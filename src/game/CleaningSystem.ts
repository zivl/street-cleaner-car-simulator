import type { CityConfig } from '../data/cities';
import { DIRT_TYPES } from '../data/dirtTypes';
import type { VehicleStats } from '../data/vehicles';
import type { CityLayout, Rect } from './CityGenerator';
import { Rng, makeNoise2D } from './random';

export const CELL = 0.5;
export const CHUNK = 8; // cells per chunk side (4 m)

export const SURF_NONE = 0;
export const SURF_ROAD = 1;
export const SURF_SIDEWALK = 2;
export const SURF_GRASS = 3;
export const SURF_WATER = 4;
export const SURF_LOT = 5;

/** Kinds of visible dirt items. */
export const ITEM_LEAF = 0;
export const ITEM_PILE = 1;
export const ITEM_BOTTLE = 2;
export const ITEM_CAN = 3;
export const ITEM_PAPER = 4;
export const ITEM_BOX = 5;
export const ITEM_KINDS = 6;

export interface DirtItem {
  kind: number;
  x: number;
  z: number;
  rot: number;
  scale: number;
  variant: number;
  cell: number;
  hideAt: number;
  alive: boolean;
}

const BASE_RATE = 4.6;
const CLEAN_EPS = 0.04;
const FOAM_TIME = 7;

export class CleaningSystem {
  readonly gw: number;
  readonly gh: number;
  readonly cw: number;
  readonly ch: number;
  readonly surface: Uint8Array;
  readonly dirt: Float32Array;
  readonly type: Uint8Array;
  readonly foam: Float32Array;
  readonly initialDirt: Float32Array;
  readonly tex: Uint8Array;
  readonly chunkDirt: Float32Array;
  readonly chunkInit: Float32Array;
  readonly chunkType: Uint8Array;
  readonly chunkKnown: Uint8Array;
  readonly items: DirtItem[] = [];
  readonly itemsByChunk: number[][];

  initialTotal = 0;
  total = 0;
  itemsCollected = 0;
  cellsCleaned = 0;
  texVersion = 0;
  chunkVersion = 0;
  /** Items removed since the scene last consumed them. */
  removed: number[] = [];
  /** Amount of dirt removed this frame (for particles / sound). */
  frameRemoved = 0;
  frameRemovedType = 0;

  private foamActive: number[] = [];
  private touchedChunks = new Set<number>();

  constructor(
    readonly layout: CityLayout,
    readonly city: CityConfig,
    seed: number,
  ) {
    this.gw = Math.ceil(layout.width / CELL);
    this.gh = Math.ceil(layout.depth / CELL);
    const n = this.gw * this.gh;
    this.surface = new Uint8Array(n);
    this.dirt = new Float32Array(n);
    this.initialDirt = new Float32Array(n);
    this.type = new Uint8Array(n);
    this.foam = new Float32Array(n);
    this.tex = new Uint8Array(n * 4);
    this.cw = Math.ceil(this.gw / CHUNK);
    this.ch = Math.ceil(this.gh / CHUNK);
    const nc = this.cw * this.ch;
    this.chunkDirt = new Float32Array(nc);
    this.chunkInit = new Float32Array(nc);
    this.chunkType = new Uint8Array(nc);
    this.chunkKnown = new Uint8Array(nc);
    this.itemsByChunk = Array.from({ length: nc }, () => []);

    this.rasterizeSurface();
    this.generateDirt(new Rng(seed ^ 0x5eed));
    this.buildTexture();
  }

  // ---------------------------------------------------------------------------

  cellIndex(x: number, z: number) {
    const i = Math.floor(x / CELL);
    const j = Math.floor(z / CELL);
    if (i < 0 || j < 0 || i >= this.gw || j >= this.gh) return -1;
    return j * this.gw + i;
  }

  surfaceAt(x: number, z: number) {
    const c = this.cellIndex(x, z);
    return c < 0 ? SURF_NONE : this.surface[c];
  }

  chunkOfCell(c: number) {
    const i = c % this.gw;
    const j = (c / this.gw) | 0;
    return ((j / CHUNK) | 0) * this.cw + ((i / CHUNK) | 0);
  }

  get cleanRatio() {
    return this.initialTotal > 0 ? 1 - this.total / this.initialTotal : 1;
  }

  private fillRect(r: Rect, v: number) {
    const i0 = Math.max(0, Math.floor(r.x0 / CELL + 0.001));
    const i1 = Math.min(this.gw - 1, Math.ceil(r.x1 / CELL - 0.001) - 1);
    const j0 = Math.max(0, Math.floor(r.z0 / CELL + 0.001));
    const j1 = Math.min(this.gh - 1, Math.ceil(r.z1 / CELL - 0.001) - 1);
    for (let j = j0; j <= j1; j++) this.surface.fill(v, j * this.gw + i0, j * this.gw + i1 + 1);
  }

  private rasterizeSurface() {
    this.surface.fill(SURF_ROAD);
    const sw = this.city.grid.sidewalk;
    for (const b of this.layout.blocks) {
      this.fillRect(b, SURF_SIDEWALK);
      const inner = { x0: b.x0 + sw, x1: b.x1 - sw, z0: b.z0 + sw, z1: b.z1 - sw };
      if (b.kind === 'buildings') this.fillRect(inner, SURF_LOT);
      else if (b.kind === 'park') this.fillRect(inner, SURF_GRASS);
      else if (b.kind === 'canal') this.fillRect(inner, SURF_WATER);
    }
    for (const f of this.layout.fillers) this.fillRect(f, SURF_GRASS);
  }

  private generateDirt(rng: Rng) {
    const { gw, gh } = this;
    const noise = makeNoise2D(rng.int(0, 1e9));
    const blocked = new Uint8Array(gw * gh);
    for (const r of this.layout.noDirt) {
      const i0 = Math.max(0, Math.floor(r.x0 / CELL));
      const i1 = Math.min(gw - 1, Math.floor(r.x1 / CELL));
      const j0 = Math.max(0, Math.floor(r.z0 / CELL));
      const j1 = Math.min(gh - 1, Math.floor(r.z1 / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * gw + i] = 1;
    }

    const roadCells: number[] = [];
    for (let c = 0; c < gw * gh; c++) if (this.surface[c] === SURF_ROAD && !blocked[c]) roadCells.push(c);
    const roadArea = roadCells.length * CELL * CELL;
    const targetArea = Math.min(3600, Math.max(2200, roadArea * 0.2));
    const targetCells = Math.floor(targetArea / (CELL * CELL));

    let dirtyCells = 0;
    const paint = (cx: number, cz: number, rx: number, rz: number, t: number, strength: number) => {
      const i0 = Math.max(0, Math.floor((cx - rx) / CELL));
      const i1 = Math.min(gw - 1, Math.floor((cx + rx) / CELL));
      const j0 = Math.max(0, Math.floor((cz - rz) / CELL));
      const j1 = Math.min(gh - 1, Math.floor((cz + rz) / CELL));
      const ns = t === 1 ? 0.55 : 0.32;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const c = j * gw + i;
          if (this.surface[c] !== SURF_ROAD || blocked[c]) continue;
          const x = (i + 0.5) * CELL;
          const z = (j + 0.5) * CELL;
          const dx = (x - cx) / rx;
          const dz = (z - cz) / rz;
          const d = Math.sqrt(dx * dx + dz * dz);
          const v = 1 - d + (noise(x * ns + t * 17, z * ns) - 0.5) * 0.9;
          if (v < 0.12) continue;
          const amount = Math.min(1, (0.45 + v * 0.9) * strength);
          if (this.dirt[c] === 0) dirtyCells++;
          if (amount > this.dirt[c]) {
            this.dirt[c] = amount;
            this.type[c] = t;
          }
        }
      }
    };

    const weights = this.city.dirt;
    const segs = this.layout.segments;
    let guard = 0;
    while (dirtyCells < targetCells && guard++ < 5000) {
      const t = rng.weighted(weights);
      const def = DIRT_TYPES[t];
      if (t !== 1 && rng.chance(0.3) && segs.length) {
        // Gutter strip along a curb — leaves and trash collect there.
        const s = rng.pick(segs);
        const r = s.rect;
        const side = rng.chance(0.5) ? -1 : 1;
        const len = s.horizontal ? r.x1 - r.x0 : r.z1 - r.z0;
        const stripLen = Math.min(len, rng.range(12, 34));
        const start = rng.range(0, Math.max(0.01, len - stripLen));
        const off = side * (s.width / 2 - rng.range(0.9, 1.6));
        const halfW = rng.range(0.9, 1.6);
        const cxm = s.horizontal ? r.x0 + start + stripLen / 2 : (r.x0 + r.x1) / 2 + off;
        const czm = s.horizontal ? (r.z0 + r.z1) / 2 + off : r.z0 + start + stripLen / 2;
        paint(cxm, czm, s.horizontal ? stripLen / 2 : halfW, s.horizontal ? halfW : stripLen / 2, t, rng.range(0.8, 1.1));
      } else {
        const c = rng.pick(roadCells);
        const x = ((c % gw) + 0.5) * CELL;
        const z = (((c / gw) | 0) + 0.5) * CELL;
        const r = rng.range(def.patchRadius[0], def.patchRadius[1]);
        const aspect = rng.range(0.6, 1.5);
        paint(x, z, r * aspect, r / aspect, t, rng.range(0.85, 1.15));
      }
    }

    // Totals, chunk data, dominant type per chunk.
    const typeCounts = new Uint16Array(this.cw * this.ch * 3);
    for (let c = 0; c < gw * gh; c++) {
      const d = this.dirt[c];
      if (d <= 0) continue;
      this.initialDirt[c] = d;
      this.total += d;
      const k = this.chunkOfCell(c);
      this.chunkDirt[k] += d;
      typeCounts[k * 3 + this.type[c]]++;
    }
    this.initialTotal = this.total;
    this.chunkInit.set(this.chunkDirt);
    for (let k = 0; k < this.cw * this.ch; k++) {
      const a = typeCounts[k * 3];
      const b = typeCounts[k * 3 + 1];
      const d = typeCounts[k * 3 + 2];
      this.chunkType[k] = b >= a && b >= d ? 1 : d >= a ? 2 : 0;
    }

    // Visible items.
    const budgets = [5200, 320, 700, 700, 700, 350];
    const counts = [0, 0, 0, 0, 0, 0];
    const addItem = (kind: number, c: number, scale: number) => {
      if (counts[kind] >= budgets[kind]) return;
      counts[kind]++;
      const i = c % gw;
      const j = (c / gw) | 0;
      const item: DirtItem = {
        kind,
        x: (i + rng.next()) * CELL,
        z: (j + rng.next()) * CELL,
        rot: rng.range(0, Math.PI * 2),
        scale,
        variant: rng.int(0, 7),
        cell: c,
        hideAt: Math.min(this.dirt[c] * 0.8, rng.range(0.18, 0.5)),
        alive: true,
      };
      const idx = this.items.push(item) - 1;
      this.itemsByChunk[this.chunkOfCell(c)].push(idx);
    };
    for (let c = 0; c < gw * gh; c++) {
      const d = this.dirt[c];
      if (d < 0.3) continue;
      const t = this.type[c];
      if (t === 0) {
        const n = rng.next() < 0.55 * d ? (rng.next() < 0.35 ? 2 : 1) : 0;
        for (let k = 0; k < n; k++) addItem(ITEM_LEAF, c, rng.range(0.8, 1.3));
        if (d > 0.8 && rng.chance(0.03)) addItem(ITEM_PILE, c, rng.range(0.7, 1.3));
      } else if (t === 2) {
        if (rng.chance(0.13 * d)) {
          const kind = rng.pick([ITEM_BOTTLE, ITEM_CAN, ITEM_CAN, ITEM_PAPER, ITEM_PAPER, ITEM_BOX]);
          addItem(kind, c, rng.range(0.85, 1.25));
        }
      }
    }
  }

  private encodeCell(c: number) {
    const o = c * 4;
    const d = this.dirt[c];
    const t = this.tex;
    t[o] = d > 0 ? Math.min(255, 40 + d * 215) : 0;
    t[o + 1] = this.type[c] * 127;
    t[o + 2] = Math.min(255, (this.foam[c] / FOAM_TIME) * 255 * 1.4);
    t[o + 3] = this.surface[c] === SURF_ROAD ? 255 : 0;
  }

  private buildTexture() {
    for (let c = 0; c < this.gw * this.gh; c++) this.encodeCell(c);
    this.texVersion++;
  }

  // ---------------------------------------------------------------------------

  private applyClean(c: number, amount: number, stats: VehicleStats) {
    const d = this.dirt[c];
    if (d <= 0) return;
    const t = this.type[c];
    const def = DIRT_TYPES[t];
    const typeMult = def.boostedBy === 'oil' ? stats.oilMult : stats.debrisMult;
    let nd = d - (amount * stats.cleanMult * typeMult) / def.toughness;
    if (nd < CLEAN_EPS) {
      nd = 0;
      this.cellsCleaned++;
    }
    const delta = d - nd;
    this.dirt[c] = nd;
    this.total -= delta;
    const k = this.chunkOfCell(c);
    this.chunkDirt[k] -= delta;
    if (this.chunkDirt[k] < 1e-3) this.chunkDirt[k] = 0;
    this.touchedChunks.add(k);
    this.frameRemoved += delta;
    this.frameRemovedType = t;
    this.encodeCell(c);
  }

  /**
   * Iterate the cells covered by a rectangle in the vehicle's local frame.
   * Local frame: +z forward, +x left.
   */
  private forEachCellInLocalRect(
    px: number,
    pz: number,
    heading: number,
    xMin: number,
    xMax: number,
    zMin: number,
    zMax: number,
    fn: (c: number, lx: number, lz: number) => void,
  ) {
    const s = Math.sin(heading);
    const co = Math.cos(heading);
    // Local basis: forward f = (s, co), left l = (co, -s)
    const corners = [
      [xMin, zMin],
      [xMax, zMin],
      [xMin, zMax],
      [xMax, zMax],
    ];
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const [lx, lz] of corners) {
      const wx = px + co * lx + s * lz;
      const wz = pz - s * lx + co * lz;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz;
      if (wz > maxZ) maxZ = wz;
    }
    const i0 = Math.max(0, Math.floor(minX / CELL));
    const i1 = Math.min(this.gw - 1, Math.floor(maxX / CELL));
    const j0 = Math.max(0, Math.floor(minZ / CELL));
    const j1 = Math.min(this.gh - 1, Math.floor(maxZ / CELL));
    for (let j = j0; j <= j1; j++) {
      const wz = (j + 0.5) * CELL - pz;
      for (let i = i0; i <= i1; i++) {
        const wx = (i + 0.5) * CELL - px;
        const lx = co * wx - s * wz;
        const lz = s * wx + co * wz;
        if (lx < xMin || lx > xMax || lz < zMin || lz > zMax) continue;
        fn(j * this.gw + i, lx, lz);
      }
    }
  }

  brush(dt: number, px: number, pz: number, heading: number, stats: VehicleStats) {
    const hw = stats.brushWidth / 2;
    const rate = BASE_RATE * stats.brushRate * dt;
    this.forEachCellInLocalRect(px, pz, heading, -hw, hw, 1.6, 4.0, (c) => {
      if (this.dirt[c] <= 0) return;
      const foamMult = this.foam[c] > 0 ? stats.foamPower : 1;
      this.applyClean(c, rate * foamMult, stats);
    });
  }

  spray(px: number, pz: number, heading: number, stats: VehicleStats) {
    const near = 3.6;
    const far = near + stats.foamRange;
    const w0 = 1.0;
    const w1 = stats.foamWidth / 2;
    this.forEachCellInLocalRect(px, pz, heading, -w1, w1, near, far, (c, lx, lz) => {
      if (this.surface[c] !== SURF_ROAD) return;
      const t = (lz - near) / (far - near);
      if (Math.abs(lx) > w0 + (w1 - w0) * t) return;
      if (this.foam[c] <= 0) this.foamActive.push(c);
      this.foam[c] = FOAM_TIME;
      this.encodeCell(c);
    });
  }

  /** Per-frame: foam decay and gentle foam-only cleaning. */
  update(dt: number, stats: VehicleStats) {
    if (this.foamActive.length) {
      const soak = dt * 0.1 * stats.foamPower;
      let w = 0;
      for (let k = 0; k < this.foamActive.length; k++) {
        const c = this.foamActive[k];
        const f = this.foam[c] - dt;
        if (f > 0) {
          this.foam[c] = f;
          if (this.dirt[c] > 0) this.applyClean(c, soak, stats);
          else this.encodeCell(c);
          this.foamActive[w++] = c;
        } else {
          this.foam[c] = 0;
          this.encodeCell(c);
        }
      }
      this.foamActive.length = w;
      this.texVersion++;
    }
  }

  /** Check items in touched chunks; mark removed ones. Call once per frame after cleaning. */
  collectItems() {
    if (this.touchedChunks.size === 0) return;
    for (const k of this.touchedChunks) {
      const list = this.itemsByChunk[k];
      for (let n = 0; n < list.length; n++) {
        const idx = list[n];
        const it = this.items[idx];
        if (!it.alive) continue;
        if (this.dirt[it.cell] < it.hideAt) {
          it.alive = false;
          this.itemsCollected++;
          this.removed.push(idx);
        }
      }
    }
    this.touchedChunks.clear();
    this.texVersion++;
    this.chunkVersion++;
  }

  /** Mark chunks within radius as known (radar). Returns number of dirty chunks inside. */
  scan(px: number, pz: number, radius: number) {
    const cs = CHUNK * CELL;
    const r2 = radius * radius;
    const ci0 = Math.max(0, Math.floor((px - radius) / cs));
    const ci1 = Math.min(this.cw - 1, Math.floor((px + radius) / cs));
    const cj0 = Math.max(0, Math.floor((pz - radius) / cs));
    const cj1 = Math.min(this.ch - 1, Math.floor((pz + radius) / cs));
    let dirty = 0;
    for (let j = cj0; j <= cj1; j++) {
      for (let i = ci0; i <= ci1; i++) {
        const dx = (i + 0.5) * cs - px;
        const dz = (j + 0.5) * cs - pz;
        if (dx * dx + dz * dz > r2) continue;
        const k = j * this.cw + i;
        if (!this.chunkKnown[k]) {
          this.chunkKnown[k] = 1;
          this.chunkVersion++;
        }
        if (this.chunkDirt[k] > 0.5) dirty++;
      }
    }
    return dirty;
  }

  /** Nearest dirty chunk centre within radius, or null. */
  nearestDirt(px: number, pz: number, radius: number): { x: number; z: number; d: number } | null {
    const cs = CHUNK * CELL;
    let best: { x: number; z: number; d: number } | null = null;
    const ci0 = Math.max(0, Math.floor((px - radius) / cs));
    const ci1 = Math.min(this.cw - 1, Math.floor((px + radius) / cs));
    const cj0 = Math.max(0, Math.floor((pz - radius) / cs));
    const cj1 = Math.min(this.ch - 1, Math.floor((pz + radius) / cs));
    for (let j = cj0; j <= cj1; j++) {
      for (let i = ci0; i <= ci1; i++) {
        const k = j * this.cw + i;
        if (this.chunkDirt[k] < 0.5) continue;
        const x = (i + 0.5) * cs;
        const z = (j + 0.5) * cs;
        const d = Math.hypot(x - px, z - pz);
        if (d < 6 || d > radius) continue;
        if (!best || d < best.d) best = { x, z, d };
      }
    }
    return best;
  }

  /** Debug helper: clean everything down to the given ratio. */
  debugCleanTo(ratio: number) {
    const target = this.initialTotal * (1 - ratio);
    for (let c = 0; c < this.dirt.length && this.total > target; c++) {
      const d = this.dirt[c];
      if (d <= 0) continue;
      this.dirt[c] = 0;
      this.total -= d;
      const k = this.chunkOfCell(c);
      this.chunkDirt[k] = Math.max(0, this.chunkDirt[k] - d);
      this.touchedChunks.add(k);
      this.encodeCell(c);
    }
    this.collectItems();
  }
}
