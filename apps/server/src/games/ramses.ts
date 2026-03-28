import {
  hashPoint,
  PlayerSeat,
  RamsesAction,
  RamsesCell,
  RamsesPawn,
  RamsesSnapshot,
  randomFrom,
  TreasureColor,
  TREASURE_COLORS
} from '@rippd/shared';
import { recordMatchSummary, recordRoomEvent } from '../db';

export type InternalRamsesCell = RamsesCell & {
  treasure?: TreasureColor;
  discovered: boolean;
};

export type InternalRamsesGame = {
  type: 'ramses';
  rows: number;
  cols: number;
  phase: 'lobby' | 'slide' | 'move' | 'round-over';
  cells: InternalRamsesCell[];
  pawns: RamsesPawn[];
  turnIndex: number;
  targetCards: Record<string, TreasureColor | undefined>;
  empty: { x: number; y: number };
  reachable: { x: number; y: number }[];
  message: string;
  startedAt?: number;
};

export function createRamsesGame(players: PlayerSeat[]): InternalRamsesGame {
  const rows = 7;
  const cols = 7;
  const cells: InternalRamsesCell[] = [];
  const empty = { x: 3, y: 3 };

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const isEmpty = x === empty.x && y === empty.y;
      const blocked = !isEmpty && Math.random() < 0.45;
      cells.push({ x, y, blocked, discovered: !blocked });
    }
  }

  const openCells = cells.filter((cell) => !cell.blocked);
  const treasureSpots = [...openCells].sort(() => Math.random() - 0.5).slice(0, Math.min(10, openCells.length));
  treasureSpots.forEach((cell, index) => {
    cell.treasure = TREASURE_COLORS[index % TREASURE_COLORS.length];
  });

  const pawns: RamsesPawn[] = players.map((player, index) => ({
    id: player.id,
    name: player.name,
    position: index % 2 === 0 ? { x: 0, y: index } : { x: cols - 1, y: rows - 1 - index },
    score: 0
  }));

  const targetCards: Record<string, TreasureColor | undefined> = {};
  pawns.forEach((pawn) => {
    targetCards[pawn.id] = randomFrom(TREASURE_COLORS);
  });

  const game: InternalRamsesGame = {
    type: 'ramses',
    rows,
    cols,
    phase: pawns.length ? 'slide' : 'lobby',
    cells,
    pawns,
    turnIndex: 0,
    targetCards,
    empty,
    reachable: [],
    message: 'Slide a neighbouring pyramid into the empty slot, then move along the open path.',
    startedAt: Date.now()
  };

  if (pawns[0]) {
    game.reachable = computeReachable(game, pawns[0].position);
  }

  return game;
}

function getCell(game: InternalRamsesGame, x: number, y: number) {
  return game.cells.find((cell) => cell.x === x && cell.y === y);
}

function currentPawn(game: InternalRamsesGame) {
  return game.pawns[game.turnIndex];
}

function computeReachable(game: InternalRamsesGame, start: { x: number; y: number }) {
  const queue = [start];
  const seen = new Set<string>([hashPoint(start)]);
  const result = [start];

  while (queue.length) {
    const current = queue.shift()!;
    const neighbours = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];

    neighbours.forEach((next) => {
      if (next.x < 0 || next.y < 0 || next.x >= game.cols || next.y >= game.rows) return;
      const key = hashPoint(next);
      if (seen.has(key)) return;
      const cell = getCell(game, next.x, next.y);
      if (!cell || cell.blocked) return;
      seen.add(key);
      queue.push(next);
      result.push(next);
    });
  }

  return result;
}

function findPath(game: InternalRamsesGame, start: { x: number; y: number }, end: { x: number; y: number }) {
  const queue = [start];
  const parents = new Map<string, string>();
  const seen = new Set<string>([hashPoint(start)]);

  while (queue.length) {
    const current = queue.shift()!;
    if (current.x === end.x && current.y === end.y) break;
    const neighbours = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];

    neighbours.forEach((next) => {
      if (next.x < 0 || next.y < 0 || next.x >= game.cols || next.y >= game.rows) return;
      const key = hashPoint(next);
      if (seen.has(key)) return;
      const cell = getCell(game, next.x, next.y);
      if (!cell || cell.blocked) return;
      seen.add(key);
      parents.set(key, hashPoint(current));
      queue.push(next);
    });
  }

  if (!seen.has(hashPoint(end))) return [];
  const path: { x: number; y: number }[] = [];
  let cursor = hashPoint(end);
  while (cursor) {
    const [x, y] = cursor.split(',').map(Number);
    path.unshift({ x, y });
    cursor = parents.get(cursor) ?? '';
  }
  return path;
}

function nextTarget(current?: TreasureColor): TreasureColor | undefined {
  const pool = TREASURE_COLORS.filter((color) => color !== current);
  return pool.length ? randomFrom(pool) : current;
}

export function currentRamsesPlayerId(game: InternalRamsesGame) {
  return currentPawn(game)?.id ?? '';
}

export async function handleRamsesAction(roomCode: string, game: InternalRamsesGame, playerId: string, action: RamsesAction, playerCount: number) {
  if (game.phase === 'lobby' || game.phase === 'round-over') return false;
  const pawn = currentPawn(game);
  if (!pawn || pawn.id !== playerId) return false;

  if (action.type === 'slide' && game.phase === 'slide') {
    const cell = getCell(game, action.x, action.y);
    const emptyCell = getCell(game, game.empty.x, game.empty.y);
    if (!cell || !emptyCell || !cell.blocked) return false;
    const adjacent = Math.abs(cell.x - game.empty.x) + Math.abs(cell.y - game.empty.y) === 1;
    if (!adjacent) return false;

    emptyCell.blocked = true;
    cell.blocked = false;
    cell.discovered = true;
    cell.revealedTreasure = cell.treasure;
    game.empty = { x: cell.x, y: cell.y };
    game.phase = 'move';
    game.reachable = computeReachable(game, pawn.position);
    game.message = 'Now move your pawn through the open path.';
    return true;
  }

  if (action.type === 'move' && game.phase === 'move') {
    const reachable = game.reachable.some((spot) => spot.x === action.x && spot.y === action.y);
    if (!reachable) return false;
    const destination = getCell(game, action.x, action.y);
    if (!destination || destination.blocked) return false;

    const path = findPath(game, pawn.position, { x: action.x, y: action.y });
    const target = game.targetCards[pawn.id];
    const touchedOtherTreasure = path.some((step, index) => {
      const stepCell = getCell(game, step.x, step.y);
      if (!stepCell?.revealedTreasure) return false;
      if (index === path.length - 1 && stepCell.revealedTreasure === target) return false;
      return true;
    });

    pawn.position = { x: action.x, y: action.y };

    if (!touchedOtherTreasure && destination.revealedTreasure && destination.revealedTreasure === target) {
      pawn.score += 1;
      game.targetCards[pawn.id] = nextTarget(target);
      game.message = `${pawn.name} claimed the ${target} treasure.`;
    } else if (touchedOtherTreasure) {
      game.message = `${pawn.name} touched another treasure on the way, so the card was not claimed.`;
    } else {
      game.message = `${pawn.name} moved safely but did not reach the target treasure.`;
    }

    if (pawn.score >= 3) {
      game.phase = 'round-over';
      game.reachable = [];
      game.message = `${pawn.name} wins the treasure race.`;
      await recordMatchSummary({
        roomId: roomCode,
        gameKind: 'ramses',
        winnerPlayerId: pawn.id,
        playerCount,
        startedAt: game.startedAt ? new Date(game.startedAt) : undefined,
        endedAt: new Date(),
        summary: { scores: game.pawns.map((entry) => ({ id: entry.id, score: entry.score })) }
      });
      return true;
    }

    game.turnIndex = (game.turnIndex + 1) % game.pawns.length;
    game.phase = 'slide';
    game.reachable = computeReachable(game, currentPawn(game).position);
    return true;
  }

  return false;
}

export function startRamses(roomCode: string, players: PlayerSeat[]) {
  const game = createRamsesGame(players);
  void recordRoomEvent({ roomId: roomCode, gameKind: 'ramses', eventType: 'match_started', payload: { players: players.length } });
  return game;
}

export function buildRamsesSnapshot(game: InternalRamsesGame): RamsesSnapshot {
  return {
    type: 'ramses',
    rows: game.rows,
    cols: game.cols,
    phase: game.phase,
    turnPlayerId: currentRamsesPlayerId(game),
    cells: game.cells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      blocked: cell.blocked,
      revealedTreasure: cell.discovered && !cell.blocked ? cell.revealedTreasure : undefined
    })),
    pawns: game.pawns,
    targetCards: game.targetCards,
    reachable: game.phase === 'move' ? game.reachable : [],
    message: game.message
  };
}
