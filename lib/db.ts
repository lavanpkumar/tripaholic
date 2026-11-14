import { MongoClient, type Db } from "mongodb";
import { env } from "./env";

// Cache the client on globalThis so Next.js dev hot-reloads and separate route bundles share one pool.
const g = globalThis as unknown as { __mongo?: { client: MongoClient; db: Promise<Db> } };

export function mongoConfigured(): boolean {
  return Boolean(env.mongoUri);
}

export async function getDb(): Promise<Db> {
  if (!env.mongoUri) throw new Error("MONGODB_URI is not set");
  if (!g.__mongo) {
    const client = new MongoClient(env.mongoUri, { appName: "tripaholic", serverSelectionTimeoutMS: 8000 });
    const db = client.connect().then(async (c) => {
      const d = c.db(env.mongoDb);
      await ensureIndexes(d);
      return d;
    });
    db.catch(() => {
      // Allow a retry on the next request instead of caching a failed connection forever.
      delete g.__mongo;
    });
    g.__mongo = { client, db };
  }
  return g.__mongo.db;
}

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("trips").createIndex({ userId: 1, startDate: 1 }),
    db.collection("events").createIndex({ tripId: 1, start: 1 }),
    db.collection("bookings").createIndex({ tripId: 1 }),
    db.collection("agentRuns").createIndex({ tripId: 1 }),
    db.collection("itinerarySummaries").createIndex({ tripId: 1 }, { unique: true }),
  ]);
}

export async function closeDb(): Promise<void> {
  if (g.__mongo) {
    await g.__mongo.client.close();
    delete g.__mongo;
  }
}
