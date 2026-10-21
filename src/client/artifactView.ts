// How artifacts look in the menus: their art in a medallion of their tier's color, and their effects.

import { ARTIFACTS, ARTIFACT_IDS, TIERS, TIER_IDS, artifact, describeActive, describeArtifact, orbColor, type ArtifactId, type OrbKind, type Tier } from '../shared/artifacts';
import { artifactSvg } from './artifactIcons';
import { iconSvg } from './icons';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
export const tierColor = (tier: Tier) => hex(TIERS[tier].color);

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Best tier first, then by name. */
export function sortArtifacts(ids: readonly ArtifactId[]): ArtifactId[] {
  const rank = (id: ArtifactId) => TIER_IDS.indexOf(ARTIFACTS[id].tier);
  return [...ids].sort((a, b) => rank(b) - rank(a) || ARTIFACTS[a].name.localeCompare(ARTIFACTS[b].name));
}

/** Every artifact in the game, in the same order. */
export const ALL_ARTIFACTS = sortArtifacts(ARTIFACT_IDS);

/**
 * The artifact's art in a round medallion of its tier's color (upgrades are square tiles, so the two don't mix up).
 * `known` false shows a "?" in the tier's frame (not found yet); a null id is the empty slot.
 */
export function artifactIcon(id: ArtifactId | null, size = 32, known = true): HTMLElement {
  const box = el('span', `artifact-icon${id ? ` tier-${ARTIFACTS[id].tier}` : ' empty'}${known ? '' : ' unknown'}`);
  box.style.setProperty('--tier', id ? tierColor(ARTIFACTS[id].tier) : '#4a5263');
  box.style.width = box.style.height = `${size}px`;
  const art = Math.round(size * 0.68);
  if (id && known) box.innerHTML = artifactSvg(id, art) ?? iconSvg(ARTIFACTS[id].icon, art); // Static SVG.
  else box.textContent = id ? '?' : '∅';
  return box;
}

/**
 * An unopened orb: a glowing glass sphere in its tier's color with a swirl of light inside. The Dragon Orb is dark
 * red, with a dragon's slit eye of gold looking out.
 */
export function orbIcon(kind: OrbKind, size = 32): HTMLElement {
  const box = el('span', `orb-icon orb-${kind}`);
  const c = hex(orbColor(kind));
  box.style.setProperty('--tier', c);
  box.style.width = box.style.height = `${size}px`;
  const inside =
    kind === 'dragon'
      ? '<ellipse cx="16" cy="16" rx="7" ry="5" fill="#ffca28"/><ellipse cx="16" cy="16" rx="1.6" ry="4.6" fill="#1a0505"/>'
      : `<path d="M10 18 C10 12 16 9 20 12 C17 11 13 13 13 17 C13 20 16 22 19 21 C16 24 10 22 10 18 Z" fill="#ffffff" opacity=".55"/><circle cx="20" cy="18" r="1.4" fill="#ffffff" opacity=".8"/>`;
  // Static markup.
  box.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="${c}" opacity=".22"/><circle cx="16" cy="16" r="12" fill="${c}"/><path d="M4.6 19.5 A12 12 0 0 0 27.4 19.5 A13 9 0 0 1 4.6 19.5 Z" fill="#000000" opacity=".28"/>${inside}<ellipse cx="11.5" cy="10" rx="4" ry="2.4" transform="rotate(-30 11.5 10)" fill="#ffffff" opacity=".7"/><circle cx="16" cy="16" r="12" fill="none" stroke="#000000" stroke-opacity=".35" stroke-width="1"/></svg>`;
  return box;
}

/** The tier as a small colored tag. */
export function tierTag(tier: Tier): HTMLElement {
  const tag = el('span', 'artifact-tier', TIERS[tier].name);
  tag.style.setProperty('--tier', tierColor(tier));
  return tag;
}

/** Its effects, one per line, drawbacks marked, then what Q does (if anything). */
export function effectLines(id: ArtifactId): HTMLElement {
  const list = el('ul', 'artifact-effects');
  for (const line of describeArtifact(id)) list.append(el('li', line.bad ? 'bad' : 'good', line.text));
  const active = artifact(id).active;
  if (active) {
    list.append(el('li', 'active-head', `Q · ${active.name} · ${active.cooldown}s cooldown`));
    for (const line of describeActive(id)) list.append(el('li', 'active', line));
  }
  return list;
}
