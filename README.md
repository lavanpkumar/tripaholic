# Tripaholic

Plan the whole trip in one place. A booking agent searches, compares, and books flights and stays, and Gemini plans your days on a calendar you can drag, edit, and regenerate.

## Setup

```bash
npm install
cp .env.example .env.local     # add MONGODB_URI and GEMINI_API_KEY
npm run smoke:mongo            # Atlas connection check
npm run smoke:gemini           # Gemini text + structured-output check
npm run seed                   # demo trips (planned, in progress, archived)
npm run dev                    # http://localhost:3000
```

Both keys are optional for local development. Without `MONGODB_URI` the app stores data in `.data/db.json`; without `GEMINI_API_KEY` the planner and agent run a deterministic offline mode, and the UI says so.

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run seed` | Re-creates the seeded demo trips (leaves your own trips alone) |
| `npm run smoke:mongo` / `npm run smoke:gemini` | Connectivity checks |

See `PLAN.md` for the build plan and `DECISIONS.md` for deviations from it.

## Dev workflow

Claude Code implements each phase from `PLAN.md` on its own branch (`cc/phase-<n>-<name>`), commits, pushes, and writes `HANDOFF.md` describing the change. Grok Bot opens the pull request from that handoff and reviews it; a human merges to `main`. `main` only changes through PRs.
