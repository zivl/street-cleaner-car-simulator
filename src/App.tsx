import { useEffect } from 'react';
import { GameView } from './components/GameView';
import { Garage, MainMenu, Settings } from './components/Screens';
import { audio } from './game/AudioSystem';
import { input } from './game/Input';
import { useSave, useUI } from './state/gameState';

if (import.meta.env.DEV) {
  // Handles for manual / automated testing in development builds.
  Object.assign(window, { __ui: useUI, __save: useSave });
}

export default function App() {
  const screen = useUI((s) => s.screen);
  const settingsReturn = useUI((s) => s.settingsReturn);
  const level = useUI((s) => s.level);
  const soundVolume = useSave((s) => s.settings.soundVolume);
  const musicVolume = useSave((s) => s.settings.musicVolume);

  useEffect(() => {
    input.attach();
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => audio.setVolumes(soundVolume, musicVolume), [soundVolume, musicVolume]);

  // Keep the game mounted (paused) while settings are opened from the pause menu.
  const inGame = level && (screen === 'playing' || (screen === 'settings' && settingsReturn === 'playing'));

  return (
    <div className="app">
      {inGame && <GameView key={level.id} level={level} />}
      {screen === 'menu' && <MainMenu />}
      {screen === 'garage' && <Garage />}
      {screen === 'settings' && <Settings />}
    </div>
  );
}
