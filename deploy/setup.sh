#!/usr/bin/env bash
# One-time setup of a fresh Vultr Ubuntu 24.04 server for Tripaholic. Run as root:
#   curl -fsSL https://raw.githubusercontent.com/lavanpkumar/tripaholic/main/deploy/setup.sh -o setup.sh
#   sudo bash setup.sh your-domain.example [repo-url] [branch] [--strict]
#
# First run: installs Node 22 and Caddy, creates a `tripaholic` system user, clones the repo to
# /opt/tripaholic/app, writes /opt/tripaholic/.env from .env.example, and stops so you can fill it.
# Second run: checks, build, systemd service, firewall, HTTPS.
#
# Missing keys do not block a deploy (the app has fallbacks); they are reported:
#   - no GEMINI_API_KEY, or the Gemini check fails -> offline planner/agent mode
#   - no MONGODB_URI -> local file store in $DATA_DIR (kept across deploys), not Atlas
# A MONGODB_URI that is set but fails its check is always fatal (the app would return errors).
# --strict makes both fallbacks fatal too: use it for the final pre-submission deploy.
set -euo pipefail

STRICT=0
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
DOMAIN="${POSITIONAL[0]:?usage: setup.sh <domain> [repo-url] [branch] [--strict]}"
REPO="${POSITIONAL[1]:-https://github.com/lavanpkumar/tripaholic.git}"
BRANCH="${POSITIONAL[2]:-main}"
ROOT=/opt/tripaholic
ENV_FILE="$ROOT/.env"
DATA_DIR="$ROOT/data"

warn() { echo "!! $*"; }
fail() { echo "!! $*" >&2; exit 1; }
# Value of KEY in the env file (last assignment wins; surrounding spaces and quotes stripped).
# Always succeeds (empty output if unset), so it is safe under set -euo pipefail.
env_value() { { grep -E "^$1=" "$ENV_FILE" || true; } | tail -1 | cut -d= -f2- | sed -e 's/^[[:space:]"]*//' -e 's/[[:space:]"]*$//'; }

echo "==> Base packages"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git ufw

if ! command -v node >/dev/null || ! node -v | grep -q '^v2[2-9]'; then
  echo "==> Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

if ! command -v caddy >/dev/null; then
  echo "==> Installing Caddy"
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

# next build needs ~1.5 GB; small plans get swap so the build doesn't get OOM-killed.
if [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 2000000 ] && ! swapon --show | grep -q /swapfile; then
  echo "==> Adding 2 GB swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

id tripaholic >/dev/null 2>&1 || useradd --system --create-home --home-dir "$ROOT" --shell /usr/sbin/nologin tripaholic
mkdir -p "$ROOT" "$DATA_DIR"
chown tripaholic:tripaholic "$ROOT" "$DATA_DIR"

if [ ! -d "$ROOT/app/.git" ]; then
  echo "==> Cloning $REPO ($BRANCH)"
  sudo -u tripaholic git clone --quiet --branch "$BRANCH" "$REPO" "$ROOT/app"
fi

if [ ! -s "$ENV_FILE" ]; then
  cp "$ROOT/app/.env.example" "$ENV_FILE"
  printf '\n# Local file store location on this server (used only when MONGODB_URI is empty).\nDATA_DIR=%s\n' "$DATA_DIR" >> "$ENV_FILE"
  chown tripaholic:tripaholic "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo
  echo "Created $ENV_FILE. Fill in what you have (MONGODB_URI, GEMINI_API_KEY, GEMINI_MODEL,"
  echo "NEXT_PUBLIC_APP_URL=https://$DOMAIN), add this server's IP to Atlas → Network Access,"
  echo "then run this script again. Missing keys are fine for a first deploy: see the notes at the top."
  exit 0
fi
grep -qE '^DATA_DIR=' "$ENV_FILE" || printf '\nDATA_DIR=%s\n' "$DATA_DIR" >> "$ENV_FILE"
# Scripts (seed, smoke tests) read .env.local from the app directory.
ln -sf "$ENV_FILE" "$ROOT/app/.env.local"

echo "==> Firewall"
ufw allow OpenSSH >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

echo "==> Service"
install -m 644 "$ROOT/app/deploy/tripaholic.service" /etc/systemd/system/tripaholic.service
systemctl daemon-reload
systemctl enable tripaholic >/dev/null

echo "==> Checks"
(cd "$ROOT/app" && sudo -u tripaholic npm ci --no-audit --no-fund --silent)
run_check() { (cd "$ROOT/app" && sudo -u tripaholic npm run --silent "$1"); }

if [ -n "$(env_value MONGODB_URI)" ]; then
  run_check smoke:mongo || fail "MongoDB check failed. Fix MONGODB_URI or Atlas Network Access (allow $(hostname -I | awk '{print $1}')) and run again."
  STORE_MODE="MongoDB Atlas"
elif [ "$STRICT" = 1 ]; then
  fail "--strict: MONGODB_URI is not set in $ENV_FILE."
else
  warn "MONGODB_URI not set: the app will use the local file store at $DATA_DIR/db.json (kept across deploys, but not Atlas)."
  STORE_MODE="local file store ($DATA_DIR)"
fi

if [ -z "$(env_value GEMINI_API_KEY)" ]; then
  [ "$STRICT" = 1 ] && fail "--strict: GEMINI_API_KEY is not set in $ENV_FILE."
  warn "GEMINI_API_KEY not set: the app will run in offline planner/agent mode."
  AI_MODE="offline planner/agent (no key)"
elif run_check smoke:gemini; then
  AI_MODE="Gemini ($(env_value GEMINI_MODEL))"
else
  [ "$STRICT" = 1 ] && fail "--strict: the Gemini check failed (see above)."
  warn "Gemini check failed: the app will fall back to offline planner/agent mode until it's fixed."
  AI_MODE="offline fallback (Gemini check failed)"
fi

bash "$ROOT/app/deploy/deploy.sh" "$BRANCH"

echo "==> Caddy for $DOMAIN"
sed "s/__DOMAIN__/$DOMAIN/g" "$ROOT/app/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo
echo "Done."
echo "  Data:  $STORE_MODE"
echo "  AI:    $AI_MODE"
echo "  DNS:   point A records for @ and www at this server ($(hostname -I | awk '{print $1}')), then open https://$DOMAIN"
echo "  Seed:  cd $ROOT/app && sudo -u tripaholic npm run seed"
[ "$STRICT" = 1 ] || echo "  Before submitting, rerun with --strict to confirm Atlas and Gemini are both live."
