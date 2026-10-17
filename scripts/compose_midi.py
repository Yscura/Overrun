"""
Composes the music as General MIDI files (sfx/midi/*.mid): a theme for every map and a boss theme for every map, for
rendering in a DAW (or any MIDI player with a good soundfont) and exporting as mp3 for the game.

    python scripts/compose_midi.py

Map themes are built the same way, so they loop cleanly: an 8-bar intro, then A (16 bars), B (16), a calm break (8),
A again (16), B again (16) and an 8-bar climax whose last bar leads straight back into A: loop from bar 9 to the end.
Boss themes are faster and heavier: a 4-bar intro, A (the map theme's tune, in battle dress), B (the boss's own
tune), a choir-chant bridge, A, B and a climax: loop from bar 5 to the end. The files have "loop start" and
"loop end" markers. The tempo never changes, so the loop points in seconds are exact: printed when you run this.

A choir ("oohs") sings a slow line through the chords of every song, quietly in A, fuller in B, out front in the
breaks.

Chords and melodies are written out per section below; the accompaniment (pads, bass, ostinatos, arpeggios, drums)
is generated from the chords. No dependencies: the MIDI bytes are written by hand.
"""

import os
import random
import struct

PPQ = 480
OUT = os.path.join(os.path.dirname(__file__), '..', 'sfx', 'midi')

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def pitch(name):
    """'D4' -> 62 (middle C is C4 = 60)."""
    i = 2 if len(name) > 2 and name[1] in '#b' else 1
    return NOTE[name[:i]] + 12 * (int(name[i:]) + 1)


# Chord qualities as semitones above the root.
QUALITY = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'dim': [0, 3, 6], 'sus4': [0, 5, 7],
           '5': [0, 7]}


def chord(name):
    """'Ebm' -> (root pitch class, intervals)."""
    i = 2 if len(name) > 1 and name[1] in '#b' else 1
    return NOTE[name[:i]], QUALITY[name[i:]]


class Track:
    def __init__(self, name, channel, program, volume=100, pan=64, reverb=40):
        self.name, self.channel, self.program = name, channel, program
        self.volume, self.pan, self.reverb = volume, pan, reverb
        self.notes = []  # (start beat, length in beats, pitch, velocity)

    def add(self, start, length, p, vel):
        self.notes.append((start, length, p, max(1, min(127, int(vel)))))

    def line(self, start, text, vel=90, legato=0.92):
        """Plays 'D5:1.5 C5:0.5 r:1 A4+C5:2 ...' from `start` (beats). '!' after a length accents the note."""
        t = start
        for token in text.split():
            notes, length = token.split(':')
            accent = length.endswith('!')
            length = float(length.rstrip('!'))
            if notes != 'r':
                for n in notes.split('+'):
                    self.add(t, length * legato, pitch(n), vel + (14 if accent else 0) + random.randint(-6, 6))
            t += length
        return t


class Song:
    def __init__(self, title, bpm, file):
        self.title, self.bpm, self.file = title, bpm, file
        self.tracks = []
        self.bar = 0  # Where the next section goes, in bars.
        self.sections = []  # (name, first bar, bars, chords: one per bar)
        self.loop_bar = 8  # The loop goes back to the start of this bar (0-based).

    def track(self, *args, **kwargs):
        t = Track(*args, **kwargs)
        self.tracks.append(t)
        return t

    def beats(self, bar):
        return bar * 4

    def seconds(self, bar):
        return bar * 4 * 60 / self.bpm

    # --- Writing the file ---

    def save(self):
        def vlq(n):
            out = [n & 0x7F]
            n >>= 7
            while n:
                out.insert(0, (n & 0x7F) | 0x80)
                n >>= 7
            return bytes(out)

        def chunk(events):
            events.sort(key=lambda e: (e[0], e[1]))
            data, last = b'', 0
            for tick, _, body in events:
                data += vlq(tick - last) + body
                last = tick
            data += b'\x00\xff\x2f\x00'
            return b'MTrk' + struct.pack('>I', len(data)) + data

        def meta(kind, text):
            raw = text.encode('ascii', 'replace')
            return bytes([0xFF, kind]) + vlq(len(raw)) + raw

        tick = lambda beats: int(round(beats * PPQ))
        end = self.beats(self.bar)
        conductor = [
            (0, 0, meta(0x03, self.title)),
            (0, 1, bytes([0xFF, 0x51, 0x03]) + int(60_000_000 / self.bpm).to_bytes(3, 'big')),
            (0, 2, bytes([0xFF, 0x58, 0x04, 4, 2, 24, 8])),
            (tick(self.beats(self.loop_bar)), 3, meta(0x06, 'loop start')),
            (tick(end), 3, meta(0x06, 'loop end')),
        ]
        for name, first, _, _ in self.sections:
            conductor.append((tick(self.beats(first)), 4, meta(0x06, name)))
        chunks = [chunk(conductor)]
        for t in self.tracks:
            ch = t.channel
            events = [(0, 0, meta(0x03, t.name)),
                      (0, 1, bytes([0xB0 | ch, 7, t.volume])),
                      (0, 1, bytes([0xB0 | ch, 10, t.pan])),
                      (0, 1, bytes([0xB0 | ch, 91, t.reverb]))]
            if ch != 9:
                events.append((0, 2, bytes([0xC0 | ch, t.program])))
            for start, length, p, vel in t.notes:
                if start >= end:
                    continue
                stop = min(start + length, end)
                # Note-offs sort before note-ons at the same tick, so repeated notes retrigger cleanly.
                events.append((tick(stop), 3, bytes([0x80 | ch, p, 0])))
                events.append((tick(start), 4, bytes([0x90 | ch, p, vel])))
            events.append((tick(end), 5, bytes([0xB0 | ch, 123, 0])))  # All notes off at the end.
            chunks.append(chunk(events))
        header = b'MThd' + struct.pack('>IHHH', 6, 1, len(chunks), PPQ)
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, self.file), 'wb') as f:
            f.write(header + b''.join(chunks))
        loop_in, loop_out = self.seconds(self.loop_bar), self.seconds(self.bar)
        notes = sum(len(t.notes) for t in self.tracks)
        print(f'{self.file}: {self.title}, {self.bpm} BPM, {self.bar} bars, {loop_out:.2f}s, {len(self.tracks)} tracks, '
              f'{notes} notes. Loop {loop_in:.3f}s -> {loop_out:.3f}s')


# --- Accompaniment, generated from the chords (one chord per bar) ---

def voicing(root, ivs, low, high):
    """Chord tones between two pitches, the root's octave chosen to sit in the range."""
    out = []
    for octave in range(0, 10):
        for iv in ivs:
            p = root + iv + 12 * octave
            if low <= p <= high:
                out.append(p)
    return sorted(out)


def pad(track, start, chords, low, high, vel, length=4):
    for i, c in enumerate(chords):
        root, ivs = chord(c)
        for p in voicing(root, ivs, low, high):
            track.add(start + 4 * i, length * 0.98, p, vel + random.randint(-4, 4))


def bass(track, start, chords, rhythm, octave_low, vel):
    """Roots on the given rhythm (beats), e.g. [1.5, 0.5, 2]."""
    for i, c in enumerate(chords):
        root, _ = chord(c)
        p = root + 12 * (octave_low + 1)
        t = start + 4 * i
        for j, length in enumerate(rhythm):
            track.add(t, length * 0.9, p, vel + (10 if j == 0 else 0) + random.randint(-4, 4))
            t += length


def ostinato(track, start, chords, offsets, octave, vel, step=0.5, major_offsets=None):
    """A repeating figure (semitones above each chord's root), `step` beats per note."""
    for i, c in enumerate(chords):
        root, ivs = chord(c)
        figure = major_offsets if (major_offsets and 4 in ivs) else offsets
        base = root + 12 * (octave + 1)
        for k in range(int(4 / step)):
            off = figure[k % len(figure)]
            track.add(start + 4 * i + k * step, step * 0.8, base + off, vel + (12 if k % 4 == 0 else 0) + random.randint(-5, 5))


def arpeggio(track, start, chords, low, high, vel, step=0.5, pattern=(0, 1, 2, 3, 2, 1)):
    for i, c in enumerate(chords):
        root, ivs = chord(c)
        notes = voicing(root, ivs, low, high)
        for k in range(int(4 / step)):
            p = notes[pattern[k % len(pattern)] % len(notes)]
            track.add(start + 4 * i + k * step, step * 1.6, p, vel + (8 if k % 4 == 0 else 0) + random.randint(-5, 5))


def drums(track, start, bars, pattern, vel=100):
    """`pattern`: {drum note: 16-step string}, 'x' a hit, 'X' an accent, 'o' a soft hit, '.' a rest."""
    for b in range(bars):
        for note, steps in pattern.items():
            for k, s in enumerate(steps):
                if s == '.':
                    continue
                v = vel + {'x': 0, 'X': 18, 'o': -30}[s] + random.randint(-6, 6)
                track.add(start + 4 * b + k * 0.25, 0.2, note, v)


def fill(track, start, note, vel=95):
    """A one-bar build: 16ths, getting louder."""
    for k in range(16):
        track.add(start + k * 0.25, 0.2, note, vel - 30 + k * 3)


def hits(track, start, chords, low, high, vel, beats=(0,)):
    """Short stabs of the chord on the given beats of each bar."""
    for i, c in enumerate(chords):
        root, ivs = chord(c)
        for b in beats:
            for p in voicing(root, ivs, low, high):
                track.add(start + 4 * i + b, 0.6, p, vel + random.randint(-4, 4))


# GM drum notes.
KICK, SNARE, CLAP, HAT, OPEN_HAT, CRASH, RIDE, TOM_LO, TOM_MID, TOM_HI, FLOOR_TOM = 36, 38, 39, 42, 46, 49, 51, 45, 47, 50, 41
TAMB, SHAKER, CONGA_HI, CONGA_LO, BONGO_HI, BONGO_LO, TIMBALE = 54, 70, 63, 64, 60, 61, 65


def section(song, name, bars, chords):
    assert len(chords) == bars, (name, len(chords), bars)
    song.sections.append((name, song.bar, bars, chords))
    start = song.beats(song.bar)
    song.bar += bars
    return start


# --- The maps' main tunes (their themes' A sections, and their boss themes' too) ---

RUINS_A = ['Dm', 'Eb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A']
RUINS_TUNE = ('D5:1.5 C5:0.5 A4:1 F4:1 G4:1.5 F4:0.5 Eb4:2 E4:1 G4:1 C5:1.5 Bb4:0.5 A4:4 '
              'D5:1.5 E5:0.5 F5:1 E5:0.5 D5:0.5 D5:1.5 C5:0.5 Bb4:1 F4:1 G4:1 A4:0.5 Bb4:0.5 C5:1 E4:1 E4:2 C#5:2')
FROZEN_A = ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B']
FROZEN_TUNE = ('B4:1 E5:1 G5:1.5 F#5:0.5 E5:1.5 D5:0.5 C5:2 D5:1 B4:1 G4:1 B4:1 A4:3 F#4:1 '
               'G4:1 B4:1 E5:1.5 F#5:0.5 G5:1.5 F#5:0.5 E5:1 C5:1 E5:1 D5:1 C5:1 B4:0.5 A4:0.5 B4:2 D#5:2')
CANYON_A = ['D', 'Eb', 'D', 'Eb', 'Gm', 'Cm', 'Eb', 'D']
CANYON_TUNE = ('D5:1 Eb5:0.5 F#5:0.5 G5:1 F#5:1 Eb5:1.5 D5:0.5 C5:1 Bb4:1 A4:0.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:2 '
               'G4:1 Bb4:1 Eb5:2 D5:1 G5:1 F#5:0.5 G5:0.5 A5:1 G5:1.5 Eb5:0.5 C5:2 '
               'Bb4:1 C5:0.5 Bb4:0.5 G4:1 Eb4:1 D4:2 F#4:1 A4:1')


# ======================================================================================================================
# Desecrated Ruins: dark, tribal, relentless. D minor with a Phrygian Eb, 140 BPM.
# ======================================================================================================================

def ruins():
    random.seed(11)
    s = Song('Desecrated Ruins', 140, 'desecrated_ruins.mid')
    flute = s.track('Flute (lead)', 0, 77, volume=96, pan=70, reverb=60)       # Shakuhachi
    horns = s.track('Horns', 1, 60, volume=100, pan=58)                         # French horn
    choir = s.track('Choir', 2, 52, volume=88, reverb=80)                       # Choir aahs
    cello = s.track('Cello ostinato', 3, 42, volume=96, pan=50)                 # Cello
    strings = s.track('Strings', 4, 48, volume=78, reverb=60)                   # String ensemble
    low = s.track('Contrabass', 5, 43, volume=100)                              # Contrabass
    taiko = s.track('Taiko', 6, 116, volume=110)                                # Taiko drum
    timp = s.track('Timpani', 7, 47, volume=96)                                 # Timpani
    kit = s.track('Drums', 9, 0, volume=104)

    A = RUINS_A
    B = ['Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Dm', 'Dm']
    BREAK = ['Dm', 'Dm', 'Eb', 'Eb', 'Dm', 'Dm', 'C', 'A']
    INTRO = ['Dm', 'Dm', 'Dm', 'Dm', 'Eb', 'C', 'Dm', 'A']
    CLIMAX = ['Dm', 'Eb', 'C', 'Dm', 'Bb', 'C', 'A', 'A']
    melody_a = RUINS_TUNE
    melody_b = ('F4:1! Bb4:1 D5:2 E5:1! D5:0.5 C5:0.5 G4:2 A4:1 D5:1 F5:1.5 E5:0.5 D5:4 '
                'G4:1! Bb4:1 D5:1 G5:1 F5:1 E5:1 C#5:2 D5:1.5 E5:0.5 F5:1 A5:1 D5:4')
    melody_break = 'A4:3 G4:1 F4:4 G4:2 Bb4:2 A4:4 D5:3 C5:1 A4:4 G4:2 E4:2 E4:2 r:2'

    tribal = {KICK: 'X..x..x.X...x...', FLOOR_TOM: '....x.......x..x', TOM_LO: '..x.....x.x.....', HAT: 'o.o.o.o.o.o.o.o.'}
    tribal_big = {KICK: 'X..x..x.X..x.xx.', FLOOR_TOM: '....X.......X..x', TOM_LO: '..x.x...x.x.x...',
                  SNARE: '....x.......x...', HAT: 'x.o.x.o.x.o.x.o.'}
    sparse = {FLOOR_TOM: 'x.......x.......', TOM_LO: '..........o.....'}
    ostinato_minor = [0, 0, 3, 0, 1, 0, -2, 0]
    ostinato_major = [0, 0, 4, 0, 7, 0, 4, 0]

    def taiko_beat(start, bars, busy):
        for b in range(bars):
            t = start + 4 * b
            taiko.add(t, 0.5, 36, 112)
            taiko.add(t + 2, 0.5, 36, 100)
            if busy:
                taiko.add(t + 1.5, 0.5, 38, 84)
                taiko.add(t + 3.5, 0.25, 38, 80)
                taiko.add(t + 3.75, 0.25, 38, 90)

    # Intro: taiko and choir, the cello creeps in.
    t = section(s, 'Intro', 8, INTRO)
    taiko_beat(t, 8, busy=False)
    pad(choir, t, INTRO, 50, 67, 62)
    pad(strings, t + 16, INTRO[4:], 45, 62, 56)
    ostinato(cello, t + 16, INTRO[4:], ostinato_minor, 2, 78, major_offsets=ostinato_major)
    bass(low, t, INTRO, [4], 1, 76)
    fill(kit, t + 28, FLOOR_TOM)
    timp.add(t + 28, 4, pitch('A2'), 70)

    def a_section(t, second):
        for half in (0, 1):
            h = t + 32 * half
            ostinato(cello, h, A, ostinato_minor, 2, 84, major_offsets=ostinato_major)
            pad(strings, h, A, 50, 69, 64)
            bass(low, h, A, [1.5, 0.5, 2], 1, 90)
            drums(kit, h, 8, tribal if half == 0 and not second else tribal_big)
            taiko_beat(h, 8, busy=half == 1 or second)
            flute.line(h, melody_a, vel=92 if half == 0 else 100)
            if half == 1 or second:
                # The horns double the tune an octave down the second time round.
                horns.line(h, ' '.join(_down(tok) for tok in melody_a.split()), vel=74)
            if second:
                pad(choir, h, A, 55, 72, 66)
        timp.add(t, 1, pitch('D2'), 110)
        crash(kit, t)

    def b_section(t, second):
        for half in (0, 1):
            h = t + 32 * half
            pad(strings, h, B, 52, 72, 74)
            pad(choir, h, B, 55, 76, 70 if half == 0 else 82)
            bass(low, h, B, [1, 1, 1, 0.5, 0.5], 1, 94)
            ostinato(cello, h, B, ostinato_minor, 2, 80, major_offsets=ostinato_major)
            drums(kit, h, 8, tribal_big)
            taiko_beat(h, 8, busy=True)
            horns.line(h, melody_b, vel=96 if half == 0 else 108)
            if second or half == 1:
                flute.line(h, ' '.join(_up(tok) for tok in melody_b.split()), vel=78)
            hits(timp, h, B, 38, 50, 96, beats=(0, 2))
        crash(kit, t)
        fill(kit, t + 60, SNARE, 100)

    t = section(s, 'A', 16, A + A)
    a_section(t, second=False)
    t = section(s, 'B', 16, B + B)
    b_section(t, second=False)

    # Break: the drums drop out to a heartbeat, the flute alone over a dark pad.
    t = section(s, 'Break', 8, BREAK)
    pad(strings, t, BREAK, 45, 62, 58)
    pad(choir, t, BREAK, 50, 64, 54)
    bass(low, t, BREAK, [4], 1, 70)
    drums(kit, t, 8, sparse, vel=88)
    flute.line(t, melody_break, vel=84, legato=0.98)
    for k in range(16):
        timp.add(t + 28 + k * 0.25, 0.25, pitch('A2'), 50 + k * 4)

    t = section(s, 'A again', 16, A + A)
    a_section(t, second=True)
    t = section(s, 'B again', 16, B + B)
    b_section(t, second=True)

    # Climax: everyone, the tune on horns and flute together, ending on the dominant to lead back into A.
    t = section(s, 'Climax', 8, CLIMAX)
    pad(strings, t, CLIMAX, 52, 76, 82)
    pad(choir, t, CLIMAX, 55, 79, 88)
    bass(low, t, CLIMAX, [1, 1, 1, 1], 1, 98)
    ostinato(cello, t, CLIMAX, ostinato_minor, 2, 92, major_offsets=ostinato_major)
    drums(kit, t, 7, tribal_big, vel=110)
    fill(kit, t + 28, SNARE, 110)
    taiko_beat(t, 8, busy=True)
    horns.line(t, 'D5:1.5! C5:0.5 A4:1 F4:1 G4:1.5! F4:0.5 Eb4:2 E4:1 G4:1 C5:1.5 Bb4:0.5 A4:4 '
               'Bb4:1! D5:1 F5:2 C5:1 E5:1 G5:2 A5:4 C#5:2! E5:2', vel=110)
    flute.line(t, 'D6:1.5 C6:0.5 A5:1 F5:1 G5:1.5 F5:0.5 Eb5:2 E5:1 G5:1 C6:1.5 Bb5:0.5 A5:4 '
               'Bb5:1 D6:1 F6:2 C6:1 E6:1 G6:2 A5:4 C#6:2 E6:2', vel=92)
    hits(timp, t, CLIMAX, 38, 50, 104, beats=(0, 1, 2, 3))
    crash(kit, t)
    add_choir(s, 10)
    return s


# ======================================================================================================================
# Frozen Fortress: a cold, regal siege. E minor, 150 BPM.
# ======================================================================================================================

def frozen():
    random.seed(22)
    s = Song('Frozen Fortress', 150, 'frozen_fortress.mid')
    violin = s.track('Violin (lead)', 0, 40, volume=98, pan=72, reverb=60)      # Violin
    trumpet = s.track('Trumpets', 1, 56, volume=100, pan=56)                    # Trumpet
    celesta = s.track('Celesta', 2, 8, volume=88, pan=80, reverb=70)            # Celesta
    glock = s.track('Glockenspiel', 3, 9, volume=70, pan=44, reverb=80)         # Glockenspiel
    strings = s.track('Staccato strings', 4, 48, volume=90, reverb=50)          # String ensemble
    choir = s.track('Choir', 5, 52, volume=84, reverb=90)                       # Choir aahs
    low = s.track('Low strings', 6, 43, volume=98)                              # Contrabass
    timp = s.track('Timpani', 7, 47, volume=100)                                # Timpani
    brass = s.track('Brass', 8, 61, volume=92, pan=52)                          # Brass section
    kit = s.track('Drums', 9, 0, volume=100)

    A = FROZEN_A
    B = ['C', 'D', 'G', 'Em', 'Am', 'B', 'Em', 'Em']
    BREAK = ['Em', 'Em', 'C', 'C', 'Am', 'Am', 'B', 'B']
    INTRO = ['Em', 'Em', 'C', 'C', 'Em', 'Em', 'C', 'B']
    CLIMAX = ['Em', 'C', 'G', 'D', 'Am', 'C', 'B', 'B']
    melody_a = FROZEN_TUNE
    melody_b = ('G4:1! C5:1 E5:2 F#5:1! E5:0.5 D5:0.5 A4:2 B4:1 D5:1 G5:2 E5:3 B4:1 '
                'C5:1! E5:1 A5:1.5 G5:0.5 F#5:1 D#5:1 B4:2 E5:1.5 F#5:0.5 G5:1 B5:1 E5:4')
    melody_break = 'E5:2 G5:2 F#5:4 E5:2 C5:2 D5:4 C5:2 E5:2 A4:4 B4:2 D#5:2 F#5:4'

    march = {KICK: 'X.......x.......', SNARE: '....X..o....X.o.', HAT: 'x.x.x.x.x.x.x.x.'}
    march_big = {KICK: 'X..x....x..x....', SNARE: '....X..o.o..X.oo', RIDE: 'x.x.x.x.x.x.x.x.'}
    soft = {SNARE: 'o...o...o...o...'}

    def stabs(t, chords, vel):
        # Staccato strings: the chord on every 8th, accents on the beat.
        for i, c in enumerate(chords):
            root, ivs = chord(c)
            notes = voicing(root, ivs, 52, 67)
            for k in range(8):
                for p in notes:
                    strings.add(t + 4 * i + k * 0.5, 0.22, p, vel + (14 if k % 2 == 0 else 0) + random.randint(-4, 4))

    t = section(s, 'Intro', 8, INTRO)
    arpeggio(celesta, t, INTRO, 64, 84, 74, step=0.5, pattern=(0, 2, 4, 2, 1, 3, 5, 3))
    pad(choir, t + 16, INTRO[4:], 52, 71, 60)
    bass(low, t, INTRO, [4], 1, 74)
    for b in range(8):
        timp.add(t + 4 * b, 1, pitch('E2') if INTRO[b] != 'B' else pitch('B1'), 80 + b * 3)
    fill(kit, t + 28, SNARE, 90)

    def a_section(t, second):
        for half in (0, 1):
            h = t + 32 * half
            arpeggio(celesta, h, A, 64, 86, 70, step=0.5, pattern=(0, 2, 4, 2, 1, 3, 5, 3))
            stabs(h, A, 64 if half == 0 and not second else 74)
            bass(low, h, A, [0.5] * 8, 1, 84)
            drums(kit, h, 8, march if half == 0 and not second else march_big)
            violin.line(h, melody_a, vel=94)
            if half == 1 or second:
                glock.line(h, ' '.join(_up(tok) for tok in melody_a.split()), vel=58)
                pad(choir, h, A, 55, 74, 64)
            hits(timp, h, A, 38, 50, 92, beats=(0,))
        crash(kit, t)

    def b_section(t, second):
        for half in (0, 1):
            h = t + 32 * half
            arpeggio(celesta, h, B, 64, 86, 66, step=0.5, pattern=(0, 2, 4, 2, 1, 3, 5, 3))
            stabs(h, B, 76)
            pad(choir, h, B, 55, 76, 74 if half == 0 else 86)
            bass(low, h, B, [1, 0.5, 0.5, 1, 0.5, 0.5], 1, 92)
            drums(kit, h, 8, march_big, vel=106)
            trumpet.line(h, melody_b, vel=100 if half == 0 else 110)
            hits(brass, h, B, 48, 64, 86, beats=(0, 2.5))
            if second or half == 1:
                violin.line(h, ' '.join(_up(tok) for tok in melody_b.split()), vel=80)
            hits(timp, h, B, 38, 50, 100, beats=(0, 2))
        crash(kit, t)
        fill(kit, t + 60, SNARE, 104)

    t = section(s, 'A', 16, A + A)
    a_section(t, second=False)
    t = section(s, 'B', 16, B + B)
    b_section(t, second=False)

    # Break: a music box in the snow.
    t = section(s, 'Break', 8, BREAK)
    arpeggio(celesta, t, BREAK, 64, 84, 58, step=0.5, pattern=(0, 2, 4, 2, 1, 3, 5, 3))
    pad(choir, t, BREAK, 52, 69, 58)
    pad(strings, t, BREAK, 45, 60, 50)
    bass(low, t, BREAK, [4], 1, 64)
    glock.line(t, melody_break, vel=80, legato=1.4)
    drums(kit, t + 16, 4, soft, vel=80)
    for k in range(16):
        timp.add(t + 28 + k * 0.25, 0.25, pitch('B1'), 50 + k * 4)

    t = section(s, 'A again', 16, A + A)
    a_section(t, second=True)
    t = section(s, 'B again', 16, B + B)
    b_section(t, second=True)

    t = section(s, 'Climax', 8, CLIMAX)
    arpeggio(celesta, t, CLIMAX, 64, 88, 74, step=0.5, pattern=(0, 2, 4, 2, 1, 3, 5, 3))
    stabs(t, CLIMAX, 84)
    pad(choir, t, CLIMAX, 55, 79, 90)
    bass(low, t, CLIMAX, [0.5] * 8, 1, 98)
    drums(kit, t, 7, march_big, vel=112)
    fill(kit, t + 28, SNARE, 112)
    trumpet.line(t, 'B4:1! E5:1 G5:1.5 F#5:0.5 E5:1.5 D5:0.5 C5:2 D5:1 B4:1 G4:1 B4:1 A4:3 F#4:1 '
                 'C5:1! E5:1 A5:2 E5:1 G5:1 C6:2 B5:4 D#5:2! F#5:2', vel=112)
    violin.line(t, 'E6:2 B5:2 C6:2 G5:2 B5:2 G5:2 A5:2 F#5:2 A5:2 E5:2 G5:2 E5:2 F#5:4 B5:4', vel=90)
    hits(brass, t, CLIMAX, 48, 64, 98, beats=(0, 1, 2, 3))
    hits(timp, t, CLIMAX, 38, 50, 106, beats=(0, 1, 2, 3))
    crash(kit, t)
    add_choir(s, 10)
    return s


# ======================================================================================================================
# Sunscar Canyon: hot, dusty and driving. D Phrygian dominant (D Eb F# G A Bb C), 130 BPM.
# ======================================================================================================================

def canyon():
    random.seed(33)
    s = Song('Sunscar Canyon', 130, 'sunscar_canyon.mid')
    shanai = s.track('Shanai (lead)', 0, 111, volume=94, pan=70, reverb=50)     # Shanai
    sitar = s.track('Sitar', 1, 104, volume=86, pan=44, reverb=50)              # Sitar
    guitar = s.track('Baritone guitar', 2, 27, volume=92, pan=56, reverb=40)    # Electric guitar (clean)
    cello = s.track('Cello', 3, 42, volume=88, pan=60)                          # Cello
    brass = s.track('Brass', 4, 61, volume=94)                                  # Brass section
    strings = s.track('Strings', 5, 48, volume=72, reverb=60)                   # String ensemble
    low = s.track('Bass', 6, 33, volume=100)                                    # Electric bass (finger)
    taiko = s.track('Taiko', 7, 116, volume=104)                                # Taiko drum
    kit = s.track('Percussion', 9, 0, volume=100)

    A = CANYON_A
    B = ['Gm', 'Cm', 'D', 'D', 'Gm', 'Eb', 'D', 'D']
    BREAK = ['D5', 'D5', 'Eb', 'Eb', 'D5', 'D5', 'Cm', 'D']
    INTRO = ['D5', 'D5', 'D5', 'D5', 'Eb', 'Eb', 'Cm', 'D']
    CLIMAX = ['D', 'Eb', 'D', 'Eb', 'Gm', 'Eb', 'D', 'D']
    melody_a = CANYON_TUNE
    melody_b = ('G4:0.5! A4:0.5 Bb4:1 D5:2 Eb5:1! D5:0.5 C5:0.5 G4:2 F#4:1 A4:1 D5:1 Eb5:1 D5:4 '
                'Bb4:1! D5:1 G5:1.5 F#5:0.5 G5:1 Eb5:1 Bb4:2 A4:0.5 Bb4:0.5 C5:0.5 Bb4:0.5 A4:1 F#4:1 D4:4')
    melody_break = ('A4:1 Bb4:1 A4:2 F#4:4 G4:1 Bb4:1 Eb5:2 D5:4 '
                    'F#5:1 G5:0.5 F#5:0.5 Eb5:1 D5:1 D5:4 C5:2 Eb5:2 D5:2 r:2')

    groove = {KICK: 'X.....x...X.....', CLAP: '....x.......x...', CONGA_HI: '..x..x.x..x..x.x',
              CONGA_LO: 'x.....x.x.....x.', SHAKER: 'xoxoxoxoxoxoxoxo'}
    groove_big = {KICK: 'X..x..x...X..x..', CLAP: '....X.......X...', CONGA_HI: '..x..x.x..x..x.x',
                  CONGA_LO: 'x..x..x.x..x..x.', BONGO_HI: '.x...x...x...x..', TAMB: '..x...x...x...x.',
                  SHAKER: 'xoxoxoxoxoxoxoxo'}
    hand = {CONGA_LO: 'x.....x...x.....', BONGO_HI: '...o.....o...o..', SHAKER: 'o.o.o.o.o.o.o.o.'}
    riff = [0, 0, 1, 0, 4, 5, 4, 1]           # D D Eb D F# G F# Eb: the Phrygian-dominant hook.
    riff_minor = [0, 0, 3, 0, 5, 7, 5, 3]

    def taiko_beat(start, bars):
        for b in range(bars):
            t = start + 4 * b
            taiko.add(t, 0.5, 36, 110)
            taiko.add(t + 2.5, 0.5, 36, 96)

    t = section(s, 'Intro', 8, INTRO)
    drums(kit, t, 4, hand, vel=86)
    drums(kit, t + 16, 4, groove, vel=94)
    ostinato(guitar, t + 16, INTRO[4:], riff_minor, 2, 80, major_offsets=riff)
    pad(strings, t, INTRO, 50, 66, 52)
    bass(low, t + 16, INTRO[4:], [1.5, 0.5, 2], 1, 86)
    sitar.line(t, 'D4:4 r:4 A4:2 Bb4:2 A4:4', vel=80, legato=1.2)
    fill(kit, t + 28, CONGA_HI, 96)

    def a_section(t, second):
        for half in (0, 1):
            h = t + 32 * half
            ostinato(guitar, h, A, riff_minor, 2, 84, major_offsets=riff)
            bass(low, h, A, [1.5, 0.5, 1, 1], 1, 92)
            drums(kit, h, 8, groove if half == 0 and not second else groove_big)
            taiko_beat(h, 8)
            pad(strings, h, A, 52, 70, 58)
            shanai.line(h, melody_a, vel=94)
            if half == 1 or second:
                sitar.line(h, ' '.join(_down(tok) for tok in melody_a.split()), vel=78)
                pad(cello, h, A, 45, 57, 66)
        crash(kit, t)

    def b_section(t, second):
        for half in (0, 1):
            h = t + 32 * half
            ostinato(guitar, h, B, riff_minor, 2, 88, major_offsets=riff)
            bass(low, h, B, [1, 0.5, 0.5, 1, 1], 1, 96)
            drums(kit, h, 8, groove_big, vel=104)
            taiko_beat(h, 8)
            pad(strings, h, B, 55, 74, 70)
            hits(brass, h, B, 50, 65, 92, beats=(0, 1.5, 3))
            sitar.line(h, melody_b, vel=100 if half == 0 else 108)
            if second or half == 1:
                shanai.line(h, ' '.join(_up(tok) for tok in melody_b.split()), vel=82)
        crash(kit, t)
        fill(kit, t + 60, TIMBALE, 100)

    t = section(s, 'A', 16, A + A)
    a_section(t, second=False)
    t = section(s, 'B', 16, B + B)
    b_section(t, second=False)

    # Break: heat haze. Just hand drums, a drone and the shanai.
    t = section(s, 'Break', 8, BREAK)
    drums(kit, t, 8, hand, vel=84)
    pad(strings, t, BREAK, 50, 64, 54)
    pad(cello, t, BREAK, 38, 50, 60)
    shanai.line(t, melody_break, vel=86, legato=1.0)
    fill(kit, t + 28, CONGA_HI, 92)

    t = section(s, 'A again', 16, A + A)
    a_section(t, second=True)
    t = section(s, 'B again', 16, B + B)
    b_section(t, second=True)

    t = section(s, 'Climax', 8, CLIMAX)
    ostinato(guitar, t, CLIMAX, riff_minor, 2, 94, major_offsets=riff)
    bass(low, t, CLIMAX, [0.5] * 8, 1, 100)
    drums(kit, t, 7, groove_big, vel=110)
    fill(kit, t + 28, TIMBALE, 110)
    taiko_beat(t, 8)
    pad(strings, t, CLIMAX, 55, 79, 80)
    hits(brass, t, CLIMAX, 50, 67, 104, beats=(0, 1, 2, 3))
    shanai.line(t, 'D5:1! Eb5:0.5 F#5:0.5 G5:1 F#5:1 Eb5:1.5 D5:0.5 C5:1 Bb4:1 A4:0.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:2 '
                'G4:1! Bb4:1 Eb5:2 D5:1 G5:1 F#5:0.5 G5:0.5 A5:1 D5:2 F#5:2 A5:4 G5:1 F#5:1 Eb5:1 C5:1', vel=108)
    sitar.line(t, 'D4:4 Eb4:4 D4:4 Eb4:4 G4:4 Eb4:4 D4:4 D4:2 A4:2', vel=88)
    crash(kit, t)
    add_choir(s, 10)
    return s


# ======================================================================================================================
# The choir: a slow "oohs" line through every song's chords.
# ======================================================================================================================

def choir_line(track, start, chords, low, high, vel):
    """Moves smoothly from chord to chord (the nearest chord tone each time); every other bar moves on halfway."""
    prev = (low + high) // 2
    for i, c in enumerate(chords):
        root, ivs = chord(c)
        tones = voicing(root, ivs, low, high)
        p = min(tones, key=lambda q: (abs(q - prev), q))
        t = start + 4 * i
        if i % 2 == 1 and len(tones) > 1:
            # Step to the neighboring chord tone (up if there's room) for the second half of the bar.
            above = [q for q in tones if q > p]
            below = [q for q in tones if q < p]
            q = above[0] if above and (p - low) < (high - p) else (below[-1] if below else above[0])
            track.add(t, 1.95, p, vel + random.randint(-4, 4))
            track.add(t + 2, 1.95, q, vel + random.randint(-4, 4))
            prev = q
        else:
            track.add(t, 3.95, p, vel + random.randint(-4, 4))
            prev = p


# Per section: velocity and range. Quiet under the tune in A, fuller in B, out front in the break.
CHOIR_STYLE = {
    'Intro': (52, 55, 67),
    'A': (56, 60, 72),
    'A again': (64, 60, 72),
    'B': (72, 62, 76),
    'B again': (78, 62, 76),
    'Break': (76, 60, 74),
    'Bridge': (70, 60, 74),
    'Climax': (88, 64, 79),
}


def add_choir(song, channel):
    oohs = song.track('Choir oohs', channel, 53, volume=92, pan=64, reverb=100)
    for name, first, bars, chords in song.sections:
        vel, low, high = CHOIR_STYLE.get(name, (64, 60, 74))
        start = song.beats(first)
        if name == 'Intro' and bars == 8:
            start, chords = start + 16, chords[4:]  # It comes in halfway through a long intro.
        choir_line(oohs, start, chords, low, high, vel)


# ======================================================================================================================
# Shared arrangers for the newer songs: a palette of instruments (spec) plus chords and tunes per section.
# ======================================================================================================================

def check(text, bars, what):
    beats = sum(float(tok.split(':')[1].rstrip('!')) for tok in text.split())
    assert beats == bars * 4, f'{what}: {beats} beats, expected {bars * 4}'


def low_root(name, octave):
    root, _ = chord(name)
    return root + 12 * (octave + 1)


def chant(track, start, chords, low, high, vel, rhythm=(0, 0.75, 1.5, 2, 3)):
    """The choir chanting: short, punchy chords on a driving rhythm."""
    for i, c in enumerate(chords):
        root, ivs = chord(c)
        notes = voicing(root, ivs, low, high)[-3:]
        for k, b in enumerate(rhythm):
            for p in notes:
                track.add(start + 4 * i + b, 0.35, p, vel + (12 if k == 0 else 0) + random.randint(-4, 4))


def taiko_boss(track, start, bars, vel=104):
    for b in range(bars):
        t = start + 4 * b
        for beat, v in ((0, 12), (0.75, -10), (1.5, 0), (2, 8), (2.5, -10), (3, 4), (3.5, -6), (3.75, -2)):
            track.add(t + beat, 0.25, 36 if v >= 0 else 38, vel + v + random.randint(-4, 4))


class Palette:
    """The tracks a spec asks for. Channels: 0 lead, 1 counter, 2 brass, 3 pad, 4 choir, 5 ostinato, 6 arpeggio,
    7 bass, 8 timpani, 9 drums, 10 choir oohs (add_choir), 11 taiko."""

    def __init__(self, s, spec):
        self.lead = s.track(spec['lead'][0], 0, spec['lead'][1], volume=98, pan=72, reverb=60)
        self.counter = s.track(spec['counter'][0], 1, spec['counter'][1], volume=88, pan=48, reverb=60)
        self.brass = s.track(spec['brass'][0], 2, spec['brass'][1], volume=96, pan=58)
        self.pad = s.track(spec['pad'][0], 3, spec['pad'][1], volume=78, reverb=70)
        self.choir = s.track('Choir', 4, 52, volume=90, reverb=90)
        o = spec['ostinato']
        self.ost = s.track(o[0], 5, o[1], volume=90, pan=40)
        self.ost_minor, self.ost_major, self.ost_octave = o[2], o[3], o[4]
        self.arp = s.track(spec['arp'][0], 6, spec['arp'][1], volume=80, pan=88, reverb=70) if spec.get('arp') else None
        self.bass = s.track(spec['bass'][0], 7, spec['bass'][1], volume=100)
        self.timp = s.track('Timpani', 8, 47, volume=98)
        self.kit = s.track('Drums', 9, 0, volume=104)
        self.taiko = s.track('Taiko', 11, 116, volume=106) if spec.get('taiko') else None
        self.roles = {'lead': self.lead, 'counter': self.counter, 'brass': self.brass}

    def ostinato(self, t, chords, vel, step=0.5):
        ostinato(self.ost, t, chords, self.ost_minor, self.ost_octave, vel, step=step, major_offsets=self.ost_major)


def arrange_theme(spec):
    """A map theme: Intro 8, A 16, B 16, Break 8, A 16, B 16, Climax 8 (loops from bar 9)."""
    random.seed(spec['seed'])
    s = Song(spec['title'], spec['bpm'], spec['file'])
    p = Palette(s, spec)
    C, M, D = spec['chords'], spec['tunes'], spec['drums']
    for k, text in M.items():
        check(text, 8, f"{spec['title']} {k}")
    b_lead = p.roles[spec['b_lead']]

    t = section(s, 'Intro', 8, C['intro'])
    pad(p.pad, t, C['intro'], 50, 67, 56)
    if p.arp:
        arpeggio(p.arp, t, C['intro'], 60, 84, 64, step=0.5, pattern=(0, 2, 4, 2, 1, 3, 5, 3))
    p.ostinato(t + 16, C['intro'][4:], 74)
    bass(p.bass, t, C['intro'], [4], 1, 74)
    drums(p.kit, t + 16, 3, D['soft'], vel=88)
    fill(p.kit, t + 28, D['fill'], 92)
    for k in range(16):
        p.timp.add(t + 28 + k * 0.25, 0.25, low_root(C['intro'][-1], 1), 50 + k * 4)

    def a_section(t, second):
        A = C['A']
        for half in (0, 1):
            h = t + 32 * half
            loud = half == 1 or second
            p.ostinato(h, A, 80 if loud else 72)
            pad(p.pad, h, A, 52, 69, 62)
            if p.arp:
                arpeggio(p.arp, h, A, 62, 86, 62, step=0.5, pattern=(0, 2, 4, 2, 1, 3, 5, 3))
            bass(p.bass, h, A, [1.5, 0.5, 2], 1, 88)
            drums(p.kit, h, 8, D['big'] if loud else D['main'])
            if p.taiko and loud:
                for b in range(8):
                    p.taiko.add(h + 4 * b, 0.5, 36, 100)
                    p.taiko.add(h + 4 * b + 2.5, 0.5, 36, 88)
            p.lead.line(h, M['A'], vel=94 if not loud else 100)
            if loud:
                p.counter.line(h, ' '.join(_down(tok) for tok in M['A'].split()), vel=70)
        hits(p.timp, t, C['A'][:1], 38, 50, 100)
        crash(p.kit, t)

    def b_section(t, second):
        B = C['B']
        for half in (0, 1):
            h = t + 32 * half
            loud = half == 1 or second
            p.ostinato(h, B, 84)
            pad(p.pad, h, B, 52, 72, 70)
            pad(p.choir, h, B, 55, 74, 66 if not loud else 78)
            bass(p.bass, h, B, [1, 1, 1, 0.5, 0.5], 1, 92)
            drums(p.kit, h, 8, D['big'], vel=104)
            if p.taiko:
                for b in range(8):
                    p.taiko.add(h + 4 * b, 0.5, 36, 104)
                    p.taiko.add(h + 4 * b + 2, 0.5, 36, 92)
            hits(p.brass if b_lead is not p.brass else p.pad, h, B, 48, 64, 80, beats=(0, 2.5))
            b_lead.line(h, M['B'], vel=98 if not loud else 108)
            if loud and b_lead is not p.lead:
                p.lead.line(h, ' '.join(_up(tok) for tok in M['B'].split()), vel=80)
            hits(p.timp, h, B, 38, 50, 96, beats=(0, 2))
        crash(p.kit, t)
        fill(p.kit, t + 60, D['fill'], 100)

    t = section(s, 'A', 16, C['A'] + C['A'])
    a_section(t, False)
    t = section(s, 'B', 16, C['B'] + C['B'])
    b_section(t, False)

    t = section(s, 'Break', 8, C['break'])
    pad(p.pad, t, C['break'], 48, 64, 54)
    if p.arp:
        arpeggio(p.arp, t, C['break'], 60, 82, 54, step=0.5, pattern=(0, 2, 4, 2, 1, 3, 5, 3))
    bass(p.bass, t, C['break'], [4], 1, 66)
    drums(p.kit, t, 8, D['soft'], vel=80)
    p.counter.line(t, M['break'], vel=84, legato=1.0)
    for k in range(16):
        p.timp.add(t + 28 + k * 0.25, 0.25, low_root(C['break'][-1], 1), 50 + k * 4)

    t = section(s, 'A again', 16, C['A'] + C['A'])
    a_section(t, True)
    t = section(s, 'B again', 16, C['B'] + C['B'])
    b_section(t, True)

    t = section(s, 'Climax', 8, C['climax'])
    p.ostinato(t, C['climax'], 92)
    pad(p.pad, t, C['climax'], 52, 76, 80)
    pad(p.choir, t, C['climax'], 55, 79, 86)
    bass(p.bass, t, C['climax'], [1, 1, 1, 1], 1, 98)
    drums(p.kit, t, 7, D['big'], vel=110)
    fill(p.kit, t + 28, D['fill'], 110)
    p.brass.line(t, M['climax'], vel=110)
    p.lead.line(t, ' '.join(_up(tok) for tok in M['climax'].split()), vel=88)
    hits(p.timp, t, C['climax'], 38, 50, 104, beats=(0, 1, 2, 3))
    crash(p.kit, t)
    add_choir(s, 10)
    return s


def arrange_boss(spec):
    """A boss theme: Intro 4, A 16 (the map's tune), B 16 (the boss's), Bridge 8 (choir chant), A 16, B 16,
    Climax 8 (loops from bar 5)."""
    random.seed(spec['seed'])
    s = Song(spec['title'], spec['bpm'], spec['file'])
    s.loop_bar = 4
    p = Palette(s, spec)
    C, M, D = spec['chords'], spec['tunes'], spec['drums']
    for k, text in M.items():
        check(text, 8, f"{spec['title']} {k}")
    b_lead = p.roles[spec['b_lead']]

    # Intro: the whole band hammering every beat, then a drum fill.
    t = section(s, 'Intro', 4, C['intro'])
    hits(p.brass, t, C['intro'], 46, 64, 104, beats=(0, 1, 2, 3))
    chant(p.choir, t, C['intro'], 55, 74, 92, rhythm=(0, 1, 2, 3))
    hits(p.timp, t, C['intro'], 38, 50, 106, beats=(0, 1, 2, 3))
    bass(p.bass, t, C['intro'], [0.5] * 8, 1, 100)
    p.ostinato(t, C['intro'], 86, step=0.25)
    if p.taiko:
        taiko_boss(p.taiko, t, 4)
    drums(p.kit, t, 3, D['boss'], vel=106)
    fill(p.kit, t + 12, D['fill'], 112)
    crash(p.kit, t)

    def a_section(t, second):
        A = C['A']
        for half in (0, 1):
            h = t + 32 * half
            loud = half == 1 or second
            p.ostinato(h, A, 86 if loud else 80, step=0.25)
            pad(p.pad, h, A, 50, 69, 66)
            bass(p.bass, h, A, [0.5] * 8, 1, 96)
            drums(p.kit, h, 8, D['boss_big'] if loud else D['boss'], vel=106)
            if p.taiko:
                taiko_boss(p.taiko, h, 8)
            chant(p.choir, h, A, 55, 74, 78 if loud else 70)
            p.lead.line(h, M['A'], vel=102)
            if loud:
                p.brass.line(h, ' '.join(_down(tok) for tok in M['A'].split()), vel=92)
            hits(p.timp, h, A, 38, 50, 100, beats=(0, 2))
        crash(p.kit, t)

    def b_section(t, second):
        B = C['B']
        for half in (0, 1):
            h = t + 32 * half
            loud = half == 1 or second
            p.ostinato(h, B, 90, step=0.25)
            pad(p.pad, h, B, 52, 72, 76)
            pad(p.choir, h, B, 55, 76, 80 if not loud else 92)
            bass(p.bass, h, B, [0.5] * 8, 1, 100)
            drums(p.kit, h, 8, D['boss_big'], vel=110)
            if p.taiko:
                taiko_boss(p.taiko, h, 8, vel=110)
            b_lead.line(h, M['B'], vel=104 if not loud else 114)
            if b_lead is not p.lead:
                p.lead.line(h, ' '.join(_up(tok) for tok in M['B'].split()), vel=84 if not loud else 94)
            if b_lead is not p.brass:
                hits(p.brass, h, B, 46, 62, 96, beats=(0, 1.5, 3))
            hits(p.timp, h, B, 38, 50, 104, beats=(0, 1, 2, 3))
        crash(p.kit, t)
        fill(p.kit, t + 60, D['fill'], 112)

    t = section(s, 'A', 16, C['A'] + C['A'])
    a_section(t, False)
    t = section(s, 'B', 16, C['B'] + C['B'])
    b_section(t, False)

    # Bridge: the drums drop to a half-time stomp and the choir chants the boss's name, more or less.
    t = section(s, 'Bridge', 8, C['bridge'])
    p.choir.line(t, M['bridge'], vel=96, legato=0.95)
    pad(p.pad, t, C['bridge'], 45, 62, 62)
    bass(p.bass, t, C['bridge'], [2, 2], 1, 90)
    drums(p.kit, t, 7, D['half'], vel=100)
    if p.taiko:
        for b in range(8):
            p.taiko.add(t + 4 * b, 0.5, 36, 110)
            p.taiko.add(t + 4 * b + 1.5, 0.5, 38, 88)
            p.taiko.add(t + 4 * b + 2, 0.5, 36, 100)
    p.ostinato(t + 16, C['bridge'][4:], 76, step=0.25)
    fill(p.kit, t + 28, D['fill'], 112)
    for k in range(16):
        p.timp.add(t + 28 + k * 0.25, 0.25, low_root(C['bridge'][-1], 1), 60 + k * 4)

    t = section(s, 'A again', 16, C['A'] + C['A'])
    a_section(t, True)
    t = section(s, 'B again', 16, C['B'] + C['B'])
    b_section(t, True)

    t = section(s, 'Climax', 8, C['climax'])
    p.ostinato(t, C['climax'], 96, step=0.25)
    pad(p.pad, t, C['climax'], 52, 76, 84)
    pad(p.choir, t, C['climax'], 55, 79, 96)
    bass(p.bass, t, C['climax'], [0.5] * 8, 1, 104)
    drums(p.kit, t, 7, D['boss_big'], vel=114)
    fill(p.kit, t + 28, D['fill'], 116)
    if p.taiko:
        taiko_boss(p.taiko, t, 8, vel=114)
    p.brass.line(t, M['climax'], vel=114)
    p.lead.line(t, ' '.join(_up(tok) for tok in M['climax'].split()), vel=96)
    hits(p.timp, t, C['climax'], 38, 50, 110, beats=(0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5))
    crash(p.kit, t)
    add_choir(s, 10)
    return s


# --- Drum kits for the shared arrangers ---

ORCHESTRAL_BOSS = {
    'boss': {KICK: 'X.x.x.x.X.x.x.xx', SNARE: '....X.......X...', HAT: 'xoxoxoxoxoxoxoxo', TOM_LO: '..............x.'},
    'boss_big': {KICK: 'X.xxX.xxX.xxX.xx', SNARE: '....X..x....X.xx', RIDE: 'x.x.x.x.x.x.x.x.', TOM_LO: '..........x.x...'},
    'half': {KICK: 'X.......X.......', FLOOR_TOM: '....x.......x..x', SNARE: '........X.......'},
    'fill': SNARE,
}


# ======================================================================================================================
# Emerald Woods: bright and adventurous, the first map. D major, 120 BPM.
# ======================================================================================================================

WOODS_A = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A']
WOODS_TUNE = ('F#4:1 A4:1 D5:1.5 C#5:0.5 E5:2 C#5:1 A4:1 B4:1.5 C#5:0.5 D5:1 F#5:1 E5:3 D5:1 '
              'F#5:1 E5:0.5 D5:0.5 A4:1 D5:1 C#5:1 E5:1 A5:2 G5:1 F#5:0.5 E5:0.5 D5:1 B4:1 C#5:2 E5:1 A4:1')


def woods():
    return arrange_theme({
        'seed': 44, 'title': 'Emerald Woods', 'file': 'emerald_woods.mid', 'bpm': 120,
        'lead': ('Pan flute (lead)', 75), 'counter': ('Flute', 73), 'brass': ('French horns', 60),
        'pad': ('Strings', 48), 'ostinato': ('Pizzicato', 45, [0, 7, 12, 7, 3, 7, 12, 7], [0, 7, 12, 7, 4, 7, 12, 7], 3),
        'arp': ('Harp', 46), 'bass': ('Contrabass', 43), 'taiko': False, 'b_lead': 'brass',
        'chords': {
            'intro': ['D', 'D', 'G', 'G', 'Bm', 'Bm', 'A', 'A'],
            'A': WOODS_A,
            'B': ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'],
            'break': ['Bm', 'Bm', 'G', 'G', 'D', 'D', 'A', 'A'],
            'climax': ['D', 'A', 'Bm', 'G', 'Em', 'G', 'A', 'A'],
        },
        'tunes': {
            'A': WOODS_TUNE,
            'B': ('D5:1! B4:1 G4:1 B4:1 C#5:1.5 D5:0.5 E5:2 F#5:1! E5:1 C#5:1 A4:1 B4:3 D5:1 '
                  'G5:1.5! F#5:0.5 E5:1 D5:1 E5:1 F#5:0.5 E5:0.5 C#5:2 D5:1 F#5:1 A5:1.5 G5:0.5 F#5:4'),
            'break': 'B4:2 D5:2 C#5:4 B4:2 G4:2 A4:4 F#4:2 A4:2 D5:4 C#5:2 E5:2 E5:4',
            'climax': ('F#4:1! A4:1 D5:1.5 C#5:0.5 E5:2 C#5:1 A4:1 B4:1.5 C#5:0.5 D5:1 F#5:1 G5:3 F#5:1 '
                       'E5:1! G5:1 B5:1.5 A5:0.5 G5:2 D5:2 E5:1 F#5:0.5 G5:0.5 A5:2 C#5:2 E5:2'),
        },
        'drums': {
            'main': {KICK: 'x.......x.......', TAMB: '..x...x...x...x.', SHAKER: 'o.o.o.o.o.o.o.o.'},
            'big': {KICK: 'x.....x.x.......', SNARE: '....x.......x...', TAMB: '..x...x...x...x.', SHAKER: 'xoxoxoxoxoxoxoxo'},
            'soft': {SHAKER: 'o...o...o...o...', TAMB: '........o.......'},
            'fill': TOM_MID,
        },
    })


def woods_boss():
    # Sylvara: the woods' tune turned to D minor, and a slithering, chromatic serpent theme.
    return arrange_boss({
        'seed': 45, 'title': 'Emerald Woods: Sylvara', 'file': 'emerald_woods_boss.mid', 'bpm': 150,
        'lead': ('Pan flute (lead)', 75), 'counter': ('Flute', 73), 'brass': ('Brass', 61),
        'pad': ('Strings', 48), 'ostinato': ('String ostinato', 48, [0, 12, 7, 12, 3, 12, 7, 12], [0, 12, 7, 12, 4, 12, 7, 12], 3),
        'arp': ('Harp', 46), 'bass': ('Contrabass', 43), 'taiko': True, 'b_lead': 'brass',
        'chords': {
            'intro': ['Dm', 'Dm', 'Eb', 'A'],
            'A': ['Dm', 'A', 'Bb', 'Gm', 'Dm', 'A', 'Gm', 'A'],
            'B': ['Bb', 'A', 'Dm', 'Dm', 'Gm', 'Eb', 'A', 'A'],
            'bridge': ['Dm', 'Dm', 'Eb', 'Eb', 'Dm', 'Dm', 'A', 'A'],
            'climax': ['Dm', 'A', 'Bb', 'Gm', 'Dm', 'Eb', 'A', 'A'],
        },
        'tunes': {
            'A': ('F4:1 A4:1 D5:1.5 C#5:0.5 E5:2 C#5:1 A4:1 Bb4:1.5 C5:0.5 D5:1 F5:1 D5:3 Bb4:1 '
                  'F5:1 E5:0.5 D5:0.5 A4:1 D5:1 C#5:1 E5:1 A5:2 G5:1 F5:0.5 E5:0.5 D5:1 Bb4:1 C#5:2 E5:1 A4:1'),
            'B': ('D5:0.5! C#5:0.5 D5:1 F5:1 D5:1 E5:0.5! D#5:0.5 E5:1 A5:1 E5:1 F5:1.5 E5:0.5 D5:1 A4:1 D5:4 '
                  'Bb4:0.5! A4:0.5 Bb4:1 D5:1 G5:1 G5:1.5 F5:0.5 Eb5:1 Bb4:1 A4:1 C#5:1 E5:1 G5:1 A5:2 E5:2'),
            'bridge': 'D4:1 D4:1 F4:1 E4:1 D4:2 A3:2 Eb4:1 Eb4:1 G4:1 F4:1 Eb4:4 D4:1 D4:1 F4:1 A4:1 D5:2 C5:2 C#5:4 E5:2 A4:2',
            'climax': ('F4:1! A4:1 D5:1.5 C#5:0.5 E5:2 C#5:1 A4:1 Bb4:1.5 C5:0.5 D5:1 F5:1 D5:3 Bb4:1 '
                       'F5:1! E5:1 D5:1 A4:1 G5:2 Eb5:2 E5:1 F5:1 G5:1 A5:1 C#5:2 A4:2'),
        },
        'drums': ORCHESTRAL_BOSS,
    })


# ======================================================================================================================
# Ashen Caldera: heavy and volcanic. C minor, 135 BPM.
# ======================================================================================================================

CALDERA_A = ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G']
CALDERA_TUNE = ('C5:1 Eb5:1 G5:1.5 F5:0.5 Eb5:1.5 C5:0.5 Ab4:2 Bb4:1 D5:1 F5:1 D5:1 B4:3 G4:1 '
                'C5:1 D5:0.5 Eb5:0.5 G5:1 C6:1 Ab5:1.5 G5:0.5 Eb5:1 C5:1 F5:1 Eb5:0.5 D5:0.5 C5:1 Ab4:1 G4:1 B4:1 D5:1 F5:1')
CALDERA_KIT = {
    'main': {KICK: 'X..x..x.X.......', SNARE: '....X.......X...', HAT: 'x.x.x.x.x.x.x.x.'},
    'big': {KICK: 'X.xx..x.X.xx..x.', SNARE: '....X.......X..x', RIDE: 'x.x.x.x.x.x.x.x.', TOM_LO: '..............xx'},
    'soft': {FLOOR_TOM: 'x.......x.......'},
    'fill': TOM_LO,
}


def caldera():
    return arrange_theme({
        'seed': 55, 'title': 'Ashen Caldera', 'file': 'ashen_caldera.mid', 'bpm': 135,
        'lead': ('Distortion guitar (lead)', 30), 'counter': ('Church organ', 19), 'brass': ('Brass', 61),
        'pad': ('Organ pad', 19), 'ostinato': ('Riff guitar', 29, [0, 0, 12, 0, 0, 10, 0, 7], [0, 0, 12, 0, 0, 10, 0, 7], 2),
        'arp': None, 'bass': ('Picked bass', 34), 'taiko': True, 'b_lead': 'brass',
        'chords': {
            'intro': ['Cm', 'Cm', 'Ab', 'Ab', 'Cm', 'Cm', 'Ab', 'G'],
            'A': CALDERA_A,
            'B': ['Ab', 'Bb', 'Cm', 'Cm', 'Fm', 'G', 'Cm', 'Cm'],
            'break': ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G'],
            'climax': ['Cm', 'Ab', 'Bb', 'G', 'Fm', 'Ab', 'G', 'G'],
        },
        'tunes': {
            'A': CALDERA_TUNE,
            'B': ('C5:1! Eb5:1 Ab5:2 G5:1! F5:0.5 Eb5:0.5 D5:2 Eb5:1 G5:1 C6:1.5 Bb5:0.5 G5:4 '
                  'Ab5:1! G5:0.5 F5:0.5 C5:2 D5:1 F5:1 B5:1.5 G5:0.5 C6:1.5 Bb5:0.5 G5:1 Eb5:1 C5:4'),
            'break': 'G4:2 Eb5:2 D5:4 C5:2 Ab4:2 Eb5:4 F5:2 Ab4:2 C5:4 B4:2 D5:2 G5:4',
            'climax': ('C5:1! Eb5:1 G5:1.5 F5:0.5 Eb5:1.5 C5:0.5 Ab4:2 Bb4:1 D5:1 F5:1 D5:1 B4:3 G4:1 '
                       'F5:1! Ab5:1 C6:2 Eb5:1 Ab5:1 C6:2 B5:4 D5:1 F5:1 G5:1 B4:1'),
        },
        'drums': CALDERA_KIT,
    })


def caldera_boss():
    # The Twin Flames: the caldera's tune at full burn, and a Neapolitan (Db) twist in their own theme.
    return arrange_boss({
        'seed': 56, 'title': 'Ashen Caldera: The Twin Flames', 'file': 'ashen_caldera_boss.mid', 'bpm': 165,
        'lead': ('Distortion guitar (lead)', 30), 'counter': ('Church organ', 19), 'brass': ('Brass', 61),
        'pad': ('Church organ', 19),
        'ostinato': ('Riff guitar', 29, [0, 0, 0, 12, 0, 0, 10, 0, 0, 7, 0, 0, 6, 0, 5, 0], [0, 0, 0, 12, 0, 0, 10, 0, 0, 7, 0, 0, 6, 0, 5, 0], 2),
        'arp': None, 'bass': ('Picked bass', 34), 'taiko': True, 'b_lead': 'brass',
        'chords': {
            'intro': ['Cm', 'Cm', 'Db', 'G'],
            'A': CALDERA_A,
            'B': ['Fm', 'G', 'Cm', 'Ab', 'Db', 'G', 'Cm', 'Cm'],
            'bridge': ['Cm', 'Cm', 'Db', 'Db', 'Cm', 'Cm', 'G', 'G'],
            'climax': ['Cm', 'Ab', 'Bb', 'G', 'Fm', 'Db', 'G', 'G'],
        },
        'tunes': {
            'A': CALDERA_TUNE,
            'B': ('F5:0.5! F5:0.5 Ab5:1 C6:1 Ab5:1 G5:0.5! F5:0.5 Eb5:0.5 D5:0.5 B4:2 C5:1 Eb5:1 G5:1 Eb5:1 Ab5:3 G5:1 '
                  'F5:1! Ab5:1 Db6:1.5 C6:0.5 B5:1 G5:1 D5:1 F5:1 Eb5:1.5 D5:0.5 C5:1 G4:1 C5:4'),
            'bridge': 'C4:1 C4:1 Eb4:1 D4:1 C4:2 G3:2 Db4:1 Db4:1 F4:1 Eb4:1 Db4:4 C4:1 C4:1 Eb4:1 G4:1 C5:2 Bb4:2 B4:4 D5:2 G4:2',
            'climax': ('C5:1! Eb5:1 G5:1.5 F5:0.5 Eb5:1.5 C5:0.5 Ab4:2 Bb4:1 D5:1 F5:1 D5:1 B4:3 G4:1 '
                       'F5:1! Ab5:1 C6:2 F5:1 Ab5:1 Db6:2 B5:2 D6:2 G5:4'),
        },
        'drums': {**ORCHESTRAL_BOSS, 'boss': {KICK: 'XxX.XxX.XxX.XxX.', SNARE: '....X.......X...', HAT: 'x.x.x.x.x.x.x.x.'},
                  'boss_big': {KICK: 'XxXxXxXxXxXxXxXx', SNARE: '....X..x....X.xx', RIDE: 'x.x.x.x.x.x.x.x.', CRASH: 'x...............'},
                  'fill': TOM_LO},
    })


# ======================================================================================================================
# Boss themes for the original three maps: their tune in battle dress, and a new theme for each boss.
# ======================================================================================================================

def ruins_boss():
    # Grimjaw: tribal and brutal.
    return arrange_boss({
        'seed': 61, 'title': 'Desecrated Ruins: Grimjaw', 'file': 'desecrated_ruins_boss.mid', 'bpm': 160,
        'lead': ('Shakuhachi (lead)', 77), 'counter': ('Flute', 73), 'brass': ('Horns', 60),
        'pad': ('Strings', 48), 'ostinato': ('Cello ostinato', 42, [0, 0, 3, 0, 1, 0, -2, 0], [0, 0, 4, 0, 7, 0, 4, 0], 2),
        'arp': None, 'bass': ('Contrabass', 43), 'taiko': True, 'b_lead': 'brass',
        'chords': {
            'intro': ['Dm', 'Dm', 'Eb', 'A'],
            'A': RUINS_A,
            'B': ['Gm', 'A', 'Dm', 'Bb', 'Eb', 'A', 'Dm', 'Dm'],
            'bridge': ['Dm', 'Dm', 'Eb', 'Eb', 'Dm', 'Dm', 'A', 'A'],
            'climax': ['Dm', 'Eb', 'C', 'Dm', 'Bb', 'A', 'Dm', 'A'],
        },
        'tunes': {
            'A': RUINS_TUNE,
            'B': ('G4:0.5! A4:0.5 Bb4:1 D5:1 G5:1 F5:1! E5:1 C#5:1 A4:1 D5:1.5 E5:0.5 F5:1 A5:1 F5:3 D5:1 '
                  'Eb5:1! G5:1 Bb5:1.5 G5:0.5 E5:1 C#5:1 A4:2 D5:1 F5:0.5 E5:0.5 D5:1 A4:1 D5:4'),
            'bridge': 'A3:1 D4:1 E4:1 F4:1 E4:2 D4:2 Bb3:1 Eb4:1 F4:1 G4:1 F4:2 Eb4:2 D4:1 F4:1 A4:1 D5:1 C5:1 A4:1 F4:2 E4:2 G4:2 A4:4',
            'climax': ('D5:1.5! C5:0.5 A4:1 F4:1 G4:1.5 F4:0.5 Eb4:2 E4:1 G4:1 C5:1.5 Bb4:0.5 A4:4 '
                       'Bb4:1! D5:1 F5:2 E5:1 C#5:1 A4:2 D5:1 F5:1 A5:2 C#5:2 E5:2'),
        },
        'drums': {**ORCHESTRAL_BOSS,
                  'boss': {KICK: 'X..x..x.X..x.xx.', FLOOR_TOM: '....X.......X..x', TOM_LO: '..x.x...x.x.x...', HAT: 'x.o.x.o.x.o.x.o.'},
                  'boss_big': {KICK: 'X.xx..x.X.xx.xx.', FLOOR_TOM: '....X..x....X.xx', TOM_LO: '..x.x.x.x.x.x...', SNARE: '....X.......X...', HAT: 'xoxoxoxoxoxoxoxo'},
                  'fill': FLOOR_TOM},
    })


def frozen_boss():
    # Rime, the Frost Queen: a racing siege with a Neapolitan (F) chill in her theme.
    return arrange_boss({
        'seed': 62, 'title': 'Frozen Fortress: Rime', 'file': 'frozen_fortress_boss.mid', 'bpm': 170,
        'lead': ('Violin (lead)', 40), 'counter': ('Glockenspiel', 9), 'brass': ('Trumpets', 56),
        'pad': ('Strings', 48), 'ostinato': ('String ostinato', 48, [0, 12, 7, 12, 3, 12, 7, 12], [0, 12, 7, 12, 4, 12, 7, 12], 3),
        'arp': ('Celesta', 8), 'bass': ('Contrabass', 43), 'taiko': False, 'b_lead': 'brass',
        'chords': {
            'intro': ['Em', 'Em', 'F', 'B'],
            'A': FROZEN_A,
            'B': ['Am', 'B', 'Em', 'C', 'F', 'B', 'Em', 'Em'],
            'bridge': ['Em', 'Em', 'F', 'F', 'Em', 'Em', 'B', 'B'],
            'climax': ['Em', 'C', 'G', 'D', 'Am', 'F', 'B', 'B'],
        },
        'tunes': {
            'A': FROZEN_TUNE,
            'B': ('A4:0.5! B4:0.5 C5:1 E5:1 A5:1 F#5:1! D#5:1 B4:2 E5:1 G5:1 B5:1.5 A5:0.5 G5:3 E5:1 '
                  'F5:1! A5:1 C6:1.5 A5:0.5 B5:1 F#5:1 D#5:2 E5:1 G5:0.5 F#5:0.5 E5:1 B4:1 E5:4'),
            'bridge': 'E4:1 E4:1 G4:1 F#4:1 E4:2 B3:2 F4:1 F4:1 A4:1 G4:1 F4:4 E4:1 G4:1 B4:1 E5:1 D5:2 B4:2 D#5:4 F#5:2 B4:2',
            'climax': ('B4:1! E5:1 G5:1.5 F#5:0.5 E5:1.5 D5:0.5 C5:2 D5:1 B4:1 G4:1 B4:1 A4:3 F#4:1 '
                       'C5:1! E5:1 A5:2 F5:1 A5:1 C6:2 B5:4 D#5:2 F#5:2'),
        },
        'drums': {**ORCHESTRAL_BOSS,
                  'boss': {KICK: 'X.......X.x.....', SNARE: '....X..o.o..X.oo', HAT: 'xxxxxxxxxxxxxxxx'},
                  'boss_big': {KICK: 'X..x..x.X..x..x.', SNARE: '..o.X.oo.o.oX.oo', RIDE: 'x.x.x.x.x.x.x.x.'}},
    })


def canyon_boss():
    # Kharzak: a stalking desert war dance.
    return arrange_boss({
        'seed': 63, 'title': 'Sunscar Canyon: Kharzak', 'file': 'sunscar_canyon_boss.mid', 'bpm': 150,
        'lead': ('Shanai (lead)', 111), 'counter': ('Sitar', 104), 'brass': ('Brass', 61),
        'pad': ('Strings', 48), 'ostinato': ('Baritone guitar', 27, [0, 0, 3, 0, 5, 7, 5, 3], [0, 0, 1, 0, 4, 5, 4, 1], 2),
        'arp': None, 'bass': ('Electric bass', 33), 'taiko': True, 'b_lead': 'counter',
        'chords': {
            'intro': ['D5', 'D5', 'Eb', 'D'],
            'A': CANYON_A,
            'B': ['Gm', 'Eb', 'D', 'Cm', 'Gm', 'Eb', 'D', 'D'],
            'bridge': ['D5', 'D5', 'Eb', 'Eb', 'D5', 'D5', 'Cm', 'D'],
            'climax': ['D', 'Eb', 'D', 'Eb', 'Gm', 'Eb', 'D', 'D'],
        },
        'tunes': {
            'A': CANYON_TUNE,
            'B': ('G5:0.5! F#5:0.5 G5:1 D5:1 Bb4:1 Eb5:0.5! D5:0.5 Eb5:1 G5:2 F#5:1 Eb5:1 D5:1 A4:1 C5:1.5 Eb5:0.5 G5:2 '
                  'Bb5:1! A5:0.5 G5:0.5 F#5:1 G5:1 Eb5:1.5 D5:0.5 C5:1 Bb4:1 A4:0.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:1 Eb4:1 D4:4'),
            'bridge': 'D4:1 Eb4:1 F#4:1 Eb4:1 D4:4 Eb4:1 G4:1 Bb4:1 G4:1 Eb4:4 D4:1 F#4:1 A4:1 D5:1 C5:2 A4:2 G4:2 Eb4:2 F#4:4',
            'climax': ('D5:1! Eb5:0.5 F#5:0.5 G5:1 F#5:1 Eb5:1.5 D5:0.5 C5:1 Bb4:1 A4:0.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:2 '
                       'G4:1 Bb4:1 Eb5:2 G5:1! Bb5:1 D6:2 G5:1 Eb5:1 Bb4:2 F#5:1 G5:1 A5:2 D5:4'),
        },
        'drums': {
            'boss': {KICK: 'X.x.x.x.X.x.x.x.', CLAP: '....X.......X...', CONGA_HI: '.xx.x.xx.xx.x.xx', CONGA_LO: 'x..x..x.x..x..x.', SHAKER: 'xxxxxxxxxxxxxxxx'},
            'boss_big': {KICK: 'X.xxX.x.X.xxX.x.', CLAP: '....X.......X..x', CONGA_HI: '.xx.x.xx.xx.x.xx', CONGA_LO: 'x..x..x.x..x..x.',
                         BONGO_HI: 'x.x.x.x.x.x.x.x.', TAMB: '..x...x...x...x.', SHAKER: 'xxxxxxxxxxxxxxxx'},
            'half': {KICK: 'X.......X.......', CONGA_LO: '....x.......x..x', SHAKER: 'o.o.o.o.o.o.o.o.'},
            'fill': TIMBALE,
        },
    })


# --- Small helpers ---

def crash(kit, t):
    kit.add(t, 1, CRASH, 112)


def _shift(token, octaves):
    notes, length = token.split(':')
    if notes == 'r':
        return token
    out = []
    for n in notes.split('+'):
        i = 2 if len(n) > 2 and n[1] in '#b' else 1
        out.append(n[:i] + str(int(n[i:]) + octaves))
    return '+'.join(out) + ':' + length


def _up(token):
    return _shift(token, 1)


def _down(token):
    return _shift(token, -1)


if __name__ == '__main__':
    for compose in (woods, ruins, frozen, canyon, caldera, woods_boss, ruins_boss, frozen_boss, canyon_boss, caldera_boss):
        compose().save()
