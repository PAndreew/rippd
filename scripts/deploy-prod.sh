#!/usr/bin/env bash
set -euo pipefail

cd /opt/rippd

echo "Pulling latest code..."
git pull --ff-only

echo "Rebuilding and restarting containers..."
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

echo "Cleaning old images..."
docker image prune -f

echo "Done."
