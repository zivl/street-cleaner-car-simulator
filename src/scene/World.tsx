import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CityConfig } from '../data/cities';
import type { Game } from '../game/Game';
import type { Building, CityLayout } from '../game/CityGenerator';
import { SURF_ROAD } from '../game/CleaningSystem';
import { Rng } from '../game/random';
import { MeshBuilder } from './geometry';
import {
  barrierGeometry,
  busGeometry,
  carGeometry,
  coneGeometry,
  lampGeometry,
  propGeometry,
  treeGeometry,
} from './propGeometry';
import { FACADE_BAYS, FACADE_FLOORS, asphaltTexture, facadeTextures, grassTexture, neonSignTexture, pavingTexture } from './textures';

type V3 = [number, number, number];

interface Built {
  objects: THREE.Object3D[];
  dispose: () => void;
}

const SIDEWALK_H = 0.15;

function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c;
}

function buildWorld(game: Game, shadows: boolean, density: number): Built {
  const { layout: L, city: cfg, env } = game;
  const objects: THREE.Object3D[] = [];
  const disposables: { dispose: () => void }[] = [];
  const add = <T extends THREE.Object3D>(o: T, cast = false, receive = true) => {
    o.castShadow = cast && shadows;
    o.receiveShadow = receive && shadows;
    objects.push(o);
    return o;
  };
  const mat = <M extends THREE.Material>(m: M) => {
    disposables.push(m);
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => {
    disposables.push(g);
    return g;
  };

  const B = L.border;
  const sw = cfg.grid.sidewalk;

  // --- Ground (asphalt everywhere; blocks sit on top) -------------------------
  {
    const b = new MeshBuilder();
    const ext = B + 400;
    const s = 1 / 7;
    b.quad(
      [-ext, 0, L.depth + ext],
      [L.width + ext, 0, L.depth + ext],
      [L.width + ext, 0, -ext],
      [-ext, 0, -ext],
      '#ffffff',
      [
        [-ext * s, (L.depth + ext) * s],
        [(L.width + ext) * s, (L.depth + ext) * s],
        [(L.width + ext) * s, -ext * s],
        [-ext * s, -ext * s],
      ],
    );
    const m = mat(
      new THREE.MeshStandardMaterial({
        map: asphaltTexture(cfg.palette.asphalt),
        roughness: game.level.weather === 'rain' ? 0.35 : 0.92,
        metalness: game.level.weather === 'rain' ? 0.25 : 0,
      }),
    );
    add(new THREE.Mesh(geo(b.build()), m), false, true);
  }

  // --- Sidewalks, parks, canals ------------------------------------------------
  const paving = new MeshBuilder();
  const grass = new MeshBuilder();
  const water = new MeshBuilder();
  const quay = new MeshBuilder();
  const worldUv = (scale: number) => (_f: number, w: number, h: number) =>
    [
      [0, 0],
      [w / scale, 0],
      [w / scale, h / scale],
      [0, h / scale],
    ] as [number, number][];
  const pUv = worldUv(2);
  const curb = cfg.palette.curb;
  const slab = (x0: number, z0: number, x1: number, z1: number, h = SIDEWALK_H) => {
    if (x1 - x0 <= 0 || z1 - z0 <= 0) return;
    paving.box(x0, 0, z0, x1, h, z1, curb, { uv: pUv, topColor: '#ffffff' });
  };
  const ring = (x0: number, z0: number, x1: number, z1: number, w: number) => {
    slab(x0, z0, x1, z0 + w);
    slab(x0, z1 - w, x1, z1);
    slab(x0, z0 + w, x0 + w, z1 - w);
    slab(x1 - w, z0 + w, x1, z1 - w);
  };
  for (const b of L.blocks) {
    if (b.kind === 'buildings' || b.kind === 'plaza') {
      slab(b.x0, b.z0, b.x1, b.z1);
    } else if (b.kind === 'park') {
      ring(b.x0, b.z0, b.x1, b.z1, sw);
      grass.box(b.x0 + sw, 0, b.z0 + sw, b.x1 - sw, SIDEWALK_H + 0.05, b.z1 - sw, '#ffffff', { uv: worldUv(6) });
    } else if (b.kind === 'canal') {
      ring(b.x0, b.z0, b.x1, b.z1, sw);
      const x0 = b.x0 + sw;
      const z0 = b.z0 + sw;
      const x1 = b.x1 - sw;
      const z1 = b.z1 - sw;
      const wy = -0.9;
      water.quad([x0, wy, z1], [x1, wy, z1], [x1, wy, z0], [x0, wy, z0], '#ffffff');
      const stone = '#6f6a60';
      // Inner quay walls facing the water.
      quay.quad([x0, -1.2, z0], [x1, -1.2, z0], [x1, SIDEWALK_H, z0], [x0, SIDEWALK_H, z0], stone);
      quay.quad([x1, -1.2, z1], [x0, -1.2, z1], [x0, SIDEWALK_H, z1], [x1, SIDEWALK_H, z1], stone);
      quay.quad([x0, -1.2, z1], [x0, -1.2, z0], [x0, SIDEWALK_H, z0], [x0, SIDEWALK_H, z1], stone);
      quay.quad([x1, -1.2, z0], [x1, -1.2, z1], [x1, SIDEWALK_H, z1], [x1, SIDEWALK_H, z0], stone);
      // Railings.
      const rail = '#2a2d30';
      const rh = 1.0;
      quay.box(x0 - 0.05, rh - 0.05, z0 - 0.05, x1 + 0.05, rh + 0.05, z0 + 0.05, rail);
      quay.box(x0 - 0.05, rh - 0.05, z1 - 0.05, x1 + 0.05, rh + 0.05, z1 + 0.05, rail);
      quay.box(x0 - 0.05, rh - 0.05, z0, x0 + 0.05, rh + 0.05, z1, rail);
      quay.box(x1 - 0.05, rh - 0.05, z0, x1 + 0.05, rh + 0.05, z1, rail);
      for (let x = x0; x <= x1; x += 2.5) {
        quay.box(x - 0.04, 0, z0 - 0.04, x + 0.04, rh, z0 + 0.04, rail);
        quay.box(x - 0.04, 0, z1 - 0.04, x + 0.04, rh, z1 + 0.04, rail);
      }
      for (let z = z0; z <= z1; z += 2.5) {
        quay.box(x0 - 0.04, 0, z - 0.04, x0 + 0.04, rh, z + 0.04, rail);
        quay.box(x1 - 0.04, 0, z - 0.04, x1 + 0.04, rh, z + 0.04, rail);
      }
    }
  }
  for (const f of L.fillers) {
    grass.box(f.x0, 0, f.z0, f.x1, SIDEWALK_H + 0.05, f.z1, '#ffffff', { uv: worldUv(6) });
  }
  // Outer ring sidewalk + ground under border buildings.
  slab(-B, -B, L.width + B, 0);
  slab(-B, L.depth, L.width + B, L.depth + B);
  slab(-B, 0, 0, L.depth);
  slab(L.width, 0, L.width + B, L.depth);

  add(
    new THREE.Mesh(
      geo(paving.build()),
      mat(new THREE.MeshStandardMaterial({ map: pavingTexture(cfg.palette.sidewalk), vertexColors: true, roughness: 0.85 })),
    ),
  );
  if (!grass.empty)
    add(
      new THREE.Mesh(
        geo(grass.build()),
        mat(new THREE.MeshStandardMaterial({ map: grassTexture(cfg.palette.grass), vertexColors: true, roughness: 1 })),
      ),
    );
  if (!water.empty)
    add(
      new THREE.Mesh(
        geo(water.build()),
        mat(new THREE.MeshStandardMaterial({ color: '#2d5f73', roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.92 })),
      ),
      false,
      false,
    );
  if (!quay.empty) add(new THREE.Mesh(geo(quay.build()), mat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }))), true);

  // --- Road markings --------------------------------------------------------------
  {
    const mk = new MeshBuilder();
    const y = 0.012;
    const line = (x0: number, z0: number, x1: number, z1: number, color: string) =>
      mk.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color);
    const markColor = cfg.palette.marking;
    const center = cfg.palette.centerLine;
    for (const s of L.segments) {
      const r = s.rect;
      const avenue = s.width > cfg.grid.roadWidth;
      const len = s.horizontal ? r.x1 - r.x0 : r.z1 - r.z0;
      const mid = s.horizontal ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
      const along = (a0: number, a1: number, off: number, w: number, color: string) => {
        if (s.horizontal) line(r.x0 + a0, mid + off - w / 2, r.x0 + a1, mid + off + w / 2, color);
        else line(mid + off - w / 2, r.z0 + a0, mid + off + w / 2, r.z0 + a1, color);
      };
      const across = (a0: number, a1: number, o0: number, o1: number, color: string) => {
        if (s.horizontal) line(r.x0 + a0, mid + o0, r.x0 + a1, mid + o1, color);
        else line(mid + o0, r.z0 + a0, mid + o1, r.z0 + a1, color);
      };
      const cw = 3.2; // crosswalk length
      const start = cw + 1.2;
      const end = len - cw - 1.2;
      if (avenue) {
        along(start, end, -0.12, 0.12, center);
        along(start, end, 0.12, 0.12, center);
        for (let a = start; a < end - 3; a += 6) {
          along(a, a + 3, -s.width / 4, 0.12, markColor);
          along(a, a + 3, s.width / 4, 0.12, markColor);
        }
      } else {
        for (let a = start; a < end - 2; a += 5) along(a, a + 2.6, 0, 0.13, center);
      }
      // Crosswalk stripes and stop lines at both ends.
      if (len > 14) {
        const hw = s.width / 2 - 0.4;
        for (const [c0, sign] of [
          [0.6, 1],
          [len - 0.6 - cw, -1],
        ] as [number, number][]) {
          for (let o = -hw; o < hw - 0.3; o += 1.0) across(c0, c0 + cw, o, o + 0.5, markColor);
          const stop = sign > 0 ? c0 + cw + 0.6 : c0 - 0.9;
          across(stop, stop + 0.3, sign > 0 ? -hw : 0, sign > 0 ? 0 : hw, markColor);
        }
      }
    }
    add(
      new THREE.Mesh(
        geo(mk.build()),
        mat(
          new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.6,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          }),
        ),
      ),
      false,
      true,
    );
  }

  // --- Buildings -------------------------------------------------------------------
  buildBuildings(game, L, cfg, add, mat, geo);

  // --- Instanced props --------------------------------------------------------------
  const rng = new Rng(game.level.seed ^ 0xbeef);
  const byKind = new Map<string, { x: number; z: number; rot: number }[]>();
  for (const p of L.props) {
    if (p.kind !== 'lamp' && density < 1 && rng.next() > density) continue;
    let arr = byKind.get(p.kind);
    if (!arr) byKind.set(p.kind, (arr = []));
    arr.push(p);
  }
  const dummy = new THREE.Object3D();
  const instanced = (g: THREE.BufferGeometry, m: THREE.Material, items: { x: number; z: number; rot: number }[], opts: { y?: number; scale?: (i: number) => number; cast?: boolean } = {}) => {
    const mesh = new THREE.InstancedMesh(geo(g), m, Math.max(1, items.length));
    mesh.count = items.length;
    items.forEach((it, i) => {
      const s = opts.scale ? opts.scale(i) : 1;
      dummy.position.set(it.x, opts.y ?? SIDEWALK_H, it.z);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    add(mesh, opts.cast ?? true, false);
    return mesh;
  };
  const vcMat = mat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));

  const lamps = byKind.get('lamp') ?? [];
  const lampGeo = lampGeometry(cfg.lampStyle);
  instanced(lampGeo.body, vcMat, lamps);
  const bulbMat = mat(
    new THREE.MeshStandardMaterial({
      color: '#fff3d0',
      emissive: '#ffd89a',
      emissiveIntensity: env.lampGlow,
      roughness: 0.4,
    }),
  );
  instanced(lampGeo.bulb, bulbMat, lamps, { cast: false });

  const trees = byKind.get('tree') ?? [];
  const treeMat = mat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
  instanced(treeGeometry(cfg.nature.tree), treeMat, trees, { scale: () => 0.8 + rng.next() * 0.45 });

  for (const kind of cfg.props) {
    const items = byKind.get(kind);
    if (!items?.length) continue;
    const m =
      kind === 'vending'
        ? mat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: '#6fb7ff', emissiveIntensity: env.lampGlow * 0.15 }))
        : vcMat;
    instanced(propGeometry(kind), m, items);
  }
  const benches = byKind.get('bench');
  if (benches?.length && !cfg.props.includes('bench')) instanced(propGeometry('bench'), vcMat, benches);

  // Parked cars.
  const cars = L.parked.filter((c) => !c.bus);
  const buses = L.parked.filter((c) => c.bus);
  const paintMat = mat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 }));
  const tint = (mesh: THREE.InstancedMesh, list: { color: string }[]) => {
    list.forEach((c, i) => mesh.setColorAt(i, new THREE.Color(c.color)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  if (cars.length) tint(instanced(carGeometry(), paintMat, cars, { y: 0 }), cars);
  if (buses.length) tint(instanced(busGeometry(), paintMat, buses, { y: 0 }), buses);

  // Road works.
  const cones = L.barriers.filter((b) => b.kind === 'cone');
  const bars = L.barriers.filter((b) => b.kind === 'barrier');
  if (cones.length) instanced(coneGeometry(), vcMat, cones, { y: 0 });
  if (bars.length) instanced(barrierGeometry(), vcMat, bars, { y: 0 });

  return {
    objects,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

function buildBuildings(
  game: Game,
  L: CityLayout,
  cfg: CityConfig,
  add: (o: THREE.Object3D, cast?: boolean, receive?: boolean) => THREE.Object3D,
  mat: <M extends THREE.Material>(m: M) => M,
  geo: <T extends THREE.BufferGeometry>(g: T) => T,
) {
  const env = game.env;
  const bcfg = cfg.buildings;
  const facades = new Map<string, MeshBuilder>();
  const plain = new MeshBuilder();
  const neon = new MeshBuilder();
  const bayW = 3;
  const fh = bcfg.floorHeight;
  const roofColor = bcfg.roofColor;
  const awningColors = ['#c0392b', '#1f6f8b', '#2e7d32', '#e0a526', '#6a1b9a', '#37474f'];

  const facadeUv = (b: Building) => {
    const uOff = (b.seed % FACADE_BAYS) / FACADE_BAYS;
    const vOff = ((b.seed >> 3) % FACADE_FLOORS) / FACADE_FLOORS;
    return (_face: number, w: number, h: number): [number, number][] => {
      const bays = Math.max(1, Math.round(w / bayW));
      const u1 = uOff + bays / FACADE_BAYS;
      const v1 = vOff + h / fh / FACADE_FLOORS;
      return [
        [uOff, vOff],
        [u1, vOff],
        [u1, v1],
        [uOff, v1],
      ];
    };
  };

  const streetSide = (b: Building) => {
    // Which sides (0:+x 1:-x 2:+z 3:-z) face a road.
    const probe = cfg.grid.sidewalk + 0.8;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const C = game.cleaning;
    return [
      C.surfaceAt(b.x1 + probe, cz) === SURF_ROAD,
      C.surfaceAt(b.x0 - probe, cz) === SURF_ROAD,
      C.surfaceAt(cx, b.z1 + probe) === SURF_ROAD,
      C.surfaceAt(cx, b.z0 - probe) === SURF_ROAD,
    ];
  };

  const octo = (cx: number, cz: number, r: number, y0: number, y1: number, color: string, seg = 8) => {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0: V3 = [cx + Math.sin(a0) * r, y0, cz + Math.cos(a0) * r];
      const p1: V3 = [cx + Math.sin(a1) * r, y0, cz + Math.cos(a1) * r];
      plain.quad(p0, p1, [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], color);
      plain.tri([cx, y1, cz], [p0[0], y1, p0[2]], [p1[0], y1, p1[2]], color);
    }
  };

  for (const b of L.buildings) {
    const rng = new Rng(b.seed);
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    if (w < 1 || d < 1) continue;
    let fb = facades.get(b.facade);
    if (!fb) facades.set(b.facade, (fb = new MeshBuilder()));
    const h = b.floors * fh;
    fb.box(b.x0, 0, b.z0, b.x1, h, b.z1, b.color, { top: false, uv: facadeUv(b) });
    const inMap = b.x1 > 0 && b.z1 > 0 && b.x0 < L.width && b.z0 < L.depth;
    const sides = inMap ? streetSide(b) : [false, false, false, false];
    const wall = shade(b.color, 0.85);
    const roof = new THREE.Color(roofColor);

    // Plinth
    plain.box(b.x0 - 0.06, 0, b.z0 - 0.06, b.x1 + 0.06, 0.55, b.z1 + 0.06, shade(b.color, 0.6), { top: false });

    // Roof
    switch (b.roof) {
      case 'mansard': {
        const inset = Math.min(1.4, Math.min(w, d) * 0.2);
        const rh = 2.8;
        const t: V3[] = [
          [b.x0 + inset, h + rh, b.z0 + inset],
          [b.x1 - inset, h + rh, b.z0 + inset],
          [b.x1 - inset, h + rh, b.z1 - inset],
          [b.x0 + inset, h + rh, b.z1 - inset],
        ];
        const bt: V3[] = [
          [b.x0, h, b.z0],
          [b.x1, h, b.z0],
          [b.x1, h, b.z1],
          [b.x0, h, b.z1],
        ];
        plain.quad(bt[3], bt[2], t[2], t[3], roof);
        plain.quad(bt[1], bt[0], t[0], t[1], roof);
        plain.quad(bt[2], bt[1], t[1], t[2], roof);
        plain.quad(bt[0], bt[3], t[3], t[0], roof);
        plain.quad(t[3], t[2], t[1], t[0], shade(roofColor, 0.8));
        // Cornice
        plain.box(b.x0 - 0.25, h - 0.3, b.z0 - 0.25, b.x1 + 0.25, h, b.z1 + 0.25, shade(b.color, 0.92));
        // Dormers on street sides
        const dorm = (x: number, z: number) => plain.box(x - 0.5, h + 0.6, z - 0.5, x + 0.5, h + 1.9, z + 0.5, wall, { topColor: roof });
        if (sides[2]) for (let x = b.x0 + 2.5; x < b.x1 - 2; x += 3.2) dorm(x, b.z1 - inset * 0.6);
        if (sides[3]) for (let x = b.x0 + 2.5; x < b.x1 - 2; x += 3.2) dorm(x, b.z0 + inset * 0.6);
        // Chimneys
        for (let k = 0; k < 2; k++) {
          const cx = rng.range(b.x0 + inset + 0.5, b.x1 - inset - 0.5);
          const cz = rng.range(b.z0 + inset + 0.5, b.z1 - inset - 0.5);
          plain.box(cx - 0.4, h + rh - 0.2, cz - 0.25, cx + 0.4, h + rh + 1.1, cz + 0.25, '#b9876a');
        }
        break;
      }
      case 'gable':
      case 'chimney': {
        const alongX = w >= d;
        const span = alongX ? d : w;
        const rh = Math.min(5, span * 0.55);
        const col = roof;
        if (alongX) {
          const zm = (b.z0 + b.z1) / 2;
          plain.quad([b.x1, h, b.z0], [b.x0, h, b.z0], [b.x0, h + rh, zm], [b.x1, h + rh, zm], col);
          plain.quad([b.x0, h, b.z1], [b.x1, h, b.z1], [b.x1, h + rh, zm], [b.x0, h + rh, zm], col);
          plain.tri([b.x0, h, b.z0], [b.x0, h, b.z1], [b.x0, h + rh, zm], wall);
          plain.tri([b.x1, h, b.z1], [b.x1, h, b.z0], [b.x1, h + rh, zm], wall);
        } else {
          const xm = (b.x0 + b.x1) / 2;
          plain.quad([b.x0, h, b.z0], [b.x0, h, b.z1], [xm, h + rh, b.z1], [xm, h + rh, b.z0], col);
          plain.quad([b.x1, h, b.z1], [b.x1, h, b.z0], [xm, h + rh, b.z0], [xm, h + rh, b.z1], col);
          plain.tri([b.x1, h, b.z0], [b.x0, h, b.z0], [xm, h + rh, b.z0], wall);
          plain.tri([b.x0, h, b.z1], [b.x1, h, b.z1], [xm, h + rh, b.z1], wall);
        }
        if (b.roof === 'chimney' || rng.chance(0.3)) {
          const n = rng.int(1, 3);
          for (let k = 0; k < n; k++) {
            const cx = rng.range(b.x0 + 0.6, b.x1 - 0.6);
            const cz = rng.range(b.z0 + 0.6, b.z1 - 0.6);
            plain.box(cx - 0.35, h, cz - 0.35, cx + 0.35, h + rh + 0.9, cz + 0.35, '#8a4b3a', { topColor: '#222' });
          }
        }
        break;
      }
      default: {
        // Flat roof with parapet and rooftop details.
        const ph = 0.6;
        plain.quad([b.x0, h, b.z1], [b.x1, h, b.z1], [b.x1, h, b.z0], [b.x0, h, b.z0], shade(roofColor, 0.9));
        const t = 0.25;
        plain.box(b.x0, h, b.z0, b.x1, h + ph, b.z0 + t, wall);
        plain.box(b.x0, h, b.z1 - t, b.x1, h + ph, b.z1, wall);
        plain.box(b.x0, h, b.z0 + t, b.x0 + t, h + ph, b.z1 - t, wall);
        plain.box(b.x1 - t, h, b.z0 + t, b.x1, h + ph, b.z1 - t, wall);
        const units = rng.int(0, 2);
        for (let k = 0; k < units; k++) {
          const s = rng.range(1, 2.2);
          const cx = rng.range(b.x0 + s + 0.3, b.x1 - s - 0.3);
          const cz = rng.range(b.z0 + s + 0.3, b.z1 - s - 0.3);
          if (cx > b.x0 && cz > b.z0) plain.box(cx - s / 2, h, cz - s / 2, cx + s / 2, h + rng.range(0.8, 1.8), cz + s / 2, '#9a9ea3');
        }
        if (b.roof === 'watertower' && w > 6 && d > 6) {
          const cx = rng.range(b.x0 + 2.5, b.x1 - 2.5);
          const cz = rng.range(b.z0 + 2.5, b.z1 - 2.5);
          for (const [ox, oz] of [
            [-0.9, -0.9],
            [0.9, -0.9],
            [-0.9, 0.9],
            [0.9, 0.9],
          ])
            plain.box(cx + ox - 0.08, h, cz + oz - 0.08, cx + ox + 0.08, h + 2.2, cz + oz + 0.08, '#3b3129');
          octo(cx, cz, 1.4, h + 2.2, h + 5, '#7a5a3c');
          for (let i = 0; i < 8; i++) {
            const a0 = (i / 8) * Math.PI * 2;
            const a1 = ((i + 1) / 8) * Math.PI * 2;
            plain.tri(
              [cx, h + 6.1, cz],
              [cx + Math.sin(a0) * 1.5, h + 5, cz + Math.cos(a0) * 1.5],
              [cx + Math.sin(a1) * 1.5, h + 5, cz + Math.cos(a1) * 1.5],
              '#4b3a2a',
            );
          }
        }
      }
    }

    // Balconies on street faces.
    if (bcfg.balconies && b.floors > 2 && rng.chance(0.6)) {
      const bc = shade(b.color, 1.02);
      for (let f = 1; f < b.floors; f++) {
        const y = f * fh;
        if (sides[2]) plain.box(b.x0 + 0.4, y - 0.1, b.z1, b.x1 - 0.4, y + 0.05, b.z1 + 0.9, bc);
        if (sides[3]) plain.box(b.x0 + 0.4, y - 0.1, b.z0 - 0.9, b.x1 - 0.4, y + 0.05, b.z0, bc);
        if (sides[0]) plain.box(b.x1, y - 0.1, b.z0 + 0.4, b.x1 + 0.9, y + 0.05, b.z1 - 0.4, bc);
        if (sides[1]) plain.box(b.x0 - 0.9, y - 0.1, b.z0 + 0.4, b.x0, y + 0.05, b.z1 - 0.4, bc);
        if (cfg.id === 'tel-aviv') {
          // Solid white balcony railings (Bauhaus style)
          if (sides[2]) plain.box(b.x0 + 0.4, y, b.z1 + 0.8, b.x1 - 0.4, y + 1, b.z1 + 0.9, bc);
          if (sides[3]) plain.box(b.x0 + 0.4, y, b.z0 - 0.9, b.x1 - 0.4, y + 1, b.z0 - 0.8, bc);
        }
      }
    }

    // Awnings / shop fronts.
    if (bcfg.awnings && rng.chance(0.55)) {
      const col = rng.pick(awningColors);
      const y = 2.9;
      if (sides[2]) plain.quad([b.x0 + 0.5, y, b.z1], [b.x0 + 0.5, y - 0.6, b.z1 + 1.4], [b.x1 - 0.5, y - 0.6, b.z1 + 1.4], [b.x1 - 0.5, y, b.z1], col);
      if (sides[3]) plain.quad([b.x1 - 0.5, y, b.z0], [b.x1 - 0.5, y - 0.6, b.z0 - 1.4], [b.x0 + 0.5, y - 0.6, b.z0 - 1.4], [b.x0 + 0.5, y, b.z0], col);
      if (sides[0]) plain.quad([b.x1, y, b.z1 - 0.5], [b.x1 + 1.4, y - 0.6, b.z1 - 0.5], [b.x1 + 1.4, y - 0.6, b.z0 + 0.5], [b.x1, y, b.z0 + 0.5], col);
      if (sides[1]) plain.quad([b.x0, y, b.z0 + 0.5], [b.x0 - 1.4, y - 0.6, b.z0 + 0.5], [b.x0 - 1.4, y - 0.6, b.z1 - 0.5], [b.x0, y, b.z1 - 0.5], col);
    }

    // Neon signs.
    if (bcfg.neon && inMap && rng.chance(0.7)) {
      const row = rng.int(0, 7);
      const v0 = 1 - (row + 1) / 8;
      const v1 = 1 - row / 8;
      const uv: [number, number][] = [
        [0, v0],
        [1, v0],
        [1, v1],
        [0, v1],
      ];
      const y0 = rng.range(4, Math.max(4.5, Math.min(h - 2, 10)));
      const sw2 = Math.min(5, w - 1);
      const sd2 = Math.min(5, d - 1);
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      if (sides[2]) neon.quad([cx - sw2 / 2, y0, b.z1 + 0.15], [cx + sw2 / 2, y0, b.z1 + 0.15], [cx + sw2 / 2, y0 + 1.1, b.z1 + 0.15], [cx - sw2 / 2, y0 + 1.1, b.z1 + 0.15], '#fff', uv);
      if (sides[3]) neon.quad([cx + sw2 / 2, y0, b.z0 - 0.15], [cx - sw2 / 2, y0, b.z0 - 0.15], [cx - sw2 / 2, y0 + 1.1, b.z0 - 0.15], [cx + sw2 / 2, y0 + 1.1, b.z0 - 0.15], '#fff', uv);
      if (sides[0]) neon.quad([b.x1 + 0.15, y0, cz + sd2 / 2], [b.x1 + 0.15, y0, cz - sd2 / 2], [b.x1 + 0.15, y0 + 1.1, cz - sd2 / 2], [b.x1 + 0.15, y0 + 1.1, cz + sd2 / 2], '#fff', uv);
      if (sides[1]) neon.quad([b.x0 - 0.15, y0, cz - sd2 / 2], [b.x0 - 0.15, y0, cz + sd2 / 2], [b.x0 - 0.15, y0 + 1.1, cz + sd2 / 2], [b.x0 - 0.15, y0 + 1.1, cz - sd2 / 2], '#fff', uv);
    }
  }

  for (const [style, fb] of facades) {
    const tex = facadeTextures(style as never);
    const m = mat(
      new THREE.MeshStandardMaterial({
        map: tex.map,
        vertexColors: true,
        emissiveMap: tex.lit,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: env.windowGlow,
        roughness: 0.78,
        metalness: 0.05,
      }),
    );
    add(new THREE.Mesh(geo(fb.build()), m), true, true);
  }
  add(new THREE.Mesh(geo(plain.build()), mat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }))), true, true);
  if (!neon.empty) {
    const nm = mat(
      new THREE.MeshBasicMaterial({
        map: neonSignTexture(),
        color: new THREE.Color(1, 1, 1).multiplyScalar(0.5 + env.windowGlow * 0.9),
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    add(new THREE.Mesh(geo(neon.build()), nm), false, false);
  }
}

export function World({ game, shadows, density }: { game: Game; shadows: boolean; density: number }) {
  const built = useMemo(() => buildWorld(game, shadows, density), [game, shadows, density]);
  useEffect(() => () => built.dispose(), [built]);
  return (
    <group>
      {built.objects.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </group>
  );
}
