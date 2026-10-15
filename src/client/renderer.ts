import { Application, BitmapFont, BitmapText, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { CHARACTER_IDS, type CharacterId, REWIND_SECONDS } from '../shared/characters';
import { BOMB, BOSS_INTRO, COIN, CRATE_RADIUS, DODGE_SPEED, HEART_RADIUS, PLAYER_RADIUS, REVIVE_RADIUS } from '../shared/constants';
import { DAMAGE_COLORS, DAMAGE_TYPES } from '../shared/upgrades';
import { AFFIXES, CHAMPION, ENEMY_TYPES, EnemyType } from '../shared/enemies';
import { NO_ROTATE, drawEnemy, shade } from './enemyArt';
import { TILE, decorations, drawWalls, groundTile } from './mapArt';
import { MAPS } from '../shared/maps';
import { Minimap } from './minimap';
import { portraitUrl } from './portraits';
import { RALLY_RADIUS, SHRINES, SHRINE_RADIUS, ShrineKind } from '../shared/objectives';
import {
  ENEMY_SHOT_STRIDE,
  ENEMY_STRIDE,
  EnemyFlag,
  GEM_STRIDE,
  HAZARD_STRIDE,
  HazardKind,
  PICKUP_STRIDE,
  PROJECTILE_STRIDE,
  PickupKind,
  ProjectileKind,
  SHRINE_STRIDE,
  ZONE_STRIDE,
  ZoneKind,
  type Fx,
  type PlayerState,
  type Snapshot,
  SUMMON_STRIDE,
  SummonKind,
  AFFIX_SHIFT,
} from '../shared/protocol';
import { fieldRadius, orbitLayout } from '../shared/characters';
import type { Sample } from './snapshots';

const MAX_PARTICLES = 800;
const DANGER = 0xff1744;
const STUNNED = 0x90caf9;
/** Damage numbers: [x, y, amount, crit, type] per hit. */
const HIT_STRIDE = 5;
const CRIT_COLOR = 0xffd740;
const FIRE = 0xff3d00;
const HEALTH_GREEN = 0x00e676;
const QUEST_COLOR = 0xffee58;
const DAMAGE_FONT = 'DamageNumbers';
const MAX_DAMAGE_NUMBERS = 80;
/** Seconds a damage number stays on screen. */
const NUMBER_LIFE = 0.75;

interface DamageNumber {
  label: BitmapText;
  /** Base scale (crits are bigger). */
  size: number;
  life: number;
  vx: number;
}
/** Off-screen objective arrows stay this far inside the screen edge. */
const POINTER_MARGIN = 28;
/** Downed players: their red cross and revive zone, and their body grayed out. */
const DOWNED_RED = 0xff1744;
const DOWNED_TINT = 0x8a8f99;
/** Heroes are drawn as round portrait tokens, a little bigger than their hitbox so the faces read. */
const TOKEN_R = PLAYER_RADIUS + 4;
/** Resolution of the token textures (they're drawn at TOKEN_R * 2). */
const TOKEN_TEX = 128;
/** Walk cycle: radians of stride per pixel moved (a full step every ~30px). */
const STRIDE_PER_PX = 0.21;
/** Moving faster than this (a dodge, a leap) leaves wind streaks behind. Walking never gets near it. */
const WIND_SPEED = DODGE_SPEED * 0.6;
/** How long a ping stays on the map, in seconds. */
const PING_LIFE = 4;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Point {
  x: number;
  y: number;
}

interface PointView {
  sprite: Sprite;
  seen: number;
  /** Face the direction of travel. */
  rotate?: boolean;
  /** Keep spinning (the shuriken). */
  spin?: boolean;
}

/** Enemies and pickups: the type/kind is kept for the death effect. */
interface TypedView extends PointView {
  type: number;
}

interface EnemyView extends TypedView {
  /** Which way it faces (smoothed), in radians. */
  facing: number;
}

interface PlayerView {
  root: Container;
  bladeLayer: Container;
  blades: Sprite[];
  /** On the ground: a shadow and two feet. */
  shadow: Graphics;
  feet: Graphics;
  /** The bit that bobs and sways: the portrait token, its ring, and a white flash when hit. */
  avatar: Container;
  token: Sprite;
  ring: Graphics;
  flash: Graphics;
  bars: Graphics;
  /** Walk cycle phase, how much they're walking (0 idle to 1), and which way they face (1 right, -1 left). */
  walk: number;
  moving: number;
  facing: number;
  turn: number;
  last: Point;
  ringColor: number;
  /** Moving at dash speed last frame (the first frame of a dash also leaves a puff of air). */
  dashing: boolean;
  seen: number;
}

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface ShrineView {
  root: Container;
  /** Redrawn every frame: base circle and capture progress. */
  dial: Graphics;
  seen: number;
}

/** A short-lived drawing (slam ring, slash, lightning...). `draw` gets progress from 0 to 1. */
interface Ping {
  x: number;
  y: number;
  color: number;
  /** performance.now() when it arrived. */
  start: number;
  root: Container;
  marker: Graphics;
}

interface Effect {
  g: Graphics;
  life: number;
  maxLife: number;
  draw: (g: Graphics, progress: number) => void;
}

export class GameRenderer {
  readonly app = new Application();
  /** Called when an enemy disappears mid-run (died), e.g. to play a sound. */
  onEnemyDeath: (x: number, y: number, big: boolean) => void = () => {};

  private world = new Container();
  private background!: TilingSprite;
  /** The map's glowing bits (lava, embers), pulsed every frame. */
  private mapGlow: Graphics | null = null;
  private layers = {
    shrines: new Container(),
    hazards: new Container(),
    pickups: new Container(),
    gems: new Container(),
    enemies: new Container(),
    players: new Container(),
    projectiles: new Container(),
    enemyShots: new Container(),
    fx: new Container(),
    numbers: new Container(),
  };
  private tex!: {
    wolf: Texture;
    treant: Texture;
    enemies: Texture[];
    enemyFlash: Texture[];
    tokens: Record<CharacterId, Texture>;
    aimArrow: Texture;
    bolt: Texture;
    knife: Texture;
    shuriken: Texture;
    hex: Texture;
    mine: Texture;
    enemyShot: Texture;
    blade: Texture;
    gemSmall: Texture;
    gemBig: Texture;
    crate: Texture;
    heart: Texture;
    coin: Texture;
    bomb: Texture;
    particle: Texture;
  };
  private aimArrow!: Sprite;
  /** Floor outside the map edge plus the walls; rebuilt when the map changes. */
  private mapLayer = new Container();
  private mapIndex = -1;
  private arenaRing = new Graphics();
  /** Red tint over everything outside the boss arena while the zone burns. */
  private zone = new Graphics();
  private minimap = new Minimap();
  private questMarker = new Graphics();
  /** Chronobreak preview: where you've been (game time, position), and a ghost where the ult would take you. */
  private rewindTrail = new Graphics();
  private rewindPath: { t: number; x: number; y: number }[] = [];
  private rewindEpoch = -1;
  /** Screen-space arrows pointing at off-screen shrines and quest targets. */
  private pointers = new Container();
  /** Shift-click pings from the team: a marker with the pinger's name, for a few seconds. */
  private pings: Ping[] = [];

  private frame = 0;
  private artCache = new Map<number, string>();
  private shrineViews = new Map<number, ShrineView>();
  private spritePool: Sprite[] = [];
  private enemyViews = new Map<number, EnemyView>();
  private pickupViews = new Map<number, TypedView>();
  private projectileViews = new Map<number, PointView>();
  private summonViews = new Map<number, PointView>();
  private enemyShotViews = new Map<number, PointView>();
  private gemViews = new Map<number, PointView>();
  private playerViews = new Map<number, PlayerView>();
  private hazardViews = new Map<number, { g: Graphics; seen: number }>();
  /** Venom puddles are drawn together in one graphic; mines are sprites. */
  private venom = new Graphics();
  /** Boss shields and mission-target markers, redrawn every frame. */
  private marks = new Graphics();
  private mineViews = new Map<number, PointView>();
  private particles: Particle[] = [];
  private effects: Effect[] = [];
  private numbers: DamageNumber[] = [];
  private numberPool: BitmapText[] = [];

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: window,
      background: 0x14161b,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
    });
    parent.appendChild(this.app.canvas);

    // Most textures are white so one texture can be tinted to any color (enemies have their own art).
    this.tex = {
      enemies: ENEMY_TYPES.map((_, type) => this.enemyTexture(type, false)),
      enemyFlash: ENEMY_TYPES.map((_, type) => this.enemyTexture(type, true)),
      tokens: await this.tokenTextures(),
      aimArrow: this.texture(new Graphics().poly([0, -6, 10, 0, 0, 6]).fill({ color: 0xffffff, alpha: 0.85 })),
      bolt: this.texture(new Graphics().circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.3 }).circle(0, 0, 5).fill(0xffffff)),
      knife: this.texture(new Graphics().poly([-9, -2, 7, -2, 12, 0, 7, 2, -9, 2]).fill(0xffffff)),
      shuriken: this.texture(this.starShape(new Graphics(), 20, 7, 4).fill(0xffffff).circle(0, 0, 4).fill(0x263238)),
      hex: this.texture(new Graphics().circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.25 }).poly(this.hexagon(6)).fill(0xffffff)),
      // Mines keep their own colors: dark casing with a red light.
      mine: this.texture(new Graphics().circle(0, 0, 9).fill(0x37474f).stroke({ width: 2, color: 0xffab40 }).circle(0, 0, 3).fill(0xff1744)),
      enemyShot: this.texture(new Graphics().circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.3 }).circle(0, 0, 6).fill(0xffffff)),
      blade: this.texture(new Graphics().poly([0, -14, 5, 0, 0, 14, -5, 0]).fill(0xffffff)),
      // Wolves point where they run; treants are a leafy crown.
      wolf: this.texture(new Graphics().poly([14, 0, -9, -8, -4, 0, -9, 8]).fill(0xffffff).stroke({ width: 1.5, color: 0x1b5e20 })),
      treant: this.texture(this.starShape(new Graphics(), 28, 20, 7).fill(0xffffff).circle(0, 0, 9).fill(0x4e342e)),
      gemSmall: this.texture(new Graphics().poly([0, -7, 5, 0, 0, 7, -5, 0]).fill(0xffffff)),
      gemBig: this.texture(new Graphics().poly([0, -11, 8, 0, 0, 11, -8, 0]).fill(0xffffff)),
      // Loot: a wooden crate, the green cross (healing) and gold coins that come out of it, and bombs. Own colors.
      crate: this.texture(this.crateShape()),
      heart: this.texture(this.crossShape(new Graphics(), HEART_RADIUS, 4.5, HEALTH_GREEN, 0xffffff)),
      coin: this.texture(
        new Graphics()
          .circle(0, 0, COIN.radius)
          .fill(0xffc107)
          .stroke({ width: 1.5, color: 0x8d5b00 })
          .circle(0, 0, COIN.radius * 0.55)
          .stroke({ width: 1.2, color: 0xffecb3 }),
      ),
      bomb: this.texture(
        new Graphics()
          .circle(0, 0, BOMB.radius + 3)
          .fill({ color: 0xff1744, alpha: 0.25 })
          .circle(0, 0, BOMB.radius)
          .fill(0x263238)
          .stroke({ width: 2, color: 0x000000 })
          .circle(-4, -4, 4)
          .fill({ color: 0xffffff, alpha: 0.25 })
          .rect(-3, -BOMB.radius - 4, 6, 5)
          .fill(0x546e7a)
          .moveTo(0, -BOMB.radius - 4)
          .quadraticCurveTo(6, -BOMB.radius - 10, 3, -BOMB.radius - 14)
          .stroke({ width: 2, color: 0x8d6e63 })
          .circle(3, -BOMB.radius - 15, 3)
          .fill(0xffab40),
      ),
      particle: this.texture(new Graphics().rect(0, 0, 4, 4).fill(0xffffff)),
    };
    // A bitmap font for damage numbers: hundreds of them a second would be slow as regular text.
    BitmapFont.install({
      name: DAMAGE_FONT,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 32, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x000000, width: 5 } },
      chars: [['0', '9'], '-!EVAD'],
      resolution: 2,
    });
    this.aimArrow = new Sprite(this.tex.aimArrow);
    this.aimArrow.anchor.set(0.5);

    this.background = new TilingSprite({ texture: Texture.EMPTY, width: 1, height: 1 });
    this.world.addChild(this.mapLayer, this.arenaRing, this.questMarker, this.rewindTrail, ...Object.values(this.layers), this.zone, this.aimArrow);
    this.app.stage.addChild(this.background, this.world, this.pointers, this.minimap.container);
  }

  /** An enemy's sprite as an image (for the bestiary), made once per type. */
  enemyArt(type: number): string {
    let url = this.artCache.get(type);
    if (!url) {
      const canvas = this.app.renderer.extract.canvas(this.tex.enemies[type]) as HTMLCanvasElement;
      url = canvas.toDataURL();
      this.artCache.set(type, url);
    }
    return url;
  }

  /** Floor, map edge and walls in the map's colors. */
  private setMap(index: number): void {
    this.mapIndex = index;
    const map = MAPS[index];
    const { theme } = map;

    const old = this.background.texture;
    const tile = groundTile(index, map);
    this.background.texture = this.app.renderer.generateTexture({ target: tile, frame: new Rectangle(0, 0, TILE, TILE) });
    tile.destroy();
    if (old !== Texture.EMPTY) old.destroy(true);

    for (const child of this.mapLayer.removeChildren()) child.destroy();
    // Darken everything outside the map and outline its edge.
    const pad = 4000;
    const outside = new Graphics()
      .rect(-pad, -pad, map.width + pad * 2, pad)
      .rect(-pad, map.height, map.width + pad * 2, pad)
      .rect(-pad, 0, pad, map.height)
      .rect(map.width, 0, pad, map.height)
      .fill({ color: theme.outside, alpha: 0.85 })
      .rect(0, 0, map.width, map.height)
      .stroke({ width: 6, color: theme.wallEdge });

    // Floor decorations and landmarks, then the walls on top. All drawn once.
    const decor = decorations(index, map);
    this.mapGlow = decor.glow;
    this.mapLayer.addChild(decor.still, decor.glow, outside, drawWalls(map));
  }

  /** The boss arena: a faint ring until the boss shows up, then a glowing barrier, plus the burning zone outside. */
  private renderArena(snap: Snapshot): void {
    const arena = snap.arena;
    const ring = this.arenaRing.clear();
    const zone = this.zone.clear();
    if (!arena) return;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
    ring.circle(arena.x, arena.y, arena.r);
    if (arena.state === 'idle') ring.stroke({ width: 4, color: DANGER, alpha: 0.25 });
    else if (arena.state === 'gather') ring.fill({ color: DANGER, alpha: 0.05 }).stroke({ width: 6, color: DANGER, alpha: 0.5 + 0.5 * pulse });
    else ring.stroke({ width: 8, color: 0xff8a80, alpha: 0.9 });
    if (arena.state !== 'idle') {
      // The burning zone: everything beyond the safe circle glows with fire, with a flickering front line.
      const map = MAPS[snap.map];
      const flicker = 0.5 + 0.5 * Math.sin(performance.now() / 70);
      zone
        .rect(-200, -200, map.width + 400, map.height + 400)
        .fill({ color: FIRE, alpha: 0.16 + 0.04 * pulse })
        .circle(arena.x, arena.y, arena.safeR)
        .cut();
      zone
        .circle(arena.x, arena.y, arena.safeR)
        .stroke({ width: 14, color: FIRE, alpha: 0.35 + 0.25 * flicker })
        .circle(arena.x, arena.y, arena.safeR)
        .stroke({ width: 3, color: 0xffd180, alpha: 0.9 });
    }
  }

  /** Whose camera to follow while you're down (null = your own). */
  private spectateId: number | null = null;

  spectate(id: number | null): void {
    this.spectateId = id;
  }

  /**
   * A boss's entrance: pan from the player to the boss, hold there (with a shake when it roars), and pan back.
   * Timed in real seconds, like the server's slow motion.
   */
  private intro: { x: number; y: number; start: number } | null = null;

  private introCamera(follow: Point): Point {
    if (!this.intro) return follow;
    const { panIn, hold, ease, panOut } = BOSS_INTRO;
    const t = (performance.now() - this.intro.start) / 1000;
    const end = hold + ease;
    if (t >= end) {
      this.intro = null;
      return follow;
    }
    const smooth = (x: number) => x * x * (3 - 2 * x);
    // In, hold, then back out, finishing as the game reaches full speed.
    const k = t < panIn ? smooth(t / panIn) : t < end - panOut ? 1 : smooth((end - t) / panOut);
    // The roar shakes the screen for a moment.
    const shake = t > panIn && t < panIn + 0.6 ? 8 * (1 - (t - panIn) / 0.6) : 0;
    return {
      x: follow.x + (this.intro.x - follow.x) * k + (Math.random() - 0.5) * shake,
      y: follow.y + (this.intro.y - follow.y) * k + (Math.random() - 0.5) * shake,
    };
  }

  addFx(fx: Fx): void {
    switch (fx.k) {
      case 'ping': {
        const root = new Container();
        const marker = new Graphics();
        const label = new Text({
          text: fx.name,
          style: { fontFamily: 'system-ui, sans-serif', fontSize: 14, fontWeight: '700', fill: fx.color, stroke: { color: 0x000000, width: 4 } },
        });
        label.anchor.set(0.5, 1);
        label.y = -34;
        root.addChild(marker, label);
        root.position.set(fx.x, fx.y);
        this.layers.numbers.addChild(root);
        this.pings.push({ x: fx.x, y: fx.y, color: fx.color, start: performance.now(), root, marker });
        break;
      }
      case 'intro': {
        this.intro = { x: fx.x, y: fx.y, start: performance.now() };
        // A shockwave from the boss as the camera arrives.
        for (const [delay, color] of [[0, 0xff5252], [0.15, 0xffd180]] as const) {
          this.addEffect(fx.x, fx.y, 1.2 + delay, (g, p) => {
            const q = Math.max(0, (p * (1.2 + delay) - delay - 0.35) / 0.85);
            if (q <= 0) return;
            g.circle(0, 0, 60 + 520 * q).stroke({ width: 10 * (1 - q) + 2, color, alpha: 1 - q });
          });
        }
        break;
      }
      case 'ring':
        this.addEffect(fx.x, fx.y, 0.35, (g, p) =>
          g
            .circle(0, 0, fx.r * (0.3 + 0.7 * p))
            .fill({ color: fx.c, alpha: 0.12 * (1 - p) })
            .stroke({ width: 1 + 5 * (1 - p), color: fx.c, alpha: 1 - p }),
        );
        break;
      case 'boom':
        this.burst(fx.x, fx.y, 0xff7043, 16);
        this.addEffect(fx.x, fx.y, 0.3, (g, p) =>
          g
            .circle(0, 0, fx.r * (0.6 + 0.4 * p))
            .fill({ color: 0xff7043, alpha: 0.45 * (1 - p) })
            .stroke({ width: 4, color: 0xffcc80, alpha: 1 - p }),
        );
        break;
      case 'slash': {
        const start = fx.a - fx.arc / 2;
        const end = fx.a + fx.arc / 2;
        this.addEffect(fx.x, fx.y, 0.18, (g, p) =>
          g
            .moveTo(0, 0)
            .arc(0, 0, fx.r, start, end)
            .lineTo(0, 0)
            .fill({ color: fx.c, alpha: 0.35 * (1 - p) })
            .moveTo(Math.cos(start) * fx.r, Math.sin(start) * fx.r)
            .arc(0, 0, fx.r, start, end)
            .stroke({ width: 1 + 4 * (1 - p), color: 0xffffff, alpha: 1 - p }),
        );
        break;
      }
      case 'cast':
        // A friendly target circle that fills up until the hit lands.
        this.addEffect(fx.x, fx.y, fx.t, (g, p) =>
          g
            .circle(0, 0, fx.r)
            .fill({ color: fx.c, alpha: 0.08 })
            .stroke({ width: 3, color: fx.c, alpha: 0.8 })
            .circle(0, 0, fx.r * p)
            .fill({ color: fx.c, alpha: 0.25 }),
        );
        break;
      case 'zap': {
        // A jagged bolt from the sky down to the target.
        const points: number[] = [];
        for (let i = 0; i <= 6; i++) points.push(i === 6 ? 0 : (Math.random() - 0.5) * 28, -260 + (260 * i) / 6);
        this.addEffect(fx.x, fx.y, 0.22, (g, p) =>
          g
            .poly(points, false)
            .stroke({ width: 3, color: 0xe1f5fe, alpha: 1 - p })
            .circle(0, 0, 10 + 30 * p)
            .stroke({ width: 3, color: 0x80d8ff, alpha: 1 - p }),
        );
        break;
      }
    }
  }

  /** `aim` is your cursor angle, or null to hide the aim arrow. */
  /** `dt` follows the game's speed (slow motion); `realDt` is wall-clock time, for the damage numbers. */
  render(sample: Sample, myId: number | null, local: Point, aim: number | null, dt: number, realDt: number): void {
    this.frame++;
    const { a, b, t } = sample;
    if (b.snap.map !== this.mapIndex) this.setMap(b.snap.map);
    const { width, height } = this.app.screen;
    const hasMe = b.snap.players.some((p) => p.id === myId);
    // While you're down you can follow a teammate's camera instead.
    let follow: Point = hasMe ? local : MAPS[b.snap.map].spawn;
    if (this.spectateId !== null) {
      const target = b.snap.players.find((p) => p.id === this.spectateId);
      const prev = a.snap.players.find((p) => p.id === this.spectateId);
      if (target) follow = prev ? { x: lerp(prev.x, target.x, t), y: lerp(prev.y, target.y, t) } : target;
    }
    const cam = this.introCamera(follow);
    this.world.position.set(Math.round(width / 2 - cam.x), Math.round(height / 2 - cam.y));
    this.background.width = width;
    this.background.height = height;
    this.background.tilePosition.set(this.world.x, this.world.y);

    const playing = b.snap.phase === 'playing';
    if (this.mapGlow) this.mapGlow.alpha = 0.75 + 0.25 * Math.sin(performance.now() / 450);
    this.renderArena(b.snap);
    this.renderShrines(b.snap);
    this.renderQuestMarker(b.snap);
    this.renderHazards(sample);
    this.renderZones(b.snap.zones);
    this.renderEnemies(sample, playing);
    this.renderPoints(this.projectileViews, a.snap.projectiles, a.projectiles, b.snap.projectiles, PROJECTILE_STRIDE, 2, t, this.layers.projectiles, (list, i) =>
      list[i + 1] === ProjectileKind.Knife
        ? { texture: this.tex.knife, tint: 0xeceff1, rotate: true }
        : list[i + 1] === ProjectileKind.Shuriken || list[i + 1] === ProjectileKind.BigShuriken
          ? { texture: this.tex.shuriken, tint: 0xce93d8, spin: true, scale: list[i + 1] === ProjectileKind.BigShuriken ? 1.5 : 1 }
          : list[i + 1] === ProjectileKind.Fireball
          ? { texture: this.tex.bolt, tint: 0xff7043, scale: 1.7 }
          : list[i + 1] === ProjectileKind.Arrow
          ? { texture: this.tex.knife, tint: 0xdcedc8, rotate: true, scale: 1.4 }
          : list[i + 1] === ProjectileKind.Hex
            ? { texture: this.tex.hex, tint: 0xea80fc, spin: true }
            : { texture: this.tex.bolt, tint: 0xb3e5fc },
    );
    this.renderPoints(this.summonViews, a.snap.summons, a.summons, b.snap.summons, SUMMON_STRIDE, 2, t, this.layers.projectiles, (list, i) =>
      list[i + 1] === SummonKind.Treant ? { texture: this.tex.treant, tint: 0x6d8f3a } : { texture: this.tex.wolf, tint: 0xa5d6a7, rotate: true },
    );
    this.renderPoints(this.enemyShotViews, a.snap.enemyShots, a.enemyShots, b.snap.enemyShots, ENEMY_SHOT_STRIDE, 1, t, this.layers.enemyShots, () => ({
      texture: this.tex.enemyShot,
      tint: 0xd4e157,
    }));
    this.renderPoints(this.gemViews, a.snap.gems, a.gems, b.snap.gems, GEM_STRIDE, 1, t, this.layers.gems, (list, i) =>
      list[i + 3] ? { texture: this.tex.gemBig, tint: 0xb388ff } : { texture: this.tex.gemSmall, tint: 0x69f0ae },
    );
    this.renderPickups(sample, playing);
    this.renderRewindTrail(b.snap, myId, local);
    this.renderPlayers(sample, myId, local, aim, realDt);

    this.aimArrow.visible = hasMe && aim !== null;
    if (aim !== null) {
      const r = PLAYER_RADIUS + 14;
      this.aimArrow.position.set(local.x + Math.cos(aim) * r, local.y + Math.sin(aim) * r);
      this.aimArrow.rotation = aim;
    }
    this.renderPings();
    this.renderPointers(b.snap, myId);
    this.minimap.update(b.snap, myId, cam, { x: cam.x - width / 2, y: cam.y - height / 2, w: width, h: height }, width, this.pings);
    this.updateEffects(dt);
    this.updateDamageNumbers(realDt);
  }

  // --- Objectives ---

  private renderShrines(snap: Snapshot): void {
    const list = snap.shrines;
    for (let i = 0; i < list.length; i += SHRINE_STRIDE) {
      const [id, kind, x, y, progress] = list.slice(i, i + SHRINE_STRIDE);
      const view = this.shrineViews.get(id) ?? this.createShrineView(id, kind, x, y);
      view.seen = this.frame;
      const color = SHRINES[kind].color;
      const r = SHRINE_RADIUS;
      // Fills clockwise from the top as the team stands in it.
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * progress;
      const g = view.dial.clear();
      g.circle(0, 0, r)
        .fill({ color, alpha: 0.07 })
        .stroke({ width: 3, color, alpha: 0.6 });
      if (progress > 0) {
        g.moveTo(0, 0).arc(0, 0, r, start, end).lineTo(0, 0).fill({ color, alpha: 0.28 });
        g.moveTo(Math.cos(start) * r, Math.sin(start) * r).arc(0, 0, r, start, end).stroke({ width: 6, color });
      }
    }
    for (const [id, view] of this.shrineViews) {
      if (view.seen === this.frame) continue;
      view.root.destroy({ children: true });
      this.shrineViews.delete(id);
    }
  }

  private createShrineView(id: number, kind: number, x: number, y: number): ShrineView {
    const root = new Container();
    root.position.set(x, y);
    const dial = new Graphics();
    const icon = new Graphics();
    const color = SHRINES[kind].color;
    switch (kind) {
      case ShrineKind.Forge: // A sword.
        icon.rect(-3, -26, 6, 36).rect(-12, 8, 24, 5).rect(-2.5, 13, 5, 12).fill(color);
        icon.rotation = Math.PI / 4;
        break;
      case ShrineKind.Event: // An hourglass.
        icon.poly([-14, -20, 14, -20, 0, 0]).poly([-14, 20, 14, 20, 0, 0]).fill(color);
        break;
      case ShrineKind.Sigil: // A rune: a diamond with a cross.
        icon.poly([0, -24, 18, 0, 0, 24, -18, 0]).stroke({ width: 4, color }).rect(-2, -14, 4, 28).rect(-10, -2, 20, 4).fill(color);
        break;
      default: // An exclamation mark.
        icon.roundRect(-4, -24, 8, 30, 3).circle(0, 16, 5).fill(color);
    }
    const label = new Text({
      text: SHRINES[kind].name,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 14, fontWeight: '700', fill: color, stroke: { color: 0x000000, width: 3 } },
    });
    label.anchor.set(0.5, 0);
    label.y = SHRINE_RADIUS + 6;
    root.addChild(dial, icon, label);
    this.layers.shrines.addChild(root);
    const view = { root, dial, seen: 0 };
    this.shrineViews.set(id, view);
    return view;
  }

  /** The rally point: a pulsing gold circle to gather in. */
  private renderQuestMarker(snap: Snapshot): void {
    const g = this.questMarker.clear();
    const quest = snap.quest;
    if (quest?.kind !== 'rally') return;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    g.position.set(quest.x, quest.y);
    g.circle(0, 0, RALLY_RADIUS)
      .fill({ color: QUEST_COLOR, alpha: 0.1 + 0.08 * pulse })
      .stroke({ width: 4, color: QUEST_COLOR, alpha: 0.5 + 0.5 * pulse })
      .circle(0, 0, 10)
      .fill(QUEST_COLOR);
  }

  /** Pings: rings rippling out from a pin, fading at the end. */
  private renderPings(): void {
    const now = performance.now();
    this.pings = this.pings.filter((ping) => {
      const age = (now - ping.start) / 1000;
      if (age >= PING_LIFE) {
        ping.root.destroy({ children: true });
        return false;
      }
      const fade = Math.min(1, (PING_LIFE - age) / 0.6);
      ping.root.alpha = fade;
      const g = ping.marker.clear();
      for (let i = 0; i < 2; i++) {
        const q = (age * 0.9 + i * 0.5) % 1;
        g.circle(0, 0, 14 + 46 * q).stroke({ width: 3 * (1 - q) + 1, color: ping.color, alpha: 1 - q });
      }
      // A pin that drops in with a little bounce.
      const drop = Math.max(0, 1 - age / 0.25);
      const top = -26 - 30 * drop * drop;
      g.ellipse(0, 0, 9, 4).fill({ color: 0x000000, alpha: 0.35 });
      g.poly([0, 0, -9, top + 10, 9, top + 10]).fill(ping.color);
      g.circle(0, top + 6, 10).fill(ping.color).stroke({ width: 2.5, color: 0xffffff });
      g.circle(0, top + 6, 3.5).fill(0xffffff);
      return true;
    });
  }

  /** Screen point to world point. Points on the minimap give the map spot under them. */
  screenToWorld(sx: number, sy: number): Point {
    return this.minimap.toWorld(sx, sy) ?? { x: sx - this.world.x, y: sy - this.world.y };
  }

  /** Arrows on the screen edge toward objectives you can't see. */
  private renderPointers(snap: Snapshot, myId: number | null): void {
    for (const child of [...this.pointers.children]) this.release(child as Sprite);
    if (snap.phase !== 'playing') return;
    const targets: { x: number; y: number; color: number }[] = [];
    for (let i = 0; i < snap.shrines.length; i += SHRINE_STRIDE) {
      targets.push({ x: snap.shrines[i + 2], y: snap.shrines[i + 3], color: SHRINES[snap.shrines[i + 1]].color });
    }
    if (snap.quest) targets.push({ x: snap.quest.x, y: snap.quest.y, color: QUEST_COLOR });
    const inArena = snap.players.find((p) => p.id === myId)?.inArena;
    if (snap.arena && snap.arena.state !== 'idle' && !inArena) targets.push({ x: snap.arena.x, y: snap.arena.y, color: DANGER });
    // Downed teammates who need you.
    for (const p of snap.players) if (p.downed && p.id !== myId) targets.push({ x: p.x, y: p.y, color: DOWNED_RED });
    for (const ping of this.pings) targets.push(ping);

    const { width, height } = this.app.screen;
    const cx = width / 2;
    const cy = height / 2;
    for (const target of targets) {
      const sx = target.x + this.world.x;
      const sy = target.y + this.world.y;
      if (sx > 0 && sx < width && sy > 0 && sy < height) continue;
      const angle = Math.atan2(sy - cy, sx - cx);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // Walk from the center toward the target until we hit the (inset) screen edge.
      const reach = Math.min((cx - POINTER_MARGIN) / Math.abs(cos || 1e-6), (cy - POINTER_MARGIN) / Math.abs(sin || 1e-6));
      const arrow = this.acquire(this.tex.aimArrow, this.pointers);
      arrow.position.set(cx + cos * reach, cy + sin * reach);
      arrow.rotation = angle;
      arrow.scale.set(2);
      arrow.tint = target.color;
    }
  }

  // --- Entities ---

  private renderEnemies({ a, b, t }: Sample, showDeaths: boolean): void {
    const listA = a.snap.enemies;
    const listB = b.snap.enemies;
    const now = performance.now();
    const blink = Math.floor(now / 80) % 2 === 0;
    const pulse = 0.5 + 0.5 * Math.sin(now / 180);
    const marks = this.marks.clear();
    if (!marks.parent) this.layers.enemies.addChild(marks);
    else this.layers.enemies.setChildIndex(marks, this.layers.enemies.children.length - 1);
    for (let i = 0; i < listB.length; i += ENEMY_STRIDE) {
      const id = listB[i];
      const type = listB[i + 1];
      let x = listB[i + 2];
      let y = listB[i + 3];
      const flags = listB[i + 4];
      const j = a.enemies.get(id);
      if (j !== undefined) {
        x = lerp(listA[j + 2], x, t);
        y = lerp(listA[j + 3], y, t);
      }
      let view = this.enemyViews.get(id);
      if (!view) {
        view = { sprite: this.acquire(this.tex.enemies[type], this.layers.enemies), type, seen: 0, facing: Math.random() * Math.PI * 2 };
        if (type === EnemyType.Wraith) view.sprite.alpha = 0.85;
        this.enemyViews.set(id, view);
      }
      view.seen = this.frame;
      view.sprite.position.set(x, y);
      // Turn toward where it's walking (smoothly), and bob along while it moves.
      let moving = false;
      if (j !== undefined) {
        const dx = listB[i + 2] - listA[j + 2];
        const dy = listB[i + 3] - listA[j + 3];
        moving = dx * dx + dy * dy > 0.25;
        if (moving && !NO_ROTATE.has(type)) {
          const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - view.facing), Math.cos(Math.atan2(dy, dx) - view.facing));
          view.facing += diff * 0.25;
        }
      }
      view.sprite.rotation = NO_ROTATE.has(type) ? 0 : view.facing;
      // Winding up a charge: swell and blink as a warning.
      const windingUp = (flags & EnemyFlag.WindingUp) !== 0;
      const affix = flags >> AFFIX_SHIFT;
      const size = (windingUp ? 1.15 : 1) * (affix ? CHAMPION.size : 1);
      const bob = moving ? Math.sin(now / 75 + id) * 0.06 : 0;
      view.sprite.scale.set(size * (1 + bob), size * (1 - bob));
      // Hit: the white silhouette. Stunned: tinted icy blue.
      const white = (flags & EnemyFlag.Hit) !== 0 || (windingUp && blink);
      view.sprite.texture = white ? this.tex.enemyFlash[type] : this.tex.enemies[type];
      view.sprite.tint = (flags & EnemyFlag.Stunned) !== 0 ? STUNNED : 0xffffff;
      const r = ENEMY_TYPES[type].radius;
      // A shimmering bubble on shielded bosses; a gold ring on enemies a side mission needs dead.
      if (flags & EnemyFlag.Shielded) {
        marks.circle(x, y, r + 14).fill({ color: 0xe040fb, alpha: 0.12 + 0.08 * pulse }).stroke({ width: 3, color: 0xea80fc, alpha: 0.5 + 0.4 * pulse });
      }
      if (flags & EnemyFlag.Marked) marks.circle(x, y, r + 6).stroke({ width: 2.5, color: 0xffd54f, alpha: 0.5 + 0.5 * pulse });
      // Champions: bigger, with a ring in their affix's color.
      if (affix) {
        marks.circle(x, y, r * CHAMPION.size + 5).stroke({ width: 3, color: AFFIXES[affix].color, alpha: 0.6 + 0.4 * pulse });
      }
    }
    // Enemies that vanished died (or the run reset).
    for (const [id, view] of this.enemyViews) {
      if (view.seen === this.frame) continue;
      if (showDeaths) {
        const big = ENEMY_TYPES[view.type].radius >= 50;
        this.burst(view.sprite.x, view.sprite.y, ENEMY_TYPES[view.type].color, big ? 40 : 6);
        this.onEnemyDeath(view.sprite.x, view.sprite.y, big);
      }
      this.release(view.sprite);
      this.enemyViews.delete(id);
    }
  }

  /** Players' venom puddles (green pools) and mines (blinking once armed). */
  private renderZones(list: number[]): void {
    const venom = this.venom.clear();
    if (!venom.parent) this.layers.hazards.addChildAt(venom, 0);
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    for (let i = 0; i < list.length; i += ZONE_STRIDE) {
      const [id, kind, x, y, r] = list.slice(i, i + ZONE_STRIDE);
      if (kind === ZoneKind.Venom) {
        venom.circle(x, y, r).fill({ color: 0x76ff03, alpha: 0.16 });
        continue;
      }
      if (kind === ZoneKind.Toxic) {
        // Toxic Pool: a murky green pool with slowly drifting bubbles.
        const t = performance.now() / 1000;
        venom.circle(x, y, r).fill({ color: 0x558b2f, alpha: 0.22 }).circle(x, y, r).stroke({ width: 2, color: 0x9ccc65, alpha: 0.45 });
        for (let b = 0; b < 6; b++) {
          const a = id * 1.7 + b * 1.05 + t * 0.15;
          const d = r * (0.25 + 0.6 * ((b * 0.37 + id * 0.13) % 1));
          const pop = (t * 0.8 + b * 0.31) % 1;
          venom.circle(x + Math.cos(a) * d, y + Math.sin(a) * d, 3 + 6 * pop).stroke({ width: 1.5, color: 0xc5e1a5, alpha: 0.5 * (1 - pop) });
        }
        continue;
      }
      if (kind === ZoneKind.Holy) {
        // Hallowed ground: a soft golden glow with a pulsing rim.
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260 + id);
        venom
          .circle(x, y, r)
          .fill({ color: 0xffe082, alpha: 0.12 + 0.05 * pulse })
          .circle(x, y, r)
          .stroke({ width: 3, color: 0xfff59d, alpha: 0.35 + 0.3 * pulse })
          .circle(x, y, r * 0.6)
          .stroke({ width: 1.5, color: 0xfff59d, alpha: 0.25 });
        continue;
      }
      if (kind === ZoneKind.Fire) {
        const flicker = 0.5 + 0.5 * Math.sin(performance.now() / 90 + id);
        venom.circle(x, y, r).fill({ color: 0xff6d00, alpha: 0.14 + 0.06 * flicker }).circle(x, y, r * 0.55).fill({ color: 0xffab40, alpha: 0.1 });
        continue;
      }
      let view = this.mineViews.get(id);
      if (!view) {
        view = { sprite: this.acquire(this.tex.mine, this.layers.pickups), seen: 0 };
        view.sprite.position.set(x, y);
        this.mineViews.set(id, view);
      }
      view.seen = this.frame;
      view.sprite.alpha = blink ? 1 : 0.7;
    }
    for (const [id, view] of this.mineViews) {
      if (view.seen === this.frame) continue;
      this.release(view.sprite);
      this.mineViews.delete(id);
    }
  }

  /** Telegraphed attacks: red zones that fill up until they go off. */
  private renderHazards({ b }: Sample): void {
    const list = b.snap.hazards;
    for (let i = 0; i < list.length; i += HAZARD_STRIDE) {
      const id = list[i];
      let view = this.hazardViews.get(id);
      if (!view) {
        view = { g: new Graphics(), seen: 0 };
        this.layers.hazards.addChild(view.g);
        this.hazardViews.set(id, view);
      }
      view.seen = this.frame;
      const [kind, x, y, ha, hb, w, progress] = list.slice(i + 1, i + HAZARD_STRIDE);
      const g = view.g.clear();
      g.position.set(x, y);
      if (kind === HazardKind.Circle) {
        g.rotation = 0;
        g.circle(0, 0, ha)
          .fill({ color: DANGER, alpha: 0.1 })
          .stroke({ width: 2, color: DANGER, alpha: 0.7 })
          .circle(0, 0, ha * progress)
          .fill({ color: DANGER, alpha: 0.25 });
      } else {
        g.rotation = ha;
        g.rect(0, -w / 2, hb, w)
          .fill({ color: DANGER, alpha: 0.08 + 0.12 * progress })
          .stroke({ width: 2, color: DANGER, alpha: 0.6 })
          .rect(0, -w / 2, hb * progress, w)
          .fill({ color: DANGER, alpha: 0.15 });
      }
    }
    for (const [id, view] of this.hazardViews) {
      if (view.seen === this.frame) continue;
      view.g.destroy();
      this.hazardViews.delete(id);
    }
  }

  private renderPickups({ a, b, t }: Sample, showBreaks: boolean): void {
    const list = b.snap.pickups;
    const now = performance.now();
    const bob = 1 + Math.sin(now / 200) * 0.1;
    const textures = [this.tex.crate, this.tex.heart, this.tex.coin, this.tex.bomb];
    for (let i = 0; i < list.length; i += PICKUP_STRIDE) {
      const id = list[i];
      const kind = list[i + 1];
      let view = this.pickupViews.get(id);
      if (!view) {
        view = { sprite: this.acquire(textures[kind], this.layers.pickups), type: kind, seen: 0 };
        this.pickupViews.set(id, view);
      }
      view.seen = this.frame;
      let x = list[i + 2];
      let y = list[i + 3];
      // Only coins move (toward whoever picks them up), so only they need smoothing.
      if (kind === PickupKind.Coin) {
        const prev = a.snap.pickups;
        for (let j = 0; j < prev.length; j += PICKUP_STRIDE) {
          if (prev[j] !== id) continue;
          x = lerp(prev[j + 2], x, t);
          y = lerp(prev[j + 3], y, t);
          break;
        }
        // Coins spin: squash them horizontally.
        view.sprite.scale.set(Math.abs(Math.cos(now / 250 + id)) * 0.7 + 0.3, 1);
      } else if (kind === PickupKind.Heart) {
        view.sprite.scale.set(bob);
      } else if (kind === PickupKind.Bomb) {
        // The fuse fizzes: a nervous little pulse.
        view.sprite.scale.set(1 + Math.sin(now / 90 + id) * 0.05);
      } else {
        view.sprite.tint = list[i + 4] ? 0xffcdd2 : 0xffffff;
      }
      view.sprite.position.set(x, y);
    }
    for (const [id, view] of this.pickupViews) {
      if (view.seen === this.frame) continue;
      if (showBreaks) {
        if (view.type === PickupKind.Crate) this.burst(view.sprite.x, view.sprite.y, 0x8d6e63, 14);
        else if (view.type === PickupKind.Heart) this.burst(view.sprite.x, view.sprite.y, HEALTH_GREEN, 10);
        else if (view.type === PickupKind.Coin) this.burst(view.sprite.x, view.sprite.y, 0xffc107, 3);
      }
      this.release(view.sprite);
      this.pickupViews.delete(id);
    }
  }

  /** A wooden crate: planks, a cross brace and metal corners. */
  private crateShape(): Graphics {
    const r = CRATE_RADIUS;
    const g = new Graphics().rect(-r + 3, -r + 4, r * 2, r * 2).fill({ color: 0x000000, alpha: 0.3 });
    g.roundRect(-r, -r, r * 2, r * 2, 3).fill(0xa1744a).stroke({ width: 2.5, color: 0x4e342e });
    for (const y of [-r / 3, r / 3]) g.moveTo(-r + 2, y).lineTo(r - 2, y).stroke({ width: 1.5, color: 0x6d4c41 });
    g.moveTo(-r + 3, -r + 3).lineTo(r - 3, r - 3).stroke({ width: 3, color: 0x6d4c41 });
    for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.rect(cx * (r - 3) - 2.5, cy * (r - 3) - 2.5, 5, 5).fill(0x90a4ae);
    g.rect(-r + 2, -r + 2, r * 2 - 4, 3).fill({ color: 0xffffff, alpha: 0.18 });
    return g;
  }

  /**
   * Flat [id, ..., x, y, ...] lists with interpolated positions. `pos` is the offset of x within an entry.
   * `look` may ask for the sprite to face its direction of travel.
   */
  private renderPoints(
    views: Map<number, PointView>,
    listA: number[],
    indexA: Map<number, number>,
    listB: number[],
    stride: number,
    pos: number,
    t: number,
    layer: Container,
    look: (list: number[], i: number) => { texture: Texture; tint: number; rotate?: boolean; spin?: boolean; scale?: number },
  ): void {
    for (let i = 0; i < listB.length; i += stride) {
      const id = listB[i];
      const bx = listB[i + pos];
      const by = listB[i + pos + 1];
      let x = bx;
      let y = by;
      let heading: number | null = null;
      const j = indexA.get(id);
      if (j !== undefined) {
        const ax = listA[j + pos];
        const ay = listA[j + pos + 1];
        x = lerp(ax, bx, t);
        y = lerp(ay, by, t);
        if (ax !== bx || ay !== by) heading = Math.atan2(by - ay, bx - ax);
      }
      let view = views.get(id);
      if (!view) {
        const style = look(listB, i);
        const sprite = this.acquire(style.texture, layer);
        sprite.tint = style.tint;
        sprite.scale.set(style.scale ?? 1);
        view = { sprite, seen: 0, rotate: style.rotate, spin: style.spin };
        views.set(id, view);
      }
      view.seen = this.frame;
      view.sprite.position.set(x, y);
      if (view.rotate && heading !== null) view.sprite.rotation = heading;
      if (view.spin) view.sprite.rotation += 0.35;
    }
    for (const [id, view] of views) {
      if (view.seen === this.frame) continue;
      this.release(view.sprite);
      views.delete(id);
    }
  }

  /**
   * Chronobreaker only: a fading trail through the last few seconds of your movement, ending in a ghost where
   * Chronobreak would take you. Bright when the ult is ready, faint while it's cooling down.
   */
  private renderRewindTrail(snap: Snapshot, myId: number | null, local: Point): void {
    const g = this.rewindTrail.clear();
    const me = snap.players.find((p) => p.id === myId);
    if (!me || !snap.me || me.character !== 'chronobreaker' || snap.phase !== 'playing') {
      this.rewindPath = [];
      return;
    }
    // The server forgets your past when it moves you (a rewind, a respawn); so do we.
    if (snap.me.epoch !== this.rewindEpoch || me.downed) {
      this.rewindEpoch = snap.me.epoch;
      this.rewindPath = [];
    }
    const now = snap.time;
    const path = this.rewindPath;
    const last = path[path.length - 1];
    if (!last || now - last.t >= 0.05 || Math.hypot(local.x - last.x, local.y - last.y) > 6) path.push({ t: now, x: local.x, y: local.y });
    while (path.length > 1 && now - path[1].t > REWIND_SECONDS) path.shift();
    if (path.length < 2 || me.downed) return;

    const ready = snap.me.ultimate.cd <= 0;
    const strength = ready ? 1 : 0.35;
    const color = 0x80d8ff;
    // The trail fades toward the present, so the rewind end stands out.
    for (let i = 1; i < path.length; i++) {
      const age = (now - path[i].t) / REWIND_SECONDS;
      g.moveTo(path[i - 1].x, path[i - 1].y)
        .lineTo(path[i].x, path[i].y)
        .stroke({ width: 4, color, alpha: (0.2 + 0.6 * age) * strength, cap: 'round' });
    }
    // The ghost: where you'd land.
    const end = path[0];
    const pulse = ready ? 0.5 + 0.5 * Math.sin(performance.now() / 160) : 0;
    g.circle(end.x, end.y, PLAYER_RADIUS + 4)
      .fill({ color, alpha: 0.12 * strength })
      .stroke({ width: 2.5, color, alpha: (0.55 + 0.35 * pulse) * strength });
    if (ready) g.circle(end.x, end.y, PLAYER_RADIUS + 10 + pulse * 6).stroke({ width: 1.5, color, alpha: 0.35 * (1 - pulse) });
    // A little hourglass in the middle.
    const h = 7;
    g.poly([end.x - h, end.y - h, end.x + h, end.y - h, end.x, end.y, end.x + h, end.y + h, end.x - h, end.y + h, end.x, end.y]).fill({ color, alpha: 0.7 * strength });
  }

  private renderPlayers({ a, b, t }: Sample, myId: number | null, local: Point, aim: number | null, realDt: number): void {
    const time = lerp(a.snap.time, b.snap.time, t);
    for (const p of b.snap.players) {
      let x = p.x;
      let y = p.y;
      if (p.id === myId) {
        // Your own player is drawn where you are right now, not in the past.
        x = local.x;
        y = local.y;
      } else {
        const prev = a.snap.players.find((o) => o.id === p.id);
        if (prev) {
          x = lerp(prev.x, x, t);
          y = lerp(prev.y, y, t);
        }
      }
      const view = this.playerViews.get(p.id) ?? this.createPlayerView(p);
      view.seen = this.frame;
      view.root.position.set(x, y);
      view.token.texture = this.tex.tokens[p.character]; // Heroes can change in the lobby.
      this.animateAvatar(view, p, x, y, p.id === myId ? aim : null, realDt);
      // Shadow Veil: barely there (enemies can't see you at all).
      view.root.alpha = p.veiled ? 0.25 : p.invuln ? 0.5 : 1;
      this.drawBars(view.bars, p);
      this.updateBlades(view, p, time);
    }
    for (const [id, view] of this.playerViews) {
      if (view.seen === this.frame) continue;
      view.root.destroy({ children: true });
      this.playerViews.delete(id);
    }
  }

  private createPlayerView(p: PlayerState): PlayerView {
    const root = new Container();
    const bladeLayer = new Container();
    const shadow = new Graphics().ellipse(0, 0, TOKEN_R * 0.95, TOKEN_R * 0.38).fill({ color: 0x000000, alpha: 0.35 });
    shadow.y = TOKEN_R - 1;
    const feet = new Graphics();
    const avatar = new Container();
    const token = new Sprite(this.tex.tokens[p.character]);
    token.anchor.set(0.5);
    token.width = token.height = TOKEN_R * 2;
    const ring = new Graphics();
    const flash = new Graphics().circle(0, 0, TOKEN_R).fill(0xffffff);
    flash.alpha = 0;
    avatar.addChild(token, flash, ring);
    const bars = new Graphics();
    const label = new Text({
      text: p.name,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: '600', fill: 0xffffff, stroke: { color: 0x000000, width: 3 } },
    });
    label.anchor.set(0.5, 1);
    label.y = -TOKEN_R - 10;
    root.addChild(bladeLayer, shadow, feet, avatar, bars, label);
    this.layers.players.addChild(root);
    const view: PlayerView = {
      root,
      bladeLayer,
      blades: [],
      shadow,
      feet,
      avatar,
      token,
      ring,
      flash,
      bars,
      walk: 0,
      moving: 0,
      facing: 1,
      turn: 1,
      last: { x: p.x, y: p.y },
      ringColor: -1,
      dashing: false,
      seen: 0,
    };
    this.playerViews.set(p.id, view);
    return view;
  }

  /**
   * Air rushing past a dashing hero: thin streaks trailing behind them that drift back and fade, and on the first
   * frame a puff of air where they kicked off.
   */
  private windTrail(x: number, y: number, ux: number, uy: number, start: boolean): void {
    const px = -uy;
    const py = ux;
    for (let i = 0; i < 2; i++) {
      const side = (Math.random() * 2 - 1) * TOKEN_R * 1.1;
      const back = TOKEN_R * 0.4 + Math.random() * 10;
      const len = 18 + Math.random() * 22;
      const drift = 26 + Math.random() * 20;
      const width = 1.5 + Math.random() * 1.5;
      this.addEffect(x + px * side - ux * back, y + py * side - uy * back, 0.26 + Math.random() * 0.1, (g, p) => {
        const off = -drift * p;
        const l = len * (1 - 0.5 * p);
        g.moveTo(ux * off, uy * off)
          .lineTo(ux * (off - l), uy * (off - l))
          .stroke({ width: width * (1 - p) + 0.5, color: 0xe8f4ff, alpha: 0.6 * (1 - p), cap: 'round' });
      });
    }
    if (!start) return;
    for (let i = 0; i < 6; i++) {
      const angle = Math.atan2(-uy, -ux) + (Math.random() - 0.5) * 2.2;
      const speed = 20 + Math.random() * 30;
      const r = 5 + Math.random() * 5;
      this.addEffect(x - ux * TOKEN_R, y - uy * TOKEN_R, 0.4, (g, p) =>
        g
          .circle(Math.cos(angle) * speed * p, Math.sin(angle) * speed * p, r * (1 + p * 1.2))
          .fill({ color: 0xdfe9f3, alpha: 0.35 * (1 - p) }),
      );
    }
  }

  /**
   * The walking trick: the token bobs and sways in step, two feet shuffle underneath, it squashes a little on each
   * step and turns to face where it's going (or, for you, the cursor). Fallen heroes topple over and go gray.
   */
  private animateAvatar(view: PlayerView, p: PlayerState, x: number, y: number, aim: number | null, realDt: number): void {
    const dx = x - view.last.x;
    const dy = y - view.last.y;
    const dist = Math.hypot(dx, dy);
    view.last = { x, y };
    // Dashing (dodge, leap): wind streaks behind them.
    const dashing = !p.downed && dist < 120 && dist / Math.max(realDt, 1e-3) > WIND_SPEED;
    if (dashing) this.windTrail(x, y, dx / dist, dy / dist, !view.dashing);
    view.dashing = dashing;
    const walking = !p.downed && dist > 0.15 && dist < 40; // Big jumps are teleports, not steps.
    if (walking) view.walk += dist * STRIDE_PER_PX;
    view.moving += ((walking ? 1 : 0) - view.moving) * 0.2;
    if (aim !== null) view.facing = Math.cos(aim) < 0 ? -1 : 1;
    else if (Math.abs(dx) > 0.3) view.facing = dx < 0 ? -1 : 1;
    // Turning flips through a squash rather than snapping.
    view.turn += (view.facing - view.turn) * 0.45;

    const m = view.moving;
    const step = Math.sin(view.walk);
    const breathe = Math.sin(performance.now() / 420 + p.id) * 0.008;
    const bob = Math.abs(step) * 1.5 * m;
    const a = view.avatar;
    if (p.downed) {
      // Toppled over onto their side.
      a.rotation += (view.turn * 1.4 - a.rotation) * 0.2;
      a.position.set(0, 4);
      a.scale.set(1, 1);
    } else {
      a.rotation = step * 0.03 * m;
      a.position.set(0, -bob);
      const squash = (1 - Math.abs(step)) * 0.015 * m; // Flattest when a foot lands.
      a.scale.set(Math.max(0.15, Math.abs(view.turn)) * (1 + squash + breathe), 1 - squash + breathe);
    }
    // The art faces left or right as drawn; mirror it to face the other way.
    view.token.scale.x = Math.abs(view.token.scale.x) * (view.turn < 0 ? -1 : 1);
    view.token.tint = p.downed ? DOWNED_TINT : 0xffffff;
    view.flash.alpha = p.hurt ? 0.55 : 0;

    if (view.ringColor !== p.color) {
      view.ringColor = p.color;
      view.ring.clear().circle(0, 0, TOKEN_R).stroke({ width: 3.5, color: p.color }).circle(0, 0, TOKEN_R + 2).stroke({ width: 1.5, color: 0x000000, alpha: 0.6 });
    }

    // Feet: step forward and back in turn, lifting a little mid-stride; tucked away while idle or down.
    const g = view.feet.clear();
    view.shadow.scale.set(1 - bob * 0.03);
    if (p.downed) return;
    const foot = shade(p.color, -0.45);
    for (const side of [-1, 1]) {
      const swing = step * side * 5 * m;
      const lift = Math.max(0, -step * side) * 2.5 * m;
      g.ellipse(side * 7 + swing * view.turn, TOKEN_R + 1 - lift, 6, 4).fill(foot).stroke({ width: 1.5, color: 0x000000, alpha: 0.6 });
    }
  }

  private drawBars(g: Graphics, p: PlayerState): void {
    g.clear();
    // Radiant Field: a faint, flickering aura at its damage radius.
    const field = p.downed ? 0 : fieldRadius(p.upgrades, p.character);
    if (field) {
      const flicker = 0.5 + 0.5 * Math.sin(performance.now() / 90);
      g.circle(0, 0, field).fill({ color: 0xffca28, alpha: 0.06 + 0.03 * flicker }).stroke({ width: 2, color: 0xffca28, alpha: 0.25 });
    }
    // A glowing ring while a buff (Bloodrage, guard, Death Lotus) is active.
    if (p.aura) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
      g.circle(0, 0, PLAYER_RADIUS + 7).stroke({ width: 3, color: p.aura, alpha: 0.5 + 0.4 * pulse });
    }
    const width = 36;
    const y = TOKEN_R + 6;
    const ratio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    g.rect(-width / 2, y, width, 5).fill({ color: 0x000000, alpha: 0.7 });
    if (ratio > 0) g.rect(-width / 2, y, width * ratio, 5).fill(ratio > 0.35 ? 0x66bb6a : 0xef5350);
    if (p.downed) this.drawDowned(g, p);
  }

  /**
   * A downed teammate: the revive zone (stand inside it to help), a ripple calling for help, the revive progress
   * around the zone's edge, and a bobbing red cross above them that's easy to spot in a crowd.
   */
  private drawDowned(g: Graphics, p: PlayerState): void {
    const now = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 200);
    const r = REVIVE_RADIUS;
    const start = -Math.PI / 2;
    g.circle(0, 0, r)
      .fill({ color: DOWNED_RED, alpha: 0.07 + 0.05 * pulse })
      .stroke({ width: 3, color: DOWNED_RED, alpha: 0.45 + 0.35 * pulse });
    // A ripple running inward toward them.
    const q = (now / 1100) % 1;
    g.circle(0, 0, r * (1 - q) + PLAYER_RADIUS * q).stroke({ width: 2, color: 0xffffff, alpha: 0.35 * (1 - q) });
    if (p.revive > 0) {
      g.moveTo(Math.cos(start) * r, Math.sin(start) * r)
        .arc(0, 0, r, start, start + Math.PI * 2 * p.revive)
        .stroke({ width: 7, color: HEALTH_GREEN });
    }
    // The marker: a white disc with a red cross, bobbing above the name.
    const y = -PLAYER_RADIUS - 44 + Math.sin(now / 260) * 4;
    const s = 1 + 0.12 * pulse;
    g.circle(0, y, 17 * s).fill({ color: DOWNED_RED, alpha: 0.3 * pulse });
    g.circle(0, y, 13 * s).fill(0xffffff).stroke({ width: 2.5, color: DOWNED_RED });
    g.rect(-3 * s, y - 8 * s, 6 * s, 16 * s).rect(-8 * s, y - 3 * s, 16 * s, 6 * s).fill(DOWNED_RED);
  }

  private updateBlades(view: PlayerView, p: PlayerState, time: number): void {
    const stats = p.downed ? null : orbitLayout(p.upgrades, p.character);
    const count = stats?.count ?? 0;
    while (view.blades.length < count) {
      const blade = new Sprite(this.tex.blade);
      blade.anchor.set(0.5);
      blade.tint = 0xe0f7fa;
      view.bladeLayer.addChild(blade);
      view.blades.push(blade);
    }
    while (view.blades.length > count) view.blades.pop()!.destroy();
    if (!stats) return;
    view.blades.forEach((blade, i) => {
      // Same formula the server uses for hit detection.
      const angle = time * stats.spin + (i * Math.PI * 2) / count;
      blade.position.set(Math.cos(angle) * stats.radius, Math.sin(angle) * stats.radius);
      blade.rotation = angle;
    });
  }

  // --- Damage numbers ---

  /**
   * Your hits ([x, y, amount, crit, type, ...]) float up off enemies in their damage type's color (orange physical,
   * blue magic, white true); damage you take (0 = evaded) floats up off you.
   */
  addDamageNumbers(hits: number[], taken: number[], me: Point): void {
    for (let i = 0; i < hits.length; i += HIT_STRIDE) {
      const crit = hits[i + 3] === 1;
      const color = crit ? CRIT_COLOR : DAMAGE_COLORS[DAMAGE_TYPES[hits[i + 4]] ?? 'physical'];
      this.addNumber(hits[i], hits[i + 1] - 18, crit ? `${hits[i + 2]}!` : String(hits[i + 2]), color, crit ? 0.8 : 0.55);
    }
    for (const amount of taken) {
      if (amount === 0) this.addNumber(me.x, me.y - PLAYER_RADIUS - 24, 'EVADE', 0x80d8ff, 0.5);
      else this.addNumber(me.x, me.y - PLAYER_RADIUS - 24, `-${amount}`, 0xff5252, 0.65);
    }
  }

  private addNumber(x: number, y: number, text: string, color: number, size: number): void {
    if (this.numbers.length >= MAX_DAMAGE_NUMBERS) this.removeNumber(0); // Oldest makes room.
    const label = this.numberPool.pop() ?? new BitmapText({ text: '', style: { fontFamily: DAMAGE_FONT, fontSize: 32 } });
    label.text = text;
    label.anchor.set(0.5);
    label.tint = color;
    label.alpha = 1;
    label.position.set(x + (Math.random() - 0.5) * 16, y);
    this.layers.numbers.addChild(label);
    this.numbers.push({ label, size, life: NUMBER_LIFE, vx: (Math.random() - 0.5) * 30 });
  }

  /** Numbers pop in, drift up and fade out. */
  private updateDamageNumbers(dt: number): void {
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= dt;
      if (n.life <= 0) {
        this.removeNumber(i);
        continue;
      }
      const age = NUMBER_LIFE - n.life;
      const pop = age < 0.08 ? 1.5 - (age / 0.08) * 0.5 : 1;
      n.label.scale.set(n.size * pop);
      n.label.x += n.vx * dt;
      n.label.y -= 45 * dt;
      n.label.alpha = Math.min(1, n.life / (NUMBER_LIFE * 0.4));
    }
  }

  private removeNumber(index: number): void {
    const [n] = this.numbers.splice(index, 1);
    n.label.removeFromParent();
    this.numberPool.push(n.label);
  }

  // --- Effects ---

  private addEffect(x: number, y: number, life: number, draw: Effect['draw']): void {
    const g = new Graphics();
    g.position.set(x, y);
    this.layers.fx.addChild(g);
    this.effects.push({ g, life, maxLife: life, draw });
  }

  private burst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      const sprite = this.acquire(this.tex.particle, this.layers.fx);
      sprite.position.set(x, y);
      sprite.tint = color;
      this.particles.push({ sprite, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.4, maxLife: 0.4 });
    }
  }

  private updateEffects(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p.sprite);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.alpha = p.life / p.maxLife;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;
      if (effect.life <= 0) {
        effect.g.destroy();
        this.effects.splice(i, 1);
        continue;
      }
      effect.draw(effect.g.clear(), 1 - effect.life / effect.maxLife);
    }
  }

  // --- Helpers ---

  /** Each character has its own body shape: a tintable fill plus a white outline that keeps its color. */
  /** Each hero's portrait cropped to a round token around the face (the art is a bust on a dark background). */
  private async tokenTextures(): Promise<Record<CharacterId, Texture>> {
    const load = (url: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    const entries = await Promise.all(
      CHARACTER_IDS.map(async (id) => {
        const img = await load(portraitUrl(id));
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = TOKEN_TEX;
        const ctx = canvas.getContext('2d')!;
        // A square around the head and shoulders: a bit above the middle of the picture.
        const side = Math.min(img.width, img.height) * 0.6;
        const sx = (img.width - side) / 2;
        const sy = Math.max(0, img.height * 0.37 - side / 2);
        ctx.beginPath();
        ctx.arc(TOKEN_TEX / 2, TOKEN_TEX / 2, TOKEN_TEX / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, sx, sy, side, side, 0, 0, TOKEN_TEX, TOKEN_TEX);
        return [id, Texture.from(canvas)] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<CharacterId, Texture>;
  }

  /** Draws a plus sign onto `g`, optionally with an outline. */
  private hexagon(r: number): number[] {
    const points: number[] = [];
    for (let i = 0; i < 6; i++) points.push(Math.cos((i * Math.PI) / 3) * r, Math.sin((i * Math.PI) / 3) * r);
    return points;
  }

  /** A star with `points` tips, outer radius `outer` and inner radius `inner`. */
  private starShape(g: Graphics, outer: number, inner: number, points: number): Graphics {
    const coords: number[] = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (points * 2)) * Math.PI * 2;
      coords.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    return g.poly(coords);
  }

  private crossShape(g: Graphics, arm: number, half: number, color: number, outline?: number): Graphics {
    const shape = (gr: Graphics) => gr.rect(-half, -arm, half * 2, arm * 2).rect(-arm, -half, arm * 2, half * 2);
    if (outline !== undefined) shape(g).stroke({ width: 4, color: outline, join: 'round' });
    return shape(g).fill(color);
  }

  /** An enemy type's look (or its white hit-flash silhouette), centered on the enemy and drawn at 2x for sharpness. */
  private enemyTexture(type: number, flash: boolean): Texture {
    const g = new Graphics();
    const reach = Math.ceil(drawEnemy(g, type, flash)) + 4;
    const texture = this.app.renderer.generateTexture({ target: g, frame: new Rectangle(-reach, -reach, reach * 2, reach * 2), resolution: 2 });
    g.destroy();
    return texture;
  }

  private texture(g: Graphics): Texture {
    const texture = this.app.renderer.generateTexture(g);
    g.destroy();
    return texture;
  }

  /** Sprites are recycled because hundreds of enemies, bolts and gems come and go every second. */
  private acquire(texture: Texture, layer: Container): Sprite {
    const sprite = this.spritePool.pop() ?? new Sprite();
    sprite.texture = texture;
    sprite.anchor.set(0.5);
    sprite.tint = 0xffffff;
    sprite.alpha = 1;
    sprite.rotation = 0;
    sprite.scale.set(1);
    layer.addChild(sprite);
    return sprite;
  }

  private release(sprite: Sprite): void {
    sprite.removeFromParent();
    this.spritePool.push(sprite);
  }
}
