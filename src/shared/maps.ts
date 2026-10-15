import type { Wall } from './collision';
import { EnemyType, bossDisplayName } from './enemies';

/** The named boss arrives this many seconds in; with the fight that makes a run about 10 minutes. */
export const BOSS_TIME = 9 * 60;
/**
 * On arena maps, when the boss is due a burning zone sweeps in from the map's far corners toward the arena,
 * reaching the arena's edge after this many seconds.
 */
export const ZONE_SWEEP_TIME = 45;
/** Damage for standing in the burning zone, as a share of max HP per second. */
export const ZONE_DAMAGE = 0.08;

/** Lava maps: when the boss is due the rim closes in on the middle over this many seconds, then the boss arrives. */
export const LAVA_CLOSE_TIME = 40;
/** Standing in lava, as a share of max HP per second. Everyone burns (bosses barely), unless invulnerable. */
export const LAVA_DAMAGE = { player: 0.2, enemy: 0.25, boss: 0.015 };

/** A boss arena walled off by a gate that opens when the boss is due. */
export interface Arena {
  x: number;
  y: number;
  /** Round arenas: how far from the middle you're kept once inside. */
  r: number;
  /** A rectangular hall instead of a round arena: half its inside width and height. */
  hall?: { hw: number; hh: number };
  /** Where the burning zone stops (see `inZone`): just outside the arena's walls. */
  zone: number;
  /** The gate: walls that seal the arena until the boss is due (and again once everyone is inside). */
  gate: Wall[];
}

/** A map ringed by lava: everything farther than `r` from the middle burns. */
export interface Lava {
  x: number;
  y: number;
  r: number;
  /** How far the lava closes in for the boss fight. */
  final: number;
}

export interface MapDef {
  name: string;
  subtitle: string;
  width: number;
  height: number;
  /** Where the team starts. */
  spawn: { x: number; y: number };
  walls: Wall[];
  /** Enemy type of the named final boss. */
  boss: number;
  /** A second boss fought at the same time (kill them close together, or the survivor turns vengeful). */
  twin?: number;
  /** Display name for the boss fight, when there are two. */
  bossName?: string;
  /** A walled boss arena the team is forced into, or null. */
  arena: Arena | null;
  /** A lava rim that closes in for the boss (who then spawns in the middle). */
  lava?: Lava;
  /**
   * Multiplier on enemy health and damage (bosses included). Later maps are meant to need a few ranks of
   * prestige first.
   */
  difficulty: number;
  /** Prestige points per team level gained in a run here. */
  prestigeReward: number;
  /** Multipliers on enemy spawn weights, to give each map its own mix. */
  enemyWeights: Partial<Record<number, number>>;
  theme: { background: number; grid: number; wall: number; wallEdge: number; fence: number; outside: number };
}

/** Is a circle of radius `radius` at (x, y) all the way inside the arena? */
export function insideArena(a: Arena, x: number, y: number, radius: number): boolean {
  if (a.hall) return Math.abs(x - a.x) <= a.hall.hw - radius && Math.abs(y - a.y) <= a.hall.hh - radius;
  return (x - a.x) ** 2 + (y - a.y) ** 2 <= (a.r - radius) ** 2;
}

/** The nearest spot to (x, y) where a circle of radius `radius` is inside the arena. */
export function clampToArena(a: Arena, x: number, y: number, radius: number): { x: number; y: number } {
  if (a.hall) {
    return {
      x: Math.max(a.x - a.hall.hw + radius, Math.min(a.x + a.hall.hw - radius, x)),
      y: Math.max(a.y - a.hall.hh + radius, Math.min(a.y + a.hall.hh - radius, y)),
    };
  }
  const dx = x - a.x;
  const dy = y - a.y;
  const d = Math.hypot(dx, dy);
  const max = a.r - radius;
  return d > max && d > 0 ? { x: a.x + (dx / d) * max, y: a.y + (dy / d) * max } : { x, y };
}

/**
 * The burning zone's safe area as a rectangle, for halls: the hall, `safeR - hw` wider on every side. Null for round
 * arenas, where it's a circle of radius `safeR`.
 */
export function zoneRect(a: Arena, safeR: number): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!a.hall) return null;
  const pad = safeR - a.hall.hw;
  return { x0: a.x - a.hall.hw - pad, y0: a.y - a.hall.hh - pad, x1: a.x + a.hall.hw + pad, y1: a.y + a.hall.hh + pad };
}

/** Is (x, y) inside the burning zone's safe area? */
export function inZone(a: Arena, x: number, y: number, safeR: number): boolean {
  const box = zoneRect(a, safeR);
  if (box) return x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
  return (x - a.x) ** 2 + (y - a.y) ** 2 <= safeR ** 2;
}

/** Where the burning zone starts: just big enough that the whole map is safe. */
export function zoneStart(a: Arena, width: number, height: number): number {
  const across = Math.max(a.x, width - a.x);
  const down = Math.max(a.y, height - a.y);
  if (a.hall) return Math.max(across, down + a.hall.hw - a.hall.hh);
  return Math.hypot(across, down);
}

/** How far from the middle of the arena things can be placed (the smaller half-size, for a hall). */
export function arenaReach(a: Arena): number {
  return a.hall ? Math.min(a.hall.hw, a.hall.hh) : a.r;
}

/** The map's walls, plus the arena gate while it's shut. */
export function mapWalls(map: MapDef, gateShut: boolean): Wall[] {
  return gateShut && map.arena ? [...map.walls, ...map.arena.gate] : map.walls;
}

// --- Wall building blocks ---

const T = 40; // Thick wall width.
const F = 14; // Thin wall (fence) width.

const wall = (x: number, y: number, w: number, h: number): Wall => ({ x, y, w, h, thin: false });
const fence = (x: number, y: number, w: number, h: number): Wall => ({ x, y, w, h, thin: true });
const pillar = (cx: number, cy: number, size = 60): Wall => wall(cx - size / 2, cy - size / 2, size, size);

/** A rectangular room of thick walls, with a door gap in the middle of each listed side. */
function room(x: number, y: number, w: number, h: number, doors: ('n' | 's' | 'e' | 'w')[], door = 160): Wall[] {
  const horizontal = (wy: number, open: boolean) =>
    open ? [wall(x, wy, (w - door) / 2, T), wall(x + (w + door) / 2, wy, (w - door) / 2, T)] : [wall(x, wy, w, T)];
  const vertical = (wx: number, open: boolean) =>
    open ? [wall(wx, y, T, (h - door) / 2), wall(wx, y + (h + door) / 2, T, (h - door) / 2)] : [wall(wx, y, T, h)];
  return [
    ...horizontal(y, doors.includes('n')),
    ...horizontal(y + h - T, doors.includes('s')),
    ...vertical(x, doors.includes('w')),
    ...vertical(x + w - T, doors.includes('e')),
  ];
}

/** A horizontal fence from x1 to x2, with an optional gap in the middle. */
function fenceH(x1: number, x2: number, y: number, gap = 0): Wall[] {
  if (!gap) return [fence(x1, y, x2 - x1, F)];
  const mid = (x1 + x2) / 2;
  return [fence(x1, y, mid - gap / 2 - x1, F), fence(mid + gap / 2, y, x2 - mid - gap / 2, F)];
}

/** A vertical fence from y1 to y2, with an optional gap in the middle. */
function fenceV(x: number, y1: number, y2: number, gap = 0): Wall[] {
  if (!gap) return [fence(x, y1, F, y2 - y1)];
  const mid = (y1 + y2) / 2;
  return [fence(x, y1, F, mid - gap / 2 - y1), fence(x, mid + gap / 2, F, y2 - mid - gap / 2)];
}

/**
 * A round wall of overlapping blocks around (cx, cy) with an opening facing west, and the gate that fills it.
 * `opening` is roughly how wide the way in is.
 */
function colosseum(cx: number, cy: number, r: number, size: number, opening: number): { walls: Wall[]; gate: Wall[] } {
  const count = Math.ceil((Math.PI * 2 * r) / (size * 0.85));
  const half = Math.asin(opening / 2 / r);
  const walls: Wall[] = [];
  let nearest = Math.PI;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const fromWest = Math.abs(a - Math.PI);
    if (fromWest < half) continue;
    nearest = Math.min(nearest, fromWest);
    walls.push(pillar(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size));
  }
  // The gate reaches the middle of the blocks on either side of the opening.
  const reach = Math.sin(nearest) * r;
  return { walls, gate: [wall(cx - r - size / 2, cy - reach, size, reach * 2)] };
}

/** Blocks along an arc around (cx, cy), from angle a0 to a1: a stretch of a ruined round wall. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, size: number): Wall[] {
  const count = Math.max(2, Math.ceil(((a1 - a0) * r) / (size * 0.8)));
  return Array.from({ length: count + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / count;
    return pillar(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size);
  });
}

function pillarRing(cx: number, cy: number, r: number, count: number, size: number): Wall[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return pillar(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size);
  });
}

// --- The maps, in unlock order ---

// The Verdant Ruins' old colosseum, east of the courtyard.
const RUINS_ARENA = colosseum(4150, 1800, 540, 80, 220);

// The Frozen Fortress: a courtyard inside the curtain walls, with the keep (and its throne hall) to the east.
const C = 60; // Curtain wall width.
const K = 70; // Keep wall width.
const KEEP = { x: 3300, y: 880, w: 1100 - C, h: 1240 };
const KEEP_GATE = 260;

// The Ashen Caldera: a round plateau in a sea of lava.
const CALDERA = { x: 2200, y: 2200 };

export const MAPS: MapDef[] = [
  {
    name: 'Verdant Ruins',
    subtitle: 'Overgrown ruins with a fenced courtyard, and an old colosseum to the east.',
    width: 4750,
    height: 3600,
    spawn: { x: 1800, y: 1800 },
    boss: EnemyType.Grimjaw,
    arena: { x: 4150, y: 1800, r: 470, zone: 640, gate: RUINS_ARENA.gate },
    difficulty: 1,
    prestigeReward: 1,
    enemyWeights: { [EnemyType.Wraith]: 0 },
    theme: { background: 0x18201a, grid: 0x223024, wall: 0x5d6b5a, wallEdge: 0x3b4539, fence: 0x8d7b5a, outside: 0x070a07 },
    walls: [
      ...room(350, 350, 560, 420, ['s', 'e']),
      ...room(2650, 350, 600, 420, ['s', 'w']),
      ...room(350, 2800, 520, 450, ['n', 'e']),
      ...room(2700, 2750, 540, 480, ['n', 'w']),
      ...room(1550, 300, 500, 300, ['s']),
      ...room(1550, 3000, 500, 300, ['n']),
      // The courtyard: fences with an opening on each side.
      ...fenceH(1250, 2350, 1250, 220),
      ...fenceH(1250, 2350, 2350, 220),
      ...fenceV(1250, 1250, 2364, 220),
      ...fenceV(2336, 1250, 2364, 220),
      ...pillarRing(1800, 1800, 620, 8, 70),
      wall(600, 1500, 50, 600),
      wall(2950, 1500, 50, 600),
      wall(1500, 900, 600, 50),
      wall(1500, 2650, 600, 50),
      // The colosseum, and broken columns around it.
      ...RUINS_ARENA.walls,
      pillar(3900, 700, 70),
      pillar(4400, 850, 60),
      pillar(4150, 450, 50),
      pillar(3900, 2900, 70),
      pillar(4400, 2750, 60),
      pillar(4150, 3150, 50),
      ...fenceH(3700, 4100, 1050),
      ...fenceH(3700, 4100, 2550),
    ],
  },
  {
    name: 'Frozen Fortress',
    subtitle: 'Fight across the castle courtyard. The Queen waits in her throne hall.',
    width: 4400,
    height: 3000,
    spawn: { x: 450, y: 1500 },
    boss: EnemyType.Rime,
    arena: {
      x: KEEP.x + K + (KEEP.w - K) / 2,
      y: KEEP.y + KEEP.h / 2,
      r: (KEEP.w - K) / 2,
      hall: { hw: (KEEP.w - K) / 2, hh: KEEP.h / 2 - K },
      // The burning zone stops just outside the keep's walls.
      zone: (KEEP.w - K) / 2 + K + 10,
      gate: [wall(KEEP.x, KEEP.y + (KEEP.h - KEEP_GATE) / 2, K, KEEP_GATE)],
    },
    difficulty: 1.5,
    prestigeReward: 1.5,
    enemyWeights: { [EnemyType.Spitter]: 1.6, [EnemyType.Wraith]: 1, [EnemyType.Bombardier]: 0.5 },
    theme: { background: 0x161c24, grid: 0x1f2833, wall: 0x8fa3b8, wallEdge: 0x52606f, fence: 0x6d8ba3, outside: 0x05080c },
    walls: [
      // Curtain walls all around, towers at the corners and along the sides, and the gatehouse to the west.
      wall(0, 0, 4400, C),
      wall(0, 3000 - C, 4400, C),
      wall(0, 0, C, 3000),
      wall(4400 - C, 0, C, 3000),
      wall(0, 0, 180, 180),
      wall(0, 2820, 180, 180),
      wall(4220, 0, 180, 180),
      wall(4220, 2820, 180, 180),
      wall(1300, 0, 160, 130),
      wall(2500, 0, 160, 130),
      wall(1300, 2870, 160, 130),
      wall(2500, 2870, 160, 130),
      wall(0, 1260, 170, 140),
      wall(0, 1600, 170, 140),
      // The keep: thick walls with towers, and its gate (see the arena) facing the courtyard.
      wall(KEEP.x, KEEP.y, KEEP.w, K),
      wall(KEEP.x, KEEP.y + KEEP.h - K, KEEP.w, K),
      wall(KEEP.x, KEEP.y, K, (KEEP.h - KEEP_GATE) / 2),
      wall(KEEP.x, KEEP.y + (KEEP.h + KEEP_GATE) / 2, K, (KEEP.h - KEEP_GATE) / 2),
      wall(KEEP.x - 60, KEEP.y - 60, 190, 190),
      wall(KEEP.x - 60, KEEP.y + KEEP.h - 130, 190, 190),
      wall(KEEP.x - 50, KEEP.y + (KEEP.h - KEEP_GATE) / 2 - 120, 120, 120),
      wall(KEEP.x - 50, KEEP.y + (KEEP.h + KEEP_GATE) / 2, 120, 120),
      // Columns in the throne hall.
      pillar(3620, 1200, 56),
      pillar(3620, 1800, 56),
      pillar(4090, 1200, 56),
      pillar(4090, 1800, 56),
      // Barracks and a smithy against the north wall, stables and a storehouse against the south.
      ...room(450, 40, 760, 420, ['s'], 180),
      ...room(1750, 40, 560, 380, ['s', 'e']),
      ...room(450, 2540, 760, 420, ['n'], 180),
      ...fenceV(700, 2720, 2940),
      ...fenceV(950, 2720, 2940),
      ...room(1750, 2580, 560, 380, ['n', 'w']),
      // The frozen fountain in the middle, ringed by a hedge garden.
      pillar(1800, 1500, 110),
      ...fenceH(1500, 2100, 1200, 220),
      ...fenceH(1500, 2100, 1800, 220),
      ...fenceV(1500, 1200, 1814, 220),
      ...fenceV(2086, 1200, 1814, 220),
      // Statues lining the way to the keep.
      pillar(2600, 1320, 50),
      pillar(2600, 1680, 50),
      pillar(2950, 1320, 50),
      pillar(2950, 1680, 50),
      // Carts and crates.
      wall(950, 950, 170, 50),
      wall(1050, 1950, 50, 170),
      wall(2450, 750, 180, 50),
      wall(2450, 2190, 180, 50),
      // Frozen orchards beside the keep.
      ...fenceH(3450, 4150, 600, 200),
      ...fenceH(3450, 4150, 2400, 200),
      pillar(3700, 350, 50),
      pillar(4000, 420, 50),
      pillar(3650, 2650, 50),
      pillar(4000, 2600, 50),
    ],
  },
  {
    name: 'Ashen Caldera',
    subtitle: 'A ring of rock in a sea of lava. When the Twin Flames come, the lava closes in.',
    width: 4400,
    height: 4400,
    spawn: { x: CALDERA.x, y: CALDERA.y + 750 },
    boss: EnemyType.AshlordVael,
    twin: EnemyType.Embra,
    bossName: 'Ashlord Vael and Embra, the Twin Flames',
    arena: null,
    lava: { x: CALDERA.x, y: CALDERA.y, r: 1950, final: 720 },
    difficulty: 2.2,
    prestigeReward: 2,
    enemyWeights: { [EnemyType.Charger]: 1.6, [EnemyType.Bombardier]: 1.6, [EnemyType.Wraith]: 1.2, [EnemyType.Spitter]: 0.8 },
    theme: { background: 0x1e1714, grid: 0x2a201b, wall: 0x5a4038, wallEdge: 0x2e1f1a, fence: 0xb2552c, outside: 0x0a0503 },
    walls: [
      // Four obelisks around the heart of the caldera, where the boss fight happens.
      ...[1, 3, 5, 7].map((i) => pillar(CALDERA.x + Math.cos((i * Math.PI) / 4) * 400, CALDERA.y + Math.sin((i * Math.PI) / 4) * 400, 60)),
      // A broken ring of basalt around it, with six ways through.
      ...[0, 1, 2, 3, 4, 5].flatMap((i) => {
        const mid = (i * Math.PI) / 3 + Math.PI / 6;
        return arc(CALDERA.x, CALDERA.y, 1150, mid - 0.3, mid + 0.3, 70);
      }),
      // Outcrops near the rim.
      ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        const x = CALDERA.x + Math.cos(a) * 1620;
        const y = CALDERA.y + Math.sin(a) * 1620;
        return [pillar(x, y, 100), pillar(x + 55, y + 35, 70), pillar(x - 40, y + 50, 60)];
      }),
      // Charred stakes by the camp where the team starts.
      ...fenceH(1950, 2450, 3250, 160),
    ],
  },
];

/** Who you fight at the end of this map. */
export function mapBossName(map: MapDef): string {
  return map.bossName ?? bossDisplayName(map.boss);
}
