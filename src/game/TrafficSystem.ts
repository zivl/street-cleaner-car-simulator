import type { CityConfig } from '../data/cities';
import type { CityLayout, RoadNode } from './CityGenerator';
import { Rng } from './random';

export interface TrafficCar {
  x: number;
  z: number;
  heading: number;
  color: string;
  bus: boolean;
  length: number;
  speed: number;
  cruise: number;
  // path
  from: number;
  to: number;
  next: number;
  /** Progress along current piece. */
  t: number;
  phase: 'lane' | 'turn';
  p0x: number;
  p0z: number;
  p1x: number;
  p1z: number;
  p2x: number;
  p2z: number;
  pieceLen: number;
  blockedTime: number;
  honkCooldown: number;
  /** While > 0 the car ignores other cars (breaks intersection deadlocks). */
  ghost: number;
  jammed: number;
}

const LANE_STOP = 1.5;

/** Simple lane-following AI traffic on the road graph. */
export class TrafficSystem {
  cars: TrafficCar[] = [];
  private rng: Rng;
  private widths = new Map<string, number>();
  /** +1 drive on the right, -1 drive on the left. */
  private side: number;

  constructor(
    private layout: CityLayout,
    cfg: CityConfig,
    seed: number,
    density = 1,
  ) {
    this.rng = new Rng(seed ^ 0x7aff1c);
    this.side = cfg.driveLeft ? -1 : 1;
    for (const s of layout.segments) {
      this.widths.set(`${s.a}-${s.b}`, s.width);
      this.widths.set(`${s.b}-${s.a}`, s.width);
    }
    const count = Math.round(cfg.traffic.cars * density);
    const spawn = layout.spawn;
    for (let k = 0; k < count; k++) {
      const seg = this.rng.pick(layout.segments);
      const forward = this.rng.chance(0.5);
      const from = forward ? seg.a : seg.b;
      const to = forward ? seg.b : seg.a;
      const bus = this.rng.chance(cfg.traffic.busChance);
      const car: TrafficCar = {
        x: 0,
        z: 0,
        heading: 0,
        color: bus ? cfg.traffic.busColor ?? '#ddd' : this.rng.pick(cfg.traffic.colors),
        bus,
        length: bus ? 10 : 4.4,
        speed: 0,
        cruise: bus ? 6.5 : this.rng.range(7, 9.5),
        from,
        to,
        next: -1,
        t: this.rng.range(0.1, 0.8),
        phase: 'lane',
        p0x: 0,
        p0z: 0,
        p1x: 0,
        p1z: 0,
        p2x: 0,
        p2z: 0,
        pieceLen: 1,
        blockedTime: 0,
        honkCooldown: 0,
        ghost: 0,
        jammed: 0,
      };
      this.setupLane(car);
      this.place(car);
      if (Math.hypot(car.x - spawn.x, car.z - spawn.z) < 25) continue;
      this.cars.push(car);
    }
  }

  private width(a: number, b: number) {
    return this.widths.get(`${a}-${b}`) ?? 7;
  }

  private laneOffset(a: number, b: number) {
    const w = this.width(a, b);
    return (w > 9 ? w / 4 + 0.6 : Math.max(0.95, w / 2 - 2.5)) * this.side;
  }

  /** Right-hand lane from node a to b. */
  private laneEnds(a: RoadNode, b: RoadNode, off: number) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const fx = dx / len;
    const fz = dz / len;
    // right = (-fz, fx)?? For forward (fx, fz) = (sin h, cos h), right = (-cos h, sin h) = (-fz, fx)
    const rx = -fz;
    const rz = fx;
    const inset = 5.5;
    return {
      sx: a.x + fx * inset + rx * off,
      sz: a.z + fz * inset + rz * off,
      ex: b.x - fx * inset + rx * off,
      ez: b.z - fz * inset + rz * off,
      fx,
      fz,
      rx,
      rz,
    };
  }

  private setupLane(car: TrafficCar) {
    const a = this.layout.nodes[car.from];
    const b = this.layout.nodes[car.to];
    const L = this.laneEnds(a, b, this.laneOffset(car.from, car.to));
    car.phase = 'lane';
    car.p0x = L.sx;
    car.p0z = L.sz;
    car.p2x = L.ex;
    car.p2z = L.ez;
    car.pieceLen = Math.max(0.5, Math.hypot(L.ex - L.sx, L.ez - L.sz));
  }

  private chooseNext(car: TrafficCar) {
    const node = this.layout.nodes[car.to];
    const options = node.edges.filter((n) => n !== car.from);
    car.next = options.length ? this.rng.pick(options) : car.from;
  }

  private setupTurn(car: TrafficCar) {
    const nodes = this.layout.nodes;
    const a = nodes[car.from];
    const b = nodes[car.to];
    const c = nodes[car.next];
    const L1 = this.laneEnds(a, b, this.laneOffset(car.from, car.to));
    const L2 = this.laneEnds(b, c, this.laneOffset(car.to, car.next));
    car.phase = 'turn';
    car.p0x = L1.ex;
    car.p0z = L1.ez;
    car.p2x = L2.sx;
    car.p2z = L2.sz;
    const dot = L1.fx * L2.fx + L1.fz * L2.fz;
    if (dot > 0.5) {
      car.p1x = (car.p0x + car.p2x) / 2;
      car.p1z = (car.p0z + car.p2z) / 2;
    } else if (dot < -0.5) {
      // U-turn: control point pushed past the node.
      car.p1x = b.x + L1.fx * 4;
      car.p1z = b.z + L1.fz * 4;
    } else {
      // Intersection of the two lane lines.
      const o1 = this.laneOffset(car.from, car.to);
      const o2 = this.laneOffset(car.to, car.next);
      car.p1x = b.x + L1.rx * o1 + L2.rx * o2;
      car.p1z = b.z + L1.rz * o1 + L2.rz * o2;
    }
    car.pieceLen = Math.max(1, (Math.hypot(car.p1x - car.p0x, car.p1z - car.p0z) + Math.hypot(car.p2x - car.p1x, car.p2z - car.p1z)) * 0.9);
  }

  private place(car: TrafficCar) {
    const t = car.t;
    let x: number, z: number, tx: number, tz: number;
    if (car.phase === 'lane') {
      x = car.p0x + (car.p2x - car.p0x) * t;
      z = car.p0z + (car.p2z - car.p0z) * t;
      tx = car.p2x - car.p0x;
      tz = car.p2z - car.p0z;
    } else {
      const u = 1 - t;
      x = u * u * car.p0x + 2 * u * t * car.p1x + t * t * car.p2x;
      z = u * u * car.p0z + 2 * u * t * car.p1z + t * t * car.p2z;
      tx = 2 * u * (car.p1x - car.p0x) + 2 * t * (car.p2x - car.p1x);
      tz = 2 * u * (car.p1z - car.p0z) + 2 * t * (car.p2z - car.p1z);
    }
    car.x = x;
    car.z = z;
    if (tx * tx + tz * tz > 1e-6) car.heading = Math.atan2(tx, tz);
  }

  /** Returns true for each car that honked this frame (for audio). */
  update(dt: number, truckX: number, truckZ: number, onHonk: (car: TrafficCar) => void) {
    for (const car of this.cars) {
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      // Look ahead for obstacles (truck, other cars).
      let clear = true;
      const look = car.length / 2 + 7;
      const check = (ox: number, oz: number, rad: number) => {
        const dx = ox - car.x;
        const dz = oz - car.z;
        const along = dx * fx + dz * fz;
        if (along <= 0 || along > look + rad) return false;
        const lat = Math.abs(dx * fz - dz * fx);
        return lat < 1.6 + rad;
      };
      if (check(truckX, truckZ, 1.5)) {
        clear = false;
        car.blockedTime += dt;
      }
      car.ghost -= dt;
      if (clear && car.ghost <= 0) {
        for (const other of this.cars) {
          if (other === car) continue;
          if (check(other.x, other.z, other.length / 2 - LANE_STOP)) {
            clear = false;
            car.jammed += dt;
            if (car.jammed > 5) {
              car.ghost = 2.5;
              car.jammed = 0;
            }
            break;
          }
        }
      }
      if (clear) {
        car.blockedTime = 0;
        car.jammed = 0;
      }
      car.honkCooldown -= dt;
      if (car.blockedTime > 1.6 && car.honkCooldown <= 0) {
        car.honkCooldown = 5 + this.rng.range(0, 4);
        onHonk(car);
      }

      const target = clear ? car.cruise * (car.phase === 'turn' ? 0.6 : 1) : 0;
      const a = target > car.speed ? 2.5 : 7;
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), a * dt);

      car.t += (car.speed * dt) / car.pieceLen;
      if (car.t >= 1) {
        car.t -= 1;
        if (car.phase === 'lane') {
          this.chooseNext(car);
          this.setupTurn(car);
        } else {
          car.from = car.to;
          car.to = car.next;
          this.setupLane(car);
        }
        car.t = Math.min(car.t * 0.5, 0.2);
      }
      this.place(car);
    }
  }
}
