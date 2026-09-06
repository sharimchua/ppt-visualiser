import {
  ActiveNote,
  VisualiserConfig,
  PianoTriangleType,
  PianoTrianglePoint,
} from '../core/types';
import {
  SOLFEGE_SYLLABLES,
  SOLFEGE_SPECS,
  PITCH_CLASS_TO_PIANO_TRIANGLE,
  TRIANGLE_VERTEX_COORDINATES,
  PITCH_NAMES_SHARP,
  PITCH_NAMES_FLAT,
  getTriPitchClass,
  INTERVAL_NAMES,
} from '../core/ppt-constants';
import { getEffectiveModeIntervals } from '../core/scale-alignment';

/**
 * Fixed pitch-class mapping for every point on each of the 4 piano triangles.
 */
export const PIANO_TRIANGLE_POINT_TO_PITCH_CLASS: Record<PianoTriangleType, Record<PianoTrianglePoint, number>> = {
  D: { 1: 1, 2: 2, 3: 3 },   // 1=C#, 2=D, 3=D#
  L: { 1: 4, 2: 5, 3: 6 },   // 1=E, 2=F, 3=F#
  U: { 1: 7, 2: 8, 3: 9 },   // 1=G, 2=G#, 3=A
  R: { 1: 10, 2: 11, 3: 0 }, // 1=A#, 2=B, 3=C
};

export interface ScaleVertexInfo {
  degree: number; // 1..7 (1=Do, 2=Re...)
  semitonesFromDo: number;
  pc: number;
  syllable: string;
  color: string;
  isDo: boolean;
}

export interface PianoTriangleScaleSegment {
  triangle: PianoTriangleType;
  points: PianoTrianglePoint[];
  scaleVertices: Map<PianoTrianglePoint, ScaleVertexInfo>;
  hasDo: boolean;
  doPoint?: PianoTrianglePoint;
}

/**
 * Port of PPT Engraver's Tetrachord Chaining Algorithm:
 * Chains the 7 diatonic scale degrees around the tonic:
 * [5, 6, 7] (dominant fragment) -> [1] (tonic anchor Do) -> [2, 3, 4] (tonic fragment).
 * Adjacent degrees sharing the same piano triangle type merge into single triangle segments,
 * producing 4 or 5 chained triangles across all 12 keys.
 */
export function getScaleTetrachordChainTriangles(
  tonicPc: number,
  intervals: number[] = [0, 2, 4, 5, 7, 9, 11]
): PianoTriangleScaleSegment[] {
  const normTonic = ((tonicPc % 12) + 12) % 12;

  // Tetrachord chaining 0-indexed degree order:
  // [5, 6, 7] -> indices 4, 5, 6; [1] (Do) -> index 0; [2, 3, 4] -> indices 1, 2, 3
  const chainDegreeIndices = [4, 5, 6, 0, 1, 2, 3];

  const chainNotes = chainDegreeIndices.map((idx) => {
    const semitonesFromDo = intervals[idx % intervals.length];
    const pc = (normTonic + semitonesFromDo) % 12;
    const syllable = SOLFEGE_SYLLABLES[semitonesFromDo % 12];
    const spec = SOLFEGE_SPECS[syllable];
    const color = spec ? spec.colorHex : '#E13610';
    const pt = PITCH_CLASS_TO_PIANO_TRIANGLE[pc];
    const isDo = (idx === 0);
    const degreeNumber = idx === 0 ? 1 : idx + 1;

    return {
      degree: degreeNumber,
      semitonesFromDo,
      pc,
      syllable,
      color,
      triangle: pt.triangle,
      point: pt.point as PianoTrianglePoint,
      isDo,
    };
  });

  const segments: PianoTriangleScaleSegment[] = [];
  let currentSegment: PianoTriangleScaleSegment | null = null;

  for (const note of chainNotes) {
    if (!currentSegment || currentSegment.triangle !== note.triangle) {
      currentSegment = {
        triangle: note.triangle,
        points: [note.point],
        scaleVertices: new Map([[note.point, note]]),
        hasDo: note.isDo,
        doPoint: note.isDo ? note.point : undefined,
      };
      segments.push(currentSegment);
    } else {
      if (!currentSegment.points.includes(note.point)) {
        currentSegment.points.push(note.point);
      }
      currentSegment.scaleVertices.set(note.point, note);
      if (note.isDo) {
        currentSegment.hasDo = true;
        currentSegment.doPoint = note.point;
      }
    }
  }

  return segments;
}

interface TonicTriangleShiftAnimation {
  oldTonic: number;
  newTonic: number;
  startTime: number;
  durationMs: number;
}

/**
 * 60fps Canvas Renderer for the Piano Triangles Scale Signature Cell.
 * Displays 4/5 chained piano triangles with the vertex for Do centered,
 * pure geometric silhouettes, and octave-agnostic active tone highlighting.
 */
export class PianoTrianglesRenderer {
  private activeTonicShift: TonicTriangleShiftAnimation | null = null;

  /**
   * Triggers the kinetic Do anchor beam surge and vertex expansion ripple.
   */
  public triggerTonicShift(oldTonic: number, newTonic: number): void {
    this.activeTonicShift = {
      oldTonic,
      newTonic,
      startTime: performance.now(),
      durationMs: 900,
    };
  }

  /**
   * Main render tick.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    activeNotes: Map<number, ActiveNote>,
    decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>,
    config: VisualiserConfig,
    _timeMs: number
  ): void {
    if (width <= 0 || height <= 0) return;

    // Resolve scale intervals based on active mode
    const intervals = getEffectiveModeIntervals(config.autoTonicMode, config.autoTonicCustomDegrees);
    const segments = getScaleTetrachordChainTriangles(config.tonic, intervals);
    const n = segments.length;
    if (n === 0) return;

    // Find the segment and vertex containing Do
    const doSegIndex = segments.findIndex((s) => s.hasDo);
    const doSegment = doSegIndex !== -1 ? segments[doSegIndex] : segments[Math.floor(n / 2)];
    const doPoint = doSegment.doPoint ?? 2;

    // Calculate responsive margins and available layout geometry
    const marginX = Math.max(8, Math.min(24, width * 0.04));
    const marginY = Math.max(10, Math.min(28, height * 0.05));
    const availableWidth = Math.max(60, width - marginX * 2);
    const availableHeight = Math.max(40, height - marginY * 2);

    // Initial estimation of triangle size to fit available width
    let triSize = Math.max(30, Math.min(170, Math.min((availableWidth - (n - 1) * 6) / n, availableHeight * 0.75)));
    let gap = Math.max(4, Math.min(24, triSize * 0.16));
    let totalChainWidth = n * triSize + (n - 1) * gap;

    if (totalChainWidth > availableWidth) {
      const fitScale = availableWidth / totalChainWidth;
      triSize = Math.max(26, triSize * fitScale);
      gap = Math.max(3, gap * fitScale);
      totalChainWidth = n * triSize + (n - 1) * gap;
    }

    // Locate Do vertex normalized in 100x100 space
    const doGeom = TRIANGLE_VERTEX_COORDINATES[doSegment.triangle];
    const doNormX = (doGeom.points[doPoint]?.x ?? 50) / 100;
    const doXInChain = doSegIndex * (triSize + gap) + doNormX * triSize;

    // Horizontal placement with graceful soft-centering:
    // When width permits, centre Do at width / 2; otherwise clamp within viewport margins
    // so triangles are never crushed to keep an off-centre tonic at the exact canvas midpoint.
    let chainStartX = width / 2 - doXInChain;
    const minStartX = marginX;
    const maxStartX = Math.max(minStartX, width - marginX - totalChainWidth);

    if (chainStartX < minStartX) {
      chainStartX = minStartX;
    } else if (chainStartX > maxStartX) {
      chainStartX = maxStartX;
    }

    const actualDoX = chainStartX + doXInChain;
    const chainCenterY = height / 2;

    // Build octave-agnostic active & decaying pitch-class maps
    const activePcMap = new Map<number, number>(); // pc -> max velocity
    for (const note of activeNotes.values()) {
      const pc = ((note.midi % 12) + 12) % 12;
      activePcMap.set(pc, Math.max(activePcMap.get(pc) || 0, note.velocity ?? 0.8));
    }

    const decayPcMap = new Map<number, number>(); // pc -> intensity (1 - progress)
    for (const data of decayingNotes.values()) {
      const pc = ((data.note.midi % 12) + 12) % 12;
      const factor = Math.max(0, 1 - data.decayProgress);
      decayPcMap.set(pc, Math.max(decayPcMap.get(pc) || 0, factor));
    }

    // 1. Draw subtle Centre Anchor guide line at actual Do position if enabled
    if (config.showCenterAnchor) {
      this.renderCenterAnchorGuide(ctx, actualDoX, chainCenterY, triSize, availableHeight);
    }

    // 2. Draw subtle chain link baseline connecting adjacent triangles
    this.renderChainLink(ctx, chainStartX, chainCenterY, segments, triSize, gap);

    // 3. Render each Piano Triangle in the chain
    segments.forEach((seg, i) => {
      const triX = chainStartX + i * (triSize + gap);
      const triY = chainCenterY - triSize / 2;

      this.renderTriangleSegment(
        ctx,
        seg,
        triX,
        triY,
        triSize,
        activePcMap,
        decayPcMap,
        config
      );
    });

    // 4. Kinetic tonic modulation surge & Do anchor pulse
    if (config.tonicShiftEffectsEnabled !== false && this.activeTonicShift) {
      const doNormY = (doGeom.points[doPoint]?.y ?? 50) / 100;
      const actualDoY = (chainCenterY - triSize / 2) + doNormY * triSize;
      this.renderTonicShiftKinetics(ctx, actualDoX, actualDoY, chainCenterY, triSize, availableHeight, config);
    }
  }

  /**
   * Renders the kinetic Do anchor beam surge and vertex ripple when tonic changes.
   */
  private renderTonicShiftKinetics(
    ctx: CanvasRenderingContext2D,
    doX: number,
    doY: number,
    chainCenterY: number,
    triSize: number,
    availH: number,
    config: VisualiserConfig
  ): void {
    if (!this.activeTonicShift) return;
    const elapsed = performance.now() - this.activeTonicShift.startTime;
    if (elapsed >= this.activeTonicShift.durationMs) {
      this.activeTonicShift = null;
      return;
    }

    const t = elapsed / this.activeTonicShift.durationMs;
    const surgeAlpha = Math.max(0, 1 - Math.pow(t, 1.4));

    ctx.save();

    // 1. Vertical Do Anchor Laser Beam Surge
    const beamY1 = chainCenterY - availH / 2 + 6;
    const beamY2 = chainCenterY + availH / 2 - 6;

    ctx.beginPath();
    ctx.moveTo(doX, beamY1);
    ctx.lineTo(doX, beamY2);
    ctx.strokeStyle = '#E13610';
    ctx.lineWidth = 1.5 + (1 - t) * 3.5;
    ctx.globalAlpha = surgeAlpha * 0.9;
    ctx.shadowColor = '#E13610';
    ctx.shadowBlur = 16 * (config.glowBloom ?? 0.8);
    ctx.stroke();

    // Inner white laser core
    ctx.beginPath();
    ctx.moveTo(doX, beamY1);
    ctx.lineTo(doX, beamY2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = surgeAlpha * 0.75;
    ctx.stroke();

    // 2. Expanding Do Vertex Harmonic Ring Ripple
    const rippleR = 6 + t * 48;
    ctx.beginPath();
    ctx.arc(doX, doY, rippleR, 0, Math.PI * 2);
    ctx.strokeStyle = '#E13610';
    ctx.lineWidth = Math.max(0.6, 2.4 * (1 - t));
    ctx.globalAlpha = surgeAlpha * 0.8;
    ctx.shadowColor = '#E13610';
    ctx.shadowBlur = 14 * (config.glowBloom ?? 0.8);
    ctx.stroke();

    // 3. Do Anchor Diamond Pip Flash
    const pipY = chainCenterY - triSize * 0.7;
    ctx.beginPath();
    ctx.arc(doX, pipY, 3 + surgeAlpha * 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#E13610';
    ctx.shadowBlur = 16 * (config.glowBloom ?? 0.8);
    ctx.globalAlpha = surgeAlpha;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renders a subtle vertical dashed axis guide at the Do center position.
   */
  private renderCenterAnchorGuide(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    triSize: number,
    availH: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 6]);
    ctx.moveTo(centerX, centerY - availH / 2 + 10);
    ctx.lineTo(centerX, centerY + availH / 2 - 10);
    ctx.strokeStyle = 'rgba(225, 54, 16, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Subtle Do Anchor diamond pip at top
    ctx.setLineDash([]);
    ctx.fillStyle = '#E13610';
    ctx.beginPath();
    const pipY = centerY - triSize * 0.7;
    ctx.arc(centerX, pipY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draws a faint horizontal chain linkage behind adjacent triangles.
   */
  private renderChainLink(
    ctx: CanvasRenderingContext2D,
    startX: number,
    centerY: number,
    segments: PianoTriangleScaleSegment[],
    triSize: number,
    gap: number
  ): void {
    if (segments.length <= 1) return;
    ctx.save();
    ctx.beginPath();
    const endX = startX + segments.length * triSize + (segments.length - 1) * gap;
    ctx.moveTo(startX + triSize * 0.5, centerY);
    ctx.lineTo(endX - triSize * 0.5, centerY);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders a single Piano Triangle segment (pure geometric shape, vertices, and labels).
   */
  private renderTriangleSegment(
    ctx: CanvasRenderingContext2D,
    seg: PianoTriangleScaleSegment,
    x: number,
    y: number,
    size: number,
    activePcMap: Map<number, number>,
    decayPcMap: Map<number, number>,
    config: VisualiserConfig
  ): void {
    const geom = TRIANGLE_VERTEX_COORDINATES[seg.triangle];
    const scale = size / 100;

    ctx.save();
    ctx.translate(x, y);

    // --- A. Draw Triangle Silhouette (Pure Geometric Shape) ---
    const p1 = geom.points[1];
    const p2 = geom.points[2];
    const p3 = geom.points[3];

    ctx.beginPath();
    ctx.moveTo(p1.x * scale, p1.y * scale);
    ctx.lineTo(p2.x * scale, p2.y * scale);
    ctx.lineTo(p3.x * scale, p3.y * scale);
    ctx.closePath();

    // Fill silhouette
    ctx.fillStyle = seg.hasDo ? 'rgba(25, 30, 45, 0.85)' : 'rgba(15, 23, 42, 0.75)';
    ctx.fill();

    // Silhouette Stroke
    ctx.strokeStyle = seg.hasDo ? 'rgba(225, 54, 16, 0.45)' : 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = seg.hasDo ? 2.2 : 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Triangle centroid for outward label offsets
    const centroidX = ((p1.x + p2.x + p3.x) / 3) * scale;
    const centroidY = ((p1.y + p2.y + p3.y) / 3) * scale;

    // --- B. Draw the 3 Vertices ---
    for (const pt of [1, 2, 3] as PianoTrianglePoint[]) {
      const ptCoord = geom.points[pt];
      const vx = ptCoord.x * scale;
      const vy = ptCoord.y * scale;

      const pc = PIANO_TRIANGLE_POINT_TO_PITCH_CLASS[seg.triangle][pt];
      const scaleInfo = seg.scaleVertices.get(pt);
      const isScaleTone = !!scaleInfo;
      const isDo = scaleInfo?.isDo || (seg.hasDo && seg.doPoint === pt);

      const isActive = activePcMap.has(pc);
      const isDecaying = !isActive && decayPcMap.has(pc);
      const velocity = activePcMap.get(pc) ?? 0.8;
      const decayFactor = decayPcMap.get(pc) ?? 0;

      // Determine solfege color for active/idle state
      const semitone = ((pc - config.tonic) % 12 + 12) % 12;
      const defaultSyllable = SOLFEGE_SYLLABLES[semitone];
      const defaultColor = SOLFEGE_SPECS[defaultSyllable]?.colorHex ?? '#E13610';
      const vertexColor = scaleInfo?.color ?? defaultColor;

      // Base radius calculation with proportional scaling
      let radius = Math.max(2.8, size * 0.08);
      if (isActive) {
        radius = Math.max(4.5, size * (0.11 + 0.03 * velocity));
      } else if (isScaleTone) {
        radius = Math.max(3.5, size * (isDo ? 0.095 : 0.082));
      } else {
        radius = Math.max(2.2, size * 0.055); // Chromatic non-scale tones are smaller in resting state
      }

      ctx.save();

      if (isActive) {
        // --- ACTIVE VERTEX: Vibrant Solfege Glow + White Halo ---
        ctx.shadowColor = vertexColor;
        ctx.shadowBlur = 18 * velocity;

        // Outer glow disc
        ctx.beginPath();
        ctx.arc(vx, vy, radius + 2.5, 0, Math.PI * 2);
        ctx.fillStyle = vertexColor;
        ctx.globalAlpha = 0.4;
        ctx.fill();

        // Main active disc
        ctx.beginPath();
        ctx.arc(vx, vy, radius, 0, Math.PI * 2);
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = vertexColor;
        ctx.fill();

        // High contrast rim
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      } else if (isDecaying) {
        // --- DECAYING VERTEX: Smooth Alpha Fade ---
        ctx.shadowColor = vertexColor;
        ctx.shadowBlur = 10 * decayFactor;

        ctx.beginPath();
        ctx.arc(vx, vy, radius, 0, Math.PI * 2);
        ctx.fillStyle = vertexColor;
        ctx.globalAlpha = decayFactor * 0.85;
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = decayFactor * 0.9;
        ctx.stroke();
      } else if (isScaleTone) {
        // --- IDLE DIATONIC SCALE VERTEX ---
        ctx.beginPath();
        ctx.arc(vx, vy, radius, 0, Math.PI * 2);

        if (isDo) {
          // Do: prominent anchor with rich solfege fill and double rim
          ctx.fillStyle = vertexColor;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Outer accent ring for Do
          ctx.beginPath();
          ctx.arc(vx, vy, radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(225, 54, 16, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          // Other diatonic degrees: dark interior with crisp solfege color border
          ctx.fillStyle = 'rgba(20, 26, 40, 0.9)';
          ctx.fill();
          ctx.strokeStyle = vertexColor;
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // Subtle center pip
          ctx.beginPath();
          ctx.arc(vx, vy, radius * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = vertexColor;
          ctx.fill();
        }
      } else {
        // --- IDLE CHROMATIC / NON-SCALE VERTEX ---
        // Subtle ghosted resting circle
        ctx.beginPath();
        ctx.arc(vx, vy, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.restore();

      // --- C. Vertex Label (if enabled) ---
      if (config.showVertexLabels && config.vertexLabelType !== 'none') {
        this.renderVertexLabel(
          ctx,
          vx,
          vy,
          centroidX,
          centroidY,
          radius,
          size,
          pc,
          scaleInfo,
          isScaleTone,
          isDo,
          isActive,
          vertexColor,
          config
        );
      }
    }

    ctx.restore();
  }

  /**
   * Renders descriptive labels (Syllables, Pitch Names, Tri-Pitches, Intervals) outward from vertex.
   */
  private renderVertexLabel(
    ctx: CanvasRenderingContext2D,
    vx: number,
    vy: number,
    centroidX: number,
    centroidY: number,
    radius: number,
    size: number,
    pc: number,
    scaleInfo: ScaleVertexInfo | undefined,
    isScaleTone: boolean,
    isDo: boolean,
    isActive: boolean,
    color: string,
    config: VisualiserConfig
  ): void {
    // When triangles are compact (size < 48), suppress idle chromatic non-scale labels to prevent collision
    if (size < 48 && !isScaleTone && !isActive) {
      return;
    }

    // Determine label text
    let labelText = '';
    const semitone = ((pc - config.tonic) % 12 + 12) % 12;

    switch (config.vertexLabelType) {
      case 'syllables':
        labelText = scaleInfo?.syllable ?? SOLFEGE_SYLLABLES[semitone];
        break;
      case 'pitches':
        labelText = config.accidentalStyle === 'flat' ? PITCH_NAMES_FLAT[pc] : PITCH_NAMES_SHARP[pc];
        break;
      case 'triPitches':
        labelText = getTriPitchClass(pc, 'short');
        break;
      case 'intervals':
        labelText = isScaleTone ? `${scaleInfo?.degree ?? 1}` : INTERVAL_NAMES[semitone];
        break;
      default:
        return;
    }

    if (!labelText) return;

    // Compute outward label direction from triangle centroid with proportional offset
    const dx = vx - centroidX;
    const dy = vy - centroidY;
    const dist = Math.hypot(dx, dy) || 1;
    const offsetDist = radius + Math.max(5, Math.min(12, size * 0.14));
    const lx = vx + (dx / dist) * offsetDist;
    const ly = vy + (dy / dist) * offsetDist;

    // Dynamic typography scaling based on triangle size
    const fontSize = isDo
      ? Math.max(8, Math.min(12, Math.round(size * 0.16)))
      : Math.max(7, Math.min(11, Math.round(size * 0.14)));

    ctx.save();
    ctx.font = isDo ? `bold ${fontSize}px system-ui, sans-serif` : `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isActive) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
    } else if (isScaleTone) {
      ctx.fillStyle = isDo ? '#ffffff' : color;
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    }

    ctx.fillText(labelText, lx, ly);
    ctx.restore();
  }
}
