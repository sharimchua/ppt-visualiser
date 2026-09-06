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
  category: string;
  description: string;
  defaultTonic: number; // e.g. 2 for D, 0 for C
  duration: number;
  notes: TimedNoteEvent[];
}

/**
 * 1. J.S. Bach - Prelude in C Major (BWV 846)
 * Expanded 16-bar harmonic progression from The Well-Tempered Clavier.
 * Highlights smooth arpeggiated movement traversing octaves 2 through 5.
 */
function generateBachPrelude(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  const chords = [
    [48, 52, 55, 60, 64], // C major (Bar 1)
    [48, 50, 57, 62, 65], // Dm7/C (Bar 2)
    [47, 50, 55, 62, 65], // G7/B (Bar 3)
    [48, 52, 55, 60, 64], // C (Bar 4)
    [48, 52, 57, 60, 69], // Am/C (Bar 5)
    [42, 54, 57, 62, 66], // D7/F# (Bar 6)
    [43, 50, 55, 62, 67], // G (Bar 7)
    [47, 48, 52, 55, 60], // Cmaj7/B (Bar 8)
    [45, 48, 52, 57, 60], // Am7/A (Bar 9)
    [45, 50, 54, 60, 62], // D7/A (Bar 10)
    [43, 50, 55, 59, 62], // G (Bar 11)
    [43, 49, 52, 58, 64], // C#dim7/G (Bar 12)
    [41, 50, 57, 62, 65], // Dm/F (Bar 13)
    [43, 50, 55, 60, 65], // G7sus4 (Bar 14)
    [43, 50, 55, 59, 65], // G7 (Bar 15)
    [48, 52, 55, 60, 64], // C major resolution (Bar 16)
  ];

  let t = 0.2;
  const noteDur = 0.20;

  for (const chord of chords) {
    for (let rep = 0; rep < 2; rep++) {
      const pattern = [0, 1, 2, 3, 4, 2, 3, 4];
      for (const idx of pattern) {
        notes.push({
          midi: chord[idx],
          velocity: idx === 0 ? 0.90 : 0.72 + (idx * 0.04),
          time: t,
          duration: idx < 2 ? noteDur * 3.5 : noteDur * 0.9,
        });
        t += noteDur;
      }
    }
  }

  // Final resolving chord
  notes.push({ midi: 36, velocity: 0.9, time: t, duration: 3.0 });
  notes.push({ midi: 48, velocity: 0.85, time: t, duration: 3.0 });
  notes.push({ midi: 55, velocity: 0.85, time: t, duration: 3.0 });
  notes.push({ midi: 60, velocity: 0.85, time: t, duration: 3.0 });
  notes.push({ midi: 64, velocity: 0.9, time: t, duration: 3.0 });

  return notes;
}

/**
 * 2. J.S. Bach - Two-Part Invention No. 1 in C Major (BWV 772)
 * Authentic two-voice polyphonic counterpoint.
 * Soprano subject introduces the theme, answered by Bass in octave 3.
 */
function generateBachInvention1(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;
  const s = 0.17; // 16th note duration

  // Measure 1: Right Hand subject alone
  const rhM1 = [
    { m: 60, d: s }, { m: 62, d: s }, { m: 64, d: s }, { m: 65, d: s },
    { m: 62, d: s }, { m: 64, d: s }, { m: 60, d: s }, { m: 67, d: s * 2 },
    { m: 72, d: s * 2 }, { m: 71, d: s }, { m: 72, d: s }, { m: 74, d: s },
    { m: 71, d: s }, { m: 72, d: s }, { m: 69, d: s }, { m: 71, d: s },
  ];
  for (const n of rhM1) {
    notes.push({ midi: n.m, velocity: 0.88, time: t, duration: n.d });
    t += n.d;
  }

  // Measure 2: Left hand plays subject octave lower while Right hand counters
  const m2Start = t;
  const lhM2 = [
    { m: 48, d: s }, { m: 50, d: s }, { m: 52, d: s }, { m: 53, d: s },
    { m: 50, d: s }, { m: 52, d: s }, { m: 48, d: s }, { m: 55, d: s * 2 },
    { m: 60, d: s * 2 }, { m: 59, d: s }, { m: 60, d: s }, { m: 62, d: s },
    { m: 59, d: s }, { m: 60, d: s }, { m: 57, d: s }, { m: 59, d: s },
  ];
  let lhT = m2Start;
  for (const n of lhM2) {
    notes.push({ midi: n.m, velocity: 0.86, time: lhT, duration: n.d });
    lhT += n.d;
  }

  const rhM2 = [
    { m: 67, d: s * 2 }, { m: 65, d: s }, { m: 64, d: s }, { m: 62, d: s },
    { m: 64, d: s }, { m: 65, d: s }, { m: 67, d: s * 2 }, { m: 64, d: s * 2 },
    { m: 69, d: s * 2 }, { m: 67, d: s }, { m: 65, d: s }, { m: 64, d: s },
    { m: 65, d: s }, { m: 67, d: s }, { m: 69, d: s * 2 },
  ];
  let rhT = m2Start;
  for (const n of rhM2) {
    notes.push({ midi: n.m, velocity: 0.82, time: rhT, duration: n.d });
    rhT += n.d;
  }
  t = Math.max(lhT, rhT);

  // Measure 3-4: Modulatory sequence to G major with F# leading tone
  const seqChords = [
    { lh: 43, rh: [55, 62, 67, 71] }, // G
    { lh: 45, rh: [57, 60, 66, 69] }, // Am/D7
    { lh: 47, rh: [55, 59, 62, 67] }, // Bm/G
    { lh: 48, rh: [55, 60, 64, 72] }, // C
    { lh: 42, rh: [54, 57, 62, 66] }, // D7/F#
    { lh: 43, rh: [55, 59, 62, 67] }, // G resolution
  ];
  for (const ch of seqChords) {
    notes.push({ midi: ch.lh, velocity: 0.90, time: t, duration: 0.7 });
    for (const rm of ch.rh) {
      notes.push({ midi: rm, velocity: 0.84, time: t, duration: 0.65 });
    }
    t += 0.7;
  }

  // Final G major ring
  notes.push({ midi: 31, velocity: 0.95, time: t, duration: 2.5 });
  notes.push({ midi: 43, velocity: 0.90, time: t, duration: 2.5 });
  notes.push({ midi: 55, velocity: 0.85, time: t, duration: 2.5 });
  notes.push({ midi: 62, velocity: 0.85, time: t, duration: 2.5 });
  notes.push({ midi: 67, velocity: 0.95, time: t, duration: 2.5 });

  return notes;
}

/**
 * 3. Erik Satie - Gymnopédie No. 1
 * Lent et douloureux (3/4 time). Ethereal, modal oscillations between Gmaj7 and Dmaj7.
 * Features slow hovering melody notes and wide chord voicings that showcase convex hull rays.
 */
function generateSatieGymnopedie(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.3;
  const beat = 0.80; // ~75 BPM

  // Measures: [Bass note, Beat 2-3 chord]
  const bars = [
    { bass: 43, chord: [59, 62, 66] }, // M1: G2 -> Bm/G (Gmaj7)
    { bass: 38, chord: [57, 61, 64] }, // M2: D2 -> F#m/D (Dmaj7)
    { bass: 43, chord: [59, 62, 66] }, // M3: G2
    { bass: 38, chord: [57, 61, 64] }, // M4: D2
    { bass: 43, chord: [59, 62, 66], mel: { m: 78, d: beat * 3 } }, // M5: Melody F#5
    { bass: 38, chord: [57, 61, 64], mel: { m: 76, d: beat * 2 } }, // M6: Melody E5
    { bass: 43, chord: [59, 62, 66], mel: { m: 74, d: beat * 3 } }, // M7: Melody D5
    { bass: 38, chord: [57, 61, 64], mel: { m: 71, d: beat * 2 } }, // M8: Melody B4
    { bass: 43, chord: [59, 62, 66], mel: { m: 73, d: beat * 2 } }, // M9: Melody C#5
    { bass: 38, chord: [57, 61, 64], mel: { m: 74, d: beat * 3 } }, // M10: Melody D5
    { bass: 40, chord: [55, 59, 62], mel: { m: 71, d: beat * 3 } }, // M11: Em (E2) -> Melody B4
    { bass: 45, chord: [57, 61, 64], mel: { m: 69, d: beat * 3 } }, // M12: A7 (A2) -> Melody A4
    { bass: 38, chord: [57, 62, 66], mel: { m: 74, d: beat * 4 } }, // M13: D major cadence
  ];

  for (const b of bars) {
    // Beat 1: Bass note
    notes.push({ midi: b.bass, velocity: 0.88, time: t, duration: beat * 2.8 });
    // Beat 2: Mid chord
    const t2 = t + beat;
    for (const cm of b.chord) {
      notes.push({ midi: cm, velocity: 0.70, time: t2, duration: beat * 0.88 });
    }
    // Beat 3: Mid chord repeat
    const t3 = t + beat * 2;
    for (const cm of b.chord) {
      notes.push({ midi: cm, velocity: 0.65, time: t3, duration: beat * 0.9 });
    }
    // Optional melody voice
    if (b.mel) {
      notes.push({ midi: b.mel.m, velocity: 0.94, time: t + 0.05, duration: b.mel.d });
    }
    t += beat * 3;
  }

  // Final resonant resolution chord
  notes.push({ midi: 38, velocity: 0.85, time: t, duration: 4.0 }); // D2
  notes.push({ midi: 50, velocity: 0.75, time: t, duration: 4.0 }); // D3
  notes.push({ midi: 57, velocity: 0.80, time: t, duration: 4.0 }); // A3
  notes.push({ midi: 62, velocity: 0.80, time: t, duration: 4.0 }); // D4
  notes.push({ midi: 66, velocity: 0.85, time: t, duration: 4.0 }); // F#4
  notes.push({ midi: 74, velocity: 0.90, time: t, duration: 4.0 }); // D5

  return notes;
}

/**
 * 4. Ludwig van Beethoven - Moonlight Sonata (Op. 27 No. 2, 1st Mvt)
 * Adagio sostenuto in C# minor.
 * Hypnotic triplet arpeggios, dark bass octaves, poignant singing melody.
 */
function generateBeethovenMoonlight(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;
  const trip = 0.35; // triplet 8th note duration (~57 BPM)

  // Triplet patterns per measure (4 triplets = 12 notes per bar)
  const measures = [
    // M1: C#m (C#2+C#3 bass)
    { bass: [37, 49], trip: [56, 61, 64], mel: null },
    // M2: C#m/B (B1+B2 bass)
    { bass: [35, 47], trip: [56, 61, 64], mel: null },
    // M3: A major (A1+A2 bass)
    { bass: [33, 45], trip: [57, 61, 64], mel: null },
    // M4: F#m to G#7 (F#1 bass then G#1 bass)
    { bass: [30, 42], trip: [57, 61, 66], mel: null },
    // M5: Melody enters on G#4! (C#2+C#3 bass)
    {
      bass: [37, 49],
      trip: [56, 61, 64],
      mel: [
        { m: 68, timeOff: trip * 6, dur: trip * 2.5 },
        { m: 68, timeOff: trip * 9, dur: trip * 2.0 },
        { m: 68, timeOff: trip * 11, dur: trip * 0.9 },
      ]
    },
    // M6: Melody moves to A4 -> G#4 -> F##4 -> G#4
    {
      bass: [35, 47],
      trip: [56, 61, 64],
      mel: [
        { m: 69, timeOff: 0, dur: trip * 3 },
        { m: 68, timeOff: trip * 4, dur: trip * 2.5 },
        { m: 67, timeOff: trip * 7, dur: trip * 2.5 }, // F## / G natural
        { m: 68, timeOff: trip * 10, dur: trip * 2.0 },
      ]
    },
    // M7: High C#5 emotional peak!
    {
      bass: [33, 45],
      trip: [57, 61, 64],
      mel: [
        { m: 73, timeOff: 0, dur: trip * 5 },
        { m: 71, timeOff: trip * 6, dur: trip * 3 },
        { m: 69, timeOff: trip * 9, dur: trip * 3 },
      ]
    },
    // M8: G#7 dominant cadence
    {
      bass: [32, 44],
      trip: [56, 60, 63],
      mel: [
        { m: 68, timeOff: 0, dur: trip * 6 },
      ]
    },
  ];

  for (const m of measures) {
    const barStart = t;
    // Bass octave held across measure
    for (const bm of m.bass) {
      notes.push({ midi: bm, velocity: 0.88, time: barStart, duration: trip * 11.5 });
    }
    // 4 triplet arpeggios (12 notes)
    for (let tr = 0; tr < 4; tr++) {
      for (const tm of m.trip) {
        notes.push({ midi: tm, velocity: 0.68, time: t, duration: trip * 1.8 });
        t += trip;
      }
    }
    // Melody notes
    if (m.mel) {
      for (const mn of m.mel) {
        notes.push({ midi: mn.m, velocity: 0.96, time: barStart + mn.timeOff, duration: mn.dur });
      }
    }
  }

  // Resolving deep C# minor chord
  notes.push({ midi: 25, velocity: 0.92, time: t, duration: 4.0 }); // C#1
  notes.push({ midi: 37, velocity: 0.88, time: t, duration: 4.0 }); // C#2
  notes.push({ midi: 49, velocity: 0.84, time: t, duration: 4.0 }); // C#3
  notes.push({ midi: 56, velocity: 0.85, time: t, duration: 4.0 }); // G#3
  notes.push({ midi: 61, velocity: 0.90, time: t, duration: 4.0 }); // C#4
  notes.push({ midi: 64, velocity: 0.92, time: t, duration: 4.0 }); // E4

  return notes;
}

/**
 * 5. Claude Debussy - Clair de Lune
 * Andante très expressif in Db major (9/8 time).
 * Lyrical high duet in thirds over shimmering descending whole-tone / pentatonic arpeggios.
 */
function generateDebussyClairDeLune(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;
  const eighth = 0.36; // 9/8 eighth note

  // Opening phrase: floating pairs of thirds
  const thirdsPhrase = [
    { top: 77, bot: 80, time: 0, dur: eighth * 2.8 },      // F5 + Ab5
    { top: 75, bot: 79, time: eighth * 3, dur: eighth * 2.8 }, // Eb5 + G5
    { top: 73, bot: 77, time: eighth * 6, dur: eighth * 2.8 }, // Db5 + F5
    { top: 72, bot: 75, time: eighth * 9, dur: eighth * 4.5 }, // C5 + Eb5
  ];

  // Bass accompaniment
  notes.push({ midi: 37, velocity: 0.85, time: t, duration: eighth * 8.5 }); // Db2
  notes.push({ midi: 49, velocity: 0.75, time: t, duration: eighth * 8.5 }); // Db3
  notes.push({ midi: 56, velocity: 0.70, time: t + eighth * 3, duration: eighth * 5 }); // Ab3
  notes.push({ midi: 61, velocity: 0.70, time: t + eighth * 4, duration: eighth * 4 }); // Db4
  notes.push({ midi: 65, velocity: 0.75, time: t + eighth * 5, duration: eighth * 3 }); // F4

  for (const p of thirdsPhrase) {
    notes.push({ midi: p.top, velocity: 0.90, time: t + p.time, duration: p.dur });
    notes.push({ midi: p.bot, velocity: 0.85, time: t + p.time, duration: p.dur });
  }
  t += eighth * 14;

  // Second phrase: Gb major expansion
  notes.push({ midi: 42, velocity: 0.88, time: t, duration: eighth * 8.5 }); // Gb2
  notes.push({ midi: 54, velocity: 0.75, time: t, duration: eighth * 8.5 }); // Gb3
  notes.push({ midi: 58, velocity: 0.75, time: t + eighth * 2, duration: eighth * 6 }); // Bb3
  notes.push({ midi: 61, velocity: 0.75, time: t + eighth * 3, duration: eighth * 5 }); // Db4
  notes.push({ midi: 66, velocity: 0.80, time: t + eighth * 4, duration: eighth * 4 }); // Gb4

  // Melody line descending
  const mel2 = [
    { m: 73, time: 0, dur: eighth * 2.5 },
    { m: 70, time: eighth * 3, dur: eighth * 2.5 },
    { m: 68, time: eighth * 6, dur: eighth * 2.5 },
    { m: 66, time: eighth * 9, dur: eighth * 4.0 },
  ];
  for (const m of mel2) {
    notes.push({ midi: m.m, velocity: 0.92, time: t + m.time, duration: m.dur });
  }
  t += eighth * 14;

  // Shimmering Db arpeggio sweep upward
  const arpeggio = [49, 56, 61, 65, 68, 73, 77, 80, 85];
  let arpT = t;
  for (const m of arpeggio) {
    notes.push({ midi: m, velocity: 0.82 + (m * 0.001), time: arpT, duration: 2.2 });
    arpT += 0.16;
  }
  t = arpT + 1.2;

  // Final glowing Db major 9 chord
  notes.push({ midi: 25, velocity: 0.90, time: t, duration: 3.5 }); // Db1
  notes.push({ midi: 37, velocity: 0.85, time: t, duration: 3.5 }); // Db2
  notes.push({ midi: 61, velocity: 0.80, time: t, duration: 3.5 }); // Db4
  notes.push({ midi: 65, velocity: 0.85, time: t, duration: 3.5 }); // F4
  notes.push({ midi: 68, velocity: 0.85, time: t, duration: 3.5 }); // Ab4
  notes.push({ midi: 72, velocity: 0.90, time: t, duration: 3.5 }); // C5
  notes.push({ midi: 75, velocity: 0.92, time: t, duration: 3.5 }); // Eb5

  return notes;
}

/**
 * 6. Scott Joplin - The Entertainer (Ragtime Two-Step)
 * Upbeat syncopated ragtime classic.
 * Features stride bass, chromatic walkups, and iconic syncopated hooks.
 */
function generateJoplinEntertainer(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;
  const s = 0.14; // 16th note (~105 BPM)

  // Iconic Intro motif: D - D# - E - C, E - C - E
  const intro = [
    { m: 74, d: s }, { m: 75, d: s }, { m: 76, d: s }, { m: 72, d: s * 2 },
    { m: 76, d: s }, { m: 72, d: s }, { m: 76, d: s * 3 },
    { m: 74, d: s }, { m: 75, d: s }, { m: 76, d: s }, { m: 72, d: s * 2 },
    { m: 76, d: s }, { m: 72, d: s }, { m: 76, d: s * 3 },
    // Descending run: C - D - D# - E - C - D - E - B - D - C
    { m: 60, d: s }, { m: 62, d: s }, { m: 63, d: s }, { m: 64, d: s },
    { m: 60, d: s }, { m: 62, d: s }, { m: 64, d: s * 2 },
    { m: 59, d: s * 2 }, { m: 62, d: s * 2 }, { m: 60, d: s * 4 },
  ];

  for (const ev of intro) {
    notes.push({ midi: ev.m, velocity: 0.92, time: t, duration: ev.d });
    t += ev.d;
  }
  t += 0.2;

  // Main Stride Section: Bouncy Ragtime accompaniment + melody
  const beat = s * 2; // 8th note
  for (let bar = 0; bar < 4; bar++) {
    // Left hand stride: Low bass on beat 1, mid chord on beat 2
    const bassNote = bar % 2 === 0 ? 36 : 43; // C2 then G2
    notes.push({ midi: bassNote, velocity: 0.92, time: t, duration: beat * 0.9 });
    // Mid chord on offbeat
    notes.push({ midi: 52, velocity: 0.78, time: t + beat, duration: beat * 0.8 }); // E3
    notes.push({ midi: 55, velocity: 0.78, time: t + beat, duration: beat * 0.8 }); // G3
    notes.push({ midi: 60, velocity: 0.82, time: t + beat, duration: beat * 0.8 }); // C4

    // Right hand syncopated tune
    if (bar === 0 || bar === 2) {
      notes.push({ midi: 64, velocity: 0.94, time: t, duration: s });
      notes.push({ midi: 65, velocity: 0.94, time: t + s, duration: s });
      notes.push({ midi: 67, velocity: 0.96, time: t + s * 2, duration: s * 2 });
    } else {
      notes.push({ midi: 69, velocity: 0.95, time: t, duration: s * 1.5 });
      notes.push({ midi: 67, velocity: 0.92, time: t + s * 1.5, duration: s * 1.5 });
      notes.push({ midi: 64, velocity: 0.90, time: t + s * 3, duration: s });
    }

    t += beat * 2;
  }

  // End cadence
  notes.push({ midi: 48, velocity: 0.90, time: t, duration: 1.8 });
  notes.push({ midi: 60, velocity: 0.95, time: t, duration: 1.8 });
  notes.push({ midi: 64, velocity: 0.90, time: t, duration: 1.8 });
  notes.push({ midi: 67, velocity: 0.92, time: t, duration: 1.8 });
  notes.push({ midi: 72, velocity: 0.98, time: t, duration: 1.8 });

  return notes;
}

/**
 * 7. Traditional - 12-Bar Blues & Boogie in F
 * Swung blues progression with walking boogie bass, blue notes, and 7th chords.
 */
function generateBluesInF(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;
  const beat = 0.50; // 120 BPM shuffle

  // Walking bass pattern in F (F2 - A2 - C3 - D3 - Eb3 - D3 - C3 - A2)
  const bassPatterns: Record<string, number[]> = {
    F: [41, 45, 48, 50, 51, 50, 48, 45],
    Bb: [46, 50, 53, 55, 56, 55, 53, 50],
    C: [48, 52, 55, 57, 58, 57, 55, 52],
  };

  // 12-bar sequence: F, F, F, F | Bb, Bb, F, F | C, Bb, F, C
  const progression = ['F', 'F', 'Bb', 'F', 'C', 'Bb', 'F'];

  for (const chordName of progression) {
    const bass = bassPatterns[chordName];
    // Play 4 beats (8 eighth notes)
    for (let i = 0; i < 8; i++) {
      const isDownbeat = i % 2 === 0;
      const stepDur = isDownbeat ? beat * 0.62 : beat * 0.38; // Swung shuffle
      notes.push({
        midi: bass[i % bass.length],
        velocity: isDownbeat ? 0.92 : 0.78,
        time: t,
        duration: stepDur * 0.95,
      });

      // Comping right-hand chord on offbeats
      if (i === 2 || i === 6) {
        const chordMidis = chordName === 'F' ? [57, 60, 63, 65] // F9
          : chordName === 'Bb' ? [56, 62, 65, 68] // Bb9
          : [58, 64, 67, 70]; // C9
        for (const cm of chordMidis) {
          notes.push({ midi: cm, velocity: 0.82, time: t, duration: stepDur * 1.5 });
        }
      }

      // Blues melody lick on the final beats
      if (chordName === 'F' && i === 4) {
        notes.push({ midi: 68, velocity: 0.95, time: t, duration: 0.3 }); // Ab (blue note)
        notes.push({ midi: 69, velocity: 0.98, time: t + 0.15, duration: 0.45 }); // A natural
        notes.push({ midi: 72, velocity: 0.96, time: t + 0.35, duration: 0.6 }); // C5
      }

      t += stepDur;
    }
  }

  // Turnaround chord
  notes.push({ midi: 41, velocity: 0.95, time: t, duration: 2.2 }); // F2
  notes.push({ midi: 53, velocity: 0.90, time: t, duration: 2.2 }); // F3
  notes.push({ midi: 57, velocity: 0.85, time: t, duration: 2.2 }); // A3
  notes.push({ midi: 63, velocity: 0.90, time: t, duration: 2.2 }); // Eb4
  notes.push({ midi: 67, velocity: 0.95, time: t, duration: 2.2 }); // G4 (9th)

  return notes;
}

/**
 * 8. Traditional Jazz - Jazz ii-V-I Progression & Voicings
 * Melodic phrasing + rich jazz chord voicings in "Do is D" (Em7 - A7alt - Dmaj9 - B7)
 */
function generateJazz251(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;

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

/**
 * 9. Steve Reich & Philip Glass - Kinetic Minimalist Phasing
 * Fast 12/8 interlocking modal polyrhythm in D Dorian (Do = D).
 * Creates rotating kaleidoscope geometries and shifting polygon hulls.
 */
function generateKineticMinimalism(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;
  const pulse = 0.12; // fast sixteenth pulse (~125 BPM)

  // Pattern A: D Dorian ostinato [D4, F4, A4, C5, B4, G4]
  const patternA = [62, 65, 69, 72, 71, 67];
  // Pattern B: Bass anchor points [D2, A2, C3, G2]
  const bassAnchors = [38, 45, 48, 43];

  // Phase cycle: 8 bars of shifting polyrhythm
  for (let bar = 0; bar < 8; bar++) {
    const bass = bassAnchors[bar % bassAnchors.length];
    notes.push({ midi: bass, velocity: 0.92, time: t, duration: pulse * 11 });

    // 12 sixteenth pulses per bar
    for (let p = 0; p < 12; p++) {
      const idx = (p + (bar % 3)) % patternA.length;
      notes.push({
        midi: patternA[idx],
        velocity: p % 3 === 0 ? 0.94 : 0.76,
        time: t + (p * pulse),
        duration: pulse * 1.4,
      });

      // High bell tone on polyrhythmic accents
      if ((p + bar) % 4 === 0) {
        notes.push({
          midi: patternA[idx] + 12, // Octave above
          velocity: 0.88,
          time: t + (p * pulse),
          duration: pulse * 2.0,
        });
      }
    }
    t += pulse * 12;
  }

  // Harmonic culmination
  const chordDorian = [38, 50, 57, 62, 65, 69, 72, 76];
  for (const m of chordDorian) {
    notes.push({ midi: m, velocity: 0.92, time: t, duration: 3.0 });
  }

  return notes;
}

/**
 * 10. PPT Piano Triangles & Tetrachord Study (Do = D)
 * Cycles systematically through Down (C#, D, D#), Left (E, F, F#), Up (G, G#, A), Right (A#, B, C)
 */
function generateTetrachordStudy(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;
  const dur = 0.32;

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
 * 11. Boot Up (Default Demo Track)
 * High-octane kinetic showcase across all 8 concentric pitch clock registers:
 * 1. Ascending chromatic spiral starting at D1 (Do zenith) through D7.
 * 2. Rapid descending dim7 arpeggios demonstrating minor 3rd rotational symmetries.
 * 3. Dominant 7th block chords cycling the circle of fifths from D to G.
 * 4. Chromatic walkdown with tritone substitutions (G7 -> Gb7 -> F7) targeting E.
 * 5. Lush jazz ii-V-I cadence (Em7 -> A7 -> Dmaj7) resolving home to D.
 */
function generateRadialOrbit(): TimedNoteEvent[] {
  const notes: TimedNoteEvent[] = [];
  let t = 0.2;

  // 1. Ascending chromatic spiral starting from D (MIDI 26 = D1 up to MIDI 98 = D7)
  const stepDur = 0.08;
  for (let midi = 26; midi <= 98; midi += 1) {
    notes.push({
      midi,
      velocity: 0.72 + Math.sin((midi - 26) * 0.35) * 0.18,
      time: t,
      duration: stepDur * 1.6,
    });
    t += stepDur;
  }

  t += 0.25;

  // 2. Single-family cardinal dim7 descent (D°7: D, B, Ab, F)
  // Sweeps continuously across the four cardinal axes (12, 9, 6, 3 o'clock)
  // spanning 6 full octaves from D7 (98) all the way down to D1 (26).
  const dDim7Descent = [
    98, 95, 92, 89, // D7, B6, Ab6, F6
    86, 83, 80, 77, // D6, B5, Ab5, F5
    74, 71, 68, 65, // D5, B4, Ab4, F4
    62, 59, 56, 53, // D4, B3, Ab3, F3
    50, 47, 44, 41, // D3, B2, Ab2, F2
    38, 35, 32, 29, // D2, B1, Ab1, F1
    26,             // D1 (Do1 at 12 o'clock zenith)
  ];
  const arpeggioStep = 0.075;
  const arpeggioDur = 0.28;
  for (const midi of dDim7Descent) {
    notes.push({ midi, velocity: 0.88, time: t, duration: arpeggioDur });
    t += arpeggioStep;
  }
  t += 0.3;

  // 3. Dominant 7th block chords in the circle of fifths from D to G
  // D7 -> A7 -> E7 -> B7 -> F#7 -> C#7 -> G#7 -> D#7 -> Bb7 -> F7 -> C7 -> G7
  const circleOfFifths = [
    { name: 'D7',  notes: [50, 60, 64, 66] }, // D3 bass, C4, E4, F#4
    { name: 'A7',  notes: [45, 55, 61, 64] }, // A2 bass, G3, C#4, E4
    { name: 'E7',  notes: [52, 59, 62, 68] }, // E3 bass, B3, D4, G#4
    { name: 'B7',  notes: [47, 57, 63, 66] }, // B2 bass, A3, D#4, F#4
    { name: 'F#7', notes: [54, 61, 64, 70] }, // F#3 bass, C#4, E4, A#4
    { name: 'C#7', notes: [49, 59, 65, 68] }, // C#3 bass, B3, F4, G#4
    { name: 'G#7', notes: [44, 56, 60, 66] }, // G#2 bass, G#3, C4, F#4
    { name: 'D#7', notes: [51, 61, 67, 70] }, // D#3 bass, C#4, G4, A#4
    { name: 'Bb7', notes: [46, 58, 62, 68] }, // Bb2 bass, Bb3, D4, Ab4
    { name: 'F7',  notes: [53, 63, 65, 69] }, // F3 bass, Eb4, F4, A4
    { name: 'C7',  notes: [48, 58, 64, 67] }, // C3 bass, Bb3, E4, G4
    { name: 'G7',  notes: [43, 55, 59, 65] }, // G2 bass, G3, B3, F4
  ];

  const blockDur = 0.16;
  const blockStep = 0.18;
  for (const chord of circleOfFifths) {
    for (const midi of chord.notes) {
      notes.push({ midi, velocity: 0.92, time: t, duration: blockDur });
    }
    t += blockStep;
  }
  t += 0.25;

  // 4. Chromatic walkdown as slower descending arpeggios with tritone substitutions
  // Lets the intense energy of the circle of fifths settle before the 2-5-1.
  // G7 -> Gb7 (tritone sub for C7) -> F7 (tritone sub for B7) targeting E (Em7)
  const walkdownArpeggios = [
    // G7: F5, D5, B4, G4, D4, G2 (bass)
    { name: 'G7',  notes: [77, 74, 71, 67, 62, 43] },
    // Gb7: E5, Db5, Bb4, Gb4, Db4, Gb2 (bass) - tritone sub for C7
    { name: 'Gb7', notes: [76, 73, 70, 66, 61, 42] },
    // F7: Eb5, C5, A4, F4, C4, F2 (bass) - tritone sub for B7
    { name: 'F7',  notes: [75, 72, 69, 65, 60, 41] },
  ];

  const walkStep = 0.11;
  const walkDur = 0.50;
  for (const chord of walkdownArpeggios) {
    for (const midi of chord.notes) {
      notes.push({ midi, velocity: 0.90, time: t, duration: walkDur });
      t += walkStep;
    }
    t += 0.10; // gentle breath between chords
  }
  t += 0.15;

  // 5. Jazz ii-V-I cadence (iim7 -> V7 -> Imaj7) in D major
  // iim7: Em7
  const em7 = [40, 52, 55, 59, 62, 67, 71, 76]; // E2, E3, G3, B3, D4, G4, B4, E5
  for (const midi of em7) {
    notes.push({ midi, velocity: 0.92, time: t, duration: 1.5 });
  }
  t += 1.6;

  // V7: A7
  const a7 = [33, 45, 55, 61, 64, 67, 69, 73]; // A1, A2, G3, C#4, E4, G4, A4, C#5
  for (const midi of a7) {
    notes.push({ midi, velocity: 0.94, time: t, duration: 1.5 });
  }
  t += 1.6;

  // Imaj7: Dmaj7 (resolving home to D at 12 o'clock zenith)
  const dmaj7 = [26, 38, 45, 54, 61, 66, 69, 73, 74, 78]; // D1, D2, A2, F#3, C#4, F#4, A4, C#5, D5, F#5
  for (const midi of dmaj7) {
    notes.push({ midi, velocity: 0.95, time: t, duration: 3.8 });
  }
  t += 3.8;

  return notes;
}

export const DEMO_TRACKS: DemoTrack[] = [
  // Classical & Impressionism
  {
    id: 'satie-gymnopedie',
    title: 'Gymnopédie No. 1',
    composer: 'Erik Satie',
    category: 'Classical & Impressionism',
    description: 'Serene modal waltz with ethereal major 7th chords and floating melodic lines',
    defaultTonic: 2, // D
    duration: 32.0,
    notes: generateSatieGymnopedie(),
  },
  {
    id: 'beethoven-moonlight',
    title: 'Moonlight Sonata (Adagio)',
    composer: 'Ludwig van Beethoven',
    category: 'Classical & Romantic',
    description: 'Hypnotic triplet arpeggios, dark bass octaves, and expressive singing melody',
    defaultTonic: 1, // C#
    duration: 32.0,
    notes: generateBeethovenMoonlight(),
  },
  {
    id: 'debussy-clair-de-lune',
    title: 'Clair de Lune',
    composer: 'Claude Debussy',
    category: 'Classical & Impressionism',
    description: 'Lyrical thirds and shimmering descending whole-tone arpeggios in Db major',
    defaultTonic: 1, // Db
    duration: 25.0,
    notes: generateDebussyClairDeLune(),
  },

  // Baroque Polyphony
  {
    id: 'bach-prelude',
    title: 'Prelude in C Major (BWV 846)',
    composer: 'J.S. Bach',
    category: 'Baroque Polyphony',
    description: 'Flowing arpeggiated counterpoint spanning multiple registers (16 measures)',
    defaultTonic: 0, // C
    duration: 28.0,
    notes: generateBachPrelude(),
  },
  {
    id: 'bach-invention-1',
    title: 'Two-Part Invention No. 1 in C',
    composer: 'J.S. Bach',
    category: 'Baroque Polyphony',
    description: 'Pure two-voice polyphony: subject answered in lower octave with running counterpoint',
    defaultTonic: 0, // C
    duration: 16.0,
    notes: generateBachInvention1(),
  },

  // Ragtime & Blues
  {
    id: 'joplin-entertainer',
    title: 'The Entertainer',
    composer: 'Scott Joplin',
    category: 'Ragtime & Blues',
    description: 'Iconic syncopated ragtime two-step with stride bass and chromatic flourishes',
    defaultTonic: 0, // C
    duration: 15.0,
    notes: generateJoplinEntertainer(),
  },
  {
    id: 'blues-in-f',
    title: '12-Bar Blues & Boogie in F',
    composer: 'Traditional Blues',
    category: 'Ragtime & Blues',
    description: 'Walking boogie bassline with swung blue notes and dominant 9th chords',
    defaultTonic: 5, // F
    duration: 18.0,
    notes: generateBluesInF(),
  },
  {
    id: 'jazz-251',
    title: 'Jazz ii-V-I Progression & Voicings',
    composer: 'Traditional Jazz',
    category: 'Ragtime & Blues',
    description: 'Lush chord voicings and melodic ornaments centered around Do = D',
    defaultTonic: 2, // D
    duration: 8.5,
    notes: generateJazz251(),
  },

  // PPT Theory & Kinetics
  {
    id: 'ppt-tetrachords',
    title: 'PPT Piano Triangles & Tetrachords',
    composer: 'Midlife Muso',
    category: 'PPT Theory & Kinetics',
    description: 'Systematic exploration of Down, Left, Up, and Right triangles with Do = D',
    defaultTonic: 2, // D
    duration: 16.0,
    notes: generateTetrachordStudy(),
  },
  {
    id: 'kinetic-minimalism',
    title: 'Kinetic Phasing in D Dorian',
    composer: 'Steve Reich / Glass',
    category: 'PPT Theory & Kinetics',
    description: 'Fast 12/8 interlocking modal polyrhythms producing rotating geometric polygons',
    defaultTonic: 2, // D
    duration: 18.0,
    notes: generateKineticMinimalism(),
  },
  {
    id: 'radial-orbit',
    title: 'Boot Up',
    composer: 'PPT Soundlab',
    category: 'PPT Theory & Kinetics',
    description: 'Concentric chromatic spiral from D, cardinal dim7 descent to D1, circle of 5ths block chords, slower tritone arpeggios, and jazz ii-V-I',
    defaultTonic: 2, // D
    duration: 21.0,
    notes: generateRadialOrbit(),
  },
];
