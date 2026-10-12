import { ALL_UPGRADES, UPGRADES, magnetRadius, type Role, type UpgradeId, type Upgrades, type WeaponId } from './upgrades';

export type CharacterId = 'assassin' | 'mage' | 'bruiser' | 'tank';

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
  /** One-line perk shown on the character select screen. */
  trait: string;
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
    trait: 'Fastest mover, dodges far more often',
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
    trait: 'Takes 25% less damage',
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
export const DEFAULT_CHARACTER: CharacterId = 'mage';

export function isCharacterId(id: unknown): id is CharacterId {
  return typeof id === 'string' && id in CHARACTERS;
}

/** Upgrades this character can be offered: its role's weapons, shared weapons and all passives. */
export function upgradesFor(character: CharacterId): UpgradeId[] {
  const role = CHARACTERS[character].role;
  return ALL_UPGRADES.filter((id) => !UPGRADES[id].role || UPGRADES[id].role === role);
}

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
  };
}

export type PlayerStats = ReturnType<typeof playerStats>;
