'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GAME_CONFIG, GAME_THEME, GameKind } from '@rippd/shared';
import { CATEGORY_BADGE_TONES_LIGHT } from '@/lib/design';
import { RippdWordmark } from '@/components/rippd-logo';
import {
  AuthUser,
  clearStoredAuthToken,
  fetchCurrentUser,
  loginAccount,
  registerAccount,
  storeAuthToken
} from '@/lib/auth';

function ZenButton({
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
  return (
    <button type={type} onClick={onClick} className={`rounded-full ${className}`}>
      {children}
    </button>
  );
}

function CategoryBadge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`pill-badge ${tone}`}>{children}</span>;
}

function AuthModal({
  user,
  setUser,
  onClose
}: {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-[28px] bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl font-black text-white hover:bg-white/20"
        >
          ×
        </button>

        <div className="eyebrow !text-white/42">rippd</div>

        {user ? (
          <div className="mt-3">
            <div className="text-2xl font-black uppercase tracking-tight">{user.displayName}</div>
            <div className="mt-1 text-sm text-white/55">{user.email}</div>
            <button
              onClick={() => {
                clearStoredAuthToken();
                setUser(null);
              }}
              className="mt-5 rounded-full border border-white/14 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75 hover:border-white/35 hover:text-white"
            >
              Sign out
            </button>
          </div>
        ) : (
          <>
            <div className="mt-3 flex gap-2">
              {(['register', 'login'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setMode(v)}
                  className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${
                    mode === v
                      ? 'bg-[#efeaff] text-black'
                      : 'border border-white/12 text-white/65 hover:border-white/30'
                  }`}
                >
                  {v === 'register' ? 'Create account' : 'Sign in'}
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="mt-4 space-y-3">
              {mode === 'register' && (
                <label className="block">
                  <span className="field-label">Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="text-field"
                    placeholder="Player one"
                    required
                  />
                </label>
              )}
              <label className="block">
                <span className="field-label">Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-field"
                  placeholder="you@example.com"
                  type="email"
                  required
                />
              </label>
              <label className="block">
                <span className="field-label">Password</span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-field"
                  placeholder="At least 8 characters"
                  type="password"
                  required
                  minLength={8}
                />
              </label>
              {error ? (
                <div className="rounded-[22px] border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
              <ZenButton
                type="submit"
                className="action-button w-full disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Working…' : mode === 'register' ? 'Create account' : 'Sign in'}
              </ZenButton>
            </form>
          </>
        )}
      </div>
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
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(user);

  useEffect(() => {
    setCurrentUser(user);
    setPlayMode(user ? 'account' : 'guest');
    if (user?.displayName) setNickname(user.displayName);
  }, [user]);

  if (!game) return null;

  const meta = GAME_CONFIG[game];
  const activeName =
    playMode === 'account' && currentUser ? currentUser.displayName : nickname.trim() || 'Guest';

  const createRoom = () => {
    const roomId = crypto.randomUUID().slice(0, 6).toUpperCase();
    router.push(`/room/${roomId}?game=${game}&nickname=${encodeURIComponent(activeName)}`);
  };

  const joinRoom = () => {
    if (!joinCode.trim()) return;
    router.push(
      `/room/${joinCode.trim().toUpperCase()}?game=${game}&nickname=${encodeURIComponent(activeName)}`
    );
  };

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setAuthError('');
    try {
      const result =
        authMode === 'register'
          ? await registerAccount({ email, password, displayName })
          : await loginAccount({ email, password });
      storeAuthToken(result.token);
      setCurrentUser(result.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-[28px] bg-white p-6 shadow-[0_40px_120px_rgba(0,0,0,0.38)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/8 text-xl font-black text-black hover:bg-black/15"
        >
          ×
        </button>

        <h2 className="display-font pr-10 text-3xl font-black uppercase tracking-tight">
          Play: {meta.name}
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setPlayMode('guest')}
            className={`rounded-full px-4 py-3 text-xs font-black uppercase tracking-[0.18em] ${
              playMode === 'guest'
                ? 'bg-black text-white'
                : 'border border-black/12 bg-black/5 text-black hover:bg-black/10'
            }`}
          >
            Guest
          </button>
          <button
            onClick={() => setPlayMode('account')}
            className={`rounded-full px-4 py-3 text-xs font-black uppercase tracking-[0.18em] ${
              playMode === 'account'
                ? 'bg-black text-white'
                : 'border border-black/12 bg-black/5 text-black hover:bg-black/10'
            }`}
          >
            Account
          </button>
        </div>

        {playMode === 'guest' ? (
          <div className="mt-4">
            <input
              autoFocus
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createRoom()}
              placeholder="Enter your nickname…"
              className="w-full rounded-[20px] border border-black/12 bg-black/5 px-4 py-3 text-base text-black outline-none placeholder:text-black/35 focus:border-black/35"
            />
          </div>
        ) : currentUser ? (
          <div className="mt-4 rounded-[20px] border border-black/10 bg-black/5 px-4 py-3">
            <div className="text-sm font-black uppercase tracking-tight">{currentUser.displayName}</div>
            <div className="text-xs text-black/55">{currentUser.email}</div>
            <button
              onClick={() => {
                clearStoredAuthToken();
                setCurrentUser(null);
              }}
              className="mt-2 text-xs text-black/45 underline hover:text-black"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="mb-3 flex gap-2">
              {(['register', 'login'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setAuthMode(v)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] ${
                    authMode === v
                      ? 'bg-black text-white'
                      : 'border border-black/12 text-black/65 hover:border-black/30'
                  }`}
                >
                  {v === 'register' ? 'Create account' : 'Sign in'}
                </button>
              ))}
            </div>
            <form onSubmit={submitAuth} className="space-y-2">
              {authMode === 'register' && (
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  required
                  className="w-full rounded-[16px] border border-black/12 bg-black/5 px-3 py-2 text-sm text-black outline-none placeholder:text-black/35 focus:border-black/35"
                />
              )}
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                required
                className="w-full rounded-[16px] border border-black/12 bg-black/5 px-3 py-2 text-sm text-black outline-none placeholder:text-black/35 focus:border-black/35"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (8+ chars)"
                type="password"
                required
                minLength={8}
                className="w-full rounded-[16px] border border-black/12 bg-black/5 px-3 py-2 text-sm text-black outline-none placeholder:text-black/35 focus:border-black/35"
              />
              {authError ? (
                <div className="rounded-[16px] border border-rose-400/40 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {authError}
                </div>
              ) : null}
              <button
                type="submit"
                className="w-full rounded-full bg-black py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white hover:bg-black/85"
              >
                {saving ? 'Working…' : authMode === 'register' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          </div>
        )}

        <button onClick={createRoom} className="action-button mt-4 w-full">
          Create room
        </button>

        <div className="relative py-3 text-center">
          <div className="absolute inset-y-1/2 left-0 right-0 border-t border-black/10" />
          <span className="relative bg-white px-3 text-[10px] uppercase tracking-[0.2em] text-black/35">
            or join existing
          </span>
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            placeholder="ROOM42"
            maxLength={8}
            className="min-w-0 flex-1 rounded-[20px] border border-black/12 bg-black/5 px-4 py-3 font-mono text-base uppercase outline-none focus:border-black/35"
          />
          <ZenButton onClick={joinRoom} className="action-button-dark px-5 py-3">
            Join
          </ZenButton>
        </div>
      </div>
    </div>
  );
}

function GameSection({
  game,
  index,
  onPlay
}: {
  game: (typeof GAME_CONFIG)[GameKind];
  index: number;
  onPlay: () => void;
}) {
  const theme = GAME_THEME[game.kind];

  return (
    <section className="zen-section">
      <div className="shell-width">
        <div
          className={`grid items-center gap-8 lg:grid-cols-2 ${index % 2 === 1 ? '' : ''}`}
        >
          <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
            <div className="eyebrow">{theme.badgeLabel}</div>
            <div className="mt-8 zen-display-title text-[clamp(4.2rem,10vw,9rem)]">
              {game.name.split(' ').map((part) => (
                <span key={part}>{part}</span>
              ))}
            </div>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-black/68 sm:text-lg">
              {game.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {theme.badgeClasses.map((badge, badgeIndex) => (
                <CategoryBadge
                  key={badge}
                  tone={CATEGORY_BADGE_TONES_LIGHT[badgeIndex % CATEGORY_BADGE_TONES_LIGHT.length]}
                >
                  {badge}
                </CategoryBadge>
              ))}
            </div>
            <ZenButton onClick={onPlay} className="action-button mt-10 px-8 py-5">
              Play
            </ZenButton>
          </div>

          <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
            <div className="flex min-h-[320px] items-center justify-center rounded-[34px] border border-black/10 bg-black/[0.04] sm:min-h-[400px]">
              <span className="text-sm text-black/35">No preview yet</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Navbar({ user, onMenuClick }: { user: AuthUser | null; onMenuClick: () => void }) {
  return (
    <div className="shell-width pt-4 sm:pt-6">
      <nav className="zen-nav-shell">
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          <Link href="/"><RippdWordmark /></Link>
          <button onClick={onMenuClick} className="zen-burger" aria-label={user ? `Open account menu for ${user.displayName}` : 'Open account menu'}>
            <span className="flex w-10 flex-col gap-2 sm:w-12">
              <span className="h-[4px] rounded-full bg-white" />
              <span className="h-[4px] rounded-full bg-white" />
              <span className="h-[4px] rounded-full bg-white" />
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function Hero() {
  return (
    <section className="zen-section pt-6 sm:pt-8 lg:pt-10">
      <div className="shell-width">
        <div className="pb-2">
          <div className="eyebrow">Instant multiplayer · optional accounts</div>
          <div className="mt-8 zen-display-title text-[clamp(4.8rem,13vw,10.5rem)]">
            <span>Lets play</span>
          </div>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-black/68 sm:text-lg">
            Digital remakes of classic board games and digital games, playable instantly with friends.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="pb-10 pt-8">
      <div className="shell-width">
        <div className="rounded-[34px] bg-black px-6 py-8 text-white shadow-[0_24px_80px_rgba(0,0,0,0.2)] sm:px-8">
          <RippdWordmark textClassName="sm:tracking-[-0.04em]" />
          <p className="mt-2 text-sm text-white/48">Copyright 2026</p>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const [activeGame, setActiveGame] = useState<GameKind | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
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
      <Navbar user={user} onMenuClick={() => setShowAuthModal(true)} />
      <Hero />

      {games.map((game, index) => (
        <GameSection key={game.kind} game={game} index={index} onPlay={() => setActiveGame(game.kind)} />
      ))}

      <Footer />
      <PlayModal game={activeGame} user={user} onClose={() => setActiveGame(null)} />
      {showAuthModal && (
        <AuthModal user={user} setUser={setUser} onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
}
