FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json ./package.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm install

FROM node:20-bookworm-slim AS builder
WORKDIR /app

ARG NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./package.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

RUN npm run build --workspace @rippd/shared && npm run build --workspace @rippd/web

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/web ./apps/web
COPY --from=builder /app/packages/shared ./packages/shared

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "start"]
