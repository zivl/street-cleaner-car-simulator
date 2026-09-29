import { useEffect, useState } from 'react';
import type { Game } from '../game/Game';
import { TIME_LABEL, WEATHER_LABEL } from '../game/Environment';
import { WIN_THRESHOLD, useHud, useSave, useToasts, useUI } from '../state/gameState';
import { Icon } from './icons';
import { MiniMap } from './MiniMap';
import { audio } from '../game/AudioSystem';

function Bar({ value, color, warn }: { value: number; color: string; warn?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`bar ${warn ? 'bar-warn' : ''}`}>
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      <div className="bar-ticks" />
    </div>
  );
}

function barColor(v: number) {
  return v > 0.5 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : v > 0.25 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#dc2626,#f87171)';
}

export function money(n: number) {
  return '$' + n.toLocaleString('en-US');
}

const TIME_ICON = { day: '☀️', evening: '🌇', night: '🌙' } as const;

export function HUD({ game, touch }: { game: Game; touch: boolean }) {
  const h = useHud();
  const cash = useSave((s) => s.money);
  const setPaused = useUI((s) => s.setPaused);
  const toasts = useToasts((s) => s.toasts);
  const [showHelp, setShowHelp] = useState(!touch);
  useEffect(() => {
    const t = setTimeout(() => setShowHelp(false), 14000);
    return () => clearTimeout(t);
  }, []);

  const pct = Math.floor(h.clean * 100);
  const goal = WIN_THRESHOLD * 100;
  const level = game.level;

  return (
    <div className={`hud ${touch ? 'hud-touch' : ''}`}>
      {/* Top-left: pause, city, money */}
      <div className="hud-tl">
        <button
          className="hud-icon-btn"
          aria-label="Pause"
          onClick={() => {
            audio.play('click');
            setPaused(true);
          }}
        >
          <Icon.pause size={20} />
        </button>
        <div className="hud-city panel">
          <div className="hud-city-name">{game.city.name}</div>
          <div className="hud-city-meta">
            {TIME_ICON[level.time]} {TIME_LABEL[level.time]} · {WEATHER_LABEL[level.weather]}
          </div>
        </div>
        <div className="hud-money panel">{money(cash)}</div>
      </div>

      {/* Top-center: cleaned % */}
      <div className="hud-clean panel">
        <div className="hud-clean-label">CLEANED</div>
        <div className={`hud-clean-value ${pct >= goal ? 'done' : ''}`}>
          {pct}
          <span>%</span>
        </div>
        <div className="clean-progress">
          <div className="clean-progress-fill" style={{ width: `${Math.min(100, (h.clean / WIN_THRESHOLD) * 100)}%` }} />
        </div>
        <div className="hud-clean-goal">Goal {goal}%</div>
        {h.dirtBearing !== null && h.dirtDistance !== null && (
          <div className="dirt-compass" title="Nearest dirt (radar)">
            <span className="dirt-arrow" style={{ transform: `rotate(${h.dirtBearing}rad)` }}>
              <Icon.arrowUp size={16} />
            </span>
            <span>{Math.round(h.dirtDistance)} m</span>
          </div>
        )}
      </div>

      {/* Toasts */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>

      {/* Warnings */}
      {(h.lowFuel || h.critical) && (
        <div className="hud-warn">
          {h.lowFuel && <div className="warn-chip">⛽ LOW FUEL</div>}
          {h.critical && <div className="warn-chip">⚠ CRITICAL DAMAGE</div>}
        </div>
      )}

      {/* Top-right: minimap */}
      <div className="hud-tr">
        <MiniMap game={game} size={touch ? 124 : 190} />
        <div className="radar-status panel">
          <Icon.radar size={14} />
          <span>RADAR {h.radarRange}m</span>
          <b>{h.radarBlips}</b>
        </div>
      </div>

      {/* Bottom-left: vehicle status */}
      <div className="hud-bl panel">
        <div className="speedo">
          <div className="speedo-value">{Math.round(h.speedKmh)}</div>
          <div className="speedo-unit">km/h</div>
        </div>
        <div className="status-rows">
          <div className="status-row">
            <Icon.fuel size={16} />
            <span className="status-label">FUEL</span>
            <Bar value={h.fuel} color={barColor(h.fuel)} warn={h.lowFuel} />
            <span className="status-num">{Math.round(h.fuel * 100)}%</span>
          </div>
          <div className="status-row">
            <Icon.wrench size={16} />
            <span className="status-label">VEHICLE</span>
            <Bar value={h.condition} color={barColor(h.condition)} warn={h.critical} />
            <span className="status-num">{Math.round(h.condition * 100)}%</span>
          </div>
          <div className="status-row">
            <Icon.foam size={16} />
            <span className="status-label">FOAM</span>
            <Bar value={h.foam} color="linear-gradient(90deg,#7dd3fc,#e0f2fe)" />
            <span className="status-num">{Math.round(h.foam * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Bottom-right: equipment (desktop) */}
      {!touch && (
        <div className="hud-br">
          <div className={`equip ${h.brushes ? 'on' : ''}`}>
            <Icon.brush size={18} />
            <span>BRUSHES</span>
            <b>{h.brushes ? 'ON' : 'OFF'}</b>
            <kbd>E</kbd>
          </div>
          <div className={`equip ${h.foaming ? 'on' : ''}`}>
            <Icon.foam size={18} />
            <span>FOAM</span>
            <b>{h.foaming ? 'SPRAY' : 'HOLD'}</b>
            <kbd>T</kbd>
          </div>
          <div className={`equip ${h.lights ? 'on' : ''}`}>
            <Icon.light size={18} />
            <span>LIGHTS</span>
            <b>{h.lights ? 'ON' : 'OFF'}</b>
            <kbd>F</kbd>
          </div>
          <div className="equip">
            <Icon.camera size={18} />
            <span>CAMERA</span>
            <b>{h.camera === 'first' ? '1ST' : '3RD'}</b>
            <kbd>C</kbd>
          </div>
        </div>
      )}

      {!h.brushes && h.clean < 0.02 && <div className="hint-bubble">{touch ? 'Tap 🧹 to lower the brushes' : 'Press E to lower the brushes and start cleaning'}</div>}

      {showHelp && (
        <div className="help-strip panel">
          <span>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> / arrows drive
          </span>
          <span>
            <kbd>E</kbd> brushes
          </span>
          <span>
            <kbd>T</kbd> foam (hold)
          </span>
          <span>
            <kbd>F</kbd> lights
          </span>
          <span>
            <kbd>C</kbd> camera
          </span>
          <span>
            <kbd>Esc</kbd> pause
          </span>
          <span>Drag to look around</span>
        </div>
      )}
    </div>
  );
}
