'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ClientRoomSnapshot, CONTROL_KEYSETS, SlitherControlInput, SlitherUsePowerupInput } from '@rippd/shared';

export function SlitherView({
  snapshot,
  onInput,
  onUsePowerup
}: {
  snapshot: ClientRoomSnapshot;
  onInput: (input: SlitherControlInput) => void;
  onUsePowerup: (input: SlitherUsePowerupInput) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [countdownSecs, setCountdownSecs] = useState<number | null>(null);
  const [showGo, setShowGo] = useState(false);
  const game = snapshot.gameState.type === 'slither' ? snapshot.gameState : null;

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

  useEffect(() => {
    if (game?.phase === 'running' && showGo) {
      const id = setTimeout(() => setShowGo(false), 700);
      return () => clearTimeout(id);
    }
  }, [game?.phase, showGo]);

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

    if (game.settings.walls) {
      ctx.strokeStyle = 'rgba(255,255,255,0.24)';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    }

    const riderById = new Map(game.riders.map((r) => [r.id, r]));
    for (const trail of game.trails) {
      const rider = riderById.get(trail.playerId);
      if (!trail.segments.length) continue;
      ctx.strokeStyle = trail.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = rider?.ghostActive ? 0.45 : 1;
      for (const segment of trail.segments) {
        if (segment.length < 2) continue;
        ctx.beginPath();
        segment.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    for (const powerup of game.powerups) {
      ctx.save();
      ctx.translate(powerup.position.x, powerup.position.y);
      if (powerup.kind === 'bomb') {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff7ed';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(8, -20);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(103,232,249,0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (game.phase === 'countdown' || game.phase === 'running') {
      for (const rider of game.riders) {
        if (!rider.alive) continue;
        if (rider.ghostActive) {
          ctx.fillStyle = 'rgba(103,232,249,0.25)';
          ctx.beginPath();
          ctx.arc(rider.position.x, rider.position.y, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rider.position.x, rider.position.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [game]);

  const localPlayers = useMemo(() => snapshot.players.filter((player) => snapshot.viewer.localPlayerIds.includes(player.id)), [snapshot.players, snapshot.viewer.localPlayerIds]);

  useEffect(() => {
    const handleDown = (event: KeyboardEvent) => {
      localPlayers.forEach((player) => {
        const keyset = CONTROL_KEYSETS[player.controlPreset];
        const key = event.key.toLowerCase();
        if (key === keyset.left) onInput({ playerId: player.id, steering: -1 });
        if (key === keyset.right) onInput({ playerId: player.id, steering: 1 });
        if (!event.repeat && key === keyset.action) onUsePowerup({ playerId: player.id });
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
    const lastPowerupPressed = new Map<string, boolean>();
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
        const powerupPressed = pad.buttons[0]?.pressed ?? false;
        if (powerupPressed && !lastPowerupPressed.get(player.id)) {
          onUsePowerup({ playerId: player.id });
        }
        lastPowerupPressed.set(player.id, powerupPressed);
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
  }, [localPlayers, onInput, onUsePowerup]);

  if (!game) return null;

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={960}
        height={600}
        className="absolute inset-0 m-auto w-full h-full object-contain"
      />

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
              animation: 'slither-pop 0.25s ease-out'
            }}
          >
            {showGo ? 'GO!' : countdownSecs}
          </div>
        </div>
      )}

      {game.paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div style={{ fontSize: 'clamp(4rem,14vw,10rem)', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.06em', lineHeight: 1, textShadow: '0 0 40px rgba(255,255,255,0.3)' }}>
            PAUSED
          </div>
        </div>
      )}

      {game.phase === 'round-over' && (
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

      <style>{`
        @keyframes slither-pop {
          from { transform: scale(1.4); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
