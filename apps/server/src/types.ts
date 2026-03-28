import { GameKind, PlayerSeat, RamsesSnapshot, ZatackaSnapshot } from '@rippd/shared';

export type InternalSnapshot = ZatackaSnapshot | RamsesSnapshot;

export type RoomPlayerState = PlayerSeat;

export type RoomState = {
  roomCode: string;
  game: GameKind;
  hostSessionId: string;
  players: RoomPlayerState[];
  sessionLocalPlayers: Map<string, string[]>;
  sessionToSocket: Map<string, string>;
  gameState: InternalSnapshot;
};
