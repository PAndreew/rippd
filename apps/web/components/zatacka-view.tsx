'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ClientRoomSnapshot, CONTROL_KEYSETS, ZatackaControlInput } from '@rippd/shared';

export function ZatackaView({ snapshot, onInput }: { snapshot: ClientRoomSnapshot; onInput: (input: ZatackaControlInput) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdownSecs, setCountdownSecs] = useState<number | null>(null);
  const [showGo, setShowGo] = useState(false);
  const game = snapshot.gameState.type === 'zatacka' ? snapshot.gameState : null;

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (game?.phase !== 'countdown') {
      setCountdownSecs(null);
      setShowGo(false);
      return;
    }
    const endsAt = game.countdownEndsAt ?? Date.now();
    const update = () => {
      const remaining = endsAt - Date.now();
      if (remaining > 0) {
        setCountdownSecs(Math.ceil(remaining / 1000));
        setShowGo(false);
      } else {
        setCountdownSecs(null);
        setShowGo(true);
      }
    };
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [game?.phase, game?.countdownEndsAt]);

  // Hide "Go!" after a short delay once running
  useEffect(() => {
    if (game?.phase === 'running' && showGo) {
      const id = setTimeout(() => setShowGo(false), 700);
      return () => clearTimeout(id);
    }
  }, [game?.phase, showGo]);

  // Canvas drawing
  useEffect(() => {
    if (!game || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#060606';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#181227';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    for (const trail of game.trails) {
      if (!trail.points.length) continue;
      ctx.strokeStyle = trail.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      trail.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }

    // Draw small direction indicators (no blob)
    if (game.phase === 'countdown' || game.phase === 'running') {
      for (const rider of game.riders) {
        if (!rider.alive) continue;
        // Just a tiny bright dot at the tip (radius 2) - no blob
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rider.position.x, rider.position.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [game]);

  const localPlayers = useMemo(() => snapshot.players.filter((player) => snapshot.viewer.localPlayerIds.includes(player.id)), [snapshot.players, snapshot.viewer.localPlayerIds]);

  useEffect(() => {
    const handleDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) return; // let browser handle esc
      localPlayers.forEach((player) => {
        const keyset = CONTROL_KEYSETS[player.controlPreset];
        const key = event.key.toLowerCase();
        if (key === keyset.left) onInput({ playerId: player.id, steering: -1 });
        if (key === keyset.right) onInput({ playerId: player.id, steering: 1 });
      });
    };

    const handleUp = (event: KeyboardEvent) => {
      localPlayers.forEach((player) => {
        const keyset = CONTROL_KEYSETS[player.controlPreset];
        const key = event.key.toLowerCase();
        if (key === keyset.left || key === keyset.right) onInput({ playerId: player.id, steering: 0 });
      });
    };

    let frame = 0;
    const lastSteering = new Map<string, -1 | 0 | 1>();
    const tickGamepads = () => {
      const pads = navigator.getGamepads?.() ?? [];
      localPlayers.forEach((player, index) => {
        const pad = pads[index];
        if (!pad) return;
        const axis = pad.axes[0] ?? 0;
        const steering = axis < -0.35 ? -1 : axis > 0.35 ? 1 : 0;
        if (lastSteering.get(player.id) !== steering) {
          lastSteering.set(player.id, steering);
          onInput({ playerId: player.id, steering });
        }
      });
      frame = window.requestAnimationFrame(tickGamepads);
    };

    frame = window.requestAnimationFrame(tickGamepads);
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [localPlayers, onInput, isFullscreen]);

  const exitFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  if (!game) return null;

  return (
    <div className="space-y-4">
      {!isFullscreen && (
        <div className="flex flex-wrap gap-3 rounded-[28px] border border-black/10 bg-white/60 p-4 text-sm text-black/70">
          <div>Round: <span className="font-semibold text-black">{game.round}</span></div>
          <div>State: <span className="font-semibold text-black">{game.phase}</span></div>
          <div>Alive: <span className="font-semibold text-black">{game.riders.filter((rider) => rider.alive).length}</span></div>
        </div>
      )}

      <div ref={containerRef} className="relative" style={isFullscreen ? { width: '100vw', height: '100vh', background: '#060606' } : {}}>
        <canvas
          ref={canvasRef}
          width={960}
          height={600}
          className={isFullscreen ? 'absolute inset-0 m-auto h-full w-full object-contain' : 'h-auto w-full rounded-[30px] border border-black/12 bg-black shadow-[0_26px_60px_rgba(0,0,0,0.24)]'}
        />

        {/* Countdown overlay */}
        {(countdownSecs !== null || showGo) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              key={countdownSecs ?? 'go'}
              style={{
                fontSize: 'clamp(6rem, 20vw, 14rem)',
                fontWeight: 900,
                fontFamily: 'inherit',
                color: showGo ? '#34d399' : '#ffffff',
                textShadow: showGo ? '0 0 60px rgba(52,211,153,0.8)' : '0 0 40px rgba(255,255,255,0.5)',
                lineHeight: 1,
                letterSpacing: '-0.06em',
                animation: 'zatacka-pop 0.25s ease-out'
              }}
            >
              {showGo ? 'GO!' : countdownSecs}
            </div>
          </div>
        )}

        {/* Exit fullscreen button */}
        {isFullscreen && (
          <button
            onClick={exitFullscreen}
            className="absolute top-4 right-4 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-white/20 pointer-events-auto"
          >
            Exit fullscreen
          </button>
        )}

        {/* Paused overlay */}
        {game.paused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.45)' }}>
            <div style={{ fontSize: 'clamp(4rem,14vw,10rem)', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.06em', lineHeight: 1, textShadow: '0 0 40px rgba(255,255,255,0.3)' }}>
              PAUSED
            </div>
          </div>
        )}

        {/* Round-over overlay in fullscreen */}
        {isFullscreen && game.phase === 'round-over' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              {game.winnerId ? (
                <>
                  <div style={{ fontSize: 'clamp(1.2rem,4vw,2.5rem)', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em' }}>
                    {game.riders.find((r) => r.id === game.winnerId)?.name ?? 'Winner'} wins!
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '1rem', color: 'rgba(255,255,255,0.5)' }}>Next round starting…</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 'clamp(1.2rem,4vw,2.5rem)', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em' }}>Draw!</div>
                  <div style={{ marginTop: '0.5rem', fontSize: '1rem', color: 'rgba(255,255,255,0.5)' }}>Next round starting…</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {!isFullscreen && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {game.riders.map((rider) => (
            <div key={rider.id} className="rounded-[24px] border border-black/10 bg-white/60 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-black">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: rider.color }} />
                {rider.name}
              </div>
              <div className="mt-2 text-black/55">{rider.alive ? 'Alive' : 'Crashed'} · {rider.controlPreset.toUpperCase()}</div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes zatacka-pop {
          from { transform: scale(1.4); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
