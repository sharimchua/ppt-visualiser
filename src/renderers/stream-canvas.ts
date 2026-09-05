import { StreamItem, VisualiserConfig, PianoTriangleType, PianoTrianglePoint } from '../core/types';
import { drawUniformSolfegeOnCanvas, drawPianoTriangleOnCanvas } from './glyph-renderer';
import { TRI_PITCH_CLASSES } from '../core/ppt-constants';

export class StreamRenderer {
  // Single-window rotation animation state
  private currentRotation: number = 0;
  private targetRotation: number = 0;
  private currentScale: number = 1.0;
  private lastNoteId: string = '';

  public render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    streamItems: StreamItem[],
    config: VisualiserConfig,
    now: number
  ) {
    if (width <= 10 || height <= 10) return;

    ctx.save();
    // Clip to stream viewport boundary
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    // Stream container background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Apply Filters
    const filteredItems = this.filterStreamItems(streamItems, config);

    if (config.streamMode === 'fixed') {
      if (config.fixedWindowSize === 1) {
        this.renderSingleWindowShowcase(ctx, x, y, width, height, filteredItems, config);
      } else {
        this.renderFixedQueue(ctx, x, y, width, height, filteredItems, config);
      }
    } else {
      this.renderContinuousStream(ctx, x, y, width, height, filteredItems, config, now);
    }

    ctx.restore();
  }

  private filterStreamItems(items: StreamItem[], config: VisualiserConfig): StreamItem[] {
    return items.filter(item => {
      // Velocity gate
      if (item.velocity < config.streamMinVelocity) return false;

      // Register filter
      if (config.streamFilterRegister === 'bass' && item.octave > 3) return false;
      if (config.streamFilterRegister === 'mid' && (item.octave < 3 || item.octave > 5)) return false;
      if (config.streamFilterRegister === 'treble' && item.octave < 5) return false;

      return true;
    });
  }

  /**
   * Special Single-Window Mode (N=1):
   * Continuously rotates and morphs the Uniform Solfège glyph or Piano Triangle between note representations!
   */
  private renderSingleWindowShowcase(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    items: StreamItem[],
    config: VisualiserConfig
  ) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const latestItem = items[items.length - 1];

    if (!latestItem) {
      // Idle prompt
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '13px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Play notes to activate 1-Window Glyph Rotation', cx, cy);
      return;
    }

    // When a new note arrives, set target rotation with shortest circular path
    if (latestItem.id !== this.lastNoteId) {
      this.lastNoteId = latestItem.id;
      const targetDeg = latestItem.rotation;
      let diff = (targetDeg - (this.currentRotation % 360) + 540) % 360 - 180;
      this.targetRotation = this.currentRotation + diff;
      this.currentScale = 1.35; // Pulse bounce on note onset
    }

    // Spring interpolation for kinetic rotation & scale
    this.currentRotation += (this.targetRotation - this.currentRotation) * 0.18;
    this.currentScale += (1.0 - this.currentScale) * 0.15;

    const size = Math.min(width, height) * 0.62 * this.currentScale;
    const isFi = latestItem.colorHex === '#141414';
    const auraColor = isFi ? '#f8fafc' : latestItem.colorHex;

    // Glowing aura behind showcase glyph
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = auraColor;
    ctx.globalAlpha = isFi ? 0.28 : 0.18;
    ctx.shadowColor = auraColor;
    ctx.shadowBlur = 25 * config.glowBloom;
    ctx.fill();
    ctx.restore();

    // Render showcase presentation
    if (config.presentationFormat === 'pianoTriangles') {
      drawPianoTriangleOnCanvas(
        ctx,
        latestItem.pianoTriangle.triangle as PianoTriangleType,
        latestItem.pianoTriangle.point as PianoTrianglePoint,
        cx,
        cy,
        size,
        isFi ? '#f8fafc' : latestItem.colorHex,
        'rgba(255, 255, 255, 0.85)',
        'rgba(148, 163, 184, 0.4)'
      );
    } else if (config.presentationFormat === 'syllables') {
      ctx.save();
      ctx.fillStyle = isFi ? '#f8fafc' : latestItem.colorHex;
      ctx.font = `bold ${Math.round(size * 0.55)}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 15;
      ctx.fillText(latestItem.solfege, cx, cy);
      ctx.restore();
    } else if (config.presentationFormat === 'pitchNames') {
      ctx.save();
      ctx.fillStyle = isFi ? '#f8fafc' : latestItem.colorHex;
      ctx.font = `bold ${Math.round(size * 0.55)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 15;
      ctx.fillText(`${latestItem.pitchName}${latestItem.octave}`, cx, cy);
      ctx.restore();
    } else if (config.presentationFormat === 'triPitches') {
      ctx.save();
      ctx.fillStyle = isFi ? '#f8fafc' : latestItem.colorHex;
      ctx.font = `bold ${Math.round(size * 0.52)}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 15;
      const triName = latestItem.triPitchName || TRI_PITCH_CLASSES[latestItem.pitchClass];
      ctx.fillText(`${triName}${latestItem.octave}`, cx, cy);
      ctx.restore();
    } else {
      // Default: Uniform Solfège with smooth animated rotation!
      drawUniformSolfegeOnCanvas(
        ctx,
        latestItem.glyphType,
        this.currentRotation,
        cx,
        cy,
        size,
        latestItem.colorHex,
        undefined,
        isFi ? 3.5 : 2.5,
        config.glyphContrastMode === 'high'
      );
    }

    // Label HUD below glyph
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${latestItem.solfege} (${latestItem.pitchName}${latestItem.octave}) • Vel ${Math.round(latestItem.velocity * 127)}`, cx, y + height - 14);
  }

  /**
   * Fixed Queue Mode:
   * Fixed length queue (e.g. 8 notes) moving along horizontal conveyor.
   */
  private renderFixedQueue(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    items: StreamItem[],
    config: VisualiserConfig
  ) {
    const queueSize = Math.max(2, config.fixedWindowSize);
    // Take the most recent items up to queueSize
    const visibleItems = items.slice(-queueSize);

    const slotWidth = width / queueSize;
    const itemSize = Math.min(slotWidth * 0.72, height * 0.58);
    const cy = y + height / 2;

    // Slot separators & conveyor track
    for (let i = 0; i < queueSize; i++) {
      const slotX = x + i * slotWidth;
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(slotX, y + 4, slotWidth, height - 8);
    }

    // Render items in queue from oldest (left) to newest (right)
    visibleItems.forEach((item, idx) => {
      // Slot index from right to left
      const slotIdx = queueSize - visibleItems.length + idx;
      const slotCenterX = x + slotIdx * slotWidth + slotWidth / 2;
      const isNewest = idx === visibleItems.length - 1;

      // Glow on slot
      if (isNewest) {
        ctx.save();
        ctx.fillStyle = item.colorHex;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(x + slotIdx * slotWidth + 2, y + 6, slotWidth - 4, height - 12);
        ctx.restore();
      }

      this.renderItemCard(ctx, slotCenterX, cy, itemSize, item, config, isNewest);
    });
  }

  /**
   * Continuous Scrolling Mode:
   * Real-time passage of time, notes move horizontally right to left smoothly.
   */
  private renderContinuousStream(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    items: StreamItem[],
    config: VisualiserConfig,
    now: number
  ) {
    const speed = config.scrollSpeed; // px per second
    const nowSec = now / 1000;
    const cy = y + height / 2;
    const itemSize = Math.min(60, height * 0.55);

    // Current playhead line at right edge
    const playheadX = x + width - 30;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, y);
    ctx.lineTo(playheadX, y + height);
    ctx.stroke();

    // Iterate through items and position based on elapsed time
    for (const item of items) {
      const elapsed = nowSec - item.timestamp;
      const itemX = playheadX - elapsed * speed;

      // Skip if scrolled past left edge
      if (itemX + itemSize < x) continue;
      // Skip if in future beyond right edge
      if (itemX - itemSize > x + width) continue;

      // Note duration ribbon (if duration is present)
      if (item.duration && item.duration > 0.05) {
        const ribbonWidth = item.duration * speed;
        const ribbonX = itemX;
        ctx.save();
        ctx.fillStyle = item.colorHex;
        ctx.globalAlpha = 0.35 * item.velocity;
        ctx.beginPath();
        ctx.roundRect(ribbonX, cy - itemSize * 0.25, ribbonWidth, itemSize * 0.5, 4);
        ctx.fill();
        ctx.restore();
      }

      this.renderItemCard(ctx, itemX, cy, itemSize, item, config, false);
    }
  }

  private renderItemCard(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    item: StreamItem,
    config: VisualiserConfig,
    isHighlighted: boolean
  ) {
    ctx.save();

    const isFi = item.colorHex === '#141414';

    // Circle backdrop
    ctx.beginPath();
    ctx.arc(cx, cy - 6, size * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = isFi ? '#0f172a' : item.colorHex;
    ctx.globalAlpha = isHighlighted ? 0.4 : (isFi ? 0.75 : 0.22);
    ctx.fill();

    ctx.strokeStyle = isHighlighted ? '#ffffff' : (isFi ? '#f8fafc' : item.colorHex);
    ctx.lineWidth = isHighlighted ? 2.2 : (isFi ? 2.0 : 1.4);
    if (isFi) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 4;
    }
    ctx.stroke();

    // Presentation format
    if (config.presentationFormat === 'pianoTriangles') {
      drawPianoTriangleOnCanvas(
        ctx,
        item.pianoTriangle.triangle as PianoTriangleType,
        item.pianoTriangle.point as PianoTrianglePoint,
        cx,
        cy - 6,
        size * 0.75,
        isFi ? '#f8fafc' : item.colorHex,
        isHighlighted ? 'rgba(255, 255, 255, 0.95)' : (isFi ? '#f8fafc' : 'rgba(255, 255, 255, 0.85)'),
        'rgba(148, 163, 184, 0.4)'
      );
    } else if (config.presentationFormat === 'syllables') {
      ctx.fillStyle = isFi ? '#f8fafc' : '#ffffff';
      ctx.font = `bold ${Math.round(size * 0.38)}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.solfege, cx, cy - 6);
    } else if (config.presentationFormat === 'pitchNames') {
      ctx.fillStyle = isFi ? '#f8fafc' : '#ffffff';
      ctx.font = `bold ${Math.round(size * 0.34)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${item.pitchName}${item.octave}`, cx, cy - 6);
    } else if (config.presentationFormat === 'triPitches') {
      ctx.fillStyle = isFi ? '#f8fafc' : '#ffffff';
      ctx.font = `bold ${Math.round(size * 0.34)}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const triName = item.triPitchName || TRI_PITCH_CLASSES[item.pitchClass];
      ctx.fillText(`${triName}${item.octave}`, cx, cy - 6);
    } else {
      // Default: Uniform Solfège Vector Glyph
      drawUniformSolfegeOnCanvas(
        ctx,
        item.glyphType,
        item.rotation,
        cx,
        cy - 6,
        size * 0.65,
        isFi ? '#141414' : item.colorHex,
        undefined,
        isFi ? 3.0 : 2.0,
        config.glyphContrastMode === 'high'
      );
    }

    // Syllable / Note sub-label
    ctx.fillStyle = isHighlighted ? '#ffffff' : (isFi ? '#f8fafc' : 'rgba(203, 213, 225, 0.85)');
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${item.solfege} • ${item.pitchName}${item.octave}`, cx, cy + size * 0.44);

    ctx.restore();
  }
}
