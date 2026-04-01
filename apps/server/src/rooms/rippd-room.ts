import { Client, Room } from 'colyseus';
import { nanoid } from 'nanoid';
import {
  AddLocalPlayerPayload,
  ClientRoomSnapshot,
  CreateOrJoinPayload,
  ExplodeAction,
  GameKind,
  PLAYER_COLORS,
  PlayerSeat,
  RamsesAction,
  SlitherControlInput,
  SlitherSettingsUpdate,
  SlitherUsePowerupInput
} from '@rippd/shared';
import { config } from '../config';
import { recordRoomEvent } from '../db';
import {
  InternalExplodeGame,
  InternalRamsesGame,
  InternalSlitherGame,
  applySlitherInput,
  applySlitherSettings,
  buildExplodeSnapshot,
  buildRamsesSnapshot,
  buildSlitherSnapshot,
  createExplodeGame,
  createRamsesGame,
  createSlitherGame,
  currentExplodePlayerId,
  currentRamsesPlayerId,
  handleExplodeAction,
  handleRamsesAction,
  maybeRestartSlither,
  startExplode,
  startRamses,
  startSlither,
  syncLobbyRiders,
  tickSlither,
  useSlitherPowerup
} from '../games';
import { clearReconnectSession, setReconnectSession, setRoomPresence } from '../presence-store';

export class RippdRoom extends Room {
  maxClients = 32;

  private roomCode = '';
  private game: GameKind = 'slither';
  private hostSessionId = '';
  private players: PlayerSeat[] = [];
  private sessionLocalPlayers = new Map<string, string[]>();
  private sessionToSocket = new Map<string, string>();
  private gameState: InternalSlitherGame | InternalRamsesGame | InternalExplodeGame = createSlitherGame();

  async onCreate(options: { roomCode: string; game: GameKind }) {
    this.roomCode = String(options.roomCode || '').toUpperCase();
    this.game = options.game ?? 'slither';
    this.gameState =
      this.game === 'slither'
        ? createSlitherGame()
        : this.game === 'ramses'
          ? createRamsesGame([])
          : createExplodeGame([]);

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
      if (this.game === 'slither' && this.gameState.type === 'slither') {
        startSlither(this.roomCode, this.gameState, this.players);
      } else if (this.game === 'ramses') {
        this.gameState = startRamses(this.roomCode, this.players);
      } else {
        this.gameState = startExplode(this.roomCode, this.players);
      }
      this.broadcastSnapshot();
    });

    this.onMessage('room:updateSlitherSettings', (_client, payload: SlitherSettingsUpdate) => {
      if (this.game !== 'slither' || this.gameState.type !== 'slither') return;
      applySlitherSettings(this.gameState, payload);
      this.broadcastSnapshot();
    });

    this.onMessage('room:pauseGame', () => {
      if (this.game !== 'slither' || this.gameState.type !== 'slither') return;
      if (this.gameState.phase !== 'running' && this.gameState.phase !== 'countdown') return;
      this.gameState.paused = !this.gameState.paused;
      this.broadcastSnapshot();
    });

    this.onMessage('room:stopGame', () => {
      if (this.game === 'slither' && this.gameState.type === 'slither') {
        this.gameState.phase = 'lobby';
        this.gameState.paused = false;
      } else if (this.game === 'ramses') {
        this.gameState = createRamsesGame(this.players);
      } else {
        this.gameState = createExplodeGame(this.players);
      }
      this.broadcastSnapshot();
    });

    this.onMessage('room:renamePlayer', (client, payload: { playerId: string; name: string }) => {
      const ownsPlayer = (this.sessionLocalPlayers.get(client.sessionId) ?? []).includes(payload.playerId);
      if (!ownsPlayer) return;
      const player = this.players.find((p) => p.id === payload.playerId);
      if (!player) return;
      const name = String(payload.name ?? '').trim().slice(0, 32);
      if (!name) return;
      player.name = name;
      if (this.gameState.type === 'slither') {
        const rider = this.gameState.riders.find((r) => r.id === payload.playerId);
        if (rider) rider.name = name;
      } else if (this.gameState.type === 'ramses' || this.gameState.type === 'explode') {
        const gamePlayer = this.gameState.players.find((entry) => entry.id === payload.playerId);
        if (gamePlayer) gamePlayer.name = name;
      }
      this.broadcastSnapshot();
    });

    this.onMessage('slither:input', (client, payload: SlitherControlInput) => {
      if (this.game !== 'slither' || this.gameState.type !== 'slither') return;
      const ownsPlayer = (this.sessionLocalPlayers.get(client.sessionId) ?? []).includes(payload.playerId);
      if (!ownsPlayer) return;
      applySlitherInput(this.gameState, payload.playerId, payload.steering);
    });

    this.onMessage('slither:usePowerup', (client, payload: SlitherUsePowerupInput) => {
      if (this.game !== 'slither' || this.gameState.type !== 'slither') return;
      const ownsPlayer = (this.sessionLocalPlayers.get(client.sessionId) ?? []).includes(payload.playerId);
      if (!ownsPlayer) return;
      if (useSlitherPowerup(this.gameState, payload.playerId)) this.broadcastSnapshot();
    });

    this.onMessage('ramses:action', async (client, payload: RamsesAction) => {
      if (this.game !== 'ramses' || this.gameState.type !== 'ramses') return;
      const currentId = currentRamsesPlayerId(this.gameState);
      const ownsCurrentPlayer = (this.sessionLocalPlayers.get(client.sessionId) ?? []).includes(currentId);
      if (!ownsCurrentPlayer || !currentId) return;
      const changed = await handleRamsesAction(this.roomCode, this.gameState, currentId, payload, this.players.length);
      if (changed) this.broadcastSnapshot();
    });

    this.onMessage('explode:action', async (client, payload: ExplodeAction) => {
      if (this.game !== 'explode' || this.gameState.type !== 'explode') return;
      const currentId = currentExplodePlayerId(this.gameState);
      const ownsCurrentPlayer = (this.sessionLocalPlayers.get(client.sessionId) ?? []).includes(currentId);
      if (!ownsCurrentPlayer || !currentId) return;
      const changed = await handleExplodeAction(this.roomCode, this.gameState, currentId, payload, this.players.length);
      if (changed) this.broadcastSnapshot();
    });

    this.setSimulationInterval(async () => {
      if (this.game === 'slither' && this.gameState.type === 'slither') {
        const changed = await tickSlither(this.roomCode, this.gameState, this.players.length);
        const restarted = maybeRestartSlither(this.roomCode, this.gameState, this.players);
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

    if (this.game === 'slither' && this.gameState.type === 'slither') {
      syncLobbyRiders(this.gameState, this.players);
    } else if (this.game === 'ramses') {
      this.gameState = createRamsesGame(this.players);
    } else {
      this.gameState = createExplodeGame(this.players);
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

    if (this.game === 'slither' && this.gameState.type === 'slither') {
      this.gameState = createSlitherGame();
      syncLobbyRiders(this.gameState, this.players);
      if (this.players.length >= 2) startSlither(this.roomCode, this.gameState, this.players);
    } else if (this.game === 'ramses') {
      this.gameState = createRamsesGame(this.players);
    } else {
      this.gameState = createExplodeGame(this.players);
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
      gameState:
        this.gameState.type === 'slither'
          ? buildSlitherSnapshot(this.gameState)
          : this.gameState.type === 'ramses'
            ? buildRamsesSnapshot(this.gameState)
            : buildExplodeSnapshot(this.gameState)
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
