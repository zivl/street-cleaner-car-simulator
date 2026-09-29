import { Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { audio } from '../game/AudioSystem';
import { Game } from '../game/Game';
import { input, isTouchDevice } from '../game/Input';
import { GameScene, type SceneQuality } from '../scene/GameScene';
import { LEVEL_REWARD, useHud, useSave, useToasts, useUI, type LevelSpec } from '../state/gameState';
import { HUD } from './HUD';
import { MobileControls } from './MobileControls';
import { CityIntro, PauseMenu, Results } from './Screens';

const QUALITY: Record<string, SceneQuality & { dpr: [number, number]; antialias: boolean }> = {
  low: { shadows: false, shadowSize: 512, density: 0.5, streetLights: 3, dpr: [0.75, 1], antialias: false },
  medium: { shadows: true, shadowSize: 1024, density: 0.8, streetLights: 5, dpr: [1, 1.5], antialias: true },
  high: { shadows: true, shadowSize: 2048, density: 1, streetLights: 8, dpr: [1, 2], antialias: true },
};

export function GameView({ level }: { level: LevelSpec }) {
  const qualityKey = useSave((s) => s.settings.quality);
  const showFps = useSave((s) => s.settings.showFps);
  const paused = useUI((s) => s.paused);
  const result = useUI((s) => s.result);
  const setPaused = useUI((s) => s.setPaused);
  const touch = useMemo(() => isTouchDevice(), []);

  const game = useMemo(() => {
    input.reset();
    return new Game(level, useSave.getState().upgrades, qualityKey, {
      onToast: (text, tone) => useToasts.getState().push(text, tone),
      onEnd: (r) => {
        const save = useSave.getState();
        let reward = 0;
        if (r.win) {
          save.awardLevel(r.cityId, r.items, r.clean);
          reward = LEVEL_REWARD;
        } else {
          save.recordAttempt(r.cityId, r.items, r.clean);
        }
        useUI.getState().setResult({ ...r, reward });
      },
    });
    // The game instance is tied to the level; quality changes rebuild the scene only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id]);

  useEffect(() => () => game.dispose(), [game]);

  // Keep upgrades in sync (e.g. none mid-level, but harmless).
  useEffect(() => useSave.subscribe((s) => game.applyUpgrades(s.upgrades)), [game]);

  game.paused = paused || !!result;
  useEffect(() => {
    if (game.paused) audio.silenceVehicle();
  }, [game, paused, result]);

  // HUD snapshot at ~10 Hz.
  useEffect(() => {
    const id = window.setInterval(() => useHud.setState(game.hudSnapshot()), 100);
    useHud.setState(game.hudSnapshot());
    return () => window.clearInterval(id);
  }, [game]);

  useEffect(() => input.onAction((a) => game.handleAction(a)), [game]);

  // Esc / P toggles pause.
  useEffect(
    () =>
      input.onAction((a) => {
        if (a !== 'pause' || game.ended) return;
        const ui = useUI.getState();
        if (ui.result) return;
        ui.setPaused(!ui.paused);
      }),
    [game],
  );

  // Dev-only debug handle for testing.
  useEffect(() => {
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
      (window as unknown as { __game: Game }).__game = game;
    }
  }, [game]);

  const q = QUALITY[qualityKey] ?? QUALITY.high;
  const sceneQuality: SceneQuality = {
    shadows: q.shadows,
    shadowSize: q.shadowSize,
    density: q.density,
    streetLights: game.env.streetLights > 0 ? q.streetLights : 0,
  };

  return (
    <div className="game-root">
      <Canvas
        key={qualityKey}
        shadows={q.shadows ? { type: THREE.PCFSoftShadowMap } : false}
        dpr={q.dpr}
        gl={{ antialias: q.antialias, powerPreference: 'high-performance' }}
        camera={{ fov: 72, near: 0.1, far: 1400, position: [0, 5, -10] }}
        onPointerDown={() => audio.unlock()}
      >
        <GameScene game={game} quality={sceneQuality} />
        {showFps && <Stats className="fps-stats" />}
      </Canvas>
      <HUD game={game} touch={touch} />
      {touch && !paused && !result && <MobileControls />}
      <CityIntro level={level} />
      {paused && !result && <PauseMenu onResume={() => setPaused(false)} />}
      {result && <Results result={result} />}
    </div>
  );
}
