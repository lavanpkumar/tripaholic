// Central place for environment configuration. Read lazily so scripts can load dotenv first.

export const env = {
  get mongoUri() {
    return process.env.MONGODB_URI?.trim() || "";
  },
  get mongoDb() {
    return process.env.MONGODB_DB?.trim() || "triphub";
  },
  get geminiKey() {
    return process.env.GEMINI_API_KEY?.trim() || "";
  },
  get geminiModel() {
    // The model is configured via GEMINI_MODEL (see .env.example). The fallback is only a safety net
    // so a missing var does not crash the server; it is the stable Flash model as of 2026-11.
    return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  },
  get grounding() {
    return process.env.GEMINI_GROUNDING === "true";
  },
  get providerMode() {
    return process.env.PROVIDER_MODE?.trim() === "real" ? "real" : "mock";
  },
};

export const DEMO_USER_ID = "demo-user";
