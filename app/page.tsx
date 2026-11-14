import { connection } from "next/server";
import Shell from "@/components/Shell";
import { geminiConfigured } from "@/lib/ai/gemini";
import { storeMode } from "@/lib/store";

// Phase 0 placeholder: confirms the app boots and shows which backends are active.
export default async function Home() {
  await connection();
  return (
    <Shell>
      <section className="py-14">
        <p className="eyebrow">Setup</p>
        <h1 className="mt-3 text-[42px] font-semibold">Tripaholic is running</h1>
        <ul className="mt-6 space-y-2 text-sm text-muted">
          <li>Data store: <strong className="text-ink">{storeMode() === "mongo" ? "MongoDB Atlas" : "local JSON file (.data/db.json)"}</strong></li>
          <li>Gemini: <strong className="text-ink">{geminiConfigured() ? "configured" : "not configured (offline mode)"}</strong></li>
        </ul>
      </section>
    </Shell>
  );
}
