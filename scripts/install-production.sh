#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_NAME="lappeenranta"
readonly APP_USER="lappeenranta"
readonly APP_GROUP="lappeenranta"
readonly APP_DIR="/opt/lappeenranta"
readonly DATA_DIR="/var/lib/lappeenranta"
readonly ETC_DIR="/etc/lappeenranta"
readonly ENV_FILE="${ETC_DIR}/lappeenranta.env"
readonly UNIT_SOURCE_DIR="${APP_DIR}/deploy/systemd"
readonly UNIT_DIR="/etc/systemd/system"

log() { printf '[lappeenranta] %s\n' "$*"; }
die() { printf '[lappeenranta] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die "run this installer as root (for example: sudo bash scripts/install-production.sh)"
[[ -r /etc/os-release ]] || die "cannot identify the operating system"
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "ubuntu" || "${ID:-}" == "debian" ]] || die "Ubuntu or Debian is required (found ${ID:-unknown})"
command -v apt-get >/dev/null || die "apt-get is required"

for command_name in node npm runuser install chown chmod systemctl curl id useradd sleep; do
  command -v "$command_name" >/dev/null || die "required command is missing: $command_name"
done

node_major="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$node_major" =~ ^[0-9]+$ && "$node_major" -ge 22 ]] || die "Node.js 22 or newer is required (found $(node --version))"

[[ -f "${APP_DIR}/package.json" ]] || die "${APP_DIR}/package.json was not found; run this from the checkout at ${APP_DIR}"
[[ -f "${APP_DIR}/package-lock.json" ]] || die "${APP_DIR}/package-lock.json is required for npm ci"
[[ -d "$UNIT_SOURCE_DIR" ]] || die "systemd unit source directory is missing: $UNIT_SOURCE_DIR"

if ! id -u "$APP_USER" >/dev/null 2>&1; then
  log "creating system user ${APP_USER}"
  useradd --system --user-group --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi

install -d -o "$APP_USER" -g "$APP_GROUP" -m 0755 "$APP_DIR"
install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$DATA_DIR"
install -d -o root -g "$APP_GROUP" -m 0750 "$ETC_DIR"

if [[ ! -e "$ENV_FILE" ]]; then
  install -o "$APP_USER" -g "$APP_GROUP" -m 0600 /dev/null "$ENV_FILE"
  printf '%s\n' \
    'LAPPEENRANTA_REPORT_API_URL=http://127.0.0.1:4000/api/reports' \
    'LAPPEENRANTA_DATA_DIR=/var/lib/lappeenranta' > "$ENV_FILE"
fi
[[ -f "$ENV_FILE" ]] || die "environment path is not a regular file: $ENV_FILE"
chown "$APP_USER:$APP_GROUP" "$ENV_FILE"
chmod 0600 "$ENV_FILE"

# Build artifacts and node_modules are generated in the checkout by the service user.
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"
chmod 0750 "$DATA_DIR"

run_as_app() {
  runuser -u "$APP_USER" -- env HOME="$DATA_DIR" PATH="$PATH" "$@"
}

log "installing locked dependencies"
cd "$APP_DIR"
run_as_app npm ci
log "running typecheck"
run_as_app npm run typecheck
log "running tests"
run_as_app npm test
log "building Next.js"
run_as_app npm run build
log "building backend"
run_as_app npm run backend:build

log "installing systemd units"
install -o root -g root -m 0644 \
  "$UNIT_SOURCE_DIR/lappeenranta-backend.service" \
  "$UNIT_DIR/lappeenranta-backend.service"
install -o root -g root -m 0644 \
  "$UNIT_SOURCE_DIR/lappeenranta-frontend.service" \
  "$UNIT_DIR/lappeenranta-frontend.service"

systemctl daemon-reload
systemctl enable lappeenranta-backend.service lappeenranta-frontend.service
systemctl restart lappeenranta-backend.service
systemctl restart lappeenranta-frontend.service

log "waiting for backend health endpoint"
for attempt in {1..30}; do
  if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:4000/health >/dev/null; then
    break
  fi
  [[ "$attempt" -eq 30 ]] && die "backend health check failed; inspect journalctl -u lappeenranta-backend"
  sleep 1
done

log "waiting for frontend"
for attempt in {1..30}; do
  if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3000/ >/dev/null; then
    break
  fi
  [[ "$attempt" -eq 30 ]] && die "frontend smoke test failed; inspect journalctl -u lappeenranta-frontend"
  sleep 1
done

log "deployment complete"
systemctl --no-pager --full status lappeenranta-backend.service lappeenranta-frontend.service || true
