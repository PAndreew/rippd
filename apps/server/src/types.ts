import { GameKind, PlayerSeat, RamsesSnapshot, SlitherSnapshot } from '@rippd/shared';

export type InternalSnapshot = SlitherSnapshot | RamsesSnapshot;

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
