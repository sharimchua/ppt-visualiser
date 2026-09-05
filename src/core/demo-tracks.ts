export interface TimedNoteEvent {
  midi: number;
  velocity: number;
  time: number; // in seconds
  duration: number; // in seconds
}

export interface DemoTrack {
  id: string;
  title: string;
  composer: string;
  description: string;
  defaultTonic: number; // e.g. 2 for D, 0 for C
  duration: number;
  notes: TimedNoteEvent[];
}

/**
 * 1. Bach - Prelude in C Major (BWV 846)
 * Iconic arpeggiated texture traversing octaves 2 through 5.
 */
function generateBachPrelude(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  // Bar patterns: [bass1, tenor, alto, sop1, sop2] repeated twice per bar
  const chords = [
    // C major (Bar 1)
    [48, 52, 55, 60, 64],
    // Dm7/C (Bar 2)
    [48, 50, 57, 62, 65],
    // G7/B (Bar 3)
    [47, 50, 55, 62, 65],
    // C (Bar 4)
    [48, 52, 55, 60, 64],
    // Am/C (Bar 5)
    [48, 52, 57, 60, 69],
    // D7/F# (Bar 6)
    [42, 54, 57, 62, 66],
    // G (Bar 7)
    [43, 50, 55, 62, 67],
    // C/E (Bar 8)
    [40, 52, 55, 60, 64],
  ];

  let t = 0;
  const noteDur = 0.22;

  for (const chord of chords) {
    // 2 repetitions per bar
    for (let rep = 0; rep < 2; rep++) {
      // 16th note pattern: 0, 1, 2, 3, 4, 2, 3, 4
      const pattern = [0, 1, 2, 3, 4, 2, 3, 4];
      for (const idx of pattern) {
        notes.push({
          midi: chord[idx],
          velocity: idx === 0 ? 0.9 : 0.7 + Math.random() * 0.15,
          time: t,
          duration: idx < 2 ? noteDur * 3 : noteDur * 0.9,
        });
        t += noteDur;
      }
    }
  }

  // Final resolving chord
  notes.push({ midi: 36, velocity: 0.85, time: t, duration: 2.5 });
  notes.push({ midi: 48, velocity: 0.85, time: t, duration: 2.5 });
  notes.push({ midi: 55, velocity: 0.85, time: t, duration: 2.5 });
  notes.push({ midi: 60, velocity: 0.85, time: t, duration: 2.5 });
  notes.push({ midi: 64, velocity: 0.85, time: t, duration: 2.5 });

  return notes;
}

/**
 * 2. PPT Tetrachord & Piano Triangles Study (Do = D)
 * Cycles systematically through Down (C#, D, D#), Left (E, F, F#), Up (G, G#, A), Right (A#, B, C)
 */
function generateTetrachordStudy(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;
  const dur = 0.32;

  // Triangles: Down(1,2,3), Left(1,2,3), Up(1,2,3), Right(1,2,3)
  // D1=C#(61), D2=D(62), D3=D#(63)
  // L1=E(64), L2=F(65), L3=F#(66)
  // U1=G(67), U2=G#(68), U3=A(69)
  // R1=A#(70), R2=B(71), R3=C(72)

  const octaves = [48, 60, 72];

  for (const base of octaves) {
    // Down Triangle
    notes.push({ midi: base + 1, velocity: 0.85, time: t, duration: dur }); t += dur;
    notes.push({ midi: base + 2, velocity: 0.95, time: t, duration: dur }); t += dur;
    notes.push({ midi: base + 3, velocity: 0.85, time: t, duration: dur }); t += dur;
    t += 0.1;

    // Left Triangle
    notes.push({ midi: base + 4, velocity: 0.85, time: t, duration: dur }); t += dur;
    notes.push({ midi: base + 5, velocity: 0.85, time: t, duration: dur }); t += dur;
    notes.push({ midi: base + 6, velocity: 0.95, time: t, duration: dur }); t += dur; // Tritone Fi
    t += 0.1;

    // Up Triangle
    notes.push({ midi: base + 7, velocity: 0.90, time: t, duration: dur }); t += dur; // So
    notes.push({ midi: base + 8, velocity: 0.85, time: t, duration: dur }); t += dur;
    notes.push({ midi: base + 9, velocity: 0.85, time: t, duration: dur }); t += dur;
    t += 0.1;

    // Right Triangle
    notes.push({ midi: base + 10, velocity: 0.85, time: t, duration: dur }); t += dur;
    notes.push({ midi: base + 11, velocity: 0.85, time: t, duration: dur }); t += dur;
    notes.push({ midi: base + 12, velocity: 0.95, time: t, duration: dur }); t += dur;
    t += 0.3;
  }

  // Harmonic chord resonance at the end
  notes.push({ midi: 50, velocity: 0.9, time: t, duration: 3.0 }); // D3
  notes.push({ midi: 62, velocity: 0.9, time: t, duration: 3.0 }); // D4 (Do)
  notes.push({ midi: 66, velocity: 0.85, time: t, duration: 3.0 }); // F#4 (Mi)
  notes.push({ midi: 69, velocity: 0.9, time: t, duration: 3.0 }); // A4 (So)
  notes.push({ midi: 74, velocity: 0.95, time: t, duration: 3.0 }); // D5 (Do)

  return notes;
}

/**
 * 3. Radial Orbit across all 8 concentric pitch clocks
 * Sweeps from deep bass (A0/Do1) all the way up to treble (C8/Do8) and spirals back.
 */
function generateRadialOrbit(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;

  // Ascending chromatic spiral
  for (let midi = 24; midi <= 96; midi += 1) {
    const stepDur = 0.11;
    notes.push({
      midi,
      velocity: 0.7 + (Math.sin(midi * 0.4) * 0.2),
      time: t,
      duration: stepDur * 1.5,
    });
    t += stepDur;
  }

  t += 0.5;

  // Concentric ring chords (octave blasts across registers)
  const tonicD = [26, 38, 50, 62, 74, 86, 98]; // D in all registers
  for (const midi of tonicD) {
    notes.push({ midi, velocity: 0.95, time: t, duration: 2.0 });
  }
  t += 1.8;

  const fifthA = [21, 33, 45, 57, 69, 81, 93]; // So (A) in all registers
  for (const midi of fifthA) {
    notes.push({ midi, velocity: 0.95, time: t, duration: 2.0 });
  }

  return notes;
}

/**
 * 4. Jazz ii-V-I Progression in D (Em7 - A7 - Dmaj7 - B7)
 * Melodic phrasing + rich jazz chord voicings in "Do is D"
 */
function generateJazz251(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;

  // Bars: [bass, chord notes, melody notes]
  // 1. Em7 (ii)
  notes.push({ midi: 40, velocity: 0.9, time: t, duration: 1.8 }); // E2
  notes.push({ midi: 55, velocity: 0.75, time: t + 0.05, duration: 1.6 }); // G3
  notes.push({ midi: 59, velocity: 0.75, time: t + 0.05, duration: 1.6 }); // B3
  notes.push({ midi: 62, velocity: 0.75, time: t + 0.05, duration: 1.6 }); // D4
  // melody lick
  notes.push({ midi: 67, velocity: 0.85, time: t + 0.3, duration: 0.3 }); // G4
  notes.push({ midi: 69, velocity: 0.85, time: t + 0.6, duration: 0.3 }); // A4
  notes.push({ midi: 71, velocity: 0.9, time: t + 0.9, duration: 0.4 });  // B4
  notes.push({ midi: 74, velocity: 0.85, time: t + 1.3, duration: 0.4 }); // D5
  t += 1.8;

  // 2. A7alt (V)
  notes.push({ midi: 45, velocity: 0.9, time: t, duration: 1.8 }); // A2
  notes.push({ midi: 55, velocity: 0.8, time: t + 0.05, duration: 1.6 }); // G3
  notes.push({ midi: 61, velocity: 0.8, time: t + 0.05, duration: 1.6 }); // C#4
  notes.push({ midi: 66, velocity: 0.8, time: t + 0.05, duration: 1.6 }); // F#4 (13)
  // melody
  notes.push({ midi: 73, velocity: 0.9, time: t + 0.4, duration: 0.35 }); // C#5
  notes.push({ midi: 71, velocity: 0.85, time: t + 0.8, duration: 0.35 }); // B4
  notes.push({ midi: 68, velocity: 0.9, time: t + 1.2, duration: 0.5 });  // G#4 (#11)
  t += 1.8;

  // 3. Dmaj9 (I - Do)
  notes.push({ midi: 50, velocity: 0.95, time: t, duration: 2.2 }); // D3
  notes.push({ midi: 57, velocity: 0.8, time: t + 0.05, duration: 2.0 }); // A3
  notes.push({ midi: 61, velocity: 0.8, time: t + 0.05, duration: 2.0 }); // C#4
  notes.push({ midi: 64, velocity: 0.85, time: t + 0.05, duration: 2.0 }); // E4
  notes.push({ midi: 66, velocity: 0.9, time: t + 0.05, duration: 2.0 }); // F#4
  // melody flourish
  notes.push({ midi: 74, velocity: 0.95, time: t + 0.4, duration: 0.6 }); // D5
  notes.push({ midi: 73, velocity: 0.85, time: t + 1.0, duration: 0.4 }); // C#5
  notes.push({ midi: 69, velocity: 0.9, time: t + 1.4, duration: 0.8 });  // A4
  t += 2.2;

  // Final cadence
  notes.push({ midi: 38, velocity: 0.9, time: t, duration: 2.5 }); // Low D2
  notes.push({ midi: 62, velocity: 0.85, time: t, duration: 2.5 }); // D4
  notes.push({ midi: 69, velocity: 0.85, time: t, duration: 2.5 }); // A4
  notes.push({ midi: 74, velocity: 0.95, time: t, duration: 2.5 }); // D5

  return notes;
}

export const DEMO_TRACKS: DemoTrack[] = [
  {
    id: 'bach-prelude',
    title: 'Prelude in C Major (BWV 846)',
    composer: 'J.S. Bach',
    description: 'Flowing arpeggiated counterpoint spanning multiple registers',
    defaultTonic: 0, // C
    duration: 16.5,
    notes: generateBachPrelude(),
  },
  {
    id: 'ppt-tetrachords',
    title: 'PPT Piano Triangles & Tetrachord Study',
    composer: 'Midlife Muso',
    description: 'Systematic exploration of Down, Left, Up, and Right triangles with Do = D',
    defaultTonic: 2, // D
    duration: 16.0,
    notes: generateTetrachordStudy(),
  },
  {
    id: 'jazz-251',
    title: 'Jazz ii-V-I Progression & Voicings',
    composer: 'Traditional Jazz',
    description: 'Lush chord voicings and melodic ornaments centered around Do = D',
    defaultTonic: 2, // D
    duration: 8.5,
    notes: generateJazz251(),
  },
  {
    id: 'radial-orbit',
    title: 'Concentric Clock Radial Orbit',
    composer: 'PPT Soundlab',
    description: 'Full 8-octave kinetic journey highlighting nearest-address registers',
    defaultTonic: 2, // D
    duration: 13.0,
    notes: generateRadialOrbit(),
  },
];
