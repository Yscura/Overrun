// Everyone's progress, saved next to the server so it survives restarts: each account's prestige, gold, artifacts and
// unlocked maps (by player name).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Profile } from './profiles';

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/progress.json');

/**
 * Which map list `unlocked` counts in. Version 2 added the Emerald Woods before the Verdant Ruins and the Sunscar
 * Canyon before the Ashen Caldera; older saves move over without losing a map (indexed by the old count).
 */
const MAPS_VERSION = 2;
const FROM_V1 = [1, 2, 3, 5];

export interface Progress {
  mapsVersion: number;
  /** Prestige by lowercased player name. */
  profiles: Record<string, Profile>;
}

export function loadProgress(): Progress {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const profiles: Record<string, Profile> = data.profiles && typeof data.profiles === 'object' ? data.profiles : {};
    // Unlocks used to be shared by the whole server: everyone already here keeps what the server had.
    if (data.unlocked !== undefined) {
      let unlocked = Math.max(1, Number(data.unlocked) || 1);
      if ((Number(data.mapsVersion) || 1) < 2) unlocked = FROM_V1[Math.min(unlocked, 3)];
      const hard = Math.max(0, Number(data.hardUnlocked) || 0);
      for (const profile of Object.values(profiles)) {
        profile.maps = Math.max(profile.maps ?? 1, unlocked);
        profile.hardMaps = Math.max(profile.hardMaps ?? 0, hard);
      }
    }
    return { mapsVersion: MAPS_VERSION, profiles };
  } catch {
    return { mapsVersion: MAPS_VERSION, profiles: {} };
  }
}

export function saveProgress(progress: Progress): void {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(progress, null, 2));
  } catch (err) {
    console.error('Could not save progress:', err);
  }
}
