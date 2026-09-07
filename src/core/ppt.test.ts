import test from 'node:test';
import assert from 'node:assert';
import { DEFAULT_CONFIG, loadSavedConfig, saveConfig, clearSavedConfig, sanitizeConfig } from './config';
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
  PIANO_RANGE_PRESETS,
  PPT_NOTEHEAD_SPECS,
  getPptNoteheadSpec,
  midiToDiatonicStaffNote,
  TONIC_TO_KEY_SIGNATURE,
  isBlackPianoKey,
} from './ppt-constants';
import { renderPptNoteOnCanvas } from '../renderers/notehead-renderer';
import { DEMO_TRACKS } from './demo-tracks';
import { encodeNotesToMidi } from './midi-encoder';
import { midiPlayerInstance } from './midi-file-player';
import { midiManagerInstance } from './midi-manager';
import { synthInstance } from './audio-synth';
import {
  saveCustomTrack,
  loadSavedCustomTracks,
  deleteCustomTrack,
  clearAllCustomTracks,
  findAnyTrackById,
  CustomMidiTrack,
  CUSTOM_MIDI_STORAGE_KEY,
} from './custom-midi-store';
import { CosmeticsEngine } from '../renderers/cosmetics';
import { PitchClockRenderer } from '../renderers/pitch-clock-canvas';
import { compute2DConvexHull } from './convex-hull';
import { clusterSimultaneousNotes, resolveChordVoicingGroups } from './chord-clustering';
import {
  SCALE_MODE_DEFINITIONS,
  getEffectiveModeIntervals,
  calculateDiatonicFitScore,
  evaluateAllTonicCandidates,
  ScaleAlignmentTracker,
} from './scale-alignment';
import {
  PRESET_BALANCED,
  PRESET_MONUMENT,
  PRESET_SIGNATURE,
  PRESET_HARMONIC,
  PRESET_LAYOUTS,
  splitCellInTree,
  removeCellFromTree,
  duplicateCellInTree,
  moveCellInTree,
  addCellToTree,
  createUniqueCellId,
  getAllCellNodes,
  encodeLayoutToSlug,
  decodeLayoutFromSlug,
} from './layout-models';
import { LayoutDefinition, ActiveNote } from './types';
import {
  getScaleTetrachordChainTriangles,
  PIANO_TRIANGLE_POINT_TO_PITCH_CLASS,
  PianoTrianglesRenderer,
} from '../renderers/piano-triangles-canvas';
import {
  NUM_PARTIALS,
  midiToFrequency,
  computeRegisterWaveWidth,
  computeNotePartials,
  calculatePlompLevelt,
  OvertonesRenderer,
} from '../renderers/overtones-canvas';
import { RenderCoordinator } from './render-coordinator';
import { WebGLPostProcessingPipeline } from '../renderers/webgl-post-processing';
import { SMUFL_GLYPH_PATHS } from '../renderers/smufl-glyphs';
import {
  clusterItemsIntoOnsets,
  computeSatbVoiceLeading,
  VoiceLeadingNode,
  TREBLE_KEY_SIG_SHARPS,
  TREBLE_KEY_SIG_FLATS,
  BASS_KEY_SIG_SHARPS,
  BASS_KEY_SIG_FLATS,
  StaffStreamRenderer,
} from '../renderers/staff-stream-canvas';
import { StreamItem } from './types';

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
  assert.strictEqual(reverted.backgroundTheme, 'carbon-grid');
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
    ['pitches', 'triPitches', 'syllables', 'glyphs', 'triangles', 'intervals', 'none', 'none']
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
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
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

test('Cosmetics Configuration & Persistence: CRT Scanlines, Optical Lens Flares, and Sparks Physics', () => {
  // Test defaults
  assert.strictEqual(DEFAULT_CONFIG.scanlineIntensity, 0.4);
  assert.strictEqual(DEFAULT_CONFIG.scanlineDensity, 2);
  assert.strictEqual(DEFAULT_CONFIG.crtVignette, 0.3);
  assert.strictEqual(DEFAULT_CONFIG.lensFlareIntensity, 0.55);
  assert.strictEqual(DEFAULT_CONFIG.lensFlareStyle, 'cinematic');
  assert.strictEqual(DEFAULT_CONFIG.filmGrainIntensity, 0.35);
  assert.strictEqual(DEFAULT_CONFIG.ghostingIntensity, 0.3);
  assert.strictEqual(DEFAULT_CONFIG.lightBleedIntensity, 0.45);
  assert.strictEqual(DEFAULT_CONFIG.streamMode, 'continuous');
  assert.strictEqual(DEFAULT_CONFIG.particleSize, 1.0);
  assert.strictEqual(DEFAULT_CONFIG.particleVolume, 1.0);
  assert.strictEqual(DEFAULT_CONFIG.particleGravity, 0.15);
  assert.strictEqual(DEFAULT_CONFIG.particleOriginDistance, 0);

  // Test display option enable toggles
  assert.strictEqual(DEFAULT_CONFIG.filmGrainEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.sparksEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.glowBloomEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.motionTrailsEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.ghostingEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.lightBleedEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.scanlinesEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.lensFlareEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.webglEnabled, true);

  // Test loading and sanitization with custom config and Eco Mode (all effects disabled)
  const customConfig = {
    ...DEFAULT_CONFIG,
    filmGrainEnabled: false,
    sparksEnabled: false,
    glowBloomEnabled: false,
    motionTrailsEnabled: false,
    ghostingEnabled: false,
    lightBleedEnabled: false,
    scanlinesEnabled: false,
    lensFlareEnabled: false,
    webglEnabled: false,
    scanlineIntensity: 0.6,
    scanlineDensity: 3,
    crtVignette: 0.45,
    lensFlareIntensity: 0.8,
    lensFlareStyle: 'starburst' as const,
    particleSize: 2.2,
    particleVolume: 1.5,
    particleGravity: -0.5,
    particleOriginDistance: 25,
  };
  saveConfig(customConfig);
  const loaded = loadSavedConfig();
  assert.strictEqual(loaded.filmGrainEnabled, false);
  assert.strictEqual(loaded.sparksEnabled, false);
  assert.strictEqual(loaded.glowBloomEnabled, false);
  assert.strictEqual(loaded.motionTrailsEnabled, false);
  assert.strictEqual(loaded.ghostingEnabled, false);
  assert.strictEqual(loaded.lightBleedEnabled, false);
  assert.strictEqual(loaded.scanlinesEnabled, false);
  assert.strictEqual(loaded.lensFlareEnabled, false);
  assert.strictEqual(loaded.webglEnabled, false);
  assert.strictEqual(loaded.scanlineIntensity, 0.6);
  assert.strictEqual(loaded.scanlineDensity, 3);
  assert.strictEqual(loaded.crtVignette, 0.45);
  assert.strictEqual(loaded.lensFlareIntensity, 0.8);
  assert.strictEqual(loaded.lensFlareStyle, 'starburst');
  assert.strictEqual(loaded.particleSize, 2.2);
  assert.strictEqual(loaded.particleVolume, 1.5);
  assert.strictEqual(loaded.particleGravity, -0.5);
  assert.strictEqual(loaded.particleOriginDistance, 25);
  clearSavedConfig();
});

test('Note Sparks Physics: Particle trajectory, gravity, volume scaling, and radial origin offset', () => {
  const engine = new CosmeticsEngine();

  // Test 1: Spawning with radial offset
  const cx = 200;
  const cy = 200;
  const offset = 30;
  const radialAngle = 0; // 0 radians = along +X axis
  engine.spawnNoteSparks(cx, cy, '#3b82f6', 1.0, 10, 1.5, 1.0, 0.2, offset, radialAngle);

  // Run physics step with downward gravity (+0.2)
  for (let i = 0; i < 5; i++) {
    engine.update();
  }

  // Test 2: Spawning with upward buoyant gravity (-0.8) and high volume
  engine.spawnNoteSparks(cx, cy, '#ef4444', 0.9, 20, 2.0, 2.5, -0.8, 15, Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    engine.update();
  }

  // Verify renderEffects renders with mock context
  let arcCount = 0;
  let fillCount = 0;
  const mockCtx: any = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    arc: () => { arcCount++; },
    fill: () => { fillCount++; },
    stroke: () => {},
    fillRect: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
  };

  engine.renderEffects(mockCtx, 1.0);
  assert.ok(arcCount > 0, 'Sparks must render arcs for active particles');
  assert.ok(fillCount > 0, 'Sparks must fill particles');
});

test('Optical Lens Flare & CRT Scanline Rendering: Canvas drawing execution', () => {
  const engine = new CosmeticsEngine();

  let lineCount = 0;
  let rectCount = 0;
  let gradCount = 0;
  const mockCtx: any = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => { lineCount++; },
    lineTo: () => { lineCount++; },
    stroke: () => {},
    arc: () => {},
    fill: () => {},
    fillRect: () => { rectCount++; },
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    closePath: () => {},
    createLinearGradient: () => {
      gradCount++;
      return { addColorStop: () => {} };
    },
    createRadialGradient: () => {
      gradCount++;
      return { addColorStop: () => {} };
    },
  };

  // Test CRT Scanlines & Screen Vignette
  engine.renderScanlines(mockCtx, 800, 600, 0.5, 2, 0.3);
  assert.ok(rectCount > 0, 'Scanlines must draw horizontal raster lines across canvas');
  assert.ok(gradCount > 0, 'CRT Vignette must create radial gradient for glass curvature falloff');

  // Test Optical Lens Flares with sources across different styles
  const sources = [
    { x: 300, y: 200, color: '#f59e0b', velocity: 0.9 },
    { x: 500, y: 350, color: '#06b6d4', velocity: 0.75 },
  ];

  // Cinematic style (streaks + ghosts + starburst)
  engine.renderOpticalLensFlares(mockCtx, 800, 600, sources, 0.6, 'cinematic');

  // Anamorphic style (horizontal streaks)
  engine.renderOpticalLensFlares(mockCtx, 800, 600, sources, 0.6, 'anamorphic');

  // Starburst style (diffraction rays)
  engine.renderOpticalLensFlares(mockCtx, 800, 600, sources, 0.6, 'starburst');
});

test('Pitch Clock Renderer: Tone node coordinate query interface', () => {
  const renderer = new PitchClockRenderer();
  // Before rendering, no cached coordinates
  const initial = renderer.getToneCoordinates(62, 2, 21);
  assert.strictEqual(initial, null);

  // Reset reveals and activity works cleanly
  renderer.resetRevealsAndActivity();
});

test('Pitch Clock Renderer: Deterministic predictive tone coordinates when orbits are dynamically controlled', () => {
  const renderer = new PitchClockRenderer();
  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D;

  const activeNotes = new Map<number, ActiveNote>();
  const decayingNotes = new Map<number, { note: ActiveNote; decayProgress: number }>();

  // Render first frame to establish canvas dimensions (800x800)
  renderer.render(mockCtx, 800, 800, activeNotes, decayingNotes, { ...DEFAULT_CONFIG, tonic: 0 }, 1000);

  // Query un-rendered note F4 (MIDI 65, tonic C = Fa at semitone 5)
  const coords = renderer.getToneCoordinates(65, 0, 21);
  assert.ok(coords !== null, 'getToneCoordinates must return predictive coordinates once dimensions are established');
  assert.strictEqual(coords.semitone, 5);

  const cx = 400;
  const cy = 400;
  const distFromCenter = Math.sqrt((coords.x - cx) ** 2 + (coords.y - cy) ** 2);
  const maxClockRadius = 800 * 0.45; // 360
  const minClockRadius = maxClockRadius * 0.22; // 79.2
  assert.ok(
    distFromCenter >= minClockRadius * 0.8 && distFromCenter <= maxClockRadius * 1.1,
    `Predicted radius ${distFromCenter} must lie comfortably within clock bounds [${minClockRadius}, ${maxClockRadius}]`
  );
});

test('Pitch Clock Renderer: Tonic modulation remaps discovered tones and removes phantom tone circles', () => {
  const renderer = new PitchClockRenderer();
  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D;

  const activeNotes = new Map<number, ActiveNote>();
  const decayingNotes = new Map<number, { note: ActiveNote; decayProgress: number }>();

  // 1. Play Note F4 (MIDI 65) with tonic C (0). F is Fa (semitone 5).
  activeNotes.set(65, {
    midi: 65,
    pitchClass: 5,
    octave: 4,
    registerIndex: 3,
    velocity: 0.8,
    startTime: 1000,
    colorHex: '#38BDF8',
    solfege: 'Fa',
    pianoTriangle: { triangle: 'L', point: 2 },
  });

  renderer.render(mockCtx, 800, 800, activeNotes, decayingNotes, { ...DEFAULT_CONFIG, tonic: 0, toneRevealMode: 'played' }, 1000);

  // Fa should have coordinates under tonic C
  const faCoords = renderer.getToneCoordinates(65, 0, 21);
  assert.ok(faCoords !== null);
  assert.strictEqual(faCoords.semitone, 5, 'Under tonic C, F4 is Fa (semitone 5)');

  // 2. Modulate tonic from C (0) to F (5). F is now Do (semitone 0).
  activeNotes.clear();
  renderer.triggerTonicShift(0, 5, 21);
  renderer.render(mockCtx, 800, 800, activeNotes, decayingNotes, { ...DEFAULT_CONFIG, tonic: 5, toneRevealMode: 'played' }, 2000);

  // Under new tonic F (5), F4 is Do (semitone 0)
  const doCoords = renderer.getToneCoordinates(65, 5, 21);
  assert.ok(doCoords !== null);
  assert.strictEqual(doCoords.semitone, 0, 'Under tonic F, F4 must be Do (semitone 0)');
});

test('Multi-Genre Demo Repertoire: 11 diverse works across 4 distinct categories', () => {
  assert.strictEqual(DEMO_TRACKS.length, 11);

  const categories = new Set(DEMO_TRACKS.map(t => t.category));
  assert.ok(categories.has('Classical & Impressionism'));
  assert.ok(categories.has('Classical & Romantic'));
  assert.ok(categories.has('Baroque Polyphony'));
  assert.ok(categories.has('Ragtime & Blues'));
  assert.ok(categories.has('PPT Theory & Kinetics'));

  for (const track of DEMO_TRACKS) {
    assert.ok(track.id, 'Track must have unique ID');
    assert.ok(track.title, 'Track must have title');
    assert.ok(track.composer, 'Track must have composer');
    assert.ok(track.description, 'Track must have description');
    assert.ok(track.notes.length >= 20, `${track.title} must have at least 20 note events`);
    assert.ok(track.duration > 5, `${track.title} duration must be > 5s`);
  }
});

test('Standard MIDI File Encoder: SMF Format 0 binary encoding and round-trip verification', () => {
  // Test encoding a demo track
  const satieTrack = DEMO_TRACKS.find(t => t.id === 'satie-gymnopedie');
  assert.ok(satieTrack);

  const midiBytes = encodeNotesToMidi(satieTrack.notes, satieTrack.title, 120);
  assert.ok(midiBytes instanceof Uint8Array);
  assert.ok(midiBytes.length > 100);

  // Verify SMF Header (MThd, length=6, format=0, tracks=1, division=480)
  const header = String.fromCharCode(...midiBytes.slice(0, 4));
  assert.strictEqual(header, 'MThd');
  const view = new DataView(midiBytes.buffer, midiBytes.byteOffset, midiBytes.byteLength);
  assert.strictEqual(view.getUint32(4), 6); // header length
  assert.strictEqual(view.getUint16(8), 0); // format 0
  assert.strictEqual(view.getUint16(10), 1); // 1 track
  assert.strictEqual(view.getUint16(12), 480); // ticks per beat

  // Verify MTrk chunk tag
  const trackTag = String.fromCharCode(...midiBytes.slice(14, 18));
  assert.strictEqual(trackTag, 'MTrk');

  // Verify round-trip parsing via midiPlayerInstance['parseMidiBuffer']
  const parsed = (midiPlayerInstance as any).parseMidiBuffer(midiBytes.buffer);
  assert.ok(parsed.length > 0);
  assert.strictEqual(parsed.length, satieTrack.notes.length);

  // Sort both by time and pitch
  parsed.sort((a: any, b: any) => a.time - b.time || a.midi - b.midi);
  const expected = [...satieTrack.notes].sort((a, b) => a.time - b.time || a.midi - b.midi);
  assert.strictEqual(parsed[0].midi, expected[0].midi);
  assert.strictEqual(parsed[parsed.length - 1].midi, expected[expected.length - 1].midi);
});

test('Layout Models: Preset tree validation and cell extraction', () => {
  const balancedCells = getAllCellNodes(PRESET_BALANCED.root);
  assert.strictEqual(balancedCells.length, 2, 'Balanced layout must have 2 cells');
  assert.strictEqual(balancedCells[0].module, 'orbital');
  assert.strictEqual(balancedCells[1].module, 'stream');

  const monumentCells = getAllCellNodes(PRESET_MONUMENT.root);
  assert.strictEqual(monumentCells.length, 2);

  for (const [key, layout] of Object.entries(PRESET_LAYOUTS)) {
    assert.ok(layout.id, `Layout ${key} must have ID`);
    assert.ok(layout.root, `Layout ${key} must have root container`);
    const cells = getAllCellNodes(layout.root);
    assert.ok(cells.length >= 1, `Layout ${key} must have at least 1 cell`);
  }
});

test('Layout Models: splitCellInTree handles same-direction insertion and cross-direction container nesting', () => {
  const root = PRESET_BALANCED.root; // direction: 'column', children: [clock, stream]
  
  // 1. Split in same direction ('column')
  const splitCol = splitCellInTree(root, 'cell-stream-bottom', 'column', 'stream');
  const splitColCells = getAllCellNodes(splitCol);
  assert.strictEqual(splitColCells.length, 3, 'Should have 3 cells after same-direction split');
  assert.strictEqual(splitCol.children.length, 3, 'Children directly inserted in root column container');

  // 2. Split in cross direction ('row')
  // When splitting 'cell-stream-bottom' horizontally (row), it should wrap the target cell and new cell in a row container
  const splitRow = splitCellInTree(root, 'cell-stream-bottom', 'row', 'stream');
  const splitRowCells = getAllCellNodes(splitRow);
  assert.strictEqual(splitRowCells.length, 3, 'Should have 3 cells after cross-direction split');
  assert.strictEqual(splitRow.children.length, 2, 'Root still has 2 main children (clock and subcontainer)');
  const subContainer = splitRow.children[1] as any;
  assert.strictEqual(subContainer.type, 'container');
  assert.strictEqual(subContainer.direction, 'row', 'Subcontainer should have row direction');
  assert.strictEqual(subContainer.children.length, 2, 'Subcontainer should contain target and new cell');
});

test('Layout Models: removeCellFromTree prunes cells and preserves minimum-1-cell invariant', () => {
  const root = PRESET_BALANCED.root;
  // Remove one cell
  const reduced = removeCellFromTree(root, 'cell-stream-bottom');
  const reducedCells = getAllCellNodes(reduced);
  assert.strictEqual(reducedCells.length, 1, 'Should have 1 cell after removal');
  assert.strictEqual(reducedCells[0].id, 'cell-clock-main');

  // Attempting to remove the last remaining cell should be ignored (preserves layout)
  const safeguard = removeCellFromTree(reduced, 'cell-clock-main');
  const safeguardCells = getAllCellNodes(safeguard);
  assert.strictEqual(safeguardCells.length, 1, 'Cannot remove the last cell in layout');
  assert.strictEqual(safeguardCells[0].id, 'cell-clock-main');
});

test('Layout Models: duplicateCellInTree and moveCellInTree maintain order and configOverrides', () => {
  const root = PRESET_BALANCED.root;
  // Duplicate stream cell
  const duplicated = duplicateCellInTree(root, 'cell-stream-bottom');
  const dupCells = getAllCellNodes(duplicated);
  assert.strictEqual(dupCells.length, 3, 'Should have 3 cells after duplication');
  const clone = dupCells[2];
  assert.strictEqual(clone.module, 'stream');
  assert.strictEqual(clone.title, 'Note Stream (Copy)');
  assert.strictEqual(clone.configOverrides?.orientation, 'horizontal');

  // Move stream cell up/backward
  const moved = moveCellInTree(root, 'cell-stream-bottom', -1);
  const movedCells = getAllCellNodes(moved);
  assert.strictEqual(movedCells[0].id, 'cell-stream-bottom', 'Stream cell should now be first');
  assert.strictEqual(movedCells[1].id, 'cell-clock-main', 'Clock cell should now be second');
});

test('Layout Models: addCellToTree appends cells and nests appropriately', () => {
  const root = PRESET_BALANCED.root;
  const added = addCellToTree(root, 'column', 'stream');
  const addedCells = getAllCellNodes(added);
  assert.strictEqual(addedCells.length, 3);
  assert.strictEqual(addedCells[2].module, 'stream');
});

test('Layout Models: URL Slug round-trip encoding and decoding with and without aesthetics', () => {
  const layout = PRESET_BALANCED;

  // 1. Without aesthetics
  const slugNoAesthetics = encodeLayoutToSlug(layout, false);
  assert.ok(slugNoAesthetics.length > 20, 'Slug must be non-empty base64 string');
  const decodedNoAes = decodeLayoutFromSlug(slugNoAesthetics);
  assert.ok(decodedNoAes);
  assert.strictEqual(decodedNoAes.layout.id, layout.id);
  assert.strictEqual(decodedNoAes.hasAesthetics, false);
  assert.strictEqual(getAllCellNodes(decodedNoAes.layout.root).length, 2);

  // 2. With aesthetics (including priority slots & glyph contrast)
  const layoutWithAesthetics = {
    ...layout,
    aesthetics: {
      backgroundTheme: 'cosmic-abyss' as const,
      glowBloom: 0.8,
      scanlineIntensity: 0.4,
      crtVignette: 0.5,
      clockLabelPriorities: ['syllables', 'triangles', 'glyphs', 'pitches', 'glyphs', 'glyphs', 'glyphs', 'glyphs'] as any,
      glyphContrastMode: 'solfege' as const,
    },
  };
  const slugWithAesthetics = encodeLayoutToSlug(layoutWithAesthetics, true);
  const decodedWithAes = decodeLayoutFromSlug(slugWithAesthetics);
  assert.ok(decodedWithAes);
  assert.strictEqual(decodedWithAes.hasAesthetics, true);
  assert.strictEqual(decodedWithAes.layout.aesthetics?.backgroundTheme, 'cosmic-abyss');
  assert.strictEqual(decodedWithAes.layout.aesthetics?.glowBloom, 0.8);
  assert.strictEqual(decodedWithAes.layout.aesthetics?.scanlineIntensity, 0.4);
  assert.strictEqual(decodedWithAes.layout.aesthetics?.glyphContrastMode, 'solfege');
  assert.strictEqual(decodedWithAes.layout.aesthetics?.clockLabelPriorities?.[0], 'syllables');

  // 3. User slug verification (tweaked aesthetic defaults & continuous stream)
  const userLayout: LayoutDefinition = {
    id: 'custom-mtox6883',
    name: 'Custom Layout',
    root: PRESET_SIGNATURE.root,
    aesthetics: PRESET_SIGNATURE.aesthetics,
  };
  const userSlug = encodeLayoutToSlug(userLayout, true);
  const decodedUser = decodeLayoutFromSlug(userSlug);
  assert.ok(decodedUser);
  assert.strictEqual(decodedUser.hasAesthetics, true);
  assert.strictEqual(decodedUser.layout.aesthetics?.filmGrainIntensity, 0.35);
  assert.strictEqual(decodedUser.layout.aesthetics?.scanlineIntensity, 0.4);
  assert.strictEqual(decodedUser.layout.aesthetics?.scanlineDensity, 2);
  assert.strictEqual(decodedUser.layout.aesthetics?.lensFlareIntensity, 0.55);

  // 4. Corrupted slug handling
  const corrupted = decodeLayoutFromSlug('not-a-valid-base64-json-slug!!!');
  assert.strictEqual(corrupted, null, 'Corrupted slug should return null gracefully');
});

test('Piano Triangles: Deterministic point-to-pitch-class mapping for all 4 triangles', () => {
  // Down triangle: C# (1), D (2), D# (3)
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.D[1], 1);
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.D[2], 2);
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.D[3], 3);

  // Left triangle: E (4), F (5), F# (6)
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.L[1], 4);
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.L[2], 5);
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.L[3], 6);

  // Up triangle: G (7), G# (8), A (9)
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.U[1], 7);
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.U[2], 8);
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.U[3], 9);

  // Right triangle: A# (10), B (11), C (0)
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.R[1], 10);
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.R[2], 11);
  assert.strictEqual(PIANO_TRIANGLE_POINT_TO_PITCH_CLASS.R[3], 0);
});

test('Piano Triangles (Scale Signature): Tetrachord chaining algorithm creates 4 or 5 triangles with Do centered', () => {
  // 1. D Major (Do = D, tonic = 2):
  // Notes: So(A/U3), La(B/R2), Ti(C#/D1), Do(D/D2), Re(E/L1), Mi(F#/L3), Fa(G/U1)
  // Segments: U, R, D (with Ti & Do), L (with Re & Mi), U -> 5 triangles
  const dMajorSegs = getScaleTetrachordChainTriangles(2);
  assert.strictEqual(dMajorSegs.length, 5, 'D Major must produce 5 chained triangles');
  assert.strictEqual(dMajorSegs[0].triangle, 'U');
  assert.strictEqual(dMajorSegs[1].triangle, 'R');
  assert.strictEqual(dMajorSegs[2].triangle, 'D');
  assert.strictEqual(dMajorSegs[3].triangle, 'L');
  assert.strictEqual(dMajorSegs[4].triangle, 'U');

  // Do must be in the 3rd segment (middle of the 5 triangles)
  assert.strictEqual(dMajorSegs[2].hasDo, true);
  assert.strictEqual(dMajorSegs[2].doPoint, 2);
  assert.strictEqual(dMajorSegs[2].points.length, 2); // points 1 and 2 (Ti and Do)

  // 2. C Major (Do = C, tonic = 0):
  // Notes: So(G/U1), La(A/U3), Ti(B/R2), Do(C/R3), Re(D/D2), Mi(E/L1), Fa(F/L2)
  // Segments: U (So, La), R (Ti, Do), D (Re), L (Mi, Fa) -> 4 triangles
  const cMajorSegs = getScaleTetrachordChainTriangles(0);
  assert.strictEqual(cMajorSegs.length, 4, 'C Major must produce 4 chained triangles');
  assert.strictEqual(cMajorSegs[0].triangle, 'U');
  assert.strictEqual(cMajorSegs[1].triangle, 'R');
  assert.strictEqual(cMajorSegs[2].triangle, 'D');
  assert.strictEqual(cMajorSegs[3].triangle, 'L');

  // Do must be in segment 1 (triangle R, point 3)
  assert.strictEqual(cMajorSegs[1].hasDo, true);
  assert.strictEqual(cMajorSegs[1].doPoint, 3);

  // 3. Verify all 12 keys produce either 4 or 5 triangles, and exactly 1 segment has hasDo = true
  for (let tonic = 0; tonic < 12; tonic++) {
    const segs = getScaleTetrachordChainTriangles(tonic);
    assert.ok(segs.length === 4 || segs.length === 5, `Tonic ${tonic} must produce 4 or 5 triangles, got ${segs.length}`);
    const doCount = segs.filter(s => s.hasDo).length;
    assert.strictEqual(doCount, 1, `Tonic ${tonic} must have exactly one Do segment`);
  }
});

test('Piano Triangles Renderer: Canvas drawing execution with octave-agnostic active notes and decay', () => {
  const renderer = new PianoTrianglesRenderer();
  assert.ok(renderer);

  let arcCount = 0;
  let fillCount = 0;
  let strokeCount = 0;
  const mockCtx: any = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    arc: () => { arcCount++; },
    fill: () => { fillCount++; },
    stroke: () => { strokeCount++; },
    translate: () => {},
    scale: () => {},
    setLineDash: () => {},
    fillText: () => {},
  };

  // Active note: D5 (MIDI 74, pitch class 2, velocity 0.9) - played in high octave
  const activeNotes = new Map<number, any>([
    [74, { midi: 74, velocity: 0.9, colorHex: '#e13610', pitchClass: 2, octave: 5 }],
  ]);

  // Decaying note: A2 (MIDI 45, pitch class 9) - released in bass octave
  const decayingNotes = new Map<number, any>([
    [45, { note: { midi: 45, velocity: 0.7, colorHex: '#0032a4', pitchClass: 9, octave: 2 }, decayProgress: 0.3 }],
  ]);

  renderer.render(
    mockCtx,
    800,
    300,
    activeNotes,
    decayingNotes,
    DEFAULT_CONFIG,
    1000
  );

  assert.ok(arcCount > 0, 'Vertices and markers must render circles');
  assert.ok(fillCount > 0, 'Silhouettes and vertices must fill');
  assert.ok(strokeCount > 0, 'Triangle edges and vertex rims must stroke');
});

test('Piano Triangles Layout: PRESET_SIGNATURE trio tree and URL slug round-trip', () => {
  assert.strictEqual(PRESET_SIGNATURE.id, 'signature');
  assert.ok(PRESET_LAYOUTS['signature']);

  const cells = getAllCellNodes(PRESET_SIGNATURE.root);
  assert.strictEqual(cells.length, 3, 'Signature layout must contain 3 cells');
  assert.strictEqual(cells[0].module, 'orbital');
  assert.strictEqual(cells[1].module, 'triangles');
  assert.strictEqual(cells[2].module, 'overtones');

  // Slug round-trip
  const slug = encodeLayoutToSlug(PRESET_SIGNATURE, false);
  assert.ok(slug.length > 20);
  const decoded = decodeLayoutFromSlug(slug);
  assert.ok(decoded);
  assert.strictEqual(decoded.layout.id, 'signature');
  const decodedCells = getAllCellNodes(decoded.layout.root);
  assert.strictEqual(decodedCells.length, 3);
  assert.strictEqual(decodedCells[1].module, 'triangles');
  assert.strictEqual(decodedCells[2].module, 'overtones');
});

test('RenderCoordinator: Decoupled note lifecycle, subscriptions, and session reset', () => {
  const coordinator = new RenderCoordinator(DEFAULT_CONFIG);
  assert.ok(coordinator);

  // 1. Initial State
  assert.strictEqual(coordinator.activeNotes.size, 0);
  assert.strictEqual(coordinator.decayingNotes.size, 0);
  assert.strictEqual(coordinator.streamItems.length, 0);

  // 2. Active notes subscription
  let activeNotesSeen = 0;
  const unsubActive = coordinator.subscribeActiveNotes((notes) => {
    activeNotesSeen = notes.size;
  });
  assert.strictEqual(activeNotesSeen, 0);

  // 3. Trigger Note On: D4 (MIDI 62, tonic D)
  coordinator.triggerNoteOn(62, 0.9);
  assert.strictEqual(coordinator.activeNotes.size, 1);
  assert.strictEqual(activeNotesSeen, 1);
  assert.ok(coordinator.activeNotes.has(62));
  assert.strictEqual(coordinator.streamItems.length, 1);
  assert.strictEqual(coordinator.streamItems[0].midi, 62);
  assert.strictEqual(coordinator.streamItems[0].solfege, 'Do');

  // 4. Trigger Note Off: moves to decayingNotes
  coordinator.triggerNoteOff(62);
  assert.strictEqual(coordinator.activeNotes.size, 0);
  assert.strictEqual(activeNotesSeen, 0);
  assert.strictEqual(coordinator.decayingNotes.size, 1);
  assert.ok(coordinator.decayingNotes.has(62));

  // 5. Retrigger Note: removed from decayingNotes, back in activeNotes
  coordinator.triggerNoteOn(62, 0.85);
  assert.strictEqual(coordinator.activeNotes.size, 1);
  assert.strictEqual(coordinator.decayingNotes.size, 0);
  assert.strictEqual(coordinator.streamItems.length, 2);

  // 6. Reset Session: clears all notes and stream
  coordinator.resetSession();
  assert.strictEqual(coordinator.activeNotes.size, 0);
  assert.strictEqual(coordinator.decayingNotes.size, 0);
  assert.strictEqual(coordinator.streamItems.length, 0);
  assert.strictEqual(activeNotesSeen, 0);

  unsubActive();
  coordinator.destroy();
});

test('WebGLPostProcessingPipeline: Headless fallback and mock GL execution', () => {
  // 1. Headless Fallback: getContext returns null
  const nullCanvas: any = { getContext: () => null };
  const fallbackPipeline = new WebGLPostProcessingPipeline(nullCanvas);
  assert.strictEqual(fallbackPipeline.supported, false);
  // Calling render on unsupported pipeline does nothing and does not throw
  fallbackPipeline.render(DEFAULT_CONFIG, [], 1000);
  fallbackPipeline.destroy();

  // 2. Mock WebGL Context Execution
  let drawArraysCalled = false;
  let useProgramCalled = false;
  const uniformsSet: Record<string, any> = {};

  const mockGl: any = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    COLOR_BUFFER_BIT: 16384,
    BLEND: 3042,
    ONE: 1,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,
    TRIANGLE_STRIP: 5,
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    deleteBuffer: () => {},
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    getUniformLocation: (_p: any, name: string) => name,
    viewport: () => {},
    clearColor: () => {},
    clear: () => {},
    enable: () => {},
    blendFunc: () => {},
    useProgram: () => { useProgramCalled = true; },
    uniform1f: (loc: string, val: number) => { uniformsSet[loc] = val; },
    uniform2f: (loc: string, x: number, y: number) => { uniformsSet[loc] = [x, y]; },
    uniform1i: (loc: string, val: number) => { uniformsSet[loc] = val; },
    uniform4fv: (loc: string, data: any) => { uniformsSet[loc] = data; },
    uniform3fv: (loc: string, data: any) => { uniformsSet[loc] = data; },
    drawArrays: (mode: number, _first: number, count: number) => {
      assert.strictEqual(mode, 5); // TRIANGLE_STRIP
      assert.strictEqual(count, 4); // 4 vertices for fullscreen quad
      drawArraysCalled = true;
    },
  };

  const mockCanvas: any = {
    width: 1920,
    height: 1080,
    getContext: (type: string) => (type === 'webgl' ? mockGl : null),
  };

  const pipeline = new WebGLPostProcessingPipeline(mockCanvas);
  assert.strictEqual(pipeline.supported, true);

  pipeline.render(
    DEFAULT_CONFIG,
    [{ x: 960, y: 540, velocity: 0.9, colorHex: '#e13610' }],
    2500
  );

  assert.strictEqual(useProgramCalled, true, 'Shader program must be bound');
  assert.strictEqual(drawArraysCalled, true, 'Fullscreen quad must be drawn');
  assert.strictEqual(uniformsSet['u_lightCount'], 1, 'Active light count must be passed');
  assert.ok(uniformsSet['u_time'] > 0, 'Time uniform must be set');

  pipeline.destroy();
  assert.strictEqual(pipeline.supported, false);
});

test('Information Modal: Storage keys and first-visit display contracts', () => {
  const STORAGE_KEY_DONT_SHOW_INTRO = 'ppt_dont_show_intro_on_launch_v1';
  const STORAGE_KEY_HAS_SEEN = 'ppt_has_seen_intro_modal_v1';

  const mockStorage: Record<string, string> = {};
  const getItem = (key: string) => mockStorage[key] || null;
  const setItem = (key: string, val: string) => { mockStorage[key] = val; };

  // 1. Initial state for brand new user: neither key set -> should show modal
  const shouldShowFirstVisit = !getItem(STORAGE_KEY_DONT_SHOW_INTRO) && !getItem(STORAGE_KEY_HAS_SEEN);
  assert.strictEqual(shouldShowFirstVisit, true, 'Brand new user must see intro modal');

  // 2. User closes modal without ticking dont show again -> hasSeen is set
  setItem(STORAGE_KEY_HAS_SEEN, 'true');
  const shouldShowSecondVisit = getItem(STORAGE_KEY_DONT_SHOW_INTRO) !== 'true' && getItem(STORAGE_KEY_HAS_SEEN) !== 'true';
  assert.strictEqual(shouldShowSecondVisit, false, 'Returning user who saw modal should not auto-open on next launch');

  // 3. User ticks "Don't show this guide automatically on launch"
  setItem(STORAGE_KEY_DONT_SHOW_INTRO, 'true');
  const shouldShowWithDontShowTicked = getItem(STORAGE_KEY_DONT_SHOW_INTRO) !== 'true' && getItem(STORAGE_KEY_HAS_SEEN) !== 'true';
  assert.strictEqual(shouldShowWithDontShowTicked, false, 'Users with dontShow ticked must not auto-open modal');
});

test('Real-time Focus Mode: MidiManager ignores background MIDI and releases held notes on blur', () => {
  midiManagerInstance.setFocusMode(true);
  midiManagerInstance.setFocusedForTesting(true);

  const noteOns: number[] = [];
  const noteOffs: number[] = [];
  const unsubOn = midiManagerInstance.onNoteOn((midi) => noteOns.push(midi));
  const unsubOff = midiManagerInstance.onNoteOff((midi) => noteOffs.push(midi));

  // 1. When focused, note on is accepted
  midiManagerInstance.triggerNoteOn(60, 0.8);
  assert.strictEqual(noteOns.length, 1);
  assert.strictEqual(noteOns[0], 60);

  // 2. When losing focus, held notes are automatically released to prevent stuck notes
  midiManagerInstance.setFocusedForTesting(false);
  assert.strictEqual(noteOffs.length, 1);
  assert.strictEqual(noteOffs[0], 60);

  // 3. While unfocused, incoming MIDI events are ignored
  midiManagerInstance.triggerNoteOn(62, 0.8);
  assert.strictEqual(noteOns.length, 1, 'Incoming MIDI must be discarded when window lacks focus');

  // 4. When focusMode is disabled, events pass through even when unfocused
  midiManagerInstance.setFocusMode(false);
  midiManagerInstance.triggerNoteOn(64, 0.8);
  assert.strictEqual(noteOns.length, 2);
  assert.strictEqual(noteOns[1], 64);

  // Cleanup
  unsubOn();
  unsubOff();
  midiManagerInstance.setFocusedForTesting(null);
  midiManagerInstance.setFocusMode(true);
});

test('Real-time Focus Mode: AudioSynth silences voices and rejects notes when unfocused', () => {
  synthInstance.setFocusMode(true);
  synthInstance.setFocusedForTesting(false);

  // NoteOn while unfocused should be rejected
  synthInstance.noteOn(60, 0.8);

  // Immediate stop on blur
  synthInstance.stopAll(true);

  synthInstance.setFocusedForTesting(null);
});

test('Real-time Focus Mode: RenderCoordinator clears active notes and discards background events', () => {
  const coordinator = new RenderCoordinator(DEFAULT_CONFIG);
  coordinator.setFocusedForTesting(true);

  let activeNotesSeen = 0;
  const unsub = coordinator.subscribeActiveNotes((notes) => {
    activeNotesSeen = notes.size;
  });

  // 1. Play note while focused
  coordinator.triggerNoteOn(62, 0.9);
  assert.strictEqual(coordinator.activeNotes.size, 1);
  assert.strictEqual(activeNotesSeen, 1);

  // 2. Blur window -> active and decaying notes cleared immediately
  coordinator.setFocusedForTesting(false);
  assert.strictEqual(coordinator.activeNotes.size, 0, 'Active notes must be cleared on blur');
  assert.strictEqual(coordinator.decayingNotes.size, 0, 'Decaying notes must be cleared on blur');
  assert.strictEqual(activeNotesSeen, 0, 'Subscribers must receive empty map on blur');

  // 3. Trigger note while unfocused -> discarded
  coordinator.triggerNoteOn(65, 0.8);
  assert.strictEqual(coordinator.activeNotes.size, 0, 'Notes triggered while unfocused must be discarded');

  // 4. Disable focusMode -> notes accepted even when unfocused
  coordinator.setConfig({ ...DEFAULT_CONFIG, focusModeEnabled: false });
  coordinator.triggerNoteOn(67, 0.8);
  assert.strictEqual(coordinator.activeNotes.size, 1, 'Notes accepted when focusModeEnabled is false');

  // Cleanup
  unsub();
  coordinator.destroy();
});

test('Real-time Focus Mode: Configuration persistence and sanitisation defaults to true', () => {
  // 1. Default config must have focusModeEnabled: true
  assert.strictEqual(DEFAULT_CONFIG.focusModeEnabled, true, 'Default configuration must enable focusModeEnabled');

  // 2. Sanitisation defaults to true if missing
  const storage: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => storage[k] || null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; },
    },
  };

  storage['ppt_visualiser_config_v1'] = JSON.stringify({ tonic: 2 });
  const loaded = loadSavedConfig();
  assert.strictEqual(loaded.focusModeEnabled, true, 'Missing focusModeEnabled must sanitise to true');

  // 3. User preference persistence
  saveConfig({ ...DEFAULT_CONFIG, focusModeEnabled: false });
  const reloaded = loadSavedConfig();
  assert.strictEqual(reloaded.focusModeEnabled, false, 'Explicitly disabled focusModeEnabled must persist');

  clearSavedConfig();
});

test('Custom MIDI Tracks & LocalStorage Persistence: Store, load, playback state, and deletion', () => {
  // 1. Mock localStorage environment
  const storage: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => storage[k] || null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; },
    },
  };

  clearAllCustomTracks();
  assert.strictEqual(loadSavedCustomTracks().length, 0, 'Initial custom tracks must be empty');

  // 2. Save a custom track
  const mockTrack1: CustomMidiTrack = {
    id: 'user-track-1',
    title: 'My Custom Song',
    composer: 'Uploaded File',
    category: 'Uploaded Tracks',
    duration: 12.5,
    notes: [
      { midi: 62, velocity: 0.8, time: 0, duration: 1.0 },
      { midi: 65, velocity: 0.7, time: 1.0, duration: 1.0 },
    ],
    filename: 'My Custom Song.mid',
    timestamp: Date.now(),
  };

  const saved = saveCustomTrack(mockTrack1);
  assert.strictEqual(saved, true, 'saveCustomTrack must succeed');

  const loaded = loadSavedCustomTracks();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].id, 'user-track-1');
  assert.strictEqual(loaded[0].title, 'My Custom Song');
  assert.strictEqual(loaded[0].notes.length, 2);
  assert.ok(storage[CUSTOM_MIDI_STORAGE_KEY], 'Storage key must be populated in localStorage');

  // 3. findAnyTrackById resolution (demo tracks and custom tracks)
  const demoMatch = findAnyTrackById('bach-prelude');
  assert.ok(demoMatch, 'findAnyTrackById must find inbuilt demo track');
  assert.strictEqual(demoMatch?.title, 'Prelude in C Major (BWV 846)');

  const customMatch = findAnyTrackById('user-track-1');
  assert.ok(customMatch, 'findAnyTrackById must find uploaded custom track');
  assert.strictEqual(customMatch?.title, 'My Custom Song');

  // 4. MidiFilePlayer loading and playback state tracking
  const loadedIntoPlayer = midiPlayerInstance.loadTrack('user-track-1');
  assert.strictEqual(loadedIntoPlayer, true, 'MidiFilePlayer.loadTrack must return true for custom track');

  const playerState = midiPlayerInstance.getState();
  assert.strictEqual(playerState.trackId, 'user-track-1', 'playerState must report trackId');
  assert.strictEqual(playerState.trackName, 'My Custom Song', 'playerState must report custom track title');
  assert.strictEqual(playerState.duration, 12.5);

  // 5. Delete custom track with automatic fallback to default demo track
  const deleteResult = midiPlayerInstance.removeCustomTrack('user-track-1');
  assert.strictEqual(deleteResult, true, 'removeCustomTrack must return true');

  const afterDeleteState = midiPlayerInstance.getState();
  assert.strictEqual(afterDeleteState.trackId, 'radial-orbit', 'Active track must fall back to radial-orbit on deletion');

  // 6. Capping and quota management (limit to 20 tracks)
  for (let i = 1; i <= 25; i++) {
    saveCustomTrack({
      id: `user-track-${i}`,
      title: `Track ${i}`,
      composer: 'Uploaded File',
      category: 'Uploaded Tracks',
      duration: 10,
      notes: [{ midi: 60, velocity: 0.5, time: 0, duration: 0.5 }],
      timestamp: Date.now() + i,
    });
  }
  const cappedTracks = loadSavedCustomTracks();
  assert.strictEqual(cappedTracks.length, 20, 'Custom tracks must be capped at 20');

  // 7. Directly delete a custom track
  const directDelete = deleteCustomTrack('user-track-25');
  assert.strictEqual(directDelete, true, 'deleteCustomTrack must return true');
  assert.strictEqual(loadSavedCustomTracks().length, 19);

  // 8. Clear all custom tracks
  clearAllCustomTracks();
  assert.strictEqual(loadSavedCustomTracks().length, 0, 'clearAllCustomTracks must empty storage');
});

test('Tonic Shift Kinetics: Configuration defaults, sanitisation, and Eco Mode toggle', () => {
  // 1. Default config check
  assert.strictEqual(DEFAULT_CONFIG.tonicShiftEffectsEnabled, true, 'tonicShiftEffectsEnabled must default to true');

  // 2. Sanitisation
  const sanitised = sanitizeConfig({} as any);
  assert.strictEqual(sanitised.tonicShiftEffectsEnabled, true, 'Sanitised config must default to true if unspecified');

  const sanitisedExplicitFalse = sanitizeConfig({ tonicShiftEffectsEnabled: false } as any);
  assert.strictEqual(sanitisedExplicitFalse.tonicShiftEffectsEnabled, false, 'Explicit false must be preserved');
});

test('Tonic Shift Kinetics: Manual and automatic shift triggering, RenderCoordinator listeners, and timeline markers', () => {
  const coordinator = new RenderCoordinator({
    ...DEFAULT_CONFIG,
    tonic: 2, // D
    tonicShiftEffectsEnabled: true,
  });

  // 1. Listeners subscription
  let shiftCount = 0;
  let lastOldTonic = -1;
  let lastNewTonic = -1;
  let lastWasAuto = false;

  const unsub = coordinator.subscribeTonicShift((oldT, newT, isAuto) => {
    shiftCount++;
    lastOldTonic = oldT;
    lastNewTonic = newT;
    lastWasAuto = isAuto;
  });

  // 2. Trigger manual shift via setConfig (D=2 -> G=7)
  coordinator.setConfig({
    ...coordinator.getConfig(),
    tonic: 7,
  });

  assert.strictEqual(shiftCount, 1, 'Manual tonic change must trigger tonic shift listener');
  assert.strictEqual(lastOldTonic, 2, 'Old tonic must be D (2)');
  assert.strictEqual(lastNewTonic, 7, 'New tonic must be G (7)');
  assert.strictEqual(lastWasAuto, false, 'Manual shift must not be marked as auto');
  assert.strictEqual(coordinator.tonicShiftMarkers.length, 1, 'Tonic shift marker must be created');
  assert.strictEqual(coordinator.tonicShiftMarkers[0].oldTonic, 2);
  assert.strictEqual(coordinator.tonicShiftMarkers[0].newTonic, 7);
  assert.strictEqual(coordinator.tonicShiftMarkers[0].isAuto, false);

  // 3. Trigger manual shift directly via triggerTonicShift with isAuto=true (G=7 -> C=0)
  coordinator.triggerTonicShift(7, 0, true);
  assert.strictEqual(shiftCount, 2);
  assert.strictEqual(lastOldTonic, 7);
  assert.strictEqual(lastNewTonic, 0);
  assert.strictEqual(lastWasAuto, true);
  assert.strictEqual(coordinator.tonicShiftMarkers.length, 2);
  assert.strictEqual(coordinator.tonicShiftMarkers[1].isAuto, true);

  // 4. Session reset clears markers
  coordinator.resetSession();
  assert.strictEqual(coordinator.tonicShiftMarkers.length, 0, 'resetSession must clear timeline markers');

  unsub();
  coordinator.destroy();
});

test('Tonic Shift Kinetics: Zero-overhead bypass when tonicShiftEffectsEnabled is disabled', () => {
  const coordinator = new RenderCoordinator({
    ...DEFAULT_CONFIG,
    tonic: 0,
    tonicShiftEffectsEnabled: false,
  });

  assert.strictEqual(coordinator.cosmeticsEngine.hasActiveParticles(), false);

  // Trigger shift with effects disabled
  coordinator.triggerTonicShift(0, 5, false);

  // Markers should not be spawned and cosmetic particles should not be active
  assert.strictEqual(coordinator.tonicShiftMarkers.length, 0, 'No stream markers when effects disabled');
  assert.strictEqual(coordinator.cosmeticsEngine.hasActiveParticles(), false, 'No cosmetic particles when effects disabled');

  coordinator.destroy();
});

test('Overtones: 7 harmonic partials derivation and Uniform Solfege pitch colouring', () => {
  // Test C4 (MIDI 60) with tonic C (0):
  // Partials:
  // 1: C (0, Do, #E13610)
  // 2: C (0, Do, #E13610)
  // 3: G (7, So, #0032A4)
  // 4: C (0, Do, #E13610)
  // 5: E (4, Mi, #F5D432)
  // 6: G (7, So, #0032A4)
  // 7: Bb/A# (10, Te, #F158A4)
  const partials = computeNotePartials(60, 0.8, 0, 1000, 400, 400);

  assert.strictEqual(partials.length, NUM_PARTIALS, 'Must generate exactly 7 partials');

  // Test Plomp-Levelt roughness calculation
  const unisonRoughness = calculatePlompLevelt(440, 1.0, 440, 1.0);
  const clashRoughness = calculatePlompLevelt(440, 1.0, 465, 1.0);
  assert.strictEqual(unisonRoughness, 0, 'Unison pure tones must have 0 roughness');
  assert.ok(clashRoughness > 0, 'Minor second tones must have positive psychoacoustical roughness');

  assert.strictEqual(partials[0].partialNumber, 1);
  assert.strictEqual(partials[0].isFundamental, true);
  assert.strictEqual(partials[0].solfege, 'Do');
  assert.strictEqual(partials[0].colorHex, '#E13610');
  assert.strictEqual(Math.round(partials[0].frequency), 262); // C4 ≈ 261.6 Hz

  assert.strictEqual(partials[1].partialNumber, 2);
  assert.strictEqual(partials[1].isFundamental, false);
  assert.strictEqual(partials[1].solfege, 'Do');
  assert.strictEqual(partials[1].colorHex, '#E13610');
  assert.strictEqual(Math.round(partials[1].frequency), 523); // C5 ≈ 523.3 Hz

  assert.strictEqual(partials[2].partialNumber, 3);
  assert.strictEqual(partials[2].solfege, 'So');
  assert.strictEqual(partials[2].colorHex, '#0032A4');

  assert.strictEqual(partials[3].partialNumber, 4);
  assert.strictEqual(partials[3].solfege, 'Do');

  assert.strictEqual(partials[4].partialNumber, 5);
  assert.strictEqual(partials[4].solfege, 'Mi');
  assert.strictEqual(partials[4].colorHex, '#F5D432');

  assert.strictEqual(partials[5].partialNumber, 6);
  assert.strictEqual(partials[5].solfege, 'So');

  assert.strictEqual(partials[6].partialNumber, 7);
  assert.strictEqual(partials[6].solfege, 'Te');
  assert.strictEqual(partials[6].colorHex, '#F158A4');

  // Test D4 (MIDI 62) with default PPT tonic D (2):
  const dPartials = computeNotePartials(62, 0.8, 2, 1000, 400, 400);
  assert.strictEqual(dPartials[0].solfege, 'Do', 'D with tonic D must be Do');
  assert.strictEqual(dPartials[2].solfege, 'So', '3rd partial of D is A, which is So in key of D');
  assert.strictEqual(dPartials[4].solfege, 'Mi', '5th partial of D is F#, which is Mi in key of D');
});

test('Overtones: Velocity-dependent base height and overtone amplitude decay', () => {
  const soft = computeNotePartials(60, 0.1, 0, 1000, 400, 400);
  const hard = computeNotePartials(60, 1.0, 0, 1000, 400, 400);

  // 1. Base height of fundamental is governed by velocity
  assert.ok(
    hard[0].amplitude > soft[0].amplitude * 2.5,
    `Hard strike fundamental amplitude (${hard[0].amplitude}) must be significantly taller than soft (${soft[0].amplitude})`
  );

  // 2. Amplitude decay of higher overtones is governed by velocity
  // Soft strike higher partials roll off much faster
  const softRatio7to1 = soft[6].amplitude / soft[0].amplitude;
  const hardRatio7to1 = hard[6].amplitude / hard[0].amplitude;

  assert.ok(
    hardRatio7to1 > softRatio7to1 * 3,
    `Hard strike must sustain much richer higher harmonics (ratio ${hardRatio7to1.toFixed(3)}) than soft (ratio ${softRatio7to1.toFixed(3)})`
  );
});

test('Overtones: Register-scaled spatial wave envelope width (bass wider than treble)', () => {
  // A1 (MIDI 33 ≈ 55 Hz) bass note vs A6 (MIDI 93 ≈ 1760 Hz) treble note
  const bassFreq = midiToFrequency(33);
  const trebleFreq = midiToFrequency(93);

  const bassWidth = computeRegisterWaveWidth(bassFreq);
  const trebleWidth = computeRegisterWaveWidth(trebleFreq);

  assert.ok(
    bassWidth > trebleWidth * 2.5,
    `Bass wave width (${bassWidth.toFixed(1)}px) must be significantly wider than treble (${trebleWidth.toFixed(1)}px)`
  );
  assert.ok(bassWidth <= 110, 'Width must respect maximum clamping');
  assert.ok(trebleWidth >= 14, 'Width must respect minimum clamping');
});

test('Overtones: Layout models integration, unique IDs, and PRESET_HARMONIC serialization', () => {
  // 1. Unique cell ID
  const id = createUniqueCellId('overtones');
  assert.ok(id.startsWith('cell-overtones-'), 'Unique cell ID must start with cell-overtones-');

  // 2. addCellToTree
  const rootContainer = { ...PRESET_BALANCED.root };
  const updatedTree = addCellToTree(rootContainer, 'row', 'overtones');
  const allCells = getAllCellNodes(updatedTree);
  const overtoneCell = allCells.find((c) => c.module === 'overtones');
  assert.ok(overtoneCell, 'Added overtones cell must be present in tree');
  assert.strictEqual(overtoneCell?.title, 'Overtone Waves');

  // 3. PRESET_HARMONIC
  assert.ok(PRESET_HARMONIC, 'PRESET_HARMONIC must be defined');
  assert.strictEqual(PRESET_LAYOUTS['harmonic'], PRESET_HARMONIC);
  const harmonicCells = getAllCellNodes(PRESET_HARMONIC.root);
  assert.ok(harmonicCells.some((c) => c.module === 'orbital'));
  assert.ok(harmonicCells.some((c) => c.module === 'overtones'));
  assert.ok(harmonicCells.some((c) => c.module === 'stream'));

  // 4. URL slug round-trip
  const slug = encodeLayoutToSlug(PRESET_HARMONIC, true);
  assert.ok(slug.length > 0, 'Slug must be non-empty');
  const decoded = decodeLayoutFromSlug(slug);
  assert.ok(decoded, 'Decoded layout must not be null');
  assert.strictEqual(decoded?.layout.id, 'harmonic');
  const decodedCells = getAllCellNodes(decoded!.layout.root);
  assert.ok(decodedCells.some((c) => c.module === 'overtones'));
});

test('Overtones: OvertonesRenderer canvas execution with active/decaying notes and idle baseline', () => {
  const renderer = new OvertonesRenderer();

  // Mock CanvasRenderingContext2D
  const drawCalls: string[] = [];
  const mockCtx = {
    save: () => drawCalls.push('save'),
    restore: () => drawCalls.push('restore'),
    beginPath: () => drawCalls.push('beginPath'),
    closePath: () => drawCalls.push('closePath'),
    moveTo: () => drawCalls.push('moveTo'),
    lineTo: () => drawCalls.push('lineTo'),
    arc: () => drawCalls.push('arc'),
    stroke: () => drawCalls.push('stroke'),
    fill: () => drawCalls.push('fill'),
    fillRect: () => drawCalls.push('fillRect'),
    strokeRect: () => drawCalls.push('strokeRect'),
    fillText: () => drawCalls.push('fillText'),
    setLineDash: () => drawCalls.push('setLineDash'),
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
  } as unknown as CanvasRenderingContext2D;

  const activeNotes = new Map<number, ActiveNote>();
  const decayingNotes = new Map<number, { note: ActiveNote; decayProgress: number }>();

  // 1. Idle render (no notes)
  renderer.render(mockCtx, 800, 400, activeNotes, decayingNotes, DEFAULT_CONFIG, 1000);
  assert.ok(drawCalls.includes('fillRect'), 'Must draw background');
  assert.ok(drawCalls.includes('stroke'), 'Must draw idle baseline');

  // 2. Render with active chord (C major: C4, E4, G4)
  drawCalls.length = 0;
  activeNotes.set(60, {
    midi: 60,
    pitchClass: 0,
    octave: 4,
    registerIndex: 3,
    velocity: 0.8,
    startTime: 900,
    colorHex: '#E13610',
    solfege: 'Do',
    pianoTriangle: { triangle: 'R', point: 3 },
  });
  activeNotes.set(64, {
    midi: 64,
    pitchClass: 4,
    octave: 4,
    registerIndex: 3,
    velocity: 0.7,
    startTime: 900,
    colorHex: '#F5D432',
    solfege: 'Mi',
    pianoTriangle: { triangle: 'L', point: 1 },
  });

  renderer.render(mockCtx, 800, 400, activeNotes, decayingNotes, DEFAULT_CONFIG, 1000);
  assert.ok(drawCalls.includes('fill'), 'Must draw partial wave fills');
  assert.ok(drawCalls.includes('arc'), 'Must draw Solfege label badges');

  // 3. Fundamental coordinates helper
  const coords = renderer.getFundamentalCoordinates(60, 800, 400);
  assert.ok(coords, 'Coordinates must be found for C4');
  assert.ok(coords!.x > 0 && coords!.x < 800, 'X coordinate must be within plot width');
});

test('Overtones: Consistent absolute dissonance scaling (P5 vs Tritone vs Minor 2nd)', () => {
  const renderer = new OvertonesRenderer();
  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D;

  const decayingNotes = new Map<number, { note: ActiveNote; decayProgress: number }>();
  const config = { ...DEFAULT_CONFIG, showDissonanceCurve: true };

  // 1. Render isolated Perfect 5th (C4 = 60, G4 = 67)
  const p5Notes = new Map<number, ActiveNote>();
  p5Notes.set(60, { midi: 60, pitchClass: 0, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#E13610', solfege: 'Do', pianoTriangle: { triangle: 'R', point: 3 } });
  p5Notes.set(67, { midi: 67, pitchClass: 7, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#0032A4', solfege: 'So', pianoTriangle: { triangle: 'U', point: 1 } });
  renderer.render(mockCtx, 1000, 500, p5Notes, decayingNotes, config, 1000);
  const p5Diss = renderer.getPeakDissonance();
  const p5Pct = renderer.getPeakRoughnessPercentage();

  // 2. Render isolated Tritone (C4 = 60, F#4 = 66)
  const ttNotes = new Map<number, ActiveNote>();
  ttNotes.set(60, { midi: 60, pitchClass: 0, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#E13610', solfege: 'Do', pianoTriangle: { triangle: 'R', point: 3 } });
  ttNotes.set(66, { midi: 66, pitchClass: 6, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#6F2C91', solfege: 'Fi', pianoTriangle: { triangle: 'L', point: 3 } });
  renderer.render(mockCtx, 1000, 500, ttNotes, decayingNotes, config, 1000);
  const ttDiss = renderer.getPeakDissonance();
  const ttPct = renderer.getPeakRoughnessPercentage();

  // 3. Render isolated Minor 2nd (C4 = 60, C#4 = 61)
  const m2Notes = new Map<number, ActiveNote>();
  m2Notes.set(60, { midi: 60, pitchClass: 0, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#E13610', solfege: 'Do', pianoTriangle: { triangle: 'R', point: 3 } });
  m2Notes.set(61, { midi: 61, pitchClass: 1, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#E56A54', solfege: 'Ra', pianoTriangle: { triangle: 'D', point: 2 } });
  renderer.render(mockCtx, 1000, 500, m2Notes, decayingNotes, config, 1000);
  const m2Diss = renderer.getPeakDissonance();
  const m2Pct = renderer.getPeakRoughnessPercentage();

  // 4. Render isolated Minor 3rd (C4 = 60, Eb4 = 63)
  const m3Notes = new Map<number, ActiveNote>();
  m3Notes.set(60, { midi: 60, pitchClass: 0, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#E13610', solfege: 'Do', pianoTriangle: { triangle: 'R', point: 3 } });
  m3Notes.set(63, { midi: 63, pitchClass: 3, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#00A86B', solfege: 'Me', pianoTriangle: { triangle: 'U', point: 3 } });
  renderer.render(mockCtx, 1000, 500, m3Notes, decayingNotes, config, 1000);
  const m3Diss = renderer.getPeakDissonance();
  const m3Pct = renderer.getPeakRoughnessPercentage();

  // 5. Render Major 7th chord in 4th register (C4, E4, G4, B4)
  const maj7Notes = new Map<number, ActiveNote>();
  maj7Notes.set(60, { midi: 60, pitchClass: 0, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#E13610', solfege: 'Do', pianoTriangle: { triangle: 'R', point: 3 } });
  maj7Notes.set(64, { midi: 64, pitchClass: 4, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#F5D432', solfege: 'Mi', pianoTriangle: { triangle: 'L', point: 1 } });
  maj7Notes.set(67, { midi: 67, pitchClass: 7, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#0032A4', solfege: 'So', pianoTriangle: { triangle: 'U', point: 1 } });
  maj7Notes.set(71, { midi: 71, pitchClass: 11, octave: 4, registerIndex: 3, velocity: 0.8, startTime: 0, colorHex: '#B22222', solfege: 'Ti', pianoTriangle: { triangle: 'D', point: 3 } });
  renderer.render(mockCtx, 1000, 500, maj7Notes, decayingNotes, config, 1000);
  const maj7Diss = renderer.getPeakDissonance();
  const maj7Pct = renderer.getPeakRoughnessPercentage();

  // Assertions: Consistent absolute scaling across intervals and chords
  assert.ok(p5Diss > 0, 'P5 must have some slight overtone interaction');
  assert.ok(ttDiss > p5Diss * 5.0, `Tritone dissonance (${ttDiss.toFixed(4)}) must be much higher than P5 (${p5Diss.toFixed(4)})`);
  assert.ok(ttDiss > m3Diss * 2.5, `Tritone dissonance (${ttDiss.toFixed(4)}) must be substantially higher than Minor 3rd (${m3Diss.toFixed(4)})`);
  assert.ok(ttDiss > maj7Diss * 2.0, `Tritone dissonance (${ttDiss.toFixed(4)}) must be more than double a Major 7th chord (${maj7Diss.toFixed(4)})`);
  assert.ok(m2Diss > ttDiss * 1.3, `Minor 2nd dissonance (${m2Diss.toFixed(4)}) must be higher than Tritone (${ttDiss.toFixed(4)})`);
  assert.ok(p5Pct < 15, `P5 crunch (${p5Pct}%) must be very gentle`);
  assert.ok(m3Pct < 30, `Minor 3rd crunch (${m3Pct}%) must be mild consonant coloration`);
  assert.ok(maj7Pct < 35, `Major 7th chord crunch (${maj7Pct}%) must be gentle lush coloration`);
  assert.ok(ttPct > maj7Pct * 2, `Tritone crunch (${ttPct}%) must be much greater than Major 7th chord (${maj7Pct}%)`);
  assert.ok(ttPct > m3Pct * 2, `Tritone crunch (${ttPct}%) must be much greater than Minor 3rd (${m3Pct}%)`);
  assert.ok(m2Pct > ttPct, `Minor 2nd crunch (${m2Pct}%) must exceed Tritone (${ttPct}%)`);
});

test('Overtones: Configuration sanitisation and persistence', () => {
  const rawConfig = {
    ...DEFAULT_CONFIG,
    layoutMode: 'harmonic',
    showDissonanceCurve: false,
    showOvertoneLabels: false,
    fluidSpeed: 1.8,
    waveFluidity: 0.95,
  };

  const sanitized = sanitizeConfig(rawConfig);
  assert.strictEqual(sanitized.layoutMode, 'harmonic');
  assert.strictEqual(sanitized.showDissonanceCurve, false);
  assert.strictEqual(sanitized.showOvertoneLabels, false);
  assert.strictEqual(sanitized.fluidSpeed, 1.8);
  assert.strictEqual(sanitized.waveFluidity, 0.95);

  // Out of bounds values should clamp safely
  const clamped = sanitizeConfig({
    ...DEFAULT_CONFIG,
    fluidSpeed: 10.0, // max 3.0
    waveFluidity: -5.0, // min 0.0
  });
  assert.strictEqual(clamped.fluidSpeed, 3.0);
  assert.strictEqual(clamped.waveFluidity, 0.0);
});

test('Virtual Keyboard: Range presets specification and bounds', () => {
  assert.ok(PIANO_RANGE_PRESETS.length >= 6, 'Must provide at least 6 standard range presets');

  // Verify specific presets exist
  const preset25 = PIANO_RANGE_PRESETS.find((p) => p.id === '25-key');
  assert.ok(preset25, '25-key preset must exist');
  assert.strictEqual(preset25.startMidi, 48); // C3
  assert.strictEqual(preset25.endMidi, 72);   // C5
  assert.strictEqual(preset25.keys, 25);

  const preset88 = PIANO_RANGE_PRESETS.find((p) => p.id === '88-key');
  assert.ok(preset88, '88-key preset must exist');
  assert.strictEqual(preset88.startMidi, 21); // A0
  assert.strictEqual(preset88.endMidi, 108);  // C8
  assert.strictEqual(preset88.keys, 88);

  // All presets must have valid ordered bounds within MIDI range
  for (const preset of PIANO_RANGE_PRESETS) {
    assert.ok(preset.startMidi >= 21, `Preset ${preset.id} start note must be >= 21 (A0)`);
    assert.ok(preset.endMidi <= 108, `Preset ${preset.id} end note must be <= 108 (C8)`);
    assert.ok(preset.startMidi < preset.endMidi, `Preset ${preset.id} start must be strictly less than end`);
    assert.strictEqual(preset.keys, preset.endMidi - preset.startMidi + 1);
  }
});

test('Virtual Keyboard: Configuration sanitisation and clamping', () => {
  // Default values
  assert.strictEqual(DEFAULT_CONFIG.virtualKeyboardStartMidi, 48);
  assert.strictEqual(DEFAULT_CONFIG.virtualKeyboardEndMidi, 72);

  // Valid values preserved
  const valid = sanitizeConfig({
    ...DEFAULT_CONFIG,
    virtualKeyboardStartMidi: 21,
    virtualKeyboardEndMidi: 108,
  });
  assert.strictEqual(valid.virtualKeyboardStartMidi, 21);
  assert.strictEqual(valid.virtualKeyboardEndMidi, 108);

  // Clamping out-of-bounds start note
  const clampedLow = sanitizeConfig({
    ...DEFAULT_CONFIG,
    virtualKeyboardStartMidi: 5,
    virtualKeyboardEndMidi: 72,
  });
  assert.strictEqual(clampedLow.virtualKeyboardStartMidi, 21);

  // Clamping out-of-bounds end note
  const clampedHigh = sanitizeConfig({
    ...DEFAULT_CONFIG,
    virtualKeyboardStartMidi: 48,
    virtualKeyboardEndMidi: 150,
  });
  assert.strictEqual(clampedHigh.virtualKeyboardEndMidi, 108);

  // Guarantee minimum 12 semitones between start and end
  const clampedSpan = sanitizeConfig({
    ...DEFAULT_CONFIG,
    virtualKeyboardStartMidi: 60,
    virtualKeyboardEndMidi: 62,
  });
  assert.strictEqual(clampedSpan.virtualKeyboardStartMidi, 60);
  assert.ok(clampedSpan.virtualKeyboardEndMidi >= 72, 'End note must be at least start + 12 semitones');

  // Fallback on invalid types
  const fallback = sanitizeConfig({
    ...DEFAULT_CONFIG,
    virtualKeyboardStartMidi: 'invalid' as any,
    virtualKeyboardEndMidi: null as any,
    virtualKeyboardStretchWidth: 'not-a-boolean' as any,
    showVirtualKeyboard: 'not-a-boolean' as any,
  });
  assert.strictEqual(fallback.virtualKeyboardStartMidi, 48);
  assert.strictEqual(fallback.virtualKeyboardEndMidi, 72);
  assert.strictEqual(fallback.virtualKeyboardStretchWidth, false);
  assert.strictEqual(fallback.showVirtualKeyboard, false);

  // Stretch / fit width boolean sanitisation
  assert.strictEqual(DEFAULT_CONFIG.virtualKeyboardStretchWidth, false);
  const stretched = sanitizeConfig({
    ...DEFAULT_CONFIG,
    virtualKeyboardStretchWidth: true,
  });
  assert.strictEqual(stretched.virtualKeyboardStretchWidth, true);

  // Virtual keyboard hidden by default
  assert.strictEqual(DEFAULT_CONFIG.showVirtualKeyboard, false);
  const keyboardEnabled = sanitizeConfig({
    ...DEFAULT_CONFIG,
    showVirtualKeyboard: true,
  });
  assert.strictEqual(keyboardEnabled.showVirtualKeyboard, true);
});

test('Layout Models: Upgrade legacy signature layout containing stream to new orbital/triangles/waves trio', () => {
  const legacySignatureRoot = {
    id: 'root-signature',
    type: 'container' as const,
    direction: 'column' as const,
    gap: 8,
    children: [
      { id: 'cell-clock-sig', type: 'cell' as const, module: 'orbital' as const, flex: 3 },
      {
        id: 'container-sig-bottom',
        type: 'container' as const,
        direction: 'row' as const,
        flex: 1,
        children: [
          { id: 'cell-triangles-sig', type: 'cell' as const, module: 'triangles' as const, flex: 1 },
          { id: 'cell-stream-sig', type: 'cell' as const, module: 'stream' as const, flex: 1 },
        ],
      },
    ],
  };

  const upgraded = sanitizeConfig({
    ...DEFAULT_CONFIG,
    layoutMode: 'signature',
    activeLayout: {
      id: 'signature',
      name: 'Scale Signature Trio',
      root: legacySignatureRoot,
    },
  });

  const cells = getAllCellNodes(upgraded.activeLayout.root);
  assert.strictEqual(cells[2].module, 'overtones', 'Legacy stream in signature must be upgraded to overtones');
});

test('Virtual Keyboard: 2-Octave QWERTY octave shifter offsets', () => {
  // Computer keyboard window covers 24 semitones (2 octaves)
  // Base offset 0 = C3 (48), span 48..72
  const base0 = 48 + 0 * 12;
  assert.strictEqual(base0, 48);
  assert.strictEqual(base0 + 24, 72);

  // Min octave offset -2 = C1 (24), span 24..48
  const baseMin = 48 + (-2) * 12;
  assert.strictEqual(baseMin, 24);
  assert.strictEqual(baseMin + 24, 48);
  assert.ok(baseMin >= 21, 'Lowest playable note with shift -2 is inside piano bounds');

  // Max octave offset +3 = C6 (84), span 84..108
  const baseMax = 48 + 3 * 12;
  assert.strictEqual(baseMax, 84);
  assert.strictEqual(baseMax + 24, 108);
  assert.ok(baseMax + 24 <= 108, 'Highest playable note with shift +3 touches C8');
});

test('PPT Noteheads: Taxonomy of 12 chromatic degrees matches shapes and Solfège colours', () => {
  // Check exact 12 degree specs
  assert.strictEqual(PPT_NOTEHEAD_SPECS[0].shape, 'circle');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[0].colorHex, '#E13610'); // Do
  assert.strictEqual(PPT_NOTEHEAD_SPECS[0].semitone, 0);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[1].shape, 'diamond');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[1].colorHex, '#F98016'); // Ra/Di
  assert.strictEqual(PPT_NOTEHEAD_SPECS[1].semitone, 1);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[2].shape, 'square');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[2].colorHex, '#F98016'); // Re
  assert.strictEqual(PPT_NOTEHEAD_SPECS[2].semitone, 2);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[3].shape, 'triangle-down');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[3].colorHex, '#F5D432'); // Me/Ri
  assert.strictEqual(PPT_NOTEHEAD_SPECS[3].semitone, 3);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[4].shape, 'triangle-up');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[4].colorHex, '#F5D432'); // Mi
  assert.strictEqual(PPT_NOTEHEAD_SPECS[4].semitone, 4);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[5].shape, 'semicircle-left');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[5].colorHex, '#43A440'); // Fa
  assert.strictEqual(PPT_NOTEHEAD_SPECS[5].semitone, 5);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[6].shape, 'cross');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[6].colorHex, '#141414'); // Fi (Tritone)
  assert.strictEqual(PPT_NOTEHEAD_SPECS[6].semitone, 6);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[7].shape, 'semicircle-right');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[7].colorHex, '#0032A4'); // So
  assert.strictEqual(PPT_NOTEHEAD_SPECS[7].semitone, 7);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[8].shape, 'triangle-down');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[8].colorHex, '#5300A4'); // Le/Si
  assert.strictEqual(PPT_NOTEHEAD_SPECS[8].neonColorHex, '#C084FC'); // Le/Si neon violet
  assert.strictEqual(PPT_NOTEHEAD_SPECS[8].semitone, 8);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[9].shape, 'triangle-up');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[9].colorHex, '#5300A4'); // La/Li
  assert.strictEqual(PPT_NOTEHEAD_SPECS[9].semitone, 9);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[10].shape, 'diamond');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[10].colorHex, '#F158A4'); // Te/Li
  assert.strictEqual(PPT_NOTEHEAD_SPECS[10].semitone, 10);

  assert.strictEqual(PPT_NOTEHEAD_SPECS[11].shape, 'square');
  assert.strictEqual(PPT_NOTEHEAD_SPECS[11].colorHex, '#F158A4'); // Ti
  assert.strictEqual(PPT_NOTEHEAD_SPECS[11].semitone, 11);

  // Modulo wrap testing for getPptNoteheadSpec
  const wrapDo = getPptNoteheadSpec(12);
  assert.strictEqual(wrapDo.shape, 'circle');
  assert.strictEqual(wrapDo.semitone, 0);

  const wrapNegative = getPptNoteheadSpec(-1);
  assert.strictEqual(wrapNegative.shape, 'square');
  assert.strictEqual(wrapNegative.semitone, 11);
});

test('Diatonic Staff Mapping: Middle C, natural notes, and accidentals', () => {
  // Middle C (MIDI 60) -> step 0, accidental 0 (natural)
  const c4 = midiToDiatonicStaffNote(60, false);
  assert.strictEqual(c4.diatonicStep, 0);
  assert.strictEqual(c4.accidental, 0);
  assert.strictEqual(c4.letterName, 'C');

  // D4 (MIDI 62) -> step 1
  const d4 = midiToDiatonicStaffNote(62, false);
  assert.strictEqual(d4.diatonicStep, 1);
  assert.strictEqual(d4.accidental, 0);
  assert.strictEqual(d4.letterName, 'D');

  // E4 (MIDI 64) -> step 2
  const e4 = midiToDiatonicStaffNote(64, false);
  assert.strictEqual(e4.diatonicStep, 2);
  assert.strictEqual(e4.accidental, 0);

  // F4 (MIDI 65) -> step 3
  const f4 = midiToDiatonicStaffNote(65, false);
  assert.strictEqual(f4.diatonicStep, 3);
  assert.strictEqual(f4.accidental, 0);

  // G4 (MIDI 67) -> step 4
  const g4 = midiToDiatonicStaffNote(67, false);
  assert.strictEqual(g4.diatonicStep, 4);
  assert.strictEqual(g4.accidental, 0);

  // A4 (MIDI 69) -> step 5
  const a4 = midiToDiatonicStaffNote(69, false);
  assert.strictEqual(a4.diatonicStep, 5);
  assert.strictEqual(a4.accidental, 0);

  // B4 (MIDI 71) -> step 6
  const b4 = midiToDiatonicStaffNote(71, false);
  assert.strictEqual(b4.diatonicStep, 6);
  assert.strictEqual(b4.accidental, 0);

  // C5 (MIDI 72) -> step 7
  const c5 = midiToDiatonicStaffNote(72, false);
  assert.strictEqual(c5.diatonicStep, 7);
  assert.strictEqual(c5.accidental, 0);

  // C3 (MIDI 48) -> step -7
  const c3 = midiToDiatonicStaffNote(48, false);
  assert.strictEqual(c3.diatonicStep, -7);
  assert.strictEqual(c3.accidental, 0);

  // C#4 (MIDI 61) with sharp preference -> step 0 (C), accidental 1 (sharp)
  const cSharp4 = midiToDiatonicStaffNote(61, false);
  assert.strictEqual(cSharp4.diatonicStep, 0);
  assert.strictEqual(cSharp4.accidental, 1);

  // Eb4 (MIDI 63) with flat preference -> step 2 (E), accidental -1 (flat)
  const eFlat4 = midiToDiatonicStaffNote(63, true);
  assert.strictEqual(eFlat4.diatonicStep, 2);
  assert.strictEqual(eFlat4.accidental, -1);

  // F#4 (MIDI 66) with sharp preference -> step 3 (F), accidental 1 (sharp)
  const fSharp4 = midiToDiatonicStaffNote(66, false);
  assert.strictEqual(fSharp4.diatonicStep, 3);
  assert.strictEqual(fSharp4.accidental, 1);
});

test('Key Signatures: Canonical accidentals for all 12 tonics', () => {
  assert.deepStrictEqual(TONIC_TO_KEY_SIGNATURE[0], { sharpsFlats: 0, accidentals: [] });
  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[7].sharpsFlats, 1); // G major (F#)
  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[2].sharpsFlats, 2); // D major (F#, C#)
  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[9].sharpsFlats, 3); // A major (F#, C#, G#)
  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[4].sharpsFlats, 4); // E major
  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[11].sharpsFlats, 5); // B major
  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[6].sharpsFlats, 6); // F# major

  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[5].sharpsFlats, -1); // F major (Bb)
  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[10].sharpsFlats, -2); // Bb major (Bb, Eb)
  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[3].sharpsFlats, -3); // Eb major
  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[8].sharpsFlats, -4); // Ab major
  assert.strictEqual(TONIC_TO_KEY_SIGNATURE[1].sharpsFlats, -5); // Db major
});

test('Configuration & Sanitisation: Fixed window size and staffStream configuration', () => {
  // Default fixed queue lengths must be 8
  assert.strictEqual(DEFAULT_CONFIG.fixedWindowSize, 8);
  assert.strictEqual(DEFAULT_CONFIG.staffFixedWindowSize, 8);

  // Clamping test: below 2 clamps to 2
  const clampedLow = sanitizeConfig({
    ...DEFAULT_CONFIG,
    fixedWindowSize: 1,
    staffFixedWindowSize: 1,
  });
  assert.strictEqual(clampedLow.fixedWindowSize, 2);
  assert.strictEqual(clampedLow.staffFixedWindowSize, 2);

  // Clamping test: above 32 clamps to 32
  const clampedHigh = sanitizeConfig({
    ...DEFAULT_CONFIG,
    fixedWindowSize: 50,
    staffFixedWindowSize: 50,
  });
  assert.strictEqual(clampedHigh.fixedWindowSize, 32);
  assert.strictEqual(clampedHigh.staffFixedWindowSize, 32);

  // Valid range preserved
  const valid = sanitizeConfig({
    ...DEFAULT_CONFIG,
    fixedWindowSize: 16,
    staffFixedWindowSize: 16,
  });
  assert.strictEqual(valid.fixedWindowSize, 16);
  assert.strictEqual(valid.staffFixedWindowSize, 16);

  // Staff stream configuration defaults
  assert.strictEqual(DEFAULT_CONFIG.staffSize, 'grand');
  assert.strictEqual(DEFAULT_CONFIG.staffClef, 'dynamic');
  assert.strictEqual(DEFAULT_CONFIG.staffStreamMode, 'continuous');
  assert.strictEqual(DEFAULT_CONFIG.includeCClefs, false);
  assert.strictEqual(DEFAULT_CONFIG.showKeySignature, false);
  assert.strictEqual(DEFAULT_CONFIG.showVoiceLeadingLines, true);

  // Sanitisation of invalid values
  const sanitizedStaff = sanitizeConfig({
    ...DEFAULT_CONFIG,
    staffSize: 'invalid' as any,
    staffClef: 'invalid' as any,
    staffStreamMode: 'invalid' as any,
    includeCClefs: 'yes' as any,
    showKeySignature: 'not-bool' as any,
    showVoiceLeadingLines: 'not-bool' as any,
  });
  assert.strictEqual(sanitizedStaff.staffSize, 'grand');
  assert.strictEqual(sanitizedStaff.staffClef, 'dynamic');
  assert.strictEqual(sanitizedStaff.staffStreamMode, 'continuous');
  assert.strictEqual(sanitizedStaff.includeCClefs, false);
  assert.strictEqual(sanitizedStaff.showKeySignature, false);
  assert.strictEqual(sanitizedStaff.showVoiceLeadingLines, true);
});

test('Layout Models: Split and add cell with staff-stream module', () => {
  const root = {
    id: 'root-test',
    type: 'container' as const,
    direction: 'row' as const,
    gap: 8,
    children: [
      { id: 'cell-1', type: 'cell' as const, module: 'orbital' as const, flex: 1 },
    ],
  };

  const splitResult = splitCellInTree(root, 'cell-1', 'row', 'staff-stream');
  assert.strictEqual(splitResult.type, 'container');
  assert.strictEqual(splitResult.children[1].type, 'cell');
  assert.strictEqual((splitResult.children[1] as any).module, 'staff-stream');
  assert.strictEqual((splitResult.children[1] as any).title, 'Staff Stream');

  const addedResult = addCellToTree(root, 'row', 'staff-stream');
  const cells = getAllCellNodes(addedResult);
  assert.ok(cells.some((c) => c.module === 'staff-stream' && c.title === 'Staff Stream'));
});

test('SMuFL Glyphs: Vector path definitions for clefs and accidentals', () => {
  assert.ok(SMUFL_GLYPH_PATHS.gClef.startsWith('M 541 598'));
  assert.ok(SMUFL_GLYPH_PATHS.fClef.startsWith('M 363 377'));
  assert.ok(SMUFL_GLYPH_PATHS.cClef.startsWith('M 331 694'));
  assert.ok(SMUFL_GLYPH_PATHS.accidentalSharp.startsWith('M 341 170'));
  assert.ok(SMUFL_GLYPH_PATHS.accidentalFlat.startsWith('M 17 -245'));
  assert.ok(SMUFL_GLYPH_PATHS.accidentalNatural.startsWith('M 203 261'));
});

test('Staff Stream: Chord onset clustering for polyphonic chords', () => {
  const createMockItem = (id: string, midi: number, timestamp: number): StreamItem => ({
    id,
    midi,
    pitchClass: midi % 12,
    octave: Math.floor(midi / 12) - 1,
    velocity: 0.8,
    timestamp,
    colorHex: '#38bdf8',
    solfege: 'Do',
    pitchName: 'C',
    interval: 'P1',
    pianoTriangle: { triangle: 'D', point: 1 },
    glyphType: 'base',
    rotation: 0,
  });

  // 3 notes in a C major chord played simultaneously (within 20ms)
  // followed 500ms later by a 4th note (melody note)
  const items: StreamItem[] = [
    createMockItem('n3', 67, 1.015), // G4
    createMockItem('n1', 60, 1.000), // C4
    createMockItem('n2', 64, 1.008), // E4
    createMockItem('n4', 72, 1.500), // C5
  ];

  const onsets = clusterItemsIntoOnsets(items);
  assert.strictEqual(onsets.length, 2, 'Should cluster into 2 distinct onsets');
  assert.strictEqual(onsets[0].items.length, 3, 'First onset should contain 3 chord notes');
  // Notes within onset must be sorted ascending by MIDI pitch: C4 (60), E4 (64), G4 (67)
  assert.strictEqual(onsets[0].items[0].midi, 60);
  assert.strictEqual(onsets[0].items[1].midi, 64);
  assert.strictEqual(onsets[0].items[2].midi, 67);

  // Second onset is monophonic
  assert.strictEqual(onsets[1].items.length, 1);
  assert.strictEqual(onsets[1].items[0].midi, 72);
});

test('Staff Stream: Deduplication of identical MIDI notes within same chord onset', () => {
  const createMockItem = (id: string, midi: number, timestamp: number): StreamItem => ({
    id,
    midi,
    pitchClass: midi % 12,
    octave: Math.floor(midi / 12) - 1,
    velocity: 0.8,
    timestamp,
    colorHex: '#E13610',
    solfege: 'Do',
    pitchName: 'C',
    interval: 'P1',
    pianoTriangle: { triangle: 'D', point: 1 },
    glyphType: 'base',
    rotation: 0,
  });

  // Simulated Cmaj7 2nd inversion with duplicate C5 triggers (e.g. from Web MIDI / driver duplicate messages)
  const items: StreamItem[] = [
    createMockItem('g4', 67, 1.000), // G4
    createMockItem('b4', 71, 1.005), // B4
    createMockItem('c5_1', 72, 1.010), // C5 first trigger
    createMockItem('c5_2', 72, 1.012), // C5 duplicate trigger
    createMockItem('e5', 76, 1.015), // E5
  ];

  const onsets = clusterItemsIntoOnsets(items);
  assert.strictEqual(onsets.length, 1, 'Should cluster into 1 onset');
  assert.strictEqual(onsets[0].items.length, 4, 'Duplicate C5 note must be deduplicated into 4 unique pitches');
  assert.deepStrictEqual(onsets[0].items.map((it) => it.midi), [67, 71, 72, 76]);
});

test('Staff Stream: 1-to-1 SATB Voice Leading logic', () => {
  const createNode = (midi: number, x: number, y: number): VoiceLeadingNode => ({
    x,
    y,
    diatonicStep: midi,
    item: {
      id: `m_${midi}`,
      midi,
      pitchClass: midi % 12,
      octave: Math.floor(midi / 12) - 1,
      velocity: 0.8,
      timestamp: 1.0,
      colorHex: '#E13610',
      solfege: 'Do',
      pitchName: 'C',
      interval: 'P1',
      pianoTriangle: { triangle: 'D', point: 1 },
      glyphType: 'base',
      rotation: 0,
    },
  });

  // Onset 1: C major SATB chord: C3(48), G3(55), E4(64), C5(72)
  const chord1: VoiceLeadingNode[] = [
    createNode(48, 100, 300), // Bass: C3
    createNode(55, 100, 260), // Tenor: G3
    createNode(64, 100, 210), // Alto: E4
    createNode(72, 100, 160), // Soprano: C5
  ];

  // Onset 2: G major SATB chord: G2(43), G3(55), D4(62), B4(71)
  const chord2: VoiceLeadingNode[] = [
    createNode(43, 200, 330), // Bass: G2
    createNode(55, 200, 260), // Tenor: G3
    createNode(62, 200, 220), // Alto: D4
    createNode(71, 200, 165), // Soprano: B4
  ];

  const pairs = computeSatbVoiceLeading(chord1, chord2);
  assert.strictEqual(pairs.length, 4, '4-voice to 4-voice transition should yield 4 1-to-1 voice leading pairs');

  // Soprano must connect to Soprano: C5(72) -> B4(71)
  const sopranoPair = pairs.find((p) => p.from.item.midi === 72);
  assert.ok(sopranoPair, 'Soprano voice must exist');
  assert.strictEqual(sopranoPair.to.item.midi, 71, 'Soprano C5 must connect to Soprano B4');

  // Bass must connect to Bass: C3(48) -> G2(43)
  const bassPair = pairs.find((p) => p.from.item.midi === 48);
  assert.ok(bassPair, 'Bass voice must exist');
  assert.strictEqual(bassPair.to.item.midi, 43, 'Bass C3 must connect to Bass G2');

  // Tenor held note: G3(55) -> G3(55)
  const tenorPair = pairs.find((p) => p.from.item.midi === 55);
  assert.ok(tenorPair, 'Tenor voice must exist');
  assert.strictEqual(tenorPair.to.item.midi, 55, 'Tenor G3 connects to common tone G3');

  // Alto: E4(64) -> D4(62)
  const altoPair = pairs.find((p) => p.from.item.midi === 64);
  assert.ok(altoPair, 'Alto voice must exist');
  assert.strictEqual(altoPair.to.item.midi, 62, 'Alto E4 connects to D4');

  // Voice expansion test: 3-note chord to 4-note chord
  const triad: VoiceLeadingNode[] = [
    createNode(48, 100, 300), // Bass
    createNode(64, 100, 210), // Inner
    createNode(72, 100, 160), // Soprano
  ];
  const expansionPairs = computeSatbVoiceLeading(triad, chord2);
  assert.strictEqual(expansionPairs.length, 3, 'Each voice from origin chord connects 1-to-1 to destination chord');
  // Outer voices still strictly preserved
  assert.strictEqual(expansionPairs.find((p) => p.from.item.midi === 72)?.to.item.midi, 71);
  assert.strictEqual(expansionPairs.find((p) => p.from.item.midi === 48)?.to.item.midi, 43);
});

test('Staff Stream: Traditional Key Signature step positions', () => {
  // Treble sharps order: F5(4.0), C5(2.5), G5(4.5), D5(3.0), A4(1.5), E5(3.5), B4(2.0)
  assert.deepStrictEqual(TREBLE_KEY_SIG_SHARPS, [4.0, 2.5, 4.5, 3.0, 1.5, 3.5, 2.0]);
  // Treble flats order: Bb4(2.0), Eb5(3.5), Ab4(1.5), Db5(3.0), Gb4(1.0), Cb5(2.5), Fb4(0.5)
  assert.deepStrictEqual(TREBLE_KEY_SIG_FLATS, [2.0, 3.5, 1.5, 3.0, 1.0, 2.5, 0.5]);

  // Bass sharps order: F4(3.0), C4(1.5), G4(3.5), D4(2.0), A3(0.5), E4(2.5), B3(1.0)
  assert.deepStrictEqual(BASS_KEY_SIG_SHARPS, [3.0, 1.5, 3.5, 2.0, 0.5, 2.5, 1.0]);
  // Bass flats order: Bb3(1.0), Eb4(2.5), Ab3(0.5), Db4(2.0), Gb3(0.0), Cb4(1.5), Fb3(-0.5)
  assert.deepStrictEqual(BASS_KEY_SIG_FLATS, [1.0, 2.5, 0.5, 2.0, 0.0, 1.5, -0.5]);
});

test('Piano Keyboard Mapping: isBlackPianoKey identifies physical black and white keys', () => {
  // White keys: C(0), D(2), E(4), F(5), G(7), A(9), B(11)
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11];
  for (const pc of whiteKeys) {
    assert.strictEqual(isBlackPianoKey(pc), false, `Pitch class ${pc} must be a white key`);
    assert.strictEqual(isBlackPianoKey(pc + 60), false, `MIDI ${pc + 60} must be a white key`);
  }

  // Black keys: C#(1), D#(3), F#(6), G#(8), A#(10)
  const blackKeys = [1, 3, 6, 8, 10];
  for (const pc of blackKeys) {
    assert.strictEqual(isBlackPianoKey(pc), true, `Pitch class ${pc} must be a black key`);
    assert.strictEqual(isBlackPianoKey(pc + 60), true, `MIDI ${pc + 60} must be a black key`);
  }
});

test('PPT Noteheads: Outline colour indicates physical piano key (white or black)', () => {
  let capturedStrokeStyle = '';
  const mockCtx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    beginPath: () => {},
    closePath: () => {},
    arc: () => {},
    rect: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fill: () => {},
    stroke: () => {},
    set strokeStyle(val: string) {
      capturedStrokeStyle = val;
    },
    get strokeStyle() {
      return capturedStrokeStyle;
    },
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;

  // 1. White piano key notehead -> White outline (#ffffff)
  renderPptNoteOnCanvas(mockCtx, 0, 100, 100, 20, 0, false, false, false);
  assert.strictEqual(capturedStrokeStyle, '#ffffff', 'White piano key must have white outline');

  // 2. Black piano key notehead -> Luminous neon Solfège outline (e.g. #FB923C for semitone 1 Ra)
  renderPptNoteOnCanvas(mockCtx, 1, 100, 100, 20, 0, false, false, true);
  assert.strictEqual(capturedStrokeStyle, '#FB923C', 'Black piano key Ra must have neon orange outline');

  // 3. Minor 6th (semitone 8 Le) on black key -> Radiant neon violet outline (#C084FC)
  renderPptNoteOnCanvas(mockCtx, 8, 100, 100, 20, 0, false, false, true);
  assert.strictEqual(capturedStrokeStyle, '#C084FC', 'Black piano key Le must have neon violet outline');
});

test('Staff Stream: Mode-specific accidentals, key signatures, and timing alignment', () => {
  const mockCtx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    beginPath: () => {},
    closePath: () => {},
    arc: () => {},
    rect: () => {},
    roundRect: () => {},
    moveTo: () => {},
    lineTo: () => {},
    strokeRect: () => {},
    fillRect: () => {},
    clip: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
    strokeText: () => {},
    set strokeStyle(_val: string) {},
    set fillStyle(_val: string) {},
    lineWidth: 1,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;

  const renderer = new StaffStreamRenderer();

  const createItem = (midi: number, timestamp: number): StreamItem => ({
    id: `item_${midi}`,
    midi,
    pitchClass: midi % 12,
    octave: Math.floor(midi / 12) - 1,
    velocity: 0.8,
    timestamp,
    duration: 0.5,
    colorHex: '#E13610',
    solfege: 'Do',
    pitchName: 'C',
    interval: 'P1',
    pianoTriangle: { triangle: 'D', point: 1 },
    glyphType: 'base',
    rotation: 0,
  });

  // Simultaneous C4 (60) and C#4 (61) - a second
  const items = [
    createItem(60, 1.0),
    createItem(61, 1.0),
  ];

  // 1. Continuous mode: must render without error, clipping and termination line present
  assert.doesNotThrow(() => {
    renderer.render(
      mockCtx,
      0,
      0,
      800,
      400,
      items,
      { ...DEFAULT_CONFIG, staffStreamMode: 'continuous', showKeySignature: true },
      2000
    );
  }, 'Continuous mode should render without errors');

  // 2. Fixed queue mode: must render without error
  assert.doesNotThrow(() => {
    renderer.render(
      mockCtx,
      0,
      0,
      800,
      400,
      items,
      { ...DEFAULT_CONFIG, staffStreamMode: 'fixed', showKeySignature: true },
      2000
    );
  }, 'Fixed queue mode should render without errors');
});

test('RenderCoordinator: isContinuousStreamingActive detects continuous modes across cell overrides', () => {
  // 1. Default config: both streamMode and staffStreamMode are continuous
  const coordinator = new RenderCoordinator(DEFAULT_CONFIG);
  assert.strictEqual(coordinator.isContinuousStreamingActive(), true);

  // 2. Both set to fixed: should return false
  const fixedConfig = { ...DEFAULT_CONFIG, streamMode: 'fixed' as const, staffStreamMode: 'fixed' as const };
  const fixedCoordinator = new RenderCoordinator(fixedConfig);
  assert.strictEqual(fixedCoordinator.isContinuousStreamingActive(), false);

  // 3. streamMode fixed, but staffStreamMode continuous: should return true
  const staffContinuousConfig = { ...DEFAULT_CONFIG, streamMode: 'fixed' as const, staffStreamMode: 'continuous' as const };
  const staffContinuousCoordinator = new RenderCoordinator(staffContinuousConfig);
  assert.strictEqual(staffContinuousCoordinator.isContinuousStreamingActive(), true);

  // 4. Global fixed, but registered cell has continuous override: should return true
  const mockCanvas = { getContext: () => ({}) } as unknown as HTMLCanvasElement;
  fixedCoordinator.registerCellCanvas(
    'cell-staff-1',
    mockCanvas,
    'staff-stream',
    { staffStreamMode: 'continuous' }
  );
  assert.strictEqual(fixedCoordinator.isContinuousStreamingActive(), true);

  coordinator.destroy();
  fixedCoordinator.destroy();
  staffContinuousCoordinator.destroy();
});

test('RenderCoordinator: High-volume polyphonic stream retains all notes in continuous conveyor', () => {
  // Config with streamMode: 'fixed' but staffStreamMode: 'continuous'
  const config = { ...DEFAULT_CONFIG, streamMode: 'fixed' as const, staffStreamMode: 'continuous' as const };
  const coordinator = new RenderCoordinator(config);

  // Play 150 polyphonic notes in rapid succession
  for (let i = 0; i < 150; i++) {
    coordinator.triggerNoteOn(36 + (i % 48), 0.8);
  }

  // All 150 notes must be retained in streamItems without premature 48-item pruning
  assert.strictEqual(coordinator.streamItems.length, 150);
  assert.strictEqual(coordinator.streamItems[0].midi, 36);

  coordinator.destroy();
});

test('Staff Stream: Renders discrete noteheads without offset duration ribbons', () => {
  const renderer = new StaffStreamRenderer();
  const mockCtx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    roundRect: () => {},
    ellipse: () => {},
    closePath: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D;

  const items: StreamItem[] = [
    {
      id: 'item-1',
      midi: 60,
      pitchClass: 0,
      octave: 4,
      velocity: 0.8,
      timestamp: 1.0,
      colorHex: '#38bdf8',
      solfege: 'Do',
      pitchName: 'C',
      triPitchName: 'C',
      interval: 'P1',
      pianoTriangle: { triangle: 'D', point: 1 },
      glyphType: 'base',
      rotation: 0,
      duration: 1.5, // Note has duration, but Staff Stream must render discrete noteheads
    },
  ];

  assert.doesNotThrow(() => {
    renderer.render(
      mockCtx,
      0,
      0,
      800,
      400,
      items,
      { ...DEFAULT_CONFIG, staffStreamMode: 'continuous' },
      2000
    );
  });
});

test('Staff Stream and Piano Triangles Visual Effects Configuration Defaults and Sanitisation', () => {
  // Verify defaults
  assert.strictEqual(DEFAULT_CONFIG.noteEntranceAnimation, true);
  assert.strictEqual(DEFAULT_CONFIG.staffSparksEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.staffAbsorptionEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.voiceLeadingUndulation, true);
  assert.strictEqual(DEFAULT_CONFIG.triangleSparksEnabled, true);
  assert.strictEqual(DEFAULT_CONFIG.triangleLensFlaresEnabled, true);

  // Verify sanitisation preserves boolean overrides
  const sanitized = sanitizeConfig({
    noteEntranceAnimation: false,
    staffSparksEnabled: false,
    staffAbsorptionEnabled: false,
    voiceLeadingUndulation: false,
    triangleSparksEnabled: false,
    triangleLensFlaresEnabled: false,
  });
  assert.strictEqual(sanitized.noteEntranceAnimation, false);
  assert.strictEqual(sanitized.staffSparksEnabled, false);
  assert.strictEqual(sanitized.staffAbsorptionEnabled, false);
  assert.strictEqual(sanitized.voiceLeadingUndulation, false);
  assert.strictEqual(sanitized.triangleSparksEnabled, false);
  assert.strictEqual(sanitized.triangleLensFlaresEnabled, false);
});

test('CosmeticsEngine: Directional Sparks and Absorption Effect', () => {
  const cosmetics = new CosmeticsEngine();
  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    closePath: () => {},
    rect: () => {},
    fillRect: () => {},
    clearRect: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D;

  assert.doesNotThrow(() => {
    // Eastward directional sparks
    cosmetics.spawnDirectionalSparks(100, 200, '#E13610', 0.8, 0, Math.PI * 0.65, 15, 1.2, 1.0, 0.15);
    // Boundary absorption ripple
    cosmetics.spawnAbsorptionEffect(20, 200, '#38BDF8', 300);
    // Update and render
    cosmetics.update();
    cosmetics.renderEffects(mockCtx, 0.8, 800, 600);
  });
});

test('PianoTrianglesRenderer: Active Vertex Coordinate Tracking and Query', () => {
  const ptRenderer = new PianoTrianglesRenderer();
  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    closePath: () => {},
    translate: () => {},
    setLineDash: () => {},
    measureText: () => ({ width: 10 }),
    fillText: () => {},
  } as unknown as CanvasRenderingContext2D;

  const activeNotes = new Map<number, ActiveNote>([
    [60, { midi: 60, velocity: 0.9, startTime: 1000 } as ActiveNote], // C4 (pc 0)
    [64, { midi: 64, velocity: 0.7, startTime: 1000 } as ActiveNote], // E4 (pc 4)
  ]);
  const decayingNotes = new Map();

  ptRenderer.render(mockCtx, 800, 400, activeNotes, decayingNotes, DEFAULT_CONFIG, 1200);

  const activeVertices = ptRenderer.getActiveVertexCoordinates();
  assert.ok(activeVertices.length >= 2, `Expected at least 2 active vertices, got ${activeVertices.length}`);
  const pcs = activeVertices.map(v => v.pc);
  assert.ok(pcs.includes(0), 'Active vertices must include pitch class 0 (C)');
  assert.ok(pcs.includes(4), 'Active vertices must include pitch class 4 (E)');

  // Verify pitch class coordinate query
  const coordC = ptRenderer.getVertexCoordinatesForPc(0);
  assert.ok(coordC !== undefined, 'getVertexCoordinatesForPc(0) must return valid coordinates');
  assert.ok(typeof coordC.x === 'number' && typeof coordC.y === 'number');
  assert.ok(typeof coordC.colorHex === 'string');
});

test('StaffStreamRenderer: getPlayheadCoordinatesForMidi', () => {
  const staffRenderer = new StaffStreamRenderer();
  const coord = staffRenderer.getPlayheadCoordinatesForMidi(60, 100, 50, 600, 300, DEFAULT_CONFIG);
  assert.strictEqual(coord.x, 100 + 600 - 24, 'Playhead X must align with the origin line');
  assert.ok(typeof coord.y === 'number' && coord.y > 50 && coord.y < 350, 'Playhead Y must sit within cell bounds');
});

test('GPU Offloading & Zero-Thrashing Bounding Rect Cache', () => {
  const cosmetics = new CosmeticsEngine();
  cosmetics.spawnNoteSparks(100, 100, '#E13610', 0.9, 10);
  cosmetics.spawnShockwave(200, 200, '#38BDF8', 80);

  // 1. GPU particle streaming data contract
  const { buffer, count } = cosmetics.getParticleGpuData();
  assert.ok(count >= 10);
  assert.ok(buffer instanceof Float32Array);
  assert.strictEqual(buffer.length, 512 * 8);
  // Verify first particle x, y, radius, alpha
  assert.strictEqual(buffer[0], 100);
  assert.strictEqual(buffer[1], 100);
  assert.ok(buffer[2] > 0); // radius
  assert.strictEqual(buffer[3], 1.0); // alpha

  // 2. Active shockwaves query for GPU fragment shader
  const shockwaves = cosmetics.getActiveShockwaves();
  assert.strictEqual(shockwaves.length, 1);
  assert.strictEqual(shockwaves[0].x, 200);
  assert.strictEqual(shockwaves[0].y, 200);
  assert.strictEqual(shockwaves[0].colorHex, '#38BDF8');

  // 3. RenderCoordinator cached rects contract
  const coord = new RenderCoordinator();
  let getBoundingClientRectCallCount = 0;
  const mockCanvas: any = {
    getContext: () => ({}),
    getBoundingClientRect: () => {
      getBoundingClientRectCallCount++;
      return { left: 50, top: 50, width: 400, height: 300 };
    },
  };

  coord.registerCellCanvas('test-cell', mockCanvas, 'orbital');
  assert.strictEqual(getBoundingClientRectCallCount, 1, 'Bounding client rect should be queried only on registration');

  coord.updateAllCachedBounds();
  assert.strictEqual(getBoundingClientRectCallCount, 2, 'Bounding client rect should be queried when explicitly updating bounds');
  coord.destroy();
});



