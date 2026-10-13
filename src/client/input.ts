import type { DevAction } from '../shared/protocol';

// Uses KeyboardEvent.code, so WASD is by physical position and works on any keyboard layout.
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
/** God-mode cheat keys (see the dev panel). */
export const DEV_KEYS: Record<string, DevAction> = { KeyT: 'skip', KeyU: 'level', KeyF: 'forge', KeyB: 'max' };

export class Input {
  private keys = new Set<string>();
  private mouse = { x: 1, y: 0 };
  private dodgePressed = false;
  private castPressed: 'e' | 'r' | null = null;
  private devPressed: DevAction | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault(); // Don't scroll or press a focused button.
        if (!e.repeat) this.dodgePressed = true;
      }
      if (!e.repeat && e.code === 'KeyE') this.castPressed = 'e';
      if (!e.repeat && e.code === 'KeyR') this.castPressed = 'r';
      if (!e.repeat && e.code in DEV_KEYS) this.devPressed = DEV_KEYS[e.code];
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
  }

  /** Normalized movement direction, or (0, 0) when idle. */
  direction(): { x: number; y: number } {
    const held = (codes: string[]) => codes.some((c) => this.keys.has(c));
    const x = (held(RIGHT) ? 1 : 0) - (held(LEFT) ? 1 : 0);
    const y = (held(DOWN) ? 1 : 0) - (held(UP) ? 1 : 0);
    const len = Math.hypot(x, y);
    return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  /** Angle from your player to the cursor. The camera keeps your player at the center of the screen. */
  aim(): number {
    return Math.atan2(this.mouse.y - window.innerHeight / 2, this.mouse.x - window.innerWidth / 2);
  }

  /** How far the cursor is from your player, in world units. */
  aimDistance(): number {
    return Math.hypot(this.mouse.x - window.innerWidth / 2, this.mouse.y - window.innerHeight / 2);
  }

  /** 'e' or 'r' once per key press, otherwise null. */
  consumeCast(): 'e' | 'r' | null {
    const slot = this.castPressed;
    this.castPressed = null;
    return slot;
  }

  /** A god-mode cheat key, once per press (only sent when your name is "dev"). */
  consumeDev(): DevAction | null {
    const action = this.devPressed;
    this.devPressed = null;
    return action;
  }

  /** True once per Space press. */
  consumeDodge(): boolean {
    const pressed = this.dodgePressed;
    this.dodgePressed = false;
    return pressed;
  }
}
