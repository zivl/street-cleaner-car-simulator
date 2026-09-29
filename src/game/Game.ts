import { cityById, type CityConfig } from '../data/cities';
import { DIRT_TYPES } from '../data/dirtTypes';
import type { UpgradeLevels } from '../data/upgrades';
import { SWEEPER, computeVehicleStats, type VehicleStats } from '../data/vehicles';
import { WIN_THRESHOLD, type EndReason, type HudSnapshot, type LevelResult, type LevelSpec } from '../state/gameState';
import { audio } from './AudioSystem';
import { generateCity, type CityLayout } from './CityGenerator';
import { CleaningSystem, SURF_GRASS, SURF_ROAD, SURF_SIDEWALK } from './CleaningSystem';
import { SpatialHash, circleVs, type Collider, type Contact } from './Collision';
import { envPreset, type EnvPreset } from './Environment';
import { input, type InputAction } from './Input';
import { TrafficSystem } from './TrafficSystem';
import { VehiclePhysics } from './VehiclePhysics';
import { clamp, damp } from './random';

export interface FxEvent {
  kind: 'dust' | 'spark' | 'sparkle';
  x: number;
  y: number;
  z: number;
  count: number;
  color: string;
}

export interface RadarBlip {
  x: number;
  z: number;
  type: number;
  strength: number;
}

export interface PickupState {
  kind: 'fuel' | 'repair';
  x: number;
  z: number;
  alive: boolean;
}

export interface GameCallbacks {
  onEnd: (r: LevelResult) => void;
  onToast: (text: string, tone: 'info' | 'good' | 'warn' | 'bad') => void;
}

export type Quality = 'low' | 'medium' | 'high';

export class Game {
  readonly city: CityConfig;
  readonly layout: CityLayout;
  readonly cleaning: CleaningSystem;
  readonly traffic: TrafficSystem;
  readonly colliders = new SpatialHash(8);
  readonly vehicle = new VehiclePhysics(SWEEPER);
  readonly env: EnvPreset;
  stats: VehicleStats;

  fuel: number;
  fuelMax: number;
  condition = 1;
  foam: number;
  foamMax: number;

  brushes = false;
  lights: boolean;
  camera: 'first' | 'third' = 'first';
  /** 0 = first person, 1 = third person (animated). */
  camBlend = 0;
  foaming = false;
  brushSpin = 0;
  brushDeploy = 0;

  paused = false;
  ended = false;
  private endTimer = -1;
  private endReason: EndReason = 'cleaned';

  elapsed = 0;
  collisions = 0;
  shake = 0;
  rideHeight = 0;
  surface = SURF_ROAD;
  bodyRoll = 0;
  bodyPitch = 0;

  pickups: PickupState[];
  blips: RadarBlip[] = [];
  nearestDirt: { x: number; z: number; d: number } | null = null;
  radarDirtyChunks = 0;
  fx: FxEvent[] = [];

  private radarTimer = 0;
  private lowFuelWarned = false;
  private criticalWarned = false;
  private hitCooldown = new Map<number, number>();
  private brakeSoundTimer = 0;
  private popTimer = 0;
  private tmpColliders: Collider[] = [];
  private contact: Contact = { nx: 0, nz: 0, depth: 0, px: 0, pz: 0, collider: null };

  constructor(
    readonly level: LevelSpec,
    upgrades: UpgradeLevels,
    readonly quality: Quality,
    private cb: GameCallbacks,
  ) {
    this.city = cityById(level.cityId);
    this.layout = generateCity(this.city, level.seed);
    this.cleaning = new CleaningSystem(this.layout, this.city, level.seed);
    this.traffic = new TrafficSystem(this.layout, this.city, level.seed, quality === 'low' ? 0.6 : 1);
    this.env = envPreset(level.time, level.weather);
    this.stats = computeVehicleStats(upgrades);
    this.fuelMax = SWEEPER.fuelCapacity;
    this.fuel = this.fuelMax;
    this.foamMax = this.stats.foamCapacity;
    this.foam = this.foamMax;
    this.lights = level.time !== 'day' || level.weather === 'rain';
    this.pickups = this.layout.pickups.map((p) => ({ ...p, alive: true }));

    const sp = this.layout.spawn;
    this.vehicle.reset(sp.x, sp.z, sp.heading);
    this.buildColliders();
  }

  dispose() {
    audio.silenceVehicle();
  }

  private buildColliders() {
    const L = this.layout;
    const H = this.colliders;
    for (const b of L.buildings) {
      // Only buildings near the playable area matter.
      if (b.x1 < -6 || b.z1 < -6 || b.x0 > L.width + 6 || b.z0 > L.depth + 6) continue;
      H.addBox(b.x0, b.z0, b.x1, b.z1, 1, 'building');
    }
    // Map boundary walls (just beyond the outer sidewalks).
    const sw = this.city.grid.sidewalk;
    const W = L.width;
    const D = L.depth;
    H.addBox(-40, -40, W + 40, -sw, 0.6, 'wall');
    H.addBox(-40, D + sw, W + 40, D + 40, 0.6, 'wall');
    H.addBox(-40, -40, -sw, D + 40, 0.6, 'wall');
    H.addBox(W + sw, -40, W + 40, D + 40, 0.6, 'wall');
    for (const b of L.blocks) {
      if (b.kind === 'canal') {
        H.addBox(b.x0 + sw - 0.3, b.z0 + sw - 0.3, b.x1 - sw + 0.3, b.z1 - sw + 0.3, 0.5, 'canal railing');
      }
    }
    for (const p of L.props) {
      switch (p.kind) {
        case 'lamp':
          H.addCircle(p.x, p.z, 0.25, 0.9, 'lamp post');
          break;
        case 'tree':
          H.addCircle(p.x, p.z, 0.4, 0.9, 'tree');
          break;
        case 'hydrant':
        case 'bollard':
          H.addCircle(p.x, p.z, 0.25, 0.6, p.kind);
          break;
        case 'bin':
        case 'planter':
          H.addCircle(p.x, p.z, 0.45, 0.5, p.kind);
          break;
        case 'bench':
          H.addCircle(p.x, p.z, 0.7, 0.5, 'bench');
          break;
        case 'phonebox':
        case 'vending':
          H.addCircle(p.x, p.z, 0.65, 0.8, p.kind === 'phonebox' ? 'phone box' : 'vending machine');
          break;
        case 'kiosk':
          H.addCircle(p.x, p.z, 1.1, 0.8, 'kiosk');
          break;
      }
    }
    for (const c of L.parked) {
      const len = c.bus ? 10 : 4.3;
      const along = Math.abs(Math.sin(c.rot)) > 0.5; // oriented along x
      const hw = along ? len / 2 : 0.95;
      const hd = along ? 0.95 : len / 2;
      H.addBox(c.x - hw, c.z - hd, c.x + hw, c.z + hd, 0.8, 'parked car');
    }
    for (const b of L.barriers) {
      if (b.kind === 'cone') H.addCircle(b.x, b.z, 0.3, 0.2, 'traffic cone');
      else H.addCircle(b.x, b.z, 0.8, 0.4, 'road barrier');
    }
  }

  handleAction(a: InputAction) {
    if (this.ended) return;
    if (a === 'pause') return; // handled by UI
    if (this.paused) return;
    audio.play('toggle');
    if (a === 'brushes') {
      this.brushes = !this.brushes;
      this.cb.onToast(this.brushes ? 'Brushes ON' : 'Brushes OFF', this.brushes ? 'good' : 'info');
    } else if (a === 'lights') {
      this.lights = !this.lights;
    } else if (a === 'camera') {
      this.camera = this.camera === 'first' ? 'third' : 'first';
    }
  }

  applyUpgrades(levels: UpgradeLevels) {
    this.stats = computeVehicleStats(levels);
  }

  get engineRunning() {
    return this.fuel > 0 && this.condition > 0 && !this.ended;
  }

  get cleanRatio() {
    return this.cleaning.cleanRatio;
  }

  update(rawDt: number) {
    const dt = Math.min(rawDt, 0.1);
    // Camera blend animates even while paused so toggles feel responsive.
    const camTarget = this.camera === 'third' ? 1 : 0;
    this.camBlend += clamp(camTarget - this.camBlend, -dt / 0.6, dt / 0.6);
    if (this.paused) return;

    const steps = Math.ceil(dt / (1 / 60));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h);
    this.stepOnce(dt);
  }

  private step(dt: number) {
    const v = this.vehicle;
    const st = this.stats;
    const controlsLocked = this.ended || this.endTimer >= 0;
    const drive = controlsLocked
      ? { throttle: false, brake: true, steer: 0 }
      : { throttle: input.throttle, brake: input.brake, steer: input.steer };

    const surf = this.cleaning.surfaceAt(v.x, v.z);
    this.surface = surf;
    const offRoad = surf === SURF_SIDEWALK || surf === SURF_GRASS;
    const limp = this.condition < 0.25 ? 0.6 : 1;
    const moved = v.update(dt, drive, st, {
      enginesOn: this.engineRunning && !controlsLocked,
      speedCap: limp * (offRoad ? 0.55 : 1),
      surfaceDrag: offRoad ? 0.6 : 0,
    });

    this.resolveCollisions();

    // Fuel.
    if (this.engineRunning) {
      let burn = SWEEPER.fuelIdlePerSec * dt + (moved * SWEEPER.fuelPerMeter * (0.7 + v.load * 0.5)) / st.fuelEfficiency;
      if (this.brushes) burn += SWEEPER.fuelBrushPerSec * dt;
      this.fuel = Math.max(0, this.fuel - burn);
    }

    // Cleaning.
    this.brushDeploy += clamp((this.brushes ? 1 : 0) - this.brushDeploy, -dt * 2.5, dt * 2.5);
    if (this.brushes && this.brushDeploy > 0.6 && this.engineRunning) {
      this.cleaning.brush(dt, v.x, v.z, v.heading, st);
    }
    this.foaming = !controlsLocked && input.foam && this.foam > 0.5 && this.engineRunning;
    if (this.foaming) {
      this.foam = Math.max(0, this.foam - 14 * dt);
      this.cleaning.spray(v.x, v.z, v.heading, st);
    } else {
      this.foam = Math.min(this.foamMax, this.foam + 1.2 * dt);
    }
  }

  private resolveCollisions() {
    const v = this.vehicle;
    const s = Math.sin(v.heading);
    const c = Math.cos(v.heading);
    const r = SWEEPER.hitRadius;
    let bestImpact = 0;
    let bestContact: Contact | null = null;

    for (let iter = 0; iter < 2; iter++) {
      for (const off of SWEEPER.hitCircles) {
        const cx = v.x + s * off;
        const cz = v.z + c * off;
        this.colliders.query(cx, cz, r + 1, this.tmpColliders);
        for (const col of this.tmpColliders) {
          if (!circleVs(cx, cz, r, col, this.contact)) continue;
          const impact = this.pushOut(this.contact);
          if (impact > bestImpact) {
            bestImpact = impact;
            bestContact = { ...this.contact };
          }
        }
        // Traffic cars.
        for (const car of this.traffic.cars) {
          const dx = car.x - cx;
          const dz = car.z - cz;
          if (dx * dx + dz * dz > 64) continue;
          const fx = Math.sin(car.heading);
          const fz = Math.cos(car.heading);
          const n = car.bus ? 4 : 2;
          for (let k = 0; k < n; k++) {
            const o = (k / (n - 1) - 0.5) * (car.length - 1.9);
            const ccx = car.x + fx * o;
            const ccz = car.z + fz * o;
            const dx2 = cx - ccx;
            const dz2 = cz - ccz;
            const d = Math.hypot(dx2, dz2);
            const rr = r + 0.95;
            if (d >= rr || d === 0) continue;
            this.contact.nx = dx2 / d;
            this.contact.nz = dz2 / d;
            this.contact.depth = rr - d;
            this.contact.px = ccx + this.contact.nx * 0.95;
            this.contact.pz = ccz + this.contact.nz * 0.95;
            this.contact.collider = null;
            const impact = this.pushOut(this.contact);
            car.speed = 0;
            car.blockedTime = 2;
            if (impact > bestImpact) {
              bestImpact = impact;
              bestContact = { ...this.contact };
            }
          }
        }
      }
    }
    v.syncSpeed();

    if (bestContact && bestImpact > 1.2) {
      const col = bestContact.collider;
      const id = col?.id ?? -1;
      const now = this.elapsed;
      if ((this.hitCooldown.get(id) ?? -10) + 0.6 < now) {
        this.hitCooldown.set(id, now);
        this.onImpact(bestImpact, bestContact, col?.label ?? 'car', col?.damage ?? 0.8);
      }
    }
  }

  /** Push the truck out along the contact normal and cancel inward velocity. Returns impact speed. */
  private pushOut(ct: Contact) {
    const v = this.vehicle;
    v.x += ct.nx * ct.depth;
    v.z += ct.nz * ct.depth;
    const vn = v.vx * ct.nx + v.vz * ct.nz;
    if (vn >= 0) return 0;
    v.vx -= ct.nx * vn * 1.25;
    v.vz -= ct.nz * vn * 1.25;
    // Scrub some tangential speed (friction).
    v.vx *= 0.92;
    v.vz *= 0.92;
    return -vn;
  }

  private onImpact(impact: number, ct: Contact, label: string, damageMul: number) {
    this.collisions++;
    const dmg = Math.max(0, impact - 1.8) * 0.028 * damageMul * this.stats.damageMult;
    this.condition = Math.max(0, this.condition - dmg);
    this.shake = Math.min(1, this.shake + impact / 9);
    const vol = Math.min(1, impact / 10);
    if (impact > 3.5) {
      audio.play('collision', vol);
      this.fx.push({ kind: 'spark', x: ct.px, y: 0.8, z: ct.pz, count: Math.round(6 + impact * 2), color: '#ffcf5a' });
      if (dmg > 0.02) this.cb.onToast(`Crashed into a ${label}!  -${Math.round(dmg * 100)}%`, 'bad');
    } else {
      audio.play('bump', vol + 0.3);
    }
  }

  private stepOnce(dt: number) {
    const v = this.vehicle;
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.brushSpin += dt * this.brushDeploy * 14;

    // Suspension feel: ride height on sidewalks, body roll/pitch from forces.
    const targetRide = this.surface === SURF_SIDEWALK ? 0.16 : this.surface === SURF_GRASS ? 0.08 : 0;
    this.rideHeight += (targetRide - this.rideHeight) * damp(10, dt);
    const lat = v.speed * Math.tan(v.steerAngle) * 0.02;
    this.bodyRoll += (clamp(-lat, -0.05, 0.05) - this.bodyRoll) * damp(4, dt);
    const pitchTarget = v.braking ? 0.02 : v.load > 0.5 && v.speed > 0 ? -0.012 : 0;
    this.bodyPitch += (pitchTarget - this.bodyPitch) * damp(5, dt);

    this.cleaning.update(dt, this.stats);
    const removedBefore = this.cleaning.removed.length;
    this.cleaning.collectItems();
    const newItems = this.cleaning.removed.length - removedBefore;

    // Cleaning feedback: dust particles and pops.
    const removedAmt = this.cleaning.frameRemoved;
    if (removedAmt > 0.002) {
      const s = Math.sin(v.heading);
      const c = Math.cos(v.heading);
      const side = Math.random() < 0.5 ? -1 : 1;
      const lx = side * this.stats.brushWidth * 0.4;
      const lz = 2.9;
      const t = DIRT_TYPES[this.cleaning.frameRemovedType];
      this.fx.push({
        kind: 'dust',
        x: v.x + c * lx + s * lz,
        y: 0.2,
        z: v.z - s * lx + c * lz,
        count: Math.min(6, 1 + Math.round(removedAmt * 3)),
        color: t.id === 'oil' ? '#3a3440' : t.id === 'leaves' ? '#c98a2e' : '#9a9080',
      });
    }
    this.popTimer -= dt;
    if (newItems > 0 && this.popTimer <= 0) {
      audio.play('pop', Math.min(1, 0.4 + newItems * 0.2));
      this.popTimer = 0.07;
    }

    // Traffic.
    this.traffic.update(dt, v.x, v.z, () => audio.play('honk', 0.6));

    // Brake squeal.
    this.brakeSoundTimer -= dt;
    if (v.braking && Math.abs(v.speed) > 7 && this.brakeSoundTimer <= 0) {
      audio.play('brake', 0.8);
      this.brakeSoundTimer = 1.2;
    }

    // Pickups.
    for (const p of this.pickups) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - v.x, p.z - v.z) < 3.2) {
        p.alive = false;
        audio.play('pickup');
        this.fx.push({ kind: 'sparkle', x: p.x, y: 1.2, z: p.z, count: 24, color: p.kind === 'fuel' ? '#ffd23f' : '#4ade80' });
        if (p.kind === 'fuel') {
          this.fuel = Math.min(this.fuelMax, this.fuel + this.fuelMax * 0.2);
          this.cb.onToast('Fuel canister  +20% fuel', 'good');
        } else {
          this.condition = Math.min(1, this.condition + 0.3);
          this.cb.onToast('Repair kit  +30% condition', 'good');
        }
      }
    }

    // Radar.
    this.radarTimer -= dt;
    if (this.radarTimer <= 0) {
      this.radarTimer = 0.25;
      this.updateRadar();
    }

    // Warnings.
    const fuelPct = this.fuel / this.fuelMax;
    if (fuelPct < 0.15 && !this.lowFuelWarned) {
      this.lowFuelWarned = true;
      audio.play('warning');
      this.cb.onToast('Low fuel! Look for fuel canisters ⛽', 'warn');
    }
    if (this.condition < 0.25 && !this.criticalWarned) {
      this.criticalWarned = true;
      audio.play('warning');
      this.cb.onToast('Vehicle critically damaged — limp mode!', 'bad');
    }

    // Audio.
    audio.updateVehicle({
      speed: v.speed,
      load: v.load,
      running: this.engineRunning,
      brushes: this.brushes && this.engineRunning,
      foam: this.foaming,
      cleaning: removedAmt,
      rain: this.level.weather === 'rain',
    });
    this.cleaning.frameRemoved = 0;

    // Win / lose.
    if (this.endTimer < 0 && !this.ended) {
      if (this.cleanRatio >= WIN_THRESHOLD) {
        this.endReason = 'cleaned';
        this.endTimer = 1.0;
      } else if (this.condition <= 0) {
        this.endReason = 'wrecked';
        this.endTimer = 1.5;
      } else if (this.fuel <= 0 && Math.abs(v.speed) < 0.3) {
        this.endReason = 'fuel';
        this.endTimer = 1.2;
      }
    }
    if (this.endTimer >= 0 && !this.ended) {
      this.endTimer -= dt;
      if (this.endTimer < 0) this.finish(this.endReason);
    }
  }

  private updateRadar() {
    const v = this.vehicle;
    const range = this.stats.radarRange;
    this.radarDirtyChunks = this.cleaning.scan(v.x, v.z, range);
    this.nearestDirt = this.stats.radarTier >= 2 ? this.cleaning.nearestDirt(v.x, v.z, range) : null;
    // 3D blips: nearest dirty chunks.
    const C = this.cleaning;
    const cs = 4;
    const blips: RadarBlip[] = [];
    const ci0 = Math.max(0, Math.floor((v.x - range) / cs));
    const ci1 = Math.min(C.cw - 1, Math.floor((v.x + range) / cs));
    const cj0 = Math.max(0, Math.floor((v.z - range) / cs));
    const cj1 = Math.min(C.ch - 1, Math.floor((v.z + range) / cs));
    for (let j = cj0; j <= cj1; j++) {
      for (let i = ci0; i <= ci1; i++) {
        const k = j * C.cw + i;
        const d = C.chunkDirt[k];
        if (d < 2) continue;
        const x = (i + 0.5) * cs;
        const z = (j + 0.5) * cs;
        const dist = Math.hypot(x - v.x, z - v.z);
        if (dist > range || dist < 16) continue;
        blips.push({ x, z, type: C.chunkType[k], strength: Math.min(1, d / 30) });
      }
    }
    blips.sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z));
    this.blips = blips.slice(0, 48);
  }

  private finish(reason: EndReason) {
    this.ended = true;
    audio.silenceVehicle();
    const win = reason === 'cleaned';
    audio.play(win ? 'complete' : 'fail');
    const badges: string[] = [];
    const clean = this.cleanRatio;
    if (win) {
      if (clean >= 0.99) badges.push('Spotless — 99%+ clean');
      if (this.collisions === 0) badges.push('Zero collisions');
      if (this.fuel / this.fuelMax >= 0.4) badges.push('Fuel saver — 40%+ fuel left');
      if (this.condition >= 0.95) badges.push('Pristine truck');
    }
    this.cb.onEnd({
      win,
      reason,
      cityId: this.city.id,
      clean,
      items: this.cleaning.itemsCollected,
      areaCleaned: Math.round((this.cleaning.initialTotal - this.cleaning.total) * 0.25),
      fuel: this.fuel / this.fuelMax,
      condition: this.condition,
      reward: 0,
      distance: this.vehicle.distance,
      time: this.elapsed,
      collisions: this.collisions,
      badges,
    });
  }

  hudSnapshot(): HudSnapshot {
    const v = this.vehicle;
    let bearing: number | null = null;
    if (this.nearestDirt) {
      const dx = this.nearestDirt.x - v.x;
      const dz = this.nearestDirt.z - v.z;
      // Angle relative to forward, positive = to the right.
      const ang = Math.atan2(dx, dz) - v.heading;
      bearing = -Math.atan2(Math.sin(ang), Math.cos(ang));
    }
    return {
      clean: this.cleanRatio,
      fuel: this.fuel / this.fuelMax,
      condition: this.condition,
      speedKmh: Math.abs(v.speed) * 3.6,
      brushes: this.brushes,
      foam: this.foam / this.foamMax,
      foaming: this.foaming,
      lights: this.lights,
      camera: this.camera,
      radarRange: this.stats.radarRange,
      radarTier: this.stats.radarTier,
      radarBlips: this.radarDirtyChunks,
      dirtBearing: bearing,
      dirtDistance: this.nearestDirt?.d ?? null,
      items: this.cleaning.itemsCollected,
      lowFuel: this.fuel / this.fuelMax < 0.15,
      critical: this.condition < 0.25,
      onSidewalk: this.surface === SURF_SIDEWALK,
    };
  }

  // Debug helpers (exposed on window in dev builds).
  debug = {
    cleanTo: (ratio: number) => this.cleaning.debugCleanTo(ratio),
    setFuel: (f: number) => (this.fuel = f * this.fuelMax),
    setCondition: (c: number) => (this.condition = c),
    teleport: (x: number, z: number, h = 0) => this.vehicle.reset(x, z, h),
  };
}
