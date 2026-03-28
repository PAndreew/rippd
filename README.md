# rippd

A low-friction multiplayer game hub with:
- **Zatacka** for couch co-op and online rooms
- **Ramses-inspired** treasure maze with square pyramids and coloured treasure circles
- No accounts, just nicknames, room codes and invite links

## Stack
- **Next.js** for the web app
- **TypeScript** everywhere
- **Tailwind CSS** for UI
- **Node.js** backend
- **Colyseus** for multiplayer rooms and reconnect-aware session handling
- **Redis** for presence, reconnect metadata, and room support
- **Postgres** for analytics, match history, support/admin data

## Deployment targets
- **Hetzner VPS** for all-in-one hosting
- **Vercel** optional later for web only
- **Railway** optional later for managed split infra

## Local development
1. Install dependencies: `npm install`
2. Start infrastructure: `docker compose up -d`
3. Copy env files:
   - `cp apps/server/.env.example apps/server/.env`
   - `cp apps/web/.env.local.example apps/web/.env.local`
4. Start the server: `npm run dev:server`
5. Start the web app: `npm run dev:web`

## Production on Hetzner
Files included:
- `docker-compose.prod.yml`
- `apps/web/Dockerfile`
- `apps/server/Dockerfile`
- `infra/caddy/Caddyfile`
- `.env.production.example`
- `scripts/deploy-prod.sh`
- `scripts/backup-postgres.sh`
- `infra/hetzner-deploy-plan.md`

### Production services
- `caddy` for HTTPS and reverse proxy
- `web` for Next.js
- `server` for Colyseus
- `redis` for presence/reconnect
- `postgres` for analytics/summaries

### Domains expected by default
- `rippd.com`
- `www.rippd.com`
- `api.rippd.com`

Update `infra/caddy/Caddyfile` and `docker-compose.prod.yml` if your final domain differs.

## Environment
### apps/server/.env
- `PORT=3001`
- `CLIENT_ORIGIN=http://localhost:3000`
- `PUBLIC_SERVER_URL=ws://localhost:3001`
- `REDIS_URL=redis://localhost:6379`
- `POSTGRES_URL=postgresql://rippd:rippd_dev@localhost:5432/rippd`
- `ROOM_TTL_SECONDS=21600`
- `PERSIST_MATCH_EVENTS=true`
- `RECONNECT_WINDOW_SECONDS=45`

### apps/web/.env.local
- `NEXT_PUBLIC_SERVER_URL=ws://localhost:3001`

## Current behaviour
### Zatacka
- couch co-op by assigning multiple riders to one browser
- online multiplayer by sharing a room code
- keyboard presets for 4 local riders
- basic gamepad steering support
- authoritative collision handling on the server
- automatic round restart after round-over

### Ramses-inspired
- grid board with movable square pyramids and hidden treasures
- players draw a target treasure card colour
- on each turn: slide a pyramid, then move to a reachable cell
- claim the target treasure only if the path avoids all other treasures
