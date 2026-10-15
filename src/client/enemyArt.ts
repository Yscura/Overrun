// Enemy looks: each type is drawn once (facing right, +x) into a texture at startup, plus a white silhouette for
// hit flashes. Sprites are rotated toward where the enemy walks, so the eyes look the way it's going.

import type { Graphics } from 'pixi.js';
import { ENEMY_TYPES, EnemyType } from '../shared/enemies';

const INK = 0x14100e;

/** A color mixed toward black (amount < 0) or white (amount > 0). */
export function shade(color: number, amount: number): number {
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  return (mix((color >> 16) & 255) << 16) | (mix((color >> 8) & 255) << 8) | mix(color & 255);
}

/** Points of a regular polygon. */
function ngon(sides: number, r: number, rotation = 0, cx = 0, cy = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

/** Points of a star: alternating outer and inner radius. */
function star(points: number, outer: number, inner: number, rotation = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rotation + (i / (points * 2)) * Math.PI * 2;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

interface Pen {
  g: Graphics;
  /** Drawing the white hit-flash silhouette: one color, no details. */
  flash: boolean;
  /** The body color, its darker outline and a lighter highlight. */
  body: number;
  dark: number;
  light: number;
}

/** Fills a shape in the body color with a dark outline (or white for the flash). */
function solid(pen: Pen, draw: (g: Graphics) => Graphics, color = pen.body, outline = pen.dark): void {
  draw(pen.g).fill(pen.flash ? 0xffffff : color);
  if (!pen.flash) draw(pen.g).stroke({ width: 2, color: outline, join: 'round' });
}

/** Details that the flash silhouette leaves out. */
function detail(pen: Pen, draw: (g: Graphics) => void): void {
  if (!pen.flash) draw(pen.g);
}

/** Two eyes looking forward. `size` is the eye radius; `glow` replaces white eyes with glowing ones. */
function eyes(pen: Pen, x: number, spread: number, size: number, opts: { angry?: boolean; glow?: number; single?: boolean } = {}): void {
  detail(pen, (g) => {
    const ys = opts.single ? [0] : [-spread, spread];
    for (const y of ys) {
      if (opts.glow !== undefined) {
        g.circle(x, y, size * 1.6).fill({ color: opts.glow, alpha: 0.3 });
        g.circle(x, y, size).fill(opts.glow);
        g.circle(x + size * 0.2, y, size * 0.45).fill(0xffffff);
      } else {
        g.circle(x, y, size).fill(0xffffff).circle(x, y, size).stroke({ width: 1, color: INK, alpha: 0.6 });
        g.circle(x + size * 0.4, y, size * 0.55).fill(INK);
        g.circle(x + size * 0.15, y - size * 0.3, size * 0.2).fill(0xffffff);
      }
      if (opts.angry) {
        // A brow slanting down toward the middle.
        const side = Math.sign(y) || 1;
        g.moveTo(x - size * 1.1, y + side * size * 1.5).lineTo(x + size * 1.1, y + side * size * 0.6).stroke({ width: Math.max(2, size * 0.5), color: INK, cap: 'round' });
      }
    }
  });
}

/** A soft round shadow under the body (round, so it looks right at any rotation). */
function shadow(pen: Pen, r: number): void {
  detail(pen, (g) => {
    g.circle(0, 0, r * 1.12).fill({ color: 0x000000, alpha: 0.28 });
  });
}

/** A highlight on the upper body, for a rounded look. */
function gloss(pen: Pen, x: number, y: number, rx: number, ry: number): void {
  detail(pen, (g) => {
    g.ellipse(x, y, rx, ry).fill({ color: pen.light, alpha: 0.35 });
  });
}

/**
 * Draws enemy `type` into `g`, facing +x, centered on (0, 0), in `color` (its own, or the map's for it). Returns how far
 * it reaches from the center.
 */
export function drawEnemy(g: Graphics, type: number, flash: boolean, color = ENEMY_TYPES[type].color): number {
  const def = ENEMY_TYPES[type];
  const r = def.radius;
  const pen: Pen = { g, flash, body: color, dark: shade(color, -0.55), light: shade(color, 0.6) };
  shadow(pen, r);
  // Resistances show as a rim: steel for armor (resists physical), blue for a ward (resists magic).
  detail(pen, (g) => {
    if (def.armor) g.circle(0, 0, r * 1.12).stroke({ width: 3, color: 0xcfd8dc, alpha: 0.75 });
    if (def.ward) g.circle(0, 0, r * (def.armor ? 1.22 : 1.12)).stroke({ width: 3, color: 0x448aff, alpha: 0.8 });
  });
  switch (type) {
    case EnemyType.Grunt: {
      // A squat blob with little horns.
      solid(pen, (g) => g.poly([-r * 0.6, -r * 0.75, -r * 1.05, -r * 1.05, -r * 0.35, -r * 0.95]), pen.dark, INK);
      solid(pen, (g) => g.poly([-r * 0.6, r * 0.75, -r * 1.05, r * 1.05, -r * 0.35, r * 0.95]), pen.dark, INK);
      solid(pen, (g) => g.ellipse(0, 0, r * 1.05, r * 0.95));
      gloss(pen, -r * 0.2, -r * 0.35, r * 0.45, r * 0.25);
      eyes(pen, r * 0.4, r * 0.38, r * 0.27, { angry: true });
      detail(pen, (g) => g.moveTo(r * 0.8, -r * 0.2).lineTo(r * 0.8, r * 0.2).stroke({ width: 2, color: INK, cap: 'round' }));
      return r * 1.5;
    }
    case EnemyType.Runner: {
      // Lean and pointy, built for speed.
      solid(pen, (g) => g.poly([r * 1.4, 0, r * 0.2, -r * 0.95, -r * 1.1, -r * 0.55, -r * 0.7, 0, -r * 1.1, r * 0.55, r * 0.2, r * 0.95]));
      gloss(pen, 0, -r * 0.35, r * 0.5, r * 0.2);
      eyes(pen, r * 0.45, r * 0.32, r * 0.28);
      return r * 1.6;
    }
    case EnemyType.Brute: {
      // A bulky block with tusks and a scowl.
      solid(pen, (g) => g.roundRect(-r, -r * 0.95, r * 2, r * 1.9, r * 0.45));
      detail(pen, (g) => g.roundRect(-r * 0.75, -r * 0.7, r * 0.9, r * 1.4, r * 0.3).fill({ color: pen.dark, alpha: 0.35 }));
      gloss(pen, -r * 0.1, -r * 0.55, r * 0.6, r * 0.2);
      solid(pen, (g) => g.poly([r * 0.75, -r * 0.45, r * 1.25, -r * 0.6, r * 0.85, -r * 0.2]), 0xfff3e0, INK);
      solid(pen, (g) => g.poly([r * 0.75, r * 0.45, r * 1.25, r * 0.6, r * 0.85, r * 0.2]), 0xfff3e0, INK);
      eyes(pen, r * 0.45, r * 0.32, r * 0.17, { angry: true });
      return r * 1.5;
    }
    case EnemyType.Warlord: {
      // A crowned brute with three eyes.
      solid(pen, (g) => g.poly(star(9, r * 1.18, r * 0.92, Math.PI / 9)), shade(color, -0.3), INK);
      solid(pen, (g) => g.circle(0, 0, r * 0.95));
      gloss(pen, -r * 0.25, -r * 0.4, r * 0.45, r * 0.22);
      detail(pen, (g) => {
        // Jagged mouth.
        g.poly([r * 0.62, -r * 0.35, r * 0.82, -r * 0.2, r * 0.66, -r * 0.08, r * 0.86, 0, r * 0.66, r * 0.08, r * 0.82, r * 0.2, r * 0.62, r * 0.35]).fill(INK);
      });
      eyes(pen, r * 0.25, r * 0.38, r * 0.15, { angry: true });
      eyes(pen, r * 0.05, 0, r * 0.13, { single: true, glow: 0xffea00 });
      return r * 1.35;
    }
    case EnemyType.Spitter: {
      // A round body with a spitting snout and one big eye.
      solid(pen, (g) => g.roundRect(r * 0.5, -r * 0.32, r * 0.8, r * 0.64, r * 0.2), pen.dark, INK);
      detail(pen, (g) => g.circle(r * 1.25, 0, r * 0.2).fill(0xccff90));
      solid(pen, (g) => g.circle(0, 0, r));
      gloss(pen, -r * 0.25, -r * 0.35, r * 0.4, r * 0.22);
      eyes(pen, r * 0.1, 0, r * 0.42, { single: true });
      return r * 1.5;
    }
    case EnemyType.Bombardier: {
      // A shell carrying a lit bomb on its back.
      solid(pen, (g) => g.circle(-r * 0.75, 0, r * 0.55), 0x263238, INK);
      detail(pen, (g) => {
        g.moveTo(-r * 1.1, -r * 0.3).lineTo(-r * 1.35, -r * 0.55).stroke({ width: 2, color: 0x8d6e63 });
        g.circle(-r * 1.4, -r * 0.6, r * 0.18).fill(0xffab40);
      });
      solid(pen, (g) => g.ellipse(r * 0.1, 0, r * 0.95, r * 0.85));
      detail(pen, (g) => g.ellipse(r * 0.1, 0, r * 0.95, r * 0.85).stroke({ width: 3, color: pen.dark, alpha: 0.4 }));
      gloss(pen, -r * 0.05, -r * 0.35, r * 0.4, r * 0.2);
      eyes(pen, r * 0.5, r * 0.3, r * 0.22);
      return r * 1.7;
    }
    case EnemyType.Charger: {
      // A rhino: long body, a big horn up front.
      solid(pen, (g) => g.poly([r * 0.85, -r * 0.3, r * 1.75, 0, r * 0.85, r * 0.3]), 0xe8eaf6, INK);
      solid(pen, (g) => g.ellipse(0, 0, r * 1.15, r * 0.85));
      detail(pen, (g) => {
        for (const y of [-0.45, 0, 0.45]) g.moveTo(-r * 0.6, y * r).lineTo(-r * 0.2, y * r).stroke({ width: 2, color: pen.dark, alpha: 0.6 });
      });
      gloss(pen, -r * 0.1, -r * 0.4, r * 0.5, r * 0.18);
      eyes(pen, r * 0.5, r * 0.4, r * 0.18, { angry: true });
      return r * 1.85;
    }
    case EnemyType.Thief: {
      // A masked bandit with a loot sack.
      solid(pen, (g) => g.circle(-r * 0.95, r * 0.15, r * 0.6), 0x8d6e63, 0x3e2723);
      detail(pen, (g) => g.circle(-r * 0.95, r * 0.15, r * 0.18).fill(0xffd54f));
      solid(pen, (g) => g.circle(0, 0, r));
      gloss(pen, -r * 0.25, -r * 0.4, r * 0.4, r * 0.2);
      detail(pen, (g) => g.roundRect(r * 0.15, -r * 0.65, r * 0.65, r * 1.3, r * 0.3).fill(INK));
      eyes(pen, r * 0.5, r * 0.3, r * 0.17);
      return r * 1.7;
    }
    case EnemyType.Wraith: {
      // A ghost: a round head trailing a wavy tail, with hollow eyes.
      const tail = [
        r * 0.2, -r * 0.9, -r * 0.6, -r * 0.8, -r * 1.5, -r * 0.55, -r * 1.1, -r * 0.15, -r * 1.6, r * 0.15,
        -r * 1.1, r * 0.45, -r * 1.5, r * 0.75, -r * 0.6, r * 0.85, r * 0.2, r * 0.9,
      ];
      solid(pen, (g) => g.poly(tail));
      solid(pen, (g) => g.circle(r * 0.2, 0, r * 0.95));
      detail(pen, (g) => {
        g.ellipse(r * 0.5, -r * 0.33, r * 0.2, r * 0.27).fill(INK);
        g.ellipse(r * 0.5, r * 0.33, r * 0.2, r * 0.27).fill(INK);
        g.circle(r * 0.55, -r * 0.33, r * 0.08).fill(0xe1bee7);
        g.circle(r * 0.55, r * 0.33, r * 0.08).fill(0xe1bee7);
      });
      return r * 1.9;
    }
    case EnemyType.Grimjaw: {
      // All mouth: a huge maw full of teeth, little eyes, spikes down the back.
      solid(pen, (g) => g.poly(star(7, r * 1.15, r * 0.8, Math.PI / 2 + 0.25).map((v, i) => (i % 2 === 0 ? Math.min(v, r * 0.2) : v))), pen.dark, INK);
      solid(pen, (g) => g.circle(0, 0, r));
      gloss(pen, -r * 0.3, -r * 0.45, r * 0.4, r * 0.18);
      detail(pen, (g) => {
        g.moveTo(r * 0.98, 0).arc(r * 0.98, 0, r * 0.62, Math.PI * 0.55, Math.PI * 1.45).fill(INK);
        for (let i = 0; i < 6; i++) {
          const a = Math.PI * 0.62 + (i / 5) * Math.PI * 0.76;
          const bx = r * 0.98 + Math.cos(a) * r * 0.6;
          const by = Math.sin(a) * r * 0.6;
          g.poly([bx, by - 5, bx + 10, by, bx, by + 5]).fill(0xfff8e1);
        }
      });
      eyes(pen, r * 0.05, r * 0.45, r * 0.12, { angry: true, glow: 0xffca28 });
      return r * 1.3;
    }
    case EnemyType.Rime: {
      // An ice crystal with cold, glowing eyes.
      solid(pen, (g) => g.poly(star(6, r * 1.2, r * 0.75, 0)), shade(color, 0.3), shade(color, -0.4));
      solid(pen, (g) => g.poly(ngon(6, r * 0.9, Math.PI / 6)));
      detail(pen, (g) => {
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
          g.moveTo(0, 0).lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9).stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
        }
      });
      gloss(pen, -r * 0.2, -r * 0.4, r * 0.4, r * 0.16);
      eyes(pen, r * 0.35, r * 0.3, r * 0.13, { glow: 0x00e5ff });
      return r * 1.3;
    }
    case EnemyType.AshlordVael: {
      // Horned, with molten cracks across the body.
      // Big horns sweeping back.
      for (const side of [-1, 1]) {
        solid(pen, (g) => g.poly([r * 0.25, side * r * 0.75, -r * 0.35, side * r * 1.35, -r * 0.95, side * r * 1.45, -r * 0.45, side * r * 1.05, -r * 0.2, side * r * 0.8]), 0xbcaaa4, 0x3e2723);
      }
      solid(pen, (g) => g.circle(0, 0, r), shade(color, -0.3), INK);
      detail(pen, (g) => {
        const cracks = [
          [-0.7, -0.2, -0.3, -0.35, 0, -0.1],
          [-0.6, 0.45, -0.25, 0.3, 0.1, 0.45],
          [0.2, -0.6, 0.35, -0.3, 0.6, -0.25],
        ];
        for (const c of cracks) {
          g.moveTo(c[0] * r, c[1] * r).lineTo(c[2] * r, c[3] * r).lineTo(c[4] * r, c[5] * r).stroke({ width: 5, color: 0xff6d00, alpha: 0.5, cap: 'round' });
          g.moveTo(c[0] * r, c[1] * r).lineTo(c[2] * r, c[3] * r).lineTo(c[4] * r, c[5] * r).stroke({ width: 2, color: 0xffd180, cap: 'round' });
        }
      });
      eyes(pen, r * 0.5, r * 0.3, r * 0.12, { angry: true, glow: 0xffea00 });
      return r * 1.5;
    }
    case EnemyType.Embra: {
      // Wreathed in flame.
      solid(pen, (g) => g.poly(star(10, r * 1.25, r * 0.85, 0.2)), 0xff6d00, 0xbf360c);
      detail(pen, (g) => g.poly(star(10, r * 1.05, r * 0.8, 0.5)).fill({ color: 0xffd180, alpha: 0.6 }));
      solid(pen, (g) => g.circle(0, 0, r * 0.82), shade(color, -0.15), 0x6d2a00);
      gloss(pen, -r * 0.2, -r * 0.35, r * 0.35, r * 0.15);
      eyes(pen, r * 0.38, r * 0.28, r * 0.12, { glow: 0xfff176 });
      return r * 1.35;
    }
    case EnemyType.Sylvara: {
      // A coiled serpent: one smooth body spiraling out behind the head, thickening as it goes, with a pattern
      // down its back, a wedge-shaped head and a forked tongue.
      const cx = -r * 0.3;
      const steps = 40;
      const coil = Array.from({ length: steps + 1 }, (_, i) => {
        const t = i / steps;
        const a = (t - 1) * Math.PI * 2 * 1.25;
        const d = r * (0.15 + 0.55 * t);
        return { x: cx + Math.cos(a) * d, y: Math.sin(a) * d, w: r * (0.12 + 0.36 * t) };
      });
      const body = (extra: number, color: number) => {
        for (let i = 1; i < coil.length; i++) {
          pen.g.moveTo(coil[i - 1].x, coil[i - 1].y).lineTo(coil[i].x, coil[i].y).stroke({ width: coil[i].w + extra, color, cap: 'round' });
        }
      };
      // The outline pass first, then the body over it, so there are no seams between segments.
      if (!pen.flash) body(5, pen.dark);
      body(0, pen.flash ? 0xffffff : color);
      detail(pen, (g) => {
        for (let i = 6; i < coil.length; i += 4) {
          const { x, y, w } = coil[i];
          g.poly([x, y - w * 0.22, x + w * 0.22, y, x, y + w * 0.22, x - w * 0.22, y]).fill({ color: 0x1b5e20, alpha: 0.75 });
        }
      });
      solid(pen, (g) => g.poly([r * 0.3, -r * 0.3, r * 0.9, -r * 0.34, r * 1.22, 0, r * 0.9, r * 0.34, r * 0.3, r * 0.3]), shade(color, 0.1));
      detail(pen, (g) => {
        g.moveTo(r * 1.22, 0).lineTo(r * 1.45, 0).lineTo(r * 1.58, -r * 0.09).moveTo(r * 1.45, 0).lineTo(r * 1.58, r * 0.09).stroke({ width: 3, color: 0xe53935, cap: 'round' });
        g.poly([r * 0.5, -r * 0.12, r * 0.7, 0, r * 0.5, r * 0.12, r * 0.4, 0]).fill({ color: 0x1b5e20, alpha: 0.7 });
      });
      gloss(pen, r * 0.75, -r * 0.18, r * 0.22, r * 0.08);
      eyes(pen, r * 0.9, r * 0.2, r * 0.09, { angry: true, glow: 0xffeb3b });
      return r * 1.65;
    }
    case EnemyType.Kharzak: {
      // A giant scorpion: eight legs, two big pincers in front, and the tail curling around to its sting.
      const limb = pen.flash ? 0xffffff : shade(color, -0.45);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const bx = r * (0.3 - i * 0.28);
          pen.g
            .moveTo(bx, side * r * 0.4)
            .lineTo(bx - r * 0.05, side * r * 0.95)
            .lineTo(bx - r * 0.3, side * r * 1.25)
            .stroke({ width: r * 0.09, color: limb, cap: 'round', join: 'round' });
        }
        pen.g.moveTo(r * 0.45, side * r * 0.3).lineTo(r * 0.95, side * r * 0.62).stroke({ width: r * 0.16, color: limb, cap: 'round' });
        solid(pen, (g) => g.poly([r * 0.85, side * r * 0.45, r * 1.5, side * r * 0.42, r * 1.22, side * r * 0.6, r * 1.52, side * r * 0.8, r * 1.0, side * r * 0.9]));
      }
      solid(pen, (g) => g.ellipse(-r * 0.3, 0, r * 0.68, r * 0.56));
      solid(pen, (g) => g.ellipse(r * 0.32, 0, r * 0.46, r * 0.48), shade(color, 0.1));
      detail(pen, (g) => {
        for (let i = 0; i < 4; i++) g.moveTo(-r * (0.7 - i * 0.22), -r * 0.45).quadraticCurveTo(-r * (0.6 - i * 0.22), 0, -r * (0.7 - i * 0.22), r * 0.45).stroke({ width: 2, color: shade(color, -0.45), alpha: 0.8 });
      });
      gloss(pen, r * 0.2, -r * 0.25, r * 0.22, r * 0.1);
      // The tail, over the body.
      const tail: [number, number, number][] = [
        [-0.95, 0, 0.22],
        [-1.2, -0.18, 0.2],
        [-1.22, -0.45, 0.18],
        [-1.0, -0.65, 0.16],
        [-0.68, -0.68, 0.14],
      ];
      for (const [tx, ty, tr] of tail) solid(pen, (g) => g.circle(tx * r, ty * r, tr * r), shade(color, -0.1));
      solid(pen, (g) => g.poly([-r * 0.58, -r * 0.78, -r * 0.2, -r * 0.62, -r * 0.55, -r * 0.55]), 0x3e2723, INK);
      eyes(pen, r * 0.58, r * 0.12, r * 0.07, { angry: true, glow: 0xff1744 });
      return r * 1.75;
    }
    case EnemyType.Ward: {
      // A stone totem with a glowing rune (it doesn't turn).
      solid(pen, (g) => g.poly(ngon(8, r, Math.PI / 8)), 0x546e7a, 0x263238);
      solid(pen, (g) => g.poly(ngon(8, r * 0.7, Math.PI / 8)), 0x78909c, 0x37474f);
      detail(pen, (g) => {
        g.poly([0, -r * 0.45, r * 0.3, 0, 0, r * 0.45, -r * 0.3, 0]).stroke({ width: 3, color: color });
        g.circle(0, 0, r * 0.12).fill(color);
      });
      return r * 1.15;
    }
    default: {
      solid(pen, (g) => g.circle(0, 0, r));
      eyes(pen, r * 0.4, r * 0.35, r * 0.25);
      return r * 1.2;
    }
  }
}

/** Enemies that never turn to face where they're going. */
export const NO_ROTATE = new Set<number>([EnemyType.Ward]);
