'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ClientRoomSnapshot, CONTROL_KEYSETS, ZatackaControlInput } from '@rippd/shared';

export function ZatackaView({ snapshot, onInput }: { snapshot: ClientRoomSnapshot; onInput: (input: ZatackaControlInput) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const game = snapshot.gameState.type === 'zatacka' ? snapshot.gameState : null;

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
      ctx.beginPath();
      trail.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }

    for (const rider of game.riders) {
      ctx.fillStyle = rider.alive ? rider.color : '#7b7b8f';
      ctx.beginPath();
      ctx.arc(rider.position.x, rider.position.y, 7, 0, Math.PI * 2);
      ctx.fill();
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
  }, [localPlayers, onInput]);

  if (!game) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 rounded-[28px] border border-black/10 bg-white/60 p-4 text-sm text-black/70">
        <div>Round: <span className="font-semibold text-black">{game.round}</span></div>
        <div>State: <span className="font-semibold text-black">{game.phase}</span></div>
        <div>Alive: <span className="font-semibold text-black">{game.riders.filter((rider) => rider.alive).length}</span></div>
      </div>
      <canvas ref={canvasRef} width={960} height={600} className="h-auto w-full rounded-[30px] border border-black/12 bg-black shadow-[0_26px_60px_rgba(0,0,0,0.24)]" />
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
    </div>
  );
}
