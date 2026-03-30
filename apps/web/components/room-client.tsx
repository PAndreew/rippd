'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Client, Room } from 'colyseus.js';
import {
  ClientRoomSnapshot,
  ControlPreset,
  GAME_CONFIG,
  GAME_THEME,
  GameKind,
  RamsesAction,
  SlitherControlInput,
  SlitherUsePowerupInput
} from '@rippd/shared';
import { SlitherView } from '@/components/slither-view';
import { RamsesView } from '@/components/ramses-view';
import { RippdWordmark } from '@/components/rippd-logo';
import { CATEGORY_BADGE_TONES_LIGHT } from '@/lib/design';
import { fetchCurrentUser, getStoredAuthToken, type AuthUser } from '@/lib/auth';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'ws://localhost:3001';
const presets: ControlPreset[] = ['arrows', 'wasd', 'tfgh', 'ijkl'];

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-black' : 'bg-black/18'}`}
    >
      <span
        className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

function ClipboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

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
      const fallbackGame = ((initialGame as GameKind | undefined) ?? saved?.game ?? 'slither') as GameKind;

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
    const game = snapshot?.game ?? ((initialGame as GameKind | undefined) ?? 'slither');
    return `${window.location.origin}/room/${roomId}?game=${game}`;
  }, [initialGame, roomId, snapshot?.game]);

  const send = (type: string, payload: unknown) => {
    roomRef.current?.send(type, payload);
  };

  const startGame = () => {
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

  const slitherGame = snapshot?.game === 'slither' && snapshot.gameState.type === 'slither' ? snapshot.gameState : null;
  const gameIsActive = slitherGame ? slitherGame.phase !== 'lobby' : false;

  if (joining && !snapshot) {
    return (
      <main className="zen-room-stage flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <div className="eyebrow">Connecting</div>
          <div className="mt-4 display-font text-6xl font-black uppercase tracking-[-0.01em] sm:tracking-[-0.04em]">Room {roomId}</div>
        </div>
      </main>
    );
  }

  const activeGame = snapshot?.game ?? ((initialGame as GameKind | undefined) ?? 'slither');
  const gameName = snapshot ? GAME_CONFIG[snapshot.game].name : GAME_CONFIG[activeGame].name;

  return (
    <main className="zen-room-stage min-h-screen px-4 py-4 sm:px-6 sm:py-6">
      <div className="shell-width flex flex-col gap-6 px-0">
        <nav className="flex items-center">
          <Link href="/"><RippdWordmark textClassName="sm:tracking-[-0.04em]" textColor="text-black" /></Link>
        </nav>
        <header className="zen-nav-shell overflow-hidden">
          <div className="eyebrow !text-white/40">Room {snapshot?.roomId ?? roomId}</div>
          <div className="mt-5 display-font text-[clamp(3.7rem,8vw,7rem)] font-black uppercase leading-[0.88] tracking-[-0.01em] sm:tracking-[-0.04em] text-white">
            {gameName}
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/64 sm:text-base">
            {GAME_CONFIG[activeGame].description}
          </p>
        </header>

        {error ? <div className="rounded-[24px] border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-rose-900">{error}</div> : null}

        <section className="grid gap-6 xl:grid-cols-[1fr_260px]">
          {/* Settings + players card */}
          <div className="rounded-[30px] bg-[#ece8ff] p-5 text-black flex flex-col gap-5">

            {/* Slither settings */}
            {slitherGame && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Settings</div>
                <div className="mt-3 rounded-[24px] border border-black/10 bg-white/60 p-4 text-sm text-black/70 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-black">Speed</div>
                      <div className="text-xs text-black/50">1 = slow · 10 = fast</div>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={slitherGame.settings.speed}
                      onChange={(e) => {
                        const val = Math.round(Number(e.target.value));
                        if (val >= 1 && val <= 10) send('room:updateSlitherSettings', { speed: val });
                      }}
                      className="w-16 rounded-[14px] border border-black/15 bg-transparent px-2 py-1.5 text-center text-sm font-bold text-black outline-none focus:border-black/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-black">Walls</div>
                      <div className="text-xs">{slitherGame.settings.walls ? 'Crash at edge' : 'Wrap around'}</div>
                    </div>
                    <ToggleSwitch
                      checked={slitherGame.settings.walls}
                      onChange={() => send('room:updateSlitherSettings', { walls: !slitherGame.settings.walls })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-black">Gaps</div>
                      <div className="text-xs">{slitherGame.settings.gaps ? 'Gaps in trails' : 'Solid trails'}</div>
                    </div>
                    <ToggleSwitch
                      checked={slitherGame.settings.gaps}
                      onChange={() => send('room:updateSlitherSettings', { gaps: !slitherGame.settings.gaps })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-black">Powerups</div>
                      <div className="text-xs">{slitherGame.settings.powerups ? 'Enabled' : 'Disabled'}</div>
                    </div>
                    <ToggleSwitch
                      checked={slitherGame.settings.powerups}
                      onChange={() => send('room:updateSlitherSettings', { powerups: !slitherGame.settings.powerups })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Players */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Players</div>
                <button onClick={addLocalPlayer} className="rounded-full border border-black/20 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-black hover:bg-black/8">
                  + Add player
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {snapshot?.players.map((player) => {
                  const isLocal = snapshot.viewer.localPlayerIds.includes(player.id);
                  const riderState = slitherGame?.riders.find((rider) => rider.id === player.id);
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

            {/* Invite link */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Invite link</div>
              <div className="mt-2 flex items-start gap-2">
                <div className="min-w-0 break-all text-sm text-black/55">{shareUrl}</div>
                <button
                  onClick={copyInvite}
                  className="shrink-0 rounded-full bg-black/8 p-2 text-black/60 hover:bg-black/15 hover:text-black"
                  title="Copy invite link"
                >
                  {copied ? <CheckIcon /> : <ClipboardIcon />}
                </button>
              </div>
            </div>

            {/* Start / restart — bottom of card */}
            <div className="mt-auto pt-2">
              <button onClick={startGame} className="w-full rounded-full bg-black px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white hover:bg-black/84">
                Start / restart
              </button>
            </div>
          </div>

          {/* Controls sidebar */}
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
            {slitherGame && slitherGame.settings.powerups && (
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

      {/* Full-window game overlay */}
      {snapshot && gameIsActive && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#060606]">
          {/* HUD bar */}
          <div className="flex items-center gap-4 border-b border-white/10 px-5 py-3">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
              Round {slitherGame?.round ?? 1}
            </div>
            <div className="flex flex-1 flex-wrap gap-3">
              {snapshot.players.map((player) => {
                const rider = slitherGame?.riders.find((r) => r.id === player.id);
                const score = slitherGame?.scores?.[player.id] ?? 0;
                return (
                  <div key={player.id} className={`flex items-center gap-2 rounded-full px-3 py-1 ${rider?.alive === false ? 'opacity-40' : ''}`} style={{ background: player.color + '22', border: `1px solid ${player.color}55` }}>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: player.color }} />
                    <span className="text-sm font-semibold text-white">{player.name}</span>
                    {rider?.carriedPowerup && (
                      <span className="text-xs text-white/60">{rider.ghostActive ? '👻' : rider.carriedPowerup === 'bomb' ? '💣' : '⚡'}</span>
                    )}
                    <span className="text-xs font-bold text-white/50">{score}</span>
                  </div>
                );
              })}
            </div>
            {slitherGame && (slitherGame.phase === 'running' || slitherGame.phase === 'countdown') && (
              <button
                onClick={() => send('room:pauseGame', {})}
                className="shrink-0 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-white/20"
              >
                {slitherGame.paused ? 'Resume' : 'Pause'}
              </button>
            )}
          </div>

          {/* Game canvas */}
          <div className="relative flex-1 min-h-0">
            {snapshot.game === 'slither' ? (
              <SlitherView
                snapshot={snapshot}
                onInput={(input: SlitherControlInput) => send('slither:input', input)}
                onUsePowerup={(input: SlitherUsePowerupInput) => send('slither:usePowerup', input)}
              />
            ) : snapshot.game === 'ramses' ? (
              <RamsesView snapshot={snapshot} onAction={(action: RamsesAction) => send('ramses:action', action)} />
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
