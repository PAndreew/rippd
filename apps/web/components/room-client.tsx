'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Client, Room } from 'colyseus.js';
import {
  ClientRoomSnapshot,
  ControlPreset,
  GAME_CONFIG,
  GAME_THEME,
  GameKind,
  RamsesAction,
  ZatackaControlInput,
  ZatackaUsePowerupInput
} from '@rippd/shared';
import { ZatackaView } from '@/components/zatacka-view';
import { RamsesView } from '@/components/ramses-view';
import { CATEGORY_BADGE_TONES_LIGHT } from '@/lib/design';
import { fetchCurrentUser, getStoredAuthToken, type AuthUser } from '@/lib/auth';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'ws://localhost:3001';
const presets: ControlPreset[] = ['arrows', 'wasd', 'tfgh', 'ijkl'];

type SavedReconnect = {
  roomCode: string;
  roomId: string;
  sessionId: string;
  reconnectionToken: string;
  game: GameKind;
};

function storageKey(roomCode: string) {
  return `rippd:reconnect:${roomCode}`;
}

function RoomBadge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`pill-badge ${tone}`}>{children}</span>;
}

export function RoomClient({ roomId, nickname, initialGame }: { roomId: string; nickname: string; initialGame?: string }) {
  const roomRef = useRef<Room | null>(null);
  const [snapshot, setSnapshot] = useState<ClientRoomSnapshot | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!getStoredAuthToken()) return;
    fetchCurrentUser()
      .then((result) => setUser(result.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    let active = true;

    const connect = async () => {
      const client = new Client(SERVER_URL);
      let room: Room | null = null;
      const savedRaw = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey(roomId)) : null;
      const saved = savedRaw ? (JSON.parse(savedRaw) as SavedReconnect) : null;
      const fallbackGame = ((initialGame as GameKind | undefined) ?? saved?.game ?? 'zatacka') as GameKind;

      try {
        if (saved?.roomCode === roomId && saved.sessionId && saved.roomId) {
          try {
            room = await client.reconnect(saved.reconnectionToken);
          } catch {
            window.localStorage.removeItem(storageKey(roomId));
          }
        }

        if (!room) {
          room = await client.joinOrCreate('rippd', {
            roomCode: roomId,
            game: fallbackGame,
            nickname
          });
        }

        if (!active) {
          room.leave();
          return;
        }

        roomRef.current = room;
        window.localStorage.setItem(
          storageKey(roomId),
          JSON.stringify({ roomCode: roomId, roomId: room.roomId, sessionId: room.sessionId, reconnectionToken: room.reconnectionToken, game: fallbackGame } satisfies SavedReconnect)
        );

        room.onMessage('room:update', (next: ClientRoomSnapshot) => {
          setSnapshot(next);
          setJoining(false);
          window.localStorage.setItem(
            storageKey(roomId),
            JSON.stringify({ roomCode: roomId, roomId: room!.roomId, sessionId: room!.sessionId, reconnectionToken: room!.reconnectionToken, game: next.game } satisfies SavedReconnect)
          );
        });

        room.onMessage('room:error', (message: string) => setError(message));
        room.onLeave(() => {
          if (!active) return;
          setError('Disconnected from room. Refreshing during the reconnect window should bring you back.');
        });
      } catch (err) {
        setJoining(false);
        setError(err instanceof Error ? err.message : 'Failed to join room');
      }
    };

    void connect();

    return () => {
      active = false;
    };
  }, [initialGame, nickname, roomId]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const game = snapshot?.game ?? ((initialGame as GameKind | undefined) ?? 'zatacka');
    return `${window.location.origin}/room/${roomId}?game=${game}`;
  }, [initialGame, roomId, snapshot?.game]);

  const gameWrapperRef = useRef<HTMLDivElement>(null);

  const send = (type: string, payload: unknown) => {
    roomRef.current?.send(type, payload);
  };

  const startGame = () => {
    gameWrapperRef.current?.requestFullscreen().catch(() => {});
    send('room:startGame', {});
  };

  const addLocalPlayer = () => {
    const preset = presets[(snapshot?.viewer.localPlayerIds.length ?? 0) % presets.length];
    const base = nickname || user?.displayName || 'Player';
    send('room:addLocalPlayer', {
      name: `${base} ${String((snapshot?.viewer.localPlayerIds.length ?? 0) + 1)}`,
      controlPreset: preset
    });
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const zatackaGame = snapshot?.game === 'zatacka' && snapshot.gameState.type === 'zatacka' ? snapshot.gameState : null;

  if (joining && !snapshot) {
    return (
      <main className="zen-room-stage flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <div className="eyebrow">Connecting</div>
          <div className="mt-4 display-font text-6xl font-black uppercase tracking-[-0.06em]">Room {roomId}</div>
        </div>
      </main>
    );
  }

  const activeGame = snapshot?.game ?? ((initialGame as GameKind | undefined) ?? 'zatacka');
  const theme = GAME_THEME[activeGame];
  const gameName = snapshot ? GAME_CONFIG[snapshot.game].name : GAME_CONFIG[activeGame].name;

  return (
    <main className="zen-room-stage min-h-screen px-4 py-4 sm:px-6 sm:py-6">
      <div className="shell-width flex flex-col gap-6 px-0">
        <header className="zen-nav-shell overflow-hidden">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="eyebrow !text-white/40">Room {snapshot?.roomId ?? roomId}</div>
              <div className="mt-5 display-font text-[clamp(3.7rem,8vw,7rem)] font-black uppercase leading-[0.88] tracking-[-0.06em] text-white">
                {gameName}
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/64 sm:text-base">
                Invite people with the room code, add local players for couch co-op, and manage the match with the same bold visual language as the refreshed landing page.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {theme.badgeClasses.map((badge, index) => (
                  <RoomBadge key={badge} tone={CATEGORY_BADGE_TONES_LIGHT[index % CATEGORY_BADGE_TONES_LIGHT.length]}>
                    {badge}
                  </RoomBadge>
                ))}
                {user ? <RoomBadge tone="border-white/14 bg-white/8 text-white">Signed in</RoomBadge> : <RoomBadge tone="border-white/14 bg-white/8 text-white">Guest mode</RoomBadge>}
              </div>
            </div>

            <div id="room-quick-actions" className="rounded-[30px] bg-[#ece8ff] p-5 text-black">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Quick actions</div>
              <div id="room-action-buttons" className="mt-4 flex flex-wrap gap-3">
                <button onClick={copyInvite} className="rounded-full bg-black px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white hover:bg-black/84">
                  {copied ? 'Copied!' : 'Copy invite'}
                </button>
                <button onClick={addLocalPlayer} className="rounded-full border-2 border-black px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-black hover:bg-black/8">
                  Add local player
                </button>
                <button onClick={startGame} className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-black hover:bg-black/10">
                  Start / restart
                </button>
                {zatackaGame && (zatackaGame.phase === 'running' || zatackaGame.phase === 'countdown') && (
                  <button onClick={() => send('room:pauseGame', {})} className="rounded-full border-2 border-black px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-black hover:bg-black/8">
                    {zatackaGame.paused ? 'Resume' : 'Pause'}
                  </button>
                )}
              </div>

              {zatackaGame && (
                <div className="mt-5 rounded-[24px] border border-black/10 bg-white/60 p-4 text-sm text-black/70">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Slither settings</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-black">Speed</div>
                      <div>{zatackaGame.settings.speed.toFixed(1)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => send('room:updateZatackaSettings', { speed: zatackaGame.settings.speed - 0.4 })}
                        className="rounded-full border border-black/15 px-4 py-2 font-bold uppercase tracking-[0.12em] text-black hover:bg-black/6"
                      >
                        Slower
                      </button>
                      <button
                        onClick={() => send('room:updateZatackaSettings', { speed: zatackaGame.settings.speed + 0.4 })}
                        className="rounded-full border border-black/15 px-4 py-2 font-bold uppercase tracking-[0.12em] text-black hover:bg-black/6"
                      >
                        Faster
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-black">Walls</div>
                      <div>{zatackaGame.settings.walls ? 'Crash at edge' : 'Wrap around screen'}</div>
                    </div>
                    <button
                      onClick={() => send('room:updateZatackaSettings', { walls: !zatackaGame.settings.walls })}
                      className="rounded-full border border-black/15 px-4 py-2 font-bold uppercase tracking-[0.12em] text-black hover:bg-black/6"
                    >
                      {zatackaGame.settings.walls ? 'Turn walls off' : 'Turn walls on'}
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-black">Gaps</div>
                      <div>{zatackaGame.settings.gaps ? 'Periodic openings are enabled' : 'Continuous trails'}</div>
                    </div>
                    <button
                      onClick={() => send('room:updateZatackaSettings', { gaps: !zatackaGame.settings.gaps })}
                      className="rounded-full border border-black/15 px-4 py-2 font-bold uppercase tracking-[0.12em] text-black hover:bg-black/6"
                    >
                      {zatackaGame.settings.gaps ? 'Turn gaps off' : 'Turn gaps on'}
                    </button>
                  </div>
                </div>
              )}

              <div id="room-players" className="mt-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Players</div>
                <div className="mt-3 space-y-2">
                  {snapshot?.players.map((player) => {
                    const isLocal = snapshot.viewer.localPlayerIds.includes(player.id);
                    const riderState = zatackaGame?.riders.find((rider) => rider.id === player.id);
                    return (
                      <div key={player.id} className="rounded-[20px] border border-black/10 bg-white/60 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 font-semibold text-black min-w-0">
                            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: player.color }} />
                            {isLocal ? (
                              <input
                                key={player.id}
                                defaultValue={player.name}
                                maxLength={32}
                                onBlur={(e) => {
                                  const name = e.target.value.trim();
                                  if (name && name !== player.name) send('room:renamePlayer', { playerId: player.id, name });
                                  else e.target.value = player.name;
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                className="min-w-0 flex-1 bg-transparent outline-none border-b border-black/20 focus:border-black/60 text-black font-semibold"
                              />
                            ) : (
                              <span>{player.name}</span>
                            )}
                          </div>
                          <span className="text-xs uppercase tracking-[0.18em] text-black/40 shrink-0">{player.controlPreset}</span>
                        </div>
                        <div className="mt-1 text-black/50">{isLocal ? 'This device · tap name to rename' : 'Remote player'}</div>
                        {riderState && (
                          <div className="mt-1 text-black/55">
                            Powerup: <span className="font-medium text-black">{riderState.carriedPowerup ?? 'none'}</span>
                            {riderState.ghostActive ? ' · ghost active' : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div id="room-invite" className="mt-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Invite link</div>
                <div className="mt-2 break-all text-sm text-black/55">{shareUrl}</div>
              </div>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-[24px] border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-rose-900">{error}</div> : null}

        <section id="room-game-section" className="grid gap-6 xl:grid-cols-[1fr_260px]">
          <div id="room-game-board" ref={gameWrapperRef} className="rounded-[34px] border border-black/10 bg-white/30 p-3 shadow-[0_24px_60px_rgba(25,18,53,0.12)] backdrop-blur-md sm:p-4">
            {snapshot?.game === 'zatacka' ? (
              <ZatackaView
                snapshot={snapshot}
                onInput={(input: ZatackaControlInput) => send('zatacka:input', input)}
                onUsePowerup={(input: ZatackaUsePowerupInput) => send('zatacka:usePowerup', input)}
              />
            ) : snapshot?.game === 'ramses' ? (
              <RamsesView snapshot={snapshot} onAction={(action: RamsesAction) => send('ramses:action', action)} />
            ) : null}
          </div>

          <aside id="room-sidebar" className="rounded-[34px] border border-black/10 bg-black p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <div id="room-controls" className="rounded-[24px] border border-white/10 bg-white/6 p-4 text-sm text-white/72">
              <div className="mb-2 text-base font-bold uppercase tracking-[0.06em] text-white">Controls</div>
              <ul className="space-y-1">
                <li>Arrows: left / right · use powerup with up</li>
                <li>WASD: A / D · use powerup with W</li>
                <li>TFGH: F / H · use powerup with T</li>
                <li>IJKL: J / L · use powerup with I</li>
              </ul>
            </div>
            {zatackaGame && (
              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4 text-sm text-white/72">
                <div className="mb-2 text-base font-bold uppercase tracking-[0.06em] text-white">Powerups</div>
                <ul className="space-y-2">
                  <li><span className="font-semibold text-white">Bomb:</span> blows a small hole through every trail near you.</li>
                  <li><span className="font-semibold text-white">Ghost:</span> your snake becomes permeable for a short time.</li>
                  <li><span className="font-semibold text-white">Inventory:</span> each player holds only their most recent pickup.</li>
                </ul>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
