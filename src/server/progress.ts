// What the group has achieved, saved next to the server so it survives restarts:
// which maps are unlocked, and everyone's prestige (by player name).

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
  /** Number of maps unlocked (at least 1). */
  unlocked: number;
  /** Number of maps unlocked on hard mode (0 until Mordak is slain). */
  hardUnlocked: number;
  mapsVersion: number;
  /** Prestige by lowercased player name. */
  profiles: Record<string, Profile>;
}

export function loadProgress(): Progress {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    let unlocked = Math.max(1, Number(data.unlocked) || 1);
    if ((Number(data.mapsVersion) || 1) < 2) unlocked = FROM_V1[Math.min(unlocked, 3)];
    return {
      unlocked,
      hardUnlocked: Math.max(0, Number(data.hardUnlocked) || 0),
      mapsVersion: MAPS_VERSION,
      profiles: data.profiles && typeof data.profiles === 'object' ? data.profiles : {},
    };
  } catch {
    return { unlocked: 1, hardUnlocked: 0, mapsVersion: MAPS_VERSION, profiles: {} };
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
