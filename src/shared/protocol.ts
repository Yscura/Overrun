// Messages sent over the WebSocket, as JSON.

import type { CharacterId } from './characters';
import type { MissionKind } from './enemies';
import type { EventKind, QuestKind } from './objectives';
import type { PrestigeId, PrestigeRanks } from './prestige';
import type { UpgradeId, Upgrades } from './upgrades';

export type Phase = 'lobby' | 'playing' | 'gameover';

export type ClientMessage =
  | { t: 'join'; name: string; character: CharacterId }
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
  | { t: 'dev'; action: DevAction };

/**
 * God-mode cheats for testing: 'skip' jumps the clock a minute ahead (with the level-ups you'd have earned),
 * 'level' and 'forge' hand out a free pick, 'max' fills your slots and maxes everything.
 */
export type DevAction = 'skip' | 'level' | 'forge' | 'max';
export const DEV_NAME = 'dev';

export type ServerMessage = { t: 'welcome'; id: number } | { t: 'full' } | Snapshot;

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
  /** Hidden by Shadow Veil (drawn faintly). */
  veiled: boolean;
  /** Color of an active buff's glow (Bloodrage, guard, Death Lotus), or 0. */
  aura: number;
  /** Everything they've picked, for the scoreboard and for drawing their blades and aura. */
  upgrades: Upgrades;
  /** Permanent prestige ranks (they change their stats). */
  prestige: PrestigeRanks;
  damageDealt: number;
  damageTaken: number;
}

/** Cooldowns in seconds: `cd` is what's left, `cooldown` the full length. */
export interface AbilityState {
  cd: number;
  cooldown: number;
}

/** Private state only sent to the player it belongs to. */
export interface MeState {
  options: UpgradeId[] | null;
  upgrades: Upgrades;
  speed: number;
  dodgeCooldown: number;
  ability: AbilityState;
  /** `active` is how long the ultimate's effect still lasts. */
  ultimate: AbilityState & { active: number };
  /** Damage numbers since the last snapshot: your hits as [x, y, amount, crit, ...], and damage you took (0 = evaded). */
  hits: number[];
  taken: number[];
  /** Your own actions since the last snapshot that make a sound (weapons firing, casts, pickups). */
  sounds: SoundId[];
  /** Bumped whenever the server moves the player (respawn, downed); the client then snaps to the server position. */
  epoch: number;
  /** Unspent prestige points. */
  prestigePoints: number;
  /** Heroes this player has unlocked (beyond the starting four). */
  heroes: CharacterId[];
}

/**
 * The game is frozen while everyone picks an upgrade, then eases back in from slow motion.
 * `reason` is what earned the pick: a team level-up or a captured Forge.
 */
export type Pause = { kind: 'choose'; timeLeft: number; reason: ChoiceReason };
export type ChoiceReason = 'level' | 'forge';

/** A timed effect from an Altar. */
export interface ActiveEvent {
  kind: EventKind;
  timeLeft: number;
}

/** A quest from a Beacon. (x, y) is the rally point, or where the thief is. */
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
  | 'rewind';

export type Fx =
  /** An expanding ring: slams, explosions, captures. `snd` is the sound everyone nearby hears, if any. */
  | { k: 'ring'; x: number; y: number; r: number; c: number; snd?: 'slam' | 'explode' | 'pop' }
  | { k: 'slash'; x: number; y: number; r: number; a: number; arc: number; c: number }
  | { k: 'zap'; x: number; y: number }
  | { k: 'boom'; x: number; y: number; r: number }
  /** A friendly area that fills up over `t` seconds before it hits (Meteor). */
  | { k: 'cast'; x: number; y: number; r: number; c: number; t: number }
  /** Big announcement text. */
  | { k: 'banner'; text: string; tone: 'danger' | 'good' };

export interface GameResult {
  victory: boolean;
  /** The named boss that was beaten (victories only). */
  boss: string | null;
  /** Name of a map this victory unlocked, if any. */
  unlockedMap: string | null;
  /** Prestige points every player earned this run. */
  prestige: number;
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
}

export const PickupKind = { Crate: 0, Heart: 1 } as const;
export const ProjectileKind = { Bolt: 0, Knife: 1, Shuriken: 2, Hex: 3, BigShuriken: 4, Fireball: 5, Arrow: 6 } as const;
/** Allies some heroes call in. */
export const SummonKind = { Wolf: 0, Treant: 1 } as const;
/** Things players leave on the ground. */
export const ZoneKind = { Venom: 0, Mine: 1, Fire: 2 } as const;
/** Telegraphed danger zones: a bomb circle or a charger's path. */
export const HazardKind = { Circle: 0, Line: 1 } as const;
/** Bit flags in the enemy list. */
export const EnemyFlag = { Hit: 1, WindingUp: 2, Stunned: 4, Shielded: 8, Marked: 16 } as const;
/** Champions carry their affix (see Affix) in the flags, shifted up by this many bits. */
export const AFFIX_SHIFT = 5;

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
  phase: Phase;
  /** Index into MAPS. */
  map: number;
  /** How many maps are unlocked (the first `unlocked` entries of MAPS). */
  unlocked: number;
  /** Seconds into the run when the named boss arrives. */
  bossTime: number;
  arena: ArenaState | null;
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
