FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y git ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/* && \
    git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"

COPY package.json ./package.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm install

FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./package.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared

RUN npm run build --workspace @rippd/shared && npm run build --workspace @rippd/server

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/server ./apps/server
COPY --from=builder /app/packages/shared ./packages/shared

WORKDIR /app/apps/server
EXPOSE 3001
CMD ["npm", "run", "start"]
