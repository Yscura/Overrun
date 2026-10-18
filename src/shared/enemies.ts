export type Behavior = 'chase' | 'ranged' | 'lobber' | 'charger' | 'boss' | 'flee' | 'named' | 'ward' | 'egg' | 'part';

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

/** Bosses (the Warlord and the named final bosses) stay hidden in the bestiary until you've reached them. */
export function isBossType(type: number): boolean {
  const behavior = ENEMY_TYPES[type]?.behavior;
  return behavior === 'boss' || behavior === 'named';
}

/** Indexed by enemy type id, which is what goes over the network. */
export const ENEMY_TYPES: EnemyDef[] = [
  { name: 'Grunt', radius: 14, speed: 85, hp: 12, damage: 10, xp: 1, color: 0xe57373, behavior: 'chase', spawnAfter: 0, weight: 10 },
  { name: 'Runner', radius: 10, speed: 145, hp: 8, damage: 8, xp: 1, color: 0xffd54f, behavior: 'chase', spawnAfter: 25, weight: 4 },
  { name: 'Brute', radius: 24, speed: 60, hp: 70, damage: 17, xp: 5, color: 0xba68c8, behavior: 'chase', spawnAfter: 60, weight: 2, elite: true, armor: 0.3 },
  // Mini-boss every few minutes.
  { name: 'Warlord', radius: 56, speed: 75, hp: 1200, damage: 40, xp: 100, color: 0xff7043, behavior: 'boss', spawnAfter: 0, weight: 0, elite: true, armor: 0.25, ward: 0.25 },
  { name: 'Spitter', radius: 13, speed: 80, hp: 16, damage: 6, xp: 2, color: 0x9ccc65, behavior: 'ranged', spawnAfter: 50, weight: 1.2 },
  { name: 'Bombardier', radius: 17, speed: 55, hp: 30, damage: 8, xp: 3, color: 0x4db6ac, behavior: 'lobber', spawnAfter: 90, weight: 0.7, elite: true, ward: 0.3 },
  { name: 'Charger', radius: 18, speed: 75, hp: 45, damage: 12, xp: 3, color: 0x7986cb, behavior: 'charger', spawnAfter: 65, weight: 1.5, elite: true, armor: 0.25 },
  // Only spawned by the hunt quest. Runs away; its reward comes from the quest.
  { name: 'Thief', radius: 15, speed: 190, hp: 160, damage: 0, xp: 0, color: 0xffd700, behavior: 'flee', spawnAfter: 0, weight: 0, elite: true },
  { name: 'Wraith', radius: 12, speed: 115, hp: 14, damage: 8, xp: 2, color: 0xb39ddb, behavior: 'chase', spawnAfter: 40, weight: 1.5, flying: true, armor: 0.5 },
  // Named final bosses, one per map (see maps.ts).
  { name: 'Grimm', radius: 60, speed: 85, hp: 30000, damage: 45, xp: 0, color: 0x6e8a96, behavior: 'named', spawnAfter: 0, weight: 0, elite: true },
  { name: 'Rime', radius: 54, speed: 70, hp: 38000, damage: 40, xp: 0, color: 0x81d4fa, behavior: 'named', spawnAfter: 0, weight: 0, elite: true, ward: 0.2 },
  { name: 'Ashlord Vael', radius: 64, speed: 80, hp: 28000, damage: 50, xp: 0, color: 0xff5722, behavior: 'named', spawnAfter: 0, weight: 0, elite: true, armor: 0.3 },
  { name: 'Embra', radius: 52, speed: 95, hp: 24000, damage: 35, xp: 0, color: 0xffab40, behavior: 'named', spawnAfter: 0, weight: 0, elite: true, ward: 0.3 },
  // Stationary totems that shield the boss during a side mission.
  { name: 'Ward', radius: 26, speed: 0, hp: 160, damage: 0, xp: 0, color: 0x80deea, behavior: 'ward', spawnAfter: 0, weight: 0, elite: true, ward: 0.5 },
  // More named final bosses (after the Ward, so the ids above don't change).
  { name: 'Sylvara', radius: 58, speed: 90, hp: 22000, damage: 35, xp: 0, color: 0x66bb6a, behavior: 'named', spawnAfter: 0, weight: 0, elite: true },
  { name: 'Kharzak', radius: 62, speed: 85, hp: 34000, damage: 48, xp: 0, color: 0xd4a056, behavior: 'named', spawnAfter: 0, weight: 0, elite: true, armor: 0.35 },
  // Laid by Sylvara: hatches into a few runners unless it's broken first.
  { name: 'Serpent Egg', radius: 20, speed: 0, hp: 120, damage: 0, xp: 0, color: 0xc5e1a5, behavior: 'egg', spawnAfter: 0, weight: 0, elite: true },
  // Called up by Grimm, the Reaper: lost souls that drift through walls.
  { name: 'Spirit', radius: 13, speed: 120, hp: 10, damage: 8, xp: 1, color: 0x4dd0c8, behavior: 'chase', spawnAfter: 0, weight: 0, flying: true },
  // The true final boss of the Ashen Caldera, waiting in his den beneath it. The largest of them all.
  { name: 'Mordak', radius: 110, speed: 75, hp: 30000, damage: 55, xp: 0, color: 0x8e1414, behavior: 'named', spawnAfter: 0, weight: 0, elite: true, armor: 0.2 },
  // Mordak's wings: targets of their own, carried on his back. Tear both off and he can't fly.
  { name: 'Dragon Wing', radius: 46, speed: 0, hp: 1, damage: 0, xp: 0, color: 0x5a0e0e, behavior: 'part', spawnAfter: 0, weight: 0, elite: true },
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
  Reaper: 9,
  Rime: 10,
  AshlordVael: 11,
  Embra: 12,
  Ward: 13,
  Sylvara: 14,
  Kharzak: 15,
  Egg: 16,
  Spirit: 17,
  Mordak: 18,
  DragonWing: 19,
} as const;

export const MAX_ENEMY_RADIUS = Math.max(...ENEMY_TYPES.map((e) => e.radius));

// Attack tuning for the special enemies.

/** Keeps its distance and spits slow, dodgeable orbs. */
export const SPITTER = { minRange: 260, maxRange: 380, fireRange: 560, cooldown: 3, shotSpeed: 220, shotDamage: 7, shotLife: 3.2 };

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
  damage: 19,
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
  damage: 21,
  width: 40,
};

/** The Warlord drops bombs on every player. */
export const BOSS_ATTACK = { cooldown: 5, radius: 95, delay: 1.4, damage: 35 };

// --- Named bosses ---

/**
 * What a named boss can do. The first few are shared; the rest belong to one boss each (see BOSS_MECHANICS).
 * barrage: bomb circles on everyone. nova: a ring of bullets. charge: a telegraphed dash. summon: minions.
 */
export type BossAttack =
  | 'fireballs'
  | 'roost'
  | 'flight'
  | 'firebeam'
  | 'barrage'
  | 'nova'
  | 'charge'
  | 'summon'
  | 'spit'
  | 'sting'
  | 'pools'
  | 'mark'
  | 'eggs'
  | 'cleave'
  | 'shockwave'
  | 'feeders'
  | 'glacial'
  | 'frostbomb'
  | 'breath'
  | 'burrow'
  | 'sweep'
  | 'meteor'
  | 'orbs';

/** A boss's voice, heard every so often during the fight (see NamedBossDef.voice). */
export type BossVoice = 'whisper' | 'hiss' | 'laugh' | 'demon' | 'dragon';

/** What happens when a boss drops below each BOSS_MISSIONS.at share: a side mission, or Kharzak's shell. */
export type BossPhase = MissionKind | 'shell' | 'none';

export interface NamedBossDef {
  title: string;
  /** Used in order, one every `cooldown` seconds (faster when enraged below half HP). */
  attacks: BossAttack[];
  /** On hard mode: a longer, meaner rotation, with an attack or two borrowed from other bosses. */
  hard: BossAttack[];
  cooldown: number;
  /** Enemy types it summons. */
  minions: number[];
  /** Casters: keep about this far from their target instead of closing in. */
  keepAway?: number;
  /** What it does at 66% and 33% health. */
  phase: BossPhase;
  /** It speaks up every `every[0]` to `every[1]` seconds of the fight, and (`gloat`) whenever it downs a player. */
  voice?: { sound: BossVoice; every: [number, number]; gloat?: boolean };
}

export const NAMED_BOSSES: Record<number, NamedBossDef> = {
  // The first boss teaches the basics: dodge a fan of shots, stay out of pools, spread out from a mark, break eggs.
  [EnemyType.Sylvara]: {
    title: 'the Glade Serpent',
    attacks: ['spit', 'pools', 'charge', 'mark', 'spit', 'eggs'],
    hard: ['spit', 'pools', 'charge', 'mark', 'nova', 'spit', 'eggs', 'pools', 'charge'],
    cooldown: 3.4,
    minions: [EnemyType.Grunt, EnemyType.Runner],
    phase: 'wards',
    voice: { sound: 'hiss', every: [6, 11] },
  },
  // Get behind his scythe, dodge through his shockwaves, and don't let the lost souls reach him.
  [EnemyType.Reaper]: {
    title: 'the Reaper',
    attacks: ['cleave', 'shockwave', 'charge', 'feeders', 'cleave', 'barrage'],
    hard: ['cleave', 'shockwave', 'charge', 'feeders', 'cleave', 'shockwave', 'barrage', 'charge'],
    cooldown: 3.3,
    minions: [EnemyType.Spirit, EnemyType.Wraith],
    phase: 'brood',
    voice: { sound: 'whisper', every: [9, 16] },
  },
  // Hide behind a column from Glacial Wrath, and carry a Frost Bomb away from your friends.
  [EnemyType.Rime]: {
    title: 'the Frost Queen',
    attacks: ['frostbomb', 'breath', 'nova', 'glacial', 'breath', 'summon'],
    hard: ['frostbomb', 'breath', 'nova', 'glacial', 'barrage', 'breath', 'frostbomb', 'nova', 'summon'],
    cooldown: 3.2,
    minions: [EnemyType.Wraith, EnemyType.Spitter],
    phase: 'sigils',
    voice: { sound: 'laugh', every: [12, 20], gloat: true },
  },
  // The twins share a burning tether and shrug off damage when close: pull them apart. Stack for meteors.
  [EnemyType.AshlordVael]: {
    title: 'Lord of the Caldera',
    attacks: ['meteor', 'charge', 'barrage', 'summon'],
    hard: ['meteor', 'charge', 'shockwave', 'barrage', 'meteor', 'charge', 'summon'],
    cooldown: 3.4,
    minions: [EnemyType.Charger, EnemyType.Runner],
    phase: 'wards',
    voice: { sound: 'demon', every: [14, 24] },
  },
  // Fights alongside the Ashlord, from a distance.
  [EnemyType.Embra]: {
    title: 'the Cinder Witch',
    attacks: ['orbs', 'nova', 'orbs', 'summon'],
    hard: ['orbs', 'nova', 'barrage', 'orbs', 'nova', 'summon'],
    cooldown: 3.6,
    minions: [EnemyType.Wraith, EnemyType.Spitter],
    keepAway: 320,
    phase: 'wards',
    voice: { sound: 'demon', every: [14, 24] },
  },
  // The real end of the Ashen Caldera: a dragon in his den. Hide behind a pillar from his fire beam, and tear off his
  // wings to keep him on the ground.
  [EnemyType.Mordak]: {
    title: 'the Earth Scourger',
    attacks: ['fireballs', 'firebeam', 'charge', 'flight', 'roost', 'fireballs', 'summon', 'firebeam', 'flight', 'roost'],
    hard: ['fireballs', 'firebeam', 'charge', 'meteor', 'flight', 'roost', 'fireballs', 'shockwave', 'firebeam', 'summon', 'flight', 'roost'],
    cooldown: 3.1,
    minions: [EnemyType.Charger, EnemyType.Runner],
    phase: 'none',
    voice: { sound: 'dragon', every: [13, 21] },
  },
  // Burrows after you, sweeps with its pincers, and hardens its shell: bait its charge into a boulder to crack it.
  [EnemyType.Kharzak]: {
    title: 'Tyrant of the Canyon',
    attacks: ['charge', 'sting', 'burrow', 'sweep', 'sting', 'summon'],
    hard: ['charge', 'sting', 'burrow', 'sweep', 'shockwave', 'sting', 'burrow', 'summon'],
    cooldown: 3.2,
    minions: [EnemyType.Charger, EnemyType.Runner],
    phase: 'shell',
  },
};

/**
 * Tuning for each boss's own mechanics. Damage is before the boss's damage scaling (like BOSS_ATTACK), except
 * Glacial Wrath, which takes a share of your max HP.
 */
export const BOSS_MECHANICS = {
  /** Sylvara: venom pools at everyone's feet that arm after `delay` and burn for `life` seconds. */
  pools: { radius: 85, delay: 0.9, life: 6, dps: 14 },
  /** Sylvara: a circle that follows one player for `follow` seconds, then lands `delay` later. */
  mark: { radius: 115, follow: 2.2, delay: 0.7, damage: 36 },
  /** Sylvara: eggs around the glade that hatch into `hatchlings` runners after `hatch` seconds. */
  eggs: { count: 4, hatch: 8, hatchlings: 3, distance: 300 },
  /** Grimm: a wide swing of his scythe in front of him. */
  cleave: { length: 300, half: 0.8, windup: 1.1, damage: 55 },
  /** Grimm: a ring that rolls out from him; dodge through it or be out of reach. */
  shockwave: { windup: 0.8, speed: 340, width: 46, range: 760, damage: 34 },
  /** Grimm: lost souls drift in from the arena's edge; each one that reaches him heals him by `heal`. */
  feeders: { count: 4, heal: 0.04, hp: 5 },
  /** Rime: she channels, then blasts everyone she can see. */
  glacial: { channel: 3.5, damage: 0.65 },
  /** Rime: a bomb that follows one player and goes off on everyone near them. */
  frostbomb: { radius: 170, fuse: 5, damage: 48 },
  /** Rime: a long cone of frost. */
  breath: { length: 440, half: 0.42, windup: 1.0, damage: 40 },
  /** Kharzak: digs in, a mark hunts one player for `hunt` seconds, and it bursts out there `delay` later. */
  burrow: { hunt: 2.6, delay: 0.8, radius: 135, damage: 50 },
  /** Kharzak: a short, very wide pincer sweep. */
  sweep: { length: 230, half: 1.35, windup: 0.8, damage: 38 },
  /**
   * Kharzak's shell: shrugs off `reduction` of all damage until one of its charges slams into a rock. Then it's
   * stunned for `stun` seconds and takes `exposedBonus` more damage for `exposed` seconds.
   */
  shell: { reduction: 0.85, stun: 4, exposed: 8, exposedBonus: 0.5 },
  /** The twins: a burning tether between them that hurts anyone standing in it. */
  tether: { width: 26, dps: 28 },
  /** The twins: closer than `range` to each other, both shrug off `reduction` of damage. */
  kindred: { range: 380, reduction: 0.4 },
  /** Vael: a meteor on one player; its damage is split between everyone standing in it. */
  meteor: { radius: 150, follow: 1.5, delay: 3.2, damage: 60 },
  /** Mordak: volleys of fireballs fanned out at his target. */
  fireballs: { volleys: 3, shots: 5, spread: 0.2, gap: 0.45, speed: 300, damage: 17 },
  /**
   * Mordak takes to the sky (untargetable), sweeps over the den and out across the lava dropping fire as he goes,
   * and lands somewhere in the den. `speed` is how fast he flies; a bomb falls every `every` seconds.
   */
  /**
   * At each turn of the fire flight he sends down `adds` of his minions (plus `addsPerPlayer` for each player past the
   * first) around the team, and drops fire on everyone again.
   */
  flight: { speed: 720, every: 0.16, radius: 100, delay: 1.0, damage: 36, overshoot: 650, adds: 3, addsPerPlayer: 1 },
  /** Mordak: a beam of fire that sweeps a half circle in front of him. Its damage is a share of your max HP. */
  firebeam: { windup: 1.7, sweep: 2.3, length: 1000, width: 50, damage: 0.35 },
  /**
   * Mordak's wings each have `hp` of his max health. Destroying one stuns him for `stagger` seconds and tears
   * `bodyDamage` of his max health off him; with both gone he can't fly.
   */
  /**
   * His wings as targets of their own (tear both off and he can't fly). `enabled`: off for now; the rest still works
   * if it's turned back on.
   */
  wings: { enabled: false, hp: 0.12, stagger: 3, bodyDamage: 0.06 },
  /**
   * Mordak's tail: anyone behind him (within `half` radians of straight back, and `reach` of his middle) gets swept
   * aside. He cocks it for `windup` seconds (a cone shows where), it lashes across, and swings back over `recover`.
   * Every `cooldown` seconds at most.
   */
  tail: { reach: 360, half: 1.1, windup: 0.65, recover: 0.7, damage: 30, knockback: 210, cooldown: 4.5 },
  /**
   * Mordak sits back on his haunches for `duration` seconds and hurls meteors of fire around the den: one every `every`
   * seconds (after `settle` seconds to sit down), each landing `delay` seconds later in a big circle (`radius`). About
   * `aimed` of them fall on someone; the rest anywhere in the den.
   */
  roost: { duration: 5, settle: 0.7, every: 0.32, delay: 1.7, radius: 175, damage: 42, aimed: 0.45 },
  /**
   * The fire flight crosses the den this many times: `start` at the start of the fight, one more at each of
   * `more` (shares of his health lost).
   */
  flightPasses: { start: 3, more: [0.5] },
  /**
   * Where Mordak's mouth is (his fire comes from it): `neck` along his body from his middle to where the neck bends,
   * then `reach` on toward wherever his head is turned. To match how the client draws him.
   */
  mouth: { neck: 70, reach: 170 },
  /** How fast Mordak's head turns (radians a second), and how far from straight ahead it can look. */
  head: { turn: 3, reach: 0.85 },
  /** Embra: slow fire orbs that turn toward their target. */
  orbs: { count: 3, speed: 150, turn: 1.5, life: 7, damage: 22 },
};

/** A ring of bullets in every direction. */
export const BOSS_NOVA = { shots: 18, speed: 210, damage: 12, life: 4 };
/** The serpent spits a fan of venom at its target: `shots` bullets, `spread` radians apart. */
export const BOSS_SPIT = { shots: 7, spread: 0.16, speed: 260, damage: 12, life: 3 };
/**
 * The scorpion stabs its tail down in a line toward its target: `count` circles `step` apart, each landing `stagger`
 * seconds after the one before (the first after `delay`).
 */
export const BOSS_STING = { count: 5, step: 115, radius: 72, delay: 0.9, stagger: 0.14, damage: 30 };
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
export const BOSS_POWER = { hp: 2.8, damage: 1.5 };
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
  brood: { goal: 'Banish the marked spirits' },
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
    damage: (1 + 1.4 * f * f) / HORDE_DENSITY ** 0.7,
    speed: 1 + 0.25 * f * f,
    /** XP per enemy. */
    xp: 1 / HORDE_DENSITY,
    /** Enemies per second, before the player-count factor. */
    spawnRate: (0.8 + 24 * f + 14 * f * f) * HORDE_DENSITY,
    /** Extra spawn weight for elite enemies. */
    elite: 1 + 2 * f,
  };
}
