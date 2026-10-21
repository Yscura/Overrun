// Icons for passives, weapons, abilities and bonus choices: bold, flat, two-tone glyphs on a 32x32 grid.
// Static markup (no user input), so it's safe to put in innerHTML.

import type { UltimateId } from '../shared/characters';
import type { ChoiceId } from '../shared/upgrades';

// A few shared colors, so related icons match.
const ORANGE = '#ff8a3d';
const ORANGE_DARK = '#d9581e';
const GOLD = '#f2b84b';
const GOLD_DARK = '#c98a22';
const GREEN = '#3ecf73';
const GREEN_DARK = '#249a52';
const CREAM = '#f4ead2';
const BLUE = '#4f8cff';
const BLUE_LIGHT = '#8fb8ff';
const CYAN = '#5ad7f0';
const RED = '#ef3b2c';
const RED_DARK = '#b5201b';
const PURPLE = '#9b6bff';
const PURPLE_LIGHT = '#c4a6ff';
const STEEL = '#cfd8e3';
const STEEL_DARK = '#8796a8';

const ICONS: Record<ChoiceId, string> = {
  // --- Passives ---
  // Damage: two claw slashes.
  might: `<path d="M20 2 L29 2 L12 30 L3 30 Z" fill="${ORANGE}"/><path d="M28 9 L31 13 L19 30 L13 30 Z" fill="${ORANGE_DARK}"/><path d="M20 2 L29 2 L26 6 L18 6 Z" fill="#ffc08a"/>`,
  // Armor: a shield with a band.
  armor: `<path d="M16 2 L28 6 L27 17 C26 23 21 27 16 30 C11 27 6 23 5 17 L4 6 Z" fill="${GOLD}"/><path d="M16 7 L23 9.5 L22.5 17 C22 20.5 19.5 23 16 25 C12.5 23 10 20.5 9.5 17 L9 9.5 Z" fill="#1b1f2a"/><path d="M9.5 16 L22.5 16 C22.2 19.5 19.8 22.5 16 25 C12.2 22.5 9.8 19.5 9.5 16 Z" fill="${GOLD}"/>`,
  // Max health: a heart.
  vitality: `<path d="M16 29 C8 23 2 18 2 11 C2 6 6 3 10 3 C13 3 15 5 16 7 C17 5 19 3 22 3 C26 3 30 6 30 11 C30 18 24 23 16 29 Z" fill="${GREEN}"/><path d="M6 10 C6 7.5 8 6 10 6" stroke="#8ef0b0" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  // Health regen: a plus and a small heart.
  regen: `<path d="M6 2 H10 V6 H14 V10 H10 V14 H6 V10 H2 V6 H6 Z" fill="${GREEN}"/><path d="M20 30 C14 26 10 22.5 10 18 C10 15 12.5 13 15 13 C17 13 19 14.3 20 16 C21 14.3 23 13 25 13 C27.5 13 30 15 30 18 C30 22.5 26 26 20 30 Z" fill="${GREEN_DARK}"/>`,
  // Movement speed: a chevron with speed lines.
  swift: `<path d="M2 8 H12 M4 14 H11 M2 20 H9" stroke="${CREAM}" stroke-width="3" stroke-linecap="round"/><path d="M14 4 L30 16 L14 28 L18 16 Z" fill="${CREAM}"/><path d="M14 4 L30 16 L22 16 L18 16 Z" fill="#ffffff" opacity=".55"/>`,
  // Pickup radius: a horseshoe magnet.
  magnet: `<path d="M5 4 H12 V16 C12 18.5 13.8 20.5 16 20.5 C18.2 20.5 20 18.5 20 16 V4 H27 V16 C27 22.5 22 27.5 16 27.5 C10 27.5 5 22.5 5 16 Z" fill="${GOLD}"/><rect x="5" y="4" width="7" height="5" fill="${CREAM}"/><rect x="20" y="4" width="7" height="5" fill="${CREAM}"/><path d="M5 16 C5 22.5 10 27.5 16 27.5 C22 27.5 27 22.5 27 16 H24 C24 20.8 20.4 24.5 16 24.5 C11.6 24.5 8 20.8 8 16 Z" fill="${GOLD_DARK}"/>`,
  // Area size: a diamond with arrows pointing out.
  area: `<path d="M16 9 L23 16 L16 23 L9 16 Z" fill="${BLUE}"/><path d="M16 9 L23 16 L16 16 Z" fill="${BLUE_LIGHT}"/><path d="M16 1 L20 6 H12 Z M16 31 L12 26 H20 Z M1 16 L6 12 V20 Z M31 16 L26 20 V12 Z" fill="${BLUE}"/><path d="M6 6 L10 7 L7 10 Z M26 6 L25 10 L22 7 Z M6 26 L7 22 L10 25 Z M26 26 L22 25 L25 22 Z" fill="${BLUE_LIGHT}"/>`,
  // Duration: a dial with a hand.
  duration: `<circle cx="16" cy="17" r="12" fill="none" stroke="${CYAN}" stroke-width="3.5"/><path d="M16 17 L16 9" stroke="${CYAN}" stroke-width="3" stroke-linecap="round"/><path d="M16 17 L22 20" stroke="#bdf3ff" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="17" r="2.6" fill="#bdf3ff"/><rect x="13" y="1" width="6" height="3.5" rx="1" fill="${CYAN}"/>`,
  // Crit: a jagged strike.
  crit: `<path d="M31 1 L5 13 L14 17 L1 31 L27 17 L18 13.5 Z" fill="${RED}"/><path d="M31 1 L5 13 L14 17 Z" fill="#ff6a4d"/><path d="M14 17 L1 31 L18 20 Z" fill="${RED_DARK}"/>`,
  // Ability haste: an hourglass.
  haste: `<path d="M6 2 H26 V5 H24 C24 11 20 13.5 18.5 16 C20 18.5 24 21 24 27 H26 V30 H6 V27 H8 C8 21 12 18.5 13.5 16 C12 13.5 8 11 8 5 H6 Z" fill="${CREAM}"/><path d="M11 6 H21 C21 9.5 18 12 16 13.8 C14 12 11 9.5 11 6 Z M11.5 26 C12.5 22.5 14.5 21 16 20 C17.5 21 19.5 22.5 20.5 26 Z" fill="#2a2418"/>`,
  // XP: stacked chevrons.
  wisdom: `<path d="M16 2 L29 14 L29 20 L16 9 L3 20 L3 14 Z" fill="${PURPLE_LIGHT}"/><path d="M16 12 L29 24 L29 30 L16 19 L3 30 L3 24 Z" fill="${PURPLE}"/>`,
  // Projectiles: an arrow streaking up-right.
  multishot: `<path d="M3 29 L20 12" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/><path d="M30 2 L26 17 L21.5 12.5 L17 10 Z" fill="${GOLD}"/><path d="M4 21 L10 15 M11 28 L17 22" stroke="${CREAM}" stroke-width="2.6" stroke-linecap="round"/>`,
  // Lifesteal: a drop of blood with a fang.
  lifesteal: `<path d="M16 2 C21 10 26 15 26 20.5 C26 26 21.5 30 16 30 C10.5 30 6 26 6 20.5 C6 15 11 10 16 2 Z" fill="${RED}"/><path d="M11 18 L16 18 L13.5 25 Z" fill="${CREAM}"/><path d="M10 15 C11 12.5 12.5 10.5 14 8.5" stroke="#ff8a80" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  // Evasion: a wing.
  evasion: `<path d="M3 26 C5 14 13 5 29 3 C26 8 23 10 19 11 C23 11.5 25 12.5 26 14 C22 16 19 17 15 17 C18 18 19.5 19 20 21 C14 23 9 24 3 26 Z" fill="${STEEL}"/><path d="M3 26 C5 14 13 5 29 3 C20 8 12 15 3 26 Z" fill="#ffffff" opacity=".6"/>`,
  // Magic damage: a sparkle.
  arcana: `<path d="M16 1 L19.5 12.5 L31 16 L19.5 19.5 L16 31 L12.5 19.5 L1 16 L12.5 12.5 Z" fill="${BLUE}"/><path d="M16 1 L19.5 12.5 L16 16 L12.5 12.5 Z M31 16 L19.5 19.5 L16 16 L19.5 12.5 Z" fill="${BLUE_LIGHT}"/><circle cx="26" cy="5" r="2.2" fill="${BLUE_LIGHT}"/><circle cx="6" cy="27" r="1.6" fill="${BLUE_LIGHT}"/>`,
  // Healing and shields you give: a heart on a shield, with a glint.
  devotion: `<path d="M16 2 L28 6 L27 17 C26 23 21 27 16 30 C11 27 6 23 5 17 L4 6 Z" fill="${GOLD_DARK}"/><path d="M16 5 L25.5 8.2 L24.8 17 C24 21.5 20.5 24.6 16 27 C11.5 24.6 8 21.5 7.2 17 L6.5 8.2 Z" fill="${GOLD}"/><path d="M16 23 C11.5 19.8 9 17.3 9 14 C9 11.8 10.8 10.2 12.7 10.2 C14.2 10.2 15.3 11 16 12.2 C16.7 11 17.8 10.2 19.3 10.2 C21.2 10.2 23 11.8 23 14 C23 17.3 20.5 19.8 16 23 Z" fill="${GREEN}"/><path d="M11.5 13.5 C11.6 12.6 12.2 12 13 11.9" stroke="#8ef0b0" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M26 1 L27 3.5 L29.5 4.5 L27 5.5 L26 8 L25 5.5 L22.5 4.5 L25 3.5 Z" fill="${CREAM}"/>`,

  // --- Weapons ---
  // Ember Halo: fireballs circling a core.
  // Frost Shield: a shield of ice with a snowflake.
  frost: `<path d="M16 2 L28 6 L27 17 C26 23 21 27 16 30 C11 27 6 23 5 17 L4 6 Z" fill="${CYAN}"/><path d="M16 2 L28 6 L27 17 C26 23 21 27 16 30 Z" fill="#9be8f7"/><g stroke="#ffffff" stroke-width="2" stroke-linecap="round"><path d="M16 9 V23 M10 12.5 L22 19.5 M22 12.5 L10 19.5"/></g>`,
  // Glaives: a three-bladed throwing glaive mid-spin, curved blades swept back round a gold-ringed hub.
  glaive: `<path d="M5 9 A13 13 0 0 1 11 4.2 M27 23 A13 13 0 0 1 21 27.8" fill="none" stroke="${STEEL}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/><g fill="${STEEL}" stroke="${STEEL_DARK}" stroke-width="1"><path d="M15 14 C14 8 19 3 28 3 C22 6 20 10 20.5 16 Z"/><path d="M15 14 C14 8 19 3 28 3 C22 6 20 10 20.5 16 Z" transform="rotate(120 16 16)"/><path d="M15 14 C14 8 19 3 28 3 C22 6 20 10 20.5 16 Z" transform="rotate(240 16 16)"/></g><path d="M20.5 16 C20 10.5 22 6.5 26.5 4" fill="none" stroke="#ffffff" stroke-width="1" opacity=".7"/><circle cx="16" cy="16" r="5.6" fill="${STEEL_DARK}"/><circle cx="16" cy="16" r="5" fill="none" stroke="${GOLD_DARK}" stroke-width="2.6"/><circle cx="16" cy="16" r="5" fill="none" stroke="${GOLD}" stroke-width="1.2"/>`,
  // Bulwark: a big square shield with an iron boss.
  bulwark: `<rect x="5" y="3" width="22" height="26" rx="4" fill="${STEEL_DARK}"/><rect x="8" y="6" width="16" height="20" rx="2.5" fill="${STEEL}"/><path d="M16 6 V26 M8 16 H24" stroke="${STEEL_DARK}" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="${GOLD}"/>`,
  // Axe Toss: a single-bit battle axe, its crescent blade sharp-edged and bearded, on a long haft.
  axe: `<path d="M7 30 L22 5" stroke="#8d6e4a" stroke-width="3.4" stroke-linecap="round"/><path d="M8.6 26.3 L10.6 27.5 M11.2 22 L13.2 23.2" stroke="#5d4430" stroke-width="1.6"/><path d="M23 4.5 L8 1.5 C4 6 3.2 12.5 6.5 18 L19.8 11 Z" fill="${STEEL}"/><path d="M8 1.5 C4 6 3.2 12.5 6.5 18 L9.2 15.6 C7 11.5 7.4 6.8 10.4 3.4 Z" fill="#ffffff" opacity=".75"/><path d="M19.6 3.2 L24.4 5.6 L21 12.4 L16.6 10 Z" fill="${STEEL_DARK}"/><path d="M24 6 L30 3.5 L26.6 9.6 Z" fill="${STEEL_DARK}"/>`,
  embers: `<circle cx="16" cy="16" r="9.5" fill="none" stroke="${ORANGE}" stroke-width="1.6" stroke-dasharray="3 3" opacity=".7"/><circle cx="16" cy="16" r="3" fill="#ffd84d"/><g><circle cx="16" cy="5" r="4.2" fill="${ORANGE}"/><circle cx="16" cy="5" r="2" fill="#ffd84d"/></g><g><circle cx="26" cy="21" r="4.2" fill="${ORANGE_DARK}"/><circle cx="26" cy="21" r="2" fill="#ffb84d"/></g><g><circle cx="6" cy="21" r="4.2" fill="${ORANGE}"/><circle cx="6" cy="21" r="2" fill="#ffd84d"/></g>`,
  // Fire Wave: flames bursting up in a row.
  // Lute Notes: two beamed eighth notes.
  notes: `<path d="M10 23 V8 L26 4 V19" fill="none" stroke="#b388ff" stroke-width="2.6" stroke-linejoin="round"/><path d="M10 8 L26 4 V8.5 L10 12.5 Z" fill="#b388ff"/><ellipse cx="7" cy="23.5" rx="4.2" ry="3.2" transform="rotate(-20 7 23.5)" fill="#d1c4e9"/><ellipse cx="23" cy="19.5" rx="4.2" ry="3.2" transform="rotate(-20 23 19.5)" fill="#d1c4e9"/><circle cx="5.5" cy="22.5" r="1" fill="#ffffff"/><circle cx="21.5" cy="18.5" r="1" fill="#ffffff"/>`,
  // On Hit: a golden eighth note bursting out of a star, with sparks: a hit.
  onhit: `<path d="M16 1.5 L19 10 L28 8.5 L21.5 15 L28.5 21 L19.5 20.5 L17.5 29.5 L13 21.5 L4.5 25 L8.5 16.5 L2.5 9.5 L11.5 10.5 Z" fill="#ffd54f" opacity=".35"/><path d="M14 22 V9 L22 7 V11 L14 13" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="11.5" cy="22.5" rx="3.6" ry="2.7" transform="rotate(-20 11.5 22.5)" fill="#ffd54f" stroke="#c98a22" stroke-width="1"/><path d="M25 3 L26 5.5 L28.5 6 L26 7 L25 9.5 L24 7 L21.5 6 L24 5.5 Z M5 4 L5.7 5.6 L7.3 6 L5.7 6.6 L5 8.2 L4.3 6.6 L2.7 6 L4.3 5.6 Z" fill="#fff8e1"/>`,
  firewave: `<path d="M3 29 C2 25 4 22 6 21 C6 23 7 24 8 24 C8 21 9 18 11 17 C11 20 13 22 13 25 C13 27.5 12 29 12 29 Z" fill="${ORANGE}"/><path d="M12 29 C11 23 14 19 17 17 C17 20 18 21.5 19.5 21.5 C19.5 17 21 13 24 11 C24 16 27 19 27 24 C27 27 26 29 26 29 Z" fill="${ORANGE_DARK}"/><path d="M16 29 C15.5 26 17 24 18.5 23 C18.5 24.5 19.5 25 20.5 25 C21 23.5 21.5 22.5 23 22 C23 25 24 26.5 23 29 Z" fill="#ffd84d"/><path d="M2 31 H30" stroke="${ORANGE_DARK}" stroke-width="2" stroke-linecap="round"/>`,
  // Arcane Bolt: an orb with a trail.
  bolt: `<path d="M3 29 L14 18" stroke="${BLUE}" stroke-width="5" stroke-linecap="round" opacity=".55"/><circle cx="20" cy="12" r="9" fill="${BLUE}"/><circle cx="20" cy="12" r="5" fill="${BLUE_LIGHT}"/><circle cx="22" cy="10" r="2" fill="#ffffff"/>`,
  // Throwing Knives: two blades.
  knives: `<path d="M29 1 L31 3 L16 20 L12 17 Z" fill="${STEEL}"/><path d="M29 1 L16 20 L14 18.5 Z" fill="#ffffff" opacity=".5"/><path d="M11 16 L17 21 L15 23 L9 18 Z" fill="${GOLD_DARK}"/><path d="M13 20 L7 27 L5 25 L11 18 Z" fill="#6d4c3a"/><path d="M22 4 L25 7 L13 23 L10 21 Z" fill="${STEEL_DARK}" opacity=".7"/>`,
  // Lightning Storm: a bolt.
  storm: `<path d="M19 1 L6 18 H15 L11 31 L26 12 H17 Z" fill="#ffd84d"/><path d="M19 1 L6 18 H11 L17 6 Z" fill="#fff3a6"/>`,
  // Seeker Hex: a hexagon with an eye.
  hex: `<path d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z" fill="${PURPLE}"/><path d="M8 16 C11 11 21 11 24 16 C21 21 11 21 8 16 Z" fill="${PURPLE_LIGHT}"/><circle cx="16" cy="16" r="3" fill="#2a1a4a"/>`,
  // Cleave: a crescent slash.
  cleave: `<path d="M4 26 C6 12 15 4 29 3 C20 7 12 14 9 27 Z" fill="${ORANGE}"/><path d="M9 27 C12 14 20 7 29 3 C24 9 19 16 16 27 Z" fill="${ORANGE_DARK}"/>`,
  // Ground Slam: a fist striking cracked ground.
  slam: `<rect x="3" y="3" width="17" height="10" rx="2" fill="${STEEL}" transform="rotate(-20 11 8)"/><rect x="3" y="3" width="17" height="3.5" rx="1.5" fill="#ffffff" opacity=".5" transform="rotate(-20 11 8)"/><path d="M14 13 L23 26" stroke="#9a6a3e" stroke-width="4" stroke-linecap="round"/><path d="M2 29 H30" stroke="#7a5a3a" stroke-width="3" stroke-linecap="round"/><path d="M6 22 L4 19 M10 21 L10 17 M3 26 L1 24" stroke="${CREAM}" stroke-width="2.2" stroke-linecap="round"/>`,
  // Venom Trail: a dripping drop.
  venom: `<path d="M16 2 C21 10 26 15 26 20.5 C26 26 21.5 30 16 30 C10.5 30 6 26 6 20.5 C6 15 11 10 16 2 Z" fill="#7cdc3a"/><circle cx="12.5" cy="20" r="2.4" fill="#2f5a12"/><circle cx="19.5" cy="20" r="2.4" fill="#2f5a12"/><path d="M12 26 H20" stroke="#2f5a12" stroke-width="2" stroke-linecap="round"/>`,
  // Spirit Blades: three blades circling.
  orbit: `<circle cx="16" cy="16" r="4" fill="${CYAN}"/><path d="M16 2 L19 9 L16 11 L13 9 Z" fill="${STEEL}"/><path d="M28.1 23 L20.6 23.8 L19.3 20.8 L22.6 18.5 Z" fill="${STEEL}"/><path d="M3.9 23 L9.4 18.5 L12.7 20.8 L11.4 23.8 Z" fill="${STEEL}"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="${CYAN}" stroke-width="1.6" stroke-dasharray="4 4" opacity=".7"/>`,
  // Radiant Field: a sun.
  field: `<circle cx="16" cy="16" r="7" fill="#ffd84d"/><g stroke="#ffb627" stroke-width="3" stroke-linecap="round"><path d="M16 2 V5 M16 27 V30 M2 16 H5 M27 16 H30 M6 6 L8 8 M24 24 L26 26 M26 6 L24 8 M6 26 L8 24"/></g><circle cx="14" cy="14" r="2.5" fill="#fff3a6"/>`,
  // Mine Layer: a mine with a red light.
  mines: `<path d="M16 3 V7 M16 25 V29 M3 16 H7 M25 16 H29 M7 7 L9.5 9.5 M25 7 L22.5 9.5 M7 25 L9.5 22.5 M25 25 L22.5 22.5" stroke="${STEEL_DARK}" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="16" r="9" fill="#3d4652"/><circle cx="16" cy="16" r="3.5" fill="${RED}"/><circle cx="13" cy="13" r="2" fill="#ffffff" opacity=".25"/>`,
  // Shuriken: a four-point star.
  shuriken: `<path d="M16 1 L19 13 L31 16 L19 19 L16 31 L13 19 L1 16 L13 13 Z" fill="${STEEL}"/><path d="M16 1 L19 13 L16 16 Z M31 16 L19 19 L16 16 Z M16 31 L13 19 L16 16 Z M1 16 L13 13 L16 16 Z" fill="${STEEL_DARK}"/><circle cx="16" cy="16" r="3" fill="#2a2f38"/>`,
  // Shadow Daggers: crossed daggers.
  daggers: `<path d="M5 2 L19 19 L16 22 L2 5 Z" fill="${PURPLE_LIGHT}"/><path d="M27 2 L13 19 L16 22 L30 5 Z" fill="${STEEL}"/><path d="M14 21 L18 25 L11 30 L9 28 Z M18 21 L14 25 L21 30 L23 28 Z" fill="#3a2b52"/>`,
  // Fireball: a flaming ball.
  fireball: `<path d="M4 28 C3 20 7 13 13 9 C12 13 14 15 16 15 C15 11 18 6 24 3 C22 9 30 13 28 21 C27 26 22 30 16 30 C11 30 7 29.5 4 28 Z" fill="${ORANGE}"/><circle cx="17" cy="21" r="6" fill="#ffd84d"/><circle cx="16" cy="20" r="2.5" fill="#fff3a6"/>`,
  // Longbow: an arrow.
  arrows: `<path d="M4 28 L25 7" stroke="#b07a4a" stroke-width="3" stroke-linecap="round"/><path d="M30 2 L28 12 L24 8 L20 4 Z" fill="${STEEL}"/><path d="M4 28 L4 21 L8 24 Z M4 28 L11 28 L8 24 Z" fill="${GREEN}"/><path d="M8 24 L7 18 L11 21 Z M8 24 L14 25 L11 21 Z" fill="${GREEN_DARK}"/>`,
  // Wolf Pack: a wolf's head.
  wolves: `<path d="M5 3 L12 10 H20 L27 3 L27 16 C27 22 22 28 16 30 C10 28 5 22 5 16 Z" fill="#9fb6a4"/><path d="M11 22 L16 30 L21 22 L16 24 Z" fill="#cfe3d3"/><circle cx="11.5" cy="16" r="2.2" fill="#ffe066"/><circle cx="20.5" cy="16" r="2.2" fill="#ffe066"/><path d="M14 22 H18 L16 25 Z" fill="#2a2f2b"/>`,

  // --- Hero abilities (E) ---
  // Meteor: a rock with a fiery tail.
  meteor: `<path d="M2 2 L18 14 L14 18 Z" fill="${ORANGE}" opacity=".6"/><path d="M8 2 L20 12 L17 16 Z M2 8 L12 20 L16 17 Z" fill="${ORANGE_DARK}" opacity=".7"/><circle cx="21" cy="21" r="9" fill="#8a5a44"/><circle cx="18" cy="19" r="2.5" fill="#5e3c2c"/><circle cx="24" cy="24" r="2" fill="#5e3c2c"/><path d="M14 16 C16 13.5 19 12.5 22 13" stroke="${ORANGE}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  // Leap: an arc ending in an impact.
  leap: `<path d="M4 26 C6 10 20 4 26 16" stroke="${RED}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-dasharray="1 5"/><path d="M22 14 L29 15 L26 21 Z" fill="${RED}"/><path d="M18 30 H31 M21 26 L23 28 M28 26 L26 28" stroke="${CREAM}" stroke-width="2.4" stroke-linecap="round"/>`,
  // War Cry: a horn with sound waves.
  warcry: `<path d="M3 13 L15 6 V26 L3 19 Z" fill="${GOLD}"/><rect x="2" y="12" width="4" height="8" rx="1" fill="${GOLD_DARK}"/><path d="M20 10 C22.5 12.5 22.5 19.5 20 22 M24 6 C29 11 29 21 24 26" stroke="${CREAM}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  // Shadow Veil: a mask with closed eyes.
  veil: `<path d="M3 9 C9 6 23 6 29 9 C29 18 24 25 16 27 C8 25 3 18 3 9 Z" fill="#5a3d8a"/><path d="M7 14 C9 16.5 12 16.5 14 14 M18 14 C20 16.5 23 16.5 25 14" stroke="${PURPLE_LIGHT}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M3 9 C9 6 23 6 29 9 C23 8 9 8 3 11 Z" fill="#7d5bbd"/>`,
  // Flame Nova: a ring of flames.
  flamenova: `<circle cx="16" cy="16" r="5" fill="#ffd84d"/><g fill="${ORANGE}"><path d="M16 1 L19 8 H13 Z"/><path d="M16 31 L13 24 H19 Z"/><path d="M1 16 L8 13 V19 Z"/><path d="M31 16 L24 19 V13 Z"/></g><g fill="${ORANGE_DARK}"><path d="M5 5 L11 9 L9 11 Z"/><path d="M27 5 L23 11 L21 9 Z"/><path d="M5 27 L9 21 L11 23 Z"/><path d="M27 27 L21 23 L23 21 Z"/></g>`,
  // Tumble: a curling arrow.
  tumble: `<path d="M6 22 C3 12 12 4 20 7 C27 9.5 28 18 22 21" stroke="${GREEN}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M26 17 L20 26 L17 18 Z" fill="${GREEN}"/><path d="M2 29 H12" stroke="${CREAM}" stroke-width="2.4" stroke-linecap="round"/>`,
  // Call of the Wild: a paw print under a moon.
  wildcall: `<path d="M26 2 C21 3 18.5 8 20.5 12.5 C22.5 16 27 17 30 15 C26.5 14.5 24 11 24.5 7.5 C25 5 26 3.5 26 2 Z" fill="${CREAM}"/><ellipse cx="13" cy="23.5" rx="6.5" ry="5.5" fill="${GREEN}"/><ellipse cx="5" cy="15.5" rx="2.6" ry="3.4" fill="${GREEN}"/><ellipse cx="10.5" cy="11" rx="2.6" ry="3.4" fill="${GREEN}"/><ellipse cx="17" cy="11.5" rx="2.6" ry="3.4" fill="${GREEN}"/><ellipse cx="21.5" cy="17" rx="2.6" ry="3.4" fill="${GREEN}"/><ellipse cx="11" cy="22" rx="3" ry="2" fill="#8ef0b0" opacity=".6"/>`,
  // Time Bomb: a bomb with a clock face.
  // Flask Toss: a round flask of green brew with a cork.
  flask: `<rect x="12" y="2" width="8" height="5" rx="1.5" fill="#8d6e63"/><path d="M13 7 H19 V12 C25 14 28 18 28 22 C28 27.5 22.5 31 16 31 C9.5 31 4 27.5 4 22 C4 18 7 14 13 12 Z" fill="${STEEL}"/><path d="M6.5 21 C10 23 22 23 25.5 21 C26 26 21.5 28.5 16 28.5 C10.5 28.5 6 26 6.5 21 Z" fill="${GREEN}"/><circle cx="13" cy="24" r="1.8" fill="#c6ff8a"/><circle cx="19" cy="25.5" r="1.2" fill="#c6ff8a"/>`,
  // Judgment Hammer: a gold-trimmed war hammer with light behind it.
  hammer: `<circle cx="19" cy="11" r="10" fill="#ffe082" opacity=".35"/><path d="M5 29 L18 14" stroke="#9a6a3e" stroke-width="3.6" stroke-linecap="round"/><rect x="12" y="3" width="17" height="11" rx="2" fill="${STEEL}" transform="rotate(42 20.5 8.5)"/><rect x="12" y="7" width="17" height="3" fill="${GOLD}" transform="rotate(42 20.5 8.5)"/>`,
  // Smite: a beam of light striking down.
  smite: `<path d="M12 1 H20 L18 22 H14 Z" fill="#fff59d"/><path d="M14.5 1 H17.5 L16.6 22 H15.4 Z" fill="#ffffff"/><ellipse cx="16" cy="25" rx="11" ry="4.5" fill="${GOLD}"/><ellipse cx="16" cy="25" rx="6" ry="2.4" fill="#fff59d"/><path d="M4 18 L7 20 M28 18 L25 20" stroke="#fff59d" stroke-width="2.2" stroke-linecap="round"/>`,
  // Toxic Pool: a bubbling green puddle with a skull-ish glint.
  toxicpool: `<ellipse cx="16" cy="23" rx="15" ry="7" fill="#5a8f2a"/><ellipse cx="16" cy="22" rx="12" ry="5" fill="#9ccc65"/><circle cx="10" cy="15" r="3" fill="#9ccc65"/><circle cx="20" cy="10" r="4" fill="#c5e1a5"/><circle cx="25" cy="16" r="2.2" fill="#9ccc65"/><circle cx="19" cy="9" r="1.3" fill="#ffffff" opacity=".7"/><path d="M8 23 C11 25 21 25 24 23" stroke="#33691e" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  // Consecration: a glowing circle on the ground with rays rising from it.
  consecrate: `<ellipse cx="16" cy="24" rx="14" ry="6" fill="#ffe082" opacity=".45"/><ellipse cx="16" cy="24" rx="14" ry="6" fill="none" stroke="${GOLD}" stroke-width="2.4"/><path d="M10 22 V9 M16 21 V3 M22 22 V9" stroke="#fff59d" stroke-width="3" stroke-linecap="round"/>`,
  // Prayer of Light: hands together, haloed.
  prayer: `<circle cx="16" cy="9" r="7" fill="none" stroke="${GOLD}" stroke-width="2.6"/><path d="M16 11 C13 15 11 20 11 25 L9 30 H16 Z" fill="#f6d2b6"/><path d="M16 11 C19 15 21 20 21 25 L23 30 H16 Z" fill="#e8b58f"/><path d="M16 11 V30" stroke="#b07a5a" stroke-width="1.5"/>`,
  timebomb: `<circle cx="15" cy="18" r="11" fill="#2e3a4a"/><circle cx="15" cy="18" r="7" fill="${CYAN}"/><path d="M15 18 V13.5 M15 18 L18.5 20" stroke="#1b2a35" stroke-width="2" stroke-linecap="round"/><path d="M22 9 L25 5" stroke="#b07a4a" stroke-width="2.4" stroke-linecap="round"/><circle cx="26.5" cy="3.5" r="2.5" fill="${ORANGE}"/>`,

  // --- Bonus choices ---
  bonusHeal: `<path d="M16 29 C8 23 2 18 2 11 C2 6 6 3 10 3 C13 3 15 5 16 7 C17 5 19 3 22 3 C26 3 30 6 30 11 C30 18 24 23 16 29 Z" fill="${GREEN}"/><path d="M14 9 H18 V13 H22 V17 H18 V21 H14 V17 H10 V13 H14 Z" fill="#ffffff"/>`,
  bonusGold: `<ellipse cx="16" cy="21" rx="12" ry="7" fill="${GOLD_DARK}"/><ellipse cx="16" cy="18" rx="12" ry="7" fill="${GOLD}"/><ellipse cx="16" cy="11" rx="9" ry="5" fill="${GOLD_DARK}"/><ellipse cx="16" cy="9" rx="9" ry="5" fill="#ffd36b"/><path d="M12 9 H20" stroke="${GOLD_DARK}" stroke-width="1.6" stroke-linecap="round"/>`,
};

/** Ultimates (R). */
const ULT_ICONS: Record<UltimateId, string> = {
  // Ballad of Heroes: a lute with notes rising from it in a ring of song.
  ballad: `<circle cx="16" cy="16" r="14" fill="none" stroke="#b388ff" stroke-width="1.6" stroke-dasharray="3 3" opacity=".8"/><path d="M19 13 L28 4" stroke="#8d6e4a" stroke-width="2.6" stroke-linecap="round"/><path d="M26 3 L30 5 L28 7 Z" fill="#5d4037"/><ellipse cx="13" cy="19" rx="8" ry="7" transform="rotate(-45 13 19)" fill="#c98a4a"/><ellipse cx="13" cy="19" rx="8" ry="7" transform="rotate(-45 13 19)" fill="none" stroke="#8d5a3a" stroke-width="1.4"/><circle cx="14" cy="18" r="2.4" fill="#3e2a1e"/><path d="M11 22 L21 11" stroke="#f4ead2" stroke-width=".8"/><path d="M6 9 V4 L9 3" fill="none" stroke="#fff59d" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="5" cy="9.3" rx="1.9" ry="1.4" fill="#fff59d"/><path d="M24 26 V21 L27 20" fill="none" stroke="#fff59d" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="23" cy="26.3" rx="1.9" ry="1.4" fill="#fff59d"/>`,
  // Dragon Form: a dragon's head breathing fire.
  dragonform: `<path d="M4 9 L10 4 L9 9 L15 6 L13 11 C18 10 22 12 23 16 L28 17 L24 20 C22 24 17 26 12 25 L7 28 L8 23 C4 20 3 14 4 9 Z" fill="#c62828"/><path d="M9 14 L13 13 L12 16 Z" fill="#ffd84d"/><path d="M23 18 C26 18 29 16 31 13 C30 17 31 20 29 23 C28 21 26 20 24 20 Z" fill="${ORANGE}"/><path d="M24 19 C26 19 28 18 29.5 16 C29 18.5 29.5 20 28.5 21.5 Z" fill="#ffd84d"/><path d="M10 4 L12 1 M15 6 L18 3" stroke="#3b0606" stroke-width="2" stroke-linecap="round"/>`,
  // Shadow Strike: a dagger blinking along a zigzag of afterimages.
  shadowstrike: `<path d="M2 26 L8 20 L6 15 L12 10" stroke="${PURPLE}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-dasharray="2 3"/><path d="M30 2 L28 9 L17 20 L12 15 L23 4 Z" fill="${PURPLE_LIGHT}"/><path d="M30 2 L17 20 L15 18 Z" fill="#ffffff" opacity=".5"/><path d="M12 15 L17 20 L15 22 L10 17 Z" fill="${GOLD_DARK}"/><path d="M12 21 L8 25 L7 24 L11 20 Z" fill="#3a2b52"/>`,
  // Chrono Freeze: a snowflake around a clock face.
  chrono: `<g stroke="${CYAN}" stroke-width="2.6" stroke-linecap="round"><path d="M16 1 V8 M16 24 V31 M3 8.5 L9 12 M23 20 L29 23.5 M3 23.5 L9 20 M23 12 L29 8.5"/><path d="M13 3 L16 5.5 L19 3 M13 29 L16 26.5 L19 29"/></g><circle cx="16" cy="16" r="7.5" fill="#1b3a4a" stroke="#bdf3ff" stroke-width="2"/><path d="M16 16 V11.5 M16 16 L19 18" stroke="#bdf3ff" stroke-width="2" stroke-linecap="round"/>`,
  // Bloodrage: a blazing red flame with angry eyes.
  rage: `<path d="M16 1 C19 7 27 10 27 19 C27 25.5 22 30 16 30 C10 30 5 25.5 5 19 C5 14 8 11 10 8 C10 12 12 13 13.5 13 C12 8 13.5 4.5 16 1 Z" fill="${RED}"/><path d="M16 30 C11.5 30 9 26.5 9 23 C9 19.5 12 17.5 13 15 C14 18 16 18.5 17 18 C19 20 23 21 23 24 C23 27.5 20 30 16 30 Z" fill="${RED_DARK}"/><path d="M10 19 L14.5 21 M22 19 L17.5 21" stroke="#ffd84d" stroke-width="2.6" stroke-linecap="round"/>`,
  // Rally: a war banner.
  retribution: `<g fill="#ff8f00"><path d="M16 1 L18 6 H14 Z"/><path d="M31 16 L26 18 V14 Z"/><path d="M1 16 L6 14 V18 Z"/><path d="M5 5 L9.5 7.5 L7.5 9.5 Z"/><path d="M27 5 L24.5 9.5 L22.5 7.5 Z"/><path d="M5 27 L7.5 22.5 L9.5 24.5 Z"/><path d="M27 27 L22.5 24.5 L24.5 22.5 Z"/></g><path d="M16 6 L25 9.5 V16 C25 22 21 26 16 28.5 C11 26 7 22 7 16 V9.5 Z" fill="#8d6e63" stroke="#3e2723" stroke-width="1.5"/><path d="M16 9 L22 11.5 V16 C22 20 19.5 23 16 25 Z" fill="#bcaaa4"/><path d="M12 15 L16 19 L20 13" stroke="#ff8f00" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Inferno: fireballs raining from above.
  inferno: `<g fill="${ORANGE}" opacity=".55"><path d="M5 2 L10 10 L7 11 Z"/><path d="M15 1 L19 8 L16 9 Z"/><path d="M24 3 L28 10 L25 11 Z"/></g><circle cx="9" cy="13" r="4" fill="${ORANGE}"/><circle cx="19" cy="11" r="3.5" fill="${ORANGE_DARK}"/><circle cx="27" cy="14" r="3" fill="${ORANGE}"/><path d="M4 31 C3 25 7 21 11 19 C10.5 22 12 23.5 13.5 23.5 C13 20 16 17 20 16 C19 20 25 22 26 27 C26.5 29.5 25 31 25 31 Z" fill="${ORANGE}"/><path d="M10 31 C10 28 12 26.5 14 25.5 C14 27.5 15.5 28 17 28 C18 26.5 19 26 20.5 26 C20.5 28 21 29.5 20 31 Z" fill="#ffd84d"/>`,
  // Arrow Storm: a volley of arrows.
  arrowstorm: `<g stroke="#b07a4a" stroke-width="2.4" stroke-linecap="round"><path d="M3 21 L17 7"/><path d="M9 27 L23 13"/><path d="M15 31 L29 17"/></g><g fill="${STEEL}"><path d="M21 3 L19.5 10 L14 4.5 Z"/><path d="M27 9 L25.5 16 L20 10.5 Z"/><path d="M31 15 L31 22 L24.5 16.5 Z"/></g><g fill="${GREEN}"><path d="M3 21 L2 17 L5 19 Z"/><path d="M9 27 L8 23 L11 25 Z"/></g>`,
  // Spirit Bear: a bear's head.
  bear: `<circle cx="7" cy="8" r="5" fill="#8d5a3a"/><circle cx="25" cy="8" r="5" fill="#8d5a3a"/><circle cx="7" cy="8" r="2.4" fill="#5a3a1e"/><circle cx="25" cy="8" r="2.4" fill="#5a3a1e"/><ellipse cx="16" cy="18" rx="12.5" ry="11.5" fill="#a0693e"/><ellipse cx="16" cy="23" rx="6.5" ry="5" fill="#e0c09a"/><ellipse cx="16" cy="20.5" rx="2.6" ry="1.8" fill="#2a1a10"/><path d="M16 22 V24.5 M13.5 25 C15 26.2 17 26.2 18.5 25" stroke="#2a1a10" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="11" cy="15" r="1.7" fill="#2a1a10"/><circle cx="21" cy="15" r="1.7" fill="#2a1a10"/><path d="M4 28 C6 25 9 26 10 29 M22 29 C23 26 26 25 28 28" stroke="${GREEN}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  // Chronobreak: an hourglass inside a backward-turning arrow.
  // Grand Elixir: a tall flask with bubbles rising out of it.
  elixir: `<circle cx="11" cy="5" r="2.4" fill="${GREEN}"/><circle cx="19" cy="3" r="1.8" fill="${GREEN}"/><circle cx="22" cy="8" r="1.4" fill="#c6ff8a"/><path d="M12 9 H20 V14 L27 25 C28.5 28 26.5 31 23 31 H9 C5.5 31 3.5 28 5 25 L12 14 Z" fill="${STEEL}"/><path d="M7.5 23 H24.5 L26 25.5 C27 27.5 25.5 29 23 29 H9 C6.5 29 5 27.5 6 25.5 Z" fill="${GREEN}"/><path d="M11 25 L13 23" stroke="#c6ff8a" stroke-width="2" stroke-linecap="round"/>`,
  // Avenging Wrath: wings of light around a sword.
  wrath: `<path d="M16 4 C9 6 4 11 2 19 C7 16 11 16 14 18 Z M16 4 C23 6 28 11 30 19 C25 16 21 16 18 18 Z" fill="#fff59d"/><path d="M15 3 H17 V24 H15 Z" fill="${STEEL}"/><path d="M10 23 H22 V25.5 H10 Z" fill="${GOLD}"/><path d="M14.8 25.5 H17.2 V31 H14.8 Z" fill="#9a6a3e"/>`,
  // Divine Intervention: a radiant hand reaching down.
  intervention: `<g stroke="#fff59d" stroke-width="2.4" stroke-linecap="round"><path d="M16 26 V31 M6 22 L3 25 M26 22 L29 25"/></g><path d="M9 2 H23 V10 C23 15 20 18 16 19 C12 18 9 15 9 10 Z" fill="#f6d2b6"/><path d="M11 2 V9 M14 2 V10 M18 2 V10 M21 2 V9" stroke="#b07a5a" stroke-width="1.4"/><circle cx="16" cy="22" r="4" fill="${GOLD}"/>`,
  rewind: `<path d="M27 16 A11 11 0 1 1 16 5" stroke="${CYAN}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M16 1 L21 5 L16 9 Z" fill="${CYAN}"/><path d="M11 10 H21 V12 C21 14 18 15.5 17 16 C18 16.5 21 18 21 20 V22 H11 V20 C11 18 14 16.5 15 16 C14 15.5 11 14 11 12 Z" fill="#eceff1"/><path d="M13 21 C13.5 19.5 15 18.5 16 18 C17 18.5 18.5 19.5 19 21 Z" fill="${CYAN}"/>`,
};

/** An ultimate's icon, in a span ready to append. */
export function ultIconEl(id: UltimateId, size = 20): HTMLElement {
  const span = document.createElement('span');
  span.className = 'icon-box';
  span.innerHTML = `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">${ULT_ICONS[id]}</svg>`; // Static markup.
  return span;
}

/** An icon as inline SVG. */
export function iconSvg(id: ChoiceId, size = 20): string {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">${ICONS[id] ?? ''}</svg>`;
}

/** An icon in a span, ready to append. */
export function iconEl(id: ChoiceId, size = 20): HTMLElement {
  const span = document.createElement('span');
  span.className = 'icon-box';
  span.innerHTML = iconSvg(id, size); // Static markup.
  return span;
}

/** Every id that has an icon (for previews). */
export const ICON_IDS = Object.keys(ICONS) as ChoiceId[];

/** Ultimate ids that have an icon (for previews). */
export const ULT_ICON_IDS = Object.keys(ULT_ICONS) as UltimateId[];

/** An ultimate's icon as inline SVG (for previews). */
export function ultIconSvg(id: UltimateId, size = 20): string {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">${ULT_ICONS[id]}</svg>`;
}
