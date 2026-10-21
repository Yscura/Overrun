import { ARTIFACTS, OMNIVAMP_CAP, growthBonus, type ArtifactEffects, type ArtifactGrowth, type ArtifactId } from './artifacts';
import { PRESTIGE_BONUS, type PrestigeId, type PrestigeRanks } from './prestige';
import {
  ALL_UPGRADES,
  MAX_LEVEL,
  PASSIVE_SLOTS,
  UPGRADES,
  WEAPON_SLOTS,
  fieldStats,
  frostStats,
  magnetRadius,
  orbitStats,
  embersStats,
  upgradeMax,
  type AbilityId,
  type DamageType,
  ATTUNEMENT,
  ARCANA_PER_LEVEL,
  DEVOTION_PER_LEVEL,
  damageType,
  type Role,
  type UpgradeId,
  type Upgrades,
  type WeaponId,
} from './upgrades';

export type CharacterId = 'assassin' | 'mage' | 'bruiser' | 'tank' | 'pyro' | 'ranger' | 'druid' | 'chronobreaker' | 'alchemist' | 'paladin' | 'cleric' | 'dragonmancer' | 'bard';
export type UltimateId =
  | 'shadowstrike'
  | 'chrono'
  | 'rage'
  | 'retribution'
  | 'inferno'
  | 'arrowstorm'
  | 'bear'
  | 'rewind'
  | 'elixir'
  | 'wrath'
  | 'intervention'
  | 'dragonform'
  | 'ballad';

/** The id an ultimate's damage is tracked under (next to weapon and ability ids, which it can't clash with). */
export function ultimateSource(id: UltimateId): string {
  return `ult:${id}`;
}

export interface UltimateDef {
  id: UltimateId;
  name: string;
  text: string;
  cooldown: number;
  /** The kind of damage it deals, if any. */
  damage?: DamageType;
}

/** Whose cries of pain a hero has (sfx/effects): see SAMPLES in src/client/samples.ts. */
export type Voice = 'male' | 'deep' | 'female' | 'dwarf';

export interface CharacterDef {
  name: string;
  title: string;
  voice: Voice;
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
  /** Can't be bought: only earned (the profile flag says how). Shown as "Locked: ???" until then. */
  secret?: 'dragonmancer';
}

/**
 * Dragon Form: for `duration` seconds the Dragonmancer is a dragon, with these multipliers (`reduction`: damage
 * taken cut by that share), and his E breathes fire (see FIREBREATH) on a `breathCooldown`.
 */
export const DRAGON_FORM = { duration: 25, damage: 1.5, maxHp: 1.4, reduction: 0.25, speed: 1.15, area: 1.2, breathCooldown: 2.4 };
/**
 * The dragon's body turns toward where he walks (`turn` radians a second) and his head toward the cursor, at most
 * `headReach` off the body's line: aiming further round swings the body with it. His mouth (where the fire breath
 * comes from) is `neck` along the body, then `reach` along the head, in world units. Keep these in step with how the
 * client draws him (see the renderer's updateDragon).
 */
export const DRAGON_FORM_TURN = { turn: 5, headReach: Math.PI / 2, neck: 29, reach: 61 };

/** Turns a dragon's body (`body`, radians) for an aim (`aim`): no more than DRAGON_FORM_TURN.headReach off it. */
export function dragonBody(body: number, aim: number): number {
  const rel = Math.atan2(Math.sin(aim - body), Math.cos(aim - body));
  return Math.abs(rel) <= DRAGON_FORM_TURN.headReach ? body : aim - Math.sign(rel) * DRAGON_FORM_TURN.headReach;
}
/**
 * Ballad of Heroes (the Bard's ultimate): for `duration` seconds, he and every ally within `radius` of him get
 * `damage` more damage, `attackSpeed` faster attacks, `speed` more speed and heal `regen` of their max HP a second.
 */
export const BALLAD = { duration: 15, radius: 420, damage: 0.2, attackSpeed: 0.4, speed: 0.15, regen: 0.02 };

/** His fire breath: a cone (`half` its half-angle) burning every `tick` seconds for `duration`, following his aim. */
export const FIREBREATH = { duration: 1.3, tick: 0.12, range: 420, half: 0.5, damage: 26, perLevel: 9 };

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  assassin: {
    name: 'Kata',
    title: 'the Assassin',
    voice: 'female',
    role: 'melee',
    maxHp: 120,
    speed: 250,
    armor: 0.1,
    regen: 0,
    damageMult: 1.5,
    areaMult: 0.9,
    dodgeCooldown: 1.6,
    startWeapon: 'daggers',
    ability: 'veil',
    ultimate: { id: 'shadowstrike', damage: 'physical', name: 'Shadow Strike', text: 'Blink between up to 7 enemies nearby (one more for every 10% crit chance). Cast from Shadow Veil, they hit even harder.', cooldown: 30 },
    trait: 'Nimble and shadowsteps through any wall',
    phaseWalls: true,
  },
  mage: {
    name: 'Eldrin',
    title: 'the Mage',
    voice: 'male',
    role: 'ranged',
    maxHp: 100,
    speed: 215,
    armor: 0,
    regen: 0,
    damageMult: 1.00,
    dodgeCooldown: 3,
    startWeapon: 'bolt',
    ability: 'meteor',
    ultimate: { id: 'chrono', name: 'Chrono Freeze', text: 'Stun every enemy nearby for 4s and erase their bullets and bombs.', cooldown: 70 },
    trait: 'Uses the arcane to control the battlefield',
  },
  bruiser: {
    name: 'Thorik',
    title: 'the Barbarian',
    voice: 'deep',
    role: 'melee',
    maxHp: 150,
    speed: 215,
    armor: 0.15,
    regen: 3,
    damageMult: 1.1,
    dodgeCooldown: 3,
    startWeapon: 'cleave',
    ability: 'leap',
    ultimate: {
      id: 'rage',
      name: 'Bloodrage',
      text: "For 8s: +60% damage, 30% faster attacks, heavy regeneration and lifesteal, and you can't drop below 1 HP.",
      cooldown: 60,
    },
    trait: 'Fights with the rage of a thousand men',
  },
  tank: {
    name: 'Torvald',
    title: 'the Tank',
    voice: 'dwarf',
    role: 'melee',
    maxHp: 230,
    speed: 195,
    armor: 0.3,
    regen: 2,
    damageMult: 1.1,
    dodgeCooldown: 3.5,
    startWeapon: 'slam',
    ability: 'warcry',
    ultimate: {
      id: 'retribution',
      name: 'Retribution',
      text: 'For 8s, take 40% less damage and draw nearby enemies to you. Whatever hurts you takes 2.5x that damage back (and more from your Might).',
      cooldown: 45,
    },
    trait: 'Stands resolute through the toughest of battles',
  },
  // Unlockable heroes: a little stronger than the starting four.
  pyro: {
    name: 'Ignis',
    title: 'the Pyromancer',
    voice: 'female',
    role: 'ranged',
    maxHp: 100,
    speed: 215,
    armor: 0,
    regen: 0,
    damageMult: 1.05,
    areaMult: 1.3,
    dodgeCooldown: 3,
    startWeapon: 'fireball',
    ability: 'flamenova',
    ultimate: { id: 'inferno', damage: 'magic', name: 'Inferno', text: 'For 3s, fireballs rain down all around you.', cooldown: 60 },
    trait: 'Wields the destructive power of fire and flame',
    unlockCost: 500,
  },
  ranger: {
    name: 'Gale',
    title: 'the Ranger',
    voice: 'male',
    role: 'ranged',
    maxHp: 105,
    speed: 245,
    armor: 0,
    regen: 0,
    damageMult: 1.2,
    dodgeCooldown: 1.4,
    startWeapon: 'arrows',
    ability: 'tumble',
    ultimate: { id: 'arrowstorm', damage: 'physical', name: 'Arrow Storm', text: 'For 4s, fire a torrent of piercing arrows toward your cursor.', cooldown: 50 },
    trait: 'Runs like the wind and aims like a hawk',
    unlockCost: 500,
  },
  druid: {
    name: 'Oakenhart',
    title: 'the Druid',
    voice: 'female',
    role: 'melee',
    maxHp: 200,
    speed: 205,
    armor: 0.1,
    regen: 2,
    damageMult: 1.2,
    dodgeCooldown: 3.5,
    startWeapon: 'wolves',
    ability: 'wildcall',
    ultimate: {
      id: 'bear',
      damage: 'physical',
      name: 'Spirit Bear',
      text: 'A great spirit bear fights beside you for 18s: slower than the wolves, but every swipe mauls its target and everything around it. Press R again to send it at the enemy nearest your cursor.',
      cooldown: 70,
    },
    trait: 'Uses the power of nature to summon wild beasts',
    unlockCost: 1000,
  },
  chronobreaker: {
    name: 'Helix',
    title: 'the Chronomancer',
    voice: 'male',
    role: 'melee',
    maxHp: 140,
    speed: 225,
    armor: 0.05,
    regen: 0,
    damageMult: 1.3,
    dodgeCooldown: 2.5,
    startWeapon: 'orbit',
    ability: 'timebomb',
    ultimate: {
      id: 'rewind', damage: 'true',
      name: 'Chronobreak',
      text: 'Rewind to where you were 4s ago, restore the most HP you had since, and explode on arrival.',
      cooldown: 60,
    },
    trait: 'Time is on his side',
    unlockCost: 1000,
  },
  alchemist: {
    name: 'Altor',
    title: 'the Alchemist',
    voice: 'male',
    role: 'ranged',
    maxHp: 100,
    speed: 220,
    armor: 0.05,
    regen: 0,
    damageMult: 1,
    dodgeCooldown: 2.8,
    startWeapon: 'flask',
    ability: 'toxicpool',
    ultimate: {
      id: 'elixir',
      name: 'Grand Elixir',
      text: 'Drink it: heal 30%, and for 8s get +25% damage, 20% faster attacks, 50% more speed and 25% less damage taken.',
      cooldown: 75,
    },
    trait: 'Poisons whole crowds at once',
    unlockCost: 1000,
  },
  paladin: {
    name: 'Zarek',
    title: 'the Paladin',
    voice: 'deep',
    role: 'melee',
    maxHp: 190,
    speed: 205,
    armor: 0.15,
    regen: 0.5,
    damageMult: 1.15,
    dodgeCooldown: 3.2,
    startWeapon: 'hammer',
    ability: 'consecrate',
    ultimate: {
      id: 'wrath', damage: 'magic',
      name: 'Avenging Wrath',
      text: 'For 8s, pillars of light strike enemies around you and you take half damage.',
      cooldown: 70,
    },
    trait: 'Armored holy warrior, smites the wicked and protects the weak',
    unlockCost: 1500,
  },
  cleric: {
    name: 'Liora',
    title: 'the Cleric',
    voice: 'female',
    role: 'ranged',
    maxHp: 100,
    speed: 215,
    armor: 0.15,
    regen: 0.5,
    damageMult: 1.00,
    dodgeCooldown: 3,
    startWeapon: 'smite',
    ability: 'prayer',
    ultimate: {
      id: 'intervention',
      name: 'Divine Intervention',
      text: 'Every ally, anywhere: the fallen get back up, everyone heals to full and is invulnerable for 3s.',
      cooldown: 120,
    },
    trait: 'Healing keeps the team standing',
    unlockCost: 1500,
  },
  bard: {
    name: 'Tricky',
    title: 'the Bard',
    voice: 'male',
    role: 'ranged',
    maxHp: 110,
    speed: 230,
    armor: 0.05,
    regen: 0.5,
    damageMult: 1.05,
    dodgeCooldown: 2.6,
    startWeapon: 'notes',
    ability: 'onhit',
    ultimate: {
      id: 'ballad',
      name: 'Ballad of Heroes',
      text: `For ${BALLAD.duration}s, play a rousing ballad: you and every ally within earshot get +${BALLAD.damage * 100}% damage, ${BALLAD.attackSpeed * 100}% faster attacks, ${BALLAD.speed * 100}% more speed, and heal ${BALLAD.regen * 100}% of max HP a second.`,
      cooldown: 60,
    },
    trait: 'A trickster whose songs rally friends and befuddle foes',
    unlockCost: 1000,
  },
  dragonmancer: {
    name: 'Kaelor',
    title: 'the Dragonmancer',
    voice: 'deep',
    role: 'melee',
    maxHp: 200,
    speed: 215,
    armor: 0.15,
    regen: 0.5,
    damageMult: 1.2,
    dodgeCooldown: 3,
    startWeapon: 'embers',
    ability: 'firewave',
    ultimate: {
      id: 'dragonform',
      damage: 'magic',
      name: 'Dragon Form',
      text: `Become a dragon for ${DRAGON_FORM.duration}s: +${Math.round((DRAGON_FORM.damage - 1) * 100)}% damage, +${Math.round((DRAGON_FORM.maxHp - 1) * 100)}% max HP, ${Math.round(DRAGON_FORM.reduction * 100)}% less damage taken, faster and bigger, and your E breathes fire.`,
      cooldown: 60,
    },
    trait: 'Wields the power of firebreathing beasts.',
    secret: 'dragonmancer',
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
    if (def.alsoFor?.[character] !== undefined) return true;
    return (!def.role || def.role === role) && (!def.owner || def.owner === character) && (!def.exclusive || def.exclusive === character);
  });
}

/** Can this player pick the hero? Starting heroes always; the rest once unlocked with prestige. */
export function heroAvailable(character: CharacterId, unlocked: readonly string[]): boolean {
  const c = CHARACTERS[character];
  if (c.secret) return unlocked.includes(character);
  return c.unlockCost === undefined || unlocked.includes(character);
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

/** A player's stats: their character's base stats with passive upgrades, prestige ranks and their artifact applied. */
export function playerStats(upgrades: Upgrades, character: CharacterId, prestige: PrestigeRanks = {}, artifact: ArtifactId | null = null, growth?: ArtifactGrowth) {
  const c = CHARACTERS[character];
  // (An artifact that grows through the run adds what it has grown so far.)
  const grown = growthBonus(artifact, growth);
  const lv = (id: UpgradeId) => upgrades[id] ?? 0;
  const rank = (id: PrestigeId) => (prestige[id] ?? 0) * PRESTIGE_BONUS[id];
  const effects: ArtifactEffects = artifact ? ARTIFACTS[artifact].effects : {};
  const a = (key: keyof ArtifactEffects) => effects[key] ?? 0;
  return {
    damageMult: c.damageMult * (1 + 0.1 * lv('might')) * (1 + rank('power')) * (1 + a('damage') + grown.damage),
    cooldownMult: (1 - 0.08 * lv('haste')) / (1 + rank('fury')) / (1 + a('attackSpeed')),
    speed: c.speed * (1 + 0.08 * lv('swift')) * (1 + rank('stride')) * (1 + a('speed')),
    maxHp: Math.max(1, Math.round((c.maxHp + 20 * lv('vitality') + a('maxHp')) * (1 + rank('fortitude')) * (1 + a('maxHpPct')) + grown.maxHp)),
    magnet: magnetRadius(upgrades) * (1 + a('magnet')),
    regen: c.regen + 0.5 * lv('regen') + a('regen'),
    armor: Math.min(0.6, c.armor + 0.06 * lv('armor') + rank('resolve') + a('armor') + (lv('frost') ? frostStats(lv('frost')).reduction : 0)),
    /** Multiplier on damage taken after armor (artifacts with a drawback). */
    damageTaken: 1 + a('damageTaken'),
    dodgeCooldown: c.dodgeCooldown * (1 - a('dodge')),
    /** Multiplier on the ultimate's cooldown. */
    ultCooldown: 1 - a('ultimate'),
    critChance: 0.06 * lv('crit') + a('crit'),
    /** Magic damage can crit too (Jeweled Gauntlet). */
    magicCrit: a('magicCrit') > 0,
    lifesteal: 0.005 * lv('lifesteal') + a('omnivamp'),
    /** Most Vampirism can heal, as a share of max HP per second. */
    lifestealCap: 0.01 * lv('lifesteal') + a('omnivamp') * OMNIVAMP_CAP,
    area: (1 + 0.1 * lv('area')) * (c.areaMult ?? 1) * (1 + a('area') + grown.area),
    duration: 1 + 0.12 * lv('duration') + a('duration'),
    projectiles: lv('multishot') + a('projectiles') + grown.projectiles,
    evasion: 0.03 * lv('evasion') + a('evasion'),
    xpMult: 1 + 0.1 * lv('wisdom') + a('xp'),
    /** Devotion: healing this player gives (themselves included), and how long the shields they give last. */
    support: 1 + DEVOTION_PER_LEVEL * lv('devotion'),
    goldMult: 1 + a('gold'),
    /** Once per run, a fatal blow leaves you at this share of max HP instead (0: no). */
    secondWind: effects.secondWind ?? 0,
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
 * more often, and so does the passive that boosts it (Crit for physical, Arcana for magic, Devotion for the heroes
 * whose kit heals or shields).
 */
const SUPPORT_HEROES: CharacterId[] = ['cleric', 'paladin', 'alchemist', 'tank'];
export const OFFER_WEIGHT = { ownType: 3, ownPassive: 2, otherPassive: 0.5 };
export function offerWeight(id: UpgradeId, character: CharacterId): number {
  const own = heroDamageType(character);
  const def = UPGRADES[id];
  const extra = def.alsoFor?.[character];
  if (extra !== undefined) return extra;
  if (def.kind === 'weapon') return !def.owner && damageType(id as WeaponId) === own ? OFFER_WEIGHT.ownType : 1;
  if (id === 'crit') return own === 'physical' ? OFFER_WEIGHT.ownPassive : OFFER_WEIGHT.otherPassive;
  if (id === 'arcana') return own === 'magic' ? OFFER_WEIGHT.ownPassive : OFFER_WEIGHT.otherPassive;
  if (id === 'devotion') return SUPPORT_HEROES.includes(character) ? OFFER_WEIGHT.ownPassive : OFFER_WEIGHT.otherPassive;
  return 1;
}

export type PlayerStats = ReturnType<typeof playerStats>;

/** Spirit Blades as they spin: shared so the client draws them exactly where the server hits with them. */
export function orbitLayout(upgrades: Upgrades, character: CharacterId, artifact: ArtifactId | null = null, weapon: 'orbit' | 'embers' = 'orbit') {
  const level = upgrades[weapon] ?? 0;
  if (!level) return null;
  const s = weapon === 'embers' ? embersStats(level) : orbitStats(level);
  const stats = playerStats(upgrades, character, {}, artifact);
  return { ...s, count: s.count + stats.projectiles, radius: s.radius * stats.area };
}

/** Frost Shield's pulse radius, or 0 without one. */
export function frostRadius(upgrades: Upgrades, character: CharacterId, artifact: ArtifactId | null = null): number {
  const level = upgrades.frost ?? 0;
  return level ? frostStats(level).radius * playerStats(upgrades, character, {}, artifact).area : 0;
}

/** Radiant Field's radius, or 0 without one. */
export function fieldRadius(upgrades: Upgrades, character: CharacterId, artifact: ArtifactId | null = null): number {
  const level = upgrades.field ?? 0;
  return level ? fieldStats(level).radius * playerStats(upgrades, character, {}, artifact).area : 0;
}
