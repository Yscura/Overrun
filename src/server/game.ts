import {
  CHARACTERS,
  CHARACTER_IDS,
  DEFAULT_CHARACTER,
  REWIND_SECONDS,
  UPGRADE_PICKS,
  heroAvailable,
  isCharacterId,
  offerableUpgrades,
  offerWeight,
  orbitLayout,
  ownedWeapons,
  playerStats,
  type CharacterId,
  type PlayerStats,
} from '../shared/characters';
import { WallIndex, blocksShot, moveCircle, overlapsWall, pushOut, type PassFlags } from '../shared/collision';
import {
  BOSS_INTERVAL,
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
  REVIVE_RADIUS,
  REVIVE_TIME,
  SPAWN_DISTANCE,
  TICK_DT,
} from '../shared/constants';
import {
  BOMBARDIER,
  BOSS_ATTACK,
  BOSS_BERSERK,
  BOSS_CHARGE,
  BOSS_ENRAGE_AT,
  BOSS_ENRAGE_SPEEDUP,
  BOSS_MISSIONS,
  BOSS_NOVA,
  BOSS_POWER,
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
} from '../shared/enemies';
import { isPrestigeId, prestigeCost, prestigeReward, prestigeSpent, PRESTIGE, type PrestigeRanks } from '../shared/prestige';
import { BOSS_TIME, MAPS, mapBossName, ZONE_DAMAGE, ZONE_SWEEP_TIME, type MapDef } from '../shared/maps';
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
  SHRINE_SOLO_SHARE,
  SHRINE_SPACING,
  ShrineKind,
  type QuestKind,
} from '../shared/objectives';
import {
  EnemyFlag,
  AFFIX_SHIFT,
  HazardKind,
  PickupKind,
  ProjectileKind,
  ZoneKind,
  type ActiveEvent,
  type ChoiceReason,
  type ClientMessage,
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
  type Snapshot,
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
  upgradeMax,
  CRIT_MULTIPLIER,
  arrowsStats,
  boltStats,
  cleaveStats,
  daggersStats,
  fireballStats,
  flamenovaStats,
  timebombStats,
  treantStats,
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
import { FlowField } from './navigation';
import { SpatialGrid } from './spatialGrid';

const SEPARATION_SPEED = 150;
const GEM_ACCEL = 1500;
const GEM_MAX_SPEED = 900;
/** Weapons that fire on their own (hero abilities are cast with E instead). */
const WEAPON_IDS: WeaponId[] = ['bolt', 'knives', 'storm', 'hex', 'cleave', 'slam', 'venom', 'orbit', 'field', 'mines', 'shuriken', 'daggers', 'fireball', 'arrows', 'wolves'];
/** Seeker hexes turn this fast (radians per second) and look this far for a target. */
const HEX_TURN = 7;
const HEX_SEEK = 600;
const MAX_VENOM = 80;
/** Damage numbers: at most this many of your hits per tick, and grouped contact damage this often. */
const MAX_DAMAGE_NUMBERS = 25;
const DAMAGE_NUMBER_INTERVAL = 0.3;
const VENOM_TICK = 0.5;
/** Recompute enemy pathfinding this often (in ticks). */
const FLOW_INTERVAL = 5;
/** If a client claims to be this far from where the server lets it be, snap the client back. */
const DESYNC_LIMIT = 120;

// Ultimate effects.
const STRIKE = { targets: 7, hop: 0.18, range: 650, damage: 120, perLevel: 8 };
const INFERNO = { duration: 3, fireballs: 16, spread: 380, radius: 110, damage: 80, perLevel: 5 };
const ARROW_STORM = { duration: 4, interval: 0.06, damage: 20, perLevel: 2, pierce: 3, jitter: 0.12 };
const WILD_CALL = { wolves: 6, life: 15 };
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
const RAGE = { duration: 8, damage: 1.6, cooldown: 0.7, regen: 0.04 };
const RALLY = { radius: 700, heal: 0.4, guard: 6, reduction: 0.5 };
const AURA = { rage: 0xff1744, guard: 0xffd54f, strike: 0xce93d8, storm: 0x9ccc65, inferno: 0xff6d00 };

/** Charge attack cycle (chargers and bosses). Other enemies stay in Normal. */
const Mode = { Normal: 0, Windup: 1, Charge: 2, Recover: 3 } as const;

export interface GameOptions {
  /** How many maps are unlocked at startup. */
  unlocked: number;
  /** Called when a victory unlocks a new map, to save progress. */
  onUnlock: (unlocked: number) => void;
  /** Override when the named boss arrives, in seconds (for testing). */
  bossTime?: number;
  /** Everyone's prestige, by lowercased name. Shared with the caller, who saves it on `onProfiles`. */
  profiles?: Record<string, Profile>;
  /** Called when prestige was earned or spent, to save it. */
  onProfiles?: () => void;
  /** Every hero is available without unlocking (for testing). */
  allHeroes?: boolean;
}

/** A player's prestige, kept between runs. */
export interface Profile {
  /** Unspent points. */
  points: number;
  /** Gold from crates, spent on heroes. */
  gold?: number;
  ranks: PrestigeRanks;
  /** Heroes unlocked with prestige. */
  heroes?: string[];
}

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
}

/** An ally a hero calls in: the druid's wolves and treants. */
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
  /** Treants: slam stats, fixed when summoned. */
  damage: number;
  radius: number;
  root: number;
  interval: number;
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
  stunUntil: number;
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
}

/** A telegraphed attack. Circles explode when the timer runs out; lines just show a charge's path. */
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
  /** Coins: how much gold. */
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
  private mapIndex = 0;
  private map!: MapDef;
  private walls!: WallIndex;
  private flow!: FlowField;
  private readonly bossTime: number;
  /** waiting -> (gather, on arena maps) -> fight. */
  private bossPhase: 'waiting' | 'gather' | 'fight' = 'waiting';
  /** Seconds until the zone outside the arena starts burning. */
  /** Radius around the arena that isn't burning yet; shrinks to the arena once the boss is due. */
  private safeRadius = Infinity;
  /** The final boss, or both twins (dead ones stay in the list). */
  private bosses: Enemy[] = [];
  /** Seconds since the boss fight started (for going berserk). */
  private fightTime = 0;
  private berserk = 0;
  private mission: Mission | null = null;
  /** How many of BOSS_MISSIONS.at have been triggered. */
  private missionsStarted = 0;
  private lastMission: MissionKind | null = null;

  private readonly profiles: Record<string, Profile>;

  private grid = new SpatialGrid<Enemy>(64);
  /** Reused query buffers; never nest two grid queries that share one. */
  private near: Enemy[] = [];
  private splashNear: Enemy[] = [];

  constructor(private readonly options: GameOptions) {
    this.unlocked = clamp(options.unlocked, 1, MAPS.length);
    this.bossTime = options.bossTime ?? BOSS_TIME;
    this.profiles = options.profiles ?? {};
    this.loadMap(this.unlocked - 1); // Start on the newest unlocked map.
  }

  /** The prestige saved under this name, created on first sight. */
  private profile(name: string): Profile {
    const key = name.toLowerCase();
    const profile = (this.profiles[key] ??= { points: 0, ranks: {} });
    profile.ranks ??= {};
    profile.points = Math.max(0, Number(profile.points) || 0);
    return profile;
  }

  addPlayer(name: string, character: unknown, send: (text: string) => void): number | null {
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
      guard: 0,
      guardReduction: 0,
      veil: 0,
      strikes: 0,
      strikeTimer: 0,
      struck: new Set(),
      arrowStorm: 0,
      inferno: 0,
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
      profile: this.profile(name),
      god: name.toLowerCase() === DEV_NAME,
    };
    if (isCharacterId(character) && this.canPlay(player, character)) player.character = character;
    this.resetPlayer(player, this.players.size);
    // Joining mid-run drops you next to a teammate (and into the current pick, if there is one).
    const buddy = this.phase === 'playing' ? this.alivePlayers().find((p) => !p.inArena) : undefined;
    if (buddy) ({ x: player.x, y: player.y } = pushOut(this.walls, buddy.x + 40, buddy.y, PLAYER_RADIUS));
    if (this.pause?.kind === 'choose') player.options = this.rollOptions(player, this.pause.reason);
    this.players.set(player.id, player);
    return player.id;
  }

  removePlayer(id: number): void {
    this.players.delete(id);
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
        if (this.phase !== 'playing' && isCharacterId(msg.character) && this.canPlay(p, msg.character)) {
          p.character = msg.character;
          this.equip(p);
        }
        break;
      case 'map':
        if (this.phase === 'lobby' && Number.isInteger(msg.index) && msg.index >= 0 && msg.index < this.unlocked) {
          this.loadMap(msg.index);
          let slot = 0;
          for (const other of this.players.values()) this.resetPlayer(other, slot++);
        }
        break;
      case 'start':
        if (this.phase !== 'playing') this.startGame();
        break;
      case 'lobby':
        if (this.phase === 'gameover') this.backToLobby();
        break;
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
      case 'pause':
        // Anyone can pause, except in the middle of picking upgrades.
        if (this.phase === 'playing' && !this.pause) {
          this.pause = { kind: 'menu', by: p.name, ready: [] };
          this.banner(`${p.name} paused the game`, 'good');
        }
        break;
      case 'ready':
        if (this.pause?.kind === 'menu') {
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
    this.clearWorld();
    let slot = 0;
    for (const other of this.players.values()) this.resetPlayer(other, slot++);
  }

  // --- God-mode cheats (player named "dev") ---

  private devCheat(p: Player, action: DevAction): void {
    switch (action) {
      case 'skip':
        if (!this.pause) this.skipMinute();
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
  private skipMinute(): void {
    this.time += 60;
    if (this.bossPhase === 'fight') this.fightTime += 60; // Straight toward berserk.
    // Don't unleash every warlord that was skipped over at once.
    this.nextBossAt = Math.max(this.nextBossAt, Math.ceil(this.time / BOSS_INTERVAL) * BOSS_INTERVAL);
    // Of the Forges skipped over, only the latest one appears.
    while (this.forgesSpawned < FORGE_SCHEDULE.length - 1 && this.time >= FORGE_SCHEDULE[this.forgesSpawned + 1] * this.bossTime) this.forgesSpawned++;
    if (this.bossPhase === 'waiting') {
      const expected = Math.round(1 + UPGRADE_PICKS * Math.pow(Math.min(1, this.time / this.bossTime), 0.9));
      for (; this.level < expected; this.level++) this.choices.push('level');
      this.xp = 0;
    }
    const m = Math.floor(this.time / 60);
    const s = Math.floor(this.time % 60);
    this.banner(`Dev: skipped to ${m}:${String(s).padStart(2, '0')}`, 'good');
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
    if (this.phase === 'playing' || !isPrestigeId(id)) return;
    const rank = p.profile.ranks[id] ?? 0;
    const cost = prestigeCost(rank);
    if (rank >= PRESTIGE[id].maxRank || p.profile.points < cost) return;
    p.profile.points -= cost;
    p.profile.ranks[id] = rank + 1;
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

  /** Spend prestige on a hero. */
  private unlockHero(p: Player, character: unknown): void {
    if (this.phase === 'playing' || !isCharacterId(character)) return;
    const cost = CHARACTERS[character].unlockCost;
    if (cost === undefined || this.canPlay(p, character) || (p.profile.gold ?? 0) < cost) return;
    p.profile.gold = (p.profile.gold ?? 0) - cost;
    p.profile.heroes = [...(p.profile.heroes ?? []), character];
    p.character = character;
    this.equip(p);
    this.options.onProfiles?.();
  }

  /** Refund every rank, for free (unlocked heroes stay unlocked). */
  private respec(p: Player): void {
    if (this.phase === 'playing') return;
    for (const rank of Object.values(p.profile.ranks)) p.profile.points += prestigeSpent(rank ?? 0);
    p.profile.ranks = {};
    p.hp = this.stats(p).maxHp;
    this.options.onProfiles?.();
  }

  tick(): void {
    this.tickCount++;
    if (this.phase === 'playing') {
      if (this.pause?.kind === 'menu') {
        // Everyone (still here) is ready: carry on, easing in from slow motion like after a pick.
        const ready = this.pause.ready;
        if ([...this.players.values()].every((p) => ready.includes(p.id))) {
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
    this.walls = new WallIndex(this.map.walls, this.map.width, this.map.height);
    this.flow = new FlowField(this.walls);
  }

  private startGame(): void {
    this.phase = 'playing';
    this.clearWorld();
    let slot = 0;
    for (const p of this.players.values()) this.resetPlayer(p, slot++);
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
    this.event = null;
    this.quest = null;
    this.blasts = [];
    this.zones = [];
    this.summons = [];
    this.runGold = 0;
    this.nextLobAt = 0;
    this.slowmo = 0;
    this.bossPhase = 'waiting';
    this.safeRadius = Infinity;
    this.bosses = [];
    this.fightTime = 0;
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
    p.abilityCd = 0;
    p.ultCd = 0;
    p.rage = 0;
    p.guard = 0;
    p.veil = 0;
    p.strikes = 0;
    p.arrowStorm = 0;
    p.inferno = 0;
    p.history = [];
    p.damageDealt = 0;
    p.damageByType = [0, 0, 0];
    p.damageTaken = 0;
    p.hp = this.stats(p).maxHp;
    p.downed = false;
    p.revive = 0;
    p.options = null;
    p.cooldowns = {};
    p.invuln = 0;
    p.dodgeCooldown = 0;
    p.hurtUntil = 0;
    p.kills = 0;
    p.inArena = false;
  }

  private endGame(victory: boolean, unlockedMap: string | null = null): void {
    if (this.phase !== 'playing') return;
    this.phase = 'gameover';
    this.pause = null;
    const prestige = prestigeReward(this.level, this.map.prestigeReward);
    for (const p of this.players.values()) p.profile.points += prestige;
    if (prestige > 0 || this.runGold > 0) this.options.onProfiles?.();
    this.result = {
      victory,
      prestige,
      gold: this.runGold,
      boss: victory ? mapBossName(this.map) : null,
      unlockedMap,
      time: this.time,
      level: this.level,
      players: [...this.players.values()].map((p) => ({ name: p.name, color: p.color, character: p.character, kills: p.kills })),
    };
  }

  private victory(): void {
    if (this.phase !== 'playing') return;
    let unlockedMap: string | null = null;
    if (this.mapIndex + 1 < MAPS.length && this.unlocked < this.mapIndex + 2) {
      this.unlocked = this.mapIndex + 2;
      this.options.onUnlock(this.unlocked);
      unlockedMap = MAPS[this.mapIndex + 1].name;
    }
    this.endGame(true, unlockedMap);
  }

  private alivePlayers(): Player[] {
    return [...this.players.values()].filter((p) => !p.downed);
  }

  /** A player's stats, including their buffs and the active Altar event. */
  private stats(p: Player): PlayerStats {
    const stats = playerStats(p.upgrades, p.character, p.profile.ranks);
    if (p.rage > 0) {
      stats.damageMult *= RAGE.damage;
      stats.cooldownMult *= RAGE.cooldown;
      stats.regen += stats.maxHp * RAGE.regen;
    }
    if (p.guard > 0) stats.armor = 1 - (1 - stats.armor) * (1 - p.guardReduction);
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

  // --- Level-up pause ---

  private updatePause(dt: number): void {
    const pause = this.pause;
    if (pause?.kind !== 'choose') return;
    pause.timeLeft -= dt;
    const undecided = [...this.players.values()].filter((p) => p.options);
    if (pause.timeLeft <= 0) {
      // Out of time: pick for whoever is still deciding.
      for (const p of undecided) this.applyUpgrade(p, p.options![Math.floor(Math.random() * p.options!.length)]);
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
    if (id) this.applyUpgrade(p, id);
  }

  private applyUpgrade(p: Player, id: ChoiceId): void {
    if (isBonus(id)) {
      if (id === 'bonusHeal') {
        const maxHp = this.stats(p).maxHp;
        p.hp = Math.min(maxHp, p.hp + maxHp * BONUS.heal);
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
    if (this.bossPhase === 'fight') this.updateBossFight(dt, alive);
    this.spawnEnemies(dt, alive);
    this.spawnCrates(dt, alive);
    this.updateShrines(dt, alive);
    this.updateQuest(dt, alive);
    this.rebuildGrid();
    this.moveEnemies(dt, alive);
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
    this.updateHearts();
    this.updateCoins(dt);
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
    for (const e of this.enemies) this.grid.insert(e);
  }

  private spawnEnemies(dt: number, alive: Player[]): void {
    if (alive.length === 0) return;
    // In a boss arena it's just the boss and its minions.
    if (this.bossPhase === 'fight' && this.map.arena) return;
    // More enemies over time, and more with more players. Fewer while fighting the boss out in the open.
    let perSecond = this.horde().spawnRate * (0.6 + 0.4 * this.players.size);
    if (this.bossPhase === 'fight') perSecond *= BOSS_FIGHT_HORDE;
    this.spawnAcc += perSecond * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.length < MAX_ENEMIES) this.spawnEnemy(this.pickEnemyType(), alive);
    }
    // Warlords every few minutes, but not right before the final boss.
    if (this.time >= this.nextBossAt) {
      this.nextBossAt += BOSS_INTERVAL;
      if (this.time < this.bossTime - 30) {
        this.spawnEnemy(EnemyType.Warlord, alive);
        this.banner('A Warlord approaches!', 'danger');
      }
    }
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
  private pointNear(alive: Player[], minDist: number, maxDist: number, radius = 20): { x: number; y: number } {
    const near = alive[Math.floor(Math.random() * alive.length)];
    let x = near.x;
    let y = near.y;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = minDist + Math.random() * (maxDist - minDist);
      x = clamp(near.x + Math.cos(angle) * distance, radius, this.map.width - radius);
      y = clamp(near.y + Math.sin(angle) * distance, radius, this.map.height - radius);
      const farEnough = dist2(x, y, near.x, near.y) > (minDist * 0.8) ** 2;
      if (farEnough && !overlapsWall(this.walls, x, y, radius) && this.flow.distanceAt(x, y) < Infinity) break;
    }
    return pushOut(this.walls, x, y, radius);
  }

  private spawnEnemy(type: number, alive: Player[], minDist = SPAWN_DISTANCE, maxDist = SPAWN_DISTANCE + 200): Enemy {
    const { x, y } = this.pointNear(alive, minDist, maxDist, ENEMY_TYPES[type].radius);
    // Enemies toughen up over time. Spawn rate already scales with player count, so only
    // single special enemies (warlords, the thief) get extra HP for it.
    let hp = this.enemyHp(type);
    if (type === EnemyType.Warlord || type === EnemyType.Thief) {
      // One-off enemies grow steadily rather than steeply, or the last warlord would rival the final boss.
      hp = ENEMY_TYPES[type].hp * (1 + 7 * Math.min(1, this.time / this.bossTime)) * this.map.difficulty;
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
    return hordeScaling(this.time / this.bossTime);
  }

  /** Multiplier on an enemy's damage: it grows over the run (named bosses have their own) and with the map's difficulty. */
  private damageScale(e: Enemy): number {
    const behavior = ENEMY_TYPES[e.type].behavior;
    // Fewer-but-tougher only applies to the horde, not to one-off enemies like warlords.
    const horde = behavior === 'boss' || behavior === 'flee' ? this.horde().damage * HORDE_DENSITY ** 0.7 : this.horde().damage;
    const scale = behavior === 'named' ? BOSS_POWER.damage * this.bossMods(e).damage : horde;
    return scale * this.map.difficulty * (e.affix ? CHAMPION.damage : 1);
  }

  /** A regular enemy's health at this point in the run, on this map. */
  private enemyHp(type: number): number {
    return ENEMY_TYPES[type].hp * this.horde().hp * this.map.difficulty;
  }

  private addEnemy(type: number, x: number, y: number, hp: number): Enemy {
    const enemy: Enemy = {
      id: this.nextId++,
      type,
      x,
      y,
      hp,
      maxHp: hp,
      flashUntil: 0,
      orbitHitUntil: 0,
      stunUntil: 0,
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
    };
    this.enemies.push(enemy);
    return enemy;
  }

  // --- Final boss ---

  private updateBoss(dt: number, alive: Player[]): void {
    const arena = this.map.arena;
    if (this.bossPhase === 'waiting' && this.time >= this.bossTime) {
      if (arena) {
        this.bossPhase = 'gather';
        this.safeRadius = this.farthestCorner(arena);
        this.banner(`${mapBossName(this.map)} ${this.map.twin ? 'await' : 'awaits'} in the arena. The fire is closing in!`, 'danger');
      } else {
        this.startBossFight(alive);
      }
    }
    if (!arena || this.bossPhase === 'waiting') return;

    // The burning zone sweeps in from the edges of the map until only the arena is safe.
    const shrink = (this.farthestCorner(arena) - arena.r) / ZONE_SWEEP_TIME;
    this.safeRadius = Math.max(arena.r, this.safeRadius - shrink * dt);
    for (const p of alive) {
      // Fully inside the arena? Then you're locked in.
      if (!p.inArena && dist2(p.x, p.y, arena.x, arena.y) < (arena.r - PLAYER_RADIUS) ** 2) {
        p.inArena = true;
        if (this.bossPhase === 'gather') this.startBossFight(alive);
      }
      // Anyone the fire has caught up with burns.
      if (!p.inArena && dist2(p.x, p.y, arena.x, arena.y) > this.safeRadius ** 2) {
        this.hurtPlayer(p, this.stats(p).maxHp * ZONE_DAMAGE * dt, true);
      }
    }
  }

  /** Distance from the arena to the farthest corner of the map: where the burning zone starts. */
  private farthestCorner(arena: { x: number; y: number }): number {
    return Math.hypot(Math.max(arena.x, this.map.width - arena.x), Math.max(arena.y, this.map.height - arena.y));
  }

  private startBossFight(alive: Player[]): void {
    this.bossPhase = 'fight';
    const type = this.map.boss;
    const arena = this.map.arena;
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
    const types = this.map.twin !== undefined ? [type, this.map.twin] : [type];
    this.bosses = types.map((t, i) => {
      const offset = types.length > 1 ? (i === 0 ? -160 : 160) : 0;
      const spot = pushOut(this.walls, x + offset, y, ENEMY_TYPES[t].radius);
      const hp = ENEMY_TYPES[t].hp * BOSS_POWER.hp * (1 + 0.75 * (this.players.size - 1)) * this.map.difficulty;
      const boss = this.addEnemy(t, spot.x, spot.y, hp);
      boss.attackTimer = 2 + i;
      return boss;
    });
    this.banner(`${mapBossName(this.map)}!`, 'danger');
    // The entrance: everything slows down while the camera shows the boss (or the middle of the twins).
    const bx = this.bosses.reduce((s, b) => s + b.x, 0) / this.bosses.length;
    const by = this.bosses.reduce((s, b) => s + b.y, 0) / this.bosses.length;
    this.fx.push({ k: 'intro', x: Math.round(bx), y: Math.round(by) });
    this.slowMotion(BOSS_INTRO.speed, BOSS_INTRO.hold, BOSS_INTRO.ease);
  }

  /** The berserk clock and side missions. */
  private updateBossFight(dt: number, alive: Player[]): void {
    this.fightTime += dt;
    const stacks = Math.max(0, Math.floor((this.fightTime - BOSS_BERSERK.after) / BOSS_BERSERK.every) + 1);
    if (stacks > this.berserk) {
      this.berserk = stacks;
      this.banner(stacks === 1 ? 'Out of time! The boss goes berserk!' : `Berserk x${stacks}: it keeps getting stronger!`, 'danger');
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
    // Never the same mission twice in a row.
    const kind = pick(MISSION_KINDS.filter((k) => k !== this.lastMission));
    this.lastMission = kind;
    // Around the arena, or the first living boss out in the open.
    const center = this.map.arena ?? this.bosses.find((b) => !b.dead)!;
    const ids: number[] = [];
    const scale = 1 + 0.5 * (this.players.size - 1);
    switch (kind) {
      case 'wards':
        for (let i = 0; i < BOSS_MISSIONS.wards; i++) {
          const a = (i / BOSS_MISSIONS.wards) * Math.PI * 2 + Math.PI / 4;
          const spot = this.missionSpot(center, a, BOSS_MISSIONS.wardDistance, ENEMY_TYPES[EnemyType.Ward].radius);
          // Pinned to boss-time strength, so a long fight doesn't make the wards ever tougher.
          const hp = ENEMY_TYPES[EnemyType.Ward].hp * hordeScaling(1).hp * this.map.difficulty * scale;
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
          const spot = this.missionSpot(center, a, 260 + Math.random() * 120, ENEMY_TYPES[EnemyType.Runner].radius);
          const e = this.addEnemy(EnemyType.Runner, spot.x, spot.y, this.enemyHp(EnemyType.Runner) * BOSS_MISSIONS.broodHp * scale);
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
    const arena = this.map.arena;
    const maxD = arena ? Math.min(distance, arena.r - radius - 30) : distance;
    const at = (a: number, d: number) => ({
      x: clamp(center.x + Math.cos(a) * d, radius, this.map.width - radius),
      y: clamp(center.y + Math.sin(a) * d, radius, this.map.height - radius),
    });
    const clear = (a: number, d: number) => {
      for (let step = 0; step <= d; step += 20) {
        const { x, y } = at(a, step);
        if (overlapsWall(this.walls, x, y, PLAYER_RADIUS)) return false;
      }
      return !overlapsWall(this.walls, at(a, d).x, at(a, d).y, radius);
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
        if (alive.some((p) => dist2(p.x, p.y, s.x, s.y) < SHRINE_RADIUS ** 2)) s.progress = Math.min(1, s.progress + dt / BOSS_MISSIONS.sigilTime);
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

  /** How much stronger a final boss is from going berserk and from losing its twin. */
  private bossMods(e: Enemy): { damage: number; haste: number; area: number } {
    const s = this.berserk;
    const v = e.vengeful;
    return {
      damage: (1 + BOSS_BERSERK.damage * s) * (v ? BOSS_VENGEFUL.damage : 1),
      haste: (1 + BOSS_BERSERK.haste * s) * (v ? BOSS_VENGEFUL.haste : 1),
      area: (1 + BOSS_BERSERK.area * s) * (v ? BOSS_VENGEFUL.area : 1),
    };
  }

  /** A final boss died: the fight is won once they all are; otherwise the survivor turns vengeful. */
  private bossDied(e: Enemy): void {
    const survivors = this.bosses.filter((b) => !b.dead);
    if (survivors.length === 0) {
      this.victory();
      return;
    }
    for (const b of survivors) {
      b.vengeful = true;
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * BOSS_VENGEFUL.heal);
      this.fx.push({ k: 'ring', x: Math.round(b.x), y: Math.round(b.y), r: 220, c: 0xff1744, snd: 'slam' });
      this.banner(`${ENEMY_TYPES[b.type].name} is consumed by rage over ${ENEMY_TYPES[e.type].name}!`, 'danger');
    }
  }

  private namedBossStep(e: Enemy, alive: Player[], ux: number, uy: number, px: number, py: number, d: number, dt: number, speed: number): [number, number] {
    if (e.mode !== Mode.Normal) return this.chargeStep(e, dt, BOSS_CHARGE);
    if (!e.enraged && e.hp < e.maxHp * BOSS_ENRAGE_AT) {
      e.enraged = true;
      this.banner(`${ENEMY_TYPES[e.type].name} is enraged!`, 'danger');
    }
    const def = NAMED_BOSSES[e.type];
    // Casters back off when you get close, and only walk in when you're far.
    let move: [number, number] = [px * speed, py * speed];
    if (def.keepAway) move = d < def.keepAway * 0.8 ? [-ux * speed, -uy * speed] : d < def.keepAway ? [0, 0] : move;
    e.attackTimer -= dt;
    if (e.attackTimer > 0) return move;

    const mods = this.bossMods(e);
    const attack = def.attacks[e.attackIndex++ % def.attacks.length];
    e.attackTimer = (def.cooldown * (e.enraged ? BOSS_ENRAGE_SPEEDUP : 1)) / mods.haste;
    switch (attack) {
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

  // --- Upgrade points ---

  private updateShrines(dt: number, alive: Player[]): void {
    if (alive.length === 0 || this.bossPhase === 'fight') return;
    // Forges come on a fixed schedule.
    if (this.forgesSpawned < FORGE_SCHEDULE.length && this.time >= FORGE_SCHEDULE[this.forgesSpawned] * this.bossTime) {
      this.forgesSpawned++;
      this.spawnShrine(alive, ShrineKind.Forge);
      this.banner(`A Forge has appeared (${this.forgesSpawned} of ${FORGE_SCHEDULE.length})`, 'good');
    }
    // Altars and Quest points stay until captured; a new one comes SHRINE_INTERVAL after there's room for it.
    if (this.shrines.filter((s) => s.kind !== ShrineKind.Forge).length >= MAX_SHRINES) {
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
        // The bigger share of the team inside, the faster it fills.
        const share = SHRINE_SOLO_SHARE + (1 - SHRINE_SOLO_SHARE) * (inside / alive.length);
        s.progress += (dt / SHRINE_CAPTURE_TIME) * share;
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
    let spot = this.pointNear(alive, 500, 800, 50);
    for (let attempt = 0; attempt < 10 && this.shrines.some((s) => dist2(s.x, s.y, spot.x, spot.y) < SHRINE_SPACING ** 2); attempt++) {
      spot = this.pointNear(alive, 500, 1000, 50);
    }
    this.shrines.push({ id: this.nextId++, kind, x: spot.x, y: spot.y, progress: 0, captured: false });
  }

  private activateShrine(s: Shrine): void {
    this.fx.push({ k: 'ring', x: Math.round(s.x), y: Math.round(s.y), r: SHRINE_RADIUS * 1.5, c: SHRINES[s.kind].color });
    switch (s.kind) {
      case ShrineKind.Forge:
        this.choices.push('forge');
        this.banner('The Forge: everyone upgrades a weapon!', 'good');
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
        if (!overlapsWall(this.walls, x, y, RALLY_RADIUS / 2) && this.flow.distanceAt(x, y) < Infinity) break;
      }
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
    const arena = this.bossPhase === 'fight' ? this.map.arena : null;
    const hordeSpeed = this.horde().speed;
    for (const e of this.enemies) {
      if (this.isStunned(e)) continue;
      const def = ENEMY_TYPES[e.type];
      if (def.behavior === 'ward') continue; // Rooted to the spot.
      // The horde gets faster toward the end (bosses and the thief keep their pace).
      const speed = def.behavior === 'named' || def.behavior === 'flee' ? def.speed : def.speed * hordeSpeed * (e.affix === Affix.Hasted ? AFFIX_TUNING.hasteSpeed : 1);

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
      if (target && best > 1) {
        const d = Math.sqrt(best);
        // Straight at the target (for aiming), and along the flow field around walls (for walking).
        const ux = (target.x - e.x) / d;
        const uy = (target.y - e.y) / d;
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
          if (o === e) continue;
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

      this.moveEnemy(e, (vx + sx * SEPARATION_SPEED) * dt, (vy + sy * SEPARATION_SPEED) * dt);
      if (arena) this.keepInArena(e, def.radius);
      if (e.hazard) {
        e.hazard.x = e.x;
        e.hazard.y = e.y;
      }

      if (e.mode === Mode.Charge) {
        const damage = def.behavior === 'named' ? BOSS_CHARGE.damage : CHARGER.damage;
        for (const p of alive) {
          const reach = Math.max(def.radius, e.chargeWidth / 2);
          if (e.charged.has(p.id) || dist2(p.x, p.y, e.x, e.y) >= (PLAYER_RADIUS + reach) ** 2) continue;
          if (this.hurtPlayer(p, damage * this.damageScale(e))) e.charged.add(p.id);
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

  private keepInArena(target: { x: number; y: number }, radius: number): void {
    const arena = this.map.arena!;
    const dx = target.x - arena.x;
    const dy = target.y - arena.y;
    const d = Math.hypot(dx, dy);
    const max = arena.r - radius;
    if (d > max && d > 0) {
      target.x = arena.x + (dx / d) * max;
      target.y = arena.y + (dy / d) * max;
    }
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
      // Getting near the map edge is bad, and worse the closer it gets.
      const edge = Math.min(tx, ty, this.map.width - tx, this.map.height - ty);
      if (edge < EDGE) score -= (EDGE - edge) * 1.5;
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
    this.enemyShots.push({ id: this.nextId++, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, life, dead: false });
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
    const hazard: Hazard = { id: this.nextId++, kind, x, y, a, b, c, t: 0, duration, damage, lob: false, dead: false };
    this.hazards.push(hazard);
    return hazard;
  }

  private updateHazards(dt: number): void {
    for (const h of this.hazards) {
      if (h.dead) continue;
      h.t += dt;
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

  private updateEnemyShots(dt: number): void {
    for (const s of this.enemyShots) {
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
    p.guard = Math.max(0, p.guard - dt);
    this.updateUltimates(p, dt);
    if (p.downed) {
      p.history = []; // Chronobreak can't take you back to before you went down.
      this.updateRevive(p, dt);
      return;
    }
    const stats = this.stats(p);
    p.hp = Math.min(stats.maxHp, p.hp + stats.regen * dt);
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
      if (this.hurtPlayer(p, amount, true) && e.affix === Affix.Vampiric) e.hp = Math.min(e.maxHp, e.hp + amount * AFFIX_TUNING.vampHeal);
    }
    if (!p.downed) this.fireWeapons(p, stats, dt);
  }

  /**
   * Applies evasion and armor, and downs the player at 0 HP. Returns false if the hit didn't land (dodging,
   * evaded, or already down). Discrete hits (bullets, bombs, charges) can be evaded; `continuous` damage
   * (contact with the horde, the burning zone) can't.
   */
  private hurtPlayer(p: Player, amount: number, continuous = false): boolean {
    if (p.downed || p.invuln > 0) return false;
    const stats = this.stats(p);
    if (!continuous && Math.random() < stats.evasion) {
      p.taken.push(0); // Shown as "EVADE".
      return false;
    }
    const taken = amount * (1 - stats.armor);
    p.hp -= taken;
    p.damageTaken += taken;
    if (continuous || taken < 1) p.takenAcc += taken;
    else p.taken.push(Math.round(taken));
    p.hurtUntil = this.time + 0.12;
    // God mode for testing: damage lands, but never below 1 HP.
    if (p.god) p.hp = Math.max(1, p.hp);
    if (p.hp <= 0) {
      p.hp = 0;
      p.downed = true;
      p.revive = 0;
      p.epoch++; // Pin the client to where the server says they went down.
    }
    return true;
  }

  private updateRevive(p: Player, dt: number): void {
    const helped = this.alivePlayers().some((o) => dist2(o.x, o.y, p.x, p.y) < REVIVE_RADIUS ** 2);
    p.revive = helped ? p.revive + dt / REVIVE_TIME : Math.max(0, p.revive - dt / REVIVE_TIME);
    if (p.revive >= 1) {
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
    if (p.downed || this.pause || epoch !== p.epoch) return;
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
      if (id === 'orbit') {
        this.orbitHits(p, stats);
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
    const fires = this.zones.filter((z) => z.kind === ZoneKind.Fire && !z.dead);
    if (fires.length > MAX_VENOM) fires[0].dead = true;
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
      const owner = this.players.get(z.owner);
      if (z.kind !== ZoneKind.Mine) {
        if (z.timer > 0) continue;
        z.timer = z.kind === ZoneKind.Fire ? BURN_TICK : VENOM_TICK;
        // Flying enemies float over venom, but not over fire.
        const hitsFlying = z.kind === ZoneKind.Fire;
        for (const e of this.grid.query(z.x, z.y, z.r + MAX_ENEMY_RADIUS, this.near)) {
          if (!e.dead && (hitsFlying || !ENEMY_TYPES[e.type].flying) && dist2(e.x, e.y, z.x, z.y) < (z.r + ENEMY_TYPES[e.type].radius) ** 2) {
            this.damageEnemy(e, z.damage, owner, z.type);
          }
        }
      } else if (z.timer <= 0) {
        const triggered = this.grid
          .query(z.x, z.y, z.r + MAX_ENEMY_RADIUS, this.near)
          .some((e) => !e.dead && dist2(e.x, e.y, z.x, z.y) < (z.r + ENEMY_TYPES[e.type].radius) ** 2);
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

  /** Shadow Daggers: stab the nearest enemies within reach (or all of them, evolved). */
  private stab(p: Player, level: number, stats: PlayerStats): number {
    const s = daggersStats(level);
    const inReach = this.grid
      .query(p.x, p.y, s.range + MAX_ENEMY_RADIUS, this.near)
      .filter((e) => !e.dead && dist2(e.x, e.y, p.x, p.y) < (s.range + ENEMY_TYPES[e.type].radius) ** 2)
      .sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y));
    if (inReach.length === 0) return 0.1; // Nobody close: try again soon.
    const targets = s.all ? inReach : inReach.slice(0, s.targets + stats.projectiles);
    for (const e of targets) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      this.damageEnemy(e, s.damage * stats.damageMult, p, 'physical');
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
      radius: 0,
      root: 0,
      interval: 0,
      dead: false,
    };
    this.summons.push(m);
    return m;
  }

  /** Wolves hunt enemies near their druid and bite; treants stand their ground and slam. */
  private updateSummons(dt: number): void {
    for (const m of this.summons) {
      const owner = this.players.get(m.owner);
      m.life -= dt;
      if (!owner || m.life <= 0) m.dead = true;
      if (m.dead || !owner) continue;
      m.timer -= dt;
      const stats = this.stats(owner);
      if (m.kind === SummonKind.Treant) {
        if (m.timer > 0) continue;
        m.timer = m.interval;
        for (const e of this.grid.query(m.x, m.y, m.radius + MAX_ENEMY_RADIUS, this.near)) {
          if (e.dead || dist2(e.x, e.y, m.x, m.y) >= (m.radius + ENEMY_TYPES[e.type].radius) ** 2) continue;
          this.damageEnemy(e, m.damage, owner, 'physical');
          this.stun(e, m.root);
        }
        this.fx.push({ k: 'ring', x: Math.round(m.x), y: Math.round(m.y), r: m.radius, c: 0x8bc34a, snd: 'slam' });
        continue;
      }
      // Wolves: pack wolves use the Wolf Pack's level; Call of the Wild's grow with the team level.
      const level = owner.upgrades.wolves ?? 0;
      const s = wolvesStats(Math.max(1, level));
      const damage = (m.pack ? s.damage : 20 + 1.5 * this.level) * stats.damageMult;
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
      if (target) {
        tx = target.x;
        ty = target.y;
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
    if (inRange.length === 0) return 0.25; // Nothing to hit; check again soon.
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

  private orbitHits(p: Player, stats: PlayerStats): void {
    const s = orbitLayout(p.upgrades, p.character);
    if (!s) return;
    for (let i = 0; i < s.count; i++) {
      // Clients draw the blades with this same formula.
      const angle = this.time * s.spin + (i * Math.PI * 2) / s.count;
      const bx = p.x + Math.cos(angle) * s.radius;
      const by = p.y + Math.sin(angle) * s.radius;
      for (const e of this.grid.query(bx, by, s.bladeRadius + MAX_ENEMY_RADIUS, this.near)) {
        if (e.dead || e.orbitHitUntil > this.time) continue;
        if (dist2(e.x, e.y, bx, by) >= (s.bladeRadius + ENEMY_TYPES[e.type].radius) ** 2) continue;
        e.orbitHitUntil = this.time + s.hitCooldown;
        this.damageEnemy(e, s.damage * stats.damageMult, p, 'physical');
      }
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
    amount *= 1 - this.resistance(e, type);
    if (by) {
      const stats = this.stats(by);
      amount *= stats.typeDamage[type];
      const crit = CRIT_TYPES[type] && stats.critChance > 0 && Math.random() < stats.critChance;
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
        by.hp = Math.min(stats.maxHp, by.hp + heal);
      }
    }
    e.hp -= amount;
    e.flashUntil = this.time + 0.1;
    if (e.hp > 0) return;
    e.dead = true;
    if (e.hazard) e.hazard.dead = true;
    if (by) by.kills++;
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
      if (!pr.target) return; // Nothing nearby: keep flying straight.
    }
    const speed = Math.hypot(pr.vx, pr.vy);
    const heading = Math.atan2(pr.vy, pr.vx);
    let turn = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x) - heading;
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
    if (slot === 'e' && p.abilityCd <= 0) {
      const level = p.upgrades[hero.ability] ?? 0;
      if (level > 0) p.abilityCd = this.castAbility(p, hero.ability, level, reach, stats) * stats.cooldownMult;
    } else if (slot === 'r' && p.ultCd <= 0) {
      this.castUltimate(p);
      p.ultCd = hero.ultimate.cooldown;
    }
  }

  /** Casts a hero ability and returns its cooldown. */
  private castAbility(p: Player, id: AbilityId, level: number, reach: number, stats: PlayerStats): number {
    // Casts arrive between ticks, so bring the enemy lookup up to date first.
    this.rebuildGrid();
    const dirX = Math.cos(p.aim);
    const dirY = Math.sin(p.aim);
    switch (id) {
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
        // Over walls, but never landing inside one.
        const landing = pushOut(this.walls, p.x + dirX * d, p.y + dirY * d, PLAYER_RADIUS);
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
        p.guardReduction = Math.max(p.guard > 0 ? p.guardReduction : 0, s.reduction);
        p.guard = Math.max(p.guard, s.duration);
        if (s.heal > 0) p.hp = Math.min(stats.maxHp, p.hp + stats.maxHp * s.heal);
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
      case 'treant': {
        const s = treantStats(level);
        const d = Math.min(reach, s.maxRange);
        for (let i = 0; i < s.count; i++) {
          const side = s.count > 1 ? (i === 0 ? -1 : 1) * 90 : 0;
          const x = p.x + dirX * d - dirY * side;
          const y = p.y + dirY * d + dirX * side;
          const spot = pushOut(this.walls, clamp(x, 30, this.map.width - 30), clamp(y, 30, this.map.height - 30), 26);
          const m = this.summon(p, SummonKind.Treant, spot.x, spot.y, s.duration * stats.duration);
          m.damage = s.damage * stats.damageMult;
          m.radius = s.radius * stats.area;
          m.root = s.root * stats.duration;
          m.interval = s.interval;
          m.timer = 0.3;
        }
        p.sounds.push('summon');
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
      case 'wildcall':
        for (let i = 0; i < WILD_CALL.wolves + stats.projectiles; i++) {
          const a = (i / WILD_CALL.wolves) * Math.PI * 2;
          this.summon(p, SummonKind.Wolf, p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40, WILD_CALL.life * stats.duration);
        }
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 160, c: 0x8bc34a });
        break;
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
        break;
      }
      case 'rage':
        p.rage = RAGE.duration * stats.duration;
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 120, c: AURA.rage });
        break;
      case 'rally':
        for (const ally of this.players.values()) {
          if (dist2(ally.x, ally.y, p.x, p.y) >= RALLY.radius ** 2) continue;
          const maxHp = this.stats(ally).maxHp;
          if (ally.downed) {
            ally.downed = false;
            ally.revive = 0;
            ally.hp = maxHp * RALLY.heal;
          } else {
            ally.hp = Math.min(maxHp, ally.hp + maxHp * RALLY.heal);
          }
          ally.guardReduction = Math.max(ally.guard > 0 ? ally.guardReduction : 0, RALLY.reduction);
          ally.guard = Math.max(ally.guard, RALLY.guard * stats.duration);
        }
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: RALLY.radius, c: AURA.guard });
        break;
    }
  }

  /** Ultimates that play out over time: Shadow Strike, Inferno, Arrow Storm, and Shadow Veil's eruption. */
  private updateUltimates(p: Player, dt: number): void {
    if (p.downed) {
      p.veil = p.strikes = p.inferno = p.arrowStorm = 0;
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
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r, c: 0x7e57c2, snd: 'slam' });
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
          p.sounds.push('dagger');
        }
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
    if (this.bossPhase === 'fight' && this.map.arena) return;
    if (this.pickups.filter((c) => c.kind === PickupKind.Crate).length >= MAX_CRATES) return;
    const { x, y } = this.pointNear(alive, 300, 600, CRATE_RADIUS + 4);
    this.addPickup(PickupKind.Crate, x, y, CRATE_HP);
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
    const damage = BOMB.damage * this.horde().hp * this.map.difficulty;
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
        for (const q of this.players.values()) q.profile.gold = (q.profile.gold ?? 0) + c.value;
        p.sounds.push('coin');
        continue;
      }
      const step = Math.min(d, COIN.speed * dt);
      c.x += ((p.x - c.x) / d) * step;
      c.y += ((p.y - c.y) / d) * step;
    }
  }

  private updateHearts(): void {
    for (const h of this.pickups) {
      if (h.kind !== PickupKind.Heart || h.dead) continue;
      for (const p of this.alivePlayers()) {
        const maxHp = this.stats(p).maxHp;
        // Players at full health walk over hearts, leaving them for teammates.
        if (p.hp >= maxHp || dist2(p.x, p.y, h.x, h.y) >= (PLAYER_RADIUS + HEART_RADIUS) ** 2) continue;
        p.hp = Math.min(maxHp, p.hp + maxHp * HEART_HEAL);
        p.sounds.push('heal');
        h.dead = true;
        break;
      }
    }
  }

  // --- XP ---

  private dropGem(x: number, y: number, value: number): void {
    if (this.gems.length >= MAX_GEMS) {
      // Too many gems lying around: fold the XP into the oldest one instead.
      this.gems[0].value += value;
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
    while (this.xp >= this.xpNext()) {
      this.xp -= this.xpNext();
      this.level++;
      this.choices.push('level');
    }
  }

  /**
   * XP for the next level. Before the boss, the curve keeps the team on a schedule where the last possible
   * upgrade lands right when the boss arrives: ahead of schedule makes levels pricier, behind makes them cheaper.
   */
  private xpNext(): number {
    const base = xpToNext(this.level, Math.max(1, this.players.size));
    if (this.bossPhase !== 'waiting' || this.players.size === 0) return base;
    const expectedLevel = 1 + UPGRADE_PICKS * Math.pow(Math.min(1, this.time / this.bossTime), 0.9);
    const factor = clamp(2 ** ((this.level - expectedLevel) / 3), 0.35, 3);
    return Math.max(1, Math.round(base * factor));
  }

  // --- Networking ---

  private broadcast(): void {
    if (this.players.size === 0) return;

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
      damageDealt: Math.round(p.damageDealt),
      damageByType: p.damageByType.map(Math.round) as [number, number, number],
      damageTaken: Math.round(p.damageTaken),
      choosing: p.options !== null,
      invuln: p.invuln > 0,
      hurt: p.hurtUntil > this.time,
      inArena: p.inArena,
      veiled: p.veil > 0,
      aura:
        p.strikes > 0 ? AURA.strike : p.arrowStorm > 0 ? AURA.storm : p.inferno > 0 ? AURA.inferno : p.rage > 0 ? AURA.rage : p.guard > 0 ? AURA.guard : 0,
    }));
    const enemies: number[] = [];
    for (const e of this.enemies) {
      const flags =
        (e.flashUntil > this.time ? EnemyFlag.Hit : 0) |
        (e.mode === Mode.Windup ? EnemyFlag.WindingUp : 0) |
        (this.isStunned(e) ? EnemyFlag.Stunned : 0) |
        (this.mission && this.bosses.includes(e) && !e.dead ? EnemyFlag.Shielded : 0) |
        (e.missionTarget ? EnemyFlag.Marked : 0) |
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
    for (const c of this.pickups) pickups.push(c.id, c.kind, Math.round(c.x), Math.round(c.y), c.flashUntil > this.time ? 1 : 0);
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

    const shared: Omit<Snapshot, 'me'> = {
      t: 'snap',
      tick: this.tickCount,
      phase: this.phase,
      map: this.mapIndex,
      unlocked: this.unlocked,
      bossTime: this.bossTime,
      arena: arena && {
        ...arena,
        state: this.bossPhase === 'waiting' ? 'idle' : this.bossPhase,
        safeR: this.bossPhase === 'waiting' ? 0 : Math.round(this.safeRadius),
      },
      bossFight:
        this.bossPhase === 'fight' && this.bosses.length > 0
          ? {
              bosses: this.bosses.map((b) => ({
                name: bossDisplayName(b.type),
                hp: b.dead ? 0 : Math.ceil(Math.max(0, b.hp)),
                maxHp: Math.ceil(b.maxHp),
                enraged: b.enraged,
                vengeful: b.vengeful,
              })),
              berserkIn: round1(Math.max(0, BOSS_BERSERK.after - this.fightTime)),
              berserk: this.berserk,
              mission: this.mission && { kind: this.mission.kind, done: this.missionDone(this.mission), total: this.mission.total },
            }
          : null,
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
      upgrades: p.upgrades,
      speed: stats.speed,
      dodgeCooldown: stats.dodgeCooldown,
      ability: { cd: round1(p.abilityCd), cooldown: round1(this.abilityCooldown(p) * stats.cooldownMult) },
      ultimate: { cd: round1(p.ultCd), cooldown: hero.ultimate.cooldown, active: round1(Math.max(p.rage, p.inferno, p.arrowStorm, p.veil)) },
      hits: this.takeHits(p),
      taken: p.taken.splice(0),
      sounds: [...new Set(p.sounds.splice(0))], // One of each per snapshot is plenty.
      epoch: p.epoch,
      prestigePoints: p.profile.points,
      god: p.god,
      gold: p.profile.gold ?? 0,
      heroes: this.allHeroes(p) ? CHARACTER_IDS : (p.profile.heroes ?? []).filter(isCharacterId),
    };
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
      case 'meteor':
        return meteorStats(level).cooldown;
      case 'veil':
        return veilStats(level).cooldown;
      case 'flamenova':
        return flamenovaStats(level).cooldown;
      case 'tumble':
        return tumbleStats(level).cooldown;
      case 'treant':
        return treantStats(level).cooldown;
      case 'timebomb':
        return timebombStats(level).cooldown;
      case 'leap':
        return leapStats(level).cooldown;
      case 'warcry':
        return warcryStats(level).cooldown;
    }
  }
}
