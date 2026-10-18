// The bestiary: every enemy with its art and stats. Bosses stay hidden until you've reached them in a run.
// Stats are for a solo run on the easiest map: horde enemies grow from their start-of-run numbers to their
// numbers at boss time (and keep growing after); harder maps multiply everything.

import { AFFIXES, AFFIX_TUNING, BOSS_POWER, ENEMY_TYPES, HORDE_DENSITY, hordeScaling, isBossType, type EnemyDef } from '../shared/enemies';
import { MAPS, enemyColor } from '../shared/maps';

/** A line about each enemy, by name. */
const LORE: Record<string, string> = {
  Grunt: 'The bulk of every horde. Slow-witted, but never alone.',
  Runner: 'Fast and fragile. First to arrive, first to fall.',
  Brute: 'A slab of muscle whose thick hide shrugs off physical hits.',
  Warlord: 'A mini-boss that leads the horde in every few minutes, tougher each time.',
  Spitter: 'Keeps its distance and spits acid. Dodge the shots or close in.',
  Bombardier: 'Lobs bombs where you stand. Leave the red circles before they land.',
  Charger: 'Winds up, then charges in a straight line. Step out of its lane.',
  Thief: 'Shows up on hunt quests carrying loot, and runs. Catch it before it gets away.',
  Wraith: 'Drifts over walls, and physical attacks pass half through it.',
  Grimm: 'The Reaper of the ruins. Swings his scythe through everything in front of him (get behind him), sends out shockwaves to dodge through, and calls lost souls to him to heal: destroy them before they get there.',
  Rime: 'The Frost Queen of the fortress, warded against magic, who laughs at every hero who falls. Her Glacial Wrath blasts everyone she can see: hide behind a column. Carry a Frost Bomb away from your friends. Wounded, she flees through a secret door behind her throne, to her tower beyond a labyrinth.',
  'Ashlord Vael': "Lord of the caldera, armored in cooled lava. Drops meteors: stack up to share the hit. Tethered to Embra by fire: don't stand in it.",
  Embra: "The Ashlord's fiery twin, warded against magic. Throws homing cinder orbs. While the twins stand close they shield each other: pull them apart.",
  Ward: 'A totem that shields the boss during a side mission. Break them all.',
  Sylvara: 'The Glade Serpent. Spits fans of venom, leaves venom pools, lunges, marks one of you (spread out) and lays eggs that hatch unless broken.',
  Kharzak: 'An armored scorpion. Burrows and bursts out under you, sweeps its pincers and stings in a line. At 66% and 33% it hardens its shell: bait its charge into a boulder to crack it.',
  'Serpent Egg': "Laid by Sylvara around her glade. Break it before it hatches into runners.",
  Spirit: 'A lost soul called up by the Reaper. Drifts through walls; the ones that reach him heal him.',
  Mordak:
    'The Earth Scourger, a dragon of crimson and black who rules the world beneath the caldera. Hurls volleys of fire, sweeps his den with a beam of flame (hide behind a pillar, or dodge through it) takes to the sky to rain fire on you while his minions drop in, and sits back to hurl meteors across the den. Out of reach in the air and while he hurls. Stay out from behind him: his tail lashes anyone there.',
};

const AFFIX_TEXT: Record<string, string> = {
  Hasted: `Moves ${Math.round((AFFIX_TUNING.hasteSpeed - 1) * 100)}% faster.`,
  Vampiric: 'Heals itself whenever it hurts you.',
  Volatile: 'Explodes shortly after it dies. Back off.',
  Splitting: `Splits into ${AFFIX_TUNING.splits} smaller copies when killed.`,
  Armored: `Shrugs off ${Math.round(AFFIX_TUNING.resist * 100)}% more physical damage.`,
  Warded: `Shrugs off ${Math.round(AFFIX_TUNING.resist * 100)}% more magic damage.`,
};

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const round = (n: number) => (n >= 1000 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)));
const range = (a: number, b: number) => (Math.round(a) === Math.round(b) ? round(a) : `${round(a)} → ${round(b)}`);
const minutes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** The map a named boss guards. */
function bossMap(type: number) {
  return MAPS.find((m) => m.boss === type || m.twin === type);
}

/** Health, damage per second and when it shows up, for a solo run. */
function numbers(type: number, def: EnemyDef): { hp: string; damage: string; when: string } {
  const start = hordeScaling(0);
  const end = hordeScaling(1);
  switch (def.behavior) {
    case 'named': {
      const map = bossMap(type);
      const k = map?.difficulty ?? 1;
      return { hp: round(def.hp * BOSS_POWER.hp * k), damage: round(def.damage * BOSS_POWER.damage * k), when: map ? `Final boss of ${map.name}` : 'Final boss' };
    }
    case 'boss':
      return { hp: range(def.hp, def.hp * 8), damage: range(def.damage * start.damage * HORDE_DENSITY ** 0.7, def.damage * end.damage * HORDE_DENSITY ** 0.7), when: 'Every few minutes' };
    case 'flee':
      return { hp: range(def.hp, def.hp * 8), damage: '0', when: 'Hunt quests' };
    case 'egg':
      return { hp: round(def.hp), damage: '0', when: 'Laid by Sylvara' };
    case 'ward':
      return { hp: round(def.hp), damage: '0', when: 'Boss side missions' };
    default:
      return {
        hp: range(def.hp * start.hp, def.hp * end.hp),
        damage: range(def.damage * start.damage, def.damage * end.damage),
        when: def.spawnAfter > 0 ? `From ${minutes(def.spawnAfter)}` : 'From the start',
      };
  }
}

/** The enemy shown in the detail panel (kept while you browse, and when the page is redrawn). */
let selected = 0;

/** The tags under an enemy's name. */
function tagsFor(def: EnemyDef): [string, string][] {
  const tags: [string, string][] = [];
  if (def.behavior === 'named') tags.push(['Final boss', 'boss']);
  else if (def.behavior === 'boss') tags.push(['Mini-boss', 'boss']);
  else if (def.elite) tags.push(['Elite', 'elite']);
  if (def.flying) tags.push(['Flying', 'flying']);
  return tags;
}

/** The big view of one enemy: art, tags, description and stats. */
/** The colors an enemy comes in, and the maps where it has each. */
function variants(type: number): { color: number; maps: string[] }[] {
  const out: { color: number; maps: string[] }[] = [];
  for (const map of MAPS) {
    const color = enemyColor(map, type);
    const same = out.find((v) => v.color === color);
    if (same) same.maps.push(map.name);
    else out.push({ color, maps: [map.name] });
  }
  return out;
}

function detail(type: number, hidden: boolean, art: (type: number, color?: number) => string): HTMLElement {
  const def = ENEMY_TYPES[type];
  const root = el('div', `beast-detail${hidden ? ' hidden-entry' : ''}`);
  const pic = el('div', 'beast-detail-art');
  const img = document.createElement('img');
  img.src = art(type);
  img.alt = '';
  pic.append(img);
  const head = el('div', 'beast-head');
  head.append(el('span', 'beast-detail-name', hidden ? '???' : def.name));
  for (const [text, cls] of tagsFor(def)) head.append(el('span', `beast-tag ${cls}`, text));
  root.append(pic, head);
  if (hidden) {
    root.append(el('p', 'beast-lore', 'Reach this boss in a run to unlock its entry.'));
    return root;
  }
  const n = numbers(type, def);
  root.append(el('div', 'beast-when', n.when), el('p', 'beast-lore', LORE[def.name] ?? ''));
  const stats = el('div', 'beast-stats');
  const stat = (label: string, value: string, cls = '') => {
    const cell = el('div', `beast-stat ${cls}`);
    cell.append(el('span', 'beast-stat-value', value), el('span', 'beast-stat-label', label));
    stats.append(cell);
  };
  stat('Health', n.hp);
  stat('Damage /s', n.damage);
  stat('Speed', def.speed ? String(def.speed) : 'Rooted');
  stat('Armor', `${Math.round((def.armor ?? 0) * 100)}%`, def.armor ? 'physical' : '');
  stat('Ward', `${Math.round((def.ward ?? 0) * 100)}%`, def.ward ? 'magic' : '');
  stat('XP', String(def.xp));
  root.append(stats);
  // Its colors on each map: click one to see it up close.
  const kinds = variants(type);
  if (kinds.length > 1) {
    const row = el('div', 'beast-variants');
    for (const v of kinds) {
      const chip = el('button', 'beast-variant');
      chip.title = v.maps.join(', ');
      const icon = document.createElement('img');
      icon.src = art(type, v.color);
      icon.alt = v.maps.join(', ');
      chip.append(icon);
      chip.addEventListener('click', () => {
        img.src = icon.src;
        for (const other of row.children) other.classList.toggle('selected', other === chip);
        caption.textContent = v.maps.join(', ');
      });
      row.append(chip);
    }
    const caption = el('div', 'beast-variant-maps', 'Looks different on each map');
    root.append(el('h3', 'beast-variants-title', 'Variants'), row, caption);
  }
  return root;
}

/**
 * The bestiary page: a grid of enemy cards (picture and name) and, to the right, the selected one up close.
 * `art` gives an enemy's picture (a data URL from the game's own sprites); `seen` is the bosses you've reached, by name.
 */
export function renderBestiary(seen: readonly string[], art: (type: number, color?: number) => string): HTMLElement {
  const root = el('div', 'bestiary');
  const grid = el('div', 'bestiary-grid');
  const side = el('div', 'bestiary-side');
  const isHidden = (type: number) => isBossType(type) && !seen.includes(ENEMY_TYPES[type].name);

  const select = (type: number) => {
    selected = type;
    cards.forEach((card, i) => card.classList.toggle('selected', i === type));
    side.replaceChildren(detail(type, isHidden(type), art));
  };
  const cards = ENEMY_TYPES.map((def, type) => {
    const hidden = isHidden(type);
    const card = el('button', `beast${isBossType(type) ? ' boss' : ''}${hidden ? ' hidden-entry' : ''}`);
    // Parts of a bigger enemy (Mordak's wings) aren't creatures of their own.
    if (def.behavior === 'part') card.style.display = 'none';
    const pic = el('div', 'beast-art');
    const img = document.createElement('img');
    img.src = art(type);
    img.alt = '';
    pic.append(img);
    card.append(pic, el('span', 'beast-name', hidden ? '???' : def.name));
    card.addEventListener('click', () => select(type));
    grid.append(card);
    return card;
  });
  select(Math.min(selected, ENEMY_TYPES.length - 1));

  const affixes = el('div', 'bestiary-affixes');
  affixes.append(el('h2', '', 'Champions'), el('p', 'prestige-hint', 'Later in a run, some enemies spawn as bigger, tougher champions with a colored ring and one of these:'));
  const list = el('div', 'affix-list');
  for (const affix of AFFIXES) {
    if (!affix.name) continue;
    const row = el('div', 'affix-row');
    const dot = el('span', 'affix-dot');
    dot.style.borderColor = `#${affix.color.toString(16).padStart(6, '0')}`;
    row.append(dot, el('b', '', affix.name), el('span', '', AFFIX_TEXT[affix.name] ?? ''));
    list.append(row);
  }
  affixes.append(list);

  const main = el('div', 'bestiary-main');
  main.append(grid, affixes);
  const layout = el('div', 'bestiary-layout');
  layout.append(main, side);
  root.append(
    layout,
    el('p', 'prestige-hint', 'Numbers are for a solo run on a map of normal difficulty (the Verdant Ruins): the horde grows from its start-of-run strength (left) to its strength at boss time (right). Harder maps and more players make everything tougher. Armor resists physical damage, ward resists magic.'),
  );
  return root;
}
