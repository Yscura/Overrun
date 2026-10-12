import type { CharacterId } from '../shared/characters';

// Simple vector emblems, drawn in the player's color. Replace with real art whenever you like.

const dagger = '<path d="M32 6 L37 33 L27 33 Z"/><rect x="22" y="33" width="20" height="4" rx="1"/><rect x="30" y="37" width="4" height="13"/><circle cx="32" cy="53" r="3"/>';

const EMBLEMS: Record<CharacterId, string> = {
  assassin: `<g transform="rotate(-32 32 32)">${dagger}</g><g transform="rotate(32 32 32)">${dagger}</g>`,
  mage:
    '<g transform="rotate(18 32 32)"><rect x="30" y="20" width="4" height="38" rx="1.5"/><circle cx="32" cy="15" r="9"/>' +
    '<circle cx="29.5" cy="12.5" r="3" fill="#fff" opacity=".55" stroke="none"/></g>' +
    '<circle cx="48" cy="12" r="2"/><circle cx="14" cy="22" r="1.6"/><circle cx="51" cy="31" r="1.4"/>',
  bruiser:
    '<rect x="29.5" y="8" width="5" height="50" rx="2"/>' +
    '<path d="M34.5 12 C50 10 57 22 54 36 C48 31 41 30 34.5 31 Z"/><path d="M29.5 12 C14 10 7 22 10 36 C16 31 23 30 29.5 31 Z"/>',
  tank:
    '<path d="M32 6 L53 13 L51 35 C49 46 41 53 32 58 C23 53 15 46 13 35 L11 13 Z"/>' +
    '<path d="M32 13 V51 M19 27 H45" fill="none" stroke="#0b0c10" stroke-width="3" opacity=".45"/>',
  pyro: '<path d="M32 6 C40 18 50 26 46 42 C44 52 38 58 32 58 C26 58 20 52 18 42 C16 32 24 28 26 18 C30 24 30 30 34 32 C36 24 34 14 32 6 Z"/>',
  ranger: '<path d="M16 8 Q46 32 16 56 L21 56 Q51 32 21 8 Z"/><rect x="12" y="30.5" width="38" height="3" rx="1"/><path d="M55 32 L45 26 L45 38 Z"/>',
  druid:
    '<path d="M32 6 C50 16 54 40 32 58 C10 40 14 16 32 6 Z"/>' +
    '<path d="M32 14 V54 M32 30 L22 22 M32 40 L42 32" fill="none" stroke="#0b0c10" stroke-width="2.5" opacity=".45"/>',
  chronobreaker:
    '<path d="M16 8 H48 V12 L34 32 L48 52 V56 H16 V52 L30 32 L16 12 Z"/><path d="M24 52 L32 42 L40 52 Z" fill="#fff" opacity=".4" stroke="none"/>',
};

/** An SVG portrait for a character. Safe for innerHTML: it contains no user input. */
export function portraitSvg(character: CharacterId, color: number): string {
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  return (
    `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="10" fill="#0f1115"/>` +
    `<circle cx="32" cy="32" r="27" fill="${hex}" opacity=".16"/>` +
    `<g fill="${hex}" stroke="#0b0c10" stroke-width="1.5" stroke-linejoin="round">${EMBLEMS[character]}</g></svg>`
  );
}
