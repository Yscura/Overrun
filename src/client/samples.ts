// Recorded sound effects (sfx/effects) and which game sounds use them. Every file is cut to start right on the sound,
// cleaned of sub-bass rumble and made exactly as loud as the others, so `volume` here is purely the mix. A sound with
// several files picks one at random each time. Sounds not listed here (or until their files have loaded) are
// synthesized: see RECIPES in audio.ts. With `layer`, the synthesized version plays on top of the recording.

import type { SoundName } from './audio';
import acid from '../../sfx/effects/acid.wav?url';
import deep1 from '../../sfx/effects/deep1.wav?url';
import deep2 from '../../sfx/effects/deep2.wav?url';
import deep3 from '../../sfx/effects/deep3.wav?url';
import deep4 from '../../sfx/effects/deep4.wav?url';
import deep5 from '../../sfx/effects/deep5.wav?url';
import deep6 from '../../sfx/effects/deep6.wav?url';
import deepdown from '../../sfx/effects/deepdown.wav?url';
import dwarf1 from '../../sfx/effects/dwarf1.wav?url';
import dwarf2 from '../../sfx/effects/dwarf2.wav?url';
import dwarf3 from '../../sfx/effects/dwarf3.wav?url';
import female1 from '../../sfx/effects/female1.wav?url';
import female2 from '../../sfx/effects/female2.wav?url';
import femaledown from '../../sfx/effects/femaledown.wav?url';
import howl1 from '../../sfx/effects/howl1.wav?url';
import howl2 from '../../sfx/effects/howl2.wav?url';
import male1 from '../../sfx/effects/male1.wav?url';
import male2 from '../../sfx/effects/male2.wav?url';
import male3 from '../../sfx/effects/male3.wav?url';
import male4 from '../../sfx/effects/male4.wav?url';
import male5 from '../../sfx/effects/male5.wav?url';
import male6 from '../../sfx/effects/male6.wav?url';
import maledown from '../../sfx/effects/maledown.wav?url';
import bear from '../../sfx/effects/bear.wav?url';
import bigdeath from '../../sfx/effects/bigdeath.wav?url';
import bigslam from '../../sfx/effects/bigslam.wav?url';
import blades from '../../sfx/effects/blades.wav?url';
import boom from '../../sfx/effects/boom.wav?url';
import bossintro from '../../sfx/effects/bossintro.wav?url';
import brace from '../../sfx/effects/brace.wav?url';
import clock from '../../sfx/effects/clock.wav?url';
import crit1 from '../../sfx/effects/crit1.wav?url';
import crit2 from '../../sfx/effects/crit2.wav?url';
import death from '../../sfx/effects/death.wav?url';
import demon1 from '../../sfx/effects/demon1.wav?url';
import demon2 from '../../sfx/effects/demon2.wav?url';
import demon3 from '../../sfx/effects/demon3.wav?url';
import demon4 from '../../sfx/effects/demon4.wav?url';
import demon5 from '../../sfx/effects/demon5.wav?url';
import dodge from '../../sfx/effects/dodge.wav?url';
import evade1 from '../../sfx/effects/evade1.wav?url';
import evade2 from '../../sfx/effects/evade2.wav?url';
import explode from '../../sfx/effects/explode.wav?url';
import fireball from '../../sfx/effects/fireball.wav?url';
import flame from '../../sfx/effects/flame.wav?url';
import flask from '../../sfx/effects/flask.wav?url';
import gate from '../../sfx/effects/gate.wav?url';
import growl1 from '../../sfx/effects/growl1.wav?url';
import growl2 from '../../sfx/effects/growl2.wav?url';
import hammer from '../../sfx/effects/hammer.wav?url';
import heavyslash from '../../sfx/effects/heavyslash.wav?url';
import hiss1 from '../../sfx/effects/hiss1.wav?url';
import hiss2 from '../../sfx/effects/hiss2.wav?url';
import hiss3 from '../../sfx/effects/hiss3.wav?url';
import hiss4 from '../../sfx/effects/hiss4.wav?url';
import hit1 from '../../sfx/effects/hit1.wav?url';
import laugh1 from '../../sfx/effects/laugh1.wav?url';
import laugh2 from '../../sfx/effects/laugh2.wav?url';
import hit2 from '../../sfx/effects/hit2.wav?url';
import hit3 from '../../sfx/effects/hit3.wav?url';
import roar from '../../sfx/effects/roar.wav?url';
import slam1 from '../../sfx/effects/slam1.wav?url';
import slam2 from '../../sfx/effects/slam2.wav?url';
import slam3 from '../../sfx/effects/slam3.wav?url';
import slash from '../../sfx/effects/slash.wav?url';
import stab from '../../sfx/effects/stab.wav?url';
import ult from '../../sfx/effects/ult.wav?url';
import warlord1 from '../../sfx/effects/warlord1.wav?url';
import whisper from '../../sfx/effects/whisper.wav?url';
import warlord2 from '../../sfx/effects/warlord2.wav?url';

export interface Sample {
  files: string[];
  volume: number;
  /** Playback speed, which also shifts the pitch (1: as recorded). */
  rate?: number;
  /** Also play the synthesized recipe on top (to add something the recording lacks). */
  layer?: true;
  /** Overlap limits, as for recipes (they default to the recipe's). */
  max?: number;
  gap?: number;
}

export const SAMPLES: Partial<Record<SoundName, Sample>> = {
  // --- Your weapons and abilities ---
  fireball: { files: [fireball], volume: 0.13 },
  flask: { files: [flask], volume: 0.14, max: 2, gap: 0.08 },
  hammer: { files: [hammer], volume: 0.21, max: 2, gap: 0.06 },
  meteor: { files: [flame], volume: 0.37, rate: 0.85 },
  nova: { files: [flame], volume: 0.31, rate: 1.1 },
  acid: { files: [acid], volume: 0.31, max: 1 },
  leap: { files: [heavyslash], volume: 0.24, rate: 0.9 },
  ult: { files: [ult], volume: 0.36, max: 1 },
  // Weapons made from the other recordings, sped up: lighter, sharper versions of the same sounds.
  // Shadow Daggers: a steel stab. Shadow Strike's hits: the same stab, heavier and louder.
  dagger: { files: [stab], volume: 0.2, max: 3, gap: 0.04 },
  stab: { files: [stab], volume: 0.4, rate: 0.85, max: 2, gap: 0.05 },
  knives: { files: [evade1, evade2], volume: 0.2, rate: 1.25 },
  arrow: { files: [evade2], volume: 0.2, rate: 1.15, max: 3, gap: 0.03 },
  shuriken: { files: [heavyslash], volume: 0.14, rate: 1.5 },
  bite: { files: [hit1, hit3], volume: 0.095, rate: 1.35, max: 2, gap: 0.08 },
  // Time bomb: the clock's tick, small and quick.
  mine: { files: [clock], volume: 0.19, rate: 1.8 },
  // Call of the Wild: the pack howls.
  howl: { files: [howl1, howl2], volume: 0.3, max: 1 },
  // Berserker's Mask: a beastly roar, pitched up.
  roar: { files: [roar], volume: 0.27, rate: 1.3, max: 1 },
  // The Spirit Bear: its roar when it appears, a growl when you send it after something.
  bear: { files: [bear], volume: 0.4, max: 1 },
  growl: { files: [growl1, growl2], volume: 0.24, max: 1, gap: 0.3 },
  brace: { files: [brace], volume: 0.34, max: 1 },
  clock: { files: [clock], volume: 0.61, max: 1 },

  // --- World (heard by everyone nearby) ---
  slam: { files: [slam1, slam2, slam3], volume: 0.35, max: 3 },
  bigSlam: { files: [bigslam], volume: 0.45, max: 2, gap: 0.1 },
  explode: { files: [explode], volume: 0.37, max: 3, gap: 0.06 },
  boom: { files: [boom], volume: 0.35, max: 3, gap: 0.08 },
  slash: { files: [slash], volume: 0.13, max: 3, gap: 0.05 },
  heavySlash: { files: [heavyslash], volume: 0.21, max: 2, gap: 0.08 },
  death: { files: [death, bigdeath], volume: 0.1, max: 4, gap: 0.03 },
  gate: { files: [gate], volume: 0.6, max: 1 },
  // Shadow Veil: blades bursting out of the shadows.
  blades: { files: [blades], volume: 0.4, max: 2 },

  // --- Feedback for you ---
  hit: { files: [hit1, hit2, hit3], volume: 0.09, max: 2, gap: 0.06 },
  crit: { files: [crit1, crit2], volume: 0.18, max: 2, gap: 0.07 },
  // A blow to the body: the heavy impacts, pitched down.
  hurt: { files: [bigdeath, hit3], volume: 0.38, rate: 0.8, max: 1, gap: 0.25 },
  evade: { files: [evade1, evade2], volume: 0.3, max: 1, gap: 0.1 },
  dodge: { files: [dodge], volume: 0.31 },
  bossIntro: { files: [bossintro], volume: 0.51, max: 1 },

  // --- Voices (each hero has one: see `voice` in src/shared/characters.ts) ---
  // Hurt: you cry out when a hit takes a real bite out of you (see soundCues.ts). Down: anyone going down.
  hurtMale: { files: [male1, male2, male3, male4, male5, male6], volume: 0.3, max: 1, gap: 1.6 },
  hurtDeep: { files: [deep1, deep2, deep3, deep4, deep5, deep6], volume: 0.3, max: 1, gap: 1.6 },
  hurtFemale: { files: [female1, female2], volume: 0.3, max: 1, gap: 1.6 },
  hurtDwarf: { files: [dwarf1, dwarf2, dwarf3], volume: 0.3, max: 1, gap: 1.6 },
  downMale: { files: [maledown], volume: 0.4, max: 2 },
  downDeep: { files: [deepdown], volume: 0.4, max: 2 },
  downFemale: { files: [femaledown], volume: 0.4, max: 2 },
  downDwarf: { files: [dwarf2], volume: 0.4, rate: 0.85, max: 2 },
  // Loud on purpose: a warlord arriving should never go unnoticed.
  warlord: { files: [warlord1, warlord2], volume: 0.8, max: 1 },
  // A final boss: the warlords' roars, deeper (it's bigger). On its entrance, when it's enraged, and going berserk.
  bossRoar: { files: [warlord1, warlord2], volume: 0.75, rate: 0.8, max: 1 },
  // Bosses' voices through the fight: Grimm whispers and Rime laughs (heard the same everywhere), Sylvara hisses.
  whisper: { files: [whisper], volume: 0.5, max: 1 },
  laugh: { files: [laugh1, laugh2], volume: 0.5, max: 1, gap: 2 },
  // The twin demons of the caldera growl (both use the same voice; never two at once).
  demon: { files: [demon1, demon2, demon3, demon4, demon5], volume: 0.5, max: 1, gap: 2 },
  hiss: { files: [hiss1, hiss2, hiss3, hiss4], volume: 0.45, max: 1 },
};
