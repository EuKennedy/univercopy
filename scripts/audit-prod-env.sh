#!/usr/bin/env bash
# Audita o ambiente de produção sem vazar valores em log.
# Padrão: ${VAR:+set}${VAR:-MISSING} — NUNCA imprimir ${VAR} diretamente.
# Roda manualmente no Coolify shell antes de releases.

set -u

REQUIRED=(
  DATABASE_URL
  REDIS_URL
  SECRET_KEY_BASE
  ANTHROPIC_API_KEY
  BETTER_AUTH_SECRET
  BETTER_AUTH_TRUSTED_ORIGINS
  TENANT_CREDENTIALS_KEY
  RESEND_API_KEY
  RESEND_WEBHOOK_SECRET
  BILLING_WEBHOOK_SECRET
  S3_ENDPOINT
  S3_BUCKET
  S3_ACCESS_KEY_ID
  S3_SECRET_ACCESS_KEY
  FRONTEND_URL
  API_URL
  COOKIE_DOMAIN
  CORS_ALLOWED_ORIGINS
  SENTRY_DSN
)

missing=0
echo "==== UniverCopy — Production ENV audit ===="
for v in "${REQUIRED[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    printf "  ✗ %-32s MISSING\n" "$v"
    missing=$((missing + 1))
  else
    printf "  ✓ %-32s set (%d chars)\n" "$v" "${#!v}"
  fi
done

echo
echo "==== DB role hardening check ===="
psql "$DATABASE_URL" -tAc "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;" 2>/dev/null \
  | awk -F'|' '{ printf "  current_user=%s super=%s bypass_rls=%s\n", $1, $2, $3 }' \
  || echo "  ⚠ could not connect to DB"

echo
if (( missing > 0 )); then
  echo "FAIL: ${missing} required ENV var(s) missing."
  exit 1
fi
echo "OK: all required ENV present."
