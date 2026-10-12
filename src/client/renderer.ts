import { Application, Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { CHARACTER_IDS, type CharacterId } from '../shared/characters';
import { CRATE_RADIUS, HEART_RADIUS, PLAYER_RADIUS, WORLD_SIZE } from '../shared/constants';
import { CHARGER, ENEMY_TYPES, EnemyType } from '../shared/enemies';
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
  type Fx,
  type PlayerState,
} from '../shared/protocol';
import { orbitStats } from '../shared/upgrades';
import type { Sample } from './snapshots';

const MAX_PARTICLES = 800;
const DANGER = 0xff1744;

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
    hazards: new Container(),
    pickups: new Container(),
    gems: new Container(),
    enemies: new Container(),
    players: new Container(),
    projectiles: new Container(),
    enemyShots: new Container(),
    fx: new Container(),
  };
  private tex!: {
    enemies: Texture[];
    bodies: Record<CharacterId, { fill: Texture; outline: Texture }>;
    aimArrow: Texture;
    bolt: Texture;
    knife: Texture;
    enemyShot: Texture;
    blade: Texture;
    gemSmall: Texture;
    gemBig: Texture;
    crate: Texture;
    heart: Texture;
    particle: Texture;
  };
  private aimArrow!: Sprite;

  private frame = 0;
  private spritePool: Sprite[] = [];
  private enemyViews = new Map<number, TypedView>();
  private pickupViews = new Map<number, TypedView>();
  private projectileViews = new Map<number, PointView>();
  private enemyShotViews = new Map<number, PointView>();
  private gemViews = new Map<number, PointView>();
  private playerViews = new Map<number, PlayerView>();
  private hazardViews = new Map<number, { g: Graphics; seen: number }>();
  private particles: Particle[] = [];
  private effects: Effect[] = [];

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
      enemyShot: this.texture(new Graphics().circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.3 }).circle(0, 0, 6).fill(0xffffff)),
      blade: this.texture(new Graphics().poly([0, -14, 5, 0, 0, 14, -5, 0]).fill(0xffffff)),
      gemSmall: this.texture(new Graphics().poly([0, -7, 5, 0, 0, 7, -5, 0]).fill(0xffffff)),
      gemBig: this.texture(new Graphics().poly([0, -11, 8, 0, 0, 11, -8, 0]).fill(0xffffff)),
      // A wooden box with a red cross, and the red cross it drops when broken. These keep their own colors.
      crate: this.texture(
        this.crossShape(
          new Graphics().rect(-CRATE_RADIUS, -CRATE_RADIUS, CRATE_RADIUS * 2, CRATE_RADIUS * 2).fill(0x8d6e63).stroke({ width: 3, color: 0x4e342e }),
          10,
          3.5,
          0xe53935,
        ),
      ),
      heart: this.texture(this.crossShape(new Graphics(), HEART_RADIUS, 4.5, 0xff5252, 0xffffff)),
      particle: this.texture(new Graphics().rect(0, 0, 4, 4).fill(0xffffff)),
    };
    this.aimArrow = new Sprite(this.tex.aimArrow);
    this.aimArrow.anchor.set(0.5);

    const tile = new Graphics().rect(0, 0, 64, 64).fill(0x1a1d24).rect(0, 0, 64, 1).fill(0x242833).rect(0, 0, 1, 64).fill(0x242833);
    this.background = new TilingSprite({ texture: this.texture(tile), width: 1, height: 1 });

    // Darken everything outside the arena and outline its edge.
    const pad = 4000;
    const outside = new Graphics()
      .rect(-pad, -pad, WORLD_SIZE + pad * 2, pad)
      .rect(-pad, WORLD_SIZE, WORLD_SIZE + pad * 2, pad)
      .rect(-pad, 0, pad, WORLD_SIZE)
      .rect(WORLD_SIZE, 0, pad, WORLD_SIZE)
      .fill({ color: 0x08090c, alpha: 0.75 })
      .rect(0, 0, WORLD_SIZE, WORLD_SIZE)
      .stroke({ width: 6, color: 0x3a4250 });

    this.world.addChild(outside, ...Object.values(this.layers), this.aimArrow);
    this.app.stage.addChild(this.background, this.world);
  }

  addFx(fx: Fx): void {
    switch (fx.k) {
      case 'slam':
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
  render(sample: Sample, myId: number | null, local: Point, aim: number | null, dt: number): void {
    this.frame++;
    const { width, height } = this.app.screen;
    const hasMe = sample.b.snap.players.some((p) => p.id === myId);
    const cam = hasMe ? local : { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 };
    this.world.position.set(Math.round(width / 2 - cam.x), Math.round(height / 2 - cam.y));
    this.background.width = width;
    this.background.height = height;
    this.background.tilePosition.set(this.world.x, this.world.y);

    const { a, b, t } = sample;
    const playing = b.snap.phase === 'playing';
    this.renderHazards(sample);
    this.renderEnemies(sample, playing);
    this.renderPoints(this.projectileViews, a.snap.projectiles, a.projectiles, b.snap.projectiles, PROJECTILE_STRIDE, 2, t, this.layers.projectiles, (list, i) =>
      list[i + 1] === ProjectileKind.Knife ? { texture: this.tex.knife, tint: 0xeceff1, rotate: true } : { texture: this.tex.bolt, tint: 0xb3e5fc },
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
    this.updateEffects(dt);
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
      view.sprite.tint = white ? 0xffffff : ENEMY_TYPES[type].color;
    }
    // Enemies that vanished died (or the run reset).
    for (const [id, view] of this.enemyViews) {
      if (view.seen === this.frame) continue;
      if (showDeaths) {
        this.burst(view.sprite.x, view.sprite.y, ENEMY_TYPES[view.type].color, view.type === EnemyType.Boss ? 40 : 6);
      }
      this.release(view.sprite);
      this.enemyViews.delete(id);
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
      const [kind, x, y, ha, hb, progress] = list.slice(i + 1, i + HAZARD_STRIDE);
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
        const w = CHARGER.width;
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
        this.burst(view.sprite.x, view.sprite.y, crate ? 0x8d6e63 : 0xff5252, crate ? 12 : 10);
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
    look: (list: number[], i: number) => { texture: Texture; tint: number; rotate?: boolean },
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
        view = { sprite, seen: 0, rotate: style.rotate };
        views.set(id, view);
      }
      view.seen = this.frame;
      view.sprite.position.set(x, y);
      if (view.rotate && heading !== null) view.sprite.rotation = heading;
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
    const stats = p.orbit && !p.downed ? orbitStats(p.orbit) : null;
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
