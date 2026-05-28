#!/usr/bin/env bash
# =====================================================================
# UniverCopy — dev orchestrator. Sobe stack completa pra E2E local:
#   - Postgres + Redis + MinIO via docker-compose.dev.yml
#   - apps/api Rails 8 (porta 3001)
#   - Sidekiq (mesma image, queue ai/critical/default/...)
#   - apps/admin Next 16 (porta 3000)
#
# Comportamento:
#   - Idempotente: containers existentes são reusados.
#   - Migra DB + roda seed na primeira subida (detecta via psql).
#   - Trap EXIT/INT/TERM mata Rails+Sidekiq+admin filhos.
#   - Logs em .dev-logs/<service>.log + tail no terminal.
#
# Uso:
#   ./scripts/dev.sh                 # tudo
#   ./scripts/dev.sh api             # só backend (api + sidekiq + db)
#   ./scripts/dev.sh admin           # só frontend (admin + dev DB up)
# =====================================================================

set -euo pipefail
IFS=$'\n\t'

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; DIM='\033[2m'; BOLD='\033[1m'; NC='\033[0m'
say()  { printf "${DIM}[dev]${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$*"; }
err()  { printf "${RED}✗${NC} %s\n" "$*" >&2; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR=".dev-logs"
mkdir -p "$LOG_DIR"

WHICH="${1:-all}"

PIDS=()

cleanup() {
  say "encerrando processos…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM EXIT

export PATH="$HOME/.rbenv/versions/3.3.6/bin:$PATH"

# --------------------------------------------------------------------- #
# 1. Docker stack
# --------------------------------------------------------------------- #
ensure_docker_stack() {
  if ! docker info >/dev/null 2>&1; then
    err "docker daemon não está rodando — abra Docker Desktop e re-rode."
    exit 1
  fi

  say "subindo postgres + redis + minio (dev compose)…"
  docker compose -f docker-compose.dev.yml up -d --wait >>"$LOG_DIR/docker.log" 2>&1
  ok "docker compose ok"
}

# --------------------------------------------------------------------- #
# 2. DB migrate + seed (idempotente)
# --------------------------------------------------------------------- #
ensure_db() {
  pushd apps/api >/dev/null
  export DATABASE_URL="postgres://univercopy:univercopy_dev@localhost:5432/univercopy_development"
  export REDIS_URL="redis://localhost:6379/0"
  export RAILS_ENV=development
  if [[ -z "${SECRET_KEY_BASE:-}" ]]; then
    SECRET_KEY_BASE="$(bundle exec rails secret 2>/dev/null || openssl rand -hex 64)"
    export SECRET_KEY_BASE
  fi

  # Bundle install se não tem vendor/bundle
  if [[ ! -d vendor/bundle ]]; then
    say "instalando gems (primeira vez)…"
    bundle config set --local path 'vendor/bundle'
    bundle install --jobs 4 --retry 2 >>"../../$LOG_DIR/api-bundle.log" 2>&1
  fi

  say "rails db:prepare + db:seed…"
  bin/rails db:prepare >>"../../$LOG_DIR/api-db.log" 2>&1
  bin/rails db:seed   >>"../../$LOG_DIR/api-db.log" 2>&1
  ok "db pronto"
  popd >/dev/null
}

# --------------------------------------------------------------------- #
# 3. Boot API + Sidekiq + Admin
# --------------------------------------------------------------------- #
start_api() {
  pushd apps/api >/dev/null
  : > "../../$LOG_DIR/api.log"
  say "rails server :3001 (log: $LOG_DIR/api.log)"
  PORT=3001 \
    DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" \
    SECRET_KEY_BASE="$SECRET_KEY_BASE" \
    ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
    CORS_ALLOWED_ORIGINS="http://localhost:3000" \
    bundle exec puma -C config/puma.rb >>"../../$LOG_DIR/api.log" 2>&1 &
  PIDS+=($!)
  popd >/dev/null
}

start_sidekiq() {
  pushd apps/api >/dev/null
  : > "../../$LOG_DIR/sidekiq.log"
  say "sidekiq (log: $LOG_DIR/sidekiq.log)"
  DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" \
    SECRET_KEY_BASE="$SECRET_KEY_BASE" \
    ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
    bundle exec sidekiq >>"../../$LOG_DIR/sidekiq.log" 2>&1 &
  PIDS+=($!)
  popd >/dev/null
}

start_admin() {
  : > "$LOG_DIR/admin.log"
  say "admin Next.js :3000 (log: $LOG_DIR/admin.log)"
  DATABASE_URL="postgres://univercopy:univercopy_dev@localhost:5432/univercopy_development" \
    BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-dev_better_auth_secret_at_least_32_chars_long_xxxx}" \
    BETTER_AUTH_TRUSTED_ORIGINS="http://localhost:3000,http://localhost:3001" \
    NEXT_PUBLIC_API_URL="http://localhost:3001" \
    NEXT_PUBLIC_ADMIN_URL="http://localhost:3000" \
    pnpm --filter admin dev >>"$LOG_DIR/admin.log" 2>&1 &
  PIDS+=($!)
}

# --------------------------------------------------------------------- #
# Run
# --------------------------------------------------------------------- #
case "$WHICH" in
  all)
    ensure_docker_stack
    ensure_db
    start_api
    start_sidekiq
    start_admin
    ;;
  api)
    ensure_docker_stack
    ensure_db
    start_api
    start_sidekiq
    ;;
  admin)
    ensure_docker_stack
    start_admin
    ;;
  db)
    ensure_docker_stack
    ensure_db
    ;;
  *)
    err "uso: ./scripts/dev.sh [all|api|admin|db]"
    exit 2
    ;;
esac

printf "\n${BOLD}=== dev stack pronto ===${NC}\n"
printf "  ${DIM}admin:${NC} http://localhost:3000\n"
printf "  ${DIM}api:  ${NC} http://localhost:3001/up\n"
printf "  ${DIM}minio:${NC} http://localhost:9001 (univercopy / univercopy_dev_minio)\n"
printf "\n${DIM}logs em ${LOG_DIR}/. Ctrl+C encerra tudo.${NC}\n\n"

# Tail multiplexado pros logs ativos.
tail -F "$LOG_DIR"/*.log 2>/dev/null
