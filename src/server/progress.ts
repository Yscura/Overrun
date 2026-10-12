// Which maps the group has unlocked, saved next to the server so it survives restarts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/progress.json');

/** Number of maps unlocked (at least 1). */
export function loadUnlocked(): number {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Math.max(1, Number(data.unlocked) || 1);
  } catch {
    return 1;
  }
}

export function saveUnlocked(unlocked: number): void {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ unlocked }, null, 2));
  } catch (err) {
    console.error('Could not save progress:', err);
  }
}
