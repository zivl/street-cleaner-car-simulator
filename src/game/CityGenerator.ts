import type { CityConfig, FacadeStyle, PropKind, RoofStyle } from '../data/cities';
import { Rng } from './random';

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export type BlockKind = 'buildings' | 'park' | 'canal' | 'plaza';

export interface Block extends Rect {
  kind: BlockKind;
}

export interface Building extends Rect {
  height: number;
  floors: number;
  color: string;
  facade: FacadeStyle;
  roof: RoofStyle;
  /** Which sides face a street: +x, -x, +z, -z */
  seed: number;
}

export interface Prop {
  kind: 'lamp' | 'tree' | PropKind;
  x: number;
  z: number;
  rot: number;
}

export interface ParkedCar {
  x: number;
  z: number;
  rot: number;
  color: string;
  bus: boolean;
}

export interface Barrier {
  x: number;
  z: number;
  rot: number;
  kind: 'cone' | 'barrier';
}

export interface RoadNode {
  id: number;
  x: number;
  z: number;
  edges: number[]; // neighbour node ids
}

export interface RoadSegment {
  a: number;
  b: number;
  horizontal: boolean;
  width: number;
  rect: Rect;
}

export interface Pickup {
  kind: 'fuel' | 'repair';
  x: number;
  z: number;
}

export interface CityLayout {
  width: number;
  depth: number;
  border: number;
  xRoads: { x0: number; x1: number; width: number }[];
  zRoads: { z0: number; z1: number; width: number }[];
  blocks: Block[];
  fillers: Rect[];
  buildings: Building[];
  props: Prop[];
  parked: ParkedCar[];
  barriers: Barrier[];
  nodes: RoadNode[];
  segments: RoadSegment[];
  pickups: Pickup[];
  spawn: { x: number; z: number; heading: number };
  /** Areas where dirt must not spawn (parked cars, barriers, spawn). */
  noDirt: Rect[];
}

const BORDER = 26;

export function generateCity(cfg: CityConfig, seed: number): CityLayout {
  const rng = new Rng(seed);
  const g = cfg.grid;
  const nbx = rng.int(g.blocksX[0], g.blocksX[1]);
  const nbz = rng.int(g.blocksZ[0], g.blocksZ[1]);

  const roadW = (k: number, n: number) => (k === 0 || k === n || k % g.avenueEvery !== 0 ? g.roadWidth : g.avenueWidth);

  // Lay out road lines along x and z.
  const xRoads: CityLayout['xRoads'] = [];
  let x = 0;
  for (let k = 0; k <= nbx; k++) {
    const w = roadW(k, nbx);
    xRoads.push({ x0: x, x1: x + w, width: w });
    x += w;
    if (k < nbx) x += Math.round(rng.range(g.blockSize[0], g.blockSize[1]));
  }
  const zRoads: CityLayout['zRoads'] = [];
  let z = 0;
  for (let k = 0; k <= nbz; k++) {
    const w = roadW(k, nbz);
    zRoads.push({ z0: z, z1: z + w, width: w });
    z += w;
    if (k < nbz) z += Math.round(rng.range(g.blockSize[0], g.blockSize[1]));
  }
  const width = x;
  const depth = z;

  // Intersection nodes.
  const nodes: RoadNode[] = [];
  const nodeId = (i: number, j: number) => j * (nbx + 1) + i;
  for (let j = 0; j <= nbz; j++) {
    for (let i = 0; i <= nbx; i++) {
      const xr = xRoads[i];
      const zr = zRoads[j];
      nodes.push({ id: nodeId(i, j), x: (xr.x0 + xr.x1) / 2, z: (zr.z0 + zr.z1) / 2, edges: [] });
    }
  }

  // Candidate segments.
  interface Seg {
    a: number;
    b: number;
    horizontal: boolean;
    outer: boolean;
    rect: Rect;
    width: number;
    removed: boolean;
  }
  const segs: Seg[] = [];
  for (let j = 0; j <= nbz; j++) {
    for (let i = 0; i < nbx; i++) {
      const zr = zRoads[j];
      segs.push({
        a: nodeId(i, j),
        b: nodeId(i + 1, j),
        horizontal: true,
        outer: j === 0 || j === nbz,
        rect: { x0: xRoads[i].x1, x1: xRoads[i + 1].x0, z0: zr.z0, z1: zr.z1 },
        width: zr.width,
        removed: false,
      });
    }
  }
  for (let i = 0; i <= nbx; i++) {
    for (let j = 0; j < nbz; j++) {
      const xr = xRoads[i];
      segs.push({
        a: nodeId(i, j),
        b: nodeId(i, j + 1),
        horizontal: false,
        outer: i === 0 || i === nbx,
        rect: { x0: xr.x0, x1: xr.x1, z0: zRoads[j].z1, z1: zRoads[j + 1].z0 },
        width: xr.width,
        removed: false,
      });
    }
  }

  const connected = () => {
    const adj: number[][] = nodes.map(() => []);
    for (const s of segs) {
      if (s.removed) continue;
      adj[s.a].push(s.b);
      adj[s.b].push(s.a);
    }
    const seen = new Uint8Array(nodes.length);
    const stack = [0];
    seen[0] = 1;
    let count = 1;
    while (stack.length) {
      const n = stack.pop()!;
      for (const m of adj[n]) {
        if (!seen[m]) {
          seen[m] = 1;
          count++;
          stack.push(m);
        }
      }
    }
    // Every node must still have at least one edge and be reachable.
    return count === nodes.length;
  };

  for (const s of segs) {
    if (s.outer || s.width > g.roadWidth) continue; // keep ring road and avenues
    if (!rng.chance(g.removeChance)) continue;
    s.removed = true;
    if (!connected()) s.removed = false;
  }

  const segments: RoadSegment[] = [];
  for (const s of segs) {
    if (s.removed) continue;
    nodes[s.a].edges.push(s.b);
    nodes[s.b].edges.push(s.a);
    segments.push({ a: s.a, b: s.b, horizontal: s.horizontal, width: s.width, rect: s.rect });
  }
  const fillers = segs.filter((s) => s.removed).map((s) => s.rect);

  // Blocks.
  const blocks: Block[] = [];
  const canalRow = cfg.nature.canalChance > 0 ? rng.int(1, nbz - 2) : -1;
  for (let j = 0; j < nbz; j++) {
    for (let i = 0; i < nbx; i++) {
      const r: Rect = { x0: xRoads[i].x1, x1: xRoads[i + 1].x0, z0: zRoads[j].z1, z1: zRoads[j + 1].z0 };
      let kind: BlockKind = 'buildings';
      if (j === canalRow && rng.chance(0.85)) kind = 'canal';
      else if (rng.chance(cfg.nature.canalChance * 0.3)) kind = 'canal';
      else if (rng.chance(cfg.nature.parkChance)) kind = 'park';
      else if (rng.chance(0.04)) kind = 'plaza';
      blocks.push({ ...r, kind });
    }
  }

  // Buildings.
  const sw = g.sidewalk;
  const buildings: Building[] = [];
  const bcfg = cfg.buildings;
  const makeBuilding = (r: Rect, allowTower = true) => {
    const tower = allowTower && rng.chance(bcfg.towerChance);
    let floors = rng.int(bcfg.floors[0], bcfg.floors[1]);
    if (tower) floors = Math.round(floors * rng.range(1.6, 2.4));
    const facade = rng.pick(bcfg.facades);
    const roof = rng.pick(bcfg.roofs);
    buildings.push({
      ...r,
      floors,
      height: floors * bcfg.floorHeight + (roof === 'flat' ? 0.6 : 0),
      color: rng.pick(bcfg.colors),
      facade,
      roof,
      seed: rng.int(0, 1_000_000),
    });
  };

  const subdivide = (r: Rect, out: Rect[], depth = 0) => {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const max = bcfg.lotSize;
    if ((w <= max && d <= max) || depth > 8) {
      out.push(r);
      return;
    }
    const t = rng.range(0.35, 0.65);
    if (w >= d) {
      const xm = Math.round(r.x0 + w * t);
      subdivide({ ...r, x1: xm }, out, depth + 1);
      subdivide({ ...r, x0: xm }, out, depth + 1);
    } else {
      const zm = Math.round(r.z0 + d * t);
      subdivide({ ...r, z1: zm }, out, depth + 1);
      subdivide({ ...r, z0: zm }, out, depth + 1);
    }
  };

  for (const b of blocks) {
    if (b.kind !== 'buildings') continue;
    const inner: Rect = { x0: b.x0 + sw, x1: b.x1 - sw, z0: b.z0 + sw, z1: b.z1 - sw };
    const lots: Rect[] = [];
    subdivide(inner, lots);
    for (const lot of lots) {
      const touches = lot.x0 <= inner.x0 + 0.1 || lot.x1 >= inner.x1 - 0.1 || lot.z0 <= inner.z0 + 0.1 || lot.z1 >= inner.z1 - 0.1;
      if (!touches) {
        if (rng.chance(0.5)) makeBuilding(shrink(lot, 1.5), false);
        continue;
      }
      makeBuilding(shrink(lot, 0.15));
    }
  }

  // Outer border buildings (skyline around the playable area).
  const outerLots: Rect[] = [];
  const bw = BORDER - sw;
  const edge = (r: Rect) => subdivide(r, outerLots);
  edge({ x0: -BORDER, x1: width + BORDER, z0: -BORDER, z1: -sw });
  edge({ x0: -BORDER, x1: width + BORDER, z0: depth + sw, z1: depth + BORDER });
  edge({ x0: -BORDER, x1: -sw, z0: -sw, z1: depth + sw });
  edge({ x0: width + sw, x1: width + BORDER, z0: -sw, z1: depth + sw });
  for (const lot of outerLots) {
    if (lot.x1 - lot.x0 < 3 || lot.z1 - lot.z0 < 3) continue;
    makeBuilding(shrink(lot, 0.15));
  }
  void bw;

  // Props along sidewalks.
  const props: Prop[] = [];
  const edgeRuns: { x0: number; z0: number; x1: number; z1: number; nx: number; nz: number }[] = [];
  const addRuns = (r: Rect, inset: number) => {
    edgeRuns.push({ x0: r.x0 + inset, z0: r.z0 + inset, x1: r.x1 - inset, z1: r.z0 + inset, nx: 0, nz: -1 });
    edgeRuns.push({ x0: r.x0 + inset, z0: r.z1 - inset, x1: r.x1 - inset, z1: r.z1 - inset, nx: 0, nz: 1 });
    edgeRuns.push({ x0: r.x0 + inset, z0: r.z0 + inset, x1: r.x0 + inset, z1: r.z1 - inset, nx: -1, nz: 0 });
    edgeRuns.push({ x0: r.x1 - inset, z0: r.z0 + inset, x1: r.x1 - inset, z1: r.z1 - inset, nx: 1, nz: 0 });
  };
  for (const b of blocks) {
    if (b.kind === 'canal') continue;
    addRuns(b, 0.7);
  }
  // Outer sidewalks (inner edge of border ring faces the map).
  edgeRuns.push({ x0: 0, z0: -0.7, x1: width, z1: -0.7, nx: 0, nz: 1 });
  edgeRuns.push({ x0: 0, z0: depth + 0.7, x1: width, z1: depth + 0.7, nx: 0, nz: -1 });
  edgeRuns.push({ x0: -0.7, z0: 0, x1: -0.7, z1: depth, nx: 1, nz: 0 });
  edgeRuns.push({ x0: width + 0.7, z0: 0, x1: width + 0.7, z1: depth, nx: -1, nz: 0 });

  const lampSpacing = 20;
  for (const run of edgeRuns) {
    const len = Math.hypot(run.x1 - run.x0, run.z1 - run.z0);
    const dx = (run.x1 - run.x0) / len;
    const dz = (run.z1 - run.z0) / len;
    const rot = Math.atan2(run.nx, run.nz);
    // Lamps
    for (let s = 4; s < len - 3; s += lampSpacing) {
      props.push({ kind: 'lamp', x: run.x0 + dx * s, z: run.z0 + dz * s, rot });
    }
    // Trees in between lamps
    if (cfg.nature.treeSpacing > 0) {
      for (let s = 4 + cfg.nature.treeSpacing / 2; s < len - 3; s += cfg.nature.treeSpacing) {
        if (Math.abs(((s - 4) % lampSpacing) - 0) < 2.5) continue;
        if (rng.chance(0.75)) {
          const inset = sw * 0.35;
          props.push({ kind: 'tree', x: run.x0 + dx * s - run.nx * inset, z: run.z0 + dz * s - run.nz * inset, rot: rng.range(0, 6.28) });
        }
      }
    }
    // Furniture
    for (let s = 8; s < len - 6; s += rng.range(14, 26)) {
      if (!rng.chance(0.55)) continue;
      const kind = rng.pick(cfg.props);
      const inset = kind === 'bollard' || kind === 'hydrant' ? 0.1 : sw * 0.55;
      props.push({ kind, x: run.x0 + dx * s - run.nx * inset, z: run.z0 + dz * s - run.nz * inset, rot });
    }
  }

  // Parks and plazas: trees and benches.
  const decorateOpen = (r: Rect, park: boolean) => {
    const area = (r.x1 - r.x0) * (r.z1 - r.z0);
    const n = Math.floor(area / (park ? 45 : 120));
    for (let k = 0; k < n; k++) {
      const px = rng.range(r.x0 + 3, r.x1 - 3);
      const pz = rng.range(r.z0 + 3, r.z1 - 3);
      props.push({ kind: park || rng.chance(0.4) ? 'tree' : 'bench', x: px, z: pz, rot: rng.range(0, 6.28) });
    }
  };
  for (const b of blocks) {
    if (b.kind === 'park') decorateOpen(shrink(b, sw), true);
    if (b.kind === 'plaza') decorateOpen(shrink(b, sw), false);
  }
  for (const f of fillers) decorateOpen(f, true);

  // Parked cars and road works along segments.
  const parked: ParkedCar[] = [];
  const barriers: Barrier[] = [];
  const noDirt: Rect[] = [];
  for (const s of segments) {
    const r = s.rect;
    const len = s.horizontal ? r.x1 - r.x0 : r.z1 - r.z0;
    if (len < 16) continue;
    const parkOk = s.width >= 7;
    // Parked cars on one or both sides.
    for (const side of [-1, 1]) {
      if (!parkOk || !rng.chance(0.32)) continue;
      let t = rng.range(5, 12);
      while (t < len - 6) {
        if (rng.chance(0.55)) {
          const bus = rng.chance(cfg.traffic.busChance * 0.5);
          const carLen = bus ? 10 : 4.4;
          if (t + carLen > len - 4) break;
          const along = t + carLen / 2;
          const off = side * (s.width / 2 - 0.95);
          const cx = s.horizontal ? r.x0 + along : (r.x0 + r.x1) / 2 + off;
          const cz = s.horizontal ? (r.z0 + r.z1) / 2 + off : r.z0 + along;
          const rot = s.horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? Math.PI : 0;
          parked.push({ x: cx, z: cz, rot, color: bus ? cfg.traffic.busColor ?? '#ddd' : rng.pick(cfg.traffic.colors), bus });
          const hw = s.horizontal ? carLen / 2 + 0.6 : 1.5;
          const hd = s.horizontal ? 1.5 : carLen / 2 + 0.6;
          noDirt.push({ x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd });
          t += carLen + rng.range(1.2, 3);
        } else {
          t += rng.range(4, 9);
        }
      }
    }
    // Occasional road-works zone.
    if (s.width >= 8 && rng.chance(0.1) && len > 24) {
      const t = rng.range(8, len - 12);
      const side = rng.chance(0.5) ? -1 : 1;
      const off = side * (s.width / 2 - 1.3);
      for (let k = 0; k < 4; k++) {
        const along = t + k * 2;
        const cx = s.horizontal ? r.x0 + along : (r.x0 + r.x1) / 2 + off;
        const cz = s.horizontal ? (r.z0 + r.z1) / 2 + off : r.z0 + along;
        barriers.push({ x: cx, z: cz, rot: s.horizontal ? 0 : Math.PI / 2, kind: k === 0 || k === 3 ? 'cone' : 'barrier' });
      }
      const ax = s.horizontal ? r.x0 + t - 1 : (r.x0 + r.x1) / 2 + off - 1.3;
      const az = s.horizontal ? (r.z0 + r.z1) / 2 + off - 1.3 : r.z0 + t - 1;
      noDirt.push({ x0: ax, z0: az, x1: ax + (s.horizontal ? 8 : 2.6), z1: az + (s.horizontal ? 2.6 : 8) });
    }
  }

  // Spawn at a corner of the ring road.
  const n0 = nodes[nodeId(0, 0)];
  const spawn = { x: n0.x, z: n0.z + 14, heading: 0 };
  noDirt.push({ x0: spawn.x - 5, x1: spawn.x + 5, z0: spawn.z - 8, z1: spawn.z + 8 });
  // Keep the spawn area clear of road works.
  for (let k = barriers.length - 1; k >= 0; k--) {
    const b = barriers[k];
    if (Math.hypot(b.x - spawn.x, b.z - spawn.z) < 40) barriers.splice(k, 1);
  }
  // Remove parked cars near spawn.
  for (let k = parked.length - 1; k >= 0; k--) {
    const p = parked[k];
    if (Math.abs(p.x - spawn.x) < 8 && Math.abs(p.z - spawn.z) < 14) parked.splice(k, 1);
  }

  // Pickups: placed at the middle of random segments far from spawn.
  const pickups: Pickup[] = [];
  const candidates = segments.filter((s) => {
    const cx = (s.rect.x0 + s.rect.x1) / 2;
    const cz = (s.rect.z0 + s.rect.z1) / 2;
    return Math.hypot(cx - spawn.x, cz - spawn.z) > 60;
  });
  const kinds: Pickup['kind'][] = ['fuel', 'fuel', 'fuel', 'repair', 'repair'];
  for (const kind of kinds) {
    if (!candidates.length) break;
    const idx = rng.int(0, candidates.length - 1);
    const s = candidates.splice(idx, 1)[0];
    pickups.push({ kind, x: (s.rect.x0 + s.rect.x1) / 2, z: (s.rect.z0 + s.rect.z1) / 2 });
  }

  return {
    width,
    depth,
    border: BORDER,
    xRoads,
    zRoads,
    blocks,
    fillers,
    buildings,
    props,
    parked,
    barriers,
    nodes,
    segments,
    pickups,
    spawn,
    noDirt,
  };
}

function shrink(r: Rect, m: number): Rect {
  return { x0: r.x0 + m, z0: r.z0 + m, x1: r.x1 - m, z1: r.z1 - m };
}
