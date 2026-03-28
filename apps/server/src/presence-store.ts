import { config } from './config';
import { redis } from './redis';

export async function setRoomPresence(roomCode: string, payload: unknown) {
  if (!redis.isOpen) return;
  await redis.set(`room:${roomCode}:presence`, JSON.stringify(payload), {
    EX: config.roomTtlSeconds
  });
}

export async function setReconnectSession(input: {
  roomId: string;
  roomCode: string;
  game: string;
  sessionId: string;
}) {
  if (!redis.isOpen) return;
  await redis.set(`reconnect:${input.sessionId}`, JSON.stringify(input), {
    EX: config.roomTtlSeconds
  });
}

export async function getReconnectSession<T>(sessionId: string) {
  if (!redis.isOpen) return null;
  const value = await redis.get(`reconnect:${sessionId}`);
  return value ? (JSON.parse(value) as T) : null;
}

export async function clearReconnectSession(sessionId: string) {
  if (!redis.isOpen) return;
  await redis.del(`reconnect:${sessionId}`);
}
