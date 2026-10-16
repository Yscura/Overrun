import { PICKUP_BASE_RADIUS } from './constants';

export type Role = 'ranged' | 'melee';
/** Hero abilities (cast with E). They level up like weapons but only their own hero can get them. */
export type AbilityId = 'meteor' | 'leap' | 'warcry' | 'veil' | 'flamenova' | 'tumble' | 'wildcall' | 'timebomb' | 'toxicpool' | 'consecrate' | 'prayer';
export type WeaponId =
  | 'bolt'
  | 'knives'
  | 'storm'
  | 'hex'
  | 'cleave'
  | 'slam'
  | 'venom'
  | 'orbit'
  | 'field'
  | 'mines'
  | 'shuriken'
  | 'daggers'
  | 'fireball'
  | 'arrows'
  | 'wolves'
  | 'flask'
  | 'hammer'
  | 'smite'
  | AbilityId;
export type PassiveId =
  | 'might'
  | 'haste'
  | 'swift'
  | 'vitality'
  | 'magnet'
  | 'regen'
  | 'armor'
  | 'crit'
  | 'lifesteal'
  | 'area'
  | 'duration'
  | 'multishot'
  | 'evasion'
  | 'wisdom'
  | 'arcana';
export type UpgradeId = WeaponId | PassiveId;

/** Offered on a level-up once there's nothing left to upgrade (or to fill up a short list of choices). */
export type BonusId = 'bonusHeal' | 'bonusGold';
export type ChoiceId = UpgradeId | BonusId;
export const BONUS = { heal: 0.25, gold: 25 };
export const BONUSES: Record<BonusId, { name: string; text: string }> = {
  bonusHeal: { name: 'Second Wind', text: `Heal ${BONUS.heal * 100}% of your max HP.` },
  bonusGold: { name: 'Spoils', text: `+${BONUS.gold} gold, kept between runs.` },
};
export function isBonus(id: string): id is BonusId {
  return id in BONUSES;
}
/** Upgrade id -> level. Missing means not owned. */
export type Upgrades = Partial<Record<UpgradeId, number>>;

/** Highest level from normal level-ups (some upgrades stop earlier, see `maxLevel`). */
export const MAX_LEVEL = 5;
/** Weapons at MAX_LEVEL can be evolved one step further, only at a Forge. */
export const EVOLVED_LEVEL = MAX_LEVEL + 1;

/** Each hero carries at most this many weapons (not counting their E ability) and passives. */
export const WEAPON_SLOTS = 4;
export const PASSIVE_SLOTS = 5;

/** Crits deal this many times normal damage. */
export const CRIT_MULTIPLIER = 2;

/**
 * Every source of damage is physical (orange numbers), magic (blue) or true (white). Enemies can resist physical
 * or magic, so a team wants a mix; true damage goes through every resistance, but it's rare.
 */
export type DamageType = 'physical' | 'magic' | 'true';
/** Which kinds of damage can crit. Flip `magic` to true to let spells crit too. */
export const CRIT_TYPES: Record<DamageType, boolean> = { physical: true, magic: false, true: false };
/** Damage type ids as they go over the network, in this order. */
export const DAMAGE_TYPES: DamageType[] = ['physical', 'magic', 'true'];
export const DAMAGE_COLORS: Record<DamageType, number> = { physical: 0xffab40, magic: 0x64b5f6, true: 0xeceff1 };
export const DAMAGE_NAMES: Record<DamageType, string> = { physical: 'Physical', magic: 'Magic', true: 'True' };
/**
 * Attunement: every weapon or ability you carry beyond the first of a damage type adds this much damage of that
 * type. Magic attunes more strongly because it can't crit.
 */
export const ATTUNEMENT: Record<DamageType, number> = { physical: 0.06, magic: 0.1, true: 0.06 };
/** Arcana, the magic counterpart to Crit: this much more magic damage per level. */
export const ARCANA_PER_LEVEL = 0.08;

// Weapon stats per level. Tweak these to balance the game.
// Level 6 (evolved) keeps the level 5 numbers and adds the weapon's special effect.

export function boltStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  return {
    damage: 12 + 4 * n,
    cooldown: Math.max(0.35, 0.7 - 0.06 * n),
    count: 1 + Math.floor(n / 2),
    pierce: Math.floor(n / 3),
    speed: 450,
    range: 650,
    spread: 0.18,
    /** Evolved: each hit explodes, damaging enemies around it for a share of the bolt's damage. */
    explosion: level >= EVOLVED_LEVEL ? { radius: 60, damageShare: 0.6 } : null,
  };
}

export function knivesStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  return {
    damage: 7 + 2 * n,
    cooldown: Math.max(0.35, 0.6 - 0.05 * n),
    count: 3 + Math.floor(n / 2),
    pierce: n >= 3 ? 1 : 0,
    speed: 650,
    range: 320,
    spread: 0.12,
    /** Evolved: also throws this many knives in a full circle around you. */
    ring: level >= EVOLVED_LEVEL ? 10 : 0,
  };
}

export function stormStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 22 + 9 * n,
    cooldown: Math.max(0.9, 1.8 - 0.2 * n),
    // Evolved: twice the strikes, with a much bigger blast.
    strikes: (1 + Math.floor((n + 1) / 2)) * (evolved ? 2 : 1),
    range: evolved ? 520 : 420,
    /** Enemies this close to a strike take its damage too. */
    splash: evolved ? 90 : 45,
  };
}

export function cleaveStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 22 + 8 * n,
    cooldown: Math.max(0.55, 1.0 - 0.1 * n),
    // Evolved: a full spin with longer reach.
    range: (95 + 10 * n) * (evolved ? 1.3 : 1),
    /** Width of the swing in radians. */
    arc: evolved ? Math.PI * 2 : 1.9 + 0.15 * n,
    knockback: 30,
  };
}

export function slamStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  return {
    damage: 20 + 10 * n,
    cooldown: Math.max(1.2, 2.5 - 0.25 * n),
    radius: 110 + 15 * n,
    knockback: 40,
    /** Evolved: enemies hit are stunned this many seconds. */
    stun: level >= EVOLVED_LEVEL ? 1.5 : 0,
  };
}

export function orbitStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    // Evolved: more blades, wider and faster.
    count: n + 2 + (evolved ? 3 : 0),
    damage: 8 + 3 * n,
    radius: 70 + 8 * n + (evolved ? 25 : 0),
    /** Radians per second. */
    spin: evolved ? 4 : 3,
    /** How often the same enemy can be hit by blades. */
    hitCooldown: 0.5,
    bladeRadius: 12,
  };
}

/** Homing missiles that seek out enemies on their own. */
export function hexStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 14 + 5 * n,
    cooldown: Math.max(0.6, 1.2 - 0.1 * n),
    // Evolved: three more hexes, and each pierces once.
    count: 1 + Math.floor(n / 2) + (evolved ? 3 : 0),
    pierce: evolved ? 1 : 0,
    speed: 380,
    range: 900,
    spread: 0.5,
  };
}

/** A damaging aura that pulses around you. */
export function fieldStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 6 + 3 * n,
    // Evolved: pulses twice as fast in a much bigger area.
    interval: evolved ? 0.25 : 0.5,
    radius: (90 + 12 * n) * (evolved ? 1.4 : 1),
  };
}

/** Poison puddles left behind as you move. */
export function venomStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    /** Per tick (every 0.5s) to every enemy standing in a puddle. */
    damage: 8 + 4 * n,
    radius: (40 + 5 * n) * (evolved ? 1.5 : 1),
    /** Seconds a puddle lasts. Evolved: twice as long. */
    life: 2.5 * (evolved ? 2 : 1),
    /** You have to move at least this far between puddles. */
    spacing: 30,
  };
}

/** Mines dropped where you stand, exploding when an enemy comes close. */
export function minesStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 40 + 18 * n,
    // Evolved: dropped twice as often, with bigger blasts.
    cooldown: Math.max(1, 2.2 - 0.2 * n) * (evolved ? 0.5 : 1),
    radius: (90 + 10 * n) * (evolved ? 1.3 : 1),
    trigger: 35,
    armTime: 0.5,
    max: 8,
  };
}

/** Pickup radius, which every character shares. */
export function magnetRadius(upgrades: Upgrades): number {
  return PICKUP_BASE_RADIUS * (1 + 0.3 * (upgrades.magnet ?? 0));
}

// --- Hero abilities (E) ---

/** Kael: a giant shuriken that flies out toward the cursor, then returns, cutting through everything both ways. */
/** A giant shuriken thrown toward your cursor that comes back, cutting through everything both ways. */
export function shurikenStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return { damage: 30 + 12 * n, cooldown: Math.max(1.6, 3 - 0.3 * n), range: 380 + 20 * n, speed: 560, radius: evolved ? 27 : 18, count: evolved ? 3 : 1 };
}

/** Quick stabs at the nearest enemies within reach. Reach doesn't grow with area. */
export function daggersStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 28 + 10 * n,
    cooldown: Math.max(0.3, 0.5 - 0.04 * n) * (evolved ? 0.7 : 1),
    range: 105,
    targets: 2 + Math.floor(n / 2),
    /** Evolved: every enemy within reach, 30% faster. */
    all: evolved,
  };
}

/** A slow fireball that explodes on impact. */
export function fireballStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 20 + 8 * n,
    cooldown: Math.max(0.7, 1.3 - 0.12 * n),
    count: 1 + Math.floor(n / 3),
    pierce: 0,
    speed: 380,
    range: 620,
    spread: 0.25,
    explosion: { radius: (55 + 6 * n) * (evolved ? 1.4 : 1), damageShare: 1 },
    /** Evolved: leaves burning ground where it explodes. Damage per tick. */
    burn: evolved ? { damage: 8 + 3 * n, life: 3 } : null,
  };
}

/** Fast, long-range arrows toward your cursor that pierce. */
export function arrowsStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 16 + 6 * n,
    cooldown: Math.max(0.45, 0.9 - 0.09 * n),
    // Evolved: a volley of three that pierces everything.
    count: 1 + Math.floor(n / 3) + (evolved ? 2 : 0),
    pierce: evolved ? 99 : 1 + Math.floor(n / 2),
    speed: 820,
    range: 780,
    spread: 0.08,
  };
}

/** Spirit wolves that hunt enemies near you. */
export function wolvesStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    count: 1 + Math.floor((n + 1) / 2) + (evolved ? 2 : 0),
    damage: 14 + 6 * n,
    biteCooldown: 0.6,
    speed: 480,
    /** They only chase enemies within this distance of you. */
    leash: 450,
    /** Evolved: each bite also hurts enemies around the target. */
    splash: evolved ? 50 : 0,
  };
}

/** Alchemist: flasks lobbed at nearby enemies that splash and leave acid puddles. */
export function flaskStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 15 + 6 * n,
    cooldown: Math.max(0.9, 1.6 - 0.14 * n),
    // Evolved: one more flask per throw.
    count: 1 + Math.floor(n / 3) + (evolved ? 1 : 0),
    radius: 55 + 5 * n,
    range: 520,
    /** Seconds from the throw to the splash. */
    flight: 0.45,
    /** Acid puddle left behind: damage every 0.5s. Evolved: 50% bigger. */
    puddle: { damage: 3 + 1.5 * n, life: 2, scale: evolved ? 1.2 : 0.8 },
  };
}

/** Paladin: a hammer of holy light smashed down in front of you. */
export function hammerStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 32 + 12 * n,
    cooldown: Math.max(0.75, 1.3 - 0.12 * n),
    radius: 75 + 6 * n,
    /** How far in front of you it lands. */
    reach: 60,
    knockback: 25,
    /** Evolved: pillars of light also strike this many other enemies nearby. */
    pillars: evolved ? 2 : 0,
  };
}

/** Cleric: holy light strikes the nearest enemy and mends the most hurt ally. */
export function smiteStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 26 + 10 * n,
    cooldown: Math.max(0.55, 1 - 0.1 * n),
    range: 480,
    // Evolved: two more strikes, and twice the healing.
    targets: 1 + (evolved ? 2 : 0),
    heal: (2 + n) * (evolved ? 2 : 1),
    healRange: 500,
  };
}

/** Lyra: a meteor lands at the cursor after a short delay. */
export function meteorStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  // Evolved: a shower of smaller meteors follows the big one.
  return { damage: 60 + 25 * n, radius: 110 + 10 * n, delay: 0.6, cooldown: Math.max(4, 8 - 0.8 * n), maxRange: 650, shower: evolved ? 5 : 0, showerDamage: 0.6 };
}

/** Brakka: leaps toward the cursor (over walls) and smashes down on landing. */
export function leapStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: (40 + 15 * n) * (evolved ? 1.5 : 1),
    radius: (130 + 10 * n) * (evolved ? 1.25 : 1),
    range: 320 + 20 * n,
    cooldown: Math.max(3.5, 7 - 0.7 * n),
    knockback: 50,
    stun: evolved ? 1.2 : 0,
  };
}

/** Torvald: taunts nearby enemies to attack him while he takes less damage. */
export function warcryStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 15 + 8 * n,
    radius: 350 + 30 * n,
    taunt: 3,
    reduction: evolved ? 0.7 : 0.4 + 0.05 * n,
    duration: 3 + 0.25 * n,
    cooldown: Math.max(5, 10 - n),
    /** Share of max HP healed on cast. */
    heal: evolved ? 0.2 : 0,
  };
}

/** Kael: vanish, faster and ignored by enemies; when it wears off, erupt from the shadows. */
export function veilStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    duration: 2 + 0.25 * n,
    damage: (60 + 25 * n) * (evolved ? 1.5 : 1),
    radius: 150 + 10 * n,
    /** Extra movement speed while hidden. */
    speed: 0.4,
    cooldown: Math.max(5, 10 - n),
    /** Evolved: the eruption stuns. */
    stun: evolved ? 1 : 0,
  };
}

/** Ignis: a ring of fire around you that leaves the ground burning. */
export function flamenovaStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 35 + 15 * n,
    radius: 150 + 15 * n,
    burn: { damage: 6 + 3 * n, life: 3 },
    cooldown: Math.max(4, 8 - 0.8 * n),
    /** Evolved: two more novas follow. */
    echoes: evolved ? 2 : 0,
  };
}

/** Sylva: tumble toward your cursor and loose a fan of arrows. */
export function tumbleStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    distance: 230,
    arrows: (5 + n) * (evolved ? 2 : 1),
    damage: 18 + 7 * n,
    pierce: evolved ? 3 : 0,
    cooldown: Math.max(3, 6 - 0.6 * n),
  };
}

/** Oakenhart's E: spirit wolves answer the call and hunt alongside the pack for a while. */
export function wildcallStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    count: 3 + Math.floor(n / 2) + (evolved ? 2 : 0),
    damage: 16 + 6 * n,
    duration: (7 + n) * (evolved ? 1.5 : 1),
    cooldown: Math.max(13, 20 - 1.6 * n),
  };
}

/** Vex: a bomb at your cursor that detonates after a delay, stunning everything it hits. */
export function timebombStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    damage: 60 + 25 * n,
    radius: 130 + 10 * n,
    delay: 1.5,
    stun: 1 + 0.1 * n,
    cooldown: Math.max(4, 8 - 0.8 * n),
    maxRange: 600,
    /** Evolved: it goes off a second time. */
    repeats: evolved ? 2 : 1,
  };
}

/** Alchemist: a big pool of poison at your cursor that eats away at everything in it for a long time. */
export function toxicpoolStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    radius: (190 + 12 * n) * (evolved ? 1.3 : 1),
    /** Seconds it lasts. Evolved: much longer. */
    life: (8 + 0.5 * n) * (evolved ? 1.6 : 1),
    /** Damage to every enemy in the pool, every `tick` seconds. */
    damage: 4 + 2 * n,
    tick: 0.3,
    cooldown: Math.max(9, 14 - n),
    maxRange: 550,
  };
}

/** Paladin: hallowed ground under you that burns enemies and heals allies standing in it. */
export function consecrateStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    radius: (140 + 10 * n) * (evolved ? 1.5 : 1),
    life: 5 + 0.5 * n,
    /** Per tick (every 0.5s): damage to enemies, HP to allies. */
    damage: 10 + 5 * n,
    heal: 2 + 0.5 * n,
    cooldown: Math.max(7, 12 - n),
    /** Evolved: enemies inside when it's laid down are stunned. */
    stun: evolved ? 1 : 0,
  };
}

/** Cleric: a burst of light that heals and shields allies around you and sears enemies. */
export function prayerStats(level: number) {
  const n = Math.min(level, MAX_LEVEL) - 1;
  const evolved = level >= EVOLVED_LEVEL;
  return {
    radius: 260 + 20 * n,
    /** Share of max HP healed. */
    heal: 0.12 + 0.02 * n,
    /** Damage taken is cut by this much for `guard` seconds. */
    reduction: 0.3,
    guard: 3,
    damage: 45 + 18 * n,
    cooldown: Math.max(6, 12 - 1.2 * n),
    /** Evolved: fallen allies inside get back up with this much HP. */
    revive: evolved ? 0.3 : 0,
  };
}

/** XP is shared, so more players (more kills) need more XP per level; each level-up still upgrades everyone. */
export function xpToNext(level: number, playerCount: number): number {
  // Grows faster later on, so level-up pauses don't come every few seconds once the kill rate ramps up.
  const n = level - 1;
  return Math.round((5 + 4 * n + 0.1 * n * n) * (0.6 + 0.4 * playerCount));
}

interface UpgradeDef {
  name: string;
  kind: 'weapon' | 'passive';
  /** Weapons limited to one role. Missing means anyone can get it. */
  role?: Role;
  /** Hero abilities: the only hero who can get it (a CharacterId). Cast with E instead of firing on its own. */
  owner?: string;
  /** A regular weapon only this hero (a CharacterId) can be offered. */
  exclusive?: string;
  /** Text shown on the level-up card for reaching `level`. */
  describe: (level: number) => string;
  /** Weapons and hero abilities: the level 6 form unlocked at a Forge. */
  evolution?: { name: string; text: string };
  /** Weapons and hero abilities: the kind of damage they deal. */
  damage?: DamageType;
  /** Defaults to MAX_LEVEL. */
  maxLevel?: number;
}

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const pierceText = (pierce: number) => (pierce ? `, pierces ${pierce}` : '');

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  bolt: {
    name: 'Arcane Bolt',
    kind: 'weapon',
    damage: 'magic',
    role: 'ranged',
    describe: (level) => {
      const s = boltStats(level);
      return `Fires ${plural(s.count, 'bolt')} toward your cursor for ${s.damage} damage every ${s.cooldown.toFixed(2)}s${pierceText(s.pierce)}.`;
    },
    evolution: { name: 'Arcane Barrage', text: 'Every bolt hit explodes, damaging all enemies around it.' },
  },
  knives: {
    name: 'Throwing Knives',
    kind: 'weapon',
    damage: 'physical',
    role: 'ranged',
    describe: (level) => {
      const s = knivesStats(level);
      return `Throws a short-range fan of ${s.count} knives toward your cursor, ${s.damage} damage each${pierceText(s.pierce)}.`;
    },
    evolution: { name: 'Blade Fan', text: 'Every throw also sends a full ring of knives in all directions.' },
  },
  storm: {
    name: 'Lightning Storm',
    kind: 'weapon',
    damage: 'magic',
    role: 'ranged',
    describe: (level) => {
      const s = stormStats(level);
      const targets = s.strikes === 1 ? 'a nearby enemy' : `${s.strikes} nearby enemies`;
      return `Lightning strikes ${targets} for ${s.damage} damage every ${s.cooldown.toFixed(1)}s.`;
    },
    evolution: { name: 'Tempest', text: 'Twice as many strikes, longer reach and a much bigger blast.' },
  },
  hex: {
    name: 'Seeker Hex',
    kind: 'weapon',
    damage: 'magic',
    role: 'ranged',
    describe: (level) => {
      const s = hexStats(level);
      return `Launches ${plural(s.count, 'homing hex', 'homing hexes')} that hunt down enemies for ${s.damage} damage every ${s.cooldown.toFixed(1)}s.`;
    },
    evolution: { name: 'Hex Swarm', text: 'Three more hexes per volley, and every hex pierces an extra enemy.' },
  },
  cleave: {
    name: 'Cleave',
    kind: 'weapon',
    damage: 'physical',
    role: 'melee',
    describe: (level) => {
      const s = cleaveStats(level);
      return `Swings a wide arc toward your cursor for ${s.damage} damage every ${s.cooldown.toFixed(2)}s.`;
    },
    evolution: { name: 'Whirlwind', text: 'Every swing is a full spin around you with 30% more reach.' },
  },
  slam: {
    name: 'Ground Slam',
    kind: 'weapon',
    damage: 'physical',
    role: 'melee',
    describe: (level) => {
      const s = slamStats(level);
      return `Slams the ground for ${s.damage} damage around you and knocks enemies back every ${s.cooldown.toFixed(1)}s.`;
    },
    evolution: { name: 'Earthshatter', text: 'Enemies hit by the slam are stunned for 1.5 seconds.' },
  },
  venom: {
    name: 'Venom Trail',
    kind: 'weapon',
    damage: 'magic',
    role: 'melee',
    describe: (level) => {
      const s = venomStats(level);
      return `Leaves poison puddles as you move, dealing ${s.damage} damage every 0.5s to enemies in them.`;
    },
    evolution: { name: 'Plague', text: 'Puddles are 50% larger and last twice as long.' },
  },
  field: {
    name: 'Radiant Field',
    kind: 'weapon',
    damage: 'magic',
    describe: (level) => {
      const s = fieldStats(level);
      return `A searing aura around you deals ${s.damage} damage to every nearby enemy every ${s.interval}s.`;
    },
    evolution: { name: 'Solar Flare', text: 'The aura grows 40% larger and pulses twice as fast.' },
  },
  mines: {
    name: 'Mine Layer',
    kind: 'weapon',
    damage: 'physical',
    describe: (level) => {
      const s = minesStats(level);
      return `Drops a mine every ${s.cooldown.toFixed(1)}s that explodes for ${s.damage} damage when an enemy comes near.`;
    },
    evolution: { name: 'Minefield', text: 'Mines are dropped twice as often and explode 30% wider.' },
  },
  orbit: {
    name: 'Spirit Blades',
    kind: 'weapon',
    damage: 'physical',
    describe: (level) => {
      const s = orbitStats(level);
      return `${s.count} blades circle you, dealing ${s.damage} damage on contact.`;
    },
    evolution: { name: 'Spirit Vortex', text: '3 extra blades that spin faster in a wider circle.' },
  },
  shuriken: {
    name: 'Shuriken',
    kind: 'weapon',
    damage: 'physical',
    role: 'ranged',
    describe: (level) => {
      const s = shurikenStats(level);
      return `Every ${s.cooldown.toFixed(1)}s, throws a giant shuriken toward your cursor that returns to you, hitting everything both ways for ${s.damage} damage.`;
    },
    evolution: { name: 'Shuriken Storm', text: 'Throws a fan of three shurikens, each 50% bigger.' },
  },
  daggers: {
    name: 'Shadow Daggers',
    kind: 'weapon',
    damage: 'physical',
    role: 'melee',
    describe: (level) => {
      const s = daggersStats(level);
      return `Stabs the ${s.targets === 1 ? 'nearest enemy' : `${s.targets} nearest enemies`} within reach for ${s.damage} damage every ${s.cooldown.toFixed(2)}s.`;
    },
    evolution: { name: 'Eviscerate', text: 'Stabs every enemy within reach, 30% faster.' },
  },
  fireball: {
    name: 'Fireball',
    kind: 'weapon',
    damage: 'magic',
    role: 'ranged',
    describe: (level) => {
      const s = fireballStats(level);
      return `Hurls ${plural(s.count, 'fireball')} toward your cursor every ${s.cooldown.toFixed(1)}s, exploding for ${s.damage} damage around the impact.`;
    },
    evolution: { name: 'Pyroblast', text: '40% bigger explosions that leave the ground burning.' },
  },
  arrows: {
    name: 'Longbow',
    kind: 'weapon',
    damage: 'physical',
    role: 'ranged',
    describe: (level) => {
      const s = arrowsStats(level);
      return `Looses ${plural(s.count, 'long-range arrow')} toward your cursor for ${s.damage} damage every ${s.cooldown.toFixed(2)}s${pierceText(s.pierce)}.`;
    },
    evolution: { name: "Hunter's Volley", text: 'Three arrows per shot that pierce everything.' },
  },
  wolves: {
    name: 'Wolf Pack',
    kind: 'weapon',
    damage: 'physical',
    exclusive: 'druid',
    describe: (level) => {
      const s = wolvesStats(level);
      return `${plural(s.count, 'spirit wolf', 'spirit wolves')} hunt enemies near you, biting for ${s.damage} damage.`;
    },
    evolution: { name: 'Alpha Pack', text: 'Two more wolves, and every bite tears into the enemies around the target.' },
  },
  flask: {
    name: 'Flask Toss',
    kind: 'weapon',
    damage: 'magic',
    role: 'ranged',
    describe: (level) => {
      const s = flaskStats(level);
      return `Lobs ${plural(s.count, 'flask')} at nearby enemies every ${s.cooldown.toFixed(1)}s, splashing for ${s.damage} damage and leaving acid that burns for ${s.puddle.damage} every 0.5s.`;
    },
    evolution: { name: 'Volatile Concoction', text: 'One more flask per throw, and the acid spreads 50% wider.' },
  },
  hammer: {
    name: 'Judgment Hammer',
    kind: 'weapon',
    damage: 'magic',
    role: 'melee',
    describe: (level) => {
      const s = hammerStats(level);
      return `Smashes a hammer of light down in front of you for ${s.damage} damage every ${s.cooldown.toFixed(2)}s, pushing enemies back.`;
    },
    evolution: { name: 'Hammer of Dawn', text: 'Every smash also calls pillars of light down on two more enemies nearby.' },
  },
  smite: {
    name: 'Smite',
    kind: 'weapon',
    damage: 'magic',
    role: 'ranged',
    describe: (level) => {
      const s = smiteStats(level);
      return `Holy light strikes the nearest enemy for ${s.damage} damage every ${s.cooldown.toFixed(2)}s and heals the most hurt ally nearby for ${s.heal} HP.`;
    },
    evolution: { name: 'Holy Fire', text: 'Strikes two more enemies, and heals twice as much.' },
  },
  toxicpool: {
    name: 'Toxic Pool',
    kind: 'weapon',
    damage: 'magic',
    owner: 'alchemist',
    describe: (level) => {
      const s = toxicpoolStats(level);
      return `[E] Spill a wide pool of poison at your cursor for ${s.life.toFixed(1)}s. Every enemy in it takes ${s.damage} damage every ${s.tick}s. ${s.cooldown.toFixed(0)}s cooldown.`;
    },
    evolution: { name: 'Plague Bog', text: 'The pool is 30% wider and lasts 60% longer.' },
  },
  consecrate: {
    name: 'Consecration',
    kind: 'weapon',
    damage: 'magic',
    owner: 'paladin',
    describe: (level) => {
      const s = consecrateStats(level);
      return `[E] Hallow the ground around you for ${s.life}s: enemies in it take ${s.damage} damage and allies heal ${s.heal} HP every 0.5s. ${s.cooldown.toFixed(0)}s cooldown.`;
    },
    evolution: { name: 'Sanctified Ground', text: 'The hallowed ground is 50% wider, and enemies in it when it appears are stunned for 1 second.' },
  },
  prayer: {
    name: 'Prayer of Light',
    kind: 'weapon',
    damage: 'magic',
    owner: 'cleric',
    describe: (level) => {
      const s = prayerStats(level);
      return `[E] Heal allies around you for ${Math.round(s.heal * 100)}% of their max HP and cut their damage taken by 30% for ${s.guard}s. Enemies in the light take ${s.damage} damage. ${s.cooldown.toFixed(1)}s cooldown.`;
    },
    evolution: { name: 'Miracle', text: 'Fallen allies in the light get back up with 30% HP.' },
  },
  veil: {
    name: 'Shadow Veil',
    kind: 'weapon',
    damage: 'physical',
    owner: 'assassin',
    describe: (level) => {
      const s = veilStats(level);
      return `[E] Vanish for ${s.duration.toFixed(2)}s: enemies lose track of you and can't touch you, and you move 40% faster. Then erupt for ${s.damage} damage around you. ${s.cooldown.toFixed(0)}s cooldown.`;
    },
    evolution: { name: 'Shadow Dance', text: 'The eruption deals 50% more damage and stuns everything it hits for 1 second.' },
  },
  flamenova: {
    name: 'Flame Nova',
    kind: 'weapon',
    damage: 'magic',
    owner: 'pyro',
    describe: (level) => {
      const s = flamenovaStats(level);
      return `[E] A ring of fire bursts from you for ${s.damage} damage and leaves the ground burning for ${s.burn.life}s. ${s.cooldown.toFixed(1)}s cooldown.`;
    },
    evolution: { name: 'Supernova', text: 'Two more novas follow, a moment apart.' },
  },
  tumble: {
    name: 'Tumble',
    kind: 'weapon',
    damage: 'physical',
    owner: 'ranger',
    describe: (level) => {
      const s = tumbleStats(level);
      return `[E] Roll toward your cursor, then loose a fan of ${s.arrows} arrows at the nearest enemy for ${s.damage} damage each. ${s.cooldown.toFixed(1)}s cooldown.`;
    },
    evolution: { name: 'Hail of Arrows', text: 'Twice the arrows, and each pierces 3 enemies.' },
  },
  wildcall: {
    name: 'Call of the Wild',
    kind: 'weapon',
    damage: 'physical',
    owner: 'druid',
    describe: (level) => {
      const s = wildcallStats(level);
      return `[E] ${s.count} more spirit wolves join the hunt for ${s.duration}s, biting for ${s.damage} damage. ${s.cooldown.toFixed(1)}s cooldown.`;
    },
    evolution: { name: 'Alpha Howl', text: 'Two more wolves, and they stay half again as long.' },
  },
  timebomb: {
    name: 'Time Bomb',
    kind: 'weapon',
    damage: 'true',
    owner: 'chronobreaker',
    describe: (level) => {
      const s = timebombStats(level);
      return `[E] Plant a bomb at your cursor that goes off after ${s.delay}s for ${s.damage} damage, stunning enemies for ${s.stun.toFixed(1)}s. ${s.cooldown.toFixed(1)}s cooldown.`;
    },
    evolution: { name: 'Paradox', text: 'The bomb goes off a second time, a moment later.' },
  },
  meteor: {
    name: 'Meteor',
    kind: 'weapon',
    damage: 'magic',
    owner: 'mage',
    describe: (level) => {
      const s = meteorStats(level);
      return `[E] Calls a meteor down at your cursor for ${s.damage} damage in a wide area. ${s.cooldown.toFixed(1)}s cooldown.`;
    },
    evolution: { name: 'Starfall', text: 'Five smaller meteors rain down around the first one.' },
  },
  leap: {
    name: 'Leap',
    kind: 'weapon',
    damage: 'physical',
    owner: 'bruiser',
    describe: (level) => {
      const s = leapStats(level);
      return `[E] Leaps toward your cursor, over walls, and smashes down for ${s.damage} damage. ${s.cooldown.toFixed(1)}s cooldown.`;
    },
    evolution: { name: 'Cataclysm', text: '50% more damage, a 25% bigger landing, and everything hit is stunned for 1.2 seconds.' },
  },
  warcry: {
    name: 'War Cry',
    kind: 'weapon',
    damage: 'physical',
    owner: 'tank',
    describe: (level) => {
      const s = warcryStats(level);
      return `[E] Taunts nearby enemies to attack you and takes ${Math.round(s.reduction * 100)}% less damage for ${s.duration.toFixed(1)}s. ${s.cooldown.toFixed(0)}s cooldown.`;
    },
    evolution: { name: 'Unbreakable', text: 'Also heals you for 20% of your max HP, and you take 70% less damage while it lasts.' },
  },
  might: { name: 'Might', kind: 'passive', describe: () => '+10% damage.' },
  haste: { name: 'Haste', kind: 'passive', describe: () => '-8% weapon cooldowns.' },
  swift: { name: 'Swiftness', kind: 'passive', describe: () => '+8% movement speed.' },
  vitality: { name: 'Vitality', kind: 'passive', describe: () => '+20 max HP.' },
  magnet: { name: 'Magnet', kind: 'passive', describe: () => '+30% pickup radius.' },
  regen: { name: 'Regeneration', kind: 'passive', describe: () => '+0.5 HP per second.' },
  armor: { name: 'Armor', kind: 'passive', describe: () => '-6% damage taken.' },
  crit: { name: 'Crit', kind: 'passive', describe: () => `+6% chance for physical damage to crit for ${CRIT_MULTIPLIER}x.` },
  lifesteal: { name: 'Vampirism', kind: 'passive', describe: (l) => `Heal for 0.5% of all damage you deal, up to ${l}% of your max HP per second.` },
  area: { name: 'Expanse', kind: 'passive', describe: () => '+10% size of areas, auras, blasts and orbits.' },
  duration: { name: 'Duration', kind: 'passive', describe: () => '+12% duration of stuns, taunts, buffs and puddles.' },
  multishot: { name: 'Multishot', kind: 'passive', describe: () => '+1 projectile, blade or strike for your weapons.', maxLevel: 3 },
  evasion: { name: 'Evasion', kind: 'passive', describe: () => '+3% chance to dodge bullets, bombs and charges entirely.' },
  wisdom: { name: 'Wisdom', kind: 'passive', describe: () => '+10% XP from gems you pick up.' },
  arcana: { name: 'Arcana', kind: 'passive', describe: () => `+${Math.round(ARCANA_PER_LEVEL * 100)}% magic damage.` },
};

export const ALL_UPGRADES = Object.keys(UPGRADES) as UpgradeId[];

export function upgradeMax(id: UpgradeId): number {
  return UPGRADES[id].maxLevel ?? MAX_LEVEL;
}

/** The kind of damage a weapon or ability deals. */
export function damageType(id: WeaponId): DamageType {
  return UPGRADES[id].damage ?? 'physical';
}
