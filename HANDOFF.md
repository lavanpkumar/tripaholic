# Handoff

**Branch:** `cc/phase-7-stretch` (stacked on `cc/phase-6-deploy`) · **Phase:** 7 (Stretch)

## What changed
- **Export .ics**: `GET /api/trips/:id/itinerary/ics` and an "Export .ics" button on the itinerary. Events are written in the destination time zone (`TZID`), with RFC 5545 escaping and line folding; AI reasons and booking notes go in the description.
- **Show me another option**: the Confirm booking card (auto-book off) can re-run the same request with the rejected pick excluded. Excluded ids are filtered out of search results before the Gemini or offline agent sees them, so they can't be proposed or booked again. The log notes how many were hidden.
- Mock homes list Kitchen/Washer first so the card always shows them.
- Not done: the Sentient OS wrapper (dropped by the team) and the real flight sandbox (needs credentials). Search grounding already exists (`GEMINI_GROUNDING=true`).

## How to verify
1. Itinerary tab of any planned trip → **Export .ics** → import into Google Calendar: times match the calendar in the destination's zone.
2. Lodging tab, auto-book off: "cheapest hotel" → **Show me another option** → a different property is proposed; the first is not in the compared list.
3. `npm test` (67 tests, including .ics escaping/folding and the exclusion flow).

## Known gaps
- Same as Phase 6: deploy, Atlas, and a live Gemini run need the team's accounts (see `docs/SUBMISSION.md`).

## Suggested PR title
Phase 7: Itinerary .ics export and "show me another option" for the booking agent
