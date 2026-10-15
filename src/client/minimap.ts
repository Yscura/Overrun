import { Container, Graphics } from 'pixi.js';
import { ENEMY_TYPES } from '../shared/enemies';
import { MAPS, enemyColor, zoneRect } from '../shared/maps';
import { SHRINES, ShrineKind } from '../shared/objectives';
import { AFFIX_SHIFT, ENEMY_STRIDE, PICKUP_STRIDE, PickupKind, SHRINE_STRIDE, type Snapshot } from '../shared/protocol';

const HEALTH_GREEN = 0x00e676;
const DOWNED_RED = 0xff1744;
/** Icon badges: a dark disc with a colored rim, so the glyph reads on any part of the map. */
const BADGE = 0x14161b;

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
  /** Keeps the dots (and the burning zone's ring) inside the minimap. */
  private clip = new Graphics();
  private mapIndex = -1;
  private size = SIZE;
  private scale = 1;
  private frame = 0;

  constructor() {
    this.container.addChild(this.base, this.dots, this.clip);
    this.dots.mask = this.clip;
  }

  update(
    snap: Snapshot,
    myId: number | null,
    local: { x: number; y: number },
    view: { x: number; y: number; w: number; h: number },
    screenWidth: number,
    pings: readonly { x: number; y: number; color: number }[],
  ): void {
    const size = screenWidth < 700 ? SMALL_SIZE : SIZE;
    if (snap.map !== this.mapIndex || size !== this.size) {
      this.mapIndex = snap.map;
      this.size = size;
      this.drawBase();
    }
    const map = MAPS[snap.map];
    this.container.position.set(screenWidth - map.width * this.scale - MARGIN, TOP);
    if (this.frame++ % REDRAW_EVERY === 0) this.drawDots(snap, myId, local, view, pings);
  }

  /** The map spot under a screen point, or null if it's not on the minimap. */
  toWorld(sx: number, sy: number): { x: number; y: number } | null {
    if (this.mapIndex < 0 || !this.container.visible) return null;
    const map = MAPS[this.mapIndex];
    const x = (sx - this.container.x) / this.scale;
    const y = (sy - this.container.y) / this.scale;
    return x >= 0 && y >= 0 && x <= map.width && y <= map.height ? { x, y } : null;
  }

  /** The parts that only change with the map: background, walls, arena. */
  private drawBase(): void {
    const map = MAPS[this.mapIndex];
    const s = (this.scale = this.size / Math.max(map.width, map.height));
    this.clip.clear().rect(0, 0, map.width * s, map.height * s).fill(0xffffff);
    const g = this.base.clear();
    g.rect(0, 0, map.width * s, map.height * s)
      .fill({ color: 0x000000, alpha: 0.6 })
      .stroke({ width: 1, color: 0x4a5263 });
    for (const w of map.walls) {
      const color = w.look === 'water' ? 0x4fc3f7 : w.look === 'tree' ? 0x66bb6a : w.look === 'rock' ? 0xbcaaa4 : 0xb0bec5;
      g.rect(w.x * s, w.y * s, Math.max(1, w.w * s), Math.max(1, w.h * s)).fill({ color, alpha: w.look ? 0.7 : w.thin ? 0.35 : 0.8 });
    }
    const arena = map.arena;
    if (arena?.hall) g.rect((arena.x - arena.hall.hw) * s, (arena.y - arena.hall.hh) * s, arena.hall.hw * 2 * s, arena.hall.hh * 2 * s).stroke({ width: 1.5, color: 0xff1744, alpha: 0.8 });
    else if (arena) g.circle(arena.x * s, arena.y * s, arena.r * s).stroke({ width: 1.5, color: 0xff1744, alpha: 0.8 });
  }

  private drawDots(
    snap: Snapshot,
    myId: number | null,
    local: { x: number; y: number },
    view: { x: number; y: number; w: number; h: number },
    pings: readonly { x: number; y: number; color: number }[],
  ): void {
    const s = this.scale;
    const g = this.dots.clear();

    // The lava, and the arena gate while it's shut.
    const map = MAPS[this.mapIndex];
    if (snap.lava) g.rect(0, 0, map.width * s, map.height * s).fill({ color: 0xff6d00, alpha: 0.45 }).circle(snap.lava.x * s, snap.lava.y * s, snap.lava.r * s).cut();
    if (map.arena && !snap.arena?.open) for (const w of map.arena.gate) g.rect(w.x * s, w.y * s, Math.max(2, w.w * s), Math.max(2, w.h * s)).fill(0xffab40);

    // Ordinary enemies as a heat map, elites individually.
    const heat = new Map<number, number>();
    const elites: number[] = [];
    for (let i = 0; i < snap.enemies.length; i += ENEMY_STRIDE) {
      const type = snap.enemies[i + 1];
      if (ENEMY_TYPES[type].elite || snap.enemies[i + 4] >> AFFIX_SHIFT) {
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
      const x = snap.enemies[i + 2] * s;
      const y = snap.enemies[i + 3] * s;
      const color = enemyColor(MAPS[snap.map], snap.enemies[i + 1]);
      if (def.radius >= 50) skull(g, x, y, color);
      else g.circle(x, y, 2.5).fill(color);
    }

    // Crates as small wooden boxes, hearts as green plus signs.
    for (let i = 0; i < snap.pickups.length; i += PICKUP_STRIDE) {
      const kind = snap.pickups[i + 1];
      const x = snap.pickups[i + 2] * s;
      const y = snap.pickups[i + 3] * s;
      if (kind === PickupKind.Crate) g.rect(x - 2.5, y - 2.5, 5, 5).fill(0xbc8a5f).stroke({ width: 1, color: 0x3e2723 });
      else if (kind === PickupKind.Heart) g.rect(x - 3, y - 1.2, 6, 2.4).rect(x - 1.2, y - 3, 2.4, 6).fill(HEALTH_GREEN);
    }

    // Upgrade points and the quest target, with a pulsing halo so they stand out.
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    for (let i = 0; i < snap.shrines.length; i += SHRINE_STRIDE) {
      const kind = snap.shrines[i + 1];
      const x = snap.shrines[i + 2] * s;
      const y = snap.shrines[i + 3] * s;
      const color = SHRINES[kind].color;
      g.circle(x, y, 10 + 3 * pulse).stroke({ width: 1.5, color, alpha: 0.6 - 0.4 * pulse });
      g.circle(x, y, 7.5).fill(BADGE).stroke({ width: 1.5, color });
      shrineGlyph(g, kind, x, y, color);
    }
    if (snap.quest) {
      const x = snap.quest.x * s;
      const y = snap.quest.y * s;
      g.circle(x, y, 10 + 3 * pulse).stroke({ width: 1.5, color: 0xffee58, alpha: 0.6 - 0.4 * pulse });
      flag(g, x, y, 0xffee58);
    }

    // The burning zone closing in on the arena.
    if (snap.arena && snap.arena.state !== 'idle') {
      const box = map.arena && zoneRect(map.arena, snap.arena.safeR);
      if (box) g.rect(box.x0 * s, box.y0 * s, (box.x1 - box.x0) * s, (box.y1 - box.y0) * s).stroke({ width: 2, color: 0xff3d00, alpha: 0.9 });
      else g.circle(snap.arena.x * s, snap.arena.y * s, snap.arena.safeR * s).stroke({ width: 2, color: 0xff3d00, alpha: 0.9 });
    }

    // Pings: a ring pulsing in the pinger's color.
    for (const ping of pings) {
      const x = ping.x * s;
      const y = ping.y * s;
      g.circle(x, y, 7 + 5 * pulse).stroke({ width: 2, color: ping.color, alpha: 1 - 0.6 * pulse });
      pin(g, x, y, ping.color);
    }

    // What you can see right now.
    g.rect(view.x * s, view.y * s, view.w * s, view.h * s).stroke({ width: 1, color: 0xffffff, alpha: 0.35 });

    // Players on top. Downed teammates get a pulsing red cross; you get a white halo.
    const players = [...snap.players].sort((a, b) => Number(b.downed) - Number(a.downed)); // Standing players on top.
    for (const p of players) {
      const x = (p.id === myId ? local.x : p.x) * s;
      const y = (p.id === myId ? local.y : p.y) * s;
      if (p.downed) {
        g.circle(x, y, 9 + 4 * pulse).stroke({ width: 2, color: DOWNED_RED, alpha: 0.9 - 0.6 * pulse });
        g.circle(x, y, 6.5).fill(0xffffff).stroke({ width: 1.5, color: DOWNED_RED });
        g.rect(x - 1.5, y - 4.5, 3, 9).rect(x - 4.5, y - 1.5, 9, 3).fill(DOWNED_RED);
        continue;
      }
      if (p.id === myId) g.circle(x, y, 8).fill({ color: 0xffffff, alpha: 0.25 });
      g.circle(x, y, p.id === myId ? 5 : 4).fill(p.color).stroke({ width: 1.5, color: 0xffffff });
    }
  }
}

/** The glyph inside an upgrade point's badge. */
function shrineGlyph(g: Graphics, kind: number, x: number, y: number, color: number): void {
  switch (kind) {
    case ShrineKind.Forge:
      // An anvil.
      g.poly([x - 5, y - 3, x + 5, y - 3, x + 3, y, x + 1.5, y, x + 2.5, y + 3.5, x - 2.5, y + 3.5, x - 1.5, y, x - 3, y]).fill(color);
      break;
    case ShrineKind.Event:
      // A four-pointed sparkle.
      g.poly([x, y - 5.5, x + 1.5, y - 1.5, x + 5.5, y, x + 1.5, y + 1.5, x, y + 5.5, x - 1.5, y + 1.5, x - 5.5, y, x - 1.5, y - 1.5]).fill(color);
      break;
    case ShrineKind.Quest:
      // An exclamation mark.
      g.roundRect(x - 1.3, y - 5, 2.6, 6.5, 1).circle(x, y + 3.8, 1.4).fill(color);
      break;
    default:
      // A rune: a diamond with a hole.
      g.poly([x, y - 5, x + 4, y, x, y + 5, x - 4, y]).fill(color).circle(x, y, 1.6).fill(BADGE);
  }
}

/** The quest target: a flag on a pole. */
function flag(g: Graphics, x: number, y: number, color: number): void {
  g.circle(x, y + 5, 3).fill({ color: 0x000000, alpha: 0.4 });
  g.rect(x - 4, y - 7, 1.8, 13).fill(0xffffff);
  g.poly([x - 2.2, y - 7, x + 6, y - 4, x - 2.2, y - 1]).fill(color).stroke({ width: 1, color: 0xffffff });
}

/** A boss: a skull in its own color. */
function skull(g: Graphics, x: number, y: number, color: number): void {
  g.circle(x, y - 1, 6).rect(x - 3.5, y + 2, 7, 4).fill(color).stroke({ width: 1, color: 0x000000 });
  g.circle(x - 2.2, y - 1, 1.6).circle(x + 2.2, y - 1, 1.6).fill(0x000000);
  g.rect(x - 0.5, y + 3, 1, 3).fill(0x000000);
}

/** A ping: a map pin in the pinger's color. */
function pin(g: Graphics, x: number, y: number, color: number): void {
  g.poly([x, y, x - 3.5, y - 6, x + 3.5, y - 6]).fill(color);
  g.circle(x, y - 7.5, 4).fill(color).stroke({ width: 1, color: 0xffffff });
  g.circle(x, y - 7.5, 1.5).fill(0xffffff);
}
