'use client';

import { ClientRoomSnapshot, RamsesAction } from '@rippd/shared';

export function RamsesView({ snapshot, onAction }: { snapshot: ClientRoomSnapshot; onAction: (action: RamsesAction) => void }) {
  const game = snapshot.gameState.type === 'ramses' ? snapshot.gameState : null;
  if (!game) return null;

  const activePlayer = game.pawns.find((pawn) => pawn.id === game.turnPlayerId);
  const currentCard = game.targetCards[game.turnPlayerId];

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-black/10 bg-white/60 p-5 text-sm text-black/68">
        <div className="display-font text-3xl font-black uppercase tracking-[-0.05em] text-black">Current turn</div>
        <div className="mt-2">{activePlayer?.name ?? 'Unknown'} is up · target card <span className="font-semibold text-black">{currentCard ?? '—'}</span></div>
        <div className="mt-1 text-black/45">{game.message}</div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))` }}>
        {game.cells.map((cell) => {
          const occupant = game.pawns.find((pawn) => pawn.position.x === cell.x && pawn.position.y === cell.y);
          const isReachable = game.reachable.some((spot) => spot.x === cell.x && spot.y === cell.y);
          return (
            <button
              key={`${cell.x}-${cell.y}`}
              onClick={() => onAction(game.phase === 'slide' ? { type: 'slide', x: cell.x, y: cell.y } : { type: 'move', x: cell.x, y: cell.y })}
              className={`aspect-square rounded-[22px] border p-1 text-xs ${cell.blocked ? 'border-amber-500/40 bg-amber-100' : 'border-black/10 bg-white/60'} ${isReachable ? 'ring-2 ring-violet-500/45' : ''}`}
            >
              <div className="flex h-full flex-col items-center justify-center rounded-[18px] border border-black/6 bg-black/[0.03]">
                {cell.blocked ? <div className="text-[10px] uppercase tracking-[0.2em] text-amber-800">Pyramid</div> : null}
                {cell.revealedTreasure ? (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-black">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: cell.revealedTreasure }} />
                    {cell.revealedTreasure}
                  </div>
                ) : null}
                {occupant ? <div className="mt-2 rounded-full bg-black px-2 py-1 font-bold text-white">{occupant.name[0]}</div> : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {game.pawns.map((pawn) => (
          <div key={pawn.id} className="rounded-[24px] border border-black/10 bg-white/60 p-4 text-sm">
            <div className="font-semibold text-black">{pawn.name}</div>
            <div className="mt-1 text-black/55">Target: {game.targetCards[pawn.id] ?? 'Finished'}</div>
            <div className="mt-1 text-black/55">Score: {pawn.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
