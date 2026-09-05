import { VisualiserConfig } from './types';

export const STORAGE_KEY = 'ppt_visualiser_config_v1';

/**
 * Default configuration follows PPT's "Default Do: D on 12TET Keyboards"
 * (D = pitch class 2), providing physical black/white symmetry around Do (D)
 * and Fi (G#/Ab) on standard keyboards.
 */
export const DEFAULT_CONFIG: VisualiserConfig = {
  // General & Tonic: Do is D (2) by default
  tonic: 2, // 2 = D
  accidentalStyle: 'dual',
  autoTonicEnabled: false,
  autoTonicMode: 'ionian',
  autoTonicCustomDegrees: [0, 2, 4, 5, 7, 9, 11],
  autoTonicSensitivity: 'balanced',

  // Pitch Clock (Concentric rings)
  octaveMode: 'dynamic', // Starts with dynamic organic discovery
  keyboardLowestMidi: 21, // Lowest note of instrument (default 21 = A1)
  keyboardHighestMidi: 108, // Highest note of instrument (default 108 = C8)
  startOctave: 1, // 1..8 (lowest / outermost ring)
  endOctave: 8, // 1..8 (highest / innermost ring)
  showOctaveNumbers: true, // Display clean octave numbers (1..8) on rings
  clockLabelPriorities: ['glyphs', 'glyphs', 'glyphs', 'glyphs', 'glyphs', 'glyphs', 'glyphs', 'glyphs'],
  toneRevealMode: 'played', // Only show tones that have been played!
  registerWeightMode: 'organic', // Organic window of what is being played
  inactiveRegisterDisplay: 'hidden', // Unused registers omitted to give maximum room to active octaves
  organicWindowDurationSec: 12, // 12 second organic decay window
  glyphContrastMode: 'high', // High-contrast crisp glyphs with luminous outlines and platinum Fi
  showUniformSolfege: true,
  showPianoTriangles: false,
  showSyllables: true,
  showPitchNames: true,
  showIntervals: false,
  decayDurationMs: 900,
  connectChordRays: true,
  chordRayMode: 'hull',
  showRadialMovementTrails: true,
  pulseShockwaves: true,

  // Live Note Stream
  streamMode: 'fixed',
  fixedWindowSize: 8,
  presentationFormat: 'glyphs',
  singleWindowRotationAnimation: true,
  scrollSpeed: 160,
  streamFilterRegister: 'all',
  streamMinVelocity: 0.05,

  // Cosmetics & Aesthetics
  backgroundTheme: 'studio-obsidian',
  filmGrainIntensity: 0.25,
  filmGrainSize: 1,
  filmGrainContrast: 0.5,
  particleIntensity: 0.7,
  glowBloom: 0.85,
  motionTrails: 0.15,
  ghostingIntensity: 0.0,
  lightBleedIntensity: 0.25,

  // Layout & Sound
  layoutMode: 'balanced',
  showVirtualKeyboard: true,
  masterVolume: 0.75,
  soundEnabled: true,
  synthWaveform: 'warm-poly',
};

/**
 * Safely loads user configuration from browser localStorage,
 * falling back to DEFAULT_CONFIG if unset or corrupted.
 */
export function loadSavedConfig(): VisualiserConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_CONFIG };
    }

    const merged = {
      ...DEFAULT_CONFIG,
      ...parsed,
    };

    // Sanitize keyboard instrument range bounds
    merged.keyboardLowestMidi = typeof merged.keyboardLowestMidi === 'number'
      ? Math.max(0, Math.min(120, Math.round(merged.keyboardLowestMidi)))
      : 21;
    merged.keyboardHighestMidi = typeof merged.keyboardHighestMidi === 'number'
      ? Math.max(merged.keyboardLowestMidi + 12, Math.min(127, Math.round(merged.keyboardHighestMidi)))
      : 108;

    // Sanitize octave bounds
    const rawStart = typeof merged.startOctave === 'number' ? merged.startOctave : 1;
    const rawEnd = typeof merged.endOctave === 'number' ? merged.endOctave : 8;
    const startOctave = Math.max(1, Math.min(8, Math.round(rawStart)));
    const endOctave = Math.max(startOctave, Math.min(8, Math.round(rawEnd)));

    merged.startOctave = startOctave;
    merged.endOctave = endOctave;
    merged.showOctaveNumbers = typeof merged.showOctaveNumbers === 'boolean' ? merged.showOctaveNumbers : true;

    // Sanitize 8 clock label priority slots
    const validLabels = new Set(['glyphs', 'triangles', 'syllables', 'pitches', 'triPitches', 'intervals', 'none']);
    const rawPriorities = Array.isArray(merged.clockLabelPriorities) ? merged.clockLabelPriorities : [];
    const sanitizedPriorities = [];
    for (let i = 0; i < 8; i++) {
      const val = rawPriorities[i];
      sanitizedPriorities.push(validLabels.has(val) ? val : 'glyphs');
    }
    merged.clockLabelPriorities = sanitizedPriorities as any;

    // Sanitize stream presentation format
    const validPresentation = new Set(['glyphs', 'pianoTriangles', 'syllables', 'pitchNames', 'triPitches']);
    if (!validPresentation.has(merged.presentationFormat)) merged.presentationFormat = 'glyphs';

    // Sanitize film grain & artifact settings
    merged.filmGrainSize = Math.max(1, Math.min(4, Math.round(typeof merged.filmGrainSize === 'number' ? merged.filmGrainSize : 1)));
    merged.filmGrainContrast = Math.max(0, Math.min(1, typeof merged.filmGrainContrast === 'number' ? merged.filmGrainContrast : 0.5));
    merged.ghostingIntensity = Math.max(0, Math.min(1, typeof merged.ghostingIntensity === 'number' ? merged.ghostingIntensity : 0.0));
    merged.lightBleedIntensity = Math.max(0, Math.min(1, typeof merged.lightBleedIntensity === 'number' ? merged.lightBleedIntensity : 0.25));

    // Sanitize chord geometry & radial movement trails
    merged.chordRayMode = merged.chordRayMode === 'web' ? 'web' : 'hull';
    merged.showRadialMovementTrails = typeof merged.showRadialMovementTrails === 'boolean' ? merged.showRadialMovementTrails : true;

    // Sanitize auto-tonic settings
    merged.autoTonicEnabled = typeof merged.autoTonicEnabled === 'boolean' ? merged.autoTonicEnabled : false;
    const validAutoModes = new Set([
      'ionian', 'aeolian', 'dorian', 'mixolydian', 'lydian', 'phrygian', 'locrian',
      'harmonic-minor', 'melodic-minor', 'pentatonic-major', 'pentatonic-minor', 'blues', 'custom',
    ]);
    if (!validAutoModes.has(merged.autoTonicMode)) merged.autoTonicMode = 'ionian';
    if (!Array.isArray(merged.autoTonicCustomDegrees) || merged.autoTonicCustomDegrees.length === 0) {
      merged.autoTonicCustomDegrees = [0, 2, 4, 5, 7, 9, 11];
    } else {
      const degrees = merged.autoTonicCustomDegrees
        .filter((d: any): d is number => typeof d === 'number' && d >= 0 && d <= 11)
        .map((d: number) => Math.round(d));
      merged.autoTonicCustomDegrees = Array.from(new Set<number>(degrees)).sort((a, b) => a - b);
      if (merged.autoTonicCustomDegrees.length === 0) merged.autoTonicCustomDegrees = [0, 2, 4, 5, 7, 9, 11];
    }
    const validSensitivities = new Set(['fast', 'balanced', 'conservative']);
    if (!validSensitivities.has(merged.autoTonicSensitivity)) merged.autoTonicSensitivity = 'balanced';

    return merged;
  } catch (err) {
    console.warn('[Config] Failed to load saved config from localStorage:', err);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Persists user configuration to browser localStorage.
 */
export function saveConfig(config: VisualiserConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('[Config] Failed to persist config to localStorage:', err);
  }
}

/**
 * Clears saved configuration from browser localStorage.
 */
export function clearSavedConfig(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[Config] Failed to clear config from localStorage:', err);
  }
}
