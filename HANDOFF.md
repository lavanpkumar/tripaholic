# Handoff

**Branch:** `cc/phase-2-itinerary-calendar` (stacked on `cc/phase-1-trips-hub`) · **Phase:** 2 (Itinerary, no AI)

## What changed
- Events API: `GET/POST /api/trips/:id/events` (POST creates `source: "user"` events), `PATCH/DELETE /api/events/:id`. zod-validated; events must fall inside the trip dates; `source` cannot be changed; booking events cannot be re-timed.
- Itinerary tab: FullCalendar time grid limited to the trip dates (`validRange`), styled to the design. Shows the whole trip (up to 7 days, then paged by week) plus a Day view.
- Create (button or click/drag an empty slot), edit, delete, drag to move, and resize. Drag and resize save optimistically and revert with a message if the server rejects them.
- Side panel: "Selected event" card (time, location, category, source, AI reason when present) and the create/edit form. Category colors and legend match the original design.

## How to verify
```
npm run dev
```
1. Open any trip, Itinerary tab. Click an empty slot: the form opens with that time. Add an event.
2. Drag it to another day and time, resize it, edit its title. Reload: everything persisted.
3. Delete it (confirm dialog).
4. `npm run typecheck && npm test`

## Known gaps
- No AI events or summary yet (Phase 3).
- The calendar is laptop-first; on phones it scrolls horizontally inside its card.

## Suggested PR title
Phase 2: Itinerary calendar with event CRUD, drag, and resize
