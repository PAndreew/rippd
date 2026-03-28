'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GAME_CONFIG, GAME_THEME, GameKind } from '@rippd/shared';
import { CATEGORY_BADGE_TONES, CATEGORY_BADGE_TONES_LIGHT } from '@/lib/design';
import {
  AuthUser,
  clearStoredAuthToken,
  fetchCurrentUser,
  loginAccount,
  registerAccount,
  storeAuthToken
} from '@/lib/auth';

function ZigzagDivider({ upper, lower, height = 36 }: { upper: string; lower: string; height?: number }) {
  const toothW = 40;
  const count = 80;
  const w = count * toothW;

  const pts: string[] = [];
  for (let i = 0; i <= count; i++) {
    pts.push(`${i * toothW},0`);
    if (i < count) pts.push(`${i * toothW + toothW / 2},${height}`);
  }
  const polygon = [`0,-2`, ...pts, `${w},-2`].join(' ');

  return (
    <svg
      viewBox={`0 -2 ${w} ${height + 2}`}
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: `${height}px`, flexShrink: 0 }}
      aria-hidden="true"
    >
      <rect x="0" y="-2" width={w} height={height + 2} fill={lower} />
      <polygon points={polygon} fill={upper} />
    </svg>
  );
}

function ZigzagButton({
  children,
  onClick,
  className = '',
  type = 'button'
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const steps = 10;
  const h = 7;

  const top = Array.from({ length: steps + 1 }, (_, i) => `${(i * 100) / steps}% ${i % 2 === 0 ? `${h}px` : '0px'}`);
  const bottom = Array.from({ length: steps + 1 }, (_, i) => {
    const j = steps - i;
    return `${(j * 100) / steps}% ${j % 2 === 0 ? `calc(100% - ${h}px)` : '100%'}`;
  });

  return (
    <button type={type} onClick={onClick} style={{ clipPath: `polygon(${[...top, ...bottom].join(', ')})` }} className={className}>
      {children}
    </button>
  );
}

function CategoryBadge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`pill-badge ${tone}`}>{children}</span>;
}

function AuthPanel({
  user,
  setUser,
  setError,
  authError
}: {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  setError: (value: string) => void;
  authError: string;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result =
        mode === 'register'
          ? await registerAccount({ email, password, displayName })
          : await loginAccount({ email, password });
      storeAuthToken(result.token);
      setUser(result.user);
      if (mode === 'register') setDisplayName('');
      setPassword('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setSaving(false);
    }
  };

  if (user) {
    return (
      <div className="surface-tile p-4">
        <div className="eyebrow">Account ready</div>
        <div className="mt-2 text-xl font-black text-white">{user.displayName}</div>
        <div className="mt-1 text-sm text-white/50">{user.email}</div>
        <p className="mt-3 text-sm text-white/65">You can play with your saved identity, or still join any room as a guest nickname.</p>
        <button
          onClick={() => {
            clearStoredAuthToken();
            setUser(null);
          }}
          className="mt-4 rounded-full border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75 hover:border-white/35 hover:text-white"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="surface-tile p-4">
      <div className="flex gap-2">
        {(['register', 'login'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] ${
              mode === value ? 'bg-white text-slate-950' : 'border border-white/15 text-white/65 hover:border-white/30'
            }`}
          >
            {value === 'register' ? 'Create account' : 'Sign in'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {mode === 'register' ? (
          <label className="block">
            <span className="field-label">Display name</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="text-field" placeholder="Player one" required />
          </label>
        ) : null}
        <label className="block">
          <span className="field-label">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="text-field" placeholder="you@example.com" type="email" required />
        </label>
        <label className="block">
          <span className="field-label">Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} className="text-field" placeholder="At least 8 characters" type="password" required minLength={8} />
        </label>
        {authError ? <div className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{authError}</div> : null}
        <ZigzagButton type="submit" className="action-button w-full disabled:cursor-not-allowed disabled:opacity-70">
          {saving ? 'Working…' : mode === 'register' ? 'Create account' : 'Sign in'}
        </ZigzagButton>
      </form>
    </div>
  );
}

function PlayModal({
  game,
  user,
  onClose
}: {
  game: GameKind | null;
  user: AuthUser | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [playMode, setPlayMode] = useState<'guest' | 'account'>(user ? 'account' : 'guest');
  const [nickname, setNickname] = useState(user?.displayName ?? '');
  const [joinCode, setJoinCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(user);

  useEffect(() => {
    setCurrentUser(user);
    setPlayMode(user ? 'account' : 'guest');
    if (user?.displayName) setNickname(user.displayName);
  }, [user]);

  if (!game) return null;

  const meta = GAME_CONFIG[game];
  const theme = GAME_THEME[game];

  const activeName = playMode === 'account' && currentUser ? currentUser.displayName : nickname.trim() || 'Guest';

  const createRoom = () => {
    const roomId = crypto.randomUUID().slice(0, 6).toUpperCase();
    router.push(`/room/${roomId}?game=${game}&nickname=${encodeURIComponent(activeName)}`);
  };

  const joinRoom = () => {
    if (!joinCode.trim()) return;
    router.push(`/room/${joinCode.trim().toUpperCase()}?game=${game}&nickname=${encodeURIComponent(activeName)}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          className="surface-panel-strong max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.2),transparent_34%),linear-gradient(180deg,#091229_0%,#050816_100%)] px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow">Play</div>
                <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">{meta.name}</h2>
              </div>
              <ZigzagButton
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center border border-white/15 bg-white/5 text-lg font-black text-white hover:border-white/35 hover:bg-white/10"
              >
                ×
              </ZigzagButton>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {theme.badgeClasses.map((badge, index) => (
                <CategoryBadge key={badge} tone={CATEGORY_BADGE_TONES[index % CATEGORY_BADGE_TONES.length]}>
                  {badge}
                </CategoryBadge>
              ))}
            </div>
          </div>

          <ZigzagDivider upper="#050816" lower="#ffffff" height={28} />

          <div className="grid lg:grid-cols-[1fr_0.95fr]">
            <div className="bg-[linear-gradient(180deg,#091229_0%,#050816_100%)] px-5 py-5 text-white sm:px-6 sm:py-6 lg:border-r lg:border-white/10">
              <div className="grid gap-3 sm:grid-cols-2">
                <ZigzagButton
                  onClick={() => setPlayMode('guest')}
                  className={`w-full px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] ${
                    playMode === 'guest' ? 'bg-white text-slate-950' : 'border border-white/15 bg-white/5 text-white hover:border-white/35 hover:bg-white/10'
                  }`}
                >
                  Play as guest
                </ZigzagButton>
                <ZigzagButton
                  onClick={() => setPlayMode('account')}
                  className={`w-full px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] ${
                    playMode === 'account' ? 'bg-white text-slate-950' : 'border border-white/15 bg-white/5 text-white hover:border-white/35 hover:bg-white/10'
                  }`}
                >
                  Use account
                </ZigzagButton>
              </div>

              {playMode === 'guest' ? (
                <label className="mt-5 block">
                  <span className="field-label">Guest nickname</span>
                  <input
                    autoFocus
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                    placeholder="Enter your nickname…"
                    className="text-field"
                  />
                </label>
              ) : (
                <div className="mt-5">
                  <AuthPanel user={currentUser} setUser={setCurrentUser} setError={setAuthError} authError={authError} />
                </div>
              )}
            </div>

            <div className="bg-white px-5 py-5 text-slate-950 sm:px-6 sm:py-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Ready to play</div>
              <div className="mt-2 text-2xl font-black sm:text-3xl">{activeName}</div>

              <ZigzagButton onClick={createRoom} className="mt-6 action-button w-full">
                Create room
              </ZigzagButton>

              <div className="relative py-4 text-center">
                <div className="absolute inset-y-1/2 left-0 right-0 border-t border-slate-200" />
                <span className="relative bg-white px-4 text-[11px] uppercase tracking-widest text-slate-400">or join a room</span>
              </div>

              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                  placeholder="ROOM42"
                  maxLength={8}
                  className="min-w-0 flex-1 rounded-[20px] border border-slate-200 px-4 py-3 font-mono text-base uppercase outline-none focus:border-slate-900"
                />
                <ZigzagButton onClick={joinRoom} className="border border-slate-200 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] hover:bg-slate-950 hover:text-white">
                  Join
                </ZigzagButton>
              </div>

              <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Privacy</div>
                <p className="mt-2 text-sm text-slate-600">Account records are stored with encrypted personal fields in the database. Guests can still play without creating anything.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameSection({ game, index, onPlay }: { game: (typeof GAME_CONFIG)[GameKind]; index: number; onPlay: () => void }) {
  const theme = GAME_THEME[game.kind];
  const isDark = index % 2 === 0;
  const textColor = isDark ? 'text-white' : 'text-slate-950';
  const mutedColor = isDark ? 'text-white/65' : 'text-slate-700';

  return (
    <section style={{ background: theme.surface, color: isDark ? '#f8fafc' : '#08111f' }}>
      <div className="shell-width py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_320px]">
          <div>
            <div className={`eyebrow ${isDark ? 'text-white/40' : 'text-slate-500'}`}>{theme.badgeLabel}</div>
            <h2 className={`mt-3 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl ${textColor}`}>{game.name}</h2>
            <p className={`mt-5 max-w-xl text-lg leading-relaxed ${mutedColor}`}>{game.description}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              {theme.badgeClasses.map((badge, badgeIndex) => {
                const tones = isDark ? CATEGORY_BADGE_TONES : CATEGORY_BADGE_TONES_LIGHT;
                return (
                  <CategoryBadge key={badge} tone={tones[badgeIndex % tones.length]}>
                    {badge}
                  </CategoryBadge>
                );
              })}
            </div>
            <ZigzagButton onClick={onPlay} className={`mt-8 px-8 py-5 text-sm font-black uppercase tracking-[0.18em] ${isDark ? 'bg-white text-slate-950 hover:bg-slate-100' : 'bg-slate-950 text-white hover:bg-slate-800'}`}>
              Play →
            </ZigzagButton>
          </div>

          <div className="flex items-center justify-center">
            <div className={`hidden aspect-square w-72 flex-col items-center justify-center rounded-[30px] border-2 lg:flex ${isDark ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200 bg-slate-950/5 text-slate-950'}`}>
              <span className="text-7xl">{theme.emoji}</span>
              <span className={`mt-4 text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-white/25' : 'text-slate-400'}`}>Preview</span>
            </div>
            <ZigzagButton onClick={onPlay} className={`flex h-20 w-20 items-center justify-center border-2 text-2xl lg:hidden ${isDark ? 'border-white/20 text-white/70 hover:border-white hover:text-white' : 'border-slate-300 text-slate-600 hover:border-slate-950 hover:text-slate-950'}`}>
              ▶
            </ZigzagButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function Navbar({ user, onSignIn }: { user: AuthUser | null; onSignIn: () => void }) {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/5 bg-black/75 backdrop-blur-xl">
      <div className="shell-width flex items-center justify-between py-4">
        <span className="text-2xl font-black tracking-tight text-white">rippd</span>
        <div className="flex items-center gap-3 text-right">
          <span className="hidden text-[11px] uppercase tracking-[0.2em] text-white/35 sm:block">guest play or account-based identity</span>
          {user ? (
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">{user.displayName}</span>
          ) : (
            <button
              onClick={onSignIn}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75 hover:border-white/40 hover:text-white"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function Hero({ onPlay }: { onPlay: () => void }) {
  return (
    <section className="bg-transparent text-white">
      <div className="shell-width py-24 text-center sm:py-32">
          <div className="eyebrow">Instant multiplayer, now with optional accounts</div>
          <h1 className="mt-4 text-6xl font-black leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl">
            Pick a game.
            <br />
            <span className="text-white/35">Share the link.</span>
            <br />
            Play instantly.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/55">Couch co-op and online multiplayer with the flexibility to stay a guest or create an account. Launch a room in seconds, keep the styling consistent, and make future theme updates easy with shared design tokens.</p>
          <ZigzagButton onClick={onPlay} className="mt-12 action-button px-10 py-6">
            Start playing →
          </ZigzagButton>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-black/70 backdrop-blur-xl">
      <div className="shell-width py-12 text-center">
        <p className="text-2xl font-black text-white">rippd</p>
        <p className="mt-2 text-sm text-white/35">Guest rooms, optional accounts, encrypted profile data.</p>
      </div>
    </footer>
  );
}

const SECTION_COLORS: Record<GameKind, string> = {
  zatacka: GAME_THEME.zatacka.surface,
  ramses: GAME_THEME.ramses.surface
};
const EDGE_COLOR = '#020617';

export default function HomePage() {
  const [activeGame, setActiveGame] = useState<GameKind | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const games = useMemo(() => Object.values(GAME_CONFIG), []);

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser()
      .then((result) => {
        if (mounted) setUser(result.user);
      })
      .catch(() => {
        if (mounted) setUser(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="page-shell">
      <Navbar user={user} onSignIn={() => setActiveGame(games[0].kind)} />
      <Hero onPlay={() => setActiveGame(games[0].kind)} />

      {games.map((game, index) => {
        const upper = index === 0 ? EDGE_COLOR : SECTION_COLORS[games[index - 1].kind];
        const lower = SECTION_COLORS[game.kind];
        return (
          <div key={game.kind}>
            <ZigzagDivider upper={upper} lower={lower} />
            <GameSection game={game} index={index} onPlay={() => setActiveGame(game.kind)} />
          </div>
        );
      })}

      <ZigzagDivider upper={SECTION_COLORS[games[games.length - 1].kind]} lower={EDGE_COLOR} />
      <Footer />
      <PlayModal game={activeGame} user={user} onClose={() => setActiveGame(null)} />
    </div>
  );
}
