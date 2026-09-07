import { PptNoteheadShape, getPptNoteheadSpec } from '../core/ppt-constants';
import { drawSmuflGlyph, getSmuflPath } from './smufl-glyphs';

/**
 * Renders a custom PPT geometric notehead on a 2D Canvas context.
 * The shape and colour are strictly defined by Solfège relative to the active tonic.
 *
 * PPT Notehead Taxonomy:
 * - Circle: Do (Tonic 0, Red #E13610)
 * - Diamond: Ra (Minor 2nd 1, Orange #F98016), Te (Minor 7th 10, Magenta #F158A4)
 * - Square: Re (Major 2nd 2, Orange #F98016), Ti (Major 7th 11, Magenta #F158A4)
 * - Triangle Down: Me (Minor 3rd 3, Yellow #F5D432), Le (Minor 6th 8, Purple #5300A4)
 * - Triangle Up: Mi (Major 3rd 4, Yellow #F5D432), La (Major 6th 9, Purple #5300A4)
 * - Semicircle Left: Fa (Perfect 4th 5, Green #43A440)
 * - Cross (X): Fi (Tritone 6, Charcoal #141414 with obsidian boundary/luminous fill)
 * - Semicircle Right: So (Perfect 5th 7, Blue #0032A4)
 */
export function drawPptNotehead(
  ctx: CanvasRenderingContext2D,
  shape: PptNoteheadShape,
  cx: number,
  cy: number,
  size: number,
  colorHex: string,
  outlineColor: string = '#0b0d13',
  isHighContrast: boolean = false,
  outlineWidth: number = 2.0,
  hasCenterDot: boolean = false
): void {
  const isFi = colorHex === '#141414' || colorHex.toLowerCase() === '#141414';
  const radius = size * 0.5;

  ctx.save();
  ctx.translate(cx, cy);

  ctx.beginPath();
  buildNoteheadPath(ctx, shape, radius);

  if (isFi) {
    if (isHighContrast) {
      // High-contrast Fi: platinum white fill with bold obsidian border
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(2.5, outlineWidth * 1.5);
      ctx.stroke();
    } else if (outlineColor === '#ffffff' || outlineColor === '#f8fafc') {
      // White piano key Fi: charcoal fill with crisp white outline
      ctx.fillStyle = '#141414';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2.2, outlineWidth);
      ctx.stroke();
    } else if (outlineColor === '#090d16' || outlineColor === '#0b0d13' || outlineColor === '#000000') {
      // Black piano key Fi: charcoal fill with obsidian black outline
      ctx.fillStyle = '#141414';
      ctx.fill();
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = Math.max(2.2, outlineWidth);
      ctx.stroke();
    } else {
      // Canonical Fi: Charcoal/obsidian with sleek slate boundary
      ctx.fillStyle = '#141414';
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.max(2.0, outlineWidth * 1.2);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = colorHex;
    ctx.fill();

    if (outlineWidth > 0) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = isHighContrast ? Math.max(2.5, outlineWidth * 1.5) : outlineWidth;
      ctx.stroke();
    }
  }

  // Draw Cross inner detail for Fi if shape is cross
  if (shape === 'cross') {
    drawFiCrossLines(ctx, radius, isFi && isHighContrast ? '#0f172a' : (isFi ? '#f8fafc' : '#ffffff'));
  }

  // Draw black center dot for black piano keys to clearly distinguish them
  if (hasCenterDot) {
    const dotRadius = Math.max(2.0, radius * 0.28);
    ctx.beginPath();
    ctx.arc(0, 0, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#090d16';
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Builds the geometric path for each of the 8 canonical PPT notehead shapes.
 * Units are normalized to radius = 1.0 (multiplied by r).
 */
function buildNoteheadPath(ctx: CanvasRenderingContext2D, shape: PptNoteheadShape, r: number): void {
  switch (shape) {
    case 'circle': {
      // Do (Circle of radius r)
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      break;
    }

    case 'diamond': {
      // Ra, Te (Diamond / Rhombus)
      // Width slightly wider than height matching standard music notation notehead proportions
      const hw = r * 1.15;
      const hh = r * 0.95;
      ctx.moveTo(-hw, 0);
      ctx.lineTo(0, -hh);
      ctx.lineTo(hw, 0);
      ctx.lineTo(0, hh);
      ctx.closePath();
      break;
    }

    case 'square': {
      // Re, Ti (Square / Rectangle)
      const w = r * 1.7;
      const h = r * 1.5;
      ctx.rect(-w / 2, -h / 2, w, h);
      break;
    }

    case 'triangle-down': {
      // Me, Le (Triangle pointing Down)
      const hw = r * 1.1;
      const topY = -r * 0.85;
      const bottomY = r * 1.05;
      ctx.moveTo(-hw, topY);
      ctx.lineTo(hw, topY);
      ctx.lineTo(0, bottomY);
      ctx.closePath();
      break;
    }

    case 'triangle-up': {
      // Mi, La (Triangle pointing Up)
      const hw = r * 1.1;
      const bottomY = r * 0.85;
      const topY = -r * 1.05;
      ctx.moveTo(-hw, bottomY);
      ctx.lineTo(hw, bottomY);
      ctx.lineTo(0, topY);
      ctx.closePath();
      break;
    }

    case 'semicircle-left': {
      // Fa (Semicircle Left: flat right spine, round bulb to the left with increased horizontal width)
      const hw = r * 0.8;
      const hh = r * 0.95;
      ctx.moveTo(hw, -hh);
      ctx.lineTo(hw, hh);
      // Cubic Bezier curve around the left bulb
      ctx.bezierCurveTo(hw - 2 * hw * 0.5523, hh, -hw, hh * 0.5523, -hw, 0);
      ctx.bezierCurveTo(-hw, -hh * 0.5523, hw - 2 * hw * 0.5523, -hh, hw, -hh);
      ctx.closePath();
      break;
    }

    case 'semicircle-right': {
      // So (Semicircle Right: flat left spine, round bulb to the right with increased horizontal width)
      const hw = r * 0.8;
      const hh = r * 0.95;
      ctx.moveTo(-hw, hh);
      ctx.lineTo(-hw, -hh);
      // Cubic Bezier curve around the right bulb
      ctx.bezierCurveTo(-hw + 2 * hw * 0.5523, -hh, hw, -hh * 0.5523, hw, 0);
      ctx.bezierCurveTo(hw, hh * 0.5523, -hw + 2 * hw * 0.5523, hh, -hw, hh);
      ctx.closePath();
      break;
    }

    case 'cross': {
      // Fi (Thick diagonal cross)
      const arm = r * 0.9;
      const t = r * 0.35; // arm half-thickness
      // 12-vertex octagon-cross polygon
      ctx.moveTo(-arm, -arm + t);
      ctx.lineTo(-arm + t, -arm);
      ctx.lineTo(0, -t);
      ctx.lineTo(arm - t, -arm);
      ctx.lineTo(arm, -arm + t);
      ctx.lineTo(t, 0);
      ctx.lineTo(arm, arm - t);
      ctx.lineTo(arm - t, arm);
      ctx.lineTo(0, t);
      ctx.lineTo(-arm + t, arm);
      ctx.lineTo(-arm, arm - t);
      ctx.lineTo(-t, 0);
      ctx.closePath();
      break;
    }
  }
}

/**
 * Draws internal high-contrast crossing strokes on Fi.
 */
function drawFiCrossLines(ctx: CanvasRenderingContext2D, r: number, strokeColor: string): void {
  const arm = r * 0.55;
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-arm, -arm);
  ctx.lineTo(arm, arm);
  ctx.moveTo(-arm, arm);
  ctx.lineTo(arm, -arm);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws an accidental symbol (sharp ♯, flat ♭, natural ♮) centered at (cx, cy).
 * Scaled canonically to standard music engraving proportions (~2.5 staff spaces height).
 */
export function drawAccidental(
  ctx: CanvasRenderingContext2D,
  accidental: -1 | 0 | 1,
  cx: number,
  cy: number,
  staffSpace: number,
  color: string = '#f8fafc'
): void {
  if (accidental === 0) return;

  ctx.save();
  ctx.fillStyle = color;
  const glyphName = accidental === 1 ? 'accidentalSharp' : 'accidentalFlat';
  const path = getSmuflPath(glyphName);

  // Scaled accidental size: 0.65 of staff space gives canonical traditional score height (~2.6s)
  const scaleSpacing = staffSpace * 0.65;

  if (path) {
    const scale = scaleSpacing / 250;
    // SMuFL Bravura glyph width centers: Sharp is ~180 font units wide center, Flat is ~162 font units wide center
    const centerOffsetX = (accidental === 1 ? 180 : 162) * scale;
    // Anchor center Y: SMuFL sharp center is at Y=0, flat bulb center is around Y=25
    const centerOffsetY = (accidental === 1 ? 0 : 25) * scale;
    drawSmuflGlyph(ctx, glyphName, cx - centerOffsetX, cy + centerOffsetY, scaleSpacing);
  } else {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(scaleSpacing * 1.5)}px "Noto Music", "Bravura", "Segoe UI Symbol", sans-serif`;
    ctx.fillText(accidental === 1 ? '♯' : '♭', cx, cy - 1);
  }
  ctx.restore();
}

/**
 * Renders a complete PPT note onset with notehead, optional accidental, and high-contrast outline.
 * The outline color indicates whether the underlying piano key is white or black:
 * - White outline for white piano keys (C, D, E, F, G, A, B).
 * - Black outline for black piano keys (C#, D#, F#, G#, A#).
 */
export function renderPptNoteOnCanvas(
  ctx: CanvasRenderingContext2D,
  semitoneFromTonic: number,
  cx: number,
  cy: number,
  size: number,
  accidental: -1 | 0 | 1 = 0,
  showAccidental: boolean = false,
  isHighContrast: boolean = false,
  isBlackKey?: boolean
): void {
  const spec = getPptNoteheadSpec(semitoneFromTonic);

  // Derive piano key outline colour
  let outlineColor = '#0b0d13';
  if (isBlackKey === true) {
    outlineColor = '#090d16';
  } else if (isBlackKey === false) {
    outlineColor = '#ffffff';
  } else if (isHighContrast) {
    outlineColor = '#ffffff';
  }

  // Render notehead with black dot in center for black piano keys
  drawPptNotehead(
    ctx,
    spec.shape,
    cx,
    cy,
    size,
    spec.colorHex,
    outlineColor,
    isHighContrast && isBlackKey === undefined,
    2.2,
    isBlackKey === true
  );

  // Render accidental if required, with strict kerning margin preventing any overlap
  if (showAccidental && accidental !== 0) {
    const r = size * 0.5;
    const noteHalfWidth = r * 1.18; // covers widest diamond notehead tip
    const staffSpace = size * 0.70;
    const accHalfWidth = (staffSpace * 0.65) * 0.48;
    const kerningGap = Math.max(5, size * 0.22);
    const accX = cx - noteHalfWidth - kerningGap - accHalfWidth;

    drawAccidental(ctx, accidental, accX, cy, staffSpace, isHighContrast ? '#ffffff' : '#cbd5e1');
  }
}


