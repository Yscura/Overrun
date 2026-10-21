// Decides which sounds a snapshot calls for: your own actions, what happens around you, and big moments.

import { DRAGON_INTRO } from '../shared/constants';
import { HAZARD_STRIDE, HazardKind, type Snapshot } from '../shared/protocol';
import { CHARACTERS } from '../shared/characters';
import { EnemyType } from '../shared/enemies';
import { DAMAGE_TYPES } from '../shared/upgrades';
import { setLuteNote, voiceSound, type Sound } from './audio';

/** Bosses with an entrance cry of their own (also when they're enraged or go berserk), instead of the usual roar. */
const BOSS_CRY: Partial<Record<number, 'kharzakSpawn' | 'rimeSpawn' | 'sylvaraSpawn'>> = {
  [EnemyType.Kharzak]: 'kharzakSpawn',
  [EnemyType.Rime]: 'rimeSpawn',
  [EnemyType.Sylvara]: 'sylvaraSpawn',
};

/** You cry out when the damage you take in one go is at least this share of your max HP. */
const CRY_AT = 0.05;

export class SoundCues {
  /** Hazards we've already warned about. */
  private seenHazards = new Set<number>();
  /** Revive progress at the last chime, per downed player. */
  private reviveChimes = new Map<number, number>();

  /** Big roars (a warlord arriving, Mordak) dip the music for this many seconds, so they cut through. */
  onDuck: (seconds: number) => void = () => {};

  constructor(private readonly sound: Sound) {}

  onSnapshot(prev: Snapshot | null, snap: Snapshot, me: { x: number; y: number }, myId: number | null): void {
    const { sound } = this;
    const near = (x: number, y: number) => [{ x, y }, me] as const;

    // Your own actions and feedback.
    if (snap.me) {
      // The Bard's Lute Notes: pluck the note of his song the server just played.
      setLuteNote(snap.me.lute);
      for (const id of snap.me.sounds) sound.play(id);
      const hits = snap.me.hits;
      if (hits.length > 0) {
        // A crit's sound follows its damage type (hits are [x, y, amount, crit, type]): a blade for physical, a
        // crack for magic and true damage. A physical crit wins if there are both.
        let physical = false;
        let other = false;
        for (let i = 3; i < hits.length; i += 5) {
          if (!hits[i]) continue;
          if (DAMAGE_TYPES[hits[i + 1]] === 'physical') physical = true;
          else other = true;
        }
        sound.play(physical ? 'crit' : other ? 'magicCrit' : 'hit');
      }
      const taken = snap.me.taken;
      if (taken.some((amount) => amount > 0)) {
        sound.play('hurt');
        const self = snap.players.find((p) => p.id === myId);
        const total = taken.reduce((sum, amount) => sum + Math.max(0, amount), 0);
        if (self && !self.downed && total >= CRY_AT * self.maxHp) sound.play(voiceSound('hurt', CHARACTERS[self.character].voice));
      } else if (taken.length > 0) sound.play('evade');
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
          if (fx.snd !== 'none') sound.play(fx.snd ?? (fx.heavy ? 'heavySlash' : 'slash'), ...near(fx.x, fx.y));
          break;
        case 'zap':
          sound.play('zap', ...near(fx.x, fx.y));
          break;
        case 'boom':
          sound.play('boom', ...near(fx.x, fx.y));
          break;
        case 'intro':
          if (fx.dragon) {
            // Mordak: a swell builds as the camera creeps over to him, and ends in his roar.
            sound.play('reveal');
            setTimeout(() => {
              sound.play('mordakRoar');
              this.onDuck(4);
            }, DRAGON_INTRO.roarAt * 1000);
            break;
          }
          sound.play('bossIntro');
          // Kharzak, the Reaper, the Frost Queen and Sylvara have entrances of their own; the rest roar.
          sound.play(fx.boss === EnemyType.Reaper ? 'reaperStart' : (BOSS_CRY[fx.boss ?? -1] ?? 'bossRoar'));
          break;
        case 'lob':
          sound.play('fireball', ...near(fx.x, fx.y));
          break;
        case 'roar':
          // Some bosses cry out in their own voices (their entrance sound); the rest roar.
          sound.play(BOSS_CRY[fx.boss ?? -1] ?? 'bossRoar');
          break;
        case 'shatter':
          sound.play('shatter');
          sound.play('explode');
          break;
        case 'quake':
          sound.play('rumble');
          break;
        case 'sfx':
          sound.play(fx.snd, ...near(fx.x, fx.y));
          break;
        case 'voice':
          // The whisper, the laugh and the demons' growls fill the arena; the hiss comes from the serpent.
          if (fx.snd !== 'hiss') sound.play(fx.snd);
          else sound.play(fx.snd, ...near(fx.x, fx.y));
          break;
        case 'ping':
          sound.play('ping');
          break;
        case 'chat':
          sound.play('message');
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

    // Reviving: a chime each time the bar fills another step, rising in pitch; a chord when they're back up.
    for (const p of snap.players) {
      const before = prev?.players.find((o) => o.id === p.id);
      if (p.downed) {
        if (before && !before.downed) sound.play(voiceSound('down', CHARACTERS[p.character].voice), ...near(p.x, p.y));
        const last = this.reviveChimes.get(p.id) ?? 0;
        if (p.revive < last - 0.05) this.reviveChimes.set(p.id, p.revive); // The bar is draining: start over.
        else if (p.revive - last >= 0.08) {
          this.reviveChimes.set(p.id, p.revive);
          sound.play('revive', ...near(p.x, p.y), 1 + p.revive * 1.5);
        }
      } else {
        if (before?.downed && snap.phase === 'playing') sound.play('revived', ...near(p.x, p.y));
        this.reviveChimes.delete(p.id);
      }
    }

    // Big moments.
    if (snap.warlord && prev && snap.warlord.count > (prev.warlord?.count ?? 0)) {
      sound.play('warlord');
      this.onDuck(3);
    }
    // The arena gate swings open for the boss, and slams shut behind the last one in.
    if (snap.arena && prev?.arena && snap.arena.open !== prev.arena.open) sound.play('gate');
    // The Frost Queen's secret door grinds open, and her tower's gate slams shut.
    if (prev && snap.tower?.stage === 'maze' && prev.tower?.stage !== 'maze') sound.play('gate');
    if (prev && !!snap.tower?.shut !== !!prev.tower?.shut) sound.play('gate');
    if (snap.pause?.kind === 'choose' && !prev?.pause) sound.play('levelup');
    // PvP: your team levels up (the pick waits for you without pausing).
    const team = snap.players.find((p) => p.id === myId)?.team ?? -1;
    if (snap.pvp && prev?.pvp && team >= 0 && snap.pvp.teams[team].level > prev.pvp.teams[team].level) sound.play('levelup');
    if (prev?.pause && !snap.pause && snap.phase === 'playing') sound.play('resume');
    if (snap.result && prev && !prev.result) sound.play(snap.result.victory ? 'victory' : 'defeat');
  }
}
