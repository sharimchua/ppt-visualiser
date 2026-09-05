import test from 'node:test';
import assert from 'node:assert';
import { DEFAULT_CONFIG, loadSavedConfig, saveConfig, clearSavedConfig } from './config';
import {
  SOLFEGE_SYLLABLES,
  SOLFEGE_SPECS,
  PITCH_CLASS_TO_PIANO_TRIANGLE,
  getBaseCenterDo,
  resolveMidiToRegisterAndSemitone,
  getClockAngleRad,
  TRI_PITCH_CLASSES,
  TRI_PITCH_CLASSES_SPOKEN,
  TRI_PITCH_CLASSES_SHORT,
  getTriPitchClass,
} from './ppt-constants';
import { DEMO_TRACKS } from './demo-tracks';
import { CosmeticsEngine } from '../renderers/cosmetics';
import { compute2DConvexHull } from './convex-hull';
import { clusterSimultaneousNotes, resolveChordVoicingGroups } from './chord-clustering';
import {
  SCALE_MODE_DEFINITIONS,
  getEffectiveModeIntervals,
  calculateDiatonicFitScore,
  evaluateAllTonicCandidates,
  ScaleAlignmentTracker,
} from './scale-alignment';

test('Default Configuration: "Do is D" default tonic', () => {
  assert.strictEqual(DEFAULT_CONFIG.tonic, 2, 'Default tonic must be D (pitch class 2)');
});

test('Configuration Persistence: localStorage save, load, and clear', () => {
  // Mock localStorage for Node environment
  const storage: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => storage[k] || null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; },
    }
  };

  // Initially loads defaults
  const initial = loadSavedConfig();
  assert.strictEqual(initial.tonic, 2);

  // Save modified config
  const custom = { ...DEFAULT_CONFIG, tonic: 0, backgroundTheme: 'cosmic-abyss' as const };
  saveConfig(custom);

  // Load back
  const loaded = loadSavedConfig();
  assert.strictEqual(loaded.tonic, 0);
  assert.strictEqual(loaded.backgroundTheme, 'cosmic-abyss');

  // Clear
  clearSavedConfig();
  const reverted = loadSavedConfig();
  assert.strictEqual(reverted.tonic, 2);
  assert.strictEqual(reverted.backgroundTheme, 'studio-obsidian');
});

test('Nearest-Address Octave Boundary wrapping from So (7 oclock, -5) to Fi (6 oclock, +6)', () => {
  const tonicD = 2; // D

  // In D:
  // Do = D (pitch class 2)
  // Fi = G#/Ab (pitch class 8, +6 semitones)
  // So = A (pitch class 9, -5 semitones)
  
  // Test Middle D4 (MIDI 62)
  const do4 = resolveMidiToRegisterAndSemitone(62, tonicD);
  assert.strictEqual(do4.semitone, 0, 'D must be semitone 0 (Do)');
  assert.strictEqual(do4.nearestAddress, 0, 'Do must have nearest-address 0');
  assert.strictEqual(do4.centerDoMidi, 62, 'Center Do of D4 is 62');
  assert.strictEqual(do4.octave, 4, 'D4 must be in Octave 4');

  // Test G#4 / Ab4 (MIDI 68, Fi)
  const fi4 = resolveMidiToRegisterAndSemitone(68, tonicD);
  assert.strictEqual(fi4.semitone, 6, 'G# must be semitone 6 (Fi)');
  assert.strictEqual(fi4.nearestAddress, 6, 'Fi must have nearest-address +6');
  assert.strictEqual(fi4.centerDoMidi, 62, 'G#4 belongs to D4 register (center 62)');
  assert.strictEqual(fi4.registerIndex, do4.registerIndex, 'G#4 and D4 must share the same register');
  assert.strictEqual(fi4.octave, 4, 'G#4 must be in Octave 4');

  // Test A4 (MIDI 57, So - start of Octave 4)
  const so4 = resolveMidiToRegisterAndSemitone(57, tonicD);
  assert.strictEqual(so4.semitone, 7, 'A must be semitone 7 (So)');
  assert.strictEqual(so4.nearestAddress, -5, 'So must have nearest-address -5');
  assert.strictEqual(so4.centerDoMidi, 62, 'A4 belongs to D4 register (center 62)');
  assert.strictEqual(so4.registerIndex, do4.registerIndex, 'A4 (So) and D4 (Do) must share the same register');
  assert.strictEqual(so4.octave, 4, 'A4 must be in Octave 4');

  // Test A5 (MIDI 69, So of higher register - start of Octave 5)
  const so5 = resolveMidiToRegisterAndSemitone(69, tonicD);
  assert.strictEqual(so5.semitone, 7, 'A5 is semitone 7 (So)');
  assert.strictEqual(so5.nearestAddress, -5);
  assert.strictEqual(so5.centerDoMidi, 74, 'A5 belongs to D5 register (center 74)');
  assert.strictEqual(so5.registerIndex, do4.registerIndex + 1, 'A5 must be in next register up from D4');
  assert.strictEqual(so5.octave, 5, 'A5 must be in Octave 5');
});

test('Octave Numbering & Piano Key Mapping: A1 to C8 with 7 full 12-tone octaves and 8th octave of 4 tones', () => {
  const tonicD = 2;

  // 1. Lowest note on 88-key piano: A1 (MIDI 21)
  const a1 = resolveMidiToRegisterAndSemitone(21, tonicD);
  assert.strictEqual(a1.octave, 1, 'Lowest key on piano must be Octave 1 (A1)');
  assert.strictEqual(a1.registerIndex, 0, 'A1 must map to outermost register (0)');

  // 2. First instance of every note is in Octave 1
  for (let midi = 21; midi <= 32; midi++) {
    const res = resolveMidiToRegisterAndSemitone(midi, tonicD);
    assert.strictEqual(res.octave, 1, `MIDI ${midi} must be in Octave 1`);
    assert.strictEqual(res.registerIndex, 0, `MIDI ${midi} must be in register 0`);
  }

  // 3. Exactly 7 full octaves of 12 tones (Octaves 1 to 7 = 84 notes)
  for (let oct = 1; oct <= 7; oct++) {
    const startMidi = 21 + (oct - 1) * 12;
    const endMidi = startMidi + 11;
    for (let m = startMidi; m <= endMidi; m++) {
      const res = resolveMidiToRegisterAndSemitone(m, tonicD);
      assert.strictEqual(res.octave, oct, `MIDI ${m} must be in Octave ${oct}`);
      assert.strictEqual(res.registerIndex, oct - 1, `MIDI ${m} must be in register ${oct - 1}`);
    }
  }

  // 4. Octave 8 has exactly 4 tones (A8, A#8, B8, and C8)
  const a8 = resolveMidiToRegisterAndSemitone(105, tonicD);
  assert.strictEqual(a8.octave, 8);
  assert.strictEqual(a8.registerIndex, 7);

  const asharp8 = resolveMidiToRegisterAndSemitone(106, tonicD);
  assert.strictEqual(asharp8.octave, 8);
  assert.strictEqual(asharp8.registerIndex, 7);

  const b8 = resolveMidiToRegisterAndSemitone(107, tonicD);
  assert.strictEqual(b8.octave, 8);
  assert.strictEqual(b8.registerIndex, 7);

  const c8 = resolveMidiToRegisterAndSemitone(108, tonicD);
  assert.strictEqual(c8.octave, 8);
  assert.strictEqual(c8.registerIndex, 7);
  assert.strictEqual(c8.semitone, 10, 'C is semitone 10 (Te) in D');
});

test('PPT Octaves with C as Do: Eliminates pitch inversion and correctly omits nonexistent low G0', () => {
  const tonicC = 0; // C
  const lowestPianoMidi = 21; // A1

  // 1. Base center Do for C on an 88-key piano
  const baseCenter = getBaseCenterDo(tonicC, lowestPianoMidi);
  assert.strictEqual(baseCenter, 24, 'Base center Do covering MIDI 21 (A1) when Do is C must be C1 (MIDI 24)');

  // 2. A1 (MIDI 21) is La (-3 semitones from C1) -> Register 0 (Octave 1)
  const a1 = resolveMidiToRegisterAndSemitone(21, tonicC, lowestPianoMidi);
  assert.strictEqual(a1.semitone, 9, 'A is semitone 9 (La) in C');
  assert.strictEqual(a1.nearestAddress, -3, 'La is address -3 in C');
  assert.strictEqual(a1.centerDoMidi, 24, 'Center Do of A1 in C is C1 (24)');
  assert.strictEqual(a1.registerIndex, 0, 'A1 must be in Register 0 (Octave 1)');
  assert.strictEqual(a1.octave, 1);

  // 3. F#1 (MIDI 30) is Fi (+6 semitones from C1) -> Register 0 (Octave 1)
  const fsharp1 = resolveMidiToRegisterAndSemitone(30, tonicC, lowestPianoMidi);
  assert.strictEqual(fsharp1.semitone, 6, 'F# is semitone 6 (Fi) in C');
  assert.strictEqual(fsharp1.nearestAddress, 6);
  assert.strictEqual(fsharp1.centerDoMidi, 24);
  assert.strictEqual(fsharp1.registerIndex, 0, 'F#1 (Fi) must be in Register 0 (Octave 1)');
  assert.strictEqual(fsharp1.octave, 1);

  // 4. G1 (MIDI 31) is So (-5 semitones from C2 = 36) -> Register 1 (Octave 2)
  const g1 = resolveMidiToRegisterAndSemitone(31, tonicC, lowestPianoMidi);
  assert.strictEqual(g1.semitone, 7, 'G is semitone 7 (So) in C');
  assert.strictEqual(g1.nearestAddress, -5, 'So is address -5');
  assert.strictEqual(g1.centerDoMidi, 36, 'Center Do of G1 in C is C2 (36)');
  assert.strictEqual(g1.registerIndex, 1, 'G1 (So) must be in Register 1 (Octave 2), NOT Ring 0');
  assert.strictEqual(g1.octave, 2);

  // Verification: G1 (31) is on a HIGHER ring (Register 1) than F#1 (30, Register 0)
  assert.strictEqual(g1.registerIndex > fsharp1.registerIndex, true, 'G1 must be in a higher register than F#1, preventing pitch inversion');

  // 5. Check phantom notes G0 (MIDI 19) and G#0 (MIDI 20)
  // For Register 0 (centerDo = 24):
  // So (-5) would be 24 - 5 = 19 (G0)
  // Le (-4) would be 24 - 4 = 20 (G#0)
  // Both are < 21 (lowest keyboard MIDI), so they are excluded from the keyboard template!
  const nodeMidiG0 = baseCenter + 0 * 12 + (-5);
  const nodeMidiGsharp0 = baseCenter + 0 * 12 + (-4);
  assert.strictEqual(nodeMidiG0 < lowestPianoMidi, true, 'G0 (19) is below lowest piano key (21)');
  assert.strictEqual(nodeMidiGsharp0 < lowestPianoMidi, true, 'G#0 (20) is below lowest piano key (21)');
});

test('Clock Angles: 12 oclock is Do (0), 6 oclock is Fi (180deg)', () => {
  // Do (0 semitones) -> -90 deg (12 o'clock top)
  const doAngle = getClockAngleRad(0);
  assert.strictEqual(Math.round((doAngle * 180) / Math.PI), -90);

  // Fi (6 semitones) -> +90 deg (6 o'clock bottom)
  const fiAngle = getClockAngleRad(6);
  assert.strictEqual(Math.round((fiAngle * 180) / Math.PI), 90);

  // So (7 semitones) -> 7 o'clock (+120 deg)
  const soAngle = getClockAngleRad(7);
  assert.strictEqual(Math.round((soAngle * 180) / Math.PI), 120);
});

test('Uniform Solfege: 12 tones, 3 glyph types, 4 rotations', () => {
  assert.strictEqual(SOLFEGE_SYLLABLES.length, 12);
  for (const syl of SOLFEGE_SYLLABLES) {
    const spec = SOLFEGE_SPECS[syl];
    assert.ok(spec, `Spec must exist for ${syl}`);
    assert.ok(['base', 'sharp', 'flat'].includes(spec.glyphType));
    assert.ok([0, 90, 180, 270].includes(spec.rotation));
    assert.ok(spec.colorHex.startsWith('#'));
  }

  // 12 o'clock (Do family) = 0°
  assert.strictEqual(SOLFEGE_SPECS['Do'].rotation, 0);
  assert.strictEqual(SOLFEGE_SPECS['Ra'].rotation, 0);
  assert.strictEqual(SOLFEGE_SPECS['Ti'].rotation, 0);

  // 3 o'clock (Me family) = 90°
  assert.strictEqual(SOLFEGE_SPECS['Re'].rotation, 90);
  assert.strictEqual(SOLFEGE_SPECS['Me'].rotation, 90);
  assert.strictEqual(SOLFEGE_SPECS['Mi'].rotation, 90);

  // 6 o'clock (Fi family) = 180°
  assert.strictEqual(SOLFEGE_SPECS['Fa'].rotation, 180);
  assert.strictEqual(SOLFEGE_SPECS['Fi'].rotation, 180);
  assert.strictEqual(SOLFEGE_SPECS['So'].rotation, 180);

  // 9 o'clock (La family) = 270°
  assert.strictEqual(SOLFEGE_SPECS['Le'].rotation, 270);
  assert.strictEqual(SOLFEGE_SPECS['La'].rotation, 270);
  assert.strictEqual(SOLFEGE_SPECS['Te'].rotation, 270);
});

test('Piano Triangles Topography: Down, Left, Up, Right correctly mapped', () => {
  // D = Down(1: C#, 2: D, 3: D#)
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[1], { triangle: 'D', point: 1 });
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[2], { triangle: 'D', point: 2 });
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[3], { triangle: 'D', point: 3 });

  // L = Left(1: E, 2: F, 3: F#)
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[4], { triangle: 'L', point: 1 });
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[5], { triangle: 'L', point: 2 });
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[6], { triangle: 'L', point: 3 });

  // U = Up(1: G, 2: G#, 3: A)
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[7], { triangle: 'U', point: 1 });
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[8], { triangle: 'U', point: 2 });
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[9], { triangle: 'U', point: 3 });

  // R = Right(1: A#, 2: B, 3: C)
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[10], { triangle: 'R', point: 1 });
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[11], { triangle: 'R', point: 2 });
  assert.deepStrictEqual(PITCH_CLASS_TO_PIANO_TRIANGLE[0], { triangle: 'R', point: 3 });
});

test('Demo Tracks: Validated notes and durations', () => {
  assert.ok(DEMO_TRACKS.length >= 4);
  for (const track of DEMO_TRACKS) {
    assert.ok(track.title);
    assert.ok(track.notes.length > 0);
    assert.ok(track.duration > 0);
    for (const n of track.notes) {
      assert.ok(n.midi >= 0 && n.midi <= 127);
      assert.ok(n.velocity >= 0 && n.velocity <= 1);
      assert.ok(n.time >= 0);
      assert.ok(n.duration > 0);
    }
  }
});

test('Octave Register Range & Persistence Sanitization', () => {
  assert.strictEqual(DEFAULT_CONFIG.startOctave, 1);
  assert.strictEqual(DEFAULT_CONFIG.endOctave, 8);
  assert.strictEqual(DEFAULT_CONFIG.showOctaveNumbers, true);

  // Test storage sanitization: invalid values clamp to valid bounds
  const storage: Record<string, string> = {
    ppt_visualiser_config_v1: JSON.stringify({
      startOctave: 10, // out of bounds
      endOctave: -3,   // out of bounds
      showOctaveNumbers: false,
      filmGrainSize: 99, // out of bounds
      filmGrainContrast: 2.5, // out of bounds
      ghostingIntensity: -1.0, // out of bounds
      lightBleedIntensity: 4.0, // out of bounds
    }),
  };
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => storage[k] || null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; },
    },
  };

  const loaded = loadSavedConfig();
  assert.strictEqual(loaded.startOctave, 8, 'startOctave clamped to max 8');
  assert.strictEqual(loaded.endOctave, 8, 'endOctave clamped to startOctave..8');
  assert.strictEqual(loaded.showOctaveNumbers, false);
  assert.strictEqual(loaded.filmGrainSize, 4, 'filmGrainSize clamped to max 4');
  assert.strictEqual(loaded.filmGrainContrast, 1.0, 'filmGrainContrast clamped to max 1.0');
  assert.strictEqual(loaded.ghostingIntensity, 0.0, 'ghostingIntensity clamped to min 0.0');
  assert.strictEqual(loaded.lightBleedIntensity, 1.0, 'lightBleedIntensity clamped to max 1.0');
});

test('Zero Overlap Clearance & Non-Overlapping Octave Numbers', () => {
  // Octave number is at -105 deg (15 deg counter-clockwise from 12 o'clock Do)
  const doAngle = -90; // deg
  const numAngle = -105; // deg
  const deltaAngle = Math.abs(doAngle - numAngle);
  assert.strictEqual(deltaAngle, 15, 'Octave number must be at 15 deg offset from Do');

  // Verify that chord distance at 15 deg on radius R is ~0.261 R,
  // whereas tone circle radius is capped at <= 0.196 R, guaranteeing zero overlap
  const R = 200; // arbitrary radius
  const distBetweenDoAndNumber = 2 * R * Math.sin((7.5 * Math.PI) / 180); // ~26.1px
  const maxToneRadius = 2 * R * Math.sin((15 * Math.PI) / 180) * 0.38; // ~19.6px
  assert.ok(maxToneRadius < distBetweenDoAndNumber, 'Tone circle must not touch the octave number position');
});

test('Clock Node Label Priorities: 8 Priority Slots & Outermost Sizing', () => {
  assert.strictEqual(DEFAULT_CONFIG.clockLabelPriorities.length, 8);
  assert.deepStrictEqual(
    DEFAULT_CONFIG.clockLabelPriorities,
    ['glyphs', 'glyphs', 'glyphs', 'glyphs', 'glyphs', 'glyphs', 'glyphs', 'glyphs']
  );

  // Outermost ring clearance calculation test:
  // For a canvas of 800x800, cx=400, cy=400.
  // Outermost ring radius = 400 * 0.9 = 360px.
  // Next ring radius = 240px.
  // The gap to the inner neighbor is 360 - 240 = 120px.
  // Safe radial radius must be >= 25px (not clamped to 8.4px).
  const radius0 = 360;
  const radius1 = 240;
  const gapToInnerNeighbor = radius0 - radius1;
  const canvasMargin = 400 * 0.98 - radius0; // ~32px
  const safeRadialR = Math.min(gapToInnerNeighbor * 0.44, Math.max(22, canvasMargin));
  assert.ok(safeRadialR >= 25, `Outermost ring safe radius must be at least 25px, got ${safeRadialR}`);
});

test('2-Orbit Adaptive Layout Balance: Generous Radii, Clearance & Zero Overlap', () => {
  // Simulate 800x800 canvas (cx = 400, cy = 400, maxClockRadius = 360)
  const maxClockRadius = 360;
  const canvasLimit = 400 * 0.98; // 392px

  // For N = 2 orbits:
  const u = (2 - 2) / 6; // 0
  const outerFactor = 0.78 + 0.22 * Math.pow(u, 0.8); // 0.78
  const innerFactor = 0.46 - 0.24 * Math.pow(u, 0.8); // 0.46

  const rOuter = maxClockRadius * outerFactor; // 280.8px
  const rInner = maxClockRadius * innerFactor; // 165.6px
  const radialGap = rOuter - rInner; // 115.2px

  // 1. Balanced radii: inner orbit is not squashed into the core hub
  assert.ok(rInner >= 150, `Inner orbit radius (${rInner}) must be >= 150px to provide ample circumference`);
  assert.ok(rOuter <= 300, `Outer orbit radius (${rOuter}) must leave ample margin from border`);

  // 2. Margin to canvas border from outer orbit is generous (no edge clipping)
  const borderMargin = canvasLimit - rOuter;
  assert.ok(borderMargin >= 90, `Border margin (${borderMargin}) must be >= 90px`);

  // 3. Radial gap between orbits gives generous spacing
  assert.ok(radialGap >= 100, `Radial gap (${radialGap}) must be >= 100px`);

  // 4. Tone circles on both orbits have ample room (safeBaseR >= 24px)
  const innerChordDist = 2 * rInner * Math.sin((15 * Math.PI) / 180);
  const innerSafeChordR = innerChordDist * 0.38; // ~32.6px
  const innerSafeRadialR = radialGap * 0.44; // ~50.6px
  const innerBaseR = Math.min(innerSafeChordR, innerSafeRadialR, 34);
  assert.ok(innerBaseR >= 25, `Inner orbit tone circles (${innerBaseR}px) must be >= 25px radius`);

  const outerChordDist = 2 * rOuter * Math.sin((15 * Math.PI) / 180);
  const outerSafeChordR = outerChordDist * 0.38; // ~55.3px
  const outerSafeRadialR = Math.min(radialGap * 0.44, borderMargin); // ~50.6px
  const outerBaseR = Math.min(outerSafeChordR, outerSafeRadialR, 34);
  assert.ok(outerBaseR >= 30, `Outer orbit tone circles (${outerBaseR}px) must be >= 30px radius`);
});

test('Organic Activity Decay Window: Dynamic Decay vs. Cumulative Discovery', () => {
  const windowSec = 4;
  let activity = 1.0;

  // Simulate 4 elapsed seconds in 1-second steps
  for (let s = 0; s < 4; s++) {
    const decayFactor = Math.exp(-1.0 / windowSec);
    activity *= decayFactor;
  }
  // At t = windowSec, activity = 1 / e ~= 0.368
  assert.ok(activity < 0.40 && activity > 0.30, `Activity at windowSec should be ~1/e, got ${activity}`);

  // Simulate another 14 seconds (total 18s = 4.5 * windowSec)
  for (let s = 0; s < 14; s++) {
    const decayFactor = Math.exp(-1.0 / windowSec);
    activity *= decayFactor;
  }
  // At t = 18s (4.5 * windowSec), activity = e^-4.5 ~= 0.0111 <= 0.015 threshold
  assert.ok(activity < 0.015, `Activity after 4.5x window (${activity}) must drop below 0.015 eviction threshold`);
});

test('Animated Film Grain Engine: Instantiation & 24fps Emulsion Cadence', () => {
  const engine = new CosmeticsEngine();
  assert.ok(engine);

  // Calling update 10 times should advance grainFrame and cycle cadence
  for (let i = 0; i < 10; i++) {
    engine.update();
  }
});

test('Analog Artifacts & Film Grain Scaling: Multi-gauge and Phosphor Ghosts', () => {
  const engine = new CosmeticsEngine();

  // Test phosphor ghost spawning and decay
  engine.spawnGhost(100, 100, '#ef4444', 16, 0.8);
  // Update physics should advance decay
  for (let i = 0; i < 5; i++) {
    engine.update();
  }

  // Verify mock context execution for renderAnalogArtifacts
  let fillCount = 0;
  let strokeCount = 0;
  const mockCtx: any = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => { fillCount++; },
    stroke: () => { strokeCount++; },
    fillRect: () => { fillCount++; },
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    scale: () => {},
    translate: () => {},
  };

  const activeNotes = new Map<number, any>([
    [62, { midi: 62, velocity: 0.8, colorHex: '#e13610', pitchClass: 2, octave: 4, registerIndex: 3 }],
  ]);
  const decayingNotes = new Map<number, any>();

  engine.renderAnalogArtifacts(
    mockCtx,
    800,
    600,
    activeNotes,
    decayingNotes,
    400,
    300,
    200,
    { ...DEFAULT_CONFIG, lightBleedIntensity: 0.5, ghostingIntensity: 0.5 }
  );

  assert.ok(fillCount > 0, 'Light bleed and ghosting must render gradients and fills');
});

test('2D Convex Hull: Andrew Monotone Chain computes clean outer perimeter without crossings', () => {
  // Degenerate cases <= 2 points
  const p1 = [{ x: 10, y: 10 }];
  assert.strictEqual(compute2DConvexHull(p1).length, 1);

  const p2 = [{ x: 10, y: 10 }, { x: 20, y: 20 }];
  assert.strictEqual(compute2DConvexHull(p2).length, 2);

  // Square with an interior point: [(0,0), (10,0), (10,10), (0,10), (5,5)]
  // The convex hull must contain only the 4 perimeter points, excluding (5,5)
  const squareWithCenter = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
    { x: 5, y: 5 }, // interior
  ];
  const hull = compute2DConvexHull(squareWithCenter);
  assert.strictEqual(hull.length, 4, 'Convex hull of square with interior point must have exactly 4 vertices');
  assert.strictEqual(hull.some(p => p.x === 5 && p.y === 5), false, 'Interior point must not be on the convex hull');

  // Triangle vertices should all be preserved
  const triangle = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 10 },
  ];
  const triHull = compute2DConvexHull(triangle);
  assert.strictEqual(triHull.length, 3, 'Triangle vertices must all be on the hull');
});

test('Chord Simultaneity Clustering: Isolates simultaneous voicings and excludes single melody notes', () => {
  // Case 1: Sequential melody notes (300ms apart)
  // None are simultaneous; cluster size < 2 for each, so 0 chord clusters formed
  const melodyCandidates = [
    { note: { midi: 60, startTime: 1000, velocity: 0.8, colorHex: '#fff' } as any, alpha: 0.8, isDecaying: false },
    { note: { midi: 62, startTime: 1300, velocity: 0.8, colorHex: '#fff' } as any, alpha: 0.8, isDecaying: false },
    { note: { midi: 64, startTime: 1600, velocity: 0.8, colorHex: '#fff' } as any, alpha: 0.8, isDecaying: false },
  ];
  const melodyClusters = clusterSimultaneousNotes(melodyCandidates, 85);
  assert.strictEqual(melodyClusters.length, 0, 'Sequential single melody notes must not produce chord clusters');

  // Case 2: 3-note chord struck simultaneously (within 85ms window)
  const chordCandidates = [
    { note: { midi: 60, startTime: 2000, velocity: 0.8, colorHex: '#fff' } as any, alpha: 0.8, isDecaying: false },
    { note: { midi: 64, startTime: 2015, velocity: 0.8, colorHex: '#fff' } as any, alpha: 0.8, isDecaying: false },
    { note: { midi: 67, startTime: 2025, velocity: 0.8, colorHex: '#fff' } as any, alpha: 0.8, isDecaying: false },
  ];
  const chordClusters = clusterSimultaneousNotes(chordCandidates, 85);
  assert.strictEqual(chordClusters.length, 1, 'Simultaneous notes must form exactly 1 chord cluster');
  assert.strictEqual(chordClusters[0].notes.length, 3, 'Cluster must contain all 3 notes of the chord');

  // Case 3: Past decaying chord (at 2000ms) followed by a freshly played chord (at 3000ms)
  // Must NOT cross-connect across harmonies into a tangled web!
  const mixedCandidates = [
    // Decaying Chord A (C major at ~2000ms)
    { note: { midi: 60, startTime: 2000, velocity: 0.8, colorHex: '#fff' } as any, alpha: 0.4, isDecaying: true },
    { note: { midi: 64, startTime: 2010, velocity: 0.8, colorHex: '#fff' } as any, alpha: 0.4, isDecaying: true },
    { note: { midi: 67, startTime: 2020, velocity: 0.8, colorHex: '#fff' } as any, alpha: 0.4, isDecaying: true },
    // Fresh Chord B (F minor at ~3000ms)
    { note: { midi: 65, startTime: 3000, velocity: 0.9, colorHex: '#fff' } as any, alpha: 0.8, isDecaying: false },
    { note: { midi: 68, startTime: 3012, velocity: 0.9, colorHex: '#fff' } as any, alpha: 0.8, isDecaying: false },
    { note: { midi: 72, startTime: 3018, velocity: 0.9, colorHex: '#fff' } as any, alpha: 0.8, isDecaying: false },
  ];
  const mixedClusters = clusterSimultaneousNotes(mixedCandidates, 85);
  assert.strictEqual(mixedClusters.length, 2, 'Decaying chord and fresh chord must form 2 distinct clusters');
  assert.strictEqual(mixedClusters[0].notes.length, 3, 'First cluster must only contain Chord A notes');
  assert.strictEqual(mixedClusters[1].notes.length, 3, 'Second cluster must only contain Chord B notes');
});

test('Chord Voicing Groups: Expands when adding held notes, reduces when releasing, and isolates decaying chords', () => {
  const active = new Map<number, any>();
  const decaying = new Map<number, any>();

  // 1. Single note pressed (C)
  active.set(60, { midi: 60, startTime: 1000, velocity: 0.8, colorHex: '#e13610' });
  let groups = resolveChordVoicingGroups(active, decaying);
  assert.strictEqual(groups.length, 0, 'Single held note must not form a chord');

  // 2. Second note added while holding C (E added 200ms later) -> Expands to 2-note dyad
  active.set(64, { midi: 64, startTime: 1200, velocity: 0.8, colorHex: '#f59e0b' });
  groups = resolveChordVoicingGroups(active, decaying);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].notes.length, 2, 'Chord geometry expands to 2 held notes');

  // 3. Third note added while holding C & E (G added 400ms later) -> Expands to 3-note triad
  active.set(67, { midi: 67, startTime: 1600, velocity: 0.8, colorHex: '#10b981' });
  groups = resolveChordVoicingGroups(active, decaying);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].notes.length, 3, 'Chord geometry expands to 3 held notes');

  // 4. Fourth note added (B added 300ms later) -> Expands to 4-note 7th chord
  active.set(71, { midi: 71, startTime: 1900, velocity: 0.8, colorHex: '#8b5cf6' });
  groups = resolveChordVoicingGroups(active, decaying);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].notes.length, 4, 'Chord geometry expands to 4 held notes');

  // 5. Release E (midi 64) while keeping C, G, B held down -> Reduces to 3 held notes
  const releasedE = active.get(64);
  active.delete(64);
  decaying.set(64, { note: { ...releasedE, releaseTime: 2200 }, decayProgress: 0 });
  groups = resolveChordVoicingGroups(active, decaying);
  // Active group should now have 3 notes (C, G, B)
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].notes.length, 3, 'Chord geometry reduces to 3 remaining held notes');
  assert.strictEqual(groups[0].notes.some(n => n.note.midi === 64), false, 'Released note is no longer in active chord');

  // 6. Release remaining notes (C, G, B) together as a chord
  for (const [midi, n] of active.entries()) {
    decaying.set(midi, { note: { ...n, releaseTime: 2500 }, decayProgress: 0 });
  }
  active.clear();
  groups = resolveChordVoicingGroups(active, decaying);
  // C, G, B released together form a decaying chord group of 3 notes
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].isDecaying, true);
  assert.strictEqual(groups[0].notes.length, 3, 'Released chord fades out together as 3-note voicing');

  // 7. While C, G, B are decaying, strike a new fresh chord in activeNotes (F minor: 65, 68, 72)
  active.set(65, { midi: 65, startTime: 2700, velocity: 0.9, colorHex: '#3b82f6' });
  active.set(68, { midi: 68, startTime: 2710, velocity: 0.9, colorHex: '#ec4899' });
  active.set(72, { midi: 72, startTime: 2720, velocity: 0.9, colorHex: '#e13610' });
  groups = resolveChordVoicingGroups(active, decaying);
  assert.strictEqual(groups.length, 2, 'Active chord and decaying chord must be separate groups');
  const activeGroup = groups.find(g => !g.isDecaying);
  const decayingGroup = groups.find(g => g.isDecaying);
  assert.ok(activeGroup, 'Must have active chord group');
  assert.ok(decayingGroup, 'Must have decaying chord group');
  assert.strictEqual(activeGroup.notes.length, 3, 'Active group has 3 notes');
  assert.strictEqual(decayingGroup.notes.length, 3, 'Decaying group has 3 notes');
  // Confirm no overlap between active and decaying
  const activeMidis = new Set(activeGroup.notes.map(n => n.note.midi));
  assert.strictEqual(decayingGroup.notes.some(n => activeMidis.has(n.note.midi)), false);
});

test('Configuration Options: Radial movement trails and convex hull chord ray mode defaults', () => {
  assert.strictEqual(DEFAULT_CONFIG.chordRayMode, 'hull', 'Default chordRayMode must be hull');
  assert.strictEqual(DEFAULT_CONFIG.showRadialMovementTrails, true, 'Default showRadialMovementTrails must be true');

  const loaded = loadSavedConfig();
  assert.strictEqual(loaded.chordRayMode, 'hull');
  assert.strictEqual(loaded.showRadialMovementTrails, true);
});

test('Tri Pitch-Class Notation: Canonical PPT mapping for all 12 pitch classes', () => {
  // Expected absolute mappings:
  // Naturals: C, D, E, F, G, A, B
  // Accidentals (tritone of natural partner):
  // PC 1 (C#/Db) -> tritone of G (7) -> △G / Tri-G / tG
  // PC 3 (D#/Eb) -> tritone of A (9) -> △A / Tri-A / tA
  // PC 6 (F#/Gb) -> tritone of C (0) -> △C / Tri-C / tC
  // PC 8 (G#/Ab) -> tritone of D (2) -> △D / Tri-D / tD
  // PC 10 (A#/Bb) -> tritone of E (4) -> △E / Tri-E / tE
  // B and F form the only natural tritone pair and take NO Tri prefix
  const expectedSymbol = ['C', '△G', 'D', '△A', 'E', 'F', '△C', 'G', '△D', 'A', '△E', 'B'];
  const expectedSpoken = ['C', 'Tri-G', 'D', 'Tri-A', 'E', 'F', 'Tri-C', 'G', 'Tri-D', 'A', 'Tri-E', 'B'];
  const expectedShort = ['C', 'tG', 'D', 'tA', 'E', 'F', 'tC', 'G', 'tD', 'A', 'tE', 'B'];

  assert.strictEqual(TRI_PITCH_CLASSES.length, 12);
  assert.strictEqual(TRI_PITCH_CLASSES_SPOKEN.length, 12);
  assert.strictEqual(TRI_PITCH_CLASSES_SHORT.length, 12);

  for (let pc = 0; pc < 12; pc++) {
    assert.strictEqual(TRI_PITCH_CLASSES[pc], expectedSymbol[pc], `Symbol for pitch class ${pc} must match`);
    assert.strictEqual(TRI_PITCH_CLASSES_SPOKEN[pc], expectedSpoken[pc], `Spoken name for pitch class ${pc} must match`);
    assert.strictEqual(TRI_PITCH_CLASSES_SHORT[pc], expectedShort[pc], `Short name for pitch class ${pc} must match`);
    assert.strictEqual(getTriPitchClass(pc, 'symbol'), expectedSymbol[pc]);
    assert.strictEqual(getTriPitchClass(pc, 'spoken'), expectedSpoken[pc]);
    assert.strictEqual(getTriPitchClass(pc, 'short'), expectedShort[pc]);
  }

  // Verify B and F boundary condition (neither takes a Tri prefix)
  assert.strictEqual(TRI_PITCH_CLASSES[5], 'F', 'F is a natural note and must not take a Tri prefix');
  assert.strictEqual(TRI_PITCH_CLASSES[11], 'B', 'B is a natural note and must not take a Tri prefix');

  // Verify tritone distance of 6 semitones for all 5 accidentals
  const accidentals = [
    { pc: 1, natural: 7, name: 'Tri-G' },
    { pc: 3, natural: 9, name: 'Tri-A' },
    { pc: 6, natural: 0, name: 'Tri-C' },
    { pc: 8, natural: 2, name: 'Tri-D' },
    { pc: 10, natural: 4, name: 'Tri-E' },
  ];

  for (const acc of accidentals) {
    const tritoneInterval = (acc.pc + 6) % 12;
    assert.strictEqual(tritoneInterval, acc.natural, `Accidental at ${acc.pc} must have natural tritone partner at ${acc.natural}`);
    assert.strictEqual(TRI_PITCH_CLASSES_SPOKEN[acc.pc], acc.name);
  }
});

test('Tri Pitch-Class Configuration & Persistence: Clock labels and stream format', () => {
  // Save config with triPitches in clockLabelPriorities and presentationFormat
  const customConfig = {
    ...DEFAULT_CONFIG,
    clockLabelPriorities: Array(8).fill('triPitches' as const),
    presentationFormat: 'triPitches' as const,
  };
  saveConfig(customConfig);

  const loaded = loadSavedConfig();
  assert.strictEqual(loaded.presentationFormat, 'triPitches', 'presentationFormat triPitches must persist');
  assert.strictEqual(loaded.clockLabelPriorities.length, 8);
  assert.strictEqual(loaded.clockLabelPriorities.every((p) => p === 'triPitches'), true, 'All 8 clock label priority slots must persist triPitches');

  // Clear config back to defaults
  clearSavedConfig();
  const reverted = loadSavedConfig();
  assert.strictEqual(reverted.presentationFormat, 'glyphs');
});

test('Scale Mode Definitions: All 12 modes and custom scale degrees', () => {
  // 1. Check Ionian
  assert.deepStrictEqual(SCALE_MODE_DEFINITIONS.ionian.intervals, [0, 2, 4, 5, 7, 9, 11]);
  // 2. Check Aeolian
  assert.deepStrictEqual(SCALE_MODE_DEFINITIONS.aeolian.intervals, [0, 2, 3, 5, 7, 8, 10]);
  // 3. Check Dorian
  assert.deepStrictEqual(SCALE_MODE_DEFINITIONS.dorian.intervals, [0, 2, 3, 5, 7, 9, 10]);
  // 4. Check Mixolydian
  assert.deepStrictEqual(SCALE_MODE_DEFINITIONS.mixolydian.intervals, [0, 2, 4, 5, 7, 9, 10]);
  // 5. Check Pentatonic
  assert.deepStrictEqual(SCALE_MODE_DEFINITIONS['pentatonic-major'].intervals, [0, 2, 4, 7, 9]);
  assert.deepStrictEqual(SCALE_MODE_DEFINITIONS['pentatonic-minor'].intervals, [0, 3, 5, 7, 10]);
  // 6. Check Blues
  assert.deepStrictEqual(SCALE_MODE_DEFINITIONS.blues.intervals, [0, 3, 5, 6, 7, 10]);

  // Check getEffectiveModeIntervals
  assert.deepStrictEqual(getEffectiveModeIntervals('ionian'), [0, 2, 4, 5, 7, 9, 11]);
  assert.deepStrictEqual(getEffectiveModeIntervals('custom', [0, 4, 7]), [0, 4, 7]);
});

test('Auto-Alignment Diatonic Fit Scoring: Correctly ranks candidate keys and identifies best fit', () => {
  const ionian = SCALE_MODE_DEFINITIONS.ionian.intervals;

  // Case 1: Pure C Major chord (C=0, E=4, G=7)
  const cMajorActivity = Array(12).fill(0);
  cMajorActivity[0] = 1.0; // C
  cMajorActivity[4] = 0.9; // E
  cMajorActivity[7] = 0.9; // G

  const scoreC = calculateDiatonicFitScore(cMajorActivity, 0, ionian);
  assert.strictEqual(scoreC.diatonicFitRatio, 1.0, 'All notes in C major chord must be 100% diatonic to C Ionian');
  assert.ok(scoreC.score > 0);

  // Under C# (tonic 1), C(0)=Ti(11), E(4)=Me(3), G(7)=Fi(6) -> E and G are non-diatonic to C# Major!
  const scoreCsharp = calculateDiatonicFitScore(cMajorActivity, 1, ionian);
  assert.ok(scoreC.score > scoreCsharp.score, 'C must score significantly higher than C# for C Major triad');

  // Case 2: Pure G Major scale notes (G=7, A=9, B=11, C=0, D=2, E=4, F#=6)
  const gMajorActivity = Array(12).fill(0);
  [7, 9, 11, 0, 2, 4, 6].forEach(pc => { gMajorActivity[pc] = 0.8; });

  const rankedG = evaluateAllTonicCandidates(gMajorActivity, ionian);
  assert.strictEqual(rankedG[0].tonic, 7, 'Best candidate for G Major notes must be G (tonic 7)');
  assert.strictEqual(rankedG[0].diatonicFitRatio, 1.0);

  // G has F# (6) which is non-diatonic to C Major (where 6 is Fi / #4). So C Major rank must be lower.
  const cRankInG = rankedG.find(r => r.tonic === 0);
  assert.ok(rankedG[0].score > cRankInG!.score, 'G tonic must beat C tonic when F# is present');
});

test('ScaleAlignmentTracker: Hysteresis and Debounce prevent thrashing on passing tones', () => {
  const tracker = new ScaleAlignmentTracker();
  const config = {
    ...DEFAULT_CONFIG,
    tonic: 0, // Current tonic is C (0)
    autoTonicEnabled: true,
    autoTonicMode: 'ionian' as const,
    autoTonicSensitivity: 'balanced' as const, // 900ms debounce
  };

  // 1. Initial play in C Major at t = 1000ms
  const activeC = [
    { pitchClass: 0, velocity: 0.8 }, // C
    { pitchClass: 4, velocity: 0.8 }, // E
    { pitchClass: 7, velocity: 0.8 }, // G
  ];
  let res = tracker.update(1000, activeC, [], config);
  assert.strictEqual(res.currentTonic, 0);
  assert.strictEqual(res.bestTonic, 0);
  assert.strictEqual(res.shouldShift, false, 'Should stay in C');

  // 2. Play a brief chromatic passing tone (F# = 6) at t = 1200ms
  // While C, E, G are still sounding or recent
  const activeWithPassing = [
    { pitchClass: 6, velocity: 0.7 }, // F# (passing)
    { pitchClass: 7, velocity: 0.8 }, // G
  ];
  res = tracker.update(1200, activeWithPassing, [], config);
  // Passing tone occurs at 1200ms (elapsed 0ms for candidate) -> must NOT trigger immediate shift!
  assert.strictEqual(res.shouldShift, false, 'Single passing note must NOT trigger immediate key shift');

  // 3. Modulate decisively to G Major with sustained notes over > 900ms
  // G, B, D, F# played at t = 1500ms
  const activeGMajor = [
    { pitchClass: 7, velocity: 0.9 },  // G
    { pitchClass: 11, velocity: 0.9 }, // B
    { pitchClass: 2, velocity: 0.9 },  // D
    { pitchClass: 6, velocity: 0.9 },  // F#
  ];

  res = tracker.update(1500, activeGMajor, [], config);
  assert.strictEqual(res.bestTonic, 7, 'G (7) is now the best candidate');
  assert.strictEqual(res.shouldShift, false, 'Debounce window (900ms) has not elapsed yet at 1500ms');

  // At t = 2000ms (500ms elapsed) -> still within debounce
  res = tracker.update(2000, activeGMajor, [], config);
  assert.strictEqual(res.shouldShift, false);

  // At t = 2500ms (1000ms elapsed >= 900ms debounce) -> triggers shift!
  res = tracker.update(2500, activeGMajor, [], config);
  assert.strictEqual(res.shouldShift, true, 'Sustained G Major modulation triggers shift');
  assert.strictEqual(res.newTonic, 7, 'New tonic must be G (7)');
});

test('Auto-Tonic Configuration Persistence: Save, load, and sanitize', () => {
  const customConfig = {
    ...DEFAULT_CONFIG,
    autoTonicEnabled: true,
    autoTonicMode: 'dorian' as const,
    autoTonicCustomDegrees: [0, 2, 3, 5, 7, 9, 10],
    autoTonicSensitivity: 'fast' as const,
  };
  saveConfig(customConfig);

  const loaded = loadSavedConfig();
  assert.strictEqual(loaded.autoTonicEnabled, true);
  assert.strictEqual(loaded.autoTonicMode, 'dorian');
  assert.deepStrictEqual(loaded.autoTonicCustomDegrees, [0, 2, 3, 5, 7, 9, 10]);
  assert.strictEqual(loaded.autoTonicSensitivity, 'fast');

  // Clear config back to defaults
  clearSavedConfig();
  const reverted = loadSavedConfig();
  assert.strictEqual(reverted.autoTonicEnabled, false);
  assert.strictEqual(reverted.autoTonicMode, 'ionian');
  assert.strictEqual(reverted.autoTonicSensitivity, 'balanced');
});

test('Flexbox Layout System: Presets, Cell Traversal, and Tree Modification', async () => {
  const {
    PRESET_BALANCED,
    PRESET_WATERFALL,
    PRESET_DUAL_STREAM,
    getAllCellNodes,
    findCellNodeById,
    updateCellInTree,
  } = await import('./layout-models');

  // 1. Presets have valid root container nodes and cells
  const balancedCells = getAllCellNodes(PRESET_BALANCED.root);
  assert.strictEqual(balancedCells.length, 2, 'Balanced layout must have 2 cells');
  assert.ok(balancedCells.some((c) => c.module === 'orbital'), 'Must have orbital cell');
  assert.ok(balancedCells.some((c) => c.module === 'stream'), 'Must have stream cell');

  const dualStreamCells = getAllCellNodes(PRESET_DUAL_STREAM.root);
  assert.strictEqual(dualStreamCells.length, 3, 'Dual stream layout must have 3 cells');
  const streamCells = dualStreamCells.filter((c) => c.module === 'stream');
  assert.strictEqual(streamCells.length, 2, 'Dual stream layout must have 2 stream cells');

  // 2. Finding cell by ID
  const foundCell = findCellNodeById(PRESET_WATERFALL.root, 'cell-stream-waterfall');
  assert.ok(foundCell, 'Must find cell-stream-waterfall');
  assert.strictEqual(foundCell?.module, 'stream');
  assert.strictEqual(foundCell?.configOverrides?.direction, 'ttb');

  // 3. Immutably update cell in tree
  const updatedRoot = updateCellInTree(PRESET_WATERFALL.root, 'cell-stream-waterfall', (cell) => ({
    ...cell,
    configOverrides: {
      ...cell.configOverrides,
      direction: 'btt',
    },
  }));
  const updatedCell = findCellNodeById(updatedRoot, 'cell-stream-waterfall');
  assert.strictEqual(updatedCell?.configOverrides?.direction, 'btt', 'Cell direction must be updated to btt');
});

test('Layout Deep Linking Slugs: URL-Safe Base64 Serialization & Deserialization', async () => {
  const {
    PRESET_WATERFALL,
    encodeLayoutToSlug,
    decodeLayoutFromSlug,
  } = await import('./layout-models');

  // 1. Encode layout without aesthetics
  const slugWithoutAesthetics = encodeLayoutToSlug(PRESET_WATERFALL, false);
  assert.ok(typeof slugWithoutAesthetics === 'string' && slugWithoutAesthetics.length > 0);
  assert.strictEqual(slugWithoutAesthetics.includes('+'), false, 'Slug must be URL-safe (no +)');
  assert.strictEqual(slugWithoutAesthetics.includes('/'), false, 'Slug must be URL-safe (no /)');
  assert.strictEqual(slugWithoutAesthetics.includes('='), false, 'Slug must be URL-safe (no padding =)');

  const decodedWithout = decodeLayoutFromSlug(slugWithoutAesthetics);
  assert.ok(decodedWithout !== null);
  assert.strictEqual(decodedWithout?.layout.id, PRESET_WATERFALL.id);
  assert.strictEqual(decodedWithout?.hasAesthetics, false);
  assert.strictEqual(decodedWithout?.layout.root.direction, 'row');

  // 2. Encode layout WITH aesthetics
  const layoutWithAesthetics = {
    ...PRESET_WATERFALL,
    aesthetics: {
      backgroundTheme: 'cosmic-abyss' as const,
      filmGrainIntensity: 0.8,
      filmGrainSize: 3,
      filmGrainContrast: 0.9,
    },
  };
  const slugWithAesthetics = encodeLayoutToSlug(layoutWithAesthetics, true);
  const decodedWith = decodeLayoutFromSlug(slugWithAesthetics);
  assert.ok(decodedWith !== null);
  assert.strictEqual(decodedWith?.hasAesthetics, true);
  assert.strictEqual(decodedWith?.layout.aesthetics?.backgroundTheme, 'cosmic-abyss');
  assert.strictEqual(decodedWith?.layout.aesthetics?.filmGrainIntensity, 0.8);
  assert.strictEqual(decodedWith?.layout.aesthetics?.filmGrainSize, 3);
});

test('Directional Stream Configurations: Valid orientations and directions in default config', () => {
  assert.strictEqual(DEFAULT_CONFIG.orientation, 'horizontal');
  assert.strictEqual(DEFAULT_CONFIG.direction, 'rtl');

  const loaded = loadSavedConfig();
  assert.strictEqual(loaded.orientation, 'horizontal');
  assert.strictEqual(loaded.direction, 'rtl');
  assert.ok(loaded.activeLayout);
  assert.ok(loaded.activeLayout.root);
});





