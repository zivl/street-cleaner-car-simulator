import { statValue, type UpgradeLevels } from './upgrades';

export interface VehicleDef {
  id: string;
  name: string;
  length: number;
  width: number;
  wheelBase: number;
  /** Collision circles along the body (local z offsets). */
  hitCircles: number[];
  hitRadius: number;
  fuelCapacity: number;
  /** Fuel units per metre driven at efficiency 1. */
  fuelPerMeter: number;
  fuelIdlePerSec: number;
  fuelBrushPerSec: number;
}

export const SWEEPER: VehicleDef = {
  id: 'cityvac',
  name: 'CityVac 3000',
  length: 6.6,
  width: 2.4,
  wheelBase: 3.9,
  hitCircles: [-2.3, -0.75, 0.8, 2.35],
  hitRadius: 1.2,
  fuelCapacity: 100,
  fuelPerMeter: 0.009,
  fuelIdlePerSec: 0.012,
  fuelBrushPerSec: 0.02,
};

/** Derived, gameplay-ready vehicle stats for a set of upgrade levels. */
export interface VehicleStats {
  brushWidth: number;
  brushRate: number;
  debrisMult: number;
  radarRange: number;
  radarTier: number;
  accel: number;
  maxSpeed: number; // m/s
  fuelEfficiency: number;
  steerRate: number;
  grip: number;
  maxSteer: number;
  damageMult: number;
  cleanMult: number;
  oilMult: number;
  foamCapacity: number;
  foamRange: number;
  foamWidth: number;
  foamPower: number;
}

export function computeVehicleStats(levels: UpgradeLevels): VehicleStats {
  const s = (id: keyof UpgradeLevels, key: string) => statValue(levels, id, key);
  return {
    brushWidth: s('brushes', 'width'),
    brushRate: s('brushes', 'rate'),
    debrisMult: s('brushes', 'debris'),
    radarRange: s('radar', 'range'),
    radarTier: s('radar', 'tier'),
    accel: s('engine', 'accel'),
    maxSpeed: s('engine', 'maxSpeed') / 3.6,
    fuelEfficiency: s('engine', 'efficiency'),
    steerRate: s('wheels', 'steer'),
    grip: s('wheels', 'grip'),
    maxSteer: 0.52 + (levels.wheels - 1) * 0.04,
    damageMult: s('wheels', 'stability'),
    cleanMult: s('liquid', 'clean'),
    oilMult: s('liquid', 'oil'),
    foamCapacity: s('foam', 'capacity'),
    foamRange: s('foam', 'range'),
    foamWidth: s('foam', 'width'),
    foamPower: s('foam', 'power'),
  };
}
