// What the group has achieved, saved next to the server so it survives restarts:
// which maps are unlocked, and everyone's prestige (by player name).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Profile } from './profiles';

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/progress.json');

export interface Progress {
  /** Number of maps unlocked (at least 1). */
  unlocked: number;
  /** Prestige by lowercased player name. */
  profiles: Record<string, Profile>;
}

export function loadProgress(): Progress {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      unlocked: Math.max(1, Number(data.unlocked) || 1),
      profiles: data.profiles && typeof data.profiles === 'object' ? data.profiles : {},
    };
  } catch {
    return { unlocked: 1, profiles: {} };
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
