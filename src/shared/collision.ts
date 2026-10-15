// Circle-vs-wall collision, shared by the server (everyone) and the client (your own movement prediction).

/** An axis-aligned wall. Thin walls (fences) block movement but not projectiles, and can be dodged through. */
export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
  thin: boolean;
  /** How it's drawn: stonework by default, or as water, a tree or rock. Collision doesn't care. */
  look?: 'water' | 'tree' | 'rock';
}

/** Which walls a mover may pass through. */
export interface PassFlags {
  thin?: boolean;
  thick?: boolean;
}

const CELL = 128;
/** Movement is split into steps no longer than this, so fast movers can't tunnel through walls. */
const MAX_STEP = 8;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Buckets walls by area so collision checks only look at walls nearby. */
export class WallIndex {
  private cells = new Map<number, Wall[]>();

  constructor(
    readonly walls: Wall[],
    readonly width: number,
    readonly height: number,
  ) {
    for (const wall of walls) {
      for (let cy = Math.floor(wall.y / CELL); cy <= Math.floor((wall.y + wall.h) / CELL); cy++) {
        for (let cx = Math.floor(wall.x / CELL); cx <= Math.floor((wall.x + wall.w) / CELL); cx++) {
          const key = cy * 4096 + cx;
          let cell = this.cells.get(key);
          if (!cell) this.cells.set(key, (cell = []));
          cell.push(wall);
        }
      }
    }
  }

  /** Walls whose cells overlap the square around (x, y). May contain duplicates. */
  near(x: number, y: number, r: number): Wall[] {
    const out: Wall[] = [];
    for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
      for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
        const cell = this.cells.get(cy * 4096 + cx);
        if (cell) out.push(...cell);
      }
    }
    return out;
  }
}

function blocks(wall: Wall, pass: PassFlags | undefined): boolean {
  return wall.thin ? !pass?.thin : !pass?.thick;
}

/** If the circle overlaps the wall, the nearest position where it doesn't. Otherwise null. */
function pushOutOf(x: number, y: number, r: number, wall: Wall): { x: number; y: number } | null {
  const nx = clamp(x, wall.x, wall.x + wall.w);
  const ny = clamp(y, wall.y, wall.y + wall.h);
  const dx = x - nx;
  const dy = y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { x: nx + (dx / d) * r, y: ny + (dy / d) * r };
  }
  // Center is inside the wall: leave by the closest side.
  const left = x - wall.x;
  const right = wall.x + wall.w - x;
  const top = y - wall.y;
  const bottom = wall.y + wall.h - y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { x: wall.x - r, y };
  if (min === right) return { x: wall.x + wall.w + r, y };
  if (min === top) return { x, y: wall.y - r };
  return { x, y: wall.y + wall.h + r };
}

/** Pushes a circle out of any walls it may not overlap. */
export function pushOut(index: WallIndex, x: number, y: number, r: number, pass?: PassFlags): { x: number; y: number } {
  // Two passes settle corners where two walls meet.
  for (let pass_ = 0; pass_ < 2; pass_++) {
    for (const wall of index.near(x, y, r)) {
      if (!blocks(wall, pass)) continue;
      const out = pushOutOf(x, y, r, wall);
      if (out) ({ x, y } = out);
    }
  }
  return { x: clamp(x, r, index.width - r), y: clamp(y, r, index.height - r) };
}

/** Moves a circle by (dx, dy), sliding along walls and staying inside the map. */
export function moveCircle(index: WallIndex, x: number, y: number, dx: number, dy: number, r: number, pass?: PassFlags): { x: number; y: number } {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_STEP));
  for (let i = 0; i < steps; i++) ({ x, y } = pushOut(index, x + dx / steps, y + dy / steps, r, pass));
  return { x, y };
}

/** Does a circle at (x, y) overlap a wall it may not pass? */
export function overlapsWall(index: WallIndex, x: number, y: number, r: number, pass?: PassFlags): boolean {
  return index.near(x, y, r).some((wall) => blocks(wall, pass) && pushOutOf(x, y, r, wall) !== null);
}

/** Is this point inside a thick wall? Projectiles fly over thin ones. */
export function blocksShot(index: WallIndex, x: number, y: number): boolean {
  return index.near(x, y, 0).some((w) => !w.thin && x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
}
