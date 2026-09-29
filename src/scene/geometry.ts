import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const tmpColor = new THREE.Color();

/** Accumulates quads into a single non-indexed BufferGeometry with colors and UVs. */
export class MeshBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];

  /** Quad from 4 corners (counter-clockwise when viewed from the front). */
  quad(
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    color: THREE.ColorRepresentation,
    uvs: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  ) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1];
    let ny = e1[2] * e2[0] - e1[0] * e2[2];
    let nz = e1[0] * e2[1] - e1[1] * e2[0];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    tmpColor.set(color);
    const verts = [a, b, c, a, c, d];
    const uvIdx = [0, 1, 2, 0, 2, 3];
    for (let i = 0; i < 6; i++) {
      const v = verts[i];
      this.pos.push(v[0], v[1], v[2]);
      this.nor.push(nx, ny, nz);
      const t = uvs[uvIdx[i]];
      this.uv.push(t[0], t[1]);
      this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  tri(a: [number, number, number], b: [number, number, number], c: [number, number, number], color: THREE.ColorRepresentation) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1];
    let ny = e1[2] * e2[0] - e1[0] * e2[2];
    let nz = e1[0] * e2[1] - e1[1] * e2[0];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    tmpColor.set(color);
    for (const v of [a, b, c]) {
      this.pos.push(v[0], v[1], v[2]);
      this.nor.push(nx, ny, nz);
      this.uv.push(0, 0);
      this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  /**
   * Axis-aligned box. `uvFn` maps (faceIndex, u01, v01, faceW, faceH) → uv; default uses world metres.
   * Faces: 0:+x 1:-x 2:+z 3:-z 4:+y 5:-y
   */
  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    color: THREE.ColorRepresentation,
    opts: { bottom?: boolean; top?: boolean; uv?: (face: number, w: number, h: number) => [number, number][]; topColor?: THREE.ColorRepresentation } = {},
  ) {
    const uvf =
      opts.uv ??
      ((_f: number, w: number, h: number) =>
        [
          [0, 0],
          [w, 0],
          [w, h],
          [0, h],
        ] as [number, number][]);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    // +z face (front)
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, uvf(2, dx, dy));
    // -z face
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, uvf(3, dx, dy));
    // +x
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color, uvf(0, dz, dy));
    // -x
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, uvf(1, dz, dy));
    if (opts.top !== false) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], opts.topColor ?? color, uvf(4, dx, dz));
    if (opts.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, uvf(5, dx, dz));
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }

  get empty() {
    return this.pos.length === 0;
  }
}

export interface Part {
  geo: THREE.BufferGeometry;
  color: THREE.ColorRepresentation;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

/** Merge primitive parts into one geometry with per-vertex colors (for instancing). */
export function mergeParts(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(p.position ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rotation ?? [0, 0, 0]))),
      new THREE.Vector3(...(p.scale ?? [1, 1, 1])),
    );
    g.applyMatrix4(m);
    const c = new THREE.Color(p.color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    // Keep only the attributes we need so merge succeeds.
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
    return g;
  });
  const merged = mergeGeometries(geos, false)!;
  merged.computeBoundingSphere();
  return merged;
}

export const G = {
  box: (w = 1, h = 1, d = 1) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg),
  sphere: (r: number, detail = 1) => new THREE.IcosahedronGeometry(r, detail),
  cone: (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg),
  torus: (r: number, t: number) => new THREE.TorusGeometry(r, t, 8, 24),
};
