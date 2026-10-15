// Ways to play. Each room on the server runs one mode. A new mode is a new entry here (plus whatever Game options
// it needs); the main menu lists them.

import { MAX_PLAYERS } from './constants';

export type ModeId = 'single' | 'multi';

export interface ModeDef {
  name: string;
  /** One line for the main menu. */
  description: string;
  /** How many people can be in a room of this mode (bots fill the rest of the team). */
  maxHumans: number;
  /** Listed in the multiplayer lobby browser, and joinable with the room's code. */
  joinable: boolean;
}

export const MODES: Record<ModeId, ModeDef> = {
  single: {
    name: 'Singleplayer',
    description: 'Play on your own, with bot teammates if you like.',
    maxHumans: 1,
    joinable: false,
  },
  multi: {
    name: 'Multiplayer',
    description: 'Create a lobby for your friends, or join one.',
    maxHumans: MAX_PLAYERS,
    joinable: true,
  },
};

export const MODE_IDS = Object.keys(MODES) as ModeId[];

export function isModeId(id: unknown): id is ModeId {
  return typeof id === 'string' && id in MODES;
}
