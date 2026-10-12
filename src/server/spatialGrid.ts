/**
 * Buckets items into square cells so "what is near this point?" only checks a few cells
 * instead of every enemy. Rebuilt every tick.
 */
export class SpatialGrid<T extends { x: number; y: number }> {
  private cells = new Map<number, T[]>();

  constructor(private readonly cellSize: number) {}

  clear(): void {
    for (const cell of this.cells.values()) cell.length = 0;
  }

  insert(item: T): void {
    const key = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, (cell = []));
    cell.push(item);
  }

  /** Fills `out` with every item in the cells overlapping the square around (x, y). Callers do the exact distance check. */
  query(x: number, y: number, radius: number, out: T[]): T[] {
    out.length = 0;
    const cs = this.cellSize;
    const x0 = Math.floor((x - radius) / cs);
    const x1 = Math.floor((x + radius) / cs);
    const y0 = Math.floor((y - radius) / cs);
    const y1 = Math.floor((y + radius) / cs);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (cell) for (const item of cell) out.push(item);
      }
    }
    return out;
  }

  private key(cx: number, cy: number): number {
    return (cy + 1024) * 4096 + (cx + 1024);
  }
}
