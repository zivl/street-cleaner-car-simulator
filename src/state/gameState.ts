import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_UPGRADES, MAX_UPGRADE_LEVEL, upgradeCost, type UpgradeId, type UpgradeLevels } from '../data/upgrades';
import { CITIES, type TimeOfDay, type Weather } from '../data/cities';
import { randomSeed } from '../game/random';

export const LEVEL_REWARD = 500;
export const WIN_THRESHOLD = 0.95;

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  soundVolume: number;
  musicVolume: number;
  quality: Quality;
  cameraSensitivity: number;
  showFps: boolean;
}

export interface Stats {
  citiesCleaned: number;
  levelsPlayed: number;
  totalItems: number;
  totalMoneyEarned: number;
  bestClean: number;
  cleanedCities: string[];
}

interface SaveState {
  money: number;
  upgrades: UpgradeLevels;
  settings: Settings;
  stats: Stats;
  lastCityId: string | null;
  buyUpgrade: (id: UpgradeId) => boolean;
  awardLevel: (cityId: string, items: number, clean: number) => void;
  recordAttempt: (cityId: string, items: number, clean: number) => void;
  updateSettings: (s: Partial<Settings>) => void;
  resetProgress: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  soundVolume: 0.8,
  musicVolume: 0.4,
  quality: 'high',
  cameraSensitivity: 1,
  showFps: false,
};

const DEFAULT_STATS: Stats = {
  citiesCleaned: 0,
  levelsPlayed: 0,
  totalItems: 0,
  totalMoneyEarned: 0,
  bestClean: 0,
  cleanedCities: [],
};

export const useSave = create<SaveState>()(
  persist(
    (set, get) => ({
      money: 0,
      upgrades: { ...DEFAULT_UPGRADES },
      settings: { ...DEFAULT_SETTINGS },
      stats: { ...DEFAULT_STATS },
      lastCityId: null,
      buyUpgrade: (id) => {
        const { money, upgrades } = get();
        const lvl = upgrades[id];
        const cost = upgradeCost(lvl);
        if (cost === null || lvl >= MAX_UPGRADE_LEVEL || money < cost) return false;
        set({ money: money - cost, upgrades: { ...upgrades, [id]: lvl + 1 } });
        return true;
      },
      awardLevel: (cityId, items, clean) => {
        const { money, stats } = get();
        set({
          money: money + LEVEL_REWARD,
          stats: {
            ...stats,
            citiesCleaned: stats.citiesCleaned + 1,
            levelsPlayed: stats.levelsPlayed + 1,
            totalItems: stats.totalItems + items,
            totalMoneyEarned: stats.totalMoneyEarned + LEVEL_REWARD,
            bestClean: Math.max(stats.bestClean, clean),
            cleanedCities: stats.cleanedCities.includes(cityId) ? stats.cleanedCities : [...stats.cleanedCities, cityId],
          },
        });
      },
      recordAttempt: (_cityId, items, clean) => {
        const { stats } = get();
        set({
          stats: {
            ...stats,
            levelsPlayed: stats.levelsPlayed + 1,
            totalItems: stats.totalItems + items,
            bestClean: Math.max(stats.bestClean, clean),
          },
        });
      },
      updateSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      resetProgress: () =>
        set({
          money: 0,
          upgrades: { ...DEFAULT_UPGRADES },
          stats: { ...DEFAULT_STATS },
          lastCityId: null,
        }),
    }),
    {
      name: 'street-cleaner-save-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        money: s.money,
        upgrades: s.upgrades,
        settings: s.settings,
        stats: s.stats,
        lastCityId: s.lastCityId,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SaveState>;
        return {
          ...current,
          ...p,
          upgrades: { ...DEFAULT_UPGRADES, ...(p.upgrades ?? {}) },
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
          stats: { ...DEFAULT_STATS, ...(p.stats ?? {}) },
        };
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Session / UI state (not persisted)

export type Screen = 'menu' | 'garage' | 'settings' | 'playing';

export interface LevelSpec {
  id: number;
  cityId: string;
  seed: number;
  time: TimeOfDay;
  weather: Weather;
}

export type EndReason = 'cleaned' | 'fuel' | 'wrecked' | 'quit';

export interface LevelResult {
  win: boolean;
  reason: EndReason;
  cityId: string;
  clean: number;
  items: number;
  areaCleaned: number;
  fuel: number;
  condition: number;
  reward: number;
  distance: number;
  time: number;
  collisions: number;
  badges: string[];
}

interface UIState {
  screen: Screen;
  settingsReturn: Screen;
  level: LevelSpec | null;
  result: LevelResult | null;
  paused: boolean;
  go: (screen: Screen) => void;
  openSettings: () => void;
  closeSettings: () => void;
  startNewCity: () => void;
  restartLevel: () => void;
  setResult: (r: LevelResult | null) => void;
  setPaused: (p: boolean) => void;
}

let levelCounter = 1;

function pickTime(times: TimeOfDay[]) {
  return times[Math.floor(Math.random() * times.length)];
}

export function makeLevel(cityId?: string): LevelSpec {
  const last = useSave.getState().lastCityId;
  let city = cityId ? CITIES.find((c) => c.id === cityId)! : undefined;
  if (!city) {
    const pool = CITIES.filter((c) => c.id !== last);
    city = pool[Math.floor(Math.random() * pool.length)];
  }
  useSave.setState({ lastCityId: city.id });
  return {
    id: levelCounter++,
    cityId: city.id,
    seed: randomSeed(),
    time: pickTime(city.times),
    weather: city.weather[Math.floor(Math.random() * city.weather.length)],
  };
}

export const useUI = create<UIState>()((set, get) => ({
  screen: 'menu',
  settingsReturn: 'menu',
  level: null,
  result: null,
  paused: false,
  go: (screen) => set({ screen, paused: false }),
  openSettings: () => set({ settingsReturn: get().screen === 'settings' ? 'menu' : get().screen, screen: 'settings' }),
  closeSettings: () => set({ screen: get().settingsReturn }),
  startNewCity: () => set({ level: makeLevel(), result: null, paused: false, screen: 'playing' }),
  restartLevel: () => {
    const lvl = get().level;
    if (!lvl) return get().startNewCity();
    set({ level: { ...lvl, id: levelCounter++ }, result: null, paused: false, screen: 'playing' });
  },
  setResult: (result) => set({ result }),
  setPaused: (paused) => set({ paused }),
}));

// ---------------------------------------------------------------------------
// HUD snapshot — updated ~10x/sec from the game loop, read by React HUD.

export interface HudSnapshot {
  clean: number;
  fuel: number;
  condition: number;
  speedKmh: number;
  brushes: boolean;
  foam: number;
  foaming: boolean;
  lights: boolean;
  camera: 'first' | 'third';
  radarRange: number;
  radarTier: number;
  radarBlips: number;
  dirtBearing: number | null;
  dirtDistance: number | null;
  items: number;
  lowFuel: boolean;
  critical: boolean;
  onSidewalk: boolean;
}

export const useHud = create<HudSnapshot>()(() => ({
  clean: 0,
  fuel: 1,
  condition: 1,
  speedKmh: 0,
  brushes: false,
  foam: 1,
  foaming: false,
  lights: false,
  camera: 'first',
  radarRange: 40,
  radarTier: 1,
  radarBlips: 0,
  dirtBearing: null,
  dirtDistance: null,
  items: 0,
  lowFuel: false,
  critical: false,
  onSidewalk: false,
}));

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'warn' | 'bad';
}

interface ToastState {
  toasts: Toast[];
  push: (text: string, tone?: Toast['tone']) => void;
}

let toastId = 1;
export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (text, tone = 'info') => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600);
  },
}));
