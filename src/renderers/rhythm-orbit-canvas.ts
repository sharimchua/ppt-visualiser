import {
  SOLFEGE_SYLLABLES,
  SOLFEGE_SPECS,
  resolveMidiToRegisterAndSemitone,
  isBlackPianoKey,
  getPptNoteheadSpec,
  getDecayFadeFactor,
} from '../core/ppt-constants';
import { VisualiserConfig } from '../core/types';
import {
  RhythmEngine,
  TempoShiftType,
  RhythmAlignmentResult,
  PrimeFamily,
  StreamMetreState,
} from '../core/rhythm-engine';
import { drawPptNotehead } from './notehead-renderer';
import { drawUniformSolfegeOnCanvas } from './glyph-renderer';

interface PulseWave {
  startTime: number;
  durationMs: number;
  isConvergence?: boolean;
}

interface TempoShiftAnimation {
  oldBpm: number;
  newBpm: number;
  shiftType: TempoShiftType;
  startTime: number;
  durationMs: number;
}

/**
 * Prime-family visual palette for per-track metre visualisation.
 * Follows canonical Prime Period Theory generators:
 * - Du (Prime 2): Sky Blue
 * - Tri (Prime 3): Warm Amber
 * - DuTri (Compound 2x3): Crimson / Rose
 * - Qui (Prime 5): Emerald Green
 * - Sep (Prime 7): Royal Violet
 * - Unknown: Silver Slate
 */
export const PRIME_FAMILY_COLORS: Record<
  PrimeFamily,
  { primary: string; glow: string; label: string }
> = {
  du: { primary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)', label: 'Du' },
  tri: { primary: '#f59e0b', glow: 'rgba(245, 158, 11, 0.45)', label: 'Tri' },
  dutri: { primary: '#f43f5e', glow: 'rgba(244, 63, 94, 0.45)', label: 'DuTri' },
  qui: { primary: '#10b981', glow: 'rgba(16, 185, 129, 0.45)', label: 'Qui' },
  sep: { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.45)', label: 'Sep' },
  unknown: { primary: '#94a3b8', glow: 'rgba(148, 163, 184, 0.35)', label: 'Grid' },
};

export class RhythmOrbitRenderer {
  private downbeatPulses: PulseWave[] = [];
  private activeTempoShift: TempoShiftAnimation | null = null;

  // Cached on-screen coordinates for active onsets (to support cosmetic particle bursts)
  private onsetCoordinates: Map<number, { x: number; y: number; radius: number }> = new Map();

  // Last rendered dimensions
  private lastCx: number = 0;
  private lastCy: number = 0;
  private lastRadius: number = 0;

  /**
   * Triggers a kinetic tempo modulation animation.
   * Duple modulation uses a less pronounced gentle ripple; arbitrary shifts use full elastic scaling.
   */
  public triggerTempoShift(
    oldBpm: number,
    newBpm: number,
    shiftType: TempoShiftType = 'arbitrary'
  ): void {
    const isDuple = shiftType === 'duple';
    this.activeTempoShift = {
      oldBpm,
      newBpm,
      shiftType,
      startTime: performance.now(),
      durationMs: isDuple ? 420 : 950,
    };
  }

  /**
   * Returns rendered coordinates for a MIDI note to spawn cosmetic particles.
   */
  public getCoordinatesForMidi(midi: number): { x: number; y: number } | null {
    const coord = this.onsetCoordinates.get(midi);
    if (coord) {
      return { x: coord.x, y: coord.y };
    }
    // Fallback: approximate along outer track
    if (this.lastRadius > 0) {
      return { x: this.lastCx, y: this.lastCy - this.lastRadius * 0.85 };
    }
    return null;
  }

  /**
   * Main render method for Rhythm Orbit.
   * Accepts an optional pre-computed RhythmAlignmentResult from RenderCoordinator
   * to eliminate duplicate update ticks per frame.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    rhythmEngine: RhythmEngine,
    config: VisualiserConfig,
    timeMs: number,
    passedAlignment?: RhythmAlignmentResult
  ): void {
    if (width <= 0 || height <= 0) return;

    const cx = width / 2;
    const cy = height / 2;
    this.lastCx = cx;
    this.lastCy = cy;

    const baseRadius = Math.min(width, height) * 0.41;
    let radius = baseRadius;

    // 1. Calculate Kinetic Scaling for committed tempo shifts
    let ringScale = 1.0;
    let dupleRippleAlpha = 0;

    if (this.activeTempoShift) {
      const elapsed = timeMs - this.activeTempoShift.startTime;
      const progress = Math.min(1.0, elapsed / this.activeTempoShift.durationMs);

      if (progress >= 1.0) {
        this.activeTempoShift = null;
      } else {
        if (this.activeTempoShift.shiftType === 'duple') {
          // Less pronounced duple modulation: subtle damped ripple
          dupleRippleAlpha = Math.sin(progress * Math.PI) * 0.7;
          ringScale = 1.0 + Math.sin(progress * Math.PI * 2) * 0.025 * (1 - progress);
        } else {
          // Full elastic kinetic ring expansion/contraction for arbitrary tempo shifts
          const damping = Math.exp(-progress * 3.5);
          const oscillation = Math.sin(progress * Math.PI * 3.5);
          ringScale = 1.0 + oscillation * 0.075 * damping;
        }
      }
    }

    radius = baseRadius * ringScale;
    this.lastRadius = radius;

    // Clear coordinate cache for this frame
    this.onsetCoordinates.clear();

    // 2. Query Rhythm Engine state
    const alignment = passedAlignment ?? rhythmEngine.update(timeMs, config);
    const onsets = rhythmEngine.getOnsets();
    const streams: StreamMetreState[] = alignment.streams ?? [];

    // Convergence pulse trigger (polyrhythmic alignment at 12 o'clock)
    if (alignment.convergenceOccurred && config.rhythmDownbeatPulses !== false) {
      this.downbeatPulses.push({
        startTime: timeMs,
        durationMs: 900,
        isConvergence: true,
      });
    } else if (alignment.downbeatOccurred && config.rhythmDownbeatPulses !== false) {
      this.downbeatPulses.push({
        startTime: timeMs,
        durationMs: 700,
        isConvergence: false,
      });
    }

    if (this.downbeatPulses.length > 8) {
      this.downbeatPulses = this.downbeatPulses.slice(-8);
    }

    // 3. Render Downbeat and Convergence Perimeter Pulses
    if (this.downbeatPulses.length > 0) {
      const activePulses: PulseWave[] = [];
      for (const pulse of this.downbeatPulses) {
        const elapsed = timeMs - pulse.startTime;
        const progress = Math.min(1.0, elapsed / pulse.durationMs);
        if (progress < 1.0) {
          activePulses.push(pulse);
          const pulseRadius = radius + progress * (radius * 0.35);
          const alpha = (1 - progress) * (pulse.isConvergence ? 0.85 : 0.65);

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);

          if (pulse.isConvergence) {
            // Polyrhythmic convergence: radiant golden-white halo
            ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
            ctx.lineWidth = Math.max(1.5, 6 * (1 - progress));
          } else {
            // Standard downbeat: Do Crimson pulse
            ctx.strokeStyle = `rgba(225, 54, 16, ${alpha})`;
            ctx.lineWidth = Math.max(1, 4 * (1 - progress));
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      this.downbeatPulses = activePulses;
    }

    // 4. Determine Concentric Track Distribution
    const activeStreamCount = streams.length;
    const isDynamic = (config.rhythmTrackMode ?? 'dynamic') === 'dynamic';
    const trackCount = isDynamic
      ? Math.max(1, Math.min(8, activeStreamCount > 0 ? activeStreamCount : 4))
      : Math.max(1, Math.min(8, config.rhythmTrackCount ?? 4));

    const innerRadius = radius * 0.35;
    const trackSpan = radius - innerRadius;
    const trackSpacing = trackCount > 1 ? trackSpan / (trackCount - 1) : 0;

    // Helper to get radius for a track index
    const getTrackR = (trackIdx: number) => {
      const clamped = Math.max(0, Math.min(trackCount - 1, trackIdx));
      return trackCount === 1 ? radius * 0.75 : radius - clamped * trackSpacing;
    };

    // 5. Render Concentric Track Rings
    for (let t = 0; t < trackCount; t++) {
      const r = getTrackR(t);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);

      if (t === 0) {
        // Outermost boundary ring
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 2.0;
      } else {
        // Inner concentric tracks
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.22)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 6]);
      }
      ctx.stroke();

      // Duple modulation subtle ripple glint on tracks
      if (dupleRippleAlpha > 0) {
        ctx.strokeStyle = `rgba(56, 189, 248, ${dupleRippleAlpha * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    }

    // 6. Render Per-Track Prime-Family Metre Grids & Spokes
    for (let t = 0; t < trackCount; t++) {
      const r = getTrackR(t);
      const stream = streams.find((s) => s.trackIndex === t);
      const slots = stream ? stream.slots : 4;
      const family = stream ? stream.family : 'du';
      const palette = PRIME_FAMILY_COLORS[family];

      const tickHalfHeight = Math.max(4, Math.min(10, (trackSpacing || 24) * 0.28));

      for (let k = 0; k < slots; k++) {
        const angle = (k / slots) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const isDownbeat = k === 0;
        // Midpoint subdivision for duple
        const isDupleMid = family === 'du' && k === slots / 2;
        // Thirds for triple
        const isTriThird = family === 'tri' && (k === slots / 3 || k === (slots * 2) / 3);

        const isStructural = isDownbeat || isDupleMid || isTriThird;

        ctx.save();
        ctx.beginPath();

        if (isDownbeat) {
          // 12 o'clock downbeat spoke extends from track to track
          const startR = t === trackCount - 1 ? innerRadius * 0.85 : r - tickHalfHeight * 1.5;
          const endR = t === 0 ? radius + 6 : r + tickHalfHeight * 1.5;
          ctx.moveTo(cx + startR * cos, cy + startR * sin);
          ctx.lineTo(cx + endR * cos, cy + endR * sin);
          ctx.strokeStyle = t === 0 ? 'rgba(225, 54, 16, 0.75)' : palette.primary;
          ctx.lineWidth = 2.2;
        } else {
          // Per-slot radial tick centered on the track ring
          const startR = r - tickHalfHeight * (isStructural ? 1.2 : 0.8);
          const endR = r + tickHalfHeight * (isStructural ? 1.2 : 0.8);
          ctx.moveTo(cx + startR * cos, cy + startR * sin);
          ctx.lineTo(cx + endR * cos, cy + endR * sin);

          if (isStructural) {
            ctx.strokeStyle = palette.primary;
            ctx.lineWidth = 1.4;
          } else {
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.28)';
            ctx.lineWidth = 0.9;
          }
        }
        ctx.stroke();

        // Node pip at the slot intersection
        const pipRadius = isDownbeat ? 3.5 : isStructural ? 2.5 : 1.6;
        ctx.beginPath();
        ctx.arc(cx + r * cos, cy + r * sin, pipRadius, 0, Math.PI * 2);
        ctx.fillStyle = isDownbeat ? '#ffffff' : palette.primary;
        ctx.fill();

        ctx.restore();
      }
    }

    // 7. Perimeter Slot Numbers for Outermost Track
    const outerStream = streams.find((s) => s.trackIndex === 0);
    const outerSlots = outerStream ? outerStream.slots : 4;
    const outerPalette = PRIME_FAMILY_COLORS[outerStream ? outerStream.family : 'du'];

    for (let k = 0; k < outerSlots; k++) {
      const angle = (k / outerSlots) * Math.PI * 2 - Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const isDownbeat = k === 0;
      const labelR = radius + 18;
      const lx = cx + labelR * cos;
      const ly = cy + labelR * sin;

      ctx.save();
      ctx.font = isDownbeat
        ? 'bold 12px ui-monospace, SFMono-Regular, Menlo, monospace'
        : '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isDownbeat ? '#f8fafc' : outerPalette.primary;

      // Label as 1-indexed beat numbers or Do for downbeat
      const labelText = isDownbeat ? 'Do' : `${k + 1}`;
      ctx.fillText(labelText, lx, ly);
      ctx.restore();
    }

    // 8. Per-Track Independent Scanning Hands
    if (streams.length > 0 && alignment.isPulseActive) {
      for (const stream of streams) {
        if (!stream.isPulseActive) continue;

        const trackIdx = Math.min(trackCount - 1, stream.trackIndex);
        const r = getTrackR(trackIdx);
        const handAngle = stream.pulsePhase * Math.PI * 2 - Math.PI / 2;
        const handCos = Math.cos(handAngle);
        const handSin = Math.sin(handAngle);
        const palette = PRIME_FAMILY_COLORS[stream.family];

        ctx.save();

        // Faint trailing phosphor arc along the track
        const trailAngle = handAngle - Math.PI * 0.18;
        ctx.beginPath();
        ctx.arc(cx, cy, r, trailAngle, handAngle);
        ctx.strokeStyle = palette.glow;
        ctx.lineWidth = Math.max(3, (trackSpacing || 20) * 0.45);
        ctx.stroke();

        // Scanning hand line from centre to track radius
        const handGrad = ctx.createLinearGradient(
          cx,
          cy,
          cx + r * handCos,
          cy + r * handSin
        );
        handGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        handGrad.addColorStop(0.6, palette.primary);
        handGrad.addColorStop(1, '#ffffff');

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + r * handCos, cy + r * handSin);
        ctx.strokeStyle = handGrad;
        ctx.lineWidth = trackIdx === 0 ? 2.2 : 1.6;
        ctx.stroke();

        // Glowing beacon at tip
        const tipX = cx + r * handCos;
        const tipY = cy + r * handSin;

        ctx.beginPath();
        ctx.arc(tipX, tipY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(tipX, tipY, 7.0, 0, Math.PI * 2);
        ctx.fillStyle = palette.glow;
        ctx.fill();

        ctx.restore();
      }
    } else if (alignment.isPulseActive) {
      // Global fallback scanning hand if streams not yet populated
      const handAngle = alignment.pulsePhase * Math.PI * 2 - Math.PI / 2;
      const handCos = Math.cos(handAngle);
      const handSin = Math.sin(handAngle);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radius * handCos, cy + radius * handSin);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 2.0;
      ctx.stroke();
      ctx.restore();
    } else if (onsets.length > 0) {
      // Parked hand pointing at 12 o'clock awaiting beat 2
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - radius);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy - radius, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
      ctx.fill();
      ctx.restore();
    }

    // 9. Render Onsets on Tracks
    const nowSec = timeMs / 1000;
    const noteheadStyle = config.rhythmNoteheadStyle ?? 'ppt';
    const lowestMidi = config.keyboardLowestMidi ?? 21;

    for (const onset of onsets) {
      const ageSec = nowSec - onset.timestamp;
      const fadeProgress = Math.min(1.0, ageSec / 6.0); // 6s Hann window decay
      const alpha = getDecayFadeFactor(fadeProgress);
      if (alpha <= 0.01) continue;

      const trackIdx = Math.min(trackCount - 1, onset.trackIndex);
      const r = getTrackR(trackIdx);

      // Query slot count for this onset's track
      const stream = streams.find((s) => s.streamId === onset.streamId) ??
        streams.find((s) => s.trackIndex === trackIdx);
      const slots = stream ? stream.slots : 4;

      const displayPosition =
        config.rhythmQuantisation === 'none'
          ? onset.quantisedPosition
          : onset.nearestPosition;

      const noteAngle = (displayPosition / slots) * Math.PI * 2 - Math.PI / 2;
      const nx = cx + r * Math.cos(noteAngle);
      const ny = cy + r * Math.sin(noteAngle);

      // Cache coordinates for cosmetic particle emissions
      this.onsetCoordinates.set(onset.midi, { x: nx, y: ny, radius: 12 });

      // Elastic pop on entrance (within first 220ms)
      let popScale = 1.0;
      if (ageSec < 0.22) {
        const popNorm = ageSec / 0.22;
        popScale = 1.0 + Math.sin(popNorm * Math.PI) * 0.35;
      }

      const noteSize = Math.max(12, Math.min(24, 16 * popScale));

      // Resolve pitch context relative to active tonic
      const res = resolveMidiToRegisterAndSemitone(onset.midi, config.tonic, lowestMidi);
      const syllable = SOLFEGE_SYLLABLES[res.semitone];
      const spec = SOLFEGE_SPECS[syllable];
      const colorHex = spec ? spec.colorHex : '#38bdf8';

      const isBlack = isBlackPianoKey(onset.midi);
      const outlineColor = isBlack ? '#090d16' : '#ffffff';
      const pptSpec = getPptNoteheadSpec(res.semitone);

      ctx.save();
      ctx.globalAlpha = alpha;

      if (noteheadStyle === 'solfege') {
        // Uniform Solfège glyph
        drawUniformSolfegeOnCanvas(
          ctx,
          spec.glyphType,
          spec.rotation,
          nx,
          ny,
          noteSize * 1.25,
          colorHex,
          outlineColor,
          2.0,
          false
        );
      } else {
        // PPT geometric notehead
        drawPptNotehead(
          ctx,
          pptSpec.shape,
          nx,
          ny,
          noteSize,
          colorHex,
          outlineColor,
          false,
          isBlack ? 2.5 : 2.0,
          isBlack,
          colorHex
        );
      }

      ctx.restore();
    }

    // 10. Central Readout with Metre & Polyrhythm Classification
    if (config.rhythmShowBpm !== false) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const bpmNumber = Math.round(alignment.currentBpm);
      ctx.font = 'bold 26px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = alignment.isPulseActive ? '#f8fafc' : '#64748b';
      ctx.fillText(`${bpmNumber}`, cx, cy - 8);

      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('BPM', cx, cy + 12);

      // Metre & Polyrhythm Subtitle
      if (alignment.isPulseActive) {
        let metreBadge = '4/4';
        if (streams.length >= 2) {
          const distinctSlots = Array.from(new Set(streams.map((s) => s.slots)));
          if (distinctSlots.length >= 2) {
            // Distinct metres running across tracks -> Polyrhythm!
            metreBadge = `${distinctSlots.join(':')} POLYRHYTHM`;
          } else {
            const familyLabel = PRIME_FAMILY_COLORS[streams[0].family].label.toUpperCase();
            metreBadge = `${familyLabel} ${streams[0].slots} SLOTS`;
          }
        } else if (streams.length === 1) {
          const s = streams[0];
          const familyLabel = PRIME_FAMILY_COLORS[s.family].label.toUpperCase();
          metreBadge = `${familyLabel} ${s.slots} SLOTS`;
        }

        ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle =
          streams.length >= 2 && new Set(streams.map((s) => s.slots)).size >= 2
            ? '#facc15' // Gold for polyrhythm
            : '#38bdf8'; // Blue for standard metre
        ctx.fillText(metreBadge, cx, cy + 26);
      } else {
        ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = onsets.length > 0 ? '#f59e0b' : '#64748b';
        ctx.fillText(onsets.length > 0 ? 'AWAITING BEAT 2' : 'IDLE', cx, cy + 26);
      }

      ctx.restore();
    }

    // 11. Tuner-Style Tempo Shift Indicator
    if (
      config.rhythmShowTunerIndicator !== false &&
      alignment.tunerConfidence > 0 &&
      Math.abs(alignment.tunerOffset) > 0.02
    ) {
      this.renderTunerIndicator(
        ctx,
        cx,
        cy,
        radius,
        alignment.tunerOffset,
        alignment.tunerConfidence,
        alignment.bestBpm
      );
    }
  }

  /**
   * Renders the tuner-style needle gauge offset above 12 o'clock.
   */
  private renderTunerIndicator(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    tunerOffset: number,
    confidence: number,
    targetBpm: number
  ): void {
    const gaugeRadius = radius + 32;
    const arcHalfSpan = Math.PI * 0.14;
    const zenith = -Math.PI / 2;

    ctx.save();

    // Gauge background arc
    ctx.beginPath();
    ctx.arc(cx, cy, gaugeRadius, zenith - arcHalfSpan, zenith + arcHalfSpan);
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
    ctx.lineWidth = 3.0;
    ctx.stroke();

    // Centre tick mark at zenith
    const tickInner = gaugeRadius - 4;
    const tickOuter = gaugeRadius + 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - tickInner);
    ctx.lineTo(cx, cy - tickOuter);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Active deflected needle angle
    const needleAngle = zenith + tunerOffset * arcHalfSpan;
    const needleCos = Math.cos(needleAngle);
    const needleSin = Math.sin(needleAngle);

    const gaugeColor = tunerOffset > 0 ? '#10b981' : '#f59e0b';

    // Filled evidence progress arc
    ctx.beginPath();
    if (tunerOffset > 0) {
      ctx.arc(cx, cy, gaugeRadius, zenith, needleAngle);
    } else {
      ctx.arc(cx, cy, gaugeRadius, needleAngle, zenith);
    }
    ctx.strokeStyle = gaugeColor;
    ctx.lineWidth = 3.5;
    ctx.globalAlpha = 0.5 + confidence * 0.5;
    ctx.stroke();

    // Needle indicator pip
    const pipX = cx + gaugeRadius * needleCos;
    const pipY = cy + gaugeRadius * needleSin;

    ctx.beginPath();
    ctx.arc(pipX, pipY, 4.0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = gaugeColor;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Target BPM badge
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = gaugeColor;
    const bpmSign = tunerOffset > 0 ? `+${Math.round(targetBpm)}` : `${Math.round(targetBpm)}`;
    ctx.fillText(`${bpmSign} BPM`, cx, cy - gaugeRadius - 6);

    ctx.restore();
  }
}
