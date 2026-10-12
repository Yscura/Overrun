import { Application, BitmapFont, BitmapText, Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { CHARACTER_IDS, type CharacterId } from '../shared/characters';
import { CRATE_RADIUS, HEART_RADIUS, PLAYER_RADIUS } from '../shared/constants';
import { ENEMY_TYPES } from '../shared/enemies';
import { MAPS } from '../shared/maps';
import { Minimap } from './minimap';
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
} from '../shared/protocol';
import { fieldRadius, orbitLayout } from '../shared/characters';
import type { Sample } from './snapshots';

const MAX_PARTICLES = 800;
const DANGER = 0xff1744;
const STUNNED = 0x90caf9;
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

interface PlayerView {
  root: Container;
  bladeLayer: Container;
  blades: Sprite[];
  body: Sprite;
  outline: Sprite;
  bars: Graphics;
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
interface Effect {
  g: Graphics;
  life: number;
  maxLife: number;
  draw: (g: Graphics, progress: number) => void;
}

export class GameRenderer {
  readonly app = new Application();

  private world = new Container();
  private background!: TilingSprite;
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
    enemies: Texture[];
    bodies: Record<CharacterId, { fill: Texture; outline: Texture }>;
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
  /** Screen-space arrows pointing at off-screen shrines and quest targets. */
  private pointers = new Container();

  private frame = 0;
  private shrineViews = new Map<number, ShrineView>();
  private spritePool: Sprite[] = [];
  private enemyViews = new Map<number, TypedView>();
  private pickupViews = new Map<number, TypedView>();
  private projectileViews = new Map<number, PointView>();
  private enemyShotViews = new Map<number, PointView>();
  private gemViews = new Map<number, PointView>();
  private playerViews = new Map<number, PlayerView>();
  private hazardViews = new Map<number, { g: Graphics; seen: number }>();
  /** Venom puddles are drawn together in one graphic; mines are sprites. */
  private venom = new Graphics();
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

    // Most textures are white so one texture can be tinted to any color.
    const circle = (radius: number) =>
      this.texture(
        new Graphics()
          .circle(0, 0, radius)
          .fill(0xffffff)
          .circle(0, 0, radius)
          .stroke({ width: 2, color: 0x000000, alpha: 0.45 }),
      );
    this.tex = {
      enemies: ENEMY_TYPES.map((def) => circle(def.radius)),
      bodies: Object.fromEntries(CHARACTER_IDS.map((id) => [id, this.bodyTextures(id)])) as Record<CharacterId, { fill: Texture; outline: Texture }>,
      aimArrow: this.texture(new Graphics().poly([0, -6, 10, 0, 0, 6]).fill({ color: 0xffffff, alpha: 0.85 })),
      bolt: this.texture(new Graphics().circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.3 }).circle(0, 0, 5).fill(0xffffff)),
      knife: this.texture(new Graphics().poly([-9, -2, 7, -2, 12, 0, 7, 2, -9, 2]).fill(0xffffff)),
      shuriken: this.texture(this.starShape(new Graphics(), 20, 7, 4).fill(0xffffff).circle(0, 0, 4).fill(0x263238)),
      hex: this.texture(new Graphics().circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.25 }).poly(this.hexagon(6)).fill(0xffffff)),
      // Mines keep their own colors: dark casing with a red light.
      mine: this.texture(new Graphics().circle(0, 0, 9).fill(0x37474f).stroke({ width: 2, color: 0xffab40 }).circle(0, 0, 3).fill(0xff1744)),
      enemyShot: this.texture(new Graphics().circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.3 }).circle(0, 0, 6).fill(0xffffff)),
      blade: this.texture(new Graphics().poly([0, -14, 5, 0, 0, 14, -5, 0]).fill(0xffffff)),
      gemSmall: this.texture(new Graphics().poly([0, -7, 5, 0, 0, 7, -5, 0]).fill(0xffffff)),
      gemBig: this.texture(new Graphics().poly([0, -11, 8, 0, 0, 11, -8, 0]).fill(0xffffff)),
      // A wooden box with a red cross, and the red cross it drops when broken. These keep their own colors.
      crate: this.texture(
        this.crossShape(
          new Graphics().roundRect(-CRATE_RADIUS, -CRATE_RADIUS, CRATE_RADIUS * 2, CRATE_RADIUS * 2, 4).fill(HEALTH_GREEN).stroke({ width: 3, color: 0x1b5e20 }),
          10,
          3.5,
          0xffffff,
        ),
      ),
      heart: this.texture(this.crossShape(new Graphics(), HEART_RADIUS, 4.5, HEALTH_GREEN, 0xffffff)),
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
    this.world.addChild(this.mapLayer, this.arenaRing, this.questMarker, ...Object.values(this.layers), this.zone, this.aimArrow);
    this.app.stage.addChild(this.background, this.world, this.pointers, this.minimap.container);
  }

  /** Floor, map edge and walls in the map's colors. */
  private setMap(index: number): void {
    this.mapIndex = index;
    const map = MAPS[index];
    const { theme } = map;

    const tile = new Graphics().rect(0, 0, 64, 64).fill(theme.background).rect(0, 0, 64, 1).fill(theme.grid).rect(0, 0, 1, 64).fill(theme.grid);
    const old = this.background.texture;
    this.background.texture = this.texture(tile);
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

    const walls = new Graphics();
    for (const w of map.walls) {
      if (w.thin) {
        // A fence: a light rail with posts along it.
        walls.rect(w.x, w.y, w.w, w.h).fill({ color: theme.fence, alpha: 0.75 });
        const along = w.w > w.h;
        const length = along ? w.w : w.h;
        for (let d = 0; d <= length; d += 36) {
          const px = along ? w.x + Math.min(d, w.w - 6) : w.x - 2;
          const py = along ? w.y - 2 : w.y + Math.min(d, w.h - 6);
          walls.rect(px, py, along ? 6 : w.w + 4, along ? w.h + 4 : 6).fill(theme.wallEdge);
        }
      } else {
        // A solid block with a lighter top edge.
        walls.rect(w.x, w.y, w.w, w.h).fill(theme.wall).stroke({ width: 3, color: theme.wallEdge, alignment: 1 });
        walls.rect(w.x + 3, w.y + 3, w.w - 6, Math.min(6, w.h - 6)).fill({ color: 0xffffff, alpha: 0.12 });
      }
    }
    this.mapLayer.addChild(outside, walls);
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
    if (arena.state !== 'idle' && arena.zoneIn <= 0) {
      const map = MAPS[snap.map];
      zone
        .rect(-200, -200, map.width + 400, map.height + 400)
        .fill({ color: DANGER, alpha: 0.1 + 0.05 * pulse })
        .circle(arena.x, arena.y, arena.r)
        .cut();
    }
  }

  addFx(fx: Fx): void {
    switch (fx.k) {
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
    const cam = hasMe ? local : MAPS[b.snap.map].spawn;
    this.world.position.set(Math.round(width / 2 - cam.x), Math.round(height / 2 - cam.y));
    this.background.width = width;
    this.background.height = height;
    this.background.tilePosition.set(this.world.x, this.world.y);

    const playing = b.snap.phase === 'playing';
    this.renderArena(b.snap);
    this.renderShrines(b.snap);
    this.renderQuestMarker(b.snap);
    this.renderHazards(sample);
    this.renderZones(b.snap.zones);
    this.renderEnemies(sample, playing);
    this.renderPoints(this.projectileViews, a.snap.projectiles, a.projectiles, b.snap.projectiles, PROJECTILE_STRIDE, 2, t, this.layers.projectiles, (list, i) =>
      list[i + 1] === ProjectileKind.Knife
        ? { texture: this.tex.knife, tint: 0xeceff1, rotate: true }
        : list[i + 1] === ProjectileKind.Shuriken
          ? { texture: this.tex.shuriken, tint: 0xce93d8, spin: true }
          : list[i + 1] === ProjectileKind.Hex
            ? { texture: this.tex.hex, tint: 0xea80fc, spin: true }
            : { texture: this.tex.bolt, tint: 0xb3e5fc },
    );
    this.renderPoints(this.enemyShotViews, a.snap.enemyShots, a.enemyShots, b.snap.enemyShots, ENEMY_SHOT_STRIDE, 1, t, this.layers.enemyShots, () => ({
      texture: this.tex.enemyShot,
      tint: 0xd4e157,
    }));
    this.renderPoints(this.gemViews, a.snap.gems, a.gems, b.snap.gems, GEM_STRIDE, 1, t, this.layers.gems, (list, i) =>
      list[i + 3] ? { texture: this.tex.gemBig, tint: 0xb388ff } : { texture: this.tex.gemSmall, tint: 0x69f0ae },
    );
    this.renderPickups(sample, playing);
    this.renderPlayers(sample, myId, local);

    this.aimArrow.visible = hasMe && aim !== null;
    if (aim !== null) {
      const r = PLAYER_RADIUS + 14;
      this.aimArrow.position.set(local.x + Math.cos(aim) * r, local.y + Math.sin(aim) * r);
      this.aimArrow.rotation = aim;
    }
    this.renderPointers(b.snap, myId);
    this.minimap.update(b.snap, myId, cam, { x: cam.x - width / 2, y: cam.y - height / 2, w: width, h: height }, width);
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
    const blink = Math.floor(performance.now() / 80) % 2 === 0;
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
        view = { sprite: this.acquire(this.tex.enemies[type], this.layers.enemies), type, seen: 0 };
        this.enemyViews.set(id, view);
      }
      view.seen = this.frame;
      view.sprite.position.set(x, y);
      // Winding up a charge: swell and blink as a warning.
      const windingUp = (flags & EnemyFlag.WindingUp) !== 0;
      view.sprite.scale.set(windingUp ? 1.15 : 1);
      const white = (flags & EnemyFlag.Hit) !== 0 || (windingUp && blink);
      const stunned = (flags & EnemyFlag.Stunned) !== 0;
      view.sprite.tint = white ? 0xffffff : stunned ? STUNNED : ENEMY_TYPES[type].color;
    }
    // Enemies that vanished died (or the run reset).
    for (const [id, view] of this.enemyViews) {
      if (view.seen === this.frame) continue;
      if (showDeaths) {
        this.burst(view.sprite.x, view.sprite.y, ENEMY_TYPES[view.type].color, ENEMY_TYPES[view.type].radius >= 50 ? 40 : 6);
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

  private renderPickups({ b }: Sample, showBreaks: boolean): void {
    // Pickups don't move, so no interpolation needed.
    const list = b.snap.pickups;
    const bob = 1 + Math.sin(performance.now() / 200) * 0.1;
    for (let i = 0; i < list.length; i += PICKUP_STRIDE) {
      const id = list[i];
      const kind = list[i + 1];
      let view = this.pickupViews.get(id);
      if (!view) {
        const texture = kind === PickupKind.Crate ? this.tex.crate : this.tex.heart;
        view = { sprite: this.acquire(texture, this.layers.pickups), type: kind, seen: 0 };
        view.sprite.position.set(list[i + 2], list[i + 3]);
        this.pickupViews.set(id, view);
      }
      view.seen = this.frame;
      if (kind === PickupKind.Heart) view.sprite.scale.set(bob);
      else view.sprite.tint = list[i + 4] ? 0xffcdd2 : 0xffffff;
    }
    for (const [id, view] of this.pickupViews) {
      if (view.seen === this.frame) continue;
      if (showBreaks) {
        const crate = view.type === PickupKind.Crate;
        this.burst(view.sprite.x, view.sprite.y, crate ? 0x1b5e20 : HEALTH_GREEN, crate ? 12 : 10);
      }
      this.release(view.sprite);
      this.pickupViews.delete(id);
    }
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
    look: (list: number[], i: number) => { texture: Texture; tint: number; rotate?: boolean; spin?: boolean },
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

  private renderPlayers({ a, b, t }: Sample, myId: number | null, local: Point): void {
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
      // Character can change in the lobby.
      const textures = this.tex.bodies[p.character];
      view.body.texture = textures.fill;
      view.outline.texture = textures.outline;
      view.body.tint = p.hurt ? 0xffffff : p.color;
      view.body.alpha = p.downed ? 0.35 : 1;
      view.root.alpha = p.invuln ? 0.5 : 1;
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
    const body = new Sprite(this.tex.bodies[p.character].fill);
    body.anchor.set(0.5);
    const outline = new Sprite(this.tex.bodies[p.character].outline);
    outline.anchor.set(0.5);
    const bars = new Graphics();
    const label = new Text({
      text: p.name,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: '600', fill: 0xffffff, stroke: { color: 0x000000, width: 3 } },
    });
    label.anchor.set(0.5, 1);
    label.y = -PLAYER_RADIUS - 8;
    root.addChild(bladeLayer, body, outline, bars, label);
    this.layers.players.addChild(root);
    const view: PlayerView = { root, bladeLayer, blades: [], body, outline, bars, seen: 0 };
    this.playerViews.set(p.id, view);
    return view;
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
    const y = PLAYER_RADIUS + 8;
    const ratio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    g.rect(-width / 2, y, width, 5).fill({ color: 0x000000, alpha: 0.7 });
    if (ratio > 0) g.rect(-width / 2, y, width * ratio, 5).fill(ratio > 0.35 ? 0x66bb6a : 0xef5350);
    if (p.downed) {
      const r = PLAYER_RADIUS + 12;
      const start = -Math.PI / 2;
      g.circle(0, 0, r).stroke({ width: 3, color: 0xffffff, alpha: 0.2 });
      if (p.revive > 0) {
        g.moveTo(Math.cos(start) * r, Math.sin(start) * r)
          .arc(0, 0, r, start, start + Math.PI * 2 * p.revive)
          .stroke({ width: 4, color: 0xffffff });
      }
    }
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

  /** Your hits ([x, y, amount, crit, ...]) float up off enemies; damage you take (0 = evaded) floats up off you. */
  addDamageNumbers(hits: number[], taken: number[], me: Point): void {
    for (let i = 0; i < hits.length; i += 4) {
      const crit = hits[i + 3] === 1;
      this.addNumber(hits[i], hits[i + 1] - 18, crit ? `${hits[i + 2]}!` : String(hits[i + 2]), crit ? 0xffd54f : 0xffffff, crit ? 0.8 : 0.55);
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
  private bodyTextures(character: CharacterId): { fill: Texture; outline: Texture } {
    const r = PLAYER_RADIUS;
    const shape = (g: Graphics): Graphics => {
      switch (character) {
        case 'assassin':
          return g.poly([0, -r - 3, r - 1, 0, 0, r + 3, -r + 1, 0]);
        case 'bruiser':
          return g.roundRect(-r + 1, -r + 1, (r - 1) * 2, (r - 1) * 2, 6);
        case 'tank': {
          const points: number[] = [];
          for (let i = 0; i < 6; i++) points.push(Math.cos((i * Math.PI) / 3) * (r + 2), Math.sin((i * Math.PI) / 3) * (r + 2));
          return g.poly(points);
        }
        default:
          return g.circle(0, 0, r);
      }
    };
    return {
      fill: this.texture(shape(new Graphics()).fill(0xffffff)),
      outline: this.texture(shape(new Graphics()).stroke({ width: 3, color: 0xffffff })),
    };
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
