import { Application, BitmapFont, BitmapText, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { TIERS, TIER_IDS } from '../shared/artifacts';
import { CHARACTER_IDS, type CharacterId, REWIND_SECONDS } from '../shared/characters';
import { BOMB, BOSS_DEATH, BOSS_INTRO, COIN, DRAGON_INTRO, CRATE_RADIUS, DODGE_SPEED, HEART_RADIUS, PLAYER_RADIUS, REVIVE_RADIUS } from '../shared/constants';
import { DAMAGE_COLORS, DAMAGE_TYPES, type DamageType } from '../shared/upgrades';
import { AFFIXES, CHAMPION, ENEMY_TYPES, EnemyType, isBossType } from '../shared/enemies';
import { DRAGON_SHOULDER, NO_ROTATE, drawDragonWing, drawEnemy, shade } from './enemyArt';
import { TILE, decorations, drawGate, lavaField, drawWalls, groundTile } from './mapArt';
import { MAPS, mapWalls, enemyColor, zoneRect } from '../shared/maps';
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
  AFFIX_MASK,
  BossFlag,
  FACING_SHIFT,
  FACING_STEPS,
} from '../shared/protocol';
import { fieldRadius, orbitLayout } from '../shared/characters';
import type { Sample } from './snapshots';

const MAX_PARTICLES = 800;
const DANGER = 0xff1744;
const STUNNED = 0x90caf9;
/** Damage numbers: [x, y, amount, crit, type] per hit. */
const HIT_STRIDE = 5;
/** Crit numbers per damage type: yellow for physical, a deep blue for magic (Jeweled Gauntlet). True damage can't crit. */
const CRIT_COLORS: Record<DamageType, number> = { physical: 0xffd740, magic: 0x2979ff, true: 0xffd740 };
const FIRE = 0xff3d00;
/** Boss telegraphs: venom pools, meteors to stack in, marks to spread out from. */
const VENOM = 0x9ccc65;
const SHARE = 0xffb300;
const MARK = 0xe040fb;
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
/** The Dragonmancer's dragon: fiery orange, so it's never mistaken for Mordak. */
const DRAGON_FORM_COLOR = 0xe65100;
/** Dragon Form's body parts along its spine, in Mordak's radii: x is along the body (head forward). */
const DRAGON_PARTS = {
  head: { x: 0.92 },
  neck: [
    { x: 0.58, r: 0.13 },
    { x: 0.74, r: 0.11 },
  ],
  chest: { x: 0.3, rx: 0.28, ry: 0.24 },
  belly: { x: 0.0, rx: 0.26, ry: 0.19 },
  hips: { x: -0.3, rx: 0.23, ry: 0.19 },
  tail: { from: -0.45, to: -1.75, width: 0.14 },
};
/** How it moves: a stride of this many radians of its walk cycle a second (at full speed), and wings swept back this far. */
const DRAGON_STRIDE = 7;
const DRAGON_WING_TILT = 0.28;
/** Mordak is drawn the same way, but heavier set (wider plates and stance) and scaled up to fill his bulk. */
const MORDAK_BULK = 1.7;
const MORDAK_SCALE = 1.35;
/** A boss's hit flash lasts `length` ms, and comes at most every `every` ms. */
const BOSS_FLASH = { length: 70, every: 600 };
/** Off-screen objective arrows stay this far inside the screen edge. */
const POINTER_MARGIN = 40;
/** ...and are drawn this many times the aim arrow's size. */
const POINTER_SCALE = 3.2;
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
  /** Bosses: when their last hit flash started (they flash briefly, at most every BOSS_FLASH.every ms). */
  flashAt?: number;
  /** Mordak: drawn as a dragon of parts, like Dragon Form (his sprite stays, unseen). */
  dragon?: DragonView;
}

/** A Dragon Form dragon: legs (redrawn every frame), two wings that flap at the shoulder, and the body on top. */
interface DragonView {
  root: Container;
  legs: Graphics;
  wings: [Sprite, Sprite];
  /** Head, neck, chest, belly, hips and tail along a spine that bends as it walks (redrawn every frame). */
  body: Graphics;
  /** How much it's walking (0 to 1, eased; Mordak's), its own stride (slower than a hero's walk), and when it was last drawn. */
  moving: number;
  stride: number;
  last: number;
}

interface PlayerView {
  root: Container;
  bladeLayer: Container;
  blades: Sprite[];
  /** The Ember Halo's fireballs. */
  embers: Sprite[];
  /** In Dragon Form: drawn as a dragon instead, built from parts so it can walk and beat its wings. */
  dragon: DragonView | null;
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
    bear: Texture;
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
    artifact: Texture;
    particle: Texture;
  };
  private aimArrow!: Sprite;
  /** Floor outside the map edge plus the walls; rebuilt when the map changes. */
  private mapLayer = new Container();
  private mapIndex = -1;
  private arenaRing = new Graphics();
  /** The Ashen Caldera's finale: the stepping stones and the dragon's den, drawn once they appear. */
  private finaleGround = new Graphics();
  private finaleDrawn = false;
  /** The arena gate's doors, and how far open they're drawn (-1: not drawn yet on this map). */
  private gate = new Graphics();
  private gateAmount = 0;
  private gateDrawn = -1;
  /** Lava maps: the mask that shows the lava field past the current edge, and the radius it was drawn for. */
  private lavaMask: Graphics | null = null;
  private lavaDrawnR = -1;
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
  private artCache = new Map<string, string>();
  private enemyTextures = new Map<string, Texture>();
  /** Dragon Form's wings, one per side (and hit flash), with the shoulder they flap around. */
  private dragonWings = new Map<string, { texture: Texture; anchor: { x: number; y: number } }>();
  /** Each enemy type's color on the current map (for death bursts). */
  private enemyColors: number[] = ENEMY_TYPES.map((def) => def.color);
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
      // Spirit wolves are little wolf heads (like the Wolf Pack icon), in their own colors. The bear points where it
      // runs; from above: a broad body, head, ears and snout.
      wolf: this.texture(this.wolfHead()),
      bear: this.texture(
        new Graphics()
          .circle(-2, 0, 30)
          .fill({ color: 0xffffff, alpha: 0.12 })
          .ellipse(-4, 0, 22, 17)
          .fill(0xffffff)
          .stroke({ width: 2, color: 0x4e342e })
          .circle(18, -9, 4.5)
          .circle(18, 9, 4.5)
          .fill(0xd7ccc8)
          .stroke({ width: 1.5, color: 0x4e342e })
          .circle(18, 0, 11)
          .fill(0xffffff)
          .stroke({ width: 2, color: 0x4e342e })
          .ellipse(27, 0, 6, 4.5)
          .fill(0xd7ccc8)
          .circle(31, 0, 2)
          .fill(0x2a1a10)
          .circle(21, -4.5, 1.6)
          .circle(21, 4.5, 1.6)
          .fill(0x2a1a10)
          .ellipse(-6, 0, 12, 9)
          .fill({ color: 0x000000, alpha: 0.1 }),
      ),
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
      // An artifact: a faceted crystal in a halo, white so it can be tinted its tier's color.
      artifact: this.texture(
        new Graphics()
          .circle(0, 0, 30)
          .fill({ color: 0xffffff, alpha: 0.12 })
          .circle(0, 0, 22)
          .fill({ color: 0xffffff, alpha: 0.2 })
          .poly([0, -17, 12, -3, 0, 15, -12, -3])
          .fill(0xffffff)
          .stroke({ width: 2, color: 0x303030 })
          .poly([0, -17, 12, -3, 0, -3])
          .fill(0xe0e0e0)
          .poly([0, -3, 12, -3, 0, 15])
          .fill(0x9e9e9e)
          .poly([-12, -3, 0, -3, 0, 15])
          .fill(0xc8c8c8)
          .circle(-4, -8, 2.5)
          .fill(0xffffff),
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
    this.world.addChild(this.mapLayer, this.gate, this.arenaRing, this.questMarker, this.rewindTrail, ...Object.values(this.layers), this.zone, this.aimArrow);
    this.app.stage.addChild(this.background, this.world, this.pointers, this.minimap.container);
  }

  /** An enemy's sprite as an image (for the bestiary), made once per type. */
  enemyArt(type: number, color = ENEMY_TYPES[type].color): string {
    const key = `${type}|${color}`;
    let url = this.artCache.get(key);
    if (!url) {
      const canvas = this.app.renderer.extract.canvas(this.enemyTexture(type, false, color)) as HTMLCanvasElement;
      url = canvas.toDataURL();
      this.artCache.set(key, url);
    }
    return url;
  }

  /** Floor, map edge and walls in the map's colors. */
  private setMap(index: number): void {
    this.mapIndex = index;
    const map = MAPS[index];
    const { theme } = map;

    const old = this.background.texture;
    const tile = groundTile(map);
    this.background.texture = this.app.renderer.generateTexture({ target: tile, frame: new Rectangle(0, 0, TILE, TILE) });
    tile.destroy();
    if (old !== Texture.EMPTY) old.destroy(true);

    // The horde in this map's colors.
    this.enemyColors = ENEMY_TYPES.map((_, type) => enemyColor(map, type));
    this.tex.enemies = ENEMY_TYPES.map((_, type) => this.enemyTexture(type, false, this.enemyColors[type]));
    // (The finale's ground is kept: it's reused on the next lava map.)
    for (const child of this.mapLayer.removeChildren()) if (child !== this.finaleGround) child.destroy();
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
    const decor = decorations(map);
    this.mapGlow = decor.glow;
    this.mapLayer.addChild(decor.still, decor.glow);
    // The lava field, shown past the lava's edge (see renderLava).
    this.lavaMask = null;
    this.lavaDrawnR = -1;
    if (map.lava) {
      const lava = lavaField(map);
      this.lavaMask = new Graphics();
      lava.mask = this.lavaMask;
      this.mapLayer.addChild(lava, this.lavaMask);
      this.finaleGround.clear();
      this.finaleDrawn = false;
      this.mapLayer.addChild(this.finaleGround);
    }
    this.mapLayer.addChild(outside, drawWalls(map), decor.top);
    this.gateDrawn = -1;
  }

  /** The arena gate's doors slide open when the boss is due, and shut once everyone's inside. */
  private renderGate(snap: Snapshot, realDt: number): void {
    const arena = MAPS[snap.map].arena;
    if (!arena) {
      this.gate.clear();
      return;
    }
    const target = snap.arena?.open ? 1 : 0;
    // About a second to open or close; a new map starts where it is.
    this.gateAmount = this.gateDrawn < 0 ? target : this.gateAmount + Math.max(-realDt, Math.min(realDt, target - this.gateAmount));
    if (this.gateAmount === this.gateDrawn) return;
    this.gateDrawn = this.gateAmount;
    this.gate.clear();
    for (const w of arena.gate) drawGate(this.gate, w, this.gateAmount, arena.gateLook);
  }

  /** The lava's edge: the lava field is masked to everything past it, with a glowing front line. */
  private renderLava(snap: Snapshot): void {
    const lava = snap.lava;
    if (!lava || !this.lavaMask) return;
    const map = MAPS[snap.map];
    const sunk = !!snap.finale && snap.finale.stage !== 'crumble';
    const key = sunk ? -2 : lava.r;
    if (key !== this.lavaDrawnR) {
      this.lavaDrawnR = key;
      this.lavaMask.clear().rect(-50, -50, map.width + 100, map.height + 100).fill(0xffffff);
      if (!sunk) this.lavaMask.circle(lava.x, lava.y, lava.r).cut();
    }
    this.renderFinale(snap);
    if (sunk) return;
    const flicker = 0.5 + 0.5 * Math.sin(performance.now() / 90);
    this.arenaRing
      .circle(lava.x, lava.y, lava.r + 6)
      .stroke({ width: 26, color: FIRE, alpha: 0.25 + 0.15 * flicker })
      .circle(lava.x, lava.y, lava.r)
      .stroke({ width: 5, color: 0xffd180, alpha: 0.85 });
    // While it closes in: where it will stop.
    if (lava.closing && map.lava) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      this.arenaRing.circle(lava.x, lava.y, map.lava.final).stroke({ width: 5, color: 0xffd180, alpha: 0.25 + 0.4 * pulse });
    }
  }

  /**
   * The Ashen Caldera's finale. Shaking: glowing cracks spread across the ground. Then the stepping stones and the
   * dragon's den (with its pillars) rise out of the lava, drawn once.
   */
  private renderFinale(snap: Snapshot): void {
    const finale = MAPS[snap.map].finale;
    const stage = snap.finale?.stage;
    if (!finale || !stage) {
      if (this.finaleDrawn) {
        this.finaleGround.clear();
        this.finaleDrawn = false;
      }
      return;
    }
    if (stage === 'crumble') {
      // Cracks reaching out from the heart as it shakes apart.
      const grow = Math.min(1, snap.finale!.t / 3.5);
      const heart = finale.stones[0];
      for (let i = 0; i < 14; i++) {
        let x = heart.x;
        let y = heart.y;
        let a = (i / 14) * Math.PI * 2 + i * 0.37;
        const steps = Math.ceil(9 * grow);
        for (let k = 0; k < steps; k++) {
          a += Math.sin(i * 7.1 + k * 3.3) * 0.5;
          const nx = x + Math.cos(a) * 80;
          const ny = y + Math.sin(a) * 80;
          this.arenaRing.moveTo(x, y).lineTo(nx, ny).stroke({ width: 9, color: 0xff6d00, alpha: 0.35 }).moveTo(x, y).lineTo(nx, ny).stroke({ width: 3, color: 0xffd180, alpha: 0.9 });
          x = nx;
          y = ny;
        }
      }
      return;
    }
    if (this.finaleDrawn) return;
    this.finaleDrawn = true;
    const g = this.finaleGround.clear();
    // First, a clean sea of lava over the field's floating crusts (so the stones are the only rock to stand on).
    const map = MAPS[snap.map];
    g.rect(0, 0, map.width, map.height).fill(0xd84315);
    for (let i = 0; i < 260; i++) {
      const x = ((i * 7919) % 997) / 997;
      const y = ((i * 104729) % 991) / 991;
      g.ellipse(x * map.width, y * map.height, 70 + ((i * 37) % 110), 30 + ((i * 53) % 55)).fill({ color: i % 3 ? 0xff9100 : 0xffab40, alpha: 0.3 });
    }
    for (let i = 0; i < 180; i++) {
      const x = ((i * 6007) % 1009) / 1009;
      const y = ((i * 7741) % 1013) / 1013;
      g.circle(x * map.width, y * map.height, 3 + (i % 5)).fill({ color: 0xffe0b2, alpha: 0.6 });
    }
    const rock = (x: number, y: number, r: number, seed: number, floor: number, top: number) => {
      const pts: number[] = [];
      const n = Math.max(11, Math.round(r / 28));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const w = r * (0.9 + 0.12 * Math.sin(seed * 3.7 + ((i * 2.3) * 11) / n));
        pts.push(x + Math.cos(a) * w, y + Math.sin(a) * w);
      }
      g.poly(pts).fill(floor).stroke({ width: 6, color: 0xff6d00, alpha: 0.55 }).poly(pts).stroke({ width: 2, color: 0xffd180, alpha: 0.9 });
      g.ellipse(x - r * 0.2, y - r * 0.25, r * 0.45, r * 0.22).fill({ color: top, alpha: 0.5 });
    };
    // The den: a great slab of dark rock, scorched and littered with bones.
    const den = finale.den;
    rock(den.x, den.y, den.r, 1, 0x2e211c, 0x4a362e);
    g.circle(den.x, den.y, den.r * 0.7).stroke({ width: 3, color: 0x6d4c41, alpha: 0.5 });
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + 0.3;
      const d = den.r * (0.25 + ((i * 0.37) % 0.6));
      const x = den.x + Math.cos(a) * d;
      const y = den.y + Math.sin(a) * d;
      // Scorch marks and old bones.
      g.ellipse(x, y, 40, 22).fill({ color: 0x120a07, alpha: 0.5 });
      g.moveTo(x - 14, y - 4).lineTo(x + 14, y + 4).stroke({ width: 5, color: 0xd7ccc8, alpha: 0.75, cap: 'round' });
      g.circle(x - 15, y - 5, 4).circle(x + 15, y + 5, 4).fill({ color: 0xd7ccc8, alpha: 0.75 });
    }
    // Claw marks.
    for (let k = 0; k < 3; k++) {
      const x = den.x - 60 + k * 12;
      g.moveTo(x, den.y - 120).lineTo(x + 30, den.y - 40).stroke({ width: 4, color: 0x120a07, alpha: 0.6, cap: 'round' });
    }
    // Its pillars: tall hexagonal columns of basalt, cool gray against the brown floor. A long shadow, the side of the
    // column below its top, lava glowing in the cracks, and a bright rim so they stand out.
    for (const [k, p] of finale.pillars.entries()) {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const r = p.w * 0.62;
      const lift = p.w * 0.45;
      const hex = (x: number, y: number, rr: number) => {
        const pts: number[] = [];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + k * 0.4;
          pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9);
        }
        return pts;
      };
      g.ellipse(cx + r * 0.5, cy + r * 0.55, r * 1.25, r * 0.7).fill({ color: 0x000000, alpha: 0.45 });
      // The column's side (the base), then its top raised above it.
      const base = hex(cx, cy + lift * 0.5, r);
      const top = hex(cx, cy - lift * 0.5, r);
      g.poly(base).fill(0x1c1a1a).stroke({ width: 3, color: 0x0a0808 });
      g.rect(cx - r, cy - lift * 0.5, r * 2, lift).fill(0x1c1a1a);
      for (let i = 0; i < 3; i++) {
        const x = cx - r * 0.6 + i * r * 0.6;
        g.moveTo(x, cy - lift * 0.3).lineTo(x, cy + lift * 0.5 + r * 0.6).stroke({ width: 2, color: 0x3a3534, alpha: 0.8 });
      }
      g.poly(top).fill(0x5f5a58).stroke({ width: 3, color: 0xb0a8a2, alpha: 0.9 });
      g.poly(hex(cx, cy - lift * 0.5, r * 0.6)).stroke({ width: 2, color: 0x7d7672, alpha: 0.8 });
      // Lava in the cracks.
      g.moveTo(cx - r * 0.5, cy - lift * 0.5 - r * 0.2).lineTo(cx - r * 0.05, cy - lift * 0.5 + r * 0.05).lineTo(cx + r * 0.35, cy - lift * 0.5 - r * 0.3)
        .stroke({ width: 5, color: 0xff6d00, alpha: 0.5, cap: 'round', join: 'round' })
        .moveTo(cx - r * 0.5, cy - lift * 0.5 - r * 0.2).lineTo(cx - r * 0.05, cy - lift * 0.5 + r * 0.05).lineTo(cx + r * 0.35, cy - lift * 0.5 - r * 0.3)
        .stroke({ width: 1.5, color: 0xffd180, alpha: 0.9, cap: 'round', join: 'round' });
    }
    // And the stepping stones.
    finale.stones.forEach((st, i) => rock(st.x, st.y, st.r, i + 2, 0x4e3b33, 0x7a5c50));
  }

  /**
   * The boss arena (its walls and gate show where it is): a pulsing glow inside once the gate opens, a barrier while
   * the fight is on and the gate still open, and the burning zone outside. Then the lava, on lava maps.
   */
  private renderArena(snap: Snapshot): void {
    const arena = snap.arena;
    const ring = this.arenaRing.clear();
    const zone = this.zone.clear();
    this.renderLava(snap);
    const def = MAPS[snap.map].arena;
    if (!arena || !def) return;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
    const shape = () => (def.hall ? ring.rect(def.x - def.hall.hw, def.y - def.hall.hh, def.hall.hw * 2, def.hall.hh * 2) : ring.circle(def.x, def.y, def.r));
    if (arena.state === 'gather') shape().fill({ color: DANGER, alpha: 0.05 + 0.04 * pulse }).stroke({ width: 4, color: DANGER, alpha: 0.3 + 0.4 * pulse });
    else if (arena.state === 'fight' && arena.open) shape().stroke({ width: 6, color: 0xff8a80, alpha: 0.7 });
    if (arena.state !== 'idle') {
      // The burning zone: everything outside the safe area glows with fire, with a flickering front line.
      const map = MAPS[snap.map];
      const flicker = 0.5 + 0.5 * Math.sin(performance.now() / 70);
      const tint = { color: FIRE, alpha: 0.16 + 0.04 * pulse };
      const pad = 200;
      const box = zoneRect(def, arena.safeR);
      if (box) {
        // Around a hall it's a rectangle: tint the four strips around it.
        const L = -pad;
        const T = -pad;
        const R = map.width + pad;
        const B = map.height + pad;
        const x0 = Math.max(L, Math.min(R, box.x0));
        const x1 = Math.max(L, Math.min(R, box.x1));
        const y0 = Math.max(T, Math.min(B, box.y0));
        const y1 = Math.max(T, Math.min(B, box.y1));
        for (const [x, y, w, h] of [
          [L, T, R - L, y0 - T],
          [L, y1, R - L, B - y1],
          [L, y0, x0 - L, y1 - y0],
          [x1, y0, R - x1, y1 - y0],
        ]) {
          if (w > 0 && h > 0) zone.rect(x, y, w, h).fill(tint);
        }
        zone
          .rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0)
          .stroke({ width: 14, color: FIRE, alpha: 0.35 + 0.25 * flicker })
          .rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0)
          .stroke({ width: 3, color: 0xffd180, alpha: 0.9 });
      } else {
        // A ring wide enough to cover the rest of the map. (Cutting the circle out of a rectangle breaks once the
        // circle is bigger than the map, and tints everything.)
        const far = Math.hypot(map.width + pad * 2, map.height + pad * 2);
        zone
          .circle(arena.x, arena.y, arena.safeR + far / 2)
          .stroke({ width: far, color: FIRE, alpha: tint.alpha })
          .circle(arena.x, arena.y, arena.safeR)
          .stroke({ width: 14, color: FIRE, alpha: 0.35 + 0.25 * flicker })
          .circle(arena.x, arena.y, arena.safeR)
          .stroke({ width: 3, color: 0xffd180, alpha: 0.9 });
      }
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
  private intro: { x: number; y: number; start: number; dragon: boolean } | null = null;
  /** How far the camera has moved over to a dying boss (0 to 1), and the last spot it held on. */
  private focus = 0;
  private focusAt: Point = { x: 0, y: 0 };
  /** The ground shaking: how hard, fading away. */
  private quake = 0;

  /**
   * A final boss's death: the camera eases over to the corpse and holds there, then back. And whenever the ground
   * quakes, everything shakes.
   */
  private deathCamera(cam: Point, snap: Snapshot, realDt: number): Point {
    const dying = snap.dying;
    if (dying) this.focusAt = dying;
    this.focus = Math.max(0, Math.min(1, this.focus + (dying ? realDt / 0.8 : -realDt / 0.8)));
    const k = this.focus * this.focus * (3 - 2 * this.focus);
    this.quake = Math.max(0, this.quake - realDt * 14);
    const shake = this.quake;
    return {
      x: cam.x + (this.focusAt.x - cam.x) * k + (Math.random() - 0.5) * shake,
      y: cam.y + (this.focusAt.y - cam.y) * k + (Math.random() - 0.5) * shake,
    };
  }

  private introCamera(follow: Point): Point {
    if (!this.intro) return follow;
    const { panIn, hold, ease, panOut } = this.intro.dragon ? DRAGON_INTRO : BOSS_INTRO;
    const t = (performance.now() - this.intro.start) / 1000;
    const end = hold + ease;
    if (t >= end) {
      this.intro = null;
      return follow;
    }
    const smooth = (x: number) => x * x * (3 - 2 * x);
    // In, hold, then back out, finishing as the game reaches full speed.
    const k = t < panIn ? smooth(t / panIn) : t < end - panOut ? 1 : smooth((end - t) / panOut);
    // The roar shakes the screen for a moment (Mordak's longer and harder).
    const roar = this.intro.dragon ? DRAGON_INTRO.roarAt : panIn;
    const length = this.intro.dragon ? 1.6 : 0.6;
    const strength = this.intro.dragon ? 14 : 8;
    const shake = t > roar && t < roar + length ? strength * (1 - (t - roar) / length) : 0;
    return {
      x: follow.x + (this.intro.x - follow.x) * k + (Math.random() - 0.5) * shake,
      y: follow.y + (this.intro.y - follow.y) * k + (Math.random() - 0.5) * shake,
    };
  }

  addFx(fx: Fx): void {
    switch (fx.k) {
      case 'quake':
        this.quake = Math.max(this.quake, 12 * fx.strength);
        break;
      case 'breath': {
        // A gout of flame: a cone that flares out and fades, hot at its heart.
        const half = fx.arc / 2;
        this.addEffect(fx.x, fx.y, 0.32, (g, p) => {
          const reach = fx.r * (0.55 + 0.45 * p);
          const cone = (r: number, w: number) => g.moveTo(0, 0).arc(0, 0, r, fx.a - w, fx.a + w).lineTo(0, 0);
          cone(reach, half).fill({ color: 0xff3d00, alpha: 0.32 * (1 - p) });
          cone(reach * 0.8, half * 0.75).fill({ color: 0xff9100, alpha: 0.4 * (1 - p) });
          cone(reach * 0.55, half * 0.45).fill({ color: 0xffe082, alpha: 0.5 * (1 - p) });
        });
        break;
      }
      case 'shatter': {
        // The corpse breaks apart: chunks of it fly out and tumble away, with a flash and a cloud of embers.
        this.burst(fx.x, fx.y, fx.c, 90);
        this.burst(fx.x, fx.y, 0xffab40, 40);
        const chunks = Array.from({ length: 16 }, (_, i) => ({
          a: (i / 16) * Math.PI * 2 + Math.random() * 0.3,
          d: fx.r * (1.5 + Math.random() * 1.6),
          size: fx.r * (0.18 + Math.random() * 0.2),
          spin: (Math.random() - 0.5) * 8,
        }));
        this.addEffect(fx.x, fx.y, 1.6, (g, p) => {
          const ease = 1 - (1 - p) ** 3;
          g.circle(0, 0, fx.r * (1 + 2.5 * p)).fill({ color: 0xffffff, alpha: Math.max(0, 0.6 - p * 1.5) });
          for (const c of chunks) {
            const x = Math.cos(c.a) * c.d * ease;
            const y = Math.sin(c.a) * c.d * ease;
            const rot = c.spin * p;
            const pts: number[] = [];
            for (let k = 0; k < 4; k++) {
              const a = rot + (k / 4) * Math.PI * 2 + (k % 2) * 0.4;
              pts.push(x + Math.cos(a) * c.size * (k % 2 ? 0.6 : 1), y + Math.sin(a) * c.size * (k % 2 ? 0.6 : 1));
            }
            g.poly(pts).fill({ color: fx.c, alpha: 1 - p }).stroke({ width: 2, color: 0x000000, alpha: 0.6 * (1 - p) });
          }
        });
        break;
      }
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
        this.intro = { x: fx.x, y: fx.y, start: performance.now(), dragon: !!fx.dragon };
        // A shockwave from the boss as the camera arrives (as Mordak roars).
        const late = fx.dragon ? DRAGON_INTRO.roarAt - 0.35 : 0;
        for (const [delay, color] of [[late, 0xff5252], [late + 0.15, 0xffd180]] as const) {
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
    const cam = this.deathCamera(this.introCamera(follow), b.snap, realDt);
    this.world.position.set(Math.round(width / 2 - cam.x), Math.round(height / 2 - cam.y));
    this.background.width = width;
    this.background.height = height;
    this.background.tilePosition.set(this.world.x, this.world.y);

    const playing = b.snap.phase === 'playing';
    if (this.mapGlow) this.mapGlow.alpha = 0.75 + 0.25 * Math.sin(performance.now() / 450);
    this.renderArena(b.snap);
    this.renderGate(b.snap, realDt);
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
      list[i + 1] === SummonKind.Bear ? { texture: this.tex.bear, tint: 0xd7a86e, rotate: true } : { texture: this.tex.wolf, tint: 0xffffff },
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
    if (snap.lava?.closing) targets.push({ x: snap.lava.x, y: snap.lava.y, color: FIRE });
    const den = MAPS[snap.map].finale?.den;
    if (den && snap.finale?.stage === 'path') targets.push({ x: den.x, y: den.y, color: FIRE });
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
      arrow.scale.set(POINTER_SCALE);
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
    const missionHp = new Map<number, number>();
    const hpList = b.snap.bossFight?.targets ?? [];
    for (let i = 0; i < hpList.length; i += 2) missionHp.set(hpList[i], hpList[i + 1]);
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
      // Mordak says which way he faces (his wings have to line up with where they're hit).
      if (type === EnemyType.Mordak) view.facing = (((flags >> FACING_SHIFT) & (FACING_STEPS - 1)) / FACING_STEPS) * Math.PI * 2;
      view.sprite.rotation = NO_ROTATE.has(type) ? 0 : view.facing;
      // Winding up a charge: swell and blink as a warning.
      const windingUp = (flags & EnemyFlag.WindingUp) !== 0;
      const affix = (flags >> AFFIX_SHIFT) & AFFIX_MASK;
      const flying = (flags & BossFlag.Flying) !== 0;
      const dying = (flags & BossFlag.Dying) !== 0;
      const size = (windingUp ? 1.15 : 1) * (affix ? CHAMPION.size : 1) * (flying ? 1.25 : 1);
      const bob = moving ? Math.sin(now / 75 + id) * 0.06 : 0;
      view.sprite.scale.set(size * (1 + bob), size * (1 - bob));
      // Hit: the white silhouette. Stunned: tinted icy blue.
      // Bosses are hit all the time: they blink white briefly now and then, instead of staying white.
      let hit = (flags & EnemyFlag.Hit) !== 0;
      if (isBossType(type) || ENEMY_TYPES[type].behavior === 'part') {
        if (hit && now - (view.flashAt ?? -Infinity) > BOSS_FLASH.every) view.flashAt = now;
        hit = now - (view.flashAt ?? -Infinity) < BOSS_FLASH.length;
      }
      const white = hit || (windingUp && blink);
      view.sprite.texture = white ? this.tex.enemyFlash[type] : this.tex.enemies[type];
      if (type === EnemyType.Mordak && !view.dragon) {
        view.dragon = this.newDragon();
        this.layers.enemies.addChild(view.dragon.root);
      }
      // High in the air: his shadow passes over the ground below.
      if (flying) marks.ellipse(x + 40, y + 90, ENEMY_TYPES[type].radius * 1.3, ENEMY_TYPES[type].radius * 0.6).fill({ color: 0x000000, alpha: 0.35 });
      // Dying: it shakes harder and harder, blinking white, until it breaks apart.
      if (dying && b.snap.dying) {
        const p = Math.min(1, (b.snap.dying.progress * BOSS_DEATH.total) / BOSS_DEATH.shatter);
        const amp = 2 + 14 * p * p;
        view.sprite.position.set(x + (Math.random() - 0.5) * amp, y + (Math.random() - 0.5) * amp);
        if (Math.random() < 0.15 + 0.5 * p) view.sprite.texture = this.tex.enemyFlash[type];
        view.sprite.tint = 0xffccbc;
      }
      view.sprite.tint = (flags & EnemyFlag.Stunned) !== 0 ? STUNNED : 0xffffff;
      const r = ENEMY_TYPES[type].radius;
      if (view.dragon) {
        // Mordak: his sprite is only a stand-in (for where he is); he's drawn as a dragon of parts.
        const d = view.dragon;
        d.moving += ((moving ? 1 : 0) - d.moving) * 0.12;
        const flash = view.sprite.texture === this.tex.enemyFlash[type];
        const torn: [boolean, boolean] = [(flags & BossFlag.LeftWingGone) !== 0, (flags & BossFlag.RightWingGone) !== 0];
        this.poseDragon(d, { R: r, color: this.enemyColors[type], flash, moving: d.moving, seed: id, torn, flying, bulk: MORDAK_BULK, heavy: true });
        d.root.position.copyFrom(view.sprite.position);
        d.root.rotation = view.facing;
        d.root.scale.set(size * MORDAK_SCALE);
        d.root.tint = view.sprite.tint;
        view.sprite.alpha = 0;
      }
      // Burrowed: only a mound of churning dirt shows where it is.
      const part = ENEMY_TYPES[type].behavior === 'part';
      view.sprite.visible = (flags & EnemyFlag.Hidden) === 0 && !part;
      if (view.dragon) view.dragon.root.visible = view.sprite.visible;
      if (flags & EnemyFlag.Hidden && !part) {
        marks.ellipse(x, y, r * 0.9, r * 0.6).fill({ color: 0x5d4037, alpha: 0.8 });
        for (let k = 0; k < 6; k++) {
          const a = k + now / 150;
          marks.circle(x + Math.cos(a) * r * 0.6, y + Math.sin(a * 1.3) * r * 0.35, 4).fill(0x8d6e63);
        }
      }
      // A hard shell: thick gray plates. Cracked open: a pulsing red ring.
      if (flags & EnemyFlag.Shelled) {
        marks.circle(x, y, r + 10).stroke({ width: 8, color: 0x90a4ae, alpha: 0.8 }).circle(x, y, r + 10).stroke({ width: 2, color: 0x37474f, alpha: 0.9 });
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          marks.moveTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6)).lineTo(x + Math.cos(a) * (r + 14), y + Math.sin(a) * (r + 14)).stroke({ width: 2, color: 0x37474f });
        }
      }
      if (flags & EnemyFlag.Exposed) marks.circle(x, y, r + 8).stroke({ width: 4, color: 0xff1744, alpha: 0.5 + 0.5 * pulse });
      // A twin shielded by its sibling: a fiery aura.
      if (flags & EnemyFlag.Linked) marks.circle(x, y, r + 16).fill({ color: 0xff9100, alpha: 0.1 + 0.08 * pulse }).stroke({ width: 3, color: 0xffab40, alpha: 0.6 + 0.3 * pulse });
      // A shimmering bubble on shielded bosses; a gold ring on enemies a side mission needs dead.
      if (flags & EnemyFlag.Shielded) {
        marks.circle(x, y, r + 14).fill({ color: 0xe040fb, alpha: 0.12 + 0.08 * pulse }).stroke({ width: 3, color: 0xea80fc, alpha: 0.5 + 0.4 * pulse });
      }
      if (flags & EnemyFlag.Marked) {
        marks.circle(x, y, r + 6).stroke({ width: 2.5, color: 0xffd54f, alpha: 0.5 + 0.5 * pulse });
        // And a health bar, so you can see the wards (and the marked brood) going down.
        const hp = missionHp.get(id);
        if (hp !== undefined) {
          const w = Math.max(40, r * 2);
          const by = y + r + 12;
          marks.rect(x - w / 2 - 1, by - 1, w + 2, 7).fill({ color: 0x000000, alpha: 0.7 });
          marks.rect(x - w / 2, by, w * hp, 5).fill(0xffd54f);
        }
      }
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
        this.burst(view.sprite.x, view.sprite.y, this.enemyColors[view.type], big ? 40 : 6);
        this.onEnemyDeath(view.sprite.x, view.sprite.y, big);
      }
      this.release(view.sprite);
      view.dragon?.root.destroy({ children: true });
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
      if (kind === ZoneKind.Sanctuary) {
        // An artifact's sanctuary: a shimmering golden dome (players inside can't be hurt).
        const t = performance.now() / 1000;
        const pulse = 0.5 + 0.5 * Math.sin(t * 5 + id);
        venom
          .circle(x, y, r)
          .fill({ color: 0xffe082, alpha: 0.16 + 0.05 * pulse })
          .circle(x, y, r)
          .stroke({ width: 5, color: 0xfff8e1, alpha: 0.7 + 0.25 * pulse })
          .circle(x, y, r - 9)
          .stroke({ width: 2, color: 0xffd54f, alpha: 0.5 });
        // Light lines sweeping around the dome.
        for (let k = 0; k < 6; k++) {
          const a = t * 0.8 + (k * Math.PI) / 3;
          venom.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25).lineTo(x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10));
        }
        venom.stroke({ width: 2, color: 0xfff59d, alpha: 0.3 });
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
      g.rotation = 0;
      this.drawHazard(g, kind, ha, hb, w, progress, b.snap);
    }
    for (const [id, view] of this.hazardViews) {
      if (view.seen === this.frame) continue;
      view.g.destroy();
      this.hazardViews.delete(id);
    }
  }

  /** One telegraph, drawn around (0, 0) (see HazardKind for what a, b and c mean). */
  private drawHazard(g: Graphics, kind: number, ha: number, hb: number, w: number, progress: number, snap: Snapshot): void {
    const now = performance.now();
    // Little arrows around a circle: pointing in (stack up) or out (spread out).
    const arrows = (r: number, inward: boolean, color: number) => {
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const bob = Math.sin(now / 150) * 4;
        const tip = inward ? r + 6 - bob : r + 26 + bob;
        const base = inward ? r + 24 - bob : r + 8 + bob;
        const side = (d: number, off: number) => [Math.cos(a) * d + Math.cos(a + Math.PI / 2) * off, Math.sin(a) * d + Math.sin(a + Math.PI / 2) * off];
        g.poly([...side(tip, 0), ...side(base, 9), ...side(base, -9)]).fill({ color, alpha: 0.9 });
      }
    };
    switch (kind) {
      case HazardKind.Circle:
        g.circle(0, 0, ha)
          .fill({ color: DANGER, alpha: 0.1 })
          .stroke({ width: 2, color: DANGER, alpha: 0.7 })
          .circle(0, 0, ha * progress)
          .fill({ color: DANGER, alpha: 0.25 });
        return;
      case HazardKind.Line:
        g.rotation = ha;
        g.rect(0, -w / 2, hb, w)
          .fill({ color: DANGER, alpha: 0.08 + 0.12 * progress })
          .stroke({ width: 2, color: DANGER, alpha: 0.6 })
          .rect(0, -w / 2, hb * progress, w)
          .fill({ color: DANGER, alpha: 0.15 });
        return;
      case HazardKind.Cone: {
        // A wedge in front of the boss, filling up until it lands.
        g.rotation = ha;
        const half = w / 100;
        const wedge = (r: number) => g.moveTo(0, 0).arc(0, 0, r, -half, half).lineTo(0, 0);
        wedge(hb).fill({ color: DANGER, alpha: 0.1 }).stroke({ width: 2, color: DANGER, alpha: 0.75 });
        wedge(Math.max(1, hb * progress)).fill({ color: DANGER, alpha: 0.25 });
        return;
      }
      case HazardKind.Ring:
        if (progress < 1) {
          // Gathering: how far it will roll, and a ring tightening around the boss.
          g.circle(0, 0, w).stroke({ width: 2, color: DANGER, alpha: 0.3 });
          g.circle(0, 0, 160 - 90 * progress).stroke({ width: 6, color: DANGER, alpha: 0.5 + 0.4 * progress });
        } else {
          g.circle(0, 0, ha).stroke({ width: hb, color: DANGER, alpha: 0.45 }).circle(0, 0, ha).stroke({ width: 3, color: 0xffcdd2, alpha: 0.9 });
        }
        return;
      case HazardKind.Pool: {
        // Venom: faint while it settles, then a bubbling pool.
        const armed = hb > 0;
        g.circle(0, 0, ha).fill({ color: VENOM, alpha: armed ? 0.32 : 0.1 }).stroke({ width: 2, color: VENOM, alpha: 0.75 });
        if (!armed) g.circle(0, 0, ha * progress).fill({ color: VENOM, alpha: 0.2 });
        else {
          for (let k = 0; k < 6; k++) {
            const a = k * 2.4 + now / 900;
            const r = ha * (0.2 + ((k * 0.37) % 0.6));
            g.circle(Math.cos(a) * r, Math.sin(a) * r, 3 + 2 * Math.sin(now / 200 + k)).fill({ color: 0xdcedc8, alpha: 0.6 });
          }
        }
        return;
      }
      case HazardKind.Share:
        // A meteor: stack up inside.
        g.circle(0, 0, ha).fill({ color: SHARE, alpha: 0.12 }).stroke({ width: 3, color: SHARE, alpha: 0.85 });
        g.circle(0, 0, ha * progress).fill({ color: SHARE, alpha: 0.22 });
        arrows(ha, true, SHARE);
        return;
      case HazardKind.Mark:
        // Spread out: whoever it follows should leave the group.
        g.circle(0, 0, ha).fill({ color: MARK, alpha: 0.1 }).stroke({ width: 3, color: MARK, alpha: 0.85 });
        g.circle(0, 0, ha * progress).fill({ color: MARK, alpha: 0.2 });
        arrows(ha, false, MARK);
        return;
      case HazardKind.Beam: {
        // The twins' burning tether.
        g.rotation = ha;
        const flicker = 0.5 + 0.5 * Math.sin(now / 60);
        g.rect(0, -w / 2 - 6, hb, w + 12).fill({ color: FIRE, alpha: 0.2 + 0.1 * flicker });
        g.rect(0, -w / 2, hb, w).fill({ color: 0xffab40, alpha: 0.55 + 0.2 * flicker });
        g.rect(0, -2, hb, 4).fill({ color: 0xfff3e0, alpha: 0.9 });
        return;
      }
      case HazardKind.Sweep: {
        if (progress < 1) {
          // Winding up: the half circle it's about to sweep glows, and the shadows behind pillars are safe.
          const wedge = () => g.moveTo(0, 0).arc(0, 0, hb, ha - Math.PI / 2, ha + Math.PI / 2).lineTo(0, 0);
          wedge().fill({ color: FIRE, alpha: 0.06 + 0.12 * progress }).stroke({ width: 3, color: FIRE, alpha: 0.5 + 0.4 * progress });
          this.wallShadows(g, snap, hb, 0x1a0500, 0.55);
          g.circle(0, 0, 40 + 120 * (1 - progress)).stroke({ width: 6, color: 0xffab40, alpha: 0.4 + 0.5 * progress });
        } else {
          // The beam itself, sweeping.
          g.rotation = ha;
          const flicker = 0.5 + 0.5 * Math.sin(now / 40);
          g.rect(0, -w / 2 - 14, hb, w + 28).fill({ color: FIRE, alpha: 0.18 + 0.1 * flicker });
          g.rect(0, -w / 2, hb, w).fill({ color: 0xff6d00, alpha: 0.75 });
          g.rect(0, -w / 4, hb, w / 2).fill({ color: 0xffd180, alpha: 0.9 });
          g.rect(0, -3, hb, 6).fill({ color: 0xffffff, alpha: 0.9 });
        }
        return;
      }
      case HazardKind.Glacial: {
        // Frost gathers: everything she can see gets tinted, and the shadows behind walls are safe.
        g.circle(0, 0, 1500).fill({ color: 0x80deea, alpha: 0.06 + 0.14 * progress });
        const map = MAPS[snap.map];
        const reach = 1600;
        for (const wall of mapWalls(map, !snap.arena?.open, !!snap.finale && snap.finale.stage !== 'crumble')) {
          if (wall.thin) continue;
          const cx = wall.x + wall.w / 2 - g.x;
          const cy = wall.y + wall.h / 2 - g.y;
          if (cx * cx + cy * cy > 900 * 900) continue;
          const corners = [
            [wall.x - g.x, wall.y - g.y],
            [wall.x + wall.w - g.x, wall.y - g.y],
            [wall.x + wall.w - g.x, wall.y + wall.h - g.y],
            [wall.x - g.x, wall.y + wall.h - g.y],
          ];
          const far = (c: number[]) => {
            const d = Math.hypot(c[0], c[1]) || 1;
            return [c[0] + (c[0] / d) * reach, c[1] + (c[1] / d) * reach];
          };
          for (let k = 0; k < 4; k++) {
            const c1 = corners[k];
            const c2 = corners[(k + 1) % 4];
            g.poly([...c1, ...c2, ...far(c2), ...far(c1)]).fill({ color: 0x06121c, alpha: 0.45 });
          }
        }
        g.circle(0, 0, 60 + 200 * (1 - progress)).stroke({ width: 5, color: 0xe0f7fa, alpha: 0.4 + 0.5 * progress });
        return;
      }
    }
  }

  /** Dark shadows behind every wall near (0, 0) of `g` (where a blast from there can't reach), out to `reach`. */
  private wallShadows(g: Graphics, snap: Snapshot, reach: number, color: number, alpha: number): void {
    const map = MAPS[snap.map];
    for (const wall of mapWalls(map, !snap.arena?.open, !!snap.finale && snap.finale.stage !== 'crumble')) {
      if (wall.thin) continue;
      const cx = wall.x + wall.w / 2 - g.x;
      const cy = wall.y + wall.h / 2 - g.y;
      if (cx * cx + cy * cy > reach * reach) continue;
      const corners = [
        [wall.x - g.x, wall.y - g.y],
        [wall.x + wall.w - g.x, wall.y - g.y],
        [wall.x + wall.w - g.x, wall.y + wall.h - g.y],
        [wall.x - g.x, wall.y + wall.h - g.y],
      ];
      const far = (c: number[]) => {
        const d = Math.hypot(c[0], c[1]) || 1;
        return [c[0] + (c[0] / d) * reach, c[1] + (c[1] / d) * reach];
      };
      for (let k = 0; k < 4; k++) {
        const c1 = corners[k];
        const c2 = corners[(k + 1) % 4];
        g.poly([...c1, ...c2, ...far(c2), ...far(c1)]).fill({ color, alpha });
      }
    }
  }

  private renderPickups({ a, b, t }: Sample, showBreaks: boolean): void {
    const list = b.snap.pickups;
    const now = performance.now();
    const bob = 1 + Math.sin(now / 200) * 0.1;
    const textures = [this.tex.crate, this.tex.heart, this.tex.coin, this.tex.bomb, this.tex.artifact];
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
      } else if (kind === PickupKind.Artifact) {
        // Floats and glows in its tier's color.
        view.sprite.tint = TIERS[TIER_IDS[list[i + 4]] ?? 'common'].color;
        view.sprite.scale.set(1 + Math.sin(now / 260 + id) * 0.08);
        y += Math.sin(now / 400 + id) * 4;
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
        else if (view.type === PickupKind.Artifact) this.burst(view.sprite.x, view.sprite.y, view.sprite.tint as number, 24);
      }
      this.release(view.sprite);
      this.pickupViews.delete(id);
    }
  }

  /** A spirit wolf's head, front on, about 26px across: ears up, yellow eyes, a pale muzzle. */
  private wolfHead(): Graphics {
    // Drawn on the icons' 32x32 grid, centered and scaled down.
    const k = 0.8;
    const p = (x: number, y: number): [number, number] => [(x - 16) * k, (y - 16) * k];
    const g = new Graphics();
    g.circle(0, 0, 15).fill({ color: 0xa5d6a7, alpha: 0.18 });
    g.moveTo(...p(5, 3))
      .lineTo(...p(12, 10))
      .lineTo(...p(20, 10))
      .lineTo(...p(27, 3))
      .lineTo(...p(27, 16))
      .bezierCurveTo(...p(27, 22), ...p(22, 28), ...p(16, 30))
      .bezierCurveTo(...p(10, 28), ...p(5, 22), ...p(5, 16))
      .closePath()
      .fill(0x9fb6a4)
      .stroke({ width: 1.5, color: 0x2e4a36 });
    g.poly([...p(7.5, 6.5), ...p(11, 10.5), ...p(7.5, 12)]).fill(0x5f7a66);
    g.poly([...p(24.5, 6.5), ...p(21, 10.5), ...p(24.5, 12)]).fill(0x5f7a66);
    g.poly([...p(10.5, 21.5), ...p(16, 30), ...p(21.5, 21.5), ...p(16, 23.5)]).fill(0xdfeee2);
    g.circle(...p(11.5, 16), 2.2 * k).circle(...p(20.5, 16), 2.2 * k).fill(0xffe066);
    g.poly([...p(14, 21.5), ...p(18, 21.5), ...p(16, 24.5)]).fill(0x2a2f2b);
    return g;
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
      this.updateDragon(view, p, p.id === myId ? aim : null);
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
      embers: [],
      dragon: null,
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
    const field = p.downed ? 0 : fieldRadius(p.upgrades, p.character, p.artifact);
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

  /**
   * Dragon Form: a fiery dragon in place of the hero's token, facing where they aim. It's drawn in Mordak's units (his
   * radius) and scaled down (see poseDragon).
   */
  private updateDragon(view: PlayerView, p: PlayerState, aim: number | null): void {
    const dragon = p.dragon && !p.downed;
    if (dragon && !view.dragon) {
      view.dragon = this.newDragon();
      view.root.addChildAt(view.dragon.root, view.root.getChildIndex(view.avatar));
    }
    view.avatar.visible = !dragon;
    view.feet.visible = !dragon;
    if (!view.dragon) return;
    const d = view.dragon;
    d.root.visible = dragon;
    if (!dragon) return;
    const R = ENEMY_TYPES[EnemyType.Mordak].radius;
    d.root.scale.set((TOKEN_R * 2.3) / R);
    d.root.rotation = aim ?? p.aim;
    this.poseDragon(d, { R, color: DRAGON_FORM_COLOR, flash: p.hurt, moving: view.moving, seed: p.id });
  }

  /** The parts of a dragon (Dragon Form, or Mordak himself): wings first, legs over their roots, the body on top. */
  private newDragon(): DragonView {
    const root = new Container();
    const legs = new Graphics();
    const wings: [Sprite, Sprite] = [new Sprite(), new Sprite()];
    const body = new Graphics();
    root.addChild(...wings, legs, body);
    return { root, legs, wings, body, stride: 0, last: performance.now(), moving: 0 };
  }

  /**
   * Poses a dragon for this frame, in units of `R` (a body radius). Its legs step in a slow trot while it walks
   * (`moving`, 0 to 1), its wings beat (slowly at rest, harder on the move, hard in flight) and its body sways along.
   * A `torn` wing stays on, but hangs folded back, limp and dark. In flight the legs are tucked in.
   */
  private poseDragon(
    d: DragonView,
    o: {
      R: number;
      color: number;
      flash: boolean;
      moving: number;
      seed: number;
      torn?: [boolean, boolean];
      flying?: boolean;
      bulk?: number;
      /** Mordak's build (see drawHeavyDragonBody): broader wings, dark claws. */
      heavy?: boolean;
    },
  ): void {
    const { R, color, flash, seed } = o;
    // How heavy its build is: wider plates, neck, tail and stance (Mordak is a brute of a dragon).
    const bulk = o.bulk ?? 1;
    const moving = o.flying ? 0 : o.moving;
    const now = performance.now() / 1000;
    // A big, slow stride: its own clock, not a hero's quick steps.
    const dt = Math.min(0.1, now - d.last / 1000);
    d.last = performance.now();
    d.stride += dt * DRAGON_STRIDE * moving;
    const step = d.stride;

    // The spine: a slow wave runs down the body as it walks, and the tail sways on its own (more toward the tip).
    const sway = (x: number) => {
      const walk = Math.sin(step - (x / R) * 2.4) * 0.07 * R * moving;
      const tail = x < -0.4 * R ? Math.sin(now * 1.7 + seed + (x / R) * 2.2) * 0.06 * R * (-x / R - 0.4) : 0;
      return walk + tail;
    };
    const breath = 1 + Math.sin(now * 2.4 + seed) * 0.03;
    if (o.heavy) this.drawHeavyDragonBody(d.body, R, sway, breath, flash, color, bulk);
    else this.drawDragonBody(d.body, R, sway, breath, flash, color, bulk);
    const wingSize = o.heavy ? 1.2 : 0.85;

    // The wings: hinged at the shoulders (on the chest). A beat folds them in and sweeps them further back.
    const beat = Math.sin(now * (o.flying ? 9 : moving > 0.3 ? 11 : 4.5) + seed);
    const depth = o.flying ? 0.5 : 0.12 + 0.33 * moving;
    const shoulderX = DRAGON_PARTS.chest.x * R;
    for (const [i, side] of [-1, 1].entries()) {
      const wing = d.wings[i];
      const art = this.dragonWingTexture(side, flash, color);
      wing.texture = art.texture;
      wing.anchor.set(art.anchor.x, art.anchor.y);
      wing.position.set(shoulderX, sway(shoulderX) + side * DRAGON_PARTS.chest.ry * bulk * 0.8 * R);
      if (o.torn?.[i]) {
        // Torn: folded back along the body, limp, scorched dark, twitching now and then.
        const twitch = Math.max(0, Math.sin(now * 1.3 + seed + i * 2)) ** 8 * 0.08;
        wing.scale.set(wingSize * 0.73, wingSize * 0.59);
        wing.rotation = side * (DRAGON_WING_TILT + 0.55 + twitch);
        wing.tint = flash ? 0xffffff : 0x6a5050;
        continue;
      }
      wing.tint = 0xffffff;
      wing.scale.set(wingSize * (1 - 0.08 * depth * (beat + 1)), wingSize * (1 - depth * (beat + 1) * 0.5));
      wing.rotation = side * (DRAGON_WING_TILT + 0.12 * depth * (beat + 1));
    }

    // The legs: front ones on the chest, back ones on the hips, trotting (front left with back right, then the other
    // pair). Mid-stride a foot lifts and tucks in a little; planted, it's out wide. Claws out. Tucked in, in flight.
    const g = d.legs.clear();
    const legColor = flash ? 0xffffff : shade(color, -0.45);
    const tuck = o.flying ? 0.55 : 1;
    for (const [part, side, phase] of [
      ['chest', -1, 0],
      ['chest', 1, Math.PI],
      ['hips', -1, Math.PI],
      ['hips', 1, 0],
    ] as const) {
      const at = DRAGON_PARTS[part];
      const cycle = Math.sin(step + phase);
      const lift = Math.max(0, Math.cos(step + phase)) * moving;
      const hipX = at.x * R;
      const hipY = sway(hipX) + side * at.ry * bulk * 0.7 * R;
      const footX = hipX + cycle * 0.26 * R * moving - (o.flying ? 0.12 * R : 0);
      const footY = sway(hipX) + side * (0.56 * bulk - 0.08 * lift) * R * tuck;
      const kneeX = (hipX + footX) / 2 + (part === 'chest' ? 0.06 : -0.06) * R;
      const kneeY = sway(hipX) + side * 0.44 * bulk * R * tuck;
      g.moveTo(hipX, hipY).lineTo(kneeX, kneeY).lineTo(footX, footY).stroke({ width: R * 0.15 * bulk, color: 0x140404, cap: 'round', join: 'round' });
      g.moveTo(hipX, hipY).lineTo(kneeX, kneeY).lineTo(footX, footY).stroke({ width: R * 0.09 * bulk, color: legColor, cap: 'round', join: 'round' });
      for (const c of [-1, 0, 1]) {
        g.moveTo(footX, footY).lineTo(footX + R * 0.1, footY + side * R * 0.03 + c * R * 0.05).stroke({ width: R * 0.04, color: o.heavy ? 0x0d0202 : 0xfff3e0, cap: 'round' });
      }
    }
  }

  /**
   * Dragon Form's body, in parts along a spine (`sway(x)` is how far the spine bends sideways at x): a long tail of
   * tapering segments ending in a spade, then hips, belly and a broad chest (a lean, long build), a two-part neck and a
   * wedge of a head with horns swept back. Spines down the back, scales on the plates, and lava between them. All
   * white when hit.
   */
  private drawDragonBody(g: Graphics, R: number, sway: (x: number) => number, breath: number, flash: boolean, color: number, bulk = 1): void {
    g.clear();
    const fill = (c: number) => (flash ? 0xffffff : c);
    const ink = 0x2b0d02;
    const dark = shade(color, -0.35);
    const P = DRAGON_PARTS;
    // The tail: a tapering ribbon along the spine, then its spade.
    const top: number[] = [];
    const bottom: number[] = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (P.tail.from + (P.tail.to - P.tail.from) * t) * R;
      const w = (P.tail.width * bulk * (1 - t) + 0.025) * R;
      top.push(x, sway(x) - w);
      bottom.unshift(x, sway(x) + w);
    }
    g.poly([...top, ...bottom]).fill(fill(dark)).stroke({ width: 3, color: ink, join: 'round' });
    const tipX = P.tail.to * R;
    const tipY = sway(tipX);
    g.poly([tipX + 0.04 * R, tipY, tipX - 0.1 * R, tipY - 0.11 * R, tipX - 0.22 * R, tipY, tipX - 0.1 * R, tipY + 0.11 * R]).fill(fill(0x1a0606)).stroke({ width: 2, color: ink });
    // Hips, belly and chest: overlapping plates, the chest broadest.
    for (const part of [P.hips, P.belly, P.chest]) {
      const x = part.x * R;
      g.ellipse(x, sway(x), part.rx * R * (1 + (bulk - 1) * 0.4), part.ry * bulk * R * breath).fill(fill(color)).stroke({ width: 3, color: ink });
    }
    // The neck, in two parts, and the head.
    for (const n of P.neck) {
      const x = n.x * R;
      g.circle(x, sway(x), n.r * bulk * R).fill(fill(color)).stroke({ width: 3, color: ink });
    }
    const hx = P.head.x * R;
    const hy = sway(hx);
    for (const side of [-1, 1]) {
      g.poly([hx + 0.05 * R, hy + side * 0.08 * R, hx - 0.18 * R, hy + side * 0.24 * R, hx - 0.3 * R, hy + side * 0.26 * R, hx - 0.14 * R, hy + side * 0.13 * R]).fill(fill(0x1a0606)).stroke({ width: 2, color: 0x000000 });
    }
    g.poly([hx - 0.12 * R, hy - 0.14 * R, hx + 0.14 * R, hy - 0.1 * R, hx + 0.36 * R, hy - 0.04 * R, hx + 0.4 * R, hy, hx + 0.36 * R, hy + 0.04 * R, hx + 0.14 * R, hy + 0.1 * R, hx - 0.12 * R, hy + 0.14 * R])
      .fill(fill(shade(color, 0.08)))
      .stroke({ width: 3, color: ink, join: 'round' });
    if (flash) return;
    // Eyes like coals, and smoldering nostrils.
    for (const side of [-1, 1]) {
      g.circle(hx + 0.08 * R, hy + side * 0.065 * R, 0.035 * R).fill(0xffab00);
      g.circle(hx + 0.36 * R, hy + side * 0.025 * R, 0.015 * R).fill(0xff6d00);
    }
    // Scales on the plates, and lava glowing where they meet.
    for (const part of [P.hips, P.belly, P.chest]) {
      const x = part.x * R;
      const y = sway(x);
      for (let k = -1; k <= 1; k++) {
        g.moveTo(x - 0.07 * R + k * 0.09 * R, y + 0.08 * R).arc(x + k * 0.09 * R, y + 0.08 * R, 0.07 * R, Math.PI, Math.PI * 2).stroke({ width: 2, color: 0x3b1003, alpha: 0.8 });
        g.moveTo(x - 0.07 * R + k * 0.09 * R, y - 0.04 * R).arc(x + k * 0.09 * R, y - 0.04 * R, 0.07 * R, Math.PI, Math.PI * 2).stroke({ width: 2, color: 0x3b1003, alpha: 0.8 });
      }
    }
    for (const [a, b] of [
      [P.hips, P.belly],
      [P.belly, P.chest],
    ]) {
      const x = ((a.x + a.rx * 0.6 + b.x - b.rx * 0.6) / 2) * R;
      const y = sway(x);
      g.moveTo(x, y - 0.14 * R).lineTo(x + 0.02 * R, y).lineTo(x, y + 0.14 * R).stroke({ width: 3, color: 0xff9100, alpha: 0.75, cap: 'round' });
    }
    // A ridge of spines down the back, from the neck to the tail.
    for (let i = 0; i < 12; i++) {
      const x = (0.62 - i * 0.16) * R;
      const y = sway(x);
      const size = R * 0.06 * (1 - i * 0.05);
      g.poly([x + size, y, x - size * 0.8, y - size * 0.7, x - size * 0.8, y + size * 0.7]).fill(0x140404);
    }
  }

  /**
   * Mordak's body: not plates but one powerful shape along the spine, broad at the shoulders and narrowing into a long,
   * thick neck, with a heavy tail behind it fringed with spikes. Rows of black scales across the back with lava between
   * them, a ridge of great spines, and a big wedge of a head: long snout, jaw, brow ridges and two huge horns swept
   * back. All white when hit.
   */
  private drawHeavyDragonBody(g: Graphics, R: number, sway: (x: number) => number, breath: number, flash: boolean, color: number, bulk: number): void {
    g.clear();
    const fill = (c: number) => (flash ? 0xffffff : c);
    const ink = 0x1a0505;
    const dark = shade(color, -0.4);
    // Half the body's width along the spine (x in R): the tail tapering from the hips, the torso swelling to the
    // shoulders, then the neck narrowing to the head.
    const TAIL_END = -1.9;
    const HIPS = -0.45;
    const SHOULDERS = 0.62;
    const HEAD = 1.05;
    const width = (x: number) => {
      if (x < HIPS) {
        const t = (x - HIPS) / (TAIL_END - HIPS);
        return (0.13 * (1 - t) ** 1.3 + 0.012) * bulk;
      }
      if (x < SHOULDERS) {
        const t = (x - HIPS) / (SHOULDERS - HIPS);
        return (0.13 + 0.12 * Math.sin(Math.PI * t ** 1.9)) * bulk * breath;
      }
      const t = (x - SHOULDERS) / (HEAD - SHOULDERS);
      return (0.13 - 0.05 * t) * bulk;
    };
    const outline = (from: number, to: number, steps: number) => {
      const top: number[] = [];
      const bottom: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const x = (from + ((to - from) * i) / steps) * R;
        const w = width(x / R) * R;
        top.push(x, sway(x) - w);
        bottom.unshift(x, sway(x) + w);
      }
      return [...top, ...bottom];
    };
    // Spikes along both edges of the tail, then the tail, and its barbed tip.
    for (let i = 1; i < 9; i++) {
      const x = (HIPS + ((TAIL_END - HIPS) * i) / 9) * R;
      const w = width(x / R) * R;
      const size = R * 0.07 * (1 - i / 11);
      for (const side of [-1, 1]) {
        const y = sway(x) + side * w;
        g.poly([x + size, y, x - size * 0.6, y + side * size * 1.3, x - size * 1.1, y]).fill(fill(0x0d0202));
      }
    }
    g.poly(outline(HIPS + 0.05, TAIL_END, 18)).fill(fill(dark)).stroke({ width: 3, color: ink, join: 'round' });
    const tipX = TAIL_END * R;
    const tipY = sway(tipX);
    g.poly([tipX + 0.05 * R, tipY, tipX - 0.1 * R, tipY - 0.16 * R, tipX - 0.3 * R, tipY, tipX - 0.1 * R, tipY + 0.16 * R]).fill(fill(0x0d0202)).stroke({ width: 2, color: ink });
    // The torso and neck, as one.
    g.poly(outline(HIPS - 0.02, HEAD - 0.05, 24)).fill(fill(color)).stroke({ width: 4, color: ink, join: 'round' });
    // The head: a long wedge with a jaw, brow ridges and horns sweeping back past the neck.
    const hx = HEAD * R;
    const hy = sway(hx);
    const k = R * bulk * 0.62;
    const at = (dx: number, dy: number) => [hx + dx * k, hy + dy * k];
    for (const side of [-1, 1]) {
      // Horns: long, curving back and out.
      g.poly([...at(-0.05, side * 0.18), ...at(-0.32, side * 0.42), ...at(-0.62, side * 0.66), ...at(-0.5, side * 0.44), ...at(-0.26, side * 0.24), ...at(-0.02, side * 0.08)])
        .fill(fill(0x5d4e44))
        .stroke({ width: 3, color: 0x120404, join: 'round' });
      if (!flash) g.poly([...at(-0.42, side * 0.52), ...at(-0.62, side * 0.66), ...at(-0.5, side * 0.48)]).fill(0xd7ccc8);
      // A frill of smaller spikes along the jaw.
      g.poly([...at(0.1, side * 0.15), ...at(-0.08, side * 0.3), ...at(-0.1, side * 0.14)]).fill(fill(0x0d0202));
    }
    g.poly([...at(-0.15, -0.2), ...at(0.1, -0.22), ...at(0.45, -0.1), ...at(0.62, -0.05), ...at(0.66, 0), ...at(0.62, 0.05), ...at(0.45, 0.1), ...at(0.1, 0.22), ...at(-0.15, 0.2)])
      .fill(fill(shade(color, 0.06)))
      .stroke({ width: 4, color: ink, join: 'round' });
    if (flash) return;
    // The snout's ridge and the mouth line, brow ridges over eyes like coals, smoldering nostrils.
    g.moveTo(...(at(0.05, 0) as [number, number])).lineTo(...(at(0.55, 0) as [number, number])).stroke({ width: 3, color: shade(color, -0.3), cap: 'round' });
    for (const side of [-1, 1]) {
      g.moveTo(...(at(0.62, side * 0.04) as [number, number])).lineTo(...(at(0.2, side * 0.14) as [number, number])).stroke({ width: 2, color: 0x2b0000, alpha: 0.9 });
      g.poly([...at(0.02, side * 0.06), ...at(0.2, side * 0.08), ...at(0.08, side * 0.13)]).fill(0x0d0202);
      const [ex, ey] = at(0.1, side * 0.085);
      g.circle(ex, ey, 0.032 * k * 1.6).fill({ color: 0xff6d00, alpha: 0.5 }).circle(ex, ey, 0.03 * k).fill(0xffd740);
      const [nx, ny] = at(0.6, side * 0.03);
      g.circle(nx, ny, 0.018 * k).fill(0xff3d00);
    }
    // Rows of black scales across the back, with lava glowing between some of them.
    for (let x = HIPS + 0.08; x < SHOULDERS + 0.15; x += 0.13) {
      const px = x * R;
      const py = sway(px);
      const w = width(x) * R * 0.85;
      g.moveTo(px - 0.05 * R, py - w).quadraticCurveTo(px + 0.06 * R, py, px - 0.05 * R, py + w).stroke({ width: 3, color: 0x2a0606, alpha: 0.85 });
    }
    for (const x of [-0.12, 0.2, 0.45]) {
      const px = x * R;
      const py = sway(px);
      const w = width(x) * R * 0.6;
      g.moveTo(px, py - w).quadraticCurveTo(px + 0.05 * R, py, px, py + w).stroke({ width: 5, color: 0xff6d00, alpha: 0.4 }).moveTo(px, py - w).quadraticCurveTo(px + 0.05 * R, py, px, py + w).stroke({ width: 1.5, color: 0xffd180, alpha: 0.85 });
    }
    // A ridge of great spines from the head down the tail.
    for (let i = 0; i < 16; i++) {
      const x = (0.95 - i * 0.16) * R;
      const y = sway(x);
      const size = R * 0.1 * bulk * 0.6 * (1 - i * 0.045);
      g.poly([x + size * 0.6, y, x - size, y - size * 0.55, x - size * 0.75, y, x - size, y + size * 0.55]).fill(0x0d0202);
    }
  }

  /** One dragon wing (see drawDragonWing), and where its shoulder falls in it (its anchor, to flap around). */
  private dragonWingTexture(side: number, flash: boolean, color: number): { texture: Texture; anchor: { x: number; y: number } } {
    const key = `dragonWing|${side}|${flash}|${color}`;
    const cached = this.dragonWings.get(key);
    if (cached) return cached;
    const g = new Graphics();
    drawDragonWing(g, side, flash, color);
    const b = g.getLocalBounds();
    const frame = new Rectangle(b.x - 4, b.y - 4, b.width + 8, b.height + 8);
    const texture = this.app.renderer.generateTexture({ target: g, frame, resolution: 2 });
    g.destroy();
    const R = ENEMY_TYPES[EnemyType.Mordak].radius;
    const anchor = { x: (DRAGON_SHOULDER.x * R - frame.x) / frame.width, y: (side * DRAGON_SHOULDER.y * R - frame.y) / frame.height };
    const wing = { texture, anchor };
    this.dragonWings.set(key, wing);
    return wing;
  }

  private updateBlades(view: PlayerView, p: PlayerState, time: number): void {
    this.updateEmbers(view, p, time);
    const stats = p.downed ? null : orbitLayout(p.upgrades, p.character, p.artifact);
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

  /** The Ember Halo: fireballs circling the hero, half a step off Orbit's blades (the server uses the same formula). */
  private updateEmbers(view: PlayerView, p: PlayerState, time: number): void {
    const stats = p.downed ? null : orbitLayout(p.upgrades, p.character, p.artifact, 'embers');
    const count = stats?.count ?? 0;
    while (view.embers.length < count) {
      const ember = new Sprite(this.tex.bolt);
      ember.anchor.set(0.5);
      ember.tint = 0xff7043;
      view.bladeLayer.addChild(ember);
      view.embers.push(ember);
    }
    while (view.embers.length > count) view.embers.pop()!.destroy();
    if (!stats) return;
    const flicker = 1 + Math.sin(performance.now() / 70) * 0.08;
    view.embers.forEach((ember, i) => {
      const angle = time * stats.spin + ((i + 0.5) * Math.PI * 2) / count;
      ember.position.set(Math.cos(angle) * stats.radius, Math.sin(angle) * stats.radius);
      ember.scale.set(((stats.bladeRadius * 2.4) / Math.max(1, this.tex.bolt.width)) * flicker);
    });
  }

  // --- Damage numbers ---

  /**
   * Your hits ([x, y, amount, crit, type, ...]) float up off enemies in their damage type's color (orange physical,
   * blue magic, white true; crits bigger, yellow or deep blue); damage you take (0 = evaded) floats up off you.
   */
  addDamageNumbers(hits: number[], taken: number[], me: Point): void {
    for (let i = 0; i < hits.length; i += HIT_STRIDE) {
      const crit = hits[i + 3] === 1;
      const type = DAMAGE_TYPES[hits[i + 4]] ?? 'physical';
      const color = crit ? CRIT_COLORS[type] : DAMAGE_COLORS[type];
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

  /**
   * An enemy type's look in a color (or its white hit-flash silhouette), centered on the enemy and drawn at 2x for
   * sharpness. Kept, since maps share colors and sprites may still show the last map's.
   */
  private enemyTexture(type: number, flash: boolean, color = ENEMY_TYPES[type].color, variant = 3): Texture {
    const key = `${type}|${flash ? 'flash' : color}|${variant}`;
    let texture = this.enemyTextures.get(key);
    if (texture) return texture;
    const g = new Graphics();
    const reach = Math.ceil(drawEnemy(g, type, flash, color, variant)) + 4;
    texture = this.app.renderer.generateTexture({ target: g, frame: new Rectangle(-reach, -reach, reach * 2, reach * 2), resolution: 2 });
    g.destroy();
    this.enemyTextures.set(key, texture);
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
