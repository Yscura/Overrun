// Background music: each map has one or more themes (a run picks one at random) and a boss theme that takes over when
// the boss fight starts (someone walks into the arena). Songs are shorter than a run, so after
// the first play-through each one jumps from `loopOut` back to `loopIn` and keeps going for as long as it's needed.
// The song's own ending is never reached; the music fades out when the run ends.

import type { MapDef } from '../shared/maps';
import type { Sound } from './audio';
import woodsTheme from '../../sfx/Emerald Woods/emerald_woods.mp3?url';
import woodsBoss from '../../sfx/Emerald Woods/emerald_woods_boss.mp3?url';
import ruinsTheme from '../../sfx/Desecrated Ruins/desecrated_ruins.mp3?url';
import ruinsBoss from '../../sfx/Desecrated Ruins/desecrated_ruins_boss.mp3?url';
import frozenTheme from '../../sfx/Frozen Fortress/frozen_fortress.mp3?url';
import frozenBoss from '../../sfx/Frozen Fortress/frozen_fortress_boss.mp3?url';
import canyonTheme from '../../sfx/Sunscar Canyon/sunscar_canyon.mp3?url';
import canyonBoss from '../../sfx/Sunscar Canyon/sunscar_canyon_boss.mp3?url';
import calderaTheme from '../../sfx/Ashen Caldera/ashen_caldera.mp3?url';
import calderaBoss from '../../sfx/Ashen Caldera/ashen_caldera_boss.mp3?url';

interface Track {
  url: string;
  /** Seconds into the song where a run starts it (0 if left out). */
  start?: number;
  /** Seconds into the song: where each repeat jumps out of, and where it comes back in. */
  loopOut: number;
  loopIn: number;
  /** How long the handover lasts. */
  crossfade: number;
  /**
   * The loop points are exact (a song written to loop, rendered at a steady tempo): the repeat starts at full volume
   * right on the beat, and only the old copy's reverb tail fades out under it. Otherwise both fade (equal power).
   */
  seamless?: boolean;
  /** Loudness relative to the other tracks. */
  gain: number;
}

interface MapMusic {
  /** A run picks one of these at random. */
  themes: Track[];
  /** Plays from the moment the boss fight starts. */
  boss?: Track;
}

/**
 * Songs written to loop (sfx/midi, from scripts/compose_midi.py): a theme loops from bar 9 to its last bar (88), a boss
 * theme from bar 5 to its last bar (84). Their loop points come straight from the tempo, plus the mp3 encoder's delay
 * (the renders start 1105 samples late). `gain` evens out how loud the renders came out (measured: themes all play at
 * about -20 dBFS, boss themes 2.5 dB louder).
 */
const ENCODER_DELAY = 1105 / 44100;

function composed(url: string, bpm: number, boss: boolean, gain: number): Track {
  const bar = (4 * 60) / bpm;
  const at = (bars: number) => bars * bar + ENCODER_DELAY;
  return boss
    ? { url, start: ENCODER_DELAY, loopIn: at(4), loopOut: at(84), crossfade: 0.05, seamless: true, gain }
    : { url, start: ENCODER_DELAY, loopIn: at(8), loopOut: at(88), crossfade: 0.05, seamless: true, gain };
}

/**
 * Which map plays what (by the map's `art`). A song made elsewhere works too: give it its own loop points (where the
 * beat and loudness match) and leave `seamless` off, so both sides crossfade. For example, Where Starlight Touches
 * Ground once ran as { start: 60, loopOut: 155.95, loopIn: 66.22, crossfade: 4, gain: 0.75 }.
 */
const MAP_MUSIC: Partial<Record<MapDef['art'], MapMusic>> = {
  forest: {
    themes: [composed(woodsTheme, 120, false, 1.23)],
    boss: composed(woodsBoss, 150, true, 1.19),
  },
  ruins: { themes: [composed(ruinsTheme, 140, false, 1.62)], boss: composed(ruinsBoss, 160, true, 1.15) },
  frost: { themes: [composed(frozenTheme, 150, false, 1.22)], boss: composed(frozenBoss, 170, true, 1.35) },
  canyon: { themes: [composed(canyonTheme, 130, false, 1.14)], boss: composed(canyonBoss, 150, true, 1.1) },
  caldera: {
    themes: [composed(calderaTheme, 135, false, 1.18)],
    boss: composed(calderaBoss, 165, true, 1.16),
  },
};

/** Fade in at the start of a run, and out when it ends or you leave. The boss theme comes in faster. */
const FADE_IN = 2.5;
const BOSS_FADE_IN = 1.2;
const FADE_OUT = 2.5;
/** Paused: the music drops to this share of its volume. */
const PAUSED_LEVEL = 0.35;

interface Playing {
  track: Track;
  /** The whole track's volume (fades in and out, and dips while paused). */
  out: GainNode;
  /** Every scheduled piece of the song, so they can all be stopped. */
  sources: AudioBufferSourceNode[];
  timer: number;
}

export class Music {
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private current: Playing | null = null;
  /** The track we're asked to play, even if it's still loading. */
  private wanted: Track | null = null;
  private paused = false;
  /** This run's theme (picked when the run starts), and the map it was picked for. */
  private theme: { map: MapDef; track: Track } | null = null;

  constructor(private readonly sound: Sound) {}

  /**
   * What should be playing: `map` during a run (null otherwise), `boss` once the boss phase has started. Call it with
   * every snapshot; it only changes the music when the answer changes.
   */
  update(map: MapDef | null, boss: boolean): void {
    const music = map ? MAP_MUSIC[map.art] : undefined;
    if (!map || !music) {
      this.theme = null;
      void this.play(null);
      return;
    }
    if (this.theme?.map !== map) {
      this.theme = { map, track: music.themes[Math.floor(Math.random() * music.themes.length)] };
      // Get the boss theme ready now, so it can come in on time.
      const ctx = this.sound.context;
      if (ctx && music.boss) void this.load(ctx, music.boss.url);
    }
    void this.play(boss && music.boss ? music.boss : this.theme.track);
  }

  /** Dip the music while the game is paused. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    const ctx = this.sound.context;
    if (!ctx || !this.current) return;
    const g = this.current.out.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(this.current.track.gain * (paused ? PAUSED_LEVEL : 1), ctx.currentTime + 0.6);
  }

  /** Switch to this track (null: silence), fading out whatever was playing. */
  private async play(track: Track | null): Promise<void> {
    if (track === this.wanted) return;
    const fromTheme = this.wanted !== null;
    this.wanted = track;
    this.stop();
    if (!track) return;
    const ctx = this.sound.context;
    const bus = this.sound.musicBus;
    if (!ctx || !bus) {
      // Audio isn't unlocked yet (no click so far): try again on the next call.
      this.wanted = null;
      return;
    }
    const buffer = await this.load(ctx, track.url);
    if (!buffer || this.wanted !== track || this.current) return;
    const out = ctx.createGain();
    out.connect(bus);
    const now = ctx.currentTime + 0.05;
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(track.gain * (this.paused ? PAUSED_LEVEL : 1), now + (fromTheme ? BOSS_FADE_IN : FADE_IN));
    this.current = { track, out, sources: [], timer: 0 };
    this.schedule(ctx, buffer, now, track.start ?? 0, false);
  }

  /** Fade out whatever is playing. */
  private stop(): void {
    const playing = this.current;
    this.current = null;
    const ctx = this.sound.context;
    if (!playing || !ctx) return;
    clearTimeout(playing.timer);
    const g = playing.out.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(0, ctx.currentTime + FADE_OUT);
    for (const s of playing.sources) {
      try {
        s.stop(ctx.currentTime + FADE_OUT + 0.1);
      } catch {
        // Already stopped.
      }
    }
  }

  private load(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    let buffer = this.buffers.get(url);
    if (!buffer) {
      buffer = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => null);
      this.buffers.set(url, buffer);
    }
    return buffer;
  }

  /**
   * One piece of the song: from `offset` until `loopOut`, after which the next piece (from `loopIn`) takes over.
   * `fadeIn`: this piece is the one taking over.
   */
  private schedule(ctx: AudioContext, buffer: AudioBuffer, at: number, offset: number, fadeIn: boolean): void {
    const playing = this.current;
    if (!playing) return;
    const { track } = playing;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    source.connect(gain).connect(playing.out);
    const handover = at + (track.loopOut - offset);
    const steps = 64;
    const rise = new Float32Array(steps);
    const fall = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const x = i / (steps - 1);
      rise[i] = Math.sin((x * Math.PI) / 2);
      fall[i] = Math.cos((x * Math.PI) / 2);
    }
    if (fadeIn && !track.seamless) gain.gain.setValueCurveAtTime(rise, at, track.crossfade);
    else gain.gain.setValueAtTime(1, at);
    gain.gain.setValueCurveAtTime(fall, handover, track.crossfade);
    source.start(at, offset);
    source.stop(handover + track.crossfade + 0.05);
    playing.sources.push(source);
    source.onended = () => {
      const i = playing.sources.indexOf(source);
      if (i >= 0) playing.sources.splice(i, 1);
    };
    // Line up the next piece a few seconds before it's due (timers are imprecise; the audio clock isn't).
    const wait = Math.max(0, (handover - ctx.currentTime - 5) * 1000);
    playing.timer = window.setTimeout(() => {
      if (this.current === playing) this.schedule(ctx, buffer, handover, track.loopIn, true);
    }, wait);
  }
}
