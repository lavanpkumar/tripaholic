#!/usr/bin/env bash
# Build and (re)start Tripaholic on the server. Run as root from anywhere:
#   sudo /opt/tripaholic/app/deploy/deploy.sh [branch]
set -euo pipefail

APP_DIR=/opt/tripaholic/app
BRANCH="${1:-main}"

cd "$APP_DIR"
echo "==> Updating code ($BRANCH)"
sudo -u tripaholic git fetch --quiet origin
sudo -u tripaholic git checkout --quiet "$BRANCH"
sudo -u tripaholic git pull --quiet --ff-only origin "$BRANCH"

echo "==> Installing dependencies"
sudo -u tripaholic npm ci --no-audit --no-fund

echo "==> Building"
sudo -u tripaholic npm run build

echo "==> Assembling the standalone server"
# server.js serves public/ and .next/static only if they sit next to it.
sudo -u tripaholic rm -rf .next/standalone/public .next/standalone/.next/static
sudo -u tripaholic cp -r public .next/standalone/public
sudo -u tripaholic cp -r .next/static .next/standalone/.next/static

echo "==> Restarting"
systemctl restart tripaholic

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/tmp/tripaholic-health.json 2>/dev/null; then
    echo "==> Healthy: $(cat /tmp/tripaholic-health.json)"
    grep -q '"store":"file"' /tmp/tripaholic-health.json && echo "   note: running on the local file store (no MONGODB_URI)"
    grep -q '"gemini":"offline"' /tmp/tripaholic-health.json && echo "   note: running the offline planner/agent (no GEMINI_API_KEY)"
    exit 0
  fi
  sleep 1
done
echo "!! Health check failed. Logs: journalctl -u tripaholic -n 50" >&2
exit 1
