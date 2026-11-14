# Handoff

**Branch:** `cc/phase-1-trips-hub` (stacked on `cc/phase-0-setup`) · **Phase:** 1 (Trips hub)

## What changed
- Trip CRUD API (`/api/trips`, `/api/trips/:id`) with zod validation and consistent `{ error }` responses; status is derived (planned / in progress / archived) in the destination time zone.
- Home page with Planned, In-progress, and Archived columns in the original design (date-chip cards, live progress card, archived card), plus empty and load-error states.
- New Trip dialog as a required 3-step flow: location with autocomplete (Open-Meteo geocoding + built-in states/countries), then City / State / Country, then title (auto-suggested) and dates. Next is blocked until each step is valid.
- Trip page `/trips/:id` with header (scope and status chips, local GMT offset), Archive/Unarchive/Delete, and Flights / Lodging / Itinerary icon tabs (stub content).
- `lib/geo.ts` gazetteer (airports, countries/states with multi-city routes) used later by the mock provider and offline planner.

## How to verify
```
npm run seed && npm run dev
```
1. Home shows 2 planned, 1 in-progress, 1 archived seeded trip.
2. New Trip: Next is disabled with an empty location; type "Tokyo", pick "Tokyo, Japan", Next; Next is disabled until City/State/Country is chosen; title is pre-filled; create; you land on the trip page.
3. Create trips with past, current, and future dates: each lands in the right column. Archive a planned trip: it moves to Archived.
4. `npm run typecheck && npm test`

## Known gaps
- Tab content is stubbed until Phases 2 and 4.
- Changing trip dates after creation is API-only (no UI yet).

## Suggested PR title
Phase 1: Trips hub with 3-step New Trip flow and derived trip status
