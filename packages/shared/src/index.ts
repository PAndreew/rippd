export type GameKind = 'slither' | 'ramses' | 'explode';
export type ControlPreset = 'arrows' | 'wasd' | 'tfgh' | 'ijkl';

export const GAME_CONFIG = {
  slither: {
    kind: 'slither' as const,
    name: 'Slither',
    tagline: 'Last snake standing',
    description: 'A remake of Zatacka — leave trails, dodge your rivals, be the last snake standing.'
  },
  ramses: {
    kind: 'ramses' as const,
    name: 'Treasure Hunt',
    tagline: 'Card-driven treasure race',
    description: 'Pull treasure cards, slide pyramids around a single hole, and reach the matching treasure without stumbling onto the wrong one.'
  },
  explode: {
    kind: 'explode' as const,
    name: 'Explode',
    tagline: 'Competitive minesweeper',
    description: 'Take turns clearing a live minefield, chain open safe zones, and outscore your rivals without blowing yourself up.'
  }
};

export const GAME_THEME: Record<
  GameKind,
  {
    surface: string;
    surfaceMuted: string;
    contrastSurface: string;
    contrastText: string;
    accent: string;
    accentSoft: string;
    badgeClasses: string[];
    emoji: string;
    badgeLabel: string;
  }
> = {
  slither: {
    surface: '#050816',
    surfaceMuted: '#0c1533',
    contrastSurface: '#f8fafc',
    contrastText: '#08111f',
    accent: '#6ee7b7',
    accentSoft: 'rgba(110, 231, 183, 0.18)',
    badgeClasses: ['Live action', 'Arcade', 'Multiplayer'],
    emoji: '🏍️',
    badgeLabel: 'Speed'
  },
  ramses: {
    surface: '#f8fafc',
    surfaceMuted: '#e2e8f0',
    contrastSurface: '#08111f',
    contrastText: '#f8fafc',
    accent: '#f59e0b',
    accentSoft: 'rgba(245, 158, 11, 0.18)',
    badgeClasses: ['Board game', 'Strategy', 'Multiplayer'],
    emoji: '🔺',
    badgeLabel: 'Puzzle'
  },
  explode: {
    surface: '#fff7ed',
    surfaceMuted: '#fde7d2',
    contrastSurface: '#08111f',
    contrastText: '#fff7ed',
    accent: '#f97316',
    accentSoft: 'rgba(249, 115, 22, 0.18)',
    badgeClasses: ['Puzzle', 'Competitive', 'Multiplayer'],
    emoji: '💥',
    badgeLabel: 'Mind game'
  }
};

export const CONTROL_KEYSETS: Record<ControlPreset, { left: string; right: string; action: string }> = {
  arrows: { left: 'arrowleft', right: 'arrowright', action: 'arrowup' },
  wasd: { left: 'a', right: 'd', action: 'w' },
  tfgh: { left: 'f', right: 'h', action: 't' },
  ijkl: { left: 'j', right: 'l', action: 'i' }
};

export type TreasureKind = 'star' | 'diamond' | 'scarab' | 'ankh' | 'sun' | 'eye';
export const TREASURE_KINDS: TreasureKind[] = ['star', 'diamond', 'scarab', 'ankh', 'sun', 'eye'];

export type Point = { x: number; y: number };

export type PlayerSeat = {
  id: string;
  socketId: string;
  name: string;
  controlPreset: ControlPreset;
  color: string;
};

export type ViewerState = {
  socketId: string;
  localPlayerIds: string[];
};

export type CreateOrJoinPayload = {
  roomId: string;
  nickname: string;
  preferredGame: GameKind;
};

export type AddLocalPlayerPayload = {
  name: string;
  controlPreset: ControlPreset;
};

export type SlitherControlInput = {
  playerId: string;
  steering: -1 | 0 | 1;
};

export type SlitherPowerupKind = 'bomb' | 'ghost';

export type SlitherSettings = {
  speed: number;
  walls: boolean;
  gaps: boolean;
  powerups: boolean;
};

export type SlitherSettingsUpdate = Partial<SlitherSettings>;

export type SlitherUsePowerupInput = {
  playerId: string;
};

export type RamsesAction = { type: 'slide'; x: number; y: number };
export type ExplodeAction = { type: 'reveal'; x: number; y: number };

export type SlitherRiderState = {
  id: string;
  name: string;
  color: string;
  controlPreset: ControlPreset;
  alive: boolean;
  position: Point;
};

export type SlitherTrail = {
  playerId: string;
  color: string;
  segments: Point[][];
};

export type SlitherPowerupPickup = {
  id: string;
  kind: SlitherPowerupKind;
  position: Point;
};

export type SlitherSnapshotRider = SlitherRiderState & { carriedPowerup?: SlitherPowerupKind; ghostActive: boolean };

export type SlitherSnapshot = {
  type: 'slither';
  phase: 'lobby' | 'countdown' | 'running' | 'round-over';
  width: number;
  height: number;
  round: number;
  riders: SlitherSnapshotRider[];
  trails: SlitherTrail[];
  powerups: SlitherPowerupPickup[];
  settings: SlitherSettings;
  scores: Record<string, number>;
  winnerId?: string;
  countdownEndsAt?: number;
  paused: boolean;
};

export type RamsesCard = {
  treasure: TreasureKind;
  points: 1 | 2 | 3;
};

export type RamsesCell = {
  x: number;
  y: number;
  covered: boolean;
  coin: TreasureKind | 'empty';
  isHole: boolean;
};

export type RamsesPlayer = {
  id: string;
  name: string;
  score: number;
};

export type RamsesSnapshot = {
  type: 'ramses';
  rows: number;
  cols: number;
  phase: 'lobby' | 'playing' | 'round-over';
  turnPlayerId: string;
  cells: RamsesCell[];
  players: RamsesPlayer[];
  currentCard?: RamsesCard;
  deckRemaining: number;
  movable: Point[];
  message: string;
  winnerIds: string[];
};

export type ExplodeCell = {
  x: number;
  y: number;
  revealed: boolean;
  adjacent?: number;
  mine: boolean;
  exploded: boolean;
  ownerId?: string;
};

export type ExplodePlayer = {
  id: string;
  name: string;
  score: number;
  blasts: number;
};

export type ExplodeSnapshot = {
  type: 'explode';
  rows: number;
  cols: number;
  mines: number;
  phase: 'lobby' | 'playing' | 'round-over';
  turnPlayerId: string;
  cells: ExplodeCell[];
  players: ExplodePlayer[];
  safeCellsRemaining: number;
  message: string;
  winnerIds: string[];
};

export type ClientRoomSnapshot = {
  roomId: string;
  game: GameKind;
  players: PlayerSeat[];
  hostSocketId: string;
  viewer: ViewerState;
  gameState: SlitherSnapshot | RamsesSnapshot | ExplodeSnapshot;
};

export type ServerToClientEvents = {
  'room:update': (snapshot: ClientRoomSnapshot) => void;
  'room:error': (message: string) => void;
};

export type SocketMessageMap = {
  'room:join': CreateOrJoinPayload;
  'room:addLocalPlayer': AddLocalPlayerPayload;
  'room:startGame': {};
  'room:updateSlitherSettings': SlitherSettingsUpdate;
  'slither:input': SlitherControlInput;
  'slither:usePowerup': SlitherUsePowerupInput;
  'ramses:action': RamsesAction;
  'explode:action': ExplodeAction;
};

export const PLAYER_COLORS = ['#60a5fa', '#f97316', '#a78bfa', '#34d399', '#f43f5e', '#facc15'];

export function randomFrom<T>(items: T[], indexSeed = Math.random()) {
  return items[Math.floor(indexSeed * items.length) % items.length];
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function wrapAngle(angle: number) {
  if (angle < 0) return angle + Math.PI * 2;
  if (angle >= Math.PI * 2) return angle - Math.PI * 2;
  return angle;
}

export function hashPoint(point: Point) {
  return `${point.x},${point.y}`;
}

export function manhattan(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
