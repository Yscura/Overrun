// Game-wide tuning values shared by client and server.

export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;

export const MAX_PLAYERS = 4;
export const PLAYER_RADIUS = 16;
export const PICKUP_BASE_RADIUS = 90;

// Dodge (spacebar): a quick dash in your movement direction (toward the cursor when still) with a moment of invulnerability.
export const DODGE_DISTANCE = 170;
export const DODGE_DURATION = 0.18;
export const DODGE_SPEED = DODGE_DISTANCE / DODGE_DURATION;
export const DODGE_IFRAMES = 0.35;
export const PLAYER_COLORS = [0x4fc3f7, 0x81c784, 0xffb74d, 0xf06292];

/** Stand this close to a downed teammate for REVIVE_TIME seconds to bring them back. */
export const REVIVE_RADIUS = 120;
export const REVIVE_TIME = 3;

export const PROJECTILE_RADIUS = 6;
export const ENEMY_SHOT_RADIUS = 7;

export const MAX_ENEMIES = 450;
export const MAX_GEMS = 400;
/** Enemies spawn roughly this far from a player, i.e. just off screen. */
export const SPAWN_DISTANCE = 1000;
/** A boss shows up every this many seconds. */
export const BOSS_INTERVAL = 200;

/** Seconds everyone gets to pick an upgrade before one is picked for them. */
export const CHOOSE_TIME = 15;
/** Once everyone has picked, the game resumes at `start` speed and eases up to full speed over `duration` seconds. */
export const SLOWMO = { start: 0.15, duration: 1.2 };
/**
 * A final boss's entrance: the game drops to `speed`, holds there for `hold` seconds while the camera shows the
 * boss, then eases back to full speed over `ease` seconds as the camera returns. All in real seconds.
 */
/**
 * A final boss's death: the camera holds on the corpse while it shakes; it breaks apart at `shatter` seconds, and the
 * victory (or what comes next) follows at `total`.
 */
export const BOSS_DEATH = { shatter: 2.6, total: 4.2 };
/**
 * Hard mode (every map again, unlocked by slaying Mordak): enemies are `difficulty` times tougher (like the map's own
 * difficulty: more health, and harder hits) and hit `damage` times harder on top. The horde is `speed` times faster.
 * Bosses attack `haste` times as often, with `area` times bigger attacks, use their hard rotations (NamedBossDef.hard)
 * and every `comboEvery`th attack follows right on the last one (`comboGap` seconds later). The rewards: `prestige`
 * times the prestige, and artifacts drop from hard mode's own steps of the loot ladder (LOOT in artifacts.ts).
 */
export const HARD = { difficulty: 2, damage: 1.1, speed: 1, haste: 1.25, area: 1.1, comboEvery: 4, comboGap: 0.7, prestige: 1.6 };

/**
 * Endless mode: no final victory, the run goes on until the team falls. The map's boss comes back in waves: the first
 * at `firstWave` of the usual boss time, then every `waveEvery` seconds after the last one falls, tougher each time
 * (see endlessWave). Past the usual boss time the horde keeps growing (see Game.horde). A Forge comes every
 * `forgeEvery` seconds once the usual ones are done, and an Armory every `armoryEvery` seconds.
 */
export const ENDLESS = { firstWave: 0.6, waveEvery: 360, forgeEvery: 150, armoryEvery: 240 };

/** How much tougher endless mode's `wave`th boss wave is (1 = the first): its health, and how hard it hits. */
export function endlessWave(wave: number): { hp: number; damage: number } {
  const n = Math.max(0, wave - 1);
  return { hp: 0.5 + 0.5 * n + 0.12 * n * n, damage: 0.8 + 0.15 * n };
}

/** The Armory (trade a weapon for a new one, same level) first appears this far into the usual boss time. */
export const ARMORY_AT = 0.35;

export const BOSS_INTRO = { speed: 0.12, hold: 2.3, ease: 1, panIn: 0.5, panOut: 0.6 };
/**
 * Mordak's entrance is longer: everything stops dead (`speed` 0) while the camera creeps over to him and the reveal
 * swells, then he roars (`roarAt` seconds in, as the swell peaks) and the fight starts as the roar dies down.
 */
export const DRAGON_INTRO = { speed: 0, hold: 5, ease: 0.8, panIn: 1.2, panOut: 0.7, roarAt: 2.2 };

// Health crates: shoot one to break it, then walk over the heart it drops.
export const CRATE_RADIUS = 16;
export const CRATE_HP = 10;
/** A new crate appears near the team every this many seconds. */
export const CRATE_INTERVAL = 10;
export const MAX_CRATES = 9;
/** What a broken crate holds: the chances of a heart, a pile of gold or a bomb. */
export const CRATE_LOOT = { heart: 0.45, gold: 0.4, bomb: 0.15 };
/** Gold coins: a pile has `min`-`max` coins worth `value` each. They fly to you within your pickup radius. */
export const COIN = { min: 5, max: 9, value: 3, radius: 7, speed: 520 };
/**
 * A bomb on the ground goes off when anything hits it, hurting enemies within `blast` (not players).
 * Damage is `damage` times how tough the horde is at the moment, so it stays useful all run.
 */
export const BOMB = { radius: 20, blast: 170, damage: 30 };
export const HEART_RADIUS = 12;
/** Artifacts lying on the ground: touch one to pick it up. */
export const ARTIFACT_RADIUS = 16;
/** Fraction of max HP a heart restores. */
export const HEART_HEAL = 0.2;
