# Handoff

**Branch:** `cc/phase-0-setup` · **Phase:** 0 (Setup)

## What changed
- Replaced the static Vite prototype with a Next.js 16 + TypeScript + Tailwind v4 app (the prototype's design assets in `public/assets` are kept and reused).
- `lib/db.ts` cached MongoDB client with index creation; `lib/store/*` repository layer with a MongoDB backend and a local JSON-file fallback.
- `lib/ai/gemini.ts` Gemini client plus a structured-output helper (JSON schema in, zod-validated object out, one retry).
- Scripts: `npm run smoke:mongo`, `npm run smoke:gemini`, `npm run seed` (demo user with planned, in-progress, and archived trips).
- `DECISIONS.md`, `.env.example`, README with setup and dev workflow.

## How to verify
```
npm install
cp .env.example .env.local   # fill MONGODB_URI and GEMINI_API_KEY
npm run smoke:mongo          # expect "Mongo OK"
npm run smoke:gemini         # expect "Text call OK" and "Structured output OK"
npm run seed
npm run dev                  # http://localhost:3000 shows which backends are active
npm run typecheck && npm test
```
Without keys, the app runs on the local file store and offline AI; the smoke tests print "not set".

## Known gaps
- Smoke tests not yet run against real Atlas/Gemini (no keys in the dev environment).
- Home page is a placeholder until Phase 1.

## Suggested PR title
Phase 0: Next.js scaffold, Mongo + Gemini helpers, seed and smoke tests
