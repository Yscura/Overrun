export type Behavior = 'chase' | 'ranged' | 'lobber' | 'charger' | 'boss' | 'flee' | 'named';

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
  /** Relative spawn chance once available. 0 = never spawned randomly. Maps can scale this. */
  weight: number;
  /** Flies over walls. */
  flying?: boolean;
  /** Shown individually on the minimap. */
  elite?: boolean;
}

/** Indexed by enemy type id, which is what goes over the network. */
export const ENEMY_TYPES: EnemyDef[] = [
  { name: 'Grunt', radius: 14, speed: 85, hp: 12, damage: 10, xp: 1, color: 0xe57373, behavior: 'chase', spawnAfter: 0, weight: 10 },
  { name: 'Runner', radius: 10, speed: 145, hp: 8, damage: 8, xp: 1, color: 0xffd54f, behavior: 'chase', spawnAfter: 40, weight: 4 },
  { name: 'Brute', radius: 24, speed: 60, hp: 70, damage: 20, xp: 5, color: 0xba68c8, behavior: 'chase', spawnAfter: 90, weight: 2, elite: true },
  // Mini-boss every few minutes.
  { name: 'Warlord', radius: 56, speed: 75, hp: 2000, damage: 40, xp: 100, color: 0xff7043, behavior: 'boss', spawnAfter: 0, weight: 0, elite: true },
  { name: 'Spitter', radius: 13, speed: 80, hp: 16, damage: 6, xp: 2, color: 0x9ccc65, behavior: 'ranged', spawnAfter: 75, weight: 1.2 },
  { name: 'Bombardier', radius: 17, speed: 55, hp: 30, damage: 8, xp: 3, color: 0x4db6ac, behavior: 'lobber', spawnAfter: 140, weight: 0.7, elite: true },
  { name: 'Charger', radius: 18, speed: 75, hp: 45, damage: 12, xp: 3, color: 0x7986cb, behavior: 'charger', spawnAfter: 100, weight: 1.5, elite: true },
  // Only spawned by the hunt quest. Runs away; its reward comes from the quest.
  { name: 'Thief', radius: 15, speed: 190, hp: 160, damage: 0, xp: 0, color: 0xffd700, behavior: 'flee', spawnAfter: 0, weight: 0, elite: true },
  { name: 'Wraith', radius: 12, speed: 115, hp: 14, damage: 8, xp: 2, color: 0xb39ddb, behavior: 'chase', spawnAfter: 60, weight: 1.5, flying: true },
  // Named final bosses, one per map (see maps.ts).
  { name: 'Grimjaw', radius: 60, speed: 85, hp: 30000, damage: 45, xp: 0, color: 0xa1887f, behavior: 'named', spawnAfter: 0, weight: 0, elite: true },
  { name: 'Rime', radius: 54, speed: 70, hp: 38000, damage: 40, xp: 0, color: 0x81d4fa, behavior: 'named', spawnAfter: 0, weight: 0, elite: true },
  { name: 'Ashlord Vael', radius: 64, speed: 80, hp: 48000, damage: 50, xp: 0, color: 0xff5722, behavior: 'named', spawnAfter: 0, weight: 0, elite: true },
];

export const EnemyType = {
  Grunt: 0,
  Runner: 1,
  Brute: 2,
  Warlord: 3,
  Spitter: 4,
  Bombardier: 5,
  Charger: 6,
  Thief: 7,
  Wraith: 8,
  Grimjaw: 9,
  Rime: 10,
  AshlordVael: 11,
} as const;

export const MAX_ENEMY_RADIUS = Math.max(...ENEMY_TYPES.map((e) => e.radius));

// Attack tuning for the special enemies.

/** Keeps its distance and spits slow, dodgeable orbs. */
export const SPITTER = { minRange: 260, maxRange: 380, fireRange: 560, cooldown: 3, shotSpeed: 220, shotDamage: 8, shotLife: 3.2 };

/**
 * Lobs a bomb at where you are; a circle marks the spot until it explodes. Each bombardier waits
 * `cooldown` plus up to `jitter` seconds between bombs, all bombardiers together throw at most one bomb
 * every `spacing` seconds, and no more than `maxActive` of their bombs are on the ground at once.
 */
export const BOMBARDIER = {
  minRange: 380,
  maxRange: 500,
  fireRange: 650,
  cooldown: 5,
  jitter: 3,
  spacing: 0.6,
  maxActive: 4,
  radius: 75,
  delay: 1.3,
  damage: 22,
};

/** A dash attack: stop, show the path, then dash along it. */
export interface ChargeConfig {
  windup: number;
  speed: number;
  duration: number;
  recover: number;
  damage: number;
  /** Width of the telegraphed lane. */
  width: number;
}

export const CHARGER: ChargeConfig & { triggerRange: number; cooldown: number } = {
  triggerRange: 340,
  windup: 0.8,
  speed: 520,
  duration: 0.7,
  recover: 0.5,
  cooldown: 3,
  damage: 25,
  width: 40,
};

/** The Warlord drops bombs on every player. */
export const BOSS_ATTACK = { cooldown: 5, radius: 95, delay: 1.4, damage: 35 };

// --- Named bosses ---

export type BossAttack = 'barrage' | 'nova' | 'charge' | 'summon';

export interface NamedBossDef {
  title: string;
  /** Used in order, one every `cooldown` seconds (faster when enraged below half HP). */
  attacks: BossAttack[];
  cooldown: number;
  /** Enemy types it summons. */
  minions: number[];
}

export const NAMED_BOSSES: Record<number, NamedBossDef> = {
  [EnemyType.Grimjaw]: { title: 'the Ruin Beast', attacks: ['charge', 'barrage', 'charge', 'summon'], cooldown: 3.5, minions: [EnemyType.Grunt, EnemyType.Runner] },
  [EnemyType.Rime]: { title: 'Queen of the Frozen Fortress', attacks: ['nova', 'barrage', 'nova', 'summon'], cooldown: 3.2, minions: [EnemyType.Wraith, EnemyType.Spitter] },
  [EnemyType.AshlordVael]: {
    title: 'Lord of the Caldera',
    attacks: ['charge', 'nova', 'barrage', 'summon', 'nova'],
    cooldown: 3,
    minions: [EnemyType.Charger, EnemyType.Runner],
  },
};

/** A ring of bullets in every direction. */
export const BOSS_NOVA = { shots: 18, speed: 210, damage: 12, life: 4 };
export const BOSS_CHARGE: ChargeConfig = { windup: 1.0, speed: 640, duration: 0.8, recover: 0.8, damage: 40, width: 120 };
export const BOSS_SUMMON = { count: 6 };
/** Bosses (Warlords and named bosses) take only `share` of any stun, then can't be stunned for `immunity` seconds. */
export const BOSS_STUN = { share: 0.3, immunity: 4 };
/** Below this share of HP the boss attacks faster. */
export const BOSS_ENRAGE_AT = 0.5;
export const BOSS_ENRAGE_SPEEDUP = 0.65;

export function bossDisplayName(type: number): string {
  return `${ENEMY_TYPES[type].name}, ${NAMED_BOSSES[type]?.title ?? ''}`.replace(/, $/, '');
}
