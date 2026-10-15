import { PRESTIGE_BONUS, type PrestigeId, type PrestigeRanks } from './prestige';
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
  type DamageType,
  ATTUNEMENT,
  ARCANA_PER_LEVEL,
  damageType,
  type Role,
  type UpgradeId,
  type Upgrades,
  type WeaponId,
} from './upgrades';

export type CharacterId = 'assassin' | 'mage' | 'bruiser' | 'tank' | 'pyro' | 'ranger' | 'druid' | 'chronobreaker';
export type UltimateId = 'shadowstrike' | 'chrono' | 'rage' | 'rally' | 'inferno' | 'arrowstorm' | 'wildcall' | 'rewind';

export interface UltimateDef {
  id: UltimateId;
  name: string;
  text: string;
  cooldown: number;
  /** The kind of damage it deals, if any. */
  damage?: DamageType;
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
  /** Multiplier on the size of areas, auras, blasts and orbits. Defaults to 1. */
  areaMult?: number;
  /** Gold to unlock this hero (per player). Missing means available from the start. */
  unlockCost?: number;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  assassin: {
    name: 'Kata',
    title: 'the Assassin',
    role: 'melee',
    maxHp: 70,
    speed: 250,
    armor: 0,
    regen: 0,
    damageMult: 1.4,
    areaMult: 0.8,
    dodgeCooldown: 1.6,
    startWeapon: 'daggers',
    ability: 'veil',
    ultimate: { id: 'shadowstrike', damage: 'physical', name: 'Shadow Strike', text: 'Blink between up to 7 enemies nearby, striking each one hard. Untouchable while it lasts.', cooldown: 45 },
    trait: '+40% damage but 20% smaller areas. Fastest, and shadowsteps through any wall',
    phaseWalls: true,
  },
  mage: {
    name: 'Eldrin',
    title: 'the Mage',
    role: 'ranged',
    maxHp: 95,
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
    name: 'Thorik',
    title: 'the Barbarian',
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
  // Unlockable heroes: a little stronger than the starting four.
  pyro: {
    name: 'Ignis',
    title: 'the Pyromancer',
    role: 'ranged',
    maxHp: 70,
    speed: 215,
    armor: 0,
    regen: 0,
    damageMult: 1.25,
    areaMult: 1.3,
    dodgeCooldown: 3,
    startWeapon: 'fireball',
    ability: 'flamenova',
    ultimate: { id: 'inferno', damage: 'magic', name: 'Inferno', text: 'For 3s, fireballs rain down all around you.', cooldown: 60 },
    trait: '+25% damage and 30% bigger areas, but fragile',
    unlockCost: 500,
  },
  ranger: {
    name: 'Gale',
    title: 'the Ranger',
    role: 'ranged',
    maxHp: 90,
    speed: 245,
    armor: 0,
    regen: 0,
    damageMult: 1.15,
    dodgeCooldown: 1.4,
    startWeapon: 'arrows',
    ability: 'tumble',
    ultimate: { id: 'arrowstorm', damage: 'physical', name: 'Arrow Storm', text: 'For 4s, fire a torrent of piercing arrows toward your cursor.', cooldown: 50 },
    trait: '+15% damage, fast, and dodges more often than anyone',
    unlockCost: 500,
  },
  druid: {
    name: 'Oakenhart',
    title: 'the Druid',
    role: 'melee',
    maxHp: 200,
    speed: 205,
    armor: 0.1,
    regen: 1.5,
    damageMult: 1,
    dodgeCooldown: 3.5,
    startWeapon: 'wolves',
    ability: 'treant',
    ultimate: { id: 'wildcall', damage: 'physical', name: 'Call of the Wild', text: 'Six more spirit wolves join the hunt for 15s.', cooldown: 70 },
    trait: 'Toughest hero: regenerates and fights with a wolf pack',
    unlockCost: 500,
  },
  chronobreaker: {
    name: 'Helix',
    title: 'the Chronomancer',
    role: 'melee',
    maxHp: 120,
    speed: 225,
    armor: 0.05,
    regen: 0,
    damageMult: 1.25,
    dodgeCooldown: 2.5,
    startWeapon: 'orbit',
    ability: 'timebomb',
    ultimate: {
      id: 'rewind', damage: 'true',
      name: 'Chronobreak',
      text: 'Rewind to where you were 4s ago, restore the most HP you had since, and explode on arrival.',
      cooldown: 60,
    },
    trait: '+25% damage. Chronobreak turns back time',
    unlockCost: 500,
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

/** Chronobreak takes you back to where you were this many seconds ago. */
export const REWIND_SECONDS = 4;
export const DEFAULT_CHARACTER: CharacterId = 'mage';

export function isCharacterId(id: unknown): id is CharacterId {
  return typeof id === 'string' && id in CHARACTERS;
}

/** Upgrades this character can be offered: its role's weapons, shared weapons, its own ability and all passives. */
export function upgradesFor(character: CharacterId): UpgradeId[] {
  const role = CHARACTERS[character].role;
  return ALL_UPGRADES.filter((id) => {
    const def = UPGRADES[id];
    return (!def.role || def.role === role) && (!def.owner || def.owner === character) && (!def.exclusive || def.exclusive === character);
  });
}

/** Can this player pick the hero? Starting heroes always; the rest once unlocked with prestige. */
export function heroAvailable(character: CharacterId, unlocked: readonly string[]): boolean {
  return CHARACTERS[character].unlockCost === undefined || unlocked.includes(character);
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

/** A player's stats: their character's base stats with passive upgrades and prestige ranks applied. */
export function playerStats(upgrades: Upgrades, character: CharacterId, prestige: PrestigeRanks = {}) {
  const c = CHARACTERS[character];
  const lv = (id: UpgradeId) => upgrades[id] ?? 0;
  const rank = (id: PrestigeId) => (prestige[id] ?? 0) * PRESTIGE_BONUS[id];
  return {
    damageMult: c.damageMult * (1 + 0.1 * lv('might')) * (1 + rank('power')),
    cooldownMult: (1 - 0.08 * lv('haste')) / (1 + rank('fury')),
    speed: c.speed * (1 + 0.08 * lv('swift')) * (1 + rank('stride')),
    maxHp: Math.round((c.maxHp + 20 * lv('vitality')) * (1 + rank('fortitude'))),
    magnet: magnetRadius(upgrades),
    regen: c.regen + 0.5 * lv('regen'),
    armor: Math.min(0.6, c.armor + 0.06 * lv('armor') + rank('resolve')),
    dodgeCooldown: c.dodgeCooldown,
    critChance: 0.06 * lv('crit'),
    lifesteal: 0.005 * lv('lifesteal'),
    /** Most Vampirism can heal, as a share of max HP per second. */
    lifestealCap: 0.01 * lv('lifesteal'),
    area: (1 + 0.1 * lv('area')) * (c.areaMult ?? 1),
    duration: 1 + 0.12 * lv('duration'),
    projectiles: lv('multishot'),
    evasion: 0.03 * lv('evasion'),
    xpMult: 1 + 0.1 * lv('wisdom'),
    /** Extra damage per damage type: attunement (more weapons of a type) and Arcana for magic. */
    typeDamage: typeDamage(upgrades),
  };
}

/** How many of a player's weapons and abilities deal each damage type. */
export function typeCounts(upgrades: Upgrades): Record<DamageType, number> {
  const counts: Record<DamageType, number> = { physical: 0, magic: 0, true: 0 };
  for (const id of Object.keys(upgrades) as UpgradeId[]) {
    if ((upgrades[id] ?? 0) > 0 && UPGRADES[id].kind === 'weapon') counts[damageType(id as WeaponId)]++;
  }
  return counts;
}

function typeDamage(upgrades: Upgrades): Record<DamageType, number> {
  const counts = typeCounts(upgrades);
  const attune = (t: DamageType) => 1 + ATTUNEMENT[t] * Math.max(0, counts[t] - 1);
  return {
    physical: attune('physical'),
    magic: attune('magic') * (1 + ARCANA_PER_LEVEL * (upgrades.arcana ?? 0)),
    true: attune('true'),
  };
}

/** A hero's own damage type: what their starting weapon deals. */
export function heroDamageType(character: CharacterId): DamageType {
  return damageType(CHARACTERS[character].startWeapon);
}

/**
 * How likely an upgrade is to be offered to this hero, relative to 1: weapons of the hero's own damage type come up
 * more often, and so does the passive that boosts it (Crit for physical, Arcana for magic).
 */
export const OFFER_WEIGHT = { ownType: 3, ownPassive: 2, otherPassive: 0.5 };
export function offerWeight(id: UpgradeId, character: CharacterId): number {
  const own = heroDamageType(character);
  const def = UPGRADES[id];
  if (def.kind === 'weapon') return !def.owner && damageType(id as WeaponId) === own ? OFFER_WEIGHT.ownType : 1;
  if (id === 'crit') return own === 'physical' ? OFFER_WEIGHT.ownPassive : OFFER_WEIGHT.otherPassive;
  if (id === 'arcana') return own === 'magic' ? OFFER_WEIGHT.ownPassive : OFFER_WEIGHT.otherPassive;
  return 1;
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
