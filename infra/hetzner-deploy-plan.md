# Hetzner deployment plan for rippd

## Architecture
One VPS running:
- Caddy
- Next.js web app
- Colyseus server
- Redis
- Postgres

## Domains
- `rippd.com` -> web
- `www.rippd.com` -> redirect to apex
- `api.rippd.com` -> Colyseus backend

## Why this setup
- simpler than splitting across multiple providers
- good for websocket multiplayer
- easy to control costs early
- Redis and Postgres stay private inside Docker network

## Suggested VPS
- start with 4 vCPU / 8 GB RAM if you want comfortable headroom
- 2 vCPU / 4 GB can work for early MVP traffic

## Directory layout on server
- `/opt/rippd` repo checkout
- `/opt/rippd/.env.production` production secrets
- `/opt/rippd/backups` Postgres dumps

## Deployment flow
1. provision VPS
2. point DNS
3. install Docker + Compose + git
4. clone repo
5. create `.env.production`
6. update `infra/caddy/Caddyfile` domains if needed
7. run `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build`
8. verify https + websockets
9. add cron backup job

## Security basics
- use SSH keys only
- disable password login
- enable UFW or Hetzner firewall
- open only 22, 80, 443
- do not expose Redis or Postgres ports publicly
- keep system packages updated

## Backups
- daily Postgres dump via cron
- optional off-server sync later

## Scale path
- single VPS first
- later add a second VPS for Postgres or game server if needed
- Redis presence already helps multi-node Colyseus later
