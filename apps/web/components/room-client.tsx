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
import { CATEGORY_BADGE_TONES } from '@/lib/design';
import { fetchCurrentUser, type AuthUser } from '@/lib/auth';

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
    return <main className="page-shell flex min-h-screen items-center justify-center px-6 text-center text-xl text-white/80">Connecting to room {roomId}…</main>;
  }

  const activeGame = snapshot?.game ?? ((initialGame as GameKind | undefined) ?? 'zatacka');
  const theme = GAME_THEME[activeGame];
  const gameName = snapshot ? GAME_CONFIG[snapshot.game].name : GAME_CONFIG[activeGame].name;

  return (
    <main className="page-shell px-4 py-6 sm:px-6">
      <div className="shell-width flex flex-col gap-6 px-0">
        <header className="surface-panel-strong overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.18),transparent_30%),linear-gradient(180deg,#091229_0%,#050816_100%)] px-6 py-6 lg:border-b-0 lg:border-r lg:border-white/10 lg:px-8 lg:py-8">
              <div className="eyebrow">Room {snapshot?.roomId ?? roomId}</div>
              <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">{gameName}</h1>
              <p className="mt-3 max-w-2xl text-base text-white/60">Invite people with the room code, drop in locally for couch co-op, and keep everyone in sync with the same visual language as the landing page.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {theme.badgeClasses.map((badge, index) => (
                  <RoomBadge key={badge} tone={CATEGORY_BADGE_TONES[index % CATEGORY_BADGE_TONES.length]}>
                    {badge}
                  </RoomBadge>
                ))}
                {user ? <RoomBadge tone="border-white/20 bg-white/10 text-white">Signed in</RoomBadge> : <RoomBadge tone="border-white/20 bg-white/10 text-white">Guest mode</RoomBadge>}
              </div>
            </div>

            <div className="bg-white px-6 py-6 text-slate-950 lg:px-8 lg:py-8">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Quick actions</div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={copyInvite} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold hover:border-slate-950 hover:text-slate-950">
                  {copied ? 'Copied!' : 'Copy invite'}
                </button>
                <button onClick={addLocalPlayer} className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-200">
                  Add local player
                </button>
                <button onClick={() => send('room:startGame', {})} className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100">
                  Start / restart
                </button>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Player identity</div>
                  <div className="mt-2 text-lg font-black">{user?.displayName ?? nickname}</div>
                  <div className="mt-1 text-sm text-slate-500">{user ? 'Account-backed profile' : 'Guest profile for this room'}</div>
                </div>
                <div className="rounded-[22px] border border-slate-200 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Reconnect</div>
                  <div className="mt-2 text-sm text-slate-600">This browser stores a reconnect token locally, so refreshing should reclaim your local seats during the reconnect window.</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-[22px] border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-rose-100">{error}</div> : null}

        <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="surface-panel p-3 sm:p-4">
            {snapshot?.game === 'zatacka' ? (
              <ZatackaView snapshot={snapshot} onInput={(input: ZatackaControlInput) => send('zatacka:input', input)} />
            ) : snapshot?.game === 'ramses' ? (
              <RamsesView snapshot={snapshot} onAction={(action: RamsesAction) => send('ramses:action', action)} />
            ) : null}
          </div>

          <aside className="surface-panel space-y-4 p-5">
            <div>
              <div className="eyebrow">Players</div>
              <div className="mt-3 space-y-2">
                {snapshot?.players.map((player) => (
                  <div key={player.id} className="surface-tile px-3 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-semibold text-white">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: player.color }} />
                        {player.name}
                      </div>
                      <span className="text-xs uppercase tracking-[0.18em] text-white/35">{player.controlPreset}</span>
                    </div>
                    <div className="mt-1 text-white/50">{player.socketId === snapshot.viewer.socketId ? 'This device' : 'Remote player'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-tile p-4 text-sm text-white/70">
              <div className="mb-2 text-base font-bold text-white">Controls</div>
              <ul className="space-y-1">
                <li>Arrows: left / right</li>
                <li>WASD: A / D</li>
                <li>TFGH: F / H</li>
                <li>IJKL: J / L</li>
              </ul>
            </div>

            <div className="surface-tile p-4 text-sm text-white/70">
              <div className="mb-2 text-base font-bold text-white">Invite link</div>
              <div className="break-all text-white/55">{shareUrl}</div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
