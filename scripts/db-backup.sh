#!/usr/bin/env bash
# Backup encrypted do Postgres → MinIO (ou S3). Retenção: 30 dias.
# Pré-requisitos no host: pg_dump, gzip, gpg, mc (MinIO Client).
# ENV: POSTGRES_*, GPG_RECIPIENT, MINIO_ALIAS, BACKUP_BUCKET.
# Roda diário via cron do Coolify.

set -euo pipefail

: "${POSTGRES_HOST:?missing}"
: "${POSTGRES_USER:?missing}"
: "${POSTGRES_DB:?missing}"
: "${POSTGRES_PASSWORD:?missing}"
: "${GPG_RECIPIENT:?missing}"
: "${MINIO_ALIAS:?missing}"
: "${BACKUP_BUCKET:?missing}"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="univercopy_${stamp}.sql.gz.gpg"

export PGPASSWORD="$POSTGRES_PASSWORD"

pg_dump \
  --host="$POSTGRES_HOST" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --no-owner --no-privileges --clean --if-exists \
  | gzip -9 \
  | gpg --batch --yes --trust-model always --encrypt --recipient "$GPG_RECIPIENT" \
  | mc pipe "${MINIO_ALIAS}/${BACKUP_BUCKET}/backups/${file}"

# Retenção: remove backups com mais de 30 dias.
mc rm --recursive --force --older-than "30d" "${MINIO_ALIAS}/${BACKUP_BUCKET}/backups/" || true

echo "[backup] ok → ${file}"
