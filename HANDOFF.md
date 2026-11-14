# Handoff

**Branch:** `cc/phase-7-stretch` (stacked on `cc/phase-6-deploy`) · **Phase:** 7 (Stretch)

## What changed
- **Export .ics**: `GET /api/trips/:id/itinerary/ics` and an "Export .ics" button on the itinerary. Events are written in the destination time zone (`TZID`) with a matching generated `VTIMEZONE` (real DST transitions), plus RFC 5545 escaping and line folding. AI reasons and booking notes go in the description.
- **Show me another option**: the Confirm booking card (auto-book off) can re-run the same request with the rejected pick excluded by its stable key (same property or same flight across searches), filtered out of search results before the Gemini or offline agent sees them. The log notes how many were hidden. Mock providers now keep property/flight identity stable across queries.
- Mock homes list Kitchen/Washer first so the card always shows them.
- Not done: the Sentient OS wrapper (dropped by the team) and the real flight sandbox (needs credentials). Search grounding already exists (`GEMINI_GROUNDING=true`).

## How to verify
1. Itinerary tab of any planned trip → **Export .ics** → import into Google Calendar and Outlook: times match the calendar in the destination's zone. The file contains a `VTIMEZONE` whose `TZID` matches every event's.
2. Lodging tab, auto-book off: "cheapest hotel" → **Show me another option** → a different property is proposed; the first is not in the compared list.
3. `npm test` (73 tests: .ics VTIMEZONE/DST, escaping and folding, and exclusion surviving a re-search with different dates, guests, or passengers).

## Known gaps
- Same as Phase 6: deploy, Atlas, and a live Gemini run need the team's accounts (see `docs/SUBMISSION.md`).

## Suggested PR title
Phase 7: Itinerary .ics export and "show me another option" for the booking agent
