import { connection } from "next/server";
import { geminiConfigured } from "@/lib/ai/gemini";
import { getDb } from "@/lib/db";
import { storeMode } from "@/lib/store";

/** Deploy health check: which backends are active and whether the database answers. No secrets. */
export async function GET() {
  await connection();
  const store = storeMode();
  let db: "ok" | "error" | "file" = "file";
  if (store === "mongo") {
    try {
      await (await getDb()).command({ ping: 1 });
      db = "ok";
    } catch {
      db = "error";
    }
  }
  const ok = db !== "error";
  return Response.json({ ok, store, db, gemini: geminiConfigured() ? "configured" : "offline" }, { status: ok ? 200 : 503 });
}
