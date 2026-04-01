import {
  PlayerSeat,
  RamsesAction,
  RamsesCard,
  RamsesCell,
  RamsesPlayer,
  RamsesSnapshot,
  TreasureKind,
  TREASURE_KINDS
} from '@rippd/shared';
import { recordMatchSummary, recordRoomEvent } from '../db';

export type InternalRamsesCell = RamsesCell & {
  hiddenCoin: TreasureKind | 'empty';
};

export type InternalRamsesGame = {
  type: 'ramses';
  rows: number;
  cols: number;
  phase: 'lobby' | 'playing' | 'round-over';
  cells: InternalRamsesCell[];
  players: RamsesPlayer[];
  turnIndex: number;
  hole: { x: number; y: number };
  currentCard?: RamsesCard;
  deck: RamsesCard[];
  deckIndex: number;
  movable: { x: number; y: number }[];
  message: string;
  winnerIds: string[];
  startedAt?: number;
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function createDeck() {
  return shuffle(
    TREASURE_KINDS.flatMap((treasure) => [
      { treasure, points: 1 as const },
      { treasure, points: 2 as const },
      { treasure, points: 3 as const }
    ])
  );
}

function buildCoins(rows: number, cols: number, hole: { x: number; y: number }) {
  const cells: InternalRamsesCell[] = [];
  const positions: { x: number; y: number }[] = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) positions.push({ x, y });
  }

  const treasurePositions = shuffle(positions.filter((position) => position.x !== hole.x || position.y !== hole.y)).slice(0, TREASURE_KINDS.length);
  const treasureMap = new Map(treasurePositions.map((position, index) => [`${position.x},${position.y}`, TREASURE_KINDS[index]]));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const k = `${x},${y}`;
      const hiddenCoin = treasureMap.get(k) ?? 'empty';
      const isHole = x === hole.x && y === hole.y;
      cells.push({
        x,
        y,
        covered: !isHole,
        hiddenCoin,
        coin: isHole ? hiddenCoin : 'empty',
        isHole
      });
    }
  }

  return cells;
}

function getCell(game: InternalRamsesGame, x: number, y: number) {
  return game.cells.find((cell) => cell.x === x && cell.y === y);
}

function currentPlayer(game: InternalRamsesGame) {
  return game.players[game.turnIndex];
}

function computeMovable(game: InternalRamsesGame) {
  return [
    { x: game.hole.x + 1, y: game.hole.y },
    { x: game.hole.x - 1, y: game.hole.y },
    { x: game.hole.x, y: game.hole.y + 1 },
    { x: game.hole.x, y: game.hole.y - 1 }
  ].filter((point) => point.x >= 0 && point.y >= 0 && point.x < game.cols && point.y < game.rows);
}

function moveToNextPlayer(game: InternalRamsesGame) {
  if (!game.players.length) return;
  game.turnIndex = (game.turnIndex + 1) % game.players.length;
}

function topCard(game: InternalRamsesGame) {
  return game.deck[game.deckIndex];
}

function updateRoundState(game: InternalRamsesGame) {
  game.currentCard = topCard(game);
  game.movable = game.phase === 'playing' ? computeMovable(game) : [];

  if (!game.currentCard) {
    const highScore = Math.max(...game.players.map((player) => player.score), 0);
    game.winnerIds = game.players.filter((player) => player.score === highScore).map((player) => player.id);
    game.phase = 'round-over';
    game.movable = [];
    game.message =
      game.winnerIds.length > 1
        ? `Deck finished. It's a tie on ${highScore} points.`
        : `${game.players.find((player) => player.id === game.winnerIds[0])?.name ?? 'Winner'} wins with ${highScore} points.`;
  }
}

export function createRamsesGame(players: PlayerSeat[]): InternalRamsesGame {
  const rows = 7;
  const cols = 7;
  const hole = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
  const deck = createDeck();

  const game: InternalRamsesGame = {
    type: 'ramses',
    rows,
    cols,
    phase: 'lobby',
    cells: buildCoins(rows, cols, hole),
    players: players.map((player) => ({ id: player.id, name: player.name, score: 0 })),
    turnIndex: 0,
    hole,
    currentCard: deck[0],
    deck,
    deckIndex: 0,
    movable: [],
    message: 'Press start, then slide a pyramid into the hole. Empty coins are safe, the wrong treasure ends your turn, and the matching treasure wins the card.',
    winnerIds: []
  };

  updateRoundState(game);
  return game;
}

export function currentRamsesPlayerId(game: InternalRamsesGame) {
  return currentPlayer(game)?.id ?? '';
}

export async function handleRamsesAction(roomCode: string, game: InternalRamsesGame, playerId: string, action: RamsesAction, playerCount: number) {
  if (game.phase !== 'playing' || action.type !== 'slide') return false;

  const player = currentPlayer(game);
  const card = game.currentCard;
  if (!player || player.id !== playerId || !card) return false;

  const clicked = getCell(game, action.x, action.y);
  const holeCell = getCell(game, game.hole.x, game.hole.y);
  if (!clicked || !holeCell || !clicked.covered) return false;

  const adjacent = Math.abs(clicked.x - game.hole.x) + Math.abs(clicked.y - game.hole.y) === 1;
  if (!adjacent) return false;

  holeCell.covered = true;
  holeCell.isHole = false;
  holeCell.coin = 'empty';
  clicked.covered = false;
  clicked.isHole = true;
  clicked.coin = clicked.hiddenCoin;
  game.hole = { x: clicked.x, y: clicked.y };

  if (clicked.hiddenCoin === card.treasure) {
    player.score += card.points;
    game.deckIndex += 1;
    moveToNextPlayer(game);
    updateRoundState(game);
    if (!game.currentCard) {
      await recordMatchSummary({
        roomId: roomCode,
        gameKind: 'ramses',
        winnerPlayerId: game.winnerIds[0],
        playerCount,
        startedAt: game.startedAt ? new Date(game.startedAt) : undefined,
        endedAt: new Date(),
        summary: {
          scores: game.players.map((entry) => ({ id: entry.id, score: entry.score })),
          winners: game.winnerIds
        }
      });
    } else {
      const nextCard = game.currentCard;
      game.message = `${player.name} found the ${card.treasure} and took ${card.points} point${card.points === 1 ? '' : 's'}. Next card: ${nextCard?.treasure ?? 'none'} for ${nextCard?.points ?? 0}.`;
    }
    return true;
  }

  if (clicked.hiddenCoin !== 'empty') {
    const wrongTreasure = clicked.hiddenCoin;
    moveToNextPlayer(game);
    updateRoundState(game);
    const nextPlayer = currentPlayer(game);
    game.message = `${player.name} hit the ${wrongTreasure} instead of the ${card.treasure}. Turn over — ${nextPlayer?.name ?? 'next player'} keeps chasing the same card for ${card.points}.`;
    return true;
  }

  game.movable = computeMovable(game);
  game.message = `${player.name} moved onto an empty coin. Keep sliding toward the ${card.treasure} worth ${card.points}.`;
  return true;
}

export function startRamses(roomCode: string, players: PlayerSeat[]) {
  const game = createRamsesGame(players);
  game.phase = 'playing';
  game.startedAt = Date.now();
  game.message = 'Slide a pyramid into the hole. Empty coins are safe, the wrong treasure ends your turn, and the matching treasure wins the card.';
  updateRoundState(game);
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
      covered: cell.covered,
      coin: cell.covered ? 'empty' : cell.coin,
      isHole: cell.isHole
    })),
    players: game.players,
    currentCard: game.currentCard,
    deckRemaining: Math.max(game.deck.length - game.deckIndex, 0),
    movable: game.movable,
    message: game.message,
    winnerIds: game.winnerIds
  };
}
