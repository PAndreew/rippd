#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/rippd/backups"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$BACKUP_DIR"

docker compose --env-file /opt/rippd/.env.production -f /opt/rippd/docker-compose.prod.yml exec -T postgres \
  pg_dump -U rippd rippd | gzip > "$BACKUP_DIR/rippd_${TIMESTAMP}.sql.gz"

find "$BACKUP_DIR" -type f -name 'rippd_*.sql.gz' -mtime +14 -delete

echo "Backup saved to $BACKUP_DIR/rippd_${TIMESTAMP}.sql.gz"
