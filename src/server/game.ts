import {
  CHARACTERS,
  DEFAULT_CHARACTER,
  UPGRADE_PICKS,
  isCharacterId,
  offerableUpgrades,
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
  CRATE_HP,
  CRATE_INTERVAL,
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
  REVIVE_RADIUS,
  REVIVE_TIME,
  SPAWN_DISTANCE,
  TICK_DT,
} from '../shared/constants';
import {
  BOMBARDIER,
  BOSS_ATTACK,
  BOSS_CHARGE,
  BOSS_ENRAGE_AT,
  BOSS_ENRAGE_SPEEDUP,
  BOSS_NOVA,
  BOSS_STUN,
  BOSS_SUMMON,
  CHARGER,
  ENEMY_TYPES,
  EnemyType,
  MAX_ENEMY_RADIUS,
  NAMED_BOSSES,
  SPITTER,
  bossDisplayName,
  type ChargeConfig,
} from '../shared/enemies';
import { BOSS_TIME, MAPS, ZONE_DAMAGE, ZONE_SWEEP_TIME, type MapDef } from '../shared/maps';
import {
  EVENTS,
  EVENT_DURATION,
  EVENT_KINDS,
  HUNT_TIME,
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
  HazardKind,
  PickupKind,
  ProjectileKind,
  ZoneKind,
  type ActiveEvent,
  type ChoiceReason,
  type ClientMessage,
  type Fx,
  type SoundId,
  type GameResult,
  type MeState,
  type Pause,
  type Phase,
  type PlayerState,
  type Snapshot,
} from '../shared/protocol';
import {
  MAX_LEVEL,
  UPGRADES,
  CRIT_MULTIPLIER,
  boltStats,
  cleaveStats,
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
const WEAPON_IDS: WeaponId[] = ['bolt', 'knives', 'storm', 'hex', 'cleave', 'slam', 'venom', 'orbit', 'field', 'mines'];
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
const LOTUS = { duration: 3, interval: 0.2, knives: 12 };
const CHRONO = { radius: 900, stun: 4 };
const RAGE = { duration: 8, damage: 1.6, cooldown: 0.7, regen: 0.04 };
const RALLY = { radius: 700, heal: 0.4, guard: 6, reduction: 0.5 };
const AURA = { rage: 0xff1744, guard: 0xffd54f, lotus: 0xce93d8 };

/** Charge attack cycle (chargers and bosses). Other enemies stay in Normal. */
const Mode = { Normal: 0, Windup: 1, Charge: 2, Recover: 3 } as const;

export interface GameOptions {
  /** How many maps are unlocked at startup. */
  unlocked: number;
  /** Called when a victory unlocks a new map, to save progress. */
  onUnlock: (unlocked: number) => void;
  /** Override when the named boss arrives, in seconds (for testing). */
  bossTime?: number;
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
  /** Upgrade choices while a level-up pause is waiting on this player. */
  options: UpgradeId[] | null;
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
  lotus: number;
  lotusTimer: number;
  // For the Tab scoreboard.
  damageDealt: number;
  damageTaken: number;
  /** Where the last Venom Trail puddle was dropped. */
  lastVenomX: number;
  lastVenomY: number;
  // Damage numbers for this player's screen, collected until the next snapshot.
  /** Enemy id -> damage dealt to it this tick. */
  hits: Map<number, { x: number; y: number; amount: number; crit: boolean }>;
  taken: number[];
  /** Small continuous damage (contact, zone) is added up and shown every DAMAGE_NUMBER_INTERVAL. */
  takenAcc: number;
  takenTimer: number;
  /** Sounds for this player's own actions, collected until the next snapshot. */
  sounds: SoundId[];
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
  dead: boolean;
}

/** A delayed area hit from a player (Meteor). */
interface Blast {
  x: number;
  y: number;
  r: number;
  damage: number;
  owner: number;
  t: number;
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
  /** Evolved Arcane Bolt: damage dealt around each hit. */
  explosion: { radius: number; damage: number } | null;
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
interface Pickup {
  id: number;
  kind: number;
  x: number;
  y: number;
  hp: number;
  flashUntil: number;
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
  private event: ActiveEvent | null = null;
  private quest: Quest | null = null;
  private blasts: Blast[] = [];
  private zones: Zone[] = [];
  /** Real seconds left of the slow-motion ease-in after a pause. */
  private slowmo = 0;
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
  private finalBoss: Enemy | null = null;
  private enraged = false;

  private grid = new SpatialGrid<Enemy>(64);
  /** Reused query buffers; never nest two grid queries that share one. */
  private near: Enemy[] = [];
  private splashNear: Enemy[] = [];

  constructor(private readonly options: GameOptions) {
    this.unlocked = clamp(options.unlocked, 1, MAPS.length);
    this.bossTime = options.bossTime ?? BOSS_TIME;
    this.loadMap(this.unlocked - 1); // Start on the newest unlocked map.
  }

  addPlayer(name: string, character: unknown, send: (text: string) => void): number | null {
    if (this.players.size >= MAX_PLAYERS) return null;
    const used = new Set([...this.players.values()].map((p) => p.color));
    const player: Player = {
      id: this.nextId++,
      name,
      color: PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0],
      character: isCharacterId(character) ? character : DEFAULT_CHARACTER,
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
      lotus: 0,
      lotusTimer: 0,
      damageDealt: 0,
      damageTaken: 0,
      lastVenomX: 0,
      lastVenomY: 0,
      hits: new Map(),
      taken: [],
      takenAcc: 0,
      takenTimer: 0,
      sounds: [],
    };
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
        if (this.phase !== 'playing' && isCharacterId(msg.character)) {
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
        if (this.phase === 'gameover') {
          this.phase = 'lobby';
          this.clearWorld();
          let slot = 0;
          for (const other of this.players.values()) this.resetPlayer(other, slot++);
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
    }
  }

  tick(): void {
    this.tickCount++;
    if (this.phase === 'playing') {
      if (this.pause) {
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

  /** Game speed while easing back in after a pause: starts slow, smoothly reaching full speed. */
  private timeScale(): number {
    if (this.slowmo <= 0) return 1;
    const t = 1 - this.slowmo / SLOWMO.duration;
    return SLOWMO.start + (1 - SLOWMO.start) * t * t * (3 - 2 * t);
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
    this.event = null;
    this.quest = null;
    this.blasts = [];
    this.zones = [];
    this.nextLobAt = 0;
    this.slowmo = 0;
    this.bossPhase = 'waiting';
    this.safeRadius = Infinity;
    this.finalBoss = null;
    this.enraged = false;
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
    p.lotus = 0;
    p.damageDealt = 0;
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
    this.result = {
      victory,
      boss: victory ? bossDisplayName(this.map.boss) : null,
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
    const stats = playerStats(p.upgrades, p.character);
    if (p.rage > 0) {
      stats.damageMult *= RAGE.damage;
      stats.cooldownMult *= RAGE.cooldown;
      stats.regen += stats.maxHp * RAGE.regen;
    }
    if (p.guard > 0) stats.armor = 1 - (1 - stats.armor) * (1 - p.guardReduction);
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
    const pause = this.pause!;
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
      this.slowmo = SLOWMO.duration;
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

  private rollOptions(p: Player, reason: ChoiceReason): UpgradeId[] | null {
    // Anything owned and not maxed, plus new things while there are free slots.
    const offerable = offerableUpgrades(p.upgrades, p.character);
    if (reason === 'forge') {
      // Max-level weapons can evolve; otherwise it's a regular weapon upgrade (or a new weapon).
      const evolve = shuffle(ownedWeapons(p.upgrades).filter((id) => p.upgrades[id] === MAX_LEVEL && UPGRADES[id].evolution));
      const improve = shuffle(offerable.filter((id) => UPGRADES[id].kind === 'weapon'));
      const options = [...evolve, ...improve].slice(0, 3);
      if (options.length > 0) return options;
      // Every weapon is already evolved: fall back to a normal pick.
    }
    const candidates = shuffle(offerable);
    if (candidates.length === 0) {
      // Everything is maxed; the pick becomes a full heal.
      p.hp = this.stats(p).maxHp;
      return null;
    }
    return candidates.slice(0, 3);
  }

  private choose(p: Player, index: number): void {
    if (this.pause?.kind !== 'choose' || !p.options || !Number.isInteger(index)) return;
    const id = p.options[index];
    if (id) this.applyUpgrade(p, id);
  }

  private applyUpgrade(p: Player, id: UpgradeId): void {
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
    if (this.tickCount % FLOW_INTERVAL === 0 && alive.length > 0) this.flow.update(alive);
    this.updateBoss(dt, alive);
    this.spawnEnemies(dt, alive);
    this.spawnCrates(dt, alive);
    this.updateShrines(dt, alive);
    this.updateQuest(dt, alive);
    this.rebuildGrid();
    this.moveEnemies(dt, alive);
    this.rebuildGrid();
    for (const p of this.players.values()) this.updatePlayer(p, dt);
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
    let perSecond = (0.8 + this.time / 30) * (0.6 + 0.4 * this.players.size);
    if (this.bossPhase === 'fight') perSecond *= 0.4;
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
    const available = ENEMY_TYPES.map((def, type) => ({
      type,
      weight: this.time >= def.spawnAfter ? def.weight * (this.map.enemyWeights[type] ?? 1) : 0,
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
    let hp = ENEMY_TYPES[type].hp * (1 + this.time / 120);
    if (type === EnemyType.Warlord || type === EnemyType.Thief) hp *= 1 + 0.5 * (this.players.size - 1);
    return this.addEnemy(type, x, y, hp);
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
        this.banner(`${bossDisplayName(this.map.boss)} awaits in the arena. The fire is closing in!`, 'danger');
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
    }
    const hp = ENEMY_TYPES[type].hp * (1 + 0.75 * (this.players.size - 1));
    this.finalBoss = this.addEnemy(type, x, y, hp);
    this.finalBoss.attackTimer = 2;
    this.banner(`${bossDisplayName(type)}!`, 'danger');
  }

  private namedBossStep(e: Enemy, alive: Player[], ux: number, uy: number, px: number, py: number, dt: number, speed: number): [number, number] {
    if (e.mode !== Mode.Normal) return this.chargeStep(e, dt, BOSS_CHARGE);
    if (!this.enraged && e.hp < e.maxHp * BOSS_ENRAGE_AT) {
      this.enraged = true;
      this.banner(`${ENEMY_TYPES[e.type].name} is enraged!`, 'danger');
    }
    e.attackTimer -= dt;
    if (e.attackTimer > 0) return [px * speed, py * speed];

    const def = NAMED_BOSSES[e.type];
    const attack = def.attacks[e.attackIndex++ % def.attacks.length];
    e.attackTimer = def.cooldown * (this.enraged ? BOSS_ENRAGE_SPEEDUP : 1);
    switch (attack) {
      case 'barrage':
        for (const p of alive) this.addHazard(HazardKind.Circle, p.x, p.y, BOSS_ATTACK.radius, 0, 0, BOSS_ATTACK.delay, BOSS_ATTACK.damage);
        break;
      case 'nova': {
        const shots = Math.round(BOSS_NOVA.shots * (this.enraged ? 1.5 : 1));
        const offset = Math.random() * Math.PI * 2;
        for (let i = 0; i < shots; i++) {
          const angle = offset + (i / shots) * Math.PI * 2;
          this.addEnemyShot(e.x, e.y, angle, BOSS_NOVA.speed, BOSS_NOVA.damage, BOSS_NOVA.life);
        }
        break;
      }
      case 'charge':
        this.startWindup(e, ux, uy, BOSS_CHARGE);
        return [0, 0];
      case 'summon':
        for (let i = 0; i < BOSS_SUMMON.count; i++) {
          const angle = (i / BOSS_SUMMON.count) * Math.PI * 2;
          const type = pick(def.minions);
          const spot = pushOut(this.walls, e.x + Math.cos(angle) * 110, e.y + Math.sin(angle) * 110, ENEMY_TYPES[type].radius);
          this.addEnemy(type, spot.x, spot.y, ENEMY_TYPES[type].hp * (1 + this.time / 120));
        }
        break;
    }
    return [px * speed, py * speed];
  }

  // --- Upgrade points ---

  private updateShrines(dt: number, alive: Player[]): void {
    if (alive.length === 0 || this.bossPhase === 'fight') return;
    // Shrines stay until captured; a new one comes SHRINE_INTERVAL after there's room for it.
    if (this.shrines.length >= MAX_SHRINES) {
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

  private spawnShrine(alive: Player[]): void {
    const questBusy = this.quest !== null || this.shrines.some((s) => s.kind === ShrineKind.Quest);
    const allowed = Object.values(ShrineKind).filter((kind) => !(kind === ShrineKind.Quest && questBusy));
    // Prefer a kind that isn't already on the map.
    const fresh = allowed.filter((kind) => !this.shrines.some((s) => s.kind === kind));
    const kind = pick(fresh.length > 0 ? fresh : allowed);
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

  private moveEnemies(dt: number, alive: Player[]): void {
    const arena = this.bossPhase === 'fight' ? this.map.arena : null;
    for (const e of this.enemies) {
      if (this.isStunned(e)) continue;
      const def = ENEMY_TYPES[e.type];

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
            [vx, vy] = this.keepDistance(e, ux, uy, px, py, d, SPITTER.minRange, SPITTER.maxRange, def.speed);
            this.spit(e, ux, uy, d, dt);
            break;
          case 'lobber':
            [vx, vy] = this.keepDistance(e, ux, uy, px, py, d, BOMBARDIER.minRange, BOMBARDIER.maxRange, def.speed);
            this.lob(e, target, d, dt);
            break;
          case 'charger':
            if (e.mode !== Mode.Normal) {
              [vx, vy] = this.chargeStep(e, dt, CHARGER);
            } else {
              e.attackTimer -= dt;
              if (e.attackTimer <= 0 && d < CHARGER.triggerRange) this.startWindup(e, ux, uy, CHARGER);
              else [vx, vy] = [px * def.speed, py * def.speed];
            }
            break;
          case 'boss':
            this.warlordAttack(e, alive, dt);
            [vx, vy] = [px * def.speed, py * def.speed];
            break;
          case 'named':
            [vx, vy] = this.namedBossStep(e, alive, ux, uy, px, py, dt, def.speed);
            break;
          case 'flee':
            [vx, vy] = this.fleeStep(e, alive, def.speed, def.radius);
            break;
          default:
            [vx, vy] = [px * def.speed, py * def.speed];
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
          if (e.charged.has(p.id) || dist2(p.x, p.y, e.x, e.y) >= (PLAYER_RADIUS + def.radius) ** 2) continue;
          if (this.hurtPlayer(p, damage)) e.charged.add(p.id);
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
    this.addEnemyShot(e.x, e.y, Math.atan2(uy, ux), SPITTER.shotSpeed, SPITTER.shotDamage, SPITTER.shotLife);
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
    const bomb = this.addHazard(HazardKind.Circle, target.x, target.y, BOMBARDIER.radius, 0, 0, BOMBARDIER.delay, BOMBARDIER.damage);
    bomb.lob = true;
  }

  /** Stop and show the charge lane. */
  private startWindup(e: Enemy, ux: number, uy: number, cfg: ChargeConfig): void {
    e.mode = Mode.Windup;
    e.modeTimer = cfg.windup;
    e.dirX = ux;
    e.dirY = uy;
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
    for (const p of alive) this.addHazard(HazardKind.Circle, p.x, p.y, BOSS_ATTACK.radius, 0, 0, BOSS_ATTACK.delay, BOSS_ATTACK.damage);
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
    p.lotus = p.downed ? 0 : Math.max(0, p.lotus - dt);
    if (p.lotus > 0) this.deathLotus(p, dt);
    if (p.downed) {
      this.updateRevive(p, dt);
      return;
    }
    const stats = this.stats(p);
    p.hp = Math.min(stats.maxHp, p.hp + stats.regen * dt);

    for (const e of this.grid.query(p.x, p.y, PLAYER_RADIUS + MAX_ENEMY_RADIUS, this.near)) {
      const def = ENEMY_TYPES[e.type];
      if (e.dead || def.damage === 0 || this.isStunned(e)) continue;
      if (dist2(e.x, e.y, p.x, p.y) < (PLAYER_RADIUS + def.radius) ** 2) this.hurtPlayer(p, def.damage * dt, true);
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
    // God mode for testing: a player named "dev" takes damage but never goes below 1 HP.
    if (p.name.toLowerCase() === 'dev') p.hp = Math.max(1, p.hp);
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
        this.shootFan(p, ProjectileKind.Bolt, { ...s, count: s.count + stats.projectiles, explosion }, stats);
        p.sounds.push('bolt');
        return s.cooldown;
      }
      case 'knives': {
        const s = knivesStats(level);
        this.shootFan(p, ProjectileKind.Knife, { ...s, count: s.count + stats.projectiles }, stats);
        for (let i = 0; i < s.ring; i++) this.shoot(p, ProjectileKind.Knife, p.aim + (i * Math.PI * 2) / s.ring, s, stats);
        p.sounds.push('knives');
        return s.cooldown;
      }
      case 'hex': {
        // Hexes don't need aim: they fan out around your aim and then find their own targets.
        const s = hexStats(level);
        const count = s.count + stats.projectiles;
        for (let i = 0; i < count; i++) this.shoot(p, ProjectileKind.Hex, p.aim + (i - (count - 1) / 2) * s.spread, s, stats, true);
        p.sounds.push('hex');
        return s.cooldown;
      }
      case 'storm':
        return this.storm(p, level, stats);
      case 'cleave':
        return this.cleave(p, level, stats);
      case 'slam':
        return this.slam(p, level, stats);
      case 'field': {
        const s = fieldStats(level);
        const r = s.radius * stats.area;
        for (const e of this.grid.query(p.x, p.y, r + MAX_ENEMY_RADIUS, this.near)) {
          if (!e.dead && dist2(e.x, e.y, p.x, p.y) < (r + ENEMY_TYPES[e.type].radius) ** 2) this.damageEnemy(e, s.damage * stats.damageMult, p);
        }
        return s.interval;
      }
      case 'venom': {
        const s = venomStats(level);
        // A new puddle once you've moved far enough from the last one.
        if (dist2(p.x, p.y, p.lastVenomX, p.lastVenomY) >= s.spacing ** 2) {
          p.lastVenomX = p.x;
          p.lastVenomY = p.y;
          this.addZone(p, ZoneKind.Venom, s.radius * stats.area, 0, s.damage * stats.damageMult, s.life * stats.duration, 0);
          const venom = this.zones.filter((z) => z.kind === ZoneKind.Venom && !z.dead);
          if (venom.length > MAX_VENOM) venom[0].dead = true;
        }
        return 0.1;
      }
      case 'mines': {
        const s = minesStats(level);
        const mine = this.zones.filter((z) => z.kind === ZoneKind.Mine && z.owner === p.id && !z.dead);
        if (mine.length >= s.max) mine[0].dead = true; // Replace the oldest.
        this.addZone(p, ZoneKind.Mine, s.trigger, s.radius * stats.area, s.damage * stats.damageMult, 60, s.armTime);
        p.sounds.push('mine');
        return s.cooldown;
      }
      default:
        return 1;
    }
  }

  private addZone(p: Player, kind: number, r: number, blast: number, damage: number, life: number, timer: number): void {
    this.zones.push({ id: this.nextId++, kind, owner: p.id, x: p.x, y: p.y, r, blast, damage, life, timer, dead: false });
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
      if (z.kind === ZoneKind.Venom) {
        if (z.timer > 0) continue;
        z.timer = VENOM_TICK;
        for (const e of this.grid.query(z.x, z.y, z.r + MAX_ENEMY_RADIUS, this.near)) {
          if (!e.dead && !ENEMY_TYPES[e.type].flying && dist2(e.x, e.y, z.x, z.y) < (z.r + ENEMY_TYPES[e.type].radius) ** 2) {
            this.damageEnemy(e, z.damage, owner);
          }
        }
      } else if (z.timer <= 0) {
        const triggered = this.grid
          .query(z.x, z.y, z.r + MAX_ENEMY_RADIUS, this.near)
          .some((e) => !e.dead && dist2(e.x, e.y, z.x, z.y) < (z.r + ENEMY_TYPES[e.type].radius) ** 2);
        if (!triggered) continue;
        z.dead = true;
        this.splash(z.x, z.y, z.blast, z.damage, owner);
        this.hitCratesAround(z.x, z.y, z.blast, z.damage);
        this.fx.push({ k: 'ring', x: Math.round(z.x), y: Math.round(z.y), r: z.blast, c: 0xffab40, snd: 'explode' });
      }
    }
    this.zones = this.zones.filter((z) => !z.dead);
  }

  /** Projectiles fanned out around the aim direction. */
  private shootFan(p: Player, kind: number, s: FanStats, stats: PlayerStats): void {
    for (let i = 0; i < s.count; i++) this.shoot(p, kind, p.aim + (i - (s.count - 1) / 2) * s.spread, s, stats);
  }

  private shoot(p: Player, kind: number, angle: number, s: FanStats, stats: PlayerStats, homing = false): void {
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
  private splash(x: number, y: number, radius: number, damage: number, by: Player | undefined, skip?: Enemy): void {
    for (const e of this.grid.query(x, y, radius + MAX_ENEMY_RADIUS, this.splashNear)) {
      if (e !== skip && dist2(e.x, e.y, x, y) < (radius + ENEMY_TYPES[e.type].radius) ** 2) this.damageEnemy(e, damage, by);
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
      this.splash(target.x, target.y, s.splash * stats.area, s.damage * stats.damageMult, p);
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
      this.damageEnemy(e, damage, p);
      this.knockback(e, p.x, p.y, s.knockback);
    }
    for (const c of this.pickups) {
      if (c.kind === PickupKind.Crate && this.inSwing(p, c.x, c.y, CRATE_RADIUS, s.range, s.arc)) this.damageCrate(c, damage);
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
      this.damageEnemy(e, damage, p);
      this.knockback(e, p.x, p.y, s.knockback);
      if (s.stun) this.stun(e, s.stun);
    }
    for (const c of this.pickups) {
      if (c.kind === PickupKind.Crate && dist2(c.x, c.y, p.x, p.y) < (s.radius + CRATE_RADIUS) ** 2) this.damageCrate(c, damage);
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
        this.damageEnemy(e, s.damage * stats.damageMult, p);
      }
    }
  }

  private knockback(e: Enemy, fromX: number, fromY: number, amount: number): void {
    if (ENEMY_TYPES[e.type].radius >= 50) return; // Bosses don't budge.
    const dx = e.x - fromX;
    const dy = e.y - fromY;
    const d = Math.hypot(dx, dy);
    if (d === 0) return;
    this.moveEnemy(e, (dx / d) * amount, (dy / d) * amount);
  }

  /** Damage from a player rolls for a crit and feeds their lifesteal and damage stats. */
  private damageEnemy(e: Enemy, amount: number, by: Player | undefined): void {
    if (e.dead) return;
    if (by) {
      const stats = this.stats(by);
      const crit = stats.critChance > 0 && Math.random() < stats.critChance;
      if (crit) amount *= CRIT_MULTIPLIER;
      // Add to this enemy's damage number for the tick.
      const hit = by.hits.get(e.id);
      if (hit) {
        hit.amount += amount;
        hit.crit ||= crit;
        hit.x = e.x;
        hit.y = e.y;
      } else {
        by.hits.set(e.id, { x: e.x, y: e.y, amount, crit });
      }
      const dealt = Math.min(amount, e.hp);
      by.damageDealt += dealt;
      if (stats.lifesteal > 0 && !by.downed) by.hp = Math.min(stats.maxHp, by.hp + dealt * stats.lifesteal);
    }
    e.hp -= amount;
    e.flashUntil = this.time + 0.1;
    if (e.hp > 0) return;
    e.dead = true;
    if (e.hazard) e.hazard.dead = true;
    if (by) by.kills++;
    if (e === this.finalBoss) this.victory();
    else if (this.quest?.kind === 'hunt' && e.id === this.quest.targetId) this.completeQuest(e.x, e.y);
    else if (ENEMY_TYPES[e.type].xp > 0) this.dropGem(e.x, e.y, ENEMY_TYPES[e.type].xp);
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
        this.damageEnemy(e, pr.damage, owner);
        if (pr.explosion) {
          this.splash(e.x, e.y, pr.explosion.radius, pr.explosion.damage, owner, e);
          this.fx.push({ k: 'ring', x: Math.round(e.x), y: Math.round(e.y), r: pr.explosion.radius, c: 0xb3e5fc, snd: 'pop' });
        }
        if (pr.pierce-- <= 0) {
          pr.dead = true;
          break;
        }
      }
      if (pr.dead) continue;
      for (const c of this.pickups) {
        if (c.kind !== PickupKind.Crate || c.dead || pr.hit.has(c.id)) continue;
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
      case 'shuriken': {
        const s = shurikenStats(level);
        // Multishot fans out extra shurikens.
        const count = 1 + stats.projectiles;
        for (let i = 0; i < count; i++) {
          const angle = p.aim + (i - (count - 1) / 2) * 0.3;
          this.projectiles.push({
            id: this.nextId++,
            kind: ProjectileKind.Shuriken,
            owner: p.id,
            x: p.x,
            y: p.y,
            vx: Math.cos(angle) * s.speed,
            vy: Math.sin(angle) * s.speed,
            damage: s.damage * stats.damageMult,
            pierce: Infinity,
            life: 5,
            hit: new Set(),
            explosion: null,
            radius: s.radius * stats.area,
            phasing: true,
            boomerang: { range: s.range, traveled: 0, returning: false },
            homing: false,
            target: null,
            dead: false,
          });
        }
        p.sounds.push('shuriken');
        return s.cooldown;
      }
      case 'meteor': {
        const s = meteorStats(level);
        const d = Math.min(reach, s.maxRange);
        const x = clamp(p.x + dirX * d, 0, this.map.width);
        const y = clamp(p.y + dirY * d, 0, this.map.height);
        const r = s.radius * stats.area;
        this.blasts.push({ x, y, r, damage: s.damage * stats.damageMult, owner: p.id, t: s.delay });
        this.fx.push({ k: 'cast', x: Math.round(x), y: Math.round(y), r, c: 0xff9100, t: s.delay });
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
          this.damageEnemy(e, damage, p);
          this.knockback(e, p.x, p.y, s.knockback);
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
          this.damageEnemy(e, damage, p);
          e.tauntBy = p.id;
          e.tauntUntil = this.time + s.taunt;
        }
        // Stack with a guard that's already running (e.g. from Rally) by keeping the stronger reduction.
        p.guardReduction = Math.max(p.guard > 0 ? p.guardReduction : 0, s.reduction);
        p.guard = Math.max(p.guard, s.duration);
        this.fx.push({ k: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: s.radius, c: AURA.guard });
        p.sounds.push('warcry');
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
      case 'lotus':
        p.lotus = LOTUS.duration * stats.duration;
        p.lotusTimer = 0;
        break;
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

  /** Death Lotus: rings of knives every LOTUS.interval while it lasts, getting stronger with the team level. */
  private deathLotus(p: Player, dt: number): void {
    p.lotusTimer -= dt;
    if (p.lotusTimer > 0) return;
    p.lotusTimer = LOTUS.interval;
    const stats = this.stats(p);
    const knives = { damage: 10 + 1.5 * this.level, count: 1, pierce: 1, speed: 600, range: 420, spread: 0 };
    const count = LOTUS.knives + 2 * stats.projectiles;
    const offset = p.lotus * 3; // Rotates the ring each throw.
    for (let i = 0; i < count; i++) this.shoot(p, ProjectileKind.Knife, offset + (i / count) * Math.PI * 2, knives, stats);
    p.sounds.push('knives');
  }

  private updateBlasts(dt: number): void {
    for (const b of this.blasts) {
      b.t -= dt;
      if (b.t > 0) continue;
      this.splash(b.x, b.y, b.r, b.damage, this.players.get(b.owner));
      this.hitCratesAround(b.x, b.y, b.r, b.damage);
      this.fx.push({ k: 'ring', x: Math.round(b.x), y: Math.round(b.y), r: b.r, c: 0xff9100, snd: 'explode' });
    }
    this.blasts = this.blasts.filter((b) => b.t > 0);
  }

  private hitCratesAround(x: number, y: number, r: number, damage: number): void {
    for (const c of this.pickups) {
      if (c.kind === PickupKind.Crate && dist2(c.x, c.y, x, y) < (r + CRATE_RADIUS) ** 2) this.damageCrate(c, damage);
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
    this.pickups.push({ id: this.nextId++, kind: PickupKind.Crate, x, y, hp: CRATE_HP, flashUntil: 0, dead: false });
  }

  private damageCrate(c: Pickup, amount: number): void {
    if (c.dead) return;
    c.hp -= amount;
    c.flashUntil = this.time + 0.1;
    if (c.hp <= 0) {
      c.dead = true;
      this.pickups.push({ id: this.nextId++, kind: PickupKind.Heart, x: c.x, y: c.y, hp: 0, flashUntil: 0, dead: false });
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
      damageDealt: Math.round(p.damageDealt),
      damageTaken: Math.round(p.damageTaken),
      choosing: p.options !== null,
      invuln: p.invuln > 0,
      hurt: p.hurtUntil > this.time,
      inArena: p.inArena,
      aura: p.lotus > 0 ? AURA.lotus : p.rage > 0 ? AURA.rage : p.guard > 0 ? AURA.guard : 0,
    }));
    const enemies: number[] = [];
    for (const e of this.enemies) {
      const flags =
        (e.flashUntil > this.time ? EnemyFlag.Hit : 0) |
        (e.mode === Mode.Windup ? EnemyFlag.WindingUp : 0) |
        (this.isStunned(e) ? EnemyFlag.Stunned : 0);
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
    const arena = this.map.arena;
    const boss = this.finalBoss && !this.finalBoss.dead ? this.finalBoss : null;

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
      boss: boss && {
        name: bossDisplayName(boss.type),
        hp: Math.ceil(boss.hp),
        maxHp: Math.ceil(boss.maxHp),
        enraged: this.enraged,
      },
      pause: this.pause && { ...this.pause, timeLeft: round1(this.pause.timeLeft) },
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
      ultimate: { cd: round1(p.ultCd), cooldown: hero.ultimate.cooldown, active: round1(Math.max(p.lotus, p.rage)) },
      hits: this.takeHits(p),
      taken: p.taken.splice(0),
      sounds: [...new Set(p.sounds.splice(0))], // One of each per snapshot is plenty.
      epoch: p.epoch,
    };
  }

  /** This tick's damage numbers as [x, y, amount, crit, ...], biggest first, skipping tiny ticks. */
  private takeHits(p: Player): number[] {
    const hits = [...p.hits.values()].filter((h) => h.amount >= 1).sort((a, b) => b.amount - a.amount);
    p.hits.clear();
    const out: number[] = [];
    for (const h of hits.slice(0, MAX_DAMAGE_NUMBERS)) out.push(Math.round(h.x), Math.round(h.y), Math.round(h.amount), h.crit ? 1 : 0);
    return out;
  }

  /** Base cooldown of the player's E ability at its current level (for the HUD). */
  private abilityCooldown(p: Player): number {
    const id = CHARACTERS[p.character].ability;
    const level = Math.max(1, p.upgrades[id] ?? 1);
    switch (id) {
      case 'shuriken':
        return shurikenStats(level).cooldown;
      case 'meteor':
        return meteorStats(level).cooldown;
      case 'leap':
        return leapStats(level).cooldown;
      case 'warcry':
        return warcryStats(level).cooldown;
    }
  }
}
