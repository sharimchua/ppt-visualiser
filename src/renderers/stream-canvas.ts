import { StreamItem, TonicShiftMarker, VisualiserConfig, PianoTriangleType, PianoTrianglePoint } from '../core/types';
import { drawUniformSolfegeOnCanvas, drawPianoTriangleOnCanvas } from './glyph-renderer';
import { TRI_PITCH_CLASSES, PITCH_NAMES_DUAL } from '../core/ppt-constants';

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
    now: number,
    tonicMarkers: TonicShiftMarker[] = []
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
        this.renderFixedQueue(ctx, x, y, width, height, filteredItems, config, now, tonicMarkers);
      }
    } else {
      this.renderContinuousStream(ctx, x, y, width, height, filteredItems, config, now, tonicMarkers);
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
      this.currentScale = 1.35; // Pop burst animation
    }

    // Smooth lerp rotation and scale bounce
    this.currentRotation += (this.targetRotation - this.currentRotation) * 0.18;
    this.currentScale += (1.0 - this.currentScale) * 0.15;

    const size = Math.min(width * 0.55, height * 0.65, 140) * this.currentScale;
    const auraColor = latestItem.colorHex === '#141414' ? 'rgba(255, 255, 255, 0.35)' : latestItem.colorHex;

    // Glowing energy backdrop ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = auraColor;
    ctx.globalAlpha = 0.14;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = auraColor;
    ctx.globalAlpha = 0.45;
    ctx.stroke();
    ctx.restore();

    const isFi = latestItem.colorHex === '#141414';

    // Presentation format rendering
    if (config.presentationFormat === 'pianoTriangles') {
      drawPianoTriangleOnCanvas(
        ctx,
        latestItem.pianoTriangle.triangle as PianoTriangleType,
        latestItem.pianoTriangle.point as PianoTrianglePoint,
        cx,
        cy,
        size * 0.85,
        isFi ? '#f8fafc' : latestItem.colorHex,
        isFi ? '#f8fafc' : '#ffffff',
        'rgba(148, 163, 184, 0.4)'
      );
    } else if (config.presentationFormat === 'syllables') {
      ctx.save();
      ctx.fillStyle = isFi ? '#f8fafc' : latestItem.colorHex;
      ctx.font = `bold ${Math.round(size * 0.52)}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 15;
      ctx.fillText(latestItem.solfege, cx, cy);
      ctx.restore();
    } else if (config.presentationFormat === 'pitchNames') {
      ctx.save();
      ctx.fillStyle = isFi ? '#f8fafc' : latestItem.colorHex;
      ctx.font = `bold ${Math.round(size * 0.48)}px "JetBrains Mono", monospace`;
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
        size * 0.75,
        latestItem.colorHex,
        undefined,
        isFi ? 3.5 : 2.5,
        false
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
   * Fixed length queue moving along horizontal or vertical conveyor.
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
    tonicMarkers: TonicShiftMarker[] = []
  ) {
    const queueSize = Math.max(2, config.fixedWindowSize);
    const visibleItems = items.slice(-queueSize);
    const isVertical = config.orientation === 'vertical';
    const direction = config.direction || (isVertical ? 'ttb' : 'rtl');

    // Kinetic wash across fixed conveyor if a recent tonic shift occurred
    const nowSec = now / 1000;
    const recentMarker = (config.tonicShiftEffectsEnabled !== false)
      ? tonicMarkers.find(m => nowSec - m.timestamp >= 0 && nowSec - m.timestamp < 1.4)
      : null;

    if (recentMarker) {
      const pulseT = (nowSec - recentMarker.timestamp) / 1.4;
      const pulseAlpha = Math.max(0, 1 - pulseT) * 0.28;
      ctx.save();
      ctx.fillStyle = '#E13610';
      ctx.globalAlpha = pulseAlpha;
      ctx.fillRect(x, y, width, height);
      ctx.restore();
    }

    if (isVertical) {
      // Vertical conveyor
      const slotHeight = height / queueSize;
      const itemSize = Math.min(width * 0.72, slotHeight * 0.65, 80);
      const cx = x + width / 2;

      // Slot dividers
      for (let i = 0; i < queueSize; i++) {
        const slotY = y + i * slotHeight;
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 4, slotY, width - 8, slotHeight);
      }

      visibleItems.forEach((item, idx) => {
        // Position depends on direction:
        // 'ttb': newest note at top (slot 0) or waterfall down
        // If 'ttb', newest is at slot 0:
        const slotIdx = direction === 'ttb'
          ? (visibleItems.length - 1 - idx)
          : (queueSize - visibleItems.length + idx);

        const slotCenterY = y + slotIdx * slotHeight + slotHeight / 2;
        const isNewest = idx === visibleItems.length - 1;

        if (isNewest) {
          ctx.save();
          ctx.fillStyle = item.colorHex;
          ctx.globalAlpha = 0.12;
          ctx.fillRect(x + 6, y + slotIdx * slotHeight + 2, width - 12, slotHeight - 4);
          ctx.restore();
        }

        this.renderItemCard(ctx, cx, slotCenterY, itemSize, item, config, isNewest);
      });
    } else {
      // Horizontal conveyor
      const slotWidth = width / queueSize;
      const itemSize = Math.min(slotWidth * 0.72, height * 0.58, 80);
      const cy = y + height / 2;

      for (let i = 0; i < queueSize; i++) {
        const slotX = x + i * slotWidth;
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(slotX, y + 4, slotWidth, height - 8);
      }

      visibleItems.forEach((item, idx) => {
        // 'rtl': newest note at right (slot queueSize - 1)
        // 'ltr': newest note at left (slot 0)
        const slotIdx = direction === 'ltr'
          ? (visibleItems.length - 1 - idx)
          : (queueSize - visibleItems.length + idx);

        const slotCenterX = x + slotIdx * slotWidth + slotWidth / 2;
        const isNewest = idx === visibleItems.length - 1;

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
  }

  /**
   * Continuous Scrolling Mode:
   * Real-time passage of time. Supports 4 directions:
   * - Horizontal RTL: notes enter right, scroll left (standard piano roll / tape)
   * - Horizontal LTR: notes enter left, scroll right
   * - Vertical TTB: notes enter top, waterfall downwards
   * - Vertical BTT: notes enter bottom, float upwards
   */
  private renderContinuousStream(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    items: StreamItem[],
    config: VisualiserConfig,
    now: number,
    tonicMarkers: TonicShiftMarker[] = []
  ) {
    const speed = config.scrollSpeed; // px per second
    const nowSec = now / 1000;
    const isVertical = config.orientation === 'vertical';
    const direction = config.direction || (isVertical ? 'ttb' : 'rtl');

    if (isVertical) {
      const itemSize = Math.min(60, width * 0.55);
      const cx = x + width / 2;
      const isTTB = direction === 'ttb'; // Waterfall: playhead at top, notes scroll down
      const playheadY = isTTB ? (y + 30) : (y + height - 30);

      // Playhead line
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, playheadY);
      ctx.lineTo(x + width, playheadY);
      ctx.stroke();

      // Render notes
      for (const item of items) {
        const elapsed = nowSec - item.timestamp;
        const itemY = isTTB
          ? playheadY + elapsed * speed
          : playheadY - elapsed * speed;

        if (itemY + itemSize < y || itemY - itemSize > y + height) continue;

        // Note duration ribbon
        if (item.duration && item.duration > 0.05) {
          const ribbonHeight = item.duration * speed;
          const ribbonY = isTTB ? (itemY - ribbonHeight) : itemY;
          ctx.save();
          ctx.fillStyle = item.colorHex;
          ctx.globalAlpha = 0.35 * item.velocity;
          ctx.beginPath();
          ctx.roundRect(cx - itemSize * 0.25, ribbonY, itemSize * 0.5, ribbonHeight, 4);
          ctx.fill();
          ctx.restore();
        }

        this.renderItemCard(ctx, cx, itemY, itemSize, item, config, false);
      }

      // Render kinetic tonic modulation barriers along timeline
      if (config.tonicShiftEffectsEnabled !== false && tonicMarkers.length > 0) {
        for (const marker of tonicMarkers) {
          const elapsed = nowSec - marker.timestamp;
          if (elapsed < 0) continue;
          const markerY = isTTB
            ? playheadY + elapsed * speed
            : playheadY - elapsed * speed;

          if (markerY >= y - 12 && markerY <= y + height + 12) {
            this.renderStreamTonicBarrier(ctx, x, markerY, width, 0, marker, config, true);
          }
        }
      }
    } else {
      // Horizontal
      const itemSize = Math.min(60, height * 0.55);
      const cy = y + height / 2;
      const isLTR = direction === 'ltr';
      const playheadX = isLTR ? (x + 30) : (x + width - 30);

      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, y);
      ctx.lineTo(playheadX, y + height);
      ctx.stroke();

      // Render notes
      for (const item of items) {
        const elapsed = nowSec - item.timestamp;
        const itemX = isLTR
          ? playheadX + elapsed * speed
          : playheadX - elapsed * speed;

        if (itemX + itemSize < x || itemX - itemSize > x + width) continue;

        // Note duration ribbon
        if (item.duration && item.duration > 0.05) {
          const ribbonWidth = item.duration * speed;
          const ribbonX = isLTR ? (itemX - ribbonWidth) : itemX;
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

      // Render kinetic tonic modulation barriers along timeline
      if (config.tonicShiftEffectsEnabled !== false && tonicMarkers.length > 0) {
        for (const marker of tonicMarkers) {
          const elapsed = nowSec - marker.timestamp;
          if (elapsed < 0) continue;
          const markerX = isLTR
            ? playheadX + elapsed * speed
            : playheadX - elapsed * speed;

          if (markerX >= x - 12 && markerX <= x + width + 12) {
            this.renderStreamTonicBarrier(ctx, markerX, y, 0, height, marker, config, false);
          }
        }
      }
    }
  }

  /**
   * Renders a kinetic modulation laser barrier stamped into the note stream timeline.
   */
  private renderStreamTonicBarrier(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    marker: TonicShiftMarker,
    config: VisualiserConfig,
    isVertical: boolean
  ): void {
    const oldPitch = PITCH_NAMES_DUAL[marker.oldTonic] ?? 'C';
    const newPitch = PITCH_NAMES_DUAL[marker.newTonic] ?? 'C';
    const label = marker.isAuto ? `AUTO: ${newPitch}` : `${oldPitch} ➔ ${newPitch}`;

    ctx.save();

    // Laser barrier outer glow
    ctx.strokeStyle = '#E13610';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#E13610';
    ctx.shadowBlur = 10 * (config.glowBloom ?? 0.8);

    ctx.beginPath();
    if (isVertical) {
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bw, by);
    } else {
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, by + bh);
    }
    ctx.stroke();

    // Laser barrier bright inner wire
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Center pill badge
    const badgeW = marker.isAuto ? 72 : 92;
    const badgeH = 18;
    const badgeX = isVertical ? bx + bw / 2 - badgeW / 2 : bx - badgeW / 2;
    const badgeY = isVertical ? by - badgeH / 2 : by + bh / 2 - badgeH / 2;

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
        false
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
