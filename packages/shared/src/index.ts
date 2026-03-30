export type GameKind = 'slither' | 'ramses';
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
    tagline: 'Treasure maze with moving pyramids',
    description: 'Slide square pyramids, reveal coloured treasures, and path your pawn to the matching card.'
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
  }
};

export const CONTROL_KEYSETS: Record<ControlPreset, { left: string; right: string; action: string }> = {
  arrows: { left: 'arrowleft', right: 'arrowright', action: 'arrowup' },
  wasd: { left: 'a', right: 'd', action: 'w' },
  tfgh: { left: 'f', right: 'h', action: 't' },
  ijkl: { left: 'j', right: 'l', action: 'i' }
};

export type TreasureColor = 'tomato' | 'gold' | 'deepskyblue' | 'mediumspringgreen' | 'orchid' | 'coral';
export const TREASURE_COLORS: TreasureColor[] = ['tomato', 'gold', 'deepskyblue', 'mediumspringgreen', 'orchid', 'coral'];

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
};

export type SlitherSettingsUpdate = Partial<SlitherSettings>;

export type SlitherUsePowerupInput = {
  playerId: string;
};

export type RamsesAction =
  | { type: 'slide'; x: number; y: number }
  | { type: 'move'; x: number; y: number };

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
  winnerId?: string;
  countdownEndsAt?: number;
  paused: boolean;
};

export type RamsesCell = {
  x: number;
  y: number;
  blocked: boolean;
  revealedTreasure?: TreasureColor;
};

export type RamsesPawn = {
  id: string;
  name: string;
  position: Point;
  score: number;
};

export type RamsesSnapshot = {
  type: 'ramses';
  rows: number;
  cols: number;
  phase: 'lobby' | 'slide' | 'move' | 'round-over';
  turnPlayerId: string;
  cells: RamsesCell[];
  pawns: RamsesPawn[];
  targetCards: Record<string, TreasureColor | undefined>;
  reachable: Point[];
  message: string;
};

export type ClientRoomSnapshot = {
  roomId: string;
  game: GameKind;
  players: PlayerSeat[];
  hostSocketId: string;
  viewer: ViewerState;
  gameState: SlitherSnapshot | RamsesSnapshot;
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
