import {
  StreamItem,
  TonicShiftMarker,
  VisualiserConfig,
  StaffSize,
  StaffClef,
} from '../core/types';
import {
  midiToDiatonicStaffNote,
  TONIC_TO_KEY_SIGNATURE,
  PITCH_NAMES_DUAL,
  isBlackPianoKey,
} from '../core/ppt-constants';
import { renderPptNoteOnCanvas } from './notehead-renderer';
import { drawSmuflGlyph } from './smufl-glyphs';

export interface StaffChordOnset {
  timestamp: number;
  items: StreamItem[];
}

function deduplicateOnsetItems(items: StreamItem[]): StreamItem[] {
  const seenMidi = new Set<number>();
  const unique: StreamItem[] = [];
  for (const it of items) {
    if (!seenMidi.has(it.midi)) {
      seenMidi.add(it.midi);
      unique.push(it);
    }
  }
  return unique;
}

export function clusterItemsIntoOnsets(
  items: StreamItem[],
  windowSec: number = 0.045
): StaffChordOnset[] {
  if (items.length === 0) return [];
  const onsets: StaffChordOnset[] = [];
  let currentOnset: StreamItem[] = [];
  let currentBaseTime = items[0].timestamp;

  for (const item of items) {
    if (currentOnset.length === 0) {
      currentOnset.push(item);
      currentBaseTime = item.timestamp;
    } else if (Math.abs(item.timestamp - currentBaseTime) <= windowSec) {
      currentOnset.push(item);
    } else {
      const uniqueItems = deduplicateOnsetItems(currentOnset);
      uniqueItems.sort((a, b) => a.midi - b.midi);
      onsets.push({ timestamp: currentBaseTime, items: uniqueItems });
      currentOnset = [item];
      currentBaseTime = item.timestamp;
    }
  }

  if (currentOnset.length > 0) {
    const uniqueItems = deduplicateOnsetItems(currentOnset);
    uniqueItems.sort((a, b) => a.midi - b.midi);
    onsets.push({ timestamp: currentBaseTime, items: uniqueItems });
  }

  return onsets;
}

export interface VoiceLeadingNode {
  x: number;
  y: number;
  item: StreamItem;
  diatonicStep?: number;
}

export interface VoiceLeadingPair {
  from: VoiceLeadingNode;
  to: VoiceLeadingNode;
}

export function computeSatbVoiceLeading(
  onsetA: VoiceLeadingNode[],
  onsetB: VoiceLeadingNode[]
): VoiceLeadingPair[] {
  if (onsetA.length === 0 || onsetB.length === 0) return [];

  const sortedA = [...onsetA].sort((a, b) => a.item.midi - b.item.midi);
  const sortedB = [...onsetB].sort((a, b) => a.item.midi - b.item.midi);

  const pairs: VoiceLeadingPair[] = [];
  const matchedA = new Set<number>();
  const matchedB = new Set<number>();

  // 1. Soprano Line (Highest to Highest)
  const sopranoA = sortedA.length - 1;
  const sopranoB = sortedB.length - 1;
  pairs.push({ from: sortedA[sopranoA], to: sortedB[sopranoB] });
  matchedA.add(sopranoA);
  matchedB.add(sopranoB);

  // 2. Bass Line (Lowest to Lowest, if both have >= 2 notes)
  if (sortedA.length > 1 && sortedB.length > 1) {
    pairs.push({ from: sortedA[0], to: sortedB[0] });
    matchedA.add(0);
    matchedB.add(0);
  }

  // 3. Inner Voices (Tenor, Alto, etc.)
  const remainingA: number[] = [];
  for (let i = 0; i < sortedA.length; i++) {
    if (!matchedA.has(i)) remainingA.push(i);
  }
  const remainingB: number[] = [];
  for (let j = 0; j < sortedB.length; j++) {
    if (!matchedB.has(j)) remainingB.push(j);
  }

  if (remainingA.length > 0 && remainingB.length > 0) {
    if (remainingA.length === remainingB.length) {
      for (let k = 0; k < remainingA.length; k++) {
        pairs.push({ from: sortedA[remainingA[k]], to: sortedB[remainingB[k]] });
      }
    } else {
      const smaller = remainingA.length <= remainingB.length ? remainingA : remainingB;
      const larger = remainingA.length <= remainingB.length ? remainingB : remainingA;
      const isASmaller = remainingA.length <= remainingB.length;
      const usedLarger = new Set<number>();

      for (const sIdx of smaller) {
        let bestLIdx = -1;
        let bestDist = Infinity;
        const sMidi = isASmaller ? sortedA[sIdx].item.midi : sortedB[sIdx].item.midi;

        for (const lIdx of larger) {
          if (usedLarger.has(lIdx)) continue;
          const lMidi = isASmaller ? sortedB[lIdx].item.midi : sortedA[lIdx].item.midi;
          const dist = Math.abs(sMidi - lMidi);
          if (dist < bestDist) {
            bestDist = dist;
            bestLIdx = lIdx;
          }
        }

        if (bestLIdx !== -1) {
          usedLarger.add(bestLIdx);
          const fromNode = isASmaller ? sortedA[sIdx] : sortedA[bestLIdx];
          const toNode = isASmaller ? sortedB[bestLIdx] : sortedB[sIdx];
          pairs.push({ from: fromNode, to: toNode });
        }
      }
    }
  }

  return pairs;
}

/**
 * Resolves the active Solfège semitone degree (0..11) for a stream item,
 * honouring the item's recorded context (semitone / tonic) or reconstructing
 * it from timeline tonic shift markers so historical noteheads never change
 * retrospectively upon manual or automatic tonic modulation.
 */
export function resolveItemSemitoneFromTonic(
  item: StreamItem,
  currentTonic: number,
  tonicMarkers: TonicShiftMarker[] = []
): number {
  if (item.semitone !== undefined) {
    return ((item.semitone % 12) + 12) % 12;
  }
  const pc = item.pitchClass ?? (item.midi % 12);
  if (item.tonic !== undefined) {
    return ((pc - item.tonic) % 12 + 12) % 12;
  }
  // Reconstruct tonic context from timeline tonic shift markers
  if (tonicMarkers.length > 0) {
    let effectiveTonic: number | null = null;
    for (let i = tonicMarkers.length - 1; i >= 0; i--) {
      const marker = tonicMarkers[i];
      if (item.timestamp >= marker.timestamp) {
        effectiveTonic = marker.newTonic;
        break;
      }
    }
    if (effectiveTonic === null) {
      effectiveTonic = tonicMarkers[0].oldTonic;
    }
    return ((pc - effectiveTonic) % 12 + 12) % 12;
  }
  return ((pc - currentTonic) % 12 + 12) % 12;
}

// Standard staff line/space step positions from bottom line (Line 1 = 0, Space 1 = 0.5, Line 2 = 1.0, ..., Line 5 = 4.0)
export const TREBLE_KEY_SIG_SHARPS = [4.0, 2.5, 4.5, 3.0, 1.5, 3.5, 2.0]; // F5, C5, G5, D5, A4, E5, B4
export const TREBLE_KEY_SIG_FLATS  = [2.0, 3.5, 1.5, 3.0, 1.0, 2.5, 0.5]; // Bb4, Eb5, Ab4, Db5, Gb4, Cb5, Fb4

export const BASS_KEY_SIG_SHARPS   = [3.0, 1.5, 3.5, 2.0, 0.5, 2.5, 1.0]; // F4, C3, G3, D3, A2, E3, B2
export const BASS_KEY_SIG_FLATS    = [1.0, 2.5, 0.5, 2.0, 0.0, 1.5, -0.5]; // Bb3, Eb3, Ab2, Db3, Gb2, Cb3, Fb2

export const ALTO_KEY_SIG_SHARPS   = [3.0, 1.5, 3.5, 2.0, 0.5, 2.5, 1.0];
export const ALTO_KEY_SIG_FLATS    = [1.5, 3.0, 1.0, 2.5, 0.5, 2.0, 0.0];

export const TENOR_KEY_SIG_SHARPS  = [2.5, 1.0, 3.0, 1.5, 3.5, 2.0, 0.5];
export const TENOR_KEY_SIG_FLATS   = [2.0, 0.5, 2.5, 1.0, 3.0, 1.5, 3.5];

interface ClefRange {
  bottomStep: number; // Diatonic step of line 1 (bottom) relative to C4 (0)
  topStep: number;    // Diatonic step of line 5 (top)
  middleCStep: number;
}

const CLEF_RANGES: Record<Exclude<StaffClef, 'dynamic'>, ClefRange> = {
  treble: { bottomStep: 2, topStep: 10, middleCStep: 0 },         // E4 to F5
  treble_8va: { bottomStep: 9, topStep: 17, middleCStep: 7 },     // E5 to F6
  treble_8vb: { bottomStep: -5, topStep: 3, middleCStep: -7 },    // E3 to F4
  bass: { bottomStep: -10, topStep: -2, middleCStep: 0 },         // G2 to A3
  bass_8va: { bottomStep: -3, topStep: 5, middleCStep: 7 },       // G3 to A4
  bass_8vb: { bottomStep: -17, topStep: -9, middleCStep: -7 },    // G1 to A2
  alto: { bottomStep: -4, topStep: 4, middleCStep: 0 },           // F3 to G4 (C4 on line 3)
  tenor: { bottomStep: -6, topStep: 2, middleCStep: 0 },          // D3 to E4 (C4 on line 4)
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

export class StaffStreamRenderer {
  // Kinetic animation state for dynamic clef switching
  private activeSingleClef: Exclude<StaffClef, 'dynamic'> = 'treble';
  private targetSingleClef: Exclude<StaffClef, 'dynamic'> = 'treble';
  private clefTransitionProgress: number = 1.0; // 0..1

  // Scratch canvas buffers for Grand Staff stylized clef compositing
  private grandClefCanvas: HTMLCanvasElement | null = null;
  private grandClefCtx: CanvasRenderingContext2D | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;

  // Preallocated scratch buffers for voice leading curves (zero per-frame GC allocations)
  private static scratchPathX = new Float32Array(32);
  private static scratchPathY = new Float32Array(32);

  // Track absorbed note item IDs to trigger particle dissipation effect exactly once at boundary
  private absorbedItemIds = new Set<string>();
  public onNoteAbsorbed?: (x: number, y: number, colorHex: string, noteSize: number) => void;

  private getClefBuffers(width: number, height: number): {
    clefCanvas: HTMLCanvasElement;
    clefCtx: CanvasRenderingContext2D;
    maskCanvas: HTMLCanvasElement;
    maskCtx: CanvasRenderingContext2D;
  } | null {
    if (typeof document === 'undefined') return null;
    if (!this.grandClefCanvas) {
      this.grandClefCanvas = document.createElement('canvas');
      this.grandClefCtx = this.grandClefCanvas.getContext('2d');
      this.maskCanvas = document.createElement('canvas');
      this.maskCtx = this.maskCanvas.getContext('2d');
    }
    if (!this.grandClefCanvas || !this.grandClefCtx || !this.maskCanvas || !this.maskCtx) {
      return null;
    }
    if (this.grandClefCanvas.width < width || this.grandClefCanvas.height < height) {
      this.grandClefCanvas.width = width;
      this.grandClefCanvas.height = height;
      this.maskCanvas.width = width;
      this.maskCanvas.height = height;
    }
    return {
      clefCanvas: this.grandClefCanvas,
      clefCtx: this.grandClefCtx,
      maskCanvas: this.maskCanvas,
      maskCtx: this.maskCtx,
    };
  }

  /**
   * Computes the playhead strike coordinates (x, y) for a given MIDI pitch
   * within a specific cell's bounding box and configuration.
   */
  public getPlayheadCoordinatesForMidi(
    midi: number,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
    config: VisualiserConfig
  ): { x: number; y: number } {
    const isGrand = (config.staffSize || 'grand') === 'grand';
    const geom = this.computeStaffGeometry(cellY, cellHeight, isGrand);
    const staffNote = midiToDiatonicStaffNote(midi);
    const noteY = this.stepToY(staffNote.diatonicStep, geom, isGrand);
    const playheadX = cellX + cellWidth - 24;
    return { x: playheadX, y: noteY };
  }

  public reset(): void {
    this.activeSingleClef = 'treble';
    this.targetSingleClef = 'treble';
    this.clefTransitionProgress = 1.0;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    streamItems: StreamItem[],
    config: VisualiserConfig,
    now: number,
    tonicMarkers: TonicShiftMarker[] = []
  ): void {
    if (width <= 10 || height <= 10) return;

    ctx.save();
    // Clip to cell bounds
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    // Backdrop
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Apply velocity & register filters
    const filteredItems = this.filterItems(streamItems, config);

    // Evaluate dynamic clef
    const staffSize: StaffSize = config.staffSize || 'grand';
    this.updateDynamicClef(filteredItems, config);

    const isGrand = staffSize === 'grand';
    const staffGeometry = this.computeStaffGeometry(y, height, isGrand);

    // Render items: Fixed Queue or Continuous Stream (strictly RTL)
    const streamMode = config.staffStreamMode || config.streamMode || 'continuous';

    // Draw staff lines and clef headers
    this.renderStaffHeaderAndLines(ctx, x, width, staffGeometry, config, isGrand, streamMode);

    if (streamMode === 'fixed') {
      this.renderFixedQueue(
        ctx,
        x,
        y,
        width,
        height,
        filteredItems,
        config,
        now,
        tonicMarkers,
        staffGeometry,
        isGrand
      );
    } else {
      this.renderContinuous(
        ctx,
        x,
        y,
        width,
        height,
        filteredItems,
        config,
        now,
        tonicMarkers,
        staffGeometry,
        isGrand
      );
    }

    ctx.restore();
  }

  private filterItems(items: StreamItem[], config: VisualiserConfig): StreamItem[] {
    const minVel = config.staffMinVelocity ?? config.streamMinVelocity ?? 0.05;
    const filter = config.staffFilterRegister ?? config.streamFilterRegister ?? 'all';

    return items.filter((item) => {
      if (item.velocity < minVel) return false;
      if (filter === 'bass' && item.octave > 3) return false;
      if (filter === 'mid' && (item.octave < 3 || item.octave > 5)) return false;
      if (filter === 'treble' && item.octave < 5) return false;
      return true;
    });
  }

  /**
   * Dynamic clef selection: evaluates the played notes that need to be shown
   * and prioritises placing notes directly on staff lines.
   */
  private updateDynamicClef(items: StreamItem[], config: VisualiserConfig): void {
    const userClef = config.staffClef || 'dynamic';
    if (userClef !== 'dynamic') {
      this.targetSingleClef = userClef as Exclude<StaffClef, 'dynamic'>;
      if (this.activeSingleClef !== this.targetSingleClef) {
        this.activeSingleClef = this.targetSingleClef;
        this.clefTransitionProgress = 1.0;
      }
      return;
    }

    // Determine candidate pool
    const candidates: Array<Exclude<StaffClef, 'dynamic'>> = [
      'treble',
      'bass',
      'treble_8va',
      'treble_8vb',
      'bass_8va',
      'bass_8vb',
    ];

    if (config.includeCClefs && config.staffSize === 'single') {
      candidates.push('alto', 'tenor');
    }

    // Evaluate visible notes (recent 8 or active notes)
    const recent = items.slice(-10);
    if (recent.length === 0) {
      // Default to Treble when idle
      this.targetSingleClef = 'treble';
      return;
    }

    let bestClef = this.activeSingleClef;
    let bestScore = -Infinity;

    for (const clef of candidates) {
      const range = CLEF_RANGES[clef];
      let score = 0;

      for (const item of recent) {
        const staffNote = midiToDiatonicStaffNote(item.midi);
        const step = staffNote.diatonicStep;

        if (step >= range.bottomStep && step <= range.topStep) {
          // Inside 5 lines: strong positive score, highest in center (line 3)
          const mid = (range.bottomStep + range.topStep) / 2;
          const distToCenter = Math.abs(step - mid);
          score += 10 - distToCenter;
        } else {
          // Outside staff (ledger lines): penalty proportional to ledger distance
          const dist = step < range.bottomStep
            ? range.bottomStep - step
            : step - range.topStep;
          score -= dist * 3;
        }
      }

      // Hysteresis bias for currently active clef to prevent jitter
      if (clef === this.activeSingleClef) {
        score += 8;
      }

      if (score > bestScore) {
        bestScore = score;
        bestClef = clef;
      }
    }

    if (bestClef !== this.activeSingleClef) {
      this.targetSingleClef = bestClef;
      this.activeSingleClef = bestClef;
      this.clefTransitionProgress = 0.0;
    }

    // Advance transition progress
    if (this.clefTransitionProgress < 1.0) {
      this.clefTransitionProgress = Math.min(1.0, this.clefTransitionProgress + 0.1);
    }
  }

  private computeStaffGeometry(
    cellY: number,
    cellHeight: number,
    isGrand: boolean
  ): {
    lineSpacing: number;
    topStaffBottomY: number; // Bottom line of top staff (Treble line 1)
    bottomStaffTopY: number; // Top line of bottom staff (Bass line 5)
    middleCY: number;        // Shared Middle C (1st ledger line between them)
    singleStaffLine1Y: number;
  } {
    if (isGrand) {
      // Grand Staff:
      // Top staff 5 lines (4 spaces = 4s)
      // Gap between staves = 2s (with Middle C ledger line at 1s)
      // Bottom staff 5 lines (4 spaces = 4s)
      // Total height = 10s
      const maxSpacing = Math.max(7, Math.min(16, cellHeight / 16));
      const lineSpacing = maxSpacing;
      const centerY = cellY + cellHeight / 2;

      const middleCY = centerY;
      const topStaffBottomY = middleCY - lineSpacing;
      const bottomStaffTopY = middleCY + lineSpacing;

      return {
        lineSpacing,
        topStaffBottomY,
        bottomStaffTopY,
        middleCY,
        singleStaffLine1Y: centerY + 2 * lineSpacing,
      };
    } else {
      // Single Staff: 5 lines (4 spaces = 4s)
      const lineSpacing = Math.max(9, Math.min(22, cellHeight / 8));
      const centerY = cellY + cellHeight / 2;
      const singleStaffLine1Y = centerY + 2 * lineSpacing; // Bottom line 1

      return {
        lineSpacing,
        topStaffBottomY: centerY,
        bottomStaffTopY: centerY,
        middleCY: centerY,
        singleStaffLine1Y,
      };
    }
  }

  /**
   * Converts a diatonic step to pixel Y coordinate on the canvas.
   */
  private stepToY(
    diatonicStep: number,
    geom: ReturnType<StaffStreamRenderer['computeStaffGeometry']>,
    isGrand: boolean
  ): number {
    const s = geom.lineSpacing;
    const halfStep = s * 0.5;

    if (isGrand) {
      // Middle C (diatonicStep = 0) sits at geom.middleCY
      // Higher diatonic step -> moves UP (-Y)
      return geom.middleCY - diatonicStep * halfStep;
    } else {
      // Single staff: position relative to active clef line 1
      const clefRange = CLEF_RANGES[this.activeSingleClef];
      const stepOffsetFromLine1 = diatonicStep - clefRange.bottomStep;
      return geom.singleStaffLine1Y - stepOffsetFromLine1 * halfStep;
    }
  }

  private renderStaffHeaderAndLines(
    ctx: CanvasRenderingContext2D,
    x: number,
    width: number,
    geom: ReturnType<StaffStreamRenderer['computeStaffGeometry']>,
    config: VisualiserConfig,
    isGrand: boolean,
    streamMode: 'fixed' | 'continuous' = 'continuous'
  ): void {
    const s = geom.lineSpacing;
    ctx.save();
    // High-luminosity staff lines for clear score legibility against dark background
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)';
    ctx.lineWidth = 1.2;

    if (isGrand) {
      // 1. Top staff (Treble): 5 lines from topStaffBottomY upwards
      for (let i = 0; i < 5; i++) {
        const ly = geom.topStaffBottomY - i * s;
        ctx.beginPath();
        ctx.moveTo(x + 4, ly);
        ctx.lineTo(x + width - 4, ly);
        ctx.stroke();
      }

      // 2. Bottom staff (Bass): 5 lines from bottomStaffTopY downwards
      for (let i = 0; i < 5; i++) {
        const ly = geom.bottomStaffTopY + i * s;
        ctx.beginPath();
        ctx.moveTo(x + 4, ly);
        ctx.lineTo(x + width - 4, ly);
        ctx.stroke();
      }

      // Grand Staff Left Accolade / Bracket line with increased luminosity
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
      ctx.lineWidth = 2.5;
      const topY = geom.topStaffBottomY - 4 * s;
      const botY = geom.bottomStaffTopY + 4 * s;
      ctx.beginPath();
      ctx.moveTo(x + 12, topY);
      ctx.lineTo(x + 12, botY);
      ctx.stroke();

      // Stylised Grand Clefs: Treble white with black outline,
      // Bass black with white outline, and grey intersection.
      this.renderGrandStaffStylisedClefs(ctx, x + 24, geom, s);

      // Key signature: strictly rendered only in fixed (grid) mode, positioned cleanly to the right of the clef
      const clefRight = x + 24 + Math.round(s * 4.4);
      if (config.showKeySignature && streamMode === 'fixed') {
        this.renderKeySignature(ctx, clefRight + 8, geom, config.tonic, isGrand);
      }
    } else {
      // Single Staff: 5 lines
      for (let i = 0; i < 5; i++) {
        const ly = geom.singleStaffLine1Y - i * s;
        ctx.beginPath();
        ctx.moveTo(x + 4, ly);
        ctx.lineTo(x + width - 4, ly);
        ctx.stroke();
      }

      // Single staff clef on left: Anchor precisely to line
      let anchorY = geom.singleStaffLine1Y - s; // default Treble line 2
      if (this.activeSingleClef.startsWith('treble')) {
        anchorY = geom.singleStaffLine1Y - s; // Line 2 (G4)
      } else if (this.activeSingleClef.startsWith('bass')) {
        anchorY = geom.singleStaffLine1Y - 3 * s; // Line 4 (F3)
      } else if (this.activeSingleClef === 'alto') {
        anchorY = geom.singleStaffLine1Y - 2 * s; // Line 3 (C4)
      } else if (this.activeSingleClef === 'tenor') {
        anchorY = geom.singleStaffLine1Y - 3 * s; // Line 4 (C4)
      }

      this.drawClefSymbol(ctx, this.activeSingleClef, x + 24, anchorY, s);

      // Key signature: strictly rendered only in fixed (grid) mode, positioned cleanly to the right of the clef
      const clefRight = x + 24 + Math.round(s * 4.4);
      if (config.showKeySignature && streamMode === 'fixed') {
        this.renderKeySignature(ctx, clefRight + 8, geom, config.tonic, isGrand);
      }
    }

    ctx.restore();
  }

  /**
   * Stylised Grand Staff Clefs:
   * Due to standard vertical proximity of the staves, Treble and Bass clefs overlap.
   * Treble clef is rendered predominantly white with a black outline.
   * Bass clef is rendered predominantly black with a white outline.
   * Where the two clef glyphs intersect, they render in grey (#94a3b8).
   */
  private renderGrandStaffStylisedClefs(
    ctx: CanvasRenderingContext2D,
    cx: number,
    geom: ReturnType<StaffStreamRenderer['computeStaffGeometry']>,
    s: number
  ): void {
    const trebleY = geom.topStaffBottomY - s;
    const bassY = geom.bottomStaffTopY + s;

    // Buffer bounding box: generous right margin (s * 7.5) so clef is never clipped on the right
    const boxX = Math.floor(cx - s * 1.5);
    const boxY = Math.floor(trebleY - s * 7.5);
    const boxW = Math.ceil(s * 7.5);
    const boxH = Math.ceil(bassY + s * 5 - boxY);

    const buffers = this.getClefBuffers(boxW, boxH);
    if (!buffers) {
      // Headless / non-DOM fallback
      this.drawClefSymbol(ctx, 'bass', cx, bassY, s, '#090d16', '#f8fafc', 1.8);
      this.drawClefSymbol(ctx, 'treble', cx, trebleY, s, '#f8fafc', '#090d16', 1.8);
      return;
    }

    const { clefCanvas, clefCtx, maskCanvas, maskCtx } = buffers;
    clefCtx.clearRect(0, 0, boxW, boxH);
    maskCtx.clearRect(0, 0, boxW, boxH);

    const localCx = cx - boxX;
    const localTrebleY = trebleY - boxY;
    const localBassY = bassY - boxY;

    // 1. Build intersection mask in maskCanvas:
    // Draw Bass clef solid shape
    this.drawClefSymbol(maskCtx, 'bass', localCx, localBassY, s, '#ffffff');
    // Keep only intersection with Treble clef solid shape
    maskCtx.globalCompositeOperation = 'source-in';
    this.drawClefSymbol(maskCtx, 'treble', localCx, localTrebleY, s, '#ffffff');
    // Fill intersection region with grey
    maskCtx.fillStyle = '#94a3b8';
    maskCtx.fillRect(0, 0, boxW, boxH);
    maskCtx.globalCompositeOperation = 'source-over';

    // 2. Render styled clefs into clefCanvas:
    // Bass clef: predominantly black with white outline
    this.drawClefSymbol(clefCtx, 'bass', localCx, localBassY, s, '#090d16', '#f8fafc', 1.8);

    // Treble clef: predominantly white with black outline
    this.drawClefSymbol(clefCtx, 'treble', localCx, localTrebleY, s, '#f8fafc', '#090d16', 1.8);

    // 3. Composite grey intersection on top
    clefCtx.drawImage(maskCanvas, 0, 0);

    // 4. Blit to destination canvas
    ctx.drawImage(clefCanvas, 0, 0, boxW, boxH, boxX, boxY, boxW, boxH);
  }

  private drawClefSymbol(
    ctx: CanvasRenderingContext2D,
    clef: Exclude<StaffClef, 'dynamic'>,
    cx: number,
    anchorY: number,
    s: number,
    fillColor: string = '#f8fafc',
    strokeColor?: string,
    strokeWidth?: number
  ): void {
    ctx.save();
    ctx.fillStyle = fillColor;

    const hasPath2D = typeof Path2D !== 'undefined';

    if (clef.startsWith('treble')) {
      if (hasPath2D) {
        drawSmuflGlyph(ctx, 'gClef', cx, anchorY, s, strokeColor, strokeWidth);
      } else {
        ctx.font = `bold ${Math.round(s * 2.8)}px "Noto Music", "Bravura", "Segoe UI Symbol", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('𝄞', cx, anchorY);
        if (strokeColor && strokeWidth) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.strokeText('𝄞', cx, anchorY);
        }
      }
      if (clef === 'treble_8va') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText('8va', cx, anchorY - s * 3.4);
      } else if (clef === 'treble_8vb') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText('8', cx, anchorY + s * 2.8);
      }
    } else if (clef.startsWith('bass')) {
      if (hasPath2D) {
        drawSmuflGlyph(ctx, 'fClef', cx, anchorY, s, strokeColor, strokeWidth);
      } else {
        ctx.font = `bold ${Math.round(s * 2.2)}px "Noto Music", "Bravura", "Segoe UI Symbol", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('𝄢', cx, anchorY);
        if (strokeColor && strokeWidth) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.strokeText('𝄢', cx, anchorY);
        }
      }
      if (clef === 'bass_8va') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText('8', cx, anchorY - s * 2.2);
      } else if (clef === 'bass_8vb') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText('8vb', cx, anchorY + s * 2.2);
      }
    } else {
      // C-Clef (Alto or Tenor)
      if (hasPath2D) {
        drawSmuflGlyph(ctx, 'cClef', cx, anchorY, s, strokeColor, strokeWidth);
      } else {
        ctx.font = `bold ${Math.round(s * 2.1)}px "Noto Music", "Bravura", "Segoe UI Symbol", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('𝄡', cx, anchorY);
        if (strokeColor && strokeWidth) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.strokeText('𝄡', cx, anchorY);
        }
      }
    }

    ctx.restore();
  }

  private renderKeySignature(
    ctx: CanvasRenderingContext2D,
    startX: number,
    geom: ReturnType<StaffStreamRenderer['computeStaffGeometry']>,
    tonic: number,
    isGrand: boolean
  ): void {
    const keySig = TONIC_TO_KEY_SIGNATURE[tonic] || { sharpsFlats: 0, accidentals: [] };
    if (keySig.sharpsFlats === 0) return;

    ctx.save();
    ctx.fillStyle = '#cbd5e1';

    const isSharps = keySig.sharpsFlats > 0;
    const glyphName = isSharps ? 'accidentalSharp' : 'accidentalFlat';
    const textGlyph = isSharps ? '♯' : '♭';
    const count = Math.abs(keySig.sharpsFlats);
    const spacingX = Math.max(9, geom.lineSpacing * 0.75);
    const keySigSpacing = geom.lineSpacing * 0.68;
    const hasPath2D = typeof Path2D !== 'undefined';
    const scale = keySigSpacing / 250;
    const centerOffsetX = (isSharps ? 180 : 162) * scale;
    const centerOffsetY = (isSharps ? 0 : 25) * scale;

    if (!hasPath2D) {
      ctx.font = `bold ${Math.round(keySigSpacing * 1.5)}px "Noto Music", "Segoe UI Symbol", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    }

    if (isGrand) {
      // Top staff: Treble
      const trebleSteps = isSharps ? TREBLE_KEY_SIG_SHARPS : TREBLE_KEY_SIG_FLATS;
      // Bottom staff: Bass
      const bassSteps = isSharps ? BASS_KEY_SIG_SHARPS : BASS_KEY_SIG_FLATS;

      for (let i = 0; i < Math.min(count, 7); i++) {
        const px = startX + i * spacingX;
        // Treble staff Line 1 is topStaffBottomY
        const trebleY = geom.topStaffBottomY - trebleSteps[i] * geom.lineSpacing;
        if (hasPath2D) {
          drawSmuflGlyph(ctx, glyphName, px - centerOffsetX, trebleY + centerOffsetY, keySigSpacing);
        } else {
          ctx.fillText(textGlyph, px, trebleY);
        }

        // Bass staff Line 1 is bottomStaffTopY + 4 * s
        const bassLine1Y = geom.bottomStaffTopY + 4 * geom.lineSpacing;
        const bassY = bassLine1Y - bassSteps[i] * geom.lineSpacing;
        if (hasPath2D) {
          drawSmuflGlyph(ctx, glyphName, px - centerOffsetX, bassY + centerOffsetY, keySigSpacing);
        } else {
          ctx.fillText(textGlyph, px, bassY);
        }
      }
    } else {
      // Single staff: pick positions based on active single clef
      let steps: readonly number[];
      if (this.activeSingleClef.startsWith('treble')) {
        steps = isSharps ? TREBLE_KEY_SIG_SHARPS : TREBLE_KEY_SIG_FLATS;
      } else if (this.activeSingleClef.startsWith('bass')) {
        steps = isSharps ? BASS_KEY_SIG_SHARPS : BASS_KEY_SIG_FLATS;
      } else if (this.activeSingleClef === 'alto') {
        steps = isSharps ? ALTO_KEY_SIG_SHARPS : ALTO_KEY_SIG_FLATS;
      } else {
        steps = isSharps ? TENOR_KEY_SIG_SHARPS : TENOR_KEY_SIG_FLATS;
      }

      for (let i = 0; i < Math.min(count, 7); i++) {
        const px = startX + i * spacingX;
        const py = geom.singleStaffLine1Y - steps[i] * geom.lineSpacing;
        if (hasPath2D) {
          drawSmuflGlyph(ctx, glyphName, px - centerOffsetX, py + centerOffsetY, keySigSpacing);
        } else {
          ctx.fillText(textGlyph, px, py);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Fixed Queue Mode:
   * Fixed length queue (default 8) arranged into RTL horizontal columns.
   * Fully polyphonic: clusters simultaneous notes into chord onsets per slot.
   */
  private renderFixedQueue(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    items: StreamItem[],
    config: VisualiserConfig,
    now: number,
    tonicMarkers: TonicShiftMarker[],
    geom: ReturnType<StaffStreamRenderer['computeStaffGeometry']>,
    isGrand: boolean
  ): void {
    const queueSize = Math.max(2, config.staffFixedWindowSize || config.fixedWindowSize || 8);
    // Polyphonic fixed queue: cluster incoming items into simultaneous chord onsets
    const chordOnsets = clusterItemsIntoOnsets(items);
    const visibleOnsets = chordOnsets.slice(-queueSize);

    const s = geom.lineSpacing;
    const clefRight = x + 24 + Math.round(s * 4.4);
    const keySigCount = Math.abs(TONIC_TO_KEY_SIGNATURE[config.tonic]?.sharpsFlats || 0);
    const keySigWidth = config.showKeySignature && keySigCount > 0
      ? keySigCount * Math.max(9, s * 0.75) + 12
      : 0;
    const startStaffX = clefRight + 14 + keySigWidth;
    const availableWidth = width - (startStaffX - x) - 20;
    const slotWidth = availableWidth / queueSize;
    const noteSize = Math.min(geom.lineSpacing * 1.45, 24);

    // Kinetic tonic shift wash
    this.renderTonicShiftPulse(ctx, x, y, width, height, tonicMarkers, config, now);

    // Slot separators
    for (let i = 0; i < queueSize; i++) {
      const slotX = startStaffX + i * slotWidth;
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(slotX, y + 4, slotWidth, height - 8);
    }

    // Voice leading nodes per onset
    const onsetNodes: VoiceLeadingNode[][] = [];

    visibleOnsets.forEach((onset, idx) => {
      // RTL: newest onset at the rightmost slot
      const slotIdx = queueSize - visibleOnsets.length + idx;
      const slotCenterX = startStaffX + slotIdx * slotWidth + slotWidth / 2;
      const isNewest = idx === visibleOnsets.length - 1;

      // Highlight slot for newest chord
      if (isNewest) {
        ctx.save();
        ctx.fillStyle = onset.items[onset.items.length - 1]?.colorHex || '#38bdf8';
        ctx.globalAlpha = 0.1;
        ctx.fillRect(startStaffX + slotIdx * slotWidth + 2, y + 6, slotWidth - 4, height - 12);
        ctx.restore();
      }

      // Convert items to diatonic staff notes and calculate coordinates
      const currentNodes: VoiceLeadingNode[] = [];
      const staffNotes = onset.items.map((item) => ({
        item,
        note: midiToDiatonicStaffNote(item.midi, config.accidentalStyle === 'flat'),
      }));

      // Handle notehead collisions for adjacent diatonic steps (seconds in chord)
      for (let ni = 0; ni < staffNotes.length; ni++) {
        const { item, note } = staffNotes[ni];
        const noteY = this.stepToY(note.diatonicStep, geom, isGrand);

        let noteX = slotCenterX;
        if (ni > 0) {
          const prevNote = staffNotes[ni - 1].note;
          if (note.diatonicStep - prevNote.diatonicStep === 1) {
            noteX = slotCenterX + noteSize * 0.82;
          }
        }

        currentNodes.push({
          x: noteX,
          y: noteY,
          item,
          diatonicStep: note.diatonicStep,
        });

        // Draw ledger lines
        this.drawLedgerLines(ctx, noteX, note.diatonicStep, geom, isGrand, noteSize);

        // Draw notehead (consistent Solfège head for played notes in their tonic context)
        const semitoneFromTonic = resolveItemSemitoneFromTonic(item, config.tonic, tonicMarkers);
        const showAccidental = !config.showKeySignature && note.accidental !== 0;
        const isBlackKey = isBlackPianoKey(item.pitchClass);

        renderPptNoteOnCanvas(
          ctx,
          semitoneFromTonic,
          noteX,
          noteY,
          noteSize,
          note.accidental,
          showAccidental,
          false,
          isBlackKey
        );
      }

      onsetNodes.push(currentNodes);
    });

    // 1-to-1 SATB Voice Leading across consecutive chord onsets
    if (config.showVoiceLeadingLines !== false && onsetNodes.length > 1) {
      const allPairs: VoiceLeadingPair[] = [];
      for (let i = 0; i < onsetNodes.length - 1; i++) {
        const pairs = computeSatbVoiceLeading(onsetNodes[i], onsetNodes[i + 1]);
        allPairs.push(...pairs);
      }
      this.drawSatbVoiceLeadingLines(ctx, allPairs, now, config.voiceLeadingUndulation !== false);
    }
  }

  /**
   * Continuous Mode:
   * Smooth horizontal RTL stream with duration ribbons trailing noteheads.
   * Clusters simultaneous notes into chord onsets with SATB voice leading.
   */
  private renderContinuous(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    items: StreamItem[],
    config: VisualiserConfig,
    now: number,
    tonicMarkers: TonicShiftMarker[],
    geom: ReturnType<StaffStreamRenderer['computeStaffGeometry']>,
    isGrand: boolean
  ): void {
    const speed = config.staffScrollSpeed || config.scrollSpeed || 160;
    const nowSec = now / 1000;
    const playheadX = x + width - 40;
    const s = geom.lineSpacing;
    const clefRight = x + 24 + Math.round(s * 4.4);
    // Termination line placed strictly to the right of the clef
    const terminationX = clefRight + 12;
    const noteSize = Math.min(geom.lineSpacing * 1.45, 24);

    // Playhead vertical marker (red origin line on right)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, y + 4);
    ctx.lineTo(playheadX, y + height - 4);
    ctx.stroke();

    // Termination vertical marker on left (luminous sky/cyan optical complement to red playhead)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(terminationX, y + 4);
    ctx.lineTo(terminationX, y + height - 4);
    ctx.stroke();

    // Clip rendering strictly between terminationX and playheadX so elements cleanly disappear at the boundary
    ctx.save();
    ctx.beginPath();
    ctx.rect(terminationX, y, Math.max(0, playheadX - terminationX + 1), height);
    ctx.clip();

    // Cluster items into chord onsets
    const chordOnsets = clusterItemsIntoOnsets(items);
    const onsetNodes: VoiceLeadingNode[][] = [];

    // Render notes for each onset
    for (const onset of chordOnsets) {
      const elapsed = nowSec - onset.timestamp;
      // RTL: notes enter at playhead and scroll left
      const chordX = playheadX - elapsed * speed;

      // Check visibility
      if (chordX + noteSize * 2 < x || chordX - noteSize * 2 > x + width + 50) continue;

      const currentNodes: VoiceLeadingNode[] = [];
      const staffNotes = onset.items.map((item) => ({
        item,
        note: midiToDiatonicStaffNote(item.midi, config.accidentalStyle === 'flat'),
      }));

      for (let ni = 0; ni < staffNotes.length; ni++) {
        const { item, note } = staffNotes[ni];
        const noteY = this.stepToY(note.diatonicStep, geom, isGrand);

        // In continuous mode: notehead position strictly aligns with onset time (no horizontal displacement)
        const noteX = chordX;

        currentNodes.push({
          x: noteX,
          y: noteY,
          item,
          diatonicStep: note.diatonicStep,
        });

        // Draw ledger lines
        this.drawLedgerLines(ctx, noteX, note.diatonicStep, geom, isGrand, noteSize);

        // 1. Note Entrance Animation (at Playhead origin line)
        let entranceScale = 1.0;
        if (config.noteEntranceAnimation !== false && elapsed >= 0 && elapsed < 0.35) {
          const p = elapsed / 0.35;
          entranceScale = 1.0 + Math.sin((1 - p) * Math.PI * 0.5) * 0.42;
          const flashAlpha = Math.max(0, 1 - p);
          if (flashAlpha > 0.05) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(noteX, noteY, noteSize * (1.1 + flashAlpha * 0.75), 0, Math.PI * 2);
            ctx.strokeStyle = item.colorHex;
            ctx.globalAlpha = flashAlpha * 0.8;
            ctx.lineWidth = 2.0;
            ctx.stroke();
            ctx.restore();
          }
        }

        // 2. Termination Boundary Absorption Effect
        let squishX = 1.0;
        let squishY = 1.0;
        const distToTerm = noteX - terminationX;
        if (config.staffAbsorptionEnabled !== false && distToTerm >= -14 && distToTerm <= 30) {
          squishX = Math.max(0.10, Math.min(1.0, (distToTerm + 14) / 44));
          // Area conservation: horizontal flattening induces proportional vertical bulging
          squishY = 1.0 + (1.0 - squishX) * 0.45;
          const absorbNorm = 1.0 - Math.max(0, distToTerm) / 30;

          if (absorbNorm > 0.05) {
            ctx.save();

            // Multi-layer dynamic meniscus contour hugging the vertical termination boundary
            const meniscusH = noteSize * (1.2 + absorbNorm * 1.6);
            const meniscusGrad = ctx.createLinearGradient(terminationX, noteY - meniscusH, terminationX, noteY + meniscusH);
            meniscusGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
            meniscusGrad.addColorStop(0.25, hexToRgba(item.colorHex, 0.7));
            meniscusGrad.addColorStop(0.5, '#FFFFFF');
            meniscusGrad.addColorStop(0.75, hexToRgba(item.colorHex, 0.7));
            meniscusGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

            // Outer radiant meniscus bloom
            ctx.beginPath();
            ctx.ellipse(terminationX, noteY, 4 + absorbNorm * 8, meniscusH, 0, 0, Math.PI * 2);
            ctx.fillStyle = meniscusGrad;
            ctx.globalAlpha = absorbNorm * 0.65;
            ctx.fill();

            // Focused cyan impact crest along termination line
            ctx.beginPath();
            ctx.ellipse(terminationX, noteY, 1.8 + absorbNorm * 3.2, noteSize * (0.6 + absorbNorm * 0.8), 0, 0, Math.PI * 2);
            ctx.fillStyle = '#38BDF8';
            ctx.globalAlpha = absorbNorm * 0.9;
            ctx.fill();

            // Radiant white contact flash pip at impact point
            if (absorbNorm > 0.35) {
              const flashStrength = (absorbNorm - 0.35) / 0.65;
              ctx.beginPath();
              ctx.ellipse(terminationX, noteY, 1.5, noteSize * 0.45 * flashStrength, 0, 0, Math.PI * 2);
              ctx.fillStyle = '#FFFFFF';
              ctx.globalAlpha = flashStrength * 0.95;
              ctx.fill();
            }

            ctx.restore();
          }

          // Trigger particle dissipation splash once as notehead meets barrier
          if (distToTerm <= 4 && !this.absorbedItemIds.has(item.id)) {
            this.absorbedItemIds.add(item.id);
            if (this.absorbedItemIds.size > 800) {
              // Bound memory by pruning oldest IDs
              const iter = this.absorbedItemIds.values();
              for (let prune = 0; prune < 200; prune++) {
                const nextVal = iter.next().value;
                if (nextVal) this.absorbedItemIds.delete(nextVal);
              }
            }
            if (this.onNoteAbsorbed) {
              this.onNoteAbsorbed(terminationX, noteY, item.colorHex, noteSize);
            }
          }
        }

        // Render PPT Notehead: in continuous mode, no accidentals are rendered
        const pc = item.pitchClass ?? (item.midi % 12);
        const semitoneFromTonic = resolveItemSemitoneFromTonic(item, config.tonic, tonicMarkers);
        const isBlackKey = isBlackPianoKey(pc);

        if (squishX < 0.98) {
          ctx.save();
          ctx.translate(noteX, noteY);
          ctx.scale(squishX, squishY);
          ctx.translate(-noteX, -noteY);
        }

        renderPptNoteOnCanvas(
          ctx,
          semitoneFromTonic,
          noteX,
          noteY,
          noteSize * entranceScale,
          0,     // accidental = 0 (suppressed in continuous mode)
          false, // showAccidental = false (suppressed in continuous mode)
          false,
          isBlackKey
        );

        if (squishX < 0.98) {
          ctx.restore();
        }
      }

      if (currentNodes.length > 0) {
        onsetNodes.push(currentNodes);
      }
    }

    // Voice leading lines between consecutive chord onsets
    if (config.showVoiceLeadingLines !== false && onsetNodes.length > 1) {
      const allPairs: VoiceLeadingPair[] = [];
      for (let i = 0; i < onsetNodes.length - 1; i++) {
        const pairs = computeSatbVoiceLeading(onsetNodes[i], onsetNodes[i + 1]);
        allPairs.push(...pairs);
      }
      this.drawSatbVoiceLeadingLines(ctx, allPairs, now, config.voiceLeadingUndulation !== false);
    }

    // Timeline tonic modulation barriers
    if (config.tonicShiftEffectsEnabled !== false && tonicMarkers.length > 0) {
      for (const marker of tonicMarkers) {
        const elapsed = nowSec - marker.timestamp;
        if (elapsed < 0) continue;
        const markerX = playheadX - elapsed * speed;
        if (markerX >= x - 12 && markerX <= x + width + 12) {
          this.renderTonicBarrier(ctx, markerX, y, height, marker);
        }
      }
    }

    ctx.restore(); // Restore clip region
  }

  /**
   * Draws ledger lines for notes sitting outside the 5 staff lines.
   */
  private drawLedgerLines(
    ctx: CanvasRenderingContext2D,
    nx: number,
    diatonicStep: number,
    geom: ReturnType<StaffStreamRenderer['computeStaffGeometry']>,
    isGrand: boolean,
    noteSize: number
  ): void {
    const ledgerWidth = noteSize * 1.5;
    const lx1 = nx - ledgerWidth / 2;
    const lx2 = nx + ledgerWidth / 2;

    ctx.save();
    // High-luminosity ledger lines matching staff lines
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.92)';
    ctx.lineWidth = 1.6;

    if (isGrand) {
      // Middle C (step 0): Shared 1st ledger line between top and bottom staves!
      if (diatonicStep === 0) {
        ctx.beginPath();
        ctx.moveTo(lx1, geom.middleCY);
        ctx.lineTo(lx2, geom.middleCY);
        ctx.stroke();
      } else if (diatonicStep > 10) {
        // Above Top staff (line 5 = step 10 / F5)
        // Ledger lines occur on even diatonic steps: A5(12), C6(14), E6(16)...
        for (let step = 12; step <= diatonicStep; step += 2) {
          const ly = this.stepToY(step, geom, isGrand);
          ctx.beginPath();
          ctx.moveTo(lx1, ly);
          ctx.lineTo(lx2, ly);
          ctx.stroke();
        }
      } else if (diatonicStep < -10) {
        // Below Bottom staff (line 1 = step -10 / G2)
        // Ledger lines occur on even diatonic steps below: E2(-12), C2(-14), A1(-16)...
        for (let step = -12; step >= diatonicStep; step -= 2) {
          const ly = this.stepToY(step, geom, isGrand);
          ctx.beginPath();
          ctx.moveTo(lx1, ly);
          ctx.lineTo(lx2, ly);
          ctx.stroke();
        }
      }
    } else {
      // Single staff: ledger lines relative to active clef bounds
      const range = CLEF_RANGES[this.activeSingleClef];

      if (diatonicStep > range.topStep) {
        for (let step = range.topStep + 2; step <= diatonicStep; step += 2) {
          const ly = this.stepToY(step, geom, isGrand);
          ctx.beginPath();
          ctx.moveTo(lx1, ly);
          ctx.lineTo(lx2, ly);
          ctx.stroke();
        }
      } else if (diatonicStep < range.bottomStep) {
        for (let step = range.bottomStep - 2; step >= diatonicStep; step -= 2) {
          const ly = this.stepToY(step, geom, isGrand);
          ctx.beginPath();
          ctx.moveTo(lx1, ly);
          ctx.lineTo(lx2, ly);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  /**
   * Draws 1-to-1 SATB voice leading lines between consecutive chord onsets
   * with a gradient from origin Solfège colour to destination Solfège colour.
   */
  /**
   * Draws 1-to-1 SATB voice leading lines between consecutive chord onsets
   * with a gradient from origin Solfège colour to destination Solfège colour,
   * organic harmonic undulation, dual-layer glow, and travelling counterpoint energy pulses.
   */
  private drawSatbVoiceLeadingLines(
    ctx: CanvasRenderingContext2D,
    pairs: VoiceLeadingPair[],
    now: number,
    enableUndulation: boolean
  ): void {
    if (pairs.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';

    const nowSec = now / 1000;

    for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
      const pair = pairs[pairIdx];
      const p1 = pair.from;
      const p2 = pair.to;

      // Linear gradient from origin Solfège colour to destination Solfège colour
      const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      grad.addColorStop(0, p1.item.colorHex);
      grad.addColorStop(1, p2.item.colorHex);

      const midX = (p1.x + p2.x) / 2;

      if (!enableUndulation) {
        // Clean static Bézier curve fallback
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.bezierCurveTo(midX, p1.y, midX, p2.y, p2.x, p2.y);

        // Soft glow pass
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = 0.28;
        ctx.stroke();

        // Crisp core pass
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.75;
        ctx.stroke();
        continue;
      }

      // Harmonic standing wave undulation
      // Envelope sin(pi * t) strictly forces offset to 0 at t=0 and t=1
      const steps = 24;
      const waveSeed = (p1.item.pitchClass * 7 + p2.item.pitchClass * 13 + pairIdx * 5) % 100;

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const oneMinusT = 1 - t;

        // Base horizontal S-curve Bézier evaluation
        const bx =
          oneMinusT * oneMinusT * oneMinusT * p1.x +
          3 * oneMinusT * oneMinusT * t * midX +
          3 * oneMinusT * t * t * midX +
          t * t * t * p2.x;

        const by =
          oneMinusT * oneMinusT * oneMinusT * p1.y +
          3 * oneMinusT * oneMinusT * t * p1.y +
          3 * oneMinusT * t * t * p2.y +
          t * t * t * p2.y;

        // Standing harmonic wave undulation
        const env = Math.sin(Math.PI * t);
        const wave1 = Math.sin(t * Math.PI * 2 + nowSec * 4.2 + waveSeed) * 4.5;
        const wave2 = Math.sin(t * Math.PI * 4 - nowSec * 5.8 + waveSeed * 0.5) * 2.0;
        const undulationY = env * (wave1 + wave2);

        StaffStreamRenderer.scratchPathX[s] = bx;
        StaffStreamRenderer.scratchPathY[s] = by + undulationY;
      }

      // 1. Ambient outer glow pass
      ctx.beginPath();
      ctx.moveTo(StaffStreamRenderer.scratchPathX[0], StaffStreamRenderer.scratchPathY[0]);
      for (let i = 1; i <= steps; i++) {
        ctx.lineTo(StaffStreamRenderer.scratchPathX[i], StaffStreamRenderer.scratchPathY[i]);
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4.2;
      ctx.globalAlpha = 0.32;
      ctx.stroke();

      // 2. Focused core pass
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.85;
      ctx.stroke();

      // 3. Travelling counterpoint energy pulse bead
      const pulseSpeed = 1.25;
      const pulseT = ((nowSec * pulseSpeed + waveSeed * 0.08) % 1.0 + 1.0) % 1.0;
      const sampleIdx = Math.min(Math.floor(pulseT * steps), steps - 1);
      const frac = pulseT * steps - sampleIdx;
      const ptAx = StaffStreamRenderer.scratchPathX[sampleIdx];
      const ptAy = StaffStreamRenderer.scratchPathY[sampleIdx];
      const ptBx = StaffStreamRenderer.scratchPathX[sampleIdx + 1];
      const ptBy = StaffStreamRenderer.scratchPathY[sampleIdx + 1];
      const pulseX = ptAx + (ptBx - ptAx) * frac;
      const pulseY = ptAy + (ptBy - ptAy) * frac;

      // Pulse bead glow: concentric dual-disc eliminates CPU Gaussian shadowBlur filter
      ctx.save();
      // Outer ambient halo
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = p2.item.colorHex;
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 5.0, 0, Math.PI * 2);
      ctx.fill();

      // Crisp specular white core
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private renderTonicShiftPulse(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    tonicMarkers: TonicShiftMarker[],
    config: VisualiserConfig,
    now: number
  ): void {
    if (config.tonicShiftEffectsEnabled === false || tonicMarkers.length === 0) return;

    const nowSec = now / 1000;
    const recent = tonicMarkers.find((m) => nowSec - m.timestamp >= 0 && nowSec - m.timestamp < 1.4);
    if (!recent) return;

    const pulseT = (nowSec - recent.timestamp) / 1.4;
    const pulseAlpha = Math.max(0, 1 - pulseT) * 0.25;

    ctx.save();
    ctx.fillStyle = '#E13610';
    ctx.globalAlpha = pulseAlpha;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  private renderTonicBarrier(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bh: number,
    marker: TonicShiftMarker
  ): void {
    const oldPitch = PITCH_NAMES_DUAL[marker.oldTonic] ?? 'C';
    const newPitch = PITCH_NAMES_DUAL[marker.newTonic] ?? 'C';
    const label = marker.isAuto ? `AUTO: ${newPitch}` : `${oldPitch} ➔ ${newPitch}`;

    ctx.save();
    // Barrier line
    ctx.strokeStyle = '#E13610';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by + bh);
    ctx.stroke();

    // Badge
    const badgeW = marker.isAuto ? 72 : 90;
    const badgeH = 18;
    const badgeX = bx - badgeW / 2;
    const badgeY = by + bh / 2 - badgeH / 2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 9);
    ctx.fill();

    ctx.strokeStyle = marker.isAuto ? '#10B981' : '#E13610';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, badgeX + badgeW / 2, badgeY + badgeH / 2);

    ctx.restore();
  }
}
