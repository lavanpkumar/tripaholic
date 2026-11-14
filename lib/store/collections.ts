import fs from "node:fs";
import path from "node:path";
import type { Filter as MongoFilter, UpdateFilter } from "mongodb";
import { getDb } from "../db";

/**
 * Minimal document-collection abstraction with two backends:
 *  - MongoDB Atlas (production; the official `mongodb` driver)
 *  - a JSON file in .data/ (local dev without credentials)
 * Filters are top-level equality only, which is all the app needs.
 * Documents carry a string `id`; in Mongo it is stored as `_id`.
 */

export type Doc = { id: string };
export type Filter = Record<string, unknown>;
export type Sort = Record<string, 1 | -1>;

export interface Coll<T extends Doc> {
  find(filter: Filter, sort?: Sort): Promise<T[]>;
  findOne(filter: Filter): Promise<T | null>;
  insertMany(docs: T[]): Promise<void>;
  /** Shallow-merge `patch` into the doc with this id; returns the updated doc. */
  update(id: string, patch: Partial<T>): Promise<T | null>;
  /** Append `value` to an array field. */
  push(id: string, field: keyof T & string, value: unknown): Promise<void>;
  deleteMany(filter: Filter): Promise<number>;
}

export type CollName = "trips" | "events" | "itinerarySummaries" | "bookings" | "agentRuns" | "meta";

type Rec = Record<string, unknown>;
type MongoDoc = { _id: string } & Rec;

// ---------- Mongo backend ----------

function toMongoFilter(filter: Filter): MongoFilter<MongoDoc> {
  const { id, ...rest } = filter;
  return (id === undefined ? rest : { _id: id, ...rest }) as MongoFilter<MongoDoc>;
}

function fromMongo<T extends Doc>(doc: MongoDoc | null): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest } as unknown as T;
}

export function mongoColl<T extends Doc>(name: CollName): Coll<T> {
  const coll = async () => (await getDb()).collection<MongoDoc>(name);
  return {
    async find(filter, sort) {
      const c = await coll();
      const docs = await c.find(toMongoFilter(filter), sort ? { sort } : undefined).toArray();
      return docs.map((d) => fromMongo<T>(d)!);
    },
    async findOne(filter) {
      return fromMongo<T>(await (await coll()).findOne(toMongoFilter(filter)));
    },
    async insertMany(docs) {
      if (!docs.length) return;
      await (await coll()).insertMany(
        docs.map((d) => {
          const { id, ...rest } = d as unknown as Rec & { id: string };
          return { _id: id, ...rest };
        }),
      );
    },
    async update(id, patch) {
      const { id: _ignored, ...set } = patch as unknown as Rec;
      void _ignored;
      const res = await (await coll()).findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: "after" });
      return fromMongo<T>(res);
    },
    async push(id, field, value) {
      // The driver's $push typing cannot express a dynamic field name on an open schema.
      const update = { $push: { [field]: value } } as unknown as UpdateFilter<MongoDoc>;
      await (await coll()).updateOne({ _id: id }, update);
    },
    async deleteMany(filter) {
      const res = await (await coll()).deleteMany(toMongoFilter(filter));
      return res.deletedCount;
    },
  };
}

// ---------- JSON file backend ----------

type FileData = Record<CollName, Rec[]>;
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "db.json");
const g = globalThis as unknown as { __fileDb?: FileData; __fileDbNoDisk?: boolean };

function emptyData(): FileData {
  return { trips: [], events: [], itinerarySummaries: [], bookings: [], agentRuns: [], meta: [] };
}

function load(): FileData {
  if (!g.__fileDb) {
    try {
      g.__fileDb = { ...emptyData(), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) } as FileData;
    } catch {
      g.__fileDb = emptyData();
    }
  }
  return g.__fileDb;
}

function save(): void {
  if (g.__fileDbNoDisk) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(load(), null, 1));
  fs.renameSync(tmp, DATA_FILE);
}

function matches(doc: Rec, filter: Filter): boolean {
  return Object.entries(filter).every(([k, v]) => doc[k] === v);
}

function sortDocs(docs: Rec[], sort?: Sort): Rec[] {
  if (!sort) return docs;
  const keys = Object.entries(sort);
  return [...docs].sort((a, b) => {
    for (const [k, dir] of keys) {
      const av = String(a[k] ?? "");
      const bv = String(b[k] ?? "");
      if (av !== bv) return av < bv ? -dir : dir;
    }
    return 0;
  });
}

const clone = <T>(v: T): T => structuredClone(v);

export function fileColl<T extends Doc>(name: CollName): Coll<T> {
  const docs = () => load()[name];
  const out = (d: Rec) => clone(d) as unknown as T;
  return {
    async find(filter, sort) {
      return sortDocs(docs().filter((d) => matches(d, filter)), sort).map(out);
    },
    async findOne(filter) {
      const d = docs().find((x) => matches(x, filter));
      return d ? out(d) : null;
    },
    async insertMany(newDocs) {
      docs().push(...(clone(newDocs) as unknown as Rec[]));
      save();
    },
    async update(id, patch) {
      const d = docs().find((x) => x.id === id);
      if (!d) return null;
      Object.assign(d, clone(patch), { id });
      save();
      return out(d);
    },
    async push(id, field, value) {
      const d = docs().find((x) => x.id === id);
      if (!d) return;
      const arr = (d[field] as unknown[] | undefined) ?? [];
      arr.push(clone(value));
      d[field] = arr;
      save();
    },
    async deleteMany(filter) {
      const all = docs();
      const keep = all.filter((d) => !matches(d, filter));
      const removed = all.length - keep.length;
      load()[name] = keep;
      if (removed) save();
      return removed;
    },
  };
}

/** Test helper: reset the in-memory file store and stop writing it to disk. */
export function __resetFileStoreForTests(): void {
  g.__fileDb = emptyData();
  g.__fileDbNoDisk = true;
}
