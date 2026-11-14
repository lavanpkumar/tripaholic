import { GoogleGenAI, type Content, type GenerateContentConfig, type GenerateContentParameters } from "@google/genai";
import type { z } from "zod";
import { env } from "../env";

/** Gemini client + helpers. Everything AI-related goes through this module. */

const g = globalThis as unknown as { __gemini?: GoogleGenAI };

export function geminiConfigured(): boolean {
  return Boolean(env.geminiKey);
}

export function gemini(): GoogleGenAI {
  if (!env.geminiKey) throw new GeminiError("not_configured", "GEMINI_API_KEY is not set");
  if (!g.__gemini) g.__gemini = new GoogleGenAI({ apiKey: env.geminiKey });
  return g.__gemini;
}

export function geminiModel(): string {
  return env.geminiModel;
}

// ---------- errors ----------

export type GeminiErrorKind =
  | "auth" // 401/403: bad or unauthorized key
  | "rate_limit" // 429: quota or rate limit
  | "timeout" // our abort signal fired
  | "server" // 5xx
  | "grounding_unsupported" // 400 because the model rejects the search tool in this request
  | "bad_request" // any other 400
  | "invalid_output" // reply did not match the schema
  | "not_configured"
  | "unknown";

export class GeminiError extends Error {
  constructor(
    public kind: GeminiErrorKind,
    message: string,
    public status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "GeminiError";
  }

  get retryable(): boolean {
    return this.kind === "rate_limit" || this.kind === "server";
  }
}

export class GeminiOutputError extends GeminiError {
  constructor(message: string) {
    super("invalid_output", message);
    this.name = "GeminiOutputError";
  }
}

const KIND_MESSAGE: Partial<Record<GeminiErrorKind, string>> = {
  auth: "Gemini rejected the API key (check GEMINI_API_KEY)",
  rate_limit: "Gemini rate limit or quota exceeded",
  timeout: "Gemini did not respond in time",
  server: "Gemini is temporarily unavailable",
};

function statusOf(err: unknown): number | undefined {
  const s = (err as { status?: unknown } | null)?.status;
  if (typeof s === "number") return s;
  const m = String((err as Error | null)?.message ?? "").match(/\b(?:status(?: code)?:?\s*)(\d{3})\b/i);
  return m ? Number(m[1]) : undefined;
}

/** True for the 400 Gemini returns when a model cannot combine search grounding with this request. */
export function isGroundingUnsupported(message: string): boolean {
  return /\b(tool|tools|google_?search|grounding|search)\b/i.test(message) && /(unsupported|not supported|not enabled|not available|not allowed|cannot be used)/i.test(message);
}

/** Map anything thrown by the SDK (or our abort signal) to a typed GeminiError. */
export function classifyGeminiError(err: unknown): GeminiError {
  if (err instanceof GeminiError) return err;
  const name = (err as Error | null)?.name;
  const raw = String((err as Error | null)?.message ?? err);
  if (name === "TimeoutError" || name === "AbortError") return new GeminiError("timeout", KIND_MESSAGE.timeout!, undefined, { cause: err });
  const status = statusOf(err);
  let kind: GeminiErrorKind = "unknown";
  if (status === 401 || status === 403) kind = "auth";
  else if (status === 429) kind = "rate_limit";
  else if (status !== undefined && status >= 500) kind = "server";
  else if (status === 400) kind = isGroundingUnsupported(raw) ? "grounding_unsupported" : "bad_request";
  const message = KIND_MESSAGE[kind] ? `${KIND_MESSAGE[kind]}: ${raw}` : raw;
  return new GeminiError(kind, message, status, { cause: err });
}

// ---------- calls with retry ----------

type GenerateFn = (params: GenerateContentParameters) => Promise<{ text?: string }>;

export interface GeminiDeps {
  /** Defaults to the real client's models.generateContent. Injected in tests. */
  generate?: GenerateFn;
  sleep?: (ms: number) => Promise<void>;
  /** Retries after the first attempt for 429/5xx (default 2, so up to 3 calls). */
  retries?: number;
  baseDelayMs?: number;
  warn?: (...args: unknown[]) => void;
}

const defaultGenerate: GenerateFn = (params) => gemini().models.generateContent(params);
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** One logical call: bounded exponential backoff on 429/5xx, everything else thrown as a typed error. */
export async function callWithRetry<T>(fn: () => Promise<T>, deps: GeminiDeps = {}): Promise<T> {
  const retries = deps.retries ?? 2;
  const base = deps.baseDelayMs ?? 1000;
  const sleep = deps.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const e = classifyGeminiError(err);
      if (!e.retryable || attempt >= retries) throw e;
      await sleep(base * 2 ** attempt);
    }
  }
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences and stray prose). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new GeminiOutputError("Model reply was not JSON");
  }
}

export interface JsonRequest<T> {
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
 * - Invalid output: one retry with the validation error fed back, then GeminiOutputError.
 * - 429/5xx: bounded backoff (callWithRetry), then a typed GeminiError.
 * - Auth, timeout, other 400s: thrown immediately as typed GeminiErrors.
 * - Grounding: falls back to an ungrounded call only when Gemini says the search tool is
 *   unsupported for this request, and logs the original error when it does.
 */
export async function generateJson<T>(req: JsonRequest<T>, deps: GeminiDeps = {}): Promise<{ data: T; grounded: boolean }> {
  const generate = deps.generate ?? defaultGenerate;
  const warn = deps.warn ?? console.warn;
  const contents: Content[] = [{ role: "user", parts: [{ text: req.prompt }] }];
  let grounded = Boolean(req.grounding);
  let lastError = "";

  const call = (useGrounding: boolean) => {
    const config: GenerateContentConfig = {
      systemInstruction: req.system,
      temperature: req.temperature ?? 0.7,
      responseMimeType: "application/json",
      responseJsonSchema: req.jsonSchema,
      abortSignal: AbortSignal.timeout(req.timeoutMs ?? 90_000),
      ...(useGrounding ? { tools: [{ googleSearch: {} }] } : {}),
    };
    return callWithRetry(() => generate({ model: geminiModel(), contents, config }), deps);
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string | undefined;
    try {
      text = (await call(grounded)).text;
    } catch (err) {
      const e = classifyGeminiError(err);
      if (!grounded || e.kind !== "grounding_unsupported") throw e;
      warn("[gemini] Search grounding is not supported for this request; retrying without it.", e.message);
      grounded = false;
      text = (await call(false)).text;
    }
    try {
      const parsed = req.validate.safeParse(extractJson(text ?? ""));
      if (parsed.success) return { data: parsed.data, grounded };
      lastError = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
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
