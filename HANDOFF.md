# Handoff

**Branch:** `cc/nightlife-planning` (from `main`) · **Change:** nightlife and late-evening planning

## Problem
The planner couldn't plan late nights. Post-processing dropped any non-travel event ending after 23:00, and the Gemini prompt never allowed nightlife. A Miami trip generated with "I want to go clubbing at night" got no night events.

## What changed
- **`lib/events.ts`**: one shared rule. Events must *start* on a trip day; an evening can *end* up to 03:00 the next morning, including after the last day. `tripBounds` now returns `max = endDate+1 03:00` and `lastStart = endDate+1 00:00`, and `withinTrip` checks both, so the API accepts overnight events too. Also adds `EVENING_START` (18:00), `NIGHT_END` (03:00), and `crossesMidnight()`.
- **`lib/ai/postprocess.ts`**: an event *planned* to start at or after 18:00 may run to 03:00 the next day. Daytime rules are unchanged (end by 23:00, 6 h cap, at most a 4 h shift). An event is classified by its original start, so a daytime event is never pushed into the night. Overlap resolution, per-day caps, and flight windows all still apply.
- **`lib/ai/planner.ts`** (Gemini prompt): late evening and nightlife are allowed (bars, clubs, live music, night markets, roughly 21:30–02:00), the end time is written with the next date, and the next day starts later. The traveler's request is now labeled `TRAVELER'S REQUEST (must shape the plan)`, with a rule to include it on the relevant days at the right time of day and explain it in the summary. Pace is up to 5 events on days the request needs it.
- **`lib/ai/offline-planner.ts`**: matches keywords (club, nightlife, bar, party, live music, dancing). When one matches, it adds a 22:30–01:30 "Nightlife in <place>" on most nights (skipping nights before an early travel morning or a departure day), starts the next morning later, and mentions it in the summary and highlights.
- **UI**:
  - The empty "Let AI plan your days" panel has an optional **What do you want from this trip?** box that goes with the first Generate.
  - The calendar starts at 00:00 when any event crosses midnight, so the after-midnight part shows at the top of the next day.
  - Every segment of an overnight event is labeled with its full time range, e.g. "22:30–02:00 +1".
  - If the last night runs past the trip, the morning after is shown as a shaded "after trip" column, where you can't create or drop events.
  - The event form treats an end time earlier than the start as the next day (up to 03:00) and says "Ends the next day at …". The event card shows "(next day)".
- `scripts/demo-check.ts` allows the 03:00 end bound.

## How to verify
```
npm test                                   # 84 tests
npm run dev
```
1. Create a city trip to Miami. On the Itinerary tab, type "I want to go clubbing at night" in **What do you want from this trip?** and click **Generate with AI**.
2. Expect clubbing and late-bar events ending after midnight on most nights, a later start the next day, no overlaps, and a summary that mentions the nights out. Scroll the calendar: each night shows 22:30–00:00 in its own day's column and 00:00–02:00 at the top of the next day's column, both labeled "22:30–02:00 +1".
3. Click **Export .ics**. Night events have `DTEND` on the following date in the trip's `TZID`.
4. Add your own event ending at 02:00 (end earlier than start) on the last day. The calendar shows the after-trip column.
5. `npm run demo:check -- <url> --runs 3`

## Verification done
- **Live Gemini + Atlas** (your dev server on :3000): a Miami city trip (Dec 4–7) generated with "I want to go clubbing at night" in 28 s gave 14 events. Three were club nights past midnight (22:30–02:00, 23:00–02:30, 22:30–02:00), with late starts after them, no overlaps, and a summary built around the request. The `.ics` has a `VTIMEZONE` for America/New_York, and night `DTEND`s fall on the next date. In the rendered DOM, every night segment carries its full label, and a temporary last-night event produced the "8 Tue" after-trip column; I deleted it afterwards. **The "Miami Nights" trip is still in your Atlas data.** Delete it when you're done.
- **Offline**, on a production build in file-store mode (no Atlas writes): the same request gave nightlife on all 4 nights (22:30–01:30, including the last one past the end date), no overlaps, the summary line, and correct `.ics`.
- `npm test`: 84/84. `npm run demo:check -- <offline build> --runs 3`: PASS (8.0 s, 7.2 s, 7.1 s). It wasn't run against your Atlas server because that database has no seeded demo trips; seeding would have written four demo trips into it.

## Known gaps
- The calendar still opens scrolled to 08:00, so you scroll down to see the nights.
- The offline planner only recognizes nightlife keywords; other requests ("street food", "beach day") still only shape Gemini plans.

## Suggested PR title
Nightlife planning: overnight events, request-driven plans, first-generate preferences
