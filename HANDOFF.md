# Handoff

**Branch:** `cc/phase-6-deploy` (stacked on `cc/phase-5-polish`) · **Phase:** 6 (Deploy and sponsor requirements)

## What changed
- `deploy/setup.sh`: one-time setup of a fresh Vultr Ubuntu 24.04 VM. It installs Node 22 and Caddy, adds swap on small plans, creates a `tripaholic` system user, clones to `/opt/tripaholic/app`, and writes `/opt/tripaholic/.env` (mode 600). On the second run it does smoke tests, the systemd service, the firewall, the build, and HTTPS.
- `deploy/deploy.sh`: pull, `npm ci`, build, assemble the Next.js standalone server (copies `public/` and `.next/static`), restart, and poll `/api/health`.
- `deploy/tripaholic.service` (hardened systemd unit) and `deploy/Caddyfile` (auto HTTPS, `www` redirect, security headers, no compression and immediate flush for the agent's SSE stream).
- `GET /api/health`: store mode, database ping, Gemini configured or not. No secrets.
- README rewritten: what it does, demo script, how each sponsor technology is used, architecture diagram, local setup, deploy steps, honest notes, dev workflow. `docs/SUBMISSION.md`: checklist status and a project-description draft.

## How to verify
Locally, rehearsing the production layout:
```
npm run build
cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static
cd .next/standalone && PORT=3300 node server.js
curl localhost:3300/api/health
npm run demo:check -- http://localhost:3300
```
(Done during development: health OK, pages/CSS/assets 200, demo check PASS.) On the VM, follow README "Deploy", then run `npm run demo:check -- https://<domain> --runs 3`.

## Known gaps (need the team's accounts)
- Vultr VM not created, GoDaddy domain not registered or pointed, Atlas not connected, and no Gemini key run yet. All the steps are scripted in README "Deploy" and listed in `docs/SUBMISSION.md`.
- The production seed (`npm run seed` on the VM) is one command once Atlas is connected.

## Suggested PR title
Phase 6: Vultr deploy scripts, Caddy/systemd config, health check, README and submission notes
