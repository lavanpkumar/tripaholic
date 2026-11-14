import { ApiError, type GenerateContentParameters } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GeminiError, GeminiOutputError, classifyGeminiError, generateJson, type GeminiDeps } from "./gemini";

const req = {
  system: "test",
  prompt: "test",
  jsonSchema: { type: "object" },
  validate: z.object({ ok: z.boolean() }),
};

const apiError = (status: number, message: string) => new ApiError({ status, message });

function deps(generate: (p: GenerateContentParameters) => Promise<{ text?: string }>) {
  const sleep = vi.fn(async (_ms: number) => {});
  const warn = vi.fn();
  const gen = vi.fn(generate);
  return { gen, sleep, warn, deps: { generate: gen, sleep, warn } satisfies GeminiDeps };
}

const usesSearch = (p: GenerateContentParameters) => Boolean(p.config?.tools?.length);

describe("generateJson error handling", () => {
  it("falls back to an ungrounded call when grounding is unsupported, and logs why", async () => {
    const t = deps(async (p) => {
      if (usesSearch(p)) throw apiError(400, "Tool use with a response mime type: 'application/json' is unsupported");
      return { text: '{"ok":true}' };
    });
    const res = await generateJson({ ...req, grounding: true }, t.deps);
    expect(res).toEqual({ data: { ok: true }, grounded: false });
    expect(t.gen).toHaveBeenCalledTimes(2);
    expect(usesSearch(t.gen.mock.calls[0][0])).toBe(true);
    expect(usesSearch(t.gen.mock.calls[1][0])).toBe(false);
    expect(t.warn).toHaveBeenCalledOnce();
    expect(String(t.warn.mock.calls[0][1])).toContain("unsupported");
  });

  it("throws a typed auth error without retrying or dropping grounding", async () => {
    const t = deps(async () => {
      throw apiError(403, "API key not valid");
    });
    const err = await generateJson({ ...req, grounding: true }, t.deps).catch((e) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err.kind).toBe("auth");
    expect(err.status).toBe(403);
    expect(t.gen).toHaveBeenCalledTimes(1);
    expect(t.sleep).not.toHaveBeenCalled();
    expect(t.warn).not.toHaveBeenCalled();
  });

  it("retries a 429 with backoff, then throws a rate_limit error", async () => {
    const t = deps(async () => {
      throw apiError(429, "Resource has been exhausted");
    });
    const err = await generateJson({ ...req, grounding: true }, t.deps).catch((e) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err.kind).toBe("rate_limit");
    expect(t.gen).toHaveBeenCalledTimes(3);
    expect(t.sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
    // Every attempt kept grounding: a rate limit is not a reason to drop the tool.
    expect(t.gen.mock.calls.every((c) => usesSearch(c[0]))).toBe(true);
  });

  it("recovers when a 5xx clears on retry", async () => {
    let n = 0;
    const t = deps(async () => {
      if (n++ === 0) throw apiError(503, "The model is overloaded");
      return { text: '{"ok":true}' };
    });
    await expect(generateJson(req, t.deps)).resolves.toEqual({ data: { ok: true }, grounded: false });
    expect(t.gen).toHaveBeenCalledTimes(2);
  });

  it("surfaces a timeout as a typed error without retrying", async () => {
    const t = deps(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    const err = await generateJson({ ...req, grounding: true }, t.deps).catch((e) => e);
    expect(err.kind).toBe("timeout");
    expect(t.gen).toHaveBeenCalledTimes(1);
  });

  it("retries once on invalid output, then throws GeminiOutputError", async () => {
    const t = deps(async () => ({ text: '{"ok":"nope"}' }));
    const err = await generateJson(req, t.deps).catch((e) => e);
    expect(err).toBeInstanceOf(GeminiOutputError);
    expect(t.gen).toHaveBeenCalledTimes(2);
  });
});

describe("classifyGeminiError", () => {
  it("keeps other 400s as bad_request", () => {
    expect(classifyGeminiError(apiError(400, "Invalid JSON payload")).kind).toBe("bad_request");
  });
  it("reads a status embedded in the message", () => {
    expect(classifyGeminiError(new Error("got status: 429 Too Many Requests")).kind).toBe("rate_limit");
  });
});
