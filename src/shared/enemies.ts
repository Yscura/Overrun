export type Behavior = 'chase' | 'ranged' | 'lobber' | 'charger' | 'boss';

export interface EnemyDef {
  name: string;
  radius: number;
  speed: number;
  hp: number;
  /** Damage per second dealt to a player while touching them. */
  damage: number;
  xp: number;
  color: number;
  behavior: Behavior;
  /** Seconds into a run before this enemy starts spawning. */
  spawnAfter: number;
  /** Relative spawn chance once available. 0 = never spawned randomly (bosses). */
  weight: number;
}

/** Indexed by enemy type id, which is what goes over the network. */
export const ENEMY_TYPES: EnemyDef[] = [
  { name: 'Grunt', radius: 14, speed: 85, hp: 12, damage: 10, xp: 1, color: 0xe57373, behavior: 'chase', spawnAfter: 0, weight: 10 },
  { name: 'Runner', radius: 10, speed: 145, hp: 8, damage: 8, xp: 1, color: 0xffd54f, behavior: 'chase', spawnAfter: 40, weight: 4 },
  { name: 'Brute', radius: 24, speed: 60, hp: 70, damage: 20, xp: 5, color: 0xba68c8, behavior: 'chase', spawnAfter: 90, weight: 2 },
  { name: 'Boss', radius: 56, speed: 75, hp: 2000, damage: 40, xp: 100, color: 0xff7043, behavior: 'boss', spawnAfter: 0, weight: 0 },
  { name: 'Spitter', radius: 13, speed: 80, hp: 16, damage: 6, xp: 2, color: 0x9ccc65, behavior: 'ranged', spawnAfter: 75, weight: 1.2 },
  { name: 'Bombardier', radius: 17, speed: 55, hp: 30, damage: 8, xp: 3, color: 0x4db6ac, behavior: 'lobber', spawnAfter: 140, weight: 1 },
  { name: 'Charger', radius: 18, speed: 75, hp: 45, damage: 12, xp: 3, color: 0x7986cb, behavior: 'charger', spawnAfter: 100, weight: 1.5 },
];

export const EnemyType = { Grunt: 0, Runner: 1, Brute: 2, Boss: 3, Spitter: 4, Bombardier: 5, Charger: 6 } as const;

export const MAX_ENEMY_RADIUS = Math.max(...ENEMY_TYPES.map((e) => e.radius));

// Attack tuning for the special enemies.

/** Keeps its distance and spits slow, dodgeable orbs. */
export const SPITTER = { minRange: 260, maxRange: 380, fireRange: 560, cooldown: 3, shotSpeed: 220, shotDamage: 8, shotLife: 3.2 };

/** Lobs a bomb at where you are; a circle marks the spot until it explodes. */
export const BOMBARDIER = { minRange: 380, maxRange: 500, fireRange: 650, cooldown: 4, radius: 75, delay: 1.3, damage: 25 };

/** Stops, shows its path, then dashes along it. */
export const CHARGER = { triggerRange: 340, windup: 0.8, speed: 520, duration: 0.7, recover: 0.5, cooldown: 3, damage: 25, width: 40 };

/** The boss drops bombs on every player. */
export const BOSS_ATTACK = { cooldown: 5, radius: 95, delay: 1.4, damage: 35 };
