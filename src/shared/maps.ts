import type { Wall } from './collision';
import { ENEMY_TYPES, EnemyType, bossDisplayName } from './enemies';

/** The named boss arrives this many seconds in; with the fight that makes a run about 16 minutes. */
export const BOSS_TIME = 15 * 60;
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
  /** What the gate looks like: a wooden double door, or a wall of brambles. */
  gateLook?: 'door' | 'vines';
}

/** A river: water you can't walk through (but can dodge across), with bridges and fords. */
export interface River {
  /** Its middle line, top to bottom. */
  points: { x: number; y: number }[];
  width: number;
  crossings: { y: number; kind: 'bridge' | 'ford' }[];
}

/** A map ringed by lava: everything farther than `r` from the middle burns. */
export interface Lava {
  x: number;
  y: number;
  r: number;
  /** How far the lava closes in for the boss fight. */
  final: number;
}

/**
 * A twist ending: after the map's boss falls, the ground gives way. Lava everywhere except a few stepping
 * `stones`, which lead to the `den` where the real final boss (`boss`) waits. The den and its `pillars` stay
 * hidden until then.
 */
export interface Finale {
  stones: { x: number; y: number; r: number }[];
  /** The way across: indexes into `stones`, in order, from where the team stands to the den. */
  route: number[];
  den: { x: number; y: number; r: number };
  pillars: Wall[];
  boss: number;
  bossName: string;
}

export interface MapDef {
  name: string;
  subtitle: string;
  /** Which look the client gives it: ground, props and landmarks. */
  art: 'forest' | 'ruins' | 'frost' | 'canyon' | 'caldera' | 'underworld';
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
   * Walled off behind the boss arena: everything east of `x` but the arena itself (`hole`, a circle or a rectangle) is
   * out of bounds, drawn dark like the outside of the map.
   */
  sealed?: { x: number; hole: { x: number; y: number; r: number } | { x: number; y: number; w: number; h: number } };
  /** What happens after the boss dies, if it isn't the end (see Finale). */
  finale?: Finale;
  /**
   * Endless mode's own map (played only in endless mode, not part of the campaign): the bosses its waves bring, in
   * turn (see waveBoss).
   */
  endless?: { waves: { boss: number; twin?: number }[] };
  river?: River;
  /**
   * Multiplier on enemy health and damage (bosses included). Later maps are meant to need a few ranks of
   * prestige first.
   */
  difficulty: number;
  /** Prestige points per team level gained in a run here. */
  prestigeReward: number;
  /** Multipliers on enemy spawn weights, to give each map its own mix. */
  enemyWeights: Partial<Record<number, number>>;
  /** The horde's colors here, to fit the map (types not listed keep their own color). */
  enemyColors?: Partial<Record<number, number>>;
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
/** Is (x, y) in the ground walled off beside the boss arena (where no one may ever be)? */
export function inSealed(map: MapDef, x: number, y: number): boolean {
  const s = map.sealed;
  if (!s || x <= s.x) return false;
  const h = s.hole;
  if ('r' in h) return (x - h.x) ** 2 + (y - h.y) ** 2 > h.r ** 2;
  return x < h.x || x > h.x + h.w || y < h.y || y > h.y + h.h;
}

/** Standing on a finale's stepping stones or in its den (`margin` in from their edges). */
export function onFinaleGround(finale: Finale, x: number, y: number, margin = 0): boolean {
  if ((x - finale.den.x) ** 2 + (y - finale.den.y) ** 2 < (finale.den.r - margin) ** 2) return true;
  return finale.stones.some((st) => (x - st.x) ** 2 + (y - st.y) ** 2 < (st.r - margin) ** 2);
}

/** The map's walls, with the arena gate if it's shut, and the den's pillars once the finale has revealed them. */
export function mapWalls(map: MapDef, gateShut: boolean, den = false): Wall[] {
  const walls = gateShut && map.arena ? [...map.walls, ...map.arena.gate] : map.walls;
  return den && map.finale ? [...walls, ...map.finale.pillars] : walls;
}

// --- Wall building blocks ---

const T = 40; // Thick wall width.
const F = 14; // Thin wall (fence) width.

const wall = (x: number, y: number, w: number, h: number, look?: Wall['look']): Wall => ({ x, y, w, h, thin: false, ...(look && { look }) });
const fence = (x: number, y: number, w: number, h: number): Wall => ({ x, y, w, h, thin: true });
const pillar = (cx: number, cy: number, size = 60, look?: Wall['look']): Wall => wall(cx - size / 2, cy - size / 2, size, size, look);
const tree = (cx: number, cy: number, size = 80): Wall => pillar(cx, cy, size, 'tree');
const boulder = (cx: number, cy: number, size = 90): Wall => pillar(cx, cy, size, 'rock');

/** A few trees together, around (cx, cy). */
function grove(cx: number, cy: number, scale = 1): Wall[] {
  return [tree(cx, cy, 90 * scale), tree(cx + 75 * scale, cy + 40 * scale, 70 * scale), tree(cx - 55 * scale, cy + 70 * scale, 75 * scale), tree(cx + 25 * scale, cy - 75 * scale, 65 * scale)];
}

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
function colosseum(cx: number, cy: number, r: number, size: number, opening: number, look?: Wall['look']): { walls: Wall[]; gate: Wall[]; front: { x: number; reach: number }; outer: number; inner: number } {
  const count = Math.ceil((Math.PI * 2 * r) / (size * 0.85));
  const half = Math.asin(opening / 2 / r);
  const walls: Wall[] = [];
  let nearest = Math.PI;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const fromWest = Math.abs(a - Math.PI);
    if (fromWest < half) continue;
    nearest = Math.min(nearest, fromWest);
    walls.push(pillar(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size, look));
  }
  // The gate reaches the middle of the blocks on either side of the opening.
  const reach = Math.sin(nearest) * r;
  // The front: the blocks on either side of the way in (where walls closing off the sides start).
  const front = { x: cx - Math.cos(nearest) * r, reach };
  // Nothing dodges through an arena's walls or its gate.
  for (const w of walls) w.solid = true;
  const gate = { ...wall(cx - r - size / 2, cy - reach, size, reach * 2), solid: true };
  return { walls, gate: [gate], front, outer: r + size / 2, inner: r - size / 2 };
}

/**
 * Solid ground filling everything east of `x0` but the arena (`hole`: inside its ring, or the keep): bands of terrain
 * walls, each stopping short of the arena's floor. Nothing spawns, walks or dodges in there.
 */
function terrainWalls(x0: number, width: number, height: number, hole: { x: number; y: number; r: number } | { x: number; y: number; w: number; h: number }): Wall[] {
  const band = 50;
  const walls: Wall[] = [];
  const add = (from: number, to: number, y: number) => {
    if (to - from > 1) walls.push(wall(from, y, to - from, band, 'terrain'));
  };
  for (let y = 0; y < height; y += band) {
    let gap: [number, number] | null = null;
    if ('r' in hole) {
      // Where the band comes closest to the arena's middle, its floor is widest: keep clear of all of it.
      const near = y <= hole.y && hole.y <= y + band ? 0 : Math.min(Math.abs(y - hole.y), Math.abs(y + band - hole.y));
      if (near < hole.r) {
        const half = Math.sqrt(hole.r ** 2 - near ** 2);
        gap = [hole.x - half, hole.x + half];
      }
    } else if (y + band > hole.y && y < hole.y + hole.h) {
      gap = [hole.x, hole.x + hole.w];
    }
    if (!gap) add(x0, width, y);
    else {
      add(x0, Math.max(x0, gap[0]), y);
      add(Math.min(width, gap[1]), width, y);
    }
  }
  return walls;
}

/**
 * Walls from an arena's front (either side of its way in) straight to the top and bottom of the map, so nothing can
 * get round the sides of the arena or behind it. As trees, rock or plain stone.
 */
function sealSides(frontX: number, cy: number, reach: number, height: number, size: number, look?: Wall['look']): Wall[] {
  if (look === 'tree') {
    // A thicket: trees close enough that nothing slips between them.
    const trees: Wall[] = [];
    for (let y = size / 2; y < cy - reach; y += size * 0.6) trees.push(tree(frontX, y, size));
    for (let y = cy + reach; y < height + size / 2; y += size * 0.6) trees.push(tree(frontX, y, size));
    return trees;
  }
  return [wall(frontX - size / 2, 0, size, cy - reach, look), wall(frontX - size / 2, cy + reach, size, height - cy - reach, look)];
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

// The Emerald Woods: a river down the middle, and the serpent's glade ringed by trees to the east.
const WOODS = { width: 4200, height: 3400 };
const GLADE = colosseum(3550, 1700, 520, 90, 220, 'tree');
const riverX = (y: number) => 2050 + 110 * Math.sin(y / 420) + 50 * Math.sin(y / 170 + 2);
const RIVER: River = {
  points: Array.from({ length: Math.ceil(WOODS.height / 20) + 1 }, (_, i) => ({ x: riverX(i * 20), y: i * 20 })),
  width: 170,
  crossings: [
    { y: 810, kind: 'bridge' },
    { y: 1710, kind: 'ford' },
    { y: 2610, kind: 'bridge' },
  ],
};
/**
 * The river as thin walls (you can dodge across): short strips that follow its bends, as wide as the water is drawn
 * (less a little, so you can stand at the very edge), with gaps exactly as tall as the bridges and the ford (240).
 */
function riverWalls(river: River, height: number): Wall[] {
  const step = 30;
  const width = river.width - 16;
  const walls: Wall[] = [];
  for (let y = 0; y < height; y += step) {
    if (river.crossings.some((c) => y + step > c.y - 120 && y < c.y + 120)) continue;
    walls.push({ x: riverX(y + step / 2) - width / 2, y, w: width, h: step, thin: true, look: 'water' });
  }
  return walls;
}

// The Sunscar Canyon: cliffs along both sides, and the scorpion's den behind a gate to the east.
const CANYON = { width: 5300, height: 3000 };
const DEN = colosseum(4600, 1500, 540, 110, 230, 'rock');
const cliffTop = (x: number) => 360 + 150 * Math.sin(x / 530) + 90 * Math.sin(x / 210 + 1);
const cliffBottom = (x: number) => 360 + 150 * Math.sin(x / 470 + 2) + 90 * Math.sin(x / 190 + 4);
/** The canyon's walls: columns of rock along the top and bottom edges, their heights rising and falling. */
function cliffs(width: number, height: number): Wall[] {
  const step = 100;
  const walls: Wall[] = [];
  for (let x = 0; x < width; x += step) {
    const top = Math.round(cliffTop(x + step / 2));
    const bottom = Math.round(cliffBottom(x + step / 2));
    walls.push(wall(x, 0, step, top, 'rock'), wall(x, height - bottom, step, bottom, 'rock'));
  }
  return walls;
}

// The Verdant Ruins' old colosseum, east of the courtyard.
const RUINS_ARENA = colosseum(4150, 1800, 540, 80, 220);

// The Frozen Fortress: a courtyard inside the curtain walls, with the keep (and its throne hall) to the east.
const C = 60; // Curtain wall width.
const K = 70; // Keep wall width.
const KEEP = { x: 3300, y: 880, w: 1100 - C, h: 1240 };
const KEEP_GATE = 260;

// The Ashen Caldera: a round plateau in a sea of lava, with room to the north for the finale.
const CALDERA = { x: 2200, y: 3600 };
/**
 * The finale's path north from the caldera's heart: stepping stones zigzagging toward the den, each gap a dodge's jump
 * (about 90 between edges).
 */
const DEN_PATH = [
  { dx: 50, dy: -336 },
  { dx: -70, dy: -572 },
  { dx: 50, dy: -808 },
  { dx: -70, dy: -1044 },
  { dx: 50, dy: -1280 },
  { dx: -70, dy: -1516 },
].map(({ dx, dy }) => ({ x: CALDERA.x + dx, y: CALDERA.y + dy, r: 85 }));
/** The Underworld: a big square realm around the Altar of the Dead at its center (`c`). */
const UNDERWORLD = {
  size: 5600,
  c: 2800,
  graveyards: [
    [1900, 700],
    [3200, 700],
    [700, 1900],
    [4350, 1900],
    [700, 3300],
    [4350, 3300],
    [1900, 4550],
    [3200, 4550],
  ] as [number, number][],
};

/** Mordak's den, out over the lava north of the caldera's heart (a jump past the last stone). */
const DRAGON_DEN = { x: CALDERA.x, y: CALDERA.y - 2584, r: 900 };

export const MAPS: MapDef[] = [
  {
    name: 'Emerald Woods',
    subtitle: 'A sunny forest split by a river. The serpent sleeps in a glade beyond the trees.',
    art: 'forest',
    width: WOODS.width,
    height: WOODS.height,
    spawn: { x: 800, y: 1700 },
    boss: EnemyType.Sylvara,
    arena: { x: 3550, y: 1700, r: 430, zone: 640, gate: GLADE.gate, gateLook: 'vines' },
    sealed: { x: GLADE.front.x, hole: { x: 3550, y: 1700, r: GLADE.outer } },
    river: RIVER,
    difficulty: 0.7,
    prestigeReward: 0.75,
    // A gentle start: mostly the basic horde.
    enemyWeights: { [EnemyType.Wraith]: 0, [EnemyType.Bombardier]: 0.3, [EnemyType.Charger]: 0.5, [EnemyType.Spitter]: 0.7 },
    // Greens and blues of the forest.
    enemyColors: {
      [EnemyType.Grunt]: 0xa5e05a,
      [EnemyType.Runner]: 0x4dd0e1,
      [EnemyType.Brute]: 0x7986cb,
      [EnemyType.Spitter]: 0xfff176,
      [EnemyType.Bombardier]: 0x42a5f5,
      [EnemyType.Charger]: 0x4db6ac,
      [EnemyType.Wraith]: 0xa5d6a7,
      [EnemyType.Warlord]: 0x2e7d32,
    },
    theme: { background: 0x172e18, grid: 0x1f3a20, wall: 0x6b7a5c, wallEdge: 0x3b4a32, fence: 0x9c7b4f, outside: 0x07110a },
    walls: [
      ...riverWalls(RIVER, WOODS.height),
      // The glade, a thicket closing off the woods beside and behind it, and groves dotted around the woods.
      ...GLADE.walls,
      ...sealSides(GLADE.front.x, 1700, GLADE.front.reach, WOODS.height, 100, 'tree'),
      ...terrainWalls(GLADE.front.x, WOODS.width, WOODS.height, { x: 3550, y: 1700, r: GLADE.inner }),
      ...grove(450, 450),
      ...grove(1250, 330, 0.9),
      ...grove(450, 2950),
      ...grove(1300, 3050, 0.9),
      ...grove(1450, 1150),
      ...grove(1400, 2300, 1.1),
      ...grove(2750, 480),
      ...grove(2800, 2950),
      ...grove(2700, 1250, 0.9),
      ...grove(2750, 2200),
      ...grove(250, 1700, 0.8),
      tree(900, 1050, 70),
      tree(800, 2400, 75),
      tree(1800, 520, 70),
      tree(2400, 3150, 70),
      // A log pile and a woodcutter's fence near the start.
      wall(560, 1200, 150, 44),
      ...fenceH(380, 760, 2150),
    ],
  },
  {
    name: 'Desecrated Ruins',
    subtitle: 'Overgrown ruins with a fenced courtyard, and an old colosseum to the east.',
    art: 'ruins',
    width: 4750,
    height: 3600,
    spawn: { x: 1800, y: 1800 },
    boss: EnemyType.Reaper,
    arena: { x: 4150, y: 1800, r: 470, zone: 640, gate: RUINS_ARENA.gate },
    sealed: { x: RUINS_ARENA.front.x, hole: { x: 4150, y: 1800, r: RUINS_ARENA.outer } },
    difficulty: 1,
    prestigeReward: 1,
    enemyWeights: { [EnemyType.Wraith]: 0 },
    theme: { background: 0x18201a, grid: 0x223024, wall: 0x5d6b5a, wallEdge: 0x3b4539, fence: 0x8d7b5a, outside: 0x070a07 },
    walls: [
      ...room(350, 350, 560, 420, ['s', 'e']),
      ...room(2650, 350, 600, 420, ['s', 'w']),
      ...room(350, 2800, 520, 450, ['n', 'e']),
      ...room(2700, 2750, 540, 480, ['n', 'w']),
      ...room(1550, 300, 500, 300, ['s', 'e', 'w']),
      ...room(1550, 3000, 500, 300, ['n', 'e', 'w']),
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
      // The colosseum, walled in on either side of its gate.
      ...RUINS_ARENA.walls,
      ...sealSides(RUINS_ARENA.front.x, 1800, RUINS_ARENA.front.reach, 3600, 80),
      ...terrainWalls(RUINS_ARENA.front.x, 4750, 3600, { x: 4150, y: 1800, r: RUINS_ARENA.inner }),
    ],
  },
  {
    name: 'Frozen Fortress',
    subtitle: 'Fight across the castle courtyard. The Queen waits in her throne hall.',
    art: 'frost',
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
      gate: [{ ...wall(KEEP.x, KEEP.y + (KEEP.h - KEEP_GATE) / 2, K, KEEP_GATE), solid: true }],
    },
    sealed: { x: KEEP.x + K / 2, hole: { x: KEEP.x, y: KEEP.y, w: KEEP.w, h: KEEP.h } },
    difficulty: 1.4,
    prestigeReward: 1.5,
    enemyWeights: { [EnemyType.Spitter]: 1.6, [EnemyType.Wraith]: 1, [EnemyType.Bombardier]: 0.5 },
    // Ice blues, frost whites and cold violets.
    enemyColors: {
      [EnemyType.Grunt]: 0x90caf9,
      [EnemyType.Runner]: 0xe0f7fa,
      [EnemyType.Brute]: 0x5c6bc0,
      [EnemyType.Spitter]: 0x4dd0e1,
      [EnemyType.Bombardier]: 0x90a4ae,
      [EnemyType.Charger]: 0x9575cd,
      [EnemyType.Wraith]: 0xd1c4e9,
      [EnemyType.Warlord]: 0x1e88e5,
    },
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
      { ...wall(KEEP.x, KEEP.y, KEEP.w, K), solid: true },
      { ...wall(KEEP.x, KEEP.y + KEEP.h - K, KEEP.w, K), solid: true },
      { ...wall(KEEP.x, KEEP.y, K, (KEEP.h - KEEP_GATE) / 2), solid: true },
      { ...wall(KEEP.x, KEEP.y + (KEEP.h + KEEP_GATE) / 2, K, (KEEP.h - KEEP_GATE) / 2), solid: true },
      wall(KEEP.x - 60, KEEP.y - 60, 190, 190),
      wall(KEEP.x - 60, KEEP.y + KEEP.h - 130, 190, 190),
      wall(KEEP.x - 50, KEEP.y + (KEEP.h - KEEP_GATE) / 2 - 120, 120, 120),
      wall(KEEP.x - 50, KEEP.y + (KEEP.h + KEEP_GATE) / 2, 120, 120),
      // Columns in the throne hall: cover from the Queen's Glacial Wrath.
      pillar(3620, 1220, 90),
      pillar(3620, 1780, 90),
      pillar(4090, 1220, 90),
      pillar(4090, 1780, 90),
      // Barracks and a smithy against the north wall, stables and a storehouse against the south.
      ...room(450, 40, 760, 420, ['s', 'e', 'w'], 180),
      ...room(1750, 40, 560, 380, ['s', 'e']),
      ...room(450, 2540, 760, 420, ['n', 'e', 'w'], 180),
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
      // Walls from the keep's front corners to the curtain walls: nothing gets round the keep's sides or behind it.
      wall(KEEP.x, 0, K, KEEP.y),
      wall(KEEP.x, KEEP.y + KEEP.h, K, 3000 - KEEP.y - KEEP.h),
      ...terrainWalls(KEEP.x + K / 2, 4400, 3000, { x: KEEP.x + K, y: KEEP.y + K, w: KEEP.w - K, h: KEEP.h - 2 * K }),
    ],
  },
  {
    name: 'Sunscar Canyon',
    subtitle: 'A sun-baked canyon between the mountains. The scorpion lurks in its den to the east.',
    art: 'canyon',
    width: CANYON.width,
    height: CANYON.height,
    spawn: { x: 500, y: 1500 },
    boss: EnemyType.Kharzak,
    arena: { x: 4600, y: 1500, r: 440, zone: 680, gate: DEN.gate },
    sealed: { x: DEN.front.x, hole: { x: 4600, y: 1500, r: DEN.outer } },
    difficulty: 1.5,
    prestigeReward: 1.75,
    enemyWeights: { [EnemyType.Charger]: 1, [EnemyType.Spitter]: 1.1, [EnemyType.Runner]: 1.3, [EnemyType.Wraith]: 0.6 },
    // Dust: grays, browns, sand and rust.
    enemyColors: {
      [EnemyType.Grunt]: 0xbcaaa4,
      [EnemyType.Runner]: 0xe6c07b,
      [EnemyType.Brute]: 0x8d6e63,
      [EnemyType.Spitter]: 0xafb42b,
      [EnemyType.Bombardier]: 0x90a4ae,
      [EnemyType.Charger]: 0xc0703c,
      [EnemyType.Wraith]: 0xe0e0e0,
      [EnemyType.Warlord]: 0x6d4c41,
    },
    theme: { background: 0x4a3826, grid: 0x58432d, wall: 0x9a6a45, wallEdge: 0x4e2f1c, fence: 0x9c7a4f, outside: 0x160d07 },
    walls: [
      ...cliffs(CANYON.width, CANYON.height),
      ...DEN.walls,
      // Rock walling the den in on either side of its mouth.
      ...sealSides(DEN.front.x, 1500, DEN.front.reach, CANYON.height, 110, 'rock'),
      ...terrainWalls(DEN.front.x, CANYON.width, CANYON.height, { x: 4600, y: 1500, r: DEN.inner }),
      // Boulders in the den: bait Kharzak's charge into one to crack its shell.
      boulder(4600 + Math.cos(Math.PI / 3) * 260, 1500 + Math.sin(Math.PI / 3) * 260, 100),
      boulder(4600 - 260, 1500, 100),
      boulder(4600 + Math.cos(-Math.PI / 3) * 260, 1500 + Math.sin(-Math.PI / 3) * 260, 100),
      // Mesas and boulders on the canyon floor.
      wall(1400, 1020, 280, 240, 'rock'),
      wall(2300, 1720, 320, 260, 'rock'),
      wall(3200, 980, 240, 220, 'rock'),
      wall(3150, 1880, 200, 180, 'rock'),
      boulder(900, 1150),
      boulder(1000, 1950, 80),
      boulder(1950, 1300, 100),
      boulder(2750, 1350),
      boulder(2800, 2150, 80),
      boulder(3700, 1120, 80),
      boulder(3700, 1880, 80),
      // An abandoned mining camp.
      ...fenceH(1650, 2150, 2250, 140),
    ],
  },
  {
    name: 'Ashen Caldera',
    subtitle: 'A ring of rock in a sea of lava. When the Twin Flames come, the lava closes in.',
    art: 'caldera',
    width: 4400,
    height: CALDERA.y + 2200,
    spawn: { x: CALDERA.x, y: CALDERA.y + 750 },
    boss: EnemyType.AshlordVael,
    twin: EnemyType.Embra,
    bossName: 'Ashlord Vael and Embra, the Twin Flames',
    arena: null,
    lava: { x: CALDERA.x, y: CALDERA.y, r: 1950, final: 720 },
    finale: {
      stones: [
        // What's left of the heart, and a few rocks scattered around it so nobody is stranded.
        { x: CALDERA.x, y: CALDERA.y, r: 170 },
        ...[60, 120, 180, 240, 300].map((deg, i) => ({
          x: CALDERA.x + Math.cos((deg * Math.PI) / 180) * (380 + (i % 2) * 70),
          y: CALDERA.y + Math.sin((deg * Math.PI) / 180) * (380 + (i % 2) * 70),
          r: 70,
        })),
        // The path north to the den.
        ...DEN_PATH,
      ],
      route: [0, ...DEN_PATH.map((_, i) => 6 + i)],
      den: DRAGON_DEN,
      // Pillars to hide behind from his fire beam.
      pillars: [0, 60, 120, 180, 240, 300].map((deg) => pillar(DRAGON_DEN.x + Math.cos((deg * Math.PI) / 180) * 500, DRAGON_DEN.y + Math.sin((deg * Math.PI) / 180) * 500, 100)),
      boss: EnemyType.Mordak,
      bossName: 'Mordak, the Earth Scourger',
    },
    difficulty: 2,
    prestigeReward: 2,
    enemyWeights: { [EnemyType.Charger]: 1.6, [EnemyType.Bombardier]: 1.6, [EnemyType.Wraith]: 1.2, [EnemyType.Spitter]: 0.8 },
    // Fire and ash.
    enemyColors: {
      [EnemyType.Grunt]: 0xc62828,
      [EnemyType.Runner]: 0xffca28,
      [EnemyType.Brute]: 0xa1887f,
      [EnemyType.Spitter]: 0xc6ff00,
      [EnemyType.Bombardier]: 0xff7043,
      [EnemyType.Charger]: 0xb0bec5,
      [EnemyType.Wraith]: 0xffab91,
      [EnemyType.Warlord]: 0xbf360c,
    },
    theme: { background: 0x1e1714, grid: 0x2a201b, wall: 0x5a4038, wallEdge: 0x2e1f1a, fence: 0xb2552c, outside: 0x0a0503 },
    walls: [
      // Four obelisks around the heart of the caldera, where the boss fight happens.
      ...[1, 3, 5, 7].map((i) => pillar(CALDERA.x + Math.cos((i * Math.PI) / 4) * 400, CALDERA.y + Math.sin((i * Math.PI) / 4) * 400, 60)),
      // A broken ring of basalt around it, with ways through (the widest to the north, where the den will rise).
      ...[0, 1, 2, 3, 5].flatMap((i) => {
        const mid = (i * Math.PI) / 3 + Math.PI / 6;
        return arc(CALDERA.x, CALDERA.y, 1150, mid - 0.3, mid + 0.3, 70);
      }),
      // Outcrops near the rim (none to the north, where the den will rise).
      ...[0, 1, 2, 3, 4, 7].flatMap((i) => {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        const x = CALDERA.x + Math.cos(a) * 1620;
        const y = CALDERA.y + Math.sin(a) * 1620;
        return [pillar(x, y, 100), pillar(x + 55, y + 35, 70), pillar(x - 40, y + 50, 60)];
      }),
      // Charred stakes by the camp where the team starts.
      ...fenceH(1950, 2450, CALDERA.y + 1050, 160),
    ],
  },
  // Endless mode's map (last, so it never gets in the way of the campaign's order).
  {
    name: 'The Underworld',
    subtitle: 'Death\'s own realm, with no way out. The fallen bosses rise again and again: hold out as long as you can.',
    art: 'underworld',
    width: UNDERWORLD.size,
    height: UNDERWORLD.size,
    spawn: { x: UNDERWORLD.c, y: UNDERWORLD.c },
    // The Reaper is Death's own hand; the bosses he raises come after him, in turn.
    boss: EnemyType.Reaper,
    bossName: 'Death and the risen',
    arena: null,
    endless: {
      waves: [
        { boss: EnemyType.Reaper },
        { boss: EnemyType.Sylvara },
        { boss: EnemyType.Rime },
        { boss: EnemyType.Kharzak },
        { boss: EnemyType.AshlordVael, twin: EnemyType.Embra },
      ],
    },
    difficulty: 1.2,
    prestigeReward: 1.5,
    enemyWeights: { [EnemyType.Wraith]: 1.8, [EnemyType.Brute]: 1.2, [EnemyType.Bombardier]: 0.7 },
    // The dead: bone-white skeletons, spectral runners and wraiths, purple ghouls. The bosses come back pale.
    enemyColors: {
      [EnemyType.Grunt]: 0xcfc6b4,
      [EnemyType.Runner]: 0x4dd0c8,
      [EnemyType.Brute]: 0x7e57c2,
      [EnemyType.Spitter]: 0x9ccc65,
      [EnemyType.Bombardier]: 0xb388ff,
      [EnemyType.Charger]: 0x90a4ae,
      [EnemyType.Wraith]: 0x80deea,
      [EnemyType.Warlord]: 0x5e35b1,
      [EnemyType.Sylvara]: 0x4db6ac,
      [EnemyType.Kharzak]: 0x7e57c2,
    },
    theme: { background: 0x16121d, grid: 0x231b2e, wall: 0x4d4659, wallEdge: 0x1a1522, fence: 0x8e8a9c, outside: 0x050308 },
    walls: [
      // The Altar of the Dead, where the team stands: a ring of obelisks to hide behind.
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => pillar(UNDERWORLD.c + Math.cos((i * Math.PI) / 4 + Math.PI / 8) * 520, UNDERWORLD.c + Math.sin((i * Math.PI) / 4 + Math.PI / 8) * 520, 70)),
      // A broken ring of crypt walls further out, with wide gaps.
      ...[0, 1, 2, 3, 4, 5].flatMap((i) => {
        const mid = (i * Math.PI) / 3;
        return arc(UNDERWORLD.c, UNDERWORLD.c, 1500, mid - 0.32, mid + 0.32, 80);
      }),
      // Mausoleums in the four corners of the realm, a door on each side facing the altar.
      ...room(800, 800, 560, 440, ['s', 'e']),
      ...room(UNDERWORLD.size - 1360, 800, 560, 440, ['s', 'w']),
      ...room(800, UNDERWORLD.size - 1240, 560, 440, ['n', 'e']),
      ...room(UNDERWORLD.size - 1360, UNDERWORLD.size - 1240, 560, 440, ['n', 'w']),
      // Graveyards between them: rows of headstones.
      ...UNDERWORLD.graveyards.flatMap(([gx, gy]) =>
        Array.from({ length: 12 }, (_, k) => boulder(gx + (k % 4) * 150 + (Math.floor(k / 4) % 2) * 60, gy + Math.floor(k / 4) * 150, 46)),
      ),
      // Great tombs out in the open, for cover (and for Kharzak to charge into).
      ...[
        [1700, 2800],
        [3900, 2800],
        [2800, 1700],
        [2800, 3900],
        [1300, 1900],
        [4300, 3700],
      ].map(([x, y]) => boulder(x, y, 120)),
      // Iron railings around the old burial grounds.
      ...fenceH(2350, 3250, 4550, 200),
      ...fenceH(2350, 3250, 1050, 200),
      ...fenceV(1050, 2350, 3250, 200),
      ...fenceV(4550, 2350, 3250, 200),
    ],
  },
];

/** The campaign: every map but endless mode's own, in order. Unlocks (normal and hard) count only these. */
export const CAMPAIGN = MAPS.filter((m) => !m.endless).length;
/** Endless mode's map. */
export const ENDLESS_MAP = MAPS.findIndex((m) => m.endless);

/** Who endless mode's `wave`th boss wave (1 = the first) brings on this map, and what they're called. */
export function waveBoss(map: MapDef, wave: number): { boss: number; twin?: number; name: string } {
  const waves = map.endless?.waves;
  if (!waves) return { boss: map.boss, twin: map.twin, name: mapBossName(map) };
  const w = waves[(Math.max(1, wave) - 1) % waves.length];
  // Twins are known by their own map's name for them.
  const home = MAPS.find((m) => !m.endless && m.boss === w.boss && m.twin === w.twin);
  return { ...w, name: w.twin !== undefined && home ? mapBossName(home) : bossDisplayName(w.boss) };
}

/** An enemy type's color on this map. */
export function enemyColor(map: MapDef, type: number): number {
  return map.enemyColors?.[type] ?? ENEMY_TYPES[type].color;
}

/** Who you fight at the end of this map. */
export function mapBossName(map: MapDef): string {
  return map.bossName ?? bossDisplayName(map.boss);
}
