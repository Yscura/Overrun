import {
  ALL_UPGRADES,
  MAX_LEVEL,
  PASSIVE_SLOTS,
  UPGRADES,
  WEAPON_SLOTS,
  fieldStats,
  magnetRadius,
  orbitStats,
  upgradeMax,
  type AbilityId,
  type Role,
  type UpgradeId,
  type Upgrades,
  type WeaponId,
} from './upgrades';

export type CharacterId = 'assassin' | 'mage' | 'bruiser' | 'tank';
export type UltimateId = 'lotus' | 'chrono' | 'rage' | 'rally';

export interface UltimateDef {
  id: UltimateId;
  name: string;
  text: string;
  cooldown: number;
}

export interface CharacterDef {
  name: string;
  title: string;
  /** Decides which weapons the character can be offered. */
  role: Role;
  maxHp: number;
  speed: number;
  /** Fraction of incoming damage ignored. */
  armor: number;
  /** HP per second. */
  regen: number;
  damageMult: number;
  /** Seconds between dodges. */
  dodgeCooldown: number;
  startWeapon: WeaponId;
  /** Cast with E; levels up like a weapon. */
  ability: AbilityId;
  /** Cast with R; a big effect on a long cooldown. */
  ultimate: UltimateDef;
  /** One-line perk shown on the character select screen. */
  trait: string;
  /** Dodges through thick walls too (everyone's dodge clears thin ones). */
  phaseWalls?: boolean;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  assassin: {
    name: 'Kael',
    title: 'the Assassin',
    role: 'ranged',
    maxHp: 85,
    speed: 245,
    armor: 0,
    regen: 0,
    damageMult: 1,
    dodgeCooldown: 1.8,
    startWeapon: 'knives',
    ability: 'shuriken',
    ultimate: { id: 'lotus', name: 'Death Lotus', text: 'Spin for 3s, throwing rings of knives in every direction.', cooldown: 50 },
    trait: 'Fastest, dodges often, and shadowsteps through any wall',
    phaseWalls: true,
  },
  mage: {
    name: 'Lyra',
    title: 'the Mage',
    role: 'ranged',
    maxHp: 80,
    speed: 215,
    armor: 0,
    regen: 0,
    damageMult: 1.15,
    dodgeCooldown: 3,
    startWeapon: 'bolt',
    ability: 'meteor',
    ultimate: { id: 'chrono', name: 'Chrono Freeze', text: 'Stun every enemy nearby for 4s and erase their bullets and bombs.', cooldown: 70 },
    trait: '+15% damage',
  },
  bruiser: {
    name: 'Brakka',
    title: 'the Bruiser',
    role: 'melee',
    maxHp: 130,
    speed: 215,
    armor: 0.1,
    regen: 1,
    damageMult: 1,
    dodgeCooldown: 3,
    startWeapon: 'cleave',
    ability: 'leap',
    ultimate: { id: 'rage', name: 'Bloodrage', text: 'For 8s: +60% damage, 30% faster attacks and heavy regeneration.', cooldown: 60 },
    trait: 'Regenerates 1 HP per second',
  },
  tank: {
    name: 'Torvald',
    title: 'the Tank',
    role: 'melee',
    maxHp: 170,
    speed: 195,
    armor: 0.25,
    regen: 0,
    damageMult: 1,
    dodgeCooldown: 3.5,
    startWeapon: 'slam',
    ability: 'warcry',
    ultimate: { id: 'rally', name: 'Rally', text: 'Heal nearby allies for 40%, revive the downed, and halve their damage taken for 6s.', cooldown: 90 },
    trait: 'Takes 25% less damage',
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
export const DEFAULT_CHARACTER: CharacterId = 'mage';

export function isCharacterId(id: unknown): id is CharacterId {
  return typeof id === 'string' && id in CHARACTERS;
}

/** Upgrades this character can be offered: its role's weapons, shared weapons, its own ability and all passives. */
export function upgradesFor(character: CharacterId): UpgradeId[] {
  const role = CHARACTERS[character].role;
  return ALL_UPGRADES.filter((id) => {
    const def = UPGRADES[id];
    return (!def.role || def.role === role) && (!def.owner || def.owner === character);
  });
}

/** Ordinary weapons (not the E ability) and passives the player owns, in the order they got them. */
export function ownedWeapons(upgrades: Upgrades): UpgradeId[] {
  return (Object.keys(upgrades) as UpgradeId[]).filter((id) => (upgrades[id] ?? 0) > 0 && UPGRADES[id].kind === 'weapon' && !UPGRADES[id].owner);
}

export function ownedPassives(upgrades: Upgrades): UpgradeId[] {
  return (Object.keys(upgrades) as UpgradeId[]).filter((id) => (upgrades[id] ?? 0) > 0 && UPGRADES[id].kind === 'passive');
}

/**
 * What a level-up can offer right now: anything owned that isn't maxed, plus new weapons and passives
 * while there are free slots (WEAPON_SLOTS / PASSIVE_SLOTS).
 */
export function offerableUpgrades(upgrades: Upgrades, character: CharacterId): UpgradeId[] {
  const weaponRoom = ownedWeapons(upgrades).length < WEAPON_SLOTS;
  const passiveRoom = ownedPassives(upgrades).length < PASSIVE_SLOTS;
  return upgradesFor(character).filter((id) => {
    const level = upgrades[id] ?? 0;
    if (level >= upgradeMax(id)) return false;
    if (level > 0 || UPGRADES[id].owner) return true;
    return UPGRADES[id].kind === 'weapon' ? weaponRoom : passiveRoom;
  });
}

/** Roughly how many level-up picks it takes to fill every slot and max everything, not counting the starting levels. */
export const UPGRADE_PICKS = (WEAPON_SLOTS + 1 + PASSIVE_SLOTS) * MAX_LEVEL - 2; // +1 for the E ability; weapon and ability start at 1.

/** A player's stats: their character's base stats with passive upgrades applied. */
export function playerStats(upgrades: Upgrades, character: CharacterId) {
  const c = CHARACTERS[character];
  const lv = (id: UpgradeId) => upgrades[id] ?? 0;
  return {
    damageMult: c.damageMult * (1 + 0.1 * lv('might')),
    cooldownMult: 1 - 0.08 * lv('haste'),
    speed: c.speed * (1 + 0.08 * lv('swift')),
    maxHp: c.maxHp + 20 * lv('vitality'),
    magnet: magnetRadius(upgrades),
    regen: c.regen + 0.5 * lv('regen'),
    armor: Math.min(0.6, c.armor + 0.06 * lv('armor')),
    dodgeCooldown: c.dodgeCooldown,
    critChance: 0.06 * lv('crit'),
    lifesteal: 0.005 * lv('lifesteal'),
    area: 1 + 0.1 * lv('area'),
    duration: 1 + 0.12 * lv('duration'),
    projectiles: lv('multishot'),
    evasion: 0.03 * lv('evasion'),
    xpMult: 1 + 0.1 * lv('wisdom'),
  };
}

export type PlayerStats = ReturnType<typeof playerStats>;

/** Spirit Blades as they spin: shared so the client draws them exactly where the server hits with them. */
export function orbitLayout(upgrades: Upgrades, character: CharacterId) {
  const level = upgrades.orbit ?? 0;
  if (!level) return null;
  const s = orbitStats(level);
  const stats = playerStats(upgrades, character);
  return { ...s, count: s.count + stats.projectiles, radius: s.radius * stats.area };
}

/** Radiant Field's radius, or 0 without one. */
export function fieldRadius(upgrades: Upgrades, character: CharacterId): number {
  const level = upgrades.field ?? 0;
  return level ? fieldStats(level).radius * playerStats(upgrades, character).area : 0;
}
