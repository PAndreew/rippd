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
  phase: 'lobby' | 'running' | 'round-over';
  width: number;
  height: number;
  round: number;
  riders: InternalZatackaRider[];
  occupied: Set<string>;
  winnerId?: string;
  restartAt?: number;
  startedAt?: number;
};

export function createZatackaGame(): InternalZatackaGame {
  return {
    type: 'zatacka',
    phase: 'lobby',
    width: 960,
    height: 600,
    round: 0,
    riders: [],
    occupied: new Set<string>()
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
    const angle = (Math.PI * 2 * index) / count;
    return {
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
      angle: wrapAngle(angle + Math.PI)
    };
  });
}

function toTrailKey(x: number, y: number) {
  return `${Math.round(x / 4)},${Math.round(y / 4)}`;
}

export function startZatacka(roomCode: string, game: InternalZatackaGame, players: PlayerSeat[]) {
  const positions = sampleCirclePositions(players.length || 1, game.width, game.height);
  game.phase = 'running';
  game.round += 1;
  game.winnerId = undefined;
  game.occupied = new Set<string>();
  game.restartAt = undefined;
  game.startedAt = Date.now();
  game.riders = players.map((player, index) => {
    const start = positions[index];
    const rider: InternalZatackaRider = {
      id: player.id,
      name: player.name,
      color: player.color,
      controlPreset: player.controlPreset,
      position: { x: start.x, y: start.y },
      angle: start.angle,
      steering: 0,
      speed: 3.6,
      alive: true,
      trail: [{ x: start.x, y: start.y }]
    };
    game.occupied.add(toTrailKey(start.x, start.y));
    return rider;
  });
  void recordRoomEvent({ roomId: roomCode, gameKind: 'zatacka', eventType: 'match_started', payload: { players: players.length, round: game.round } });
}

export async function tickZatacka(roomCode: string, game: InternalZatackaGame, playerCount: number) {
  if (game.phase !== 'running') return false;

  game.riders.forEach((rider) => {
    if (!rider.alive) return;
    rider.angle = wrapAngle(rider.angle + rider.steering * 0.14);
    rider.position.x += Math.cos(rider.angle) * rider.speed;
    rider.position.y += Math.sin(rider.angle) * rider.speed;

    const outOfBounds = rider.position.x < 4 || rider.position.x > game.width - 4 || rider.position.y < 4 || rider.position.y > game.height - 4;
    const collision = game.occupied.has(toTrailKey(rider.position.x, rider.position.y));
    if (outOfBounds || collision) {
      rider.alive = false;
      return;
    }

    rider.trail.push({ x: rider.position.x, y: rider.position.y });
    if (rider.trail.length > 180) rider.trail.shift();
    game.occupied.add(toTrailKey(rider.position.x, rider.position.y));
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
    winnerId: game.winnerId
  };
}
