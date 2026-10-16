// Map icons for the lobby: a tiny scene for each map's look (its `art`), on a 32x32 grid.
// Static markup (no user input), so it's safe to put in innerHTML.

import type { MapDef } from '../shared/maps';

const ICONS: Record<MapDef['art'], string> = {
  // Emerald Woods: pines on either side of a river.
  forest: `<rect width="32" height="32" rx="5" fill="#2e6b2f"/><path d="M14 0 C12 8 19 14 15 22 C13 26 16 30 17 32 H21 C19 28 17 25 19 21 C23 13 16 8 18 0 Z" fill="#4dd0e1"/><path d="M15 0 C14 7 19 13 16.5 21" stroke="#b2ebf2" stroke-width="1" fill="none" opacity=".7"/><g fill="#1b4d1f"><path d="M6 3 L11 13 H1 Z"/><path d="M6 8 L12 19 H0 Z"/><path d="M26 9 L31 19 H21 Z"/><path d="M26 14 L32 25 H20 Z"/><path d="M8 20 L12 28 H4 Z"/></g><g fill="#5d4037"><rect x="5.2" y="19" width="1.6" height="3"/><rect x="25.2" y="25" width="1.6" height="3"/><rect x="7.2" y="28" width="1.6" height="2.5"/></g>`,
  // Desecrated Ruins: broken columns overgrown with moss.
  ruins: `<rect width="32" height="32" rx="5" fill="#4a5a3a"/><rect x="0" y="24" width="32" height="8" fill="#3b4a2e"/><g fill="#b0a990"><rect x="4" y="9" width="6" height="16"/><rect x="3" y="7" width="8" height="3"/><rect x="14" y="15" width="6" height="10"/><path d="M14 15 L16 12 L18 14 L20 11 V15 Z"/><rect x="24" y="5" width="6" height="20"/><rect x="23" y="3" width="8" height="3"/></g><g stroke="#8a836b" stroke-width="1"><path d="M6 10 V24 M8 10 V24 M16 16 V24 M18 16 V24 M26 6 V24 M28 6 V24"/></g><g fill="#7cb342"><path d="M3 24 C4 20 7 21 8 24 Z"/><path d="M13 24 C14 21 17 21 19 24 Z"/><path d="M24 12 C26 10 29 11 30 14 C28 13 26 13 24 15 Z"/><circle cx="11" cy="9" r="1.6"/></g><path d="M20 27 L23 25 L26 27" stroke="#b0a990" stroke-width="2" fill="none"/>`,
  // Frozen Fortress: a castle in the snow.
  frost: `<rect width="32" height="32" rx="5" fill="#9ec9e8"/><path d="M0 24 C8 21 24 21 32 24 V32 H0 Z" fill="#eef6fb"/><g fill="#6b7f95"><rect x="3" y="10" width="7" height="15"/><rect x="22" y="10" width="7" height="15"/><rect x="9" y="15" width="14" height="10"/><path d="M3 10 V7 H4.5 V9 H6 V7 H7.5 V9 H9 V7 H10 V10 Z"/><path d="M22 10 V7 H23.5 V9 H25 V7 H26.5 V9 H28 V7 H29 V10 Z"/><path d="M9 15 V13 H11 V14.5 H13 V13 H15 V14.5 H17 V13 H19 V14.5 H21 V13 H23 V15 Z"/></g><path d="M13 25 V20 C13 18 19 18 19 20 V25 Z" fill="#2f3b4a"/><g fill="#ffffff"><rect x="3" y="9.4" width="7" height="1.4"/><rect x="22" y="9.4" width="7" height="1.4"/><circle cx="16" cy="5" r="1"/><circle cx="12" cy="3" r=".8"/><circle cx="20" cy="2.5" r=".8"/></g><rect x="25" y="14" width="1.6" height="3" fill="#ffd54f"/><rect x="5.4" y="14" width="1.6" height="3" fill="#ffd54f"/>`,
  // Sunscar Canyon: red mesas under a hot sun.
  canyon: `<rect width="32" height="32" rx="5" fill="#f2b56b"/><circle cx="24" cy="8" r="4.5" fill="#fff3c4"/><path d="M0 14 H8 L10 17 H12 V32 H0 Z" fill="#b5532f"/><path d="M0 14 H8 L9 15.5 H0 Z" fill="#d97848"/><path d="M32 18 H22 L20 21 H19 V32 H32 Z" fill="#a1462a"/><path d="M32 18 H22 L21 19.5 H32 Z" fill="#c9653e"/><path d="M0 26 C10 24 22 24 32 26 V32 H0 Z" fill="#c98a52"/><circle cx="15" cy="27.5" r="1.8" fill="#8d6e63"/><circle cx="25" cy="28.5" r="1.3" fill="#8d6e63"/><path d="M16 22 V26 M16 23 C14.5 23 14.5 21.5 14.5 21 M16 24 C17.5 24 17.5 22.5 17.5 22" stroke="#558b2f" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  // Ashen Caldera: a volcano spilling lava.
  caldera: `<rect width="32" height="32" rx="5" fill="#2a1a17"/><circle cx="7" cy="6" r="3" fill="#5d4037" opacity=".7"/><circle cx="12" cy="3" r="2.4" fill="#5d4037" opacity=".6"/><path d="M2 30 L12 11 H20 L30 30 Z" fill="#4e3a34"/><path d="M16 11 L20 11 L30 30 H22 Z" fill="#3e2c27"/><path d="M12 11 H20 L18.5 13 H13.5 Z" fill="#ff6d00"/><path d="M15 12 C14 16 16 18 13 22 C11 25 12 27 10 30 H14 C15 27 14 25 16 22 C18 19 16.5 15 17 12 Z" fill="#ff7a1a"/><path d="M15.6 13 C15 16 16.5 18 14.5 21" stroke="#ffd54f" stroke-width="1" fill="none"/><path d="M0 30 C6 28 26 28 32 30 V32 H0 Z" fill="#ff5722" opacity=".85"/><circle cx="21" cy="6" r="1.2" fill="#ff9800"/><circle cx="16" cy="7.5" r="1" fill="#ffd54f"/>`,
};

/** A map's icon as an <svg>. */
export function mapIconSvg(map: MapDef, size: number): string {
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">${ICONS[map.art]}</svg>`;
}
