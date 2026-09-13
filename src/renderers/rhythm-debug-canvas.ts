import {
  RhythmEngine,
  RhythmAlignmentResult,
  PrimeFamily,
  StreamMetreState,
  RhythmStroke,
} from '../core/rhythm-engine';
import { VisualiserConfig } from '../core/types';

/**
 * Prime Family visual colour palette (English AU spelling: colour).
 */
const PRIME_FAMILY_COLOURS: Record<PrimeFamily, string> = {
  du: '#38bdf8',    // Sky blue
  tri: '#f59e0b',   // Amber
  dutri: '#10b981', // Emerald
  qui: '#8b5cf6',   // Violet
  sep: '#f43f5e',   // Crimson
  unknown: '#94a3b8',
};

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function formatMidiNote(midi: number): string {
  const rounded = Math.round(midi);
  const pc = ((rounded % 12) + 12) % 12;
  const oct = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[pc]}${oct}`;
}

/**
 * High-performance Canvas 2D telemetry visualiser for rhythm engine diagnostics.
 * Displays real-time auditory stream segregation, candidate metre probabilities,
 * cycle sweeping phase, recent strokes, and polyrhythmic convergence.
 */
export class RhythmDebugRenderer {
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    rhythmEngine: RhythmEngine,
    config: VisualiserConfig,
    _timeSec: number,
    passedAlignment?: RhythmAlignmentResult
  ): void {
    const timeMs = _timeSec > 0 ? _timeSec * 1000 : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const alignment = passedAlignment ?? rhythmEngine.update(timeMs, config);

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Deep studio backdrop
    ctx.fillStyle = '#070a13';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid guide
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 1. Render Top Header HUD
    const headerHeight = 44;
    this.renderHeader(ctx, width, headerHeight, rhythmEngine, alignment, config);

    // 2. Render Main Body (Stream telemetry or awaiting input)
    const contentY = headerHeight + 8;
    const contentHeight = height - contentY - 24;

    const streams = alignment.streams;
    if (!streams || streams.length === 0) {
      this.renderAwaitingState(ctx, width, contentY, contentHeight);
    } else {
      this.renderStreamDashboard(
        ctx,
        width,
        contentY,
        contentHeight,
        streams,
        rhythmEngine,
        alignment
      );
    }

    // 3. Render Bottom Status Strip
    this.renderFooter(ctx, width, height - 20, 20);

    ctx.restore();
  }

  private renderHeader(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    _rhythmEngine: RhythmEngine,
    alignment: RhythmAlignmentResult,
    config: VisualiserConfig
  ): void {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();

    let curX = 14;

    // Title Badge
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(curX + 4, height / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('RHYTHM ENGINE TELEMETRY', curX + 14, height / 2 + 4);
    curX += 200;

    // BPM & Auto-tempo status
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('TEMPO:', curX, height / 2 + 4);
    curX += 46;

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(`${alignment.currentBpm} BPM`, curX, height / 2 + 4);
    curX += 65;

    const autoOn = config.rhythmAutoTempoEnabled !== false;
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = autoOn ? '#10b981' : '#f59e0b';
    ctx.fillText(autoOn ? '[AUTO]' : '[MANUAL]', curX, height / 2 + 4);
    curX += 65;

    // Tuner drift needle
    ctx.fillStyle = '#64748b';
    ctx.fillText('TUNER:', curX, height / 2 + 4);
    curX += 45;

    const needleWidth = 50;
    const needleHeight = 8;
    const needleY = height / 2 - needleHeight / 2;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(curX, needleY, needleWidth, needleHeight);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(curX, needleY, needleWidth, needleHeight);

    // Centre tick
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(curX + needleWidth / 2, needleY - 1);
    ctx.lineTo(curX + needleWidth / 2, needleY + needleHeight + 1);
    ctx.stroke();

    // Deflected needle
    const defX = curX + needleWidth / 2 + (alignment.tunerOffset * needleWidth) / 2;
    ctx.strokeStyle = Math.abs(alignment.tunerOffset) > 0.4 ? '#f43f5e' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(defX, needleY);
    ctx.lineTo(defX, needleY + needleHeight);
    ctx.stroke();
    ctx.lineWidth = 1;
    curX += needleWidth + 20;

    // Polyrhythmic Convergence Status
    if (alignment.streams.length >= 2) {
      const distinctSlots = Array.from(new Set(alignment.streams.map((s) => s.slots)));
      if (distinctSlots.length > 1) {
        ctx.fillStyle = alignment.convergenceOccurred ? '#fef08a' : '#c084fc';
        ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
        const polyText = `${distinctSlots[0]}:${distinctSlots[1]} POLYRHYTHM`;
        ctx.fillText(polyText, curX, height / 2 + 4);
        curX += ctx.measureText(polyText).width + 12;

        if (alignment.convergenceOccurred) {
          ctx.fillStyle = '#fef08a';
          ctx.fillText('★ SAM (CONVERGED)', curX, height / 2 + 4);
        }
      }
    }
  }

  private renderAwaitingState(
    ctx: CanvasRenderingContext2D,
    width: number,
    startY: number,
    height: number
  ): void {
    const centerY = startY + height / 2;

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('AWAITING RHYTHMIC MIDI INPUT', width / 2, centerY - 18);

    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(
      'Play notes across different registers (e.g. Bass vs Treble) to inspect live stream segregation,',
      width / 2,
      centerY + 8
    );
    ctx.fillText(
      'PPT prime-family metric probabilities (Du, Tri, DuTri, Qui, Sep), and cycle quantisation.',
      width / 2,
      centerY + 28
    );
    ctx.textAlign = 'left';
  }

  private renderStreamDashboard(
    ctx: CanvasRenderingContext2D,
    width: number,
    startY: number,
    height: number,
    streams: StreamMetreState[],
    rhythmEngine: RhythmEngine,
    alignment: RhythmAlignmentResult
  ): void {
    const streamCount = streams.length;
    const isHorizontalLayout = width >= 580;
    const padding = 10;

    const availableWidth = width - padding * 2;
    const colWidth = isHorizontalLayout
      ? Math.floor((availableWidth - (streamCount - 1) * 10) / streamCount)
      : availableWidth;
    const cardHeight = isHorizontalLayout
      ? height
      : Math.floor((height - (streamCount - 1) * 10) / streamCount);

    streams.forEach((stream, idx) => {
      const colX = isHorizontalLayout
        ? padding + idx * (colWidth + 10)
        : padding;
      const colY = isHorizontalLayout
        ? startY
        : startY + idx * (cardHeight + 10);

      this.renderStreamCard(
        ctx,
        colX,
        colY,
        colWidth,
        cardHeight,
        stream,
        rhythmEngine,
        alignment
      );
    });
  }

  private renderStreamCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    stream: StreamMetreState,
    _rhythmEngine: RhythmEngine,
    alignment: RhythmAlignmentResult
  ): void {
    const familyColour = PRIME_FAMILY_COLOURS[stream.family] || '#38bdf8';

    // Card background & outline
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = stream.downbeatOccurred
      ? '#fef08a'
      : stream.isPulseActive
      ? familyColour
      : 'rgba(51, 65, 85, 0.6)';
    ctx.lineWidth = stream.downbeatOccurred ? 2 : 1;
    ctx.strokeRect(x, y, width, height);
    ctx.lineWidth = 1;

    let curY = y + 18;

    // Header: Stream ID, Track, Centroid Pitch
    ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = familyColour;
    ctx.fillText(`STREAM ${stream.streamId}`, x + 10, curY);

    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`TRACK ${stream.trackIndex}`, x + 85, curY);

    const pitchLabel = `${formatMidiNote(stream.centroidMidi)} (${stream.centroidMidi.toFixed(1)})`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`CENTROID: ${pitchLabel}`, x + 155, curY);

    curY += 20;

    // Detected Metre Banner
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.fillRect(x + 10, curY, width - 20, 24);
    ctx.strokeStyle = familyColour;
    ctx.strokeRect(x + 10, curY, width - 20, 24);

    ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = familyColour;
    ctx.fillText(`${stream.family.toUpperCase()} ${stream.slots}/${stream.cycleBeats * (stream.slots >= 6 && stream.family === 'dutri' ? 8 : 4)}`, x + 18, curY + 16);

    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#94a3b8';
    let bannerText = `PERIOD: ${stream.cyclePeriod.toFixed(2)}s | CONF: ${Math.round(stream.confidence * 100)}%`;
    if (stream.crossStreamAnchor) {
      bannerText += ` | REF: STR ${stream.crossStreamAnchor.streamId} (${stream.crossStreamAnchor.ratio})`;
    }
    ctx.fillText(bannerText, x + 120, curY + 16);

    curY += 34;

    // Live Cycle Sweeper Strip
    this.renderCycleSweeperStrip(ctx, x + 10, curY, width - 20, 26, stream);
    curY += 38;

    // Candidate Metres Probability Ranking
    const availableEvalHeight = Math.max(80, (height - (curY - y) - 90));
    this.renderCandidateProbabilities(ctx, x + 10, curY, width - 20, availableEvalHeight, stream);
    curY += availableEvalHeight + 10;

    // Recent Strokes Log
    if (curY < y + height - 30) {
      this.renderRecentStrokesLog(ctx, x + 10, curY, width - 20, y + height - curY - 10, stream, alignment);
    }
  }

  private renderCycleSweeperStrip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    stream: StreamMetreState
  ): void {
    const familyColour = PRIME_FAMILY_COLOURS[stream.family] || '#38bdf8';

    ctx.fillStyle = '#0b1329';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.strokeRect(x, y, width, height);

    // Render slot spoke ticks
    const slots = stream.slots;
    for (let i = 0; i < slots; i++) {
      const slotX = x + (i / slots) * width;
      const isDownbeat = i === 0;

      ctx.strokeStyle = isDownbeat ? '#fbbf24' : 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = isDownbeat ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(slotX, y);
      ctx.lineTo(slotX, y + height);
      ctx.stroke();
      ctx.lineWidth = 1;

      // Slot index text
      if (width > 200 && slots <= 16) {
        ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
        ctx.fillStyle = isDownbeat ? '#fbbf24' : '#64748b';
        ctx.fillText(`${i}`, slotX + 3, y + 10);
      }
    }

    // Render recent stroke positions on the strip
    if (stream.strokes) {
      for (const stroke of stream.strokes) {
        const slot = stroke.nearestPosition % slots;
        const hitX = x + (slot / slots) * width + width / (slots * 2);
        ctx.fillStyle = familyColour;
        ctx.beginPath();
        ctx.arc(hitX, y + height / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Sweeping Hand Playhead Cursor
    const playheadX = x + stream.pulsePhase * width;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, y - 2);
    ctx.lineTo(playheadX, y + height + 2);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Small glowing pip at the head
    ctx.fillStyle = familyColour;
    ctx.beginPath();
    ctx.arc(playheadX, y + height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderCandidateProbabilities(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    maxHeight: number,
    stream: StreamMetreState
  ): void {
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('METRE CANDIDATE PROBABILITIES (PPT PRIME FAMILIES)', x, y + 10);

    const evaluations = stream.candidateEvaluations ?? [];
    if (evaluations.length === 0) {
      ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Accumulating window strokes...', x, y + 28);
      return;
    }

    const rowHeight = 16;
    const maxRows = Math.min(6, Math.floor((maxHeight - 16) / rowHeight));
    const topEvals = evaluations.slice(0, maxRows);

    topEvals.forEach((item, idx) => {
      const rowY = y + 18 + idx * rowHeight;
      const isWinner = item.slots === stream.slots && item.family === stream.family;
      const col = PRIME_FAMILY_COLOURS[item.family] || '#38bdf8';

      // Label: e.g. "4/4 (Du)"
      ctx.font = isWinner
        ? 'bold 10px ui-monospace, SFMono-Regular, monospace'
        : '10px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = isWinner ? '#f8fafc' : '#94a3b8';
      const label = `${item.slots}/${item.cycleBeats * (item.slots >= 6 && item.family === 'dutri' ? 8 : 4)} ${item.family.toUpperCase()}`;
      ctx.fillText(label, x, rowY + 11);

      // Horizontal Probability Bar
      const barX = x + 85;
      const barWidth = Math.max(40, width - 180);
      const barHeight = 8;
      const fillWidth = Math.max(2, item.normalizedProbability * barWidth);

      ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
      ctx.fillRect(barX, rowY + 3, barWidth, barHeight);

      ctx.fillStyle = col;
      ctx.fillRect(barX, rowY + 3, fillWidth, barHeight);

      if (isWinner) {
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(barX, rowY + 3, barWidth, barHeight);
      }

      // Percentage & Score Readout
      ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = isWinner ? col : '#cbd5e1';
      const pct = Math.round(item.normalizedProbability * 100);
      ctx.fillText(`${pct}%`, barX + barWidth + 8, rowY + 10);
      ctx.fillStyle = item.polyrhythmResonance ? '#f59e0b' : '#64748b';
      const scoreLabel = item.polyrhythmResonance
        ? `(fit: ${item.score.toFixed(2)}) ⚡RES`
        : `(fit: ${item.score.toFixed(2)})`;
      ctx.fillText(scoreLabel, barX + barWidth + 36, rowY + 10);
    });
  }

  private renderRecentStrokesLog(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    _width: number,
    maxHeight: number,
    stream: StreamMetreState,
    _alignment: RhythmAlignmentResult
  ): void {
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('RECENT STROKES IN ACTIVE WINDOW', x, y + 10);

    const strokes: readonly RhythmStroke[] = stream.strokes ?? [];
    if (strokes.length === 0) {
      ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('No active strokes recorded', x, y + 26);
      return;
    }

    const rowHeight = 14;
    const maxRows = Math.min(4, Math.floor((maxHeight - 16) / rowHeight));
    const recent = strokes.slice(-maxRows).reverse();

    recent.forEach((stroke, idx) => {
      const rowY = y + 16 + idx * rowHeight;
      const isDownbeat = (stroke.nearestPosition % stream.slots) === 0;

      // Note pitches in stroke
      const notesSummary = stroke.notes.map((n) => formatMidiNote(n.midi)).join(', ');
      const avgVel = stroke.notes.reduce((s, n) => s + n.velocity, 0) / stroke.notes.length;

      ctx.font = isDownbeat
        ? 'bold 9px ui-monospace, SFMono-Regular, monospace'
        : '9px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = isDownbeat ? '#fbbf24' : '#cbd5e1';
      ctx.fillText(`Slot ${stroke.nearestPosition % stream.slots}${isDownbeat ? ' [Do]' : ''}`, x, rowY + 10);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText(notesSummary, x + 75, rowY + 10);

      // Velocity indicator
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`vel: ${(avgVel * 100).toFixed(0)}%`, x + 150, rowY + 10);
    });
  }

  private renderFooter(
    ctx: CanvasRenderingContext2D,
    width: number,
    y: number,
    height: number
  ): void {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(0, y, width, height);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(
      'AUDITORY STREAM SEGREGATION: 14-Semitone Capture Radius | EMA Centroid Alpha: 0.30 | Polyrhythmic Convergence Window: 90ms',
      12,
      y + 14
    );
  }
}
