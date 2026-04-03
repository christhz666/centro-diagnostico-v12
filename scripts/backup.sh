#!/usr/bin/env bash

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
MONGODB_URI="${MONGODB_URI:-mongodb://mongo:27017/centro_default}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
ARCHIVE_PATH="${BACKUP_DIR}/backup-${TIMESTAMP}.archive.gz"

echo "[backup] Iniciando dump: ${ARCHIVE_PATH}"
mongodump --uri="${MONGODB_URI}" --archive="${ARCHIVE_PATH}" --gzip
echo "[backup] Backup creado correctamente"

# Retención por cantidad de archivos (equivale a días si se ejecuta 1 vez/día)
if [[ "${BACKUP_RETENTION_DAYS}" =~ ^[0-9]+$ ]]; then
  mapfile -t BACKUPS < <(ls -1t "${BACKUP_DIR}"/backup-*.archive.gz 2>/dev/null || true)

  if (( ${#BACKUPS[@]} > BACKUP_RETENTION_DAYS )); then
    for ((i=BACKUP_RETENTION_DAYS; i<${#BACKUPS[@]}; i++)); do
      rm -f "${BACKUPS[$i]}"
      echo "[backup] Eliminado por retención: ${BACKUPS[$i]}"
    done
  fi
fi
