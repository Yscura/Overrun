// Player versus player: two or three teams of up to four heroes fight across a map of lanes, jungle camps and towers,
// each defending its crystal. The last crystal standing wins.
//
// PvP is kept apart from the campaign: no prestige ranks or artifacts come into it, and no prestige, gold or artifacts
// come out of it. It's balanced on its own, in PVP below (the campaign's balance stays where it is: weapons in
// upgrades.ts, heroes in characters.ts, the horde in enemies.ts). Each number here only changes PvP.

import type { CharacterId } from './characters';
import { EnemyType } from './enemies';

export interface PvpTeam {
  name: string;
  color: number;
}

/** The teams, in order. A two-team map uses the first two. */
export const PVP_TEAMS: PvpTeam[] = [
  { name: 'Azure', color: 0x42a5f5 },
  { name: 'Crimson', color: 0xef5350 },
  { name: 'Verdant', color: 0x66bb6a },
];
/** Heroes per team at most. */
export const PVP_TEAM_SIZE = 4;
/** Everyone in the biggest PvP game. */
export const MAX_PVP_PLAYERS = PVP_TEAM_SIZE * PVP_TEAMS.length;

/** What a PvP unit is: lane minions, defenses, jungle monsters, and the stand-in each hero is hit through. */
export type UnitKind = 'minion' | 'archer' | 'tower' | 'crystal' | 'camp' | 'guardian' | 'hero';

export interface PvpPoint {
  x: number;
  y: number;
}

/** Where everything is on a PvP map (see pvpLayout). */
export interface PvpLayout {
  teams: number;
  /** Each team's crystal: its base, where its heroes spawn and heal (the fountain). */
  bases: PvpPoint[];
  /** Lanes between two bases (its points from `from`'s base to `to`'s): minion waves walk them both ways. */
  lanes: { from: number; to: number; points: PvpPoint[] }[];
  /** Jungle camps of neutral monsters, and the Guardian in the middle. */
  camps: (PvpPoint & { kind: CampKind })[];
  /** Each team's towers: two on each of its lanes, an outer one and an inner one nearer its base. */
  towers: (PvpPoint & { team: number; lane: number; tier: 'outer' | 'inner' })[];
}

export type CampKind = 'small' | 'big' | 'guardian';

/**
 * The PvP balance sheet. Times in seconds, distances in pixels, damage in HP. "Per minute" values grow with the
 * game's clock, so the lanes and defenses keep up with heroes who level up.
 */
export const PVP = {
  /** Heroes' max HP, times this (on top of PVP.heroes). */
  heroHp: 1.6,
  /**
   * Hero damage against other heroes, as a share of what it would deal to a monster: `base` at level 1, shrinking as
   * the attacker's team levels up (base / (1 + falloff * (level - 1))), since builds grow much faster than health.
   */
  heroDamage: { base: 0.35, falloff: 0.1 },
  /** Respawning: `base` seconds plus `perLevel` for each team level, at most `max`; untouchable for `shield` after. */
  respawn: { base: 5, perLevel: 1, max: 25, shield: 2.5 },
  /** Standing near your own crystal heals this share of max HP per second. */
  fountain: { radius: 420, heal: 0.15 },
  /** Slaying a hero: XP to the killer's team (`xp` plus `perLevel` for each of the victim's team levels). Anyone who hit the victim in the last `assistWindow` seconds gets an assist. */
  kill: { xp: 30, perLevel: 6, assistWindow: 10 },
  /**
   * XP each team needs for its next level (first + perLevel * (level - 1)), and the XP every team gets each second. A
   * team behind the leader gets `catchUp` (a share) more XP for each level it trails by.
   */
  xp: { first: 40, perLevel: 22, trickle: 1.5, catchUp: 0.12 },
  /**
   * Minion waves: the first one `first` seconds in, then every `every`; per lane, `melee` and `ranged` minions, and one
   * more melee minion every `growEvery` minutes.
   */
  waves: { first: 8, every: 30, melee: 3, ranged: 1, spacing: 45, growEvery: 6 },
  /** So games end: from `after` minutes in, towers and crystals take `perMinute` (a share) more damage each minute. */
  escalation: { after: 10, perMinute: 0.2 },
  /** Lane minions. `range` is how far they hit from; `aggro` how far they notice a foe from. XP to whoever's team kills them. */
  minion: { hp: 110, perMinute: 14, damage: 12, damagePerMinute: 1.2, cooldown: 1, range: 22, aggro: 300, speed: 92, xp: 8 },
  archer: { hp: 70, perMinute: 9, damage: 14, damagePerMinute: 1.4, cooldown: 1.5, range: 280, aggro: 340, speed: 92, xp: 8 },
  /**
   * Towers: two on each lane a team holds, `outer` and `inner` along it from the base (`outer` at most `outerShare` of
   * the lane's length). An inner tower is shielded until the outer one on its lane falls. They shoot `unitDamage` at
   * minions and monsters, and `heroShare` of a hero's max HP (plus `heroFlat`) at heroes. Heroes deal `heroTaken` of
   * their damage to them, and only `unescorted` of that without some of their own minions within `escort` of the tower
   * (so the lanes have to be pushed). XP to the team that brings one down.
   */
  tower: {
    outer: 1350,
    outerShare: 0.38,
    inner: 680,
    hp: 4000,
    range: 500,
    cooldown: 1.1,
    unitDamage: 70,
    heroShare: 0.14,
    heroFlat: 12,
    heroTaken: 0.4,
    escort: 700,
    unescorted: 0.25,
    xp: 150,
  },
  /**
   * The crystal: shielded until one of its team's inner towers has fallen. It shoots back, a little weaker than a tower,
   * and takes hero damage like one (`heroTaken`, needing an escort of minions too).
   */
  crystal: { hp: 8000, range: 430, cooldown: 1.3, unitDamage: 50, heroShare: 0.1, heroFlat: 8, heroTaken: 0.4 },
  /**
   * Jungle camps. Each kind: which monsters, their health and damage, and the XP for the team that clears each. They
   * fight whoever attacks them, chasing no further than `leash` from home (then they go back and heal), and come back
   * `respawn` seconds after the camp is cleared. Health grows `growth` (a share) per minute.
   */
  camps: {
    small: { types: [EnemyType.Grunt, EnemyType.Grunt, EnemyType.Spitter], hp: 170, damage: 11, xp: 14 },
    big: { types: [EnemyType.Brute, EnemyType.Charger], hp: 460, damage: 19, xp: 32 },
    guardian: { types: [EnemyType.Guardian], hp: 5000, damage: 38, xp: 180 },
    growth: 0.06,
    leash: 480,
    respawn: 60,
    guardianRespawn: 180,
    range: 30,
    rangedRange: 260,
    cooldown: 1.2,
    speed: 100,
  },
  /** Slaying the Guardian: the whole team deals `damage` more (a share) for `duration` seconds. */
  guardianBuff: { damage: 0.2, duration: 120 },
  /** Per weapon or hero ability (by its id): multiplies its damage against heroes (1 if it isn't listed). */
  weapons: {
    // Lingering areas tick very often: a bit less against heroes, who have to walk out of them first.
    field: 0.8,
    venom: 0.8,
    mines: 0.85,
    storm: 0.9,
  } as Partial<Record<string, number>>,
  /** Per hero: multipliers on their max HP, and on all the damage they deal to heroes (1 if not listed). */
  heroes: {} as Partial<Record<CharacterId, { hp?: number; damage?: number }>>,
};

/** XP a team needs to go from `level` to the next. */
export function pvpXpNext(level: number): number {
  return PVP.xp.first + PVP.xp.perLevel * (level - 1);
}

/** Seconds a hero of a team at `level` waits to respawn. */
export function pvpRespawn(level: number): number {
  return Math.min(PVP.respawn.max, PVP.respawn.base + PVP.respawn.perLevel * level);
}

/** Share of hero damage that lands on another hero, for an attacker whose team is at `level`. */
export function pvpHeroDamage(level: number): number {
  return PVP.heroDamage.base / (1 + PVP.heroDamage.falloff * (level - 1));
}

/** The point `distance` along a path of points (or its end). */
export function pointAlong(points: PvpPoint[], distance: number): PvpPoint {
  let left = distance;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= seg) return { x: a.x + ((b.x - a.x) * left) / seg, y: a.y + ((b.y - a.y) * left) / seg };
    left -= seg;
  }
  return points[points.length - 1];
}

/** How far a point is from a path of points. */
export function distanceToPath(points: PvpPoint[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
  }
  return best;
}

/**
 * Where everything goes on a PvP map of `teams` teams, `width` by `height`. Two teams: bases left and right, a top and
 * a bottom lane, camps in the jungle between, the Guardian in the middle. Three teams: bases at the corners of a
 * triangle, a lane along each side, camps inside it toward the Guardian in the middle. Every base has two lanes, and
 * a tower on each.
 */
export function pvpLayout(teams: 2 | 3, width: number, height: number): PvpLayout {
  const cx = width / 2;
  const cy = height / 2;
  let bases: PvpPoint[];
  let lanes: PvpLayout['lanes'];
  let camps: PvpLayout['camps'];
  if (teams === 2) {
    const edge = 520;
    const bend = 560;
    bases = [
      { x: edge, y: cy },
      { x: width - edge, y: cy },
    ];
    const lane = (y: number) => ({ from: 0, to: 1, points: [bases[0], { x: edge + 700, y }, { x: width - edge - 700, y }, bases[1]] });
    lanes = [lane(bend), lane(height - bend)];
    camps = [
      { x: cx - 1050, y: cy - 520, kind: 'small' },
      { x: cx - 1050, y: cy + 520, kind: 'big' },
      { x: cx + 1050, y: cy - 520, kind: 'big' },
      { x: cx + 1050, y: cy + 520, kind: 'small' },
      { x: cx, y: cy, kind: 'guardian' },
    ];
  } else {
    const r = Math.min(width, height) / 2 - 500;
    bases = [-90, 30, 150].map((deg) => ({ x: cx + Math.cos((deg * Math.PI) / 180) * r, y: cy + Math.sin((deg * Math.PI) / 180) * r }));
    lanes = [
      [0, 1],
      [1, 2],
      [2, 0],
    ].map(([from, to]) => {
      // Bowed out a little from the middle.
      const mx = (bases[from].x + bases[to].x) / 2;
      const my = (bases[from].y + bases[to].y) / 2;
      const bow = { x: cx + (mx - cx) * 1.25, y: cy + (my - cy) * 1.25 };
      return { from, to, points: [bases[from], bow, bases[to]] };
    });
    camps = lanes.flatMap((l, i) => {
      const mid = l.points[1];
      const toward = (k: number) => ({ x: cx + (mid.x - cx) * k, y: cy + (mid.y - cy) * k });
      return [
        { ...toward(0.45), kind: (i % 2 ? 'small' : 'big') as CampKind },
      ];
    });
    // Camps between each base and the middle, too.
    for (const [i, b] of bases.entries()) camps.push({ x: cx + (b.x - cx) * 0.52, y: cy + (b.y - cy) * 0.52, kind: i % 2 ? 'big' : 'small' });
    camps.push({ x: cx, y: cy, kind: 'guardian' });
  }
  const towers: PvpLayout['towers'] = [];
  lanes.forEach((l, i) => {
    let length = 0;
    for (let k = 1; k < l.points.length; k++) length += Math.hypot(l.points[k].x - l.points[k - 1].x, l.points[k].y - l.points[k - 1].y);
    const outer = Math.min(PVP.tower.outer, length * PVP.tower.outerShare);
    for (const [team, route] of [
      [l.from, l.points],
      [l.to, [...l.points].reverse()],
    ] as const) {
      towers.push({ team, lane: i, tier: 'outer', ...pointAlong(route, outer) });
      towers.push({ team, lane: i, tier: 'inner', ...pointAlong(route, PVP.tower.inner) });
    }
  });
  return { teams, bases, lanes, camps, towers };
}
