import type { CharacterId } from '../shared/characters';
import assassin from '../../img/assassin.png';
import bruiser from '../../img/Bruiser.png';
import chronobreaker from '../../img/cronobreaker.png';
import druid from '../../img/druid.png';
import mage from '../../img/mage.png';
import pyro from '../../img/pyromancer.png';
import ranger from '../../img/ranger.png';
import tank from '../../img/tank.png';

// Hero portraits, from the img folder (bundled by Vite).
const PORTRAITS: Record<CharacterId, string> = { assassin, mage, bruiser, tank, pyro, ranger, druid, chronobreaker };

/** The URL of a hero's portrait image. */
export function portraitUrl(character: CharacterId): string {
  return PORTRAITS[character];
}

/** A hero's portrait with a ring in the player's color. Safe for innerHTML: no user input. */
export function portraitHtml(character: CharacterId, color: number): string {
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  return `<img src="${PORTRAITS[character]}" alt="" draggable="false" style="--ring: ${hex}" />`;
}
