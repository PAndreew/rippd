'use client';

import { ClientRoomSnapshot, RamsesAction, TreasureKind } from '@rippd/shared';

const TREASURE_META: Record<TreasureKind, { label: string; color: string }> = {
  star: { label: 'Star', color: '#f59e0b' },
  diamond: { label: 'Diamond', color: '#38bdf8' },
  scarab: { label: 'Scarab', color: '#34d399' },
  ankh: { label: 'Ankh', color: '#f97316' },
  sun: { label: 'Sun', color: '#eab308' },
  eye: { label: 'Eye', color: '#a78bfa' }
};

function TreasureIcon({ kind, className = 'h-6 w-6' }: { kind: TreasureKind; className?: string }) {
  const color = TREASURE_META[kind].color;

  switch (kind) {
    case 'star':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 2.8l2.7 5.6 6.2.9-4.5 4.4 1 6.2L12 17l-5.4 2.9 1-6.2-4.5-4.4 6.2-.9L12 2.8z" fill={color} stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 3l7 8.5L12 21 5 11.5 12 3z" fill={color} stroke="currentColor" strokeWidth="1.2" />
          <path d="M8.2 8.5h7.6" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'scarab':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <ellipse cx="12" cy="13" rx="5.3" ry="6.5" fill={color} stroke="currentColor" strokeWidth="1.2" />
          <path d="M12 6.1V3.3M8.2 9.2 5.4 7.5M15.8 9.2l2.8-1.7M7.5 16.3l-3 2M16.5 16.3l3 2M9.7 6.7h4.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'ankh':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 3.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zm0 7.7V21M7 14.2h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="12" cy="7" r="4.8" fill="none" stroke={color} strokeWidth="2.2" />
        </svg>
      );
    case 'sun':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="4.7" fill={color} stroke="currentColor" strokeWidth="1.2" />
          <path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2M5.3 5.3l2.3 2.3M16.4 16.4l2.3 2.3M18.7 5.3l-2.3 2.3M7.6 16.4l-2.3 2.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'eye':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M2.8 12s3.3-5.7 9.2-5.7 9.2 5.7 9.2 5.7-3.3 5.7-9.2 5.7S2.8 12 2.8 12z" fill="none" stroke={color} strokeWidth="2" />
          <circle cx="12" cy="12" r="2.7" fill={color} stroke="currentColor" strokeWidth="1.1" />
        </svg>
      );
  }
}

export function RamsesView({ snapshot, onAction }: { snapshot: ClientRoomSnapshot; onAction: (action: RamsesAction) => void }) {
  const game = snapshot.gameState.type === 'ramses' ? snapshot.gameState : null;
  if (!game) return null;

  const activePlayer = game.players.find((player) => player.id === game.turnPlayerId);
  const card = game.currentCard;

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 overflow-auto px-4 py-4 text-black sm:px-6 sm:py-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="border border-black/10 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="display-font text-3xl font-black uppercase tracking-[-0.05em] text-black">Treasure Hunt</div>
                <div className="mt-2 text-sm text-black/65">
                  {activePlayer?.name ?? 'Unknown'} is up. Slide a pyramid into the hole and keep going until you hit the right treasure or the wrong one.
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-black/55">
                <div className="border border-black/10 bg-black/[0.03] px-3 py-2">Deck left: {game.deckRemaining}</div>
                <div className="border border-black/10 bg-black/[0.03] px-3 py-2">Turn: {activePlayer?.name ?? '—'}</div>
              </div>
            </div>
            <div className="mt-3 text-sm text-black/70">{game.message}</div>
          </div>

          <div className="border border-black/10 bg-[#f7f0d7] p-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="grid gap-[6px]" style={{ gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))` }}>
              {game.cells.map((cell) => {
                const isMovable = game.movable.some((spot) => spot.x === cell.x && spot.y === cell.y);
                const isOpenTreasure = !cell.covered && cell.coin !== 'empty';
                return (
                  <button
                    key={`${cell.x}-${cell.y}`}
                    onClick={() => onAction({ type: 'slide', x: cell.x, y: cell.y })}
                    disabled={!isMovable || game.phase !== 'playing'}
                    className={`group relative aspect-square border text-xs ${cell.covered ? 'border-[#8b5e34] bg-[#d4a373]' : 'border-[#c7b27a] bg-[#fef8e7]'} ${isMovable ? 'cursor-pointer' : 'cursor-default'} disabled:shadow-none`}
                  >
                    {cell.covered ? (
                      <div className={`absolute inset-[7%] border border-[#7c4f2d] bg-[linear-gradient(135deg,#f1c27d_0%,#d4a373_48%,#b87333_100%)] transition-transform duration-200 ${isMovable ? 'group-hover:scale-[1.03]' : ''}`} style={{ clipPath: 'polygon(50% 6%, 94% 94%, 6% 94%)' }} />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center border border-black/5 ${cell.isHole ? 'bg-white' : 'bg-[#fff7df]'}`}>
                        {cell.coin === 'empty' ? (
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/35">Empty</div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-black">
                            <TreasureIcon kind={cell.coin} className={`h-8 w-8 ${isOpenTreasure ? 'drop-shadow-[0_6px_10px_rgba(0,0,0,0.15)]' : ''}`} />
                            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-black/55">{TREASURE_META[cell.coin].label}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {!cell.covered && cell.isHole ? <div className="pointer-events-none absolute inset-0 border-2 border-violet-500/60" /> : null}
                    {isMovable ? <div className="pointer-events-none absolute inset-0 border-2 border-emerald-500/65" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-black/10 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45">Top card</div>
            {card ? (
              <div className="mt-4 border border-black/10 bg-[#fffaf0] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center border border-black/10 bg-white text-black">
                    <TreasureIcon kind={card.treasure} className="h-8 w-8" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-black">{TREASURE_META[card.treasure].label}</div>
                    <div className="text-sm text-black/60">Worth {card.points} point{card.points === 1 ? '' : 's'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-black/60">The stack is empty.</div>
            )}
          </div>

          <div className="border border-black/10 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45">Scores</div>
            <div className="mt-3 space-y-2">
              {game.players
                .slice()
                .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
                .map((player) => {
                  const isActive = player.id === game.turnPlayerId;
                  const isWinner = game.winnerIds.includes(player.id);
                  return (
                    <div key={player.id} className={`border px-4 py-3 text-sm ${isWinner ? 'border-emerald-400 bg-emerald-50' : isActive ? 'border-violet-400 bg-violet-50' : 'border-black/10 bg-black/[0.03]'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-black">{player.name}</div>
                        <div className="text-base font-black text-black">{player.score}</div>
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-black/45">
                        {isWinner ? 'Winner' : isActive ? 'Current player' : 'Waiting'}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="border border-black/10 bg-white p-5 text-sm text-black/68 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45">Rules</div>
            <ul className="mt-3 space-y-2">
              <li>• The board is covered by pyramids except for one open hole.</li>
              <li>• On your turn, slide one adjacent pyramid at a time into the hole.</li>
              <li>• Empty coins are safe, so you can keep moving.</li>
              <li>• Find the card’s treasure to win the card and its points.</li>
              <li>• Reveal the wrong treasure and your turn ends immediately.</li>
              <li>• When the stack is gone, the highest score wins.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
