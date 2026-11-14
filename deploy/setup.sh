#!/usr/bin/env bash
# One-time setup of a fresh Vultr Ubuntu 24.04 server for Tripaholic. Run as root:
#   curl -fsSL https://raw.githubusercontent.com/lavanpkumar/tripaholic/main/deploy/setup.sh -o setup.sh
#   sudo bash setup.sh your-domain.example
# It installs Node 22 and Caddy, creates a `tripaholic` system user, clones the repo to
# /opt/tripaholic/app, and asks you to fill /opt/tripaholic/.env. Run it again after that
# to build, start the service, and turn on HTTPS.
set -euo pipefail

DOMAIN="${1:?usage: setup.sh <domain> [repo-url] [branch]}"
REPO="${2:-https://github.com/lavanpkumar/tripaholic.git}"
BRANCH="${3:-main}"
ROOT=/opt/tripaholic
ENV_FILE="$ROOT/.env"

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
mkdir -p "$ROOT"
chown tripaholic:tripaholic "$ROOT"

if [ ! -d "$ROOT/app/.git" ]; then
  echo "==> Cloning $REPO ($BRANCH)"
  sudo -u tripaholic git clone --quiet --branch "$BRANCH" "$REPO" "$ROOT/app"
fi

if [ ! -s "$ENV_FILE" ] || grep -q '^MONGODB_URI=$' "$ENV_FILE"; then
  [ -s "$ENV_FILE" ] || cp "$ROOT/app/.env.example" "$ENV_FILE"
  chown tripaholic:tripaholic "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo
  echo "Fill in $ENV_FILE (MONGODB_URI, GEMINI_API_KEY, GEMINI_MODEL, NEXT_PUBLIC_APP_URL=https://$DOMAIN),"
  echo "add this server's IP to Atlas → Network Access, then run this script again."
  exit 0
fi
# Scripts (seed, smoke tests) read .env.local from the app directory.
ln -sf "$ENV_FILE" "$ROOT/app/.env.local"

echo "==> Firewall"
ufw allow OpenSSH >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

echo "==> Service"
install -m 644 "$ROOT/app/deploy/tripaholic.service" /etc/systemd/system/tripaholic.service
systemctl daemon-reload
systemctl enable tripaholic >/dev/null

echo "==> Smoke tests"
(cd "$ROOT/app" && sudo -u tripaholic npm ci --no-audit --no-fund --silent && sudo -u tripaholic npm run --silent smoke:mongo && sudo -u tripaholic npm run --silent smoke:gemini)

bash "$ROOT/app/deploy/deploy.sh" "$BRANCH"

echo "==> Caddy for $DOMAIN"
sed "s/__DOMAIN__/$DOMAIN/g" "$ROOT/app/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo
echo "Done. Point DNS (A record @ and www) at this server's public IP ($(hostname -I | awk '{print $1}')) and open https://$DOMAIN"
echo "Seed demo data once:  cd $ROOT/app && sudo -u tripaholic npm run seed"
