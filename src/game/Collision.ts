export interface BoxCollider {
  shape: 'box';
  id: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  damage: number;
  label: string;
}

export interface CircleCollider {
  shape: 'circle';
  id: number;
  x: number;
  z: number;
  r: number;
  damage: number;
  label: string;
}

export type Collider = BoxCollider | CircleCollider;

export interface Contact {
  nx: number;
  nz: number;
  depth: number;
  px: number;
  pz: number;
  collider: Collider | null;
}

/** Uniform-grid spatial hash for static colliders. */
export class SpatialHash {
  private cells = new Map<number, Collider[]>();
  private nextId = 1;
  readonly all: Collider[] = [];

  constructor(private cellSize = 8) {}

  private key(ix: number, iz: number) {
    return (ix + 1000) * 4096 + (iz + 1000);
  }

  addBox(x0: number, z0: number, x1: number, z1: number, damage: number, label: string) {
    this.insert({ shape: 'box', id: this.nextId++, x0, z0, x1, z1, damage, label });
  }

  addCircle(x: number, z: number, r: number, damage: number, label: string) {
    this.insert({ shape: 'circle', id: this.nextId++, x, z, r, damage, label });
  }

  private insert(c: Collider) {
    this.all.push(c);
    const [x0, z0, x1, z1] = c.shape === 'box' ? [c.x0, c.z0, c.x1, c.z1] : [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r];
    const cs = this.cellSize;
    for (let ix = Math.floor(x0 / cs); ix <= Math.floor(x1 / cs); ix++) {
      for (let iz = Math.floor(z0 / cs); iz <= Math.floor(z1 / cs); iz++) {
        const k = this.key(ix, iz);
        let arr = this.cells.get(k);
        if (!arr) this.cells.set(k, (arr = []));
        arr.push(c);
      }
    }
  }

  private seen = new Set<number>();
  query(x: number, z: number, r: number, out: Collider[]) {
    out.length = 0;
    this.seen.clear();
    const cs = this.cellSize;
    for (let ix = Math.floor((x - r) / cs); ix <= Math.floor((x + r) / cs); ix++) {
      for (let iz = Math.floor((z - r) / cs); iz <= Math.floor((z + r) / cs); iz++) {
        const arr = this.cells.get(this.key(ix, iz));
        if (!arr) continue;
        for (const c of arr) {
          if (this.seen.has(c.id)) continue;
          this.seen.add(c.id);
          out.push(c);
        }
      }
    }
    return out;
  }
}

/** Circle vs collider. Returns penetration contact or null. */
export function circleVs(x: number, z: number, r: number, c: Collider, out: Contact): boolean {
  if (c.shape === 'circle') {
    const dx = x - c.x;
    const dz = z - c.z;
    const d2 = dx * dx + dz * dz;
    const rr = r + c.r;
    if (d2 >= rr * rr) return false;
    const d = Math.sqrt(d2) || 0.0001;
    out.nx = dx / d;
    out.nz = dz / d;
    out.depth = rr - d;
    out.px = c.x + out.nx * c.r;
    out.pz = c.z + out.nz * c.r;
    out.collider = c;
    return true;
  }
  const cx = Math.max(c.x0, Math.min(x, c.x1));
  const cz = Math.max(c.z0, Math.min(z, c.z1));
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > 0) {
    if (d2 >= r * r) return false;
    const d = Math.sqrt(d2);
    out.nx = dx / d;
    out.nz = dz / d;
    out.depth = r - d;
    out.px = cx;
    out.pz = cz;
    out.collider = c;
    return true;
  }
  // Centre inside the box: push out along the smallest axis.
  const left = x - c.x0;
  const right = c.x1 - x;
  const top = z - c.z0;
  const bottom = c.z1 - z;
  const m = Math.min(left, right, top, bottom);
  out.nx = m === left ? -1 : m === right ? 1 : 0;
  out.nz = m === top ? -1 : m === bottom ? 1 : 0;
  if (out.nx !== 0) out.nz = 0;
  out.depth = m + r;
  out.px = x;
  out.pz = z;
  out.collider = c;
  return true;
}
