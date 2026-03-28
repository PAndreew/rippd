import { clamp, PLAYER_COLORS, PlayerSeat, wrapAngle, ZatackaSnapshot } from '@rippd/shared';
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
};

export type InternalZatackaGame = {
  type: 'zatacka';
  phase: 'lobby' | 'countdown' | 'running' | 'round-over';
  width: number;
  height: number;
  round: number;
  riders: InternalZatackaRider[];
  winnerId?: string;
  restartAt?: number;
  startedAt?: number;
  countdownEndsAt?: number;
  paused: boolean;
};

const TRAIL_CAP = 500;
// Collision fires when head center is within this distance of a trail point center.
// Equal to lineWidth (4px) so two bodies must visually overlap to register a hit.
const HIT_RADIUS_SQ = 16; // 4^2
// How many of a rider's own most-recent trail points to skip for self-collision,
// so tight turns don't clip the fresh wake.
const SELF_GRACE = 10;

export function createZatackaGame(): InternalZatackaGame {
  return {
    type: 'zatacka',
    phase: 'lobby',
    width: 960,
    height: 600,
    round: 0,
    riders: [],
    paused: false
  };
}

export function syncLobbyRiders(game: InternalZatackaGame, players: PlayerSeat[]) {
  game.riders = players.map((seat, index) => ({
    id: seat.id,
    name: seat.name,
    color: seat.color || PLAYER_COLORS[index % PLAYER_COLORS.length],
    controlPreset: seat.controlPreset,
    position: { x: 0, y: 0 },
    angle: 0,
    steering: 0,
    speed: 3.6,
    alive: false,
    trail: []
  }));
}

function sampleCirclePositions(count: number, width: number, height: number) {
  const radius = Math.min(width, height) * 0.28;
  return Array.from({ length: count }, (_, index) => {
    const posAngle = (Math.PI * 2 * index) / count;
    // Tangential direction (clockwise) with a small random offset so players
    // travel along the circle initially rather than rushing at walls or each other.
    const tangent = posAngle + Math.PI / 2;
    const jitter = (Math.random() - 0.5) * 0.6;
    return {
      x: width / 2 + Math.cos(posAngle) * radius,
      y: height / 2 + Math.sin(posAngle) * radius,
      angle: wrapAngle(tangent + jitter)
    };
  });
}

function hitsTrail(x: number, y: number, riders: InternalZatackaRider[], selfId: string): boolean {
  for (const rider of riders) {
    const trail = rider.trail;
    // Skip the rider's own freshest points so turns don't clip the wake.
    const limit = rider.id === selfId ? Math.max(0, trail.length - SELF_GRACE) : trail.length;
    for (let i = 0; i < limit; i++) {
      const dx = x - trail[i].x;
      const dy = y - trail[i].y;
      if (dx * dx + dy * dy < HIT_RADIUS_SQ) return true;
    }
  }
  return false;
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
  game.riders = players.map((player, index) => {
    const start = positions[index];
    return {
      id: player.id,
      name: player.name,
      color: player.color,
      controlPreset: player.controlPreset,
      position: { x: start.x, y: start.y },
      angle: start.angle,
      steering: 0,
      speed: 3.6,
      alive: true,
      trail: []
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
      });
    }
    return true;
  }

  if (game.phase !== 'running') return false;

  game.riders.forEach((rider) => {
    if (!rider.alive) return;
    rider.angle = wrapAngle(rider.angle + rider.steering * 0.14);
    rider.position.x += Math.cos(rider.angle) * rider.speed;
    rider.position.y += Math.sin(rider.angle) * rider.speed;

    const outOfBounds =
      rider.position.x < 4 || rider.position.x > game.width - 4 ||
      rider.position.y < 4 || rider.position.y > game.height - 4;

    if (outOfBounds || hitsTrail(rider.position.x, rider.position.y, game.riders, rider.id)) {
      rider.alive = false;
      return;
    }

    rider.trail.push({ x: rider.position.x, y: rider.position.y });
    if (rider.trail.length > TRAIL_CAP) rider.trail.shift();
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
      summary: { round: game.round }
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

export function buildZatackaSnapshot(game: InternalZatackaGame): ZatackaSnapshot {
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
      position: rider.position
    })),
    trails: game.riders.map((rider) => ({
      playerId: rider.id,
      color: rider.color,
      points: rider.trail
    })),
    winnerId: game.winnerId,
    countdownEndsAt: game.countdownEndsAt,
    paused: game.paused
  };
}
