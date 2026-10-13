// Map looks: a ground texture per map, decorations scattered over the floor, landmarks, and detailed walls.
// Everything here is drawn once when the map loads, so it costs nothing per frame (apart from the Caldera's
// glowing cracks, whose alpha pulses).

import { Graphics } from 'pixi.js';
import { WallIndex, overlapsWall } from '../shared/collision';
import type { MapDef } from '../shared/maps';
import { shade } from './enemyArt';

/** A small deterministic random generator, so a map always looks the same. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TILE = 256;

/** The repeating floor texture: the base color with speckles, a faint grid, and a touch of the map's flavor. */
export function groundTile(index: number, map: MapDef): Graphics {
  const { theme } = map;
  const rand = seeded(1000 + index);
  const g = new Graphics().rect(0, 0, TILE, TILE).fill(theme.background);
  // Soft blotches break up the flat color. Drawn wrapped around the edges, so the tile repeats seamlessly.
  for (let i = 0; i < 14; i++) {
    const x = rand() * TILE;
    const y = rand() * TILE;
    const r = 20 + rand() * 40;
    const color = shade(theme.background, rand() < 0.5 ? -0.25 : 0.06);
    for (const ox of [-TILE, 0, TILE]) {
      for (const oy of [-TILE, 0, TILE]) {
        if (x + ox + r > 0 && x + ox - r < TILE && y + oy + r > 0 && y + oy - r < TILE) g.circle(x + ox, y + oy, r);
      }
    }
    g.fill({ color, alpha: 0.25 });
  }
  for (let i = 0; i < 260; i++) {
    const size = 1 + rand() * 3;
    g.rect(Math.floor(rand() * TILE), Math.floor(rand() * TILE), size, size).fill({ color: shade(theme.background, rand() < 0.5 ? -0.35 : 0.18), alpha: 0.7 });
  }
  if (index === 0) {
    // Grass blades.
    for (let i = 0; i < 40; i++) {
      const x = rand() * TILE;
      const y = rand() * TILE;
      g.moveTo(x, y).lineTo(x + (rand() - 0.5) * 4, y - 4 - rand() * 4).stroke({ width: 1.5, color: 0x2e4a2f, alpha: 0.8 });
    }
  } else if (index === 1) {
    // Snow dust.
    for (let i = 0; i < 70; i++) g.circle(rand() * TILE, rand() * TILE, 0.8 + rand() * 1.5).fill({ color: 0xffffff, alpha: 0.12 + rand() * 0.12 });
  } else {
    // Ash and the odd ember.
    for (let i = 0; i < 50; i++) g.circle(rand() * TILE, rand() * TILE, 0.8 + rand() * 1.6).fill({ color: 0x9e9e9e, alpha: 0.12 });
    for (let i = 0; i < 6; i++) g.circle(rand() * TILE, rand() * TILE, 1).fill({ color: 0xff9100, alpha: 0.35 });
  }
  // A faint grid helps you feel how fast you're moving.
  for (let i = 0; i < TILE; i += 64) g.rect(i, 0, 1, TILE).rect(0, i, TILE, 1).fill({ color: theme.grid, alpha: 0.45 });
  return g;
}

/** Things lying on the floor: `still` never changes; `glow` (lava, embers) has its alpha pulsed by the renderer. */
export function decorations(index: number, map: MapDef): { still: Graphics; glow: Graphics } {
  const rand = seeded(7 + index * 31);
  const walls = new WallIndex(map.walls, map.width, map.height);
  const still = new Graphics();
  const glow = new Graphics();
  landmarks(index, map, still, glow, rand);

  const count = Math.round((map.width * map.height) / 21000);
  for (let i = 0; i < count; i++) {
    const x = 40 + rand() * (map.width - 80);
    const y = 40 + rand() * (map.height - 80);
    const roll = rand();
    const size = 0.7 + rand() * 0.8;
    if (overlapsWall(walls, x, y, 26)) continue;
    if (index === 0) ruinsProp(still, x, y, roll, size, rand);
    else if (index === 1) frostProp(still, x, y, roll, size, rand);
    else calderaProp(still, glow, x, y, roll, size, rand);
  }
  return { still, glow };
}

/** Big set pieces that give each map a sense of place. */
function landmarks(index: number, map: MapDef, still: Graphics, glow: Graphics, rand: () => number): void {
  if (index === 0) {
    // An old mosaic floor in the courtyard.
    const cx = map.width / 2;
    const cy = map.height / 2;
    still.circle(cx, cy, 520).fill({ color: 0x2b3a2c, alpha: 0.5 });
    for (const r of [500, 380, 250, 120]) still.circle(cx, cy, r).stroke({ width: 6, color: 0x55684f, alpha: 0.35 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      still.moveTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120).lineTo(cx + Math.cos(a) * 500, cy + Math.sin(a) * 500).stroke({ width: 3, color: 0x55684f, alpha: 0.25 });
    }
    // Cracks where the mosaic broke.
    for (let i = 0; i < 10; i++) crack(still, cx + (rand() - 0.5) * 800, cy + (rand() - 0.5) * 800, 60 + rand() * 80, 0x101610, 0.6, rand);
  } else if (index === 1) {
    // A paved road from the gates to the queen's arena.
    const y = map.spawn.y;
    const x0 = 200;
    const x1 = map.arena ? map.arena.x : map.width - 200;
    still.rect(x0, y - 70, x1 - x0, 140).fill({ color: 0x232c38, alpha: 0.85 });
    for (let x = x0; x < x1; x += 46) {
      for (let row = 0; row < 3; row++) {
        const off = row % 2 ? 23 : 0;
        still.roundRect(x + off + 2, y - 68 + row * 46, 42, 42, 4).stroke({ width: 2, color: 0x11161d, alpha: 0.6 });
      }
    }
    if (map.arena) {
      const { x, y: ay, r } = map.arena;
      still.circle(x, ay, r - 10).fill({ color: 0x2a3644, alpha: 0.7 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        still.poly([x + Math.cos(a) * (r - 60), ay + Math.sin(a) * (r - 60), x + Math.cos(a + 0.08) * (r - 20), ay + Math.sin(a + 0.08) * (r - 20), x + Math.cos(a - 0.08) * (r - 20), ay + Math.sin(a - 0.08) * (r - 20)]).fill({ color: 0xb3e5fc, alpha: 0.25 });
      }
    }
  } else {
    // A scorched road up to the arena, and rivers of lava along the sides of the map.
    const x = map.spawn.x;
    const yTop = map.arena ? map.arena.y : 300;
    still.rect(x - 80, yTop, 160, map.spawn.y - yTop + 100).fill({ color: 0x15100d, alpha: 0.7 });
    for (const side of [0, 1]) {
      const pts: number[] = [];
      const baseX = side === 0 ? 180 : map.width - 180;
      for (let y = -40; y <= map.height + 40; y += 120) pts.push(baseX + Math.sin(y / 260 + side) * 60, y);
      lavaRiver(glow, still, pts, 55);
    }
    if (map.arena) {
      const { x: ax, y: ay, r } = map.arena;
      still.circle(ax, ay, r - 6).fill({ color: 0x1a0f0b, alpha: 0.8 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        crack(glow, ax + Math.cos(a) * r * 0.5, ay + Math.sin(a) * r * 0.5, r * 0.45, 0xff6d00, 0.8, rand, 4);
      }
    }
  }
}

function lavaRiver(glow: Graphics, still: Graphics, pts: number[], width: number): void {
  const line = (g: Graphics) => {
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    return g;
  };
  line(still).stroke({ width: width + 24, color: 0x2a120a, cap: 'round', join: 'round' });
  line(glow).stroke({ width, color: 0xff6d00, alpha: 0.85, cap: 'round', join: 'round' });
  line(glow).stroke({ width: width * 0.45, color: 0xffd180, alpha: 0.8, cap: 'round', join: 'round' });
}

/** A jagged crack: a few short segments wandering in a direction. */
function crack(g: Graphics, x: number, y: number, length: number, color: number, alpha: number, rand: () => number, width = 2): void {
  let a = rand() * Math.PI * 2;
  g.moveTo(x, y);
  let cx = x;
  let cy = y;
  for (let d = 0; d < length; d += 14) {
    a += (rand() - 0.5) * 0.9;
    cx += Math.cos(a) * 14;
    cy += Math.sin(a) * 14;
    g.lineTo(cx, cy);
  }
  g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
}

function rock(g: Graphics, x: number, y: number, size: number, color: number, rand: () => number): void {
  const pts: number[] = [];
  const n = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = size * (0.75 + rand() * 0.35);
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
  }
  g.ellipse(x + 3, y + size * 0.55, size, size * 0.4).fill({ color: 0x000000, alpha: 0.25 });
  g.poly(pts).fill(color).stroke({ width: 2, color: shade(color, -0.5) });
  g.ellipse(x - size * 0.25, y - size * 0.3, size * 0.4, size * 0.2).fill({ color: 0xffffff, alpha: 0.12 });
}

function ruinsProp(g: Graphics, x: number, y: number, roll: number, s: number, rand: () => number): void {
  if (roll < 0.38) {
    // A grass tuft.
    for (let i = 0; i < 5; i++) {
      const bx = x + (rand() - 0.5) * 14 * s;
      g.moveTo(bx, y).lineTo(bx + (rand() - 0.5) * 10, y - (8 + rand() * 10) * s).stroke({ width: 2, color: rand() < 0.5 ? 0x3d6b3f : 0x4f8a4a, cap: 'round' });
    }
  } else if (roll < 0.52) {
    // Wildflowers.
    const color = [0xfff59d, 0xf8bbd0, 0xe1f5fe, 0xce93d8][Math.floor(rand() * 4)];
    for (let i = 0; i < 4; i++) g.circle(x + (rand() - 0.5) * 22 * s, y + (rand() - 0.5) * 14 * s, 2.2).fill(color);
  } else if (roll < 0.72) {
    rock(g, x, y, (7 + rand() * 9) * s, 0x5d6b5a, rand);
  } else if (roll < 0.88) {
    // Moss.
    g.ellipse(x, y, 26 * s, 16 * s).fill({ color: 0x223d23, alpha: 0.55 });
  } else {
    // A fallen paving stone.
    g.roundRect(x - 14 * s, y - 10 * s, 28 * s, 20 * s, 3).fill({ color: 0x4b5748, alpha: 0.8 }).stroke({ width: 2, color: 0x2c332a, alpha: 0.8 });
  }
}

function frostProp(g: Graphics, x: number, y: number, roll: number, s: number, rand: () => number): void {
  if (roll < 0.35) {
    // A snow drift: soft and bright, brightest on top.
    g.ellipse(x, y, 34 * s, 15 * s).fill({ color: 0xe3f2fd, alpha: 0.16 });
    g.ellipse(x - 4, y - 3, 24 * s, 9 * s).fill({ color: 0xffffff, alpha: 0.14 });
    g.ellipse(x - 8, y - 5, 10 * s, 4 * s).fill({ color: 0xffffff, alpha: 0.2 });
  } else if (roll < 0.5) {
    crack(g, x, y, 50 * s, 0x90caf9, 0.35, rand, 1.5);
  } else if (roll < 0.7) {
    // Ice crystals sticking out of the ground.
    for (let i = 0; i < 3; i++) {
      const cx = x + (rand() - 0.5) * 18 * s;
      const h = (10 + rand() * 12) * s;
      g.poly([cx - 4 * s, y, cx, y - h, cx + 4 * s, y]).fill({ color: 0xb3e5fc, alpha: 0.75 }).stroke({ width: 1, color: 0xe1f5fe, alpha: 0.8 });
    }
  } else if (roll < 0.88) {
    rock(g, x, y, (7 + rand() * 9) * s, 0x4a5868, rand);
  } else {
    // A frozen puddle.
    g.ellipse(x, y, 28 * s, 14 * s).fill({ color: 0x81d4fa, alpha: 0.12 }).stroke({ width: 1.5, color: 0xb3e5fc, alpha: 0.35 });
  }
}

function calderaProp(g: Graphics, glow: Graphics, x: number, y: number, roll: number, s: number, rand: () => number): void {
  if (roll < 0.3) {
    // A pile of ash.
    g.ellipse(x, y, 26 * s, 14 * s).fill({ color: 0x5d5450, alpha: 0.3 });
  } else if (roll < 0.52) {
    // Ground cracked open over magma.
    crack(g, x, y, 60 * s, 0x0c0705, 0.9, rand, 5);
    crack(glow, x, y, 60 * s, 0xff6d00, 0.6, seeded(Math.floor(x * 13 + y)), 2);
  } else if (roll < 0.65) {
    // Old bones.
    g.moveTo(x - 9 * s, y).lineTo(x + 9 * s, y + 3).stroke({ width: 3, color: 0xd7ccc8, cap: 'round' });
    g.circle(x - 10 * s, y - 1, 2.5).circle(x + 10 * s, y + 4, 2.5).fill(0xd7ccc8);
  } else if (roll < 0.88) {
    rock(g, x, y, (7 + rand() * 9) * s, 0x4e3b33, rand);
  } else if (roll < 0.94) {
    // A small lava pool.
    g.ellipse(x, y, 30 * s, 18 * s).fill(0x2a120a);
    glow.ellipse(x, y, 24 * s, 13 * s).fill({ color: 0xff6d00, alpha: 0.85 });
    glow.ellipse(x - 4, y - 2, 12 * s, 6 * s).fill({ color: 0xffd180, alpha: 0.7 });
  } else {
    // Embers.
    for (let i = 0; i < 5; i++) glow.circle(x + (rand() - 0.5) * 30, y + (rand() - 0.5) * 20, 1.5 + rand() * 1.5).fill({ color: 0xffab40, alpha: 0.8 });
  }
}

/** Walls with shadows and stonework; fences with planks and posts. */
export function drawWalls(map: MapDef): Graphics {
  const { theme } = map;
  const g = new Graphics();
  // Shadows first, so no wall is darkened by its neighbor's.
  for (const w of map.walls) g.rect(w.x + 6, w.y + 9, w.w, w.h).fill({ color: 0x000000, alpha: w.thin ? 0.22 : 0.4 });
  for (const w of map.walls) {
    if (w.thin) {
      fence(g, w, theme);
      continue;
    }
    g.rect(w.x, w.y, w.w, w.h).fill(theme.wall);
    // Courses of stone: rows with staggered joints.
    const row = 16;
    const brick = 30;
    const line = shade(theme.wall, -0.35);
    for (let y = w.y + row; y < w.y + w.h - 2; y += row) g.rect(w.x + 2, y, w.w - 4, 1.5);
    for (let y = w.y, r = 0; y < w.y + w.h - 2; y += row, r++) {
      for (let x = w.x + (r % 2 ? brick / 2 : brick); x < w.x + w.w - 4; x += brick) g.rect(x, y + 1, 1.5, Math.min(row - 1, w.y + w.h - y - 2));
    }
    g.fill({ color: line, alpha: 0.55 });
    // Light on top, dark at the bottom, a crisp edge.
    g.rect(w.x + 2, w.y + 2, w.w - 4, Math.min(5, w.h - 4)).fill({ color: 0xffffff, alpha: 0.16 });
    g.rect(w.x + 2, w.y + w.h - Math.min(5, w.h / 3), w.w - 4, Math.min(5, w.h / 3) - 2).fill({ color: 0x000000, alpha: 0.2 });
    g.rect(w.x, w.y, w.w, w.h).stroke({ width: 3, color: theme.wallEdge, alignment: 1 });
  }
  return g;
}

function fence(g: Graphics, w: { x: number; y: number; w: number; h: number }, theme: MapDef['theme']): void {
  const along = w.w > w.h;
  const length = along ? w.w : w.h;
  const dark = shade(theme.fence, -0.45);
  // Two rails.
  if (along) {
    g.rect(w.x, w.y + 2, w.w, 3).rect(w.x, w.y + w.h - 5, w.w, 3).fill(theme.fence);
  } else {
    g.rect(w.x + 2, w.y, 3, w.h).rect(w.x + w.w - 5, w.y, 3, w.h).fill(theme.fence);
  }
  // Posts.
  for (let d = 0; d <= length; d += 36) {
    const px = along ? w.x + Math.min(d, w.w - 8) : w.x - 2;
    const py = along ? w.y - 3 : w.y + Math.min(d, w.h - 8);
    g.roundRect(px, py, along ? 8 : w.w + 4, along ? w.h + 6 : 8, 2).fill(shade(theme.fence, -0.15)).stroke({ width: 1.5, color: dark });
  }
}
