import {
  PATH_BASE,
  PATH_SHARP,
  PATH_FLAT,
  TRIANGLE_VERTEX_COORDINATES
} from '../core/ppt-constants';
import { GlyphType, GlyphRotation, PianoTriangleType, PianoTrianglePoint } from '../core/types';

// Pre-constructed Path2D objects for ultra-fast canvas drawing
let path2dBase: Path2D | null = null;
let path2dSharp: Path2D | null = null;
let path2dFlat: Path2D | null = null;

function getPath2D(type: GlyphType): Path2D {
  if (typeof Path2D === 'undefined') {
    return {} as Path2D;
  }
  if (!path2dBase) {
    path2dBase = new Path2D(PATH_BASE);
    path2dSharp = new Path2D(PATH_SHARP);
    path2dFlat = new Path2D(PATH_FLAT);
  }
  if (type === 'sharp') return path2dSharp!;
  if (type === 'flat') return path2dFlat!;
  return path2dBase!;
}

/**
 * Draws a Uniform Solfège glyph on a 2D Canvas context at (cx, cy) with size and rotation.
 * Features high-contrast outlining and special platinum/silver styling for Fi (Obsidian Tritone).
 */
export function drawUniformSolfegeOnCanvas(
  ctx: CanvasRenderingContext2D,
  glyphType: GlyphType,
  rotationDeg: number,
  cx: number,
  cy: number,
  size: number,
  colorHex: string,
  strokeColor?: string,
  strokeWidth: number = 3,
  isHighContrast: boolean = true
) {
  ctx.save();
  ctx.translate(cx, cy);
  // Apply rotation
  ctx.rotate((rotationDeg * Math.PI) / 180);
  // Scale down from the 240x240 SVG viewBox to canvas size. Also invert Y as the SVG path is flipped
  const scale = size / 240;
  ctx.scale(scale, -scale);

  const path = getPath2D(glyphType);
  const isFi = colorHex === '#141414' || colorHex.toLowerCase() === '#141414';

  if (isFi) {
    // Fi (Obsidian / Tritone Boundary):
    if (isHighContrast) {
      // High-Contrast mode: Luminous platinum-white fill with crisp obsidian border
      ctx.fillStyle = '#f8fafc';
      ctx.fill(path);

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(4, strokeWidth * 1.6) / scale;
      ctx.stroke(path);
    } else {
      // Canonical Solfège mode: Mysterious deep obsidian with sleek boundary
      ctx.fillStyle = '#141414';
      ctx.fill(path);

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = Math.max(2.5, strokeWidth) / scale;
      ctx.stroke(path);
    }
  } else {
    // Other Solfege degrees
    ctx.fillStyle = colorHex;
    ctx.fill(path);

    if (isHighContrast) {
      // High-Contrast mode: Brilliant crisp white/platinum outline to ensure 100% legibility without CPU blur tax
      ctx.strokeStyle = strokeColor && strokeColor !== '#050811' && strokeColor !== '#0b0d13' ? strokeColor : '#ffffff';
      ctx.lineWidth = Math.max(4, strokeWidth * 1.6) / scale;
      ctx.stroke(path);
    } else if (strokeWidth > 0) {
      // Canonical Solfège mode: Sleek dark contour
      ctx.strokeStyle = strokeColor ?? '#0b0d13';
      ctx.lineWidth = strokeWidth / scale;
      ctx.stroke(path);
    }
  }

  ctx.restore();
}

/**
 * Generates an SVG string for a Uniform Solfège glyph with high-contrast Fi support.
 */
export function createUniformSolfegeSvg(
  glyphType: GlyphType,
  rotationDeg: GlyphRotation,
  size: number,
  colorHex: string,
  strokeColor?: string,
  strokeWidth: number = 4
): string {
  let pathD = PATH_BASE;
  if (glyphType === 'sharp') pathD = PATH_SHARP;
  else if (glyphType === 'flat') pathD = PATH_FLAT;

  const isFi = colorHex === '#141414' || colorHex.toLowerCase() === '#141414';
  const fillColor = isFi ? '#1e293b' : colorHex;
  const stroke = isFi ? '#f8fafc' : (strokeColor ?? '#0b0d13');
  const sw = isFi ? strokeWidth * 1.5 : strokeWidth;

  return `
    <svg viewBox="-120 -120 240 240" width="${size}" height="${size}" style="display:inline-block; vertical-align:middle; transform: rotate(${rotationDeg}deg); overflow:visible;">
      <path d="${pathD}" fill="${fillColor}" stroke="${stroke}" stroke-width="${sw}" transform="scale(1, -1)" />
    </svg>
  `;
}

/**
 * Draws Piano Triangle Notation on a 2D Canvas context at (cx, cy).
 * Highlights the active vertex in its solfege color with solid fill,
 * while drawing the remaining two vertices ghosted.
 */
export function drawPianoTriangleOnCanvas(
  ctx: CanvasRenderingContext2D,
  triangle: PianoTriangleType,
  activePoint: PianoTrianglePoint,
  cx: number,
  cy: number,
  size: number,
  activeColor: string,
  triangleStroke: string = 'rgba(203, 213, 225, 0.4)',
  ghostStroke: string = 'rgba(148, 163, 184, 0.3)'
) {
  const geom = TRIANGLE_VERTEX_COORDINATES[triangle];
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  const scale = size / 100;
  ctx.scale(scale, scale);

  // 1. Draw Triangle Silhouette
  const p1 = geom.points[1];
  const p2 = geom.points[2];
  const p3 = geom.points[3];

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();

  ctx.strokeStyle = triangleStroke;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 2. Draw the 3 vertices
  for (const pt of [1, 2, 3] as PianoTrianglePoint[]) {
    const ptCoords = geom.points[pt];
    const isActive = pt === activePoint;
    const radius = isActive ? 8.5 : 5.5;

    ctx.beginPath();
    ctx.arc(ptCoords.x, ptCoords.y, radius, 0, Math.PI * 2);

    if (isActive) {
      // Glowing active vertex
      ctx.fillStyle = activeColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else {
      // Ghosted vertex
      ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
      ctx.fill();
      ctx.strokeStyle = ghostStroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Generates an SVG string for Piano Triangle Notation with an active vertex.
 */
export function createPianoTriangleSvg(
  triangle: PianoTriangleType,
  activePoint: PianoTrianglePoint,
  size: number,
  activeColor: string,
  triangleStroke: string = 'rgba(203, 213, 225, 0.5)',
  darkMode: boolean = true
): string {
  const geom = TRIANGLE_VERTEX_COORDINATES[triangle];

  const circles = ([1, 2, 3] as PianoTrianglePoint[]).map(pt => {
    const coords = geom.points[pt];
    const isActive = pt === activePoint;
    const r = isActive ? 9 : 6;
    const fill = isActive ? activeColor : (darkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.8)');
    const stroke = isActive ? '#ffffff' : (darkMode ? 'rgba(148, 163, 184, 0.4)' : 'rgba(100, 116, 139, 0.4)');
    const sw = isActive ? 2 : 1;

    return `<circle cx="${coords.x}" cy="${coords.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`;
  }).join('\n');

  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" style="display:inline-block; vertical-align:middle; overflow:visible;">
      <path d="${geom.path}" fill="none" stroke="${triangleStroke}" stroke-width="3" stroke-linejoin="round" />
      ${circles}
    </svg>
  `;
}
