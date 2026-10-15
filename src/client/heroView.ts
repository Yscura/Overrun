// A hero up close: portrait, role, base stats, trait, and the starting weapon, E ability and ultimate with their
// icons. Shared by the lobby's hero panel and the profile page.

import { CHARACTERS, type CharacterId } from '../shared/characters';
import { DAMAGE_NAMES, UPGRADES, type UpgradeId } from '../shared/upgrades';
import { iconEl, ultIconEl } from './icons';
import { portraitHtml } from './portraits';

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const typeName = (id: UpgradeId) => DAMAGE_NAMES[UPGRADES[id].damage ?? 'physical'];
/** Ability texts start with "[E] " on level-up cards; the panel already says which key. */
const strip = (text: string) => text.replace(/^\[E\] /, '');

/** The hero's portrait in a box, ringed in `color`. */
export function heroPortrait(id: CharacterId, color: number, className: string): HTMLElement {
  const box = el('div', `portrait ${className}`);
  box.innerHTML = portraitHtml(id, color); // A bundled image, no user input.
  return box;
}

/** The detail panel's content: header, base stats and kit. */
export function heroDetail(id: CharacterId, color: number): HTMLElement[] {
  const c = CHARACTERS[id];
  const head = el('div', 'hero-detail-head');
  const names = el('div', 'hero-detail-names');
  const title = el('div', 'hero-detail-name');
  title.append(el('span', '', c.name), el('span', `role ${c.role}`, c.role === 'ranged' ? 'Ranged' : 'Melee'));
  names.append(title, el('div', 'hero-detail-title', c.title), el('div', 'hero-detail-trait', c.trait));
  head.append(heroPortrait(id, color, 'hero-detail-portrait'), names);

  const stats = statGrid([
    ['Health', String(c.maxHp)],
    ['Speed', String(c.speed)],
    ['Armor', `${Math.round(c.armor * 100)}%`],
    ['Dodge', `${c.dodgeCooldown}s`],
  ]);

  const kit = el('div', 'hero-kit');
  const row = (icon: HTMLElement, key: string, name: string, text: string, extra: string) => {
    const r = el('div', 'kit-row');
    const iconBox = el('div', 'kit-icon');
    iconBox.append(icon);
    const body = el('div', 'kit-body');
    const top = el('div', 'kit-top');
    top.append(el('span', 'kit-key', key), el('span', 'kit-name', name), el('span', 'kit-extra', extra));
    body.append(top, el('p', 'kit-text', text));
    r.append(iconBox, body);
    kit.append(r);
  };
  row(iconEl(c.startWeapon, 40), 'Weapon', UPGRADES[c.startWeapon].name, strip(UPGRADES[c.startWeapon].describe(1)), typeName(c.startWeapon));
  row(iconEl(c.ability, 40), 'E', UPGRADES[c.ability].name, strip(UPGRADES[c.ability].describe(1)), typeName(c.ability));
  row(ultIconEl(c.ultimate.id, 40), 'R', c.ultimate.name, c.ultimate.text, `${c.ultimate.cooldown}s`);
  return [head, stats, kit];
}

/** A row of small stat tiles: value on top, label below. */
export function statGrid(cells: [label: string, value: string][], className = 'hero-stats'): HTMLElement {
  const grid = el('div', className);
  for (const [label, value] of cells) {
    const cell = el('div', 'hero-stat');
    cell.append(el('div', 'hero-stat-value', value), el('div', 'hero-stat-label', label));
    grid.append(cell);
  }
  return grid;
}
