'use client';

import { ClientRoomSnapshot, ExplodeAction } from '@rippd/shared';

const NUMBER_COLORS: Record<number, string> = {
  1: '#2563eb',
  2: '#16a34a',
  3: '#dc2626',
  4: '#7c3aed',
  5: '#ea580c',
  6: '#0891b2',
  7: '#334155',
  8: '#111827'
};

export function ExplodeView({
  snapshot,
  onAction
}: {
  snapshot: ClientRoomSnapshot;
  onAction: (action: ExplodeAction) => void;
}) {
  const game = snapshot.gameState.type === 'explode' ? snapshot.gameState : null;
  if (!game) return null;

  const turnPlayer = game.players.find((player) => player.id === game.turnPlayerId);
  const localPlayerIds = new Set(snapshot.viewer.localPlayerIds);
  const isLocalTurn = localPlayerIds.has(game.turnPlayerId);

  return (
    <div className="h-full overflow-auto bg-[#fff7ef] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto grid max-w-[1400px] gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-[30px] border border-black/10 bg-white/80 p-5 text-black shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur-md">
          <div className="eyebrow">Explode</div>
          <div className="mt-3 display-font text-4xl font-black uppercase tracking-[-0.04em]">Minefield</div>
          <p className="mt-3 text-sm leading-relaxed text-black/65">Open safe cells for points. Empty areas chain open. Mines cost 2 points and pass the turn.</p>

          <div className="mt-5 rounded-[24px] border border-black/10 bg-[#fff7ef] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45">Turn</div>
            <div className="mt-2 text-lg font-black text-black">{turnPlayer?.name ?? 'Waiting…'}</div>
            <div className="mt-1 text-sm text-black/55">{isLocalTurn ? 'Your move.' : 'Watch the board and wait for your turn.'}</div>
          </div>

          <div className="mt-4 space-y-2">
            {game.players.map((player) => {
              const isTurn = player.id === game.turnPlayerId;
              return (
                <div key={player.id} className={`rounded-[22px] border px-4 py-3 ${isTurn ? 'border-black/20 bg-black text-white' : 'border-black/10 bg-black/[0.03] text-black'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{player.name}</div>
                    <div className={`text-xs font-bold uppercase tracking-[0.18em] ${isTurn ? 'text-white/60' : 'text-black/40'}`}>
                      {isTurn ? 'Live' : 'Player'}
                    </div>
                  </div>
                  <div className={`mt-1 text-sm ${isTurn ? 'text-white/72' : 'text-black/58'}`}>
                    {player.score} pts · {player.blasts} blast{player.blasts === 1 ? '' : 's'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-[24px] border border-black/10 bg-black/[0.03] p-4 text-sm text-black/62">
            <div>Safe cells left: <span className="font-semibold text-black">{game.safeCellsRemaining}</span></div>
            <div className="mt-1">Mines hidden: <span className="font-semibold text-black">{game.mines}</span></div>
          </div>

          <div className="mt-4 rounded-[24px] border border-orange-300/45 bg-orange-100/70 p-4 text-sm text-black/72">
            {game.message}
          </div>
        </aside>

        <section className="rounded-[34px] border border-black/10 bg-white/72 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur-md sm:p-5">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))`
            }}
          >
            {game.cells.map((cell) => {
              const owner = cell.ownerId ? snapshot.players.find((player) => player.id === cell.ownerId) : null;
              const isClickable = isLocalTurn && !cell.revealed;
              const background = cell.revealed
                ? cell.mine
                  ? cell.exploded
                    ? '#1f2937'
                    : '#fecaca'
                  : owner
                    ? `${owner.color}22`
                    : '#f3f4f6'
                : '#ebe7ff';
              const border = cell.revealed
                ? owner
                  ? `${owner.color}77`
                  : 'rgba(0,0,0,0.12)'
                : 'rgba(0,0,0,0.08)';
              const textColor = cell.mine ? '#ffffff' : NUMBER_COLORS[cell.adjacent ?? 0] ?? '#111827';

              return (
                <button
                  key={`${cell.x}-${cell.y}`}
                  onClick={() => isClickable && onAction({ type: 'reveal', x: cell.x, y: cell.y })}
                  disabled={!isClickable}
                  className={`aspect-square rounded-[16px] border text-center shadow-sm transition ${isClickable ? 'cursor-pointer hover:-translate-y-[1px] hover:shadow-md' : 'cursor-default'}`}
                  style={{
                    background,
                    borderColor: border,
                    color: textColor
                  }}
                  title={isClickable ? 'Reveal tile' : cell.revealed ? 'Opened' : 'Wait for your turn'}
                >
                  <span className="pointer-events-none select-none text-[clamp(0.8rem,1.8vw,1.15rem)] font-black">
                    {cell.revealed ? cell.mine ? '✸' : cell.adjacent ? cell.adjacent : '' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
