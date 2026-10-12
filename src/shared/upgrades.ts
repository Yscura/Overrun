import { PICKUP_BASE_RADIUS } from './constants';

export type Role = 'ranged' | 'melee';
export type WeaponId = 'bolt' | 'knives' | 'storm' | 'cleave' | 'slam' | 'orbit';
export type PassiveId = 'might' | 'haste' | 'swift' | 'vitality' | 'magnet' | 'regen' | 'armor';
export type UpgradeId = WeaponId | PassiveId;
/** Upgrade id -> level. Missing means not owned. */
export type Upgrades = Partial<Record<UpgradeId, number>>;

export const MAX_LEVEL = 5;

// Weapon stats per level. Tweak these to balance the game.

export function boltStats(level: number) {
  return {
    damage: 12 + 4 * (level - 1),
    cooldown: Math.max(0.35, 0.7 - 0.06 * (level - 1)),
    count: 1 + Math.floor((level - 1) / 2),
    pierce: Math.floor((level - 1) / 3),
    speed: 450,
    range: 650,
    spread: 0.18,
  };
}

export function knivesStats(level: number) {
  return {
    damage: 7 + 2 * (level - 1),
    cooldown: Math.max(0.35, 0.6 - 0.05 * (level - 1)),
    count: 3 + Math.floor((level - 1) / 2),
    pierce: level >= 4 ? 1 : 0,
    speed: 650,
    range: 320,
    spread: 0.12,
  };
}

export function stormStats(level: number) {
  return {
    damage: 22 + 9 * (level - 1),
    cooldown: Math.max(0.9, 1.8 - 0.2 * (level - 1)),
    strikes: 1 + Math.floor(level / 2),
    range: 420,
    /** Enemies this close to a strike take its damage too. */
    splash: 45,
  };
}

export function cleaveStats(level: number) {
  return {
    damage: 22 + 8 * (level - 1),
    cooldown: Math.max(0.55, 1.0 - 0.1 * (level - 1)),
    range: 95 + 10 * (level - 1),
    /** Width of the swing in radians. */
    arc: 1.9 + 0.15 * (level - 1),
    knockback: 30,
  };
}

export function slamStats(level: number) {
  return {
    damage: 20 + 10 * (level - 1),
    cooldown: Math.max(1.2, 2.5 - 0.25 * (level - 1)),
    radius: 110 + 15 * (level - 1),
    knockback: 40,
  };
}

export function orbitStats(level: number) {
  return {
    count: level + 1,
    damage: 8 + 3 * (level - 1),
    radius: 70 + 8 * (level - 1),
    /** Radians per second. */
    spin: 3,
    /** How often the same enemy can be hit by blades. */
    hitCooldown: 0.5,
    bladeRadius: 12,
  };
}

/** Pickup radius, which every character shares. */
export function magnetRadius(upgrades: Upgrades): number {
  return PICKUP_BASE_RADIUS * (1 + 0.3 * (upgrades.magnet ?? 0));
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
  /** Text shown on the level-up card for reaching `level`. */
  describe: (level: number) => string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pierceText = (pierce: number) => (pierce ? `, pierces ${pierce}` : '');

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  bolt: {
    name: 'Arcane Bolt',
    kind: 'weapon',
    role: 'ranged',
    describe: (level) => {
      const s = boltStats(level);
      return `Fires ${plural(s.count, 'bolt')} toward your cursor for ${s.damage} damage every ${s.cooldown.toFixed(2)}s${pierceText(s.pierce)}.`;
    },
  },
  knives: {
    name: 'Throwing Knives',
    kind: 'weapon',
    role: 'ranged',
    describe: (level) => {
      const s = knivesStats(level);
      return `Throws a short-range fan of ${s.count} knives toward your cursor, ${s.damage} damage each${pierceText(s.pierce)}.`;
    },
  },
  storm: {
    name: 'Lightning Storm',
    kind: 'weapon',
    role: 'ranged',
    describe: (level) => {
      const s = stormStats(level);
      const targets = s.strikes === 1 ? 'a nearby enemy' : `${s.strikes} nearby enemies`;
      return `Lightning strikes ${targets} for ${s.damage} damage every ${s.cooldown.toFixed(1)}s.`;
    },
  },
  cleave: {
    name: 'Cleave',
    kind: 'weapon',
    role: 'melee',
    describe: (level) => {
      const s = cleaveStats(level);
      return `Swings a wide arc toward your cursor for ${s.damage} damage every ${s.cooldown.toFixed(2)}s.`;
    },
  },
  slam: {
    name: 'Ground Slam',
    kind: 'weapon',
    role: 'melee',
    describe: (level) => {
      const s = slamStats(level);
      return `Slams the ground for ${s.damage} damage around you and knocks enemies back every ${s.cooldown.toFixed(1)}s.`;
    },
  },
  orbit: {
    name: 'Spirit Blades',
    kind: 'weapon',
    describe: (level) => {
      const s = orbitStats(level);
      return `${s.count} blades circle you, dealing ${s.damage} damage on contact.`;
    },
  },
  might: { name: 'Might', kind: 'passive', describe: () => '+10% damage.' },
  haste: { name: 'Haste', kind: 'passive', describe: () => '-8% weapon cooldowns.' },
  swift: { name: 'Swiftness', kind: 'passive', describe: () => '+8% movement speed.' },
  vitality: { name: 'Vitality', kind: 'passive', describe: () => '+20 max HP.' },
  magnet: { name: 'Magnet', kind: 'passive', describe: () => '+30% pickup radius.' },
  regen: { name: 'Regeneration', kind: 'passive', describe: () => '+0.5 HP per second.' },
  armor: { name: 'Plating', kind: 'passive', describe: () => '-6% damage taken.' },
};

export const ALL_UPGRADES = Object.keys(UPGRADES) as UpgradeId[];
