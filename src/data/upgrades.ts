export type UpgradeId = 'brushes' | 'radar' | 'engine' | 'wheels' | 'liquid' | 'foam';

export type UpgradeLevels = Record<UpgradeId, number>;

export const MAX_UPGRADE_LEVEL = 5;

/** Cost to go from level N to N+1, indexed by current level (index 0 unused). */
export const UPGRADE_COSTS = [0, 200, 350, 600, 900];

export interface StatDef {
  key: string;
  label: string;
  /** One value per level (index 0 = level 1). */
  values: number[];
  unit?: string;
  /** How values are displayed. `pct` shows the value as a +% delta relative to level 1. */
  format: 'number' | 'pct' | 'text';
  decimals?: number;
  labels?: string[];
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  color: string;
  description: string;
  stats: StatDef[];
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'brushes',
    name: 'Brushes',
    icon: 'brush',
    color: '#ffb020',
    description: 'Wider, faster sweeper brooms. Better at picking up leaves and trash.',
    stats: [
      { key: 'width', label: 'Cleaning width', values: [3.2, 3.7, 4.2, 4.8, 5.5], unit: 'm', format: 'number', decimals: 1 },
      { key: 'rate', label: 'Cleaning speed', values: [1, 1.15, 1.3, 1.5, 1.75], format: 'pct' },
      { key: 'debris', label: 'Leaves & trash pickup', values: [1, 1.12, 1.25, 1.42, 1.6], format: 'pct' },
    ],
  },
  {
    id: 'radar',
    name: 'Radar',
    icon: 'radar',
    color: '#3de0ff',
    description: 'Detects dirt from farther away and reveals more on the mini-map.',
    stats: [
      { key: 'range', label: 'Detection range', values: [40, 65, 95, 135, 190], unit: 'm', format: 'number' },
      {
        key: 'tier',
        label: 'Mini-map intel',
        values: [1, 2, 3, 4, 5],
        format: 'text',
        labels: ['Nearby blips', '+ Dirt compass', '+ Dirt types', '+ Area scan', '+ Long-range scan'],
      },
    ],
  },
  {
    id: 'engine',
    name: 'Engine',
    icon: 'engine',
    color: '#ff5a4f',
    description: 'More torque, higher top speed and better fuel efficiency.',
    stats: [
      { key: 'accel', label: 'Acceleration', values: [2.6, 3.0, 3.4, 3.9, 4.5], format: 'pct' },
      { key: 'maxSpeed', label: 'Top speed', values: [42, 48, 54, 60, 67], unit: 'km/h', format: 'number' },
      { key: 'efficiency', label: 'Fuel efficiency', values: [1, 1.12, 1.26, 1.42, 1.6], format: 'pct' },
    ],
  },
  {
    id: 'wheels',
    name: 'Wheels',
    icon: 'wheel',
    color: '#a78bfa',
    description: 'Sharper steering, more grip, and sturdier suspension that shrugs off bumps.',
    stats: [
      { key: 'steer', label: 'Steering', values: [1.7, 2.0, 2.3, 2.6, 3.0], format: 'pct' },
      { key: 'grip', label: 'Traction', values: [5, 6.5, 8, 9.5, 11.5], format: 'pct' },
      { key: 'stability', label: 'Impact damage', values: [1, 0.88, 0.76, 0.64, 0.5], format: 'pct' },
    ],
  },
  {
    id: 'liquid',
    name: 'Cleaning Liquid',
    icon: 'drop',
    color: '#4ade80',
    description: 'Stronger detergent. Fewer passes needed, and oil stains come off much faster.',
    stats: [
      { key: 'clean', label: 'Cleaning power', values: [1, 1.12, 1.25, 1.4, 1.6], format: 'pct' },
      { key: 'oil', label: 'Oil removal', values: [1, 1.35, 1.75, 2.25, 2.9], format: 'pct' },
    ],
  },
  {
    id: 'foam',
    name: 'Foam',
    icon: 'foam',
    color: '#f0f4ff',
    description: 'Bigger foam tank with a wider, longer and more potent spray.',
    stats: [
      { key: 'capacity', label: 'Tank capacity', values: [100, 130, 165, 205, 260], unit: 'L', format: 'number' },
      { key: 'range', label: 'Spray range', values: [6, 7, 8.5, 10, 12], unit: 'm', format: 'number', decimals: 1 },
      { key: 'width', label: 'Spray width', values: [3, 3.5, 4.1, 4.7, 5.5], unit: 'm', format: 'number', decimals: 1 },
      { key: 'power', label: 'Foam power', values: [1.8, 2.1, 2.45, 2.85, 3.4], format: 'pct' },
    ],
  },
];

export const DEFAULT_UPGRADES: UpgradeLevels = {
  brushes: 1,
  radar: 1,
  engine: 1,
  wheels: 1,
  liquid: 1,
  foam: 1,
};

export function upgradeDef(id: UpgradeId): UpgradeDef {
  return UPGRADES.find((u) => u.id === id)!;
}

export function upgradeCost(level: number): number | null {
  return level >= MAX_UPGRADE_LEVEL ? null : UPGRADE_COSTS[level];
}

export function statValue(levels: UpgradeLevels, id: UpgradeId, key: string): number {
  const def = upgradeDef(id);
  const stat = def.stats.find((s) => s.key === key)!;
  const lvl = Math.max(1, Math.min(MAX_UPGRADE_LEVEL, levels[id] ?? 1));
  return stat.values[lvl - 1];
}

export function formatStat(stat: StatDef, level: number): string {
  const v = stat.values[level - 1];
  if (stat.format === 'text') return stat.labels?.[level - 1] ?? String(v);
  if (stat.format === 'pct') {
    const base = stat.values[0];
    const delta = Math.round((v / base - 1) * 100);
    return delta === 0 ? 'Base' : `${delta > 0 ? '+' : ''}${delta}%`;
  }
  return `${v.toFixed(stat.decimals ?? 0)}${stat.unit ? ' ' + stat.unit : ''}`;
}
