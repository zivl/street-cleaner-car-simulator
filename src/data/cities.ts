export type TimeOfDay = 'day' | 'evening' | 'night';
export type Weather = 'clear' | 'rain' | 'haze';

export type FacadeStyle = 'bauhaus' | 'office' | 'brick' | 'haussmann' | 'canal' | 'concrete' | 'dense';
export type RoofStyle = 'flat' | 'mansard' | 'gable' | 'watertower' | 'chimney';
export type TreeStyle = 'palm' | 'round' | 'cone' | 'blossom';
export type PropKind = 'bench' | 'bin' | 'hydrant' | 'phonebox' | 'vending' | 'kiosk' | 'bollard' | 'planter';

export interface CityConfig {
  id: string;
  name: string;
  country: string;
  tagline: string;
  accent: string;
  driveLeft?: boolean;
  grid: {
    blocksX: [number, number];
    blocksZ: [number, number];
    blockSize: [number, number];
    roadWidth: number;
    avenueWidth: number;
    avenueEvery: number;
    /** Chance to remove an interior road segment (gives dead ends / irregular layout). */
    removeChance: number;
    sidewalk: number;
  };
  buildings: {
    facades: FacadeStyle[];
    roofs: RoofStyle[];
    floors: [number, number];
    floorHeight: number;
    /** Maximum lot size before subdividing. */
    lotSize: number;
    colors: string[];
    roofColor: string;
    awnings: boolean;
    balconies: boolean;
    neon: boolean;
    /** Chance a building is a tall tower (skyline accent). */
    towerChance: number;
  };
  palette: {
    asphalt: string;
    sidewalk: string;
    curb: string;
    grass: string;
    marking: string;
    centerLine: string;
    ground: string;
  };
  nature: {
    tree: TreeStyle;
    treeSpacing: number;
    parkChance: number;
    canalChance: number;
  };
  props: PropKind[];
  lampStyle: 'classic' | 'modern' | 'lantern';
  traffic: {
    cars: number;
    colors: string[];
    busColor?: string;
    busChance: number;
  };
  times: TimeOfDay[];
  weather: Weather[];
  /** Relative weights for leaves / oil / trash. */
  dirt: [number, number, number];
}

export const CITIES: CityConfig[] = [
  {
    id: 'tel-aviv',
    name: 'Tel Aviv',
    country: 'Israel',
    tagline: 'White City boulevards under the Mediterranean sun',
    accent: '#38bdf8',
    grid: { blocksX: [5, 6], blocksZ: [5, 6], blockSize: [30, 40], roadWidth: 7.5, avenueWidth: 11, avenueEvery: 3, removeChance: 0.12, sidewalk: 3 },
    buildings: {
      facades: ['bauhaus'],
      roofs: ['flat'],
      floors: [3, 6],
      floorHeight: 3.2,
      lotSize: 15,
      colors: ['#f4f1ea', '#efe9dc', '#e8f0ef', '#f7efe3', '#ffffff'],
      roofColor: '#d8d2c4',
      awnings: true,
      balconies: true,
      neon: false,
      towerChance: 0.04,
    },
    palette: { asphalt: '#3a3b3f', sidewalk: '#cfc7b8', curb: '#b8b0a0', grass: '#6d9b43', marking: '#f2f2f2', centerLine: '#f2f2f2', ground: '#c9bfa8' },
    nature: { tree: 'palm', treeSpacing: 11, parkChance: 0.12, canalChance: 0 },
    props: ['bench', 'bin', 'kiosk', 'planter'],
    lampStyle: 'modern',
    traffic: { cars: 14, colors: ['#e5e7eb', '#1f2937', '#9ca3af', '#2563eb', '#f5f5f4', '#b91c1c'], busColor: '#16a34a', busChance: 0.08 },
    times: ['day', 'day', 'evening', 'night'],
    weather: ['clear', 'clear', 'haze'],
    dirt: [0.3, 0.3, 0.4],
  },
  {
    id: 'new-york',
    name: 'New York',
    country: 'USA',
    tagline: 'Concrete canyons, yellow cabs and a city that never sleeps',
    accent: '#facc15',
    grid: { blocksX: [5, 6], blocksZ: [4, 5], blockSize: [32, 44], roadWidth: 8.5, avenueWidth: 12, avenueEvery: 2, removeChance: 0.04, sidewalk: 3.5 },
    buildings: {
      facades: ['office', 'brick', 'concrete'],
      roofs: ['watertower', 'flat', 'flat'],
      floors: [6, 16],
      floorHeight: 3.4,
      lotSize: 22,
      colors: ['#9aa3ad', '#8b5e4a', '#b9a58a', '#6b7280', '#c8b89a', '#7c8a99'],
      roofColor: '#4b4f55',
      awnings: true,
      balconies: false,
      neon: false,
      towerChance: 0.25,
    },
    palette: { asphalt: '#2f3034', sidewalk: '#a8a8a3', curb: '#8f8f8a', grass: '#4f7d38', marking: '#f5f5f5', centerLine: '#f6c343', ground: '#8a8a86' },
    nature: { tree: 'round', treeSpacing: 16, parkChance: 0.06, canalChance: 0 },
    props: ['hydrant', 'bin', 'kiosk', 'bench'],
    lampStyle: 'modern',
    traffic: { cars: 18, colors: ['#facc15', '#facc15', '#facc15', '#111827', '#e5e7eb', '#1e3a8a'], busColor: '#1d4ed8', busChance: 0.1 },
    times: ['day', 'evening', 'night', 'night'],
    weather: ['clear', 'rain', 'haze'],
    dirt: [0.2, 0.35, 0.45],
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    tagline: 'Brick terraces, red buses and a chance of drizzle',
    accent: '#ef4444',
    driveLeft: true,
    grid: { blocksX: [5, 6], blocksZ: [5, 6], blockSize: [26, 36], roadWidth: 7, avenueWidth: 10, avenueEvery: 3, removeChance: 0.2, sidewalk: 2.8 },
    buildings: {
      facades: ['brick', 'brick', 'haussmann'],
      roofs: ['chimney', 'gable', 'flat'],
      floors: [3, 5],
      floorHeight: 3.3,
      lotSize: 10,
      colors: ['#8b3a2b', '#9b4a36', '#7a3326', '#d9cdb4', '#a5553d', '#efe6d2'],
      roofColor: '#3f3a40',
      awnings: false,
      balconies: false,
      neon: false,
      towerChance: 0.03,
    },
    palette: { asphalt: '#34353a', sidewalk: '#9b9a95', curb: '#7d7c78', grass: '#4a7a36', marking: '#f5f5f5', centerLine: '#f5f5f5', ground: '#6f7f5b' },
    nature: { tree: 'round', treeSpacing: 13, parkChance: 0.14, canalChance: 0 },
    props: ['phonebox', 'bin', 'bench', 'bollard'],
    lampStyle: 'classic',
    traffic: { cars: 14, colors: ['#111827', '#374151', '#e5e7eb', '#7f1d1d', '#1f2937'], busColor: '#dc2626', busChance: 0.3 },
    times: ['day', 'evening', 'night'],
    weather: ['rain', 'rain', 'clear', 'haze'],
    dirt: [0.45, 0.25, 0.3],
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    tagline: 'Neon alleys, vending machines and tidy chaos',
    accent: '#f472b6',
    driveLeft: true,
    grid: { blocksX: [6, 7], blocksZ: [6, 7], blockSize: [22, 30], roadWidth: 6.5, avenueWidth: 10, avenueEvery: 3, removeChance: 0.16, sidewalk: 2.2 },
    buildings: {
      facades: ['dense', 'office', 'concrete'],
      roofs: ['flat'],
      floors: [3, 9],
      floorHeight: 3.1,
      lotSize: 9,
      colors: ['#d6d3d1', '#e7e5e4', '#a8a29e', '#f5f5f4', '#cbd5e1', '#fde68a'],
      roofColor: '#57534e',
      awnings: true,
      balconies: true,
      neon: true,
      towerChance: 0.12,
    },
    palette: { asphalt: '#303137', sidewalk: '#b3b0aa', curb: '#96938e', grass: '#5e8c3d', marking: '#f5f5f5', centerLine: '#f5f5f5', ground: '#8f8c86' },
    nature: { tree: 'blossom', treeSpacing: 14, parkChance: 0.06, canalChance: 0 },
    props: ['vending', 'bin', 'bollard', 'planter'],
    lampStyle: 'modern',
    traffic: { cars: 16, colors: ['#f5f5f5', '#e5e7eb', '#111827', '#9ca3af', '#0ea5e9', '#16a34a'], busColor: '#e5e7eb', busChance: 0.08 },
    times: ['evening', 'night', 'night', 'day'],
    weather: ['clear', 'rain', 'clear'],
    dirt: [0.25, 0.3, 0.45],
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    tagline: 'Grand boulevards, mansard roofs and autumn leaves',
    accent: '#a78bfa',
    grid: { blocksX: [5, 6], blocksZ: [5, 6], blockSize: [30, 40], roadWidth: 8, avenueWidth: 13, avenueEvery: 2, removeChance: 0.1, sidewalk: 3.4 },
    buildings: {
      facades: ['haussmann'],
      roofs: ['mansard'],
      floors: [5, 7],
      floorHeight: 3.3,
      lotSize: 14,
      colors: ['#e8dcc2', '#efe4cc', '#e2d4b5', '#f1e8d6', '#ddd0b3'],
      roofColor: '#5b6470',
      awnings: true,
      balconies: true,
      neon: false,
      towerChance: 0,
    },
    palette: { asphalt: '#3b3a3c', sidewalk: '#c4b9a3', curb: '#a89e8a', grass: '#6a8f45', marking: '#f5f5f5', centerLine: '#f5f5f5', ground: '#b9ad95' },
    nature: { tree: 'round', treeSpacing: 9, parkChance: 0.1, canalChance: 0 },
    props: ['kiosk', 'bench', 'bin', 'bollard'],
    lampStyle: 'lantern',
    traffic: { cars: 14, colors: ['#e5e7eb', '#1f2937', '#6b7280', '#1e40af', '#991b1b', '#f5f5f4'], busChance: 0.05, busColor: '#16a34a' },
    times: ['day', 'evening', 'evening', 'night'],
    weather: ['clear', 'haze', 'rain'],
    dirt: [0.55, 0.2, 0.25],
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    country: 'Netherlands',
    tagline: 'Gabled canal houses and waterfront streets',
    accent: '#fb923c',
    grid: { blocksX: [5, 6], blocksZ: [5, 6], blockSize: [26, 34], roadWidth: 6.5, avenueWidth: 9, avenueEvery: 4, removeChance: 0.14, sidewalk: 2.4 },
    buildings: {
      facades: ['canal'],
      roofs: ['gable'],
      floors: [3, 5],
      floorHeight: 3.2,
      lotSize: 7,
      colors: ['#5b3a29', '#7a4a33', '#2f3b33', '#8a2f2f', '#3c3f4a', '#c9b79c', '#6b4f3a'],
      roofColor: '#2d2a2a',
      awnings: false,
      balconies: false,
      neon: false,
      towerChance: 0,
    },
    palette: { asphalt: '#3a3a3d', sidewalk: '#9c7b6a', curb: '#7f6556', grass: '#5e8a3e', marking: '#f5f5f5', centerLine: '#f5f5f5', ground: '#77705e' },
    nature: { tree: 'round', treeSpacing: 10, parkChance: 0.06, canalChance: 0.2 },
    props: ['bollard', 'bench', 'bin', 'planter'],
    lampStyle: 'classic',
    traffic: { cars: 10, colors: ['#e5e7eb', '#1f2937', '#9ca3af', '#b45309', '#1e3a8a'], busChance: 0.05, busColor: '#2563eb' },
    times: ['day', 'evening', 'night'],
    weather: ['clear', 'rain', 'haze'],
    dirt: [0.45, 0.2, 0.35],
  },
  {
    id: 'berlin',
    name: 'Berlin',
    country: 'Germany',
    tagline: 'Wide streets, concrete blocks and colourful graffiti',
    accent: '#22c55e',
    grid: { blocksX: [5, 6], blocksZ: [5, 6], blockSize: [34, 44], roadWidth: 8, avenueWidth: 12, avenueEvery: 3, removeChance: 0.08, sidewalk: 3.6 },
    buildings: {
      facades: ['concrete', 'office', 'brick'],
      roofs: ['flat', 'flat', 'gable'],
      floors: [4, 8],
      floorHeight: 3.2,
      lotSize: 18,
      colors: ['#b8b4ab', '#d1ccc0', '#8f8b83', '#e0d7c3', '#9fb0a0', '#c79a6b'],
      roofColor: '#4a4a48',
      awnings: false,
      balconies: true,
      neon: false,
      towerChance: 0.08,
    },
    palette: { asphalt: '#36373a', sidewalk: '#a39f97', curb: '#86827b', grass: '#5a8440', marking: '#f5f5f5', centerLine: '#f5f5f5', ground: '#8b8b7c' },
    nature: { tree: 'cone', treeSpacing: 12, parkChance: 0.12, canalChance: 0 },
    props: ['kiosk', 'bin', 'bench', 'bollard'],
    lampStyle: 'modern',
    traffic: { cars: 14, colors: ['#e5e7eb', '#111827', '#6b7280', '#fde047', '#1e3a8a', '#a3a3a3'], busColor: '#facc15', busChance: 0.12 },
    times: ['day', 'evening', 'night'],
    weather: ['clear', 'haze', 'rain'],
    dirt: [0.35, 0.3, 0.35],
  },
];

export function cityById(id: string): CityConfig {
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}
