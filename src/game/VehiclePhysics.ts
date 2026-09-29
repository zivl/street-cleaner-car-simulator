import type { VehicleDef, VehicleStats } from '../data/vehicles';
import { clamp, damp } from './random';

export interface DriveInput {
  throttle: boolean;
  brake: boolean;
  steer: number;
}

/**
 * Arcade "bicycle model" truck physics. Heavy, forgiving and predictable.
 * Heading convention: forward = (sin h, cos h) in world XZ; +steer turns left.
 */
export class VehiclePhysics {
  x = 0;
  z = 0;
  heading = 0;
  vx = 0;
  vz = 0;
  steerAngle = 0;
  /** Signed forward speed (m/s). */
  speed = 0;
  /** Engine load 0..1 (for sound / fuel). */
  load = 0;
  braking = false;
  wheelSpin = 0;
  distance = 0;

  constructor(readonly def: VehicleDef) {}

  reset(x: number, z: number, heading: number) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = this.vz = this.speed = this.steerAngle = 0;
  }

  update(dt: number, inp: DriveInput, stats: VehicleStats, opts: { enginesOn: boolean; speedCap: number; surfaceDrag: number }) {
    const s = Math.sin(this.heading);
    const c = Math.cos(this.heading);
    // forward f = (s, c), right r = (-c, s)
    let vF = this.vx * s + this.vz * c;
    let vR = -this.vx * c + this.vz * s;

    const maxSpeed = stats.maxSpeed * opts.speedCap;
    const maxReverse = 4.2;
    const brakeDecel = 9;
    let accel = 0;
    this.braking = false;
    this.load = 0;

    const throttle = opts.enginesOn && inp.throttle;
    const reverse = opts.enginesOn && inp.brake;

    if (throttle && !inp.brake) {
      if (vF < -0.3) {
        accel = brakeDecel;
        this.braking = true;
      } else {
        const t = clamp(vF / maxSpeed, 0, 1);
        accel = stats.accel * (1 - t * t);
        this.load = 1 - t * 0.4;
      }
    } else if (inp.brake) {
      if (vF > 0.3) {
        accel = -brakeDecel;
        this.braking = true;
      } else if (reverse) {
        const t = clamp(-vF / maxReverse, 0, 1);
        accel = -stats.accel * 0.8 * (1 - t);
        this.load = 0.6;
      }
    }

    vF += accel * dt;
    // Rolling resistance + aero drag + surface drag.
    const drag = 0.25 + Math.abs(vF) * 0.015 + opts.surfaceDrag;
    if (!throttle && !this.braking) {
      const coast = (0.9 + opts.surfaceDrag * 3) * dt;
      vF = Math.abs(vF) <= coast ? 0 : vF - Math.sign(vF) * coast;
    } else {
      vF -= vF * drag * dt * 0.1;
    }
    if (vF > maxSpeed) vF += (maxSpeed - vF) * damp(3, dt);
    if (vF < -maxReverse) vF = -maxReverse;

    // Steering: rate-limited, reduced at speed for stability.
    const speedFactor = 1 - clamp(Math.abs(vF) / 16, 0, 1) * 0.55;
    const targetSteer = inp.steer * stats.maxSteer * speedFactor;
    const rate = stats.steerRate * (inp.steer === 0 ? 1.6 : 1);
    const ds = targetSteer - this.steerAngle;
    this.steerAngle += clamp(ds, -rate * dt, rate * dt);

    const yawRate = (vF / this.def.wheelBase) * Math.tan(this.steerAngle);
    this.heading += yawRate * dt;

    // Lateral grip kills sideways slide.
    vR *= Math.exp(-stats.grip * dt);

    const s2 = Math.sin(this.heading);
    const c2 = Math.cos(this.heading);
    this.vx = s2 * vF - c2 * vR;
    this.vz = c2 * vF + s2 * vR;
    this.speed = vF;

    const dx = this.vx * dt;
    const dz = this.vz * dt;
    this.x += dx;
    this.z += dz;
    const moved = Math.hypot(dx, dz);
    this.distance += moved;
    this.wheelSpin += (vF * dt) / 0.5;
    return moved;
  }

  /** Re-derive signed speed after external velocity changes (collisions). */
  syncSpeed() {
    this.speed = this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
  }
}
