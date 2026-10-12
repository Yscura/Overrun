// Messages sent over the WebSocket, as JSON.

import type { CharacterId } from './characters';
import type { UpgradeId, Upgrades } from './upgrades';

export type Phase = 'lobby' | 'playing' | 'gameover';

export type ClientMessage =
  | { t: 'join'; name: string; character: CharacterId }
  | { t: 'pick'; character: CharacterId }
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
  | { t: 'choose'; index: number };

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
  /** Spirit Blades level, so clients can draw the blades without extra data. */
  orbit: number;
  kills: number;
  /** Still picking an upgrade during a level-up pause. */
  choosing: boolean;
  /** Invulnerable from a dodge. */
  invuln: boolean;
  /** Just took damage. */
  hurt: boolean;
}

/** Private state only sent to the player it belongs to. */
export interface MeState {
  options: UpgradeId[] | null;
  upgrades: Upgrades;
  speed: number;
  dodgeCooldown: number;
  /** Bumped whenever the server moves the player (respawn, downed); the client then snaps to the server position. */
  epoch: number;
}

/** The game is frozen while everyone picks an upgrade, then counts down before resuming. */
export type Pause = { kind: 'choose'; timeLeft: number } | { kind: 'countdown'; timeLeft: number };

export type Fx =
  | { k: 'slam'; x: number; y: number; r: number; c: number }
  | { k: 'slash'; x: number; y: number; r: number; a: number; arc: number; c: number }
  | { k: 'zap'; x: number; y: number }
  | { k: 'boom'; x: number; y: number; r: number }
  | { k: 'boss' };

export interface GameResult {
  time: number;
  level: number;
  players: { name: string; color: number; character: CharacterId; kills: number }[];
}

export const PickupKind = { Crate: 0, Heart: 1 } as const;
export const ProjectileKind = { Bolt: 0, Knife: 1 } as const;
/** Telegraphed danger zones: a bomb circle or a charger's path. */
export const HazardKind = { Circle: 0, Line: 1 } as const;
/** Bit flags in the enemy list. */
export const EnemyFlag = { Hit: 1, WindingUp: 2 } as const;

// Entity lists are flat number arrays to keep snapshots small:
// enemies:     [id, type, x, y, flags, ...]
// projectiles: [id, kind, x, y, ...]
// enemyShots:  [id, x, y, ...]
// gems:        [id, x, y, big, ...]
// pickups:     [id, kind, x, y, flash, ...]
// hazards:     [id, kind, x, y, a, b, progress, ...]  circle: a = radius; line: a = angle, b = length. progress 0..1
export const ENEMY_STRIDE = 5;
export const PROJECTILE_STRIDE = 4;
export const ENEMY_SHOT_STRIDE = 3;
export const GEM_STRIDE = 4;
export const PICKUP_STRIDE = 5;
export const HAZARD_STRIDE = 7;

export interface Snapshot {
  t: 'snap';
  tick: number;
  phase: Phase;
  pause: Pause | null;
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
  fx: Fx[];
  result: GameResult | null;
  me: MeState | null;
}
