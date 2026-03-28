import { createClient } from 'redis';
import { config } from './config';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (error) => {
  console.error('Redis error', error);
});

export async function connectRedis() {
  if (redis.isOpen) return redis;
  await redis.connect();
  return redis;
}
