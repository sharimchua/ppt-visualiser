import {
  SOLFEGE_SYLLABLES,
  SOLFEGE_SPECS,
  PITCH_NAMES_DUAL,
  PITCH_NAMES_SHARP,
  PITCH_NAMES_FLAT,
  INTERVAL_NAMES,
  PITCH_CLASS_TO_PIANO_TRIANGLE,
  TRI_PITCH_CLASSES,
  getClockAngleRad,
  getBaseCenterDo,
  resolveMidiToRegisterAndSemitone,
} from '../core/ppt-constants';
import { ActiveNote, VisualiserConfig, PianoTriangleType, PianoTrianglePoint } from '../core/types';
import { drawUniformSolfegeOnCanvas, drawPianoTriangleOnCanvas } from './glyph-renderer';
import { compute2DConvexHull } from '../core/convex-hull';
import { resolveChordVoicingGroups } from '../core/chord-clustering';

interface RadialArcTrail {
  id: string;
  register: number;
  fromAngle: number;
  toAngle: number;
  deltaAngle: number;
  colorFrom: string;
  colorTo: string;
  startTime: number;
  durationMs: number;
}

export class PitchClockRenderer {
  // Set of tone keys ("${r}_${s}") that have been played in this session
  private discoveredTones: Set<string> = new Set();
  // Dynamic per-tone activity score [0..1] for organic window decay
  private toneActivity: Map<string, number> = new Map();
  // Animation scale for each discovered tone (pops from 0 -> 1.25 -> 1.0)
  private tonePopScale: Map<string, number> = new Map();

  // Activity score per register [0..7] (exponential decay over organic window)
  private registerActivity: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private registerEverPlayed: boolean[] = [false, false, false, false, false, false, false, false];

  // Animated radial radius and alpha per register for organic window transitions
  private currentRadii: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private currentAlphas: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private lastTime: number = 0;

  // Radial movement trails tracking sequential note transitions in the same octave register
  private lastNotePerRegister: Array<{ semitone: number; time: number; color: string } | null> = [
    null, null, null, null, null, null, null, null
  ];
  private processedNoteStarts: Set<string> = new Set();
  private radialTrails: RadialArcTrail[] = [];

  // Exact on-screen rendered coordinates of each tone node for pixel-precise cosmetic effects
  private toneCoordinates: Map<string, { x: number; y: number; radius: number; angle: number; semitone: number; registerIndex: number }> = new Map();

  /**
   * Look up exact on-screen rendered center coordinates and radius for a MIDI note.
   */
  public getToneCoordinates(midi: number, tonic: number, lowestMidi: number = 21): { x: number; y: number; radius: number; angle: number; semitone: number; registerIndex: number } | null {
    const res = resolveMidiToRegisterAndSemitone(midi, tonic, lowestMidi);
    const key = `${res.registerIndex}_${res.semitone}`;
    return this.toneCoordinates.get(key) || null;
  }

  /**
   * Resets all discovered tones, tone pop scale animations, and organic register activity
   * without needing to reload the webpage.
   */
  public resetRevealsAndActivity(): void {
    this.discoveredTones.clear();
    this.toneActivity.clear();
    this.tonePopScale.clear();
    this.registerActivity = [0, 0, 0, 0, 0, 0, 0, 0];
    this.registerEverPlayed = [false, false, false, false, false, false, false, false];
    this.currentRadii = [0, 0, 0, 0, 0, 0, 0, 0];
    this.currentAlphas = [0, 0, 0, 0, 0, 0, 0, 0];
    this.lastNotePerRegister = [null, null, null, null, null, null, null, null];
    this.processedNoteStarts.clear();
    this.radialTrails = [];
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    activeNotes: Map<number, ActiveNote>,
    decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>,
    config: VisualiserConfig,
    now: number
  ) {
    const cx = width / 2;
    const cy = height / 2;
    const maxClockRadius = Math.min(width, height) * 0.45;
    const minClockRadius = maxClockRadius * 0.22;

    const tonic = config.tonic;

    // Delta time calculation
    const dt = this.lastTime === 0 ? 0.016 : Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    // 1. Update activity scores and tone discovery from active & decaying notes
    for (const note of activeNotes.values()) {
      const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, config.keyboardLowestMidi);
      this.registerActivity[res.registerIndex] = 1.0;
      this.registerEverPlayed[res.registerIndex] = true;

      const toneKey = `${res.registerIndex}_${res.semitone}`;
      this.toneActivity.set(toneKey, 1.0);
      if (!this.discoveredTones.has(toneKey)) {
        this.discoveredTones.add(toneKey);
        this.tonePopScale.set(toneKey, 0.0);
      }
    }

    // 1b. Track note transitions for radial movement trails along the same octave ring
    if (config.showRadialMovementTrails) {
      const currentActiveKeys = new Set<string>();
      for (const note of activeNotes.values()) {
        const noteKey = `${note.midi}_${note.startTime}`;
        currentActiveKeys.add(noteKey);

        if (!this.processedNoteStarts.has(noteKey)) {
          this.processedNoteStarts.add(noteKey);
          const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, config.keyboardLowestMidi);
          const reg = res.registerIndex;
          const last = this.lastNotePerRegister[reg];

          // If there was a previous note in this same register within the musical phrasing window (3s) and semitone changed:
          if (last && last.semitone !== res.semitone && (now - last.time < 3000)) {
            const fromAngle = getClockAngleRad(last.semitone);
            const toAngle = getClockAngleRad(res.semitone);

            // Compute shortest angular path along the ring
            let delta = toAngle - fromAngle;
            while (delta > Math.PI) delta -= 2 * Math.PI;
            while (delta <= -Math.PI) delta += 2 * Math.PI;

            this.radialTrails.push({
              id: `${reg}_${res.semitone}_${now}`,
              register: reg,
              fromAngle,
              toAngle,
              deltaAngle: delta,
              colorFrom: last.color,
              colorTo: note.colorHex,
              startTime: now,
              durationMs: 850,
            });
          }

          this.lastNotePerRegister[reg] = {
            semitone: res.semitone,
            time: now,
            color: note.colorHex,
          };
        }
      }

      // Cleanup keys of notes that are no longer sounding
      for (const key of this.processedNoteStarts) {
        if (!currentActiveKeys.has(key)) {
          this.processedNoteStarts.delete(key);
        }
      }
    }

    for (const { note } of decayingNotes.values()) {
      const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, config.keyboardLowestMidi);
      this.registerActivity[res.registerIndex] = Math.max(this.registerActivity[res.registerIndex], 0.6);
      this.registerEverPlayed[res.registerIndex] = true;

      const toneKey = `${res.registerIndex}_${res.semitone}`;
      this.toneActivity.set(toneKey, Math.max(this.toneActivity.get(toneKey) ?? 0, 0.6));
      if (!this.discoveredTones.has(toneKey)) {
        this.discoveredTones.add(toneKey);
        this.tonePopScale.set(toneKey, 0.0);
      }
    }

    // Exponential decay of register activity and tone activity over organic window duration
    const decayFactor = Math.exp(-dt / Math.max(2, config.organicWindowDurationSec));
    for (let r = 0; r < 8; r++) {
      this.registerActivity[r] *= decayFactor;
    }

    // Decay per-tone activity; when window expires in organic mode, evict tone so it dissolves away
    for (const [key, act] of this.toneActivity.entries()) {
      const nextAct = act * decayFactor;
      if (nextAct < 0.015) {
        this.toneActivity.delete(key);
        if (config.registerWeightMode === 'organic') {
          this.discoveredTones.delete(key);
          this.tonePopScale.delete(key);
        }
      } else {
        this.toneActivity.set(key, nextAct);
      }
    }

    // Animate tone pop scales
    for (const [key, currentScale] of this.tonePopScale.entries()) {
      const target = 1.0;
      const nextScale = currentScale + (target - currentScale) * 0.16;
      this.tonePopScale.set(key, Math.min(1.0, nextScale));
    }

    // 2. Calculate Organic Radial Layout & Visual Weighting
    const { targetRadii, targetAlphas, activeRegisters } = this.calculateOrganicRadii(
      minClockRadius,
      maxClockRadius,
      config
    );

    // Spring smooth interpolation for radii and opacities
    for (let r = 0; r < 8; r++) {
      if (this.currentRadii[r] === 0) {
        this.currentRadii[r] = targetRadii[r];
        this.currentAlphas[r] = targetAlphas[r];
      } else {
        this.currentRadii[r] += (targetRadii[r] - this.currentRadii[r]) * 0.12;
        this.currentAlphas[r] += (targetAlphas[r] - this.currentAlphas[r]) * 0.12;
      }
    }

    // 3. Draw Concentric Octave Rings
    this.drawConcentricRings(ctx, cx, cy, this.currentRadii, this.currentAlphas, activeRegisters, config);

    // 3b. Draw Radial Movement Trails along octave rings
    if (config.showRadialMovementTrails) {
      this.drawRadialMovementTrails(ctx, cx, cy, this.currentRadii, now, config);
    }

    // 4. Draw Active Chord Connection Rays / Webbing
    if (config.connectChordRays && (activeNotes.size > 1 || decayingNotes.size > 0)) {
      this.drawChordConnections(ctx, cx, cy, this.currentRadii, activeNotes, decayingNotes, config);
    }

    // 5. Draw Pitch Clock Nodes
    this.drawClockNodes(
      ctx,
      cx,
      cy,
      minClockRadius,
      maxClockRadius,
      this.currentRadii,
      this.currentAlphas,
      activeRegisters,
      activeNotes,
      decayingNotes,
      config,
      now
    );
  }

  /**
   * Dynamically calculates target radii and opacities for all 8 registers.
   * Manages visual weight by expanding active registers to fill space and collapsing unused ones!
   * For fewer orbits (especially 2 orbits), scales effective radii to balance the canvas,
   * avoiding both outer edge crowding and inner core crushing.
   */
  private calculateOrganicRadii(
    _minR: number,
    maxR: number,
    config: VisualiserConfig
  ): { targetRadii: number[]; targetAlphas: number[]; activeRegisters: Set<number> } {
    const targetRadii = [0, 0, 0, 0, 0, 0, 0, 0];
    const targetAlphas = [0, 0, 0, 0, 0, 0, 0, 0];
    const activeRegisters = new Set<number>();

    const minReg = Math.max(0, Math.min(7, (config.startOctave ?? 1) - 1));
    const maxReg = Math.max(minReg, Math.min(7, (config.endOctave ?? 8) - 1));
    const span = maxReg - minReg;

    // Helper to compute balanced radial boundaries for N visible orbits.
    // When showing 2 orbits: outer orbit is inset to ~0.78 * maxR to breathe comfortably away from borders,
    // and inner orbit is placed at ~0.46 * maxR to provide generous circumference and large tone circles.
    // When showing 8 orbits: smoothly scales to full [0.22 * maxR, 1.0 * maxR].
    const getEffectiveRadiiBounds = (nOrbits: number) => {
      const n = Math.max(1, Math.min(8, nOrbits));
      if (n === 1) {
        return { effMaxR: maxR * 0.60, effMinR: maxR * 0.60 };
      }
      const u = Math.min(1.0, Math.max(0.0, (n - 2) / 6));
      const outerFactor = 0.78 + 0.22 * Math.pow(u, 0.8);
      const innerFactor = 0.46 - 0.24 * Math.pow(u, 0.8);
      return {
        effMaxR: maxR * outerFactor,
        effMinR: maxR * innerFactor,
      };
    };

    // Fixed mode for the selected octave range
    if (config.registerWeightMode === 'fixed8') {
      const numOrbits = span + 1;
      const { effMaxR, effMinR } = getEffectiveRadiiBounds(numOrbits);

      if (span === 0) {
        activeRegisters.add(minReg);
        targetAlphas[minReg] = 1.0;
        targetRadii[minReg] = effMaxR;
      } else {
        for (let r = minReg; r <= maxReg; r++) {
          activeRegisters.add(r);
          targetAlphas[r] = 1.0;
          const t = (r - minReg) / span;
          targetRadii[r] = effMaxR - t * (effMaxR - effMinR);
        }
      }
      return { targetRadii, targetAlphas, activeRegisters };
    }

    if (config.registerWeightMode === 'discovered') {
      for (let r = minReg; r <= maxReg; r++) {
        if (this.registerEverPlayed[r]) {
          activeRegisters.add(r);
          targetAlphas[r] = 1.0;
        }
      }
    } else {
      // Default: 'organic' activity window
      // Octave registers remain active while registerActivity is above threshold (> 0.02)
      // Once inactive past the decay window, they drop out so the remaining active octaves expand!
      for (let r = minReg; r <= maxReg; r++) {
        if (this.registerActivity[r] > 0.02) {
          activeRegisters.add(r);
          targetAlphas[r] = Math.min(1.0, 0.25 + this.registerActivity[r] * 0.75);
        }
      }
    }

    // If no registers in selected range have been played yet (or all have decayed), anchor middle register
    if (activeRegisters.size === 0) {
      const anchorReg = Math.round((minReg + maxReg) / 2);
      activeRegisters.add(anchorReg);
      targetAlphas[anchorReg] = 0.85;
      targetRadii[anchorReg] = maxR * 0.60;

      const { effMaxR, effMinR } = getEffectiveRadiiBounds(span + 1);
      for (let r = minReg; r <= maxReg; r++) {
        const t = span > 0 ? (r - minReg) / span : 0.5;
        if (r !== anchorReg) {
          targetRadii[r] = effMaxR - t * (effMaxR - effMinR);
          targetAlphas[r] = config.inactiveRegisterDisplay === 'hidden' ? 0.0 : 0.15;
        }
      }
      return { targetRadii, targetAlphas, activeRegisters };
    }

    // Distribute active registers across the balanced radial range [effMinR, effMaxR]
    const sortedActive = Array.from(activeRegisters).sort((a, b) => a - b);
    const count = sortedActive.length;
    const { effMaxR, effMinR } = getEffectiveRadiiBounds(count);

    if (count === 1) {
      const r = sortedActive[0];
      targetRadii[r] = maxR * 0.60;
      targetAlphas[r] = 1.0;
    } else {
      for (let i = 0; i < count; i++) {
        const r = sortedActive[i];
        const t = i / (count - 1);
        targetRadii[r] = effMaxR - t * (effMaxR - effMinR);
      }
    }

    // Inactive registers within selected span
    const inactiveBounds = getEffectiveRadiiBounds(Math.max(count, span + 1));
    for (let r = minReg; r <= maxReg; r++) {
      if (!activeRegisters.has(r)) {
        if (config.inactiveRegisterDisplay === 'hidden') {
          targetAlphas[r] = 0.0;
          const closest = sortedActive.length > 0 ? sortedActive.reduce((prev, curr) =>
            Math.abs(curr - r) < Math.abs(prev - r) ? curr : prev
          ) : r;
          targetRadii[r] = targetRadii[closest];
        } else {
          targetAlphas[r] = 0.14;
          const t = span > 0 ? (r - minReg) / span : 0.5;
          targetRadii[r] = inactiveBounds.effMaxR - t * (inactiveBounds.effMaxR - inactiveBounds.effMinR);
        }
      }
    }

    return { targetRadii, targetAlphas, activeRegisters };
  }

  private drawConcentricRings(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    ringRadii: number[],
    ringAlphas: number[],
    activeRegisters: Set<number>,
    config: VisualiserConfig
  ) {
    ctx.save();

    for (let r = 0; r < 8; r++) {
      const radius = ringRadii[r];
      const alpha = ringAlphas[r];
      if (alpha <= 0.02 || radius <= 10) continue;

      const isActive = activeRegisters.has(r);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isActive
        ? `rgba(100, 116, 139, ${0.35 * alpha})`
        : `rgba(51, 65, 85, ${0.15 * alpha})`;
      ctx.lineWidth = isActive ? 1.5 : 1.0;
      ctx.stroke();

      // Clean octave numbers positioned at angle -105 deg (15 deg counter-clockwise from 12 o'clock Do)
      // Completely avoids any overlap with Do or neighboring tone circles!
      if (config.showOctaveNumbers && alpha > 0.25) {
        const numAngle = (-105 * Math.PI) / 180;
        const nx = cx + radius * Math.cos(numAngle);
        const ny = cy + radius * Math.sin(numAngle);
        const octNum = r + 1;

        ctx.save();
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isActive
          ? `rgba(226, 232, 240, ${0.85 * alpha})`
          : `rgba(148, 163, 184, ${0.45 * alpha})`;
        ctx.fillText(String(octNum), nx, ny);
        ctx.restore();
      }
    }

    // 12-position spoke lines across active span
    const maxActiveR = Math.max(...Array.from(activeRegisters).map(r => ringRadii[r]));
    const minActiveR = Math.min(...Array.from(activeRegisters).map(r => ringRadii[r]));

    for (let s = 0; s < 12; s++) {
      const angle = getClockAngleRad(s);
      const isDoFiAxis = s === 0 || s === 6; // Vertical Do-Fi axis
      ctx.beginPath();
      ctx.moveTo(cx + Math.max(15, minActiveR * 0.75) * Math.cos(angle), cy + Math.max(15, minActiveR * 0.75) * Math.sin(angle));
      ctx.lineTo(cx + (maxActiveR * 1.05) * Math.cos(angle), cy + (maxActiveR * 1.05) * Math.sin(angle));
      ctx.strokeStyle = isDoFiAxis ? 'rgba(148, 163, 184, 0.35)' : 'rgba(51, 65, 85, 0.12)';
      ctx.lineWidth = isDoFiAxis ? 1.5 : 1.0;
      if (isDoFiAxis) {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Octave boundary sweep indicator (subtle arc from 7 o'clock So through 12 Do to 6 Fi)
    if (maxActiveR > 20) {
      ctx.beginPath();
      const startAngle = getClockAngleRad(7); // 7 o'clock (So)
      const endAngle = getClockAngleRad(6);   // 6 o'clock (Fi)
      ctx.arc(cx, cy, maxActiveR * 1.07, startAngle, endAngle, false);
      ctx.strokeStyle = 'rgba(225, 54, 16, 0.28)'; // Do red hint
      ctx.lineWidth = 2.0;
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawChordConnections(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    ringRadii: number[],
    activeNotes: Map<number, ActiveNote>,
    decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>,
    config: VisualiserConfig
  ) {
    // Resolve active and decaying chord voicing groups:
    // - Concurrently held active notes form a living chord (dynamically expanding when tones are added, reducing when released)
    // - Notes released together fade out as cohesive decaying chord shapes
    // - Distinct harmonies are never linked together
    const clusters = resolveChordVoicingGroups(activeNotes, decayingNotes);
    if (clusters.length === 0) return;

    for (const cluster of clusters) {
      // Map cluster notes to canvas coordinates
      const clusterPoints = cluster.notes.map((item) => {
        const res = resolveMidiToRegisterAndSemitone(item.note.midi, config.tonic, config.keyboardLowestMidi);
        const radius = ringRadii[res.registerIndex];
        const angle = getClockAngleRad(res.semitone);
        return {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          color: item.note.colorHex,
          alpha: item.alpha,
          midi: item.note.midi,
        };
      });

      if (clusterPoints.length < 2) continue;

      if (clusterPoints.length === 2) {
        // Clean glowing dyad line segment
        const p1 = clusterPoints[0];
        const p2 = clusterPoints[1];
        const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
        grad.addColorStop(0, p1.color);
        grad.addColorStop(1, p2.color);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = grad;
        ctx.globalAlpha = Math.min(p1.alpha, p2.alpha);
        ctx.lineWidth = 2.5;
        ctx.shadowColor = p1.color;
        ctx.shadowBlur = 10 * config.glowBloom;
        ctx.stroke();
        ctx.restore();
        continue;
      }

      // 3 or more notes:
      if (config.chordRayMode === 'web') {
        // All-to-all star web within this harmony cluster
        ctx.save();
        for (let i = 0; i < clusterPoints.length; i++) {
          for (let j = i + 1; j < clusterPoints.length; j++) {
            const p1 = clusterPoints[i];
            const p2 = clusterPoints[j];
            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            grad.addColorStop(0, p1.color);
            grad.addColorStop(1, p2.color);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = grad;
            ctx.globalAlpha = Math.min(p1.alpha, p2.alpha) * 0.7;
            ctx.lineWidth = 2.0;
            ctx.shadowColor = p1.color;
            ctx.shadowBlur = 8 * config.glowBloom;
            ctx.stroke();
          }
        }
        ctx.restore();
      } else {
        // 2D Convex Hull perimeter polygon (Andrew's Monotone Chain)
        const hull = compute2DConvexHull(clusterPoints);
        if (hull.length < 2) continue;

        ctx.save();

        // Fill chord convex polygon interior with soft radiant glow
        ctx.beginPath();
        ctx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < hull.length; i++) {
          ctx.lineTo(hull[i].x, hull[i].y);
        }
        ctx.closePath();

        const avgAlpha = hull.reduce((sum, p) => sum + p.alpha, 0) / hull.length;
        ctx.fillStyle = `rgba(241, 245, 249, ${0.06 * (avgAlpha / 0.85)})`;
        ctx.fill();

        // Stroke convex hull perimeter with single unified radiant bloom pass + crisp segment gradients
        if (config.glowBloom > 0.05) {
          ctx.beginPath();
          ctx.moveTo(hull[0].x, hull[0].y);
          for (let i = 1; i < hull.length; i++) {
            ctx.lineTo(hull[i].x, hull[i].y);
          }
          ctx.closePath();
          ctx.strokeStyle = hull[0].color;
          ctx.lineWidth = 4.0;
          ctx.globalAlpha = avgAlpha * 0.35 * config.glowBloom;
          ctx.shadowColor = hull[0].color;
          ctx.shadowBlur = 10 * config.glowBloom;
          ctx.stroke();
        }

        ctx.shadowBlur = 0;
        for (let i = 0; i < hull.length; i++) {
          const p1 = hull[i];
          const p2 = hull[(i + 1) % hull.length];
          const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
          grad.addColorStop(0, p1.color);
          grad.addColorStop(1, p2.color);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = grad;
          ctx.globalAlpha = Math.min(p1.alpha, p2.alpha);
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Subtly connect any interior notes to their nearest hull vertex
        const hullKeySet = new Set(hull.map(p => `${p.x.toFixed(1)}_${p.y.toFixed(1)}`));
        const internalPoints = clusterPoints.filter(p => !hullKeySet.has(`${p.x.toFixed(1)}_${p.y.toFixed(1)}`));

        for (const ip of internalPoints) {
          let closest = hull[0];
          let minDistSq = Infinity;
          for (const hp of hull) {
            const dsq = (ip.x - hp.x) ** 2 + (ip.y - hp.y) ** 2;
            if (dsq < minDistSq) {
              minDistSq = dsq;
              closest = hp;
            }
          }

          const grad = ctx.createLinearGradient(ip.x, ip.y, closest.x, closest.y);
          grad.addColorStop(0, ip.color);
          grad.addColorStop(1, closest.color);

          ctx.beginPath();
          ctx.moveTo(ip.x, ip.y);
          ctx.lineTo(closest.x, closest.y);
          ctx.strokeStyle = grad;
          ctx.globalAlpha = Math.min(ip.alpha, closest.alpha) * 0.45;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.restore();
      }
    }
  }

  private drawRadialMovementTrails(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    ringRadii: number[],
    now: number,
    config: VisualiserConfig
  ) {
    if (!config.showRadialMovementTrails || this.radialTrails.length === 0) return;

    // Prune expired trails
    this.radialTrails = this.radialTrails.filter(tr => now - tr.startTime < tr.durationMs);

    ctx.save();
    for (const trail of this.radialTrails) {
      const radius = ringRadii[trail.register];
      if (!radius || radius <= 12) continue;

      const progress = Math.max(0, Math.min(1.0, (now - trail.startTime) / trail.durationMs));

      // Ease-out head leading, delayed tail following
      const headEased = 1 - Math.pow(1 - progress, 2.2);
      const tailEased = Math.max(0, (progress - 0.18) / 0.82);
      const tailEasedSq = tailEased * tailEased;

      const headAngle = trail.fromAngle + trail.deltaAngle * headEased;
      const tailAngle = trail.fromAngle + trail.deltaAngle * tailEasedSq;

      // Smooth fading envelope
      const alpha = Math.max(0, 1 - Math.pow(progress, 1.4));
      if (alpha <= 0.01) continue;

      const counterclockwise = trail.deltaAngle < 0;

      // Draw swept arc along the ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius, tailAngle, headAngle, counterclockwise);

      const grad = ctx.createLinearGradient(
        cx + radius * Math.cos(tailAngle),
        cy + radius * Math.sin(tailAngle),
        cx + radius * Math.cos(headAngle),
        cy + radius * Math.sin(headAngle)
      );
      grad.addColorStop(0, trail.colorFrom);
      grad.addColorStop(1, trail.colorTo);

      ctx.strokeStyle = grad;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.globalAlpha = alpha * 0.85;
      ctx.shadowColor = trail.colorTo;
      ctx.shadowBlur = 12 * config.glowBloom;
      ctx.stroke();

      // Kinetic comet spark at the leading head
      if (progress < 0.85) {
        const hx = cx + radius * Math.cos(headAngle);
        const hy = cy + radius * Math.sin(headAngle);
        ctx.beginPath();
        ctx.arc(hx, hy, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha;
        ctx.shadowColor = trail.colorTo;
        ctx.shadowBlur = 14;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawClockNodes(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    _minClockRadius: number,
    _maxClockRadius: number,
    ringRadii: number[],
    ringAlphas: number[],
    _activeRegisters: Set<number>,
    activeNotes: Map<number, ActiveNote>,
    decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>,
    config: VisualiserConfig,
    now: number
  ) {
    const tonic = config.tonic;
    const lowestMidi = config.keyboardLowestMidi ?? 21;
    const highestMidi = config.keyboardHighestMidi ?? 108;
    const baseCenterDo = getBaseCenterDo(tonic, lowestMidi);

    let pitchNames = PITCH_NAMES_DUAL;
    if (config.accidentalStyle === 'sharp') pitchNames = PITCH_NAMES_SHARP;
    else if (config.accidentalStyle === 'flat') pitchNames = PITCH_NAMES_FLAT;

    // Collect active/visible rings and sort by radius (outermost to innermost)
    const visibleRings: Array<{ reg: number; radius: number }> = [];
    for (let r = 0; r < 8; r++) {
      if (ringAlphas[r] > 0.05 && ringRadii[r] > 15) {
        visibleRings.push({ reg: r, radius: ringRadii[r] });
      }
    }
    visibleRings.sort((a, b) => b.radius - a.radius);

    // Pre-calculate collision-free base radius for each ring and map orbit rank (0 = outermost/largest)
    const ringBaseRadius = new Map<number, number>();
    const ringOrbitRank = new Map<number, number>();

    for (let i = 0; i < visibleRings.length; i++) {
      const { reg, radius } = visibleRings[i];
      ringOrbitRank.set(reg, i);

      // 1. Circumference chord clearance between adjacent 30-degree tones:
      // chord = 2 * R * sin(15 deg) ~= 0.5176 * R
      const chordDist = 2 * radius * Math.sin((15 * Math.PI) / 180);
      const safeChordR = chordDist * 0.38;

      // 2. Radial gap clearance to adjacent rings:
      let safeRadialR = 50;
      if (visibleRings.length > 1) {
        if (i === 0) {
          // Outermost ring: no outer ring to collide with! Only avoid colliding with inner neighbor ring (i = 1)
          const gapToInnerNeighbor = radius - visibleRings[1].radius;
          const canvasMargin = (Math.min(cx, cy) * 0.98) - radius;
          safeRadialR = Math.min(gapToInnerNeighbor * 0.44, Math.max(22, canvasMargin));
        } else if (i === visibleRings.length - 1) {
          // Innermost ring: no inner ring to collide with! Only avoid colliding with outer neighbor ring (i - 1)
          const gapToOuterNeighbor = visibleRings[i - 1].radius - radius;
          const centerMargin = radius - 10;
          safeRadialR = Math.min(gapToOuterNeighbor * 0.44, Math.max(14, centerMargin));
        } else {
          // Middle ring: constrained by both outer and inner neighbors
          const gapToOuterNeighbor = visibleRings[i - 1].radius - radius;
          const gapToInnerNeighbor = radius - visibleRings[i + 1].radius;
          const minNeighborGap = Math.min(gapToOuterNeighbor, gapToInnerNeighbor);
          safeRadialR = minNeighborGap * 0.44;
        }
      } else {
        // Only 1 ring visible: plenty of radial space!
        const canvasMargin = (Math.min(cx, cy) * 0.98) - radius;
        safeRadialR = Math.max(22, Math.min(55, canvasMargin));
      }

      // Tone circle radius dynamically scales to make full use of space without overlap!
      const maxAllowed = Math.min(safeChordR, safeRadialR);
      const maxCap = visibleRings.length <= 1 ? 38 : (visibleRings.length <= 2 ? 34 : 30);
      const safeBaseR = Math.max(4.5, Math.min(maxCap, maxAllowed));
      ringBaseRadius.set(reg, safeBaseR);
    }

    for (let r = 0; r < 8; r++) {
      const radius = ringRadii[r];
      const alpha = ringAlphas[r];
      if (alpha <= 0.02 || radius <= 10) continue;

      const baseNodeRadius = ringBaseRadius.get(r) ?? 7;
      const orbitRank = ringOrbitRank.get(r) ?? 0;
      const prioritySlot = Math.min(7, Math.max(0, orbitRank));
      const labelType = config.clockLabelPriorities?.[prioritySlot] ?? 'glyphs';

      for (let s = 0; s < 12; s++) {
        const toneKey = `${r}_${s}`;
        const isDiscovered = this.discoveredTones.has(toneKey);
        const toneAct = config.registerWeightMode === 'organic'
          ? (this.toneActivity.get(toneKey) ?? 0)
          : 1.0;

        // In 'played' mode, ONLY show tones that have been played or are within organic activity window
        if (config.toneRevealMode === 'played') {
          if (!isDiscovered) continue;
          if (config.registerWeightMode === 'organic' && toneAct <= 0.02) continue;
        }

        const popScale = this.tonePopScale.get(toneKey) ?? 1.0;
        const angle = getClockAngleRad(s);
        const nx = cx + radius * Math.cos(angle);
        const ny = cy + radius * Math.sin(angle);

        // Record exact rendered coordinates for particle bursts, lens flares, and shocks
        this.toneCoordinates.set(toneKey, {
          x: nx,
          y: ny,
          radius: baseNodeRadius,
          angle,
          semitone: s,
          registerIndex: r,
        });

        const pitchClass = (tonic + s) % 12;

        const nearestAddress = s <= 6 ? s : s - 12;
        const nodeMidi = (baseCenterDo + r * 12) + nearestAddress;
        const isWithinKeyboard = nodeMidi >= lowestMidi && nodeMidi <= highestMidi;

        // Notes outside the physical keyboard boundaries are omitted unless explicitly triggered by an extended MIDI instrument.
        if (!isWithinKeyboard && !isDiscovered) {
          continue;
        }

        const syllable = SOLFEGE_SYLLABLES[s];
        const spec = SOLFEGE_SPECS[syllable];
        const isFi = s === 6; // Fi is Tritone Axis

        // Solfege color
        const solfegeColor = spec.colorHex;

        // Check note activity
        let activeMatch: ActiveNote | null = null;
        for (const note of activeNotes.values()) {
          const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, config.keyboardLowestMidi);
          if (res.registerIndex === r && res.semitone === s) {
            activeMatch = note;
            break;
          }
        }

        let decayAlpha = 0;
        let decayMatch: ActiveNote | null = null;
        if (!activeMatch) {
          for (const { note, decayProgress } of decayingNotes.values()) {
            const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, config.keyboardLowestMidi);
            if (res.registerIndex === r && res.semitone === s) {
              decayAlpha = (1 - decayProgress) * note.velocity;
              decayMatch = note;
              break;
            }
          }
        }

        const isActive = activeMatch !== null;
        const isDecaying = decayAlpha > 0.01;
        const effectiveVelocity = activeMatch ? activeMatch.velocity : (decayMatch ? decayMatch.velocity : 0);

        // Kinetic sizing with popScale intro
        let nodeR = baseNodeRadius * popScale;
        if (isActive) {
          nodeR = baseNodeRadius * (1.12 + effectiveVelocity * 0.18) * popScale;
        } else if (isDecaying) {
          nodeR = baseNodeRadius * (1.0 + decayAlpha * 0.12) * popScale;
        }

        const toneFade = config.registerWeightMode === 'organic'
          ? Math.min(1.0, 0.15 + toneAct * 0.85)
          : 1.0;
        const nodeAlpha = alpha * toneFade;

        // 1. Draw Tone Node Circle Body
        ctx.save();
        ctx.globalAlpha = nodeAlpha;
        ctx.beginPath();
        ctx.arc(nx, ny, nodeR, 0, Math.PI * 2);

        if (isActive) {
          if (isFi) {
            // Fi active: brilliant diamond platinum white with obsidian shadow
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = (20 + effectiveVelocity * 25) * config.glowBloom;
            ctx.fill();

            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 3.0;
            ctx.stroke();
          } else {
            ctx.fillStyle = solfegeColor;
            ctx.shadowColor = solfegeColor;
            ctx.shadowBlur = (16 + effectiveVelocity * 22) * config.glowBloom;
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }

          // Kinetic shockwave pulse
          if (config.pulseShockwaves) {
            const pulse = (Math.sin(now * 0.012) + 1) * 0.5;
            ctx.beginPath();
            ctx.arc(nx, ny, nodeR + 4 + pulse * 8, 0, Math.PI * 2);
            ctx.strokeStyle = isFi ? '#ffffff' : solfegeColor;
            ctx.globalAlpha = 0.45 * (1 - pulse);
            ctx.lineWidth = 2.0;
            ctx.stroke();
          }
        } else if (isDecaying) {
          if (isFi) {
            ctx.fillStyle = `rgba(241, 245, 249, ${0.4 + decayAlpha * 0.6})`;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 12 * decayAlpha * config.glowBloom;
            ctx.fill();

            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 2.0;
            ctx.stroke();
          } else {
            ctx.fillStyle = solfegeColor;
            ctx.globalAlpha = Math.min(1.0, 0.25 + decayAlpha * 0.75);
            ctx.shadowColor = solfegeColor;
            ctx.shadowBlur = 12 * decayAlpha * config.glowBloom;
            ctx.fill();

            ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + decayAlpha * 0.65})`;
            ctx.lineWidth = 2.0;
            ctx.stroke();
          }
        } else {
          // Inactive idle state
          if (isFi) {
            if (config.glyphContrastMode === 'high') {
              ctx.fillStyle = '#0f172a';
              ctx.fill();

              ctx.strokeStyle = '#f8fafc'; // Crisp platinum white rim
              ctx.lineWidth = 2.4;
              ctx.stroke();
            } else {
              ctx.fillStyle = '#141414';
              ctx.fill();

              ctx.strokeStyle = '#64748b';
              ctx.lineWidth = 1.4;
              ctx.stroke();
            }
          } else {
            // Solfege degree
            const isHigh = config.glyphContrastMode === 'high';
            ctx.fillStyle = hexToRgba(solfegeColor, isHigh ? 0.30 : 0.20);
            ctx.fill();

            ctx.strokeStyle = isHigh ? '#ffffff' : hexToRgba(solfegeColor, 0.95);
            ctx.lineWidth = s === 0 ? 2.8 : (isHigh ? 1.8 : 1.5); // Emphasize Do
            ctx.stroke();
          }
        }
        ctx.restore();

        // 2. Draw Tone Node Labels
        this.renderNodeLabels(
          ctx,
          nx,
          ny,
          nodeR,
          s,
          pitchClass,
          syllable,
          pitchNames[pitchClass],
          solfegeColor,
          isActive,
          isDecaying,
          isFi,
          labelType,
          config,
          nodeAlpha
        );
      }
    }
  }

  private renderNodeLabels(
    ctx: CanvasRenderingContext2D,
    nx: number,
    ny: number,
    nodeR: number,
    semitone: number,
    pitchClass: number,
    syllable: string,
    pitchName: string,
    solfegeColor: string,
    isActive: boolean,
    isDecaying: boolean,
    isFi: boolean,
    labelType: string,
    config: VisualiserConfig,
    nodeAlpha: number = 1.0
  ) {
    ctx.save();
    ctx.globalAlpha = nodeAlpha;
    const isLit = isActive || isDecaying;

    // If labelType is 'none' or circle is too small (<8px), do not draw labels
    if (labelType === 'none' || nodeR < 8) {
      if (isLit) {
        ctx.beginPath();
        ctx.arc(nx, ny, Math.max(1.5, nodeR * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = isFi ? '#0f172a' : '#ffffff';
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // Priority 1: Piano Triangle SVG Representation
    if (labelType === 'triangles' && nodeR >= 12) {
      const ptInfo = PITCH_CLASS_TO_PIANO_TRIANGLE[pitchClass];
      const triSize = nodeR * 1.45;
      drawPianoTriangleOnCanvas(
        ctx,
        ptInfo.triangle as PianoTriangleType,
        ptInfo.point as PianoTrianglePoint,
        nx,
        ny,
        triSize,
        isFi ? '#f8fafc' : solfegeColor,
        isLit ? 'rgba(255, 255, 255, 0.95)' : (isFi ? 'rgba(248, 250, 252, 0.9)' : 'rgba(203, 213, 225, 0.6)'),
        'rgba(71, 85, 105, 0.4)'
      );
      ctx.restore();
      return;
    }

    // Priority 2: Uniform Solfège Vector Glyph (or fallback from triangles if nodeR is 10..12)
    if ((labelType === 'glyphs' || labelType === 'triangles') && nodeR >= 10) {
      const spec = SOLFEGE_SPECS[syllable];
      const glyphSize = nodeR * 1.35;

      drawUniformSolfegeOnCanvas(
        ctx,
        spec.glyphType,
        spec.rotation,
        nx,
        ny,
        glyphSize,
        isLit ? '#ffffff' : (isFi ? '#141414' : solfegeColor),
        undefined,
        isFi ? 3.0 : 2.0,
        config.glyphContrastMode === 'high'
      );
      ctx.restore();
      return;
    }

    // Priority 3: Text Label (Solfege Syllables / Note Names / Intervals)
    let labelText = '';
    if (labelType === 'syllables' || (labelType === 'glyphs' && nodeR < 10) || (labelType === 'triangles' && nodeR < 10)) {
      labelText = syllable;
    } else if (labelType === 'pitches') {
      labelText = pitchName;
    } else if (labelType === 'triPitches') {
      labelText = TRI_PITCH_CLASSES[pitchClass];
    } else if (labelType === 'intervals') {
      labelText = INTERVAL_NAMES[semitone];
    }

    if (labelText && nodeR >= 8) {
      const isHigh = config.glyphContrastMode === 'high';
      const textColor = isLit
        ? (isFi ? '#0f172a' : '#ffffff')
        : (isFi ? (isHigh ? '#f8fafc' : '#94a3b8') : '#f8fafc');

      ctx.fillStyle = textColor;
      const fontSize = Math.max(8, Math.min(22, Math.round(nodeR * 0.78)));
      ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (isLit) {
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
      }
      ctx.fillText(labelText, nx, ny);
    }

    ctx.restore();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
