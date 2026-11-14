# Handoff

**Branch:** `cc/phase-4-booking-agent` (stacked on `cc/phase-3-ai-itinerary`) · **Phase:** 4 (Providers + booking agent)

## What changed
- `lib/providers/`: `FlightProvider` / `LodgingProvider` interfaces and deterministic mock providers (seeded by the query). Flights: 8 options with real tradeoffs (nonstops at different times, 1–2 stop fares via real hubs, a red-eye, a budget carrier, an expensive fast one), fictional airlines, and times converted across time zones. Lodging: 8 hotels and Airbnb-style homes with prices, ratings, distance, amenities, and cancellation terms.
- `lib/ai/agent.ts`: `runAgent(ctx, request, emit)`. Gemini function calling (search/book tools, up to 8 iterations, thought signatures preserved), with an offline agent that parses the request, searches, filters, ranks, explains, and books when there is no key or Gemini fails. For long-haul trips it also checks the day before so you land on day one.
- `lib/bookings.ts`: writes the booking, then adds `source: "booking"` blocks to the itinerary: the last 2 h before landing, the first 2 h of the return flight, and hotel check-in/check-out. Check-in moves after landing + 90 min, and check-out before leaving for the airport, whichever was booked first.
- API: `POST /api/trips/:id/agent` streams steps over SSE and saves them to `agentRuns`; `POST /api/trips/:id/bookings/confirm` (auto-book off); `GET /api/trips/:id/bookings`; `DELETE /api/bookings/:id` (cancel, removes its blocks).
- UI: one `AgentPanel` for the Flights and Lodging tabs, with a request box and example chips, the "Let the agent book automatically" toggle (default on), a live agent log (thoughts, tool calls with arguments, results, rationale), a Confirm card, booked cards with confirmation codes and Cancel, and the options it compared with its pick highlighted.
- Planner fix: AI events are never shifted more than 4 h (they're dropped instead), so a morning sight doesn't become an evening one.

## How to verify
```
npm run seed && npm run dev
```
1. Create a city trip to Tokyo a few weeks out. On the **Flights** tab, type "cheapest direct flight from JFK arriving before noon" and click **Search with AI**. Watch the log: search, a second search a day earlier, comparison, rationale, booking. A booked card appears.
2. **Lodging** tab: "best rated hotel near the center with breakfast". It books, with check-in/out.
3. Turn auto-book off and ask again: a Confirm card appears; confirming books it.
4. **Itinerary** tab: flight and hotel blocks are on the calendar. **Generate with AI** plans around them (nothing before landing + 90 min, nothing after leaving for the airport).
5. `npm test` (57 tests, including provider determinism, request parsing, the demo request end to end, the confirm gate, the Gemini loop with a stubbed client, and fallback).

## Known gaps
- Not yet run against a real Gemini key; the Gemini loop is covered by a stubbed-client test.
- Flight and lodging data is mock (labeled "Demo data" in the footer and on the cards). A real provider adapter is a Phase 7 stretch.
- The offline agent understands common phrasings (origin, cheapest/fastest, direct, arrive by/before, leave after, passengers, hotel/Airbnb, budget, rating, amenities, near X); unusual requests fall back to "best value".

## Suggested PR title
Phase 4: Mock providers and streaming booking agent with confirm gate
