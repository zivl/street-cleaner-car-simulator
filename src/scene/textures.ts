import * as THREE from 'three';
import type { FacadeStyle } from '../data/cities';
import { Rng } from '../game/random';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function toTexture(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) cache.set(key, (t = make()));
  return t;
}

/** Tileable asphalt with grain and subtle patches. */
export function asphaltTexture(base: string) {
  return cached('asphalt' + base, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    const rng = new Rng(7);
    for (let i = 0; i < 9000; i++) {
      const v = rng.range(-28, 28);
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
      g.fillRect(rng.range(0, 256), rng.range(0, 256), rng.range(1, 2.5), rng.range(1, 2.5));
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(0,0,0,${rng.range(0.03, 0.08)})`;
      g.beginPath();
      g.ellipse(rng.range(0, 256), rng.range(0, 256), rng.range(10, 40), rng.range(8, 30), rng.range(0, 3), 0, Math.PI * 2);
      g.fill();
    }
    return toTexture(c);
  });
}

/** Paving tiles for sidewalks. */
export function pavingTexture(base: string) {
  return cached('paving' + base, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    const rng = new Rng(3);
    const n = 4;
    const s = 256 / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = rng.range(-14, 14);
        g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
        g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * s, 0);
      g.lineTo(i * s, 256);
      g.moveTo(0, i * s);
      g.lineTo(256, i * s);
      g.stroke();
    }
    return toTexture(c);
  });
}

export function grassTexture(base: string) {
  return cached('grass' + base, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    const rng = new Rng(11);
    for (let i = 0; i < 6000; i++) {
      const v = rng.range(-35, 35);
      g.fillStyle = v > 0 ? `rgba(200,255,120,${v / 400})` : `rgba(0,40,0,${-v / 300})`;
      g.fillRect(rng.range(0, 256), rng.range(0, 256), 1.5, rng.range(2, 5));
    }
    return toTexture(c);
  });
}

/** Grime noise used by the dirt overlay shader (single channel, linear). */
export function grimeNoiseTexture() {
  return cached('grime', () => {
    const [c, g] = canvas(256, 256);
    const img = g.createImageData(256, 256);
    const rng = new Rng(99);
    // Multi-octave blotches
    const layer = new Float32Array(256 * 256);
    for (let o = 0; o < 4; o++) {
      const cells = 4 << o;
      const grid = Array.from({ length: (cells + 1) * (cells + 1) }, () => rng.next());
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const fx = (x / 256) * cells;
          const fy = (y / 256) * cells;
          const ix = Math.floor(fx);
          const iy = Math.floor(fy);
          const tx = fx - ix;
          const ty = fy - iy;
          const w = cells + 1;
          const i1 = ix % cells;
          const j1 = iy % cells;
          const i2 = (ix + 1) % cells;
          const j2 = (iy + 1) % cells;
          const a = grid[j1 * w + i1];
          const b = grid[j1 * w + i2];
          const cc = grid[j2 * w + i1];
          const d = grid[j2 * w + i2];
          const sx = tx * tx * (3 - 2 * tx);
          const sy = ty * ty * (3 - 2 * ty);
          const v = a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
          layer[y * 256 + x] += v / (1 << o) / 1.875;
        }
      }
    }
    for (let i = 0; i < 256 * 256; i++) {
      const v = Math.floor(layer[i] * 255);
      const speck = rng.next() < 0.04 ? 60 : 0;
      img.data[i * 4] = Math.min(255, v + speck);
      img.data[i * 4 + 1] = Math.floor(rng.next() * 255);
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return toTexture(c, true, false);
  });
}

export const FACADE_BAYS = 8;
export const FACADE_FLOORS = 8;

/** Facade texture: 8 window bays × 8 floors. White walls so vertex colour tints them. */
export function facadeTextures(style: FacadeStyle) {
  const key = 'facade-' + style;
  const map = cached(key, () => drawFacade(style, false));
  const lit = cached(key + '-lit', () => drawFacade(style, true));
  return { map, lit };
}

function drawFacade(style: FacadeStyle, lit: boolean): THREE.Texture {
  const W = 512;
  const H = 512;
  const [c, g] = canvas(W, H);
  const bw = W / FACADE_BAYS;
  const fh = H / FACADE_FLOORS;
  const rng = new Rng(style.length * 131 + 5);
  g.fillStyle = lit ? '#000' : '#fff';
  g.fillRect(0, 0, W, H);

  if (!lit && style === 'brick') {
    for (let y = 0; y < H; y += 6) {
      for (let x = (y / 6) % 2 ? 0 : 7; x < W; x += 14) {
        g.fillStyle = `rgba(0,0,0,${0.05 + rng.next() * 0.08})`;
        g.fillRect(x, y, 13, 5);
      }
    }
  }
  if (!lit && style === 'concrete') {
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 2;
    for (let y = 0; y <= H; y += fh) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    for (let x = 0; x <= W; x += bw * 2) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
  }

  const glass = (x: number, y: number, w: number, h: number) => {
    if (lit) {
      const on = rng.next() < 0.42;
      if (!on) return;
      const warm = rng.next() < 0.75;
      const b = 0.6 + rng.next() * 0.4;
      g.fillStyle = warm ? `rgba(255,${190 + rng.next() * 40},${110 + rng.next() * 50},${b})` : `rgba(170,210,255,${b})`;
      g.fillRect(x, y, w, h);
      return;
    }
    const grd = g.createLinearGradient(x, y, x + w, y + h);
    grd.addColorStop(0, '#3d5570');
    grd.addColorStop(1, '#22303f');
    g.fillStyle = grd;
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x + 2, y + 2, w * 0.35, h - 4);
  };

  for (let fy = 0; fy < FACADE_FLOORS; fy++) {
    const y0 = fy * fh;
    for (let bx = 0; bx < FACADE_BAYS; bx++) {
      const x0 = bx * bw;
      switch (style) {
        case 'office':
          glass(x0 + 3, y0 + 6, bw - 6, fh - 12);
          if (!lit) {
            g.fillStyle = 'rgba(0,0,0,0.25)';
            g.fillRect(x0, y0, 3, fh);
          }
          break;
        case 'bauhaus':
          // Horizontal ribbon windows with a solid band.
          glass(x0, y0 + fh * 0.3, bw, fh * 0.42);
          if (!lit) {
            g.fillStyle = 'rgba(0,0,0,0.08)';
            g.fillRect(x0, y0 + fh * 0.78, bw, 4);
          }
          break;
        case 'haussmann':
          glass(x0 + bw * 0.28, y0 + fh * 0.16, bw * 0.44, fh * 0.68);
          if (!lit) {
            g.fillStyle = 'rgba(0,0,0,0.5)';
            g.fillRect(x0 + bw * 0.2, y0 + fh * 0.72, bw * 0.6, 3);
            for (let k = 0; k < 6; k++) g.fillRect(x0 + bw * 0.22 + k * bw * 0.11, y0 + fh * 0.72, 2, fh * 0.12);
            g.fillStyle = 'rgba(0,0,0,0.07)';
            g.fillRect(x0, y0 + fh - 4, bw, 4);
          }
          break;
        case 'brick':
          glass(x0 + bw * 0.25, y0 + fh * 0.2, bw * 0.5, fh * 0.6);
          if (!lit) {
            g.fillStyle = 'rgba(255,255,255,0.85)';
            g.fillRect(x0 + bw * 0.22, y0 + fh * 0.8, bw * 0.56, 4);
            g.fillRect(x0 + bw * 0.22, y0 + fh * 0.17, bw * 0.56, 3);
          }
          break;
        case 'canal':
          glass(x0 + bw * 0.18, y0 + fh * 0.14, bw * 0.64, fh * 0.7);
          if (!lit) {
            g.strokeStyle = 'rgba(255,255,255,0.9)';
            g.lineWidth = 4;
            g.strokeRect(x0 + bw * 0.18, y0 + fh * 0.14, bw * 0.64, fh * 0.7);
            g.beginPath();
            g.moveTo(x0 + bw * 0.5, y0 + fh * 0.14);
            g.lineTo(x0 + bw * 0.5, y0 + fh * 0.84);
            g.moveTo(x0 + bw * 0.18, y0 + fh * 0.45);
            g.lineTo(x0 + bw * 0.82, y0 + fh * 0.45);
            g.stroke();
          }
          break;
        case 'concrete':
          glass(x0 + bw * 0.15, y0 + fh * 0.25, bw * 0.7, fh * 0.5);
          break;
        case 'dense':
          glass(x0 + 4, y0 + fh * 0.2, bw - 8, fh * 0.55);
          if (!lit) {
            g.fillStyle = 'rgba(0,0,0,0.18)';
            g.fillRect(x0, y0 + fh * 0.8, bw, fh * 0.08);
            if (rng.next() < 0.15) {
              g.fillStyle = 'rgba(80,80,90,0.6)';
              g.fillRect(x0 + bw * 0.6, y0 + fh * 0.55, bw * 0.3, fh * 0.2); // AC unit
            }
          }
          break;
      }
    }
  }
  return toTexture(c);
}

/** Canvas texture with text for neon signs. */
export function neonSignTexture() {
  return cached('neon', () => {
    const [c, g] = canvas(512, 512);
    g.fillStyle = '#000';
    g.fillRect(0, 0, 512, 512);
    const words = ['ラーメン', 'カラオケ', 'BAR', 'ホテル', '寿司', 'GAME', 'CAFE', '24H'];
    const colors = ['#ff3d8b', '#35e6ff', '#ffe14d', '#7cff6b', '#b46bff', '#ff8a3d', '#ffffff', '#ff3d3d'];
    for (let i = 0; i < 8; i++) {
      const y = i * 64;
      g.fillStyle = '#111';
      g.fillRect(4, y + 4, 504, 56);
      g.font = 'bold 40px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = colors[i];
      g.shadowBlur = 16;
      g.fillStyle = colors[i];
      g.fillText(words[i], 256, y + 34);
    }
    const t = toTexture(c, false);
    return t;
  });
}

/** Lane-marking texture is not needed: markings are geometry. */

export function radialGlowTexture() {
  return cached('glow', () => {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return toTexture(c, false);
  });
}
