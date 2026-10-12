import { TICK_RATE } from '../shared/constants';
import { ENEMY_SHOT_STRIDE, ENEMY_STRIDE, GEM_STRIDE, PROJECTILE_STRIDE, type Snapshot } from '../shared/protocol';

/**
 * Everything except your own player is drawn this many ticks in the past, so there is always
 * an older and a newer snapshot to blend between. Higher = smoother on bad connections, but laggier.
 */
const INTERP_TICKS = 3;

export interface IndexedSnapshot {
  snap: Snapshot;
  /** Entity id -> offset into the flat array. */
  enemies: Map<number, number>;
  projectiles: Map<number, number>;
  enemyShots: Map<number, number>;
  gems: Map<number, number>;
}

export interface Sample {
  a: IndexedSnapshot;
  b: IndexedSnapshot;
  /** 0 = fully a, 1 = fully b. */
  t: number;
}

function indexIds(list: number[], stride: number): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < list.length; i += stride) map.set(list[i], i);
  return map;
}

export class SnapshotBuffer {
  private snaps: IndexedSnapshot[] = [];
  private renderTick = 0;

  push(snap: Snapshot): void {
    const last = this.snaps[this.snaps.length - 1];
    if (last && snap.tick <= last.snap.tick) return;
    this.snaps.push({
      snap,
      enemies: indexIds(snap.enemies, ENEMY_STRIDE),
      projectiles: indexIds(snap.projectiles, PROJECTILE_STRIDE),
      enemyShots: indexIds(snap.enemyShots, ENEMY_SHOT_STRIDE),
      gems: indexIds(snap.gems, GEM_STRIDE),
    });
    if (!last) this.renderTick = snap.tick - INTERP_TICKS;
  }

  clear(): void {
    this.snaps = [];
  }

  update(dt: number): void {
    const last = this.snaps[this.snaps.length - 1];
    if (!last) return;
    // Advance the render clock in real time, gently steering it toward INTERP_TICKS behind the newest snapshot.
    this.renderTick += dt * TICK_RATE;
    const drift = last.snap.tick - INTERP_TICKS - this.renderTick;
    this.renderTick += Math.abs(drift) > 15 ? drift : drift * Math.min(1, dt * 2);
    while (this.snaps.length > 2 && this.snaps[1].snap.tick <= this.renderTick) this.snaps.shift();
  }

  sample(): Sample | null {
    const [a, b] = this.snaps;
    if (!a) return null;
    if (!b || this.renderTick <= a.snap.tick) return { a, b: a, t: 0 };
    return { a, b, t: Math.min(1, (this.renderTick - a.snap.tick) / (b.snap.tick - a.snap.tick)) };
  }
}
