'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GAME_CONFIG, GAME_THEME, GameKind } from '@rippd/shared';
import { CATEGORY_BADGE_TONES_LIGHT } from '@/lib/design';
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
      <div className="rounded-[28px] border border-white/12 bg-white/7 p-5 text-white">
        <div className="eyebrow !text-white/42">Account ready</div>
        <div className="mt-2 text-2xl font-black uppercase tracking-tight">{user.displayName}</div>
        <div className="mt-1 text-sm text-white/55">{user.email}</div>
        <p className="mt-3 text-sm text-white/68">You can play with your saved identity, or still jump into any room as a guest.</p>
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
    );
  }

  return (
    <div className="rounded-[28px] border border-white/12 bg-white/7 p-5 text-white">
      <div className="flex flex-wrap gap-2">
        {(['register', 'login'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${
              mode === value ? 'bg-[#efeaff] text-black' : 'border border-white/12 text-white/65 hover:border-white/30'
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
        {authError ? <div className="rounded-[22px] border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{authError}</div> : null}
        <ZenButton type="submit" className="action-button w-full disabled:cursor-not-allowed disabled:opacity-70">
          {saving ? 'Working…' : mode === 'register' ? 'Create account' : 'Sign in'}
        </ZenButton>
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
    <div className="fixed inset-0 z-50 bg-black/72 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-5xl overflow-hidden rounded-[34px] bg-[#d8d4ee] shadow-[0_40px_120px_rgba(0,0,0,0.38)]" onClick={(e) => e.stopPropagation()}>
          <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
            <div className="bg-black px-5 py-5 text-white sm:px-7 sm:py-6 lg:min-h-[640px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="eyebrow !text-white/38">Product drop</div>
                  <h2 className="mt-2 display-font text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em] sm:text-5xl">{meta.name}</h2>
                </div>
                <ZenButton onClick={onClose} className="flex h-12 w-12 items-center justify-center border border-white/15 bg-white/6 text-lg font-black text-white hover:border-white/35 hover:bg-white/10">
                  ×
                </ZenButton>
              </div>

              <div className="mt-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#140036_0%,#24107a_40%,#7db4ff_100%)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                <div className="zen-visual min-h-[260px] border border-white/10" />
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {theme.badgeClasses.map((badge, index) => (
                  <CategoryBadge key={badge} tone={CATEGORY_BADGE_TONES_LIGHT[index % CATEGORY_BADGE_TONES_LIGHT.length]}>
                    {badge}
                  </CategoryBadge>
                ))}
              </div>

              <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/62">
                Launch a room in seconds, invite friends fast, and keep optional accounts available for persistent identity.
              </p>
            </div>

            <div className="px-5 py-6 text-black sm:px-7 sm:py-7">
              <div className="eyebrow">Ready to play</div>
              <div className="mt-3 zen-display-title text-[clamp(3.2rem,8vw,5.6rem)]">
                <span>Enter</span>
                <span>The Vault</span>
              </div>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-black/64">
                Pick how you want to join, then create a fresh room or jump straight into an existing one.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <ZenButton
                  onClick={() => setPlayMode('guest')}
                  className={`px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] ${
                    playMode === 'guest' ? 'bg-black text-white' : 'border border-black/12 bg-white/50 text-black hover:bg-white/72'
                  }`}
                >
                  Play as guest
                </ZenButton>
                <ZenButton
                  onClick={() => setPlayMode('account')}
                  className={`px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] ${
                    playMode === 'account' ? 'bg-black text-white' : 'border border-black/12 bg-white/50 text-black hover:bg-white/72'
                  }`}
                >
                  Use account
                </ZenButton>
              </div>

              {playMode === 'guest' ? (
                <label className="mt-6 block rounded-[28px] border border-black/10 bg-white/40 p-4">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45">Guest nickname</span>
                  <input
                    autoFocus
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                    placeholder="Enter your nickname…"
                    className="mt-3 w-full rounded-[20px] border border-black/12 bg-white/72 px-4 py-3 text-base text-black outline-none placeholder:text-black/35 focus:border-black/35"
                  />
                </label>
              ) : (
                <div className="mt-6">
                  <AuthPanel user={currentUser} setUser={setCurrentUser} setError={setAuthError} authError={authError} />
                </div>
              )}

              <div className="mt-6 rounded-[30px] border border-black/10 bg-white/44 p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Current identity</div>
                <div className="mt-2 text-2xl font-black uppercase tracking-tight">{activeName}</div>
                <div className="mt-1 text-sm text-black/58">{currentUser && playMode === 'account' ? 'Account-backed player profile' : 'Guest profile for this session'}</div>

                <ZenButton onClick={createRoom} className="action-button mt-6 w-full">
                  Create room
                </ZenButton>

                <div className="relative py-5 text-center">
                  <div className="absolute inset-y-1/2 left-0 right-0 border-t border-black/12" />
                  <span className="relative bg-[#d8d4ee] px-4 text-[11px] uppercase tracking-[0.2em] text-black/38">or join existing</span>
                </div>

                <div className="flex gap-2">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                    placeholder="ROOM42"
                    maxLength={8}
                    className="min-w-0 flex-1 rounded-[20px] border border-black/12 bg-white/78 px-4 py-3 font-mono text-base uppercase outline-none focus:border-black/35"
                  />
                  <ZenButton onClick={joinRoom} className="action-button-dark px-6 py-3">
                    Join
                  </ZenButton>
                </div>
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

  return (
    <section className="zen-section">
      <div className="shell-width">
        <div className={`grid items-end gap-8 lg:grid-cols-[0.95fr_1.05fr] ${index % 2 === 1 ? 'lg:grid-cols-[1.05fr_0.95fr]' : ''}`}>
          <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
            <div className="eyebrow">{theme.badgeLabel}</div>
            <div className="mt-8 zen-display-title text-[clamp(4.2rem,10vw,9rem)]">
              {game.name.split(' ').map((part) => (
                <span key={part}>{part}</span>
              ))}
            </div>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-black/68 sm:text-lg">{game.description}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              {theme.badgeClasses.map((badge, badgeIndex) => (
                <CategoryBadge key={badge} tone={CATEGORY_BADGE_TONES_LIGHT[badgeIndex % CATEGORY_BADGE_TONES_LIGHT.length]}>
                  {badge}
                </CategoryBadge>
              ))}
            </div>
            <ZenButton onClick={onPlay} className="action-button mt-10 px-8 py-5">
              Enter vault
            </ZenButton>
          </div>

          <div className={`space-y-4 ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
            <div className="zen-visual min-h-[320px] sm:min-h-[420px]" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="zen-outline-card">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Mode</div>
                <div className="mt-2 display-font text-3xl font-black uppercase tracking-[-0.05em]">Instant rooms</div>
                <div className="mt-2 text-sm text-black/62">Spin up a room, share the code, and start without friction.</div>
              </div>
              <div className="zen-outline-card">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/42">Identity</div>
                <div className="mt-2 display-font text-3xl font-black uppercase tracking-[-0.05em]">Guest or account</div>
                <div className="mt-2 text-sm text-black/62">Keep it anonymous or save your profile for repeat play.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Navbar({ user, onSignIn }: { user: AuthUser | null; onSignIn: () => void }) {
  return (
    <div className="shell-width pt-4 sm:pt-6">
      <nav className="zen-nav-shell">
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          <span className="display-font text-4xl font-black uppercase tracking-[-0.06em] sm:text-5xl">rippd</span>
          <div className="flex items-center gap-3 sm:gap-5">
            <button onClick={onSignIn} className="zen-nav-pill">
              {user ? user.displayName : 'Products'}
              <span aria-hidden="true">▼</span>
            </button>
            <button className="zen-burger" aria-label="Menu">
              <span className="flex w-10 flex-col gap-2 sm:w-12">
                <span className="h-[4px] rounded-full bg-white" />
                <span className="h-[4px] rounded-full bg-white" />
                <span className="h-[4px] rounded-full bg-white" />
              </span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}

function Hero({ onPlay }: { onPlay: () => void }) {
  return (
    <section className="zen-section pt-6 sm:pt-8 lg:pt-10">
      <div className="shell-width">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.96fr] lg:items-end">
          <div className="space-y-8 lg:order-2">
            <div className="zen-visual min-h-[360px] sm:min-h-[520px]" />
          </div>
          <div className="pb-2 lg:order-1">
            <div className="eyebrow">Instant multiplayer · optional accounts</div>
            <div className="mt-8 zen-display-title text-[clamp(4.8rem,13vw,10.5rem)]">
              <span>The shared</span>
              <span>world</span>
              <span>powered by</span>
              <span>rippd</span>
            </div>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-black/68 sm:text-lg">
              Couch co-op and online multiplayer with a bold new visual system inspired by the reference: oversized type, floating black chrome, soft lavender space, and fast room creation.
            </p>
            <ZenButton onClick={onPlay} className="action-button mt-10 px-10 py-5">
              Enter vault
            </ZenButton>
          </div>
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
          <p className="display-font text-4xl font-black uppercase tracking-[-0.06em]">rippd</p>
          <p className="mt-2 text-sm text-white/48">Guest rooms, saved identities, and a site-wide style refresh aligned to your reference.</p>
        </div>
      </div>
    </footer>
  );
}

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

      {games.map((game, index) => (
        <GameSection key={game.kind} game={game} index={index} onPlay={() => setActiveGame(game.kind)} />
      ))}

      <Footer />
      <PlayModal game={activeGame} user={user} onClose={() => setActiveGame(null)} />
    </div>
  );
}
