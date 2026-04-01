import { ExplodeAction, ExplodeCell, ExplodePlayer, ExplodeSnapshot, PlayerSeat } from '@rippd/shared';
import { recordMatchSummary, recordRoomEvent } from '../db';

type InternalExplodeCell = {
  x: number;
  y: number;
  revealed: boolean;
  adjacent: number;
  hasMine: boolean;
  exploded: boolean;
  ownerId?: string;
};

export type InternalExplodeGame = {
  type: 'explode';
  rows: number;
  cols: number;
  mines: number;
  phase: 'lobby' | 'playing' | 'round-over';
  turnIndex: number;
  cells: InternalExplodeCell[];
  players: ExplodePlayer[];
  safeCellsRemaining: number;
  message: string;
  winnerIds: string[];
  minesPlaced: boolean;
  startedAt?: number;
};

const DEFAULT_ROWS = 12;
const DEFAULT_COLS = 12;
const DEFAULT_MINES = 24;

function key(x: number, y: number) {
  return `${x},${y}`;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function createEmptyCells(rows: number, cols: number) {
  const cells: InternalExplodeCell[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      cells.push({ x, y, revealed: false, adjacent: 0, hasMine: false, exploded: false });
    }
  }
  return cells;
}

function getCell(game: InternalExplodeGame, x: number, y: number) {
  return game.cells.find((cell) => cell.x === x && cell.y === y);
}

function getNeighbors(game: InternalExplodeGame, x: number, y: number) {
  const neighbors: InternalExplodeCell[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const next = getCell(game, x + dx, y + dy);
      if (next) neighbors.push(next);
    }
  }
  return neighbors;
}

function currentPlayer(game: InternalExplodeGame) {
  return game.players[game.turnIndex];
}

function moveToNextPlayer(game: InternalExplodeGame) {
  if (!game.players.length) return;
  game.turnIndex = (game.turnIndex + 1) % game.players.length;
}

function placeMines(game: InternalExplodeGame, safeX: number, safeY: number) {
  const blocked = new Set<string>();
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = safeX + dx;
      const y = safeY + dy;
      if (x >= 0 && y >= 0 && x < game.cols && y < game.rows) blocked.add(key(x, y));
    }
  }

  const candidates = shuffle(game.cells.filter((cell) => !blocked.has(key(cell.x, cell.y))));
  candidates.slice(0, game.mines).forEach((cell) => {
    cell.hasMine = true;
  });

  game.cells.forEach((cell) => {
    cell.adjacent = getNeighbors(game, cell.x, cell.y).filter((neighbor) => neighbor.hasMine).length;
  });

  game.minesPlaced = true;
}

function revealFlood(game: InternalExplodeGame, start: InternalExplodeCell, ownerId: string) {
  const queue: InternalExplodeCell[] = [start];
  const opened: InternalExplodeCell[] = [];

  while (queue.length) {
    const cell = queue.shift();
    if (!cell || cell.revealed || cell.hasMine) continue;

    cell.revealed = true;
    cell.ownerId = ownerId;
    opened.push(cell);
    game.safeCellsRemaining -= 1;

    if (cell.adjacent === 0) {
      getNeighbors(game, cell.x, cell.y).forEach((neighbor) => {
        if (!neighbor.revealed && !neighbor.hasMine) queue.push(neighbor);
      });
    }
  }

  return opened;
}

function settleRound(game: InternalExplodeGame) {
  const highScore = Math.max(...game.players.map((player) => player.score), 0);
  game.winnerIds = game.players.filter((player) => player.score === highScore).map((player) => player.id);
  game.phase = 'round-over';
  game.message =
    game.winnerIds.length > 1
      ? `All safe cells cleared. Tie on ${highScore} point${highScore === 1 ? '' : 's'}.`
      : `${game.players.find((player) => player.id === game.winnerIds[0])?.name ?? 'Winner'} wins with ${highScore} point${highScore === 1 ? '' : 's'}.`;
}

export function createExplodeGame(players: PlayerSeat[]) {
  return {
    type: 'explode',
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    mines: DEFAULT_MINES,
    phase: 'lobby',
    turnIndex: 0,
    cells: createEmptyCells(DEFAULT_ROWS, DEFAULT_COLS),
    players: players.map((player) => ({ id: player.id, name: player.name, score: 0, blasts: 0 })),
    safeCellsRemaining: DEFAULT_ROWS * DEFAULT_COLS - DEFAULT_MINES,
    message: 'Press start, then reveal safe cells. Empty zones cascade, mines cost points and pass the turn.',
    winnerIds: [],
    minesPlaced: false
  } satisfies InternalExplodeGame;
}

export function startExplode(roomCode: string, players: PlayerSeat[]) {
  const game = createExplodeGame(players);
  game.phase = 'playing';
  game.startedAt = Date.now();
  game.message = 'Reveal a tile. The first move is always safe, and clearing empty space can open a huge chain.';
  void recordRoomEvent({ roomId: roomCode, gameKind: 'explode', eventType: 'match_started', payload: { players: players.length } });
  return game;
}

export function currentExplodePlayerId(game: InternalExplodeGame) {
  return currentPlayer(game)?.id ?? '';
}

export async function handleExplodeAction(roomCode: string, game: InternalExplodeGame, playerId: string, action: ExplodeAction, playerCount: number) {
  if (game.phase !== 'playing' || action.type !== 'reveal') return false;

  const player = currentPlayer(game);
  if (!player || player.id !== playerId) return false;

  const cell = getCell(game, action.x, action.y);
  if (!cell || cell.revealed) return false;

  if (!game.minesPlaced) placeMines(game, action.x, action.y);

  if (cell.hasMine) {
    cell.revealed = true;
    cell.exploded = true;
    cell.ownerId = player.id;
    player.score -= 2;
    player.blasts += 1;
    moveToNextPlayer(game);
    game.message = `${player.name} hit a mine. -2 points and the turn passes.`;
    return true;
  }

  const opened = revealFlood(game, cell, player.id);
  player.score += opened.length;

  if (game.safeCellsRemaining <= 0) {
    settleRound(game);
    await recordMatchSummary({
      roomId: roomCode,
      gameKind: 'explode',
      winnerPlayerId: game.winnerIds[0],
      playerCount,
      startedAt: game.startedAt ? new Date(game.startedAt) : undefined,
      endedAt: new Date(),
      summary: {
        scores: game.players.map((entry) => ({ id: entry.id, score: entry.score, blasts: entry.blasts })),
        winners: game.winnerIds
      }
    });
  } else {
    game.message = `${player.name} cleared ${opened.length} tile${opened.length === 1 ? '' : 's'} and keeps the turn.`;
  }

  return true;
}

export function buildExplodeSnapshot(game: InternalExplodeGame): ExplodeSnapshot {
  const revealAllMines = game.phase === 'round-over';
  return {
    type: 'explode',
    rows: game.rows,
    cols: game.cols,
    mines: game.mines,
    phase: game.phase,
    turnPlayerId: currentExplodePlayerId(game),
    cells: game.cells.map<ExplodeCell>((cell) => ({
      x: cell.x,
      y: cell.y,
      revealed: cell.revealed,
      adjacent: cell.revealed ? cell.adjacent : undefined,
      mine: cell.revealed ? cell.hasMine : revealAllMines ? cell.hasMine : false,
      exploded: cell.exploded,
      ownerId: cell.ownerId
    })),
    players: game.players.map((player) => ({ ...player })),
    safeCellsRemaining: game.safeCellsRemaining,
    message: game.message,
    winnerIds: [...game.winnerIds]
  };
}
