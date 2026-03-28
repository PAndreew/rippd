'use client';

import { ClientRoomSnapshot, RamsesAction } from '@rippd/shared';

export function RamsesView({ snapshot, onAction }: { snapshot: ClientRoomSnapshot; onAction: (action: RamsesAction) => void }) {
  const game = snapshot.gameState.type === 'ramses' ? snapshot.gameState : null;
  if (!game) return null;

  const activePlayer = game.pawns.find((pawn) => pawn.id === game.turnPlayerId);
  const currentCard = game.targetCards[game.turnPlayerId];

  return (
    <div className="space-y-4">
      <div className="surface-tile p-4 text-sm text-white/70">
        <div className="text-base font-bold text-white">Current turn</div>
        <div className="mt-1">{activePlayer?.name ?? 'Unknown'} is up · target card <span className="font-semibold text-white">{currentCard ?? '—'}</span></div>
        <div className="mt-1 text-white/45">{game.message}</div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))` }}>
        {game.cells.map((cell) => {
          const occupant = game.pawns.find((pawn) => pawn.position.x === cell.x && pawn.position.y === cell.y);
          const isReachable = game.reachable.some((spot) => spot.x === cell.x && spot.y === cell.y);
          return (
            <button
              key={`${cell.x}-${cell.y}`}
              onClick={() => onAction(game.phase === 'slide' ? { type: 'slide', x: cell.x, y: cell.y } : { type: 'move', x: cell.x, y: cell.y })}
              className={`aspect-square rounded-[20px] border p-1 text-xs ${cell.blocked ? 'border-amber-400/50 bg-amber-500/20' : 'border-white/10 bg-white/[0.03]'} ${isReachable ? 'ring-2 ring-emerald-300/60' : ''}`}
            >
              <div className="flex h-full flex-col items-center justify-center rounded-[16px] border border-white/5 bg-black/10">
                {cell.blocked ? <div className="text-[10px] uppercase tracking-[0.2em] text-amber-100">Pyramid</div> : null}
                {cell.revealedTreasure ? (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-white">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: cell.revealedTreasure }} />
                    {cell.revealedTreasure}
                  </div>
                ) : null}
                {occupant ? <div className="mt-2 rounded-full bg-emerald-300 px-2 py-1 font-bold text-slate-950">{occupant.name[0]}</div> : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {game.pawns.map((pawn) => (
          <div key={pawn.id} className="surface-tile p-3 text-sm">
            <div className="font-semibold text-white">{pawn.name}</div>
            <div className="mt-1 text-white/50">Target: {game.targetCards[pawn.id] ?? 'Finished'}</div>
            <div className="mt-1 text-white/50">Score: {pawn.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
