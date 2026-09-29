export type InputAction = 'brushes' | 'lights' | 'camera' | 'pause';

/**
 * Unified input state. Keyboard and touch controls both write here;
 * the game loop only reads from it.
 */
class InputState {
  keyForward = false;
  keyBack = false;
  keyLeft = false;
  keyRight = false;
  keyFoam = false;

  touchSteer = 0; // -1 (right) .. 1 (left)
  touchGas = false;
  touchBrake = false;
  touchFoam = false;

  /** Camera look offset from pointer drag, radians. */
  lookYaw = 0;
  lookPitch = 0;
  looking = false;

  private listeners = new Set<(a: InputAction) => void>();
  private attached = false;

  get throttle() {
    return this.keyForward || this.touchGas;
  }
  get brake() {
    return this.keyBack || this.touchBrake;
  }
  get steer() {
    const k = (this.keyLeft ? 1 : 0) - (this.keyRight ? 1 : 0);
    return Math.max(-1, Math.min(1, k + this.touchSteer));
  }
  get foam() {
    return this.keyFoam || this.touchFoam;
  }

  onAction(fn: (a: InputAction) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  trigger(a: InputAction) {
    this.listeners.forEach((fn) => fn(a));
  }

  reset() {
    this.keyForward = this.keyBack = this.keyLeft = this.keyRight = this.keyFoam = false;
    this.touchGas = this.touchBrake = this.touchFoam = false;
    this.touchSteer = 0;
    this.lookYaw = this.lookPitch = 0;
    this.looking = false;
  }

  attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', () => this.reset());
  }

  private onKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown';
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keyForward = down;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keyBack = down;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keyLeft = down;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keyRight = down;
        break;
      case 'KeyT':
        this.keyFoam = down;
        break;
      case 'KeyE':
        if (down && !e.repeat) this.trigger('brushes');
        break;
      case 'KeyF':
        if (down && !e.repeat) this.trigger('lights');
        break;
      case 'KeyC':
        if (down && !e.repeat) this.trigger('camera');
        break;
      case 'Escape':
      case 'KeyP':
        if (down && !e.repeat) this.trigger('pause');
        break;
      default:
        return;
    }
    if (e.code.startsWith('Arrow')) e.preventDefault();
  };
}

export const input = new InputState();

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('touch')) return true;
  const mq = (q: string) => window.matchMedia?.(q).matches ?? false;
  return mq('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mq('(hover: hover)'));
}
