// Artifact art: one glyph per artifact on a 32x32 grid, drawn as the object itself (a whetstone, a vial, a crown)
// rather than a stat symbol, so they read as relics, not upgrades. Drawn inside a round, tier-colored medallion
// (see artifactView.ts). An artifact without art here falls back to its stat icon (`icon` in shared/artifacts.ts).
// Static markup (no user input), so it's safe to put in innerHTML.

import type { ArtifactId } from '../shared/artifacts';

const GOLD = '#f2b84b';
const GOLD_DARK = '#c98a22';
const CREAM = '#f4ead2';
const STEEL = '#cfd8e3';
const STEEL_DARK = '#8796a8';
const RED = '#ef3b2c';
const RED_DARK = '#b5201b';
const GREEN = '#3ecf73';
const GREEN_DARK = '#249a52';
const CYAN = '#5ad7f0';
const PURPLE = '#9b6bff';
const PURPLE_LIGHT = '#c4a6ff';
const ORANGE = '#ff8a3d';
const BROWN = '#8d5a3a';
const BROWN_DARK = '#5a3a1e';
/** The heart shape, shared by the heart artifacts. */
const HEART = 'M16 29 C8 23 2 18 2 11 C2 6 6 3 10 3 C13 3 15 5 16 7 C17 5 19 3 22 3 C26 3 30 6 30 11 C30 18 24 23 16 29 Z';

export const ARTIFACT_ART: Partial<Record<ArtifactId, string>> = {
  // --- Mythical ---
  // A deep red heart, cracked open at the top, with a glowing hollow inside and drops of life falling in.
  bottomlessHeart: `<circle cx="16" cy="17" r="15" fill="#ff6d00" opacity=".18"/><path d="${HEART}" fill="${RED_DARK}"/><path d="M16 26 C10.5 21.8 6 18.2 6 12.8 C6 9.8 8.2 8 10.6 8 C12.8 8 14.5 9.3 16 11.5 C17.5 9.3 19.2 8 21.4 8 C23.8 8 26 9.8 26 12.8 C26 18.2 21.5 21.8 16 26 Z" fill="${RED}"/><ellipse cx="16" cy="15" rx="5" ry="6" fill="#2a0606"/><ellipse cx="16" cy="16.5" rx="3" ry="3.6" fill="#ff8a65" opacity=".55"/><path d="M13 7 L15 10 L13.5 12 M19 7 L17 10 L18.5 12" stroke="#2a0606" stroke-width="1.4" fill="none"/><path d="M16 1 C14.6 3 14.6 4.4 16 5 C17.4 4.4 17.4 3 16 1 Z" fill="#ff6a4d"/><circle cx="16" cy="8" r="1.1" fill="#ff6a4d"/><path d="M9 11.5 C9.5 10.2 10.4 9.6 11.5 9.6" stroke="#ffffff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/>`,
  // A great curved fang, with two smaller fangs splitting off it: one becomes many.
  hydrasTooth: `<path d="M4 4 C14 2 20 6 22 14 C23.5 20 22 26 18 31 C17 25 15 20 11 15 C8 11 5 8 4 4 Z" fill="${CREAM}"/><path d="M4 4 C14 2 20 6 22 14 C23.5 20 22 26 18 31 C19.5 24 19 18 16 12 C13 7 8 5 4 4 Z" fill="#d9cdb0"/><path d="M4 4 C9 3 12 3.5 14 4.5 L12 7.5 C9.5 6.5 7 5.5 4 4 Z" fill="${GREEN_DARK}"/><path d="M22 12 C26 11 29 13 30 17 C28 16 26 16 23.5 17 Z" fill="${CREAM}"/><path d="M21.5 20 C25 20.5 27.5 23 28 27 C26 25.5 24 25 22 25.5 Z" fill="${CREAM}"/><path d="M11 9 C14 11 16.5 15 17.5 20" stroke="#ffffff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/><circle cx="18" cy="31" r="1" fill="#ff6d00"/>`,
  // A black bomb with a burning fuse, glowing orange cracks, and blast rings rolling out around it.
  blastforgedCore: `<circle cx="15" cy="18" r="14" fill="none" stroke="#ff6d00" stroke-width="1.2" opacity=".45"/><circle cx="15" cy="18" r="11.5" fill="none" stroke="#ffab40" stroke-width="1" opacity=".55" stroke-dasharray="3 2"/><circle cx="15" cy="18" r="9" fill="#262a33"/><path d="M10 15 L13 18 L11 22 M16 12 L17 16 L21 18 M15 24 L17 21" stroke="#ff6d00" stroke-width="1.6" fill="none" stroke-linejoin="round"/><circle cx="12" cy="14.5" r="2" fill="#ffffff" opacity=".22"/><rect x="18.5" y="7" width="5" height="4" rx="1" transform="rotate(40 21 9)" fill="#5f6875"/><path d="M23 7 C24 4.5 26 3.5 27.5 4" stroke="#b07a4a" stroke-width="1.6" fill="none"/><path d="M28 1 L29 3 L31 3.5 L29.2 4.6 L29.6 6.8 L28 5.4 L26.3 6.6 L26.8 4.5 L25 3.3 L27.1 3 Z" fill="#ffd84d"/>`,

  // --- Common ---
  // A grey stone, freshly used: sparks fly off it.
  whetstone: `<g transform="rotate(-20 16 20)"><rect x="3" y="16" width="26" height="9" rx="2" fill="#6b7885"/><rect x="3" y="16" width="26" height="3.5" rx="1.5" fill="#a9b4bf"/></g><path d="M8 13 L24 4 L26 7 L10 15 Z" fill="${STEEL}"/><path d="M8 13 L24 4 L25 5.5 Z" fill="#ffffff"/><path d="M20 12 L23 15 M24 10 L28 11 M18 15 L18 18" stroke="#ffd84d" stroke-width="1.8" stroke-linecap="round"/>`,
  // An acorn on a string.
  oakCharm: `<path d="M10 3 C10 0 22 0 22 3" stroke="#d8c08a" stroke-width="1.6" fill="none"/><rect x="15" y="3" width="2.4" height="5" fill="${BROWN_DARK}"/><path d="M8 15 H24 C24 24 20 29 16 30 C12 29 8 24 8 15 Z" fill="#c98a4a"/><path d="M11 17 C11 22 13 26 15 27" stroke="#e8b57a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M6 15 C6 9 26 9 26 15 Z" fill="#6d4426"/><path d="M10 11 L13 15 M15 10 L17 15 M20 10 L21 15" stroke="#4a2c16" stroke-width="1.3"/>`,
  // A worn leather boot.
  travelersBoots: `<path d="M9 3 H19 V17 L27 20 C30 21 30 26 28 26 H6 C5 26 5 24 5.5 22 L9 17 Z" fill="${BROWN}"/><path d="M9 3 H19 V7 H9 Z" fill="#b07a52"/><rect x="5" y="25" width="24" height="4" rx="1.5" fill="#3e2a1e"/><path d="M12 11 H16.5 M12 14.5 H16.5" stroke="${CREAM}" stroke-width="1.6" stroke-linecap="round"/>`,
  // A stone with a cushion of moss and a fresh sprout.
  mendingMoss: `<ellipse cx="16" cy="24" rx="13" ry="6.5" fill="#6f7680"/><path d="M4 23 C5 17 10 15 13 17 C15 13 21 13 23 17 C26 15 29 19 28 23 C24 21 8 21 4 23 Z" fill="${GREEN}"/><circle cx="10" cy="19" r="1.4" fill="#8ef0b0"/><circle cx="21" cy="17" r="1.2" fill="#8ef0b0"/><path d="M16 15 V6" stroke="${GREEN_DARK}" stroke-width="2" stroke-linecap="round"/><ellipse cx="12.5" cy="7.5" rx="3.5" ry="1.8" fill="#8ef0b0" transform="rotate(30 12.5 7.5)"/><ellipse cx="19.5" cy="5.5" rx="3.5" ry="1.8" fill="${GREEN}" transform="rotate(-30 19.5 5.5)"/>`,
  // A dark rock pulling iron filings toward it.
  lodestone: `<path d="M8 13 L14 7 L22 9 L26 16 L22 25 L12 26 L7 20 Z" fill="#4a5560"/><path d="M14 7 L22 9 L18 14 L8 13 Z" fill="#6b7885"/><path d="M18 14 L26 16 L22 25 Z" fill="#3a434c"/><g stroke="${STEEL}" stroke-width="1.8" stroke-linecap="round"><path d="M2 6 L5 8 M3 28 L6 25 M29 3 L27 6 M30 28 L28 25 M1 17 L4 17 M16 1 L16 4"/></g>`,
  // A quill and a drop of ink.
  scholarsQuill: `<path d="M29 2 C18 4 10 12 7 24 L10 25 C14 16 21 9 29 2 Z" fill="${CREAM}"/><path d="M29 2 C27 10 20 18 10 25 L9 24 C15 17 22 9 29 2 Z" fill="#d9cdb0"/><path d="M7 24 L4.5 30 L10 25 Z" fill="#2e2e3a"/><ellipse cx="7" cy="30" rx="6" ry="1.8" fill="${PURPLE}"/>`,
  // A belt buckle on its strap.
  ironBuckle: `<rect x="1" y="12" width="30" height="8" rx="1" fill="#6d4c3a"/><rect x="8" y="6" width="16" height="20" rx="3.5" fill="none" stroke="${STEEL_DARK}" stroke-width="3.5"/><rect x="8" y="6" width="16" height="20" rx="3.5" fill="none" stroke="${STEEL}" stroke-width="1.2"/><path d="M9 16 H21" stroke="${STEEL}" stroke-width="2.6" stroke-linecap="round"/>`,
  // A gold coin with a four-leaf clover.
  luckyCoin: `<circle cx="16" cy="16" r="13.5" fill="${GOLD}"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="${GOLD_DARK}" stroke-width="1.5"/><g fill="${GREEN}"><circle cx="16" cy="11.5" r="3.2"/><circle cx="16" cy="19" r="3.2"/><circle cx="12.2" cy="15.2" r="3.2"/><circle cx="19.8" cy="15.2" r="3.2"/></g><path d="M16 17 L19 23" stroke="${GREEN_DARK}" stroke-width="1.6" stroke-linecap="round"/>`,

  // A round flask of green tonic, bubbling.
  healingDraught: `<rect x="12.5" y="2" width="7" height="4" rx="1" fill="#a1785a"/><path d="M13.5 6 H18.5 V11 C24 12.5 27 16.5 27 21 C27 26.5 22 30 16 30 C10 30 5 26.5 5 21 C5 16.5 8 12.5 13.5 11 Z" fill="#e8eef2" opacity=".85"/><path d="M5.5 19 H26.5 C27 25 22 29.5 16 29.5 C10 29.5 5 25 5.5 19 Z" fill="${GREEN}"/><path d="M5.5 19 H26.5 C25 21 20 21.5 16 20.5 C12 19.5 8 21 5.5 19 Z" fill="#8ef0b0"/><circle cx="12" cy="24" r="1.6" fill="#c6ffd8"/><circle cx="19" cy="25.5" r="1.1" fill="#c6ffd8"/><path d="M14 16 h4 M16 14 v4" stroke="${RED}" stroke-width="1.8" stroke-linecap="round"/>`,

  // --- Rare ---
  // A dagger of glass, already cracked.
  glassEdge: `<path d="M27 2 L30 5 L14 21 L11 18 Z" fill="#bdf3ff" opacity=".9"/><path d="M27 2 L14 21 L12.5 19.5 Z" fill="#ffffff" opacity=".8"/><path d="M22 9 L20 13 L23 12" stroke="${RED}" stroke-width="1.3" fill="none"/><path d="M8 15 L17 24 L15 26 L6 17 Z" fill="${CYAN}"/><path d="M11 21 L5 27 L3 25 L9 19 Z" fill="#2e3a4a"/><circle cx="4" cy="28" r="2" fill="${CYAN}"/>`,
  // A corked vial of blood.
  bloodVial: `<rect x="12.5" y="2" width="7" height="5" rx="1" fill="#a1785a"/><path d="M13 7 H19 V11 C23 13 25 17 25 21 A9 9 0 0 1 7 21 C7 17 9 13 13 11 Z" fill="#e8eef2" opacity=".85"/><path d="M7.5 19 H24.5 A8.6 8.6 0 0 1 7.5 19 Z" fill="${RED}"/><path d="M7.5 19 H24.5 C24 21 20 22 16 21 C12 20 9 21 7.5 19 Z" fill="#ff6a4d"/><path d="M10 14 C11 12.5 12 12 13 11.5" stroke="#ffffff" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  // A cracked hourglass in a wooden frame, sand running.
  hourglassShard: `<rect x="5" y="2" width="22" height="4" rx="1.5" fill="${BROWN}"/><rect x="5" y="26" width="22" height="4" rx="1.5" fill="${BROWN}"/><path d="M8 6 H24 C24 12 18 14 16.5 16 C18 18 24 20 24 26 H8 C8 20 14 18 15.5 16 C14 14 8 12 8 6 Z" fill="#cfefff" opacity=".75"/><path d="M11 9 H21 C20 11.5 17 13 16 14 C15 13 12 11.5 11 9 Z M10 25 C11 21 14 20 16 19 C18 20 21 21 22 25 Z" fill="${GOLD}"/><path d="M16 14 V19" stroke="${GOLD}" stroke-width="1.2"/><path d="M20 6 L18 10 L21 12" stroke="#ffffff" stroke-width="1.4" fill="none"/>`,
  // An eye in a hunter's crosshair.
  huntersEye: `<path d="M2 16 C8 7 24 7 30 16 C24 25 8 25 2 16 Z" fill="${CREAM}"/><circle cx="16" cy="16" r="6.5" fill="${GREEN_DARK}"/><circle cx="16" cy="16" r="2.8" fill="#14181f"/><circle cx="18" cy="14" r="1.3" fill="#ffffff"/><path d="M16 1 V6 M16 26 V31 M1 16 H4 M28 16 H31" stroke="${RED}" stroke-width="2.4" stroke-linecap="round"/>`,
  // A smoke bomb with its fuse lit, smoke curling off it.
  smokeBomb: `<circle cx="7" cy="9" r="5" fill="#9aa5b1" opacity=".55"/><circle cx="12" cy="5" r="4" fill="#b8c2cc" opacity=".55"/><circle cx="26" cy="8" r="4.5" fill="#9aa5b1" opacity=".45"/><circle cx="16" cy="20" r="10" fill="#37404c"/><circle cx="12.5" cy="16.5" r="3" fill="#ffffff" opacity=".2"/><rect x="13.5" y="8" width="5" height="3.5" rx="1" fill="#5f6875"/><path d="M16 8 C16 5 19 4 20 2" stroke="#b07a4a" stroke-width="1.6" fill="none"/><circle cx="20.5" cy="2" r="1.8" fill="${ORANGE}"/>`,
  // A tall tower shield.
  towerPlate: `<path d="M6 3 H26 V23 L16 30 L6 23 Z" fill="${STEEL_DARK}"/><path d="M6 3 H26 V23 L16 30 L6 23 Z" fill="none" stroke="${STEEL}" stroke-width="2"/><path d="M16 3 V30" stroke="#5e6b7a" stroke-width="2"/><rect x="6" y="12" width="20" height="4" fill="#5e6b7a"/><g fill="${STEEL}"><circle cx="9" cy="6.5" r="1.3"/><circle cx="23" cy="6.5" r="1.3"/><circle cx="9" cy="20" r="1.3"/><circle cx="23" cy="20" r="1.3"/></g>`,
  // A gold anklet with a little wing charm, on a gust.
  windstepAnklet: `<ellipse cx="16" cy="10" rx="11" ry="5" fill="none" stroke="${GOLD}" stroke-width="2.6"/><path d="M16 15 C13 17 11 20 10 23 C14 22 17 20 18 16 Z" fill="${STEEL}"/><circle cx="16" cy="15" r="1.8" fill="${GOLD_DARK}"/><path d="M3 25 C8 22 12 28 18 25 C22 23 25 24 28 26 M9 30 C13 28 17 31 22 29" stroke="${CYAN}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  // A magnifying glass.
  sagesLens: `<path d="M20 20 L29 29" stroke="#6d4c3a" stroke-width="5" stroke-linecap="round"/><circle cx="13" cy="13" r="10" fill="#8fb8ff" opacity=".45"/><circle cx="13" cy="13" r="10" fill="none" stroke="${GOLD}" stroke-width="3"/><path d="M8 10 C9 7.5 11 6.5 13 6.5" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  // A dark heart with embers glowing through its cracks.
  emberHeart: `<path d="${HEART}" fill="#6e1a12"/><path d="M11 6 L14 12 L11 17 L16 22 M21 6 L19 11 L22 15 L19 19" stroke="${ORANGE}" stroke-width="1.8" fill="none" stroke-linejoin="round"/><circle cx="16" cy="22" r="1.6" fill="#ffd84d"/>`,

  // --- Epic ---
  // A green heart-stone set in a snowy mountain.
  heartOfTheMountain: `<path d="M1 30 L11 9 L16 16 L21 6 L31 30 Z" fill="#7d8796"/><path d="M11 9 L14 15 L12 14 L9 15 Z M21 6 L25 14 L22 12 L19 13 Z" fill="#ffffff"/><path d="M21 6 L31 30 H24 Z" fill="#5f6875"/><path d="M16 29 C12 26 9 24 9 21 C9 19 10.5 18 12 18 C13.5 18 15 19 16 20 C17 19 18.5 18 20 18 C21.5 18 23 19 23 21 C23 24 20 26 16 29 Z" fill="${GREEN}"/><path d="M11.5 20.5 C11.5 19.5 12 19 13 19" stroke="#8ef0b0" stroke-width="1.4" fill="none"/>`,
  // A long fang, dripping.
  vampireFang: `<path d="M9 2 H23 C23 12 20 21 16 28 C12 21 9 12 9 2 Z" fill="${CREAM}"/><path d="M16 2 H23 C23 12 20 21 16 28 Z" fill="#d9cdb0"/><path d="M9 2 H23 V5 H9 Z" fill="#e57373"/><path d="M16 28 C15 30 15.5 31.5 16.5 31.5 C17.5 31.5 18 30 16 28 Z" fill="${RED}"/><path d="M12 9 C12.5 14 13.5 18 15 21" stroke="${RED}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  // A horned war mask with burning eyes.
  berserkersMask: `<path d="M8 12 C3 10 2 5 4 2 C5 6 8 8 11 9 Z M24 12 C29 10 30 5 28 2 C27 6 24 8 21 9 Z" fill="#e8dcc0"/><path d="M7 9 H25 V19 C25 25 21 29 16 30 C11 29 7 25 7 19 Z" fill="${RED_DARK}"/><path d="M7 9 H25 V12 H7 Z" fill="#7a1410"/><path d="M9 15 L15 17 L9 19 Z M23 15 L17 17 L23 19 Z" fill="#ffd84d"/><path d="M11 23 H21 L19 27 H13 Z" fill="#2a0e0c"/><path d="M13 23 V25 M16 23 V26 M19 23 V25" stroke="#e8dcc0" stroke-width="1.2"/>`,
  // A glass prism splitting a beam into colors.
  prismShard: `<path d="M1 18 L11 16" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/><path d="M19 15 L31 9" stroke="${RED}" stroke-width="2.2"/><path d="M19 17 L31 16" stroke="#ffd84d" stroke-width="2.2"/><path d="M19 19 L31 23" stroke="#4f8cff" stroke-width="2.2"/><path d="M15 4 L25 26 H5 Z" fill="#e0f7fa" opacity=".92"/><path d="M15 4 L25 26 H15 Z" fill="#a5e6f5" opacity=".9"/>`,
  // A rune disc with a bolt at its heart.
  stormSigil: `<circle cx="16" cy="16" r="14" fill="#25304d"/><circle cx="16" cy="16" r="14" fill="none" stroke="#8fb8ff" stroke-width="2"/><circle cx="16" cy="16" r="10" fill="none" stroke="#8fb8ff" stroke-width="1" stroke-dasharray="2 3"/><path d="M18 5 L10 17 H15 L13 27 L22 14 H17 Z" fill="#ffd84d"/>`,
  // A hooded cloak, only the eyes showing.
  shadowCloak: `<path d="M16 2 C9 2 6 8 6 14 L3 30 H29 L26 14 C26 8 23 2 16 2 Z" fill="#3a2b52"/><path d="M16 2 C23 2 26 8 26 14 L29 30 H21 C21 22 23 12 16 2 Z" fill="#2b1f3e"/><path d="M10 13 C10 8 22 8 22 13 C22 17 19 19 16 19 C13 19 10 17 10 13 Z" fill="#0f0a18"/><circle cx="13.5" cy="14" r="1.4" fill="${PURPLE_LIGHT}"/><circle cx="18.5" cy="14" r="1.4" fill="${PURPLE_LIGHT}"/>`,
  // A gold pocket watch.
  chronometer: `<path d="M16 0.5 V4" stroke="${GOLD}" stroke-width="2"/><rect x="13.5" y="3.5" width="5" height="3.5" rx="1" fill="${GOLD_DARK}"/><circle cx="16" cy="18.5" r="12.5" fill="${GOLD}"/><circle cx="16" cy="18.5" r="10" fill="${CREAM}"/><g stroke="#8d7a5a" stroke-width="1.4" stroke-linecap="round"><path d="M16 10 V11.5 M16 25.5 V27 M7.5 18.5 H9 M23 18.5 H24.5"/></g><path d="M16 18.5 V12 M16 18.5 L21 21" stroke="#2a2418" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="18.5" r="1.4" fill="${RED}"/>`,

  // --- Legendary ---
  // A feather of fire.
  phoenixFeather: `<path d="M5 31 C5 18 14 7 29 1 C27 14 18 25 5 31 Z" fill="${RED}"/><path d="M7 28 C8 19 15 10 26 4 C24 14 17 22 7 28 Z" fill="${ORANGE}"/><path d="M9 25 C11 19 16 13 23 8 C21 15 16 20 9 25 Z" fill="#ffd84d"/><path d="M4 31 L23 9" stroke="#fff3a6" stroke-width="1.4" stroke-linecap="round"/><circle cx="27" cy="13" r="1.4" fill="${ORANGE}"/><circle cx="24" cy="19" r="1" fill="#ffd84d"/>`,
  // A gold crown set with gems.
  crownOfTheOverrun: `<path d="M3 24 L4.5 9 L11 16 L16 5 L21 16 L27.5 9 L29 24 Z" fill="${GOLD}"/><path d="M16 5 L21 16 L27.5 9 L29 24 H16 Z" fill="${GOLD_DARK}" opacity=".45"/><rect x="3" y="23" width="26" height="6" rx="1" fill="${GOLD_DARK}"/><circle cx="4.5" cy="8" r="2" fill="${GOLD}"/><circle cx="16" cy="4" r="2" fill="${GOLD}"/><circle cx="27.5" cy="8" r="2" fill="${GOLD}"/><circle cx="9" cy="26" r="1.8" fill="${RED}"/><circle cx="16" cy="26" r="2.2" fill="#4f8cff"/><circle cx="23" cy="26" r="1.8" fill="${GREEN}"/>`,
  // A goblet brimming with blood, running over.
  bloodpactChalice: `<path d="M6 4 H26 C26 13 22 18 16 18 C10 18 6 13 6 4 Z" fill="${GOLD_DARK}"/><path d="M6 4 H16 V18 C10 18 6 13 6 4 Z" fill="${GOLD}"/><ellipse cx="16" cy="4.5" rx="10" ry="2.5" fill="${RED_DARK}"/><path d="M24 5 C24.5 8 25 10 24.5 12" stroke="${RED}" stroke-width="2" stroke-linecap="round"/><rect x="14.5" y="18" width="3" height="7" fill="${GOLD_DARK}"/><path d="M8 30 C8 25.5 24 25.5 24 30 Z" fill="${GOLD}"/><circle cx="16" cy="11" r="2" fill="${RED}"/>`,
  // A gold-trimmed gauntlet, a gem set in every knuckle.
  jeweledGauntlet: `<path d="M8 30 V20 C8 17 9 15 11 14 V6 C11 4.5 13.5 4.5 13.5 6 V12 V4 C13.5 2.5 16 2.5 16 4 V12 V4.5 C16 3 18.5 3 18.5 4.5 V12 V6 C18.5 4.5 21 4.5 21 6 V15 L23.5 12 C24.5 10.8 26.5 11.8 25.8 13.4 L22 21 V30 Z" fill="${STEEL_DARK}"/><path d="M8 24 H22 V30 H8 Z" fill="${GOLD_DARK}"/><path d="M8 24 H22 V25.5 H8 Z" fill="${GOLD}"/><path d="M11 14 C13 13 19 13 21 14.5" stroke="${GOLD}" stroke-width="2" fill="none"/><circle cx="12.2" cy="9" r="1.6" fill="${RED}"/><circle cx="14.8" cy="7.5" r="1.6" fill="#4f8cff"/><circle cx="17.3" cy="7.8" r="1.6" fill="${GREEN}"/><circle cx="19.8" cy="9.3" r="1.6" fill="${PURPLE_LIGHT}"/><circle cx="15" cy="19" r="3" fill="${CYAN}"/><circle cx="14.2" cy="18.2" r="1" fill="#ffffff"/><path d="M26 3 L27 5.5 L29.5 6.5 L27 7.5 L26 10 L25 7.5 L22.5 6.5 L25 5.5 Z" fill="#bdf3ff"/>`,
  // A golden dome rising over the ground, sunrise behind it.
  aegisOfDawn: `<g stroke="#ffe082" stroke-width="2" stroke-linecap="round"><path d="M16 1 V4 M5 5 L7 7 M27 5 L25 7 M1 14 H4 M28 14 H31"/></g><path d="M3 25 A13 13 0 0 1 29 25 Z" fill="#ffe082" opacity=".35"/><path d="M3 25 A13 13 0 0 1 29 25" stroke="${GOLD}" stroke-width="2.6" fill="none"/><path d="M8 25 A8 8 0 0 1 24 25" stroke="#fff8e1" stroke-width="1.4" fill="none" opacity=".8"/><path d="M16 12 V25 M9.5 15.5 L16 25 M22.5 15.5 L16 25" stroke="#fff8e1" stroke-width="1" opacity=".6"/><rect x="1" y="25" width="30" height="4" rx="2" fill="${GOLD_DARK}"/><path d="M13 21 L16 18 L19 21 L16 24 Z" fill="#ffffff"/>`,
  // A heart of stone bound in glowing runes.
  titansHeart: `<path d="${HEART}" fill="#7d8796"/><path d="M16 7 C17 5 19 3 22 3 C26 3 30 6 30 11 C30 18 24 23 16 29 Z" fill="#5f6875"/><path d="M4 13 C12 15 20 15 28 13 M7 20 C13 21.5 19 21.5 25 20" stroke="${GOLD}" stroke-width="1.8" fill="none"/><circle cx="16" cy="17" r="3" fill="#ffd84d"/><circle cx="16" cy="17" r="5" fill="#ffd84d" opacity=".25"/>`,
  // A spiraling storm with a calm, bright eye.
  // A dragon's heart: dark red, ember scales, a flame rising from it.
  dragonsheart: `<path d="M16 29 C8.5 23.5 3 19 3 12.5 C3 8 6.5 5 10.5 5 C13 5 15 6.4 16 8.4 C17 6.4 19 5 21.5 5 C25.5 5 29 8 29 12.5 C29 19 23.5 23.5 16 29 Z" fill="#8e1414"/><path d="M16 26 C10.5 21.8 6 18.2 6 12.8 C6 9.8 8.2 8 10.6 8 C12.8 8 14.5 9.3 16 11.5 C17.5 9.3 19.2 8 21.4 8 C23.8 8 26 9.8 26 12.8 C26 18.2 21.5 21.8 16 26 Z" fill="#c62828"/><path d="M10 13 Q12 11 14 13 M18 13 Q20 11 22 13 M12 18 Q14 16 16 18 Q18 16 20 18" stroke="#3b0606" stroke-width="1.6" fill="none"/><path d="M16 22 C13.5 19.5 13.8 16.5 16 14 C15.6 16 17.5 16.8 17.6 18.6 C18.6 17.8 18.8 16.8 18.6 15.6 C20.2 17.6 19.8 20.6 16 22 Z" fill="#ffab40"/><path d="M16 21 C15 19.8 15.2 18.4 16 17.4 C16.4 18.4 17 18.8 16.9 19.8 Z" fill="#fff3e0"/>`,
  eyeOfTheStorm: `<g fill="none" stroke-linecap="round"><path d="M16 2 A14 14 0 0 1 30 16" stroke="${CYAN}" stroke-width="3"/><path d="M30 16 A14 14 0 0 1 16 30" stroke="#8fb8ff" stroke-width="3"/><path d="M16 30 A14 14 0 0 1 2 16" stroke="${CYAN}" stroke-width="3"/><path d="M2 16 A14 14 0 0 1 16 2" stroke="#8fb8ff" stroke-width="3"/><path d="M16 7 A9 9 0 0 1 25 16 M16 25 A9 9 0 0 1 7 16" stroke="#bdf3ff" stroke-width="2.2"/></g><circle cx="16" cy="16" r="4.5" fill="#ffffff"/><circle cx="16" cy="16" r="2" fill="${CYAN}"/>`,
};

/** An artifact's own art as an <svg>, or null if it has none yet. */
export function artifactSvg(id: ArtifactId, size: number): string | null {
  const art = ARTIFACT_ART[id];
  return art ? `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">${art}</svg>` : null;
}
