import { Client, Room } from 'colyseus';
import { nanoid } from 'nanoid';
import {
  AddLocalPlayerPayload,
  ClientRoomSnapshot,
  CreateOrJoinPayload,
  GameKind,
  PLAYER_COLORS,
  PlayerSeat,
  RamsesAction,
  ZatackaControlInput
} from '@rippd/shared';
import { config } from '../config';
import { recordRoomEvent } from '../db';
import {
  InternalRamsesGame,
  InternalZatackaGame,
  applyZatackaInput,
  buildRamsesSnapshot,
  buildZatackaSnapshot,
  createRamsesGame,
  createZatackaGame,
  currentRamsesPlayerId,
  handleRamsesAction,
  maybeRestartZatacka,
  startRamses,
  startZatacka,
  syncLobbyRiders,
  tickZatacka
} from '../games';
import { clearReconnectSession, setReconnectSession, setRoomPresence } from '../presence-store';

export class RippdRoom extends Room {
  maxClients = 32;

  private roomCode = '';
  private game: GameKind = 'zatacka';
  private hostSessionId = '';
  private players: PlayerSeat[] = [];
  private sessionLocalPlayers = new Map<string, string[]>();
  private sessionToSocket = new Map<string, string>();
  private gameState: InternalZatackaGame | InternalRamsesGame = createZatackaGame();

  async onCreate(options: { roomCode: string; game: GameKind }) {
    this.roomCode = String(options.roomCode || '').toUpperCase();
    this.game = options.game ?? 'zatacka';
    this.gameState = this.game === 'zatacka' ? createZatackaGame() : createRamsesGame([]);

    await this.setMetadata({ roomCode: this.roomCode, game: this.game });
    this.onMessage('room:addLocalPlayer', async (client, payload: AddLocalPlayerPayload) => {
      await this.addLocalPlayer(client, payload);
      this.broadcastSnapshot();
    });

    this.onMessage('room:startGame', async (client) => {
      if (this.players.length < 2) {
        client.send('room:error', 'You need at least 2 players in the room.');
        return;
      }
      if (this.game === 'zatacka' && this.gameState.type === 'zatacka') {
        startZatacka(this.roomCode, this.gameState, this.players);
      } else {
        this.gameState = startRamses(this.roomCode, this.players);
      }
      this.broadcastSnapshot();
    });

    this.onMessage('zatacka:input', (client, payload: ZatackaControlInput) => {
      if (this.game !== 'zatacka' || this.gameState.type !== 'zatacka') return;
      const ownsPlayer = (this.sessionLocalPlayers.get(client.sessionId) ?? []).includes(payload.playerId);
      if (!ownsPlayer) return;
      applyZatackaInput(this.gameState, payload.playerId, payload.steering);
    });

    this.onMessage('ramses:action', async (client, payload: RamsesAction) => {
      if (this.game !== 'ramses' || this.gameState.type !== 'ramses') return;
      const currentId = currentRamsesPlayerId(this.gameState);
      const ownsCurrentPlayer = (this.sessionLocalPlayers.get(client.sessionId) ?? []).includes(currentId);
      if (!ownsCurrentPlayer || !currentId) return;
      const changed = await handleRamsesAction(this.roomCode, this.gameState, currentId, payload, this.players.length);
      if (changed) this.broadcastSnapshot();
    });

    this.setSimulationInterval(async () => {
      if (this.game === 'zatacka' && this.gameState.type === 'zatacka') {
        const changed = await tickZatacka(this.roomCode, this.gameState, this.players.length);
        const restarted = maybeRestartZatacka(this.roomCode, this.gameState, this.players);
        if (changed || restarted) this.broadcastSnapshot();
      }
    }, 50);
  }

  async onJoin(client: Client, options: CreateOrJoinPayload) {
    this.sessionToSocket.set(client.sessionId, client.id);
    if (!this.hostSessionId) this.hostSessionId = client.sessionId;

    if (!this.sessionLocalPlayers.has(client.sessionId)) {
      this.sessionLocalPlayers.set(client.sessionId, []);
      await this.addLocalPlayer(client, {
        name: options.nickname || 'Player',
        controlPreset: 'arrows'
      });
      await recordRoomEvent({ roomId: this.roomCode, gameKind: this.game, eventType: 'player_joined', payload: { sessionId: client.sessionId } });
    }

    await setReconnectSession({
      roomId: this.roomId,
      roomCode: this.roomCode,
      game: this.game,
      sessionId: client.sessionId
    });

    this.broadcastSnapshot();
  }

  async onLeave(client: Client, consented: boolean) {
    this.sessionToSocket.delete(client.sessionId);
    if (consented) {
      this.removeSession(client.sessionId);
      return;
    }

    try {
      await this.allowReconnection(client, config.reconnectWindowSeconds);
      this.sessionToSocket.set(client.sessionId, client.id);
      await setReconnectSession({ roomId: this.roomId, roomCode: this.roomCode, game: this.game, sessionId: client.sessionId });
      this.broadcastSnapshot();
    } catch {
      this.removeSession(client.sessionId);
    }
  }

  async onDispose() {
    await recordRoomEvent({ roomId: this.roomCode, gameKind: this.game, eventType: 'room_closed' });
  }

  private async addLocalPlayer(client: Client, payload: AddLocalPlayerPayload) {
    const localIds = this.sessionLocalPlayers.get(client.sessionId) ?? [];
    if (localIds.length >= 4) return;

    const player: PlayerSeat = {
      id: nanoid(8),
      socketId: client.id,
      name: payload.name,
      controlPreset: payload.controlPreset,
      color: PLAYER_COLORS[this.players.length % PLAYER_COLORS.length]
    };

    this.players.push(player);
    this.sessionLocalPlayers.set(client.sessionId, [...localIds, player.id]);

    if (this.game === 'zatacka' && this.gameState.type === 'zatacka') {
      syncLobbyRiders(this.gameState, this.players);
    } else if (this.game === 'ramses') {
      this.gameState = createRamsesGame(this.players);
    }

    await recordRoomEvent({ roomId: this.roomCode, gameKind: this.game, eventType: 'local_player_added', payload: { playerId: player.id, name: player.name } });
  }

  private async removeSession(sessionId: string) {
    await clearReconnectSession(sessionId);
    this.players = this.players.filter((player) => (this.sessionLocalPlayers.get(sessionId) ?? []).every((id) => id !== player.id));
    this.sessionLocalPlayers.delete(sessionId);

    if (!this.players.length) {
      this.disconnect();
      return;
    }

    if (this.hostSessionId === sessionId) {
      this.hostSessionId = this.sessionLocalPlayers.keys().next().value ?? '';
    }

    if (this.game === 'zatacka' && this.gameState.type === 'zatacka') {
      this.gameState = createZatackaGame();
      syncLobbyRiders(this.gameState, this.players);
      if (this.players.length >= 2) startZatacka(this.roomCode, this.gameState, this.players);
    } else {
      this.gameState = createRamsesGame(this.players);
    }

    await recordRoomEvent({ roomId: this.roomCode, gameKind: this.game, eventType: 'session_removed', payload: { sessionId } });
    this.broadcastSnapshot();
  }

  private snapshotFor(sessionId: string): ClientRoomSnapshot {
    return {
      roomId: this.roomCode,
      game: this.game,
      players: this.players.map((player) => ({
        ...player,
        socketId: this.players.find((entry) => entry.id === player.id)?.socketId ?? player.socketId
      })),
      hostSocketId: this.sessionToSocket.get(this.hostSessionId) ?? '',
      viewer: {
        socketId: this.sessionToSocket.get(sessionId) ?? '',
        localPlayerIds: this.sessionLocalPlayers.get(sessionId) ?? []
      },
      gameState: this.gameState.type === 'zatacka' ? buildZatackaSnapshot(this.gameState) : buildRamsesSnapshot(this.gameState)
    };
  }

  private broadcastSnapshot() {
    const presence = {
      roomCode: this.roomCode,
      roomId: this.roomId,
      game: this.game,
      playerCount: this.players.length,
      connectedSessions: this.sessionToSocket.size,
      updatedAt: new Date().toISOString()
    };

    void setRoomPresence(this.roomCode, presence);

    this.clients.forEach((client) => {
      client.send('room:update', this.snapshotFor(client.sessionId));
    });
  }
}
