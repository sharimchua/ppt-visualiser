import {
  ActiveNote,
  VisualiserConfig,
} from '../core/types';
import {
  SOLFEGE_SYLLABLES,
  SOLFEGE_SPECS,
} from '../core/ppt-constants';

export const NUM_PARTIALS = 7;

export interface OvertonePartial {
  partialNumber: number; // 1..7 (1 = fundamental)
  frequency: number;     // in Hz
  amplitude: number;     // 0..1 normalised height relative to plot
  semitone: number;      // 0..11 relative to active tonic
  solfege: string;       // 'Do', 'Re', etc.
  colorHex: string;      // Canonical Uniform Solfège hex
  isFundamental: boolean;
  x: number;             // Canvas x coordinate
  y: number;             // Wave crest y coordinate
  envelopeWidth: number; // Spatial width (sigma) in px
}

export interface NoteOvertoneSeries {
  noteMidi: number;
  velocity: number;
  isDecaying: boolean;
  decayProgress: number;
  partials: OvertonePartial[];
}

/**
 * Computes frequency in Hz from a MIDI note number (standard A4 = 440 Hz tuning).
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Computes the spatial wave envelope width (sigma in pixels) for a given frequency.
 * Lower registers have wider waves reflecting their longer physical acoustic wavelengths.
 */
export function computeRegisterWaveWidth(freq: number, baseSigma: number = 36): number {
  // Power scaling: (440 / freq)^0.36 produces broad bass swells and narrow treble peaks
  const factor = Math.pow(440 / Math.max(20, freq), 0.36);
  return Math.max(14, Math.min(110, baseSigma * factor));
}

/**
 * Computes the 7 harmonic partials for a given note.
 *
 * Velocity behaviour:
 * - Fundamental base height is scaled directly by velocity.
 * - Higher overtone roll-off decay factor is governed by velocity:
 *   Soft notes (low velocity) have steep decay, producing a warm, muted profile.
 *   Hard strikes (high velocity) excite prominent higher harmonics with slow decay.
 */
export function computeNotePartials(
  midi: number,
  velocity: number,
  tonic: number,
  plotWidth: number,
  plotHeight: number,
  plotBottom: number,
  minFreq: number = 27.5,
  maxFreq: number = 6000,
  attackProgress: number = 1.0,
  decayProgress: number = 0.0
): OvertonePartial[] {
  const f1 = midiToFrequency(midi);
  const logMin = Math.log2(minFreq);
  const logMax = Math.log2(maxFreq);
  const logSpan = logMax - logMin;

  // Fundamental base height scaled by velocity and lifecycle easing
  // Attack ease-out curve with subtle kinetic punch
  const attackEasing = attackProgress < 1.0
    ? 1 - Math.pow(1 - attackProgress, 3)
    : 1.0;

  // Decay fade factor: exponential drop-off
  const decayFade = decayProgress > 0
    ? Math.max(0, 1 - Math.pow(decayProgress, 1.6))
    : 1.0;

  const baseHeight = plotHeight * (0.2 + 0.78 * velocity) * attackEasing * decayFade;

  // Overtone amplitude decay rate governed by velocity:
  // v = 0.1 -> ~0.59 decay per partial (fast drop-off)
  // v = 1.0 -> ~0.93 decay per partial (rich, bright harmonics)
  const overtoneDecayRate = 0.56 + 0.37 * Math.max(0, Math.min(1, velocity));

  const partials: OvertonePartial[] = [];

  for (let n = 1; n <= NUM_PARTIALS; n++) {
    const fn = f1 * n;
    if (fn < minFreq || fn > maxFreq) continue;

    // Log-frequency horizontal mapping
    const x = ((Math.log2(fn) - logMin) / logSpan) * plotWidth;

    // Musical pitch of this partial in 12TET
    const partialMidi = midi + 12 * Math.log2(n);
    const roundedMidi = Math.round(partialMidi);
    const semitone = ((roundedMidi - tonic) % 12 + 12) % 12;
    const syllable = SOLFEGE_SYLLABLES[semitone];
    const spec = SOLFEGE_SPECS[syllable] || SOLFEGE_SPECS['Do'];

    // Higher partials decay slightly faster during note release
    const partialDecayPenalty = decayProgress > 0 ? Math.pow(n, 0.28) * decayProgress : 0;
    const partialFade = Math.max(0, 1 - partialDecayPenalty);

    // Amplitude
    const ampRatio = Math.pow(overtoneDecayRate, n - 1) * partialFade;
    const ampPx = baseHeight * ampRatio;
    const y = plotBottom - ampPx;
    const envelopeWidth = computeRegisterWaveWidth(fn);

    partials.push({
      partialNumber: n,
      frequency: fn,
      amplitude: ampPx,
      semitone,
      solfege: syllable,
      colorHex: spec.colorHex,
      isFundamental: n === 1,
      x,
      y,
      envelopeWidth,
    });
  }

  return partials;
}

/**
 * Plomp-Levelt psychoacoustical roughness model between two pure tone frequencies.
 */
export function calculatePlompLevelt(f1: number, a1: number, f2: number, a2: number): number {
  const fmin = Math.min(f1, f2);
  const fmax = Math.max(f1, f2);
  const diff = fmax - fmin;
  const s = 0.24 / (0.021 * fmin + 19);
  const sd = s * diff;
  return a1 * a2 * (Math.exp(-3.5 * sd) - Math.exp(-5.75 * sd));
}

/**
 * High-performance 2D Canvas renderer for the Overtones Waveform cell.
 *
 * Local Contracts:
 * - 60 FPS performance target with preallocated typed buffers.
 * - Zero React reconciliation in render loops.
 * - High-DPI awareness scaling by window.devicePixelRatio.
 * - English (Australian) spelling maintained throughout.
 */
export class OvertonesRenderer {
  // Constant absolute reference scale for psychoacoustical roughness (prevents auto-normalizing calm intervals)
  public static readonly REFERENCE_DISSONANCE_SCALE = 0.10;

  // Psychoacoustic interval dissonance weights across the 12 chromatic semitone distances [0..11].
  // Mirrors canonical Western psychoacoustic consonance rankings (Huron/Sethares/Parncutt).
  // Ensures Tritones and 2nds produce substantial tension while 3rds/6ths, 5ths, and maj7 chord extensions remain gentle consonances.
  private static readonly INTERVAL_DISSONANCE_WEIGHTS: readonly number[] = [
    0.02, // 0: Unison / Octave (pure consonance)
    1.00, // 1: Minor 2nd (maximum sensory clash)
    0.65, // 2: Major 2nd (pronounced clash)
    0.10, // 3: Minor 3rd (warm consonance)
    0.06, // 4: Major 3rd (sweet consonance)
    0.08, // 5: Perfect 4th (open consonance)
    0.95, // 6: Tritone (maximum tonal instability / diabolus in musica)
    0.02, // 7: Perfect 5th (pure consonance)
    0.12, // 8: Minor 6th (soft consonance)
    0.08, // 9: Major 6th (consonant)
    0.45, // 10: Minor 7th (moderate dominant tension)
    0.40, // 11: Major 7th (jazz coloration / mild tension in chord)
  ];

  // Preallocated buffer for continuous fluid surface heightfield (512 bins)
  private readonly numBins = 512;
  private readonly heightfield = new Float32Array(512);
  private readonly dissonanceBins = new Float32Array(512);

  // Reusable series collector to eliminate per-frame garbage collection
  private readonly activeSeriesList: NoteOvertoneSeries[] = [];

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
    if (width <= 20 || height <= 20) return;

    const tonic = config.tonic;
    const minFreq = config.minFrequency ?? 27.5;
    const maxFreq = config.maxFrequency ?? 6000;
    const fluidSpeed = config.fluidSpeed ?? 1.0;
    const waveFluidity = config.waveFluidity ?? 0.8;
    const showDissonance = config.showDissonanceCurve ?? true;
    const showLabels = config.showOvertoneLabels ?? true;

    // Padding & layout geometry
    const padTop = Math.max(22, height * 0.10);
    const padBottom = Math.max(20, height * 0.08);

    // Reserve vertical space below baseline for downward subterranean dissonance wave if toggled on
    const dissonanceDepth = showDissonance
      ? Math.max(42, Math.min(130, (height - padTop - padBottom) * 0.28))
      : 0;

    const subterraneanBottom = height - padBottom;
    const baselineY = subterraneanBottom - dissonanceDepth;
    const plotHeight = baselineY - padTop;

    // 1. Draw subtle background container styling
    this.renderBackgroundGrid(
      ctx,
      width,
      height,
      padTop,
      baselineY,
      subterraneanBottom,
      minFreq,
      maxFreq,
      showDissonance
    );

    // 2. Collect overtone series for all active and decaying notes
    this.collectOvertoneSeries(
      activeNotes,
      decayingNotes,
      tonic,
      width,
      plotHeight,
      baselineY,
      minFreq,
      maxFreq,
      now
    );

    if (this.activeSeriesList.length === 0) {
      // Idle state: Draw ambient breathing baseline
      this.renderIdleBaseline(ctx, width, baselineY, dissonanceDepth, now, fluidSpeed, showDissonance);
      return;
    }

    // 3. Clear and populate continuous fluid heightfield buffer
    this.heightfield.fill(0);
    this.dissonanceBins.fill(0);

    const timeSec = now * 0.001;

    for (let sIdx = 0; sIdx < this.activeSeriesList.length; sIdx++) {
      const series = this.activeSeriesList[sIdx];
      for (let pIdx = 0; pIdx < series.partials.length; pIdx++) {
        const p = series.partials[pIdx];
        if (p.amplitude <= 0.5) continue;

        const sigma = p.envelopeWidth;
        const binRadius = Math.ceil((sigma * 3 * this.numBins) / width);
        const centerBin = Math.floor((p.x / width) * this.numBins);
        const startBin = Math.max(0, centerBin - binRadius);
        const endBin = Math.min(this.numBins - 1, centerBin + binRadius);

        // Fluid traveling phase angle
        const omega = 2.4 * fluidSpeed * Math.sqrt(p.frequency / 80);
        const waveNumber = (2 * Math.PI) / (2.6 * sigma);

        for (let b = startBin; b <= endBin; b++) {
          const bx = (b / (this.numBins - 1)) * width;
          const dx = bx - p.x;
          // Gaussian spatial envelope
          const envelope = Math.exp(-(dx * dx) / (2 * sigma * sigma));
          // Kinetic fluid ripple undulation
          const ripple = 1.0 + 0.32 * waveFluidity * Math.cos(waveNumber * dx - omega * timeSec);
          this.heightfield[b] += p.amplitude * envelope * ripple;
        }
      }
    }

    // 4. Calculate psychoacoustic dissonance & beating interaction
    if (showDissonance && this.activeSeriesList.length >= 2) {
      this.calculateInteractions(width, plotHeight, minFreq, maxFreq);
    }

    // 5. Render individual partial fluid wave shapes with Uniform Solfège colouring
    this.renderPartialWaves(ctx, width, baselineY, now, fluidSpeed, waveFluidity);

    // 6. Render master fluid surface wave envelope
    this.renderMasterFluidSurface(ctx, width, baselineY);

    // 7. Render subterranean dissonance wave going below the baseline Y axis if active
    if (showDissonance) {
      this.renderDissonanceCurve(ctx, width, baselineY, dissonanceDepth, now, fluidSpeed, waveFluidity);
    }

    // 8. Render Solfège badges, pitch names, and harmonic multiplier labels
    if (showLabels) {
      this.renderLabels(ctx, padTop);
    }
  }

  /**
   * Renders background log-frequency octave grid lines (C1 through C8).
   */
  private renderBackgroundGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    top: number,
    baselineY: number,
    subterraneanBottom: number,
    minFreq: number,
    maxFreq: number,
    showDissonance: boolean
  ): void {
    ctx.save();

    // Subtle dark fluid container fill
    ctx.fillStyle = 'rgba(11, 15, 25, 0.45)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(maxFreq);
    const logSpan = logMax - logMin;

    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';

    for (let oct = 1; oct <= 8; oct++) {
      // Standard C frequencies: C1 ≈ 32.7 Hz, C4 ≈ 261.63 Hz, C8 ≈ 4186 Hz
      const f = 440 * Math.pow(2, (oct - 4) + (0 - 9) / 12);
      if (f < minFreq || f > maxFreq) continue;

      const x = ((Math.log2(f) - logMin) / logSpan) * width;

      // Dashed vertical octave boundary spanning through both zones
      ctx.beginPath();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.28)';
      ctx.moveTo(x, top);
      ctx.lineTo(x, subterraneanBottom);
      ctx.stroke();

      // Octave label at bottom of subterranean zone
      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.fillText(`C${oct}`, x, subterraneanBottom + 13);
    }

    // Baseline axis line (horizontal zero axis separating harmonics above from dissonance below)
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.strokeStyle = showDissonance ? 'rgba(148, 163, 184, 0.55)' : 'rgba(71, 85, 105, 0.45)';
    ctx.lineWidth = showDissonance ? 1.4 : 1.0;
    ctx.moveTo(0, baselineY);
    ctx.lineTo(width, baselineY);
    ctx.stroke();

    // Subtle axis labels when dissonance zone is active
    if (showDissonance) {
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.fillText('+ HARMONICS', 8, baselineY - 6);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.75)';
      ctx.fillText('− DISSONANCE', 8, baselineY + 12);
    }

    ctx.restore();
  }

  /**
   * Gathers and caches overtone series objects for all currently sounding and decaying notes.
   */
  private collectOvertoneSeries(
    activeNotes: Map<number, ActiveNote>,
    decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>,
    tonic: number,
    width: number,
    plotHeight: number,
    plotBottom: number,
    minFreq: number,
    maxFreq: number,
    now: number
  ): void {
    this.activeSeriesList.length = 0;

    // 1. Active notes
    for (const note of activeNotes.values()) {
      const elapsed = now - note.startTime;
      const attackProgress = Math.min(1.0, elapsed / 140);

      const partials = computeNotePartials(
        note.midi,
        note.velocity,
        tonic,
        width,
        plotHeight,
        plotBottom,
        minFreq,
        maxFreq,
        attackProgress,
        0.0
      );

      this.activeSeriesList.push({
        noteMidi: note.midi,
        velocity: note.velocity,
        isDecaying: false,
        decayProgress: 0,
        partials,
      });
    }

    // 2. Decaying notes
    for (const { note, decayProgress } of decayingNotes.values()) {
      if (decayProgress >= 0.99) continue;

      const partials = computeNotePartials(
        note.midi,
        note.velocity,
        tonic,
        width,
        plotHeight,
        plotBottom,
        minFreq,
        maxFreq,
        1.0,
        decayProgress
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
   * Renders gentle ambient baseline oscillation when no notes are sounding.
   */
  private renderIdleBaseline(
    ctx: CanvasRenderingContext2D,
    width: number,
    baselineY: number,
    dissonanceDepth: number,
    now: number,
    fluidSpeed: number,
    showDissonance: boolean
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
    ctx.lineWidth = 1.2;

    const t = now * 0.0015 * fluidSpeed;
    ctx.moveTo(0, baselineY);
    for (let x = 0; x <= width; x += 8) {
      const dy = Math.sin(x * 0.02 + t) * 2.2 + Math.cos(x * 0.007 - t * 0.7) * 1.5;
      ctx.lineTo(x, baselineY + dy);
    }
    ctx.stroke();

    // If dissonance zone is active, show subtle subterranean calm reflection
    if (showDissonance && dissonanceDepth > 10) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.22)';
      ctx.lineWidth = 1.0;
      ctx.moveTo(0, baselineY);
      for (let x = 0; x <= width; x += 8) {
        const dy = Math.sin(x * 0.015 - t) * 1.5 + Math.cos(x * 0.006 + t * 0.5) * 1.0;
        ctx.lineTo(x, baselineY + Math.max(0, dy));
      }
      ctx.stroke();
    }

    // Subtle helper caption
    ctx.fillStyle = 'rgba(100, 116, 139, 0.55)';
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    ctx.fillText('Play keys to excite harmonic overtones and fluid wave simulation', width / 2, baselineY - 18);

    ctx.restore();
  }

  /**
   * Calculates Plomp-Levelt roughness / dissonance across interacting partials of different notes.
   * Amplitudes are normalized relative to plotHeight to maintain consistent physical acoustic scaling.
   */
  private calculateInteractions(width: number, plotHeight: number, minFreq: number, maxFreq: number): void {
    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(maxFreq);
    const logSpan = logMax - logMin;
    const invPlotHeight = 1.0 / Math.max(1, plotHeight);

    const numSeries = this.activeSeriesList.length;
    const numPairs = (numSeries * (numSeries - 1)) / 2;
    // Chord density normalization: prevents 4-note consonant chords (e.g. maj7) from accumulating more raw energy than a dyad clash
    const chordNorm = numPairs <= 1 ? 1.0 : 1.0 / Math.sqrt(numPairs);

    for (let i = 0; i < this.activeSeriesList.length; i++) {
      const seriesA = this.activeSeriesList[i];
      for (let j = i + 1; j < this.activeSeriesList.length; j++) {
        const seriesB = this.activeSeriesList[j];

        // Musical interval distance in semitones (modulo 12) between fundamental pitch classes
        const semitoneDiff = Math.abs(Math.round(seriesB.noteMidi) - Math.round(seriesA.noteMidi)) % 12;
        const intervalWeight = OvertonesRenderer.INTERVAL_DISSONANCE_WEIGHTS[semitoneDiff];

        // 1. Direct fundamental interval tension deposited directly between note A and note B
        const pA0 = seriesA.partials[0];
        const pB0 = seriesB.partials[0];
        if (pA0 && pB0 && intervalWeight > 0.04) {
          const relA0 = pA0.amplitude * invPlotHeight;
          const relB0 = pB0.amplitude * invPlotHeight;
          if (relA0 > 0.05 && relB0 > 0.05) {
            const fMid = Math.sqrt(pA0.frequency * pB0.frequency);
            const xMid = ((Math.log2(fMid) - logMin) / logSpan) * width;
            const sigma = Math.max(16, Math.abs(pB0.x - pA0.x) * 0.5);
            const binRadius = Math.ceil((sigma * 2.5 * this.numBins) / width);
            const centerBin = Math.floor((xMid / width) * this.numBins);
            const startBin = Math.max(0, centerBin - binRadius);
            const endBin = Math.min(this.numBins - 1, centerBin + binRadius);

            const fundamentalEnergy = intervalWeight * relA0 * relB0 * 0.12 * chordNorm;
            for (let b = startBin; b <= endBin; b++) {
              const bx = (b / (this.numBins - 1)) * width;
              const dx = bx - xMid;
              this.dissonanceBins[b] += fundamentalEnergy * Math.exp(-(dx * dx) / (2 * sigma * sigma));
            }
          }
        }

        // 2. Harmonic partial beating interactions (micro-roughness across all partial collisions)
        for (const pA of seriesA.partials) {
          const relA = pA.amplitude * invPlotHeight;
          if (relA < 0.01) continue;

          for (const pB of seriesB.partials) {
            const relB = pB.amplitude * invPlotHeight;
            if (relB < 0.01) continue;

            const diss = calculatePlompLevelt(pA.frequency, relA, pB.frequency, relB) * (0.3 + 0.7 * intervalWeight) * 0.5 * chordNorm;
            if (diss < 0.0001) continue;

            const fMid = (pA.frequency + pB.frequency) / 2;
            const xMid = ((Math.log2(fMid) - logMin) / logSpan) * width;
            const sigma = Math.max(12, Math.abs(pB.x - pA.x) * 0.7);
            const binRadius = Math.ceil((sigma * 2.5 * this.numBins) / width);
            const centerBin = Math.floor((xMid / width) * this.numBins);
            const startBin = Math.max(0, centerBin - binRadius);
            const endBin = Math.min(this.numBins - 1, centerBin + binRadius);

            for (let b = startBin; b <= endBin; b++) {
              const bx = (b / (this.numBins - 1)) * width;
              const dx = bx - xMid;
              this.dissonanceBins[b] += diss * Math.exp(-(dx * dx) / (2 * sigma * sigma));
            }
          }
        }
      }
    }
  }

  /**
   * Renders individual partial fluid waveforms with Uniform Solfège colouring.
   */
  private renderPartialWaves(
    ctx: CanvasRenderingContext2D,
    width: number,
    plotBottom: number,
    now: number,
    fluidSpeed: number,
    waveFluidity: number
  ): void {
    ctx.save();
    const timeSec = now * 0.001;

    for (let sIdx = 0; sIdx < this.activeSeriesList.length; sIdx++) {
      const series = this.activeSeriesList[sIdx];

      for (let pIdx = 0; pIdx < series.partials.length; pIdx++) {
        const p = series.partials[pIdx];
        if (p.amplitude <= 1) continue;

        const sigma = p.envelopeWidth;
        const xStart = Math.max(0, p.x - sigma * 3);
        const xEnd = Math.min(width, p.x + sigma * 3);
        const step = 3;

        const omega = 2.4 * fluidSpeed * Math.sqrt(p.frequency / 80);
        const waveNumber = (2 * Math.PI) / (2.6 * sigma);

        ctx.beginPath();
        ctx.moveTo(xStart, plotBottom);

        for (let x = xStart; x <= xEnd; x += step) {
          const dx = x - p.x;
          const envelope = Math.exp(-(dx * dx) / (2 * sigma * sigma));
          const ripple = 1.0 + 0.28 * waveFluidity * Math.cos(waveNumber * dx - omega * timeSec);
          const y = plotBottom - p.amplitude * envelope * ripple;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(xEnd, plotBottom);
        ctx.closePath();

        // Fluid gradient fill tinted with the Solfège pitch colour
        const grad = ctx.createLinearGradient(p.x, p.y, p.x, plotBottom);
        const alphaPeak = p.isFundamental ? 0.42 : 0.22;
        grad.addColorStop(0, this.hexToRgba(p.colorHex, alphaPeak));
        grad.addColorStop(0.7, this.hexToRgba(p.colorHex, alphaPeak * 0.35));
        grad.addColorStop(1, this.hexToRgba(p.colorHex, 0.02));

        ctx.fillStyle = grad;
        ctx.fill();

        // Glowing neon crest stroke
        ctx.beginPath();
        for (let x = xStart; x <= xEnd; x += step) {
          const dx = x - p.x;
          const envelope = Math.exp(-(dx * dx) / (2 * sigma * sigma));
          const ripple = 1.0 + 0.28 * waveFluidity * Math.cos(waveNumber * dx - omega * timeSec);
          const y = plotBottom - p.amplitude * envelope * ripple;
          if (x === xStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = this.hexToRgba(p.colorHex, p.isFundamental ? 0.9 : 0.65);
        ctx.lineWidth = p.isFundamental ? 2.4 : 1.4;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Renders the master composite fluid surface envelope spanning the entire heightfield.
   */
  private renderMasterFluidSurface(
    ctx: CanvasRenderingContext2D,
    width: number,
    plotBottom: number
  ): void {
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(0, plotBottom);

    for (let b = 0; b < this.numBins; b++) {
      const x = (b / (this.numBins - 1)) * width;
      const h = this.heightfield[b];
      const y = plotBottom - h;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, plotBottom);
    ctx.closePath();

    // Caustic surface highlight line
    ctx.beginPath();
    for (let b = 0; b < this.numBins; b++) {
      const x = (b / (this.numBins - 1)) * width;
      const h = this.heightfield[b];
      const y = plotBottom - h;
      if (b === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renders the psychoacoustical roughness / dissonance wave going below the baseline axis into the reserved subterranean space.
   */
  private renderDissonanceCurve(
    ctx: CanvasRenderingContext2D,
    width: number,
    baselineY: number,
    dissonanceDepth: number,
    now: number,
    fluidSpeed: number,
    waveFluidity: number
  ): void {
    if (dissonanceDepth <= 5) return;

    let peak = 0;
    for (let b = 0; b < this.numBins; b++) {
      if (this.dissonanceBins[b] > peak) peak = this.dissonanceBins[b];
    }

    ctx.save();

    const maxDissHeight = Math.min(dissonanceDepth - 8, dissonanceDepth * 0.82);
    const timeSec = now * 0.001;
    const t = timeSec * 2.2 * fluidSpeed;

    const REFERENCE_SCALE = OvertonesRenderer.REFERENCE_DISSONANCE_SCALE;

    if (peak > 0.003) {
      // 1. Inverted stylised fluid wave dipping below the horizontal baseline with consistent absolute scaling
      ctx.beginPath();
      ctx.moveTo(0, baselineY);

      for (let b = 0; b < this.numBins; b++) {
        const x = (b / (this.numBins - 1)) * width;
        // Consistent absolute scale: subtle for P5/3rds (~2-17%), deep for Tritone (~62%) and Minor 2nd (~100%)
        const normalizedH = Math.min(1.0, this.dissonanceBins[b] / REFERENCE_SCALE);
        // Kinetic fluid undulation
        const ripple = 1.0 + 0.18 * waveFluidity * Math.sin(x * 0.035 + t);
        const baseH = normalizedH * maxDissHeight * ripple;

        // Jagged auditory beating modulation (rapid flutter and micro-oscillations where dissonance is active)
        const beatingOsc = Math.sin(b * 0.85 + t * 8.0) * 0.55 + Math.sin(b * 1.75 - t * 13.0) * 0.45;
        const jaggedTexture = (b % 2 === 0 ? 0.65 : -0.65) * Math.min(1.0, normalizedH * 2.0);
        const beatAmplitude = Math.min(6.0, baseH * 0.22) * (0.6 * beatingOsc + 0.4 * jaggedTexture);
        const h = Math.max(0, baseH + beatAmplitude);

        const y = baselineY + h; // Going BELOW the baseline axis!
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, baselineY);
      ctx.closePath();

      // Translucent subterranean white gradient fill (from baseline downwards)
      const dissGrad = ctx.createLinearGradient(0, baselineY, 0, baselineY + maxDissHeight);
      dissGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      dissGrad.addColorStop(0.5, 'rgba(226, 232, 240, 0.10)');
      dissGrad.addColorStop(1, 'rgba(255, 255, 255, 0.01)');
      ctx.fillStyle = dissGrad;
      ctx.fill();

      // Sharp white beating stroke line along the bottom wave contour
      ctx.beginPath();
      for (let b = 0; b < this.numBins; b++) {
        const x = (b / (this.numBins - 1)) * width;
        const normalizedH = Math.min(1.0, this.dissonanceBins[b] / REFERENCE_SCALE);
        const ripple = 1.0 + 0.18 * waveFluidity * Math.sin(x * 0.035 + t);
        const baseH = normalizedH * maxDissHeight * ripple;
        const beatingOsc = Math.sin(b * 0.85 + t * 8.0) * 0.55 + Math.sin(b * 1.75 - t * 13.0) * 0.45;
        const jaggedTexture = (b % 2 === 0 ? 0.65 : -0.65) * Math.min(1.0, normalizedH * 2.0);
        const beatAmplitude = Math.min(6.0, baseH * 0.22) * (0.6 * beatingOsc + 0.4 * jaggedTexture);
        const h = Math.max(0, baseH + beatAmplitude);
        const y = baselineY + h;
        if (b === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Fine secondary caustic / ghost beating trace
      ctx.beginPath();
      for (let b = 0; b < this.numBins; b += 2) {
        const x = (b / (this.numBins - 1)) * width;
        const normalizedH = Math.min(1.0, this.dissonanceBins[b] / REFERENCE_SCALE);
        const ripple = 1.0 + 0.18 * waveFluidity * Math.sin(x * 0.035 + t);
        const baseH = normalizedH * maxDissHeight * ripple * 0.94;
        const beatingOsc = Math.sin(b * 0.85 + t * 8.0) * 0.55 + Math.sin(b * 1.75 - t * 13.0) * 0.45;
        const h = Math.max(0, baseH + beatingOsc * Math.min(3.0, baseH * 0.15));
        const y = baselineY + h;
        if (b === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Crunch / Dissonance percentage readout tag with consistent scale
      const roughnessPct = Math.min(100, Math.round((peak / REFERENCE_SCALE) * 100));
      ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(`Crunch: ${roughnessPct}%`, width - 12, baselineY + dissonanceDepth - 4);
    } else {
      // Subtle subterranean breathing wave when active notes are in pure consonance
      ctx.beginPath();
      ctx.moveTo(0, baselineY);
      for (let x = 0; x <= width; x += 8) {
        const dy = Math.sin(x * 0.018 - t) * 1.8 + Math.cos(x * 0.008 + t * 0.6) * 1.2;
        ctx.lineTo(x, baselineY + Math.max(0, dy));
      }
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Renders Solfège badges and partial multiplier labels above wave crests.
   */
  private renderLabels(
    ctx: CanvasRenderingContext2D,
    topBound: number
  ): void {
    ctx.save();

    for (let sIdx = 0; sIdx < this.activeSeriesList.length; sIdx++) {
      const series = this.activeSeriesList[sIdx];

      for (let pIdx = 0; pIdx < series.partials.length; pIdx++) {
        const p = series.partials[pIdx];
        if (p.amplitude <= 12) continue;

        const crestY = Math.max(topBound + 12, p.y);

        if (p.isFundamental) {
          // Fundamental: Prominent Solfège badge
          ctx.beginPath();
          ctx.arc(p.x, crestY - 14, 11, 0, Math.PI * 2);
          ctx.fillStyle = p.colorHex;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Syllable text
          ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = this.getContrastingTextColor(p.colorHex);
          ctx.fillText(p.solfege, p.x, crestY - 14);

          // "1×" badge above
          ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.fillText('1×', p.x, crestY - 29);
        } else {
          // Higher Partial: Compact multiplier and Solfège syllable
          ctx.beginPath();
          ctx.arc(p.x, crestY - 8, 7, 0, Math.PI * 2);
          ctx.fillStyle = this.hexToRgba(p.colorHex, 0.85);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Harmonic multiplier
          ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = this.getContrastingTextColor(p.colorHex);
          ctx.fillText(`${p.partialNumber}×`, p.x, crestY - 8);

          // Syllable text above
          ctx.font = "bold 8px 'JetBrains Mono', monospace";
          ctx.fillStyle = p.colorHex;
          ctx.fillText(p.solfege, p.x, crestY - 19);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Helper to query fundamental wave crest coordinates for bloom/flare integration.
   */
  public getFundamentalCoordinates(
    midi: number,
    width: number,
    height: number,
    minFreq: number = 27.5,
    maxFreq: number = 6000
  ): { x: number; y: number } | null {
    const f1 = midiToFrequency(midi);
    if (f1 < minFreq || f1 > maxFreq) return null;

    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(maxFreq);
    const x = ((Math.log2(f1) - logMin) / (logMax - logMin)) * width;
    const y = height * 0.45;

    return { x, y };
  }

  /**
   * Helper to query peak dissonance roughness score.
   */
  public getPeakDissonance(): number {
    let peak = 0;
    for (let b = 0; b < this.numBins; b++) {
      if (this.dissonanceBins[b] > peak) peak = this.dissonanceBins[b];
    }
    return peak;
  }

  /**
   * Helper to query peak dissonance crunch percentage (0 to 100%).
   */
  public getPeakRoughnessPercentage(): number {
    const peak = this.getPeakDissonance();
    return Math.min(100, Math.round((peak / OvertonesRenderer.REFERENCE_DISSONANCE_SCALE) * 100));
  }

  private hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return hex;
  }

  private getContrastingTextColor(hex: string): string {
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      return luma > 160 ? '#0b0f19' : '#ffffff';
    }
    return '#ffffff';
  }
}
