// Decides which sounds a snapshot calls for: your own actions, what happens around you, and big moments.

import { HAZARD_STRIDE, HazardKind, type Snapshot } from '../shared/protocol';
import type { Sound } from './audio';

export class SoundCues {
  /** Hazards we've already warned about. */
  private seenHazards = new Set<number>();

  constructor(private readonly sound: Sound) {}

  onSnapshot(prev: Snapshot | null, snap: Snapshot, me: { x: number; y: number }): void {
    const { sound } = this;
    const near = (x: number, y: number) => [{ x, y }, me] as const;

    // Your own actions and feedback.
    if (snap.me) {
      for (const id of snap.me.sounds) sound.play(id);
      const hits = snap.me.hits;
      if (hits.length > 0) {
        let crit = false;
        for (let i = 3; i < hits.length; i += 4) if (hits[i]) crit = true;
        sound.play(crit ? 'crit' : 'hit');
      }
      const taken = snap.me.taken;
      if (taken.some((amount) => amount > 0)) sound.play('hurt');
      else if (taken.length > 0) sound.play('evade');
    }

    // Things happening in the world, quieter the farther away they are.
    for (const fx of snap.fx) {
      switch (fx.k) {
        case 'banner':
          sound.play(fx.tone === 'danger' ? 'warning' : 'chime');
          break;
        case 'ring':
          if (fx.snd) sound.play(fx.snd, ...near(fx.x, fx.y));
          break;
        case 'slash':
          sound.play('slash', ...near(fx.x, fx.y));
          break;
        case 'zap':
          sound.play('zap', ...near(fx.x, fx.y));
          break;
        case 'boom':
          sound.play('boom', ...near(fx.x, fx.y));
          break;
      }
    }

    // A warning tone when a charge lane or bomb circle appears near you.
    const current = new Set<number>();
    for (let i = 0; i < snap.hazards.length; i += HAZARD_STRIDE) {
      const id = snap.hazards[i];
      current.add(id);
      if (this.seenHazards.has(id)) continue;
      const [x, y] = [snap.hazards[i + 2], snap.hazards[i + 3]];
      sound.play(snap.hazards[i + 1] === HazardKind.Line ? 'chargeWarn' : 'bombWarn', ...near(x, y));
    }
    this.seenHazards = current;

    // Big moments.
    if (snap.pause && !prev?.pause) sound.play('levelup');
    if (prev?.pause && !snap.pause && snap.phase === 'playing') sound.play('resume');
    if (snap.result && prev && !prev.result) sound.play(snap.result.victory ? 'victory' : 'defeat');
  }
}
