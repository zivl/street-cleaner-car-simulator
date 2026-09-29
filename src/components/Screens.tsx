import { useEffect, useState } from 'react';
import { CITIES, cityById } from '../data/cities';
import { MAX_UPGRADE_LEVEL, UPGRADES, formatStat, upgradeCost, type UpgradeDef } from '../data/upgrades';
import { audio } from '../game/AudioSystem';
import { TIME_LABEL, WEATHER_LABEL } from '../game/Environment';
import { ShowroomScene } from '../scene/ShowroomScene';
import { LEVEL_REWARD, WIN_THRESHOLD, useSave, useUI, type LevelResult, type LevelSpec, type Quality } from '../state/gameState';
import { money } from './HUD';
import { Icon, UpgradeIcon } from './icons';

const click = () => audio.play('click');

export function ConfirmDialog({ title, text, confirm, onConfirm, onCancel }: { title: string; text: string; confirm: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="modal-actions">
          <button
            className="btn ghost"
            onClick={() => {
              click();
              onCancel();
            }}
          >
            Cancel
          </button>
          <button
            className="btn danger"
            onClick={() => {
              click();
              onConfirm();
            }}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main menu ---------------------------------------------------------------------

export function MainMenu() {
  const startNewCity = useUI((s) => s.startNewCity);
  const go = useUI((s) => s.go);
  const openSettings = useUI((s) => s.openSettings);
  const cash = useSave((s) => s.money);
  const stats = useSave((s) => s.stats);
  const reset = useSave((s) => s.resetProgress);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="screen menu-screen">
      <ShowroomScene mode="menu" />
      <div className="menu-overlay">
        <div className="menu-brand">
          <div className="brand-kicker">3D STREET CLEANING SIMULATOR</div>
          <h1 className="brand-title">
            STREET
            <br />
            <span>CLEANER</span>
          </h1>
          <p className="brand-sub">Drive a municipal sweeper through 7 cities. Scrub 95% of the dirty roads before your fuel runs dry, earn cash and upgrade your truck.</p>
          <div className="menu-stats">
            <div>
              <b>{money(cash)}</b>
              <span>Balance</span>
            </div>
            <div>
              <b>{stats.citiesCleaned}</b>
              <span>Cities cleaned</span>
            </div>
            <div>
              <b>{stats.totalItems.toLocaleString()}</b>
              <span>Items collected</span>
            </div>
          </div>
        </div>
        <nav className="menu-buttons">
          <button
            className="btn primary big"
            onClick={() => {
              audio.unlock();
              click();
              startNewCity();
            }}
          >
            <Icon.play size={20} /> START GAME
          </button>
          <button
            className="btn big"
            onClick={() => {
              audio.unlock();
              click();
              go('garage');
            }}
          >
            <Icon.garage size={20} /> GARAGE
          </button>
          <button
            className="btn big"
            onClick={() => {
              audio.unlock();
              click();
              openSettings();
            }}
          >
            <Icon.settings size={20} /> SETTINGS
          </button>
          <button
            className="btn ghost big"
            onClick={() => {
              audio.unlock();
              click();
              setConfirm(true);
            }}
          >
            <Icon.restart size={20} /> RESET PROGRESS
          </button>
        </nav>
        <div className="menu-cities">
          {CITIES.map((c) => (
            <span key={c.id} className={stats.cleanedCities.includes(c.id) ? 'done' : ''} style={{ ['--accent' as string]: c.accent }}>
              {stats.cleanedCities.includes(c.id) && <Icon.check size={12} />} {c.name}
            </span>
          ))}
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Reset progress?"
          text="Your money, upgrades and statistics will be wiped. Settings are kept."
          confirm="Reset"
          onConfirm={() => {
            reset();
            setConfirm(false);
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

// --- Garage / upgrade shop -----------------------------------------------------------

function UpgradeCard({ def }: { def: UpgradeDef }) {
  const level = useSave((s) => s.upgrades[def.id]);
  const cash = useSave((s) => s.money);
  const buy = useSave((s) => s.buyUpgrade);
  const cost = upgradeCost(level);
  const maxed = level >= MAX_UPGRADE_LEVEL;
  const affordable = cost !== null && cash >= cost;
  const [flash, setFlash] = useState(false);

  return (
    <div className={`upgrade-card panel ${flash ? 'flash' : ''}`} style={{ ['--accent' as string]: def.color }}>
      <div className="uc-head">
        <div className="uc-icon">
          <UpgradeIcon name={def.icon} />
        </div>
        <div>
          <div className="uc-name">{def.name}</div>
          <div className="uc-level">{maxed ? `Level ${level} · MAX` : `Level ${level} → ${level + 1}`}</div>
        </div>
        <div className="uc-pips">
          {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => (
            <i key={i} className={i < level ? 'on' : ''} />
          ))}
        </div>
      </div>
      <p className="uc-desc">{def.description}</p>
      <div className="uc-stats">
        {def.stats.map((s) => (
          <div key={s.key} className="uc-stat">
            <span>{s.label}</span>
            <b>
              {formatStat(s, level)}
              {!maxed && (
                <>
                  <em>→</em>
                  <strong>{formatStat(s, level + 1)}</strong>
                </>
              )}
            </b>
          </div>
        ))}
      </div>
      <button
        className={`btn upgrade-btn ${affordable ? 'primary' : ''}`}
        disabled={maxed || !affordable}
        onClick={() => {
          if (buy(def.id)) {
            audio.play('purchase');
            setFlash(true);
            setTimeout(() => setFlash(false), 600);
          } else audio.play('denied');
        }}
      >
        {maxed ? (
          'MAXED OUT'
        ) : affordable ? (
          <>UPGRADE · {money(cost!)}</>
        ) : (
          <>
            <Icon.lock size={14} /> {money(cost!)} · need {money(cost! - cash)} more
          </>
        )}
      </button>
    </div>
  );
}

export function Garage() {
  const cash = useSave((s) => s.money);
  const upgrades = useSave((s) => s.upgrades);
  const go = useUI((s) => s.go);
  const startNewCity = useUI((s) => s.startNewCity);
  const total = Object.values(upgrades).reduce((a, b) => a + b, 0);
  const max = UPGRADES.length * MAX_UPGRADE_LEVEL;

  return (
    <div className="screen garage-screen">
      <header className="garage-header">
        <button
          className="btn ghost"
          onClick={() => {
            click();
            go('menu');
          }}
        >
          <Icon.back size={18} /> MENU
        </button>
        <div className="garage-title">
          <Icon.garage size={22} /> GARAGE
        </div>
        <div className="garage-money">{money(cash)}</div>
      </header>
      <div className="garage-body">
        <div className="garage-view">
          <ShowroomScene mode="garage" />
          <div className="garage-truck-info panel">
            <div className="gti-name">CityVac 3000</div>
            <div className="gti-sub">Municipal street sweeper</div>
            <div className="gti-progress">
              <div style={{ width: `${(total / max) * 100}%` }} />
            </div>
            <div className="gti-sub">
              Upgrades {total - UPGRADES.length}/{max - UPGRADES.length}
            </div>
          </div>
          <button
            className="btn primary big garage-go"
            onClick={() => {
              audio.unlock();
              click();
              startNewCity();
            }}
          >
            <Icon.play size={18} /> NEXT CITY
          </button>
        </div>
        <div className="shop">
          <div className="shop-title">UPGRADE SHOP</div>
          <div className="shop-grid">
            {UPGRADES.map((u) => (
              <UpgradeCard key={u.id} def={u} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Settings ------------------------------------------------------------------------

export function Settings() {
  const settings = useSave((s) => s.settings);
  const update = useSave((s) => s.updateSettings);
  const reset = useSave((s) => s.resetProgress);
  const close = useUI((s) => s.closeSettings);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => audio.setVolumes(settings.soundVolume, settings.musicVolume), [settings.soundVolume, settings.musicVolume]);

  const slider = (label: string, key: 'soundVolume' | 'musicVolume' | 'cameraSensitivity', min: number, max: number, step: number, fmt: (v: number) => string) => (
    <label className="setting">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(e) => update({ [key]: Number(e.target.value) })} />
      <b>{fmt(settings[key])}</b>
    </label>
  );

  return (
    <div className="screen settings-screen">
      <div className="settings panel">
        <h2>
          <Icon.settings size={22} /> SETTINGS
        </h2>
        {slider('Sound volume', 'soundVolume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
        {slider('Music volume', 'musicVolume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
        {slider('Camera sensitivity', 'cameraSensitivity', 0.3, 2, 0.1, (v) => `${v.toFixed(1)}×`)}
        <div className="setting">
          <span>Graphics quality</span>
          <div className="seg">
            {(['low', 'medium', 'high'] as Quality[]).map((q) => (
              <button
                key={q}
                className={settings.quality === q ? 'on' : ''}
                onClick={() => {
                  click();
                  update({ quality: q });
                }}
              >
                {q.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <label className="setting">
          <span>Show FPS</span>
          <input type="checkbox" checked={settings.showFps} onChange={(e) => update({ showFps: e.target.checked })} />
          <b />
        </label>
        <div className="settings-actions">
          <button
            className="btn danger"
            onClick={() => {
              click();
              setConfirm(true);
            }}
          >
            <Icon.restart size={16} /> Reset progress
          </button>
          <button
            className="btn primary"
            onClick={() => {
              click();
              close();
            }}
          >
            <Icon.check size={16} /> Done
          </button>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Reset progress?"
          text="Your money, upgrades and statistics will be wiped. Settings are kept."
          confirm="Reset"
          onConfirm={() => {
            reset();
            setConfirm(false);
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

// --- In-game overlays ------------------------------------------------------------------

export function PauseMenu({ onResume }: { onResume: () => void }) {
  const restart = useUI((s) => s.restartLevel);
  const go = useUI((s) => s.go);
  const openSettings = useUI((s) => s.openSettings);
  const [confirm, setConfirm] = useState<null | 'garage' | 'menu' | 'restart'>(null);
  return (
    <div className="overlay">
      <div className="overlay-card panel">
        <h2>PAUSED</h2>
        <button
          className="btn primary big"
          onClick={() => {
            click();
            onResume();
          }}
        >
          <Icon.play size={18} /> RESUME
        </button>
        <button className="btn big" onClick={() => (click(), setConfirm('restart'))}>
          <Icon.restart size={18} /> RESTART CITY
        </button>
        <button className="btn big" onClick={() => (click(), openSettings())}>
          <Icon.settings size={18} /> SETTINGS
        </button>
        <button className="btn big" onClick={() => (click(), setConfirm('garage'))}>
          <Icon.garage size={18} /> GARAGE
        </button>
        <button className="btn ghost big" onClick={() => (click(), setConfirm('menu'))}>
          <Icon.home size={18} /> MAIN MENU
        </button>
      </div>
      {confirm && (
        <ConfirmDialog
          title={confirm === 'restart' ? 'Restart this city?' : 'Abandon this city?'}
          text="Progress in the current city will be lost (no reward)."
          confirm={confirm === 'restart' ? 'Restart' : 'Leave'}
          onConfirm={() => {
            if (confirm === 'restart') restart();
            else go(confirm);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function CountUp({ to, fmt, duration = 1100 }: { to: number; fmt: (v: number) => string; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setV(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{fmt(v)}</>;
}

export function Results({ result }: { result: LevelResult }) {
  const go = useUI((s) => s.go);
  const startNewCity = useUI((s) => s.startNewCity);
  const restart = useUI((s) => s.restartLevel);
  const cash = useSave((s) => s.money);
  const city = cityById(result.cityId);
  const win = result.win;
  const title = win ? 'CITY CLEANED!' : result.reason === 'fuel' ? 'OUT OF FUEL' : result.reason === 'wrecked' ? 'VEHICLE TOWED' : 'SHIFT ENDED';
  const mins = Math.floor(result.time / 60);
  const secs = Math.floor(result.time % 60);

  return (
    <div className="overlay results">
      <div className={`results-card panel ${win ? 'win' : 'lose'}`}>
        <div className="results-kicker">{city.name.toUpperCase()}</div>
        <h2 className="results-title">{title}</h2>
        {!win && (
          <p className="results-sub">
            {result.reason === 'fuel'
              ? `The tank ran dry at ${Math.floor(result.clean * 100)}% — you need ${WIN_THRESHOLD * 100}% to finish the city.`
              : 'Your truck took too much damage and had to be towed back to the depot.'}
          </p>
        )}
        <div className="results-grid">
          <div className="rs big">
            <span>CLEANLINESS</span>
            <b className={result.clean >= WIN_THRESHOLD ? 'good' : 'bad'}>
              <CountUp to={result.clean * 100} fmt={(v) => `${Math.floor(v)}%`} />
            </b>
          </div>
          <div className="rs">
            <span>DIRT REMOVED</span>
            <b>
              <CountUp to={result.items} fmt={(v) => Math.round(v).toLocaleString()} />
            </b>
            <small>{result.areaCleaned.toLocaleString()} m² scrubbed</small>
          </div>
          <div className="rs">
            <span>FUEL REMAINING</span>
            <b>{Math.round(result.fuel * 100)}%</b>
          </div>
          <div className="rs">
            <span>VEHICLE CONDITION</span>
            <b>{Math.round(result.condition * 100)}%</b>
          </div>
          <div className="rs">
            <span>DISTANCE · TIME</span>
            <b>
              {(result.distance / 1000).toFixed(2)} km · {mins}:{secs.toString().padStart(2, '0')}
            </b>
          </div>
          <div className="rs">
            <span>COLLISIONS</span>
            <b>{result.collisions}</b>
          </div>
        </div>
        {result.badges.length > 0 && (
          <div className="badges">
            {result.badges.map((b) => (
              <span key={b}>
                <Icon.trophy size={14} /> {b}
              </span>
            ))}
          </div>
        )}
        {win && (
          <div className="reward">
            <span>REWARD</span>
            <b>
              +<CountUp to={result.reward} fmt={(v) => money(Math.round(v))} duration={1500} />
            </b>
            <small>Balance {money(cash)}</small>
          </div>
        )}
        <div className="results-actions">
          <button
            className="btn big"
            onClick={() => {
              click();
              go('garage');
            }}
          >
            <Icon.garage size={18} /> GARAGE
          </button>
          {win ? (
            <button
              className="btn primary big"
              onClick={() => {
                click();
                startNewCity();
              }}
            >
              <Icon.play size={18} /> NEXT CITY
            </button>
          ) : (
            <button
              className="btn primary big"
              onClick={() => {
                click();
                restart();
              }}
            >
              <Icon.restart size={18} /> RETRY CITY
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CityIntro({ level }: { level: LevelSpec }) {
  const city = cityById(level.cityId);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [level.id]);
  if (!visible) return null;
  return (
    <div className="city-intro" style={{ ['--accent' as string]: city.accent }}>
      <div className="ci-kicker">NOW CLEANING</div>
      <div className="ci-name">{city.name}</div>
      <div className="ci-meta">
        {city.country} · {TIME_LABEL[level.time]} · {WEATHER_LABEL[level.weather]}
      </div>
      <div className="ci-tag">{city.tagline}</div>
      <div className="ci-goal">
        Clean {WIN_THRESHOLD * 100}% of the dirty roads · Reward {money(LEVEL_REWARD)}
      </div>
    </div>
  );
}
