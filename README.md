# Street Cleaner — 3D Street Cleaning Simulator

A browser game where you drive a municipal street sweeper through procedurally generated open-world cities. Scrub at least **95 % of the dirty roads** before the fuel runs out. Every cleaned city pays **$500**, which you spend on six upgrade trees in the garage.

Built with React, TypeScript, Three.js, React Three Fiber and Vite. No external art or audio assets: geometry, textures and sound are all generated procedurally.

## Running locally

Requires Node 18+ (tested with Node 24).

```bash
npm install
npm run dev          # http://localhost:5173
```

Useful URL flags:

- `?touch` forces the mobile touch controls on desktop.
- `?debug` exposes `window.__game` in production builds (always on in dev).

## Production build

```bash
npm run build        # type-checks, then bundles to dist/
npm run preview      # serves dist/ locally
```

The output in `dist/` is a fully static site.

## Deploy (Vercel)

`vercel.json` is included (Vite framework preset, `dist` output, long-lived cache headers for hashed assets).

```bash
npx vercel login
npx vercel link
npx vercel --prod
```

You can also import the GitHub repository in the Vercel dashboard. Every push to `main` then deploys automatically.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Accelerate / forward | W / ↑ | GAS pedal |
| Brake / reverse | S / ↓ | BRAKE pedal |
| Steer | A D / ← → | Drag the steering wheel |
| Toggle brushes | E | Brush button |
| Spray foam (hold) | T | Foam button (hold) |
| Headlights | F | Lights button |
| First / third person camera | C | Camera button |
| Pause | Esc / P | Pause button (top-left) |
| Look around | Drag with the mouse | Drag on the screen |

## Gameplay

- **Cleaning.** The road surface is a 0.5 m grid. Each cell stores its dirt amount, dirt type and foam timer. When the brushes are down, the cells under the broom footprint are scrubbed. Progress is measured by the amount of dirt removed, not by distance driven.
- **Dirt types.**
  - *Leaves* are easy to clean.
  - *Trash* (bottles, cans, paper, boxes) is harder. Brush upgrades help with both.
  - *Oil* is roughly 3.4× tougher. It needs foam, slow passes or Cleaning Liquid upgrades.
- **Foam.** Hold T to lay foam ahead of the truck. Foamed cells clean much faster and slowly dissolve dirt by themselves. The tank refills slowly when you're not spraying.
- **Fuel.** Fuel is the only limit; there is no timer. Driving, idling and running the brushes all burn fuel. Fuel canisters are scattered around the city (yellow on the mini-map).
- **Damage.** Collisions with buildings, poles, trees, parked cars, barriers and traffic cost vehicle condition.
  - Below 25 % the truck goes into limp mode.
  - At 0 % it is towed and the level ends. Repair kits (green) restore condition.
- **Radar.** Radar reveals dirt within its range on the mini-map and as floating markers. Upgrades add, in order:
  - a nearest-dirt compass
  - dirt-type colours
  - area memory
  - long range
- **Cities.** There are seven cities: Tel Aviv, New York, London, Tokyo, Paris, Amsterdam and Berlin. Each has its own road grid, architecture, roofs, trees, street furniture, traffic and palette. London and Tokyo drive on the left. Each city is picked at random with a random time of day (day, evening or night) and weather (clear, rain or haze).

## Architecture

```
src/
  game/          Framework-free simulation (no React)
    Game.ts            Orchestrates one level: physics substeps, collisions, fuel,
                       damage, radar, pickups, win/lose, HUD snapshot
    VehiclePhysics.ts  Arcade bicycle-model truck physics
    Collision.ts       Spatial hash + circle-vs-box/circle contacts
    CityGenerator.ts   Seeded procedural city: road graph, blocks, lots,
                       buildings, props, parked cars, road works, pickups
    CleaningSystem.ts  Dirt grid, brush/foam footprints, chunk stats,
                       dirt items, radar scans, GPU texture data
    TrafficSystem.ts   Lane-following AI cars on the road graph
    AudioSystem.ts     WebAudio synth (engine, brushes, foam, SFX, music);
                       samples can replace any sound via registerSample()
    Environment.ts     Day / evening / night and weather presets
    Input.ts           Unified keyboard + touch input state
  scene/         React Three Fiber rendering (reads game state each frame)
    World.tsx          Merged/instanced city geometry
    DirtLayer.tsx      Dirt overlay shader (DataTexture) + instanced litter
    Truck.tsx          Procedural sweeper model + cockpit
    GameScene.tsx      Camera rig, traffic, pickups, radar markers, lighting, rain
    Effects.tsx        Pooled particles (dust, foam spray, sparks)
    ShowroomScene.tsx  Menu / garage 3D showcase
  components/    React UI: HUD, mini-map, mobile controls, menus, garage, results
  data/          Cities, upgrades, dirt types and vehicle definitions (data-driven)
  state/         Zustand stores: persisted save (localStorage), UI and HUD snapshot
```

Key design decisions:

- **The simulation runs outside React.** The R3F `useFrame` loop calls `game.update(dt)`, and meshes read the game's mutable fields directly. The HUD receives a small snapshot 10 times per second, so per-frame data never causes React re-renders.
- **Few draw calls.** Buildings are merged into one mesh per facade style. Props, trees, lamps, cars and dirt items use `InstancedMesh`. Particles come from fixed-size pools.
- **One texture for all road dirt.** The dirt overlay is a single transparent plane driven by the cleaning grid through a `DataTexture`, and the texture is uploaded at up to 30 Hz.
- **Data-driven content.** You can add a city, upgrade or dirt type by editing the files in `src/data/`.

## Persistence

Progress is saved to `localStorage` under `street-cleaner-save-v1`: money, upgrade levels, settings and statistics. You can reset it from the main menu or from Settings.

## Dependencies

- `react`, `react-dom`
- `three`, `@react-three/fiber`, `@react-three/drei` (Sky, Stars, OrbitControls, ContactShadows, Stats)
- `zustand`
- Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/*`

Fonts: Rajdhani and Inter, loaded from Google Fonts. No other external assets are used.
