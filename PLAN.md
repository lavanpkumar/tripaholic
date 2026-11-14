# Trip Hub: Build Plan (for Claude Code)
 
## 0. How to use this file
 
Read this whole file before writing code. Execute the phases in order. Each phase has a checklist and an acceptance test; do not start the next phase until the current one passes its acceptance test. Make reasonable decisions yourself instead of asking questions, and note any deviation in `DECISIONS.md` (one line each).
 
This is a hackathon project: **a working end-to-end demo beats completeness**. When forced to choose, protect the demo flow in Section 11.
 
---
 
## 1. Product
 
### Problem
When booking a trip with AI, users have to arrange every part themselves. AI agents can book hotels and flights, but they don't plan the whole trip neatly, and customizing the plan means typing into a chatbox. The solution is a single hub with all the parts together: an agent that handles bookings and a separate AI that plans the trip in a neat, intuitive way, all without the user leaving the site.
 
### Page 1: Trips (home)
- **Planned Trips**: start date is in the future.
- **In-Progress Trips**: the trip's start date has arrived and the end date has not passed.
- **Archived Trips**: the trip is over, or the user archived it.
- A "New Trip" button starts the **New Trip flow**, which ends by creating the trip and opening Page 2:
  1. **Step 1: Location.** The user must type in a location (required; cannot continue with an empty field). Use a place autocomplete or free-text field that resolves to a real place name.
  2. **Step 2: Scope.** After the location is entered, the app asks whether the user wants to travel the **city**, the **country**, or the **state**. The user picks exactly one of these three options (required).
  3. **Step 3: Details.** Trip title (auto-suggested from the location, editable) and start/end dates.
  4. On submit, the trip is created and the user lands on Page 2.
  - The chosen scope shapes everything downstream: a **city** trip plans events within that one city; a **state** trip plans across multiple cities/regions within the state; a **country** trip plans across multiple cities/regions within the country, with realistic travel time between them.
### Page 2: Trip page (after creating a trip)
Three icons/tabs: **Flights**, **Lodging**, **Itinerary**.
 
**Itinerary**
- AI looks up suggested things to do at the trip location.
- AI creates a list of events and inserts them into a Google Calendar-style view spanning the trip start date to end date.
- AI gives a summary of why it chose what it chose.
- User can **delete** events, **move** events around (drag/resize), and **create their own** events.
**Flights**
- User books a flight through here.
- AI searches for the ideal flight. The **agent must be able to complete a booking**.
**Lodging**
- User books a hotel or Airbnb through here.
- AI searches for different places to stay. The **agent must be able to complete a booking**.
---
 
## 2. Hackathon targets (sponsor tracks)
 
| Track | How this project earns it | Must-have evidence |
|---|---|---|
| **Best Agentic Hack (Sentient OS)** (main) | One booking agent that takes a natural-language request, searches, chooses, and books flights and lodging via tool calls | Visible agent step log in the UI (tool calls and results), real booking records written to the DB |
| **Best Use of Gemini API** (main) | Gemini powers the itinerary planner (structured output), the agent's reasoning/tool calling, and the "why I chose this" summaries | Gemini used in 3+ distinct ways, not a single prompt |
| **Best Use of MongoDB Atlas** | All app data lives in Atlas | Atlas connection in production, indexes defined |
| **Best Use of Vultr** | Production deployment runs on Vultr | Live URL on Vultr |
| **Best Domain Name from GoDaddy Registry** | Custom travel-themed domain pointing to the Vultr deployment | Domain resolves to the live app |
 
**Sentient OS note:** I do not have verified documentation for how Sentient OS is meant to be integrated. In Phase 0, look up the sponsor's docs or hackathon resources. If there is an SDK or framework for building agents, wrap the booking agent in it. If it is unclear, build the agent loop natively (Section 6) behind a clean interface so Sentient OS can be slotted in without rewriting anything. Record what you found in `DECISIONS.md`.
 
---
 
## 3. Tech stack
 
- **Framework:** Next.js (App Router) + TypeScript, single repo, API routes for the backend.
- **UI:** Tailwind CSS + shadcn/ui.
- **Calendar:** FullCalendar (`@fullcalendar/react`, `daygrid`, `timegrid`, `interaction`) for the Google Calendar-style drag/drop/resize view.
- **DB:** MongoDB Atlas via the official `mongodb` driver (or Mongoose if you prefer; pick one and stay consistent).
- **AI:** Google Gemini via the `@google/genai` SDK. Model name comes from `GEMINI_MODEL` env var (verify the current recommended fast model in the docs; don't hardcode).
- **Validation:** `zod` for all API inputs and for validating Gemini structured output.
- **Auth:** keep it minimal. A simple demo user (single hard-coded user ID or an anonymous cookie session) is fine. Do not spend time on real auth.
- **Deploy:** Vultr (Cloud Compute VM or Vultr's app platform), Node process behind a reverse proxy (Caddy for automatic HTTPS), plus a GoDaddy Registry domain.
---
 
## 4. Architecture
 
```
Browser (Next.js UI)
   |
Next.js API routes
   |-- /api/trips ................ CRUD
   |-- /api/trips/:id/itinerary .. generate + event CRUD
   |-- /api/trips/:id/agent ...... booking agent (streams step events)
   |
   |-- lib/ai/planner.ts ......... Gemini structured-output itinerary generation
   |-- lib/ai/agent.ts ........... agent loop (Gemini function calling)  <- Sentient OS wrapper goes here if applicable
   |-- lib/providers/
   |      flights.ts / lodging.ts  interface + MockProvider (+ optional real provider)
   |
MongoDB Atlas
```
 
**Provider abstraction is critical.** The agent only ever calls `FlightProvider` / `LodgingProvider` interfaces. Ship `MockProvider` first (realistic seeded data, deterministic). A real provider (e.g., Duffel/Amadeus for flights) is a stretch goal only if API access is quick to get.
 
---
 
## 5. Data model (MongoDB collections)
 
```ts
// trips
{
  _id, userId,
  title: string,                 // "Tokyo Spring Trip"
  destination: {
    name: string,                // location the user typed in, e.g. "Tokyo"
    scope: "city" | "state" | "country",   // chosen in New Trip flow Step 2 (required)
    lat?: number, lng?: number,
    timezone: string
  },
  startDate: string,             // YYYY-MM-DD
  endDate: string,               // YYYY-MM-DD
  archived: boolean,             // manual archive flag
  createdAt, updatedAt
}
// status is DERIVED, not stored:
//   archived || today > endDate  -> "archived"
//   today >= startDate           -> "in_progress"
//   else                         -> "planned"
 
// events  (itinerary)
{
  _id, tripId,
  title: string,
  description?: string,
  start: string,                 // ISO datetime
  end: string,                   // ISO datetime
  location?: string,
  category?: "food"|"sight"|"activity"|"travel"|"lodging"|"other",
  source: "ai" | "user" | "booking",   // "booking" = auto-added flight/lodging blocks
  aiReason?: string,             // per-event "why I chose this"
  createdAt, updatedAt
}
 
// itinerarySummaries
{ _id, tripId, summary: string, generatedAt }   // overall "why I chose what I chose"
 
// bookings
{
  _id, tripId,
  type: "flight" | "lodging",
  status: "confirmed",
  provider: "mock" | string,
  confirmationCode: string,
  details: object,               // flight legs OR property info, dates, price
  priceTotal: number, currency: string,
  bookedBy: "agent" | "user",
  createdAt
}
 
// agentRuns  (for the step log and demo)
{ _id, tripId, kind: "flight"|"lodging", userRequest: string,
  steps: [{ type: "thought"|"tool_call"|"tool_result"|"final", content: any, at: string }],
  createdAt }
```
 
Indexes: `trips(userId, startDate)`, `events(tripId, start)`, `bookings(tripId)`, `agentRuns(tripId)`.
 
---
 
## 6. AI design
 
### 6.1 Itinerary planner (`lib/ai/planner.ts`), Gemini
Input: destination (including `scope`), dates, existing bookings (flight arrival/departure times, lodging location), existing user-created events, optional preferences.
 
Use Gemini **structured output** (JSON schema), validate with zod, retry once on invalid output.
 
Output schema:
```ts
{
  summary: string,           // overall explanation of the plan and why it was chosen
  events: [{
    title, description, location,
    start, end,              // ISO, inside trip dates, in destination timezone
    category,
    reason                   // 1-2 sentences: why this was chosen
  }]
}
```
 
Rules to enforce in the prompt AND in post-processing code:
- All events fall within `startDate`..`endDate`.
- No overlaps between events; respect booked flight arrival/departure times (don't schedule things before landing or after departure).
- Reasonable daily pacing (roughly 2-4 events per day; mornings/evenings sensible; meals at mealtimes).
- Respect `destination.scope`: `city` keeps every event inside that city; `state` and `country` spread events across multiple cities/regions within that state or country, grouping each day's events geographically and leaving realistic time for travel between places. The summary should explain how the scope shaped the plan.
- Never overwrite or remove `source: "user"` events; plan around them.
- Post-process: clamp or drop invalid events, resolve overlaps, assign `source: "ai"`.
Grounding: if Gemini's Google Search grounding tool is available in the SDK, enable it so suggestions reflect real places. Otherwise, rely on model knowledge and keep descriptions general. Do not invent precise opening hours or prices.
 
"Regenerate" must replace only `source: "ai"` events, never user events.
 
### 6.2 Booking agent (`lib/ai/agent.ts`), Gemini function calling
A tool-calling loop (max ~8 iterations) with these tools:
 
| Tool | Args | Returns |
|---|---|---|
| `search_flights` | origin, destination, departDate, returnDate?, passengers, preferences? | list of flight options |
| `book_flight` | optionId | booking confirmation |
| `search_lodging` | location, checkIn, checkOut, guests, budget?, type? ("hotel"/"airbnb"), preferences? | list of properties |
| `book_lodging` | propertyId, checkIn, checkOut, guests | booking confirmation |
 
Behavior:
- Agent receives the trip context (destination, scope, dates) plus the user's free-text request ("cheapest direct flight from JFK, arriving before noon").
- For `state` and `country` scopes, the agent chooses a sensible arrival city/airport and a sensible base city for lodging, and states that choice in its explanation.
- It searches, compares, **picks the best option, explains the pick in plain language, then calls the booking tool**.
- Every thought, tool call, and tool result is appended to `agentRuns.steps` and **streamed to the UI** (SSE or chunked response) so the step log renders live. This visible log is the core evidence for the agentic track.
- **Safety gate (simple):** before the book_* tool executes, the UI shows a one-click "Confirm booking" card with the agent's chosen option. (The agent proposes, the user confirms.) Add a toggle "Let agent book automatically" so the demo can show full autonomy. Default: auto-book ON for the demo, confirm card available.
- On successful booking: write to `bookings`, and create a `source: "booking"` event on the itinerary (flight blocks at departure/arrival times, lodging check-in/check-out).
Keep the agent behind `runAgent(ctx, request, emit)` so a Sentient OS wrapper can replace the internals without changing callers.
 
### 6.3 Gemini usage summary (for the judging narrative)
1. Structured itinerary generation
2. Function-calling booking agent
3. Reasoned summaries ("why I chose this") for events, flights, and lodging
4. (Optional) Google Search grounding for real places
---
 
## 7. Providers
 
```ts
interface FlightProvider {
  search(q: FlightQuery): Promise<FlightOption[]>;
  book(optionId: string, passenger: Passenger): Promise<Booking>;
}
interface LodgingProvider {
  search(q: LodgingQuery): Promise<LodgingOption[]>;
  book(propertyId: string, stay: StayDetails): Promise<Booking>;
}
```
 
**MockProvider requirements:**
- Generate 6-10 realistic options per search, seeded from the query so results are stable between runs.
- Flights: airline, flight numbers, departure/arrival times, duration, stops, price. Include variety (cheapest, fastest, one with a layover, one red-eye) so the agent has real tradeoffs to reason about.
- Lodging: name, type (hotel/airbnb), neighborhood, rating, nightly price, amenities, distance to center. Include variety.
- `book()` returns a confirmation code and persists nothing on its own (the caller writes the booking record).
- Clearly label mock data in the UI footer ("Demo data") so it is honest.
**Stretch:** a real provider adapter for flights (e.g., Duffel test mode or Amadeus self-service sandbox) behind the same interface, enabled by env var. Only attempt after Phase 5.
 
---
 
## 8. Pages and components
 
```
/                         Trips home: three sections (Planned / In Progress / Archived), TripCard, NewTripDialog
                          NewTripDialog is a 3-step flow: (1) required location text input,
                          (2) required scope choice: City / State / Country, (3) title + dates. Back button between steps.
/trips/[id]               Trip page: header (title, destination, dates), 3 icon tabs
  ?tab=itinerary          CalendarView (FullCalendar), EventDrawer (edit/create), SummaryPanel (AI reasoning), Generate/Regenerate button
  ?tab=flights            AgentPanel (request box + live step log + confirm card), BookedFlightCard(s)
  ?tab=lodging            AgentPanel (same component, kind="lodging"), BookedLodgingCard(s)
```
 
UI requirements:
- **Itinerary calendar:** week/day time-grid across the trip's date range only (`validRange` = trip dates). Events draggable and resizable; click empty slot to create; click event to edit or delete. Persist changes optimistically via `PATCH /api/events/:id`.
- AI events and user events visually distinct (e.g., a small sparkle badge on AI events). Clicking an AI event shows its `aiReason`.
- `SummaryPanel` shows the overall summary beside the calendar.
- Flights and Lodging tabs share one `AgentPanel` component. Step log renders each step as a row (thought / tool call with args / result summary).
- Empty, loading, and error states for every view. Loading skeleton during generation (itinerary generation can take several seconds).
- Responsive enough for a laptop-projector demo; mobile polish is low priority.
- Clean, modern travel aesthetic. Pick one accent color and one font pairing; avoid default-template look.
---
 
## 9. API routes
 
```
GET    /api/trips                       list (with derived status)
POST   /api/trips                       create
GET    /api/trips/:id                   get
PATCH  /api/trips/:id                   update (incl. archived)
DELETE /api/trips/:id                   delete
 
GET    /api/trips/:id/events            list
POST   /api/trips/:id/events            create user event
PATCH  /api/events/:id                  move/resize/edit
DELETE /api/events/:id                  delete
 
POST   /api/trips/:id/itinerary/generate   run planner; replaces only source:"ai" events; saves summary
GET    /api/trips/:id/itinerary/summary
 
POST   /api/trips/:id/agent             body: { kind, request, autoBook } -> streams steps (SSE)
POST   /api/trips/:id/bookings/confirm  body: { runId, optionId } (used when autoBook is off)
GET    /api/trips/:id/bookings
```
 
All inputs validated with zod. Return consistent `{ error: string }` on failure.
 
---
 
## 10. Phases
 
### Phase 0: Setup (≈ first hour)
- [ ] Scaffold Next.js + TS + Tailwind + shadcn/ui; git init; `.env.example`.
- [ ] Create MongoDB Atlas cluster connection helper (`lib/db.ts`) with cached client.
- [ ] Gemini client helper (`lib/ai/gemini.ts`) and a smoke-test script that returns a response.
- [ ] Look up Sentient OS integration docs; record findings in `DECISIONS.md`.
- [ ] Seed script for a demo user and two sample trips.
**Accept:** `npm run dev` runs; smoke tests for Mongo and Gemini both pass.
 
### Phase 1: Trips hub
- [ ] Trip CRUD API + derived status logic (with unit tests for the three statuses and boundary dates).
- [ ] Home page with three sections, TripCard.
- [ ] NewTripDialog as a 3-step flow: (1) location is required, (2) after the location is entered, ask whether the user wants to travel the **city**, **state**, or **country** (required single choice), (3) title and start/end dates. Block "Next" until the current step is valid. Save `destination.scope` on the trip, and show the scope on TripCard and the trip header.
- [ ] Creating a trip routes to `/trips/[id]` with the three icon tabs (stub content).
**Accept:** create trips with past, current, and future dates; each appears in the correct section; archiving moves it. Clicking New Trip forces a location entry, then asks city/state/country, and cannot be skipped; the chosen scope is saved and displayed.
 
### Phase 2: Itinerary (no AI yet)
- [ ] Events CRUD API.
- [ ] FullCalendar view limited to the trip dates; create, edit, delete, drag, resize all persist and survive refresh.
**Accept:** manually build a day of events; reload; everything persisted.
 
### Phase 3: AI itinerary
- [ ] Planner with structured output, zod validation, post-processing rules (Section 6.1).
- [ ] Generate and Regenerate button with loading state; `SummaryPanel`; per-event reason display.
- [ ] Regenerate keeps user events untouched.
**Accept:** generating for a 4-day trip yields non-overlapping events in range with reasons and a summary (a city-scope trip stays in one city; a country- or state-scope trip spans multiple places); user-created events survive regeneration; dragging an AI event persists.
 
### Phase 4: Providers + booking agent
- [ ] Provider interfaces + MockProvider (flights and lodging).
- [ ] Agent loop with the four tools; step events persisted to `agentRuns`.
- [ ] SSE streaming endpoint; `AgentPanel` with live step log, confirm card, auto-book toggle.
- [ ] Booking persistence; booked flight/lodging shown in their tabs; booking events auto-added to the itinerary calendar.
**Accept:** typing "cheapest direct flight from JFK arriving before noon" results in a visible search, comparison, rationale, booking record, and a flight block on the calendar. Same for lodging.
 
### Phase 5: Integration polish
- [ ] Planner reads bookings so events respect flight times and lodging location.
- [ ] Booking events cannot be accidentally deleted without a warning.
- [ ] Error handling: Gemini failure, invalid structured output, tool errors (agent recovers or reports clearly).
- [ ] Visual polish pass; empty states; skeleton loaders.
**Accept:** run the full Demo Flow (Section 11) three times in a row without errors.
 
### Phase 6: Deploy and sponsor requirements
- [ ] Deploy to a Vultr instance (Node + Caddy for HTTPS, process manager like PM2 or systemd), env vars set, Atlas network access allows the Vultr IP.
- [ ] Register the GoDaddy Registry domain; point DNS to the Vultr IP; verify HTTPS.
- [ ] README with: what it is, architecture diagram, how each sponsor tech is used, setup steps, demo script.
- [ ] Seed production with a demo account and a pre-built archived trip and in-progress trip so the home page looks full.
**Accept:** public URL on the custom domain works end to end.
 
### Phase 7: Stretch (only if time remains, in this order)
1. Sentient OS wrapper around the agent (if not already done in Phase 4).
2. Google Search grounding for itinerary suggestions.
3. Real flight provider sandbox adapter.
4. Export itinerary to `.ics`.
5. Agent suggests alternatives if the user rejects the confirm card.
---
 
## 11. Demo flow (protect this above everything)
 
1. Home page shows planned, in-progress, and archived trips (pre-seeded).
2. Click **New Trip**: type "Tokyo" as the location, choose **City** when asked city/state/country, set dates a few days out.
3. **Flights** tab: type a request; watch the agent search, compare, explain, and book. Confirmation appears.
4. **Lodging** tab: same, with a hotel booked near the destination.
5. **Itinerary** tab: click Generate; calendar fills with events planned around the booked flights and hotel; open the summary to show the AI's reasoning.
6. Drag an event to a new time, delete one, add one of your own. Click **Regenerate** to show the user event is preserved.
7. Return home: the new trip appears under Planned.
Total target time: under 3 minutes.
 
---
 
## 12. Environment variables (`.env.example`)
 
```
MONGODB_URI=
MONGODB_DB=triphub
GEMINI_API_KEY=
GEMINI_MODEL=
NEXT_PUBLIC_APP_URL=
PROVIDER_MODE=mock          # mock | real
# Optional, only for stretch real provider:
FLIGHT_API_KEY=
FLIGHT_API_SECRET=
```
 
Never commit real secrets.
 
---
 
## 13. Quality rules
 
- TypeScript strict mode; no `any` without a comment explaining why.
- Every API route validates input with zod and handles errors.
- Unit tests for: trip status derivation, planner post-processing (range clamp, overlap resolution, user-event preservation), provider determinism. Do not write exhaustive tests for UI.
- Commit after each phase with a clear message.
- Keep `DECISIONS.md` current.
- If something is blocked (e.g., a missing API key), stub it behind its interface, finish the rest, and list the blocker at the top of `DECISIONS.md`.
---
 
## 14. Submission checklist
 
- [ ] Public URL on the custom GoDaddy Registry domain, served from Vultr
- [ ] Data stored in MongoDB Atlas (screenshot of collections for submission)
- [ ] Gemini API usage clearly described in README (planner, agent, reasoning)
- [ ] Agent step log visible in the UI and shown in the demo
- [ ] Sentient OS integration documented (or a clear note on how the agent interface maps to it)
- [ ] README with architecture diagram and demo script
- [ ] 2-3 minute demo video following Section 11
- [ ] Mock data honestly labeled as demo data
- [ ] Project description states plainly how Cursor, Claude Code, and Grok Bot were each used (for the SpaceXSI raffle), and the raffle opt-in is checked
---
 
## 15. Dev workflow: Claude Code + Grok Bot
 
Claude Code (you) writes the code. Grok Bot is a separate teammate that handles the pull request side of the GitHub repo. Keep the roles clean so they never collide.
 
### Roles
| Who | Does | Does not |
|---|---|---|
| **Claude Code** | Implements each phase, writes tests, commits, pushes feature branches | Merge to `main`; open PRs if Grok Bot is handling them |
| **Grok Bot** | Opens a PR from each pushed branch, writes the PR description, runs a review pass, leaves review comments | Edit code on Claude Code's branches |
| **Human (the user)** | Final merge to `main` after checking each PR | |
 
### Branches and commits
- One branch per phase or feature, named `cc/phase-<n>-<short-name>` (e.g., `cc/phase-2-itinerary-calendar`). Any branch Grok Bot creates itself uses the prefix `grok/`.
- Small commits with clear messages. Push the branch at the end of each phase (and any time a meaningful chunk is done).
- Never push directly to `main`. Branch from the latest `main` and rebase if `main` moved.
- Each phase's PR should contain only that phase's changes.
### Handoff to Grok Bot (after every phase)
When a phase's acceptance test passes and the branch is pushed, write `HANDOFF.md` (overwrite it each time) in the repo root containing:
1. Branch name and which phase it covers
2. A 3-6 bullet summary of what changed
3. How to run and verify it (commands, env vars needed, what to click)
4. Known gaps or TODOs
5. Suggested PR title
Grok Bot uses this file to open the PR and write the description. Do not put secrets in it.
 
### PR conventions (give these to Grok Bot)
- PR title follows the suggested title in `HANDOFF.md`.
- Description sections: **What changed**, **How to test**, **Screenshots or notes**, **Known gaps**.
- Review pass should check: type errors, missing input validation on new API routes, secrets in the diff, and whether the phase's acceptance test is described and reproducible.
- Grok Bot comments on the PR; it does not push commits to the branch. Claude Code addresses comments with new commits on the same branch.
### Setup (do in Phase 0)
- [ ] Create the GitHub repo; protect `main` (require a PR, no direct pushes).
- [ ] Confirm Grok Bot can reach the repo and open a PR. I could not verify that Grok Bot has a native GitHub integration; it may work through GitHub's web interface instead. Run a test with a throwaway branch and PR, and record the result in `DECISIONS.md`.
- [ ] **Fallback:** if Grok Bot cannot reliably open PRs, Claude Code opens them with the `gh` CLI, and Grok Bot is limited to reviewing them. Note the change in `DECISIONS.md` and in the project description so the write-up stays accurate.
- [ ] Add `HANDOFF.md` to the repo and a short "Dev workflow" paragraph to the README describing this setup.
### Honest description for the submission
In the project description, say specifically what each tool did, for example: "Cursor was used as the main environment for [X], Claude Code implemented [Y] from a written plan, and Grok Bot opened and reviewed the pull requests for each phase." Only claim what actually happened.
 
