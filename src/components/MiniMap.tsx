import { useEffect, useRef } from 'react';
import { DIRT_TYPES } from '../data/dirtTypes';
import type { Game } from '../game/Game';
import { CELL, CHUNK, SURF_GRASS, SURF_LOT, SURF_ROAD, SURF_SIDEWALK, SURF_WATER } from '../game/CleaningSystem';

const SURF_COLORS: Record<number, [number, number, number, number]> = {
  [SURF_ROAD]: [92, 101, 116, 255],
  [SURF_SIDEWALK]: [48, 56, 70, 255],
  [SURF_LOT]: [26, 32, 44, 255],
  [SURF_GRASS]: [42, 82, 50, 255],
  [SURF_WATER]: [30, 80, 112, 255],
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Heading-up mini-map drawn on a 2D canvas, independent of React re-renders. */
export function MiniMap({ game, size }: { game: Game; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d')!;
    const C = game.cleaning;

    // Base layer: 1 px per metre.
    const bw = Math.ceil(C.gw * CELL);
    const bh = Math.ceil(C.gh * CELL);
    const base = document.createElement('canvas');
    base.width = bw;
    base.height = bh;
    const bctx = base.getContext('2d')!;
    const img = bctx.createImageData(bw, bh);
    const step = 1 / CELL;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const c = Math.min(C.gh - 1, y * step) * C.gw + Math.min(C.gw - 1, x * step);
        const col = SURF_COLORS[C.surface[c]] ?? [20, 24, 32, 255];
        img.data.set(col, (y * bw + x) * 4);
      }
    }
    bctx.putImageData(img, 0, 0);

    // Dirt layer: 1 px per chunk.
    const dl = document.createElement('canvas');
    dl.width = C.cw;
    dl.height = C.ch;
    const dctx = dl.getContext('2d')!;
    const dimg = dctx.createImageData(C.cw, C.ch);
    const typeRgb = DIRT_TYPES.map((t) => hexToRgb(t.blip));
    const cleanRgb: [number, number, number] = [74, 222, 128];
    let lastDirt = 0;

    const drawDirt = () => {
      const v = game.vehicle;
      const tier = game.stats.radarTier;
      const range = game.stats.radarRange;
      const cs = CHUNK * CELL;
      for (let k = 0; k < C.cw * C.ch; k++) {
        const o = k * 4;
        const init = C.chunkInit[k];
        if (init <= 0) {
          dimg.data[o + 3] = 0;
          continue;
        }
        const d = C.chunkDirt[k];
        const i = k % C.cw;
        const j = (k / C.cw) | 0;
        const inRange = Math.hypot((i + 0.5) * cs - v.x, (j + 0.5) * cs - v.z) <= range;
        const known = tier >= 4 ? C.chunkKnown[k] === 1 : inRange;
        if (d < 0.3) {
          dimg.data[o] = cleanRgb[0];
          dimg.data[o + 1] = cleanRgb[1];
          dimg.data[o + 2] = cleanRgb[2];
          dimg.data[o + 3] = 110;
        } else if (known) {
          const rgb = tier >= 3 ? typeRgb[C.chunkType[k]] : [245, 165, 36];
          dimg.data[o] = rgb[0];
          dimg.data[o + 1] = rgb[1];
          dimg.data[o + 2] = rgb[2];
          dimg.data[o + 3] = Math.min(255, 90 + (d / init) * 165);
        } else {
          dimg.data[o + 3] = 0;
        }
      }
      dctx.putImageData(dimg, 0, 0);
    };

    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - lastDirt > 250) {
        lastDirt = now;
        drawDirt();
      }
      const v = game.vehicle;
      const S = size * dpr;
      const half = S / 2;
      const viewRadius = 75; // metres from centre to edge
      const scale = half / viewRadius;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, S, S);
      ctx.save();
      ctx.beginPath();
      ctx.arc(half, half, half - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#0d1420';
      ctx.fillRect(0, 0, S, S);

      // Heading-up: rotate world so forward (sin h, cos h) points up.
      const fwdAngle = Math.atan2(Math.cos(v.heading), Math.sin(v.heading));
      const rot = -Math.PI / 2 - fwdAngle;
      ctx.translate(half, half);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-v.x, -v.z);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(base, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(dl, 0, 0, C.cw * CHUNK * CELL, C.ch * CHUNK * CELL);

      // Radar ring.
      const range = game.stats.radarRange;
      ctx.strokeStyle = 'rgba(61,224,255,0.45)';
      ctx.lineWidth = 1.2 / scale;
      ctx.beginPath();
      ctx.arc(v.x, v.z, range, 0, Math.PI * 2);
      ctx.stroke();
      // Sweep.
      const sweep = (now / 1000) * 2.5;
      const grd = ctx.createRadialGradient(v.x, v.z, 0, v.x, v.z, Math.min(range, viewRadius * 1.5));
      grd.addColorStop(0, 'rgba(61,224,255,0.22)');
      grd.addColorStop(1, 'rgba(61,224,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(v.x, v.z);
      ctx.arc(v.x, v.z, Math.min(range, viewRadius * 1.5), sweep, sweep + 0.6);
      ctx.closePath();
      ctx.fill();

      // Traffic.
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (const car of game.traffic.cars) {
        ctx.beginPath();
        ctx.arc(car.x, car.z, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Spawn / depot.
      const sp = game.layout.spawn;
      ctx.fillStyle = '#ff7a00';
      ctx.fillRect(sp.x - 3, sp.z - 3, 6, 6);

      ctx.restore();

      // Pickups (clamped to the rim when off-view), drawn in screen space.
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const toScreen = (x: number, z: number) => {
        const dx = (x - v.x) * scale;
        const dz = (z - v.z) * scale;
        return [half + dx * cosR - dz * sinR, half + dx * sinR + dz * cosR] as const;
      };
      for (const p of game.pickups) {
        if (!p.alive) continue;
        let [sx, sy] = toScreen(p.x, p.z);
        const dx = sx - half;
        const dy = sy - half;
        const dist = Math.hypot(dx, dy);
        const maxR = half - 9 * dpr;
        if (dist > maxR) {
          sx = half + (dx / dist) * maxR;
          sy = half + (dy / dist) * maxR;
        }
        ctx.fillStyle = p.kind === 'fuel' ? '#ffcc33' : '#4ade80';
        ctx.beginPath();
        ctx.arc(sx, sy, 5.5 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d1420';
        ctx.font = `bold ${8 * dpr}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.kind === 'fuel' ? 'F' : '+', sx, sy + 0.5);
      }

      // North marker.
      const [nx, ny] = (() => {
        const ang = rot - Math.PI / 2; // world -z direction
        const r = half - 9 * dpr;
        return [half + Math.cos(ang) * r, half + Math.sin(ang) * r];
      })();
      ctx.fillStyle = '#e5e7eb';
      ctx.font = `bold ${10 * dpr}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', nx, ny);

      // Player arrow.
      ctx.save();
      ctx.translate(half, half);
      ctx.fillStyle = '#ff7a00';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, -9 * dpr);
      ctx.lineTo(6.5 * dpr, 7 * dpr);
      ctx.lineTo(0, 3.5 * dpr);
      ctx.lineTo(-6.5 * dpr, 7 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Rim.
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.arc(half, half, half - 1.5 * dpr, 0, Math.PI * 2);
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [game, size]);

  return <canvas ref={ref} className="minimap" style={{ width: size, height: size }} />;
}
