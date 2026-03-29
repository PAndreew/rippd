import {
  clamp,
  PLAYER_COLORS,
  PlayerSeat,
  Point,
  randomFrom,
  wrapAngle,
  ZatackaPowerupKind,
  ZatackaPowerupPickup,
  ZatackaSettings,
  ZatackaSettingsUpdate,
  ZatackaSnapshot
} from '@rippd/shared';
import { nanoid } from 'nanoid';
import { recordMatchSummary, recordRoomEvent } from '../db';

export type InternalZatackaRider = {
  id: string;
  name: string;
  color: string;
  controlPreset: PlayerSeat['controlPreset'];
  position: { x: number; y: number };
  angle: number;
  steering: -1 | 0 | 1;
  speed: number;
  alive: boolean;
  trail: { x: number; y: number }[];
  trailTicks: number;
  gapOffset: number;
  carriedPowerup?: ZatackaPowerupKind;
  ghostUntil?: number;
};

export type InternalZatackaGame = {
  type: 'zatacka';
  phase: 'lobby' | 'countdown' | 'running' | 'round-over';
  width: number;
  height: number;
  round: number;
  riders: InternalZatackaRider[];
  powerups: ZatackaPowerupPickup[];
  winnerId?: string;
  restartAt?: number;
  startedAt?: number;
  countdownEndsAt?: number;
  nextPowerupSpawnAt?: number;
  paused: boolean;
  settings: ZatackaSettings;
};

const DEFAULT_SPEED = 3.6;
const MIN_SPEED = 2.2;
const MAX_SPEED = 7.2;
const TRAIL_CAP = 700;
const HIT_RADIUS_SQ = 16;
const SELF_GRACE = 10;
const GAP_CYCLE_TICKS = 56;
const GAP_OPEN_TICKS = 12;
const POWERUP_SPAWN_EVERY_MS = 7000;
const MAX_POWERUPS_ON_BOARD = 3;
const POWERUP_PICKUP_RADIUS_SQ = 18 * 18;
const BOMB_RADIUS_SQ = 46 * 46;
const GHOST_DURATION_MS = 4000;
const SEGMENT_BREAK_DISTANCE_SQ = 20 * 20;

function createInternalRider(seat: PlayerSeat, index: number): InternalZatackaRider {
  return {
    id: seat.id,
    name: seat.name,
    color: seat.color || PLAYER_COLORS[index % PLAYER_COLORS.length],
    controlPreset: seat.controlPreset,
    position: { x: 0, y: 0 },
    angle: 0,
    steering: 0,
    speed: DEFAULT_SPEED,
    alive: false,
    trail: [],
    trailTicks: 0,
    gapOffset: Math.floor(Math.random() * GAP_CYCLE_TICKS)
  };
}

export function createZatackaGame(): InternalZatackaGame {
  return {
    type: 'zatacka',
    phase: 'lobby',
    width: 960,
    height: 600,
    round: 0,
    riders: [],
    powerups: [],
    paused: false,
    settings: {
      speed: DEFAULT_SPEED,
      walls: true,
      gaps: true
    }
  };
}

export function syncLobbyRiders(game: InternalZatackaGame, players: PlayerSeat[]) {
  game.riders = players.map((seat, index) => createInternalRider(seat, index));
}

function sampleCirclePositions(count: number, width: number, height: number) {
  const radius = Math.min(width, height) * 0.28;
  return Array.from({ length: count }, (_, index) => {
    const posAngle = (Math.PI * 2 * index) / count;
    const tangent = posAngle + Math.PI / 2;
    const jitter = (Math.random() - 0.5) * 0.6;
    return {
      x: width / 2 + Math.cos(posAngle) * radius,
      y: height / 2 + Math.sin(posAngle) * radius,
      angle: wrapAngle(tangent + jitter)
    };
  });
}

function hasGhost(rider: InternalZatackaRider, now: number) {
  return (rider.ghostUntil ?? 0) > now;
}

function shouldLeaveTrail(rider: InternalZatackaRider, game: InternalZatackaGame) {
  if (!game.settings.gaps) return true;
  return ((rider.trailTicks + rider.gapOffset) % GAP_CYCLE_TICKS) >= GAP_OPEN_TICKS;
}

function hitsTrail(x: number, y: number, riders: InternalZatackaRider[], selfId: string, now: number): boolean {
  for (const rider of riders) {
    if (hasGhost(rider, now)) continue;
    const trail = rider.trail;
    const limit = rider.id === selfId ? Math.max(0, trail.length - SELF_GRACE) : trail.length;
    for (let i = 0; i < limit; i++) {
      const dx = x - trail[i].x;
      const dy = y - trail[i].y;
      if (dx * dx + dy * dy < HIT_RADIUS_SQ) return true;
    }
  }
  return false;
}

function splitTrailIntoSegments(points: Point[]) {
  const segments: Point[][] = [];
  let current: Point[] = [];

  for (const point of points) {
    const previous = current[current.length - 1];
    if (previous) {
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      if (dx * dx + dy * dy > SEGMENT_BREAK_DISTANCE_SQ) {
        if (current.length > 1) segments.push(current);
        current = [];
      }
    }
    current.push(point);
  }

  if (current.length > 1) segments.push(current);
  return segments;
}

function spawnPowerup(game: InternalZatackaGame) {
  if (game.powerups.length >= MAX_POWERUPS_ON_BOARD) return;

  const margin = 50;
  game.powerups.push({
    id: nanoid(8),
    kind: randomFrom<ZatackaPowerupKind>(['bomb', 'ghost']),
    position: {
      x: margin + Math.random() * (game.width - margin * 2),
      y: margin + Math.random() * (game.height - margin * 2)
    }
  });
}

function collectPowerup(rider: InternalZatackaRider, game: InternalZatackaGame) {
  const index = game.powerups.findIndex((powerup) => {
    const dx = rider.position.x - powerup.position.x;
    const dy = rider.position.y - powerup.position.y;
    return dx * dx + dy * dy <= POWERUP_PICKUP_RADIUS_SQ;
  });

  if (index === -1) return false;
  rider.carriedPowerup = game.powerups[index].kind;
  game.powerups.splice(index, 1);
  return true;
}

function carveTrailHole(game: InternalZatackaGame, center: Point, radiusSq: number) {
  game.riders.forEach((rider) => {
    rider.trail = rider.trail.filter((point) => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return dx * dx + dy * dy > radiusSq;
    });
  });
}

export function applyZatackaSettings(game: InternalZatackaGame, update: ZatackaSettingsUpdate) {
  if (typeof update.speed === 'number' && Number.isFinite(update.speed)) {
    game.settings.speed = clamp(update.speed, MIN_SPEED, MAX_SPEED);
    game.riders.forEach((rider) => {
      rider.speed = game.settings.speed;
    });
  }

  if (typeof update.walls === 'boolean') game.settings.walls = update.walls;
  if (typeof update.gaps === 'boolean') game.settings.gaps = update.gaps;
}

export function startZatacka(roomCode: string, game: InternalZatackaGame, players: PlayerSeat[]) {
  const positions = sampleCirclePositions(players.length || 1, game.width, game.height);
  game.phase = 'countdown';
  game.paused = false;
  game.round += 1;
  game.winnerId = undefined;
  game.restartAt = undefined;
  game.startedAt = undefined;
  game.countdownEndsAt = Date.now() + 3000;
  game.nextPowerupSpawnAt = Date.now() + 4500;
  game.powerups = [];
  game.riders = players.map((player, index) => {
    const start = positions[index];
    return {
      ...createInternalRider(player, index),
      position: { x: start.x, y: start.y },
      angle: start.angle,
      speed: game.settings.speed,
      alive: true
    };
  });
  void recordRoomEvent({ roomId: roomCode, gameKind: 'zatacka', eventType: 'match_started', payload: { players: players.length, round: game.round } });
}

export async function tickZatacka(roomCode: string, game: InternalZatackaGame, playerCount: number) {
  if (game.paused) return true;

  if (game.phase === 'countdown') {
    if (Date.now() >= (game.countdownEndsAt ?? 0)) {
      game.phase = 'running';
      game.startedAt = Date.now();
      game.riders.forEach((rider) => {
        rider.trail = [{ x: rider.position.x, y: rider.position.y }];
        rider.trailTicks = 0;
      });
    }
    return true;
  }

  if (game.phase !== 'running') return false;

  const now = Date.now();
  if (now >= (game.nextPowerupSpawnAt ?? 0)) {
    spawnPowerup(game);
    game.nextPowerupSpawnAt = now + POWERUP_SPAWN_EVERY_MS;
  }

  game.riders.forEach((rider) => {
    if (!rider.alive) return;

    rider.angle = wrapAngle(rider.angle + rider.steering * 0.14);
    rider.position.x += Math.cos(rider.angle) * rider.speed;
    rider.position.y += Math.sin(rider.angle) * rider.speed;

    let outOfBounds = false;
    if (game.settings.walls) {
      outOfBounds =
        rider.position.x < 4 || rider.position.x > game.width - 4 ||
        rider.position.y < 4 || rider.position.y > game.height - 4;
    } else {
      if (rider.position.x < 0) rider.position.x += game.width;
      if (rider.position.x > game.width) rider.position.x -= game.width;
      if (rider.position.y < 0) rider.position.y += game.height;
      if (rider.position.y > game.height) rider.position.y -= game.height;
    }

    if (outOfBounds) {
      rider.alive = false;
      return;
    }

    if (!hasGhost(rider, now) && hitsTrail(rider.position.x, rider.position.y, game.riders, rider.id, now)) {
      rider.alive = false;
      return;
    }

    collectPowerup(rider, game);

    if (shouldLeaveTrail(rider, game)) {
      rider.trail.push({ x: rider.position.x, y: rider.position.y });
      if (rider.trail.length > TRAIL_CAP) rider.trail.shift();
    }

    rider.trailTicks += 1;
  });

  const alive = game.riders.filter((rider) => rider.alive);
  if (alive.length <= 1) {
    game.phase = 'round-over';
    game.winnerId = alive[0]?.id;
    game.restartAt = Date.now() + 2200;
    await recordMatchSummary({
      roomId: roomCode,
      gameKind: 'zatacka',
      winnerPlayerId: game.winnerId,
      playerCount,
      startedAt: game.startedAt ? new Date(game.startedAt) : undefined,
      endedAt: new Date(),
      summary: { round: game.round, walls: game.settings.walls, speed: game.settings.speed }
    });
    return true;
  }

  return true;
}

export function maybeRestartZatacka(roomCode: string, game: InternalZatackaGame, players: PlayerSeat[]) {
  if (game.phase === 'round-over' && game.restartAt && Date.now() >= game.restartAt && players.length >= 2) {
    startZatacka(roomCode, game, players);
    return true;
  }
  return false;
}

export function applyZatackaInput(game: InternalZatackaGame, playerId: string, steering: -1 | 0 | 1) {
  const rider = game.riders.find((entry) => entry.id === playerId);
  if (!rider) return;
  rider.steering = clamp(steering, -1, 1) as -1 | 0 | 1;
}

export function useZatackaPowerup(game: InternalZatackaGame, playerId: string) {
  const rider = game.riders.find((entry) => entry.id === playerId && entry.alive);
  if (!rider?.carriedPowerup) return false;

  if (rider.carriedPowerup === 'bomb') {
    carveTrailHole(game, rider.position, BOMB_RADIUS_SQ);
  } else if (rider.carriedPowerup === 'ghost') {
    rider.ghostUntil = Date.now() + GHOST_DURATION_MS;
  }

  rider.carriedPowerup = undefined;
  return true;
}

export function buildZatackaSnapshot(game: InternalZatackaGame): ZatackaSnapshot {
  const now = Date.now();
  return {
    type: 'zatacka',
    phase: game.phase,
    width: game.width,
    height: game.height,
    round: game.round,
    riders: game.riders.map((rider) => ({
      id: rider.id,
      name: rider.name,
      color: rider.color,
      controlPreset: rider.controlPreset,
      alive: rider.alive,
      position: rider.position,
      carriedPowerup: rider.carriedPowerup,
      ghostActive: hasGhost(rider, now)
    })),
    trails: game.riders.map((rider) => ({
      playerId: rider.id,
      color: rider.color,
      segments: splitTrailIntoSegments(rider.trail)
    })),
    powerups: [...game.powerups],
    settings: { ...game.settings },
    winnerId: game.winnerId,
    countdownEndsAt: game.countdownEndsAt,
    paused: game.paused
  };
}
