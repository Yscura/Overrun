export type Behavior = 'chase' | 'ranged' | 'lobber' | 'charger' | 'boss' | 'flee' | 'named' | 'ward';

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
  /** Share of physical damage it shrugs off (thick hide, armor). */
  armor?: number;
  /** Share of magic damage it shrugs off. */
  ward?: number;
}

/** Indexed by enemy type id, which is what goes over the network. */
export const ENEMY_TYPES: EnemyDef[] = [
  { name: 'Grunt', radius: 14, speed: 85, hp: 12, damage: 10, xp: 1, color: 0xe57373, behavior: 'chase', spawnAfter: 0, weight: 10 },
  { name: 'Runner', radius: 10, speed: 145, hp: 8, damage: 8, xp: 1, color: 0xffd54f, behavior: 'chase', spawnAfter: 25, weight: 4 },
  { name: 'Brute', radius: 24, speed: 60, hp: 70, damage: 20, xp: 5, color: 0xba68c8, behavior: 'chase', spawnAfter: 60, weight: 2, elite: true, armor: 0.3 },
  // Mini-boss every few minutes.
  { name: 'Warlord', radius: 56, speed: 75, hp: 1200, damage: 40, xp: 100, color: 0xff7043, behavior: 'boss', spawnAfter: 0, weight: 0, elite: true, armor: 0.25, ward: 0.25 },
  { name: 'Spitter', radius: 13, speed: 80, hp: 16, damage: 6, xp: 2, color: 0x9ccc65, behavior: 'ranged', spawnAfter: 50, weight: 1.2 },
  { name: 'Bombardier', radius: 17, speed: 55, hp: 30, damage: 8, xp: 3, color: 0x4db6ac, behavior: 'lobber', spawnAfter: 90, weight: 0.7, elite: true, ward: 0.3 },
  { name: 'Charger', radius: 18, speed: 75, hp: 45, damage: 12, xp: 3, color: 0x7986cb, behavior: 'charger', spawnAfter: 65, weight: 1.5, elite: true, armor: 0.25 },
  // Only spawned by the hunt quest. Runs away; its reward comes from the quest.
  { name: 'Thief', radius: 15, speed: 190, hp: 160, damage: 0, xp: 0, color: 0xffd700, behavior: 'flee', spawnAfter: 0, weight: 0, elite: true },
  { name: 'Wraith', radius: 12, speed: 115, hp: 14, damage: 8, xp: 2, color: 0xb39ddb, behavior: 'chase', spawnAfter: 40, weight: 1.5, flying: true, armor: 0.5 },
  // Named final bosses, one per map (see maps.ts).
  { name: 'Grimjaw', radius: 60, speed: 85, hp: 30000, damage: 45, xp: 0, color: 0xa1887f, behavior: 'named', spawnAfter: 0, weight: 0, elite: true },
  { name: 'Rime', radius: 54, speed: 70, hp: 38000, damage: 40, xp: 0, color: 0x81d4fa, behavior: 'named', spawnAfter: 0, weight: 0, elite: true, ward: 0.2 },
  { name: 'Ashlord Vael', radius: 64, speed: 80, hp: 28000, damage: 50, xp: 0, color: 0xff5722, behavior: 'named', spawnAfter: 0, weight: 0, elite: true, armor: 0.3 },
  { name: 'Embra', radius: 52, speed: 95, hp: 24000, damage: 35, xp: 0, color: 0xffab40, behavior: 'named', spawnAfter: 0, weight: 0, elite: true, ward: 0.3 },
  // Stationary totems that shield the boss during a side mission.
  { name: 'Ward', radius: 26, speed: 0, hp: 160, damage: 0, xp: 0, color: 0x80deea, behavior: 'ward', spawnAfter: 0, weight: 0, elite: true, ward: 0.5 },
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
  Embra: 12,
  Ward: 13,
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
  /** Casters: keep about this far from their target instead of closing in. */
  keepAway?: number;
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
  // Fights alongside the Ashlord, from a distance.
  [EnemyType.Embra]: {
    title: 'the Cinder Witch',
    attacks: ['barrage', 'nova', 'barrage', 'summon'],
    cooldown: 3.4,
    minions: [EnemyType.Wraith, EnemyType.Spitter],
    keepAway: 320,
  },
};

/** A ring of bullets in every direction. */
export const BOSS_NOVA = { shots: 18, speed: 210, damage: 12, life: 4 };
export const BOSS_CHARGE: ChargeConfig = { windup: 1.0, speed: 640, duration: 0.8, recover: 0.8, damage: 40, width: 120 };
/** Each summon calls `count` minions, but never while `maxMinions` regular enemies are already in the fight. */
export const BOSS_SUMMON = { count: 3, maxMinions: 10 };
/** During the final fight on an open map, the horde keeps coming at this share of its usual rate. */
export const BOSS_FIGHT_HORDE = 0.03;
/** When the final boss shows up on an open map, only this many of the horde (the ones closest to the team) stay. */
export const BOSS_FIGHT_STAY = 30;
/** Bosses (Warlords and named bosses) take only `share` of any stun, then can't be stunned for `immunity` seconds. */
export const BOSS_STUN = { share: 0.3, immunity: 4 };
/**
 * Named bosses' health and damage on top of their base stats (and the map's difficulty). Their damage doesn't
 * follow the horde's curve, or their attacks would one-shot everyone.
 */
export const BOSS_POWER = { hp: 2.5, damage: 1.5 };
/**
 * Kill the final boss within `after` seconds of the fight starting, or it goes berserk: every `every` seconds
 * it gains a stack, and each stack adds `damage` to its damage, `haste` to its attack speed and `area` to the size
 * of its attacks (bomb circles, charge lanes, bullet rings).
 */
export const BOSS_BERSERK = { after: 300, every: 30, damage: 0.2, haste: 0.12, area: 0.12 };
/** Twin bosses: when one dies, the other heals `heal` of its max HP and gets these multipliers for good. */
export const BOSS_VENGEFUL = { heal: 0.25, damage: 1.5, haste: 1.4, area: 1.25 };

/**
 * Side missions: when the bosses' combined health drops below each `at` share, they're shielded (immune) until
 * the team completes a mission.
 */
export const BOSS_MISSIONS = { at: [0.66, 0.33], wards: 4, wardDistance: 280, sigils: 3, sigilTime: 3, sigilDistance: 260, brood: 10, broodHp: 12 };
export type MissionKind = 'wards' | 'sigils' | 'brood';
export const MISSIONS: Record<MissionKind, { goal: string }> = {
  wards: { goal: 'Destroy the wards' },
  sigils: { goal: 'Charge the sigils' },
  brood: { goal: 'Slay the marked brood' },
};
export const MISSION_KINDS = Object.keys(MISSIONS) as MissionKind[];

/** Below this share of HP the boss attacks faster. */
export const BOSS_ENRAGE_AT = 0.5;
export const BOSS_ENRAGE_SPEEDUP = 0.65;

export function bossDisplayName(type: number): string {
  return `${ENEMY_TYPES[type].name}, ${NAMED_BOSSES[type]?.title ?? ''}`.replace(/, $/, '');
}

/**
 * Fewer, tougher enemies: the horde spawns at this share of the base rate, and each enemy has 1/DENSITY times
 * the health and gives 1/DENSITY times the XP, so the total difficulty stays about the same. Damage grows a bit
 * less, since fewer enemies also means fewer of them touching you at once.
 */
export const HORDE_DENSITY = 0.65;

/**
 * Champions: from `from` of the way to the boss, a growing share of spawns (up to `maxChance`) are champions
 * with one affix, `hp` times the health, `damage` times the damage and `xp` times the XP.
 */
export const CHAMPION = { from: 0.2, minChance: 0.02, maxChance: 0.08, hp: 4, damage: 1.5, xp: 5, size: 1.35 };
export const Affix = { None: 0, Hasted: 1, Vampiric: 2, Volatile: 3, Splitting: 4, Armored: 5, Warded: 6 } as const;
export const AFFIXES = [
  { name: '', color: 0 },
  { name: 'Hasted', color: 0xffee58 },
  { name: 'Vampiric', color: 0xff1744 },
  { name: 'Volatile', color: 0xff9100 },
  { name: 'Splitting', color: 0x69f0ae },
  { name: 'Armored', color: 0xb0bec5 },
  { name: 'Warded', color: 0x448aff },
];
/** Affix tuning: Hasted speed, Vampiric healing per damage dealt, Volatile death bomb, Splitting children. */
export const AFFIX_TUNING = {
  hasteSpeed: 1.6,
  vampHeal: 10,
  volatile: { radius: 90, delay: 1.1, damage: 30 },
  splits: 3,
  /** Armored and Warded champions shrug off this much more physical / magic damage. */
  resist: 0.5,
};

/** Resistances never go above this. */
export const MAX_RESIST = 0.8;

/**
 * How tough the horde gets `progress` of the way to the final boss (0 at the start, 1 when it arrives):
 * gentle early on, then steep toward the end when builds come together. Health and damage are further
 * multiplied by the map's difficulty.
 */
export function hordeScaling(progress: number) {
  const f = Math.min(progress, 1.2);
  return {
    hp: (1 + 4 * f + 25 * f ** 4) / HORDE_DENSITY,
    damage: (1 + 2 * f * f) / HORDE_DENSITY ** 0.7,
    speed: 1 + 0.25 * f * f,
    /** XP per enemy. */
    xp: 1 / HORDE_DENSITY,
    /** Enemies per second, before the player-count factor. */
    spawnRate: (0.8 + 24 * f + 14 * f * f) * HORDE_DENSITY,
    /** Extra spawn weight for elite enemies. */
    elite: 1 + 2 * f,
  };
}
