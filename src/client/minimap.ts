import { Container, Graphics } from 'pixi.js';
import { ENEMY_TYPES } from '../shared/enemies';
import { MAPS } from '../shared/maps';
import { SHRINES } from '../shared/objectives';
import { ENEMY_STRIDE, PICKUP_STRIDE, PickupKind, SHRINE_STRIDE, type Snapshot } from '../shared/protocol';

const HEALTH_GREEN = 0x00e676;

const SIZE = 180;
const SMALL_SIZE = 130;
const MARGIN = 16;
const TOP = 28;
/** Ordinary enemies are shown as a heat map of this many minimap pixels per cell. */
const HEAT_CELL = 8;
const REDRAW_EVERY = 2;

/** Top-right overview: walls, players, upgrade points, quest target, elites and where the hordes are. */
export class Minimap {
  readonly container = new Container();
  private base = new Graphics();
  private dots = new Graphics();
  private mapIndex = -1;
  private size = SIZE;
  private scale = 1;
  private frame = 0;

  constructor() {
    this.container.addChild(this.base, this.dots);
  }

  update(snap: Snapshot, myId: number | null, local: { x: number; y: number }, view: { x: number; y: number; w: number; h: number }, screenWidth: number): void {
    const size = screenWidth < 700 ? SMALL_SIZE : SIZE;
    if (snap.map !== this.mapIndex || size !== this.size) {
      this.mapIndex = snap.map;
      this.size = size;
      this.drawBase();
    }
    const map = MAPS[snap.map];
    this.container.position.set(screenWidth - map.width * this.scale - MARGIN, TOP);
    if (this.frame++ % REDRAW_EVERY === 0) this.drawDots(snap, myId, local, view);
  }

  /** The parts that only change with the map: background, walls, arena. */
  private drawBase(): void {
    const map = MAPS[this.mapIndex];
    const s = (this.scale = this.size / Math.max(map.width, map.height));
    const g = this.base.clear();
    g.rect(0, 0, map.width * s, map.height * s)
      .fill({ color: 0x000000, alpha: 0.6 })
      .stroke({ width: 1, color: 0x4a5263 });
    for (const w of map.walls) {
      g.rect(w.x * s, w.y * s, Math.max(1, w.w * s), Math.max(1, w.h * s)).fill({ color: 0xb0bec5, alpha: w.thin ? 0.35 : 0.8 });
    }
    if (map.arena) g.circle(map.arena.x * s, map.arena.y * s, map.arena.r * s).stroke({ width: 1.5, color: 0xff1744, alpha: 0.8 });
  }

  private drawDots(snap: Snapshot, myId: number | null, local: { x: number; y: number }, view: { x: number; y: number; w: number; h: number }): void {
    const s = this.scale;
    const g = this.dots.clear();

    // Ordinary enemies as a heat map, elites individually.
    const heat = new Map<number, number>();
    const elites: number[] = [];
    for (let i = 0; i < snap.enemies.length; i += ENEMY_STRIDE) {
      const type = snap.enemies[i + 1];
      if (ENEMY_TYPES[type].elite) {
        elites.push(i);
        continue;
      }
      const key = Math.floor((snap.enemies[i + 3] * s) / HEAT_CELL) * 1000 + Math.floor((snap.enemies[i + 2] * s) / HEAT_CELL);
      heat.set(key, (heat.get(key) ?? 0) + 1);
    }
    for (const [key, count] of heat) {
      const cx = key % 1000;
      const cy = (key - cx) / 1000;
      g.rect(cx * HEAT_CELL, cy * HEAT_CELL, HEAT_CELL, HEAT_CELL).fill({ color: 0xff5252, alpha: Math.min(0.85, 0.15 + count * 0.07) });
    }
    for (const i of elites) {
      const def = ENEMY_TYPES[snap.enemies[i + 1]];
      g.circle(snap.enemies[i + 2] * s, snap.enemies[i + 3] * s, def.radius >= 50 ? 5 : 2.5).fill(def.color);
    }

    // Health packs: small green plus signs.
    for (let i = 0; i < snap.pickups.length; i += PICKUP_STRIDE) {
      const x = snap.pickups[i + 2] * s;
      const y = snap.pickups[i + 3] * s;
      const arm = snap.pickups[i + 1] === PickupKind.Crate ? 3.5 : 3;
      g.rect(x - arm, y - 1.2, arm * 2, 2.4).rect(x - 1.2, y - arm, 2.4, arm * 2).fill(HEALTH_GREEN);
    }

    // Upgrade points and the quest target, with a pulsing halo so they stand out.
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    for (let i = 0; i < snap.shrines.length; i += SHRINE_STRIDE) {
      const x = snap.shrines[i + 2] * s;
      const y = snap.shrines[i + 3] * s;
      const color = SHRINES[snap.shrines[i + 1]].color;
      g.circle(x, y, 8 + 3 * pulse).stroke({ width: 1.5, color, alpha: 0.6 - 0.4 * pulse });
      g.circle(x, y, 6).fill(color).stroke({ width: 1.5, color: 0xffffff });
    }
    if (snap.quest) {
      const x = snap.quest.x * s;
      const y = snap.quest.y * s;
      g.circle(x, y, 9 + 3 * pulse).stroke({ width: 1.5, color: 0xffee58, alpha: 0.6 - 0.4 * pulse });
      g.poly([x, y - 7, x + 7, y, x, y + 7, x - 7, y]).fill(0xffee58).stroke({ width: 1.5, color: 0xffffff });
    }

    // The burning zone closing in on the arena.
    if (snap.arena && snap.arena.state !== 'idle') {
      g.circle(snap.arena.x * s, snap.arena.y * s, snap.arena.safeR * s).stroke({ width: 2, color: 0xff3d00, alpha: 0.9 });
    }

    // What you can see right now.
    g.rect(view.x * s, view.y * s, view.w * s, view.h * s).stroke({ width: 1, color: 0xffffff, alpha: 0.35 });

    for (const p of snap.players) {
      const x = (p.id === myId ? local.x : p.x) * s;
      const y = (p.id === myId ? local.y : p.y) * s;
      g.circle(x, y, p.id === myId ? 4.5 : 3.5)
        .fill({ color: p.color, alpha: p.downed ? 0.4 : 1 })
        .stroke({ width: 1.5, color: 0xffffff });
    }
  }
}
