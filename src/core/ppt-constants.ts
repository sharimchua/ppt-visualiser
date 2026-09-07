import { PianoTriangleType, PianoTrianglePoint, SolfegeSpec, PianoTriangleInfo } from './types';

// Canonical Uniform Solfège SVG Path data (from ppt-engraver / PPT specification)
export const PATH_BASE =
  'M 26.2,80.6 L 38.9,67.4 L 55.9,49.8 L 75,30.2 L 84.8,0 L 75,-30.2 L 71.4,-41.2 L 68.6,-49.8 L 40.5,-70.2 L 26.2,-80.6 L 0,-84.8 L -26.2,-80.6 L -40.5,-70.2 L -68.6,-49.8 L -71.4,-41.2 L -75,-30.2 L -84.8,0 L -75,30.2 L -55.9,49.8 L -38.9,67.4 L -26.2,80.6 L -25,43.2 L -33,38.1 L -40.7,29.2 L -44,25.4 L -47.3,21.6 L -48.3,14.2 L -50.4,0 L -48.3,-14.2 L -44.5,-22.6 L -39.3,-34 L -33,-38.1 L -25,-43.2 L -20.9,-45.8 L -14.7,-49.8 L 0,-50.4 L 14.7,-49.8 L 20.9,-45.8 L 25,-43.2 L 33,-38.1 L 39.3,-34 L 44.5,-22.6 L 48.3,-14.2 L 50.4,0 L 48.3,14.2 L 47.3,21.6 L 44,25.4 L 40.7,29.2 L 33,38.1 L 25,43.2 Z';

export const PATH_SHARP =
  'M 0,100 L 0,80.7 L 0.1,80.6 L 26.2,80.6 L 38.9,67.4 L 44.7,61.5 L 46.2,59.9 L 55.9,49.8 L 28.8,49.8 L 14.8,74 L 11,80.6 L 0,80.6 L 0,52 L 7.2,49.9 L 14.6,49.9 L 14.7,49.8 L 7.3,49.8 L 20.9,45.8 L 25,43.2 L 33,38.1 L 40.7,29.2 L 42.4,27.2 L 44,25.4 L 47.3,21.6 L 48,16.5 L 48.3,14.2 L 50.4,0 L 51.4,-7.4 L 48.3,-14.2 L 44.5,-22.6 L 43.4,-25 L 42.4,-27.2 L 39.3,-34 L 37.1,-35.4 L 33,-38.1 L 25,-43.2 L 20.9,-45.8 L 14.7,-49.8 L 14.6,-49.9 L -14.6,-49.9 L -14.7,-49.8 L -20.9,-45.8 L -25,-43.2 L -33,-38.1 L -37.1,-35.4 L -39.3,-34 L -42.4,-27.2 L -43.4,-25 L -44.5,-22.6 L -48.3,-14.2 L -51.4,-7.4 L -50.4,0 L -48.3,14.2 L -48,16.5 L -47.3,21.6 L -44,25.4 L -42.4,27.2 L -40.7,29.2 L -33,38.1 L -25,43.2 L -25.7,44.4 L -28.8,49.8 L -56,49.8 L -66.8,38.6 L -69.7,35.6 L -75,30.2 L -84.8,0 L -75,-30.2 L -71.4,-41.2 L -68.6,-49.8 L -40.5,-70.2 L -26.2,-80.6 L 26.2,-80.6 L 11,-80.6 L 26.2,-80.6 L 40.5,-70.2 L 68.6,-49.8 L 71.4,-41.2 L 75,-30.2 L 84.8,0 L 75,30.2 L 81.1,40.8 L 86.3,49.8 L 86.6,50 A 100,100 0 0 1 58.8,80.9 A 100,100 0 0 1 50,86.6 A 100,100 0 0 1 0,100 Z';

export const PATH_FLAT =
  'M 0,100 A 100,100 0 0 1 -50,86.6 A 100,100 0 0 1 -58.8,80.9 A 100,100 0 0 1 -86.6,50 L -86.3,49.8 L -81.1,40.8 L -75,30.2 L -84.8,0 L -75,-30.2 L -71.4,-41.2 L -68.6,-49.8 L -40.5,-70.2 L -26.2,-80.6 L 26.2,-80.6 L 11,-80.6 L 26.2,-80.6 L 40.5,-70.2 L 68.6,-49.8 L 71.4,-41.2 L 75,-30.2 L 84.8,0 L 75,30.2 L 69.7,35.6 L 66.8,38.6 L 55.9,49.8 L 28.8,49.8 L 25.7,44.4 L 25,43.2 L 33,38.1 L 40.7,29.2 L 42.4,27.2 L 44,25.4 L 47.3,21.6 L 48,16.5 L 48.3,14.2 L 50.4,0 L 51.4,-7.4 L 48.3,-14.2 L 44.5,-22.6 L 43.4,-25 L 42.4,-27.2 L 39.3,-34 L 37.1,-35.4 L 33,-38.1 L 25,-43.2 L 20.9,-45.8 L 14.7,-49.8 L 14.6,-49.9 L -14.6,-49.9 L -14.7,-49.8 L -20.9,-45.8 L -25,-43.2 L -33,-38.1 L -37.1,-35.4 L -39.3,-34 L -42.4,-27.2 L -43.4,-25 L -44.5,-22.6 L -48.3,-14.2 L -51.4,-7.4 L -50.4,0 L -48.3,14.2 L -48,16.5 L -47.3,21.6 L -44,25.4 L -42.4,27.2 L -40.7,29.2 L -33,38.1 L -25,43.2 L -20.9,45.8 L -7.3,49.8 L -14.7,49.8 L -14.6,49.9 L -7.2,49.9 L 0,52 L 0,80.6 L -11,80.6 L -14.8,74 L -28.8,49.8 L -56,49.8 L -46.3,59.9 L -44.7,61.5 L -38.9,67.5 L -26.2,80.6 L -0.1,80.6 L 0,80.7 L 0,99.7 Z';

/**
 * 12 Chromatic Solfege Syllables in ascending semitone order relative to Do.
 */
export const SOLFEGE_SYLLABLES = [
  'Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'So', 'Le', 'La', 'Te', 'Ti'
] as const;

/**
 * PPT Solfege Specifications:
 * Syllable -> Glyph Type, Rotation, Canonical Colour, Semitone offset, and Nearest-Address coordinate (-5 to +6)
 */
export const SOLFEGE_SPECS: Record<string, SolfegeSpec> = {
  Do: { canonicalSyllable: 'Do', glyphType: 'base', rotation: 0, colorHex: '#E13610', semitone: 0, nearestAddress: 0 },
  Ra: { canonicalSyllable: 'Ra', glyphType: 'sharp', rotation: 0, colorHex: '#F98016', semitone: 1, nearestAddress: 1 },
  Di: { canonicalSyllable: 'Ra', glyphType: 'sharp', rotation: 0, colorHex: '#F98016', semitone: 1, nearestAddress: 1 },
  Re: { canonicalSyllable: 'Re', glyphType: 'flat', rotation: 90, colorHex: '#F98016', semitone: 2, nearestAddress: 2 },
  Me: { canonicalSyllable: 'Me', glyphType: 'base', rotation: 90, colorHex: '#F5D432', semitone: 3, nearestAddress: 3 },
  Ri: { canonicalSyllable: 'Me', glyphType: 'base', rotation: 90, colorHex: '#F5D432', semitone: 3, nearestAddress: 3 },
  Mi: { canonicalSyllable: 'Mi', glyphType: 'sharp', rotation: 90, colorHex: '#F5D432', semitone: 4, nearestAddress: 4 },
  Fa: { canonicalSyllable: 'Fa', glyphType: 'flat', rotation: 180, colorHex: '#43A440', semitone: 5, nearestAddress: 5 },
  Fi: { canonicalSyllable: 'Fi', glyphType: 'base', rotation: 180, colorHex: '#141414', semitone: 6, nearestAddress: 6 },
  Se: { canonicalSyllable: 'Fi', glyphType: 'base', rotation: 180, colorHex: '#141414', semitone: 6, nearestAddress: 6 },
  So: { canonicalSyllable: 'So', glyphType: 'sharp', rotation: 180, colorHex: '#0032A4', semitone: 7, nearestAddress: -5 },
  Si: { canonicalSyllable: 'So', glyphType: 'sharp', rotation: 180, colorHex: '#0032A4', semitone: 7, nearestAddress: -5 },
  Le: { canonicalSyllable: 'Le', glyphType: 'flat', rotation: 270, colorHex: '#5300A4', semitone: 8, nearestAddress: -4 },
  La: { canonicalSyllable: 'La', glyphType: 'base', rotation: 270, colorHex: '#5300A4', semitone: 9, nearestAddress: -3 },
  Li: { canonicalSyllable: 'La', glyphType: 'base', rotation: 270, colorHex: '#5300A4', semitone: 9, nearestAddress: -3 },
  Te: { canonicalSyllable: 'Te', glyphType: 'sharp', rotation: 270, colorHex: '#F158A4', semitone: 10, nearestAddress: -2 },
  Ti: { canonicalSyllable: 'Ti', glyphType: 'flat', rotation: 0, colorHex: '#F158A4', semitone: 11, nearestAddress: -1 },
};

/**
 * Standard pitch names for absolute display
 */
export const PITCH_NAMES_DUAL = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
export const PITCH_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const PITCH_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/**
 * Tri Pitch-Class Notation (Prime Period Theory):
 * An absolute pitch-class naming scheme for twelve-tone equal temperament (12TET).
 * It assigns each of the five chromatic accidentals a single, unambiguous name derived from
 * its tritone relationship (6 semitones) to a diatonic natural note.
 * B and F are excluded from having a Tri prefix as they are already both natural notes.
 */
export const TRI_PITCH_CLASSES = [
  'C',     // 0
  '△G',    // 1: C♯/D♭ -> tritone of G
  'D',     // 2
  '△A',    // 3: D♯/E♭ -> tritone of A
  'E',     // 4
  'F',     // 5: Natural note (B-F is natural tritone pair)
  '△C',    // 6: F♯/G♭ -> tritone of C
  'G',     // 7
  '△D',    // 8: G♯/A♭ -> tritone of D
  'A',     // 9
  '△E',    // 10: A♯/B♭ -> tritone of E
  'B',     // 11: Natural note
];

export const TRI_PITCH_CLASSES_SPOKEN = [
  'C',
  'Tri-G',
  'D',
  'Tri-A',
  'E',
  'F',
  'Tri-C',
  'G',
  'Tri-D',
  'A',
  'Tri-E',
  'B',
];

export const TRI_PITCH_CLASSES_SHORT = [
  'C',
  'tG',
  'D',
  'tA',
  'E',
  'F',
  'tC',
  'G',
  'tD',
  'A',
  'tE',
  'B',
];

export function getTriPitchClass(pitchClass: number, format: 'symbol' | 'spoken' | 'short' = 'symbol'): string {
  const pc = ((pitchClass % 12) + 12) % 12;
  if (format === 'spoken') return TRI_PITCH_CLASSES_SPOKEN[pc];
  if (format === 'short') return TRI_PITCH_CLASSES_SHORT[pc];
  return TRI_PITCH_CLASSES[pc];
}

export const INTERVAL_NAMES = ['1', '♭2', '2', '♭3', '3', '4', '♯4/♭5', '5', '♭6', '6', '♭7', '7'];

/**
 * Piano Triangle mapping from Pitch Class (0=C, 1=C# ... 11=B)
 */
export const PITCH_CLASS_TO_PIANO_TRIANGLE: Record<number, PianoTriangleInfo> = {
  0: { triangle: 'R', point: 3 },  // C
  1: { triangle: 'D', point: 1 },  // C#
  2: { triangle: 'D', point: 2 },  // D
  3: { triangle: 'D', point: 3 },  // D#
  4: { triangle: 'L', point: 1 },  // E
  5: { triangle: 'L', point: 2 },  // F
  6: { triangle: 'L', point: 3 },  // F#
  7: { triangle: 'U', point: 1 },  // G
  8: { triangle: 'U', point: 2 },  // G#
  9: { triangle: 'U', point: 3 },  // A
  10: { triangle: 'R', point: 1 }, // A# / Bb
  11: { triangle: 'R', point: 2 }, // B
};

/**
 * Triangle Geometry for SVG and Canvas vector rendering (100x100 viewBox)
 */
export const TRIANGLE_VERTEX_COORDINATES: Record<PianoTriangleType, {
  path: string;
  points: Record<PianoTrianglePoint, { x: number; y: number }>;
}> = {
  // Down: Inverted equilateral triangle (apex pointing down at point 2)
  D: {
    path: 'M 15 20 L 85 20 L 50 85 Z',
    points: {
      1: { x: 15, y: 20 }, // C# (top-left raised key)
      2: { x: 50, y: 85 }, // D (bottom central white key)
      3: { x: 85, y: 20 }, // D# (top-right raised key)
    },
  },
  // Left: Right triangle with vertical leg on right (right angle at bottom-right, apex at top-right)
  L: {
    path: 'M 15 80 L 85 80 L 85 20 Z',
    points: {
      1: { x: 15, y: 80 }, // E (bottom-left white key)
      2: { x: 85, y: 80 }, // F (bottom-right white key)
      3: { x: 85, y: 20 }, // F# (top-right raised key)
    },
  },
  // Up: Equilateral triangle (apex pointing up at point 2)
  U: {
    path: 'M 15 80 L 50 15 L 85 80 Z',
    points: {
      1: { x: 15, y: 80 }, // G (bottom-left white key)
      2: { x: 50, y: 15 }, // G# (top central raised key)
      3: { x: 85, y: 80 }, // A (bottom-right white key)
    },
  },
  // Right: Right triangle with vertical leg on left (right angle at bottom-left, apex at top-left)
  R: {
    path: 'M 15 20 L 15 80 L 85 80 Z',
    points: {
      1: { x: 15, y: 20 }, // A# (top-left raised key)
      2: { x: 15, y: 80 }, // B (bottom-left white key)
      3: { x: 85, y: 80 }, // C (bottom-right white key)
    },
  },
};

/**
 * Calculates the clock angle in radians for a given semitone offset from Do (0..11).
 * 12 o'clock (Do) is at angle -PI/2 (top).
 * Semitone 1 (Ra) is at 1 o'clock.
 * Semitone 6 (Fi) is at 6 o'clock (+PI/2).
 * Semitone 7 (So) is at 7 o'clock.
 */
export function getClockAngleRad(semitone: number): number {
  // semitone 0 = -90deg (-PI/2)
  // Each hour = 30deg = PI/6
  return (semitone * 30 - 90) * (Math.PI / 180);
}

/**
 * Calculates the base central Do for the lowest register of an instrument.
 * For any tonic and lowest note (default: MIDI 21 = A1), this identifies the
 * central Do whose PPT octave register [-5..+6] contains the lowest note.
 */
export function getBaseCenterDo(tonic: number, lowestMidi: number = 21): number {
  const lowestPitchClass = ((lowestMidi % 12) + 12) % 12;
  const lowestSemitone = ((lowestPitchClass - tonic) % 12 + 12) % 12;
  const lowestNearest = lowestSemitone <= 6 ? lowestSemitone : lowestSemitone - 12;
  return lowestMidi - lowestNearest;
}

/**
 * Resolves a MIDI note to its nearest-address register index (0..7) and semitone relative to tonic.
 * 
 * Prime Period Theory (PPT) Octave Register Logic:
 * - Each PPT register is centered symmetrically on Do (address 0, 12 o'clock).
 * - Spans strictly ascending from So (-5, 7 o'clock) around clockwise through Do (0) to Fi (+6, 6 o'clock).
 * - The octave boundary seam is strictly between Fi (+6, 6 o'clock) and So (-5, 7 o'clock).
 * - Crossing from 6 o'clock to 7 o'clock steps into the next octave register.
 * - Outermost pitch clock = register 0 (Octave 1).
 * - Innermost pitch clock = register 7 (Octave 8).
 */
export function resolveMidiToRegisterAndSemitone(
  midi: number,
  tonic: number,
  lowestMidi: number = 21
): {
  semitone: number;
  nearestAddress: number;
  registerIndex: number;
  centerDoMidi: number;
  octave: number;
} {
  const pitchClass = ((midi % 12) + 12) % 12;
  const semitone = ((pitchClass - tonic) % 12 + 12) % 12;
  
  // Nearest address relative to Do: 0..6 -> 0..+6; 7..11 -> -5..-1
  const nearestAddress = semitone <= 6 ? semitone : semitone - 12;
  const centerDoMidi = midi - nearestAddress;

  // Base center Do covering the instrument's lowest note
  const baseCenterDo = getBaseCenterDo(tonic, lowestMidi);
  const regDiff = Math.round((centerDoMidi - baseCenterDo) / 12);
  const registerIndex = Math.max(0, Math.min(7, regDiff));
  const octave = registerIndex + 1;

  return {
    semitone,
    nearestAddress,
    registerIndex,
    centerDoMidi,
    octave,
  };
}

/**
 * Standard acoustic and synthesiser keyboard range presets for the virtual piano.
 */
export interface PianoRangePreset {
  id: string;
  name: string;
  shortName: string;
  keys: number;
  startMidi: number;
  endMidi: number;
  rangeLabel: string;
}

export const PIANO_RANGE_PRESETS: PianoRangePreset[] = [
  { id: '25-key', name: '25 Keys (C3–C5)', shortName: '25k', keys: 25, startMidi: 48, endMidi: 72, rangeLabel: 'C3–C5' },
  { id: '37-key', name: '37 Keys (C3–C6)', shortName: '37k', keys: 37, startMidi: 48, endMidi: 84, rangeLabel: 'C3–C6' },
  { id: '49-key', name: '49 Keys (C2–C6)', shortName: '49k', keys: 49, startMidi: 36, endMidi: 84, rangeLabel: 'C2–C6' },
  { id: '61-key', name: '61 Keys (C2–C7)', shortName: '61k', keys: 61, startMidi: 36, endMidi: 96, rangeLabel: 'C2–C7' },
  { id: '76-key', name: '76 Keys (E1–G7)', shortName: '76k', keys: 76, startMidi: 28, endMidi: 103, rangeLabel: 'E1–G7' },
  { id: '88-key', name: '88 Keys (A0–C8)', shortName: '88k', keys: 88, startMidi: 21, endMidi: 108, rangeLabel: 'A0–C8' },
];

// ============================================================================
// PPT NOTEHEAD TAXONOMY & STAFF NOTATION (Prime Period Theory / ppt-engraver)
// ============================================================================

export type PptNoteheadShape =
  | 'circle'
  | 'diamond'
  | 'square'
  | 'triangle-down'
  | 'triangle-up'
  | 'semicircle-left'
  | 'cross'
  | 'semicircle-right';

export interface PptNoteheadSpec {
  semitone: number; // 0..11 relative to Do
  syllable: string;
  shape: PptNoteheadShape;
  colorHex: string;
  neonColorHex: string;
}

/**
 * 12 Chromatic PPT Notehead Geometries defined by Solfège relative to tonic.
 * Based on Prime Period Theory (ppt-engraver):
 * - Do (0): Circle
 * - Ra / Di (1): Diamond
 * - Re (2): Square
 * - Me / Ri (3): Triangle Down
 * - Mi (4): Triangle Up
 * - Fa / Se (5): Semicircle Left
 * - Fi (6): Cross (X)
 * - So / Si (7): Semicircle Right
 * - Le / Si (8): Triangle Down
 * - La / Li (9): Triangle Up
 * - Te / Li (10): Diamond
 * - Ti (11): Square
 */
export const PPT_NOTEHEAD_SPECS: PptNoteheadSpec[] = [
  { semitone: 0, syllable: 'Do', shape: 'circle', colorHex: '#E13610', neonColorHex: '#FF4D4D' },
  { semitone: 1, syllable: 'Ra', shape: 'diamond', colorHex: '#F98016', neonColorHex: '#FB923C' },
  { semitone: 2, syllable: 'Re', shape: 'square', colorHex: '#F98016', neonColorHex: '#FB923C' },
  { semitone: 3, syllable: 'Me', shape: 'triangle-down', colorHex: '#F5D432', neonColorHex: '#FDE047' },
  { semitone: 4, syllable: 'Mi', shape: 'triangle-up', colorHex: '#F5D432', neonColorHex: '#FDE047' },
  { semitone: 5, syllable: 'Fa', shape: 'semicircle-left', colorHex: '#43A440', neonColorHex: '#4ADE80' },
  { semitone: 6, syllable: 'Fi', shape: 'cross', colorHex: '#141414', neonColorHex: '#38BDF8' },
  { semitone: 7, syllable: 'So', shape: 'semicircle-right', colorHex: '#0032A4', neonColorHex: '#60A5FA' },
  { semitone: 8, syllable: 'Le', shape: 'triangle-down', colorHex: '#5300A4', neonColorHex: '#C084FC' },
  { semitone: 9, syllable: 'La', shape: 'triangle-up', colorHex: '#5300A4', neonColorHex: '#C084FC' },
  { semitone: 10, syllable: 'Te', shape: 'diamond', colorHex: '#F158A4', neonColorHex: '#F472B6' },
  { semitone: 11, syllable: 'Ti', shape: 'square', colorHex: '#F158A4', neonColorHex: '#F472B6' },
];

/**
 * Maps a chromatic semitone difference from tonic (0..11) to its canonical PPT notehead specification.
 */
export function getPptNoteheadSpec(semitoneFromTonic: number): PptNoteheadSpec {
  const norm = ((semitoneFromTonic % 12) + 12) % 12;
  return PPT_NOTEHEAD_SPECS[norm];
}

/**
 * Diatonic Pitch Mapping:
 * C4 (Middle C, MIDI 60) is diatonic step 0.
 * Steps: C=0, D=1, E=2, F=3, G=4, A=5, B=6, C5=7, etc.
 */
const DIATONIC_STEP_BY_PC_SHARP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const ACCIDENTAL_BY_PC_SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0]; // 0=nat, 1=sharp

const DIATONIC_STEP_BY_PC_FLAT = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const ACCIDENTAL_BY_PC_FLAT = [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0]; // 0=nat, -1=flat

export interface DiatonicStaffNote {
  diatonicStep: number; // 0 = C4 (Middle C), 2 = E4, -10 = G2, etc.
  accidental: -1 | 0 | 1; // -1 = flat, 0 = natural, 1 = sharp
  letterName: string; // 'C', 'D', 'E', 'F', 'G', 'A', 'B'
}

/**
 * Resolves a MIDI note to its diatonic staff step and accidental.
 */
export function midiToDiatonicStaffNote(
  midi: number,
  preferFlats: boolean = false
): DiatonicStaffNote {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1; // 60 -> octave 4
  const octaveOffset = (octave - 4) * 7;

  const steps = preferFlats ? DIATONIC_STEP_BY_PC_FLAT : DIATONIC_STEP_BY_PC_SHARP;
  const accs = preferFlats ? ACCIDENTAL_BY_PC_FLAT : ACCIDENTAL_BY_PC_SHARP;

  const letterSteps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const baseStep = steps[pc];
  const diatonicStep = octaveOffset + baseStep;
  const accidental = accs[pc] as -1 | 0 | 1;
  const letterName = letterSteps[baseStep];

  return { diatonicStep, accidental, letterName };
}

/**
 * Standard Key Signatures for all 12 tonics (Major scales):
 * positive = sharps, negative = flats
 */
export const TONIC_TO_KEY_SIGNATURE: Record<number, { sharpsFlats: number; accidentals: string[] }> = {
  0: { sharpsFlats: 0, accidentals: [] }, // C
  1: { sharpsFlats: -5, accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'] }, // Db
  2: { sharpsFlats: 2, accidentals: ['F#', 'C#'] }, // D
  3: { sharpsFlats: -3, accidentals: ['Bb', 'Eb', 'Ab'] }, // Eb
  4: { sharpsFlats: 4, accidentals: ['F#', 'C#', 'G#', 'D#'] }, // E
  5: { sharpsFlats: -1, accidentals: ['Bb'] }, // F
  6: { sharpsFlats: 6, accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'] }, // F#
  7: { sharpsFlats: 1, accidentals: ['F#'] }, // G
  8: { sharpsFlats: -4, accidentals: ['Bb', 'Eb', 'Ab', 'Db'] }, // Ab
  9: { sharpsFlats: 3, accidentals: ['F#', 'C#', 'G#'] }, // A
  10: { sharpsFlats: -2, accidentals: ['Bb', 'Eb'] }, // Bb
  11: { sharpsFlats: 5, accidentals: ['F#', 'C#', 'G#', 'D#', 'A#'] }, // B
};

/**
 * Determines whether a MIDI note or pitch class corresponds to a physical black key on a standard piano.
 * Black keys: C# (1), D# (3), F# (6), G# (8), A# (10).
 * White keys: C (0), D (2), E (4), F (5), G (7), A (9), B (11).
 */
export function isBlackPianoKey(midiOrPitchClass: number): boolean {
  const pc = ((midiOrPitchClass % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

