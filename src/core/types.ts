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

export interface TonicShiftMarker {
  id: string;
  oldTonic: number;
  newTonic: number;
  timestamp: number; // in seconds
  isAuto: boolean;
}

export type StreamMode = 'fixed' | 'continuous';
export type StreamOrientation = 'horizontal' | 'vertical';
export type StreamDirection = 'rtl' | 'ltr' | 'ttb' | 'btt';
export type PresentationFormat = 'glyphs' | 'pianoTriangles' | 'syllables' | 'pitchNames' | 'triPitches';
export type BackgroundTheme = 'studio-obsidian' | 'cosmic-abyss' | 'carbon-grid' | 'velvet-dark';
export type LayoutMode = 'balanced' | 'monument' | 'river' | 'waterfall' | 'dual-stream' | 'orbital-focus' | 'signature' | 'harmonic';
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

// --- FLEXBOX LAYOUT ARCHITECTURE ---
export type LayoutFlexDirection = 'row' | 'column';
export type VisualiserModuleType = 'orbital' | 'stream' | 'triangles' | 'overtones' | 'staff-stream';

export type StaffSize = 'single' | 'grand';
export type StaffClef =
  | 'dynamic'
  | 'treble'
  | 'treble_8va'
  | 'treble_8vb'
  | 'bass'
  | 'bass_8va'
  | 'bass_8vb'
  | 'alto'
  | 'tenor';

export interface OrbitalModuleConfig {
  octaveMode: 'dynamic' | 'fixed8';
  startOctave: number; // 1..8
  endOctave: number; // 1..8
  showOctaveNumbers: boolean;
  clockLabelPriorities: ClockLabelType[];
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
}

export interface StreamModuleConfig {
  streamMode: StreamMode;
  orientation: StreamOrientation;
  direction: StreamDirection;
  fixedWindowSize: number; // 1..32
  presentationFormat: PresentationFormat;
  singleWindowRotationAnimation: boolean;
  scrollSpeed: number; // px per second
  streamFilterRegister: 'all' | 'bass' | 'mid' | 'treble';
  streamMinVelocity: number; // 0..1
}

export interface StaffStreamModuleConfig {
  staffStreamMode: StreamMode; // 'fixed' | 'continuous'
  staffFixedWindowSize: number; // default: 8
  staffSize: StaffSize; // 'single' | 'grand'
  staffClef: StaffClef; // default: 'dynamic'
  includeCClefs: boolean; // default: false (Alto & Tenor C-clefs for single staff)
  staffScrollSpeed: number; // px per second (default: 160)
  showKeySignature: boolean; // default: false
  showVoiceLeadingLines: boolean; // default: true
  staffFilterRegister: 'all' | 'bass' | 'mid' | 'treble';
  staffMinVelocity: number; // 0..1
  noteEntranceAnimation?: boolean; // default: true (elastic scale pop & radiant flash)
  staffSparksEnabled?: boolean; // default: true (directional sparks at origin line)
  staffAbsorptionEnabled?: boolean; // default: true (dissipation ripple at termination line)
  voiceLeadingUndulation?: boolean; // default: true (harmonic wave undulation on SATB lines)
}

export interface PianoTrianglesModuleConfig {
  showVertexLabels: boolean;
  vertexLabelType: 'syllables' | 'pitches' | 'triPitches' | 'intervals' | 'none';
  showCenterAnchor: boolean;
  triangleSparksEnabled?: boolean; // default: true (kinetic spark bursts on active vertices)
  triangleShockwavesEnabled?: boolean; // default: true (kinetic shockwave rings on active vertices)
  triangleLensFlaresEnabled?: boolean; // default: true (optical lens flares on active vertices)
}

export interface OvertonesModuleConfig {
  showDissonanceCurve: boolean;
  showOvertoneLabels: boolean;
  fluidSpeed: number; // 0.2..3.0
  waveFluidity: number; // 0..1
  minFrequency: number;
  maxFrequency: number;
  overtoneDropletsEnabled?: boolean; // default: true (fluid droplet particle ejection from fundamental crests)
}

export type ModuleCellConfig =
  | OrbitalModuleConfig
  | StreamModuleConfig
  | StaffStreamModuleConfig
  | PianoTrianglesModuleConfig
  | OvertonesModuleConfig;

export interface LayoutCellNode {
  id: string;
  type: 'cell';
  module: VisualiserModuleType;
  title?: string;
  flex?: number; // flex-grow weight (default 1)
  minSize?: number; // min width/height in px
  configOverrides?: Partial<
    OrbitalModuleConfig &
      StreamModuleConfig &
      StaffStreamModuleConfig &
      PianoTrianglesModuleConfig &
      OvertonesModuleConfig
  >;
}

export interface LayoutContainerNode {
  id: string;
  type: 'container';
  direction: LayoutFlexDirection;
  flex?: number; // flex weight if nested
  gap?: number; // gap between children in px
  children: LayoutNode[];
}

export type LayoutNode = LayoutContainerNode | LayoutCellNode;

export type LensFlareStyle = 'anamorphic' | 'starburst' | 'cinematic';

export interface AestheticsConfig {
  backgroundTheme: BackgroundTheme;
  filmGrainEnabled?: boolean;
  filmGrainIntensity: number; // 0..1
  filmGrainSize: number; // 1..4
  filmGrainContrast: number; // 0..1
  sparksEnabled?: boolean;
  particleIntensity: number; // 0..1
  particleSize: number; // 0.5..3.0
  particleVolume: number; // 0.2..3.0
  particleGravity: number; // -2.0..+2.0 (buoyancy to gravity)
  particleOriginDistance: number; // 0..60px offset from tone circle edge
  shockwavesEnabled?: boolean; // master toggle for note activation shockwaves
  shockwaveRadius?: number; // 0.4..2.5 max radius multiplier
  shockwaveSpeed?: number; // 0.4..2.5 expansion speed multiplier
  shockwaveDecayDurationMs?: number; // 200..2000 ms decay duration
  glowBloomEnabled?: boolean;
  glowBloom: number; // 0..1
  tonicShiftEffectsEnabled?: boolean;
  motionTrailsEnabled?: boolean;
  motionTrails: number; // 0..0.8
  ghostingEnabled?: boolean;
  ghostingIntensity: number; // 0..1
  lightBleedEnabled?: boolean;
  lightBleedIntensity: number; // 0..1
  scanlinesEnabled?: boolean;
  scanlineIntensity: number; // 0..1
  scanlineDensity: number; // 1..4 (1=Fine, 2=Standard, 3=Retro, 4=Coarse Arcade)
  crtVignette: number; // 0..1
  lensFlareEnabled?: boolean;
  lensFlareIntensity: number; // 0..1
  lensFlareStyle: LensFlareStyle;
  webglEnabled?: boolean;
  clockLabelPriorities: ClockLabelType[];
  glyphContrastMode: GlyphContrastMode;
  soundEnabled: boolean;
  masterVolume: number; // 0..1
  synthWaveform: SynthWaveform;
  showVirtualKeyboard: boolean;
  focusModeEnabled?: boolean;
}

export interface SystemConfig {
  tonic: number; // 0=C, 1=C#, 2=D ...
  accidentalStyle: AccidentalStyle;
  keyboardLowestMidi: number; // Lowest note of instrument (default 21 = A1)
  keyboardHighestMidi: number; // Highest note of instrument (default 108 = C8)
  virtualKeyboardStartMidi: number; // Start note of on-screen virtual piano (default 48 = C3)
  virtualKeyboardEndMidi: number; // End note of on-screen virtual piano (default 72 = C5)
  virtualKeyboardStretchWidth: boolean; // Stretch virtual piano to window horizontal space (default false)
  autoTonicEnabled: boolean;
  autoTonicMode: AutoTonicMode;
  autoTonicCustomDegrees: number[];
  autoTonicSensitivity: AutoTonicSensitivity;
}

export interface LayoutDefinition {
  id: string;
  name: string;
  description?: string;
  root: LayoutContainerNode;
  aesthetics?: Partial<AestheticsConfig>;
}

export interface VisualiserConfig
  extends SystemConfig,
    AestheticsConfig,
    OrbitalModuleConfig,
    StreamModuleConfig,
    StaffStreamModuleConfig,
    PianoTrianglesModuleConfig,
    OvertonesModuleConfig {
  layoutMode: LayoutMode;
  activeLayout: LayoutDefinition;
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
  trackId?: string;
  trackName?: string;
  loop: boolean;
}
