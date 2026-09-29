import type { TimeOfDay, Weather } from '../data/cities';

export interface EnvPreset {
  sunColor: string;
  sunIntensity: number;
  sunElevation: number; // degrees
  sunAzimuth: number; // degrees
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fog: string;
  fogNear: number;
  fogFar: number;
  background: string;
  useSky: boolean;
  turbidity: number;
  rayleigh: number;
  exposure: number;
  windowGlow: number;
  lampGlow: number;
  streetLights: number;
  stars: boolean;
}

const PRESETS: Record<TimeOfDay, EnvPreset> = {
  day: {
    sunColor: '#fff4e0',
    sunIntensity: 3.0,
    sunElevation: 55,
    sunAzimuth: 35,
    hemiSky: '#cfe6ff',
    hemiGround: '#6b6457',
    hemiIntensity: 1.1,
    fog: '#c9dcef',
    fogNear: 90,
    fogFar: 380,
    background: '#9cc9f0',
    useSky: true,
    turbidity: 6,
    rayleigh: 1.2,
    exposure: 0.95,
    windowGlow: 0,
    lampGlow: 0,
    streetLights: 0,
    stars: false,
  },
  evening: {
    sunColor: '#ffae6b',
    sunIntensity: 1.9,
    sunElevation: 7,
    sunAzimuth: 250,
    hemiSky: '#f6b48a',
    hemiGround: '#3e3446',
    hemiIntensity: 0.75,
    fog: '#d99a86',
    fogNear: 70,
    fogFar: 320,
    background: '#e29b7a',
    useSky: true,
    turbidity: 10,
    rayleigh: 3,
    exposure: 0.9,
    windowGlow: 0.55,
    lampGlow: 1.2,
    streetLights: 0.5,
    stars: false,
  },
  night: {
    sunColor: '#9fb6ff',
    sunIntensity: 0.25,
    sunElevation: 40,
    sunAzimuth: 140,
    hemiSky: '#2a3c6b',
    hemiGround: '#141018',
    hemiIntensity: 0.22,
    fog: '#0c1224',
    fogNear: 40,
    fogFar: 230,
    background: '#070b18',
    useSky: false,
    turbidity: 0,
    rayleigh: 0,
    exposure: 1.0,
    windowGlow: 0.9,
    lampGlow: 2.6,
    streetLights: 1,
    stars: true,
  },
};

export function envPreset(time: TimeOfDay, weather: Weather): EnvPreset {
  const p = { ...PRESETS[time] };
  if (weather === 'rain') {
    p.sunIntensity *= 0.45;
    p.hemiIntensity *= 0.85;
    p.fogNear *= 0.55;
    p.fogFar *= 0.6;
    p.fog = time === 'night' ? '#0d1220' : time === 'evening' ? '#6f6470' : '#9aa6b3';
    p.background = p.fog;
    p.useSky = false;
    p.stars = false;
    if (time !== 'night') p.windowGlow = Math.max(p.windowGlow, 0.25);
  } else if (weather === 'haze') {
    p.fogNear *= 0.6;
    p.fogFar *= 0.7;
    p.turbidity += 6;
  }
  return p;
}

export const TIME_LABEL: Record<TimeOfDay, string> = { day: 'Day', evening: 'Evening', night: 'Night' };
export const WEATHER_LABEL: Record<Weather, string> = { clear: 'Clear', rain: 'Rain', haze: 'Hazy' };
