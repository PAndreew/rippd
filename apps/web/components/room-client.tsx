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
  ZatackaControlInput
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

  const send = (type: string, payload: unknown) => {
    roomRef.current?.send(type, payload);
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

            <div className="rounded-[30px] bg-[#ece8ff] p-5 text-black">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Quick actions</div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={copyInvite} className="rounded-full bg-black px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white hover:bg-black/84">
                  {copied ? 'Copied!' : 'Copy invite'}
                </button>
                <button onClick={addLocalPlayer} className="rounded-full border border-black/12 bg-white/72 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-black hover:bg-white">
                  Add local player
                </button>
                <button onClick={() => send('room:startGame', {})} className="rounded-full border border-black/12 bg-white/72 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-black hover:bg-white">
                  Start / restart
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-black/10 bg-white/64 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Player identity</div>
                  <div className="mt-2 text-xl font-black uppercase tracking-tight">{user?.displayName ?? nickname}</div>
                  <div className="mt-1 text-sm text-black/58">{user ? 'Account-backed profile' : 'Guest profile for this room'}</div>
                </div>
                <div className="rounded-[24px] border border-black/10 bg-white/64 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Reconnect</div>
                  <div className="mt-2 text-sm text-black/58">This browser stores a reconnect token locally, so refreshing should reclaim your local seats during the reconnect window.</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-[24px] border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-rose-900">{error}</div> : null}

        <section className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="rounded-[34px] border border-black/10 bg-white/30 p-3 shadow-[0_24px_60px_rgba(25,18,53,0.12)] backdrop-blur-md sm:p-4">
            {snapshot?.game === 'zatacka' ? (
              <ZatackaView snapshot={snapshot} onInput={(input: ZatackaControlInput) => send('zatacka:input', input)} />
            ) : snapshot?.game === 'ramses' ? (
              <RamsesView snapshot={snapshot} onAction={(action: RamsesAction) => send('ramses:action', action)} />
            ) : null}
          </div>

          <aside className="space-y-4 rounded-[34px] border border-black/10 bg-black p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <div>
              <div className="eyebrow !text-white/40">Players</div>
              <div className="mt-3 space-y-2">
                {snapshot?.players.map((player) => {
                  const isLocal = snapshot.viewer.localPlayerIds.includes(player.id);
                  return (
                    <div key={player.id} className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-semibold text-white min-w-0">
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
                              className="min-w-0 flex-1 bg-transparent outline-none border-b border-white/20 focus:border-white/60 text-white font-semibold"
                            />
                          ) : (
                            <span>{player.name}</span>
                          )}
                        </div>
                        <span className="text-xs uppercase tracking-[0.18em] text-white/38 shrink-0">{player.controlPreset}</span>
                      </div>
                      <div className="mt-1 text-white/52">{isLocal ? 'This device · tap name to rename' : 'Remote player'}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 text-sm text-white/72">
              <div className="mb-2 text-base font-bold uppercase tracking-[0.06em] text-white">Controls</div>
              <ul className="space-y-1">
                <li>Arrows: left / right</li>
                <li>WASD: A / D</li>
                <li>TFGH: F / H</li>
                <li>IJKL: J / L</li>
              </ul>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 text-sm text-white/72">
              <div className="mb-2 text-base font-bold uppercase tracking-[0.06em] text-white">Invite link</div>
              <div className="break-all text-white/55">{shareUrl}</div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
