# Handoff

**Branch:** `cc/phase-3-ai-itinerary` (stacked on `cc/phase-2-itinerary-calendar`) · **Phase:** 3 (AI itinerary)

## What changed
- `lib/ai/planner.ts`: Gemini structured-output planner (JSON schema + zod, one retry). The prompt carries destination, scope, dates, bookings (flight arrival/departure, lodging), fixed user/booking events, and optional preferences. City scope stays in one city; state/country scope builds a multi-city route with explicit travel events. Optional Search grounding via `GEMINI_GROUNDING=true`.
- `lib/ai/postprocess.ts`: every plan is cleaned before saving. It drops events outside the trip and invalid ones, keeps nothing before landing + 90 min or after departure − 150 min, applies daily hours, shifts AI events off user/booking events and each other (dropping what no longer fits), and caps 5 per day.
- `lib/ai/offline-planner.ts`: deterministic fallback when there is no key or Gemini fails (auth, rate limit, timeout, bad output). The UI says which planner ran and why.
- `POST /api/trips/:id/itinerary/generate` (optional `{ preferences }`) plans first, then replaces only `source: "ai"` events, so a failed plan leaves the old one intact. `GET /api/trips/:id/itinerary/summary`.
- UI: Generate/Regenerate button with a planning overlay, a "Why this plan" panel (highlights, summary, mode badge, "Ask AI to adjust this plan…" box that regenerates with that request), and a per-event "Why I picked this" box.
- `npm run seed` now pre-plans the in-progress, archived, and one planned trip. The file store reloads when another process rewrites it, so seeding no longer needs a dev-server restart.

## How to verify
```
npm run seed && npm run dev
```
1. Open a 4-day city trip, Itinerary tab, add an event of your own, click **Generate with AI**: about 4 events per day, none overlapping, all within the trip dates; your event is untouched.
2. Click an AI event (sparkle): its reason shows. The summary panel explains the plan.
3. **Regenerate with AI** (or type a request in the ask box): AI events are replaced, your event stays.
4. Country or state trip (e.g. seeded "South coast, Sri Lanka"): events span several places with travel blocks.
5. `npm test` (29 tests: post-processing rules, user-event preservation on regenerate, Gemini path, Gemini failure fallback).

## Known gaps
- Not yet run against a real Gemini key (none in the dev environment); the Gemini path is covered by tests with a stubbed client.
- The planner reads bookings, but the booking agent arrives in Phase 4.

## Suggested PR title
Phase 3: AI itinerary planner with post-processing, summary panel, and offline fallback
