import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { input } from '../game/Input';
import { useHud } from '../state/gameState';
import { Icon } from './icons';

function capture(e: RPointerEvent<HTMLElement>) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    /* pointer already released */
  }
}

/** Virtual steering wheel: drag horizontally (or rotate) to steer. */
function SteeringWheel() {
  const [angle, setAngle] = useState(0);
  const pointer = useRef<number | null>(null);
  const startX = useRef(0);
  const RANGE = 70;

  const setSteer = (dx: number) => {
    const v = Math.max(-1, Math.min(1, dx / RANGE));
    input.touchSteer = -v; // dragging right steers right (negative = right)
    setAngle(v * 110);
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== null) return;
    pointer.current = e.pointerId;
    startX.current = e.clientX;
    capture(e);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointer.current) return;
    setSteer(e.clientX - startX.current);
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointer.current) return;
    pointer.current = null;
    input.touchSteer = 0;
    setAngle(0);
  };

  return (
    <div className="mc-wheel-zone" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="mc-wheel" style={{ transform: `rotate(${angle}deg)` }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="9" />
          <circle cx="50" cy="50" r="11" fill="#ff7a00" />
          <path d="M7 50h32M61 50h32M50 61v32" stroke="rgba(255,255,255,0.85)" strokeWidth="8" strokeLinecap="round" />
          <circle cx="50" cy="6" r="4" fill="#ff7a00" />
        </svg>
      </div>
      <div className="mc-wheel-hint">◀ STEER ▶</div>
    </div>
  );
}

function HoldButton({ className, onChange, children, label }: { className: string; onChange: (down: boolean) => void; children: React.ReactNode; label: string }) {
  const [down, setDown] = useState(false);
  const set = (d: boolean) => {
    setDown(d);
    onChange(d);
  };
  return (
    <button
      aria-label={label}
      className={`${className} ${down ? 'pressed' : ''}`}
      onPointerDown={(e) => {
        capture(e);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export function MobileControls() {
  const brushes = useHud((s) => s.brushes);
  const lights = useHud((s) => s.lights);
  const camera = useHud((s) => s.camera);
  const foaming = useHud((s) => s.foaming);

  return (
    <div className="mobile-controls">
      <SteeringWheel />

      <div className="mc-actions">
        <button className={`mc-btn ${brushes ? 'active' : ''}`} onPointerDown={() => input.trigger('brushes')} aria-label="Toggle brushes">
          <Icon.brush size={22} />
          <span>{brushes ? 'ON' : 'OFF'}</span>
        </button>
        <HoldButton className={`mc-btn ${foaming ? 'active' : ''}`} onChange={(d) => (input.touchFoam = d)} label="Spray foam">
          <Icon.foam size={22} />
          <span>FOAM</span>
        </HoldButton>
        <button className={`mc-btn ${lights ? 'active' : ''}`} onPointerDown={() => input.trigger('lights')} aria-label="Toggle headlights">
          <Icon.light size={22} />
          <span>LIGHTS</span>
        </button>
        <button className="mc-btn" onPointerDown={() => input.trigger('camera')} aria-label="Toggle camera">
          <Icon.camera size={22} />
          <span>{camera === 'first' ? '1ST' : '3RD'}</span>
        </button>
      </div>

      <div className="mc-pedals">
        <HoldButton className="mc-pedal brake" onChange={(d) => (input.touchBrake = d)} label="Brake / reverse">
          <span>BRAKE</span>
          <small>REV</small>
        </HoldButton>
        <HoldButton className="mc-pedal gas" onChange={(d) => (input.touchGas = d)} label="Accelerate">
          <span>GAS</span>
        </HoldButton>
      </div>
    </div>
  );
}
