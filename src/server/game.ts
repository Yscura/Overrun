import { CHARACTERS, DEFAULT_CHARACTER, isCharacterId, playerStats, upgradesFor, type CharacterId, type PlayerStats } from '../shared/characters';
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
  RESUME_COUNTDOWN,
  REVIVE_RADIUS,
  REVIVE_TIME,
  SPAWN_DISTANCE,
  TICK_DT,
  WORLD_SIZE,
} from '../shared/constants';
import { BOMBARDIER, BOSS_ATTACK, CHARGER, ENEMY_TYPES, EnemyType, MAX_ENEMY_RADIUS, SPITTER } from '../shared/enemies';
import {
  EnemyFlag,
  HazardKind,
  PickupKind,
  ProjectileKind,
  type ClientMessage,
  type Fx,
  type GameResult,
  type MeState,
  type Pause,
  type Phase,
  type PlayerState,
  type Snapshot,
} from '../shared/protocol';
import {
  MAX_LEVEL,
  boltStats,
  cleaveStats,
  knivesStats,
  orbitStats,
  slamStats,
  stormStats,
  xpToNext,
  type UpgradeId,
  type Upgrades,
  type WeaponId,
} from '../shared/upgrades';
import { SpatialGrid } from './spatialGrid';

const SEPARATION_SPEED = 150;
const GEM_ACCEL = 1500;
const GEM_MAX_SPEED = 900;
const WEAPON_IDS: WeaponId[] = ['bolt', 'knives', 'storm', 'cleave', 'slam', 'orbit'];

/** Charger attack cycle. Other enemies stay in Normal. */
const Mode = { Normal: 0, Windup: 1, Charge: 2, Recover: 3 } as const;

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
}

interface Enemy {
  id: number;
  type: number;
  x: number;
  y: number;
  hp: number;
  flashUntil: number;
  orbitHitUntil: number;
  dead: boolean;
  attackTimer: number;
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

/** A telegraphed attack. Circles explode when the timer runs out; lines just show a charger's path. */
interface Hazard {
  id: number;
  kind: number;
  x: number;
  y: number;
  /** Circle: radius. Line: angle. */
  a: number;
  /** Line: length. */
  b: number;
  t: number;
  duration: number;
  damage: number;
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

/** Shared shape of bolt and knife stats. */
interface FanStats {
  damage: number;
  count: number;
  pierce: number;
  speed: number;
  range: number;
  spread: number;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;
const round2 = (v: number) => Math.round(v * 100) / 100;

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
  /** Level-ups earned but not yet handed out; each one is a pause where everyone picks. */
  private pendingLevels = 0;
  private spawnAcc = 0;
  private nextBossAt = BOSS_INTERVAL;
  private crateTimer = 0;
  private grid = new SpatialGrid<Enemy>(64);
  /** Reused query buffer; never nest two grid queries that share it. */
  private near: Enemy[] = [];

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
    };
    this.resetPlayer(player, this.players.size);
    // Joining mid-run drops you next to a teammate (and into the current pick, if there is one).
    const buddy = this.phase === 'playing' ? this.alivePlayers()[0] : undefined;
    if (buddy) {
      player.x = clamp(buddy.x + 40, PLAYER_RADIUS, WORLD_SIZE - PLAYER_RADIUS);
      player.y = buddy.y;
    }
    if (this.pause?.kind === 'choose') player.options = this.rollOptions(player);
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
      case 'start':
        if (this.phase !== 'playing') this.startGame();
        break;
      case 'lobby':
        if (this.phase === 'gameover') {
          this.phase = 'lobby';
          this.clearWorld();
          for (const other of this.players.values()) this.equip(other);
        }
        break;
      case 'move':
        this.movePlayer(p, msg.x, msg.y, msg.aim, msg.epoch);
        break;
      case 'dodge':
        this.dodge(p);
        break;
      case 'choose':
        this.choose(p, msg.index);
        break;
    }
  }

  tick(): void {
    this.tickCount++;
    if (this.phase === 'playing') {
      if (this.pause) this.updatePause(TICK_DT);
      else this.update(TICK_DT);
    }
    this.broadcast();
    this.fx = [];
  }

  // --- Lifecycle ---

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
    this.pendingLevels = 0;
    this.spawnAcc = 0;
    this.nextBossAt = BOSS_INTERVAL;
    this.crateTimer = CRATE_INTERVAL / 2;
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
    p.x = WORLD_SIZE / 2 + Math.cos(angle) * 60;
    p.y = WORLD_SIZE / 2 + Math.sin(angle) * 60;
    p.epoch++;
    this.equip(p);
  }

  /** Fresh run loadout for the player's character. */
  private equip(p: Player): void {
    p.upgrades = { [CHARACTERS[p.character].startWeapon]: 1 };
    p.hp = this.stats(p).maxHp;
    p.downed = false;
    p.revive = 0;
    p.options = null;
    p.cooldowns = {};
    p.invuln = 0;
    p.dodgeCooldown = 0;
    p.hurtUntil = 0;
    p.kills = 0;
  }

  private endGame(): void {
    this.phase = 'gameover';
    this.pause = null;
    this.result = {
      time: this.time,
      level: this.level,
      players: [...this.players.values()].map((p) => ({ name: p.name, color: p.color, character: p.character, kills: p.kills })),
    };
  }

  private alivePlayers(): Player[] {
    return [...this.players.values()].filter((p) => !p.downed);
  }

  private stats(p: Player): PlayerStats {
    return playerStats(p.upgrades, p.character);
  }

  // --- Level-up pause ---

  private updatePause(dt: number): void {
    const pause = this.pause!;
    pause.timeLeft -= dt;
    if (pause.kind === 'countdown') {
      if (pause.timeLeft <= 0) this.pause = null;
      return;
    }
    const undecided = [...this.players.values()].filter((p) => p.options);
    if (pause.timeLeft <= 0) {
      // Out of time: pick for whoever is still deciding.
      for (const p of undecided) this.applyUpgrade(p, p.options![Math.floor(Math.random() * p.options!.length)]);
    } else if (undecided.length > 0) {
      return;
    }
    this.pendingLevels--;
    if (this.pendingLevels > 0) this.startChoosing();
    else this.pause = { kind: 'countdown', timeLeft: RESUME_COUNTDOWN };
  }

  private startChoosing(): void {
    this.pause = { kind: 'choose', timeLeft: CHOOSE_TIME };
    for (const p of this.players.values()) p.options = this.rollOptions(p);
  }

  private rollOptions(p: Player): UpgradeId[] | null {
    const candidates = upgradesFor(p.character).filter((id) => (p.upgrades[id] ?? 0) < MAX_LEVEL);
    if (candidates.length === 0) {
      // Everything is maxed; the level-up becomes a full heal.
      p.hp = this.stats(p).maxHp;
      return null;
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
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
    const alive = this.alivePlayers();
    this.spawnEnemies(dt, alive);
    this.spawnCrates(dt, alive);
    this.rebuildGrid();
    this.moveEnemies(dt, alive);
    this.rebuildGrid();
    for (const p of this.players.values()) this.updatePlayer(p, dt);
    this.updateProjectiles(dt);
    this.updateEnemyShots(dt);
    this.updateHazards(dt);
    this.updateGems(dt);
    this.updateHearts();
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.pickups = this.pickups.filter((c) => !c.dead);
    if (this.players.size > 0 && this.alivePlayers().length === 0) this.endGame();
    else if (this.pendingLevels > 0) this.startChoosing();
  }

  private rebuildGrid(): void {
    this.grid.clear();
    for (const e of this.enemies) this.grid.insert(e);
  }

  private spawnEnemies(dt: number, alive: Player[]): void {
    if (alive.length === 0) return;
    // More enemies over time, and more with more players.
    const perSecond = (0.8 + this.time / 30) * (0.6 + 0.4 * this.players.size);
    this.spawnAcc += perSecond * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.length < MAX_ENEMIES) this.spawnEnemy(this.pickEnemyType(), alive);
    }
    if (this.time >= this.nextBossAt) {
      this.nextBossAt += BOSS_INTERVAL;
      this.spawnEnemy(EnemyType.Boss, alive);
      this.fx.push({ k: 'boss' });
    }
  }

  /** Weighted random pick among the enemy types unlocked by now (see `spawnAfter` / `weight`). */
  private pickEnemyType(): number {
    const available = ENEMY_TYPES.map((def, type) => ({ type, weight: this.time >= def.spawnAfter ? def.weight : 0 }));
    let r = Math.random() * available.reduce((sum, a) => sum + a.weight, 0);
    for (const { type, weight } of available) {
      r -= weight;
      if (weight > 0 && r < 0) return type;
    }
    return EnemyType.Grunt;
  }

  /** A random point `minDist`–`maxDist` from a random living player, kept inside the arena. */
  private pointNear(alive: Player[], minDist: number, maxDist: number): { x: number; y: number } {
    const near = alive[Math.floor(Math.random() * alive.length)];
    let x = 0;
    let y = 0;
    // Near the arena edge the clamped spot can land on top of the player, so try a few angles.
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = minDist + Math.random() * (maxDist - minDist);
      x = clamp(near.x + Math.cos(angle) * distance, 0, WORLD_SIZE);
      y = clamp(near.y + Math.sin(angle) * distance, 0, WORLD_SIZE);
      if (dist2(x, y, near.x, near.y) > (minDist * 0.8) ** 2) break;
    }
    return { x, y };
  }

  private spawnEnemy(type: number, alive: Player[]): void {
    const { x, y } = this.pointNear(alive, SPAWN_DISTANCE, SPAWN_DISTANCE + 200);
    // Enemies toughen up over time. Spawn rate already scales with player count, so only bosses get extra HP for it.
    let hpScale = 1 + this.time / 120;
    if (type === EnemyType.Boss) hpScale *= 1 + 0.5 * (this.players.size - 1);
    this.enemies.push({
      id: this.nextId++,
      type,
      x,
      y,
      hp: ENEMY_TYPES[type].hp * hpScale,
      flashUntil: 0,
      orbitHitUntil: 0,
      dead: false,
      attackTimer: 1 + Math.random() * 2,
      mode: Mode.Normal,
      modeTimer: 0,
      dirX: 0,
      dirY: 0,
      charged: new Set(),
      hazard: null,
      strafe: Math.random() < 0.5 ? 1 : -1,
    });
  }

  // --- Enemy behavior ---

  private moveEnemies(dt: number, alive: Player[]): void {
    for (const e of this.enemies) {
      const def = ENEMY_TYPES[e.type];

      // Everyone targets the nearest living player.
      let target: Player | null = null;
      let best = Infinity;
      for (const p of alive) {
        const d = dist2(p.x, p.y, e.x, e.y);
        if (d < best) {
          best = d;
          target = p;
        }
      }
      let vx = 0;
      let vy = 0;
      if (target && best > 1) {
        const d = Math.sqrt(best);
        const ux = (target.x - e.x) / d;
        const uy = (target.y - e.y) / d;
        switch (def.behavior) {
          case 'ranged':
            [vx, vy] = this.keepDistance(e, ux, uy, d, SPITTER.minRange, SPITTER.maxRange, def.speed);
            this.spit(e, ux, uy, d, dt);
            break;
          case 'lobber':
            [vx, vy] = this.keepDistance(e, ux, uy, d, BOMBARDIER.minRange, BOMBARDIER.maxRange, def.speed);
            this.lob(e, target, d, dt);
            break;
          case 'charger':
            [vx, vy] = this.chargerStep(e, ux, uy, d, dt, def.speed);
            break;
          case 'boss':
            this.bossAttack(e, alive, dt);
            [vx, vy] = [ux * def.speed, uy * def.speed];
            break;
          default:
            [vx, vy] = [ux * def.speed, uy * def.speed];
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

      e.x = clamp(e.x + (vx + sx * SEPARATION_SPEED) * dt, 0, WORLD_SIZE);
      e.y = clamp(e.y + (vy + sy * SEPARATION_SPEED) * dt, 0, WORLD_SIZE);
      if (e.hazard) {
        e.hazard.x = e.x;
        e.hazard.y = e.y;
      }

      if (e.mode === Mode.Charge) {
        for (const p of alive) {
          if (e.charged.has(p.id) || dist2(p.x, p.y, e.x, e.y) >= (PLAYER_RADIUS + def.radius) ** 2) continue;
          if (this.hurtPlayer(p, CHARGER.damage)) e.charged.add(p.id);
        }
      }
    }
  }

  /** Approach when too far, back off when too close, otherwise circle around the target. */
  private keepDistance(e: Enemy, ux: number, uy: number, d: number, min: number, max: number, speed: number): [number, number] {
    if (d > max) return [ux * speed, uy * speed];
    if (d < min) return [-ux * speed, -uy * speed];
    return [-uy * e.strafe * speed * 0.4, ux * e.strafe * speed * 0.4];
  }

  private spit(e: Enemy, ux: number, uy: number, d: number, dt: number): void {
    e.attackTimer -= dt;
    if (e.attackTimer > 0 || d > SPITTER.fireRange) return;
    e.attackTimer = SPITTER.cooldown;
    this.enemyShots.push({
      id: this.nextId++,
      x: e.x,
      y: e.y,
      vx: ux * SPITTER.shotSpeed,
      vy: uy * SPITTER.shotSpeed,
      damage: SPITTER.shotDamage,
      life: SPITTER.shotLife,
      dead: false,
    });
  }

  private lob(e: Enemy, target: Player, d: number, dt: number): void {
    e.attackTimer -= dt;
    if (e.attackTimer > 0 || d > BOMBARDIER.fireRange) return;
    e.attackTimer = BOMBARDIER.cooldown;
    this.addHazard(HazardKind.Circle, target.x, target.y, BOMBARDIER.radius, 0, BOMBARDIER.delay, BOMBARDIER.damage);
  }

  /** Chase -> stop and show the path -> dash along it -> catch breath -> repeat. */
  private chargerStep(e: Enemy, ux: number, uy: number, d: number, dt: number, speed: number): [number, number] {
    e.modeTimer -= dt;
    switch (e.mode) {
      case Mode.Normal:
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && d < CHARGER.triggerRange) {
          e.mode = Mode.Windup;
          e.modeTimer = CHARGER.windup;
          e.dirX = ux;
          e.dirY = uy;
          const length = CHARGER.speed * CHARGER.duration;
          e.hazard = this.addHazard(HazardKind.Line, e.x, e.y, Math.atan2(uy, ux), length, CHARGER.windup, 0);
          return [0, 0];
        }
        return [ux * speed, uy * speed];
      case Mode.Windup:
        if (e.modeTimer <= 0) {
          e.mode = Mode.Charge;
          e.modeTimer = CHARGER.duration;
          if (e.hazard) e.hazard.dead = true;
          e.hazard = null;
          e.charged.clear();
        }
        return [0, 0];
      case Mode.Charge:
        if (e.modeTimer <= 0) {
          e.mode = Mode.Recover;
          e.modeTimer = CHARGER.recover;
          return [0, 0];
        }
        return [e.dirX * CHARGER.speed, e.dirY * CHARGER.speed];
      default:
        if (e.modeTimer <= 0) {
          e.mode = Mode.Normal;
          e.attackTimer = CHARGER.cooldown;
        }
        return [0, 0];
    }
  }

  private bossAttack(e: Enemy, alive: Player[], dt: number): void {
    e.attackTimer -= dt;
    if (e.attackTimer > 0) return;
    e.attackTimer = BOSS_ATTACK.cooldown;
    for (const p of alive) this.addHazard(HazardKind.Circle, p.x, p.y, BOSS_ATTACK.radius, 0, BOSS_ATTACK.delay, BOSS_ATTACK.damage);
  }

  private addHazard(kind: number, x: number, y: number, a: number, b: number, duration: number, damage: number): Hazard {
    const hazard: Hazard = { id: this.nextId++, kind, x, y, a, b, t: 0, duration, damage, dead: false };
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
      if (s.life <= 0 || s.x < 0 || s.y < 0 || s.x > WORLD_SIZE || s.y > WORLD_SIZE) {
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
    if (p.downed) {
      this.updateRevive(p, dt);
      return;
    }
    const stats = this.stats(p);
    p.hp = Math.min(stats.maxHp, p.hp + stats.regen * dt);

    for (const e of this.grid.query(p.x, p.y, PLAYER_RADIUS + MAX_ENEMY_RADIUS, this.near)) {
      if (e.dead) continue;
      const def = ENEMY_TYPES[e.type];
      if (dist2(e.x, e.y, p.x, p.y) < (PLAYER_RADIUS + def.radius) ** 2) this.hurtPlayer(p, def.damage * dt);
    }
    if (!p.downed) this.fireWeapons(p, stats, dt);
  }

  /** Applies armor and downs the player at 0 HP. Returns false if the hit didn't land (dodging or already down). */
  private hurtPlayer(p: Player, amount: number): boolean {
    if (p.downed || p.invuln > 0) return false;
    p.hp -= amount * (1 - this.stats(p).armor);
    p.hurtUntil = this.time + 0.12;
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

  private movePlayer(p: Player, x: unknown, y: unknown, aim: unknown, epoch: unknown): void {
    if (p.downed || this.pause || epoch !== p.epoch) return;
    if (typeof aim === 'number' && Number.isFinite(aim)) p.aim = aim;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
    // Trust the client, but cap how far one message can move you (further while dodging).
    const maxStep = (p.invuln > 0 ? DODGE_SPEED : this.stats(p).speed) * 0.25 + 8;
    let dx = x - p.x;
    let dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > maxStep) {
      dx = (dx / d) * maxStep;
      dy = (dy / d) * maxStep;
    }
    p.x = clamp(p.x + dx, PLAYER_RADIUS, WORLD_SIZE - PLAYER_RADIUS);
    p.y = clamp(p.y + dy, PLAYER_RADIUS, WORLD_SIZE - PLAYER_RADIUS);
  }

  // --- Weapons ---

  private fireWeapons(p: Player, stats: PlayerStats, dt: number): void {
    for (const id of WEAPON_IDS) {
      const level = p.upgrades[id];
      if (!level) continue;
      if (id === 'orbit') {
        this.orbitHits(p, level, stats);
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
        this.shootFan(p, ProjectileKind.Bolt, s, stats);
        return s.cooldown;
      }
      case 'knives': {
        const s = knivesStats(level);
        this.shootFan(p, ProjectileKind.Knife, s, stats);
        return s.cooldown;
      }
      case 'storm':
        return this.storm(p, level, stats);
      case 'cleave':
        return this.cleave(p, level, stats);
      case 'slam':
        return this.slam(p, level, stats);
      default:
        return 1;
    }
  }

  /** Projectiles fanned out around the aim direction. */
  private shootFan(p: Player, kind: number, s: FanStats, stats: PlayerStats): void {
    for (let i = 0; i < s.count; i++) {
      const angle = p.aim + (i - (s.count - 1) / 2) * s.spread;
      this.projectiles.push({
        id: this.nextId++,
        kind,
        owner: p.id,
        x: p.x,
        y: p.y,
        vx: Math.cos(angle) * s.speed,
        vy: Math.sin(angle) * s.speed,
        damage: s.damage * stats.damageMult,
        pierce: s.pierce,
        life: s.range / s.speed,
        hit: new Set(),
        dead: false,
      });
    }
  }

  private storm(p: Player, level: number, stats: PlayerStats): number {
    const s = stormStats(level);
    const inRange = this.grid
      .query(p.x, p.y, s.range, this.near)
      .filter((e) => !e.dead && dist2(e.x, e.y, p.x, p.y) < s.range ** 2);
    if (inRange.length === 0) return 0.25; // Nothing to hit; check again soon.
    for (let i = 0; i < s.strikes && inRange.length > 0; i++) {
      const target = inRange.splice(Math.floor(Math.random() * inRange.length), 1)[0];
      if (target.dead) {
        i--; // Already killed by an earlier strike's splash.
        continue;
      }
      const { x, y } = target;
      for (const e of this.grid.query(x, y, s.splash + MAX_ENEMY_RADIUS, this.near)) {
        if (dist2(e.x, e.y, x, y) < (s.splash + ENEMY_TYPES[e.type].radius) ** 2) this.damageEnemy(e, s.damage * stats.damageMult, p);
      }
      this.fx.push({ k: 'zap', x: Math.round(x), y: Math.round(y) });
    }
    return s.cooldown;
  }

  private cleave(p: Player, level: number, stats: PlayerStats): number {
    const s = cleaveStats(level);
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
    const s = slamStats(level);
    const damage = s.damage * stats.damageMult;
    for (const e of this.grid.query(p.x, p.y, s.radius + MAX_ENEMY_RADIUS, this.near)) {
      if (e.dead || dist2(e.x, e.y, p.x, p.y) >= (s.radius + ENEMY_TYPES[e.type].radius) ** 2) continue;
      this.damageEnemy(e, damage, p);
      this.knockback(e, p.x, p.y, s.knockback);
    }
    for (const c of this.pickups) {
      if (c.kind === PickupKind.Crate && dist2(c.x, c.y, p.x, p.y) < (s.radius + CRATE_RADIUS) ** 2) this.damageCrate(c, damage);
    }
    this.fx.push({ k: 'slam', x: Math.round(p.x), y: Math.round(p.y), r: s.radius, c: p.color });
    return s.cooldown;
  }

  private orbitHits(p: Player, level: number, stats: PlayerStats): void {
    const s = orbitStats(level);
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
    if (e.type === EnemyType.Boss) return;
    const dx = e.x - fromX;
    const dy = e.y - fromY;
    const d = Math.hypot(dx, dy);
    if (d === 0) return;
    e.x = clamp(e.x + (dx / d) * amount, 0, WORLD_SIZE);
    e.y = clamp(e.y + (dy / d) * amount, 0, WORLD_SIZE);
  }

  private damageEnemy(e: Enemy, amount: number, by: Player | undefined): void {
    if (e.dead) return;
    e.hp -= amount;
    e.flashUntil = this.time + 0.1;
    if (e.hp <= 0) {
      e.dead = true;
      if (e.hazard) e.hazard.dead = true;
      if (by) by.kills++;
      this.dropGem(e.x, e.y, ENEMY_TYPES[e.type].xp);
    }
  }

  private updateProjectiles(dt: number): void {
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0) {
        pr.dead = true;
        continue;
      }
      const owner = this.players.get(pr.owner);
      for (const e of this.grid.query(pr.x, pr.y, PROJECTILE_RADIUS + MAX_ENEMY_RADIUS, this.near)) {
        if (e.dead || pr.hit.has(e.id)) continue;
        if (dist2(e.x, e.y, pr.x, pr.y) >= (PROJECTILE_RADIUS + ENEMY_TYPES[e.type].radius) ** 2) continue;
        pr.hit.add(e.id);
        this.damageEnemy(e, pr.damage, owner);
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

  // --- Health crates ---

  private spawnCrates(dt: number, alive: Player[]): void {
    this.crateTimer -= dt;
    if (this.crateTimer > 0 || alive.length === 0) return;
    this.crateTimer = CRATE_INTERVAL;
    if (this.pickups.filter((c) => c.kind === PickupKind.Crate).length >= MAX_CRATES) return;
    const { x, y } = this.pointNear(alive, 300, 600);
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
      const p = g.target;
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d < PLAYER_RADIUS) {
        g.collected = true;
        this.giveXp(g.value);
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
      this.pendingLevels++;
    }
  }

  private xpNext(): number {
    return xpToNext(this.level, Math.max(1, this.players.size));
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
      orbit: p.upgrades.orbit ?? 0,
      kills: p.kills,
      choosing: p.options !== null,
      invuln: p.invuln > 0,
      hurt: p.hurtUntil > this.time,
    }));
    const enemies: number[] = [];
    for (const e of this.enemies) {
      const flags = (e.flashUntil > this.time ? EnemyFlag.Hit : 0) | (e.mode === Mode.Windup ? EnemyFlag.WindingUp : 0);
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
      hazards.push(h.id, h.kind, Math.round(h.x), Math.round(h.y), round2(h.a), Math.round(h.b), round2(Math.min(1, h.t / h.duration)));
    }

    const shared: Omit<Snapshot, 'me'> = {
      t: 'snap',
      tick: this.tickCount,
      phase: this.phase,
      pause: this.pause && { kind: this.pause.kind, timeLeft: Math.max(0, Math.round(this.pause.timeLeft * 10) / 10) },
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
    return {
      options: p.options,
      upgrades: p.upgrades,
      speed: stats.speed,
      dodgeCooldown: stats.dodgeCooldown,
      epoch: p.epoch,
    };
  }
}
