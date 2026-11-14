import "./_env";
import { z } from "zod";
import { gemini, geminiConfigured, geminiModel, generateJson } from "../lib/ai/gemini";

async function main() {
  if (!geminiConfigured()) {
    console.error("GEMINI_API_KEY is not set. Add it to .env.local (see .env.example).");
    process.exit(1);
  }
  const model = geminiModel();
  const t0 = Date.now();
  const res = await gemini().models.generateContent({ model, contents: "Reply with exactly the word: pong" });
  console.log(`Text call OK (${model}, ${Date.now() - t0} ms): ${JSON.stringify(res.text?.trim())}`);

  const t1 = Date.now();
  const { data } = await generateJson({
    system: "You answer travel trivia as JSON.",
    prompt: "Give the IATA code of the main international airport of Tokyo and its city.",
    jsonSchema: {
      type: "object",
      properties: { iata: { type: "string" }, city: { type: "string" } },
      required: ["iata", "city"],
    },
    validate: z.object({ iata: z.string().length(3), city: z.string() }),
  });
  console.log(`Structured output OK (${Date.now() - t1} ms): ${JSON.stringify(data)}`);
}

main().catch((err) => {
  console.error("Gemini smoke test FAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
