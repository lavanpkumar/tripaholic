import { GoogleGenAI, type Content, type GenerateContentConfig } from "@google/genai";
import type { z } from "zod";
import { env } from "../env";

/** Gemini client + helpers. Everything AI-related goes through this module. */

const g = globalThis as unknown as { __gemini?: GoogleGenAI };

export function geminiConfigured(): boolean {
  return Boolean(env.geminiKey);
}

export function gemini(): GoogleGenAI {
  if (!env.geminiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!g.__gemini) g.__gemini = new GoogleGenAI({ apiKey: env.geminiKey });
  return g.__gemini;
}

export function geminiModel(): string {
  return env.geminiModel;
}

export class GeminiOutputError extends Error {}

/** Pull the first JSON object out of a model reply (tolerates ```json fences and stray prose). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new GeminiOutputError("Model reply was not JSON");
  }
}

interface JsonRequest<T> {
  system: string;
  prompt: string;
  /** JSON Schema handed to Gemini's structured output. */
  jsonSchema: object;
  /** zod schema the reply must pass. */
  validate: z.ZodType<T>;
  grounding?: boolean;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Structured-output call: JSON schema in, zod-validated object out.
 * Retries once with the validation error fed back to the model. If grounding is requested and the
 * model rejects the tool + schema combination, falls back to an ungrounded call.
 */
export async function generateJson<T>(req: JsonRequest<T>): Promise<{ data: T; grounded: boolean }> {
  const contents: Content[] = [{ role: "user", parts: [{ text: req.prompt }] }];
  let grounded = Boolean(req.grounding);
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const config: GenerateContentConfig = {
      systemInstruction: req.system,
      temperature: req.temperature ?? 0.7,
      responseMimeType: "application/json",
      responseJsonSchema: req.jsonSchema,
      abortSignal: AbortSignal.timeout(req.timeoutMs ?? 90_000),
      ...(grounded ? { tools: [{ googleSearch: {} }] } : {}),
    };
    let text: string | undefined;
    try {
      const res = await gemini().models.generateContent({ model: geminiModel(), contents, config });
      text = res.text;
    } catch (err) {
      if (grounded) {
        // Some models do not allow search grounding together with a response schema.
        grounded = false;
        attempt--;
        continue;
      }
      throw err;
    }
    try {
      const parsed = req.validate.safeParse(extractJson(text ?? ""));
      if (parsed.success) return { data: parsed.data, grounded };
      lastError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (err) {
      lastError = (err as Error).message;
    }
    contents.push({ role: "model", parts: [{ text: text ?? "" }] });
    contents.push({
      role: "user",
      parts: [{ text: `That reply did not match the required schema (${lastError}). Reply again with only valid JSON.` }],
    });
  }
  throw new GeminiOutputError(`Gemini returned invalid structured output twice: ${lastError}`);
}
