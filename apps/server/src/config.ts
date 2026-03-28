export const config = {
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
  publicServerUrl: process.env.PUBLIC_SERVER_URL ?? 'ws://localhost:3001',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  postgresUrl: process.env.POSTGRES_URL ?? 'postgresql://rippd:rippd_dev@localhost:5432/rippd',
  roomTtlSeconds: Number(process.env.ROOM_TTL_SECONDS ?? 21600),
  persistMatchEvents: String(process.env.PERSIST_MATCH_EVENTS ?? 'true') === 'true',
  reconnectWindowSeconds: Number(process.env.RECONNECT_WINDOW_SECONDS ?? 45),
  authTokenSecret: process.env.AUTH_TOKEN_SECRET ?? 'rippd-dev-auth-secret-change-me',
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY ?? 'rippd-dev-data-key-change-me'
};
