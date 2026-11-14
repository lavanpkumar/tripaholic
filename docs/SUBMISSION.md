# Submission

Status as of 2026-11-14. Items marked **(team)** need someone with the account or the final say.

## Checklist (PLAN.md Section 14)

- [ ] **(team)** Public URL on the GoDaddy Registry domain, served from Vultr. Ready to run: `deploy/setup.sh` (see README "Deploy"); verify with `/api/health` and `npm run demo:check -- https://<domain> --runs 3`.
- [ ] **(team)** Data stored in MongoDB Atlas: set `MONGODB_URI`, run `npm run smoke:mongo` and `npm run seed`, then screenshot the five collections (`trips`, `events`, `itinerarySummaries`, `bookings`, `agentRuns`) in Atlas.
- [x] Gemini usage described in the README (planner, agent, reasoning, grounding).
- [ ] **(team)** Run once with a real `GEMINI_API_KEY` (`npm run smoke:gemini`, then the demo flow), so the live Gemini planner and agent are exercised. Locally only the offline fallback and stubbed-client tests have run.
- [x] Agent step log visible in the UI (Flights/Lodging tabs) and persisted in `agentRuns`.
- [x] Sentient OS: not integrated (team decision; it's a sponsor only). The agent sits behind `runAgent(ctx, request, emit)`.
- [x] README with architecture diagram and demo script.
- [ ] **(team)** 2–3 minute demo video following the README demo script.
- [x] Mock data honestly labeled "Demo data".
- [ ] **(team)** Project description below (confirm the tool-usage sentence), and check the raffle opt-in.

## Project description (draft, edit before submitting)

> **Tripaholic** puts the whole trip in one hub. Tell the booking agent what matters ("cheapest direct flight from JFK, arriving before noon") and watch it work live: Gemini function calling drives search and booking tools, compares the options, explains its pick with real numbers, and books it, or waits for your one-click confirmation. A Gemini structured-output planner then fills a drag-and-drop calendar with a day-by-day itinerary. It's built around your flights and hotel, keeps to one city or routes across a state or country depending on the scope you chose, and explains every choice. Edit anything, add your own plans, and regenerate: your changes stay. Data lives in MongoDB Atlas; the app runs on a Vultr VM behind Caddy on a GoDaddy Registry domain.
>
> **How we built it:** Cursor was used to create the initial static prototype of the design. Claude Code implemented the app from a written phase-by-phase plan (Next.js, the Gemini planner and agent, MongoDB, deployment scripts, and tests), pushing one branch per phase. Grok Bot reviewed each pull request, and Claude Code addressed every review with follow-up commits. *(Team: confirm this matches what happened, e.g. who opened the PRs, before submitting.)*
