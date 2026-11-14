# Handoff

**Branch:** `cc/phase-5-polish` (stacked on `cc/phase-4-booking-agent`) · **Phase:** 5 (Integration polish)

## What changed
- `npm run demo:check -- <baseUrl> --runs 3`: runs the PLAN.md Section 11 demo flow over HTTP against a running server. It checks the home sections, creates a Tokyo city trip, has the agent book a flight and a hotel, generates the itinerary (no AI event before landing, overlapping a booking, or outside the trip), moves, deletes, and adds events, regenerates (the user event survives), checks Planned on home, then cleans up.
- Error boundary (`app/error.tsx`) with retry, and skeleton loaders for the home and trip pages (`loading.tsx`).
- Itinerary: when a new booking collides with AI suggestions planned earlier, a banner offers "Replan around bookings" (regenerates, keeping user events).
- Already in place from earlier phases and re-verified here: the planner reads bookings; deleting a booking block warns first; Gemini failures fall back with a visible notice; agent tool errors are reported in the log; the production build compiles and the agent log streams live under `next start`.

## How to verify
```
npm run seed
npm run dev                                   # or: npm run build && npm start
npm run demo:check -- http://localhost:3000 --runs 3
```
Expected: `PASS: 3 run(s), ...`. Locally (offline mode) each run takes about 9 s.

## Known gaps
- Demo check run in offline mode only (no Gemini key here). With a key, rerun it: Gemini runs take longer but use the same checks.
- No browser-level E2E test suite; UI was checked with headless Edge screenshots during development.

## Suggested PR title
Phase 5: Demo-flow acceptance script, error and loading states, replan prompt
