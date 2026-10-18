import {
  CHARACTERS,
  DRAGON_FORM,
  DRAGON_FORM_TURN,
  dragonBody,
  FIREBREATH,
  CHARACTER_IDS,
  DEFAULT_CHARACTER,
  REWIND_SECONDS,
  UPGRADE_PICKS,
  heroAvailable,
  isCharacterId,
  offerableUpgrades,
  upgradesFor,
  offerWeight,
  orbitLayout,
  ownedWeapons,
  playerStats,
  type CharacterId,
  type PlayerStats,
} from '../shared/characters';
import { DROPS, TIERS, TIER_IDS, artifact as artifactDef, rollArtifact, rollTier, type ArtifactId, type DropSource, type Tier } from '../shared/artifacts';
import { WallIndex, blocksShot, moveCircle, overlapsWall, pushOut, type PassFlags } from '../shared/collision';
import {
  ARTIFACT_RADIUS,
  BOSS_INTERVAL,
  BOSS_DEATH,
  CHOOSE_TIME,
  BOMB,
  COIN,
  CRATE_HP,
  CRATE_INTERVAL,
  CRATE_LOOT,
  CRATE_RADIUS,
  DODGE_IFRAMES,
  DODGE_SPEED,
  ENEMY_SHOT_RADIUS,
  HEART_HEAL,
  HEART_RADIUS,
  MAX_CRATES,
  MAX_ENEMIES,
  MAX_GEMS,
  MAX_PLAYERS,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  PROJECTILE_RADIUS,
  SLOWMO,
  BOSS_INTRO,
  DRAGON_INTRO,
  HARD,
  ENDLESS,
  ARMORY_AT,
  endlessWave,
  REVIVE_RADIUS,
  REVIVE_TIME,
  SPAWN_DISTANCE,
  TICK_DT,
  TICK_RATE,
} from '../shared/constants';
import {
  BOMBARDIER,
  BOSS_ATTACK,
  BOSS_BERSERK,
  BOSS_CHARGE,
  BOSS_ENRAGE_AT,
  BOSS_ENRAGE_SPEEDUP,
  BOSS_MECHANICS,
  BOSS_MISSIONS,
  BOSS_NOVA,
  BOSS_POWER,
  BOSS_SPIT,
  BOSS_STING,
  BOSS_STUN,
  BOSS_SUMMON,
  BOSS_FIGHT_HORDE,
  BOSS_FIGHT_STAY,
  AFFIX_TUNING,
  Affix,
  AFFIXES,
  CHAMPION,
  HORDE_DENSITY,
  MAX_RESIST,
  BOSS_VENGEFUL,
  MISSION_KINDS,
  MISSIONS,
  CHARGER,
  ENEMY_TYPES,
  EnemyType,
  MAX_ENEMY_RADIUS,
  NAMED_BOSSES,
  SPITTER,
  bossDisplayName,
  hordeScaling,
  type ChargeConfig,
  type MissionKind,
  isBossType,
} from '../shared/enemies';
import { isPrestigeId, prestigeCost, prestigeReward, prestigeSpent, PRESTIGE, type PrestigeRanks } from '../shared/prestige';
import {
  BOSS_TIME,
  LAVA_CLOSE_TIME,
  LAVA_DAMAGE,
  MAPS,
  CAMPAIGN,
  ENDLESS_MAP,
  waveBoss,
  ZONE_DAMAGE,
  ZONE_SWEEP_TIME,
  arenaReach,
  clampToArena,
  inZone,
  inSealed,
  insideArena,
  mapBossName,
  mapWalls,
  zoneStart,
  type MapDef,
} from '../shared/maps';
import {
  EVENTS,
  EVENT_DURATION,
  EVENT_KINDS,
  HUNT_TIME,
  FORGE_SCHEDULE,
  MAX_SHRINES,
  QUESTS,
  QUEST_KINDS,
  QUEST_REWARD,
  RALLY_DISTANCE,
  RALLY_RADIUS,
  RALLY_TIME,
  SHRINES,
  SHRINE_CAPTURE_TIME,
  SHRINE_FIRST,
  SHRINE_INTERVAL,
  SHRINE_RADIUS,
  captureSpeed,
  SHRINE_SPACING,
  ShrineKind,
  type QuestKind,
} from '../shared/objectives';
import {
  EnemyFlag,
  AFFIX_SHIFT,
  BossFlag,
  FACING_SHIFT,
  FACING_STEPS,
  type FinaleStage,
  HazardKind,
  PickupKind,
  ProjectileKind,
  ZoneKind,
  type ActiveEvent,
  type ArtifactFind,
  type ChoiceReason,
  type ClientMessage,
  type GameMode,
  type DevAction,
  DEV_NAME,
  type Fx,
  type SoundId,
  SummonKind,
  type GameResult,
  type MeState,
  type Pause,
  type Phase,
  type PlayerState,
  type RoomRef,
  type Snapshot,
  type LogTone,
  CHAT_MAX,
} from '../shared/protocol';
import {
  MAX_LEVEL,
  EVOLVED_LEVEL,
  BONUS,
  isBonus,
  CRIT_TYPES,
  DAMAGE_TYPES,
  type DamageType,
  UPGRADES,
  POISON_SLOW,
  upgradeMax,
  CRIT_MULTIPLIER,
  arrowsStats,
  boltStats,
  cleaveStats,
  daggersStats,
  fireballStats,
  flamenovaStats,
  timebombStats,
  wildcallStats,
  tumbleStats,
  veilStats,
  wolvesStats,
  fieldStats,
  hexStats,
  knivesStats,
  leapStats,
  minesStats,
  venomStats,
  meteorStats,
  damageType,
  firewaveStats,
  flaskStats,
  hammerStats,
  smiteStats,
  toxicpoolStats,
  consecrateStats,
  prayerStats,
  shurikenStats,
  slamStats,
  stormStats,
  warcryStats,
  xpToNext,
  type AbilityId,
  type ChoiceId,
  type UpgradeId,
  type Upgrades,
  type WeaponId,
} from '../shared/upgrades';
import { Bot } from './bot';
import { FlowField } from './navigation';
import {
  buyHero,
  buyPrestige,
  equipArtifact,
  equippedArtifact,
  getProfile,
  giveArtifact,
  noteBoss,
  notePlayed,
  noteRun,
  ownedArtifacts,
  refundPrestige,
  type Profile,
} from './profiles';
import { SpatialGrid } from './spatialGrid';

const SEPARATION_SPEED = 150;
/** Pings: at most this many per player within this many seconds. */
const PING_LIMIT = 10;
const PING_WINDOW = 5;
/** Names for bot teammates. */
const BOT_NAMES = ['Rook (bot)', 'Mira (bot)', 'Bram (bot)', 'Juno (bot)', 'Wren (bot)', 'Pike (bot)'];
const GEM_ACCEL = 1500;
const GEM_MAX_SPEED = 900;
/** Weapons that fire on their own (hero abilities are cast with E instead). */
const WEAPON_IDS: WeaponId[] = ['bolt', 'knives', 'storm', 'hex', 'cleave', 'slam', 'venom', 'orbit', 'field', 'mines', 'shuriken', 'daggers', 'fireball', 'arrows', 'wolves', 'flask', 'hammer', 'smite', 'embers'];
/** Seeker hexes turn this fast (radians per second) and look this far for a target. */
const HEX_TURN = 7;
const HEX_SEEK = 600;
const MAX_VENOM = 80;
/** Damage numbers: at most this many of your hits per tick, and grouped contact damage this often. */
const MAX_DAMAGE_NUMBERS = 25;
const DAMAGE_NUMBER_INTERVAL = 0.3;
const VENOM_TICK = 0.5;
/** A crate counts as tucked away within `wall` of a wall, or within `edge` of the map's edge. */
const CRATE_SPOT = { wall: 70, edge: 260 };
/** Seconds between level-ups at the least (see levelUp). */
const LEVEL_GAP = 4;
/** Shown on the results the first time someone slays Mordak. */
const HARD_FEAT = 'Hard mode is unlocked: every map again, from the Emerald Woods, and far less forgiving.';
const DRAGONMANCER_FEAT = 'Mordak is slain: Kaelor, the Dragonmancer, joins your heroes!';
/**
 * The Ashen Caldera's true ending. The ground shakes for `crumble` seconds before it gives way; then a rock falls every
 * `rockEvery` seconds while the team crosses (`rockAimed` of them at someone, the rest on a stone up ahead). The dragon comes `stir` seconds after everyone standing is in the den,
 * or `wait` seconds after the first one gets there.
 */
const FINALE = { crumble: 3.5, rockEvery: 1.25, rockAimed: 0.45, rockRadius: 80, rockDelay: 1.1, rockDamage: 40, stir: 2.5, wait: 6 };
/** How fast Mordak turns to face his target, in radians per second. */
const DRAGON_TURN = 2.4;
/** Enemies' damage grows with the map's difficulty to this power (their health grows with it in full). */
const DIFFICULTY_DAMAGE = 0.6;
/** A boss with a voice first speaks up this many seconds into the fight (after its entrance roar). */
const BOSS_VOICE_FIRST = 3;
/** Recompute enemy pathfinding this often (in ticks). */
const FLOW_INTERVAL = 5;
/** If a client claims to be this far from where the server lets it be, snap the client back. */
const DESYNC_LIMIT = 120;

// Ultimate effects.
/** `after`: seconds you stay untouchable once it ends (you may land inside something big). */
const STRIKE = { targets: 7, hop: 0.18, range: 650, damage: 120, perLevel: 8, after: 1 };
const INFERNO = { duration: 3, fireballs: 16, spread: 380, radius: 110, damage: 80, perLevel: 5 };
const ARROW_STORM = { duration: 4, interval: 0.06, damage: 26, perLevel: 3, pierce: 3, jitter: 0.12 };
/**
 * Spirit Bear: slower than the wolves but hits much harder, swiping its target and everything around it. Damage grows
 * with the team level. R again sends it at the enemy nearest the cursor (within `directRange` of it).
 */
const BEAR = {
  life: 18,
  speed: 300,
  damage: 90,
  perLevel: 6,
  swipe: 1,
  splash: 75,
  splashShare: 0.6,
  radius: 26,
  reach: 14,
  /** Picks its own prey within this distance of the druid... */
  leash: 520,
  /** ...and is called back to the druid from beyond this. */
  tether: 1400,
  directRange: 380,
};
const REWIND = { seconds: REWIND_SECONDS, radius: 220, damage: 150, perLevel: 10 };
/** Chronobreak keeps this much of each player's past, sampled every HISTORY_STEP seconds. */
const HISTORY_STEP = 0.1;
/** Burning ground and venom puddles hurt every this many seconds. */
const BURN_TICK = 0.5;
/** Wolves: how close they get before biting, and how they spread around their druid when idle. */
const WOLF = {
  radius: 12,
  reach: 10,
  followRadius: 55,
  /** Within this distance of their prey they lunge at `lunge` times their speed. */
  lungeRange: 110,
  lunge: 1.6,
  /** Prey is kept until it's this much farther from the druid than the leash. */
  keepSlack: 250,
  /** Give up on prey that hasn't been bitten after this long, and leave it alone for `ignoreFor`. */
  giveUp: 2.5,
  ignoreFor: 3,
  /** Extra distance counted for prey another wolf is already hunting, so the pack spreads out. */
  crowding: 140,
};
const CHRONO = { radius: 900, stun: 4 };
/** Invulnerability after an artifact's second wind saves you. */
const SECOND_WIND_IFRAMES = 1.5;

/** Bloodrage: also heavy lifesteal (share of damage dealt, up to `lifestealCap` of max HP per second) and no dying. */
const RAGE = { duration: 8, damage: 1.6, cooldown: 0.7, regen: 0.04, lifesteal: 0.06, lifestealCap: 0.08 };
/**
 * Torvald's Retribution: for `duration` seconds he takes `reduction` less damage and enemies within `taunt` come for
 * him (for `tauntFor` seconds). Whatever hurts him takes `mult` times the damage back, plus `flat` (times his damage
 * multiplier) per blow; hits from nowhere in particular (shots, telegraphs) go back to the nearest enemy within `reach`.
 */
const RETRIBUTION = { duration: 8, reduction: 0.4, taunt: 420, tauntFor: 3, mult: 2.5, flat: 15, reach: 500, color: 0xff8f00 };
const AURA = { rage: 0xff1744, guard: 0xffd54f, strike: 0xce93d8, storm: 0x9ccc65, inferno: 0xff6d00, elixir: 0x76ff03, wrath: 0xfff59d };
/** Grand Elixir: the alchemist drinks it, healing and buffing herself for a while. */
const ELIXIR = { duration: 8, heal: 0.3, damage: 1.25, cooldown: 0.8, speed: 1.25, reduction: 0.25 };
/** Avenging Wrath: pillars of light around the paladin, who takes less damage meanwhile. */
const WRATH = { duration: 8, interval: 0.3, range: 420, radius: 70, damage: 70, perLevel: 5, reduction: 0.5 };
/** Divine Intervention: everyone up, healed to full and untouchable for a moment. */
const INTERVENTION = { invuln: 3 };
/** The flash of a boss's cone attack landing. */
const DANGER_FX = 0xff5252;
/**
 * While the lava closes in, the horde is thinned to fit: room for `full` enemies at the full rim, shrinking with the
 * area (but never below `min` plus `perPlayer` each). At most `perTick` burn up per tick, farthest from the team first.
 */
/**
 * A Warlord's arrival makes it a mini-boss fight: the horde out of sight (farther than `clear` from every player)
 * scatters, and while the Warlord lives the horde only trickles in (`horde` times the usual rate).
 */
const WARLORD_FIGHT = { clear: 950, horde: 0.3 };
const LAVA_CROWD = { full: 160, min: 14, perPlayer: 6, perTick: 4 };
/** Holy light (Paladin and Cleric): gold rings and pillars. */
const HOLY = 0xffe082;

/** Charge attack cycle (chargers and bosses). Other enemies stay in Normal. */
const Mode = { Normal: 0, Windup: 1, Charge: 2, Recover: 3 } as const;

export interface GameOptions {
  /** How many maps are unlocked at startup. */
  unlocked: number;
  /** Called when a victory unlocks a new map, to save progress. */
  onUnlock: (unlocked: number) => void;
  /** How many maps are unlocked on hard mode (0: not yet), and the call when that grows. */
  hardUnlocked?: number;
  onHardUnlock?: (unlocked: number) => void;
  /** Override when the named boss arrives, in seconds (for testing). */
  bossTime?: number;
  /** Everyone's prestige, by lowercased name. Shared with the caller, who saves it on `onProfiles`. */
  profiles?: Record<string, Profile>;
  /** Called when prestige was earned or spent, to save it. */
  onProfiles?: () => void;
  /** Every hero is available without unlocking (for testing). */
  allHeroes?: boolean;
  /** The room this game runs in (shown to players so they can share the code). */
  room?: RoomRef;
  /**
   * Lobby rules for real rooms: only the host picks the map, manages bots and starts, and only once everyone else
   * is ready. Off for tests and the balance tool, which drive the game directly.
   */
  hostControls?: boolean;
}

export type { Profile } from './profiles';

interface Player {
  id: number;
  name: string;
  color: number;
  character: CharacterId;
  send: (text: string) => void;
  x: number;
  y: number;
  /** Radians, toward the player's cursor. */
  aim: number;
  hp: number;
  downed: boolean;
  revive: number;
  /** Choices while a level-up pause is waiting on this player. */
  options: ChoiceId[] | null;
  /** At the Armory: the weapon they're trading in (they're now picking its replacement). */
  swapOut: UpgradeId | null;
  upgrades: Upgrades;
  cooldowns: Partial<Record<WeaponId, number>>;
  /** Seconds of dodge invulnerability left. */
  invuln: number;
  dodgeCooldown: number;
  hurtUntil: number;
  kills: number;
  epoch: number;
  /** Entered the boss arena; can't leave. */
  inArena: boolean;
  /** Seconds until E / R can be cast again. */
  abilityCd: number;
  ultCd: number;
  // Seconds left on buffs.
  rage: number;
  /** Retribution (Torvald's ultimate). */
  retribution: number;
  /** Grand Elixir (from any alchemist on the team). */
  elixir: number;
  /** Avenging Wrath: seconds of light pillars left. */
  wrath: number;
  guard: number;
  guardReduction: number;
  /** Shadow Veil: seconds of invisibility left. */
  veil: number;
  /** Shadow Strike: hops left, and seconds to the next. */
  strikes: number;
  strikeTimer: number;
  struck: Set<number>;
  /** Arrow Storm and Inferno: seconds left and seconds to the next shot. */
  arrowStorm: number;
  inferno: number;
  ultTimer: number;
  /** Dragon Form: seconds left; fire breath: seconds left and to its next burst. */
  dragonForm: number;
  breath: number;
  breathTimer: number;
  /** In Dragon Form: which way the body faces, and where it was last tick (to see which way it's walking). */
  body: number;
  bodyX: number;
  bodyY: number;
  /** Chronobreak: where they were and how healthy, oldest first. */
  history: { x: number; y: number; hp: number }[];
  historyTimer: number;
  // For the Tab scoreboard.
  damageDealt: number;
  damageTaken: number;
  /** Where the last Venom Trail puddle was dropped. */
  lastVenomX: number;
  lastVenomY: number;
  // Damage numbers for this player's screen, collected until the next snapshot.
  /** Enemy id -> damage dealt to it this tick. */
  hits: Map<number, { x: number; y: number; amount: number; crit: boolean; type: number }>;
  /** Damage dealt by type (physical, magic, true), for the scoreboard. */
  damageByType: [number, number, number];
  taken: number[];
  /** Small continuous damage (contact, zone) is added up and shown every DAMAGE_NUMBER_INTERVAL. */
  takenAcc: number;
  takenTimer: number;
  /** Sounds for this player's own actions, collected until the next snapshot. */
  sounds: SoundId[];
  /** HP that Vampirism may still heal; refills by `lifestealCap` of max HP per second. */
  lifestealBudget: number;
  /** Their prestige (shared with `options.profiles`). */
  profile: Profile;
  /** God mode: damage never takes them below 1 HP. On by default for "dev", who can toggle it. */
  god: boolean;
  /** A bot teammate: the server plays it through the same messages a client sends. */
  bot: Bot | null;
  /** Tick of their last chat message (to keep spam down). */
  lastChat: number;
  /** Ticks of their recent pings (to keep spam down). */
  pings: number[];
  /** The artifact they took into this run (bots have none). */
  artifact: ArtifactId | null;
  /** Artifacts they found this run (for the post-game screen), and since the last snapshot (for their toast). */
  loot: ArtifactFind[];
  found: ArtifactFind[];
  /** Their artifact's second wind has been used up this run. */
  secondWindUsed: boolean;
  /** Their artifact's Q: seconds of cooldown left, and of its speed boost (frenzy). */
  relicCd: number;
  frenzy: number;
}

/** Venom puddles and mines on the ground. */
interface Zone {
  id: number;
  kind: number;
  owner: number;
  x: number;
  y: number;
  /** Venom: puddle radius. Mine: trigger radius. */
  r: number;
  /** Mine: blast radius. */
  blast: number;
  damage: number;
  /** Hallowed ground: HP per tick to allies standing in it. */
  heal?: number;
  /** Seconds between damage ticks, if not the usual for its kind (Toxic Pool ticks faster). */
  tick?: number;
  life: number;
  /** Venom: seconds to the next damage tick. Mine: seconds until armed. */
  timer: number;
  type: DamageType;
  dead: boolean;
}

/** A delayed area hit from a player (Meteor, Inferno, Time Bomb). */
interface Blast {
  x: number;
  y: number;
  r: number;
  damage: number;
  owner: number;
  t: number;
  type: DamageType;
  /** Stuns what it hits for this long. */
  stun?: number;
  color?: number;
  /** Flask Toss: an acid puddle left where it lands. */
  puddle?: { r: number; damage: number; life: number };
  /** Molten Path: burning ground left where it bursts. */
  burn?: { r: number; damage: number; life: number };
}

/** An ally a hero calls in: the druid's wolves and spirit bear. */
interface Summon {
  id: number;
  kind: number;
  owner: number;
  x: number;
  y: number;
  /** Seconds left; Infinity for the Wolf Pack's own wolves. */
  life: number;
  /** Seconds to the next bite or slam. */
  timer: number;
  /** Wolf Pack wolves (kept in sync with the weapon's level) vs. temporary ones. */
  pack: boolean;
  /** Wolves: what they're hunting, how long they've chased it without a bite, and prey they gave up on. */
  prey: Enemy | null;
  chase: number;
  ignoreId: number;
  ignoreUntil: number;
  /** Call of the Wild's wolves: bite damage before the druid's damage bonus. */
  damage: number;
  /** The bear: its prey was picked by the druid (R again), so it keeps after it wherever it goes. */
  ordered: boolean;
  dead: boolean;
}

interface Enemy {
  id: number;
  type: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  flashUntil: number;
  orbitHitUntil: number;
  emberHitUntil: number;
  stunUntil: number;
  /** Slowed by poison until this time (see POISON_SLOW). */
  slowUntil: number;
  /** Bosses can't be stunned again until this time. */
  stunImmuneUntil: number;
  dead: boolean;
  attackTimer: number;
  /** Named bosses: which attack in their rotation comes next. */
  attackIndex: number;
  mode: number;
  modeTimer: number;
  /** Locked charge direction. */
  dirX: number;
  dirY: number;
  /** Players already hit by the current charge. */
  charged: Set<number>;
  /** The charge-path telegraph while winding up. */
  hazard: Hazard | null;
  /** Which way ranged enemies circle around you. */
  strafe: number;
  /** Taunted by this player (War Cry) until tauntUntil. */
  tauntBy: number;
  tauntUntil: number;
  /** Width of the current charge lane (hits anyone it covers). */
  chargeWidth: number;
  /** Final bosses: below half health (attacks faster). */
  enraged: boolean;
  /** Final bosses: its twin died first. */
  vengeful: boolean;
  /** Has to die to complete the current boss side mission (wards, brood). */
  missionTarget: boolean;
  /** Champions: their affix (see Affix), else Affix.None. */
  affix: number;
  /** Kharzak: dug in (hidden and untargetable) until its burrow mark lands. */
  burrowed: boolean;
  /** Kharzak: its shell is up, shrugging off most damage. */
  shell: boolean;
  /** Takes extra damage until this time (a cracked shell). */
  exposedUntil: number;
  /** A twin close to its sibling: shrugs off damage. */
  linked: boolean;
  /** Stands still (casting or winding up a cone) until this time. */
  channelUntil: number;
  /** The Reaper's lost souls: drift to him and heal him if they get there. */
  feeder: boolean;
  /** Named bosses with a voice: when they next speak up (fight time; 0 until the fight starts). */
  voiceAt: number;
  /** A final boss in its death animation: still shown, but out of the fight. */
  corpse: boolean;
  /** Parts of a bigger enemy (Mordak's wings): where they're attached, and on which side (-1 left, 1 right). */
  partOf: Enemy | null;
  side: number;
  /** The parts attached to this one. */
  parts: Enemy[];
  /** Which way it faces, in radians (Mordak: his wings follow it). */
  facing: number;
  /** In the air (Mordak's fire flight). */
  flight: Flight | null;
  /** Fireball volleys still to come, and when the next one goes. */
  volleys: number;
  volleyAt: number;
  /** Mordak's wings torn off so far. */
  wingsLost: number;
  /** Mordak: where his head looks and his tail points (radians off his body's line), and his tail swipe under way. */
  head: number;
  tail: number;
  tailSwipe: { t: number; side: number } | null;
  tailReadyAt: number;
  /** Mordak sitting back to hurl meteors: until when, and when the next one goes. */
  roostUntil: number;
  roostLobAt: number;
}

/** Mordak's fire flight: along `path` (take-off, out over the lava, landing), dropping fire as he goes. */
interface Flight {
  path: { x: number; y: number }[];
  leg: number;
  bombIn: number;
}

/** A boss side mission in progress; the bosses are shielded until it's done. */
interface Mission {
  kind: MissionKind;
  total: number;
  /** Wards and brood: the enemies to kill. Sigils: the sigil shrines to charge. */
  ids: number[];
}

interface Projectile {
  id: number;
  kind: number;
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  pierce: number;
  life: number;
  hit: Set<number>;
  type: DamageType;
  /** Arcane Barrage and Fireball: damage dealt around each hit. */
  explosion: { radius: number; damage: number; color?: number } | null;
  /** Pyroblast: leaves burning ground where it explodes. */
  burn?: { damage: number; life: number };
  radius: number;
  /** Flies through walls. */
  phasing: boolean;
  /** Shuriken: flies out `range`, then homes back to its owner. */
  boomerang: { range: number; traveled: number; returning: boolean } | null;
  /** Seeker Hex: steers toward this enemy (picking a new one when it dies). */
  homing: boolean;
  target: Enemy | null;
  dead: boolean;
}

interface EnemyShot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  dead: boolean;
  /** Homing shots (Embra's orbs) turn toward this player, at most `turn` radians a second. */
  target: Player | null;
  turn: number;
}

/**
 * A telegraphed attack (see HazardKind). Most go off when `t` reaches `duration`; lines just show a charge's path,
 * pools linger, rings roll outward, and the twins' tether lasts as long as they both live.
 */
interface Hazard {
  id: number;
  kind: number;
  x: number;
  y: number;
  /** Circle: radius. Line: angle. */
  a: number;
  /** Line: length. */
  b: number;
  /** Line: width. */
  c: number;
  t: number;
  duration: number;
  damage: number;
  /** Thrown by a bombardier (they share a limit on bombs at once). */
  lob: boolean;
  dead: boolean;
  /** Marks and meteors: the player it follows (0: none), for its first `follow` seconds. */
  target: number;
  follow: number;
  /** Pools: how long they burn once armed. */
  linger: number;
  /** Rings: players already hit. */
  hit: Set<number> | null;
  /** The boss behind it: Kharzak surfaces where his burrow mark lands. */
  owner: Enemy | null;
  /** Cones: how far players it hits are thrown back (Mordak's tail). */
  knock?: number;
}

interface Gem {
  id: number;
  x: number;
  y: number;
  value: number;
  target: Player | null;
  speed: number;
  collected: boolean;
}

/** A health crate (breakable) or the heart it drops. */
/** Crates, and what comes out of them: hearts, gold coins and bombs. */
interface Pickup {
  id: number;
  kind: number;
  x: number;
  y: number;
  hp: number;
  flashUntil: number;
  /** Coins: how much gold. Artifacts: the tier (index into TIER_IDS). */
  value: number;
  /** Coins: flying toward this player once they come close. */
  target: Player | null;
  dead: boolean;
}

/** An upgrade point. Capture it by standing inside until it fills up. */
interface Shrine {
  id: number;
  kind: number;
  x: number;
  y: number;
  /** 0..1 */
  progress: number;
  captured: boolean;
}

interface Quest {
  kind: QuestKind;
  timeLeft: number;
  /** Rally point, or the thief's current position. */
  x: number;
  y: number;
  /** The thief's enemy id (hunt quests). */
  targetId: number;
}

/** Shared shape of bolt and knife stats. */
interface FanStats {
  damage: number;
  count: number;
  pierce: number;
  speed: number;
  range: number;
  spread: number;
  explosion?: { radius: number; damageShare: number } | null;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;
const round1 = (v: number) => Math.max(0, Math.round(v * 10) / 10);
const round2 = (v: number) => Math.round(v * 100) / 100;
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** The list in a random order where higher-weight items tend to come first (weighted sampling without replacement). */
function weightedOrder<T>(list: T[], weight: (item: T) => number): T[] {
  return list
    .map((item) => ({ item, key: Math.random() ** (1 / Math.max(0.01, weight(item))) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.item);
}

function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export class Game {
  private phase: Phase = 'lobby';
  private pause: Pause | null = null;
  private tickCount = 0;
  private time = 0;
  private nextId = 1;
  private players = new Map<number, Player>();
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private enemyShots: EnemyShot[] = [];
  private hazards: Hazard[] = [];
  private gems: Gem[] = [];
  private pickups: Pickup[] = [];
  private fx: Fx[] = [];
  private result: GameResult | null = null;
  private level = 1;
  private xp = 0;
  /** Upgrade picks earned but not yet handed out; each one is a pause where everyone picks. */
  private choices: ChoiceReason[] = [];
  private spawnAcc = 0;
  private nextBossAt = BOSS_INTERVAL;
  private crateTimer = 0;
  private shrines: Shrine[] = [];
  private shrineTimer = SHRINE_FIRST;
  /** How many of FORGE_SCHEDULE's Forges have appeared this run. */
  private forgesSpawned = 0;
  private event: ActiveEvent | null = null;
  private quest: Quest | null = null;
  private blasts: Blast[] = [];
  private zones: Zone[] = [];
  private summons: Summon[] = [];
  /** Gold the team has picked up this run. */
  private runGold = 0;
  /** Real seconds left of slow motion (after a pause, or a boss's entrance), and its shape. */
  private slowmo = 0;
  private slowmoShape = { start: SLOWMO.start, hold: 0, ease: SLOWMO.duration };
  /** No bombardier may throw before this time (spaces their bombs out). */
  private nextLobAt = 0;

  // The map and its final boss.
  private unlocked: number;
  private hardUnlocked: number;
  /** Normal, hard (see HARD) or endless (see ENDLESS). */
  private mode: GameMode = 'normal';
  /** Endless mode: the boss wave the team is on (0 before the first), and when the next one comes. */
  private wave = 0;
  private nextWaveAt = 0;
  /** When the next Armory appears (see ARMORY_AT). */
  private nextArmoryAt = 0;

  private get hard(): boolean {
    return this.mode === 'hard';
  }

  private get endless(): boolean {
    return this.mode === 'endless';
  }

  /** The boss arena, when the boss fight uses it (endless mode's boss waves are fought out in the open). */
  private fightArena() {
    return this.endless ? null : this.map.arena;
  }
  private mapIndex = 0;
  private map!: MapDef;
  private walls!: WallIndex;
  private flow!: FlowField;
  private readonly bossTime: number;
  /** waiting -> (gather, on arena maps) -> fight. */
  private bossPhase: 'waiting' | 'gather' | 'fight' | 'finale' = 'waiting';
  /** A final boss's death animation (see BOSS_DEATH), and what follows it. */
  private dying: { t: number; x: number; y: number; corpse: Enemy; shattered: boolean; next: 'victory' | 'finale' } | null = null;
  /** The Ashen Caldera's true ending, once it's begun (see FINALE). */
  private finale: { stage: FinaleStage; t: number; arrivedAt: number; rockIn: number; quakeIn: number } | null = null;
  /** The den's pillars are up (the finale has revealed them). */
  private denShown = false;
  /** Who was beaten, for the results, and anything special the victory earned. */
  private victor: string | null = null;
  private feats: string[] = [];
  /** Seconds until the zone outside the arena starts burning. */
  /** Radius around the arena that isn't burning yet; shrinks to the arena once the boss is due. */
  private safeRadius = Infinity;
  /** The arena gate: shut until the boss is due, and again once everyone is inside. */
  private gateShut = true;
  /** Lava maps: everything farther than this from the middle is lava. Closes in for the boss. */
  private lavaR = Infinity;
  /** The final boss, or both twins (dead ones stay in the list). */
  private bosses: Enemy[] = [];
  /** Seconds since the boss fight started (for going berserk). */
  private fightTime = 0;
  /** No level-up before this time (see levelUp). */
  private nextLevelAt = 0;
  private berserk = 0;
  private mission: Mission | null = null;
  /** How many of BOSS_MISSIONS.at have been triggered. */
  private missionsStarted = 0;
  private lastMission: MissionKind | null = null;
  /** The twins' burning tether, while they both live. */
  private tether: Hazard | null = null;
  /** Mechanics explained once per fight (by key), so the banner isn't repeated. */
  private hinted = new Set<string>();

  private readonly profiles: Record<string, Profile>;

  /** Players who've said they're ready in the lobby. Cleared when the map changes or a run starts. */
  private lobbyReady = new Set<number>();

  private grid = new SpatialGrid<Enemy>(64);
  /** Reused query buffers; never nest two grid queries that share one. */
  private near: Enemy[] = [];
  private splashNear: Enemy[] = [];

  constructor(private readonly options: GameOptions) {
    this.unlocked = clamp(options.unlocked, 1, CAMPAIGN);
    this.hardUnlocked = clamp(options.hardUnlocked ?? 0, 0, CAMPAIGN);
    this.bossTime = options.bossTime ?? BOSS_TIME;
    this.profiles = options.profiles ?? {};
    this.loadMap(this.unlocked - 1); // Start on the newest unlocked map.
  }

  /** The prestige saved under this name, created on first sight. */
  private profile(name: string): Profile {
    return getProfile(this.profiles, name);
  }

  // --- For the room manager ---

  /** A run is going: loadouts (hero, artifact) are locked until it ends. */
  get running(): boolean {
    return this.phase === 'playing';
  }

  /** A player's profile changed outside the game (combining artifacts, the wheel): pick up their artifact again. */
  profileChanged(id: number): void {
    const p = this.players.get(id);
    if (!p || p.bot || this.phase === 'playing') return;
    p.artifact = equippedArtifact(p.profile);
    p.hp = this.stats(p).maxHp;
  }

  /** People in the game (bots don't count). */
  get humanCount(): number {
    return this.humans().length;
  }

  get playerCount(): number {
    return this.players.size;
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  get currentMap(): number {
    return this.mapIndex;
  }

  /** The first person in the game. */
  get hostName(): string {
    return this.host()?.name ?? '';
  }

  /** Who runs the lobby: the first person still here (bots never host). */
  private host(): Player | undefined {
    return this.humans()[0];
  }

  /** Can this player change lobby settings? Everyone can when host controls are off. */
  private canRunLobby(p: Player): boolean {
    return !this.options.hostControls || this.host() === p;
  }

  /** Everyone but the host has said they're ready (bots always are). */
  private everyoneReady(): boolean {
    const host = this.host();
    return this.humans().every((p) => p === host || this.lobbyReady.has(p.id));
  }

  /** Another room won a map: this one can play it too (unlocks are shared by everyone on the server). */
  setUnlocked(unlocked: number): void {
    this.unlocked = Math.max(this.unlocked, clamp(unlocked, 1, CAMPAIGN));
  }

  /** Another room won a map on hard mode (or unlocked it): this one can play it too. */
  setHardUnlocked(unlocked: number): void {
    this.hardUnlocked = Math.max(this.hardUnlocked, clamp(unlocked, 0, CAMPAIGN));
  }

  /** How tough enemies are on this map (and mode): their health, and (less steeply) how hard they hit. */
  private difficulty(): number {
    return this.map.difficulty * (this.hard ? HARD.difficulty : 1);
  }

  addPlayer(name: string, character: unknown, send: (text: string) => void, isBot = false): number | null {
    if (this.players.size >= MAX_PLAYERS) return null;
    const used = new Set([...this.players.values()].map((p) => p.color));
    const player: Player = {
      id: this.nextId++,
      name,
      color: PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0],
      character: DEFAULT_CHARACTER,
      send,
      x: 0,
      y: 0,
      aim: 0,
      hp: 0,
      downed: false,
      revive: 0,
      options: null,
      swapOut: null,
      upgrades: {},
      cooldowns: {},
      invuln: 0,
      dodgeCooldown: 0,
      hurtUntil: 0,
      kills: 0,
      epoch: 0,
      inArena: false,
      abilityCd: 0,
      ultCd: 0,
      rage: 0,
      retribution: 0,
      elixir: 0,
      wrath: 0,
      guard: 0,
      guardReduction: 0,
      veil: 0,
      strikes: 0,
      strikeTimer: 0,
      struck: new Set(),
      arrowStorm: 0,
      inferno: 0,
      dragonForm: 0,
      breath: 0,
      breathTimer: 0,
      body: 0,
      bodyX: 0,
      bodyY: 0,
      ultTimer: 0,
      history: [],
      historyTimer: 0,
      damageDealt: 0,
      damageTaken: 0,
      lastVenomX: 0,
      lastVenomY: 0,
      hits: new Map(),
      damageByType: [0, 0, 0],
      taken: [],
      takenAcc: 0,
      takenTimer: 0,
      sounds: [],
      lifestealBudget: 0,
      // Bots get a throwaway profile, so they never end up in the saved progress.
      profile: isBot ? { points: 0, ranks: {}, gold: 0, heroes: [...CHARACTER_IDS] } : this.profile(name),
      god: name.toLowerCase() === DEV_NAME,
      bot: null,
      lastChat: -1e9,
      pings: [],
      artifact: null,
      loot: [],
      found: [],
      secondWindUsed: false,
      relicCd: 0,
      frenzy: 0,
    };
    if (isCharacterId(character) && (isBot || this.canPlay(player, character))) player.character = character;
    this.resetPlayer(player, this.players.size);
    // Joining mid-run drops you next to a teammate (and into the current pick, if there is one).
    const buddy = this.phase === 'playing' ? this.alivePlayers().find((p) => !p.inArena) : undefined;
    if (buddy) ({ x: player.x, y: player.y } = pushOut(this.walls, buddy.x + 40, buddy.y, PLAYER_RADIUS));
    if (this.pause?.kind === 'choose') player.options = this.rollOptions(player, this.pause.reason);
    this.players.set(player.id, player);
    this.log(`${name} joined`);
    return player.id;
  }

  /** Adds a bot teammate with a random hero not already in the team. Returns its id, or null if the team is full. */
  addBot(): number | null {
    if (this.players.size >= MAX_PLAYERS) return null;
    const names = new Set([...this.players.values()].map((p) => p.name));
    const name = BOT_NAMES.find((n) => !names.has(n)) ?? `Bot ${this.nextId}`;
    const taken = new Set([...this.players.values()].map((p) => p.character));
    const free = CHARACTER_IDS.filter((c) => !taken.has(c));
    let bot: Bot | null = null;
    const id = this.addPlayer(name, pick(free.length > 0 ? free : CHARACTER_IDS), (text) => bot?.receive(text), true);
    if (id === null) return null;
    bot = new Bot((msg) => this.handleMessage(id, msg), id);
    this.players.get(id)!.bot = bot;
    return id;
  }

  /** Real players (not bots). */
  private humans(): Player[] {
    return [...this.players.values()].filter((p) => !p.bot);
  }

  removePlayer(id: number): void {
    const leaving = this.players.get(id);
    if (leaving) this.log(`${leaving.name} left`);
    this.players.delete(id);
    this.lobbyReady.delete(id);
    // Bots don't play on their own: once the last person leaves, they go too.
    if (this.humans().length === 0) for (const p of [...this.players.values()]) this.players.delete(p.id);
    this.summons = this.summons.filter((m) => m.owner !== id);
    if (this.players.size === 0) {
      this.phase = 'lobby';
      this.clearWorld();
    }
  }

  handleMessage(id: number, msg: ClientMessage): void {
    const p = this.players.get(id);
    if (!p) return;
    switch (msg.t) {
      case 'pick':
        if (this.phase !== 'playing' && !this.lobbyReady.has(p.id) && isCharacterId(msg.character) && this.canPlay(p, msg.character)) {
          p.character = msg.character;
          this.equip(p);
        }
        break;
      case 'map':
        const mode: GameMode = msg.mode === 'hard' || msg.mode === 'endless' ? msg.mode : 'normal';
        // Endless mode has a map of its own; the others play the campaign's maps that are unlocked.
        const index = mode === 'endless' ? ENDLESS_MAP : msg.index;
        if (this.phase === 'lobby' && this.canRunLobby(p) && Number.isInteger(index) && index >= 0 && (mode === 'endless' || index < (mode === 'hard' ? this.hardUnlocked : this.unlocked))) {
          this.mode = mode;
          this.loadMap(index);
          this.lobbyReady.clear(); // A new map: everyone confirms again.
          let slot = 0;
          for (const other of this.players.values()) this.resetPlayer(other, slot++);
        }
        break;
      case 'start':
        if (this.options.hostControls) {
          // The host starts from the lobby, once everyone is ready.
          if (this.phase === 'lobby' && this.canRunLobby(p) && this.everyoneReady()) this.startGame();
        } else if (this.phase !== 'playing') {
          this.startGame();
        }
        break;
      case 'lobby':
        if (this.phase === 'gameover' && this.canRunLobby(p)) this.backToLobby();
        break;
      case 'addbot':
        if (this.phase === 'lobby' && !p.bot && this.canRunLobby(p)) this.addBot();
        break;
      case 'removebot': {
        const target = this.players.get(msg.id);
        if (this.phase === 'lobby' && target?.bot && this.canRunLobby(p)) this.removePlayer(target.id);
        break;
      }
      case 'chat': {
        const text = String(msg.text ?? '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
        // At most a couple of messages a second.
        if (!text || p.bot || this.tickCount - p.lastChat < TICK_RATE / 2) break;
        p.lastChat = this.tickCount;
        this.fx.push({ k: 'chat', name: p.name, color: p.color, text });
        break;
      }
      case 'ping': {
        if (this.phase !== 'playing' || typeof msg.x !== 'number' || typeof msg.y !== 'number') break;
        // At most PING_LIMIT pings in any PING_WINDOW seconds.
        p.pings = p.pings.filter((tick) => this.tickCount - tick < PING_WINDOW * TICK_RATE);
        if (p.pings.length >= PING_LIMIT) break;
        p.pings.push(this.tickCount);
        const x = Math.round(clamp(msg.x, 0, this.map.width));
        const y = Math.round(clamp(msg.y, 0, this.map.height));
        this.fx.push({ k: 'ping', x, y, color: p.color, name: p.name });
        break;
      }
      case 'giveup':
        // From the pause screen: the run ends as a defeat (prestige and gold earned so far still count).
        if (this.phase === 'playing' && this.pause?.kind === 'menu') {
          this.endGame(false);
          this.backToLobby();
        }
        break;
      case 'move':
        this.movePlayer(p, msg.x, msg.y, msg.aim, msg.epoch);
        break;
      case 'dodge':
        this.dodge(p);
        break;
      case 'cast':
        this.cast(p, msg.slot, msg.aim, msg.dist);
        break;
      case 'choose':
        this.choose(p, msg.index);
        break;
      case 'prestige':
        this.buyPrestige(p, msg.id);
        break;
      case 'respec':
        this.respec(p);
        break;
      case 'unlock':
        this.unlockHero(p, msg.character);
        break;
      case 'equip':
        // Like heroes: only between runs, and not once you've locked in.
        if (this.phase !== 'playing' && !p.bot && !this.lobbyReady.has(p.id) && equipArtifact(p.profile, msg.artifact)) {
          p.artifact = equippedArtifact(p.profile);
          p.hp = this.stats(p).maxHp;
          this.options.onProfiles?.();
        }
        break;
      case 'pause':
        // Anyone can pause, except in the middle of picking upgrades.
        if (this.phase === 'playing' && !this.pause) {
          this.pause = { kind: 'menu', by: p.name, ready: [] };
          this.banner(`${p.name} paused the game`, 'good');
        }
        break;
      case 'ready':
        if (this.phase === 'lobby') {
          if (this.lobbyReady.has(p.id)) this.lobbyReady.delete(p.id);
          else this.lobbyReady.add(p.id);
        } else if (this.pause?.kind === 'menu') {
          const ready = this.pause.ready;
          const i = ready.indexOf(p.id);
          if (i >= 0) ready.splice(i, 1);
          else ready.push(p.id);
        }
        break;
      case 'dev':
        if (p.name.toLowerCase() === DEV_NAME && this.phase === 'playing') this.devCheat(p, msg.action);
        break;
    }
  }

  private backToLobby(): void {
    this.phase = 'lobby';
    this.lobbyReady.clear();
    this.clearWorld();
    let slot = 0;
    for (const other of this.players.values()) this.resetPlayer(other, slot++);
  }

  // --- God-mode cheats (player named "dev") ---

  private devCheat(p: Player, action: DevAction): void {
    switch (action) {
      case 'skip':
        if (!this.pause) this.skipAhead(60);
        break;
      case 'boss':
        // To 3 seconds before it arrives.
        if (!this.pause && this.bossPhase === 'waiting') this.skipAhead(Math.max(0, (this.endless ? this.nextWaveAt : this.bossTime) - 3 - this.time), true);
        break;
      case 'finale':
        if (!this.pause) this.skipToFinale();
        break;
      case 'level':
        this.choices.push('level');
        break;
      case 'forge':
        this.choices.push('forge');
        break;
      case 'max':
        this.maxBuild(p);
        break;
      case 'god':
        p.god = !p.god;
        this.banner(`Dev: god mode ${p.god ? 'on' : 'off'}`, 'good');
        break;
    }
  }

  /** Jumps the clock a minute ahead, as if the team had played it: same difficulty, and the level-ups earned. */
  /**
   * Dev: jumps the clock ahead, with the level-ups the team would have earned meanwhile: picked one by one, or
   * (`autoPick`, for long jumps) picked at random for everyone on the spot.
   */
  private skipAhead(seconds: number, autoPick = false): void {
    this.time += seconds;
    if (this.bossPhase === 'fight') this.fightTime += seconds; // Straight toward berserk.
    // Don't unleash every warlord that was skipped over at once.
    this.nextBossAt = Math.max(this.nextBossAt, Math.ceil(this.time / BOSS_INTERVAL) * BOSS_INTERVAL);
    // Of the Forges skipped over, only the latest one appears.
    while (this.forgesSpawned < FORGE_SCHEDULE.length - 1 && this.time >= FORGE_SCHEDULE[this.forgesSpawned + 1] * this.bossTime) this.forgesSpawned++;
    if (this.bossPhase === 'waiting') {
      const expected = Math.round(1 + UPGRADE_PICKS * Math.pow(Math.min(1, this.time / this.bossTime), 0.9));
      for (; this.level < expected; this.level++) {
        if (!autoPick) {
          this.choices.push('level');
          continue;
        }
        for (const p of this.players.values()) {
          const upgrades = (this.rollOptions(p, 'level') ?? []).filter((id) => !isBonus(id));
          if (upgrades.length > 0) this.applyUpgrade(p, pick(upgrades));
        }
      }
      this.xp = 0;
    }
    const m = Math.floor(this.time / 60);
    const s = Math.floor(this.time % 60);
    this.banner(`Dev: skipped to ${m}:${String(s).padStart(2, '0')}`, 'good');
  }

  /**
   * Dev: straight to the caldera's finale. Before it: the boss is skipped (level-ups picked at random) and the ground
   * gives way under the team, gathered on the heart of the caldera. While crossing: the team is put down at the den's
   * mouth, to walk in and meet Mordak.
   */
  private skipToFinale(): void {
    const f = this.map.finale;
    if (!f || this.endless) {
      this.banner('Dev: only the Ashen Caldera has a finale (not in endless mode)', 'danger');
      return;
    }
    const fin = this.finale;
    if (fin?.stage === 'den') return;
    const alive = this.alivePlayers();
    const gather = (x: number, y: number, spread: number) => {
      alive.forEach((p, i) => {
        const a = (i / Math.max(1, alive.length)) * Math.PI * 2;
        p.x = x + Math.cos(a) * spread;
        p.y = y + Math.sin(a) * spread;
        p.epoch++;
      });
    };
    if (fin) {
      // Crossing (or still crumbling): skip the path.
      if (fin.stage === 'crumble') fin.t = FINALE.crumble;
      this.updateFinale(0, alive);
      const last = f.stones[f.route[f.route.length - 1]];
      gather(last.x, last.y, 25);
      this.hazards = [];
      this.banner('Dev: at the mouth of the den', 'good');
      return;
    }
    if (this.bossPhase === 'waiting') this.skipAhead(Math.max(0, this.bossTime - this.time), true);
    for (const e of this.enemies) e.dead = true;
    this.enemyShots = [];
    this.hazards = [];
    this.mission = null;
    this.dying = null;
    this.tether = null;
    const heart = f.stones[f.route[0]];
    gather(heart.x, heart.y, 40);
    this.startFinale();
  }

  /** Fills every free weapon and passive slot, then maxes everything (evolving what can evolve). */
  private maxBuild(p: Player): void {
    for (let i = 0; i < 20; i++) {
      const fresh = offerableUpgrades(p.upgrades, p.character).filter((id) => !p.upgrades[id]);
      if (fresh.length === 0) break;
      p.upgrades[pick(fresh)] = 1;
    }
    for (const id of Object.keys(p.upgrades) as UpgradeId[]) p.upgrades[id] = UPGRADES[id].evolution ? EVOLVED_LEVEL : upgradeMax(id);
    p.hp = this.stats(p).maxHp;
    this.banner(`Dev: ${p.name} is fully upgraded (${ownedWeapons(p.upgrades).length} weapons)`, 'good');
  }

  // --- Prestige (between runs only) ---

  private buyPrestige(p: Player, id: unknown): void {
    if (this.phase === 'playing' || !buyPrestige(p.profile, id)) return;
    p.hp = this.stats(p).maxHp;
    this.options.onProfiles?.();
  }

  /** Every hero is open in testing setups and for the "dev" player; otherwise starting heroes plus bought ones. */
  private allHeroes(p: Player): boolean {
    return this.options.allHeroes === true || p.name.toLowerCase() === DEV_NAME;
  }

  private canPlay(p: Player, character: CharacterId): boolean {
    return this.allHeroes(p) || heroAvailable(character, p.profile.heroes ?? []);
  }

  /** Buy a hero with gold, and play it right away. */
  private unlockHero(p: Player, character: unknown): void {
    if (this.phase === 'playing' || !buyHero(p.profile, character, this.allHeroes(p)) || !isCharacterId(character)) return;
    p.character = character;
    this.equip(p);
    this.options.onProfiles?.();
  }

  /** Refund every rank, for free (bought heroes stay bought). */
  private respec(p: Player): void {
    if (this.phase === 'playing') return;
    refundPrestige(p.profile);
    p.hp = this.stats(p).maxHp;
    this.options.onProfiles?.();
  }

  /** Every hero is open in testing setups and for "dev". Public so the room manager can say the same in profiles. */
  allHeroesFor(name: string): boolean {
    return this.options.allHeroes === true || name.toLowerCase() === DEV_NAME;
  }

  tick(): void {
    this.tickCount++;
    for (const p of this.players.values()) p.bot?.think();
    if (this.phase === 'playing') {
      if (this.pause?.kind === 'menu') {
        // Everyone (still here) is ready: carry on, easing in from slow motion like after a pick.
        const ready = this.pause.ready;
        if (this.humans().every((p) => ready.includes(p.id))) {
          this.pause = null;
          this.slowMotion(SLOWMO.start, 0, SLOWMO.duration);
        }
      } else if (this.pause) {
        this.updatePause(TICK_DT);
      } else {
        const scale = this.timeScale();
        this.slowmo = Math.max(0, this.slowmo - TICK_DT); // Counts down in real time.
        this.update(TICK_DT * scale);
      }
    }
    this.broadcast();
    this.fx = [];
  }

  /** Starts a slow-motion stretch: `hold` seconds at `start` speed, then easing up to full speed over `ease`. */
  private slowMotion(start: number, hold: number, ease: number): void {
    this.slowmo = hold + ease;
    this.slowmoShape = { start, hold, ease };
  }

  /** Game speed during slow motion (after a pause, or a boss's entrance): slow, then smoothly back to full speed. */
  private timeScale(): number {
    if (this.slowmo <= 0) return 1;
    const { start, hold, ease } = this.slowmoShape;
    const elapsed = hold + ease - this.slowmo;
    if (elapsed < hold) return start;
    const t = Math.min(1, (elapsed - hold) / ease);
    return start + (1 - start) * t * t * (3 - 2 * t);
  }

  // --- Lifecycle ---

  private loadMap(index: number): void {
    this.mapIndex = index;
    this.map = MAPS[index];
    this.setGate(true);
    this.lavaR = this.map.lava?.r ?? Infinity;
  }

  /** Collision and pathfinding for the map, with the arena gate shut or open. */
  private setGate(shut: boolean): void {
    this.gateShut = shut;
    this.walls = new WallIndex(mapWalls(this.map, shut, this.denShown), this.map.width, this.map.height);
    this.flow = new FlowField(this.walls);
    const visible = this.alivePlayers().filter((p) => p.veil <= 0);
    if (visible.length > 0) this.flow.update(visible);
  }

  private startGame(): void {
    this.phase = 'playing';
    this.lobbyReady.clear();
    this.clearWorld();
    let slot = 0;
    for (const p of this.players.values()) this.resetPlayer(p, slot++);
    // Count the run for each person's hero (their profile card shows the one they play most).
    for (const p of this.humans()) notePlayed(p.profile, p.character);
    this.options.onProfiles?.();
    if (this.hard) this.banner('Hard mode: they hit harder, and the bosses are relentless', 'danger');
    if (this.endless) this.banner('Endless: survive as long as you can. The boss comes back in waves', 'danger');
  }

  private clearWorld(): void {
    this.time = 0;
    this.pause = null;
    this.level = 1;
    this.xp = 0;
    this.choices = [];
    this.spawnAcc = 0;
    this.nextBossAt = BOSS_INTERVAL;
    this.crateTimer = CRATE_INTERVAL / 2;
    this.shrines = [];
    this.shrineTimer = SHRINE_FIRST;
    this.forgesSpawned = 0;
    this.wave = 0;
    this.nextWaveAt = this.bossTime * ENDLESS.firstWave;
    this.nextArmoryAt = this.endless ? this.bossTime * ARMORY_AT : Infinity;
    this.event = null;
    this.quest = null;
    this.blasts = [];
    this.zones = [];
    this.summons = [];
    this.runGold = 0;
    this.nextLobAt = 0;
    this.slowmo = 0;
    this.bossPhase = 'waiting';
    this.dying = null;
    this.finale = null;
    this.victor = null;
    this.feats = [];
    this.safeRadius = Infinity;
    if (!this.gateShut || this.denShown) {
      this.denShown = false;
      this.setGate(true);
    }
    this.lavaR = this.map.lava?.r ?? Infinity;
    this.bosses = [];
    this.fightTime = 0;
    this.nextLevelAt = 0;
    this.berserk = 0;
    this.mission = null;
    this.missionsStarted = 0;
    this.lastMission = null;
    this.enemies = [];
    this.projectiles = [];
    this.enemyShots = [];
    this.hazards = [];
    this.gems = [];
    this.pickups = [];
    this.result = null;
  }

  private resetPlayer(p: Player, slot: number): void {
    const angle = (slot / MAX_PLAYERS) * Math.PI * 2;
    const { spawn } = this.map;
    ({ x: p.x, y: p.y } = pushOut(this.walls, spawn.x + Math.cos(angle) * 60, spawn.y + Math.sin(angle) * 60, PLAYER_RADIUS));
    p.epoch++;
    this.equip(p);
  }

  /** Fresh run loadout for the player's character. */
  private equip(p: Player): void {
    const hero = CHARACTERS[p.character];
    p.upgrades = { [hero.startWeapon]: 1, [hero.ability]: 1 };
    p.artifact = p.bot ? null : equippedArtifact(p.profile);
    p.loot = [];
    p.found = [];
    p.secondWindUsed = false;
    p.relicCd = 0;
    p.frenzy = 0;
    p.abilityCd = 0;
    p.ultCd = 0;
    p.rage = 0;
    p.retribution = 0;
    p.elixir = 0;
    p.wrath = 0;
    p.guard = 0;
    p.veil = 0;
    p.strikes = 0;
    p.arrowStorm = 0;
    p.inferno = 0;
    p.dragonForm = 0;
    p.breath = 0;
    p.history = [];
    p.damageDealt = 0;
    p.damageByType = [0, 0, 0];
    p.damageTaken = 0;
    p.hp = this.stats(p).maxHp;
    p.downed = false;
    p.revive = 0;
    p.options = null;
    p.swapOut = null;
    p.cooldowns = {};
    p.invuln = 0;
    p.dodgeCooldown = 0;
    p.hurtUntil = 0;
    p.kills = 0;
    p.inArena = false;
  }

  private endGame(victory: boolean, unlockedMap: string | null = null): void {
    if (this.phase !== 'playing') return;
    const beaten = this.victor ?? mapBossName(this.map);
    this.log(victory ? `Victory over ${beaten}!` : 'The team was overrun', victory ? 'good' : 'danger');
    this.phase = 'gameover';
    this.pause = null;
    const prestige = prestigeReward(this.level, this.map.prestigeReward * (this.hard ? HARD.prestige : 1));
    for (const p of this.players.values()) p.profile.points += prestige;
    // Endless: everyone's longest run on this map.
    let record = false;
    if (this.endless) {
      for (const p of this.humans()) {
        const best = p.profile.endless?.[this.map.name] ?? 0;
        if (this.time > best) {
          p.profile.endless = { ...(p.profile.endless ?? {}), [this.map.name]: Math.round(this.time) };
          record = true;
        }
      }
    }
    // Each person's hero record: wins, kills, best damage, longest run.
    for (const p of this.humans()) noteRun(p.profile, p.character, { victory, damage: p.damageDealt, kills: p.kills, time: this.time });
    this.options.onProfiles?.();
    this.result = {
      victory,
      prestige,
      gold: this.runGold,
      boss: victory ? beaten : null,
      feats: victory ? [...this.feats] : [],
      unlockedMap,
      endless: this.endless ? { waves: Math.max(0, this.wave - (this.bossPhase === 'fight' ? 1 : 0)), record } : null,
      time: this.time,
      level: this.level,
      players: [...this.players.values()].map((p) => ({ name: p.name, color: p.color, character: p.character, kills: p.kills, artifact: p.artifact, loot: [...p.loot] })),
    };
  }

  private victory(slain?: number): void {
    if (this.phase !== 'playing') return;
    // The true ending of the Ashen Caldera: the Dragonsheart for everyone, and a new hero to unlock.
    if (slain !== undefined && slain === this.map.finale?.boss) {
      this.victor = this.map.finale.bossName;
      for (const p of this.humans()) {
        const find = giveArtifact(p.profile, 'dragonsheart');
        p.loot.push(find);
        p.found.push(find);
        p.sounds.push('relic');
        this.log(`${p.name} claimed the Dragonsheart`, 'good');
        if (!p.profile.dragonmancer) {
          p.profile.dragonmancer = true;
          if (!this.feats.includes(DRAGONMANCER_FEAT)) this.feats.push(DRAGONMANCER_FEAT);
        }
        if (!(p.profile.heroes ?? []).includes('dragonmancer')) p.profile.heroes = [...(p.profile.heroes ?? []), 'dragonmancer'];
      }
    }
    // The spoils: artifacts still lying around are found, and the boss leaves one for everyone.
    for (const c of this.pickups) {
      if (c.kind !== PickupKind.Artifact || c.dead) continue;
      c.dead = true;
      this.grantArtifacts(TIER_IDS[c.value]);
    }
    this.grantArtifacts(rollTier('boss', this.lootIndex()));
    let unlockedMap: string | null = null;
    if (this.hard) {
      if (this.mapIndex + 1 < CAMPAIGN && this.hardUnlocked < this.mapIndex + 2) {
        this.hardUnlocked = this.mapIndex + 2;
        this.options.onHardUnlock?.(this.hardUnlocked);
        unlockedMap = `${MAPS[this.mapIndex + 1].name} (Hard)`;
      }
    } else {
      if (this.mapIndex + 1 < CAMPAIGN && this.unlocked < this.mapIndex + 2) {
        this.unlocked = this.mapIndex + 2;
        this.options.onUnlock(this.unlocked);
        unlockedMap = MAPS[this.mapIndex + 1].name;
      }
      // Slaying Mordak opens hard mode, from the first map.
      if (slain !== undefined && slain === this.map.finale?.boss && this.hardUnlocked < 1) {
        this.hardUnlocked = 1;
        this.options.onHardUnlock?.(1);
        this.feats.push(HARD_FEAT);
      }
    }
    this.endGame(true, unlockedMap);
  }

  /** Artifact drops roll as if on this map (on hard mode, as if a few maps further along). */
  private lootIndex(): number {
    return this.mapIndex + (this.hard ? HARD.luck : 0);
  }

  private alivePlayers(): Player[] {
    return [...this.players.values()].filter((p) => !p.downed);
  }

  /** A player's stats, including their buffs and the active Altar event. */
  private stats(p: Player): PlayerStats {
    const stats = playerStats(p.upgrades, p.character, p.profile.ranks, p.artifact);
    if (p.rage > 0) {
      stats.damageMult *= RAGE.damage;
      stats.cooldownMult *= RAGE.cooldown;
      stats.regen += stats.maxHp * RAGE.regen;
      stats.lifesteal += RAGE.lifesteal;
      stats.lifestealCap += RAGE.lifestealCap;
    }
    if (p.elixir > 0) {
      stats.damageMult *= ELIXIR.damage;
      stats.cooldownMult *= ELIXIR.cooldown;
      stats.speed *= ELIXIR.speed;
      stats.armor = 1 - (1 - stats.armor) * (1 - ELIXIR.reduction);
    }
    if (p.dragonForm > 0) {
      stats.damageMult *= DRAGON_FORM.damage;
      stats.maxHp = Math.round(stats.maxHp * DRAGON_FORM.maxHp);
      stats.speed *= DRAGON_FORM.speed;
      stats.area *= DRAGON_FORM.area;
      stats.armor = 1 - (1 - stats.armor) * (1 - DRAGON_FORM.reduction);
    }
    if (p.guard > 0) stats.armor = 1 - (1 - stats.armor) * (1 - p.guardReduction);
    const frenzy = p.frenzy > 0 && p.artifact ? artifactDef(p.artifact).active?.frenzy : undefined;
    if (frenzy) {
      stats.cooldownMult /= 1 + frenzy.attackSpeed;
      stats.speed *= 1 + frenzy.speed;
    }
    if (p.veil > 0) stats.speed *= 1 + veilStats(p.upgrades.veil ?? 1).speed;
    switch (this.event?.kind) {
      case 'frenzy':
        stats.damageMult *= 2;
        break;
      case 'haste':
        stats.speed *= 1.35;
        stats.cooldownMult *= 0.65;
        break;
      case 'vacuum':
        stats.magnet = 5000;
        break;
    }
    return stats;
  }

  private banner(text: string, tone: 'danger' | 'good'): void {
    this.fx.push({ k: 'banner', text, tone });
  }

  /** A line in everyone's event log (without a banner). */
  private log(text: string, tone: LogTone = 'info'): void {
    this.fx.push({ k: 'log', text, tone });
  }

  // --- Level-up pause ---

  private updatePause(dt: number): void {
    const pause = this.pause;
    if (pause?.kind !== 'choose') return;
    pause.timeLeft -= dt;
    const undecided = [...this.players.values()].filter((p) => p.options);
    if (pause.timeLeft <= 0) {
      // Out of time: pick for whoever is still deciding (at the Armory, they keep what they have).
      for (const p of undecided) {
        if (pause.reason === 'armory') {
          p.options = null;
          p.swapOut = null;
        } else {
          this.applyUpgrade(p, p.options![Math.floor(Math.random() * p.options!.length)]);
        }
      }
    } else if (undecided.length > 0) {
      return;
    }
    this.choices.shift();
    if (this.choices.length > 0) {
      this.startChoosing();
    } else {
      // Everyone has picked: straight back into the action, easing in from slow motion.
      this.pause = null;
      this.slowMotion(SLOWMO.start, 0, SLOWMO.duration);
    }
  }

  private startChoosing(): void {
    while (this.choices.length > 0) {
      const reason = this.choices[0];
      let anyOptions = false;
      for (const p of this.players.values()) {
        p.options = this.rollOptions(p, reason);
        if (p.options) anyOptions = true;
      }
      if (anyOptions) {
        this.pause = { kind: 'choose', timeLeft: CHOOSE_TIME, reason };
        return;
      }
      // Nobody has anything left to pick: no pause for this one.
      this.choices.shift();
    }
  }

  private rollOptions(p: Player, reason: ChoiceReason): ChoiceId[] | null {
    p.swapOut = null;
    if (reason === 'armory') {
      // First, which weapon to trade in (or keep them all, for a little gold). Then see armoryOffers.
      const owned = ownedWeapons(p.upgrades);
      return owned.length > 0 && this.armoryOffers(p).length > 0 ? [...owned, 'bonusGold'] : null;
    }
    // Anything owned and not maxed, plus new things while there are free slots.
    const offerable = offerableUpgrades(p.upgrades, p.character);
    if (reason === 'forge') {
      // Max-level weapons and E abilities can evolve; otherwise it's a regular weapon upgrade (or a new weapon).
      const evolve = shuffle(
        (Object.keys(p.upgrades) as UpgradeId[]).filter((id) => UPGRADES[id].kind === 'weapon' && p.upgrades[id] === MAX_LEVEL && UPGRADES[id].evolution),
      );
      const improve = weightedOrder(
        offerable.filter((id) => UPGRADES[id].kind === 'weapon'),
        (id) => offerWeight(id, p.character),
      );
      const options = [...evolve, ...improve].slice(0, 3);
      if (options.length > 0) return options;
      // Every weapon is already evolved: fall back to a normal pick.
    }
    // Weapons of the hero's own damage type come up more often (see OFFER_WEIGHT).
    const candidates: ChoiceId[] = weightedOrder(offerable, (id) => offerWeight(id, p.character)).slice(0, 3);
    // Running out of things to upgrade: a heal or some gold fills the list.
    for (const bonus of ['bonusHeal', 'bonusGold'] as const) if (candidates.length < 3) candidates.push(bonus);
    return candidates;
  }

  private choose(p: Player, index: number): void {
    if (this.pause?.kind !== 'choose' || !p.options || !Number.isInteger(index)) return;
    const id = p.options[index];
    if (!id) return;
    if (this.pause.reason === 'armory' && !isBonus(id)) {
      this.armory(p, id);
      return;
    }
    this.applyUpgrade(p, id);
  }

  /** New weapons the Armory can offer this player: any ordinary weapon they don't have (their hero's own type first). */
  private armoryOffers(p: Player): UpgradeId[] {
    const fresh = upgradesFor(p.character).filter((id) => UPGRADES[id].kind === 'weapon' && !UPGRADES[id].owner && !p.upgrades[id]);
    return weightedOrder(fresh, (id) => offerWeight(id, p.character)).slice(0, 3);
  }

  /**
   * The Armory, step by step: picking a weapon you carry trades it in (you're then offered three new ones); picking
   * one of those takes it, at the level the old one had (an evolved weapon's replacement comes at max level, ready
   * for a Forge).
   */
  private armory(p: Player, id: UpgradeId): void {
    if (!p.swapOut) {
      if (!p.upgrades[id]) return;
      p.swapOut = id;
      p.options = this.armoryOffers(p);
      if (p.options.length === 0) {
        p.options = null;
        p.swapOut = null;
      }
      // A moment more to choose.
      if (this.pause?.kind === 'choose') this.pause.timeLeft = Math.max(this.pause.timeLeft, 10);
      return;
    }
    const out = p.swapOut;
    const level = Math.min(MAX_LEVEL, p.upgrades[out] ?? 1);
    delete p.upgrades[out];
    delete p.cooldowns[out as WeaponId];
    // The Wolf Pack's wolves leave with it.
    if (out === 'wolves') for (const m of this.summons) if (m.owner === p.id && m.pack) m.dead = true;
    p.upgrades[id] = level;
    p.swapOut = null;
    p.options = null;
    p.sounds.push('relic');
    this.log(`${p.name} traded ${UPGRADES[out].name} for ${UPGRADES[id].name}`, 'good');
  }

  private applyUpgrade(p: Player, id: ChoiceId): void {
    if (isBonus(id)) {
      if (id === 'bonusHeal') {
        this.heal(p, this.stats(p).maxHp * BONUS.heal);
        p.sounds.push('heal');
      } else {
        p.profile.gold = (p.profile.gold ?? 0) + BONUS.gold;
        p.sounds.push('coin');
      }
      p.options = null;
      return;
    }
    p.upgrades[id] = (p.upgrades[id] ?? 0) + 1;
    if (id === 'vitality') p.hp += 20;
    p.options = null;
  }

  // --- Simulation ---

  private update(dt: number): void {
    this.time += dt;
    if (this.event) {
      this.event.timeLeft -= dt;
      if (this.event.timeLeft <= 0) this.event = null;
    }
    const frozen = this.event?.kind === 'freeze';
    const alive = this.alivePlayers();
    // Enemies path toward players they can see (Shadow Veil hides you).
    const visible = alive.filter((p) => p.veil <= 0);
    if (this.tickCount % FLOW_INTERVAL === 0 && visible.length > 0) this.flow.update(visible);
    this.updateBoss(dt, alive);
    if (this.dying) this.updateDying(dt);
    else if (this.bossPhase === 'fight') this.updateBossFight(dt, alive);
    if (!this.dying) this.spawnEnemies(dt, alive);
    this.spawnCrates(dt, alive);
    this.updateShrines(dt, alive);
    this.updateQuest(dt, alive);
    this.rebuildGrid();
    this.moveEnemies(dt, alive);
    if (this.map.sealed) for (const e of this.enemies) if (!e.dead) this.keepOutOfSealed(e, ENEMY_TYPES[e.type].radius, false);
    this.updateFlights(dt);
    this.attachParts();
    this.rebuildGrid();
    for (const p of this.players.values()) this.updatePlayer(p, dt);
    this.updateSummons(dt);
    this.updateProjectiles(dt);
    this.updateBlasts(dt);
    this.updateZones(dt);
    if (!frozen) {
      // Deep Freeze stops enemy attacks in mid-air, too.
      this.updateEnemyShots(dt);
      this.updateHazards(dt);
    }
    this.updateGems(dt);
    this.levelUp();
    this.updateHearts();
    this.updateCoins(dt);
    this.updateArtifacts();
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.pickups = this.pickups.filter((c) => !c.dead);
    if (this.players.size > 0 && this.alivePlayers().length === 0) this.endGame(false);
    else if (this.phase === 'playing' && this.choices.length > 0) this.startChoosing();
  }

  /** Bosses shrug off Deep Freeze entirely. */
  private isStunned(e: Enemy): boolean {
    return (this.event?.kind === 'freeze' && !this.isBoss(e)) || e.stunUntil > this.time;
  }

  private isBoss(e: Enemy): boolean {
    return ENEMY_TYPES[e.type].radius >= 50;
  }

  /**
   * Stuns an enemy. Bosses only take a fraction of the stun and then can't be stunned again for a while,
   * so stun builds (Earthshatter, Chrono Freeze) can't lock them down for a whole fight.
   */
  private stun(e: Enemy, seconds: number): void {
    if (this.isBoss(e)) {
      if (this.time < e.stunImmuneUntil) return;
      seconds *= BOSS_STUN.share;
      e.stunImmuneUntil = this.time + seconds + BOSS_STUN.immunity;
    }
    e.stunUntil = Math.max(e.stunUntil, this.time + seconds);
  }

  private rebuildGrid(): void {
    this.grid.clear();
    // A burrowed (or flying) boss can't be hit or touched, and neither can one that's already dying.
    for (const e of this.enemies) if (!e.burrowed && !e.corpse) this.grid.insert(e);
  }

  private spawnEnemies(dt: number, alive: Player[]): void {
    if (alive.length === 0) return;
    if (this.hordeHeldBack()) return;
    // More enemies over time, and more with more players. Fewer while fighting the boss out in the open.
    // A solo player faces 65% of the base rate; each extra player adds 45%.
    let perSecond = this.horde().spawnRate * (0.2 + 0.45 * this.players.size);
    if (this.bossPhase === 'fight') perSecond *= BOSS_FIGHT_HORDE;
    else if (this.warlord()) perSecond *= WARLORD_FIGHT.horde;
    this.spawnAcc += perSecond * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.length < MAX_ENEMIES) this.spawnEnemy(this.pickEnemyType(), alive);
    }
    // Warlords every few minutes, but not right before the final boss.
    if (this.time >= this.nextBossAt) {
      this.nextBossAt += BOSS_INTERVAL;
      if (this.time < this.bossTime - 30) this.warlordArrives(alive);
    }
  }

  /** The mini-boss: the horde out of sight scatters so the team can focus on the Warlord. */
  private warlordArrives(alive: Player[]): void {
    const far = (e: Enemy) => alive.every((p) => dist2(p.x, p.y, e.x, e.y) > WARLORD_FIGHT.clear ** 2);
    for (const e of this.enemies) {
      if (e.dead || this.isBoss(e) || e.missionTarget || e.id === this.quest?.targetId || !far(e)) continue;
      e.dead = true;
      if (e.hazard) e.hazard.dead = true;
    }
    this.spawnEnemy(EnemyType.Warlord, alive);
    this.banner('A Warlord approaches!', 'danger');
  }

  /** The Warlord that's out, if any. */
  private warlord(): Enemy | undefined {
    return this.enemies.find((e) => e.type === EnemyType.Warlord && !e.dead);
  }

  /**
   * No more horde: in a boss arena it's just the boss and its minions, and on lava maps the horde stops coming once
   * the lava starts closing in.
   */
  private hordeHeldBack(): boolean {
    if (this.endless) return false;
    if (this.map.lava) return this.bossPhase !== 'waiting';
    return this.bossPhase === 'fight' && this.map.arena !== null;
  }

  /** Not in the lava, with room to spare. Always true on maps without lava. */
  private dry(x: number, y: number, radius: number): boolean {
    const lava = this.map.lava;
    return !lava || dist2(x, y, lava.x, lava.y) < (this.lavaR - radius - 40) ** 2;
  }

  /** The nearest dry spot to (x, y). */
  private ashore(x: number, y: number, radius: number): { x: number; y: number } {
    if (this.finaleGround()) return this.onFinaleGround(x, y, radius) ? { x, y } : this.nearestGround(x, y, radius);
    const lava = this.map.lava;
    if (!lava || this.dry(x, y, radius)) return { x, y };
    const d = Math.hypot(x - lava.x, y - lava.y) || 1;
    const max = Math.max(0, this.lavaR - radius - 40);
    return { x: lava.x + ((x - lava.x) / d) * max, y: lava.y + ((y - lava.y) / d) * max };
  }

  /** Weighted random pick among the enemy types unlocked by now, adjusted by the map's mix. */
  private pickEnemyType(): number {
    const elite = this.horde().elite;
    const available = ENEMY_TYPES.map((def, type) => ({
      type,
      weight: this.time >= def.spawnAfter ? def.weight * (this.map.enemyWeights[type] ?? 1) * (def.elite ? elite : 1) : 0,
    }));
    let r = Math.random() * available.reduce((sum, a) => sum + a.weight, 0);
    for (const { type, weight } of available) {
      r -= weight;
      if (weight > 0 && r < 0) return type;
    }
    return EnemyType.Grunt;
  }

  /**
   * A random free spot `minDist`–`maxDist` from a random living player: inside the map, not in a wall,
   * and reachable on foot.
   */
  /**
   * A spot `minDist` to `maxDist` from one of the players (picked at random), never close to any of them: it has to
   * end up far from everyone even after it's moved out of the lava and out of walls. Of the spots tried, the first
   * one that's good enough wins; otherwise the one farthest from the nearest player.
   */
  private pointNear(alive: Player[], minDist: number, maxDist: number, radius = 20): { x: number; y: number } {
    const near = alive[Math.floor(Math.random() * alive.length)];
    const nearest = (x: number, y: number) => Math.min(...alive.map((p) => Math.hypot(p.x - x, p.y - y)));
    let best: { x: number; y: number } | null = null;
    let bestGap = -Infinity;
    for (let attempt = 0; attempt < 48; attempt++) {
      // Cramped (a corner, the lava): after a while, try farther out, around anyone.
      const from = attempt < 24 ? near : alive[attempt % alive.length];
      const reach = attempt < 24 ? maxDist : maxDist * 1.6;
      const angle = Math.random() * Math.PI * 2;
      const distance = minDist + Math.random() * (reach - minDist);
      const tx = clamp(from.x + Math.cos(angle) * distance, radius, this.map.width - radius);
      const ty = clamp(from.y + Math.sin(angle) * distance, radius, this.map.height - radius);
      const ashore = this.ashore(tx, ty, radius);
      const spot = pushOut(this.walls, ashore.x, ashore.y, radius);
      // Only ever somewhere it may be (checked where it ends up, after being moved out of the lava and walls).
      if (!this.openGround(spot.x, spot.y, radius)) continue;
      const gap = nearest(spot.x, spot.y);
      if (gap >= minDist * 0.8) return spot;
      if (gap > bestGap) {
        bestGap = gap;
        best = spot;
      }
    }
    if (best) return best;
    // Nowhere good at random: search outward from a player, ring by ring, for the first open spot.
    for (let d = Math.max(60, minDist * 0.5); d < maxDist * 2; d += 60) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = clamp(near.x + Math.cos(a) * d, radius, this.map.width - radius);
        const y = clamp(near.y + Math.sin(a) * d, radius, this.map.height - radius);
        if (this.openGround(x, y, radius)) return { x, y };
      }
    }
    return { x: near.x, y: near.y };
  }

  /**
   * Can something `radius` across be put at (x, y)? On dry ground, clear of walls, somewhere the team can walk to, never
   * in the ground walled off beside the boss arena, and not in the arena itself before the boss is due.
   */
  private openGround(x: number, y: number, radius: number): boolean {
    if (!this.dry(x, y, radius) || overlapsWall(this.walls, x, y, radius) || inSealed(this.map, x, y)) return false;
    const arena = this.map.arena;
    if (arena && this.bossPhase === 'waiting' && insideArena(arena, x, y, -radius - 80)) return false;
    return this.flow.distanceAt(x, y) < Infinity;
  }

  private spawnEnemy(type: number, alive: Player[], minDist = SPAWN_DISTANCE, maxDist = SPAWN_DISTANCE + 200): Enemy {
    const { x, y } = this.pointNear(alive, minDist, maxDist, ENEMY_TYPES[type].radius);
    // Enemies toughen up over time. Spawn rate already scales with player count, so only
    // single special enemies (warlords, the thief) get extra HP for it.
    let hp = this.enemyHp(type);
    if (type === EnemyType.Warlord || type === EnemyType.Thief) {
      // One-off enemies grow steadily rather than steeply, or the last warlord would rival the final boss.
      hp = ENEMY_TYPES[type].hp * (1 + 7 * Math.min(1, this.time / this.bossTime)) * this.difficulty();
      hp *= 1 + 0.35 * (this.players.size - 1);
      return this.addEnemy(type, x, y, hp);
    }
    // Later on, some spawns are champions with an affix.
    const progress = this.time / this.bossTime;
    const chance = progress < CHAMPION.from ? 0 : CHAMPION.minChance + (CHAMPION.maxChance - CHAMPION.minChance) * Math.min(1, (progress - CHAMPION.from) / (1 - CHAMPION.from));
    const champion = Math.random() < chance;
    const e = this.addEnemy(type, x, y, champion ? hp * CHAMPION.hp : hp);
    if (champion) e.affix = 1 + Math.floor(Math.random() * (AFFIXES.length - 1));
    return e;
  }

  /** How tough the horde is right now (see hordeScaling). */
  private horde() {
    const progress = this.time / this.bossTime;
    const base = hordeScaling(progress);
    if (!this.endless || progress <= 1.2) return base;
    // Endless, past where a normal run's growth stops: tougher, harder-hitting and a little more of it, without end.
    const over = progress - 1.2;
    return {
      ...base,
      hp: base.hp * (1 + 1.6 * over + 1.2 * over * over),
      damage: base.damage * (1 + 0.8 * over),
      spawnRate: base.spawnRate * Math.min(1.6, 1 + 0.3 * over),
      speed: Math.min(1.45, base.speed * (1 + 0.1 * over)),
    };
  }

  /** Multiplier on an enemy's damage: it grows over the run (named bosses have their own) and with the map's difficulty. */
  private damageScale(e: Enemy): number {
    const behavior = ENEMY_TYPES[e.type].behavior;
    // Fewer-but-tougher only applies to the horde, not to one-off enemies like warlords.
    const horde = behavior === 'boss' || behavior === 'flee' ? this.horde().damage * HORDE_DENSITY ** 0.7 : this.horde().damage;
    const scale = behavior === 'named' ? BOSS_POWER.damage * this.bossMods(e).damage : horde;
    return scale * this.difficulty() ** DIFFICULTY_DAMAGE * (e.affix ? CHAMPION.damage : 1) * (this.hard ? HARD.damage : 1);
  }

  /** A regular enemy's health at this point in the run, on this map. */
  private enemyHp(type: number): number {
    return ENEMY_TYPES[type].hp * this.horde().hp * this.difficulty();
  }

  private addEnemy(type: number, x: number, y: number, hp: number): Enemy {
    // Reaching a boss unlocks its bestiary entry for everyone here, win or lose.
    if (isBossType(type)) {
      let changed = false;
      for (const p of this.humans()) changed = noteBoss(p.profile, ENEMY_TYPES[type].name) || changed;
      if (changed) this.options.onProfiles?.();
    }
    const enemy: Enemy = {
      id: this.nextId++,
      type,
      x,
      y,
      hp,
      maxHp: hp,
      flashUntil: 0,
      orbitHitUntil: 0,
      emberHitUntil: 0,
      stunUntil: 0,
      slowUntil: 0,
      stunImmuneUntil: 0,
      dead: false,
      // Stagger first attacks so enemies spawned together don't fire together.
      attackTimer: 1 + Math.random() * (ENEMY_TYPES[type].behavior === 'lobber' ? BOMBARDIER.cooldown : 2),
      attackIndex: 0,
      mode: Mode.Normal,
      modeTimer: 0,
      dirX: 0,
      dirY: 0,
      charged: new Set(),
      hazard: null,
      strafe: Math.random() < 0.5 ? 1 : -1,
      tauntBy: 0,
      tauntUntil: 0,
      chargeWidth: 0,
      enraged: false,
      vengeful: false,
      missionTarget: false,
      affix: Affix.None,
      burrowed: false,
      shell: false,
      exposedUntil: 0,
      linked: false,
      channelUntil: 0,
      feeder: false,
      voiceAt: 0,
      corpse: false,
      partOf: null,
      side: 0,
      parts: [],
      facing: 0,
      flight: null,
      volleys: 0,
      volleyAt: 0,
      wingsLost: 0,
      head: 0,
      tail: 0,
      tailSwipe: null,
      tailReadyAt: 0,
      roostUntil: 0,
      roostLobAt: 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  // --- Final boss ---

  private updateBoss(dt: number, alive: Player[]): void {
    const arena = this.map.arena;
    const lava = this.map.lava;
    if (this.endless) {
      // Endless: the boss comes in waves, out in the open (no arena to gather in, no lava closing in).
      if (this.bossPhase === 'waiting' && this.time >= this.nextWaveAt && alive.length > 0) this.startBossFight(alive, true);
      if (lava) this.updateLava(dt, alive);
      return;
    }
    if (this.bossPhase === 'waiting' && this.time >= this.bossTime) {
      if (arena) {
        this.bossPhase = 'gather';
        this.safeRadius = zoneStart(arena, this.map.width, this.map.height);
        this.setGate(false);
        this.banner(`The gates are open! ${mapBossName(this.map)} ${this.map.twin ? 'await' : 'awaits'}. The fire is closing in!`, 'danger');
      } else if (lava) {
        this.bossPhase = 'gather';
        this.banner('The lava is closing in! Get to the heart of the caldera!', 'danger');
      } else {
        this.startBossFight(alive);
      }
    }
    if (lava) this.updateLava(dt, alive);
    if (this.finale && !this.dying) this.updateFinale(dt, alive);
    if (!arena || this.bossPhase === 'waiting') return;

    // The burning zone sweeps in from the edges of the map until only the arena is safe.
    const shrink = (zoneStart(arena, this.map.width, this.map.height) - arena.zone) / ZONE_SWEEP_TIME;
    this.safeRadius = Math.max(arena.zone, this.safeRadius - shrink * dt);
    for (const p of alive) {
      // Fully inside the arena? Then you're locked in.
      if (!p.inArena && insideArena(arena, p.x, p.y, PLAYER_RADIUS)) {
        p.inArena = true;
        if (this.bossPhase === 'gather') this.startBossFight(alive);
      }
      // Anyone the fire has caught up with burns.
      if (!p.inArena && !inZone(arena, p.x, p.y, this.safeRadius)) {
        this.hurtPlayer(p, this.stats(p).maxHp * ZONE_DAMAGE * dt, true);
      }
    }
    // The gate slams shut once everyone still standing is inside, and opens again for anyone left out.
    const shut = this.bossPhase === 'fight' && alive.length > 0 && alive.every((p) => p.inArena);
    if (shut !== this.gateShut) {
      this.setGate(shut);
      // Everyone's in: the fire has done its job and closes in all the way.
      if (shut) this.safeRadius = arena.zone;
      this.log(shut ? 'The gates slam shut behind you' : 'The gates open for a straggler');
    }
  }

  /**
   * Lava maps: anyone past the rim burns. When the boss is due the rim closes in on the middle, burning away the
   * horde that no longer fits, and once it's done the boss arrives there.
   */
  private updateLava(dt: number, alive: Player[]): void {
    const lava = this.map.lava!;
    if (this.bossPhase === 'gather') {
      this.lavaR = Math.max(lava.final, this.lavaR - ((lava.r - lava.final) / LAVA_CLOSE_TIME) * dt);
      this.thinHorde(alive);
      if (this.lavaR <= lava.final) this.startBossFight(alive);
    }
    const r2 = this.lavaR ** 2;
    // After the finale's ground gives way, only the stones and the den are safe.
    const ground = this.finaleGround();
    const safe = (x: number, y: number) => (ground ? this.onFinaleGround(x, y) : dist2(x, y, lava.x, lava.y) <= r2);
    for (const p of this.players.values()) {
      if (safe(p.x, p.y)) continue;
      if (p.downed) {
        // The fallen wash up on the edge, where they can still be revived.
        const shore = this.ashore(p.x, p.y, PLAYER_RADIUS);
        ({ x: p.x, y: p.y } = pushOut(this.walls, shore.x, shore.y, PLAYER_RADIUS));
        p.epoch++;
      } else {
        this.hurtPlayer(p, this.stats(p).maxHp * LAVA_DAMAGE.player * dt, true);
      }
    }
    for (const e of this.enemies) {
      if (e.dead || e.corpse || safe(e.x, e.y)) continue;
      // The dragon and his wings are at home over the lava.
      if (ground && (this.isBoss(e) || e.partOf)) continue;
      this.damageEnemy(e, e.maxHp * (this.isBoss(e) ? LAVA_DAMAGE.boss : LAVA_DAMAGE.enemy) * dt, undefined, 'true');
    }
  }

  /** While the lava closes in there isn't room for the whole horde: the ones farthest from the team burn up first. */
  private thinHorde(alive: Player[]): void {
    const lava = this.map.lava!;
    if (alive.length === 0) return;
    const room = Math.max(LAVA_CROWD.min + LAVA_CROWD.perPlayer * this.players.size, Math.round(LAVA_CROWD.full * (this.lavaR / lava.r) ** 2));
    const horde = this.enemies.filter((e) => !e.dead && !this.isBoss(e) && !e.missionTarget && e.id !== this.quest?.targetId);
    if (horde.length <= room) return;
    const near = (e: Enemy) => Math.min(...alive.map((p) => dist2(p.x, p.y, e.x, e.y)));
    const doomed = horde
      .map((e) => ({ e, d: near(e) }))
      .sort((a, b) => b.d - a.d)
      .slice(0, Math.min(LAVA_CROWD.perTick, horde.length - room));
    for (const { e } of doomed) {
      e.dead = true;
      if (e.hazard) e.hazard.dead = true;
      this.fx.push({ k: 'ring', x: Math.round(e.x), y: Math.round(e.y), r: Math.round(ENEMY_TYPES[e.type].radius * 1.8), c: 0xff6d00 });
    }
  }

  private startBossFight(alive: Player[], open = false): void {
    this.bossPhase = 'fight';
    if (open) this.wave++;
    const { boss: type, twin, name } = this.endless ? waveBoss(this.map, this.wave) : { boss: this.map.boss, twin: this.map.twin, name: mapBossName(this.map) };
    if (open) {
      this.fightTime = 0;
      this.berserk = 0;
      this.mission = null;
      this.missionsStarted = 0;
    }
    // In the arena, or the middle of the lava ring (or, `open`, near the team: endless mode's waves).
    const arena = open ? null : (this.map.arena ?? this.map.lava);
    let x: number;
    let y: number;
    if (arena) {
      // The horde scatters; it's just you and the boss now.
      for (const e of this.enemies) e.dead = true;
      this.enemyShots = [];
      this.hazards = [];
      this.shrines = [];
      this.quest = null;
      ({ x, y } = arena);
    } else {
      ({ x, y } = this.pointNear(alive, 450, 650, ENEMY_TYPES[type].radius));
      // The horde scatters: only the few enemies closest to the team stay to fight.
      const near = (e: Enemy) => Math.min(...alive.map((p) => dist2(p.x, p.y, e.x, e.y)));
      const stay = new Set(
        this.enemies
          .filter((e) => !e.dead)
          .sort((a, b) => near(a) - near(b))
          .slice(0, BOSS_FIGHT_STAY),
      );
      for (const e of this.enemies) if (!stay.has(e)) e.dead = true;
    }
    this.tether = null;
    this.hinted.clear();
    const types = twin !== undefined ? [type, twin] : [type];
    this.bosses = types.map((t, i) => {
      const offset = types.length > 1 ? (i === 0 ? -160 : 160) : 0;
      const spot = pushOut(this.walls, x + offset, y, ENEMY_TYPES[t].radius);
      const waveHp = this.endless ? endlessWave(this.wave).hp : 1;
      const hp = ENEMY_TYPES[t].hp * BOSS_POWER.hp * (1 + 0.85 * (this.players.size - 1)) * this.difficulty() * waveHp;
      const boss = this.addEnemy(t, spot.x, spot.y, hp);
      boss.attackTimer = 2 + i;
      return boss;
    });
    this.banner(this.endless ? `Wave ${this.wave}: ${name}!` : `${name}!`, 'danger');
    // The entrance: everything slows down while the camera shows the boss (or the middle of the twins).
    const bx = this.bosses.reduce((s, b) => s + b.x, 0) / this.bosses.length;
    const by = this.bosses.reduce((s, b) => s + b.y, 0) / this.bosses.length;
    this.fx.push({ k: 'intro', x: Math.round(bx), y: Math.round(by) });
    this.slowMotion(BOSS_INTRO.speed, BOSS_INTRO.hold, BOSS_INTRO.ease);
  }

  /** The berserk clock and side missions. */
  private updateBossFight(dt: number, alive: Player[]): void {
    this.fightTime += dt;
    if (this.bosses.length === 2) this.updateTwins(dt, alive);
    // Bosses with a voice speak up every so often (the Reaper whispers, Sylvara hisses).
    for (const [i, b] of this.bosses.entries()) {
      const voice = NAMED_BOSSES[b.type]?.voice;
      if (!voice || b.dead) continue;
      // Twins take turns: the second one first speaks up a while after the first.
      if (b.voiceAt === 0) b.voiceAt = this.fightTime + BOSS_VOICE_FIRST + i * (voice.every[0] / 2);
      if (this.fightTime < b.voiceAt) continue;
      b.voiceAt = this.fightTime + voice.every[0] + Math.random() * (voice.every[1] - voice.every[0]);
      this.fx.push({ k: 'voice', snd: voice.sound, x: Math.round(b.x), y: Math.round(b.y) });
    }
    const stacks = this.berserkClock() ? Math.max(0, Math.floor((this.fightTime - BOSS_BERSERK.after) / BOSS_BERSERK.every) + 1) : 0;
    if (stacks > this.berserk) {
      this.berserk = stacks;
      this.banner(stacks === 1 ? 'Out of time! The boss goes berserk!' : `Berserk x${stacks}: it keeps getting stronger!`, 'danger');
      const boss = this.bosses.find((b) => !b.dead);
      if (boss) this.fx.push({ k: 'roar', x: Math.round(boss.x), y: Math.round(boss.y) });
    }

    if (this.mission) {
      this.updateMission(dt, alive);
      return;
    }
    // Shield up and start a side mission at each health threshold.
    const living = this.bosses.filter((b) => !b.dead);
    const threshold = BOSS_MISSIONS.at[this.missionsStarted];
    if (threshold !== undefined && living.length > 0 && this.bossHealthShare() < threshold) {
      this.missionsStarted++;
      this.startMission(alive);
    }
  }

  /** The bosses' combined health as a share of their combined max health (dead twins count as 0). */
  private bossHealthShare(): number {
    let hp = 0;
    let max = 0;
    for (const b of this.bosses) {
      hp += b.dead ? 0 : Math.max(0, b.hp);
      max += b.maxHp;
    }
    return max > 0 ? hp / max : 0;
  }

  private startMission(alive: Player[]): void {
    // Each boss has its own: a side mission, or Kharzak's shell.
    const lead = this.bosses.find((b) => !b.dead) ?? this.bosses[0];
    const phase = NAMED_BOSSES[lead.type]?.phase ?? pick(MISSION_KINDS);
    if (phase === 'none') return;
    if (phase === 'shell') {
      for (const b of this.bosses) if (!b.dead) b.shell = true;
      this.banner(`${ENEMY_TYPES[lead.type].name} hardens its shell! Bait its charge into a boulder to crack it!`, 'danger');
      return;
    }
    const kind = phase;
    this.lastMission = kind;
    // Around the arena, or the first living boss out in the open.
    const center = (this.endless ? null : (this.map.arena ?? this.map.lava)) ?? this.bosses.find((b) => !b.dead)!;
    const ids: number[] = [];
    const scale = 1 + 0.5 * (this.players.size - 1);
    switch (kind) {
      case 'wards':
        for (let i = 0; i < BOSS_MISSIONS.wards; i++) {
          const a = (i / BOSS_MISSIONS.wards) * Math.PI * 2 + Math.PI / 4;
          const spot = this.missionSpot(center, a, BOSS_MISSIONS.wardDistance, ENEMY_TYPES[EnemyType.Ward].radius);
          // Pinned to boss-time strength, so a long fight doesn't make the wards ever tougher.
          const hp = ENEMY_TYPES[EnemyType.Ward].hp * hordeScaling(1).hp * this.difficulty() * scale;
          const ward = this.addEnemy(EnemyType.Ward, spot.x, spot.y, hp);
          ward.missionTarget = true;
          ids.push(ward.id);
        }
        break;
      case 'sigils':
        for (let i = 0; i < BOSS_MISSIONS.sigils; i++) {
          const a = (i / BOSS_MISSIONS.sigils) * Math.PI * 2 - Math.PI / 2;
          const spot = this.missionSpot(center, a, BOSS_MISSIONS.sigilDistance, 40);
          const sigil: Shrine = { id: this.nextId++, kind: ShrineKind.Sigil, x: spot.x, y: spot.y, progress: 0, captured: false };
          this.shrines.push(sigil);
          ids.push(sigil.id);
        }
        break;
      case 'brood':
        for (let i = 0; i < BOSS_MISSIONS.brood; i++) {
          const a = (i / BOSS_MISSIONS.brood) * Math.PI * 2;
          const spot = this.missionSpot(center, a, 260 + Math.random() * 120, ENEMY_TYPES[EnemyType.Spirit].radius);
          const e = this.addEnemy(EnemyType.Spirit, spot.x, spot.y, this.enemyHp(EnemyType.Spirit) * BOSS_MISSIONS.broodHp * scale);
          e.missionTarget = true;
          ids.push(e.id);
        }
        break;
    }
    this.mission = { kind, total: ids.length, ids };
    this.banner(`The boss is shielded! ${MISSIONS[kind].goal}!`, 'danger');
  }

  /**
   * A free spot about `distance` from the center at roughly `angle`, inside the arena if there is one. Prefers spots
   * with a clear straight path from the center, so mission objects don't end up behind a wall.
   */
  private missionSpot(center: { x: number; y: number }, angle: number, distance: number, radius: number): { x: number; y: number } {
    const arena = this.fightArena();
    const reach = arena ? arenaReach(arena) : this.endless ? Infinity : (this.map.lava?.final ?? Infinity);
    const maxD = Math.min(distance, reach - radius - 30);
    const at = (a: number, d: number) => ({
      x: clamp(center.x + Math.cos(a) * d, radius, this.map.width - radius),
      y: clamp(center.y + Math.sin(a) * d, radius, this.map.height - radius),
    });
    const clear = (a: number, d: number) => {
      for (let step = 0; step <= d; step += 20) {
        const { x, y } = at(a, step);
        if (overlapsWall(this.walls, x, y, PLAYER_RADIUS)) return false;
      }
      const end = at(a, d);
      if (arena && !insideArena(arena, end.x, end.y, radius)) return false;
      return !overlapsWall(this.walls, end.x, end.y, radius);
    };
    for (const scale of [1, 0.75, 0.5]) {
      for (const turn of [0, 0.2, -0.2, 0.4, -0.4, 0.6, -0.6]) {
        if (clear(angle + turn, maxD * scale)) return at(angle + turn, maxD * scale);
      }
    }
    const { x, y } = at(angle, maxD);
    return pushOut(this.walls, x, y, radius);
  }

  /** Mission progress: how many of its targets are done. */
  private missionDone(m: Mission): number {
    if (m.kind === 'sigils') return m.total - this.shrines.filter((s) => s.kind === ShrineKind.Sigil).length;
    const alive = new Set(this.enemies.filter((e) => !e.dead && e.missionTarget).map((e) => e.id));
    return m.ids.filter((id) => !alive.has(id)).length;
  }

  private updateMission(dt: number, alive: Player[]): void {
    const m = this.mission!;
    if (m.kind === 'sigils') {
      for (const s of this.shrines) {
        if (s.kind !== ShrineKind.Sigil) continue;
        const inside = alive.filter((p) => dist2(p.x, p.y, s.x, s.y) < SHRINE_RADIUS ** 2).length;
        s.progress = Math.min(1, s.progress + (dt / BOSS_MISSIONS.sigilTime) * captureSpeed(inside));
        if (s.progress >= 1 && !s.captured) {
          s.captured = true;
          this.fx.push({ k: 'ring', x: Math.round(s.x), y: Math.round(s.y), r: SHRINE_RADIUS * 1.3, c: SHRINES[ShrineKind.Sigil].color, snd: 'pop' });
        }
      }
      this.shrines = this.shrines.filter((s) => !(s.kind === ShrineKind.Sigil && s.captured));
    }
    if (this.missionDone(m) >= m.total) {
      this.mission = null;
      this.shrines = this.shrines.filter((s) => s.kind !== ShrineKind.Sigil);
      for (const b of this.bosses) if (!b.dead) this.fx.push({ k: 'ring', x: Math.round(b.x), y: Math.round(b.y), r: 160, c: 0xe040fb, snd: 'explode' });
      this.banner('The shield breaks! Attack!', 'good');
    }
  }

  /**
   * The last final boss is down: it stays where it fell for its death animation (see BOSS_DEATH) while everything else
   * is swept away. Then the victory, or (on a map with a finale, the first time) the ground gives way.
   */
  private beginDeath(e: Enemy): void {
    e.dead = false;
    e.corpse = true;
    e.burrowed = false;
    e.flight = null;
    e.mode = Mode.Normal;
    for (const o of this.enemies) if (o !== e) o.dead = true;
    this.enemyShots = [];
    this.hazards = [];
    this.mission = null;
    const next = this.map.finale && e.type !== this.map.finale.boss ? 'finale' : 'victory';
    this.dying = { t: 0, x: e.x, y: e.y, corpse: e, shattered: false, next };
    this.log(`${bossDisplayName(e.type)} falls`, 'good');
  }

  /**
   * Endless: a boss wave is beaten. It breaks apart on the spot, its leftovers go with it, everyone gets an artifact,
   * the fallen get back up and everyone heals. The next wave comes ENDLESS.waveEvery seconds later.
   */
  private endWave(e: Enemy): void {
    const def = ENEMY_TYPES[e.type];
    this.fx.push({ k: 'shatter', x: Math.round(e.x), y: Math.round(e.y), r: def.radius, c: this.map.enemyColors?.[e.type] ?? def.color });
    this.fx.push({ k: 'quake', strength: 0.7 });
    for (const m of this.enemies) if (m.missionTarget || m.feeder || m.type === EnemyType.Egg) m.dead = true;
    this.shrines = this.shrines.filter((s) => s.kind !== ShrineKind.Sigil);
    this.hazards = [];
    this.bosses = [];
    this.bossPhase = 'waiting';
    this.mission = null;
    this.tether = null;
    this.berserk = 0;
    this.fightTime = 0;
    this.nextWaveAt = this.time + ENDLESS.waveEvery;
    for (const p of this.players.values()) {
      if (p.downed) {
        p.downed = false;
        p.revive = 0;
        p.hp = 0;
        this.log(`${p.name} is back up`, 'good');
      }
      this.heal(p, this.stats(p).maxHp * 0.5);
    }
    this.grantArtifacts(rollTier('boss', this.lootIndex()));
    this.log(`Wave ${this.wave} beaten: ${bossDisplayName(e.type)} falls`, 'good');
    this.banner(`Wave ${this.wave} beaten! The next comes in ${Math.round(ENDLESS.waveEvery / 60)} minutes, stronger`, 'good');
  }

  private updateDying(dt: number): void {
    const d = this.dying!;
    d.t += dt;
    // Nothing can touch the team while it plays out.
    for (const p of this.players.values()) p.invuln = Math.max(p.invuln, 0.3);
    if (!d.shattered && d.t >= BOSS_DEATH.shatter) {
      d.shattered = true;
      d.corpse.dead = true;
      const def = ENEMY_TYPES[d.corpse.type];
      this.fx.push({ k: 'shatter', x: Math.round(d.x), y: Math.round(d.y), r: def.radius, c: this.map.enemyColors?.[d.corpse.type] ?? def.color });
      this.fx.push({ k: 'quake', strength: 1 });
    }
    if (d.t < BOSS_DEATH.total) return;
    this.dying = null;
    if (d.next === 'finale') this.startFinale();
    else this.victory(d.corpse.type);
  }

  // --- The Ashen Caldera's true ending ---

  private startFinale(): void {
    this.bossPhase = 'finale';
    this.bosses = [];
    this.finale = { stage: 'crumble', t: 0, arrivedAt: -1, rockIn: 1, quakeIn: 0 };
    this.banner('The caldera is shaking apart!', 'danger');
  }

  /** Standing on something: one of the stepping stones, or the den. */
  private onFinaleGround(x: number, y: number, radius = 0): boolean {
    const f = this.map.finale!;
    if (dist2(x, y, f.den.x, f.den.y) < (f.den.r - radius) ** 2) return true;
    return f.stones.some((st) => dist2(x, y, st.x, st.y) < (st.r - radius) ** 2);
  }

  /** The nearest spot on the stones or in the den. */
  private nearestGround(x: number, y: number, radius: number): { x: number; y: number } {
    const f = this.map.finale!;
    let best = { x, y };
    let bestD = Infinity;
    for (const c of [f.den, ...f.stones]) {
      const d = Math.hypot(x - c.x, y - c.y) || 1;
      const inner = Math.max(0, c.r - radius - 6);
      const gap = Math.max(0, d - inner);
      if (gap < bestD) {
        bestD = gap;
        best = d <= inner ? { x, y } : { x: c.x + ((x - c.x) / d) * inner, y: c.y + ((y - c.y) / d) * inner };
      }
    }
    return best;
  }

  /** Lava everywhere but the stones and the den (once the ground has given way). */
  private finaleGround(): boolean {
    return !!this.finale && this.finale.stage !== 'crumble';
  }

  private updateFinale(dt: number, alive: Player[]): void {
    const fin = this.finale!;
    const f = this.map.finale!;
    fin.t += dt;
    if (fin.stage === 'crumble') {
      fin.quakeIn -= dt;
      if (fin.quakeIn <= 0) {
        fin.quakeIn = 0.8;
        this.fx.push({ k: 'quake', strength: 0.6 + fin.t / FINALE.crumble });
      }
      if (fin.t < FINALE.crumble) return;
      fin.stage = 'path';
      fin.t = 0;
      this.denShown = true;
      this.setGate(this.gateShut);
      this.fx.push({ k: 'quake', strength: 1.6 });
      this.fx.push({ k: 'ring', x: f.stones[0].x, y: f.stones[0].y, r: 900, c: 0xff6d00, snd: 'bigSlam' });
      this.banner('Only stepping stones are left! Dodge across them, and watch for falling rock!', 'danger');
      return;
    }
    if (fin.stage !== 'path') return;
    // Rocks rain down while the team crosses: on someone, or on a stone up ahead of them.
    fin.rockIn -= dt;
    if (fin.rockIn <= 0 && alive.length > 0) {
      fin.rockIn = FINALE.rockEvery;
      let x: number;
      let y: number;
      if (Math.random() < FINALE.rockAimed) {
        const p = pick(alive);
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 60;
        x = p.x + Math.cos(a) * d;
        y = p.y + Math.sin(a) * d;
      } else {
        // Ahead: nearer the den than anyone has got yet.
        const toDen = (q: { x: number; y: number }) => Math.hypot(q.x - f.den.x, q.y - f.den.y);
        const front = Math.min(...alive.map(toDen));
        const ahead = f.stones.filter((st) => toDen(st) < front + 50);
        const st = ahead.length > 0 ? pick(ahead) : pick(f.stones);
        x = st.x;
        y = st.y;
      }
      const damage = FINALE.rockDamage * this.difficulty() ** DIFFICULTY_DAMAGE;
      this.addHazard(HazardKind.Circle, x, y, FINALE.rockRadius, 0, 0, FINALE.rockDelay, damage);
    }
    // In the den: the dragon comes once everyone's there, or a while after the first one is.
    const inDen = alive.filter((p) => dist2(p.x, p.y, f.den.x, f.den.y) < f.den.r ** 2);
    if (inDen.length > 0 && fin.arrivedAt < 0) {
      fin.arrivedAt = fin.t;
      this.banner('Something stirs in the dark of the den...', 'danger');
      this.fx.push({ k: 'quake', strength: 0.8 });
    }
    const waited = fin.t - fin.arrivedAt;
    if (fin.arrivedAt >= 0 && ((inDen.length === alive.length && waited >= FINALE.stir) || waited >= FINALE.wait)) this.summonDragon();
  }

  /** Mordak lands in his den, wings and all. */
  private summonDragon(): void {
    const fin = this.finale!;
    const f = this.map.finale!;
    fin.stage = 'den';
    fin.t = 0;
    this.hazards = [];
    this.bossPhase = 'fight';
    this.fightTime = 0;
    this.berserk = 0;
    this.mission = null;
    this.missionsStarted = 0;
    this.hinted.clear();
    const type = f.boss;
    const hp = ENEMY_TYPES[type].hp * BOSS_POWER.hp * (1 + 0.85 * (this.players.size - 1)) * this.difficulty();
    // He lands at the far end of the den, facing the way the team came in (from the heart of the caldera).
    const heart = f.stones[f.route[0]];
    const away = Math.atan2(f.den.y - heart.y, f.den.x - heart.x);
    const boss = this.addEnemy(type, f.den.x + Math.cos(away) * f.den.r * 0.4, f.den.y + Math.sin(away) * f.den.r * 0.4, hp);
    boss.facing = away + Math.PI;
    boss.attackTimer = 1.5;
    for (const side of BOSS_MECHANICS.wings.enabled ? [-1, 1] : []) {
      const wing = this.addEnemy(EnemyType.DragonWing, boss.x, boss.y, hp * BOSS_MECHANICS.wings.hp);
      wing.partOf = boss;
      wing.side = side;
      boss.parts.push(wing);
    }
    this.bosses = [boss];
    this.attachParts();
    // The team, wherever they were, stands together at the edge of the den where they came in.
    const entry = Math.atan2(heart.y - f.den.y, heart.x - f.den.x);
    const team = this.alivePlayers();
    team.forEach((p, i) => {
      const along = (i - (team.length - 1) / 2) * 90;
      const spot = pushOut(this.walls, f.den.x + Math.cos(entry) * (f.den.r - 80) - Math.sin(entry) * along, f.den.y + Math.sin(entry) * (f.den.r - 80) + Math.cos(entry) * along, PLAYER_RADIUS);
      p.x = spot.x;
      p.y = spot.y;
      p.epoch++;
    });
    this.banner(`${f.bossName}!`, 'danger');
    // A moment of suspense: everything freezes while the camera finds him, and he roars before the fight begins.
    this.fx.push({ k: 'intro', x: Math.round(boss.x), y: Math.round(boss.y), dragon: true });
    this.slowMotion(DRAGON_INTRO.speed, DRAGON_INTRO.hold, DRAGON_INTRO.ease);
  }

  /** Parts ride along with what they're attached to (Mordak's wings, out to his sides). */
  private attachParts(): void {
    for (const e of this.enemies) {
      const owner = e.partOf;
      if (!owner || e.dead) continue;
      if (owner.dead || owner.corpse) {
        e.dead = true;
        continue;
      }
      const r = ENEMY_TYPES[owner.type].radius;
      const lx = -0.15 * r;
      const ly = e.side * 0.95 * r;
      const c = Math.cos(owner.facing);
      const sn = Math.sin(owner.facing);
      e.x = owner.x + lx * c - ly * sn;
      e.y = owner.y + lx * sn + ly * c;
      e.burrowed = owner.burrowed;
    }
  }

  /** A wing is torn off: Mordak reels and bleeds, and with both gone he can't fly any more. */
  private wingTorn(wing: Enemy): void {
    const boss = wing.partOf;
    if (!boss || boss.dead || boss.corpse) return;
    const M = BOSS_MECHANICS.wings;
    boss.wingsLost++;
    boss.parts = boss.parts.filter((w) => w !== wing);
    boss.stunUntil = Math.max(boss.stunUntil, this.time + M.stagger);
    boss.hp = Math.max(1, boss.hp - boss.maxHp * M.bodyDamage);
    boss.flashUntil = this.time + 0.3;
    const name = ENEMY_TYPES[boss.type].name;
    this.fx.push({ k: 'ring', x: Math.round(wing.x), y: Math.round(wing.y), r: 140, c: 0xff5252, snd: 'bigSlam' });
    this.fx.push({ k: 'roar', x: Math.round(boss.x), y: Math.round(boss.y) });
    this.banner(boss.wingsLost >= 2 ? `${name} can no longer take flight!` : `${name}'s wing is torn!`, 'good');
  }

  /** Mordak's fire flight: along his path, dropping fire, and down again at the end. */
  private updateFlights(dt: number): void {
    const M = BOSS_MECHANICS.flight;
    for (const e of this.enemies) {
      const fl = e.flight;
      if (!fl || e.dead) continue;
      const to = fl.path[fl.leg + 1];
      const dx = to.x - e.x;
      const dy = to.y - e.y;
      const d = Math.hypot(dx, dy);
      const step = M.speed * dt;
      e.facing = Math.atan2(dy, dx);
      if (d <= step) {
        e.x = to.x;
        e.y = to.y;
        fl.leg++;
        // A turn out over the lava: fire on everyone again, and a pack of his minions down among them.
        if (fl.leg < fl.path.length - 1) this.flightWave(e);
      } else {
        e.x += (dx / d) * step;
        e.y += (dy / d) * step;
      }
      fl.bombIn -= dt;
      if (fl.bombIn <= 0) {
        fl.bombIn = M.every;
        const a = Math.random() * Math.PI * 2;
        const j = Math.random() * 70;
        const scale = this.damageScale(e) * this.bossMods(e).area;
        this.addHazard(HazardKind.Circle, e.x + Math.cos(a) * j, e.y + Math.sin(a) * j, M.radius * this.bossMods(e).area, 0, 0, M.delay, M.damage * scale);
      }
      if (fl.leg >= fl.path.length - 1) {
        // Touchdown.
        e.flight = null;
        e.burrowed = false;
        e.attackTimer = 1.6;
        this.fx.push({ k: 'ring', x: Math.round(e.x), y: Math.round(e.y), r: 200, c: 0xff6d00, snd: 'bigSlam' });
      }
    }
  }

  /** How much stronger a final boss is from going berserk and from losing its twin. */
  private bossMods(e: Enemy): { damage: number; haste: number; area: number } {
    const s = this.berserk;
    const v = e.vengeful;
    return {
      damage: (1 + BOSS_BERSERK.damage * s) * (v ? BOSS_VENGEFUL.damage : 1) * (this.endless ? endlessWave(this.wave).damage : 1),
      haste: (1 + BOSS_BERSERK.haste * s) * (v ? BOSS_VENGEFUL.haste : 1) * (this.hard ? HARD.haste : 1),
      area: (1 + BOSS_BERSERK.area * s) * (v ? BOSS_VENGEFUL.area : 1) * (this.hard ? HARD.area : 1),
    };
  }

  /**
   * Mordak's head and tail. His head turns toward his target as far as his neck allows (during the fire beam it
   * follows the beam instead, see HazardKind.Sweep). Anyone behind him gets his tail: he cocks it to one side while a
   * cone shows where it will land, then lashes it across, hurting and throwing back whoever's there.
   */
  private dragonPose(e: Enemy, alive: Player[], ux: number, uy: number, dt: number): void {
    const H = BOSS_MECHANICS.head;
    const T = BOSS_MECHANICS.tail;
    const RO = BOSS_MECHANICS.roost;
    if (this.time < e.roostUntil && this.time >= e.roostLobAt) {
      e.roostLobAt = this.time + RO.every / this.bossMods(e).haste;
      const den = this.map.finale?.den ?? { x: e.x, y: e.y, r: 700 };
      let x: number;
      let y: number;
      if (alive.length > 0 && Math.random() < RO.aimed) {
        const p = pick(alive);
        const a = Math.random() * Math.PI * 2;
        x = p.x + Math.cos(a) * Math.random() * 90;
        y = p.y + Math.sin(a) * Math.random() * 90;
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * den.r * 0.92;
        x = den.x + Math.cos(a) * r;
        y = den.y + Math.sin(a) * r;
      }
      const mods = this.bossMods(e);
      this.addHazard(HazardKind.Circle, x, y, RO.radius * mods.area, 0, 0, RO.delay, RO.damage * this.damageScale(e));
      const mouth = this.dragonMouth(e);
      this.fx.push({ k: 'lob', x: Math.round(mouth.x), y: Math.round(mouth.y), tx: Math.round(x), ty: Math.round(y), t: RO.delay });
      // He looks where he throws.
      const look = Math.atan2(y - e.y, x - e.x) - e.facing;
      e.head = clamp(Math.atan2(Math.sin(look), Math.cos(look)), -H.reach, H.reach);
    }
    const sweeping = this.hazards.some((h) => h.kind === HazardKind.Sweep && h.owner === e && h.hit && !h.dead);
    if (!sweeping) {
      const want = clamp(Math.atan2(Math.sin(Math.atan2(uy, ux) - e.facing), Math.cos(Math.atan2(uy, ux) - e.facing)), -H.reach, H.reach);
      e.head += clamp(want - e.head, -H.turn * dt, H.turn * dt);
    }
    // The swipe under way: cock the tail away from its target, lash it across, then let it swing back.
    const sw = e.tailSwipe;
    if (sw) {
      sw.t += dt;
      const ease = (x: number) => x * x * (3 - 2 * x);
      // Cocked far to one side, then whipped all the way across the cone to the other.
      if (sw.t < T.windup) e.tail = -sw.side * 1.3 * ease(sw.t / T.windup);
      else if (sw.t < T.windup + 0.22) e.tail = -sw.side * 1.3 + sw.side * 3.1 * ease((sw.t - T.windup) / 0.22);
      else if (sw.t < T.windup + 0.22 + T.recover) e.tail = sw.side * 1.8 * (1 - ease((sw.t - T.windup - 0.22) / T.recover));
      else {
        e.tail = 0;
        e.tailSwipe = null;
      }
      return;
    }
    if (this.time < e.tailReadyAt || e.flight || e.burrowed || e.mode !== Mode.Normal || this.time < e.roostUntil) return;
    const back = e.facing + Math.PI;
    const behind = alive.find((p) => {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      const off = Math.atan2(Math.sin(Math.atan2(p.y - e.y, p.x - e.x) - back), Math.cos(Math.atan2(p.y - e.y, p.x - e.x) - back));
      return d < T.reach + PLAYER_RADIUS && Math.abs(off) < T.half;
    });
    if (!behind) return;
    // Which side they're on (from his point of view): the tail swings toward them, from the other side.
    const side = Math.sign(Math.sin(Math.atan2(behind.y - e.y, behind.x - e.x) - e.facing)) || 1;
    e.tailSwipe = { t: 0, side };
    e.tailReadyAt = this.time + T.cooldown / this.bossMods(e).haste;
    const cone = this.addHazard(HazardKind.Cone, e.x, e.y, back, T.reach, Math.round(T.half * 100), T.windup + 0.1, T.damage * this.damageScale(e));
    cone.knock = T.knockback;
    this.hint('tail', `${ENEMY_TYPES[e.type].name} lashes his tail at anyone behind him!`);
  }

  /**
   * Mordak turns at the end of a pass over the den: fire falls on everyone again, and a pack of his minions drops in
   * around the team (only on solid ground, and not past the usual crowd limit), so there's always something to do.
   */
  private flightWave(e: Enemy): void {
    const F = BOSS_MECHANICS.flight;
    const alive = this.alivePlayers();
    if (alive.length === 0) return;
    const mods = this.bossMods(e);
    for (const p of alive) this.addHazard(HazardKind.Circle, p.x, p.y, F.radius * 1.3 * mods.area, 0, 0, F.delay + 0.5, F.damage * this.damageScale(e) * mods.area);
    const crowd = this.enemies.filter((m) => !m.dead && !this.bosses.includes(m) && !m.partOf).length;
    const count = Math.min(F.adds + F.addsPerPlayer * (this.players.size - 1), BOSS_SUMMON.maxMinions - crowd);
    const minions = NAMED_BOSSES[e.type]?.minions ?? [EnemyType.Runner];
    for (let i = 0; i < count; i++) {
      const p = alive[i % alive.length];
      const type = pick(minions);
      const a = Math.random() * Math.PI * 2;
      const d = 220 + Math.random() * 160;
      let x = p.x + Math.cos(a) * d;
      let y = p.y + Math.sin(a) * d;
      if (this.finaleGround() && !this.onFinaleGround(x, y, ENEMY_TYPES[type].radius)) ({ x, y } = this.nearestGround(x, y, ENEMY_TYPES[type].radius));
      const spot = pushOut(this.walls, x, y, ENEMY_TYPES[type].radius);
      this.addEnemy(type, spot.x, spot.y, this.enemyHp(type));
      this.fx.push({ k: 'ring', x: Math.round(spot.x), y: Math.round(spot.y), r: 60, c: 0xff6d00 });
    }
  }

  /** Where Mordak's mouth is: at the end of his neck, turned with his head (see BOSS_MECHANICS.mouth). */
  private dragonMouth(e: Enemy): { x: number; y: number } {
    const M = BOSS_MECHANICS.mouth;
    const look = e.facing + e.head;
    return { x: e.x + Math.cos(e.facing) * M.neck + Math.cos(look) * M.reach, y: e.y + Math.sin(e.facing) * M.neck + Math.sin(look) * M.reach };
  }

  /**
   * Nobody belongs in the ground walled off beside the boss arena: anyone who got in there anyway (a leap, a shove)
   * is put back in front of its wall, level with where they were.
   */
  private keepOutOfSealed(who: { x: number; y: number; epoch?: number }, radius: number, player: boolean): void {
    const s = this.map.sealed;
    if (!s || !inSealed(this.map, who.x, who.y)) return;
    ({ x: who.x, y: who.y } = pushOut(this.walls, s.x - 80 - radius, who.y, radius));
    if (player && who.epoch !== undefined) who.epoch++;
  }

  /**
   * Before the boss is due, nobody gets into its arena (a leap, a dodge, a teleport): whoever's inside is put back out
   * in front of the gate.
   */
  private keepOutOfArena(p: Player): void {
    const arena = this.map.arena;
    if (!arena || this.bossPhase !== 'waiting' || this.endless || p.downed || !insideArena(arena, p.x, p.y, -PLAYER_RADIUS)) return;
    const front = arena.x - (arena.hall ? arena.hall.hw : arena.r) - 180;
    ({ x: p.x, y: p.y } = pushOut(this.walls, front, arena.y, PLAYER_RADIUS));
    p.epoch++;
  }

  /** Throws a player `amount` away from (fromX, fromY), stopping at walls (and short of the lava, in the den). */
  private knockPlayer(p: Player, fromX: number, fromY: number, amount: number): void {
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    let far = amount;
    while (far > 0 && this.finaleGround() && !this.onFinaleGround(p.x + (dx / d) * far, p.y + (dy / d) * far, PLAYER_RADIUS)) far -= 20;
    far = Math.max(0, far);
    const x = clamp(p.x + (dx / d) * far, PLAYER_RADIUS, this.map.width - PLAYER_RADIUS);
    const y = clamp(p.y + (dy / d) * far, PLAYER_RADIUS, this.map.height - PLAYER_RADIUS);
    ({ x: p.x, y: p.y } = pushOut(this.walls, x, y, PLAYER_RADIUS));
    p.epoch++; // Pin the client to where they landed.
  }

  /** Does this fight have a berserk clock? Not Mordak's: he spends enough of it out of reach as it is. */
  private berserkClock(): boolean {
    return !this.bosses.some((b) => b.type === EnemyType.Mordak);
  }

  /** Mordak can't be hurt while he's up in the air or sitting back hurling meteors. */
  private untouchable(e: Enemy): boolean {
    return e.type === EnemyType.Mordak && (this.time < e.roostUntil || !!e.flight);
  }

  /** Mordak's jaws are open: breathing his beam, hurling meteors or spitting fireballs. */
  private mouthOpen(e: Enemy): boolean {
    return this.time < e.roostUntil || e.volleys > 0 || this.hazards.some((h) => h.kind === HazardKind.Sweep && h.owner === e && !h.dead);
  }

  /** A final boss died: the fight is won once they all are; otherwise the survivor turns vengeful. */
  private bossDied(e: Enemy): void {
    const survivors = this.bosses.filter((b) => !b.dead);
    if (survivors.length === 0) {
      if (this.endless) this.endWave(e);
      else this.beginDeath(e);
      return;
    }
    for (const b of survivors) {
      b.vengeful = true;
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * BOSS_VENGEFUL.heal);
      this.fx.push({ k: 'ring', x: Math.round(b.x), y: Math.round(b.y), r: 220, c: 0xff1744, snd: 'bigSlam' });
      this.banner(`${ENEMY_TYPES[b.type].name} is consumed by rage over ${ENEMY_TYPES[e.type].name}!`, 'danger');
      const voice = NAMED_BOSSES[b.type]?.voice;
      if (voice) {
        this.fx.push({ k: 'voice', snd: voice.sound, x: Math.round(b.x), y: Math.round(b.y) });
        b.voiceAt = Math.max(b.voiceAt, this.fightTime + 8);
      }
    }
  }

  private namedBossStep(e: Enemy, alive: Player[], ux: number, uy: number, px: number, py: number, d: number, dt: number, speed: number): [number, number] {
    if (e.type === EnemyType.Mordak) this.dragonPose(e, alive, ux, uy, dt);
    // Holding still while it casts or winds up a cone.
    if (e.channelUntil > this.time) return [0, 0];
    if (e.mode !== Mode.Normal) return this.chargeStep(e, dt, BOSS_CHARGE);
    // The dragon turns his great bulk toward his target (his wings follow), and sends fireballs volley after volley.
    if (e.type === EnemyType.Mordak) {
      const want = Math.atan2(uy, ux);
      const diff = Math.atan2(Math.sin(want - e.facing), Math.cos(want - e.facing));
      e.facing += Math.max(-DRAGON_TURN * dt, Math.min(DRAGON_TURN * dt, diff));
    }
    if (e.volleys > 0 && this.time >= e.volleyAt) {
      const F = BOSS_MECHANICS.fireballs;
      e.volleys--;
      e.volleyAt = this.time + F.gap;
      const shots = F.shots + (e.enraged ? 2 : 0);
      const mouth = this.dragonMouth(e);
      const aim = Math.atan2(e.y + uy * d - mouth.y, e.x + ux * d - mouth.x);
      for (let i = 0; i < shots; i++) {
        this.addEnemyShot(mouth.x, mouth.y, aim + (i - (shots - 1) / 2) * F.spread, F.speed, F.damage * this.damageScale(e), 3.5);
      }
    }
    if (!e.enraged && e.hp < e.maxHp * BOSS_ENRAGE_AT) {
      e.enraged = true;
      this.banner(`${ENEMY_TYPES[e.type].name} is enraged!`, 'danger');
      this.fx.push({ k: 'roar', x: Math.round(e.x), y: Math.round(e.y) });
    }
    const def = NAMED_BOSSES[e.type];
    // Casters back off when you get close, and only walk in when you're far.
    let move: [number, number] = [px * speed, py * speed];
    if (def.keepAway) move = d < def.keepAway * 0.8 ? [-ux * speed, -uy * speed] : d < def.keepAway ? [0, 0] : move;
    e.attackTimer -= dt;
    if (e.attackTimer > 0) return move;

    const mods = this.bossMods(e);
    const rotation = this.hard ? def.hard : def.attacks;
    let attack = rotation[e.attackIndex++ % rotation.length];
    // Without his wings, Mordak can't fly: he rains fire from the ground instead.
    if (attack === 'flight' && e.wingsLost >= 2) attack = 'barrage';
    // Shelled, Kharzak keeps charging (so it can be baited into a rock), with a sting in between.
    if (e.shell) attack = e.attackIndex % 2 ? 'charge' : 'sting';
    const M = BOSS_MECHANICS;
    const scale = this.damageScale(e);
    e.attackTimer = (def.cooldown * (e.enraged ? BOSS_ENRAGE_SPEEDUP : 1)) / mods.haste;
    // Hard mode: every so often the next attack comes right on the heels of this one.
    if (this.hard && e.attackIndex % HARD.comboEvery === 0) e.attackTimer = Math.min(e.attackTimer, HARD.comboGap);
    switch (attack) {
      case 'fireballs':
        e.volleys = BOSS_MECHANICS.fireballs.volleys;
        e.volleyAt = this.time;
        break;
      case 'roost': {
        const RO = M.roost;
        this.hint('roost', `${ENEMY_TYPES[e.type].name} rears back and hurls fire across the den! Watch where it falls.`);
        e.roostUntil = this.time + RO.duration;
        e.roostLobAt = this.time + RO.settle;
        e.channelUntil = e.roostUntil;
        this.fx.push({ k: 'roar', x: Math.round(e.x), y: Math.round(e.y) });
        return [0, 0];
      }
      case 'firebeam': {
        this.hint('firebeam', `${ENEMY_TYPES[e.type].name} breathes a beam of fire! Get behind a pillar, or dodge through it.`);
        const F = M.firebeam;
        const aim = Math.atan2(uy, ux);
        const from = this.dragonMouth(e);
        const beam = this.addHazard(HazardKind.Sweep, from.x, from.y, aim, F.length, F.width * mods.area, F.windup, F.damage);
        beam.owner = e;
        // Which way it sweeps.
        beam.target = Math.random() < 0.5 ? 1 : -1;
        e.facing = aim;
        e.channelUntil = this.time + F.windup + F.sweep;
        return [0, 0];
      }
      case 'flight': {
        this.hint('flight', `${ENEMY_TYPES[e.type].name} takes to the sky! Get out from under the falling fire.`);
        const F = M.flight;
        const den = this.map.finale?.den ?? { x: e.x, y: e.y, r: 400 };
        // Out across the den and over the lava beyond it, then back down somewhere in the den.
        // Pass after pass, back and forth across the den (more of them the longer the fight goes), then down again.
        const FP = M.flightPasses;
        const lost = 1 - e.hp / e.maxHp;
        const passes = FP.start + FP.more.filter((at) => lost >= at).length;
        const out = den.r + F.overshoot;
        const path = [{ x: e.x, y: e.y }];
        let a = Math.atan2(den.y - e.y, den.x - e.x) + (Math.random() - 0.5) * 0.8;
        for (let i = 0; i < passes; i++) {
          path.push({ x: clamp(den.x + Math.cos(a) * out, 100, this.map.width - 100), y: clamp(den.y + Math.sin(a) * out, 100, this.map.height - 100) });
          a += Math.PI + (Math.random() - 0.5) * 1.2;
        }
        const la = Math.random() * Math.PI * 2;
        const ld = Math.random() * den.r * 0.55;
        path.push({ x: den.x + Math.cos(la) * ld, y: den.y + Math.sin(la) * ld });
        e.flight = { path, leg: 0, bombIn: 0.3 };
        e.burrowed = true;
        for (const p of alive) this.addHazard(HazardKind.Circle, p.x, p.y, F.radius * 1.3 * mods.area, 0, 0, F.delay + 0.5, F.damage * scale);
        this.fx.push({ k: 'roar', x: Math.round(e.x), y: Math.round(e.y) });
        return [0, 0];
      }
      case 'barrage':
        for (const p of alive) {
          this.addHazard(HazardKind.Circle, p.x, p.y, BOSS_ATTACK.radius * mods.area, 0, 0, BOSS_ATTACK.delay, BOSS_ATTACK.damage * this.damageScale(e));
        }
        break;
      case 'nova': {
        const shots = Math.round(BOSS_NOVA.shots * (e.enraged ? 1.5 : 1) * mods.area);
        const offset = Math.random() * Math.PI * 2;
        for (let i = 0; i < shots; i++) {
          const angle = offset + (i / shots) * Math.PI * 2;
          this.addEnemyShot(e.x, e.y, angle, BOSS_NOVA.speed, BOSS_NOVA.damage * this.damageScale(e), BOSS_NOVA.life);
        }
        break;
      }
      case 'charge':
        this.startWindup(e, ux, uy, { ...BOSS_CHARGE, width: BOSS_CHARGE.width * mods.area });
        return [0, 0];
      case 'spit': {
        // A fan of venom aimed at the target.
        const shots = Math.round(BOSS_SPIT.shots * mods.area) + (e.enraged ? 2 : 0);
        const aim = Math.atan2(uy, ux);
        for (let i = 0; i < shots; i++) {
          const angle = aim + (i - (shots - 1) / 2) * BOSS_SPIT.spread;
          this.addEnemyShot(e.x, e.y, angle, BOSS_SPIT.speed, BOSS_SPIT.damage * this.damageScale(e), BOSS_SPIT.life);
        }
        break;
      }
      case 'sting':
        // The tail stabs down in a line toward the target, one strike after another.
        for (let i = 0; i < BOSS_STING.count + (e.enraged ? 2 : 0); i++) {
          const along = ENEMY_TYPES[e.type].radius + BOSS_STING.step * (i + 0.6);
          const x = clamp(e.x + ux * along, 0, this.map.width);
          const y = clamp(e.y + uy * along, 0, this.map.height);
          const delay = BOSS_STING.delay + i * BOSS_STING.stagger;
          this.addHazard(HazardKind.Circle, x, y, BOSS_STING.radius * mods.area, 0, 0, delay, BOSS_STING.damage * this.damageScale(e));
        }
        break;
      case 'pools':
        // Venom at everyone's feet.
        for (const p of alive) {
          const pool = this.addHazard(HazardKind.Pool, p.x, p.y, M.pools.radius * mods.area, 0, 0, M.pools.delay, M.pools.dps * scale);
          pool.linger = M.pools.life;
        }
        break;
      case 'mark':
        this.hint('mark', 'A mark follows one of you: move away from the others!');
        this.addMark(pick(alive), M.mark.radius * mods.area, M.mark.follow, M.mark.follow + M.mark.delay, M.mark.damage * scale);
        break;
      case 'frostbomb':
        this.hint('frostbomb', 'Frost Bomb! Whoever carries it: get away from your friends!');
        this.addMark(pick(alive), M.frostbomb.radius * mods.area, M.frostbomb.fuse, M.frostbomb.fuse, M.frostbomb.damage * scale);
        break;
      case 'eggs': {
        this.hint('eggs', 'Sylvara lays her eggs: break them before they hatch!');
        const center = this.fightArena() ?? e;
        const scaleUp = 1 + 0.5 * (this.players.size - 1);
        const hp = ENEMY_TYPES[EnemyType.Egg].hp * hordeScaling(1).hp * this.difficulty() * scaleUp;
        const offset = Math.random() * Math.PI * 2;
        for (let i = 0; i < M.eggs.count; i++) {
          const spot = this.missionSpot(center, offset + (i / M.eggs.count) * Math.PI * 2, M.eggs.distance, ENEMY_TYPES[EnemyType.Egg].radius);
          this.addEnemy(EnemyType.Egg, spot.x, spot.y, hp).attackTimer = M.eggs.hatch;
        }
        break;
      }
      case 'cleave':
        this.addCone(e, ux, uy, M.cleave, scale, mods.area);
        return [0, 0];
      case 'breath':
        this.addCone(e, ux, uy, M.breath, scale, mods.area);
        return [0, 0];
      case 'sweep':
        this.addCone(e, ux, uy, M.sweep, scale, mods.area);
        return [0, 0];
      case 'shockwave': {
        this.hint('shockwave', 'Shockwave! Dodge through the ring, or be out of its reach.');
        const ring = this.addHazard(HazardKind.Ring, e.x, e.y, 0, M.shockwave.width * mods.area, M.shockwave.range * mods.area, M.shockwave.windup, M.shockwave.damage * scale);
        ring.hit = new Set();
        e.channelUntil = this.time + M.shockwave.windup;
        return [0, 0];
      }
      case 'feeders': {
        // Lost souls drift in from the edge of the arena.
        this.hint('feeders', `Lost souls! Destroy them before they reach ${ENEMY_TYPES[e.type].name} and heal him.`);
        const center = this.fightArena();
        const reach = center ? arenaReach(center) - 50 : 500;
        const from = center ?? e;
        for (let i = 0; i < M.feeders.count; i++) {
          const a = Math.random() * Math.PI * 2;
          const spot = pushOut(this.walls, from.x + Math.cos(a) * reach, from.y + Math.sin(a) * reach, ENEMY_TYPES[EnemyType.Spirit].radius);
          this.addEnemy(EnemyType.Spirit, spot.x, spot.y, this.enemyHp(EnemyType.Spirit) * M.feeders.hp).feeder = true;
        }
        break;
      }
      case 'glacial': {
        // Everyone she can see when the cast ends gets blasted.
        this.banner(`${ENEMY_TYPES[e.type].name} begins Glacial Wrath! Hide behind a column!`, 'danger');
        const cast = this.addHazard(HazardKind.Glacial, e.x, e.y, 0, 0, 0, M.glacial.channel, M.glacial.damage);
        cast.owner = e;
        e.channelUntil = this.time + M.glacial.channel;
        return [0, 0];
      }
      case 'burrow': {
        // Underground, a mark hunts someone; it bursts out where the mark lands.
        this.hint('burrow', `${ENEMY_TYPES[e.type].name} burrows! Keep moving, it's coming up under one of you.`);
        const mark = this.addMark(pick(alive), M.burrow.radius * mods.area, M.burrow.hunt, M.burrow.hunt + M.burrow.delay, M.burrow.damage * scale);
        mark.owner = e;
        e.burrowed = true;
        this.fx.push({ k: 'ring', x: Math.round(e.x), y: Math.round(e.y), r: 120, c: 0x8d6e63, snd: 'slam' });
        return [0, 0];
      }
      case 'meteor': {
        this.hint('meteor', 'Meteor! Stack up inside the circle to share the hit.');
        const target = pick(alive);
        const meteor = this.addHazard(HazardKind.Share, target.x, target.y, M.meteor.radius * mods.area, 0, 0, M.meteor.delay, M.meteor.damage * scale);
        meteor.target = target.id;
        meteor.follow = M.meteor.follow;
        break;
      }
      case 'orbs': {
        // Slow orbs that curve after whoever's closest.
        const target = alive.reduce((a, b) => (dist2(a.x, a.y, e.x, e.y) < dist2(b.x, b.y, e.x, e.y) ? a : b));
        const aim = Math.atan2(uy, ux);
        const count = M.orbs.count + (e.enraged ? 1 : 0);
        for (let i = 0; i < count; i++) {
          this.addEnemyShot(e.x, e.y, aim + (i - (count - 1) / 2) * 0.7, M.orbs.speed, M.orbs.damage * scale, M.orbs.life);
          const orb = this.enemyShots[this.enemyShots.length - 1];
          orb.target = target;
          orb.turn = M.orbs.turn;
        }
        break;
      }
      case 'summon':
        // Don't pile on: skip the summon while the fight is already crowded.
        if (this.enemies.filter((m) => !m.dead && !this.bosses.includes(m) && !m.missionTarget).length >= BOSS_SUMMON.maxMinions) break;
        for (let i = 0; i < BOSS_SUMMON.count; i++) {
          const angle = (i / BOSS_SUMMON.count) * Math.PI * 2;
          const type = pick(def.minions);
          const spot = pushOut(this.walls, e.x + Math.cos(angle) * 110, e.y + Math.sin(angle) * 110, ENEMY_TYPES[type].radius);
          this.addEnemy(type, spot.x, spot.y, this.enemyHp(type));
        }
        break;
    }
    return move;
  }

  /** Explains a mechanic the first time it shows up in a fight. */
  private hint(key: string, text: string): void {
    if (this.hinted.has(key)) return;
    this.hinted.add(key);
    this.banner(text, 'danger');
  }

  /** A circle that follows a player for `follow` seconds and goes off on everyone in it after `duration`. */
  private addMark(p: Player, radius: number, follow: number, duration: number, damage: number): Hazard {
    const mark = this.addHazard(HazardKind.Mark, p.x, p.y, radius, p.id, 0, duration, damage);
    mark.target = p.id;
    mark.follow = follow;
    return mark;
  }

  /** A telegraphed cone in front of the boss, which holds still until it lands. */
  private addCone(e: Enemy, ux: number, uy: number, cfg: { length: number; half: number; windup: number; damage: number }, scale: number, area: number): void {
    this.addHazard(HazardKind.Cone, e.x, e.y, Math.atan2(uy, ux), cfg.length * area, Math.round(Math.min(Math.PI, cfg.half * area) * 100), cfg.windup, cfg.damage * scale);
    e.channelUntil = this.time + cfg.windup;
  }

  /** Is there a thick wall between two points? (Rime can't see you behind a column.) */
  private lineBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 10);
    for (let i = 1; i < steps; i++) {
      if (blocksShot(this.walls, x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps)) return true;
    }
    return false;
  }

  /** An egg hatches into a few runners. */
  private hatch(egg: Enemy): void {
    egg.dead = true;
    for (let i = 0; i < BOSS_MECHANICS.eggs.hatchlings; i++) {
      const a = (i / BOSS_MECHANICS.eggs.hatchlings) * Math.PI * 2;
      const spot = pushOut(this.walls, egg.x + Math.cos(a) * 30, egg.y + Math.sin(a) * 30, ENEMY_TYPES[EnemyType.Runner].radius);
      this.addEnemy(EnemyType.Runner, spot.x, spot.y, this.enemyHp(EnemyType.Runner));
    }
    this.fx.push({ k: 'ring', x: Math.round(egg.x), y: Math.round(egg.y), r: 70, c: 0x9ccc65, snd: 'pop' });
  }

  /** A lost soul reaching the Reaper is reaped, healing him. True if it got there. */
  private feed(e: Enemy, boss: Enemy): boolean {
    if (dist2(e.x, e.y, boss.x, boss.y) > (ENEMY_TYPES[e.type].radius + ENEMY_TYPES[boss.type].radius + 4) ** 2) return false;
    e.dead = true;
    boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * BOSS_MECHANICS.feeders.heal);
    this.fx.push({ k: 'ring', x: Math.round(boss.x), y: Math.round(boss.y), r: 110, c: ENEMY_TYPES[e.type].color, snd: 'pop' });
    this.log(`${ENEMY_TYPES[boss.type].name} reaps a soul and heals`, 'danger');
    return true;
  }

  /** Kharzak's charge hit a rock: the shell cracks, it's stunned, and takes extra damage for a while. */
  private crackShell(e: Enemy): void {
    const cfg = BOSS_MECHANICS.shell;
    e.shell = false;
    e.mode = Mode.Normal;
    e.attackTimer = cfg.stun + 1;
    e.stunUntil = this.time + cfg.stun;
    e.exposedUntil = this.time + cfg.stun + cfg.exposed;
    this.fx.push({ k: 'ring', x: Math.round(e.x), y: Math.round(e.y), r: 220, c: 0xffd54f, snd: 'bigSlam' });
    this.banner(`${ENEMY_TYPES[e.type].name}'s shell cracks! Hit it while it's exposed!`, 'good');
  }

  /**
   * The twins: a burning tether between them hurts anyone standing in it, and while they're close they're kindred,
   * shrugging off damage.
   */
  private updateTwins(dt: number, alive: Player[]): void {
    for (const b of this.bosses) b.linked = false;
    const [a, b] = this.bosses;
    if (a.dead || b.dead || a.burrowed || b.burrowed) {
      if (this.tether) this.tether.dead = true;
      this.tether = null;
      return;
    }
    const cfg = BOSS_MECHANICS;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < cfg.kindred.range) {
      a.linked = b.linked = true;
      this.hint('kindred', 'The twins shield each other while close: pull them apart!');
    }
    if (!this.tether || this.tether.dead) this.tether = this.addHazard(HazardKind.Beam, a.x, a.y, 0, 0, cfg.tether.width, 1, 0);
    const tether = this.tether;
    tether.x = a.x;
    tether.y = a.y;
    tether.a = Math.atan2(b.y - a.y, b.x - a.x);
    tether.b = length;
    tether.t = 1;
    const damage = cfg.tether.dps * this.damageScale(a) * dt;
    for (const p of alive) {
      // Distance from the player to the tether's segment.
      const t = length > 0 ? clamp(((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (length * length), 0, 1) : 0;
      const cx = a.x + (b.x - a.x) * t;
      const cy = a.y + (b.y - a.y) * t;
      if (dist2(p.x, p.y, cx, cy) < (cfg.tether.width / 2 + PLAYER_RADIUS) ** 2) this.hurtPlayer(p, damage, true);
    }
  }

  // --- Upgrade points ---

  private updateShrines(dt: number, alive: Player[]): void {
    if (alive.length === 0 || this.bossPhase === 'fight') return;
    // Forges come on a fixed schedule (and in endless, keep coming after it).
    const n = this.forgesSpawned;
    const last = FORGE_SCHEDULE.length - 1;
    const forgeDue = n <= last ? FORGE_SCHEDULE[n] * this.bossTime : this.endless ? FORGE_SCHEDULE[last] * this.bossTime + (n - last) * ENDLESS.forgeEvery : Infinity;
    if (this.time >= forgeDue) {
      this.forgesSpawned++;
      this.spawnShrine(alive, ShrineKind.Forge);
      this.banner(this.forgesSpawned <= FORGE_SCHEDULE.length ? `A Forge has appeared (${this.forgesSpawned} of ${FORGE_SCHEDULE.length})` : 'A Forge has appeared', 'good');
    }
    // The Armory: once a run (again and again in endless), and only one at a time.
    if (this.time >= this.nextArmoryAt) {
      this.nextArmoryAt = this.endless ? this.time + ENDLESS.armoryEvery : Infinity;
      if (!this.shrines.some((s) => s.kind === ShrineKind.Armory)) {
        this.spawnShrine(alive, ShrineKind.Armory);
        this.banner('An Armory has appeared: trade in a weapon for a new one', 'good');
      }
    }
    // Altars and Quest points stay until captured; a new one comes SHRINE_INTERVAL after there's room for it.
    if (this.shrines.filter((s) => s.kind !== ShrineKind.Forge && s.kind !== ShrineKind.Armory).length >= MAX_SHRINES) {
      this.shrineTimer = Math.max(this.shrineTimer, SHRINE_INTERVAL);
    } else {
      this.shrineTimer -= dt;
      if (this.shrineTimer <= 0) {
        this.shrineTimer = SHRINE_INTERVAL;
        this.spawnShrine(alive);
      }
    }
    for (const s of this.shrines) {
      const inside = alive.filter((p) => dist2(p.x, p.y, s.x, s.y) < SHRINE_RADIUS ** 2).length;
      if (inside > 0) {
        // The more players inside, the faster it fills.
        s.progress += (dt / SHRINE_CAPTURE_TIME) * captureSpeed(inside);
      }
      if (s.progress >= 1) {
        s.captured = true;
        this.activateShrine(s);
      }
    }
    this.shrines = this.shrines.filter((s) => !s.captured);
  }

  /** Spawns an upgrade point: the given kind, or else a random Altar or Quest point. */
  private spawnShrine(alive: Player[], forced?: number): void {
    const questBusy = this.quest !== null || this.shrines.some((s) => s.kind === ShrineKind.Quest);
    const allowed = [ShrineKind.Event, ShrineKind.Quest].filter((kind) => !(kind === ShrineKind.Quest && questBusy));
    // Prefer a kind that isn't already on the map.
    const fresh = allowed.filter((kind) => !this.shrines.some((s) => s.kind === kind));
    const kind = forced ?? pick(fresh.length > 0 ? fresh : allowed);
    // Keep shrines spread out.
    let spot = this.pointNear(alive, 500, 800, SHRINE_RADIUS * 0.6);
    for (let attempt = 0; attempt < 10 && this.shrines.some((s) => dist2(s.x, s.y, spot.x, spot.y) < SHRINE_SPACING ** 2); attempt++) {
      spot = this.pointNear(alive, 500, 1000, SHRINE_RADIUS * 0.6);
    }
    this.shrines.push({ id: this.nextId++, kind, x: spot.x, y: spot.y, progress: 0, captured: false });
    if (kind !== ShrineKind.Forge && kind !== ShrineKind.Armory) this.log(`${kind === ShrineKind.Event ? 'An' : 'A'} ${SHRINES[kind].name} appeared`);
  }

  private activateShrine(s: Shrine): void {
    this.fx.push({ k: 'ring', x: Math.round(s.x), y: Math.round(s.y), r: SHRINE_RADIUS * 1.5, c: SHRINES[s.kind].color });
    switch (s.kind) {
      case ShrineKind.Forge:
        this.choices.push('forge');
        this.banner('The Forge: everyone upgrades a weapon!', 'good');
        break;
      case ShrineKind.Armory:
        this.choices.push('armory');
        this.banner('The Armory: everyone may trade in a weapon!', 'good');
        break;
      case ShrineKind.Event: {
        const kind = pick(EVENT_KINDS.filter((k) => k !== this.event?.kind));
        this.event = { kind, timeLeft: EVENT_DURATION };
        this.banner(`${EVENTS[kind].name}: ${EVENTS[kind].banner}`, 'good');
        break;
      }
      case ShrineKind.Quest:
        this.startQuest();
        break;
    }
  }

  private startQuest(): void {
    const alive = this.alivePlayers();
    if (alive.length === 0 || this.quest) return;
    const kind = pick(QUEST_KINDS);
    if (kind === 'rally') {
      // A reachable point well away from the team's center.
      const cx = alive.reduce((sum, p) => sum + p.x, 0) / alive.length;
      const cy = alive.reduce((sum, p) => sum + p.y, 0) / alive.length;
      let x = cx;
      let y = cy;
      for (let attempt = 0; attempt < 20; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = RALLY_DISTANCE[0] + Math.random() * (RALLY_DISTANCE[1] - RALLY_DISTANCE[0]);
        x = clamp(cx + Math.cos(angle) * distance, 200, this.map.width - 200);
        y = clamp(cy + Math.sin(angle) * distance, 200, this.map.height - 200);
        if (this.openGround(x, y, RALLY_RADIUS / 2) && this.dry(x, y, RALLY_RADIUS)) break;
      }
      ({ x, y } = this.ashore(x, y, RALLY_RADIUS));
      // Nowhere good that far out: somewhere open a little closer.
      if (!this.openGround(x, y, RALLY_RADIUS / 2)) ({ x, y } = this.pointNear(alive, RALLY_DISTANCE[0] * 0.6, RALLY_DISTANCE[1], RALLY_RADIUS / 2));
      this.quest = { kind, timeLeft: RALLY_TIME, x, y, targetId: 0 };
    } else {
      const thief = this.spawnEnemy(EnemyType.Thief, alive, 450, 600);
      this.quest = { kind, timeLeft: HUNT_TIME, x: thief.x, y: thief.y, targetId: thief.id };
    }
    this.banner(`${QUESTS[kind].name}: ${QUESTS[kind].goal}!`, 'good');
  }

  private updateQuest(dt: number, alive: Player[]): void {
    const q = this.quest;
    if (!q) return;
    q.timeLeft -= dt;
    if (q.kind === 'rally') {
      if (alive.length > 0 && alive.every((p) => dist2(p.x, p.y, q.x, q.y) < RALLY_RADIUS ** 2)) {
        this.completeQuest(q.x, q.y);
        return;
      }
    } else {
      const thief = this.enemies.find((e) => e.id === q.targetId);
      if (thief) {
        q.x = thief.x;
        q.y = thief.y;
      }
    }
    if (q.timeLeft <= 0) {
      const thief = this.enemies.find((e) => e.id === q.targetId);
      if (thief) thief.dead = true; // Escapes, no reward.
      this.quest = null;
      this.banner('Quest failed', 'danger');
    }
  }

  /** Showers gems worth a good chunk of the next level around (x, y). */
  private completeQuest(x: number, y: number): void {
    this.quest = null;
    const gems = Math.ceil((this.xpNext() * QUEST_REWARD) / 5);
    for (let i = 0; i < gems; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 20 + Math.random() * 70;
      this.dropGem(clamp(x + Math.cos(angle) * distance, 0, this.map.width), clamp(y + Math.sin(angle) * distance, 0, this.map.height), 5);
    }
    this.fx.push({ k: 'ring', x: Math.round(x), y: Math.round(y), r: 150, c: 0xffee58 });
    this.banner('Quest complete!', 'good');
  }

  // --- Enemy behavior ---

  private moveEnemies(dt: number, everyone: Player[]): void {
    // Veiled players are invisible to enemies (the thief still runs from them, see fleeStep).
    const alive = everyone.filter((p) => p.veil <= 0);
    const arena = this.bossPhase === 'fight' ? this.fightArena() : null;
    const hordeSpeed = this.horde().speed;
    for (const e of this.enemies) {
      if (this.isStunned(e)) continue;
      const def = ENEMY_TYPES[e.type];
      if (def.behavior === 'ward' || e.burrowed) continue; // Rooted to the spot, or underground.
      if (def.behavior === 'part' || e.corpse || e.dead) continue; // Carried along (see attachParts), dying, or dead.
      if (def.behavior === 'egg') {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) this.hatch(e);
        continue;
      }
      // The horde gets faster toward the end (bosses and the thief keep their pace).
      let speed = def.behavior === 'named' || def.behavior === 'flee' ? def.speed : def.speed * hordeSpeed * (e.affix === Affix.Hasted ? AFFIX_TUNING.hasteSpeed : 1) * (this.hard ? HARD.speed : 1);
      if (e.slowUntil > this.time) speed *= 1 - (this.isBoss(e) ? POISON_SLOW.boss : POISON_SLOW.amount);
      // Lost souls ignore everyone and drift straight to the Reaper.
      if (e.feeder) {
        const boss = this.bosses.find((b) => !b.dead && !b.burrowed);
        if (boss && !this.feed(e, boss)) {
          const d = Math.hypot(boss.x - e.x, boss.y - e.y) || 1;
          this.moveEnemy(e, ((boss.x - e.x) / d) * speed * dt, ((boss.y - e.y) / d) * speed * dt);
        }
        continue;
      }

      // Everyone targets the nearest living player, unless taunted by a War Cry.
      let target: Player | null = null;
      let best = Infinity;
      const taunter = e.tauntUntil > this.time ? this.players.get(e.tauntBy) : undefined;
      if (taunter && !taunter.downed) {
        target = taunter;
        best = dist2(taunter.x, taunter.y, e.x, e.y);
      } else {
        for (const p of alive) {
          const d = dist2(p.x, p.y, e.x, e.y);
          if (d < best) {
            best = d;
            target = p;
          }
        }
      }
      let vx = 0;
      let vy = 0;
      if (target) {
        // Right on top of the target (it stood still and got caught): keep acting, facing the way it last went.
        const close = best <= 1;
        const d = close ? 1 : Math.sqrt(best);
        // Straight at the target (for aiming), and along the flow field around walls (for walking).
        const ux = close ? e.dirX || 1 : (target.x - e.x) / d;
        const uy = close ? e.dirY : (target.y - e.y) / d;
        // (The flow field leads to the nearest player, so taunted enemies head straight for their taunter.)
        const path = def.flying || taunter ? null : this.flow.direction(e.x, e.y);
        const px = path?.x ?? ux;
        const py = path?.y ?? uy;
        switch (def.behavior) {
          case 'ranged':
            [vx, vy] = this.keepDistance(e, ux, uy, px, py, d, SPITTER.minRange, SPITTER.maxRange, speed);
            this.spit(e, ux, uy, d, dt);
            break;
          case 'lobber':
            [vx, vy] = this.keepDistance(e, ux, uy, px, py, d, BOMBARDIER.minRange, BOMBARDIER.maxRange, speed);
            this.lob(e, target, d, dt);
            break;
          case 'charger':
            if (e.mode !== Mode.Normal) {
              [vx, vy] = this.chargeStep(e, dt, CHARGER);
            } else {
              e.attackTimer -= dt;
              if (e.attackTimer <= 0 && d < CHARGER.triggerRange) this.startWindup(e, ux, uy, CHARGER);
              else [vx, vy] = [px * speed, py * speed];
            }
            break;
          case 'boss':
            this.warlordAttack(e, alive, dt);
            [vx, vy] = [px * speed, py * speed];
            break;
          case 'named':
            [vx, vy] = this.namedBossStep(e, alive, ux, uy, px, py, d, dt, def.speed);
            break;
          case 'flee':
            [vx, vy] = this.fleeStep(e, everyone, def.speed, def.radius);
            break;
          default:
            [vx, vy] = [px * speed, py * speed];
        }
      }

      // Push away from overlapping enemies so they form a crowd instead of a single blob.
      // Bigger enemies shove smaller ones harder. A charging enemy plows straight through.
      let sx = 0;
      let sy = 0;
      if (e.mode !== Mode.Charge) {
        for (const o of this.grid.query(e.x, e.y, def.radius + MAX_ENEMY_RADIUS, this.near)) {
          if (o === e || o.partOf === e) continue;
          const otherRadius = ENEMY_TYPES[o.type].radius;
          const minD = def.radius + otherRadius;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const d2 = ox * ox + oy * oy;
          if (d2 >= minD * minD) continue;
          if (d2 < 0.0001) {
            sx += Math.random() - 0.5;
            sy += Math.random() - 0.5;
            continue;
          }
          const d = Math.sqrt(d2);
          const push = ((minD - d) / minD) * (otherRadius / minD) * 2;
          sx += (ox / d) * push;
          sy += (oy / d) * push;
        }
      }

      const fromX = e.x;
      const fromY = e.y;
      const stepX = (vx + sx * SEPARATION_SPEED) * dt;
      const stepY = (vy + sy * SEPARATION_SPEED) * dt;
      this.moveEnemy(e, stepX, stepY);
      // A shelled Kharzak charging into a rock cracks its shell.
      if (e.shell && e.mode === Mode.Charge && Math.hypot(e.x - fromX, e.y - fromY) < Math.hypot(stepX, stepY) * 0.5) this.crackShell(e);
      if (arena) this.keepInArena(e, def.radius);
      // In the dragon's den, everyone stays on the rock.
      if (this.finale?.stage === 'den') this.keepInDen(e, def.radius);
      if (e.hazard) {
        e.hazard.x = e.x;
        e.hazard.y = e.y;
      }

      if (e.mode === Mode.Charge) {
        const damage = def.behavior === 'named' ? BOSS_CHARGE.damage : CHARGER.damage;
        for (const p of alive) {
          const reach = Math.max(def.radius, e.chargeWidth / 2);
          if (e.charged.has(p.id) || dist2(p.x, p.y, e.x, e.y) >= (PLAYER_RADIUS + reach) ** 2) continue;
          if (this.hurtPlayer(p, damage * this.damageScale(e), false, e)) e.charged.add(p.id);
        }
      }
    }
  }

  /** Moves an enemy, sliding along walls unless it flies. */
  private moveEnemy(e: Enemy, dx: number, dy: number): void {
    const def = ENEMY_TYPES[e.type];
    if (def.flying) {
      e.x = clamp(e.x + dx, def.radius, this.map.width - def.radius);
      e.y = clamp(e.y + dy, def.radius, this.map.height - def.radius);
    } else {
      ({ x: e.x, y: e.y } = moveCircle(this.walls, e.x, e.y, dx, dy, def.radius));
    }
  }

  private keepInDen(target: { x: number; y: number }, radius: number): void {
    const den = this.map.finale!.den;
    const d = Math.hypot(target.x - den.x, target.y - den.y);
    const max = Math.max(0, den.r - radius - 10);
    if (d <= max) return;
    target.x = den.x + ((target.x - den.x) / d) * max;
    target.y = den.y + ((target.y - den.y) / d) * max;
  }

  private keepInArena(target: { x: number; y: number }, radius: number): void {
    const { x, y } = clampToArena(this.map.arena!, target.x, target.y, radius);
    target.x = x;
    target.y = y;
  }

  /**
   * The thief's escape: try 16 directions, look ahead along each, and pick the one that ends up farthest from
   * every player while staying clear of walls and the map edge. A small bonus for its current heading keeps
   * it from jittering. It runs along edges and out of corners instead of pinning itself against them.
   */
  private fleeStep(e: Enemy, alive: Player[], speed: number, radius: number): [number, number] {
    const LOOK = 160;
    const EDGE = 300;
    let best = -Infinity;
    let bx = 0;
    let by = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const tx = e.x + dx * LOOK;
      const ty = e.y + dy * LOOK;
      // Closest any player would be to where this direction leads.
      let nearest = Infinity;
      for (const p of alive) nearest = Math.min(nearest, Math.hypot(p.x - tx, p.y - ty));
      let score = nearest;
      // Getting near the map edge is bad, and worse the closer it gets. The lava's edge counts too.
      let edge = Math.min(tx, ty, this.map.width - tx, this.map.height - ty);
      const lava = this.map.lava;
      if (lava) edge = Math.min(edge, this.lavaR - Math.hypot(tx - lava.x, ty - lava.y));
      if (edge < EDGE) score -= (EDGE - edge) * 1.5;
      // Never into the lava itself.
      if (!this.dry(e.x + dx * LOOK * 0.5, e.y + dy * LOOK * 0.5, radius) || !this.dry(tx, ty, radius)) score -= 2000;
      // Walls in the way (halfway or at the end) rule a direction out.
      const blocked =
        overlapsWall(this.walls, e.x + dx * LOOK * 0.5, e.y + dy * LOOK * 0.5, radius) || overlapsWall(this.walls, tx, ty, radius);
      if (blocked) score -= 1000;
      score += 40 * (dx * e.dirX + dy * e.dirY);
      if (score > best) {
        best = score;
        bx = dx;
        by = dy;
      }
    }
    e.dirX = bx;
    e.dirY = by;
    return [bx * speed, by * speed];
  }

  /** Approach (around walls) when too far, back off when too close, otherwise circle around the target. */
  private keepDistance(e: Enemy, ux: number, uy: number, px: number, py: number, d: number, min: number, max: number, speed: number): [number, number] {
    if (d > max) return [px * speed, py * speed];
    if (d < min) return [-ux * speed, -uy * speed];
    return [-uy * e.strafe * speed * 0.4, ux * e.strafe * speed * 0.4];
  }

  private addEnemyShot(x: number, y: number, angle: number, speed: number, damage: number, life: number): void {
    this.enemyShots.push({ id: this.nextId++, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, life, dead: false, target: null, turn: 0 });
  }

  private spit(e: Enemy, ux: number, uy: number, d: number, dt: number): void {
    e.attackTimer -= dt;
    if (e.attackTimer > 0 || d > SPITTER.fireRange) return;
    e.attackTimer = SPITTER.cooldown;
    this.addEnemyShot(e.x, e.y, Math.atan2(uy, ux), SPITTER.shotSpeed, SPITTER.shotDamage * this.damageScale(e), SPITTER.shotLife);
  }

  private lob(e: Enemy, target: Player, d: number, dt: number): void {
    e.attackTimer -= dt;
    if (e.attackTimer > 0 || d > BOMBARDIER.fireRange) return;
    // Bombardiers take turns: a gap between any two bombs, and a cap on bombs at once.
    const active = this.hazards.filter((h) => h.lob && !h.dead).length;
    if (this.time < this.nextLobAt || active >= BOMBARDIER.maxActive) {
      e.attackTimer = 0.3 + Math.random() * 0.5;
      return;
    }
    e.attackTimer = BOMBARDIER.cooldown + Math.random() * BOMBARDIER.jitter;
    this.nextLobAt = this.time + BOMBARDIER.spacing;
    const bomb = this.addHazard(HazardKind.Circle, target.x, target.y, BOMBARDIER.radius, 0, 0, BOMBARDIER.delay, BOMBARDIER.damage * this.damageScale(e));
    bomb.lob = true;
  }

  /** Stop and show the charge lane. */
  private startWindup(e: Enemy, ux: number, uy: number, cfg: ChargeConfig): void {
    e.mode = Mode.Windup;
    e.modeTimer = cfg.windup;
    e.dirX = ux;
    e.dirY = uy;
    e.chargeWidth = cfg.width;
    e.hazard = this.addHazard(HazardKind.Line, e.x, e.y, Math.atan2(uy, ux), cfg.speed * cfg.duration, cfg.width, cfg.windup, 0);
  }

  /** Windup -> dash along the lane -> catch breath -> back to normal. */
  private chargeStep(e: Enemy, dt: number, cfg: ChargeConfig & { cooldown?: number }): [number, number] {
    e.modeTimer -= dt;
    switch (e.mode) {
      case Mode.Windup:
        if (e.modeTimer <= 0) {
          e.mode = Mode.Charge;
          e.modeTimer = cfg.duration;
          if (e.hazard) e.hazard.dead = true;
          e.hazard = null;
          e.charged.clear();
        }
        return [0, 0];
      case Mode.Charge:
        if (e.modeTimer <= 0) {
          e.mode = Mode.Recover;
          e.modeTimer = cfg.recover;
          return [0, 0];
        }
        return [e.dirX * cfg.speed, e.dirY * cfg.speed];
      default:
        if (e.modeTimer <= 0) {
          e.mode = Mode.Normal;
          if (cfg.cooldown !== undefined) e.attackTimer = cfg.cooldown;
        }
        return [0, 0];
    }
  }

  private warlordAttack(e: Enemy, alive: Player[], dt: number): void {
    e.attackTimer -= dt;
    if (e.attackTimer > 0) return;
    e.attackTimer = BOSS_ATTACK.cooldown;
    for (const p of alive) this.addHazard(HazardKind.Circle, p.x, p.y, BOSS_ATTACK.radius, 0, 0, BOSS_ATTACK.delay, BOSS_ATTACK.damage * this.damageScale(e));
  }

  private addHazard(kind: number, x: number, y: number, a: number, b: number, c: number, duration: number, damage: number): Hazard {
    const hazard: Hazard = { id: this.nextId++, kind, x, y, a, b, c, t: 0, duration, damage, lob: false, dead: false, target: 0, follow: 0, linger: 0, hit: null, owner: null };
    this.hazards.push(hazard);
    return hazard;
  }

  private updateHazards(dt: number): void {
    for (const h of this.hazards) {
      if (h.dead) continue;
      if (h.kind === HazardKind.Beam) continue; // The twins' tether (see updateTwins).
      h.t += dt;
      // Marks and meteors follow their player for a while, then stay put.
      if (h.target && h.t < h.follow) {
        const p = this.players.get(h.target);
        if (p && !p.downed) {
          h.x = p.x;
          h.y = p.y;
        }
      }
      if (h.kind >= HazardKind.Cone) {
        this.updateBossHazard(h, dt);
        continue;
      }
      if (h.kind === HazardKind.Circle && h.t >= h.duration) {
        h.dead = true;
        for (const p of this.players.values()) {
          if (dist2(p.x, p.y, h.x, h.y) < (h.a + PLAYER_RADIUS * 0.5) ** 2) this.hurtPlayer(p, h.damage);
        }
        this.fx.push({ k: 'boom', x: Math.round(h.x), y: Math.round(h.y), r: h.a });
      } else if (h.kind === HazardKind.Line && h.t > h.duration + 1) {
        h.dead = true; // Safety net; chargers normally remove their own.
      }
    }
    this.hazards = this.hazards.filter((h) => !h.dead);
  }

  /** The bosses' own telegraphs (see HazardKind). */
  private updateBossHazard(h: Hazard, dt: number): void {
    const M = BOSS_MECHANICS;
    const standing = [...this.players.values()].filter((p) => !p.downed);
    switch (h.kind) {
      case HazardKind.Cone: {
        if (h.t < h.duration) return;
        h.dead = true;
        const half = h.c / 100;
        for (const p of standing) {
          const d = Math.hypot(p.x - h.x, p.y - h.y);
          if (d > h.b + PLAYER_RADIUS) continue;
          const off = Math.abs(Math.atan2(Math.sin(Math.atan2(p.y - h.y, p.x - h.x) - h.a), Math.cos(Math.atan2(p.y - h.y, p.x - h.x) - h.a)));
          if (d < PLAYER_RADIUS * 2 || off <= half + PLAYER_RADIUS / Math.max(d, 1)) {
            if (this.hurtPlayer(p, h.damage) && h.knock) this.knockPlayer(p, h.x, h.y, h.knock);
          }
        }
        this.fx.push({ k: 'slash', x: Math.round(h.x), y: Math.round(h.y), r: Math.round(h.b), a: round2(h.a), arc: round2(half * 2), c: DANGER_FX, heavy: true });
        return;
      }
      case HazardKind.Ring: {
        if (h.t < h.duration) return;
        h.a = (h.t - h.duration) * M.shockwave.speed;
        if (h.a > h.c) {
          h.dead = true;
          return;
        }
        for (const p of standing) {
          if (h.hit!.has(p.id)) continue;
          if (Math.abs(Math.hypot(p.x - h.x, p.y - h.y) - h.a) < h.b / 2 + PLAYER_RADIUS && this.hurtPlayer(p, h.damage)) h.hit!.add(p.id);
        }
        return;
      }
      case HazardKind.Pool:
        h.b = h.t >= h.duration ? 1 : 0;
        if (h.t >= h.duration + h.linger) h.dead = true;
        else if (h.b) for (const p of standing) if (dist2(p.x, p.y, h.x, h.y) < (h.a + PLAYER_RADIUS * 0.5) ** 2) this.hurtPlayer(p, h.damage * dt, true);
        return;
      case HazardKind.Share: {
        if (h.t < h.duration) return;
        h.dead = true;
        // Split between everyone inside: stack up to survive it.
        const inside = standing.filter((p) => dist2(p.x, p.y, h.x, h.y) < (h.a + PLAYER_RADIUS * 0.5) ** 2);
        for (const p of inside) this.hurtPlayer(p, h.damage / inside.length);
        this.fx.push({ k: 'boom', x: Math.round(h.x), y: Math.round(h.y), r: h.a });
        return;
      }
      case HazardKind.Mark: {
        if (h.t < h.duration) return;
        h.dead = true;
        for (const p of standing) if (dist2(p.x, p.y, h.x, h.y) < (h.a + PLAYER_RADIUS * 0.5) ** 2) this.hurtPlayer(p, h.damage);
        this.fx.push({ k: 'boom', x: Math.round(h.x), y: Math.round(h.y), r: h.a });
        // Kharzak bursts out of the ground here.
        const boss = h.owner;
        if (boss && !boss.dead) {
          boss.burrowed = false;
          ({ x: boss.x, y: boss.y } = pushOut(this.walls, h.x, h.y, ENEMY_TYPES[boss.type].radius));
          if (this.fightArena()) this.keepInArena(boss, ENEMY_TYPES[boss.type].radius);
          boss.attackTimer = 1.5;
        }
        return;
      }
      case HazardKind.Sweep: {
        // Mordak's fire beam: after the windup it sweeps a half circle; everyone it touches who isn't behind
        // something burns (once per beam). `a` is its angle (the middle of the sweep until it starts).
        const F = M.firebeam;
        if (h.owner && !h.owner.dead && !h.owner.corpse) ({ x: h.x, y: h.y } = this.dragonMouth(h.owner));
        if (h.t < h.duration) return;
        if (!h.hit) {
          h.hit = new Set();
          h.linger = h.a;
        }
        const s = (h.t - h.duration) / F.sweep;
        if (s >= 1 || !h.owner || h.owner.dead || h.owner.corpse) {
          h.dead = true;
          return;
        }
        h.a = h.linger - (h.target * Math.PI) / 2 + h.target * Math.PI * s;
        // Only his head and neck follow the beam; his body holds still.
        if (h.owner) h.owner.head = Math.atan2(Math.sin(h.a - h.owner.facing), Math.cos(h.a - h.owner.facing));
        const ex = Math.cos(h.a);
        const ey = Math.sin(h.a);
        for (const p of standing) {
          if (h.hit.has(p.id)) continue;
          const along = (p.x - h.x) * ex + (p.y - h.y) * ey;
          if (along < 0 || along > h.b) continue;
          const off = Math.abs((p.x - h.x) * -ey + (p.y - h.y) * ex);
          if (off > h.c / 2 + PLAYER_RADIUS) continue;
          if (this.lineBlocked(h.x, h.y, p.x, p.y)) continue;
          if (this.hurtPlayer(p, this.stats(p).maxHp * F.damage, true)) h.hit.add(p.id);
        }
        return;
      }
      case HazardKind.Glacial: {
        if (h.t < h.duration) return;
        h.dead = true;
        // Everyone in her line of sight takes a big share of their health.
        for (const p of standing) {
          if (!this.lineBlocked(h.x, h.y, p.x, p.y)) this.hurtPlayer(p, this.stats(p).maxHp * h.damage, true);
        }
        this.fx.push({ k: 'ring', x: Math.round(h.x), y: Math.round(h.y), r: 900, c: 0x80deea, snd: 'bigSlam' });
        return;
      }
    }
  }

  private updateEnemyShots(dt: number): void {
    for (const s of this.enemyShots) {
      // Homing orbs curve toward their target.
      if (s.target && !s.target.downed && s.turn > 0) {
        const heading = Math.atan2(s.vy, s.vx);
        const want = Math.atan2(s.target.y - s.y, s.target.x - s.x);
        const diff = Math.atan2(Math.sin(want - heading), Math.cos(want - heading));
        const turned = heading + clamp(diff, -s.turn * dt, s.turn * dt);
        const speed = Math.hypot(s.vx, s.vy);
        s.vx = Math.cos(turned) * speed;
        s.vy = Math.sin(turned) * speed;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.x < 0 || s.y < 0 || s.x > this.map.width || s.y > this.map.height || blocksShot(this.walls, s.x, s.y)) {
        s.dead = true;
        continue;
      }
      for (const p of this.players.values()) {
        // A dodging player lets the shot pass straight through.
        if (dist2(p.x, p.y, s.x, s.y) < (PLAYER_RADIUS + ENEMY_SHOT_RADIUS) ** 2 && this.hurtPlayer(p, s.damage)) {
          s.dead = true;
          break;
        }
      }
    }
    this.enemyShots = this.enemyShots.filter((s) => !s.dead);
  }

  // --- Players ---

  private updatePlayer(p: Player, dt: number): void {
    this.keepOutOfSealed(p, PLAYER_RADIUS, true);
    this.keepOutOfArena(p);
    p.invuln = Math.max(0, p.invuln - dt);
    p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
    p.takenTimer -= dt;
    if (p.takenAcc >= 1 && p.takenTimer <= 0) {
      p.taken.push(Math.round(p.takenAcc));
      p.takenAcc = 0;
      p.takenTimer = DAMAGE_NUMBER_INTERVAL;
    }
    p.abilityCd = Math.max(0, p.abilityCd - dt);
    p.ultCd = Math.max(0, p.ultCd - dt);
    p.rage = Math.max(0, p.rage - dt);
    p.retribution = p.downed ? 0 : Math.max(0, p.retribution - dt);
    p.elixir = Math.max(0, p.elixir - dt);
    p.guard = Math.max(0, p.guard - dt);
    p.relicCd = Math.max(0, p.relicCd - dt);
    p.frenzy = Math.max(0, p.frenzy - dt);
    this.updateUltimates(p, dt);
    if (p.downed) {
      p.history = []; // Chronobreak can't take you back to before you went down.
      this.updateRevive(p, dt);
      return;
    }
    const stats = this.stats(p);
    p.hp = Math.min(stats.maxHp, p.hp + stats.regen * stats.support * dt);
    p.lifestealBudget = Math.min(stats.maxHp * stats.lifestealCap, p.lifestealBudget + stats.maxHp * stats.lifestealCap * dt);

    // Chronobreak: remember where you were and how healthy.
    p.historyTimer -= dt;
    if (p.historyTimer <= 0) {
      p.historyTimer = HISTORY_STEP;
      p.history.push({ x: p.x, y: p.y, hp: p.hp });
      if (p.history.length > REWIND.seconds / HISTORY_STEP) p.history.shift();
    }

    // Enemies can't touch what they can't see.
    for (const e of p.veil > 0 ? [] : this.grid.query(p.x, p.y, PLAYER_RADIUS + MAX_ENEMY_RADIUS, this.near)) {
      const def = ENEMY_TYPES[e.type];
      if (e.dead || def.damage === 0 || this.isStunned(e)) continue;
      if (dist2(e.x, e.y, p.x, p.y) >= (PLAYER_RADIUS + def.radius) ** 2) continue;
      const amount = def.damage * this.damageScale(e) * dt;
      if (this.hurtPlayer(p, amount, true, e) && e.affix === Affix.Vampiric) e.hp = Math.min(e.maxHp, e.hp + amount * AFFIX_TUNING.vampHeal);
    }
    if (!p.downed) this.fireWeapons(p, stats, dt);
  }

  /**
   * Applies evasion and armor, and downs the player at 0 HP. Returns false if the hit didn't land (dodging,
   * evaded, or already down). Discrete hits (bullets, bombs, charges) can be evaded; `continuous` damage
   * (contact with the horde, the burning zone) can't.
   */
  /**
   * Retribution: whoever hurt him takes it back, several times over. Blows with no one behind them (shots, telegraphs)
   * go to the nearest enemy; the lava, the burning zone and such don't count.
   */
  private retribute(p: Player, amount: number, continuous: boolean, from: Enemy | undefined, stats: PlayerStats): void {
    const R = RETRIBUTION;
    if (!from && continuous) return;
    let target = from && !from.dead ? from : undefined;
    if (!target) {
      let best = R.reach ** 2;
      for (const e of this.grid.query(p.x, p.y, R.reach, this.near)) {
        const d = dist2(e.x, e.y, p.x, p.y);
        if (!e.dead && d < best) {
          best = d;
          target = e;
        }
      }
    }
    if (!target) return;
    this.damageEnemy(target, amount * R.mult + (continuous ? 0 : R.flat * stats.damageMult), p, 'physical');
    if (!continuous) {
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      this.fx.push({ k: 'slash', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(Math.sqrt(dist2(target.x, target.y, p.x, p.y)) + 10), a: round2(a), arc: 0.35, c: R.color });
    }
  }

  private hurtPlayer(p: Player, amount: number, continuous = false, from?: Enemy): boolean {
    if (p.downed || p.invuln > 0 || this.sheltered(p)) return false;
    const stats = this.stats(p);
    if (!continuous && Math.random() < stats.evasion) {
      p.taken.push(0); // Shown as "EVADE".
      return false;
    }
    if (p.retribution > 0) this.retribute(p, amount, continuous, from, stats);
    const taken = amount * (1 - stats.armor) * stats.damageTaken * (p.retribution > 0 ? 1 - RETRIBUTION.reduction : 1);
    p.hp -= taken;
    p.damageTaken += taken;
    if (continuous || taken < 1) p.takenAcc += taken;
    else p.taken.push(Math.round(taken));
    p.hurtUntil = this.time + 0.12;
    // God mode for testing: damage lands, but never below 1 HP.
    // God mode (testing) and Bloodrage: damage lands, but never below 1 HP.
    if (p.god || p.rage > 0) p.hp = Math.max(1, p.hp);
    if (p.hp <= 0 && stats.secondWind > 0 && !p.secondWindUsed) {
      // Their artifact catches them, once per run.
      p.secondWindUsed = true;
      p.hp = stats.maxHp * stats.secondWind;
      p.invuln = SECOND_WIND_IFRAMES;
      this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 160, c: TIERS.legendary.color, snd: 'pop' });
      this.banner(`${p.name}'s ${p.artifact ? artifactDef(p.artifact).name : 'artifact'} flares: back from the brink!`, 'good');
      p.sounds.push('revived');
    }
    if (p.hp <= 0) {
      p.hp = 0;
      p.downed = true;
      this.log('An ally has fallen', 'danger');
      // A boss that gloats laughs at every fallen hero.
      if (this.bossPhase === 'fight') {
        for (const b of this.bosses) {
          if (b.dead || !NAMED_BOSSES[b.type]?.voice?.gloat) continue;
          this.fx.push({ k: 'voice', snd: NAMED_BOSSES[b.type]!.voice!.sound, x: Math.round(b.x), y: Math.round(b.y) });
          b.voiceAt = Math.max(b.voiceAt, this.fightTime + 6); // Not again right after.
        }
      }
      p.revive = 0;
      p.epoch++; // Pin the client to where the server says they went down.
    }
    return true;
  }

  private updateRevive(p: Player, dt: number): void {
    const helped = this.alivePlayers().some((o) => dist2(o.x, o.y, p.x, p.y) < REVIVE_RADIUS ** 2);
    p.revive = helped ? p.revive + dt / REVIVE_TIME : Math.max(0, p.revive - dt / REVIVE_TIME);
    if (p.revive >= 1) {
      this.log(`${p.name} is back up`, 'good');
      p.downed = false;
      p.revive = 0;
      p.hp = this.stats(p).maxHp * 0.5;
    }
  }

  private dodge(p: Player): void {
    // A little slack on the cooldown, since the client times it on its own clock.
    if (this.phase !== 'playing' || this.pause || p.downed || p.dodgeCooldown > 0.25) return;
    p.dodgeCooldown = this.stats(p).dodgeCooldown;
    p.invuln = DODGE_IFRAMES;
  }

  /** Which walls a player can currently pass: dodging clears fences, and some heroes phase through anything. */
  private passFlags(p: Player): PassFlags | undefined {
    if (p.invuln <= 0) return undefined;
    return { thin: true, thick: CHARACTERS[p.character].phaseWalls };
  }

  private movePlayer(p: Player, x: unknown, y: unknown, aim: unknown, epoch: unknown): void {
    // Moves still arrive just after a pause starts (sent before the client knew): take them, or the client would be
    // snapped back and its dash cut short. Clients stand still while paused, so nothing more comes.
    if (p.downed || epoch !== p.epoch) return;
    if (typeof aim === 'number' && Number.isFinite(aim)) p.aim = aim;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
    // Trust the client, but cap how far one message can move you (further while dodging), and respect walls.
    const maxStep = (p.invuln > 0 ? DODGE_SPEED : this.stats(p).speed) * 0.25 + 8;
    let dx = x - p.x;
    let dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > maxStep) {
      dx = (dx / d) * maxStep;
      dy = (dy / d) * maxStep;
    }
    ({ x: p.x, y: p.y } = moveCircle(this.walls, p.x, p.y, dx, dy, PLAYER_RADIUS, this.passFlags(p)));
    if (p.inArena) this.keepInArena(p, PLAYER_RADIUS);
    // The client went somewhere the server won't follow (e.g. through a wall): put it back.
    if (dist2(p.x, p.y, x, y) > DESYNC_LIMIT ** 2) p.epoch++;
  }

  // --- Weapons ---

  private fireWeapons(p: Player, stats: PlayerStats, dt: number): void {
    for (const id of WEAPON_IDS) {
      const level = p.upgrades[id];
      if (!level) continue;
      if (id === 'orbit' || id === 'embers') {
        this.orbitHits(p, stats, id);
        continue;
      }
      if (id === 'wolves') {
        this.syncPack(p, level, stats);
        continue;
      }
      const cooldown = (p.cooldowns[id] ?? 0) - dt;
      p.cooldowns[id] = cooldown > 0 ? cooldown : this.fire(p, id, level, stats) * stats.cooldownMult;
    }
  }

  /** Fires a weapon and returns its cooldown. */
  private fire(p: Player, id: WeaponId, level: number, stats: PlayerStats): number {
    switch (id) {
      case 'bolt': {
        const s = boltStats(level);
        const explosion = s.explosion && { ...s.explosion, radius: s.explosion.radius * stats.area };
        this.shootFan(p, ProjectileKind.Bolt, { ...s, count: s.count + stats.projectiles, explosion }, stats, 'magic');
        p.sounds.push('bolt');
        return s.cooldown;
      }
      case 'knives': {
        const s = knivesStats(level);
        this.shootFan(p, ProjectileKind.Knife, { ...s, count: s.count + stats.projectiles }, stats, 'physical');
        for (let i = 0; i < s.ring; i++) this.shoot(p, ProjectileKind.Knife, p.aim + (i * Math.PI * 2) / s.ring, s, stats, 'physical');
        p.sounds.push('knives');
        return s.cooldown;
      }
      case 'hex': {
        // Hexes don't need aim: they fan out around your aim and then find their own targets.
        const s = hexStats(level);
        const count = s.count + stats.projectiles;
        for (let i = 0; i < count; i++) this.shoot(p, ProjectileKind.Hex, p.aim + (i - (count - 1) / 2) * s.spread, s, stats, 'magic', true);
        p.sounds.push('hex');
        return s.cooldown;
      }
      case 'storm':
        return this.storm(p, level, stats);
      case 'shuriken': {
        const s = shurikenStats(level);
        // Multishot (and the evolution) fan out extra shurikens.
        const count = s.count + stats.projectiles;
        for (let i = 0; i < count; i++) {
          const angle = p.aim + (i - (count - 1) / 2) * 0.3;
          const pr = this.projectile(p, s.count > 1 ? ProjectileKind.BigShuriken : ProjectileKind.Shuriken, angle, s.speed, s.damage * stats.damageMult, 5, 'physical');
          pr.pierce = Infinity;
          pr.radius = s.radius * stats.area;
          pr.phasing = true;
          pr.boomerang = { range: s.range, traveled: 0, returning: false };
        }
        p.sounds.push('shuriken');
        return s.cooldown;
      }
      case 'daggers':
        return this.stab(p, level, stats);
      case 'fireball': {
        const s = fireballStats(level);
        const count = s.count + stats.projectiles;
        for (let i = 0; i < count; i++) {
          const angle = p.aim + (i - (count - 1) / 2) * s.spread;
          const pr = this.projectile(p, ProjectileKind.Fireball, angle, s.speed, s.damage * stats.damageMult, s.range / s.speed, 'magic');
          pr.radius = 9;
          pr.explosion = { radius: s.explosion.radius * stats.area, damage: s.damage * stats.damageMult * s.explosion.damageShare, color: 0xff6d00 };
          if (s.burn) pr.burn = { damage: s.burn.damage * stats.damageMult, life: s.burn.life * stats.duration };
        }
        p.sounds.push('fireball');
        return s.cooldown;
      }
      case 'arrows': {
        const s = arrowsStats(level);
        this.shootFan(p, ProjectileKind.Arrow, { ...s, count: s.count + stats.projectiles }, stats, 'physical');
        p.sounds.push('arrow');
        return s.cooldown;
      }
      case 'cleave':
        return this.cleave(p, level, stats);
      case 'slam':
        return this.slam(p, level, stats);
      case 'field': {
        const s = fieldStats(level);
        const r = s.radius * stats.area;
        for (const e of this.grid.query(p.x, p.y, r + MAX_ENEMY_RADIUS, this.near)) {
          if (!e.dead && dist2(e.x, e.y, p.x, p.y) < (r + ENEMY_TYPES[e.type].radius) ** 2) this.damageEnemy(e, s.damage * stats.damageMult, p, 'magic');
        }
        this.hitCratesAround(p.x, p.y, r, s.damage * stats.damageMult, p);
        return s.interval;
      }
      case 'venom': {
        const s = venomStats(level);
        // A new puddle once you've moved far enough from the last one.
        if (dist2(p.x, p.y, p.lastVenomX, p.lastVenomY) >= s.spacing ** 2) {
          p.lastVenomX = p.x;
          p.lastVenomY = p.y;
          this.addZone(p, ZoneKind.Venom, s.radius * stats.area, 0, s.damage * stats.damageMult, s.life * stats.duration, 0, 'magic');
          const venom = this.zones.filter((z) => z.kind === ZoneKind.Venom && !z.dead);
          if (venom.length > MAX_VENOM) venom[0].dead = true;
        }
        return 0.1;
      }
      case 'flask':
        return this.flasks(p, level, stats);
      case 'hammer':
        return this.hammer(p, level, stats);
      case 'smite':
        return this.smite(p, level, stats);
      case 'mines': {
        const s = minesStats(level);
        const mine = this.zones.filter((z) => z.kind === ZoneKind.Mine && z.owner === p.id && !z.dead);
        if (mine.length >= s.max) mine[0].dead = true; // Replace the oldest.
        this.addZone(p, ZoneKind.Mine, s.trigger, s.radius * stats.area, s.damage * stats.damageMult, 60, s.armTime, 'physical');
        p.sounds.push('mine');
        return s.cooldown;
      }
      default:
        return 1;
    }
  }

  private addZone(p: Player, kind: number, r: number, blast: number, damage: number, life: number, timer: number, type: DamageType): void {
    this.zones.push({ id: this.nextId++, kind, owner: p.id, x: p.x, y: p.y, r, blast, damage, life, timer, type, dead: false });
  }

  /** Burning ground at (x, y). */
  private addZoneAt(p: Player, kind: number, x: number, y: number, r: number, damage: number, life: number, type: DamageType): void {
    this.zones.push({ id: this.nextId++, kind, owner: p.id, x, y, r, blast: 0, damage, life, timer: 0, type, dead: false });
    const same = this.zones.filter((z) => z.kind === kind && !z.dead);
    if (same.length > MAX_VENOM) same[0].dead = true;
  }

  /** Standing in an artifact's sanctuary dome: nothing can hurt you. */
  private sheltered(p: Player): boolean {
    return this.zones.some((z) => z.kind === ZoneKind.Sanctuary && !z.dead && dist2(p.x, p.y, z.x, z.y) < z.r ** 2);
  }

  /** Venom puddles tick damage; mines arm, then blow up when an enemy comes close. */
  private updateZones(dt: number): void {
    for (const z of this.zones) {
      if (z.dead) continue;
      z.life -= dt;
      z.timer -= dt;
      if (z.life <= 0) {
        z.dead = true;
        continue;
      }
      if (z.kind === ZoneKind.Sanctuary) continue; // It only shelters players (see sheltered).
      const owner = this.players.get(z.owner);
      if (z.kind !== ZoneKind.Mine) {
        if (z.timer > 0) continue;
        z.timer = z.tick ?? (z.kind === ZoneKind.Venom ? VENOM_TICK : BURN_TICK);
        // Flying enemies float over venom and poison pools, but not over fire or holy light.
        const hitsFlying = z.kind !== ZoneKind.Venom && z.kind !== ZoneKind.Toxic;
        if (z.heal) {
          for (const ally of this.players.values()) {
            if (ally.downed || dist2(ally.x, ally.y, z.x, z.y) >= (z.r + PLAYER_RADIUS) ** 2) continue;
            this.heal(ally, z.heal, owner);
          }
        }
        for (const e of this.grid.query(z.x, z.y, z.r + MAX_ENEMY_RADIUS, this.near)) {
          if (!e.dead && (hitsFlying || !ENEMY_TYPES[e.type].flying) && dist2(e.x, e.y, z.x, z.y) < (z.r + ENEMY_TYPES[e.type].radius) ** 2) {
            this.damageEnemy(e, z.damage, owner, z.type);
            if (!hitsFlying) e.slowUntil = Math.max(e.slowUntil, this.time + POISON_SLOW.linger);
          }
        }
        if (z.damage > 0) this.hitCratesAround(z.x, z.y, z.r, z.damage, owner);
      } else if (z.timer <= 0) {
        const triggered =
          this.grid.query(z.x, z.y, z.r + MAX_ENEMY_RADIUS, this.near).some((e) => !e.dead && dist2(e.x, e.y, z.x, z.y) < (z.r + ENEMY_TYPES[e.type].radius) ** 2) ||
          this.cratesNear(z.x, z.y, z.r).length > 0;
        if (!triggered) continue;
        z.dead = true;
        this.splash(z.x, z.y, z.blast, z.damage, owner, z.type);
        this.hitCratesAround(z.x, z.y, z.blast, z.damage);
        this.fx.push({ k: 'ring', x: Math.round(z.x), y: Math.round(z.y), r: z.blast, c: 0xffab40, snd: 'explode' });
      }
    }
    this.zones = this.zones.filter((z) => !z.dead);
  }

  /** A plain projectile from the player (callers adjust the extras). */
  private projectile(p: Player, kind: number, angle: number, speed: number, damage: number, life: number, type: DamageType): Projectile {
    const pr: Projectile = {
      id: this.nextId++,
      kind,
      owner: p.id,
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      type,
      pierce: 0,
      life,
      hit: new Set(),
      explosion: null,
      radius: PROJECTILE_RADIUS,
      phasing: false,
      boomerang: null,
      homing: false,
      target: null,
      dead: false,
    };
    this.projectiles.push(pr);
    return pr;
  }

  /** Flask Toss: lob flasks at different enemies nearby; each splashes and leaves acid where it lands. */
  private flasks(p: Player, level: number, stats: PlayerStats): number {
    const s = flaskStats(level);
    const inRange: { x: number; y: number }[] = this.grid.query(p.x, p.y, s.range, this.near).filter((e) => !e.dead && dist2(e.x, e.y, p.x, p.y) < s.range ** 2);
    // Nobody about: a crate will do.
    if (inRange.length === 0) inRange.push(...this.cratesNear(p.x, p.y, s.range).slice(0, 1));
    if (inRange.length === 0) return 0.2;
    inRange.sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y));
    const count = s.count + stats.projectiles;
    const r = s.radius * stats.area;
    for (let i = 0; i < count; i++) {
      // The nearest few, then spread over the rest of the crowd.
      const e = inRange[i < inRange.length ? i : Math.floor(Math.random() * inRange.length)];
      const x = e.x + (Math.random() - 0.5) * 20;
      const y = e.y + (Math.random() - 0.5) * 20;
      this.blasts.push({
        x,
        y,
        r,
        damage: s.damage * stats.damageMult,
        owner: p.id,
        t: s.flight,
        color: 0x76ff03,
        type: 'magic',
        puddle: { r: r * s.puddle.scale, damage: s.puddle.damage * stats.damageMult, life: s.puddle.life * stats.duration },
      });
      this.fx.push({ k: 'cast', x: Math.round(x), y: Math.round(y), r, c: 0x76ff03, t: s.flight });
    }
    p.sounds.push('flask');
    return s.cooldown;
  }

  /** Judgment Hammer: holy light smashed down in front of you, plus pillars on other enemies once evolved. */
  private hammer(p: Player, level: number, stats: PlayerStats): number {
    const s = hammerStats(level);
    const r = s.radius * stats.area;
    const x = p.x + Math.cos(p.aim) * s.reach;
    const y = p.y + Math.sin(p.aim) * s.reach;
    const damage = s.damage * stats.damageMult;
    for (const e of this.grid.query(x, y, r + MAX_ENEMY_RADIUS, this.near)) {
      if (e.dead || dist2(e.x, e.y, x, y) >= (r + ENEMY_TYPES[e.type].radius) ** 2) continue;
      this.damageEnemy(e, damage, p, 'magic');
      this.knockback(e, p.x, p.y, s.knockback);
    }
    this.hitCratesAround(x, y, r, damage);
    this.fx.push({ k: 'ring', x: Math.round(x), y: Math.round(y), r, c: HOLY });
    if (s.pillars > 0) {
      const others = this.grid
        .query(p.x, p.y, 320, this.near)
        .filter((e) => !e.dead && dist2(e.x, e.y, x, y) > r ** 2 && dist2(e.x, e.y, p.x, p.y) < 320 ** 2);
      for (let i = 0; i < s.pillars + stats.projectiles && others.length > 0; i++) {
        const e = others.splice(Math.floor(Math.random() * others.length), 1)[0];
        this.splash(e.x, e.y, r * 0.7, damage, p, 'magic');
        this.fx.push({ k: 'zap', x: Math.round(e.x), y: Math.round(e.y) });
        this.fx.push({ k: 'ring', x: Math.round(e.x), y: Math.round(e.y), r: r * 0.7, c: HOLY });
      }
    }
    p.sounds.push('hammer');
    return s.cooldown;
  }

  /** Smite: light strikes the nearest enemies, and the most hurt ally nearby is mended. */
  private smite(p: Player, level: number, stats: PlayerStats): number {
    const s = smiteStats(level);
    const inRange = this.grid
      .query(p.x, p.y, s.range, this.near)
      .filter((e) => !e.dead && dist2(e.x, e.y, p.x, p.y) < s.range ** 2)
      .sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y));
    const strikes = s.targets + stats.projectiles;
    const crates = this.cratesNear(p.x, p.y, s.range).slice(0, Math.max(0, strikes - inRange.length));
    if (inRange.length === 0 && crates.length === 0) return 0.2;
    for (const e of inRange.slice(0, strikes)) {
      this.damageEnemy(e, s.damage * stats.damageMult, p, 'magic');
      this.fx.push({ k: 'zap', x: Math.round(e.x), y: Math.round(e.y) });
      this.fx.push({ k: 'ring', x: Math.round(e.x), y: Math.round(e.y), r: 28, c: HOLY });
    }
    for (const c of crates) {
      this.damageCrate(c, s.damage * stats.damageMult, p);
      this.fx.push({ k: 'zap', x: Math.round(c.x), y: Math.round(c.y) });
    }
    // The ally (or yourself) missing the biggest share of their health.
    let patient: Player | null = null;
    let worst = 1;
    for (const ally of this.players.values()) {
      if (ally.downed || dist2(ally.x, ally.y, p.x, p.y) > s.healRange ** 2) continue;
      const share = ally.hp / this.stats(ally).maxHp;
      if (share < worst) {
        worst = share;
        patient = ally;
      }
    }
    if (patient) this.heal(patient, s.heal, p);
    p.sounds.push('smite');
    return s.cooldown;
  }

  /** Shadow Daggers: stab the nearest enemies within reach (or all of them, evolved). */
  private stab(p: Player, level: number, stats: PlayerStats): number {
    const s = daggersStats(level);
    const inReach = this.grid
      .query(p.x, p.y, s.range + MAX_ENEMY_RADIUS, this.near)
      .filter((e) => !e.dead && dist2(e.x, e.y, p.x, p.y) < (s.range + ENEMY_TYPES[e.type].radius) ** 2)
      .sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y));
    const stabs = s.all ? Infinity : s.targets + stats.projectiles;
    const crates = this.cratesNear(p.x, p.y, s.range + CRATE_RADIUS).slice(0, Math.max(0, stabs - inReach.length));
    if (inReach.length === 0 && crates.length === 0) return 0.1; // Nobody close: try again soon.
    const targets = s.all ? inReach : inReach.slice(0, stabs);
    for (const e of [...targets, ...crates]) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      if ('type' in e) this.damageEnemy(e, s.damage * stats.damageMult, p, 'physical');
      else this.damageCrate(e, s.damage * stats.damageMult, p);
      this.fx.push({ k: 'slash', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(Math.sqrt(dist2(e.x, e.y, p.x, p.y)) + 12), a: round2(a), arc: 0.5, c: p.color });
    }
    p.sounds.push('dagger');
    return s.cooldown;
  }

  /** Keeps the druid's Wolf Pack at the size its level calls for. */
  private syncPack(p: Player, level: number, stats: PlayerStats): void {
    const want = wolvesStats(level).count + stats.projectiles;
    const pack = this.summons.filter((m) => m.owner === p.id && m.pack && !m.dead);
    for (let i = pack.length; i < want; i++) this.summon(p, SummonKind.Wolf, p.x, p.y, Infinity, true);
    for (let i = want; i < pack.length; i++) pack[i].dead = true;
  }

  private summon(p: Player, kind: number, x: number, y: number, life: number, pack = false): Summon {
    const m: Summon = {
      id: this.nextId++,
      kind,
      owner: p.id,
      x,
      y,
      life,
      timer: 0,
      pack,
      prey: null,
      chase: 0,
      ignoreId: 0,
      ignoreUntil: 0,
      damage: 0,
      ordered: false,
      dead: false,
    };
    this.summons.push(m);
    return m;
  }

  /** Wolves hunt enemies near their druid and bite; the bear does too, but slower and harder (or what it's sent at). */
  private updateSummons(dt: number): void {
    for (const m of this.summons) {
      const owner = this.players.get(m.owner);
      m.life -= dt;
      if (!owner || m.life <= 0) m.dead = true;
      if (m.dead || !owner) continue;
      m.timer -= dt;
      const stats = this.stats(owner);
      if (m.kind === SummonKind.Bear) {
        this.updateBear(m, owner, stats, dt);
        continue;
      }
      // Wolves: pack wolves use the Wolf Pack's level; Call of the Wild's were set by the ability's level.
      const level = owner.upgrades.wolves ?? 0;
      const s = wolvesStats(Math.max(1, level));
      const damage = (m.pack ? s.damage : m.damage) * stats.damageMult;
      // Keep hunting the same prey until it dies or gets well away from the druid; chasing too long without a
      // bite means it's out of reach for now.
      let target = m.prey;
      if (target && (target.dead || dist2(target.x, target.y, owner.x, owner.y) > (s.leash + WOLF.keepSlack) ** 2 || m.chase > WOLF.giveUp)) {
        if (!target.dead && m.chase > WOLF.giveUp) {
          m.ignoreId = target.id;
          m.ignoreUntil = this.time + WOLF.ignoreFor;
        }
        target = null;
      }
      if (!target) {
        m.chase = 0;
        let best = Infinity;
        for (const e of this.grid.query(owner.x, owner.y, s.leash, this.near)) {
          if (e.dead || dist2(e.x, e.y, owner.x, owner.y) > s.leash ** 2) continue;
          if (e.id === m.ignoreId && this.time < m.ignoreUntil) continue;
          // Nearest, but spread over prey the rest of the pack isn't already on.
          const hunters = this.summons.filter((o) => o !== m && o.prey === e).length;
          const d = Math.sqrt(dist2(e.x, e.y, m.x, m.y)) + hunters * WOLF.crowding;
          if (d < best) {
            best = d;
            target = e;
          }
        }
      }
      m.prey = target;
      let tx: number;
      let ty: number;
      const crate = target ? null : (this.cratesNear(owner.x, owner.y, s.leash)[0] ?? null);
      if (target) {
        tx = target.x;
        ty = target.y;
      } else if (crate) {
        tx = crate.x;
        ty = crate.y;
        if (dist2(m.x, m.y, crate.x, crate.y) <= (WOLF.radius + CRATE_RADIUS + WOLF.reach) ** 2 && m.timer <= 0) {
          m.timer = s.biteCooldown * stats.cooldownMult;
          this.damageCrate(crate, damage, owner);
          owner.sounds.push('bite');
        }
      } else {
        // Nothing to hunt: trot along beside the druid.
        const slot = (m.id % 7) / 7;
        tx = owner.x + Math.cos(slot * Math.PI * 2) * WOLF.followRadius;
        ty = owner.y + Math.sin(slot * Math.PI * 2) * WOLF.followRadius;
      }
      const d = Math.hypot(tx - m.x, ty - m.y);
      const reach = target ? WOLF.radius + ENEMY_TYPES[target.type].radius + WOLF.reach : 4;
      // Close in to well inside biting range (so prey that keeps walking doesn't slip out of it again)...
      const close = target ? reach * 0.6 : reach;
      if (d > close) {
        const lunge = target && d < WOLF.lungeRange ? WOLF.lunge : 1;
        const step = Math.min(d - close, ((s.speed * stats.speed) / CHARACTERS[owner.character].speed) * lunge * dt);
        m.x += ((tx - m.x) / d) * step;
        m.y += ((ty - m.y) / d) * step;
      }
      // ...and bite as soon as it's in range, even on the same tick as moving.
      const inRange = target !== null && dist2(m.x, m.y, target.x, target.y) <= reach * reach;
      if (target && !inRange) m.chase += dt;
      if (target && inRange && m.timer <= 0) {
        m.chase = 0;
        m.timer = s.biteCooldown * stats.cooldownMult;
        this.damageEnemy(target, damage, owner, 'physical');
        if (m.pack && s.splash > 0) this.splash(target.x, target.y, s.splash * stats.area, damage * 0.5, owner, 'physical', target);
        owner.sounds.push('bite');
      }
      // Don't let a wolf get left behind on the other side of the map.
      if (dist2(m.x, m.y, owner.x, owner.y) > 900 ** 2) {
        m.x = owner.x;
        m.y = owner.y;
      }
    }
    this.summons = this.summons.filter((m) => !m.dead);
  }

  /** The Spirit Bear: hunts the enemy nearest it around its druid, or chases down whatever it was sent after. */
  private updateBear(m: Summon, owner: Player, stats: PlayerStats, dt: number): void {
    let target = m.prey;
    if (target && (target.dead || target.burrowed || (!m.ordered && dist2(target.x, target.y, owner.x, owner.y) > (BEAR.leash + WOLF.keepSlack) ** 2))) target = null;
    if (!target) {
      m.ordered = false;
      let best = Infinity;
      for (const e of this.grid.query(owner.x, owner.y, BEAR.leash, this.near)) {
        if (e.dead || dist2(e.x, e.y, owner.x, owner.y) > BEAR.leash ** 2) continue;
        const d = dist2(e.x, e.y, m.x, m.y);
        if (d < best) {
          best = d;
          target = e;
        }
      }
    }
    m.prey = target;
    // Nothing to fight: pad along beside the druid.
    const tx = target ? target.x : owner.x - 60;
    const ty = target ? target.y : owner.y + 30;
    const d = Math.hypot(tx - m.x, ty - m.y);
    const reach = target ? BEAR.radius + ENEMY_TYPES[target.type].radius + BEAR.reach : 6;
    const close = target ? reach * 0.7 : reach;
    if (d > close) {
      const step = Math.min(d - close, ((BEAR.speed * stats.speed) / CHARACTERS[owner.character].speed) * dt);
      m.x += ((tx - m.x) / d) * step;
      m.y += ((ty - m.y) / d) * step;
    }
    if (target && m.timer <= 0 && dist2(m.x, m.y, target.x, target.y) <= reach * reach) {
      m.timer = BEAR.swipe * stats.cooldownMult;
      const damage = (BEAR.damage + BEAR.perLevel * this.level) * stats.damageMult;
      this.damageEnemy(target, damage, owner, 'physical');
      this.splash(target.x, target.y, BEAR.splash * stats.area, damage * BEAR.splashShare, owner, 'physical', target);
      const a = Math.atan2(target.y - m.y, target.x - m.x);
      this.fx.push({ k: 'slash', x: Math.round(m.x), y: Math.round(m.y), r: Math.round(reach + BEAR.splash * 0.6), a: round2(a), arc: 1.8, c: 0xffcc80, heavy: true });
      owner.sounds.push('bite');
    }
    if (dist2(m.x, m.y, owner.x, owner.y) > BEAR.tether ** 2) {
      m.x = owner.x;
      m.y = owner.y;
      m.prey = null;
      m.ordered = false;
    }
  }

  /** R again while the bear is out: send it at the enemy nearest the cursor. */
  private directBear(p: Player, bear: Summon, reach: number): void {
    const x = p.x + Math.cos(p.aim) * reach;
    const y = p.y + Math.sin(p.aim) * reach;
    this.rebuildGrid();
    let target: Enemy | null = null;
    let best = BEAR.directRange ** 2;
    for (const e of this.grid.query(x, y, BEAR.directRange, this.near)) {
      const d = dist2(e.x, e.y, x, y);
      if (!e.dead && !e.burrowed && d < best) {
        best = d;
        target = e;
      }
    }
    if (!target) return;
    bear.prey = target;
    bear.ordered = true;
    this.fx.push({ k: 'ring', x: Math.round(target.x), y: Math.round(target.y), r: ENEMY_TYPES[target.type].radius + 18, c: 0xffcc80 });
    p.sounds.push('growl');
  }

  /** A player's Spirit Bear, if it's out. */
  private bearOf(p: Player): Summon | undefined {
    return this.summons.find((m) => m.owner === p.id && m.kind === SummonKind.Bear && !m.dead);
  }

  /** Projectiles fanned out around the aim direction. */
  private shootFan(p: Player, kind: number, s: FanStats, stats: PlayerStats, type: DamageType): void {
    for (let i = 0; i < s.count; i++) this.shoot(p, kind, p.aim + (i - (s.count - 1) / 2) * s.spread, s, stats, type);
  }

  private shoot(p: Player, kind: number, angle: number, s: FanStats, stats: PlayerStats, type: DamageType, homing = false): void {
    const damage = s.damage * stats.damageMult;
    this.projectiles.push({
      id: this.nextId++,
      kind,
      owner: p.id,
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * s.speed,
      vy: Math.sin(angle) * s.speed,
      damage,
      type,
      pierce: s.pierce,
      life: s.range / s.speed,
      hit: new Set(),
      explosion: s.explosion ? { radius: s.explosion.radius, damage: damage * s.explosion.damageShare } : null,
      radius: PROJECTILE_RADIUS,
      phasing: false,
      boomerang: null,
      homing,
      target: null,
      dead: false,
    });
  }

  /** Damages every enemy within `radius` of (x, y), except `skip`. Safe to call while iterating `this.near`. */
  private splash(x: number, y: number, radius: number, damage: number, by: Player | undefined, type: DamageType, skip?: Enemy): void {
    for (const e of this.grid.query(x, y, radius + MAX_ENEMY_RADIUS, this.splashNear)) {
      if (e !== skip && dist2(e.x, e.y, x, y) < (radius + ENEMY_TYPES[e.type].radius) ** 2) this.damageEnemy(e, damage, by, type);
    }
  }

  private storm(p: Player, level: number, stats: PlayerStats): number {
    const s = stormStats(level);
    const inRange = this.grid
      .query(p.x, p.y, s.range, this.near)
      .filter((e) => !e.dead && dist2(e.x, e.y, p.x, p.y) < s.range ** 2);
    // Strikes left over (or nothing else around) find crates.
    const crates = this.cratesNear(p.x, p.y, s.range).slice(0, Math.max(0, s.strikes + stats.projectiles - inRange.length));
    for (const c of crates) {
      this.hitCratesAround(c.x, c.y, s.splash * stats.area, s.damage * stats.damageMult, p);
      this.fx.push({ k: 'zap', x: Math.round(c.x), y: Math.round(c.y) });
    }
    if (inRange.length === 0) return crates.length > 0 ? s.cooldown : 0.25; // Nothing to hit; check again soon.
    for (let i = 0; i < s.strikes + stats.projectiles && inRange.length > 0; i++) {
      const target = inRange.splice(Math.floor(Math.random() * inRange.length), 1)[0];
      if (target.dead) {
        i--; // Already killed by an earlier strike's splash.
        continue;
      }
      this.splash(target.x, target.y, s.splash * stats.area, s.damage * stats.damageMult, p, 'magic');
      this.fx.push({ k: 'zap', x: Math.round(target.x), y: Math.round(target.y) });
    }
    return s.cooldown;
  }

  private cleave(p: Player, level: number, stats: PlayerStats): number {
    const base = cleaveStats(level);
    const s = { ...base, range: base.range * stats.area };
    const damage = s.damage * stats.damageMult;
    for (const e of this.grid.query(p.x, p.y, s.range + MAX_ENEMY_RADIUS, this.near)) {
      if (e.dead || !this.inSwing(p, e.x, e.y, ENEMY_TYPES[e.type].radius, s.range, s.arc)) continue;
      this.damageEnemy(e, damage, p, 'physical');
      this.knockback(e, p.x, p.y, s.knockback);
    }
    for (const c of this.pickups) {
      if (this.breakable(c) && this.inSwing(p, c.x, c.y, CRATE_RADIUS, s.range, s.arc)) this.damageCrate(c, damage, p);
    }
    this.fx.push({ k: 'slash', x: Math.round(p.x), y: Math.round(p.y), r: s.range, a: round2(p.aim), arc: s.arc, c: p.color });
    return s.cooldown;
  }

  /** Is a circle at (x, y) with radius r inside the swing arc in front of the player? */
  private inSwing(p: Player, x: number, y: number, r: number, range: number, arc: number): boolean {
    const dx = x - p.x;
    const dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > range + r) return false;
    if (d < r + PLAYER_RADIUS) return true; // Hugging the player always counts.
    let diff = Math.atan2(dy, dx) - p.aim;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // Wrap to -PI..PI.
    return Math.abs(diff) <= arc / 2;
  }

  private slam(p: Player, level: number, stats: PlayerStats): number {
    const base = slamStats(level);
    const s = { ...base, radius: base.radius * stats.area, stun: base.stun * stats.duration };
    const damage = s.damage * stats.damageMult;
    for (const e of this.grid.query(p.x, p.y, s.radius + MAX_ENEMY_RADIUS, this.near)) {
      if (e.dead || dist2(e.x, e.y, p.x, p.y) >= (s.radius + ENEMY_TYPES[e.type].radius) ** 2) continue;
      this.damageEnemy(e, damage, p, 'physical');
      this.knockback(e, p.x, p.y, s.knockback);
      if (s.stun) this.stun(e, s.stun);
    }
    for (const c of this.pickups) {
      if (this.breakable(c) && dist2(c.x, c.y, p.x, p.y) < (s.radius + CRATE_RADIUS) ** 2) this.damageCrate(c, damage, p);
    }
    this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: s.radius, c: p.color, snd: 'slam' });
    return s.cooldown;
  }

  /** Orbit's blades, or the Ember Halo's fireballs (each with its own per-enemy cooldown and damage type). */
  private orbitHits(p: Player, stats: PlayerStats, weapon: 'orbit' | 'embers' = 'orbit'): void {
    const s = orbitLayout(p.upgrades, p.character, p.artifact, weapon);
    if (!s) return;
    const embers = weapon === 'embers';
    const type = damageType(weapon);
    const hitUntil = (e: Enemy) => (embers ? e.emberHitUntil : e.orbitHitUntil);
    const hit = (e: Enemy) => {
      if (embers) e.emberHitUntil = this.time + s.hitCooldown / s.count;
      else e.orbitHitUntil = this.time + s.hitCooldown / s.count;
      this.damageEnemy(e, s.damage * stats.damageMult, p, type);
    };
    for (let i = 0; i < s.count; i++) {
      // Clients draw them with this same formula (the halo sits half a step off Orbit's blades).
      const angle = this.time * s.spin + ((i + (embers ? 0.5 : 0)) * Math.PI * 2) / s.count;
      const bx = p.x + Math.cos(angle) * s.radius;
      const by = p.y + Math.sin(angle) * s.radius;
      for (const e of this.grid.query(bx, by, s.bladeRadius + MAX_ENEMY_RADIUS, this.near)) {
        if (e.dead || hitUntil(e) > this.time) continue;
        if (dist2(e.x, e.y, bx, by) >= (s.bladeRadius + ENEMY_TYPES[e.type].radius) ** 2) continue;
        hit(e);
      }
    }
    // Crates the blades pass over.
    for (let i = 0; i < s.count; i++) {
      const angle = this.time * s.spin + ((i + (embers ? 0.5 : 0)) * Math.PI * 2) / s.count;
      const bx = p.x + Math.cos(angle) * s.radius;
      const by = p.y + Math.sin(angle) * s.radius;
      for (const c of this.cratesNear(bx, by, s.bladeRadius + CRATE_RADIUS)) {
        if (c.flashUntil > this.time) continue;
        this.damageCrate(c, s.damage * stats.damageMult, p);
        c.flashUntil = this.time + s.hitCooldown / s.count;
      }
    }
    // Enemies pressed right up against you are inside the ring, where no blade passes: they get cut up anyway.
    for (const e of this.grid.query(p.x, p.y, PLAYER_RADIUS + MAX_ENEMY_RADIUS + 4, this.near)) {
      if (e.dead || hitUntil(e) > this.time) continue;
      if (dist2(e.x, e.y, p.x, p.y) >= (PLAYER_RADIUS + ENEMY_TYPES[e.type].radius + 4) ** 2) continue;
      hit(e);
    }
  }

  private knockback(e: Enemy, fromX: number, fromY: number, amount: number): void {
    if (ENEMY_TYPES[e.type].radius >= 50 || ENEMY_TYPES[e.type].behavior === 'ward') return; // Bosses and wards don't budge.
    const dx = e.x - fromX;
    const dy = e.y - fromY;
    const d = Math.hypot(dx, dy);
    if (d === 0) return;
    this.moveEnemy(e, (dx / d) * amount, (dy / d) * amount);
  }

  /** Damage from a player rolls for a crit and feeds their lifesteal and damage stats. */
  /** How much of a damage type an enemy shrugs off: its own armor or ward, plus a champion's. True damage ignores it all. */
  private resistance(e: Enemy, type: DamageType): number {
    if (type === 'true') return 0;
    const def = ENEMY_TYPES[e.type];
    let r = (type === 'physical' ? def.armor : def.ward) ?? 0;
    if ((type === 'physical' && e.affix === Affix.Armored) || (type === 'magic' && e.affix === Affix.Warded)) r += AFFIX_TUNING.resist;
    return Math.min(MAX_RESIST, r);
  }

  /** Damage from a player rolls for a crit (physical only) and feeds their lifesteal and damage stats. */
  private damageEnemy(e: Enemy, amount: number, by: Player | undefined, type: DamageType): void {
    if (e.dead) return;
    // Shielded during a side mission.
    if (this.mission && this.bosses.includes(e)) return;
    // Boss mechanics: dug in, shelled, cracked open, or shielded by its twin. Mordak: in the air, or roosting.
    if (e.burrowed || this.untouchable(e)) return;
    if (e.shell) amount *= 1 - BOSS_MECHANICS.shell.reduction;
    if (e.exposedUntil > this.time) amount *= 1 + BOSS_MECHANICS.shell.exposedBonus;
    if (e.linked) amount *= 1 - BOSS_MECHANICS.kindred.reduction;
    amount *= 1 - this.resistance(e, type);
    if (by) {
      const stats = this.stats(by);
      amount *= stats.typeDamage[type];
      const crit = (CRIT_TYPES[type] || (type === 'magic' && stats.magicCrit)) && stats.critChance > 0 && Math.random() < stats.critChance;
      if (crit) amount *= CRIT_MULTIPLIER;
      // Add to this enemy's damage number for the tick (one number per damage type).
      const typeId = DAMAGE_TYPES.indexOf(type);
      const key = e.id * 4 + typeId;
      const hit = by.hits.get(key);
      if (hit) {
        hit.amount += amount;
        hit.crit ||= crit;
        hit.x = e.x;
        hit.y = e.y;
      } else {
        by.hits.set(key, { x: e.x, y: e.y, amount, crit, type: typeId });
      }
      const dealt = Math.min(amount, e.hp);
      by.damageDealt += dealt;
      by.damageByType[DAMAGE_TYPES.indexOf(type)] += dealt;
      if (stats.lifesteal > 0 && !by.downed) {
        // Capped per second, or it would scale with enemy health and outheal anything late in the run.
        const heal = Math.min(dealt * stats.lifesteal, by.lifestealBudget);
        by.lifestealBudget -= heal;
        by.hp = Math.min(stats.maxHp, by.hp + heal * stats.support);
      }
    }
    e.hp -= amount;
    e.flashUntil = this.time + 0.1;
    if (e.hp > 0) return;
    e.dead = true;
    if (e.hazard) e.hazard.dead = true;
    if (by) by.kills++;
    if (e.type === EnemyType.Warlord) {
      this.dropArtifact('warlord', e.x, e.y);
      if (!this.warlord()) this.banner('The Warlord has fallen!', 'good');
    }
    else if (e.affix) this.dropArtifact('champion', e.x, e.y);
    if (e.partOf) this.wingTorn(e);
    if (this.bosses.includes(e)) this.bossDied(e);
    else if (this.quest?.kind === 'hunt' && e.id === this.quest.targetId) this.completeQuest(e.x, e.y);
    else if (ENEMY_TYPES[e.type].xp > 0) this.dropGem(e.x, e.y, Math.round(ENEMY_TYPES[e.type].xp * this.horde().xp * (e.affix ? CHAMPION.xp : 1)));
    if (e.affix === Affix.Volatile) {
      const v = AFFIX_TUNING.volatile;
      this.addHazard(HazardKind.Circle, e.x, e.y, v.radius, 0, 0, v.delay, v.damage * this.damageScale({ ...e, affix: Affix.None }));
    } else if (e.affix === Affix.Splitting) {
      for (let i = 0; i < AFFIX_TUNING.splits; i++) {
        const a = (i / AFFIX_TUNING.splits) * Math.PI * 2;
        const spot = pushOut(this.walls, e.x + Math.cos(a) * 25, e.y + Math.sin(a) * 25, ENEMY_TYPES[e.type].radius);
        this.addEnemy(e.type, spot.x, spot.y, this.enemyHp(e.type));
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const pr of this.projectiles) {
      const owner = this.players.get(pr.owner);
      if (pr.boomerang) this.steerBoomerang(pr, owner, dt);
      if (pr.homing) this.steerHex(pr, dt);
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.dead || pr.life <= 0 || (!pr.phasing && blocksShot(this.walls, pr.x, pr.y))) {
        pr.dead = true;
        continue;
      }
      for (const e of this.grid.query(pr.x, pr.y, pr.radius + MAX_ENEMY_RADIUS, this.near)) {
        if (e.dead || pr.hit.has(e.id)) continue;
        if (dist2(e.x, e.y, pr.x, pr.y) >= (pr.radius + ENEMY_TYPES[e.type].radius) ** 2) continue;
        pr.hit.add(e.id);
        this.damageEnemy(e, pr.damage, owner, pr.type);
        if (pr.explosion) {
          this.splash(e.x, e.y, pr.explosion.radius, pr.explosion.damage, owner, pr.type, e);
          const c = pr.explosion.color ?? 0xb3e5fc;
          this.fx.push({ k: 'ring', x: Math.round(e.x), y: Math.round(e.y), r: pr.explosion.radius, c, snd: c === 0xb3e5fc ? 'pop' : 'explode' });
          if (pr.burn && owner) this.addZoneAt(owner, ZoneKind.Fire, e.x, e.y, pr.explosion.radius * 0.8, pr.burn.damage, pr.burn.life, 'magic');
        }
        if (pr.pierce-- <= 0) {
          pr.dead = true;
          break;
        }
      }
      if (pr.dead) continue;
      for (const c of this.pickups) {
        if (!this.breakable(c) || pr.hit.has(c.id)) continue;
        if (dist2(c.x, c.y, pr.x, pr.y) >= (PROJECTILE_RADIUS + CRATE_RADIUS) ** 2) continue;
        pr.hit.add(c.id);
        this.damageCrate(c, pr.damage);
        if (pr.pierce-- <= 0) {
          pr.dead = true;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
  }

  /** Seeker Hex: turn toward the nearest enemy it hasn't hit yet. */
  private steerHex(pr: Projectile, dt: number): void {
    if (!pr.target || pr.target.dead || pr.hit.has(pr.target.id)) {
      pr.target = null;
      let best = HEX_SEEK ** 2;
      for (const e of this.enemies) {
        if (e.dead || pr.hit.has(e.id)) continue;
        const d = dist2(e.x, e.y, pr.x, pr.y);
        if (d < best) {
          best = d;
          pr.target = e;
        }
      }
    }
    // No enemy nearby: a crate will do. Nothing at all: keep flying straight.
    const to = pr.target ?? this.cratesNear(pr.x, pr.y, HEX_SEEK).find((c) => !pr.hit.has(c.id));
    if (!to) return;
    const speed = Math.hypot(pr.vx, pr.vy);
    const heading = Math.atan2(pr.vy, pr.vx);
    let turn = Math.atan2(to.y - pr.y, to.x - pr.x) - heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const angle = heading + clamp(turn, -HEX_TURN * dt, HEX_TURN * dt);
    pr.vx = Math.cos(angle) * speed;
    pr.vy = Math.sin(angle) * speed;
  }

  /** The shuriken flies out its range, then turns around and homes in on its thrower (hitting everything again). */
  private steerBoomerang(pr: Projectile, owner: Player | undefined, dt: number): void {
    const b = pr.boomerang!;
    const speed = Math.hypot(pr.vx, pr.vy);
    b.traveled += speed * dt;
    if (!b.returning && b.traveled >= b.range) {
      b.returning = true;
      pr.hit.clear();
    }
    if (!b.returning) return;
    if (!owner) {
      pr.dead = true;
      return;
    }
    const dx = owner.x - pr.x;
    const dy = owner.y - pr.y;
    const d = Math.hypot(dx, dy);
    if (d < PLAYER_RADIUS + pr.radius) {
      pr.dead = true; // Caught.
      return;
    }
    pr.vx = (dx / d) * speed;
    pr.vy = (dy / d) * speed;
  }

  // --- Abilities (E) and ultimates (R) ---

  private cast(p: Player, slot: unknown, aim: unknown, dist: unknown): void {
    if (this.phase !== 'playing' || this.pause || p.downed) return;
    if (typeof aim === 'number' && Number.isFinite(aim)) p.aim = aim;
    const reach = typeof dist === 'number' && Number.isFinite(dist) ? clamp(dist, 0, 2000) : 0;
    const hero = CHARACTERS[p.character];
    const stats = this.stats(p);
    if (slot === 'e' && p.abilityCd <= 0 && p.dragonForm > 0) {
      // A dragon's E: breathe fire.
      p.breath = FIREBREATH.duration;
      p.breathTimer = 0;
      p.sounds.push('firebreath');
      p.abilityCd = DRAGON_FORM.breathCooldown * stats.cooldownMult;
    } else if (slot === 'e' && p.abilityCd <= 0) {
      const level = p.upgrades[hero.ability] ?? 0;
      if (level > 0) p.abilityCd = this.castAbility(p, hero.ability, level, reach, stats) * stats.cooldownMult;
    } else if (slot === 'r' && this.bearOf(p)) {
      this.directBear(p, this.bearOf(p)!, reach);
    } else if (slot === 'r' && p.ultCd <= 0) {
      this.castUltimate(p);
      p.ultCd = hero.ultimate.cooldown * stats.ultCooldown;
    } else if (slot === 'q' && p.relicCd <= 0) {
      this.useArtifact(p, stats);
    }
  }

  /** Heals `target` by `amount`, more with the healer's Devotion (`by`: the target itself unless someone else heals). */
  private heal(target: Player, amount: number, by: Player | undefined = target): void {
    target.hp = Math.min(this.stats(target).maxHp, target.hp + amount * (by ? this.stats(by).support : 1));
  }

  /**
   * A shield: `target` takes `reduction` less damage for `seconds` (longer with the giver's Devotion). Stacks with a
   * shield that's already up by keeping the stronger reduction and the longer time.
   */
  private shield(target: Player, reduction: number, seconds: number, by: Player = target): void {
    target.guardReduction = Math.max(target.guard > 0 ? target.guardReduction : 0, reduction);
    target.guard = Math.max(target.guard, seconds * this.stats(by).support);
  }

  /** Q: the equipped artifact's active effect (see ArtifactActive). Its parts combine, in this order. */
  private useArtifact(p: Player, stats: PlayerStats): void {
    const a = p.artifact ? artifactDef(p.artifact).active : undefined;
    if (!a || !p.artifact) return;
    p.relicCd = a.cooldown;
    const color = TIERS[artifactDef(p.artifact).tier].color;
    // Casts arrive between ticks, so bring the enemy lookup up to date first.
    this.rebuildGrid();
    const sounds: SoundId[] = [];
    if (a.blink) {
      // Through enemies and fences, not walls.
      const to = moveCircle(this.walls, p.x, p.y, Math.cos(p.aim) * a.blink, Math.sin(p.aim) * a.blink, PLAYER_RADIUS, { thin: true, thick: false });
      p.x = to.x;
      p.y = to.y;
      if (p.inArena) this.keepInArena(p, PLAYER_RADIUS);
      p.epoch++;
      sounds.push('leap');
    }
    if (a.invuln) {
      p.invuln = Math.max(p.invuln, a.invuln);
      sounds.push('veil');
    }
    if (a.blast) {
      const r = a.blast.radius * stats.area;
      const damage = a.blast.power * this.enemyHp(EnemyType.Grunt) * stats.damageMult;
      const push = a.blast.push ?? 0;
      for (const e of this.grid.query(p.x, p.y, r + MAX_ENEMY_RADIUS, this.splashNear)) {
        if (e.dead || dist2(e.x, e.y, p.x, p.y) >= (r + ENEMY_TYPES[e.type].radius) ** 2) continue;
        this.damageEnemy(e, damage, p, 'true');
        // A pull stops short of the middle instead of flinging them past you.
        const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
        if (push) this.knockback(e, p.x, p.y, push > 0 ? push : -Math.min(-push, Math.max(0, d - 30)));
      }
      this.hitCratesAround(p.x, p.y, r, damage, p);
      this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r, c: color, snd: 'explode' });
      sounds.push('nova');
    }
    if (a.stun) {
      const r = a.stun.radius * stats.area;
      for (const e of this.grid.query(p.x, p.y, r + MAX_ENEMY_RADIUS, this.splashNear)) {
        if (!e.dead && dist2(e.x, e.y, p.x, p.y) < (r + ENEMY_TYPES[e.type].radius) ** 2) this.stun(e, a.stun.duration * stats.duration);
      }
      if (!a.blast) this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r, c: 0x80d8ff });
      sounds.push('clock');
    }
    if (a.heal) {
      this.heal(p, stats.maxHp * a.heal);
      sounds.push('heal');
    }
    if (a.sanctuary) {
      this.zones.push({
        id: this.nextId++,
        kind: ZoneKind.Sanctuary,
        owner: p.id,
        x: p.x,
        y: p.y,
        r: a.sanctuary.radius * stats.area,
        blast: 0,
        damage: 0,
        life: a.sanctuary.duration * stats.duration,
        timer: 0,
        type: 'true',
        dead: false,
      });
      this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(a.sanctuary.radius * stats.area), c: 0xffe082 });
      sounds.push('holy');
    }
    if (a.rally) {
      for (const ally of this.players.values()) {
        if (dist2(ally.x, ally.y, p.x, p.y) >= a.rally.radius ** 2) continue;
        const maxHp = this.stats(ally).maxHp;
        if (ally.downed) {
          this.log(`${ally.name} was revived by ${p.name}'s ${artifactDef(p.artifact).name}`, 'good');
          ally.downed = false;
          ally.revive = 0;
          ally.hp = maxHp * a.rally.heal;
        } else {
          this.heal(ally, maxHp * a.rally.heal, p);
        }
      }
      this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: a.rally.radius, c: color });
      sounds.push('revived');
    }
    if (a.guard) {
      this.shield(p, a.guard.reduction, a.guard.duration);
      sounds.push('brace');
    }
    if (a.frenzy) {
      p.frenzy = a.frenzy.duration;
      sounds.push('roar');
    }
    if (!a.blast && !a.rally) this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 70, c: color });
    p.sounds.push(sounds[0] ?? 'ult');
  }

  /** Casts a hero ability and returns its cooldown. */
  private castAbility(p: Player, id: AbilityId, level: number, reach: number, stats: PlayerStats): number {
    // Casts arrive between ticks, so bring the enemy lookup up to date first.
    this.rebuildGrid();
    const dirX = Math.cos(p.aim);
    const dirY = Math.sin(p.aim);
    switch (id) {
      case 'firewave': {
        // Blasts burst up one after another in a row toward the cursor.
        const s = firewaveStats(level);
        const r = s.radius * stats.area;
        for (let i = 0; i < s.count; i++) {
          const along = 60 + i * s.spacing * Math.max(1, stats.area * 0.9);
          const x = clamp(p.x + dirX * along, 0, this.map.width);
          const y = clamp(p.y + dirY * along, 0, this.map.height);
          if (blocksShot(this.walls, x, y)) break; // A wall stops the wave.
          this.blasts.push({
            x,
            y,
            r,
            damage: s.damage * stats.damageMult,
            owner: p.id,
            t: 0.05 + i * s.stagger,
            type: 'magic',
            color: 0xff6d00,
            burn: s.burn ? { r: r * 0.85, damage: s.burn.damage * stats.damageMult, life: s.burn.life * stats.duration } : undefined,
          });
        }
        p.sounds.push('meteor');
        return s.cooldown;
      }
      case 'meteor': {
        const s = meteorStats(level);
        const d = Math.min(reach, s.maxRange);
        const x = clamp(p.x + dirX * d, 0, this.map.width);
        const y = clamp(p.y + dirY * d, 0, this.map.height);
        const r = s.radius * stats.area;
        this.blasts.push({ x, y, r, damage: s.damage * stats.damageMult, owner: p.id, t: s.delay, type: 'magic' });
        this.fx.push({ k: 'cast', x: Math.round(x), y: Math.round(y), r, c: 0xff9100, t: s.delay });
        // Starfall: smaller meteors land around the first, one after another.
        for (let i = 0; i < s.shower; i++) {
          const angle = (i / s.shower) * Math.PI * 2 + Math.random() * 0.5;
          const sx = clamp(x + Math.cos(angle) * r * 1.3, 0, this.map.width);
          const sy = clamp(y + Math.sin(angle) * r * 1.3, 0, this.map.height);
          const t = s.delay + 0.15 * (i + 1);
          this.blasts.push({ x: sx, y: sy, r: r * 0.6, damage: s.damage * s.showerDamage * stats.damageMult, owner: p.id, t, type: 'magic' });
          this.fx.push({ k: 'cast', x: Math.round(sx), y: Math.round(sy), r: r * 0.6, c: 0xff9100, t });
        }
        p.sounds.push('meteor');
        return s.cooldown;
      }
      case 'leap': {
        const base = leapStats(level);
        const s = { ...base, radius: base.radius * stats.area };
        const d = Math.min(Math.max(reach, 60), s.range);
        // Over walls, but never landing inside one, nor in the ground walled off beside the boss arena (it falls short).
        let far = d;
        let landing = pushOut(this.walls, p.x + dirX * far, p.y + dirY * far, PLAYER_RADIUS);
        while (far > 0 && inSealed(this.map, landing.x, landing.y)) {
          far -= 15;
          landing = pushOut(this.walls, p.x + dirX * Math.max(0, far), p.y + dirY * Math.max(0, far), PLAYER_RADIUS);
        }
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 40, c: p.color });
        p.x = landing.x;
        p.y = landing.y;
        if (p.inArena) this.keepInArena(p, PLAYER_RADIUS);
        p.epoch++; // Moves the client to the landing spot.
        p.invuln = Math.max(p.invuln, 0.25);
        const damage = s.damage * stats.damageMult;
        for (const e of this.grid.query(p.x, p.y, s.radius + MAX_ENEMY_RADIUS, this.near)) {
          if (e.dead || dist2(e.x, e.y, p.x, p.y) >= (s.radius + ENEMY_TYPES[e.type].radius) ** 2) continue;
          this.damageEnemy(e, damage, p, 'physical');
          this.knockback(e, p.x, p.y, s.knockback);
          if (s.stun > 0) this.stun(e, s.stun * stats.duration);
        }
        this.hitCratesAround(p.x, p.y, s.radius, damage);
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: s.radius, c: 0xff5252, snd: 'slam' });
        p.sounds.push('leap');
        return s.cooldown;
      }
      case 'warcry': {
        const base = warcryStats(level);
        const s = { ...base, radius: base.radius * stats.area, taunt: base.taunt * stats.duration, duration: base.duration * stats.duration };
        const damage = s.damage * stats.damageMult;
        for (const e of this.grid.query(p.x, p.y, s.radius + MAX_ENEMY_RADIUS, this.near)) {
          if (e.dead || dist2(e.x, e.y, p.x, p.y) >= (s.radius + ENEMY_TYPES[e.type].radius) ** 2) continue;
          this.damageEnemy(e, damage, p, 'physical');
          e.tauntBy = p.id;
          e.tauntUntil = this.time + s.taunt;
        }
        // Stack with a guard that's already running (e.g. from Rally) by keeping the stronger reduction.
        this.shield(p, s.reduction, s.duration);
        if (s.heal > 0) this.heal(p, stats.maxHp * s.heal);
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: s.radius, c: AURA.guard });
        p.sounds.push('warcry');
        return s.cooldown;
      }
      case 'veil': {
        const s = veilStats(level);
        p.veil = s.duration * stats.duration;
        // Everything chasing you loses the trail.
        for (const e of this.enemies) if (e.tauntBy === p.id) e.tauntUntil = 0;
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 60, c: 0x7e57c2 });
        p.sounds.push('veil');
        // The cooldown starts once the veil drops.
        return s.cooldown + p.veil;
      }
      case 'flamenova': {
        const s = flamenovaStats(level);
        const r = s.radius * stats.area;
        const damage = s.damage * stats.damageMult;
        this.splash(p.x, p.y, r, damage, p, 'magic');
        this.hitCratesAround(p.x, p.y, r, damage);
        this.addZoneAt(p, ZoneKind.Fire, p.x, p.y, r * 0.8, s.burn.damage * stats.damageMult, s.burn.life * stats.duration, 'magic');
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r, c: 0xff6d00, snd: 'explode' });
        // Supernova: more novas where you're standing now.
        for (let i = 1; i <= s.echoes; i++) this.blasts.push({ x: p.x, y: p.y, r: r * (1 + 0.2 * i), damage, owner: p.id, t: 0.4 * i, color: 0xff6d00, type: 'magic' });
        p.sounds.push('nova');
        return s.cooldown;
      }
      case 'tumble': {
        const s = tumbleStats(level);
        // Roll (through fences, not walls) and come up shooting.
        const to = moveCircle(this.walls, p.x, p.y, dirX * s.distance, dirY * s.distance, PLAYER_RADIUS, { thin: true, thick: false });
        p.x = to.x;
        p.y = to.y;
        if (p.inArena) this.keepInArena(p, PLAYER_RADIUS);
        p.epoch++;
        p.invuln = Math.max(p.invuln, 0.3);
        const arrows = s.arrows + 2 * stats.projectiles;
        // The volley goes at the nearest enemy, so you can roll away and still shoot back.
        let nearest: Enemy | null = null;
        for (const e of this.grid.query(p.x, p.y, 700, this.near)) {
          if (!e.dead && (!nearest || dist2(e.x, e.y, p.x, p.y) < dist2(nearest.x, nearest.y, p.x, p.y))) nearest = e;
        }
        const volley = nearest ? Math.atan2(nearest.y - p.y, nearest.x - p.x) : p.aim;
        for (let i = 0; i < arrows; i++) {
          const angle = volley + (i - (arrows - 1) / 2) * (1.0 / Math.max(1, arrows - 1));
          const pr = this.projectile(p, ProjectileKind.Arrow, angle, 820, s.damage * stats.damageMult, 0.75, 'physical');
          pr.pierce = s.pierce;
        }
        p.sounds.push('arrow');
        return s.cooldown;
      }
      case 'wildcall': {
        const s = wildcallStats(level);
        const count = s.count + stats.projectiles;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const m = this.summon(p, SummonKind.Wolf, p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40, s.duration * stats.duration);
          m.damage = s.damage;
        }
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 160, c: 0x8bc34a });
        p.sounds.push('howl');
        return s.cooldown;
      }
      case 'toxicpool': {
        const s = toxicpoolStats(level);
        const d = Math.min(reach, s.maxRange);
        const x = clamp(p.x + dirX * d, 0, this.map.width);
        const y = clamp(p.y + dirY * d, 0, this.map.height);
        const r = s.radius * stats.area;
        this.zones.push({
          id: this.nextId++,
          kind: ZoneKind.Toxic,
          owner: p.id,
          x,
          y,
          r,
          blast: 0,
          damage: s.damage * stats.damageMult,
          tick: s.tick,
          life: s.life * stats.duration,
          timer: 0,
          type: 'magic',
          dead: false,
        });
        this.fx.push({ k: 'ring', x: Math.round(x), y: Math.round(y), r, c: 0x9ccc65 });
        p.sounds.push('acid');
        return s.cooldown;
      }
      case 'consecrate': {
        const s = consecrateStats(level);
        const r = s.radius * stats.area;
        this.zones.push({
          id: this.nextId++,
          kind: ZoneKind.Holy,
          owner: p.id,
          x: p.x,
          y: p.y,
          r,
          blast: 0,
          damage: s.damage * stats.damageMult,
          heal: s.heal,
          life: s.life * stats.duration,
          timer: 0,
          type: 'magic',
          dead: false,
        });
        if (s.stun > 0) {
          for (const e of this.grid.query(p.x, p.y, r + MAX_ENEMY_RADIUS, this.near)) {
            if (!e.dead && dist2(e.x, e.y, p.x, p.y) < (r + ENEMY_TYPES[e.type].radius) ** 2) this.stun(e, s.stun * stats.duration);
          }
        }
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r, c: HOLY });
        p.sounds.push('holy');
        return s.cooldown;
      }
      case 'prayer': {
        const s = prayerStats(level);
        const r = s.radius * stats.area;
        for (const ally of this.players.values()) {
          if (dist2(ally.x, ally.y, p.x, p.y) >= r ** 2) continue;
          const maxHp = this.stats(ally).maxHp;
          if (ally.downed) {
            if (!s.revive) continue;
            this.log(`${ally.name} was raised by ${p.name}'s Miracle`, 'good');
            ally.downed = false;
            ally.revive = 0;
            ally.hp = maxHp * s.revive;
          } else {
            this.heal(ally, maxHp * s.heal, p);
          }
          this.shield(ally, s.reduction, s.guard * stats.duration, p);
        }
        const damage = s.damage * stats.damageMult;
        this.splash(p.x, p.y, r, damage, p, 'magic');
        this.hitCratesAround(p.x, p.y, r, damage);
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r, c: HOLY });
        p.sounds.push('holy');
        return s.cooldown;
      }
      case 'timebomb': {
        const s = timebombStats(level);
        const d = Math.min(reach, s.maxRange);
        const x = clamp(p.x + dirX * d, 0, this.map.width);
        const y = clamp(p.y + dirY * d, 0, this.map.height);
        const r = s.radius * stats.area;
        for (let i = 0; i < s.repeats; i++) {
          const t = s.delay + i;
          this.blasts.push({ x, y, r, damage: s.damage * stats.damageMult, owner: p.id, t, stun: s.stun * stats.duration, color: 0x80d8ff, type: 'true' });
          this.fx.push({ k: 'cast', x: Math.round(x), y: Math.round(y), r, c: 0x80d8ff, t });
        }
        p.sounds.push('mine');
        return s.cooldown;
      }
    }
  }

  private castUltimate(p: Player): void {
    const ult = CHARACTERS[p.character].ultimate;
    const stats = this.stats(p);
    this.banner(`${p.name}: ${ult.name}!`, 'good');
    p.sounds.push('ult');
    switch (ult.id) {
      case 'dragonform': {
        // The new HP comes with the form (and goes again when it ends).
        const before = stats.maxHp;
        p.dragonForm = DRAGON_FORM.duration * stats.duration;
        p.body = p.aim;
        p.bodyX = p.x;
        p.bodyY = p.y;
        p.hp += this.stats(p).maxHp - before;
        p.sounds.push('transform');
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 160, c: 0xff6d00, snd: 'explode' });
        break;
      }
      case 'shadowstrike':
        p.strikes = STRIKE.targets + stats.projectiles;
        p.strikeTimer = 0;
        p.struck.clear();
        break;
      case 'inferno':
        p.inferno = INFERNO.duration * stats.duration;
        p.ultTimer = 0;
        break;
      case 'arrowstorm':
        p.arrowStorm = ARROW_STORM.duration * stats.duration;
        p.ultTimer = 0;
        break;
      case 'bear': {
        // It lumbers out beside you and goes for the nearest enemy (R again to point it somewhere else).
        const spot = pushOut(this.walls, p.x + Math.cos(p.aim) * 50, p.y + Math.sin(p.aim) * 50, BEAR.radius);
        const m = this.summon(p, SummonKind.Bear, spot.x, spot.y, BEAR.life * stats.duration);
        m.timer = 0.3;
        this.fx.push({ k: 'ring', x: Math.round(spot.x), y: Math.round(spot.y), r: 140, c: 0xffcc80, snd: 'slam' });
        p.sounds.push('bear');
        break;
      }
      case 'rewind': {
        // Back to where you were REWIND.seconds ago, with the most HP you've had since.
        const past = p.history[0] ?? { x: p.x, y: p.y, hp: p.hp };
        const bestHp = Math.max(p.hp, ...p.history.map((h) => h.hp));
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 50, c: 0x80d8ff });
        ({ x: p.x, y: p.y } = pushOut(this.walls, past.x, past.y, PLAYER_RADIUS));
        if (p.inArena) this.keepInArena(p, PLAYER_RADIUS);
        p.hp = Math.min(stats.maxHp, bestHp);
        p.history = [];
        p.epoch++;
        p.invuln = Math.max(p.invuln, 0.5);
        const r = REWIND.radius * stats.area;
        const damage = (REWIND.damage + REWIND.perLevel * this.level) * stats.damageMult;
        this.rebuildGrid();
        this.splash(p.x, p.y, r, damage, p, 'true');
        this.hitCratesAround(p.x, p.y, r, damage);
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r, c: 0x80d8ff, snd: 'explode' });
        p.sounds.push('rewind');
        break;
      }
      case 'chrono': {
        const r = CHRONO.radius * stats.area;
        for (const e of this.enemies) {
          if (dist2(e.x, e.y, p.x, p.y) < r ** 2) this.stun(e, CHRONO.stun * stats.duration);
        }
        this.enemyShots = this.enemyShots.filter((s) => dist2(s.x, s.y, p.x, p.y) >= r ** 2);
        for (const h of this.hazards) if (dist2(h.x, h.y, p.x, p.y) < r ** 2) h.dead = true;
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r, c: 0x80d8ff });
        p.sounds.push('clock');
        break;
      }
      case 'elixir':
        this.heal(p, stats.maxHp * ELIXIR.heal);
        p.elixir = ELIXIR.duration * stats.duration;
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 90, c: AURA.elixir });
        p.sounds.push('heal');
        break;
      case 'wrath':
        p.wrath = WRATH.duration * stats.duration;
        p.ultTimer = 0;
        p.guardReduction = Math.max(p.guard > 0 ? p.guardReduction : 0, WRATH.reduction);
        p.guard = Math.max(p.guard, p.wrath);
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: WRATH.range, c: HOLY });
        break;
      case 'intervention':
        for (const ally of this.players.values()) {
          const maxHp = this.stats(ally).maxHp;
          if (ally.downed) {
            this.log(`${ally.name} was saved by ${p.name}'s Divine Intervention`, 'good');
            ally.downed = false;
            ally.revive = 0;
          }
          ally.hp = maxHp;
          ally.invuln = Math.max(ally.invuln, INTERVENTION.invuln);
          this.fx.push({ k: 'ring', x: Math.round(ally.x), y: Math.round(ally.y), r: 90, c: HOLY });
        }
        break;
      case 'rage':
        p.rage = RAGE.duration * stats.duration;
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 120, c: AURA.rage });
        break;
      case 'retribution': {
        // Spikes out, and every enemy around comes for him.
        p.retribution = RETRIBUTION.duration * stats.duration;
        for (const e of this.grid.query(p.x, p.y, RETRIBUTION.taunt + MAX_ENEMY_RADIUS, this.near)) {
          if (e.dead || this.isBoss(e) || dist2(e.x, e.y, p.x, p.y) > RETRIBUTION.taunt ** 2) continue;
          e.tauntBy = p.id;
          e.tauntUntil = this.time + RETRIBUTION.tauntFor;
        }
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: RETRIBUTION.taunt, c: RETRIBUTION.color, snd: 'bigSlam' });
        p.sounds.push('warcry');
        break;
      }
    }
  }

  /** Ultimates that play out over time: Shadow Strike, Inferno, Arrow Storm, and Shadow Veil's eruption. */
  private updateUltimates(p: Player, dt: number): void {
    if (p.downed) {
      p.veil = p.strikes = p.inferno = p.arrowStorm = p.wrath = p.dragonForm = p.breath = 0;
      return;
    }
    const stats = this.stats(p);
    if (p.veil > 0) {
      p.veil -= dt;
      if (p.veil <= 0) {
        // Erupt from the shadows.
        p.veil = 0;
        const s = veilStats(p.upgrades.veil ?? 1);
        const r = s.radius * stats.area;
        const damage = s.damage * stats.damageMult;
        for (const e of this.grid.query(p.x, p.y, r + MAX_ENEMY_RADIUS, this.near)) {
          if (e.dead || dist2(e.x, e.y, p.x, p.y) >= (r + ENEMY_TYPES[e.type].radius) ** 2) continue;
          this.damageEnemy(e, damage, p, 'physical');
          if (s.stun > 0) this.stun(e, s.stun * stats.duration);
        }
        this.hitCratesAround(p.x, p.y, r, damage);
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r, c: 0x7e57c2, snd: 'blades' });
      }
    }
    if (p.dragonForm > 0) {
      // The body turns toward where he's walking; a head turned past its reach swings the body round with it.
      const dx = p.x - p.bodyX;
      const dy = p.y - p.bodyY;
      p.bodyX = p.x;
      p.bodyY = p.y;
      if (dx * dx + dy * dy > 1) {
        const want = Math.atan2(dy, dx);
        p.body += clamp(Math.atan2(Math.sin(want - p.body), Math.cos(want - p.body)), -DRAGON_FORM_TURN.turn * dt, DRAGON_FORM_TURN.turn * dt);
      }
      p.body = dragonBody(p.body, p.aim);
      p.dragonForm -= dt;
      if (p.dragonForm <= 0) {
        p.dragonForm = 0;
        p.breath = 0;
        p.hp = Math.min(p.hp, this.stats(p).maxHp);
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 90, c: 0xffab40 });
      }
    }
    if (p.breath > 0) {
      p.breath -= dt;
      p.breathTimer -= dt;
      if (p.breathTimer <= 0) {
        p.breathTimer = FIREBREATH.tick;
        const level = Math.max(1, p.upgrades[CHARACTERS[p.character].ability] ?? 1);
        const range = FIREBREATH.range * stats.area;
        const damage = (FIREBREATH.damage + FIREBREATH.perLevel * (level - 1)) * stats.damageMult;
        // From his mouth: along the body to the neck, then along the head (which looks where he aims).
        const mx = p.x + Math.cos(p.body) * DRAGON_FORM_TURN.neck + Math.cos(p.aim) * DRAGON_FORM_TURN.reach;
        const my = p.y + Math.sin(p.body) * DRAGON_FORM_TURN.neck + Math.sin(p.aim) * DRAGON_FORM_TURN.reach;
        this.rebuildGrid();
        for (const e of this.grid.query(mx, my, range + MAX_ENEMY_RADIUS, this.splashNear)) {
          if (e.dead) continue;
          const d = Math.sqrt(dist2(e.x, e.y, mx, my));
          if (d > range + ENEMY_TYPES[e.type].radius) continue;
          const off = Math.abs(Math.atan2(Math.sin(Math.atan2(e.y - my, e.x - mx) - p.aim), Math.cos(Math.atan2(e.y - my, e.x - mx) - p.aim)));
          if (d < ENEMY_TYPES[e.type].radius + PLAYER_RADIUS || off <= FIREBREATH.half + ENEMY_TYPES[e.type].radius / Math.max(d, 1)) this.damageEnemy(e, damage, p, 'magic');
        }
        this.hitCratesAround(mx + Math.cos(p.aim) * range * 0.5, my + Math.sin(p.aim) * range * 0.5, range * 0.4, damage);
        this.fx.push({ k: 'breath', x: Math.round(mx), y: Math.round(my), a: round2(p.aim), r: Math.round(range), arc: round2(FIREBREATH.half * 2) });
      }
    }
    p.ultTimer -= dt;
    if (p.strikes > 0) {
      p.strikeTimer -= dt;
      p.invuln = Math.max(p.invuln, 0.1);
      if (p.strikeTimer <= 0) {
        p.strikeTimer = STRIKE.hop;
        // The toughest enemy nearby that hasn't been struck yet.
        let target: Enemy | null = null;
        for (const e of this.enemies) {
          if (e.dead || p.struck.has(e.id) || dist2(e.x, e.y, p.x, p.y) > STRIKE.range ** 2) continue;
          if (!target || e.hp > target.hp) target = e;
        }
        if (!target) {
          p.strikes = 0;
        } else {
          p.strikes--;
          p.struck.add(target.id);
          const a = Math.random() * Math.PI * 2;
          const r = ENEMY_TYPES[target.type].radius + PLAYER_RADIUS + 4;
          this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 30, c: AURA.strike });
          ({ x: p.x, y: p.y } = pushOut(this.walls, target.x + Math.cos(a) * r, target.y + Math.sin(a) * r, PLAYER_RADIUS));
          if (p.inArena) this.keepInArena(p, PLAYER_RADIUS);
          p.epoch++;
          this.damageEnemy(target, (STRIKE.damage + STRIKE.perLevel * this.level) * stats.damageMult, p, 'physical');
          this.fx.push({ k: 'slash', x: Math.round(p.x), y: Math.round(p.y), r: r + 20, a: round2(Math.atan2(target.y - p.y, target.x - p.x)), arc: 1.4, c: AURA.strike });
          p.sounds.push('stab');
        }
      }
      // Back out of the shadows: a moment untouchable, and the dodge ready again.
      if (p.strikes <= 0) {
        p.invuln = Math.max(p.invuln, STRIKE.after);
        p.dodgeCooldown = 0;
      }
    }
    if (p.inferno > 0) {
      p.inferno -= dt;
      if (p.ultTimer <= 0) {
        p.ultTimer = INFERNO.duration / INFERNO.fireballs;
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * INFERNO.spread * stats.area;
        const x = clamp(p.x + Math.cos(a) * d, 0, this.map.width);
        const y = clamp(p.y + Math.sin(a) * d, 0, this.map.height);
        const r = INFERNO.radius * stats.area;
        this.blasts.push({ x, y, r, damage: (INFERNO.damage + INFERNO.perLevel * this.level) * stats.damageMult, owner: p.id, t: 0.5, color: 0xff6d00, type: 'magic' });
        this.fx.push({ k: 'cast', x: Math.round(x), y: Math.round(y), r, c: 0xff6d00, t: 0.5 });
      }
    }
    if (p.wrath > 0) {
      p.wrath -= dt;
      while (p.ultTimer <= 0) {
        p.ultTimer += WRATH.interval;
        // A pillar of light on a random enemy around the paladin.
        const near = this.grid.query(p.x, p.y, WRATH.range * stats.area, this.near).filter((e) => !e.dead && dist2(e.x, e.y, p.x, p.y) < (WRATH.range * stats.area) ** 2);
        if (near.length === 0) break;
        const e = near[Math.floor(Math.random() * near.length)];
        const r = WRATH.radius * stats.area;
        this.blasts.push({ x: e.x, y: e.y, r, damage: (WRATH.damage + WRATH.perLevel * this.level) * stats.damageMult, owner: p.id, t: 0.25, color: HOLY, type: 'magic' });
        this.fx.push({ k: 'cast', x: Math.round(e.x), y: Math.round(e.y), r, c: HOLY, t: 0.25 });
      }
      if (p.ultTimer < 0) p.ultTimer = 0;
    }
    if (p.arrowStorm > 0) {
      p.arrowStorm -= dt;
      while (p.ultTimer <= 0) {
        p.ultTimer += ARROW_STORM.interval;
        const angle = p.aim + (Math.random() - 0.5) * 2 * ARROW_STORM.jitter;
        const pr = this.projectile(p, ProjectileKind.Arrow, angle, 900, (ARROW_STORM.damage + ARROW_STORM.perLevel * this.level) * stats.damageMult, 0.85, 'physical');
        pr.pierce = ARROW_STORM.pierce;
      }
      p.sounds.push('arrow');
    }
  }

  private updateBlasts(dt: number): void {
    for (const b of this.blasts) {
      b.t -= dt;
      if (b.t > 0) continue;
      this.splash(b.x, b.y, b.r, b.damage, this.players.get(b.owner), b.type);
      const owner = this.players.get(b.owner);
      if (b.puddle && owner) {
        this.addZoneAt(owner, ZoneKind.Venom, b.x, b.y, b.puddle.r, b.puddle.damage, b.puddle.life, 'magic');
      }
      if (b.burn && owner) this.addZoneAt(owner, ZoneKind.Fire, b.x, b.y, b.burn.r, b.burn.damage, b.burn.life, 'magic');
      if (b.stun) {
        for (const e of this.grid.query(b.x, b.y, b.r + MAX_ENEMY_RADIUS, this.near)) {
          if (!e.dead && dist2(e.x, e.y, b.x, b.y) < (b.r + ENEMY_TYPES[e.type].radius) ** 2) this.stun(e, b.stun);
        }
      }
      this.hitCratesAround(b.x, b.y, b.r, b.damage);
      this.fx.push({ k: 'ring', x: Math.round(b.x), y: Math.round(b.y), r: b.r, c: b.color ?? 0xff9100, snd: 'explode' });
    }
    this.blasts = this.blasts.filter((b) => b.t > 0);
  }

  private hitCratesAround(x: number, y: number, r: number, damage: number, by?: Player): void {
    // A copy: a bomb going off can add to the list.
    for (const c of [...this.pickups]) {
      if (this.breakable(c) && dist2(c.x, c.y, x, y) < (r + CRATE_RADIUS) ** 2) this.damageCrate(c, damage, by);
    }
  }

  // --- Health crates ---

  private spawnCrates(dt: number, alive: Player[]): void {
    this.crateTimer -= dt;
    if (this.crateTimer > 0 || alive.length === 0) return;
    this.crateTimer = CRATE_INTERVAL;
    if (this.hordeHeldBack()) return;
    if (this.pickups.filter((c) => c.kind === PickupKind.Crate).length >= MAX_CRATES) return;
    // Tucked against a wall or by the edge of the map where possible (a few tries), else anywhere nearby.
    let spot = this.pointNear(alive, 300, 900, CRATE_RADIUS + 4);
    for (let attempt = 0; attempt < 12; attempt++) {
      const edge = Math.min(spot.x, spot.y, this.map.width - spot.x, this.map.height - spot.y);
      if (edge < CRATE_SPOT.edge || overlapsWall(this.walls, spot.x, spot.y, CRATE_SPOT.wall)) break;
      spot = this.pointNear(alive, 300, 900, CRATE_RADIUS + 4);
    }
    this.addPickup(PickupKind.Crate, spot.x, spot.y, CRATE_HP);
  }

  /** Crates (and bombs) within `r` of (x, y), nearest first. */
  private cratesNear(x: number, y: number, r: number): Pickup[] {
    return this.pickups.filter((c) => this.breakable(c) && dist2(c.x, c.y, x, y) < (r + CRATE_RADIUS) ** 2).sort((a, b) => dist2(a.x, a.y, x, y) - dist2(b.x, b.y, x, y));
  }

  private addPickup(kind: number, x: number, y: number, hp = 0, value = 0): Pickup {
    const pickup: Pickup = { id: this.nextId++, kind, x, y, hp, flashUntil: 0, value, target: null, dead: false };
    this.pickups.push(pickup);
    return pickup;
  }

  /** Things your attacks can hit besides enemies: crates and bombs. */
  private breakable(c: Pickup): boolean {
    return !c.dead && (c.kind === PickupKind.Crate || c.kind === PickupKind.Bomb);
  }

  /** A hit on a crate (which breaks open after enough damage) or a bomb (which goes off). */
  private damageCrate(c: Pickup, amount: number, by?: Player): void {
    if (!this.breakable(c)) return;
    if (c.kind === PickupKind.Bomb) {
      this.explodeBomb(c, by);
      return;
    }
    c.hp -= amount;
    c.flashUntil = this.time + 0.1;
    if (c.hp > 0) return;
    c.dead = true;
    const roll = Math.random();
    if (roll < CRATE_LOOT.heart) {
      this.addPickup(PickupKind.Heart, c.x, c.y);
    } else if (roll < CRATE_LOOT.heart + CRATE_LOOT.gold) {
      // A pile of coins spilling out.
      const count = COIN.min + Math.floor(Math.random() * (COIN.max - COIN.min + 1));
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 12 + Math.random() * 30;
        this.addPickup(PickupKind.Coin, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 0, COIN.value);
      }
    } else {
      this.addPickup(PickupKind.Bomb, c.x, c.y);
    }
  }

  /** Boom: heavy damage to enemies around it, and it sets off any crates and bombs nearby. */
  private explodeBomb(b: Pickup, by?: Player): void {
    b.dead = true;
    const damage = BOMB.damage * this.horde().hp * this.difficulty();
    // The grid may be stale if this happens between ticks (a cast).
    this.rebuildGrid();
    for (const e of this.grid.query(b.x, b.y, BOMB.blast + MAX_ENEMY_RADIUS, this.splashNear)) {
      if (e.dead || dist2(e.x, e.y, b.x, b.y) >= (BOMB.blast + ENEMY_TYPES[e.type].radius) ** 2) continue;
      this.damageEnemy(e, damage, by, 'true');
      this.knockback(e, b.x, b.y, 40);
    }
    this.fx.push({ k: 'boom', x: Math.round(b.x), y: Math.round(b.y), r: BOMB.blast });
    this.fx.push({ k: 'ring', x: Math.round(b.x), y: Math.round(b.y), r: BOMB.blast, c: 0xff6d00, snd: 'explode' });
    this.hitCratesAround(b.x, b.y, BOMB.blast, damage, by);
  }

  /** Gold coins fly to a player who comes close; picking one up gives its gold to the whole team. */
  private updateCoins(dt: number): void {
    const alive = this.alivePlayers();
    for (const c of this.pickups) {
      if (c.kind !== PickupKind.Coin || c.dead) continue;
      if (!c.target || c.target.downed || !this.players.has(c.target.id)) {
        c.target = null;
        for (const p of alive) {
          if (dist2(p.x, p.y, c.x, c.y) < this.stats(p).magnet ** 2) c.target = p;
        }
        if (!c.target) continue;
      }
      const p = c.target;
      const d = Math.sqrt(dist2(p.x, p.y, c.x, c.y));
      if (d < PLAYER_RADIUS + COIN.radius) {
        c.dead = true;
        this.runGold += c.value;
        for (const q of this.players.values()) {
          const gold = c.value * this.stats(q).goldMult;
          q.profile.gold = (q.profile.gold ?? 0) + Math.floor(gold) + (Math.random() < gold % 1 ? 1 : 0);
        }
        p.sounds.push('coin');
        continue;
      }
      const step = Math.min(d, COIN.speed * dt);
      c.x += ((p.x - c.x) / d) * step;
      c.y += ((p.y - c.y) / d) * step;
    }
  }

  /** An elite or warlord died: maybe an artifact drops where it fell. */
  private dropArtifact(source: DropSource, x: number, y: number): void {
    if (Math.random() >= DROPS[source].chance) return;
    const tier = rollTier(source, this.lootIndex());
    this.addPickup(PickupKind.Artifact, x, y, 0, TIER_IDS.indexOf(tier));
    this.log(`${tier === 'epic' || tier === 'legendary' ? 'An' : 'A'} ${TIERS[tier].name.toLowerCase()} artifact dropped!`, 'good');
  }

  /** Artifacts on the ground: whoever touches one finds an artifact of its tier for every person in the team. */
  private updateArtifacts(): void {
    const lava = this.map.lava;
    for (const c of this.pickups) {
      if (c.kind !== PickupKind.Artifact || c.dead) continue;
      // Closing lava sweeps them along, so none end up out of reach.
      if (lava) {
        const d = Math.hypot(c.x - lava.x, c.y - lava.y);
        const max = Math.max(0, this.lavaR - 60);
        if (d > max) {
          c.x = lava.x + ((c.x - lava.x) / d) * max;
          c.y = lava.y + ((c.y - lava.y) / d) * max;
        }
      }
      if (!this.alivePlayers().some((p) => dist2(p.x, p.y, c.x, c.y) < (PLAYER_RADIUS + ARTIFACT_RADIUS) ** 2)) continue;
      c.dead = true;
      this.grantArtifacts(TIER_IDS[c.value]);
    }
  }

  /** Every person in the team finds an artifact of this tier (each rolls their own). Duplicates become gold. */
  private grantArtifacts(tier: Tier): void {
    const people = this.humans();
    for (const p of people) {
      const find = giveArtifact(p.profile, rollArtifact(tier, ownedArtifacts(p.profile)));
      p.loot.push(find);
      p.found.push(find);
      p.sounds.push('relic');
      const name = artifactDef(find.id).name;
      this.log(`${p.name} found ${name} (${TIERS[tier].name})`, 'good');
    }
    if (people.length > 0) this.options.onProfiles?.();
  }

  private updateHearts(): void {
    for (const h of this.pickups) {
      if (h.kind !== PickupKind.Heart || h.dead) continue;
      for (const p of this.alivePlayers()) {
        const maxHp = this.stats(p).maxHp;
        // Players at full health walk over hearts, leaving them for teammates.
        if (p.hp >= maxHp || dist2(p.x, p.y, h.x, h.y) >= (PLAYER_RADIUS + HEART_RADIUS) ** 2) continue;
        this.heal(p, maxHp * HEART_HEAL);
        p.sounds.push('heal');
        h.dead = true;
        break;
      }
    }
  }

  // --- XP ---

  private dropGem(x: number, y: number, value: number): void {
    if (this.gems.length >= MAX_GEMS) {
      // Too many gems lying around: fold the XP into the nearest one instead (not always the same one, or it would
      // grow into a jackpot worth several levels).
      let nearest = this.gems[0];
      let best = Infinity;
      for (const g of this.gems) {
        const d = dist2(g.x, g.y, x, y);
        if (!g.target && d < best) {
          best = d;
          nearest = g;
        }
      }
      nearest.value += value;
      return;
    }
    this.gems.push({ id: this.nextId++, x, y, value, target: null, speed: 0, collected: false });
  }

  private updateGems(dt: number): void {
    const magnets = this.alivePlayers().map((p) => ({ p, r2: this.stats(p).magnet ** 2 }));
    for (const g of this.gems) {
      if (g.target && (g.target.downed || !this.players.has(g.target.id))) {
        g.target = null;
        g.speed = 0;
      }
      if (!g.target) {
        g.target = magnets.find(({ p, r2 }) => dist2(p.x, p.y, g.x, g.y) < r2)?.p ?? null;
        if (!g.target) continue;
      }
      // Gems fly over walls straight to you.
      const p = g.target;
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d < PLAYER_RADIUS) {
        g.collected = true;
        this.giveXp(g.value * this.stats(p).xpMult); // Wisdom boosts what the collector brings in.
        p.sounds.push('gem');
        continue;
      }
      g.speed = Math.min(GEM_MAX_SPEED, g.speed + GEM_ACCEL * dt);
      const step = Math.min(d, g.speed * dt);
      g.x += (dx / d) * step;
      g.y += (dy / d) * step;
    }
    this.gems = this.gems.filter((g) => !g.collected);
  }

  /** XP goes into the shared team pool. */
  private giveXp(amount: number): void {
    this.xp += amount;
    this.levelUp();
  }

  /**
   * At most one level-up every LEVEL_GAP seconds: a big haul of XP is banked and pays out one level at a time
   * (instead of several upgrade picks in a row).
   */
  private levelUp(): void {
    if (this.time < this.nextLevelAt || this.xp < this.xpNext()) return;
    this.xp -= this.xpNext();
    this.level++;
    this.choices.push('level');
    this.nextLevelAt = this.time + LEVEL_GAP;
  }

  /**
   * XP for the next level. Before the boss, the curve keeps the team on a schedule where the last possible
   * upgrade lands right when the boss arrives: ahead of schedule makes levels pricier, behind makes them cheaper.
   */
  private xpNext(): number {
    const base = xpToNext(this.level, Math.max(1, this.players.size));
    if (this.bossPhase !== 'waiting' || this.players.size === 0) return base;
    const expectedLevel = 1 + UPGRADE_PICKS * Math.pow(Math.min(1, this.time / this.bossTime), 0.9);
    const factor = clamp(2 ** ((this.level - expectedLevel) / 3), 0.6, 3);
    return Math.max(1, Math.round(base * factor));
  }

  // --- Networking ---

  /** Mordak's extra flags: which way he faces (his wings follow it), and which wings are gone. */
  private dragonFlags(e: Enemy): number {
    const turn = (((e.facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
    const step = Math.round(turn * FACING_STEPS) % FACING_STEPS;
    const has = (side: number) => e.parts.some((w) => w.side === side && !w.dead);
    return (has(-1) ? 0 : BossFlag.LeftWingGone) | (has(1) ? 0 : BossFlag.RightWingGone) | (step << FACING_SHIFT);
  }

  private broadcast(): void {
    if (this.players.size === 0) return;

    const host = this.host();
    const players: PlayerState[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      character: p.character,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      hp: Math.ceil(p.hp),
      maxHp: this.stats(p).maxHp,
      downed: p.downed,
      revive: round2(p.revive),
      kills: p.kills,
      upgrades: p.upgrades,
      prestige: p.profile.ranks,
      artifact: p.artifact,
      damageDealt: Math.round(p.damageDealt),
      damageByType: p.damageByType.map(Math.round) as [number, number, number],
      damageTaken: Math.round(p.damageTaken),
      choosing: p.options !== null,
      invuln: p.invuln > 0,
      hurt: p.hurtUntil > this.time,
      inArena: p.inArena,
      bot: p.bot !== null,
      ult: round2(1 - p.ultCd / (CHARACTERS[p.character].ultimate.cooldown * this.stats(p).ultCooldown)),
      host: !p.bot && p === host,
      ready: p.bot !== null || this.lobbyReady.has(p.id),
      veiled: p.veil > 0,
      dragon: p.dragonForm > 0,
      aim: round2(p.aim),
      ...(p.dragonForm > 0 && { body: round2(p.body) }),
      aura:
        p.retribution > 0
          ? RETRIBUTION.color
          : p.strikes > 0
          ? AURA.strike
          : p.arrowStorm > 0
            ? AURA.storm
            : p.inferno > 0
              ? AURA.inferno
              : p.wrath > 0
                ? AURA.wrath
                : p.rage > 0
                  ? AURA.rage
                  : p.elixir > 0
                    ? AURA.elixir
                    : p.guard > 0
                      ? AURA.guard
                      : 0,
    }));
    const enemies: number[] = [];
    for (const e of this.enemies) {
      const flags =
        (e.flashUntil > this.time ? EnemyFlag.Hit : 0) |
        (e.mode === Mode.Windup ? EnemyFlag.WindingUp : 0) |
        (this.isStunned(e) ? EnemyFlag.Stunned : 0) |
        ((this.mission && this.bosses.includes(e) && !e.dead) || this.untouchable(e) ? EnemyFlag.Shielded : 0) |
        (e.missionTarget || e.feeder || e.partOf || e.type === EnemyType.Egg ? EnemyFlag.Marked : 0) |
        (e.burrowed && !e.flight ? EnemyFlag.Hidden : 0) |
        (e.corpse ? BossFlag.Dying : 0) |
        (e.flight ? BossFlag.Flying : 0) |
        (e.type === EnemyType.Mordak ? this.dragonFlags(e) : 0) |
        (e.shell ? EnemyFlag.Shelled : 0) |
        (e.exposedUntil > this.time ? EnemyFlag.Exposed : 0) |
        (e.linked ? EnemyFlag.Linked : 0) |
        (e.affix << AFFIX_SHIFT);
      enemies.push(e.id, e.type, Math.round(e.x), Math.round(e.y), flags);
    }
    const projectiles: number[] = [];
    for (const pr of this.projectiles) projectiles.push(pr.id, pr.kind, Math.round(pr.x), Math.round(pr.y));
    const enemyShots: number[] = [];
    for (const s of this.enemyShots) enemyShots.push(s.id, Math.round(s.x), Math.round(s.y));
    const gems: number[] = [];
    for (const g of this.gems) gems.push(g.id, Math.round(g.x), Math.round(g.y), g.value >= 5 ? 1 : 0);
    const pickups: number[] = [];
    for (const c of this.pickups) pickups.push(c.id, c.kind, Math.round(c.x), Math.round(c.y), c.kind === PickupKind.Artifact ? c.value : c.flashUntil > this.time ? 1 : 0);
    const hazards: number[] = [];
    for (const h of this.hazards) {
      hazards.push(h.id, h.kind, Math.round(h.x), Math.round(h.y), round2(h.a), Math.round(h.b), Math.round(h.c), round2(Math.min(1, h.t / h.duration)));
    }
    const shrines: number[] = [];
    for (const s of this.shrines) shrines.push(s.id, s.kind, Math.round(s.x), Math.round(s.y), round2(s.progress));
    const zones: number[] = [];
    for (const z of this.zones) zones.push(z.id, z.kind, Math.round(z.x), Math.round(z.y), Math.round(z.kind === ZoneKind.Mine ? z.blast : z.r));
    const summons: number[] = [];
    for (const m of this.summons) summons.push(m.id, m.kind, Math.round(m.x), Math.round(m.y));
    const arena = this.map.arena;
    const lava = this.map.lava;

    const shared: Omit<Snapshot, 'me'> = {
      t: 'snap',
      tick: this.tickCount,
      room: this.options.room ?? null,
      phase: this.phase,
      map: this.mapIndex,
      unlocked: this.unlocked,
      mode: this.mode,
      hardUnlocked: this.hardUnlocked,
      wave: this.wave,
      // (In endless, when the next boss wave comes: the countdown counts to it.)
      bossTime: this.endless ? this.nextWaveAt : this.bossTime,
      arena: arena && {
        x: arena.x,
        y: arena.y,
        r: arena.r,
        state: this.bossPhase === 'waiting' || this.endless ? 'idle' : this.bossPhase === 'finale' ? 'fight' : this.bossPhase,
        safeR: this.bossPhase === 'waiting' || this.endless ? 0 : Math.round(this.safeRadius),
        open: !this.gateShut,
      },
      lava: lava ? { x: lava.x, y: lava.y, r: Math.round(this.lavaR), closing: this.bossPhase === 'gather' } : null,
      dying: this.dying && { x: Math.round(this.dying.x), y: Math.round(this.dying.y), progress: round2(Math.min(1, this.dying.t / BOSS_DEATH.total)) },
      finale: this.finale && { stage: this.finale.stage, t: round1(this.finale.t) },
      bossFight:
        this.bossPhase === 'fight' && this.bosses.length > 0
          ? {
              bosses: this.bosses.map((b) => ({
                id: b.id,
                name: bossDisplayName(b.type),
                ...(b.type === EnemyType.Mordak && { pose: { head: round2(b.head), tail: round2(b.tail), sit: this.time < b.roostUntil, mouth: this.mouthOpen(b) } }),
                hp: b.dead ? 0 : Math.ceil(Math.max(0, b.hp)),
                maxHp: Math.ceil(b.maxHp),
                enraged: b.enraged,
                vengeful: b.vengeful,
                tags: [
                  b.shell ? 'shelled' : '',
                  b.exposedUntil > this.time ? 'exposed' : '',
                  b.burrowed && !b.flight ? 'burrowed' : '',
                  b.linked ? 'kindred' : '',
                  b.flight ? 'flying' : '',
                  b.type === EnemyType.Mordak && b.wingsLost >= 2 ? 'grounded' : '',
                  this.untouchable(b) ? 'invulnerable' : '',
                ].filter(Boolean),
              })),
              // Health bars for what the team should kill: mission targets, eggs, carrion.
              targets: this.enemies
                .filter((e) => !e.dead && (e.missionTarget || e.feeder || e.partOf || e.type === EnemyType.Egg))
                .flatMap((e) => [e.id, round2(Math.max(0, e.hp) / e.maxHp)]),
              berserkIn: this.berserkClock() ? round1(Math.max(0, BOSS_BERSERK.after - this.fightTime)) : -1,
              berserk: this.berserk,
              mission: this.mission && {
                kind: this.mission.kind,
                done: this.missionDone(this.mission),
                total: this.mission.total,
              },
            }
          : null,
      warlord: (() => {
        const w = this.bossPhase === 'waiting' ? this.warlord() : undefined;
        return w ? { hp: Math.ceil(Math.max(0, w.hp)), maxHp: Math.ceil(w.maxHp) } : null;
      })(),
      pause: this.pause && (this.pause.kind === 'choose' ? { ...this.pause, timeLeft: round1(this.pause.timeLeft) } : { ...this.pause, ready: [...this.pause.ready] }),
      timeScale: round2(this.pause ? 0 : this.timeScale()),
      time: Math.round(this.time * 1000) / 1000,
      level: this.level,
      xp: this.xp,
      xpNext: this.xpNext(),
      players,
      enemies,
      projectiles,
      enemyShots,
      gems,
      pickups,
      hazards,
      shrines,
      zones,
      summons,
      event: this.event && { kind: this.event.kind, timeLeft: round1(this.event.timeLeft) },
      quest: this.quest && {
        kind: this.quest.kind,
        timeLeft: round1(this.quest.timeLeft),
        x: Math.round(this.quest.x),
        y: Math.round(this.quest.y),
      },
      fx: this.fx,
      result: this.result,
    };
    // Serialize the shared part once and splice in each player's private state.
    const sharedJson = JSON.stringify(shared);
    for (const p of this.players.values()) {
      p.send(`{"me":${JSON.stringify(this.meState(p))},${sharedJson.slice(1)}`);
    }
  }

  private meState(p: Player): MeState {
    const stats = this.stats(p);
    const hero = CHARACTERS[p.character];
    return {
      options: p.options,
      swapOut: p.swapOut ? { id: p.swapOut, level: Math.min(MAX_LEVEL, p.upgrades[p.swapOut] ?? 1) } : null,
      upgrades: p.upgrades,
      speed: stats.speed,
      dodgeCooldown: stats.dodgeCooldown,
      ability: { cd: round1(p.abilityCd), cooldown: round1(this.abilityCooldown(p) * stats.cooldownMult) },
      relic: this.relicState(p),
      ultimate: { cd: round1(p.ultCd), cooldown: round1(hero.ultimate.cooldown * stats.ultCooldown), active: round1(Math.max(p.rage, p.inferno, p.arrowStorm, p.veil, p.wrath, hero.ultimate.id === 'elixir' ? p.elixir : 0, p.dragonForm, this.bearOf(p)?.life ?? 0)) },
      hits: this.takeHits(p),
      taken: p.taken.splice(0),
      sounds: [...new Set(p.sounds.splice(0))], // One of each per snapshot is plenty.
      epoch: p.epoch,
      prestigePoints: p.profile.points,
      god: p.god,
      gold: p.profile.gold ?? 0,
      heroes: this.allHeroes(p) ? CHARACTER_IDS : (p.profile.heroes ?? []).filter(isCharacterId),
      artifacts: p.bot ? [] : ownedArtifacts(p.profile),
      found: p.found.splice(0),
    };
  }

  /** The artifact's Q for the HUD, or null if it has none. */
  private relicState(p: Player): MeState['relic'] {
    const active = p.artifact ? artifactDef(p.artifact).active : undefined;
    return active ? { cd: round1(p.relicCd), cooldown: active.cooldown, active: round1(p.frenzy) } : null;
  }

  /** This tick's damage numbers as [x, y, amount, crit, ...], biggest first, skipping tiny ticks. */
  private takeHits(p: Player): number[] {
    const hits = [...p.hits.values()].filter((h) => h.amount >= 1).sort((a, b) => b.amount - a.amount);
    p.hits.clear();
    const out: number[] = [];
    for (const h of hits.slice(0, MAX_DAMAGE_NUMBERS)) out.push(Math.round(h.x), Math.round(h.y), Math.round(h.amount), h.crit ? 1 : 0, h.type);
    return out;
  }

  /** Base cooldown of the player's E ability at its current level (for the HUD). */
  private abilityCooldown(p: Player): number {
    const id = CHARACTERS[p.character].ability;
    const level = Math.max(1, p.upgrades[id] ?? 1);
    switch (id) {
      case 'firewave':
        return firewaveStats(level).cooldown;
      case 'meteor':
        return meteorStats(level).cooldown;
      case 'veil':
        return veilStats(level).cooldown;
      case 'flamenova':
        return flamenovaStats(level).cooldown;
      case 'tumble':
        return tumbleStats(level).cooldown;
      case 'wildcall':
        return wildcallStats(level).cooldown;
      case 'timebomb':
        return timebombStats(level).cooldown;
      case 'leap':
        return leapStats(level).cooldown;
      case 'warcry':
        return warcryStats(level).cooldown;
      case 'toxicpool':
        return toxicpoolStats(level).cooldown;
      case 'consecrate':
        return consecrateStats(level).cooldown;
      case 'prayer':
        return prayerStats(level).cooldown;
    }
  }
}
