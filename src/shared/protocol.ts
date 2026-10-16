// Messages sent over the WebSocket, as JSON.

import type { CharacterId } from './characters';
import type { MissionKind } from './enemies';
import type { EventKind, QuestKind } from './objectives';
import type { ModeId } from './modes';
import type { PrestigeId, PrestigeRanks } from './prestige';
import type { ChoiceId, UpgradeId, Upgrades } from './upgrades';

export type Phase = 'lobby' | 'playing' | 'gameover';

export type ClientMessage =
  // --- Outside a room (the main menu) ---
  /** First thing after connecting (and after a name change): who you are. Answered with your profile. */
  | { t: 'hello'; name: string }
  /** Start a new room in a mode and join it. */
  | { t: 'create'; mode: ModeId; character: CharacterId }
  /** Join a room by its code. */
  | { t: 'join'; code: string; character: CharacterId }
  /** Leave the room you're in, back to the menu. */
  | { t: 'leave' }
  /** The open multiplayer lobbies. */
  | { t: 'rooms' }
  /** Your profile (prestige, gold, heroes). */
  | { t: 'profile' }
  // --- In a room ---
  | { t: 'pick'; character: CharacterId }
  /** Choose the map (in the lobby). Must be unlocked. */
  | { t: 'map'; index: number }
  | { t: 'start' }
  /** Back to the lobby from the game-over screen, to change characters. */
  | { t: 'lobby' }
  /**
   * The client owns its own position (no cheating among friends); the server only sanity-checks it.
   * `aim` is the angle in radians from the player toward the cursor.
   */
  | { t: 'move'; x: number; y: number; aim: number; epoch: number }
  /** The client has started a dodge dash; the server grants the invulnerability and cooldown. */
  | { t: 'dodge' }
  /** Cast your ability (E) or ultimate (R). `dist` is how far away the cursor is, for targeted abilities. */
  | { t: 'cast'; slot: 'e' | 'r'; aim: number; dist: number }
  | { t: 'choose'; index: number }
  /** Buy the next rank of a prestige upgrade (between runs). */
  | { t: 'prestige'; id: PrestigeId }
  /** Refund all prestige ranks (between runs). */
  | { t: 'respec' }
  /** Unlock a hero with prestige points. */
  | { t: 'unlock'; character: CharacterId }
  /** Testing cheats, only for a player named "dev" (see DevAction). */
  | { t: 'dev'; action: DevAction }
  /** Pause the game for everyone. */
  | { t: 'pause' }
  /** In the lobby: toggle being ready to start. While paused: toggle being ready to carry on. */
  | { t: 'ready' }
  /** While paused: end the run for everyone (a defeat) and go back to the lobby. */
  | { t: 'giveup' }
  /** Say something in the chat. */
  | { t: 'chat'; text: string }
  /** Ping a spot on the map. */
  | { t: 'ping'; x: number; y: number }
  /** In the lobby: add a bot teammate, or remove one. */
  | { t: 'addbot' }
  | { t: 'removebot'; id: number };

/**
 * Cheats for testing: 'skip' jumps the clock a minute ahead (with the level-ups you'd have earned), 'level' and
 * 'forge' hand out a free pick, 'max' fills your slots and maxes everything, 'god' toggles god mode.
 */
export type DevAction = 'skip' | 'level' | 'forge' | 'max' | 'god';
export const DEV_NAME = 'dev';

export type ServerMessage =
  /** You're in a room now, as player `id`. */
  | { t: 'welcome'; id: number; room: RoomRef }
  /** You left your room. */
  | { t: 'left' }
  | { t: 'profile'; profile: ProfileState }
  | { t: 'rooms'; rooms: RoomInfo[] }
  | { t: 'error'; message: string }
  | Snapshot;

/** A room on the server: its code (to share with friends) and mode. */
export interface RoomRef {
  code: string;
  mode: ModeId;
}

/** An open lobby, for the multiplayer browser. */
export interface RoomInfo extends RoomRef {
  /** The first person in the room. */
  host: string;
  players: number;
  humans: number;
  maxHumans: number;
  phase: Phase;
  map: number;
}

/** Your progress between runs, for the profile page. */
/** One hero's history on a profile. */
export interface HeroRecord {
  /** Runs started with them. */
  runs: number;
  wins: number;
  kills: number;
  /** Most damage dealt in a single run. */
  bestDamage: number;
  /** Longest run, in seconds. */
  bestTime: number;
}

export interface ProfileState {
  name: string;
  points: number;
  ranks: PrestigeRanks;
  gold: number;
  /** Heroes you've bought (or all of them, for dev and testing setups). */
  heroes: CharacterId[];
  /** The hero you've started the most runs with (ties go to the latest), or null before your first run. */
  favorite: CharacterId | null;
  /** Runs started. */
  runs: number;
  /** Runs won, and enemies killed in all runs. */
  wins: number;
  kills: number;
  /** How each hero has done in your hands. */
  records: Partial<Record<CharacterId, HeroRecord>>;
  /** Bosses you've reached at least once, by name: their bestiary entries are unlocked. */
  bosses: string[];
}

export interface PlayerState {
  id: number;
  name: string;
  color: number;
  character: CharacterId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  downed: boolean;
  /** Revive progress from 0 to 1 while downed. */
  revive: number;
  kills: number;
  /** Still picking an upgrade during a level-up pause. */
  choosing: boolean;
  /** Invulnerable from a dodge. */
  invuln: boolean;
  /** Just took damage. */
  hurt: boolean;
  /** Locked inside the boss arena. */
  inArena: boolean;
  /** A bot teammate (played by the server). */
  bot: boolean;
  /** How charged their ultimate is, 0 (just used) to 1 (ready). */
  ult: number;
  /** Runs the lobby: picks the map, adds bots and starts the game. */
  host: boolean;
  /** In the lobby: ready to start. */
  ready: boolean;
  /** Hidden by Shadow Veil (drawn faintly). */
  veiled: boolean;
  /** Color of an active buff's glow (Bloodrage, guard, Death Lotus), or 0. */
  aura: number;
  /** Everything they've picked, for the scoreboard and for drawing their blades and aura. */
  upgrades: Upgrades;
  /** Permanent prestige ranks (they change their stats). */
  prestige: PrestigeRanks;
  damageDealt: number;
  /** Damage dealt split by type: physical, magic, true. */
  damageByType: [number, number, number];
  damageTaken: number;
}

/** Cooldowns in seconds: `cd` is what's left, `cooldown` the full length. */
export interface AbilityState {
  cd: number;
  cooldown: number;
}

/** Private state only sent to the player it belongs to. */
export interface MeState {
  /** Choices while a level-up waits on you: upgrades, or bonuses once there's nothing left to upgrade. */
  options: ChoiceId[] | null;
  upgrades: Upgrades;
  speed: number;
  dodgeCooldown: number;
  ability: AbilityState;
  /** `active` is how long the ultimate's effect still lasts. */
  ultimate: AbilityState & { active: number };
  /**
   * Damage numbers since the last snapshot: your hits as [x, y, amount, crit, type, ...] (type indexes DAMAGE_TYPES),
   * and damage you took (0 = evaded).
   */
  hits: number[];
  taken: number[];
  /** Your own actions since the last snapshot that make a sound (weapons firing, casts, pickups). */
  sounds: SoundId[];
  /** Bumped whenever the server moves the player (respawn, downed); the client then snaps to the server position. */
  epoch: number;
  /** Unspent prestige points. */
  prestigePoints: number;
  /** God mode (dev only): damage never takes you below 1 HP. */
  god: boolean;
  /** Gold, kept between runs (heroes are bought with it). */
  gold: number;
  /** Heroes this player has unlocked (beyond the starting four). */
  heroes: CharacterId[];
}

/**
 * The game is frozen while everyone picks an upgrade, then eases back in from slow motion.
 * `reason` is what earned the pick: a team level-up or a captured Forge.
 */
export type Pause =
  | { kind: 'choose'; timeLeft: number; reason: ChoiceReason }
  /** A player paused the game (`by` is their name); it resumes once every player in `ready` (ids) is ready. */
  | { kind: 'menu'; by: string; ready: number[] };
export type ChoiceReason = 'level' | 'forge';

/** A timed effect from an Altar. */
export interface ActiveEvent {
  kind: EventKind;
  timeLeft: number;
}

/** A quest from a Quest point. (x, y) is the rally point, or where the thief is. */
export interface ActiveQuest {
  kind: QuestKind;
  timeLeft: number;
  x: number;
  y: number;
}

/** Sounds the server asks your client to play for your own actions. */
export type SoundId =
  | 'bolt'
  | 'knives'
  | 'hex'
  | 'shuriken'
  | 'mine'
  | 'meteor'
  | 'leap'
  | 'warcry'
  | 'ult'
  | 'gem'
  | 'heal'
  | 'dagger'
  | 'fireball'
  | 'arrow'
  | 'bite'
  | 'veil'
  | 'nova'
  | 'summon'
  | 'rewind'
  | 'coin'
  | 'roar'
  | 'revive'
  | 'revived'
  | 'flask'
  | 'hammer'
  | 'smite'
  | 'holy';

export type Fx =
  /** An expanding ring: slams, explosions, captures. `snd` is the sound everyone nearby hears, if any. */
  | { k: 'ring'; x: number; y: number; r: number; c: number; snd?: 'slam' | 'explode' | 'pop' }
  | { k: 'slash'; x: number; y: number; r: number; a: number; arc: number; c: number }
  | { k: 'zap'; x: number; y: number }
  | { k: 'boom'; x: number; y: number; r: number }
  /** A final boss arrives at (x, y): clients pan the camera there and play its roar. */
  | { k: 'intro'; x: number; y: number }
  /** A friendly area that fills up over `t` seconds before it hits (Meteor). */
  | { k: 'cast'; x: number; y: number; r: number; c: number; t: number }
  /** Big announcement text (also goes in the event log). */
  | { k: 'banner'; text: string; tone: 'danger' | 'good' }
  /** A line in the event log only. */
  | { k: 'log'; text: string; tone: LogTone }
  /** A chat message. */
  | { k: 'chat'; name: string; color: number; text: string }
  /** Someone shift-clicked a spot: everyone sees and hears it. */
  | { k: 'ping'; x: number; y: number; color: number; name: string };

export type LogTone = 'danger' | 'good' | 'info';
/** Longest chat message. */
export const CHAT_MAX = 140;

export interface GameResult {
  victory: boolean;
  /** The named boss that was beaten (victories only). */
  boss: string | null;
  /** Name of a map this victory unlocked, if any. */
  unlockedMap: string | null;
  /** Prestige points every player earned this run. */
  prestige: number;
  /** Gold the team picked up this run (everyone gets all of it). */
  gold: number;
  time: number;
  level: number;
  players: { name: string; color: number; character: CharacterId; kills: number }[];
}

/**
 * The boss arena on maps that have one. 'gather': the boss is waiting and everyone must get inside
 * while a burning zone closes in on it: everything farther than `safeR` from the arena burns.
 * 'fight': players inside are locked in.
 */
export interface ArenaState {
  x: number;
  y: number;
  r: number;
  state: 'idle' | 'gather' | 'fight';
  /** Radius of the not-yet-burning area around the arena (0 while idle). */
  safeR: number;
  /** The gate is open: from when the boss is due until everyone is inside. */
  open: boolean;
}

/** Lava maps: everything farther than `r` from (x, y) is lava. `closing`: it's closing in for the boss. */
export interface LavaState {
  x: number;
  y: number;
  r: number;
  closing: boolean;
}

/** Health bar for a final boss. */
export interface BossBar {
  name: string;
  hp: number;
  maxHp: number;
  /** Below half health: attacks faster. */
  enraged: boolean;
  /** Its twin died first: stronger for the rest of the fight. */
  vengeful: boolean;
  /** What it's up to right now, for the bar: 'shelled', 'exposed', 'burrowed', 'kindred'. */
  tags: string[];
}

/** The final boss fight: the bosses' health, the berserk clock and the current side mission. */
export interface BossFight {
  bosses: BossBar[];
  /** Seconds until the bosses go berserk (0 once they have). */
  berserkIn: number;
  /** Berserk stacks so far. */
  berserk: number;
  /** While a side mission runs the bosses are shielded. */
  mission: { kind: MissionKind; done: number; total: number } | null;
  /** Health of what the team should kill (mission targets, eggs, carrion), as [id, share of max HP, ...]. */
  targets: number[];
}

export const PickupKind = { Crate: 0, Heart: 1, Coin: 2, Bomb: 3 } as const;
export const ProjectileKind = { Bolt: 0, Knife: 1, Shuriken: 2, Hex: 3, BigShuriken: 4, Fireball: 5, Arrow: 6 } as const;
/** Allies some heroes call in. */
export const SummonKind = { Wolf: 0, Treant: 1 } as const;
/** Things players leave on the ground. */
export const ZoneKind = { Venom: 0, Mine: 1, Fire: 2, Holy: 3, Toxic: 4 } as const;
/** Telegraphed danger zones: a bomb circle or a charger's path. */
/**
 * Telegraphed attacks, all [id, kind, x, y, a, b, c, progress] in the snapshot:
 * - Circle: a = radius. Line (a charge's path): a = angle, b = length, c = width.
 * - Cone: a = facing, b = length, c = half the angle in hundredths of a radian.
 * - Ring (a shockwave rolling out once `progress` reaches 1): a = current radius, b = width, c = how far it goes.
 * - Pool (lingering, hurts once armed): a = radius, b = 1 when armed.
 * - Share (stack up: its damage is split between everyone inside): a = radius.
 * - Mark (follows a player; spread out): a = radius, b = the player's id.
 * - Beam (the twins' tether): a = angle, b = length, c = width.
 * - Glacial (Rime's line-of-sight blast from (x, y)): hide behind a wall before `progress` reaches 1.
 */
export const HazardKind = { Circle: 0, Line: 1, Cone: 2, Ring: 3, Pool: 4, Share: 5, Mark: 6, Beam: 7, Glacial: 8 } as const;
/**
 * Bit flags in the enemy list. Hidden: burrowed (untargetable). Shelled: shrugging off damage. Exposed: taking extra
 * damage. Linked: a twin near its sibling, shrugging off damage. Marked: a side mission or mechanic wants it dead.
 */
export const EnemyFlag = { Hit: 1, WindingUp: 2, Stunned: 4, Shielded: 8, Marked: 16, Hidden: 32, Shelled: 64, Exposed: 128, Linked: 256 } as const;
/** Champions carry their affix (see Affix) in the flags, shifted up by this many bits. */
export const AFFIX_SHIFT = 9;

// Entity lists are flat number arrays to keep snapshots small:
// enemies:     [id, type, x, y, flags, ...]
// projectiles: [id, kind, x, y, ...]
// enemyShots:  [id, x, y, ...]
// gems:        [id, x, y, big, ...]
// pickups:     [id, kind, x, y, flash, ...]
// hazards:     [id, kind, x, y, a, b, c, progress, ...]  circle: a = radius; line: a = angle, b = length, c = width. progress 0..1
// shrines:     [id, kind, x, y, progress, ...]
// zones:       [id, kind, x, y, r, ...]  venom puddles, burning ground and mines
// summons:     [id, kind, x, y, ...]  wolves and treants
export const ENEMY_STRIDE = 5;
export const PROJECTILE_STRIDE = 4;
export const ENEMY_SHOT_STRIDE = 3;
export const GEM_STRIDE = 4;
export const PICKUP_STRIDE = 5;
export const HAZARD_STRIDE = 8;
export const SHRINE_STRIDE = 5;
export const ZONE_STRIDE = 5;
export const SUMMON_STRIDE = 4;

export interface Snapshot {
  t: 'snap';
  tick: number;
  /** The room this game runs in. */
  room: RoomRef | null;
  phase: Phase;
  /** Index into MAPS. */
  map: number;
  /** How many maps are unlocked (the first `unlocked` entries of MAPS). */
  unlocked: number;
  /** Seconds into the run when the named boss arrives. */
  bossTime: number;
  arena: ArenaState | null;
  lava: LavaState | null;
  bossFight: BossFight | null;
  pause: Pause | null;
  /** Game speed: below 1 while easing back in from a pause. */
  timeScale: number;
  time: number;
  /** XP and level are shared by the whole team. */
  level: number;
  xp: number;
  xpNext: number;
  players: PlayerState[];
  enemies: number[];
  projectiles: number[];
  enemyShots: number[];
  gems: number[];
  pickups: number[];
  hazards: number[];
  shrines: number[];
  zones: number[];
  summons: number[];
  event: ActiveEvent | null;
  quest: ActiveQuest | null;
  fx: Fx[];
  result: GameResult | null;
  me: MeState | null;
}
