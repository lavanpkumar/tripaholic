import "./_env";
import { closeDb, getDb, mongoConfigured } from "../lib/db";
import { env } from "../lib/env";

async function main() {
  if (!mongoConfigured()) {
    console.error("MONGODB_URI is not set. Add it to .env.local (see .env.example).");
    process.exit(1);
  }
  const started = Date.now();
  const db = await getDb();
  await db.command({ ping: 1 });
  const id = `smoke-${Date.now()}`;
  const meta = db.collection<{ _id: string; at: string }>("meta");
  await meta.insertOne({ _id: id, at: new Date().toISOString() });
  const back = await meta.findOne({ _id: id });
  await meta.deleteOne({ _id: id });
  if (!back) throw new Error("Round-trip read failed");
  const collections = (await db.listCollections().toArray()).map((c) => c.name).sort();
  console.log(`Mongo OK: db "${env.mongoDb}", ping + write/read/delete in ${Date.now() - started} ms`);
  console.log(`Collections: ${collections.join(", ") || "(none yet)"}`);
}

main()
  .catch((err) => {
    console.error("Mongo smoke test FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
