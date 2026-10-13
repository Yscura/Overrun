// Sound effects, synthesized on the fly with the Web Audio API: no audio files needed.
// Each sound is a small recipe of oscillators ("tones") and filtered white noise with volume and pitch sweeps.

import type { SoundId } from '../shared/protocol';

export type SoundName =
  | SoundId
  | 'slam'
  | 'explode'
  | 'pop'
  | 'slash'
  | 'zap'
  | 'boom'
  | 'death'
  | 'hit'
  | 'crit'
  | 'hurt'
  | 'evade'
  | 'dodge'
  | 'levelup'
  | 'warning'
  | 'chime'
  | 'victory'
  | 'defeat'
  | 'chargeWarn'
  | 'bombWarn'
  | 'resume';

const VOLUME_KEY = 'overrun.volume';
const MUTED_KEY = 'overrun.muted';
/** Positional sounds fade out completely at this distance from you. */
const HEARING_RANGE = 1000;
/** ...and pan fully left or right this far to the side. */
const PAN_RANGE = 700;

interface ToneOptions {
  type?: OscillatorType;
  /** Start and end frequency in Hz (exponential sweep). */
  from: number;
  to?: number;
  duration: number;
  volume: number;
  /** Seconds after the start of the sound. */
  delay?: number;
  attack?: number;
  /** Low-pass cutoff in Hz: muffles the tone for a darker, heavier sound. */
  lowpass?: number;
}

interface NoiseOptions {
  filter: BiquadFilterType;
  /** Filter frequency sweep in Hz. */
  from: number;
  to?: number;
  duration: number;
  volume: number;
  q?: number;
  delay?: number;
}

/** The "instrument" a recipe plays on: start time, pitch variation and where to send the sound. */
interface Voice {
  tone(o: ToneOptions): void;
  noise(o: NoiseOptions): void;
}

/**
 * How each sound is made. `max` voices may overlap and they're at least `gap` seconds apart.
 * The palette is deliberately dark: low pitches, filtered sawtooths, thuds and rumbles, minor keys.
 */
const RECIPES: Record<SoundName, { play: (v: Voice) => void; max?: number; gap?: number }> = {
  // --- Your weapons and abilities ---
  bolt: {
    play: (v) => {
      v.tone({ type: 'sawtooth', from: 420, to: 160, duration: 0.14, volume: 0.1, lowpass: 1200 });
      v.noise({ filter: 'lowpass', from: 900, to: 300, duration: 0.08, volume: 0.06 });
    },
  },
  knives: { play: (v) => v.noise({ filter: 'bandpass', from: 2400, to: 1100, duration: 0.07, volume: 0.13, q: 1.2 }) },
  hex: {
    play: (v) => {
      v.tone({ type: 'sawtooth', from: 180, to: 95, duration: 0.2, volume: 0.09, lowpass: 700 });
      v.tone({ type: 'sine', from: 95, to: 70, duration: 0.2, volume: 0.07 });
    },
  },
  shuriken: {
    play: (v) => {
      v.noise({ filter: 'bandpass', from: 700, to: 2200, duration: 0.32, volume: 0.16, q: 3 });
      v.tone({ type: 'sawtooth', from: 140, to: 260, duration: 0.25, volume: 0.05, lowpass: 900 });
    },
  },
  mine: { play: (v) => v.tone({ type: 'square', from: 120, to: 90, duration: 0.06, volume: 0.07, lowpass: 600 }) },
  meteor: {
    play: (v) => {
      v.noise({ filter: 'lowpass', from: 150, to: 1100, duration: 0.6, volume: 0.2 });
      v.tone({ type: 'sawtooth', from: 55, to: 40, duration: 0.6, volume: 0.1, lowpass: 300, attack: 0.15 });
    },
  },
  leap: { play: (v) => v.noise({ filter: 'lowpass', from: 300, to: 900, duration: 0.18, volume: 0.15 }) },
  warcry: {
    play: (v) => {
      v.tone({ type: 'sawtooth', from: 98, to: 73, duration: 0.55, volume: 0.16, attack: 0.04, lowpass: 650 });
      v.tone({ type: 'sawtooth', from: 147, to: 110, duration: 0.55, volume: 0.08, attack: 0.04, lowpass: 650 });
      v.noise({ filter: 'bandpass', from: 450, to: 220, duration: 0.45, volume: 0.1 });
    },
  },
  ult: {
    // A low A minor swell with a sub-bass underneath.
    play: (v) => {
      for (const f of [110, 131, 165]) v.tone({ type: 'sawtooth', from: f, duration: 1.1, volume: 0.07, attack: 0.12, lowpass: 900 });
      v.tone({ type: 'sine', from: 55, duration: 1.1, volume: 0.14, attack: 0.08 });
      v.noise({ filter: 'lowpass', from: 200, to: 1200, duration: 0.9, volume: 0.07 });
    },
  },
  dagger: { play: (v) => v.noise({ filter: 'bandpass', from: 3000, to: 1400, duration: 0.05, volume: 0.1, q: 2 }), max: 3, gap: 0.04 },
  fireball: {
    play: (v) => {
      v.noise({ filter: 'lowpass', from: 300, to: 1200, duration: 0.2, volume: 0.11 });
      v.tone({ type: 'sawtooth', from: 110, to: 70, duration: 0.2, volume: 0.06, lowpass: 600 });
    },
  },
  arrow: {
    play: (v) => {
      v.noise({ filter: 'bandpass', from: 1800, to: 900, duration: 0.06, volume: 0.08, q: 1.5 });
      v.tone({ type: 'triangle', from: 300, to: 190, duration: 0.05, volume: 0.04 });
    },
    max: 3,
    gap: 0.03,
  },
  bite: {
    play: (v) => {
      v.noise({ filter: 'lowpass', from: 900, to: 200, duration: 0.07, volume: 0.09 });
      v.tone({ type: 'square', from: 140, to: 90, duration: 0.05, volume: 0.04, lowpass: 500 });
    },
    max: 2,
    gap: 0.08,
  },
  veil: {
    play: (v) => {
      v.tone({ type: 'sine', from: 220, to: 110, duration: 0.5, volume: 0.08, attack: 0.1 });
      v.noise({ filter: 'bandpass', from: 600, to: 200, duration: 0.4, volume: 0.06 });
    },
  },
  nova: {
    play: (v) => {
      v.noise({ filter: 'lowpass', from: 200, to: 1500, duration: 0.4, volume: 0.2 });
      v.tone({ type: 'sine', from: 80, to: 40, duration: 0.4, volume: 0.2 });
    },
  },
  summon: {
    play: (v) => {
      v.tone({ type: 'triangle', from: 98, to: 147, duration: 0.5, volume: 0.09, attack: 0.08, lowpass: 800 });
      v.noise({ filter: 'lowpass', from: 150, to: 500, duration: 0.4, volume: 0.08 });
    },
  },
  rewind: {
    // A tape spun backwards: falling sweeps.
    play: (v) => {
      v.tone({ type: 'sawtooth', from: 440, to: 110, duration: 0.6, volume: 0.07, lowpass: 1500 });
      v.tone({ type: 'sine', from: 880, to: 220, duration: 0.5, volume: 0.04 });
    },
  },
  gem: { play: (v) => v.tone({ type: 'sine', from: 520, to: 560, duration: 0.05, volume: 0.03 }), max: 3, gap: 0.035 },
  // Two quick, muted metallic clinks.
  coin: {
    play: (v) => {
      v.tone({ type: 'triangle', from: 988, duration: 0.07, volume: 0.05, lowpass: 2500 });
      v.tone({ type: 'triangle', from: 1319, duration: 0.09, volume: 0.04, lowpass: 2500, delay: 0.05 });
    },
    max: 2,
    gap: 0.06,
  },
  heal: {
    play: (v) => {
      v.tone({ type: 'sine', from: 220, duration: 0.35, volume: 0.09, attack: 0.04 });
      v.tone({ type: 'sine', from: 330, duration: 0.35, volume: 0.07, attack: 0.04, delay: 0.08 });
    },
  },

  // --- World (heard by everyone nearby) ---
  slam: {
    play: (v) => {
      v.noise({ filter: 'lowpass', from: 700, to: 80, duration: 0.35, volume: 0.28 });
      v.tone({ type: 'sine', from: 90, to: 35, duration: 0.32, volume: 0.32 });
    },
    max: 3,
  },
  explode: {
    play: (v) => {
      v.noise({ filter: 'lowpass', from: 1100, to: 60, duration: 0.6, volume: 0.32 });
      v.tone({ type: 'sine', from: 70, to: 28, duration: 0.55, volume: 0.32 });
    },
    max: 3,
    gap: 0.06,
  },
  pop: { play: (v) => v.noise({ filter: 'lowpass', from: 900, to: 250, duration: 0.09, volume: 0.12 }), max: 3, gap: 0.05 },
  slash: { play: (v) => v.noise({ filter: 'bandpass', from: 1800, to: 500, duration: 0.14, volume: 0.17, q: 1.2 }), max: 3 },
  zap: {
    play: (v) => {
      v.noise({ filter: 'bandpass', from: 2200, to: 700, duration: 0.18, volume: 0.13, q: 0.8 });
      v.tone({ type: 'sawtooth', from: 420, to: 60, duration: 0.18, volume: 0.07, lowpass: 1500 });
    },
    max: 3,
  },
  boom: {
    play: (v) => {
      v.noise({ filter: 'lowpass', from: 800, to: 50, duration: 0.55, volume: 0.28 });
      v.tone({ type: 'sine', from: 60, to: 25, duration: 0.5, volume: 0.28 });
    },
    max: 3,
    gap: 0.08,
  },
  // A dull, wet thud rather than a bleep.
  death: { play: (v) => v.noise({ filter: 'lowpass', from: 500, to: 120, duration: 0.07, volume: 0.09 }), max: 5, gap: 0.025 },
  chargeWarn: { play: (v) => v.tone({ type: 'sawtooth', from: 70, to: 160, duration: 0.55, volume: 0.09, attack: 0.15, lowpass: 500 }), max: 2 },
  bombWarn: { play: (v) => v.tone({ type: 'sine', from: 600, to: 280, duration: 0.5, volume: 0.03 }), max: 2, gap: 0.2 },

  // --- Feedback for you ---
  hit: { play: (v) => v.tone({ type: 'triangle', from: 170, to: 130, duration: 0.035, volume: 0.05 }), max: 2, gap: 0.04 },
  crit: {
    // A heavier, metallic crack.
    play: (v) => {
      v.tone({ type: 'square', from: 520, to: 240, duration: 0.09, volume: 0.07, lowpass: 1800 });
      v.noise({ filter: 'bandpass', from: 1600, to: 600, duration: 0.07, volume: 0.07, q: 3 });
    },
    max: 2,
    gap: 0.06,
  },
  hurt: {
    play: (v) => {
      v.tone({ type: 'sawtooth', from: 130, to: 65, duration: 0.15, volume: 0.15, lowpass: 700 });
      v.noise({ filter: 'lowpass', from: 700, to: 150, duration: 0.12, volume: 0.12 });
    },
    max: 1,
    gap: 0.12,
  },
  evade: { play: (v) => v.noise({ filter: 'bandpass', from: 1200, to: 2600, duration: 0.11, volume: 0.1, q: 2 }), max: 1, gap: 0.1 },
  dodge: { play: (v) => v.noise({ filter: 'bandpass', from: 400, to: 1400, duration: 0.18, volume: 0.13, q: 1 }) },
  levelup: {
    // A slow, rising A minor phrase.
    play: (v) => {
      for (const [i, f] of [220, 262, 330, 440].entries()) {
        v.tone({ type: 'triangle', from: f, duration: 0.3, volume: 0.1, delay: i * 0.11, lowpass: 1400 });
      }
      v.tone({ type: 'sine', from: 55, duration: 0.6, volume: 0.1, delay: 0.33 });
    },
  },
  warning: {
    // A low war horn.
    play: (v) => {
      v.tone({ type: 'sawtooth', from: 98, duration: 0.4, volume: 0.12, attack: 0.05, lowpass: 500 });
      v.tone({ type: 'sawtooth', from: 92, duration: 0.55, volume: 0.12, attack: 0.05, lowpass: 500, delay: 0.42 });
    },
  },
  chime: {
    // A low bell: a fifth that rings out.
    play: (v) => {
      v.tone({ type: 'sine', from: 196, duration: 0.8, volume: 0.1 });
      v.tone({ type: 'sine', from: 294, duration: 0.8, volume: 0.07, delay: 0.06 });
      v.tone({ type: 'triangle', from: 392, duration: 0.4, volume: 0.03, delay: 0.06 });
    },
  },
  victory: {
    // From A minor to a broad A major, with a sub-bass swell.
    play: (v) => {
      for (const [i, f] of [220, 262, 330].entries()) v.tone({ type: 'sawtooth', from: f, duration: 0.6, volume: 0.06, delay: i * 0.15, lowpass: 1200 });
      for (const f of [220, 277, 330, 440]) v.tone({ type: 'sawtooth', from: f, duration: 1.4, volume: 0.06, delay: 0.6, attack: 0.1, lowpass: 1500 });
      v.tone({ type: 'sine', from: 55, duration: 1.8, volume: 0.15, delay: 0.6, attack: 0.1 });
    },
  },
  defeat: {
    play: (v) => {
      for (const [i, f] of [220, 196, 175, 147].entries()) v.tone({ type: 'sawtooth', from: f, duration: 0.5, volume: 0.09, delay: i * 0.25, lowpass: 800 });
      v.tone({ type: 'sine', from: 73, to: 49, duration: 1.4, volume: 0.13, delay: 0.75 });
    },
  },
  resume: {
    // Back into the fight: a rising rush that lands on a deep drum hit.
    play: (v) => {
      v.noise({ filter: 'lowpass', from: 120, to: 1600, duration: 0.5, volume: 0.14 });
      v.tone({ type: 'sawtooth', from: 55, to: 110, duration: 0.5, volume: 0.06, lowpass: 400, attack: 0.2 });
      v.tone({ type: 'sine', from: 75, to: 32, duration: 0.45, volume: 0.32, delay: 0.45 });
      v.noise({ filter: 'lowpass', from: 600, to: 80, duration: 0.3, volume: 0.2, delay: 0.45 });
    },
  },
};

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not important if this fails.
  }
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  /** End times of playing voices, per sound, to cap overlaps. */
  private playing = new Map<SoundName, number[]>();
  private lastStart = new Map<SoundName, number>();
  private volume: number;
  private muted: boolean;

  constructor() {
    const saved = Number(load(VOLUME_KEY));
    this.volume = Number.isFinite(saved) && load(VOLUME_KEY) !== null ? Math.min(1, Math.max(0, saved)) : 0.6;
    this.muted = load(MUTED_KEY) === '1';
    // Browsers only allow audio after the player has interacted with the page.
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  getVolume(): number {
    return this.volume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    save(VOLUME_KEY, String(this.volume));
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    save(MUTED_KEY, muted ? '1' : '0');
    this.applyVolume();
  }

  /**
   * Plays a sound. With `at` and `listener`, it gets quieter with distance and pans left/right;
   * without, it plays at full volume in the middle (your own actions).
   */
  play(name: SoundName, at?: { x: number; y: number }, listener?: { x: number; y: number }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted || this.volume === 0 || ctx.state !== 'running') return;
    const recipe = RECIPES[name];

    let gain = 1;
    let pan = 0;
    if (at && listener) {
      const dx = at.x - listener.x;
      const d = Math.hypot(dx, at.y - listener.y);
      if (d >= HEARING_RANGE) return;
      gain = (1 - d / HEARING_RANGE) ** 1.5;
      pan = Math.max(-1, Math.min(1, dx / PAN_RANGE));
    }

    // Limit how many copies overlap and how fast they can repeat, so a horde doesn't turn into noise.
    const now = ctx.currentTime;
    const voices = (this.playing.get(name) ?? []).filter((end) => end > now);
    if (voices.length >= (recipe.max ?? 4)) return;
    if (now - (this.lastStart.get(name) ?? -1) < (recipe.gap ?? 0.03)) return;

    const out = ctx.createGain();
    out.gain.value = gain;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner).connect(this.master);

    // A little random pitch so repeated sounds don't sound identical.
    const pitch = 0.94 + Math.random() * 0.12;
    let end = now;
    const voice: Voice = {
      tone: (o) => {
        const start = now + (o.delay ?? 0);
        const stop = start + o.duration;
        const osc = ctx.createOscillator();
        osc.type = o.type ?? 'sine';
        osc.frequency.setValueAtTime(o.from * pitch, start);
        if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to * pitch, stop);
        const env = this.envelope(ctx, start, stop, o.volume, o.attack);
        if (o.lowpass) {
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = o.lowpass;
          osc.connect(filter).connect(env).connect(out);
        } else {
          osc.connect(env).connect(out);
        }
        osc.start(start);
        osc.stop(stop + 0.02);
        end = Math.max(end, stop);
      },
      noise: (o) => {
        const start = now + (o.delay ?? 0);
        const stop = start + o.duration;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = o.filter;
        filter.Q.value = o.q ?? 0.8;
        filter.frequency.setValueAtTime(o.from * pitch, start);
        if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to * pitch, stop);
        const env = this.envelope(ctx, start, stop, o.volume);
        src.connect(filter).connect(env).connect(out);
        src.start(start, Math.random()); // Random offset into the noise for variety.
        src.stop(stop + 0.02);
        end = Math.max(end, stop);
      },
    };
    recipe.play(voice);

    voices.push(end);
    this.playing.set(name, voices);
    this.lastStart.set(name, now);
  }

  /** Quick fade in, then a smooth exponential fade out by `stop`. */
  private envelope(ctx: AudioContext, start: number, stop: number, volume: number, attack = 0.005): GainNode {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(volume, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, stop);
    return env;
  }

  private unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      // A compressor on the master bus keeps big moments from clipping.
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 6;
      compressor.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.connect(compressor);
      // One second of white noise, reused by every noisy sound.
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.applyVolume();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private applyVolume(): void {
    // Squared, so the slider feels even to the ear.
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * this.volume;
  }
}
