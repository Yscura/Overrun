// How artifacts look in the menus: their art in a medallion of their tier's color, and their effects.

import { ARTIFACTS, ARTIFACT_IDS, TIERS, TIER_IDS, artifact, describeActive, describeArtifact, type ArtifactId, type Tier } from '../shared/artifacts';
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
