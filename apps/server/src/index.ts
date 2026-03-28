import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'colyseus';
import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { matchMaker } from 'colyseus';
import { config } from './config';
import { connectInfrastructure } from './infrastructure';
import { RippdRoom } from './rooms/rippd-room';
import { getReconnectSession } from './presence-store';
import { authenticateUser, getUserFromBearerToken, issueAuthToken, registerUser } from './auth';

const app = express();
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/auth/register', async (req, res) => {
  try {
    const user = await registerUser(req.body as { email: string; password: string; displayName: string });
    res.status(201).json({ token: issueAuthToken(user.id), user });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create account' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const user = await authenticateUser(req.body as { email: string; password: string });
    res.json({ token: issueAuthToken(user.id), user });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : 'Failed to sign in' });
  }
});

app.get('/auth/me', async (req, res) => {
  const user = await getUserFromBearerToken(req.header('authorization') ?? undefined);
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  res.json({ user });
});

app.get('/reconnect/:sessionId', async (req, res) => {
  const session = await getReconnectSession<{ roomId: string; roomCode: string; game: string; sessionId: string }>(req.params.sessionId);
  if (!session) {
    res.status(404).json({ ok: false });
    return;
  }
  res.json({ ok: true, session });
});

const server = http.createServer(app);

async function bootstrap() {
  await connectInfrastructure();

  const gameServer = new Server({
    transport: new WebSocketTransport({ server }),
    presence: new RedisPresence(config.redisUrl) as never,
    driver: new RedisDriver(config.redisUrl)
  });

  gameServer.define('rippd', RippdRoom).filterBy(['roomCode', 'game']);

  app.post('/matchmake/join-or-create', async (req, res) => {
    try {
      const { roomCode, game, nickname } = req.body as { roomCode: string; game: 'zatacka' | 'ramses'; nickname: string };
      const seatReservation = await matchMaker.joinOrCreate('rippd', {
        roomCode: String(roomCode).toUpperCase(),
        game,
        nickname
      });
      res.json(seatReservation);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to reserve seat' });
    }
  });

  server.listen(config.port, () => {
    console.log(`rippd Colyseus server listening on ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to boot server', error);
  process.exit(1);
});
