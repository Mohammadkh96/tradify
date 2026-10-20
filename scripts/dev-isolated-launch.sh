#!/usr/bin/env bash
set -euo pipefail
umask 077

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(dirname "$(command -v initdb)")"
PG_PORT="${TRADIFY_LOCAL_PG_PORT:-5562}"
ROOT="$(mktemp -d /tmp/tradify-journal-dev.XXXXXX)"
SESSION_MARKER=/tmp/tradify-journal-phase-a-session.json
PG_STARTED=0
APP_PID=""

if [[ -e "$SESSION_MARKER" ]]; then
  echo "A previous Journal Phase A session marker exists; refusing to rotate or reuse its signer."
  exit 1
fi

cleanup() {
  status=$?
  trap - EXIT INT TERM

  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  if [[ "$PG_STARTED" -eq 1 ]]; then
    "$PG_BIN/pg_ctl" -D "$ROOT/data" -m fast -w stop >/dev/null 2>&1 || true
  fi
  rm -rf "$ROOT"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -m 700 "$ROOT/socket"

node - "$PG_PORT" <<'NODE'
const net = require("node:net");
const port = Number(process.argv[2]);
const server = net.createServer();
server.once("error", () => {
  console.error("Isolated development database port is already in use; refusing to attach to it.");
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => server.close(() => process.exit(0)));
NODE

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$ROOT/ca.key" -out "$ROOT/ca.crt" \
  -subj '/CN=Tradify-Journal-Temporary-Development-CA' -days 1 >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes \
  -keyout "$ROOT/server.key" -out "$ROOT/server.csr" \
  -subj '/CN=localhost' >/dev/null 2>&1
printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' > "$ROOT/server.ext"
openssl x509 -req -in "$ROOT/server.csr" \
  -CA "$ROOT/ca.crt" -CAkey "$ROOT/ca.key" -CAcreateserial \
  -out "$ROOT/server.crt" -days 1 -extfile "$ROOT/server.ext" >/dev/null 2>&1
chmod 600 "$ROOT/ca.key" "$ROOT/server.key"

"$PG_BIN/initdb" -D "$ROOT/data" -U tradify_test \
  --auth-local=trust --auth-host=trust --no-locale --encoding=UTF8 \
  > "$ROOT/initdb.log" 2>&1
cat >> "$ROOT/data/postgresql.conf" <<EOF
listen_addresses = '127.0.0.1'
port = $PG_PORT
unix_socket_directories = '$ROOT/socket'
ssl = on
ssl_cert_file = '$ROOT/server.crt'
ssl_key_file = '$ROOT/server.key'
EOF
"$PG_BIN/pg_ctl" -D "$ROOT/data" -l "$ROOT/postgres.log" -w start >/dev/null
PG_STARTED=1

export PGHOST=127.0.0.1 PGPORT="$PG_PORT" PGUSER=tradify_test
export PGDATABASE=postgres PGSSLMODE=verify-full PGSSLROOTCERT="$ROOT/ca.crt"
createdb --no-password tradify_journal_dev

DATABASE_URL_LOCAL="postgresql://tradify_test@127.0.0.1:${PG_PORT}/tradify_journal_dev?sslmode=verify-full&sslrootcert=${ROOT}/ca.crt"
FAKE_PRODUCTION_URL='postgresql://synthetic@production.invalid/neondb?sslmode=verify-full'
SESSION_SECRET="$(openssl rand -hex 32)"

cd "$WORKSPACE"
env -i \
  PATH="$PATH" HOME="${HOME:-/tmp}" PWD="$WORKSPACE" \
  NODE_ENV=development APP_ENV=development PORT=5000 HOST=0.0.0.0 \
  REPLIT_DEV_DOMAIN="${REPLIT_DEV_DOMAIN:-}" REPLIT_DOMAINS="${REPLIT_DOMAINS:-}" \
  SESSION_SECRET="$SESSION_SECRET" \
  DEV_DATABASE_URL="$DATABASE_URL_LOCAL" DATABASE_URL="$FAKE_PRODUCTION_URL" \
  NODE_EXTRA_CA_CERTS="$ROOT/ca.crt" \
  EMAIL_DELIVERY_ENABLED=false SMTP_ENABLED=false LIVE_BILLING_ENABLED=false \
  STRIPE_ENABLED=false MT5_SYNC_ENABLED=false DEV_MT5_SYNC_ENABLED=false \
  DEV_MT5_MARKET_DATA_ENABLED=false BACKGROUND_WORKERS_ENABLED=false \
  BACKGROUND_JOBS_ENABLED=false EMAIL_BACKFILL_ENABLED=false \
  DEV_PRODUCT_LINKING_ENABLED=false \
  ./node_modules/.bin/drizzle-kit migrate

# These Journal linking migrations are intentionally kept outside Drizzle's
# startup journal. Apply them only to this freshly created loopback test DB.
PGHOST=127.0.0.1 PGPORT="$PG_PORT" PGUSER=tradify_test \
  PGDATABASE=tradify_journal_dev PGSSLMODE=verify-full PGSSLROOTCERT="$ROOT/ca.crt" \
  "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 \
    -f "$WORKSPACE/migrations/0002_tradify_account_linking_v1.sql" \
    -f "$WORKSPACE/migrations/0003_product_link_revocation_retry_v1.sql"

printf 'Starting Journal isolated development app on port 5000 (ephemeral loopback database; linking disabled).\n'
env -i \
  PATH="$PATH" HOME="${HOME:-/tmp}" PWD="$WORKSPACE" \
  NODE_ENV=development APP_ENV=development PORT=5000 HOST=0.0.0.0 \
  REPLIT_DEV_DOMAIN="${REPLIT_DEV_DOMAIN:-}" REPLIT_DOMAINS="${REPLIT_DOMAINS:-}" \
  APP_URL="https://${REPLIT_DEV_DOMAIN:?Replit development domain is required}" \
  SESSION_SECRET="$SESSION_SECRET" \
  DEV_DATABASE_URL="$DATABASE_URL_LOCAL" DATABASE_URL="$FAKE_PRODUCTION_URL" \
  NODE_EXTRA_CA_CERTS="$ROOT/ca.crt" PHASEA_ROOT="$ROOT" \
  PHASEA_CONTROL_SOCKET="$ROOT/phase-a-control.sock" \
  PHASEA_SESSION_MARKER="$SESSION_MARKER" \
  EMAIL_DELIVERY_ENABLED=false SMTP_ENABLED=false LIVE_BILLING_ENABLED=false \
  STRIPE_ENABLED=false MT5_SYNC_ENABLED=false DEV_MT5_SYNC_ENABLED=false \
  DEV_MT5_MARKET_DATA_ENABLED=false BACKGROUND_WORKERS_ENABLED=false \
  BACKGROUND_JOBS_ENABLED=false EMAIL_BACKFILL_ENABLED=false \
  DEV_PRODUCT_LINKING_ENABLED=false \
  ./node_modules/.bin/tsx scripts/dev-linking-supervisor.ts &
APP_PID=$!
wait "$APP_PID"
