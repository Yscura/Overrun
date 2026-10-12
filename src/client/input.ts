// Uses KeyboardEvent.code, so WASD is by physical position and works on any keyboard layout.
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];

export class Input {
  private keys = new Set<string>();
  private mouse = { x: 1, y: 0 };
  private dodgePressed = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault(); // Don't scroll or press a focused button.
        if (!e.repeat) this.dodgePressed = true;
      }
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

  /** True once per Space press. */
  consumeDodge(): boolean {
    const pressed = this.dodgePressed;
    this.dodgePressed = false;
    return pressed;
  }
}
