import {
  ActiveNote,
  VisualiserConfig,
} from '../core/types';
import {
  SOLFEGE_SYLLABLES,
  SOLFEGE_SPECS,
  PITCH_NAMES_SHARP,
  getBaseCenterDo,
  getDecayFadeFactor,
} from '../core/ppt-constants';
import { compute2DConvexHull, Point2D } from '../core/convex-hull';
import {
  NUM_PARTIALS,
  REFERENCE_DISSONANCE_SCALE,
  INTERVAL_DISSONANCE_WEIGHTS,
  midiToFrequency,
  calculatePlompLevelt,
  computePartialAmplitudeRatio,
  hexToRgba,
  getContrastingTextColor,
} from './overtones-canvas';

export const ADAPTIVE_COMPACTION_GAMMA = 1.65;
export const FULL_COMPACTION_GAMMA = 1.35;

export interface SpiralOvertonePartial {
  partialNumber: number; // 1..7 (1 = fundamental)
  frequency: number;     // Hz
  u: number;             // Continuous octave coordinate relative to baseCenterDo
  angle: number;         // Clock angle in radians (Do = -PI/2, clockwise)
  baseRadius: number;    // Baseline radius on the continuous spiral
  amplitude: number;     // Outward radial wave displacement in px
  normalisedAmp: number; // Zoom- and compaction-invariant amplitude (0..1) for psychoacoustic corona
  sigmaU: number;        // Spatial Gaussian envelope width in octaves
  semitone: number;      // Nearest 12TET semitone 0..11 relative to active tonic
  solfege: string;       // 'Do', 'Re', etc.
  colorHex: string;      // Canonical Uniform Solfège hex
  isFundamental: boolean;
  baseX: number;         // Spiral anchor X
  baseY: number;         // Spiral anchor Y
  crestX: number;        // Outward displaced wave crest X
  crestY: number;        // Outward displaced wave crest Y
}

export interface SpiralNoteSeries {
  noteMidi: number;
  velocity: number;
  isDecaying: boolean;
  decayProgress: number;
  partials: SpiralOvertonePartial[];
}

export interface SpiralLayoutGeometry {
  cx: number;
  cy: number;
  halfMin: number;
  spiralOuterR: number;
  spiralInnerR: number;
  coronaBaseR: number;
  maxCoronaH: number;
}

/**
 * Converts a frequency in Hz to a continuous octave coordinate `u`
 * relative to the instrument's base central Do.
 * Integer steps of `u` fall cleanly on the 12 o'clock Do zenith.
 */
export function freqToOctaveU(
  freqHz: number,
  tonic: number,
  lowestMidi: number = 21
): number {
  const baseCenterDo = getBaseCenterDo(tonic, lowestMidi);
  const continuousMidi = 69 + 12 * Math.log2(Math.max(1e-3, freqHz) / 440);
  return (continuousMidi - baseCenterDo) / 12;
}

/**
 * Maps a continuous octave coordinate `u` to a polar clock angle in radians.
 * Do (`u % 1 === 0`) sits at 12 o'clock (`-PI/2`), ascending clockwise.
 */
export function octaveUToClockAngleRad(u: number): number {
  const frac = ((u % 1) + 1) % 1;
  return frac * Math.PI * 2 - Math.PI / 2;
}

/**
 * Computes the register-scaled Gaussian wave envelope width (in octaves) for a given frequency.
 * Lower registers produce broader angular swells; upper registers tighten cleanly toward treble hubs.
 */
export function computeSpiralRegisterSigmaU(freqHz: number): number {
  const semitones = Math.max(0.38, Math.min(1.05, 0.65 * Math.pow(440 / Math.max(20, freqHz), 0.22)));
  return semitones / 12;
}

/**
 * Computes the shortest signed angular distance in degrees within (-180, 180].
 */
export function shortestAngularDeltaDeg(fromDeg: number, toDeg: number): number {
  let delta = (((toDeg - fromDeg) % 360) + 360) % 360;
  if (delta > 180) delta -= 360;
  return delta;
}

/**
 * Deposits a circular Gaussian impulse onto a ring buffer of angular bins (wrapping cleanly mod `bins.length`).
 */
export function depositCircularGaussian(
  bins: Float32Array,
  centerDeg: number,
  sigmaDeg: number,
  energy: number
): void {
  const len = bins.length;
  if (len === 0 || energy <= 0 || sigmaDeg <= 0) return;

  const degPerBin = 360 / len;
  const binRadius = Math.ceil((sigmaDeg * 2.5) / degPerBin);
  const normalisedCenter = ((centerDeg % 360) + 360) % 360;
  const centerBin = Math.round(normalisedCenter / degPerBin);
  const twoSigmaSq = 2 * sigmaDeg * sigmaDeg;

  for (let offset = -binRadius; offset <= binRadius; offset++) {
    const binDeg = (centerBin + offset) * degPerBin;
    const delta = shortestAngularDeltaDeg(normalisedCenter, binDeg);
    const idx = (((centerBin + offset) % len) + len) % len;
    bins[idx] += energy * Math.exp(-(delta * delta) / twoSigmaSq);
  }
}

/**
 * Evaluates the concave nautilus compaction curve w(t) = 1 - (1 - t)^gamma,
 * safely guarded for out-of-range t values during spring zoom transitions.
 */
export function computeCompactedProgress(
  t: number,
  gamma: number = ADAPTIVE_COMPACTION_GAMMA
): number {
  if (t <= 0) return t * gamma;
  if (t >= 1) return 1 + (t - 1) * 0.2;
  return 1 - Math.pow(1 - t, gamma);
}

/**
 * Computes the baseline polar radius on the compacted logarithmic spiral for octave coordinate `u`.
 * Outer fundamental turns receive wider radial lanes while inner high-overtone turns compact inward.
 */
export function computeSpiralRadius(
  u: number,
  uMin: number,
  uMax: number,
  spiralInnerR: number,
  spiralOuterR: number,
  gamma: number = ADAPTIVE_COMPACTION_GAMMA
): number {
  const t = (u - uMin) / Math.max(1e-4, uMax - uMin);
  const w = computeCompactedProgress(t, gamma);
  return Math.max(4, spiralOuterR - w * (spiralOuterR - spiralInnerR));
}

/**
 * Computes derivative-scaled radial turn spacing at octave coordinate `u` under the compaction curve.
 */
export function computeLocalTurnSpacing(
  u: number,
  uMin: number,
  uMax: number,
  spiralInnerR: number,
  spiralOuterR: number,
  gamma: number = ADAPTIVE_COMPACTION_GAMMA
): number {
  const uSpan = Math.max(1, uMax - uMin);
  const t = Math.max(0, Math.min(0.95, (u - uMin) / uSpan));
  const localDeriv = gamma * Math.pow(Math.max(0.05, 1 - t), gamma - 1);
  return (Math.max(8, spiralOuterR - spiralInnerR) / uSpan) * localDeriv;
}

/**
 * Resolves accessible fill and stroke hex colours for low-luminance degrees (such as Fi)
 * so dark-theme wave ridges remain crisp and unmistakable.
 */
function resolveWaveVisualColors(colorHex: string): { fillHex: string; strokeHex: string } {
  const clean = colorHex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma < 45) {
      return { fillHex: '#64748B', strokeHex: '#CBD5E1' };
    }
  }
  return { fillHex: colorHex, strokeHex: colorHex };
}

/**
 * Computes responsive polar geometry for the Harmonic Spiral canvas cell.
 * Maximises spiral diameter out toward the viewport edges while reserving clean
 * outward radial headroom for fundamental waves inside the dissonance corona.
 */
export function computeSpiralLayoutGeometry(
  width: number,
  height: number,
  showDissonance: boolean
): SpiralLayoutGeometry {
  const cx = width / 2;
  const cy = height / 2;
  const halfMin = Math.min(width, height) / 2;
  const edgeR = Math.max(24, halfMin - 6);

  const coronaBaseR = showDissonance ? edgeR * 0.87 : edgeR * 0.98;
  const maxCoronaH = showDissonance ? edgeR * 0.11 : 0;
  const spiralOuterR = showDissonance ? edgeR * 0.72 : edgeR * 0.81;
  const spiralInnerR = Math.max(16, edgeR * 0.14);

  return {
    cx,
    cy,
    halfMin,
    spiralOuterR,
    spiralInnerR,
    coronaBaseR,
    maxCoronaH,
  };
}

/**
 * Computes the 7 harmonic partials for a note projected onto the compacted continuous logarithmic spiral.
 */
export function computeSpiralPartials(
  midi: number,
  velocity: number,
  tonic: number,
  lowestMidi: number,
  uMin: number,
  uMax: number,
  spiralInnerR: number,
  spiralOuterR: number,
  cx: number,
  cy: number,
  minFreq: number = 27.5,
  maxFreq: number = 6000,
  attackProgress: number = 1.0,
  decayProgress: number = 0.0,
  compactionGamma: number = ADAPTIVE_COMPACTION_GAMMA,
  maxCrestRadius?: number
): SpiralOvertonePartial[] {
  const f1 = midiToFrequency(midi);
  const clampedVel = Math.max(0, Math.min(1, velocity));
  const velScale = 0.42 + 0.58 * clampedVel;
  const normBase = 0.28 + 0.72 * clampedVel;

  const partials: SpiralOvertonePartial[] = [];

  for (let n = 1; n <= NUM_PARTIALS; n++) {
    const fn = f1 * n;
    if (fn < minFreq || fn > maxFreq) continue;

    const u = freqToOctaveU(fn, tonic, lowestMidi);
    const angle = octaveUToClockAngleRad(u);
    const baseRadius = computeSpiralRadius(u, uMin, uMax, spiralInnerR, spiralOuterR, compactionGamma);
    const localSpacing = computeLocalTurnSpacing(u, uMin, uMax, spiralInnerR, spiralOuterR, compactionGamma);

    const partialMidi = midi + 12 * Math.log2(n);
    const roundedMidi = Math.round(partialMidi);
    const semitone = ((roundedMidi - tonic) % 12 + 12) % 12;
    const syllable = SOLFEGE_SYLLABLES[semitone];
    const spec = SOLFEGE_SPECS[syllable] || SOLFEGE_SPECS['Do'];

    const ampRatio = computePartialAmplitudeRatio(n, clampedVel, attackProgress, decayProgress);
    const rawAmp = localSpacing * (n === 1 ? 0.96 : 0.86) * velScale * ampRatio;
    const ceiling = maxCrestRadius !== undefined ? Math.max(4, maxCrestRadius - baseRadius) : Infinity;
    const amplitude = Math.min(rawAmp, ceiling);
    const normalisedAmp = normBase * ampRatio;
    const sigmaU = computeSpiralRegisterSigmaU(fn);

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const baseX = cx + baseRadius * cosA;
    const baseY = cy + baseRadius * sinA;
    const crestRadius = baseRadius + amplitude;
    const crestX = cx + crestRadius * cosA;
    const crestY = cy + crestRadius * sinA;

    partials.push({
      partialNumber: n,
      frequency: fn,
      u,
      angle,
      baseRadius,
      amplitude,
      normalisedAmp,
      sigmaU,
      semitone,
      solfege: syllable,
      colorHex: spec.colorHex,
      isFundamental: n === 1,
      baseX,
      baseY,
      crestX,
      crestY,
    });
  }

  return partials;
}

/**
 * High-performance 2D Canvas renderer for the Harmonic Spiral cell.
 *
 * Local Contracts:
 * - 60 FPS performance target with preallocated typed buffers.
 * - Zero `ctx.shadowBlur` in per-frame loops (optical bloom delegated to WebGL).
 * - Zero React reconciliation in render loops.
 * - English (Australian) spelling maintained throughout.
 */
export class SpiralOvertonesRenderer {
  public static readonly REFERENCE_DISSONANCE_SCALE = REFERENCE_DISSONANCE_SCALE;

  // Preallocated typed buffers for continuous spiral surface and outer angular corona
  private readonly numSpiralBins = 768;
  private readonly spiralHeightfield = new Float32Array(768);
  private readonly coronaBins = new Float32Array(360);

  // Preallocated resonance beam buckets across 60 angular sectors (6 deg each)
  private readonly numSpokeBuckets = 60;
  private readonly bucketMinR = new Float32Array(60);
  private readonly bucketMaxR = new Float32Array(60);
  private readonly bucketAlpha = new Float32Array(60);
  private readonly bucketAngle = new Float32Array(60);
  private readonly bucketColor: string[] = new Array(60).fill('#ffffff');

  // Preallocated reusable scratch containers to eliminate per-frame heap churn
  private readonly activeSeriesList: SpiralNoteSeries[] = [];
  private readonly activeLightSources: Array<{ x: number; y: number; velocity: number; colorHex: string }> = [];
  private readonly fundamentalPoints: Point2D[] = [];
  private readonly labelCandidatePartials: SpiralOvertonePartial[] = [];
  private readonly placedLabels: Array<{ x: number; y: number; r: number }> = Array.from(
    { length: 64 },
    () => ({ x: 0, y: 0, r: 0 })
  );
  private placedLabelsCount = 0;

  // Spring-smoothed octave window bounds
  private currentMinU = 1.5;
  private currentMaxU = 4.8;
  private hasInitialisedBounds = false;
  private lastTime = 0;

  // Cached layout state for coordinate queries and radial particle ejection
  private lastWidth = 0;
  private lastHeight = 0;

  /**
   * Main rendering routine invoked by RenderCoordinator.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    activeNotes: Map<number, ActiveNote>,
    decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>,
    config: VisualiserConfig,
    now: number
  ): void {
    this.activeLightSources.length = 0;
    if (width <= 20 || height <= 20) return;

    const tonic = config.tonic;
    const lowestMidi = config.keyboardLowestMidi ?? 21;
    const minFreq = config.minFrequency ?? 27.5;
    const maxFreq = config.maxFrequency ?? 6000;
    const fluidSpeed = config.fluidSpeed ?? 1.0;
    const waveFluidity = config.waveFluidity ?? 0.8;
    const showDissonance = config.showDissonanceCurve ?? true;
    const showLabels = config.showOvertoneLabels ?? true;
    const showChordGeometry = config.showSpiralChordGeometry ?? false;
    const showSpokeResonance = config.showSpokeResonance ?? true;
    const rangeMode = config.spiralRangeMode ?? 'adaptive';
    const compactionGamma = rangeMode === 'full' ? FULL_COMPACTION_GAMMA : ADAPTIVE_COMPACTION_GAMMA;

    const geom = computeSpiralLayoutGeometry(width, height, showDissonance);
    if (geom.spiralOuterR <= geom.spiralInnerR + 4) return;

    const maxCrestRadius = geom.coronaBaseR - 3;

    this.lastWidth = width;
    this.lastHeight = height;

    const dt = this.lastTime === 0 ? 0.016 : Math.min(0.1, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    // 1. Update spring-smoothed octave bounds [uMin, uMax]
    this.updateOctaveBounds(activeNotes, decayingNotes, tonic, lowestMidi, minFreq, maxFreq, rangeMode, dt);
    const uMin = this.currentMinU;
    const uMax = this.currentMaxU;

    // 2. Render backdrop, 12 Solfège radial spokes, and outer pitch-class ring labels
    this.renderBackdropAndSpokes(ctx, width, height, geom, showDissonance);

    // 3. Collect overtone series projected onto the compacted logarithmic spiral
    this.collectSpiralSeries(
      activeNotes,
      decayingNotes,
      tonic,
      lowestMidi,
      uMin,
      uMax,
      geom.spiralInnerR,
      geom.spiralOuterR,
      geom.cx,
      geom.cy,
      minFreq,
      maxFreq,
      now,
      compactionGamma,
      maxCrestRadius
    );

    // Register WebGL optical light sources for active & decaying fundamental crests
    for (let sIdx = 0; sIdx < this.activeSeriesList.length; sIdx++) {
      const series = this.activeSeriesList[sIdx];
      const fPartial = series.partials[0];
      if (!fPartial || fPartial.u < uMin || fPartial.u > uMax) continue;
      const fade = series.isDecaying ? getDecayFadeFactor(series.decayProgress) : 1.0;
      const lightVel = series.velocity * fade;
      if (lightVel > 0.01) {
        this.activeLightSources.push({
          x: fPartial.crestX,
          y: fPartial.crestY,
          velocity: lightVel,
          colorHex: fPartial.colorHex,
        });
      }
    }

    if (this.activeSeriesList.length === 0) {
      this.coronaBins.fill(0);
      this.renderIdleSpiral(ctx, geom, uMin, uMax, now, fluidSpeed, showDissonance, compactionGamma);
      this.renderCentralHub(ctx, geom, tonic, 0, showDissonance);
      return;
    }

    // 4. Draw continuous spiral baseline guide & octave turn labels
    this.renderSpiralGuide(ctx, geom, uMin, uMax, compactionGamma);

    // 5. Populate composite spiral heightfield buffer
    this.populateSpiralHeightfield(uMin, uMax, fluidSpeed, waveFluidity, now);

    // 6. Populate collective angular dissonance corona (using zoom-invariant normalisedAmp)
    this.coronaBins.fill(0);
    if (showDissonance && this.activeSeriesList.length >= 2) {
      this.calculateCoronaInteractions();
    }

    // 7. Fundamental chord geometry overlay (off by default; user-toggleable)
    if (showChordGeometry) {
      this.renderFundamentalChordGeometry(ctx, geom, uMin, uMax);
    }

    // 8. Polyphonic harmonic spoke resonance beams
    if (showSpokeResonance && this.activeSeriesList.length >= 2) {
      this.renderSpokeResonanceBeams(ctx, geom, uMin, uMax);
    }

    // 9. Individual partial fluid wave ribbons along spiral arcs
    this.renderSpiralPartialWaves(ctx, geom, uMin, uMax, now, fluidSpeed, waveFluidity, compactionGamma, maxCrestRadius);

    // 10. Master composite fluid surface caustic highlight (active swells only)
    this.renderMasterSpiralSurface(ctx, geom, uMin, uMax, compactionGamma, maxCrestRadius);

    // 11. Outer collective dissonance corona
    let roughnessPct = 0;
    if (showDissonance) {
      roughnessPct = this.getPeakRoughnessPercentage();
      this.renderDissonanceCorona(ctx, geom, now, fluidSpeed, waveFluidity);
    }

    // 12. Central hub telemetry (active tonic & dissonance crunch readout)
    this.renderCentralHub(ctx, geom, tonic, roughnessPct, showDissonance);

    // 13. Collision-free Solfège & harmonic multiplier badges
    if (showLabels) {
      this.renderBadges(ctx, geom, uMin, uMax);
    }
  }

  /**
   * Computes adaptive or full-range target bounds in continuous octave space `u` and smoothly lerps.
   * Aggressively tightens bounds around played fundamentals so fundamentals receive dominant radial lanes.
   */
  private updateOctaveBounds(
    activeNotes: Map<number, ActiveNote>,
    decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>,
    tonic: number,
    lowestMidi: number,
    minFreq: number,
    maxFreq: number,
    rangeMode: 'adaptive' | 'full',
    dt: number
  ): void {
    const minFreqU = freqToOctaveU(minFreq, tonic, lowestMidi);
    const maxFreqU = Math.max(minFreqU + 1.0, freqToOctaveU(maxFreq, tonic, lowestMidi));

    let targetMinU: number;
    let targetMaxU: number;

    if (rangeMode === 'full') {
      targetMinU = minFreqU;
      targetMaxU = maxFreqU;
    } else {
      let minFundU = Infinity;
      let maxFundU = -Infinity;
      let hasNotes = false;

      const scanFund = (midi: number) => {
        const f1 = midiToFrequency(midi);
        if (f1 < minFreq || f1 > maxFreq) return;
        hasNotes = true;
        const uFund = freqToOctaveU(f1, tonic, lowestMidi);
        if (uFund < minFundU) minFundU = uFund;
        if (uFund > maxFundU) maxFundU = uFund;
      };

      for (const note of activeNotes.values()) {
        scanFund(note.midi);
      }
      for (const { note, decayProgress } of decayingNotes.values()) {
        if (decayProgress < 0.99) scanFund(note.midi);
      }

      if (!hasNotes) {
        targetMinU = Math.max(minFreqU, 1.5);
        targetMaxU = Math.min(maxFreqU, 4.8);
        if (targetMaxU - targetMinU < 2.65) {
          targetMinU = Math.max(minFreqU, targetMaxU - 3.3);
        }
      } else {
        const fundSpread = Math.max(0, maxFundU - minFundU);
        const fitPartials = fundSpread <= 1.2 ? 7 : fundSpread <= 2.2 ? 5 : 4;
        let noteMaxU = maxFundU;

        const scanUpper = (midi: number) => {
          const f1 = midiToFrequency(midi);
          if (f1 < minFreq || f1 > maxFreq) return;
          for (let n = 1; n <= fitPartials; n++) {
            const fn = f1 * n;
            if (fn > maxFreq) break;
            const uPartial = freqToOctaveU(fn, tonic, lowestMidi);
            if (uPartial > noteMaxU) noteMaxU = uPartial;
          }
        };

        for (const note of activeNotes.values()) {
          scanUpper(note.midi);
        }
        for (const { note, decayProgress } of decayingNotes.values()) {
          if (decayProgress < 0.99) scanUpper(note.midi);
        }

        targetMinU = minFundU - 0.10;
        targetMaxU = noteMaxU + 0.10;

        const minWindowSpan = 2.65;
        if (targetMaxU - targetMinU < minWindowSpan) {
          const mid = (targetMinU + targetMaxU) * 0.5;
          targetMinU = mid - minWindowSpan * 0.5;
          targetMaxU = mid + minWindowSpan * 0.5;
        }

        if (targetMinU < minFreqU) {
          const shift = minFreqU - targetMinU;
          targetMinU = minFreqU;
          targetMaxU = Math.min(maxFreqU, targetMaxU + shift);
        }
        if (targetMaxU > maxFreqU) {
          const shift = targetMaxU - maxFreqU;
          targetMaxU = maxFreqU;
          targetMinU = Math.max(minFreqU, targetMinU - shift);
        }
      }
    }

    if (!this.hasInitialisedBounds) {
      this.currentMinU = targetMinU;
      this.currentMaxU = targetMaxU;
      this.hasInitialisedBounds = true;
    } else {
      const lerpAlpha = 1 - Math.exp(-dt * 6.5);
      this.currentMinU += (targetMinU - this.currentMinU) * lerpAlpha;
      this.currentMaxU += (targetMaxU - this.currentMaxU) * lerpAlpha;
    }
  }

  /**
   * Renders dark polar container backdrop, 12 Solfège spokes, and perimeter Solfège labels.
   */
  private renderBackdropAndSpokes(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    geom: SpiralLayoutGeometry,
    showDissonance: boolean
  ): void {
    ctx.save();

    ctx.fillStyle = 'rgba(11, 15, 25, 0.45)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Subtle concentric corona reference boundary when dissonance is active
    if (showDissonance) {
      ctx.beginPath();
      ctx.arc(geom.cx, geom.cy, geom.coronaBaseR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 12 chromatic clock spokes & compact perimeter pips on coronaBaseR
    for (let s = 0; s < 12; s++) {
      const angle = (s / 12) * Math.PI * 2 - Math.PI / 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const isDoFiAxis = s === 0 || s === 6;

      ctx.beginPath();
      if (isDoFiAxis) {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.moveTo(geom.cx + geom.spiralInnerR * cosA, geom.cy + geom.spiralInnerR * sinA);
      ctx.lineTo(geom.cx + geom.coronaBaseR * cosA, geom.cy + geom.coronaBaseR * sinA);
      ctx.strokeStyle = isDoFiAxis ? 'rgba(148, 163, 184, 0.24)' : 'rgba(51, 65, 85, 0.13)';
      ctx.lineWidth = isDoFiAxis ? 1.2 : 0.85;
      ctx.stroke();

      const syllable = SOLFEGE_SYLLABLES[s];
      const spec = SOLFEGE_SPECS[syllable];
      const pipX = geom.cx + geom.coronaBaseR * cosA;
      const pipY = geom.cy + geom.coronaBaseR * sinA;

      ctx.beginPath();
      if (s === 0) {
        // Prominent 12 o'clock Do zenith pip
        ctx.arc(pipX, pipY, 3.0, 0, Math.PI * 2);
        ctx.fillStyle = '#E13610';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      } else {
        ctx.arc(pipX, pipY, 2.0, 0, Math.PI * 2);
        ctx.fillStyle = s === 6 ? 'rgba(203, 213, 225, 0.80)' : hexToRgba(spec.colorHex, 0.72);
        ctx.fill();
      }
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Renders the continuous logarithmic spiral baseline track and subtle octave turn numbers.
   */
  private renderSpiralGuide(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    uMin: number,
    uMax: number,
    compactionGamma: number
  ): void {
    ctx.save();
    const uSpan = Math.max(1e-4, uMax - uMin);
    const steps = Math.max(160, Math.round(uSpan * 72));

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = uMin + (i / steps) * uSpan;
      const r = computeSpiralRadius(u, uMin, uMax, geom.spiralInnerR, geom.spiralOuterR, compactionGamma);
      const angle = octaveUToClockAngleRad(u);
      const x = geom.cx + r * Math.cos(angle);
      const y = geom.cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.24)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Subtle octave turn markers along -105 degrees (15 deg counter-clockwise of Do)
    const minOct = Math.ceil(uMin + 15 / 360);
    const maxOct = Math.floor(uMax + 15 / 360);
    ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';

    for (let k = minOct; k <= maxOct; k++) {
      const markerU = k - 15 / 360;
      if (markerU < uMin || markerU > uMax) continue;
      const r = computeSpiralRadius(markerU, uMin, uMax, geom.spiralInnerR, geom.spiralOuterR, compactionGamma);
      const angle = octaveUToClockAngleRad(markerU);
      const octLabel = k + 1;
      if (octLabel >= 1 && octLabel <= 9) {
        ctx.fillText(String(octLabel), geom.cx + r * Math.cos(angle), geom.cy + r * Math.sin(angle));
      }
    }

    ctx.restore();
  }

  /**
   * Renders calm breathing spiral and silver corona ring when no notes are active.
   */
  private renderIdleSpiral(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    uMin: number,
    uMax: number,
    now: number,
    fluidSpeed: number,
    showDissonance: boolean,
    compactionGamma: number
  ): void {
    ctx.save();
    const uSpan = Math.max(1e-4, uMax - uMin);
    const steps = Math.max(180, Math.round(uSpan * 72));
    const t = now * 0.0015 * fluidSpeed;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = uMin + (i / steps) * uSpan;
      const baseR = computeSpiralRadius(u, uMin, uMax, geom.spiralInnerR, geom.spiralOuterR, compactionGamma);
      const ripple = Math.sin(u * 14.0 - t) * 1.8 + Math.cos(u * 6.0 + t * 0.7) * 1.1;
      const r = baseR + ripple;
      const angle = octaveUToClockAngleRad(u);
      const x = geom.cx + r * Math.cos(angle);
      const y = geom.cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.48)';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    if (showDissonance && geom.maxCoronaH > 4) {
      ctx.beginPath();
      const coronaSteps = 180;
      for (let i = 0; i <= coronaSteps; i++) {
        const deg = (i / coronaSteps) * 360;
        const angle = (deg / 360) * Math.PI * 2 - Math.PI / 2;
        const breathe = Math.max(0, Math.sin(deg * 0.08 - t) * 1.6 + Math.cos(deg * 0.05 + t * 0.6) * 1.0);
        const r = geom.coronaBaseR + breathe;
        const x = geom.cx + r * Math.cos(angle);
        const y = geom.cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Collects spiral partial projections for all sounding and decaying notes.
   */
  private collectSpiralSeries(
    activeNotes: Map<number, ActiveNote>,
    decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>,
    tonic: number,
    lowestMidi: number,
    uMin: number,
    uMax: number,
    spiralInnerR: number,
    spiralOuterR: number,
    cx: number,
    cy: number,
    minFreq: number,
    maxFreq: number,
    now: number,
    compactionGamma: number,
    maxCrestRadius: number
  ): void {
    this.activeSeriesList.length = 0;

    for (const note of activeNotes.values()) {
      const elapsed = now - note.startTime;
      const attackProgress = Math.min(1.0, elapsed / 140);
      const partials = computeSpiralPartials(
        note.midi,
        note.velocity,
        tonic,
        lowestMidi,
        uMin,
        uMax,
        spiralInnerR,
        spiralOuterR,
        cx,
        cy,
        minFreq,
        maxFreq,
        attackProgress,
        0.0,
        compactionGamma,
        maxCrestRadius
      );
      this.activeSeriesList.push({
        noteMidi: note.midi,
        velocity: note.velocity,
        isDecaying: false,
        decayProgress: 0,
        partials,
      });
    }

    for (const { note, decayProgress } of decayingNotes.values()) {
      if (decayProgress >= 0.99) continue;
      const partials = computeSpiralPartials(
        note.midi,
        note.velocity,
        tonic,
        lowestMidi,
        uMin,
        uMax,
        spiralInnerR,
        spiralOuterR,
        cx,
        cy,
        minFreq,
        maxFreq,
        1.0,
        decayProgress,
        compactionGamma,
        maxCrestRadius
      );
      this.activeSeriesList.push({
        noteMidi: note.midi,
        velocity: note.velocity,
        isDecaying: true,
        decayProgress,
        partials,
      });
    }
  }

  /**
   * Populates the preallocated continuous spiral heightfield buffer across [uMin, uMax].
   */
  private populateSpiralHeightfield(
    uMin: number,
    uMax: number,
    fluidSpeed: number,
    waveFluidity: number,
    now: number
  ): void {
    this.spiralHeightfield.fill(0);
    const uSpan = Math.max(1e-4, uMax - uMin);
    const timeSec = now * 0.001;

    for (let sIdx = 0; sIdx < this.activeSeriesList.length; sIdx++) {
      const series = this.activeSeriesList[sIdx];
      for (let pIdx = 0; pIdx < series.partials.length; pIdx++) {
        const p = series.partials[pIdx];
        if (p.amplitude <= 0.4) continue;

        const sigmaU = p.sigmaU;
        const binRadius = Math.ceil((sigmaU * 3 * this.numSpiralBins) / uSpan);
        const centerBin = Math.floor(((p.u - uMin) / uSpan) * (this.numSpiralBins - 1));
        const startBin = Math.max(0, centerBin - binRadius);
        const endBin = Math.min(this.numSpiralBins - 1, centerBin + binRadius);
        if (endBin < startBin) continue;

        const omega = 2.4 * fluidSpeed * Math.sqrt(p.frequency / 80);
        const waveNumber = (2 * Math.PI) / (2.6 * sigmaU);

        for (let b = startBin; b <= endBin; b++) {
          const bu = uMin + (b / (this.numSpiralBins - 1)) * uSpan;
          const du = bu - p.u;
          const envelope = Math.exp(-(du * du) / (2 * sigmaU * sigmaU));
          const ripple = 1.0 + 0.26 * waveFluidity * Math.cos(waveNumber * du - omega * timeSec);
          this.spiralHeightfield[b] += p.amplitude * envelope * ripple;
        }
      }
    }
  }

  /**
   * Computes collective Plomp-Levelt acoustic roughness mapped onto 360 circular clock degrees.
   * Uses compaction-invariant `normalisedAmp` so psychoacoustic thresholds stay consistent across zoom levels.
   * For close intervals (<= 2 semitones), deposits fundamental tension at the short-arc midpoint.
   * For wide dissonant intervals (e.g. Tritone), deposits around both contributing tonal degrees
   * rather than projecting onto an unrelated midpoint spoke.
   */
  private calculateCoronaInteractions(): void {
    const numSeries = this.activeSeriesList.length;
    const numPairs = (numSeries * (numSeries - 1)) / 2;
    const chordNorm = numPairs <= 1 ? 1.0 : 1.0 / Math.sqrt(numPairs);

    for (let i = 0; i < numSeries; i++) {
      const seriesA = this.activeSeriesList[i];
      for (let j = i + 1; j < numSeries; j++) {
        const seriesB = this.activeSeriesList[j];

        const semitoneDiff = Math.abs(Math.round(seriesB.noteMidi) - Math.round(seriesA.noteMidi)) % 12;
        const minSemiDist = Math.min(semitoneDiff, 12 - semitoneDiff);
        const intervalWeight = INTERVAL_DISSONANCE_WEIGHTS[semitoneDiff];

        // 1. Direct fundamental interval tension
        const pA0 = seriesA.partials[0];
        const pB0 = seriesB.partials[0];
        if (pA0 && pB0 && intervalWeight > 0.04) {
          const relA0 = pA0.normalisedAmp;
          const relB0 = pB0.normalisedAmp;
          if (relA0 > 0.05 && relB0 > 0.05) {
            const fundamentalEnergy = intervalWeight * relA0 * relB0 * 0.12 * chordNorm;
            const degA = (((pA0.u % 1) + 1) % 1) * 360;
            const degB = (((pB0.u % 1) + 1) % 1) * 360;

            if (minSemiDist <= 2) {
              const delta = shortestAngularDeltaDeg(degA, degB);
              const midDeg = degA + delta * 0.5;
              const sigmaDeg = Math.max(10, minSemiDist * 15);
              depositCircularGaussian(this.coronaBins, midDeg, sigmaDeg, fundamentalEnergy);
            } else {
              depositCircularGaussian(this.coronaBins, degA, 14, fundamentalEnergy * 0.5);
              depositCircularGaussian(this.coronaBins, degB, 14, fundamentalEnergy * 0.5);
            }
          }
        }

        // 2. Harmonic partial beating interactions across all partial pairs
        for (let aIdx = 0; aIdx < seriesA.partials.length; aIdx++) {
          const pA = seriesA.partials[aIdx];
          const relA = pA.normalisedAmp;
          if (relA < 0.01) continue;

          for (let bIdx = 0; bIdx < seriesB.partials.length; bIdx++) {
            const pB = seriesB.partials[bIdx];
            const relB = pB.normalisedAmp;
            if (relB < 0.01) continue;

            const diss =
              calculatePlompLevelt(pA.frequency, relA, pB.frequency, relB) *
              (0.3 + 0.7 * intervalWeight) *
              0.5 *
              chordNorm;
            if (diss < 0.0001) continue;

            const degA = (((pA.u % 1) + 1) % 1) * 360;
            const degB = (((pB.u % 1) + 1) % 1) * 360;
            const deltaDeg = shortestAngularDeltaDeg(degA, degB);
            const midDeg = degA + deltaDeg * 0.5;
            const sigmaDeg = Math.max(7, Math.min(22, Math.abs(deltaDeg) * 0.7));
            depositCircularGaussian(this.coronaBins, midDeg, sigmaDeg, diss);
          }
        }
      }
    }
  }

  /**
   * Renders fundamental Pitch-Clock chord polygons / dyad rays across active spiral anchors.
   */
  private renderFundamentalChordGeometry(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    uMin: number,
    uMax: number
  ): void {
    this.fundamentalPoints.length = 0;
    let firstColor = '#38BDF8';
    let secondColor = '#F5D432';
    let minOpacity = 1.0;

    for (let sIdx = 0; sIdx < this.activeSeriesList.length; sIdx++) {
      const series = this.activeSeriesList[sIdx];
      const fPartial = series.partials[0];
      if (!fPartial || fPartial.u < uMin - 0.1 || fPartial.u > uMax + 0.1) continue;

      const fade = series.isDecaying ? getDecayFadeFactor(series.decayProgress) : 1.0;
      if (fade <= 0.02) continue;

      if (this.fundamentalPoints.length === 0) firstColor = fPartial.colorHex;
      else if (this.fundamentalPoints.length === 1) secondColor = fPartial.colorHex;
      minOpacity = Math.min(minOpacity, fade);

      this.fundamentalPoints.push({ x: fPartial.baseX, y: fPartial.baseY });
    }

    if (this.fundamentalPoints.length < 2) return;

    ctx.save();
    if (this.fundamentalPoints.length === 2) {
      const p1 = this.fundamentalPoints[0];
      const p2 = this.fundamentalPoints[1];
      const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      grad.addColorStop(0, hexToRgba(firstColor, 0.7 * minOpacity));
      grad.addColorStop(1, hexToRgba(secondColor, 0.7 * minOpacity));

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else {
      const hull = compute2DConvexHull(this.fundamentalPoints);
      if (hull.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < hull.length; i++) {
          ctx.lineTo(hull[i].x, hull[i].y);
        }
        ctx.closePath();

        ctx.fillStyle = `rgba(56, 189, 248, ${0.07 * minOpacity})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(148, 163, 184, ${0.45 * minOpacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Subtle spoke rays from hub to vertices
        ctx.beginPath();
        for (let i = 0; i < this.fundamentalPoints.length; i++) {
          ctx.moveTo(geom.cx, geom.cy);
          ctx.lineTo(this.fundamentalPoints[i].x, this.fundamentalPoints[i].y);
        }
        ctx.strokeStyle = `rgba(148, 163, 184, ${0.15 * minOpacity})`;
        ctx.lineWidth = 1.0;
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  /**
   * Highlights shared radial pitch-class corridors where partials from different notes align on the spiral.
   */
  private renderSpokeResonanceBeams(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    uMin: number,
    uMax: number
  ): void {
    this.bucketAlpha.fill(0);
    this.bucketMinR.fill(geom.spiralOuterR);
    this.bucketMaxR.fill(geom.spiralInnerR);

    for (let i = 0; i < this.activeSeriesList.length; i++) {
      const seriesA = this.activeSeriesList[i];
      for (let j = i + 1; j < this.activeSeriesList.length; j++) {
        const seriesB = this.activeSeriesList[j];

        for (let aIdx = 0; aIdx < seriesA.partials.length; aIdx++) {
          const pA = seriesA.partials[aIdx];
          if (pA.amplitude <= 2.5 || pA.u < uMin || pA.u > uMax) continue;
          const degA = (((pA.u % 1) + 1) % 1) * 360;

          for (let bIdx = 0; bIdx < seriesB.partials.length; bIdx++) {
            const pB = seriesB.partials[bIdx];
            if (pB.amplitude <= 2.5 || pB.u < uMin || pB.u > uMax) continue;
            const degB = (((pB.u % 1) + 1) % 1) * 360;

            const delta = shortestAngularDeltaDeg(degA, degB);
            if (Math.abs(delta) > 12) continue;

            const midDeg = ((degA + delta * 0.5) % 360 + 360) % 360;
            const bucket = Math.floor(midDeg / 6) % this.numSpokeBuckets;
            const proximity = 1 - Math.abs(delta) / 12;
            const ampScore = Math.min(pA.normalisedAmp, pB.normalisedAmp) / 0.35;
            const strength = Math.min(1.0, proximity * Math.min(1.0, ampScore));

            const rLo = Math.max(geom.spiralInnerR, Math.min(pA.baseRadius, pB.baseRadius));
            const rHi = Math.min(geom.spiralOuterR, Math.max(pA.baseRadius, pB.baseRadius));
            if (rHi <= rLo + 2) continue;

            if (rLo < this.bucketMinR[bucket]) this.bucketMinR[bucket] = rLo;
            if (rHi > this.bucketMaxR[bucket]) this.bucketMaxR[bucket] = rHi;
            if (strength > this.bucketAlpha[bucket]) {
              this.bucketAlpha[bucket] = strength;
              this.bucketAngle[bucket] = (midDeg / 360) * Math.PI * 2 - Math.PI / 2;
              this.bucketColor[bucket] = resolveWaveVisualColors(
                pA.amplitude >= pB.amplitude ? pA.colorHex : pB.colorHex
              ).strokeHex;
            }
          }
        }
      }
    }

    ctx.save();
    ctx.lineCap = 'round';
    for (let b = 0; b < this.numSpokeBuckets; b++) {
      const strength = this.bucketAlpha[b];
      if (strength <= 0.05) continue;
      const rLo = this.bucketMinR[b];
      const rHi = this.bucketMaxR[b];
      if (rHi <= rLo + 2) continue;

      const angle = this.bucketAngle[b];
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const x1 = geom.cx + rLo * cosA;
      const y1 = geom.cy + rLo * sinA;
      const x2 = geom.cx + rHi * cosA;
      const y2 = geom.cy + rHi * sinA;
      const col = this.bucketColor[b];

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = hexToRgba(col, 0.10 * strength);
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = hexToRgba(col, 0.28 * strength);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Traces the displaced fluid crest arc for a single partial over [uStart, uEnd].
   */
  private tracePartialCrestArc(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    p: SpiralOvertonePartial,
    uMin: number,
    uMax: number,
    uStart: number,
    uEnd: number,
    samples: number,
    omega: number,
    waveNumber: number,
    waveFluidity: number,
    timeSec: number,
    compactionGamma: number,
    maxCrestRadius: number
  ): void {
    const sigmaSq2 = 2 * p.sigmaU * p.sigmaU;
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const u = uStart + (i / samples) * (uEnd - uStart);
      const du = u - p.u;
      const r0 = computeSpiralRadius(u, uMin, uMax, geom.spiralInnerR, geom.spiralOuterR, compactionGamma);
      const envelope = Math.exp(-(du * du) / sigmaSq2);
      const ripple = 1.0 + 0.26 * waveFluidity * Math.cos(waveNumber * du - omega * timeSec);
      const r = Math.min(maxCrestRadius, r0 + p.amplitude * envelope * ripple);
      const angle = octaveUToClockAngleRad(u);
      const x = geom.cx + r * Math.cos(angle);
      const y = geom.cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  /**
   * Renders individual harmonic partial fluid ribbons wrapped smoothly along the compacted spiral.
   */
  private renderSpiralPartialWaves(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    uMin: number,
    uMax: number,
    now: number,
    fluidSpeed: number,
    waveFluidity: number,
    compactionGamma: number,
    maxCrestRadius: number
  ): void {
    ctx.save();
    const timeSec = now * 0.001;
    const samples = 40;

    for (let sIdx = 0; sIdx < this.activeSeriesList.length; sIdx++) {
      const series = this.activeSeriesList[sIdx];

      for (let pIdx = 0; pIdx < series.partials.length; pIdx++) {
        const p = series.partials[pIdx];
        if (p.amplitude <= 0.6) continue;

        const sigmaU = p.sigmaU;
        const uStart = Math.max(uMin, p.u - sigmaU * 3);
        const uEnd = Math.min(uMax, p.u + sigmaU * 3);
        if (uEnd <= uStart) continue;

        const omega = 2.4 * fluidSpeed * Math.sqrt(p.frequency / 80);
        const waveNumber = (2 * Math.PI) / (2.6 * sigmaU);
        const { fillHex, strokeHex } = resolveWaveVisualColors(p.colorHex);

        // 1. Closed fluid ribbon polygon between baseline r0(u) and displaced outward crest
        this.tracePartialCrestArc(
          ctx, geom, p, uMin, uMax, uStart, uEnd, samples,
          omega, waveNumber, waveFluidity, timeSec, compactionGamma, maxCrestRadius
        );

        for (let i = samples; i >= 0; i--) {
          const u = uStart + (i / samples) * (uEnd - uStart);
          const r0 = computeSpiralRadius(u, uMin, uMax, geom.spiralInnerR, geom.spiralOuterR, compactionGamma);
          const angle = octaveUToClockAngleRad(u);
          ctx.lineTo(geom.cx + r0 * Math.cos(angle), geom.cy + r0 * Math.sin(angle));
        }
        ctx.closePath();

        const grad = ctx.createLinearGradient(p.crestX, p.crestY, p.baseX, p.baseY);
        const alphaPeak = p.isFundamental ? 0.74 : 0.44;
        grad.addColorStop(0, hexToRgba(fillHex, alphaPeak));
        grad.addColorStop(0.55, hexToRgba(fillHex, p.isFundamental ? 0.38 : 0.18));
        grad.addColorStop(1, hexToRgba(fillHex, p.isFundamental ? 0.07 : 0.03));
        ctx.fillStyle = grad;
        ctx.fill();

        // 2. Dual-pass neon crest stroke (soft halo pass + sharp high-contrast core pass, zero ctx.shadowBlur)
        this.tracePartialCrestArc(
          ctx, geom, p, uMin, uMax, uStart, uEnd, samples,
          omega, waveNumber, waveFluidity, timeSec, compactionGamma, maxCrestRadius
        );
        ctx.strokeStyle = hexToRgba(strokeHex, p.isFundamental ? 0.30 : 0.18);
        ctx.lineWidth = p.isFundamental ? 8.0 : 4.2;
        ctx.stroke();

        ctx.strokeStyle = hexToRgba(strokeHex, p.isFundamental ? 0.98 : 0.80);
        ctx.lineWidth = p.isFundamental ? 3.0 : 1.8;
        ctx.stroke();

        // 3. Crisp white specular crown highlight along fundamental peaks
        if (p.isFundamental) {
          const crownStart = Math.max(uMin, p.u - sigmaU * 1.2);
          const crownEnd = Math.min(uMax, p.u + sigmaU * 1.2);
          if (crownEnd > crownStart) {
            this.tracePartialCrestArc(
              ctx, geom, p, uMin, uMax, crownStart, crownEnd, 18,
              omega, waveNumber, waveFluidity, timeSec, compactionGamma, maxCrestRadius
            );
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }
    }

    ctx.restore();
  }

  /**
   * Renders the master composite caustic highlight only over active wave-swell spans
   * so quiet spiral turns remain clean and free of bright wire clutter.
   */
  private renderMasterSpiralSurface(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    uMin: number,
    uMax: number,
    compactionGamma: number,
    maxCrestRadius: number
  ): void {
    const uSpan = Math.max(1e-4, uMax - uMin);
    let inActiveSpan = false;
    let hasActive = false;

    ctx.save();
    ctx.beginPath();
    for (let b = 0; b < this.numSpiralBins; b++) {
      const rawH = this.spiralHeightfield[b];
      if (rawH <= 2.0) {
        inActiveSpan = false;
        continue;
      }

      const bu = uMin + (b / (this.numSpiralBins - 1)) * uSpan;
      const r0 = computeSpiralRadius(bu, uMin, uMax, geom.spiralInnerR, geom.spiralOuterR, compactionGamma);
      const localSpacing = computeLocalTurnSpacing(bu, uMin, uMax, geom.spiralInnerR, geom.spiralOuterR, compactionGamma);
      const maxCompositeH = Math.max(8, localSpacing * 1.15);
      const satH = maxCompositeH * Math.tanh(rawH / maxCompositeH);
      const r = Math.min(maxCrestRadius, r0 + satH);
      const angle = octaveUToClockAngleRad(bu);
      const x = geom.cx + r * Math.cos(angle);
      const y = geom.cy + r * Math.sin(angle);

      if (!inActiveSpan) {
        ctx.moveTo(x, y);
        inActiveSpan = true;
      } else {
        ctx.lineTo(x, y);
      }
      hasActive = true;
    }

    if (hasActive) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Computes displaced outer corona radius at a given degree bin [0..359].
   */
  private computeCoronaRadiusAtBin(
    bin: number,
    geom: SpiralLayoutGeometry,
    t: number,
    waveFluidity: number,
    scale: number = 1.0,
    includeJagged: boolean = true
  ): number {
    const len = this.coronaBins.length;
    const angle = (bin / len) * Math.PI * 2 - Math.PI / 2;
    const normalisedH = Math.min(1.0, this.coronaBins[bin] / REFERENCE_DISSONANCE_SCALE);
    const ripple = 1.0 + 0.16 * waveFluidity * Math.sin(angle * 6 + t);
    const baseH = normalisedH * geom.maxCoronaH * ripple * scale;
    const beatingOsc = Math.sin(bin * 0.85 + t * 8.0) * 0.55 + Math.sin(bin * 1.75 - t * 13.0) * 0.45;
    if (!includeJagged) {
      return geom.coronaBaseR + Math.max(0, baseH + beatingOsc * Math.min(3.0, baseH * 0.15));
    }
    const jaggedTexture = (bin % 2 === 0 ? 0.65 : -0.65) * Math.min(1.0, normalisedH * 2.0);
    const beatAmp = Math.min(5.5, baseH * 0.22) * (0.6 * beatingOsc + 0.4 * jaggedTexture);
    return geom.coronaBaseR + Math.max(0, baseH + beatAmp);
  }

  /**
   * Traces the corona outer perimeter path across all degree bins at the specified bin stride.
   */
  private traceCoronaContourPath(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    t: number,
    waveFluidity: number,
    stride: number,
    scale: number,
    includeJagged: boolean
  ): void {
    const len = this.coronaBins.length;
    ctx.beginPath();
    for (let b = 0; b <= len; b += stride) {
      const bin = b % len;
      const angle = (bin / len) * Math.PI * 2 - Math.PI / 2;
      const r = this.computeCoronaRadiusAtBin(bin, geom, t, waveFluidity, scale, includeJagged);
      const x = geom.cx + r * Math.cos(angle);
      const y = geom.cy + r * Math.sin(angle);
      if (b === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  /**
   * Renders the collective full-spectrum dissonance corona around the outer ring perimeter.
   */
  private renderDissonanceCorona(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    now: number,
    fluidSpeed: number,
    waveFluidity: number
  ): void {
    if (geom.maxCoronaH <= 4) return;

    const peak = this.getPeakDissonance();
    const timeSec = now * 0.001;
    const t = timeSec * 2.2 * fluidSpeed;

    ctx.save();

    if (peak > 0.003) {
      // 1. Translucent outer corona fill from coronaBaseR outward (separate subpaths avoid radial seam)
      this.traceCoronaContourPath(ctx, geom, t, waveFluidity, 1, 1.0, true);
      ctx.closePath();
      ctx.moveTo(geom.cx + geom.coronaBaseR, geom.cy);
      ctx.arc(geom.cx, geom.cy, geom.coronaBaseR, 0, Math.PI * 2, true);
      ctx.closePath();

      const coronaGrad = ctx.createRadialGradient(
        geom.cx,
        geom.cy,
        geom.coronaBaseR,
        geom.cx,
        geom.cy,
        geom.coronaBaseR + geom.maxCoronaH
      );
      coronaGrad.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
      coronaGrad.addColorStop(0.55, 'rgba(226, 232, 240, 0.11)');
      coronaGrad.addColorStop(1, 'rgba(255, 255, 255, 0.01)');
      ctx.fillStyle = coronaGrad;
      ctx.fill('evenodd');

      // 2. Sharp white auditory-beating contour along outer corona crest
      this.traceCoronaContourPath(ctx, geom, t, waveFluidity, 1, 1.0, true);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3. Secondary ghost beating trace
      this.traceCoronaContourPath(ctx, geom, t, waveFluidity, 2, 0.94, false);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else {
      // Calm consonant breathing silver corona
      ctx.beginPath();
      for (let i = 0; i <= 180; i++) {
        const angle = (i / 180) * Math.PI * 2 - Math.PI / 2;
        const breathe = Math.max(0, Math.sin(angle * 5 - t) * 1.4 + Math.cos(angle * 3 + t * 0.6) * 0.9);
        const r = geom.coronaBaseR + breathe;
        const x = geom.cx + r * Math.cos(angle);
        const y = geom.cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Renders the central treble hub ring with active tonic and collective dissonance crunch telemetry.
   */
  private renderCentralHub(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    tonic: number,
    roughnessPct: number,
    showDissonance: boolean
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(geom.cx, geom.cy, geom.spiralInnerR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(11, 15, 25, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    if (geom.spiralInnerR >= 20) {
      const tonicName = PITCH_NAMES_SHARP[((tonic % 12) + 12) % 12] ?? 'D';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const hasCrunch = showDissonance && roughnessPct > 0;
      ctx.font = geom.spiralInnerR < 30 ? "bold 7.5px 'JetBrains Mono', monospace" : "bold 8.5px 'JetBrains Mono', monospace";
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.fillText(`Do=${tonicName}`, geom.cx, hasCrunch ? geom.cy - 5 : geom.cy);

      if (hasCrunch) {
        ctx.font = geom.spiralInnerR < 30 ? "bold 7px 'JetBrains Mono', monospace" : "bold 8px 'JetBrains Mono', monospace";
        ctx.fillStyle = roughnessPct >= 45 ? 'rgba(255, 255, 255, 0.92)' : 'rgba(203, 213, 225, 0.78)';
        ctx.fillText(`${roughnessPct}%`, geom.cx, geom.cy + 6);
      }
    }

    ctx.restore();
  }

  /**
   * Renders collision-guarded Solfège badges on fundamentals and compact harmonic multiplier pips on prominent overtones.
   */
  private renderBadges(
    ctx: CanvasRenderingContext2D,
    geom: SpiralLayoutGeometry,
    uMin: number,
    uMax: number
  ): void {
    ctx.save();
    this.placedLabelsCount = 0;
    this.labelCandidatePartials.length = 0;

    const fundR = Math.max(9, Math.min(12, geom.halfMin * 0.048));

    // Pass 1: Prominent Fundamental Solfège badges at spiral anchors
    for (let sIdx = 0; sIdx < this.activeSeriesList.length; sIdx++) {
      const series = this.activeSeriesList[sIdx];
      for (let pIdx = 0; pIdx < series.partials.length; pIdx++) {
        const p = series.partials[pIdx];
        if (p.u < uMin || p.u > uMax) continue;

        if (p.isFundamental) {
          if (p.amplitude <= 5) continue;
          // Dark separation halo + crisp white border so fundamentals stand out boldly
          ctx.beginPath();
          ctx.arc(p.baseX, p.baseY, fundR + 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(11, 15, 25, 0.85)';
          ctx.lineWidth = 3.2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p.baseX, p.baseY, fundR, 0, Math.PI * 2);
          ctx.fillStyle = p.colorHex;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          ctx.font = fundR <= 9.5 ? "bold 8.5px 'JetBrains Mono', monospace" : "bold 9.5px 'JetBrains Mono', monospace";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = getContrastingTextColor(p.colorHex);
          ctx.fillText(p.solfege, p.baseX, p.baseY);

          this.recordPlacedLabel(p.baseX, p.baseY, fundR + 1.5);
        } else if (p.amplitude >= 10) {
          this.labelCandidatePartials.push(p);
        }
      }
    }

    // Pass 2: Higher partial badges (sorted low partial -> high amplitude) tucked tightly to crests
    this.labelCandidatePartials.sort((a, b) => a.partialNumber - b.partialNumber || b.amplitude - a.amplitude);

    const overtoneR = 6;
    for (let i = 0; i < this.labelCandidatePartials.length; i++) {
      const p = this.labelCandidatePartials[i];
      const tipR = Math.min(geom.coronaBaseR - overtoneR - 2, p.baseRadius + p.amplitude + 4);
      const lx = geom.cx + tipR * Math.cos(p.angle);
      const ly = geom.cy + tipR * Math.sin(p.angle);

      if (this.collidesWithPlacedLabel(lx, ly, overtoneR)) continue;

      ctx.beginPath();
      ctx.arc(lx, ly, overtoneR, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(p.colorHex, 0.90);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "bold 7px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = getContrastingTextColor(p.colorHex);
      ctx.fillText(`${p.partialNumber}×`, lx, ly);

      this.recordPlacedLabel(lx, ly, overtoneR);
    }

    ctx.restore();
  }

  private recordPlacedLabel(x: number, y: number, r: number): void {
    if (this.placedLabelsCount >= this.placedLabels.length) return;
    const slot = this.placedLabels[this.placedLabelsCount++];
    slot.x = x;
    slot.y = y;
    slot.r = r;
  }

  private collidesWithPlacedLabel(x: number, y: number, r: number): boolean {
    for (let i = 0; i < this.placedLabelsCount; i++) {
      const existing = this.placedLabels[i];
      const minDist = existing.r + r + 3;
      const dx = x - existing.x;
      const dy = y - existing.y;
      if (dx * dx + dy * dy < minDist * minDist) return true;
    }
    return false;
  }

  /**
   * Queries exact canvas coordinates, outward spoke angle, and Solfège colour for a note's
   * fundamental wave crest on the spiral (used for radial fluid droplets and sparks).
   */
  public getFundamentalCoordinatesForMidi(
    midi: number,
    width: number,
    height: number,
    config: VisualiserConfig,
    velocity: number = 0.8
  ): { x: number; y: number; angle: number; amplitude: number; colorHex: string } | null {
    if (width <= 20 || height <= 20) return null;

    const minFreq = config.minFrequency ?? 27.5;
    const maxFreq = config.maxFrequency ?? 6000;
    const f1 = midiToFrequency(midi);
    if (f1 < minFreq || f1 > maxFreq) return null;

    const tonic = config.tonic;
    const lowestMidi = config.keyboardLowestMidi ?? 21;
    const showDissonance = config.showDissonanceCurve ?? true;
    const rangeMode = config.spiralRangeMode ?? 'adaptive';
    const geom = computeSpiralLayoutGeometry(width, height, showDissonance);
    if (geom.spiralOuterR <= geom.spiralInnerR + 4) return null;

    const u = freqToOctaveU(f1, tonic, lowestMidi);
    const minFreqU = freqToOctaveU(minFreq, tonic, lowestMidi);
    const maxFreqU = Math.max(minFreqU + 1.0, freqToOctaveU(maxFreq, tonic, lowestMidi));

    let uMin: number;
    let uMax: number;
    if (rangeMode === 'full') {
      uMin = minFreqU;
      uMax = maxFreqU;
    } else if (this.hasInitialisedBounds && this.lastWidth === width && this.lastHeight === height) {
      uMin = this.currentMinU;
      uMax = this.currentMaxU;
    } else {
      uMin = Math.max(minFreqU, u - 0.10);
      uMax = Math.min(maxFreqU, Math.max(uMin + 2.65, u + 2.9));
    }

    const compactionGamma = rangeMode === 'full' ? FULL_COMPACTION_GAMMA : ADAPTIVE_COMPACTION_GAMMA;
    const baseRadius = computeSpiralRadius(u, uMin, uMax, geom.spiralInnerR, geom.spiralOuterR, compactionGamma);
    const localSpacing = computeLocalTurnSpacing(u, uMin, uMax, geom.spiralInnerR, geom.spiralOuterR, compactionGamma);
    const velScale = 0.42 + 0.58 * Math.max(0, Math.min(1, velocity));
    const rawAmp = localSpacing * 0.96 * velScale;
    const maxCrestRadius = geom.coronaBaseR - 3;
    const amplitude = Math.min(rawAmp, Math.max(4, maxCrestRadius - baseRadius));
    const crestRadius = Math.max(geom.spiralInnerR, Math.min(maxCrestRadius, baseRadius + amplitude));
    const angle = octaveUToClockAngleRad(u);

    const semitone = ((midi - tonic) % 12 + 12) % 12;
    const syllable = SOLFEGE_SYLLABLES[semitone];
    const spec = SOLFEGE_SPECS[syllable] || SOLFEGE_SPECS['Do'];

    return {
      x: geom.cx + crestRadius * Math.cos(angle),
      y: geom.cy + crestRadius * Math.sin(angle),
      angle,
      amplitude,
      colorHex: spec.colorHex,
    };
  }

  /**
   * Returns active and decaying fundamental wave crest light sources for WebGL halation & lens flares.
   */
  public getActiveLightSources(): ReadonlyArray<{ x: number; y: number; velocity: number; colorHex: string }> {
    return this.activeLightSources;
  }

  /**
   * Queries peak dissonance roughness across the outer corona.
   */
  public getPeakDissonance(): number {
    let peak = 0;
    for (let b = 0; b < this.coronaBins.length; b++) {
      if (this.coronaBins[b] > peak) peak = this.coronaBins[b];
    }
    return peak;
  }

  /**
   * Queries peak collective dissonance crunch percentage (0 to 100%).
   */
  public getPeakRoughnessPercentage(): number {
    const peak = this.getPeakDissonance();
    return Math.min(100, Math.round((peak / REFERENCE_DISSONANCE_SCALE) * 100));
  }

  /**
   * Exposes the preallocated 360-degree corona dissonance buffer (read-only view for verification).
   */
  public getCoronaBins(): Float32Array {
    return this.coronaBins;
  }
}
