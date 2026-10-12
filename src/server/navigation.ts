import type { WallIndex } from '../shared/collision';

const CELL = 40;
const UNREACHABLE = 0xffff;
// Step costs: 2 straight, 3 diagonal (close to 1 : 1.41).
const STRAIGHT = 2;
const DIAGONAL = 3;
const NEIGHBORS: [number, number, number][] = [
  [1, 0, STRAIGHT],
  [-1, 0, STRAIGHT],
  [0, 1, STRAIGHT],
  [0, -1, STRAIGHT],
  [1, 1, DIAGONAL],
  [1, -1, DIAGONAL],
  [-1, 1, DIAGONAL],
  [-1, -1, DIAGONAL],
];

/**
 * Pathfinding for the horde. Rather than running A* for each of hundreds of enemies, one search spreads out
 * from every living player and records each cell's walking distance to the nearest one (a "flow field").
 * An enemy then just steps to whichever neighboring cell is closer. Same paths as A*, a fraction of the cost.
 */
export class FlowField {
  readonly cols: number;
  readonly rows: number;
  /** 1 where a wall (thick or thin) covers part of the cell. */
  private blocked: Uint8Array;
  private dist: Uint16Array;

  constructor(walls: WallIndex) {
    this.cols = Math.ceil(walls.width / CELL);
    this.rows = Math.ceil(walls.height / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.dist = new Uint16Array(this.cols * this.rows).fill(UNREACHABLE);
    for (const w of walls.walls) {
      const x0 = Math.max(0, Math.floor(w.x / CELL));
      const x1 = Math.min(this.cols - 1, Math.floor((w.x + w.w - 0.01) / CELL));
      const y0 = Math.max(0, Math.floor(w.y / CELL));
      const y1 = Math.min(this.rows - 1, Math.floor((w.y + w.h - 0.01) / CELL));
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) this.blocked[cy * this.cols + cx] = 1;
    }
  }

  /** Recomputes distances from the given targets (Dijkstra with a bucket queue, since costs are small integers). */
  update(targets: { x: number; y: number }[]): void {
    const { cols, rows, blocked, dist } = this;
    dist.fill(UNREACHABLE);
    const buckets: number[][] = [[]];
    for (const t of targets) {
      const c = this.cellAt(t.x, t.y);
      if (c < 0) continue;
      dist[c] = 0;
      buckets[0].push(c);
    }
    for (let d = 0; d < buckets.length; d++) {
      const bucket = buckets[d];
      if (!bucket) continue;
      for (const c of bucket) {
        if (dist[c] !== d) continue; // Stale entry; a shorter path was found.
        const cx = c % cols;
        const cy = (c - cx) / cols;
        for (const [dx, dy, cost] of NEIGHBORS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const n = ny * cols + nx;
          if (blocked[n]) continue;
          // No cutting diagonally past a wall corner.
          if (dx && dy && (blocked[cy * cols + nx] || blocked[ny * cols + cx])) continue;
          const nd = d + cost;
          if (nd >= dist[n]) continue;
          dist[n] = nd;
          (buckets[nd] ??= []).push(n);
        }
      }
    }
  }

  /** Walking distance (in cost units) from a point to the nearest target, or Infinity. */
  distanceAt(x: number, y: number): number {
    const c = this.cellAt(x, y);
    return c < 0 || this.dist[c] === UNREACHABLE ? Infinity : this.dist[c];
  }

  /**
   * Unit direction to walk from (x, y) toward the nearest target, or null if there's no path
   * (or the target is close enough to walk straight at).
   */
  direction(x: number, y: number): { x: number; y: number } | null {
    const c = this.cellAt(x, y);
    if (c < 0) return null;
    const own = this.dist[c];
    if (own <= DIAGONAL) return null; // Next to a target: just go straight for it.
    const cx = c % this.cols;
    const cy = (c - cx) / this.cols;
    let best = own;
    let bx = 0;
    let by = 0;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
      if (dx && dy && (this.blocked[cy * this.cols + nx] || this.blocked[ny * this.cols + cx])) continue;
      const nd = this.dist[ny * this.cols + nx];
      if (nd < best) {
        best = nd;
        bx = nx;
        by = ny;
      }
    }
    if (best === own) return null;
    const tx = (bx + 0.5) * CELL - x;
    const ty = (by + 0.5) * CELL - y;
    const len = Math.hypot(tx, ty) || 1;
    return { x: tx / len, y: ty / len };
  }

  private cellAt(x: number, y: number): number {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return -1;
    return cy * this.cols + cx;
  }
}
