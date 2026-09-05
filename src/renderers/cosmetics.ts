import { ActiveNote, BackgroundTheme, VisualiserConfig } from '../core/types';
import { getClockAngleRad, resolveMidiToRegisterAndSemitone } from '../core/ppt-constants';

export interface KineticParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number; // Downward or upward acceleration
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  life: number;
  maxLife: number;
}

export interface ShockwaveRing {
  x: number;
  y: number;
  currentRadius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  decayRate: number;
  lineWidth: number;
}

export interface PhosphorGhost {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  decayRate: number;
  vx: number;
}

export class CosmeticsEngine {
  private static readonly GRAIN_PATTERNS_COUNT = 6;
  private static readonly GRAIN_PATTERN_SIZE = 160;

  private grainCanvases: HTMLCanvasElement[] = [];
  private grainPatterns: CanvasPattern[] = [];
  private currentPatternIndex: number = 0;
  private grainFrame: number = 0;
  private grainJitterX: number = 0;
  private grainJitterY: number = 0;

  private particles: KineticParticle[] = [];
  private shockwaves: ShockwaveRing[] = [];
  private ghosts: PhosphorGhost[] = [];
  private scanlinePatternMap: Map<number, CanvasPattern | null> = new Map();

  constructor() {
    this.initGrain();
  }

  /**
   * Retrieves or builds a cached repeating 1px line CanvasPattern for the given step.
   * Collapses multi-hundred fillRect loops into 1 single GPU draw call.
   */
  private getScanlinePattern(ctx: CanvasRenderingContext2D, step: number): CanvasPattern | null {
    if (this.scanlinePatternMap.has(step)) {
      return this.scanlinePatternMap.get(step) ?? null;
    }

    if (typeof document !== 'undefined' && document.createElement) {
      try {
        const offscreen = document.createElement('canvas');
        offscreen.width = 4;
        offscreen.height = step;
        const offCtx = offscreen.getContext('2d');
        if (offCtx) {
          offCtx.fillStyle = '#000000';
          offCtx.fillRect(0, 0, 4, 1);
          const pattern = ctx.createPattern(offscreen, 'repeat');
          if (pattern) {
            this.scanlinePatternMap.set(step, pattern);
            return pattern;
          }
        }
      } catch {
        // Fall back to direct drawing if offscreen canvas pattern fails
      }
    }
    this.scanlinePatternMap.set(step, null);
    return null;
  }

  /**
   * Pre-renders 6 small noise texture frames once at startup.
   * This yields 100% zero-allocation, zero-CPU-overhead animated grain per frame.
   */
  private initGrain() {
    if (typeof document === 'undefined') return;
    const size = CosmeticsEngine.GRAIN_PATTERN_SIZE;

    for (let p = 0; p < CosmeticsEngine.GRAIN_PATTERNS_COUNT; p++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const imgData = ctx.createImageData(size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Monochromatic organic noise distribution
        const v = (Math.random() * 255) | 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        // Varied alpha distribution for organic emulsion clumping
        data[i + 3] = (Math.random() * 45 + 12) | 0;
      }
      ctx.putImageData(imgData, 0, 0);
      this.grainCanvases.push(canvas);
    }
  }

  /**
   * Spawns a burst of kinetic particles radiating from (cx, cy).
   * Fully supports user physics controls:
   * - sizeMultiplier: scales spark radii
   * - volumeMultiplier: scales emission quantity
   * - gravity: vertical acceleration per frame (buoyancy vs gravity)
   * - originDistance: distance offset from tone circle center
   * - radialAngle: tone radial direction (if offset distance is applied)
   */
  public spawnNoteSparks(
    cx: number,
    cy: number,
    color: string,
    velocity: number,
    baseCount: number = 18,
    sizeMultiplier: number = 1.0,
    volumeMultiplier: number = 1.0,
    gravity: number = 0.15,
    originDistance: number = 0,
    radialAngle: number = 0
  ) {
    const totalCount = Math.max(2, Math.round(baseCount * volumeMultiplier * (0.6 + velocity * 0.8)));

    // Origin position offset along radial angle or ring
    const originX = originDistance > 0 ? cx + originDistance * Math.cos(radialAngle) : cx;
    const originY = originDistance > 0 ? cy + originDistance * Math.sin(radialAngle) : cy;

    for (let i = 0; i < totalCount; i++) {
      // Directional bias: outward explosion with random fan
      const angle = originDistance > 0
        ? radialAngle + (Math.random() - 0.5) * Math.PI * 1.4
        : Math.random() * Math.PI * 2;

      const speed = (Math.random() * 3.5 + 1.2) * (0.7 + velocity * 0.8);
      const life = Math.random() * 45 + 25; // frames
      const radius = (Math.random() * 2.5 + 1.0) * sizeMultiplier;

      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity,
        radius,
        color,
        alpha: 1.0,
        decay: 1.0 / life,
        life: 0,
        maxLife: life,
      });
    }
  }

  /**
   * Spawns an expanding kinetic shockwave ring
   */
  public spawnShockwave(cx: number, cy: number, color: string, maxRadius: number = 75) {
    this.shockwaves.push({
      x: cx,
      y: cy,
      currentRadius: 8,
      maxRadius,
      color,
      alpha: 0.85,
      decayRate: 0.025,
      lineWidth: 2.5,
    });
  }

  /**
   * Updates all active particles and shockwaves
   */
  public update() {
    this.grainFrame++;
    // Animated at authentic ~24-30fps film cadence (updates every 2 frames at 60Hz)
    if (this.grainFrame % 2 === 0) {
      this.currentPatternIndex = (this.currentPatternIndex + 1) % CosmeticsEngine.GRAIN_PATTERNS_COUNT;
      this.grainJitterX = (Math.random() * CosmeticsEngine.GRAIN_PATTERN_SIZE) | 0;
      this.grainJitterY = (Math.random() * CosmeticsEngine.GRAIN_PATTERN_SIZE) | 0;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity; // Apply particle gravity or upward buoyancy
      p.vx *= 0.94; // air friction
      p.vy *= 0.94;
      p.life++;
      p.alpha = Math.max(0, 1 - (p.life / p.maxLife));
      if (p.alpha <= 0 || p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.currentRadius += (sw.maxRadius - sw.currentRadius) * 0.12 + 1.5;
      sw.alpha -= sw.decayRate;
      sw.lineWidth = Math.max(0.5, sw.lineWidth * 0.96);
      if (sw.alpha <= 0 || sw.currentRadius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update phosphor ghosts
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.x += g.vx;
      g.alpha -= g.decayRate;
      g.radius *= 1.012;
      if (g.alpha <= 0.01) {
        this.ghosts.splice(i, 1);
      }
    }
  }

  /**
   * Checks if there are any active particles, shockwaves, or ghosts being simulated
   */
  public hasActiveParticles(): boolean {
    return this.particles.length > 0 || this.shockwaves.length > 0 || this.ghosts.length > 0;
  }

  /**
   * Spawns a CRT phosphor ghost echo with chromatic aberration
   */
  public spawnGhost(x: number, y: number, color: string, radius: number = 14, velocity: number = 0.5) {
    if (this.ghosts.length > 50) return; // safety limit
    this.ghosts.push({
      x,
      y,
      radius,
      color,
      alpha: Math.min(0.85, 0.35 + velocity * 0.5),
      decayRate: 0.02 + Math.random() * 0.015,
      vx: (Math.random() - 0.5) * 0.4,
    });
  }

  /**
   * Renders the atmospheric background with radial vignetting and grid lines
   */
  public renderBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: BackgroundTheme,
    motionTrails: number = 0.15
  ) {
    // Semi-transparent clearing for motion blur persistence
    if (motionTrails > 0) {
      ctx.fillStyle = `rgba(11, 13, 19, ${Math.max(0.12, 1 - motionTrails)})`;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    ctx.save();
    const cx = width / 2;
    const cy = height / 2;
    const maxDim = Math.max(width, height);

    if (theme === 'studio-obsidian') {
      const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, maxDim * 0.75);
      grad.addColorStop(0, '#151922');
      grad.addColorStop(0.5, '#0e1118');
      grad.addColorStop(1, '#08090d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (theme === 'cosmic-abyss') {
      const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, maxDim * 0.8);
      grad.addColorStop(0, '#19152b');
      grad.addColorStop(0.45, '#0f0e1c');
      grad.addColorStop(1, '#06060a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (theme === 'carbon-grid') {
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(0, 0, width, height);

      // Subtle isometric / grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (theme === 'velvet-dark') {
      const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, maxDim * 0.7);
      grad.addColorStop(0, '#131b2e');
      grad.addColorStop(0.6, '#0c101d');
      grad.addColorStop(1, '#05070c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  /**
   * Renders particles and shockwaves on top of canvas elements
   */
  public renderEffects(ctx: CanvasRenderingContext2D, glowBloom: number = 0.8) {
    ctx.save();

    // Render shockwaves
    for (const sw of this.shockwaves) {
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.currentRadius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, sw.alpha));
      ctx.lineWidth = sw.lineWidth;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 12 * glowBloom;
      ctx.stroke();
    }

    // Render particles:
    // 1. Fast ambient radiant halo (without CPU/GPU Gaussian blur filter bottlenecks)
    if (glowBloom > 0.05 && this.particles.length > 0) {
      for (const p of this.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * 0.32 * glowBloom));
        ctx.fill();
      }
    }

    // 2. Crisp bright cores
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Renders analog artifacts: Light Bleed (Halation & Anamorphic streaks)
   * and Phosphor Ghosting (CRT persistence with chromatic aberration).
   */
  public renderAnalogArtifacts(
    ctx: CanvasRenderingContext2D,
    width: number,
    _height: number,
    activeNotes: Map<number, ActiveNote>,
    decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>,
    clockCx: number,
    clockCy: number,
    clockRadius: number,
    config: VisualiserConfig
  ) {
    const bleed = config.lightBleedIntensity ?? 0;
    const ghost = config.ghostingIntensity ?? 0;
    if (bleed <= 0.01 && ghost <= 0.01) return;

    // Collect light source coordinates from active and decaying notes
    const tonic = config.tonic;
    const sources: Array<{ x: number; y: number; color: string; velocity: number }> = [];

    for (const note of activeNotes.values()) {
      const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, config.keyboardLowestMidi);
      const angle = getClockAngleRad(res.semitone);
      const orbitRatio = 0.35 + (res.registerIndex / 7) * 0.55;
      const r = clockRadius * orbitRatio;
      const x = clockCx + r * Math.cos(angle);
      const y = clockCy + r * Math.sin(angle);
      sources.push({ x, y, color: note.colorHex, velocity: note.velocity });

      // Seed phosphor ghosts while note is sounding
      if (ghost > 0.05 && Math.random() < 0.28) {
        this.spawnGhost(x, y, note.colorHex, 15, note.velocity);
      }
    }

    for (const { note, decayProgress } of decayingNotes.values()) {
      const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, config.keyboardLowestMidi);
      const angle = getClockAngleRad(res.semitone);
      const orbitRatio = 0.35 + (res.registerIndex / 7) * 0.55;
      const r = clockRadius * orbitRatio;
      const x = clockCx + r * Math.cos(angle);
      const y = clockCy + r * Math.sin(angle);
      const vel = note.velocity * (1 - decayProgress);
      if (vel > 0.04) {
        sources.push({ x, y, color: note.colorHex, velocity: vel });
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // 1. Light Bleed: Radial Halation & Anamorphic Lens Streaks
    if (bleed > 0.01 && sources.length > 0) {
      for (const src of sources) {
        const velAlpha = Math.min(1.0, src.velocity * bleed);
        if (velAlpha <= 0.02) continue;

        // Radial film halation (soft warm glow around bright highlight)
        const halationR = Math.max(35, Math.min(180, 60 * bleed + src.velocity * 50));
        const radGrad = ctx.createRadialGradient(src.x, src.y, 2, src.x, src.y, halationR);
        radGrad.addColorStop(0, hexToRgba(src.color, velAlpha * 0.55));
        radGrad.addColorStop(0.35, 'rgba(251, 146, 60, ' + (velAlpha * 0.22) + ')'); // warm 35mm halation
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(src.x, src.y, halationR, 0, Math.PI * 2);
        ctx.fill();

        // Anamorphic horizontal light streak bleed
        const streakHalfW = Math.min(width * 0.45, 120 + 260 * bleed);
        const streakH = Math.max(2, 6 * src.velocity);
        const linGrad = ctx.createLinearGradient(src.x - streakHalfW, src.y, src.x + streakHalfW, src.y);
        linGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        linGrad.addColorStop(0.3, hexToRgba(src.color, velAlpha * 0.12));
        linGrad.addColorStop(0.5, 'rgba(255, 255, 255, ' + (velAlpha * 0.5) + ')');
        linGrad.addColorStop(0.7, hexToRgba(src.color, velAlpha * 0.12));
        linGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = linGrad;
        ctx.fillRect(src.x - streakHalfW, src.y - streakH / 2, streakHalfW * 2, streakH);
      }
    }

    // 2. Phosphor Ghosting: CRT persistence with chromatic aberration
    if (ghost > 0.01 && this.ghosts.length > 0) {
      for (const g of this.ghosts) {
        const a = g.alpha * ghost;
        if (a <= 0.01) continue;

        // Chromatic split: Red left shift
        ctx.beginPath();
        ctx.arc(g.x - 2.5, g.y, g.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, ' + (a * 0.35) + ')';
        ctx.fill();

        // Green / phosphor center
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
        ctx.fillStyle = g.color;
        ctx.globalAlpha = a * 0.55;
        ctx.shadowColor = g.color;
        ctx.shadowBlur = 8;
        ctx.fill();

        // Blue / cyan right shift
        ctx.beginPath();
        ctx.arc(g.x + 2.5, g.y, g.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, ' + (a * 0.35) + ')';
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
        ctx.fill();
      }
    }

    // 3. Multi-Element Optical Lens Flare & Diffraction Starburst Rays
    const flare = config.lensFlareIntensity ?? 0;
    if (flare > 0.01 && sources.length > 0) {
      this.renderOpticalLensFlares(ctx, width, _height, sources, flare, config.lensFlareStyle ?? 'cinematic');
    }

    ctx.restore();
  }

  /**
   * Renders multi-element optical lens flares:
   * - Diffraction starburst rays radiating from sounding notes
   * - Anamorphic horizontal optical streak
   * - Aperture reflection ghosts reflected across viewport optical center
   */
  public renderOpticalLensFlares(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    sources: Array<{ x: number; y: number; color: string; velocity: number }>,
    intensity: number,
    style: 'anamorphic' | 'starburst' | 'cinematic'
  ) {
    const opticalCx = width / 2;
    const opticalCy = height / 2;

    // Up to 8 simultaneous flare sources smoothly prioritized by velocity
    const activeSources = sources.length > 8
      ? sources.slice().sort((a, b) => b.velocity - a.velocity).slice(0, 8)
      : sources;

    for (const src of activeSources) {
      const alpha = Math.min(1.0, src.velocity * intensity);
      if (alpha <= 0.02) continue;

      // 1. Starburst diffraction rays with feathered falloff
      if (style === 'starburst' || style === 'cinematic') {
        const rayCount = 6;
        const rayLen = Math.min(width * 0.35, 70 + 160 * intensity * src.velocity);
        const rayWidth = 1.6 + src.velocity * 1.2;

        ctx.save();
        ctx.translate(src.x, src.y);

        // Radiant central optical core disc (luminous bloom at the center)
        const coreR = Math.max(8, 18 * intensity * (0.6 + src.velocity * 0.6));
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
        coreGrad.addColorStop(0.25, hexToRgba(src.color, alpha * 0.65));
        coreGrad.addColorStop(0.65, hexToRgba(src.color, alpha * 0.25));
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.fill();

        // 6 diffraction rays with smooth feathered tip fade (zero hard cutoffs)
        for (let i = 0; i < rayCount; i++) {
          const angle = (i * Math.PI) / rayCount + (Math.PI / 12);
          const cos = Math.cos(angle) * rayLen;
          const sin = Math.sin(angle) * rayLen;

          const grad = ctx.createLinearGradient(-cos, -sin, cos, sin);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(0.32, hexToRgba(src.color, alpha * 0.35));
          grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.92})`);
          grad.addColorStop(0.68, hexToRgba(src.color, alpha * 0.35));
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.beginPath();
          ctx.moveTo(-cos, -sin);
          ctx.lineTo(cos, sin);
          ctx.strokeStyle = grad;
          ctx.lineWidth = rayWidth;
          ctx.stroke();
        }

        ctx.restore();
      }

      // 2. Anamorphic horizontal flare
      if (style === 'anamorphic' || style === 'cinematic') {
        const streakW = Math.min(width * 0.72, 220 + 460 * intensity);
        const streakH = Math.max(3, 5 * src.velocity);

        const streakGrad = ctx.createLinearGradient(src.x - streakW, src.y, src.x + streakW, src.y);
        streakGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        streakGrad.addColorStop(0.2, hexToRgba('#38bdf8', alpha * 0.25)); // Sci-fi cyan anamorphic tint
        streakGrad.addColorStop(0.42, hexToRgba(src.color, alpha * 0.45));
        streakGrad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.95})`);
        streakGrad.addColorStop(0.58, hexToRgba(src.color, alpha * 0.45));
        streakGrad.addColorStop(0.8, hexToRgba('#818cf8', alpha * 0.25));
        streakGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = streakGrad;
        ctx.fillRect(src.x - streakW, src.y - streakH / 2, streakW * 2, streakH);
      }

      // 3. Aperture reflection ghosts reflected across optical center
      if (style === 'cinematic') {
        const dx = opticalCx - src.x;
        const dy = opticalCy - src.y;

        // Reflection offsets: 0.4x, 0.75x, 1.35x along optical axis
        const ghostScales = [0.4, 0.75, 1.35];
        const ghostSizes = [12, 22, 38];

        for (let g = 0; g < ghostScales.length; g++) {
          const gx = src.x + dx * (1 + ghostScales[g]);
          const gy = src.y + dy * (1 + ghostScales[g]);
          const gr = ghostSizes[g] * (0.8 + src.velocity * 0.4) * intensity;
          const ga = alpha * (0.18 / (g + 1));

          ctx.beginPath();
          ctx.arc(gx, gy, gr, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(src.color, ga);
          ctx.strokeStyle = hexToRgba('#38bdf8', ga * 1.5);
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  /**
   * Renders authentic CRT scanlines and barrel vignette
   */
  public renderScanlines(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    densityMultiplier: number = 2,
    vignetteIntensity: number = 0.2
  ) {
    if (intensity <= 0.01 && vignetteIntensity <= 0.01) return;

    ctx.save();

    // 1. Interlaced Scanlines (using cached pattern for single-draw-call performance)
    if (intensity > 0.01) {
      // Density: 1=Fine (step 2), 2=Standard (step 3), 3=Retro (step 4), 4=Coarse Arcade (step 6)
      const step = Math.max(2, Math.min(8, [2, 3, 4, 6][(densityMultiplier || 2) - 1] || 3));
      const scanlineAlpha = Math.min(0.75, intensity * 0.48);
      const pattern = this.getScanlinePattern(ctx, step);

      if (pattern) {
        ctx.save();
        ctx.globalAlpha = scanlineAlpha;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, ' + scanlineAlpha + ')';
        for (let y = 0; y < height; y += step) {
          ctx.fillRect(0, y, width, 1);
        }
      }
    }

    // 2. CRT Screen Vignette / Radial Glass Curve Falloff
    if (vignetteIntensity > 0.01) {
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy);
      const vigGrad = ctx.createRadialGradient(cx, cy, maxR * 0.55, cx, cy, maxR);
      vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vigGrad.addColorStop(0.7, 'rgba(0, 0, 0, ' + (vignetteIntensity * 0.35) + ')');
      vigGrad.addColorStop(1, 'rgba(0, 0, 0, ' + (vignetteIntensity * 0.85) + ')');

      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  }

  /**
   * Overlays procedural animated film grain with Gauge/Size scaling and Contrast curve
   */
  public renderFilmGrain(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    sizeMultiplier: number = 1,
    contrastRatio: number = 0.5
  ) {
    if (intensity <= 0.01 || this.grainCanvases.length === 0) return;

    // Lazily compile patterns once for this canvas rendering context
    if (this.grainPatterns.length === 0) {
      for (const canvas of this.grainCanvases) {
        const pattern = ctx.createPattern(canvas, 'repeat');
        if (pattern) {
          this.grainPatterns.push(pattern);
        }
      }
    }
    if (this.grainPatterns.length === 0) return;

    const pattern = this.grainPatterns[this.currentPatternIndex % this.grainPatterns.length];
    if (!pattern) return;

    const size = Math.max(1, Math.min(4, sizeMultiplier || 1));
    const contrast = Math.max(0, Math.min(1, contrastRatio ?? 0.5));

    ctx.save();
    // Contrast curve: higher contrast produces punchier grit, lower contrast produces soft film haze
    const baseAlpha = Math.min(0.85, intensity * (0.32 + contrast * 0.35));
    ctx.globalAlpha = baseAlpha;
    ctx.globalCompositeOperation = contrast > 0.65 ? 'overlay' : 'screen';

    // Scale canvas by size (1x = Fine 35mm, 2x = Medium 16mm, 3x = Coarse 8mm, 4x = Chunky Vintage)
    ctx.scale(size, size);

    // Jitter pattern origin for continuous, non-repeating film motion
    ctx.translate(this.grainJitterX, this.grainJitterY);
    ctx.fillStyle = pattern;
    ctx.fillRect(
      -this.grainJitterX,
      -this.grainJitterY,
      (width / size) + CosmeticsEngine.GRAIN_PATTERN_SIZE,
      (height / size) + CosmeticsEngine.GRAIN_PATTERN_SIZE
    );

    // Secondary subtle high-contrast pass if contrast is pushed high
    if (contrast > 0.75) {
      ctx.globalCompositeOperation = 'color-dodge';
      ctx.globalAlpha = (contrast - 0.75) * intensity * 0.4;
      ctx.fillRect(
        -this.grainJitterX,
        -this.grainJitterY,
        (width / size) + CosmeticsEngine.GRAIN_PATTERN_SIZE,
        (height / size) + CosmeticsEngine.GRAIN_PATTERN_SIZE
      );
    }

    ctx.restore();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 255;
  const g = parseInt(clean.substring(2, 4), 16) || 255;
  const b = parseInt(clean.substring(4, 6), 16) || 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
