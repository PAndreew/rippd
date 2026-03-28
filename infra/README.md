# Infrastructure

## Local development
Run:
- `docker compose up -d`

This starts:
- **Postgres** on `localhost:5432`
- **Redis** on `localhost:6379`

## Why both exist now
- **Redis** backs room presence, reconnect tokens, and ephemeral room state
- **Postgres** is for analytics, match history, support/admin tooling, and later saved stats

## Railway target
On Railway, provision:
- 1 Node service for `apps/server`
- 1 Redis service
- 1 Postgres service

Then wire environment variables from Railway into the server service.
