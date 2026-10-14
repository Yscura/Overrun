// A bot that plays Overrun the way a person would, for balance testing.
//
// It only sees what a real client sees (the snapshots) and only does what a real client can do (move, dodge,
// cast, pick upgrades). It keeps its own predicted position with the same wall collision as the browser
// client. Plays decently, not perfectly: it kites, dodges telegraphs, uses its E and R, grabs upgrade points,
// hearts and revives, and does the boss side missions.

import { CHARACTERS, heroDamageType, ownedPassives, ownedWeapons, type CharacterId } from '../shared/characters';
import { WallIndex, moveCircle, overlapsWall, type PassFlags } from '../shared/collision';
import { DODGE_DURATION, DODGE_SPEED, PLAYER_RADIUS, REVIVE_RADIUS, TICK_DT } from '../shared/constants';
import { ENEMY_TYPES } from '../shared/enemies';
import { MAPS } from '../shared/maps';
import { ShrineKind } from '../shared/objectives';
import {
  ENEMY_SHOT_Swiftness,
  ENEMY_Swiftness,
  EnemyFlag,
  GEM_Swiftness,
  HAZARD_Swiftness,
  HazardKind,
  PICKUP_Swiftness,
  PickupKind,
  SHRINE_Swiftness,
  type ClientMessage,
  type PlayerState,
  type Snapshot,
} from '../shared/protocol';
import { EVOLVED_LEVEL, PASSIVE_SLOTS, UPGRADES, WEAPON_SLOTS, damageType, isBonus, type ChoiceId, type UpgradeId, type Upgrades, type WeaponId } from '../shared/upgrades';
import { FlowField } from './navigation';

interface Point {
  x: number;
  y: number;
}

interface EnemyView extends Point {
  type: number;
  radius: number;
  boss: boolean;
  marked: boolean;
  d: number;
}

/** How much the bot wants each passive (higher is better). */
const PASSIVE_PRIORITY: Partial<Record<UpgradeId, number>> = {
  might: 35,
  haste: 34,
  multishot: 33,
  crit: 32,
  arcana: 32,
  area: 30,
  vitality: 29,
  armor: 27,
  lifesteal: 24,
  duration: 22,
  regen: 21,
  swift: 20,
  evasion: 20,
  magnet: 15,
  wisdom: 14,
};

/** Which E abilities are aimed at a spot (and how far they reach). */
const TARGETED_E: Partial<Record<string, number>> = { meteor: 650, timebomb: 600, treant: 450, leap: 340 };

export class Bot {
  private snap: Snapshot | null = null;
  private raw: string | null = null;
  private local: Point = { x: 0, y: 0 };
  private epoch = -1;
  private dodgeTime = 0;
  private dodgeCooldown = 0;
  private dodgeDir: Point = { x: 1, y: 0 };
  private walls: WallIndex;
  private mapIndex = -1;
  private nav: FlowField | null = null;
  private navGoal: Point | null = null;
  private navAge = 0;
  /** Unsticking: a sideways shuffle when the bot hasn't moved for a while. */
  private stuckTime = 0;
  private wiggle = 0;
  private wiggleDir: Point = { x: 0, y: 0 };
  private lastPos: Point = { x: 0, y: 0 };
  private castDelay = 0;
  /** Charge lanes vanish when the dash starts; remember them a moment longer, like a person would. */
  private lanes = new Map<number, { h: number[]; until: number }>();
  private clock = 0;

  constructor(
    private readonly send: (msg: ClientMessage) => void,
    readonly id: number,
    /** 0 to 1: how quickly it reacts and how often it dodges. 1 = sharp player. */
    private readonly skill = 0.8,
  ) {
    this.walls = new WallIndex(MAPS[0].walls, MAPS[0].width, MAPS[0].height);
  }

  /** Called with each snapshot text the server sends this player. Parsed lazily. */
  receive(text: string): void {
    this.raw = text;
  }

  /** One frame of thinking and moving (call once per server tick). */
  think(): void {
    if (this.raw) {
      this.snap = JSON.parse(this.raw) as Snapshot;
      this.raw = null;
    }
    const snap = this.snap;
    if (!snap?.me || snap.phase !== 'playing') return;
    const me = snap.players.find((p) => p.id === this.id);
    if (!me) return;
    if (snap.map !== this.mapIndex) {
      this.mapIndex = snap.map;
      const map = MAPS[snap.map];
      this.walls = new WallIndex(map.walls, map.width, map.height);
      this.nav = new FlowField(this.walls);
      this.navGoal = null;
    }
    // The server moved us (respawn, leap, rewind...): snap to it.
    if (snap.me.epoch !== this.epoch) {
      this.epoch = snap.me.epoch;
      this.local = { x: me.x, y: me.y };
    }

    if (snap.pause) {
      if (snap.me.options) this.send({ t: 'choose', index: this.pickUpgrade(snap.me.options, snap.me.upgrades, me.character, me.hp / me.maxHp) });
      return;
    }
    if (me.downed) return;

    const dt = TICK_DT * snap.timeScale;
    this.clock += dt;
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.rememberLanes(snap);
    const enemies = this.enemiesAround(snap);
    const aim = this.chooseAim(snap, me, enemies);
    this.useAbilities(snap, me, enemies, aim);

    // Where to go, and what to get away from.
    const want = this.steer(snap, me, enemies, dt);
    const danger = this.inDanger(snap, me, enemies);
    if (danger && this.dodgeCooldown <= 0 && Math.random() < this.skill) {
      this.dodgeTime = DODGE_DURATION;
      this.dodgeCooldown = snap.me.dodgeCooldown;
      this.dodgeDir = want.x === 0 && want.y === 0 ? { x: Math.cos(aim.angle), y: Math.sin(aim.angle) } : want;
      this.send({ t: 'dodge' });
    }

    let vx: number;
    let vy: number;
    let pass: PassFlags | undefined;
    if (this.dodgeTime > 0) {
      this.dodgeTime -= dt;
      vx = this.dodgeDir.x * DODGE_SPEED;
      vy = this.dodgeDir.y * DODGE_SPEED;
      pass = { thin: true, thick: CHARACTERS[me.character].phaseWalls };
    } else {
      vx = want.x * snap.me.speed;
      vy = want.y * snap.me.speed;
    }
    const next = moveCircle(this.walls, this.local.x, this.local.y, vx * dt, vy * dt, PLAYER_RADIUS, pass);
    if (pass && overlapsWall(this.walls, next.x, next.y, PLAYER_RADIUS)) this.dodgeTime += dt; // Finish the dash.
    this.local = next;
    const arena = snap.arena;
    if (me.inArena && arena) {
      const dx = this.local.x - arena.x;
      const dy = this.local.y - arena.y;
      const d = Math.hypot(dx, dy);
      const max = arena.r - PLAYER_RADIUS;
      if (d > max) this.local = { x: arena.x + (dx / d) * max, y: arena.y + (dy / d) * max };
    }
    this.send({ t: 'move', x: this.local.x, y: this.local.y, aim: aim.angle, epoch: this.epoch });
  }

  // --- Perception ---

  private enemiesAround(snap: Snapshot): EnemyView[] {
    const out: EnemyView[] = [];
    const list = snap.enemies;
    for (let i = 0; i < list.length; i += ENEMY_Swiftness) {
      const type = list[i + 1];
      const def = ENEMY_TYPES[type];
      const x = list[i + 2];
      const y = list[i + 3];
      const d = Math.hypot(x - this.local.x, y - this.local.y);
      out.push({ x, y, type, radius: def.radius, boss: def.radius >= 50, marked: (list[i + 4] & EnemyFlag.Marked) !== 0, d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  /** Enemies within `r` of a point. */
  private countNear(enemies: EnemyView[], x: number, y: number, r: number): number {
    let n = 0;
    for (const e of enemies) if ((e.x - x) ** 2 + (e.y - y) ** 2 < r * r) n++;
    return n;
  }

  /** The spot within `range` with the most enemies around it (checks the nearest few enemies as centers). */
  private bestCluster(enemies: EnemyView[], range: number, radius: number): { x: number; y: number; count: number; d: number } | null {
    let best: { x: number; y: number; count: number; d: number } | null = null;
    for (const e of enemies.slice(0, 40)) {
      if (e.d > range) break;
      const count = this.countNear(enemies, e.x, e.y, radius) + (e.boss ? 6 : 0);
      if (!best || count > best.count) best = { x: e.x, y: e.y, count, d: e.d };
    }
    return best;
  }

  private isMelee(me: PlayerState): boolean {
    return CHARACTERS[me.character].role === 'melee';
  }

  // --- Aim and abilities ---

  private chooseAim(snap: Snapshot, me: PlayerState, enemies: EnemyView[]): { angle: number; dist: number } {
    const at = (p: Point) => ({ angle: Math.atan2(p.y - this.local.y, p.x - this.local.x), dist: Math.hypot(p.x - this.local.x, p.y - this.local.y) });
    // Mission targets and bosses first, then whatever is closest.
    const marked = enemies.find((e) => e.marked && e.d < 600);
    if (marked) return at(marked);
    const boss = enemies.find((e) => e.boss && e.d < 650);
    const nearest = enemies[0];
    if (nearest && nearest.d < 120 && !nearest.boss) return at(nearest);
    // Focus a boss in reach: leaving a warlord alive costs more than the trash around it.
    if (boss && boss.d < 400) return at(boss);
    if (me.hp / me.maxHp < 0.6) {
      for (let i = 0; i < snap.pickups.length; i += PICKUP_Swiftness) {
        if (snap.pickups[i + 1] !== PickupKind.Crate) continue;
        const c = { x: snap.pickups[i + 2], y: snap.pickups[i + 3] };
        if (Math.hypot(c.x - this.local.x, c.y - this.local.y) < 300) return at(c);
      }
    }
    if (nearest && nearest.d < 220) return at(nearest);
    if (boss) return at(boss);
    // Nothing close: shoot open a crate.
    for (let i = 0; i < snap.pickups.length; i += PICKUP_Swiftness) {
      if (snap.pickups[i + 1] !== PickupKind.Crate) continue;
      const c = { x: snap.pickups[i + 2], y: snap.pickups[i + 3] };
      if (Math.hypot(c.x - this.local.x, c.y - this.local.y) < 350) return at(c);
    }
    return nearest ? at(nearest) : { angle: 0, dist: 100 };
  }

  private useAbilities(snap: Snapshot, me: PlayerState, enemies: EnemyView[], aim: { angle: number; dist: number }): void {
    if (this.castDelay > 0) {
      this.castDelay -= TICK_DT;
      return;
    }
    const hero = CHARACTERS[me.character];
    const hpShare = me.hp / me.maxHp;
    const near = (r: number) => this.countNear(enemies, this.local.x, this.local.y, r);
    const boss = enemies.find((e) => e.boss && e.d < 600);
    const cast = (slot: 'e' | 'r', angle: number, dist: number) => {
      this.send({ t: 'cast', slot, aim: angle, dist });
      // People don't mash both buttons on the same frame.
      this.castDelay = 0.3 + (1 - this.skill) * 0.7;
    };
    const ability = snap.me!.ability;
    if (ability.cd <= 0 && (snap.me!.upgrades[hero.ability] ?? 0) > 0) {
      const reach = TARGETED_E[hero.ability];
      if (reach) {
        const spot = this.bestCluster(enemies, reach, 130);
        if (spot && (spot.count >= 3 || boss)) {
          return cast('e', Math.atan2(spot.y - this.local.y, spot.x - this.local.x), spot.d);
        }
      } else {
        const threatened = near(140) >= 3 || (hpShare < 0.6 && near(220) >= 2);
        const use =
          hero.ability === 'warcry'
            ? near(250) >= 5 || (hpShare < 0.5 && near(200) >= 2)
            : hero.ability === 'veil'
              ? threatened || near(160) >= 6
              : hero.ability === 'flamenova'
                ? near(170) >= 4 || !!(boss && boss.d < 200)
                : hero.ability === 'tumble'
                  ? threatened
                  : near(200) >= 3;
        if (use) {
          // Tumble away from the crowd; everything else uses the current aim.
          const angle = hero.ability === 'tumble' && enemies[0] ? Math.atan2(this.local.y - enemies[0].y, this.local.x - enemies[0].x) : aim.angle;
          return cast('e', angle, aim.dist);
        }
      }
    }
    if (snap.me!.ultimate.cd <= 0) {
      const allyHurt = snap.players.some((p) => p.id !== me.id && (p.downed || p.hp / p.maxHp < 0.4) && Math.hypot(p.x - this.local.x, p.y - this.local.y) < 650);
      const use: Record<string, boolean> = {
        chrono: near(600) >= 14 || (hpShare < 0.4 && near(250) >= 4),
        rage: near(200) >= 6 || !!(boss && boss.d < 300),
        rally: allyHurt || hpShare < 0.35,
        shadowstrike: near(650) >= 6 || !!boss,
        inferno: near(380) >= 10 || !!(boss && boss.d < 380),
        arrowstorm: near(600) >= 10 || !!boss,
        wildcall: near(450) >= 10 || !!boss,
        rewind: hpShare < 0.35,
      };
      if (use[hero.ultimate.id]) return cast('r', aim.angle, aim.dist);
    }
  }

  // --- Upgrades ---

  private pickUpgrade(options: ChoiceId[], upgrades: Upgrades, character: CharacterId, hpShare: number): number {
    const hero = CHARACTERS[character];
    const weapons = ownedWeapons(upgrades).length;
    const passives = ownedPassives(upgrades).length;
    const score = (id: ChoiceId): number => {
      // Nothing left to upgrade: heal when hurt, otherwise take the gold.
      if (isBonus(id)) return id === 'bonusHeal' ? (hpShare < 0.7 ? 2 : 0.5) : 1;
      const def = UPGRADES[id];
      const level = upgrades[id] ?? 0;
      if (level + 1 >= EVOLVED_LEVEL) return 100; // Evolutions are the best thing in the game.
      if (id === hero.ability) return 60 - level;
      if (def.kind === 'weapon') {
        if (level > 0) return 52 - level;
        // A fourth weapon is fine, but not before the starting one has grown. Same damage type as the hero: attunement.
        const attunes = damageType(id as WeaponId) === heroDamageType(character) ? 8 : 0;
        return weapons < WEAPON_SLOTS ? 40 - weapons * 3 + attunes : 0;
      }
      let s = PASSIVE_PRIORITY[id] ?? 10;
      // Only physical damage crits, so Crit is worth as much as your build is physical.
      if (id === 'crit' || id === 'arcana') {
        const mine = [hero.ability, ...ownedWeapons(upgrades)];
        s *= mine.filter((w) => damageType(w as WeaponId) === (id === 'crit' ? 'physical' : 'magic')).length / mine.length;
      }
      if (id === 'area' && (hero.areaMult ?? 1) < 1) s -= 8;
      if ((id === 'vitality' || id === 'armor') && hero.role === 'melee') s += 4;
      if (level > 0) s += 6;
      else if (passives >= PASSIVE_SLOTS) s = 0;
      return s;
    };
    let best = 0;
    for (let i = 1; i < options.length; i++) if (score(options[i]) > score(options[best])) best = i;
    return best;
  }

  // --- Movement ---

  /** Where the bot is headed this frame: a direction of length 0..1. */
  private steer(snap: Snapshot, me: PlayerState, enemies: EnemyView[], dt: number): Point {
    let vx = 0;
    let vy = 0;
    const goal = this.pickGoal(snap, me, enemies);
    if (goal) {
      const dir = this.pathTo(goal.point, dt);
      vx += dir.x * goal.weight;
      vy += dir.y * goal.weight;
    }

    // Keep the right distance from the horde: melee fights at the edge of it, ranged keeps its distance.
    // When too close, back off through the widest gap rather than straight away (which fails when surrounded).
    const hpShare = me.hp / me.maxHp;
    const melee = this.isMelee(me);
    // Hurt players play it safe until they've healed up.
    const comfort = (melee ? (hpShare < 0.45 ? 190 : 60) : me.character === 'druid' ? 150 : 230) + (hpShare < 0.5 ? 70 : 0);
    let threat = 0;
    for (const e of enemies) {
      if (e.d > comfort + 150) break;
      // Bosses: ranged keep well clear; melee fights in close while healthy (hit and run when hurt).
      const bossKeep = melee && hpShare > 0.5 ? 45 : Math.max(comfort, 160);
      const keep = (e.boss ? bossKeep : comfort) + e.radius;
      if (e.d < keep) threat += ((keep - e.d) / keep) * (e.boss ? 3 : 1);
    }
    // Melee can stand next to a few enemies, but not in the middle of a crowd.
    const crowd = this.countNear(enemies, this.local.x, this.local.y, 110);
    const bossClose = enemies.some((e) => e.boss && e.d < (hpShare > 0.5 ? 45 : 160) + e.radius);
    if (melee && !bossClose && crowd <= (hpShare > 0.6 ? 4 : 2)) threat = Math.min(threat, 0.3);
    if (threat > 0.15) {
      const gap = this.bestGap(enemies, 450);
      const w = Math.min(2.5, threat);
      vx += gap.x * w;
      vy += gap.y * w;
    }
    // Melee heroes go after a boss in reach while healthy.
    const boss = enemies.find((e) => e.boss && e.d < 600);
    if (melee && boss && hpShare > 0.5 && !goal && boss.d > boss.radius + 50) {
      vx += ((boss.x - this.local.x) / boss.d) * 1.2;
      vy += ((boss.y - this.local.y) / boss.d) * 1.2;
    }
    // Melee heroes with nothing to do close in on the nearest enemy.
    if (melee && !goal && enemies[0] && enemies[0].d > comfort + enemies[0].radius + 10 && enemies[0].d < 500 && hpShare > 0.45 && crowd <= 3) {
      vx += ((enemies[0].x - this.local.x) / enemies[0].d) * 0.8;
      vy += ((enemies[0].y - this.local.y) / enemies[0].d) * 0.8;
    }

    // Get out of bomb circles and charge lanes.
    const h = snap.hazards;
    for (let i = 0; i < h.length; i += HAZARD_Swiftness) {
      const kind = h[i + 1];
      const hx = h[i + 2];
      const hy = h[i + 3];
      if (kind === HazardKind.Circle) {
        const r = h[i + 4] + PLAYER_RADIUS + 15;
        const d = Math.hypot(this.local.x - hx, this.local.y - hy);
        if (d < r) {
          const k = d < 1 ? { x: 1, y: 0 } : { x: (this.local.x - hx) / d, y: (this.local.y - hy) / d };
          vx += k.x * 3;
          vy += k.y * 3;
        }
      }
    }
    for (const [lane] of this.activeLanes()) {
      const off = this.laneOffset(lane, 0);
      if (off) {
        vx += off.x * 3;
        vy += off.y * 3;
      }
    }
    // Sidestep bullets coming at you.
    const shots = snap.enemyShots;
    for (let i = 0; i < shots.length; i += ENEMY_SHOT_Swiftness) {
      const dx = this.local.x - shots[i + 1];
      const dy = this.local.y - shots[i + 2];
      const d = Math.hypot(dx, dy);
      if (d < 90 && d > 0) {
        vx += (-dy / d) * 0.8;
        vy += (dx / d) * 0.8;
      }
    }
    // Stay out of the burning zone while the arena fight is coming.
    const arena = snap.arena;
    if (arena && arena.state !== 'idle' && !me.inArena) {
      const dir = this.pathTo(arena, dt);
      vx += dir.x * 4;
      vy += dir.y * 4;
    }

    // Unstick: if we've barely moved for a while despite trying, shuffle sideways.
    const moved = Math.hypot(this.local.x - this.lastPos.x, this.local.y - this.lastPos.y);
    this.lastPos = { ...this.local };
    const trying = Math.hypot(vx, vy) > 0.3;
    this.stuckTime = trying && moved < snap.me!.speed * dt * 0.2 ? this.stuckTime + dt : 0;
    if (this.stuckTime > 0.6) {
      this.stuckTime = 0;
      this.wiggle = 0.5;
      const a = Math.random() * Math.PI * 2;
      this.wiggleDir = { x: Math.cos(a), y: Math.sin(a) };
      this.navGoal = null; // Recompute the path.
    }
    if (this.wiggle > 0) {
      this.wiggle -= dt;
      vx += this.wiggleDir.x * 2;
      vy += this.wiggleDir.y * 2;
    }

    const len = Math.hypot(vx, vy);
    if (len < 0.05) return { x: 0, y: 0 };
    return len > 1 ? { x: vx / len, y: vy / len } : { x: vx, y: vy };
  }

  /** The direction with the fewest enemies (weighted by closeness) and no wall right in front. */
  private bestGap(enemies: EnemyView[], range: number): Point {
    let best: Point = { x: 0, y: 0 };
    let bestScore = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let score = 0;
      for (const e of enemies) {
        if (e.d > range) break;
        const toward = ((e.x - this.local.x) * dx + (e.y - this.local.y) * dy) / Math.max(e.d, 1);
        if (toward > -0.2) score += (toward + 0.2) * (e.boss ? 4 : 1) / Math.max(e.d, 30);
      }
      // Walls ahead are dead ends.
      if (overlapsWall(this.walls, this.local.x + dx * 70, this.local.y + dy * 70, PLAYER_RADIUS)) score += 1;
      if (score < bestScore) {
        bestScore = score;
        best = { x: dx, y: dy };
      }
    }
    return best;
  }

  /** Charge lanes seen now, plus ones that just vanished because the dash started. As HAZARD_Swiftness-sized records. */
  private rememberLanes(snap: Snapshot): void {
    const h = snap.hazards;
    const seen = new Set<number>();
    for (let i = 0; i < h.length; i += HAZARD_Swiftness) {
      if (h[i + 1] !== HazardKind.Line) continue;
      seen.add(h[i]);
      this.lanes.set(h[i], { h: h.slice(i, i + HAZARD_Swiftness), until: Infinity });
    }
    for (const [id, lane] of this.lanes) {
      if (!seen.has(id) && lane.until === Infinity) lane.until = this.clock + 0.8;
      if (lane.until < this.clock) this.lanes.delete(id);
    }
  }

  /** Lanes to stay out of: [record, dashing now?]. */
  private activeLanes(): [number[], boolean][] {
    return [...this.lanes.values()].map((l) => [l.h, l.until !== Infinity]);
  }

  /** If we're standing in a charge lane, which way gets us out (else null). */
  private laneOffset(h: number[], i: number): Point | null {
    const angle = h[i + 4];
    const length = h[i + 5];
    const width = h[i + 6];
    const dx = this.local.x - h[i + 2];
    const dy = this.local.y - h[i + 3];
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    const across = -dx * Math.sin(angle) + dy * Math.cos(angle);
    if (along < -PLAYER_RADIUS || along > length + PLAYER_RADIUS || Math.abs(across) > width / 2 + PLAYER_RADIUS + 10) return null;
    const side = across >= 0 ? 1 : -1;
    return { x: -Math.sin(angle) * side, y: Math.cos(angle) * side };
  }

  /** About to get hit by something a dodge would avoid? */
  private inDanger(snap: Snapshot, me: PlayerState, enemies: EnemyView[]): boolean {
    const h = snap.hazards;
    for (let i = 0; i < h.length; i += HAZARD_Swiftness) {
      const progress = h[i + 7];
      if (h[i + 1] === HazardKind.Circle) {
        const inside = Math.hypot(this.local.x - h[i + 2], this.local.y - h[i + 3]) < h[i + 4] + PLAYER_RADIUS * 0.5;
        if (inside && progress > 0.75) return true;
      }
    }
    for (const [lane, dashing] of this.activeLanes()) {
      if ((dashing || lane[7] > 0.7) && this.laneOffset(lane, 0)) return true;
    }
    const shots = snap.enemyShots;
    for (let i = 0; i < shots.length; i += ENEMY_SHOT_Swiftness) {
      if (Math.hypot(this.local.x - shots[i + 1], this.local.y - shots[i + 2]) < 40) return true;
    }
    // Surrounded and hurting.
    return me.hp / me.maxHp < 0.4 && this.countNear(enemies, this.local.x, this.local.y, 70) >= 4;
  }

  /** The most important place to be right now, and how strongly to head there. */
  private pickGoal(snap: Snapshot, me: PlayerState, enemies: EnemyView[]): { point: Point; weight: number } | null {
    const dist = (p: Point) => Math.hypot(p.x - this.local.x, p.y - this.local.y);
    const crowd = this.countNear(enemies, this.local.x, this.local.y, 200);
    // Revive a downed teammate when it's not suicide.
    const downed = snap.players.filter((p) => p.downed && p.id !== me.id).sort((a, b) => dist(a) - dist(b))[0];
    if (downed && dist(downed) < 1200 && crowd < 8) return { point: downed, weight: dist(downed) > REVIVE_RADIUS * 0.6 ? 1.5 : 0 };

    // Boss side missions.
    const fight = snap.bossFight;
    if (fight?.mission) {
      if (fight.mission.kind === 'sigils') {
        const sigils: Point[] = [];
        for (let i = 0; i < snap.shrines.length; i += SHRINE_Swiftness) {
          if (snap.shrines[i + 1] === ShrineKind.Sigil) sigils.push({ x: snap.shrines[i + 2], y: snap.shrines[i + 3] });
        }
        // Spread the team over the sigils.
        const mine = sigils.sort((a, b) => dist(a) - dist(b))[this.id % Math.max(1, sigils.length)] ?? sigils[0];
        if (mine) return { point: mine, weight: dist(mine) > 40 ? 2.6 : 0 };
      } else {
        const target = enemies.find((e) => e.marked);
        if (target) return { point: target, weight: target.d > (this.isMelee(me) ? 60 : 220) ? 2.2 : 0 };
      }
    }

    // Hurt: go for hearts, and break open crates to get them.
    const hurt = me.hp / me.maxHp;
    if (hurt < 0.75) {
      let best: { p: Point; d: number; crate: boolean } | null = null;
      for (let i = 0; i < snap.pickups.length; i += PICKUP_Swiftness) {
        const p = { x: snap.pickups[i + 2], y: snap.pickups[i + 3] };
        const crate = snap.pickups[i + 1] === PickupKind.Crate;
        // A crate is worth a detour only when you're quite hurt; it has to be shot open first.
        const d = dist(p) + (crate ? 250 : 0);
        if ((!crate || hurt < 0.6) && dist(p) < 1600 && (!best || d < best.d)) best = { p, d, crate };
      }
      if (best) return { point: best.p, weight: best.crate && dist(best.p) < 200 ? 0.2 : 1.5 + (hurt < 0.4 ? 1 : 0) };
    }

    // Quests.
    if (snap.quest && dist(snap.quest) < 2500) return { point: snap.quest, weight: dist(snap.quest) > 50 ? 1.2 : 0 };

    // Upgrade points: Forges first, then whatever's closest.
    let shrine: { p: Point; score: number } | null = null;
    for (let i = 0; i < snap.shrines.length; i += SHRINE_Swiftness) {
      const kind = snap.shrines[i + 1];
      if (kind === ShrineKind.Sigil) continue;
      const p = { x: snap.shrines[i + 2], y: snap.shrines[i + 3] };
      const score = dist(p) - (kind === ShrineKind.Forge ? 1500 : 0);
      if (dist(p) < 2600 && (!shrine || score < shrine.score)) shrine = { p, score };
    }
    if (shrine && crowd < 12) return { point: shrine.p, weight: dist(shrine.p) > 45 ? 1.1 : 0 };

    // Otherwise sweep up gems, and don't wander away from the team.
    let gem: Point | null = null;
    for (let i = 0; i < snap.gems.length; i += GEM_Swiftness) {
      const g = { x: snap.gems[i + 1], y: snap.gems[i + 2] };
      if (dist(g) < 350 && (!gem || dist(g) < dist(gem))) gem = g;
    }
    if (gem) return { point: gem, weight: 0.5 };
    const others = snap.players.filter((p) => p.id !== me.id && !p.downed);
    if (others.length > 0) {
      const c = { x: others.reduce((s, p) => s + p.x, 0) / others.length, y: others.reduce((s, p) => s + p.y, 0) / others.length };
      if (dist(c) > 450) return { point: c, weight: 0.7 };
    }
    return null;
  }

  /** A unit direction toward `goal` that walks around walls. */
  private pathTo(goal: Point, dt: number): Point {
    const d = Math.hypot(goal.x - this.local.x, goal.y - this.local.y);
    if (d < 1) return { x: 0, y: 0 };
    this.navAge += dt;
    if (this.nav && (!this.navGoal || Math.hypot(goal.x - this.navGoal.x, goal.y - this.navGoal.y) > 80 || this.navAge > 2)) {
      this.nav.update([goal]);
      this.navGoal = { ...goal };
      this.navAge = 0;
    }
    // Close by, or nothing in the way: straight there.
    const step = this.nav && d > 60 ? this.nav.direction(this.local.x, this.local.y) : null;
    return step ?? { x: (goal.x - this.local.x) / d, y: (goal.y - this.local.y) / d };
  }
}
