#!/usr/bin/env bash
# =====================================================================
# UniverCopy — CI local. Espelha .github/workflows/ci.yml com fail-fast,
# logs por gate, cleanup via trap, cores e tabela de resumo.
#
# Uso:
#   ./scripts/local-ci.sh                       # roda tudo
#   ./scripts/local-ci.sh --only lint typecheck # subconjunto
#   ./scripts/local-ci.sh --skip docker trivy
#   ./scripts/local-ci.sh --continue-on-error   # não para no 1º erro
#   ./scripts/local-ci.sh --bitmask             # exit code = bitmask
#   ./scripts/local-ci.sh --help
#
# Output:
#   .local-ci-logs/<UTC-timestamp>/<gate>.log
#   .local-ci-logs/latest  (symlink)
# =====================================================================

set -euo pipefail
IFS=$'\n\t'

# --------------------------------------------------------------------- #
# Cores e helpers
# --------------------------------------------------------------------- #
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'
  BLUE='\033[0;34m'; DIM='\033[2m'; BOLD='\033[1m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; BLUE=''; DIM=''; BOLD=''; NC=''
fi

step()  { printf "${BLUE}[%d/%d]${NC} ${BOLD}%s${NC}\n" "$1" "$2" "$3"; }
ok()    { printf "  ${GREEN}✓${NC} %s ${DIM}(%ss)${NC}\n" "$1" "$2"; }
fail()  { printf "  ${RED}✗${NC} %s ${DIM}(%ss)${NC}\n" "$1" "$2"; }
skip()  { printf "  ${YELLOW}…${NC} %s ${DIM}(skipped)${NC}\n" "$1"; }
warn()  { printf "  ${YELLOW}!${NC} %s\n" "$1"; }
info()  { printf "  ${DIM}%s${NC}\n" "$1"; }

# --------------------------------------------------------------------- #
# Dirs
# --------------------------------------------------------------------- #
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_ROOT=".local-ci-logs"
LOG_DIR="${LOG_ROOT}/${TS}"
mkdir -p "$LOG_DIR"
ln -sfn "$TS" "${LOG_ROOT}/latest"

# Ruby PATH (rbenv local em ~/.rbenv — brew desabilitado neste host).
export PATH="$HOME/.rbenv/versions/3.3.6/bin:$PATH"

# --------------------------------------------------------------------- #
# Compose CI — Postgres + Redis efêmeros.
# --------------------------------------------------------------------- #
COMPOSE_FILE="docker-compose.ci.yml"
PG_PORT="${UC_CI_PG_PORT:-55432}"
REDIS_PORT="${UC_CI_REDIS_PORT:-56379}"
export UC_CI_PG_PORT="$PG_PORT" UC_CI_REDIS_PORT="$REDIS_PORT"
export CI_DATABASE_URL="postgres://ci_user:ci_pw@127.0.0.1:${PG_PORT}/ci_db"
export CI_REDIS_URL="redis://127.0.0.1:${REDIS_PORT}/0"

compose_up() {
  docker compose -f "$COMPOSE_FILE" up -d --wait >/dev/null
}
compose_down() {
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
}

# --------------------------------------------------------------------- #
# Trap — cleanup garante sem lixo, mesmo em SIGINT
# --------------------------------------------------------------------- #
COMPOSE_STARTED=0
CI_IMAGE_TAG="univercopy-api:ci-${TS}"
cleanup() {
  local exit_code=$?
  [[ $COMPOSE_STARTED -eq 1 ]] && compose_down
  docker image rm -f "$CI_IMAGE_TAG" >/dev/null 2>&1 || true
  exit $exit_code
}
trap cleanup EXIT INT TERM

# --------------------------------------------------------------------- #
# argparse
# --------------------------------------------------------------------- #
ALL_GATES=(gitleaks semgrep shared admin landing api docker trivy)
CONTINUE_ON_ERROR=0
USE_BITMASK=0
ONLY=()
SKIP=()

usage() {
  cat <<EOF
${BOLD}local-ci.sh${NC} — espelha o CI remoto offline.

${BOLD}USO${NC}
  ./scripts/local-ci.sh [opções]

${BOLD}OPÇÕES${NC}
  --only G1 G2 …       roda só estes gates
  --skip G1 G2 …       pula estes gates
  --continue-on-error  não para no primeiro erro
  --bitmask            exit code é bitmask dos gates falhos
  --help               esta ajuda

${BOLD}GATES${NC}
  ${ALL_GATES[*]}

${BOLD}ENV${NC}
  UC_CI_PG_PORT       (default 55432)
  UC_CI_REDIS_PORT    (default 56379)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --only)              shift; while [[ $# -gt 0 && "$1" != --* ]]; do ONLY+=("$1"); shift; done ;;
    --skip)              shift; while [[ $# -gt 0 && "$1" != --* ]]; do SKIP+=("$1"); shift; done ;;
    --continue-on-error) CONTINUE_ON_ERROR=1; shift ;;
    --bitmask)           USE_BITMASK=1; shift ;;
    --help|-h)           usage; exit 0 ;;
    *) printf "${RED}arg desconhecido:${NC} %s\n" "$1"; usage; exit 2 ;;
  esac
done

should_run() {
  local g="$1" arg
  if [[ ${#ONLY[@]} -gt 0 ]]; then
    for arg in "${ONLY[@]}"; do [[ "$arg" == "$g" ]] && return 0; done
    return 1
  fi
  for arg in "${SKIP[@]}"; do [[ "$arg" == "$g" ]] && return 1; done
  return 0
}

# --------------------------------------------------------------------- #
# Gates — cada um isolado em função. Cada função:
#   - lê seu log de $LOG_DIR/<gate>.log
#   - retorna 0 = pass, 1 = fail
# --------------------------------------------------------------------- #

# 1. gitleaks — secrets scan no histórico.
gate_gitleaks() {
  local log="$LOG_DIR/gitleaks.log"
  docker run --rm -v "$REPO_ROOT:/repo" -w /repo \
    zricethezav/gitleaks:latest detect --no-banner --redact --report-format=json \
    --report-path=/repo/.local-ci-logs/latest/gitleaks-report.json \
    >"$log" 2>&1
}

# 2. semgrep — SAST com regrass OWASP+JS+TS+Node+secrets.
gate_semgrep() {
  local log="$LOG_DIR/semgrep.log"
  docker run --rm -v "$REPO_ROOT:/src" -w /src \
    returntocorp/semgrep:latest semgrep ci --no-rewrite-rule-ids --error \
    --config p/owasp-top-ten --config p/javascript --config p/typescript \
    --config p/nodejs --config p/secrets \
    >"$log" 2>&1
}

# 3. shared — type-check do package compartilhado.
gate_shared() {
  local log="$LOG_DIR/shared.log"
  pnpm install --frozen-lockfile >"$log" 2>&1
  pnpm --filter @univer/shared type-check >>"$log" 2>&1
}

# 4. admin — Next.js: lint + type-check + test + build.
gate_admin() {
  local log="$LOG_DIR/admin.log"
  pnpm --filter admin lint       >>"$log" 2>&1
  pnpm --filter admin type-check >>"$log" 2>&1
  pnpm --filter admin test       >>"$log" 2>&1
  NEXT_PUBLIC_API_URL="http://localhost:3001" \
  NEXT_PUBLIC_ADMIN_URL="http://localhost:3000" \
    pnpm --filter admin build >>"$log" 2>&1
}

# 5. landing — Next.js: lint + type-check + build.
gate_landing() {
  local log="$LOG_DIR/landing.log"
  pnpm --filter landing lint       >"$log" 2>&1
  pnpm --filter landing type-check >>"$log" 2>&1
  pnpm --filter landing build      >>"$log" 2>&1
}

# 6. api — Rails: db:prepare + brakeman + bundler-audit + rspec.
#    Depende do compose CI (db+redis) estar UP.
gate_api() {
  local log="$LOG_DIR/api.log"
  if [[ $COMPOSE_STARTED -eq 0 ]]; then
    info "subindo postgres + redis efêmeros…" >&2
    compose_up
    COMPOSE_STARTED=1
  fi
  pushd apps/api >/dev/null
  bundle config set --local path 'vendor/bundle' >>"$log" 2>&1 || true
  bundle install --jobs 4 --retry 2 >>"$log" 2>&1
  RAILS_ENV=test \
    DATABASE_URL="$CI_DATABASE_URL" \
    REDIS_URL="$CI_REDIS_URL" \
    SECRET_KEY_BASE="dummy_secret_key_base_for_ci_local_64_chars_xxxxxxxxxxxxxxxxxxx" \
    bin/rails db:prepare >>"$log" 2>&1
  RAILS_ENV=test bundle exec brakeman --no-pager --exit-on-warn >>"$log" 2>&1
  RAILS_ENV=test bundle exec bundle-audit check --update >>"$log" 2>&1
  RAILS_ENV=test \
    DATABASE_URL="$CI_DATABASE_URL" \
    REDIS_URL="$CI_REDIS_URL" \
    SECRET_KEY_BASE="dummy_secret_key_base_for_ci_local_64_chars_xxxxxxxxxxxxxxxxxxx" \
    TENANT_CREDENTIALS_KEY="ci_only_tenant_credentials_key_not_a_secret_00000000000000000000" \
    COVERAGE_FLOOR=30 \
    bundle exec rspec --format progress >>"$log" 2>&1
  popd >/dev/null
}

# 7. docker-build — build do Dockerfile da API (multi-stage com BuildKit).
gate_docker() {
  local log="$LOG_DIR/docker.log"
  DOCKER_BUILDKIT=1 docker build \
    -f apps/api/Dockerfile \
    -t "$CI_IMAGE_TAG" \
    . >"$log" 2>&1
}

# 8. trivy — FS scan + image scan. severity CRITICAL,HIGH falha; MEDIUM/LOW warn.
gate_trivy() {
  local log="$LOG_DIR/trivy.log"
  {
    echo "=== TRIVY FS SCAN ==="
    docker run --rm -v "$REPO_ROOT:/src" aquasec/trivy:latest fs \
      --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 \
      --skip-dirs node_modules,.next,.turbo,vendor,coverage,.local-ci-logs \
      /src

    echo
    echo "=== TRIVY IMAGE SCAN ==="
    if docker image inspect "$CI_IMAGE_TAG" >/dev/null 2>&1; then
      docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
        aquasec/trivy:latest image \
        --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 \
        "$CI_IMAGE_TAG"
    else
      echo "skip: image $CI_IMAGE_TAG não construída (gate docker pulou ou falhou)."
    fi
  } >"$log" 2>&1
}

# --------------------------------------------------------------------- #
# Runner
# --------------------------------------------------------------------- #
# Arrays paralelos (bash 3.2 não tem associative arrays). Mesmo índice de
# ALL_GATES.
RESULTS=()
DURATIONS=()
for _ in "${ALL_GATES[@]}"; do
  RESULTS+=("pending")
  DURATIONS+=("0")
done

GATE_COUNT=${#ALL_GATES[@]}
TOTAL_START=$SECONDS

# Bitmask: bit_i = 1 se gate_i falhou.
FAIL_MASK=0
for i in "${!ALL_GATES[@]}"; do
  gate="${ALL_GATES[$i]}"
  step "$((i+1))" "$GATE_COUNT" "$gate"

  if ! should_run "$gate"; then
    skip "$gate"
    RESULTS[$i]="skip"
    DURATIONS[$i]="0"
    continue
  fi

  start=$SECONDS
  if "gate_${gate}"; then
    elapsed=$((SECONDS - start))
    ok "$gate" "$elapsed"
    RESULTS[$i]="pass"
    DURATIONS[$i]="$elapsed"
  else
    elapsed=$((SECONDS - start))
    fail "$gate" "$elapsed"
    RESULTS[$i]="fail"
    DURATIONS[$i]="$elapsed"
    FAIL_MASK=$((FAIL_MASK | (1 << i)))
    warn "log: ${LOG_ROOT}/latest/${gate}.log"
    if [[ $CONTINUE_ON_ERROR -eq 0 ]]; then
      printf "\n${RED}${BOLD}fail-fast:${NC} ${RED}interrompendo após erro em '%s'${NC}\n" "$gate"
      printf "${DIM}use --continue-on-error pra rodar tudo.${NC}\n\n"
      break
    fi
  fi
done

TOTAL_ELAPSED=$((SECONDS - TOTAL_START))

# --------------------------------------------------------------------- #
# Sumário final — tabela ASCII
# --------------------------------------------------------------------- #
printf "\n${BOLD}=== Resumo CI local ===${NC}\n"
printf "%-14s %-8s %8s   %s\n" "GATE" "STATUS" "TIME(s)" "LOG"
printf "%-14s %-8s %8s   %s\n" "----" "------" "-------" "---"
for i in "${!ALL_GATES[@]}"; do
  g="${ALL_GATES[$i]}"
  status="${RESULTS[$i]:-pending}"
  d="${DURATIONS[$i]:-0}"
  case "$status" in
    pass) sc="${GREEN}pass${NC}" ;;
    fail) sc="${RED}fail${NC}" ;;
    skip) sc="${YELLOW}skip${NC}" ;;
    *)    sc="${DIM}pending${NC}" ;;
  esac
  printf "%-14s " "$g"
  printf "%-8b " "$sc"
  printf "%8s   ${DIM}%s${NC}\n" "$d" "${LOG_ROOT}/latest/${g}.log"
done
printf "\ntotal: %s seg\n" "$TOTAL_ELAPSED"
printf "logs em: %s/\n" "${LOG_ROOT}/latest"

# --------------------------------------------------------------------- #
# Exit code
# --------------------------------------------------------------------- #
if [[ $USE_BITMASK -eq 1 ]]; then
  printf "bitmask de gates falhos: %d (0b%s)\n" "$FAIL_MASK" "$(bc <<< "obase=2; $FAIL_MASK")"
  exit "$FAIL_MASK"
fi
[[ $FAIL_MASK -eq 0 ]] && exit 0 || exit 1
