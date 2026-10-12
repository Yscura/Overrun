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
  /** A boss arena the team is forced into, or null to fight the boss wherever you are. */
  arena: { x: number; y: number; r: number } | null;
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

function pillarRing(cx: number, cy: number, r: number, count: number, size: number): Wall[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return pillar(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size);
  });
}

// --- The maps, in unlock order ---

export const MAPS: MapDef[] = [
  {
    name: 'Verdant Ruins',
    subtitle: 'Overgrown ruins with a fenced courtyard at their heart.',
    width: 3600,
    height: 3600,
    spawn: { x: 1800, y: 1800 },
    boss: EnemyType.Grimjaw,
    arena: null,
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
    ],
  },
  {
    name: 'Frozen Fortress',
    subtitle: 'Fight through the gates. The Queen waits in her arena to the east.',
    width: 4400,
    height: 3000,
    spawn: { x: 600, y: 1500 },
    boss: EnemyType.Rime,
    arena: { x: 3750, y: 1500, r: 420 },
    difficulty: 1.5,
    prestigeReward: 1.5,
    enemyWeights: { [EnemyType.Spitter]: 1.6, [EnemyType.Wraith]: 1, [EnemyType.Bombardier]: 0.5 },
    theme: { background: 0x161c24, grid: 0x1f2833, wall: 0x8fa3b8, wallEdge: 0x52606f, fence: 0x6d8ba3, outside: 0x05080c },
    walls: [
      // Outer gate wall and inner wall.
      wall(1400, 0, T, 1250),
      wall(1400, 1750, T, 1250),
      wall(2700, 250, T, 1000),
      wall(2700, 1750, T, 1000),
      ...room(200, 200, 500, 400, ['s', 'e']),
      ...room(200, 2400, 500, 400, ['n', 'e']),
      // Barracks between the walls.
      ...room(1700, 300, 700, 500, ['s', 'w']),
      ...room(1700, 2200, 700, 500, ['n', 'w']),
      pillar(2050, 1500, 70),
      ...fenceV(2350, 1150, 1850, 160),
      // Fences funnel the approach to the arena.
      ...fenceV(3150, 600, 1050),
      ...fenceV(3150, 1950, 2400),
      pillar(3600, 1320, 50),
      pillar(3900, 1680, 50),
    ],
  },
  {
    name: 'Ashen Caldera',
    subtitle: 'A burning keep below the crater, and the Ashlord above it.',
    width: 4400,
    height: 4400,
    spawn: { x: 2200, y: 3800 },
    boss: EnemyType.AshlordVael,
    twin: EnemyType.Embra,
    bossName: 'Ashlord Vael and Embra, the Twin Flames',
    arena: { x: 2200, y: 750, r: 460 },
    difficulty: 2.2,
    prestigeReward: 2,
    enemyWeights: { [EnemyType.Charger]: 1.6, [EnemyType.Bombardier]: 1.6, [EnemyType.Wraith]: 1.2, [EnemyType.Spitter]: 0.8 },
    theme: { background: 0x1e1714, grid: 0x2a201b, wall: 0x5a4038, wallEdge: 0x2e1f1a, fence: 0xb2552c, outside: 0x0a0503 },
    walls: [
      // The central keep with a door on every side.
      ...room(1550, 1750, 1300, 1300, ['n', 's', 'e', 'w'], 220),
      ...pillarRing(2200, 2400, 300, 6, 70),
      wall(600, 1400, T, 900),
      wall(3760, 1400, T, 900),
      wall(1000, 3300, 700, T),
      wall(2700, 3300, 700, T),
      ...fenceH(700, 1300, 1000),
      ...fenceH(3100, 3700, 1000),
      ...fenceV(1200, 3500, 4100),
      ...fenceV(3200, 3500, 4100),
      // Walls flanking the way up to the arena.
      wall(1500, 1350, 400, T),
      wall(2500, 1350, 400, T),
      pillar(2000, 700, 60),
      pillar(2400, 800, 60),
    ],
  },
];

/** Who you fight at the end of this map. */
export function mapBossName(map: MapDef): string {
  return map.bossName ?? bossDisplayName(map.boss);
}
