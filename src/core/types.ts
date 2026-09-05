export type AccidentalStyle = 'dual' | 'sharp' | 'flat';

export type PianoTriangleType = 'D' | 'L' | 'U' | 'R';
export type PianoTrianglePoint = 1 | 2 | 3;

export interface PianoTriangleInfo {
  triangle: PianoTriangleType;
  point: PianoTrianglePoint;
}

export type GlyphType = 'base' | 'sharp' | 'flat';
export type GlyphRotation = 0 | 90 | 180 | 270;

export interface SolfegeSpec {
  canonicalSyllable: string;
  glyphType: GlyphType;
  rotation: GlyphRotation;
  colorHex: string;
  semitone: number; // 0..11 relative to Do
  nearestAddress: number; // -5..+6
}

export interface ActiveNote {
  midi: number;
  pitchClass: number; // 0..11
  octave: number; // e.g. 4 for Middle C
  registerIndex: number; // 0..7
  velocity: number; // 0..1 normalized
  startTime: number;
  endTime?: number;
  releaseTime?: number;
  colorHex: string;
  solfege: string;
  pianoTriangle: PianoTriangleInfo;
}

export interface StreamItem {
  id: string;
  midi: number;
  pitchClass: number;
  octave: number;
  velocity: number;
  timestamp: number;
  duration?: number;
  colorHex: string;
  solfege: string;
  pitchName: string;
  triPitchName?: string;
  interval: string;
  pianoTriangle: PianoTriangleInfo;
  glyphType: GlyphType;
  rotation: GlyphRotation;
}

export type StreamMode = 'fixed' | 'continuous';
export type PresentationFormat = 'glyphs' | 'pianoTriangles' | 'syllables' | 'pitchNames' | 'triPitches';
export type BackgroundTheme = 'studio-obsidian' | 'cosmic-abyss' | 'carbon-grid' | 'velvet-dark';
export type LayoutMode = 'balanced' | 'monument' | 'river';
export type SynthWaveform = 'warm-poly' | 'sine' | 'triangle' | 'sawtooth';
export type ToneRevealMode = 'played' | 'all';
export type RegisterWeightMode = 'organic' | 'discovered' | 'fixed8';
export type InactiveRegisterDisplay = 'hidden' | 'faint' | 'equal';
export type GlyphContrastMode = 'high' | 'solfege';
export type ClockLabelType = 'glyphs' | 'triangles' | 'syllables' | 'pitches' | 'triPitches' | 'intervals' | 'none';

export type AutoTonicMode =
  | 'ionian'
  | 'aeolian'
  | 'dorian'
  | 'mixolydian'
  | 'lydian'
  | 'phrygian'
  | 'locrian'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'pentatonic-major'
  | 'pentatonic-minor'
  | 'blues'
  | 'custom';

export type AutoTonicSensitivity = 'fast' | 'balanced' | 'conservative';

export interface VisualiserConfig {
  // General & Tonic
  tonic: number; // 0=C, 1=C#, 2=D ...
  accidentalStyle: AccidentalStyle;
  autoTonicEnabled: boolean;
  autoTonicMode: AutoTonicMode;
  autoTonicCustomDegrees: number[]; // e.g. [0, 2, 4, 5, 7, 9, 11]
  autoTonicSensitivity: AutoTonicSensitivity;
  
  // Pitch Clock
  octaveMode: 'dynamic' | 'fixed8';
  keyboardLowestMidi: number; // Lowest note of keyboard/instrument (default 21 = A1)
  keyboardHighestMidi: number; // Highest note of keyboard/instrument (default 108 = C8)
  startOctave: number; // 1..8 (lowest / outermost ring)
  endOctave: number; // 1..8 (highest / innermost ring)
  showOctaveNumbers: boolean; // Show clean octave numbers (1..8) on rings
  clockLabelPriorities: ClockLabelType[]; // 8 priority slots for orbit labels from largest to smallest orbit
  toneRevealMode: ToneRevealMode;
  registerWeightMode: RegisterWeightMode;
  inactiveRegisterDisplay: InactiveRegisterDisplay;
  organicWindowDurationSec: number;
  glyphContrastMode: GlyphContrastMode;
  showUniformSolfege: boolean;
  showPianoTriangles: boolean;
  showSyllables: boolean;
  showPitchNames: boolean;
  showIntervals: boolean;
  decayDurationMs: number;
  connectChordRays: boolean;
  chordRayMode: 'hull' | 'web';
  showRadialMovementTrails: boolean;
  pulseShockwaves: boolean;
  
  // Note Stream
  streamMode: StreamMode;
  fixedWindowSize: number; // 1..32
  presentationFormat: PresentationFormat;
  singleWindowRotationAnimation: boolean;
  scrollSpeed: number; // px per second
  streamFilterRegister: 'all' | 'bass' | 'mid' | 'treble';
  streamMinVelocity: number; // 0..1

  // Cosmetics & Aesthetics
  backgroundTheme: BackgroundTheme;
  filmGrainIntensity: number; // 0..1
  filmGrainSize: number; // 1..4 (1=Fine 35mm, 2=Medium 16mm, 3=Coarse 8mm, 4=Chunky Vintage)
  filmGrainContrast: number; // 0..1 (0=Soft, 1=High-Contrast Gritty)
  particleIntensity: number; // 0..1
  glowBloom: number; // 0..1
  motionTrails: number; // 0..0.8
  ghostingIntensity: number; // 0..1 (Phosphor ghost trails / temporal lag)
  lightBleedIntensity: number; // 0..1 (Analog lens flare / halation / horizontal anamorphic glow)

  // Layout & Audio
  layoutMode: LayoutMode;
  showVirtualKeyboard: boolean;
  masterVolume: number; // 0..1
  soundEnabled: boolean;
  synthWaveform: SynthWaveform;
}

export interface MidiDeviceState {
  inputs: Array<{ id: string; name: string; manufacturer?: string }>;
  selectedInputId: string | null;
  isConnected: boolean;
}

export interface MidiPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tempoMultiplier: number;
  trackName?: string;
  loop: boolean;
}
