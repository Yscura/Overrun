// Artifacts: relics that drop from elites, warlords and final bosses and are kept between runs. Before a run you can
// equip one (in the lobby) for its bonus. Duplicates stack in your inventory, and FORGE.count of one tier combine into
// a random one of the next tier; the wheel (WHEEL) sells random ones for gold. Everything about them lives in this file: add, rename or rebalance an
// artifact by editing its entry in ARTIFACTS; its description is written from its effects. Drop rates are in DROPS and LOOT.
// Profiles save artifacts by their key (e.g. `glassEdge`), so rename one by changing its `name`, not its key.

import type { ChoiceId } from './upgrades';

export type Tier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const TIER_IDS: Tier[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export const TIERS: Record<Tier, { name: string; color: number }> = {
  common: { name: 'Common', color: 0xb0bec5 },
  rare: { name: 'Rare', color: 0x42a5f5 },
  epic: { name: 'Epic', color: 0xb388ff },
  legendary: { name: 'Legendary', color: 0xffb300 },
  mythic: { name: 'Mythical', color: 0xff6d00 },
};

/**
 * What an artifact does. Shares are fractions (0.1 = 10%). Negative values are drawbacks (for `damageTaken`,
 * positive is the drawback).
 */
export interface ArtifactEffects {
  /** Flat max HP. */
  maxHp?: number;
  /** Max HP, as a share. */
  maxHpPct?: number;
  damage?: number;
  /** More damage taken (after armor). */
  damageTaken?: number;
  /** Faster attacks and abilities (cooldowns divided by 1 + this). */
  attackSpeed?: number;
  speed?: number;
  /** Damage reduction, added to armor (armor stays capped). */
  armor?: number;
  /** HP per second. */
  regen?: number;
  /** Heal this share of all damage dealt (shares Vampirism's per-second cap, which it also raises). */
  omnivamp?: number;
  /** Crit chance (physical damage, and magic too with `magicCrit`). */
  crit?: number;
  /** 1: magic damage can crit as well. */
  magicCrit?: number;
  area?: number;
  duration?: number;
  /** Extra projectiles (and blades) on weapons. */
  projectiles?: number;
  evasion?: number;
  /** Pickup radius. */
  magnet?: number;
  xp?: number;
  /** Shorter dodge cooldown. */
  dodge?: number;
  /** Shorter ultimate cooldown. */
  ultimate?: number;
  /** More gold from coins (for you). */
  gold?: number;
  /** Once per run, a blow that would down you leaves you at this share of max HP instead. */
  secondWind?: number;
  // These grow through a run (see ArtifactGrowth):
  /** Max HP gained for good with every heart you pick up (you can pick hearts up at full health). */
  heartMaxHp?: number;
  /** +1 projectile every this many level-ups. */
  levelsPerProjectile?: number;
  /** Area gained with every bomb that goes off. */
  areaPerBomb?: number;
  /** Damage gained with every war chest the team opens. */
  damagePerChest?: number;
}

/** What a run has given the artifacts that grow: hearts you picked up, level-ups, bombs that went off, war chests opened. */
export interface ArtifactGrowth {
  hearts: number;
  levels: number;
  bombs: number;
  chests: number;
}

/** What an artifact that grows adds so far (nothing for the others). */
export function growthBonus(id: ArtifactId | null, growth: ArtifactGrowth | undefined) {
  const e: ArtifactEffects = id ? ARTIFACTS[id].effects : {};
  const g = growth ?? { hearts: 0, levels: 0, bombs: 0, chests: 0 };
  return {
    maxHp: (e.heartMaxHp ?? 0) * g.hearts,
    projectiles: e.levelsPerProjectile ? Math.floor(g.levels / e.levelsPerProjectile) : 0,
    area: (e.areaPerBomb ?? 0) * g.bombs,
    damage: (e.damagePerChest ?? 0) * (g.chests ?? 0),
  };
}

/** What an artifact that grows has added this run, as text (empty for the others). */
export function describeGrowth(id: ArtifactId | null, growth: ArtifactGrowth | undefined): string {
  if (!id) return '';
  const e: ArtifactEffects = ARTIFACTS[id].effects;
  const b = growthBonus(id, growth);
  const parts: string[] = [];
  if (e.heartMaxHp) parts.push(`+${b.maxHp} max HP`);
  if (e.levelsPerProjectile) parts.push(`+${b.projectiles} projectile${b.projectiles === 1 ? '' : 's'}`);
  if (e.areaPerBomb) parts.push(`+${+(b.area * 100).toFixed(1)}% area`);
  if (e.damagePerChest) parts.push(`+${+(b.damage * 100).toFixed(1)}% damage`);
  return parts.length ? `This run so far: ${parts.join(', ')}` : '';
}

/**
 * What pressing Q does, for artifacts that can be activated. Every part is optional and they combine; times are in
 * seconds. The Q slot's description is written from these.
 */
export interface ArtifactActive {
  /** The move's name, shown in the Q slot. */
  name: string;
  cooldown: number;
  /** Heal this share of your max HP. */
  heal?: number;
  /** You and allies within `radius` heal this share of max HP; fallen allies get back up. */
  rally?: { radius: number; heal: number };
  /** Take this share less damage for a while. */
  guard?: { reduction: number; duration: number };
  /** Faster attacks and movement for a while. */
  frenzy?: { attackSpeed: number; speed: number; duration: number };
  /**
   * True damage to enemies within `radius`: `power` times a grunt's health at this point of the run (times your
   * damage). `push` knocks them back that far, or pulls them in if negative.
   */
  blast?: { radius: number; power: number; push?: number };
  /** Stun enemies within `radius` (bosses resist most of it). */
  stun?: { radius: number; duration: number };
  /** Dash this far toward the cursor (through enemies and fences, not walls). */
  blink?: number;
  /** Untouchable for this long. */
  invuln?: number;
  /** A dome on the ground for a while: every player inside is untouchable. */
  sanctuary?: { radius: number; duration: number };
}

export interface ArtifactDef {
  name: string;
  tier: Tier;
  /** Its own art is in src/client/artifactIcons.ts; until it has some, it's drawn with this upgrade icon. */
  icon: ChoiceId;
  /** A line of flavor under the effects. */
  flavor: string;
  effects: ArtifactEffects;
  /** Press Q to use it (otherwise it's passive only). */
  active?: ArtifactActive;
  /** Only ever comes from one place (`unique` says where): never from drops, the wheel or the forge. */
  unique?: string;
}

/*
 * Balance yardstick: one level of a passive upgrade (Might +10% damage, Vitality +20 HP, Swiftness +8% speed,
 * Armor +6%, Evasion +3%, Vampirism +1% max HP healed per second, Multishot +1 of at most 3, ...) is about one
 * point. Commons are worth about 1, rares 2 to 2.5, epics 3 to 4.5, legendaries 6 or more or something unique,
 * mythicals 10 or more with an active that can turn a fight.
 * A drawback buys about its own size in extra upside (Glass Edge, Berserker's Mask, Bloodpact Chalice).
 */
const ARTIFACT_DEFS = {
  // --- Common: one small, plain bonus ---
  whetstone: { name: 'Whetstone', tier: 'common', icon: 'might', flavor: 'A few strokes before battle.', effects: { damage: 0.08 } },
  oakCharm: { name: 'Oak Charm', tier: 'common', icon: 'vitality', flavor: 'Carved from the heart of an old oak.', effects: { maxHp: 25 } },
  travelersBoots: { name: "Traveler's Boots", tier: 'common', icon: 'swift', flavor: 'Worn in, never worn out.', effects: { speed: 0.07 } },
  mendingMoss: { name: 'Mending Moss', tier: 'common', icon: 'regen', flavor: 'Press it to a wound and wait.', effects: { regen: 0.6 } },
  lodestone: { name: 'Lodestone', tier: 'common', icon: 'magnet', flavor: 'Loose things drift toward it.', effects: { magnet: 0.5 } },
  scholarsQuill: { name: "Scholar's Quill", tier: 'common', icon: 'wisdom', flavor: 'Every fight is a lesson.', effects: { xp: 0.08 } },
  ironBuckle: { name: 'Iron Buckle', tier: 'common', icon: 'armor', flavor: 'Holds the armor on. Mostly.', effects: { armor: 0.05 } },
  luckyCoin: { name: 'Lucky Coin', tier: 'common', icon: 'bonusGold', flavor: 'Heads you win, tails you win.', effects: { gold: 0.35 } },
  healingDraught: {
    name: 'Healing Draught',
    tier: 'common',
    icon: 'regen',
    flavor: 'Tastes awful. Works anyway.',
    effects: { regen: 0.3 },
    active: { name: 'Drink', cooldown: 50, heal: 0.25 },
  },

  // --- Rare: a stronger bonus, or a big one with a catch ---
  glassEdge: { name: 'Glass Edge', tier: 'rare', icon: 'crit', flavor: 'Cuts both ways.', effects: { damage: 0.22, damageTaken: 0.15 } },
  bloodVial: { name: 'Blood Vial', tier: 'rare', icon: 'lifesteal', flavor: 'Still warm.', effects: { omnivamp: 0.012 } },
  hourglassShard: { name: 'Hourglass Shard', tier: 'rare', icon: 'haste', flavor: 'The sand falls a little faster.', effects: { attackSpeed: 0.12 } },
  huntersEye: { name: "Hunter's Eye", tier: 'rare', icon: 'multishot', flavor: 'Aim for the gaps in the armor.', effects: { crit: 0.1 } },
  towerPlate: {
    name: 'Tower Plate',
    tier: 'rare',
    icon: 'armor',
    flavor: 'Heavy, and worth it.',
    effects: { armor: 0.08, speed: -0.05 },
    active: { name: 'Brace', cooldown: 35, guard: { reduction: 0.5, duration: 4 } },
  },
  windstepAnklet: {
    name: 'Windstep Anklet',
    tier: 'rare',
    icon: 'evasion',
    flavor: 'Light on your feet.',
    effects: { dodge: 0.25, evasion: 0.03 },
    active: { name: 'Gust', cooldown: 10, blink: 260, invuln: 0.4 },
  },
  smokeBomb: {
    name: 'Smoke Bomb',
    tier: 'rare',
    icon: 'evasion',
    flavor: 'Now where did they go?',
    effects: { evasion: 0.04 },
    active: { name: 'Vanish', cooldown: 30, invuln: 1.5, frenzy: { attackSpeed: 0, speed: 0.3, duration: 2 } },
  },
  sagesLens: { name: "Sage's Lens", tier: 'rare', icon: 'area', flavor: 'Everything looks bigger through it.', effects: { area: 0.2 } },
  emberHeart: { name: 'Ember Heart', tier: 'rare', icon: 'regen', flavor: 'It beats slower than yours.', effects: { maxHp: 60, damage: -0.05 } },

  // --- Epic: build-defining ---
  heartOfTheMountain: { name: 'Heart of the Mountain', tier: 'epic', icon: 'vitality', flavor: 'The mountain does not fall.', effects: { maxHp: 100 } },
  vampireFang: { name: 'Vampire Fangs', tier: 'epic', icon: 'lifesteal', flavor: 'It hungers, so you hunger.', effects: { omnivamp: 0.016, damage: 0.08 } },
  berserkersMask: {
    name: "Berserker's Mask",
    tier: 'epic',
    icon: 'might',
    flavor: "Who needs a guard when they're all dead?",
    effects: { damage: 0.35, damageTaken: 0.3, speed: 0.05 },
    active: { name: 'Bloodlust', cooldown: 40, frenzy: { attackSpeed: 0.4, speed: 0.15, duration: 6 } },
  },
  prismShard: { name: 'Prism Shard', tier: 'epic', icon: 'multishot', flavor: 'One becomes two.', effects: { projectiles: 1 } },
  stormSigil: {
    name: 'Storm Sigil',
    tier: 'epic',
    icon: 'storm',
    flavor: 'Thunder follows you around.',
    effects: { attackSpeed: 0.15, area: 0.12 },
    active: { name: 'Thunderclap', cooldown: 15, blast: { radius: 240, power: 8, push: 60 }, stun: { radius: 240, duration: 1 } },
  },
  shadowCloak: { name: 'Shadow Cloak', tier: 'epic', icon: 'veil', flavor: 'Now you see me.', effects: { evasion: 0.11, speed: 0.08 } },
  chronometer: {
    name: 'Chronometer',
    tier: 'epic',
    icon: 'duration',
    flavor: 'Wound by a clockmaker who never slept.',
    effects: { duration: 0.25, ultimate: 0.25 },
    active: { name: 'Stop the Clock', cooldown: 40, stun: { radius: 450, duration: 2.5 } },
  },

  // --- Legendary: once-in-a-while finds ---
  phoenixFeather: {
    name: 'Phoenix Feather',
    tier: 'legendary',
    icon: 'fireball',
    flavor: 'Burns, and rises again.',
    effects: { secondWind: 0.6, maxHpPct: 0.1, regen: 1 },
    active: { name: 'Flare', cooldown: 35, blast: { radius: 200, power: 6, push: 40 }, heal: 0.1 },
  },
  crownOfTheOverrun: {
    name: 'Crown of the Overrun',
    tier: 'legendary',
    icon: 'wisdom',
    flavor: 'Worn by whoever is still standing.',
    effects: { damage: 0.15, attackSpeed: 0.1, speed: 0.08, maxHpPct: 0.12, xp: 0.1 },
    active: { name: 'Rally the Line', cooldown: 60, rally: { radius: 350, heal: 0.3 } },
  },
  bloodpactChalice: { name: 'Bloodpact Chalice', tier: 'legendary', icon: 'hex', flavor: 'Drink deep. Pay later.', effects: { damage: 0.3, omnivamp: 0.035, maxHpPct: -0.25 } },
  jeweledGauntlet: {
    name: 'Jeweled Gauntlet',
    tier: 'legendary',
    icon: 'arcana',
    flavor: 'A gem for every spell, and every spell finds the weak spot.',
    effects: { magicCrit: 1, crit: 0.1, damage: 0.08 },
  },
  aegisOfDawn: {
    name: 'Aegis of Dawn',
    tier: 'legendary',
    icon: 'armor',
    flavor: 'Nothing gets in. Nothing at all.',
    effects: { armor: 0.08, maxHpPct: 0.15 },
    active: { name: 'Sanctuary', cooldown: 50, sanctuary: { radius: 230, duration: 3 } },
  },
  titansHeart: { name: "Titan's Heart", tier: 'legendary', icon: 'armor', flavor: 'Still beating, after all this time.', effects: { maxHp: 130, armor: 0.1, speed: -0.08 } },
  eyeOfTheStorm: {
    name: 'Eye of the Storm',
    tier: 'legendary',
    icon: 'orbit',
    flavor: 'Calm at the center of it all.',
    effects: { projectiles: 2, area: 0.15 },
    active: { name: 'Maelstrom', cooldown: 25, blast: { radius: 340, power: 8, push: -90 } },
  },
  // Only from Mordak, the Earth Scourger: the reward for the true ending of the Ashen Caldera.
  dragonsheart: {
    name: 'Dragonsheart',
    tier: 'legendary',
    icon: 'vitality',
    flavor: 'Still warm. It will never cool.',
    effects: { damage: 0.15, maxHpPct: 0.15, regen: 1.5, area: 0.1 },
    active: { name: 'Dragonfire', cooldown: 30, blast: { radius: 320, power: 10, push: 60 }, frenzy: { attackSpeed: 0.3, speed: 0.1, duration: 5 } },
    unique: 'Slay Mordak, the Earth Scourger',
  },

  // --- Mythical: the top tier, only ever found in play. Each grows through the run, made for endless ---
  bottomlessHeart: {
    name: 'Bottomless Heart',
    tier: 'mythic',
    icon: 'vitality',
    flavor: 'However much you give it, it has room for more.',
    effects: { heartMaxHp: 3 },
  },
  hydrasTooth: {
    name: "Hydra's Tooth",
    tier: 'mythic',
    icon: 'multishot',
    flavor: 'Cut one head off and two grow back.',
    effects: { levelsPerProjectile: 6 },
  },
  warlordsTrophy: {
    name: "Warlord's Trophy",
    tier: 'mythic',
    icon: 'might',
    flavor: 'Every warlord that falls makes the next one easier.',
    effects: { damagePerChest: 0.05 },
  },
  blastforgedCore: {
    name: 'Blastforged Core',
    tier: 'mythic',
    icon: 'area',
    flavor: 'Every blast leaves it a little bigger.',
    effects: { areaPerBomb: 0.05 },
  },} satisfies Record<string, ArtifactDef>;

export type ArtifactId = keyof typeof ARTIFACT_DEFS;
export const ARTIFACTS: Record<ArtifactId, ArtifactDef> = ARTIFACT_DEFS;
export const ARTIFACT_IDS = Object.keys(ARTIFACTS) as ArtifactId[];

export function isArtifactId(id: unknown): id is ArtifactId {
  return typeof id === 'string' && id in ARTIFACTS;
}

export function artifact(id: ArtifactId): ArtifactDef {
  return ARTIFACTS[id];
}

/** Omnivamp also raises how much Vampirism can heal per second (as a share of max HP), by this many times itself. */
export const OMNIVAMP_CAP = 2;

/** Relative odds of each tier: [common, rare, epic, legendary, mythic]. */
type Odds = [number, number, number, number, number];

/**
 * Where artifacts come from, how often, and how good. How good depends on how far along the run is: its step on the
 * LOOT ladder (see lootStep). Each step has odds per source; weights are relative.
 */
export const DROPS = {
  /** Champions (elites with an affix): a small chance each (a run kills around 500). */
  champion: { chance: 0.004 },
  /** Warlords drop a war chest: this share hold an artifact for everyone (the rest, a Warforge pick). */
  warlord: { chance: 0.2 },
  /** Beating the final boss: one for everyone. */
  boss: { chance: 1 },
  /** Artifacts you don't own yet are this many times likelier to be picked within a tier. */
  newBias: 3,
};

/**
 * The tier odds at each step of a run's progression: the campaign's maps on normal mode (Emerald Woods to the Ashen
 * Caldera), then on hard mode. The Emerald Woods only ever gives commons; each map after it opens the next tier, with a
 * rare outlier one tier further. The first legendaries come from the Ashen Caldera's bosses; hard mode is where epics
 * and legendaries are common, and the only place a mythical can drop (from warlords and bosses, rarely). Endless mode
 * climbs the ladder a step per boss wave.
 */
export const LOOT: { champion: Odds; warlord: Odds; boss: Odds }[] = [
  // Normal: Emerald Woods, Desecrated Ruins, Frozen Fortress, Sunscar Canyon, Ashen Caldera.
  { champion: [100, 0, 0, 0, 0], warlord: [100, 0, 0, 0, 0], boss: [100, 0, 0, 0, 0] },
  { champion: [85, 15, 0, 0, 0], warlord: [60, 38, 2, 0, 0], boss: [35, 62, 3, 0, 0] },
  { champion: [65, 33, 2, 0, 0], warlord: [35, 58, 7, 0, 0], boss: [10, 75, 15, 0, 0] },
  { champion: [50, 44, 6, 0, 0], warlord: [20, 62, 18, 0, 0], boss: [0, 62, 38, 0, 0] },
  { champion: [40, 48, 12, 0, 0], warlord: [10, 58, 32, 0, 0], boss: [0, 35, 50, 15, 0] },
  // Hard mode, the same maps again.
  { champion: [35, 48, 16, 1, 0], warlord: [5, 50, 40, 5, 0], boss: [0, 25, 55, 20, 1] },
  { champion: [30, 48, 20, 2, 0], warlord: [0, 45, 47, 8, 0], boss: [0, 20, 55, 25, 1.5] },
  { champion: [25, 48, 24, 3, 0], warlord: [0, 38, 52, 10, 0.5], boss: [0, 15, 55, 30, 2] },
  { champion: [20, 46, 30, 4, 0], warlord: [0, 30, 56, 14, 0.5], boss: [0, 10, 55, 35, 2.5] },
  { champion: [15, 45, 34, 6, 0], warlord: [0, 22, 58, 20, 1], boss: [0, 5, 50, 45, 3] },
];

/**
 * In a run, artifacts drop as orbs of their tier: you only see what's inside when you open it, on the profile's
 * Artifacts tab. The Dragon Orb is Mordak's alone, and always holds the Dragonsheart.
 */
export type OrbKind = Tier | 'dragon';
export const ORB_KINDS: OrbKind[] = [...TIER_IDS, 'dragon'];

export function isOrbKind(v: unknown): v is OrbKind {
  return typeof v === 'string' && (ORB_KINDS as string[]).includes(v);
}

export function orbName(kind: OrbKind): string {
  return kind === 'dragon' ? 'Dragon Orb' : `${TIERS[kind].name} Orb`;
}

export function orbColor(kind: OrbKind): number {
  return kind === 'dragon' ? 0xd32f2f : TIERS[kind].color;
}

/** Combining: this many artifacts of one tier become one random artifact of the next tier up. */
export const FORGE = { count: 5 };

/** Tiers that can't be made by combining or bought on the wheel: they're only found in play. */
export const FOUND_ONLY: readonly Tier[] = ['mythic'];

/** The tier that combining this one makes, or null if it can't be combined (legendary: the next tier is found only). */
export function nextTier(tier: Tier): Tier | null {
  const next = TIER_IDS[TIER_IDS.indexOf(tier) + 1];
  return next && !FOUND_ONLY.includes(next) ? next : null;
}

/** The wheel: a spin costs `cost` gold and lands on a tier with these odds (relative weights), then an artifact of it. */
export const WHEEL = { cost: 1000, weights: { common: 52, rare: 30, epic: 14, legendary: 4, mythic: 0 } as Record<Tier, number> };

/** Rolls the wheel's tier. */
export function rollWheel(random = Math.random): Tier {
  let roll = random() * TIER_IDS.reduce((sum, t) => sum + WHEEL.weights[t], 0);
  for (const t of TIER_IDS) {
    roll -= WHEEL.weights[t];
    if (roll < 0) return t;
  }
  return TIER_IDS[0];
}
export type DropSource = 'champion' | 'warlord' | 'boss';

/** A run's step on the LOOT ladder: its map (0 for the first), plus the campaign's length on hard mode. */
export function lootStep(mapIndex: number, hard: boolean, campaign: number): number {
  return Math.max(0, Math.min(LOOT.length - 1, mapIndex + (hard ? campaign : 0)));
}

/** Rolls a tier for a drop from `source` at `step` of the LOOT ladder. */
export function rollTier(source: DropSource, step: number, random = Math.random): Tier {
  const weights = LOOT[Math.max(0, Math.min(LOOT.length - 1, Math.floor(step)))][source];
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < TIER_IDS.length; i++) {
    roll -= weights[i];
    if (roll < 0) return TIER_IDS[i];
  }
  return TIER_IDS[0];
}

/** Picks an artifact of a tier, favoring ones not in `owned`. */
export function rollArtifact(tier: Tier, owned: readonly string[], random = Math.random): ArtifactId {
  const pool = ARTIFACT_IDS.filter((id) => ARTIFACTS[id].tier === tier && !ARTIFACTS[id].unique);
  const weight = (id: ArtifactId) => (owned.includes(id) ? 1 : DROPS.newBias);
  let roll = random() * pool.reduce((sum, id) => sum + weight(id), 0);
  for (const id of pool) {
    roll -= weight(id);
    if (roll < 0) return id;
  }
  return pool[0];
}

// --- Descriptions, written from the effects ---

const pct = (v: number) => `${+(Math.abs(v) * 100).toFixed(1)}%`;
const sign = (v: number) => (v >= 0 ? '+' : '-');

/** How each effect reads, and whether a value is a drawback. */
const EFFECT_TEXT: { [K in keyof Required<ArtifactEffects>]: { text: (v: number) => string; bad?: (v: number) => boolean } } = {
  maxHp: { text: (v) => `${sign(v)}${Math.abs(v)} max HP` },
  maxHpPct: { text: (v) => `${sign(v)}${pct(v)} max HP` },
  damage: { text: (v) => `${sign(v)}${pct(v)} damage` },
  damageTaken: { text: (v) => `${pct(v)} ${v >= 0 ? 'more' : 'less'} damage taken`, bad: (v) => v > 0 },
  attackSpeed: { text: (v) => `${sign(v)}${pct(v)} attack speed` },
  speed: { text: (v) => `${sign(v)}${pct(v)} movement speed` },
  armor: { text: (v) => `${sign(v)}${pct(v)} damage reduction` },
  regen: { text: (v) => `${sign(v)}${Math.abs(v)} HP per second` },
  omnivamp: { text: (v) => `Heal ${pct(v)} of all damage dealt` },
  crit: { text: (v) => `${sign(v)}${pct(v)} crit chance` },
  magicCrit: { text: () => 'Magic damage can crit too' },
  area: { text: (v) => `${sign(v)}${pct(v)} area` },
  duration: { text: (v) => `${sign(v)}${pct(v)} effect duration` },
  projectiles: { text: (v) => `${sign(v)}${Math.abs(v)} projectile${Math.abs(v) === 1 ? '' : 's'}` },
  evasion: { text: (v) => `${sign(v)}${pct(v)} chance to evade hits` },
  magnet: { text: (v) => `${sign(v)}${pct(v)} pickup radius` },
  xp: { text: (v) => `${sign(v)}${pct(v)} XP` },
  dodge: { text: (v) => `Dodge cooldown ${v >= 0 ? '-' : '+'}${pct(v)}`, bad: (v) => v < 0 },
  ultimate: { text: (v) => `Ultimate cooldown ${v >= 0 ? '-' : '+'}${pct(v)}`, bad: (v) => v < 0 },
  gold: { text: (v) => `${sign(v)}${pct(v)} gold from coins` },
  secondWind: { text: (v) => `Once per run, a fatal blow leaves you at ${pct(v)} HP instead` },
  heartMaxHp: { text: (v) => `+${v} max HP for every heart you pick up (even at full health)` },
  levelsPerProjectile: { text: (v) => `+1 projectile every ${v} level-ups` },
  areaPerBomb: { text: (v) => `+${pct(v)} area for every bomb that goes off` },
  damagePerChest: { text: (v) => `+${pct(v)} damage for every war chest opened` },
};

/** The effects as lines of text, drawbacks flagged. */
export function describeArtifact(id: ArtifactId): { text: string; bad: boolean }[] {
  const effects: ArtifactEffects = ARTIFACTS[id].effects;
  return (Object.keys(effects) as (keyof ArtifactEffects)[]).map((key) => {
    const v = effects[key]!;
    const e = EFFECT_TEXT[key];
    return { text: e.text(v), bad: e.bad ? e.bad(v) : v < 0 };
  });
}

/** What pressing Q does, as lines of text (empty for passive-only artifacts). */
export function describeActive(id: ArtifactId): string[] {
  const a = artifact(id).active;
  if (!a) return [];
  const lines: string[] = [];
  if (a.blink) lines.push(`Dash ${a.blink} toward your cursor`);
  if (a.invuln) lines.push(`Untouchable for ${a.invuln}s`);
  if (a.blast) {
    const push = a.blast.push ? (a.blast.push > 0 ? ', knocking them back' : ', pulling them in') : '';
    lines.push(`Blast enemies around you for heavy true damage${push}`);
  }
  if (a.stun) lines.push(`Stun enemies ${a.blast && a.blast.radius === a.stun.radius ? 'hit' : 'around you'} for ${a.stun.duration}s`);
  if (a.heal) lines.push(`Heal ${pct(a.heal)} of your max HP`);
  if (a.sanctuary) lines.push(`Raise a dome for ${a.sanctuary.duration}s: every player inside is untouchable`);
  if (a.rally) lines.push(`You and nearby allies heal ${pct(a.rally.heal)} of max HP, and fallen allies get back up`);
  if (a.guard) lines.push(`Take ${pct(a.guard.reduction)} less damage for ${a.guard.duration}s`);
  if (a.frenzy) {
    const parts = [a.frenzy.attackSpeed ? `+${pct(a.frenzy.attackSpeed)} attack speed` : '', a.frenzy.speed ? `+${pct(a.frenzy.speed)} movement speed` : ''].filter(Boolean);
    lines.push(`${parts.join(' and ')} for ${a.frenzy.duration}s`);
  }
  return lines;
}

/** The effects in one line, for chat and logs. */
export function artifactSummary(id: ArtifactId): string {
  const active = artifact(id).active;
  const passive = describeArtifact(id)
    .map((l) => l.text)
    .join(', ');
  return active ? `${passive}. Q, ${active.name}: ${describeActive(id).join(', ')} (${active.cooldown}s)` : passive;
}
