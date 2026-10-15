// Map looks: a ground texture per map, decorations scattered over the floor, landmarks, and detailed walls.
// Everything here is drawn once when the map loads, so it costs nothing per frame (apart from the Caldera's
// glowing cracks, whose alpha pulses, the lava's edge, and the arena gate).

import { Graphics } from 'pixi.js';
import { WallIndex, overlapsWall, type Wall } from '../shared/collision';
import { insideArena, type MapDef } from '../shared/maps';
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

/** Random seeds per look, so each map always looks the same (and keeps its look if the map order changes). */
const SEED: Record<MapDef['art'], number> = { ruins: 0, frost: 1, caldera: 2, forest: 3, canyon: 4 };

/** The repeating floor texture: the base color with speckles, a faint grid, and a touch of the map's flavor. */
export function groundTile(map: MapDef): Graphics {
  const { theme } = map;
  const rand = seeded(1000 + SEED[map.art]);
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
  if (map.art === 'forest') {
    // Lush grass in two greens, and a few tiny flowers.
    for (let i = 0; i < 90; i++) {
      const x = rand() * TILE;
      const y = rand() * TILE;
      g.moveTo(x, y).lineTo(x + (rand() - 0.5) * 5, y - 5 - rand() * 5).stroke({ width: 1.6, color: rand() < 0.5 ? 0x3f7d36 : 0x56973f, alpha: 0.85 });
    }
    for (let i = 0; i < 5; i++) g.circle(rand() * TILE, rand() * TILE, 1.4).fill({ color: rand() < 0.5 ? 0xfff59d : 0xffffff, alpha: 0.7 });
  } else if (map.art === 'canyon') {
    // Ripples in the sand, and pebbles.
    for (let i = 0; i < 9; i++) {
      const x = rand() * TILE;
      const y = rand() * TILE;
      const w = 20 + rand() * 30;
      g.moveTo(x, y).quadraticCurveTo(x + w / 2, y - 4, x + w, y).stroke({ width: 1.5, color: 0x7a5f40, alpha: 0.5 });
    }
    for (let i = 0; i < 25; i++) g.circle(rand() * TILE, rand() * TILE, 1 + rand() * 1.5).fill({ color: rand() < 0.5 ? 0x2e2216 : 0x8a6d4a, alpha: 0.6 });
  } else if (map.art === 'ruins') {
    // Grass blades.
    for (let i = 0; i < 40; i++) {
      const x = rand() * TILE;
      const y = rand() * TILE;
      g.moveTo(x, y).lineTo(x + (rand() - 0.5) * 4, y - 4 - rand() * 4).stroke({ width: 1.5, color: 0x2e4a2f, alpha: 0.8 });
    }
  } else if (map.art === 'frost') {
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

/**
 * Things lying on the floor: `still` never changes; `glow` (lava, embers) has its alpha pulsed by the renderer;
 * `top` goes over the walls (battlements, the throne, the fountain).
 */
export function decorations(map: MapDef): { still: Graphics; glow: Graphics; top: Graphics } {
  const rand = seeded(7 + SEED[map.art] * 31);
  const walls = new WallIndex(map.walls, map.width, map.height);
  const still = new Graphics();
  const glow = new Graphics();
  const top = new Graphics();
  landmarks(map, still, glow, top, rand);

  const count = Math.round((map.width * map.height) / 21000);
  for (let i = 0; i < count; i++) {
    const x = 40 + rand() * (map.width - 80);
    const y = 40 + rand() * (map.height - 80);
    const roll = rand();
    const size = 0.7 + rand() * 0.8;
    if (overlapsWall(walls, x, y, 26)) continue;
    // Arena floors stay clean.
    if (map.arena && insideArena(map.arena, x, y, -30)) continue;
    // Not in the river either.
    if (map.river && nearRiver(map, x, y, 30)) continue;
    if (map.art === 'forest') forestProp(still, x, y, roll, size, rand);
    else if (map.art === 'ruins') ruinsProp(still, x, y, roll, size, rand);
    else if (map.art === 'frost') frostProp(still, x, y, roll, size, rand);
    else if (map.art === 'canyon') canyonProp(still, x, y, roll, size, rand);
    else calderaProp(still, glow, x, y, roll, size, rand);
  }
  return { still, glow, top };
}

/** Big set pieces that give each map a sense of place. */
function landmarks(map: MapDef, still: Graphics, glow: Graphics, top: Graphics, rand: () => number): void {
  if (map.art === 'forest') {
    forestArt(map, still, glow, rand);
  } else if (map.art === 'canyon') {
    canyonArt(map, still, rand);
  } else if (map.art === 'ruins') {
    // An old mosaic floor in the courtyard.
    const cx = map.spawn.x;
    const cy = map.spawn.y;
    still.circle(cx, cy, 520).fill({ color: 0x2b3a2c, alpha: 0.5 });
    for (const r of [500, 380, 250, 120]) still.circle(cx, cy, r).stroke({ width: 6, color: 0x55684f, alpha: 0.35 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      still.moveTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120).lineTo(cx + Math.cos(a) * 500, cy + Math.sin(a) * 500).stroke({ width: 3, color: 0x55684f, alpha: 0.25 });
    }
    // Cracks where the mosaic broke.
    for (let i = 0; i < 10; i++) crack(still, cx + (rand() - 0.5) * 800, cy + (rand() - 0.5) * 800, 60 + rand() * 80, 0x101610, 0.6, rand);
    colosseumArt(map, still, rand);
  } else if (map.art === 'frost') {
    castleArt(map, still, top, rand);
  } else {
    calderaArt(map, still, glow, top, rand);
  }
}

/** Is (x, y) within `margin` of the river's water? */
function nearRiver(map: MapDef, x: number, y: number, margin: number): boolean {
  const river = map.river!;
  const i = Math.max(0, Math.min(river.points.length - 1, Math.round((y / (river.points[1].y - river.points[0].y)))));
  return Math.abs(x - river.points[i].x) < river.width / 2 + margin;
}

/** The Emerald Woods: a dirt path from camp to the glade, the river with its bridges and ford, and the glade itself. */
function forestArt(map: MapDef, still: Graphics, glow: Graphics, rand: () => number): void {
  const river = map.river!;
  const arena = map.arena!;
  // The dirt path from camp, across the ford, to the glade's gate.
  const y = map.spawn.y;
  const pathEnd = arena.x - 600;
  still.moveTo(map.spawn.x - 250, y);
  for (let x = map.spawn.x - 250; x <= pathEnd; x += 40) still.lineTo(x, y + Math.sin(x / 260) * 30);
  still.stroke({ width: 110, color: 0x4a3b25, alpha: 0.75, cap: 'round', join: 'round' });
  for (let i = 0; i < 60; i++) {
    const x = map.spawn.x - 200 + rand() * (pathEnd - map.spawn.x + 200);
    still.circle(x, y + Math.sin(x / 260) * 30 + (rand() - 0.5) * 70, 2 + rand() * 3).fill({ color: 0x6d5a3a, alpha: 0.7 });
  }
  // The river: muddy banks, water, a lighter channel down the middle, and glints that shimmer.
  const line = (g: Graphics) => {
    g.moveTo(river.points[0].x, river.points[0].y);
    for (const p of river.points) g.lineTo(p.x, p.y);
    return g;
  };
  line(still).stroke({ width: river.width + 50, color: 0x3d3220, cap: 'round', join: 'round' });
  line(still).stroke({ width: river.width + 14, color: 0x2a6e3a, alpha: 0.8, cap: 'round', join: 'round' });
  line(still).stroke({ width: river.width, color: 0x1f6aa5, cap: 'round', join: 'round' });
  line(still).stroke({ width: river.width * 0.5, color: 0x2b8bd0, alpha: 0.7, cap: 'round', join: 'round' });
  for (let i = 0; i < river.points.length; i += 3) {
    const p = river.points[i];
    const x = p.x + (rand() - 0.5) * river.width * 0.7;
    glow.moveTo(x - 10, p.y).lineTo(x + 10, p.y).stroke({ width: 2, color: 0xe1f5fe, alpha: 0.5, cap: 'round' });
  }
  const at = (cy: number) => river.points[Math.round(cy / (river.points[1].y - river.points[0].y))].x;
  for (const c of river.crossings) {
    const cx = at(c.y);
    const half = river.width / 2 + 40;
    if (c.kind === 'bridge') {
      // A plank bridge with rails.
      // As wide as the gap in the river's walls (see riverWalls).
      still.rect(cx - half + 5, c.y - 115, half * 2, 240).fill({ color: 0x000000, alpha: 0.3 });
      still.rect(cx - half, c.y - 120, half * 2, 240).fill(0x8d6e4a);
      for (let x = cx - half + 14; x < cx + half; x += 16) still.rect(x, c.y - 120, 2, 240);
      still.fill({ color: 0x4e3a24, alpha: 0.8 });
      still.rect(cx - half, c.y - 128, half * 2, 12).rect(cx - half, c.y + 116, half * 2, 12).fill(0x5d4330);
    } else {
      // A ford: shallow water and stepping stones.
      still.roundRect(cx - half, c.y - 125, half * 2, 250, 40).fill({ color: 0x5fb3d9, alpha: 0.6 });
      for (let i = 0; i < 7; i++) {
        const sx = cx - half + 20 + (i * (half * 2 - 40)) / 6;
        for (const dy of [-45, 40]) still.ellipse(sx + (rand() - 0.5) * 10, c.y + dy + (rand() - 0.5) * 16, 18, 14).fill(0x9e9e8e).stroke({ width: 2, color: 0x5d5d50 });
      }
    }
  }
  // The glade: soft bright grass, rings of flowers and a circle of mossy stones in the middle.
  still.circle(arena.x, arena.y, 500).fill({ color: 0x2f6a2a, alpha: 0.9 });
  still.circle(arena.x, arena.y, 330).stroke({ width: 40, color: 0x3a7d33, alpha: 0.6 });
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const d = 120 + rand() * 340;
    still.circle(arena.x + Math.cos(a) * d, arena.y + Math.sin(a) * d, 2.5).fill([0xfff176, 0xf48fb1, 0xffffff, 0xce93d8][Math.floor(rand() * 4)]);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    rock(still, arena.x + Math.cos(a) * 110, arena.y + Math.sin(a) * 110, 16, 0x7d8c6e, rand);
  }
}

/** The Sunscar Canyon: a dry riverbed down the canyon, a giant's ribcage, a miners' tent, and the scorpion's sandy den. */
function canyonArt(map: MapDef, still: Graphics, rand: () => number): void {
  const arena = map.arena!;
  const bed = (x: number) => map.spawn.y + Math.sin(x / 600) * 180;
  still.moveTo(0, bed(0));
  for (let x = 0; x <= arena.x - 560; x += 40) still.lineTo(x, bed(x));
  still.stroke({ width: 150, color: 0x3a2b1c, alpha: 0.55, cap: 'round', join: 'round' });
  for (let i = 0; i < 40; i++) {
    const x = rand() * (arena.x - 600);
    crack(still, x, bed(x) + (rand() - 0.5) * 100, 30 + rand() * 40, 0x24190f, 0.7, rand);
  }
  // Bones of something huge.
  const ribs = { x: 1250, y: 1650 };
  still.moveTo(ribs.x - 160, ribs.y).lineTo(ribs.x + 160, ribs.y).stroke({ width: 10, color: 0xd7ccc8, cap: 'round' });
  for (let i = 0; i < 6; i++) {
    const x = ribs.x - 130 + i * 52;
    for (const side of [-1, 1]) still.moveTo(x, ribs.y).quadraticCurveTo(x + 30, ribs.y + side * 50, x + 10, ribs.y + side * 85).stroke({ width: 7, color: 0xd7ccc8, cap: 'round' });
  }
  still.ellipse(ribs.x + 200, ribs.y, 40, 30).fill(0xd7ccc8).stroke({ width: 2, color: 0x8d6e63 });
  still.circle(ribs.x + 210, ribs.y - 10, 7).circle(ribs.x + 210, ribs.y + 10, 7).fill(0x3e2723);
  // The miners' tent.
  const tent = { x: 2080, y: 2370 };
  still.poly([tent.x - 70, tent.y + 40, tent.x, tent.y - 50, tent.x + 70, tent.y + 40]).fill(0xb08a5a).stroke({ width: 3, color: 0x5d4330 });
  still.poly([tent.x - 14, tent.y + 40, tent.x, tent.y - 10, tent.x + 14, tent.y + 40]).fill(0x3e2c1c);
  // The den: a sandy pit ringed with bones.
  still.circle(arena.x, arena.y, 500).fill({ color: 0x6b5235 });
  for (const r of [380, 220]) still.circle(arena.x, arena.y, r).stroke({ width: 3, color: 0x8a6c47, alpha: 0.6 });
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 300;
    const bx = arena.x + Math.cos(a) * d;
    const by = arena.y + Math.sin(a) * d;
    const t = rand() * Math.PI;
    still.moveTo(bx - Math.cos(t) * 14, by - Math.sin(t) * 14).lineTo(bx + Math.cos(t) * 14, by + Math.sin(t) * 14).stroke({ width: 4, color: 0xd7ccc8, cap: 'round' });
  }
}

/** The Verdant Ruins' colosseum: a worn path to its gate, stone seating under the ring of blocks, a sand floor. */
function colosseumArt(map: MapDef, still: Graphics, rand: () => number): void {
  const { x, y } = map.arena!;
  const x0 = map.spawn.x + 560;
  const x1 = x - 560;
  still.rect(x0, y - 60, x1 - x0, 120).fill({ color: 0x252f25, alpha: 0.7 });
  for (let px = x0; px < x1 - 40; px += 44) {
    for (let row = 0; row < 3; row++) {
      if (rand() < 0.3) continue; // Missing stones.
      still.roundRect(px + (row % 2 ? 22 : 0) + 2, y - 58 + row * 39, 40, 36, 4).fill({ color: 0x4b5748, alpha: 0.55 }).stroke({ width: 1.5, color: 0x1c231c, alpha: 0.6 });
    }
  }
  still.circle(x, y, 540).stroke({ width: 100, color: shade(map.theme.wall, -0.3) });
  for (const r of [505, 575]) still.circle(x, y, r).stroke({ width: 3, color: shade(map.theme.wall, -0.55), alpha: 0.8 });
  still.circle(x, y, 488).fill({ color: 0x4a4430 });
  for (const r of [380, 230, 70]) still.circle(x, y, r).stroke({ width: 3, color: 0x5e5640, alpha: 0.5 });
  for (let i = 0; i < 14; i++) crack(still, x + (rand() - 0.5) * 700, y + (rand() - 0.5) * 700, 40 + rand() * 60, 0x2e2a1d, 0.5, rand);
  // Old stains in the sand.
  for (let i = 0; i < 6; i++) still.ellipse(x + (rand() - 0.5) * 600, y + (rand() - 0.5) * 600, 30 + rand() * 30, 16 + rand() * 14).fill({ color: 0x3b1d16, alpha: 0.35 });
}

/** The Frozen Fortress: a cobbled road through the courtyard, the fountain, the throne hall, and battlements. */
function castleArt(map: MapDef, still: Graphics, top: Graphics, rand: () => number): void {
  const arena = map.arena!;
  const hall = arena.hall!;
  const y = map.spawn.y;
  const fountain = { x: 1800, y: 1500 };
  const cobbles = (x0: number, x1: number, y0: number, rows: number) => {
    for (let x = x0; x < x1; x += 46) {
      for (let row = 0; row < rows; row++) still.roundRect(x + (row % 2 ? 23 : 0) + 2, y0 + 2 + row * 46, 42, 42, 4).stroke({ width: 2, color: 0x11161d, alpha: 0.6 });
    }
  };
  // The road from the gatehouse to the keep, and the square around the fountain.
  const roadEnd = arena.x - hall.hw - 70;
  still.rect(60, y - 70, roadEnd - 60, 140).fill({ color: 0x232c38, alpha: 0.85 });
  cobbles(60, roadEnd - 46, y - 70, 3);
  still.circle(fountain.x, fountain.y, 290).fill({ color: 0x232c38, alpha: 0.9 });
  for (const r of [120, 190, 260]) still.circle(fountain.x, fountain.y, r).stroke({ width: 2, color: 0x11161d, alpha: 0.6 });
  // Snowed-over flower beds in the hedge garden.
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    still.roundRect(fountain.x + dx * 210 - 70, fountain.y + dy * 210 - 50, 140, 100, 16).fill({ color: 0xdfeaf5, alpha: 0.12 });
  }

  // The throne hall: a tiled floor and a long carpet up to the throne.
  const hx = arena.x - hall.hw;
  const hy = arena.y - hall.hh;
  still.rect(hx, hy, hall.hw * 2, hall.hh * 2).fill(0x1b2330);
  for (let tx = hx; tx <= hx + hall.hw * 2; tx += 80) still.rect(tx, hy, 1.5, hall.hh * 2);
  for (let ty = hy; ty <= hy + hall.hh * 2; ty += 80) still.rect(hx, ty, hall.hw * 2, 1.5);
  still.fill({ color: 0x0e131a, alpha: 0.8 });
  const carpetEnd = arena.x + hall.hw - 140;
  still.rect(hx, arena.y - 60, carpetEnd - hx, 120).fill(0x5c1820);
  still.rect(hx, arena.y - 50, carpetEnd - hx, 3).rect(hx, arena.y + 47, carpetEnd - hx, 3).fill(0xc9a227);
  // The dais and the ice throne.
  const tx = arena.x + hall.hw - 80;
  still.rect(tx - 70, arena.y - 130, 150, 260).fill(0x2a3644).stroke({ width: 3, color: 0x52606f });
  still.rect(tx - 50, arena.y - 110, 130, 220).fill(0x34445a);
  top.poly([tx + 30, arena.y - 50, tx + 50, arena.y - 95, tx + 58, arena.y - 40, tx + 58, arena.y + 40, tx + 50, arena.y + 95, tx + 30, arena.y + 50]).fill({ color: 0xb3e5fc, alpha: 0.9 }).stroke({ width: 2, color: 0xe1f5fe });
  top.roundRect(tx - 15, arena.y - 38, 50, 76, 8).fill({ color: 0x81d4fa, alpha: 0.85 }).stroke({ width: 2, color: 0xe1f5fe });
  for (const dy of [-1, 1]) top.poly([tx + 40, arena.y + dy * 30, tx + 70, arena.y + dy * 70, tx + 52, arena.y + dy * 20]).fill({ color: 0xe1f5fe, alpha: 0.9 });

  // Battlements on the castle walls and towers (not the thinner rooms, carts or statues).
  const stone = shade(map.theme.wall, 0.12);
  const edge = shade(map.theme.wall, -0.45);
  for (const w of map.walls) {
    if (w.thin) continue;
    const thick = Math.min(w.w, w.h);
    const long = Math.max(w.w, w.h);
    if (thick >= 120) {
      // A tower: a darker roof ringed with merlons.
      top.rect(w.x + 14, w.y + 14, w.w - 28, w.h - 28).fill({ color: shade(map.theme.wall, -0.2) }).stroke({ width: 2, color: edge });
      for (let d = 6; d + 16 <= w.w - 6; d += 30) top.rect(w.x + d, w.y + 4, 16, 10).rect(w.x + d, w.y + w.h - 14, 16, 10);
      for (let d = 6; d + 16 <= w.h - 6; d += 30) top.rect(w.x + 4, w.y + d, 10, 16).rect(w.x + w.w - 14, w.y + d, 10, 16);
      top.fill(stone).stroke({ width: 1.5, color: edge });
    } else if (thick >= 60 && long >= 120) {
      // A wall walk: a row of merlons down the middle.
      const across = Math.round(thick * 0.4);
      for (let d = 10; d + 18 <= long - 10; d += 34) {
        if (w.w > w.h) top.rect(w.x + d, w.y + (w.h - across) / 2, 18, across);
        else top.rect(w.x + (w.w - across) / 2, w.y + d, across, 18);
      }
      top.fill(stone).stroke({ width: 1.5, color: edge });
    }
  }
  // The main gate in the west wall, shut for good: a portcullis.
  top.rect(0, y - 100, 60, 200).fill(0x20262e);
  for (let by = y - 92; by < y + 100; by += 16) top.rect(4, by, 52, 3);
  for (let bx = 8; bx < 60; bx += 14) top.rect(bx, y - 100, 3, 200);
  top.fill(0x6b7785);
  // Red banners on either side of the keep's gate.
  const gate = arena.gate[0];
  for (const by of [gate.y - 95, gate.y + gate.h + 25]) {
    top.poly([gate.x - 64, by, gate.x - 30, by, gate.x - 30, by + 60, gate.x - 47, by + 48, gate.x - 64, by + 60]).fill(0x8e1b26).stroke({ width: 2, color: 0x4a0d13 });
    top.circle(gate.x - 47, by + 22, 7).fill(0xb3e5fc);
  }
  // The frozen fountain on its plinth.
  top.circle(fountain.x, fountain.y, 46).fill({ color: 0x81d4fa, alpha: 0.55 }).stroke({ width: 4, color: 0xb0bec5 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand() * 0.3;
    const h = 22 + rand() * 18;
    top.poly([fountain.x + Math.cos(a - 0.3) * 10, fountain.y + Math.sin(a - 0.3) * 10, fountain.x + Math.cos(a) * h, fountain.y + Math.sin(a) * h, fountain.x + Math.cos(a + 0.3) * 10, fountain.y + Math.sin(a + 0.3) * 10]).fill({ color: 0xe1f5fe, alpha: 0.9 });
  }
  top.circle(fountain.x, fountain.y, 9).fill(0xffffff);
}

/** The Ashen Caldera: a dark heart ringed with runes where the lava will stop, and a rocky lip at the rim. */
function calderaArt(map: MapDef, still: Graphics, glow: Graphics, top: Graphics, rand: () => number): void {
  const lava = map.lava!;
  const { x, y } = lava;
  still.circle(x, y, lava.r - 20).stroke({ width: 50, color: 0x2a1c16, alpha: 0.55 });
  still.circle(x, y, lava.final + 40).fill({ color: 0x120c09, alpha: 0.7 });
  // Runes around the heart, where the lava stops.
  glow.circle(x, y, lava.final).stroke({ width: 3, color: 0xff6d00, alpha: 0.45 });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const rx = x + Math.cos(a) * (lava.final + 18);
    const ry = y + Math.sin(a) * (lava.final + 18);
    glow.poly([rx, ry - 7, rx + 5, ry, rx, ry + 7, rx - 5, ry]).fill({ color: 0xff9100, alpha: 0.75 });
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.4;
    crack(still, x + Math.cos(a) * 120, y + Math.sin(a) * 120, 380, 0x0c0705, 0.9, rand, 6);
    crack(glow, x + Math.cos(a) * 120, y + Math.sin(a) * 120, 300, 0xff6d00, 0.7, seeded(i + 5), 2.5);
  }
  // Glowing runes on the obelisks around the heart.
  for (const w of map.walls) {
    const cx = w.x + w.w / 2;
    const cy = w.y + w.h / 2;
    if ((cx - x) ** 2 + (cy - y) ** 2 > lava.final ** 2) continue;
    top.poly([cx, cy - 18, cx + 11, cy, cx, cy + 18, cx - 11, cy]).stroke({ width: 3, color: 0xff9100, alpha: 0.9 });
    top.circle(cx, cy, 4).fill(0xffd180);
  }
  // The team's camp: a burnt-out fire.
  const camp = map.spawn;
  still.circle(camp.x, camp.y + 40, 34).fill({ color: 0x0c0705, alpha: 0.8 });
  for (let i = 0; i < 6; i++) glow.circle(camp.x + (rand() - 0.5) * 30, camp.y + 40 + (rand() - 0.5) * 20, 2 + rand() * 2).fill({ color: 0xff9100, alpha: 0.8 });
}

/**
 * The sea of lava around the Caldera: molten rock under drifting plates of crust. Drawn once over the whole map;
 * the renderer masks it to whatever lies past the current edge.
 */
export function lavaField(map: MapDef): Graphics {
  const lava = map.lava!;
  const rand = seeded(424242);
  const g = new Graphics().rect(0, 0, map.width, map.height).fill(0xd84315);
  for (let i = 0; i < 220; i++) g.ellipse(rand() * map.width, rand() * map.height, 60 + rand() * 120, 30 + rand() * 60).fill({ color: 0xff9100, alpha: 0.35 });
  const cell = 150;
  for (let cy = 0; cy < map.height + cell; cy += cell) {
    for (let cx = 0; cx < map.width + cell; cx += cell) {
      const px = cx + (rand() - 0.5) * 50;
      const py = cy + (rand() - 0.5) * 50;
      if (rand() < 0.3 || (px - lava.x) ** 2 + (py - lava.y) ** 2 < (lava.final - 80) ** 2) continue;
      const pts: number[] = [];
      const n = 5 + Math.floor(rand() * 3);
      const size = cell * (0.3 + rand() * 0.16);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.4;
        const r = size * (0.75 + rand() * 0.35);
        pts.push(px + Math.cos(a) * r, py + Math.sin(a) * r);
      }
      g.poly(pts).fill({ color: 0x3e2723, alpha: 0.9 }).stroke({ width: 3, color: 0xffab40, alpha: 0.5 });
      g.ellipse(px - size * 0.2, py - size * 0.25, size * 0.35, size * 0.18).fill({ color: 0x6d4c41, alpha: 0.5 });
    }
  }
  for (let i = 0; i < 160; i++) g.circle(rand() * map.width, rand() * map.height, 3 + rand() * 6).fill({ color: 0xffe0b2, alpha: 0.7 });
  return g;
}

/** A wall of thorny brambles (the glade's gate), pulling back into the trees as it opens. */
function brambles(g: Graphics, r: { x: number; y: number; w: number; h: number }, vertical: boolean, leaf: number, end: number): void {
  const rand = seeded(17 + end);
  g.roundRect(r.x - 4, r.y, r.w + 8, r.h, 14).fill(0x1e3d1a);
  // Tangled stems along its length.
  for (let k = 0; k < 4; k++) {
    const off = (k + 0.5) / 4;
    for (let d = 0; d < leaf; d += 8) {
      const wave = Math.sin(d / 14 + k * 1.7) * 9;
      const px = vertical ? r.x + r.w * off + wave : r.x + d;
      const py = vertical ? r.y + d : r.y + r.h * off + wave;
      if (d === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke({ width: 4, color: k % 2 ? 0x33691e : 0x558b2f, cap: 'round', join: 'round' });
  }
  // Thorns, leaves and the odd berry.
  for (let d = 6; d < leaf - 4; d += 11) {
    const px = vertical ? r.x + rand() * r.w : r.x + d;
    const py = vertical ? r.y + d : r.y + rand() * r.h;
    const roll = rand();
    if (roll < 0.5) g.poly([px - 3, py, px, py - 7, px + 3, py]).fill(0xd7ccc8);
    else if (roll < 0.85) g.ellipse(px, py, 6, 3.5).fill(0x7cb342);
    else g.circle(px, py, 3).fill(0xc62828);
  }
}

/** An arena gate: a heavy double door of planks and iron. `open` (0 to 1) slides the halves apart into the walls. */
export function drawGate(g: Graphics, w: Wall, open: number, look: 'door' | 'vines' = 'door'): void {
  const vertical = w.h > w.w;
  const length = vertical ? w.h : w.w;
  const leaf = (length / 2) * (1 - open);
  if (leaf < 1) return;
  for (const end of [0, 1]) {
    const start = end === 0 ? 0 : length - leaf;
    const r = vertical ? { x: w.x + 6, y: w.y + start, w: w.w - 12, h: leaf } : { x: w.x + start, y: w.y + 6, w: leaf, h: w.h - 12 };
    if (look === 'vines') {
      brambles(g, r, vertical, leaf, end);
      continue;
    }
    g.rect(r.x + 5, r.y + 8, r.w, r.h).fill({ color: 0x000000, alpha: 0.35 });
    g.rect(r.x, r.y, r.w, r.h).fill(0x5d4037);
    // Planks across the door.
    for (let d = 14; d < leaf - 2; d += 16) {
      if (vertical) g.rect(r.x, r.y + d, r.w, 2);
      else g.rect(r.x + d, r.y, 2, r.h);
    }
    g.fill({ color: 0x2e1d18, alpha: 0.8 });
    // Iron bands down its length, studded.
    for (const at of [0.22, 0.72]) {
      if (vertical) g.rect(r.x + r.w * at, r.y, 6, r.h);
      else g.rect(r.x, r.y + r.h * at, r.w, 6);
    }
    g.fill(0x37474f);
    for (const at of [0.22, 0.72]) {
      for (let d = 10; d < leaf - 4; d += 22) {
        if (vertical) g.circle(r.x + r.w * at + 3, r.y + d, 2.2);
        else g.circle(r.x + d, r.y + r.h * at + 3, 2.2);
      }
    }
    g.fill(0xb0bec5);
    g.rect(r.x, r.y, r.w, r.h).stroke({ width: 2.5, color: 0x1b1210 });
  }
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

function forestProp(g: Graphics, x: number, y: number, roll: number, s: number, rand: () => number): void {
  if (roll < 0.3) {
    // A bright grass tuft.
    for (let i = 0; i < 6; i++) {
      const bx = x + (rand() - 0.5) * 16 * s;
      g.moveTo(bx, y).lineTo(bx + (rand() - 0.5) * 10, y - (9 + rand() * 11) * s).stroke({ width: 2, color: rand() < 0.5 ? 0x4caf50 : 0x7cb342, cap: 'round' });
    }
  } else if (roll < 0.46) {
    // Wildflowers.
    const color = [0xffeb3b, 0xff8a80, 0xffffff, 0xba68c8, 0x80d8ff][Math.floor(rand() * 5)];
    for (let i = 0; i < 5; i++) {
      const fx = x + (rand() - 0.5) * 26 * s;
      const fy = y + (rand() - 0.5) * 16 * s;
      g.circle(fx, fy, 3).fill(color);
      g.circle(fx, fy, 1.2).fill(0xfff176);
    }
  } else if (roll < 0.54) {
    // Red mushrooms.
    for (let i = 0; i < 3; i++) {
      const mx = x + (rand() - 0.5) * 20 * s;
      const my = y + (rand() - 0.5) * 12 * s;
      g.rect(mx - 1.5, my, 3, 5).fill(0xefebe9);
      g.ellipse(mx, my, 6 * s, 4 * s).fill(0xe53935);
      g.circle(mx - 2, my - 1, 1).circle(mx + 2, my, 1).fill(0xffffff);
    }
  } else if (roll < 0.68) {
    // A bush.
    for (let i = 0; i < 4; i++) g.circle(x + (rand() - 0.5) * 20 * s, y + (rand() - 0.5) * 12 * s, (9 + rand() * 6) * s).fill(i % 2 ? 0x2e7d32 : 0x388e3c);
    g.circle(x - 4 * s, y - 5 * s, 5 * s).fill({ color: 0x81c784, alpha: 0.5 });
  } else if (roll < 0.78) {
    // A fern.
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.35;
      g.moveTo(x, y).lineTo(x + Math.cos(a) * 18 * s, y + Math.sin(a) * 14 * s).stroke({ width: 2.5, color: 0x43a047, cap: 'round' });
    }
  } else if (roll < 0.9) {
    rock(g, x, y, (7 + rand() * 8) * s, 0x7d8c6e, rand);
    g.ellipse(x - 2, y - 3 * s, 6 * s, 3 * s).fill({ color: 0x66bb6a, alpha: 0.6 });
  } else {
    // A fallen log.
    g.roundRect(x - 22 * s, y - 6 * s, 44 * s, 12 * s, 6 * s).fill(0x6d4c35).stroke({ width: 2, color: 0x3e2a1c });
    g.ellipse(x + 22 * s, y, 4 * s, 6 * s).fill(0xa1887f).stroke({ width: 1.5, color: 0x3e2a1c });
  }
}

function canyonProp(g: Graphics, x: number, y: number, roll: number, s: number, rand: () => number): void {
  if (roll < 0.25) {
    // Pebbles.
    for (let i = 0; i < 5; i++) g.circle(x + (rand() - 0.5) * 24 * s, y + (rand() - 0.5) * 14 * s, (2 + rand() * 2.5) * s).fill(rand() < 0.5 ? 0x8a6d4a : 0x5d4630);
  } else if (roll < 0.42) {
    // Cracked dry earth.
    crack(g, x, y, 50 * s, 0x2b1f13, 0.7, rand, 2);
  } else if (roll < 0.52) {
    // A small cactus.
    g.roundRect(x - 4 * s, y - 22 * s, 8 * s, 24 * s, 4 * s).fill(0x558b2f).stroke({ width: 1.5, color: 0x33691e });
    g.roundRect(x - 13 * s, y - 15 * s, 6 * s, 10 * s, 3 * s).roundRect(x + 7 * s, y - 18 * s, 6 * s, 9 * s, 3 * s).fill(0x689f38).stroke({ width: 1.5, color: 0x33691e });
  } else if (roll < 0.6) {
    // Bleached bones.
    g.moveTo(x - 10 * s, y).lineTo(x + 10 * s, y + 3).stroke({ width: 3, color: 0xe0d6cc, cap: 'round' });
    g.circle(x - 11 * s, y - 1, 2.5).circle(x + 11 * s, y + 4, 2.5).fill(0xe0d6cc);
  } else if (roll < 0.8) {
    rock(g, x, y, (7 + rand() * 9) * s, 0x8d5f3e, rand);
  } else if (roll < 0.9) {
    // A dry shrub.
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.45;
      g.moveTo(x, y).lineTo(x + Math.cos(a) * 14 * s, y + Math.sin(a) * 12 * s).stroke({ width: 1.5, color: 0x8d6e4a, cap: 'round' });
    }
  } else {
    // A drift of lighter sand.
    g.ellipse(x, y, 34 * s, 12 * s).fill({ color: 0xc8a477, alpha: 0.18 });
  }
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
  // Shadows first, so no wall is darkened by its neighbor's. Water has none (the river is drawn with the floor).
  for (const w of map.walls) {
    if (w.look === 'water') continue;
    if (w.look === 'tree' || isBoulder(w)) g.ellipse(w.x + w.w / 2 + 8, w.y + w.h / 2 + 12, w.w * 0.62, w.h * 0.5).fill({ color: 0x000000, alpha: 0.35 });
    else g.rect(w.x + 6, w.y + 9, w.w, w.h).fill({ color: 0x000000, alpha: w.thin ? 0.22 : 0.4 });
  }
  for (const w of map.walls) {
    if (w.look === 'water') continue;
    if (w.look === 'tree') {
      treeTop(g, w);
      continue;
    }
    if (w.look === 'rock') {
      rockWall(g, w, map);
      continue;
    }
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

/** A tree from above: a round, layered canopy a little wider than its trunk's footprint. */
function treeTop(g: Graphics, w: Wall): void {
  const rand = seeded(Math.floor(w.x * 7 + w.y * 13));
  const cx = w.x + w.w / 2;
  const cy = w.y + w.h / 2;
  const r = w.w * 0.42;
  const dark = rand() < 0.5 ? 0x2e6b30 : 0x285e2c;
  g.circle(cx, cy, r * 1.45).fill(0x1b3d1c);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand();
    g.circle(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * (0.75 + rand() * 0.15)).fill(dark);
  }
  g.circle(cx, cy, r * 0.9).fill(0x388e3c);
  g.circle(cx - r * 0.3, cy - r * 0.35, r * 0.55).fill({ color: 0x66bb6a, alpha: 0.7 });
  g.circle(cx - r * 0.42, cy - r * 0.48, r * 0.22).fill({ color: 0xa5d6a7, alpha: 0.5 });
}

/** Rock: a boulder for small blocks, a mesa with a raised top in the open, or a cliff face along the map's edge. */
function rockWall(g: Graphics, w: Wall, map: MapDef): void {
  const { theme } = map;
  const rand = seeded(Math.floor(w.x * 7 + w.y * 13));
  if (isBoulder(w)) {
    rock(g, w.x + w.w / 2, w.y + w.h / 2, Math.max(w.w, w.h) * 0.62, theme.wall, rand);
    return;
  }
  const side = shade(theme.wall, -0.3);
  const atTop = w.y <= 0;
  const atBottom = w.y + w.h >= map.height;
  const strata = (x: number, y: number, width: number, height: number) => {
    for (let sy = Math.ceil(y / 26) * 26; sy < y + height; sy += 26) {
      g.rect(x, sy, width, Math.min(9, y + height - sy)).fill({ color: shade(theme.wall, (sy / 26) % 2 ? -0.16 : 0.1), alpha: 0.55 });
    }
  };
  // A rubbly edge so the rock doesn't look boxy.
  const rubble = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const length = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 0; d < length; d += 18) {
      const t0 = d / length;
      const t1 = Math.min(1, (d + 18) / length);
      const out = 4 + rand() * 9;
      const mx = x0 + (x1 - x0) * (t0 + t1) / 2 + nx * out;
      const my = y0 + (y1 - y0) * (t0 + t1) / 2 + ny * out;
      g.poly([x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, mx, my, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1]).fill(side);
    }
  };
  if (!atTop && !atBottom) {
    // A mesa: darker sides, a lighter top inset from them.
    g.roundRect(w.x, w.y, w.w, w.h, 10).fill(side).stroke({ width: 2, color: theme.wallEdge });
    rubble(w.x, w.y, w.x + w.w, w.y, 0, -1);
    rubble(w.x, w.y + w.h, w.x + w.w, w.y + w.h, 0, 1);
    rubble(w.x, w.y, w.x, w.y + w.h, -1, 0);
    rubble(w.x + w.w, w.y, w.x + w.w, w.y + w.h, 1, 0);
    g.roundRect(w.x + 12, w.y + 10, w.w - 24, w.h - 26, 8).fill(theme.wall);
    strata(w.x + 12, w.y + 10, w.w - 24, w.h - 26);
    g.roundRect(w.x + 12, w.y + 10, w.w - 24, w.h - 26, 8).stroke({ width: 2, color: shade(theme.wall, 0.2), alpha: 0.5 });
    for (let i = 0; i < Math.ceil((w.w * w.h) / 14000); i++) crack(g, w.x + 20 + rand() * (w.w - 40), w.y + 20 + rand() * (w.h - 50), 20 + rand() * 25, shade(theme.wall, -0.5), 0.6, rand);
    return;
  }
  // A cliff: strata on top, and a darker face where it drops to the canyon floor.
  g.rect(w.x, w.y, w.w, w.h).fill(theme.wall);
  strata(w.x, w.y, w.w, w.h);
  for (let i = 0; i < Math.ceil((w.w * w.h) / 9000); i++) crack(g, w.x + rand() * w.w, w.y + rand() * w.h, 20 + rand() * 30, shade(theme.wall, -0.5), 0.6, rand);
  const face = 18;
  if (atTop) {
    g.rect(w.x, w.y + w.h - face, w.w, face).fill(side);
    rubble(w.x, w.y + w.h, w.x + w.w, w.y + w.h, 0, 1);
  } else {
    g.rect(w.x, w.y, w.w, face).fill(side);
    rubble(w.x, w.y, w.x + w.w, w.y, 0, -1);
  }
}

/** Small rock blocks are drawn as boulders. */
function isBoulder(w: Wall): boolean {
  return w.look === 'rock' && w.w <= 140 && w.h <= 140;
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
