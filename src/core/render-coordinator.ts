import {
  ActiveNote,
  StreamItem,
  VisualiserConfig,
  VisualiserModuleType,
} from './types';
import {
  SOLFEGE_SYLLABLES,
  SOLFEGE_SPECS,
  PITCH_NAMES_DUAL,
  PITCH_NAMES_SHARP,
  PITCH_NAMES_FLAT,
  INTERVAL_NAMES,
  PITCH_CLASS_TO_PIANO_TRIANGLE,
  TRI_PITCH_CLASSES,
  resolveMidiToRegisterAndSemitone,
  getClockAngleRad,
} from './ppt-constants';
import { DEFAULT_CONFIG } from './config';
import { midiManagerInstance } from './midi-manager';
import { synthInstance } from './audio-synth';
import { CosmeticsEngine } from '../renderers/cosmetics';
import { ScaleAlignmentTracker } from './scale-alignment';
import { PitchClockRenderer } from '../renderers/pitch-clock-canvas';
import { PianoTrianglesRenderer } from '../renderers/piano-triangles-canvas';
import { StreamRenderer } from '../renderers/stream-canvas';
import {
  WebGLPostProcessingPipeline,
  PostProcessingLight,
} from '../renderers/webgl-post-processing';

export interface CellCanvasEntry {
  id: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  module: VisualiserModuleType;
  configOverrides?: Partial<VisualiserConfig>;
}

export interface ScaleFitInfo {
  currentTonicFit: number;
  bestTonic: number;
  bestTonicFit: number;
  scoreMargin: number;
  shouldShift: boolean;
}

export type ActiveNotesListener = (notes: Map<number, ActiveNote>) => void;
export type ScaleFitListener = (info: ScaleFitInfo) => void;
export type AutoTonicShiftHandler = (newTonic: number) => void;

export class RenderCoordinator {
  // Live musical & animation state (bypassing React)
  public readonly activeNotes: Map<number, ActiveNote> = new Map();
  public readonly decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }> = new Map();
  public streamItems: StreamItem[] = [];

  // Dedicated Renderers & Engines
  public readonly cosmeticsEngine: CosmeticsEngine;
  public readonly scaleTracker: ScaleAlignmentTracker;
  public readonly pitchClockRenderer: PitchClockRenderer;
  public readonly pianoTrianglesRenderer: PianoTrianglesRenderer;
  public readonly streamRenderer: StreamRenderer;

  // WebGL Post-Processing Pipeline
  private postProcessingCanvas: HTMLCanvasElement | null = null;
  private webglPipeline: WebGLPostProcessingPipeline | null = null;

  // 2D Kinetic Effects Canvas (Sparks & Shockwaves)
  private effectsCanvas: HTMLCanvasElement | null = null;
  private effectsCtx: CanvasRenderingContext2D | null = null;

  // Configuration
  private config: VisualiserConfig;

  // Registered Canvases
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;

  private bgCanvas: HTMLCanvasElement | null = null;
  private bgCtx: CanvasRenderingContext2D | null = null;

  private readonly cellCanvases: Map<string, CellCanvasEntry> = new Map();

  // Listeners & Callbacks
  private readonly activeNotesListeners: Set<ActiveNotesListener> = new Set();
  private readonly scaleFitListeners: Set<ScaleFitListener> = new Set();
  public onAutoTonicShift?: AutoTonicShiftHandler;

  // Animation Frame Loop
  private animId: number | null = null;
  private isRunning: boolean = false;
  private lastFitUpdateTime: number = 0;

  // MIDI Unsubscribers
  private unsubMidiOn?: () => void;
  private unsubMidiOff?: () => void;

  constructor(initialConfig: VisualiserConfig = DEFAULT_CONFIG) {
    this.config = initialConfig;
    this.cosmeticsEngine = new CosmeticsEngine();
    this.scaleTracker = new ScaleAlignmentTracker();
    this.pitchClockRenderer = new PitchClockRenderer();
    this.pianoTrianglesRenderer = new PianoTrianglesRenderer();
    this.streamRenderer = new StreamRenderer();

    // Subscribe to MIDI events directly
    this.unsubMidiOn = midiManagerInstance.onNoteOn((midi, vel) => this.triggerNoteOn(midi, vel));
    this.unsubMidiOff = midiManagerInstance.onNoteOff((midi) => this.triggerNoteOff(midi));

    // Start master animation loop if running in browser environment
    if (typeof window !== 'undefined' && typeof requestAnimationFrame !== 'undefined') {
      this.start();
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    if (typeof requestAnimationFrame !== 'undefined') {
      this.animId = requestAnimationFrame(this.masterLoop);
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.animId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  public destroy() {
    this.stop();
    if (this.unsubMidiOn) this.unsubMidiOn();
    if (this.unsubMidiOff) this.unsubMidiOff();
    this.activeNotesListeners.clear();
    this.scaleFitListeners.clear();
    this.cellCanvases.clear();
    if (this.webglPipeline) {
      this.webglPipeline.destroy();
      this.webglPipeline = null;
    }
    this.postProcessingCanvas = null;
    this.effectsCanvas = null;
    this.effectsCtx = null;
    this.overlayCanvas = null;
    this.overlayCtx = null;
    this.bgCanvas = null;
    this.bgCtx = null;
  }

  public setConfig(config: VisualiserConfig) {
    const themeChanged = config.backgroundTheme !== this.config.backgroundTheme;
    const synthChanged =
      config.soundEnabled !== this.config.soundEnabled ||
      config.masterVolume !== this.config.masterVolume ||
      config.synthWaveform !== this.config.synthWaveform;

    this.config = config;

    if (synthChanged) {
      synthInstance.setMuted(!config.soundEnabled);
      synthInstance.setVolume(config.masterVolume);
      synthInstance.setWaveform(config.synthWaveform);
    }

    if (themeChanged) {
      this.renderBackground();
    }
  }

  public getConfig(): VisualiserConfig {
    return this.config;
  }

  public resetSession() {
    this.activeNotes.clear();
    this.decayingNotes.clear();
    this.streamItems = [];
    this.pitchClockRenderer.resetRevealsAndActivity();
    this.scaleTracker.reset();
    for (const listener of this.activeNotesListeners) {
      listener(this.activeNotes);
    }
  }

  public subscribeActiveNotes(listener: ActiveNotesListener): () => void {
    this.activeNotesListeners.add(listener);
    listener(this.activeNotes);
    return () => {
      this.activeNotesListeners.delete(listener);
    };
  }

  public subscribeScaleFit(listener: ScaleFitListener): () => void {
    this.scaleFitListeners.add(listener);
    return () => {
      this.scaleFitListeners.delete(listener);
    };
  }

  public registerPostProcessingCanvas(canvas: HTMLCanvasElement) {
    this.postProcessingCanvas = canvas;
    if (this.webglPipeline) {
      this.webglPipeline.destroy();
    }
    this.webglPipeline = new WebGLPostProcessingPipeline(canvas);
  }

  public unregisterPostProcessingCanvas() {
    if (this.webglPipeline) {
      this.webglPipeline.destroy();
      this.webglPipeline = null;
    }
    this.postProcessingCanvas = null;
  }

  public registerEffectsCanvas(canvas: HTMLCanvasElement) {
    this.effectsCanvas = canvas;
    this.effectsCtx = canvas.getContext('2d');
  }

  public unregisterEffectsCanvas() {
    this.effectsCanvas = null;
    this.effectsCtx = null;
  }

  public registerOverlayCanvas(canvas: HTMLCanvasElement) {
    this.overlayCanvas = canvas;
    this.overlayCtx = canvas.getContext('2d');
  }

  public unregisterOverlayCanvas() {
    this.overlayCanvas = null;
    this.overlayCtx = null;
  }

  public registerBgCanvas(canvas: HTMLCanvasElement) {
    this.bgCanvas = canvas;
    this.bgCtx = canvas.getContext('2d');
    this.renderBackground();
  }

  public unregisterBgCanvas() {
    this.bgCanvas = null;
    this.bgCtx = null;
  }

  public renderBackground() {
    if (!this.bgCanvas || !this.bgCtx) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = this.bgCanvas.width / dpr;
    const height = this.bgCanvas.height / dpr;
    if (width <= 0 || height <= 0) return;

    this.bgCtx.save();
    this.bgCtx.scale(dpr, dpr);
    this.cosmeticsEngine.renderBackground(this.bgCtx, width, height, this.config.backgroundTheme);
    this.bgCtx.restore();
  }

  public registerCellCanvas(
    id: string,
    canvas: HTMLCanvasElement,
    module: VisualiserModuleType,
    configOverrides?: Partial<VisualiserConfig>
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.cellCanvases.set(id, {
      id,
      canvas,
      ctx,
      module,
      configOverrides,
    });
  }

  public updateCellCanvas(
    id: string,
    module: VisualiserModuleType,
    configOverrides?: Partial<VisualiserConfig>
  ) {
    const existing = this.cellCanvases.get(id);
    if (existing) {
      existing.module = module;
      existing.configOverrides = configOverrides;
    }
  }

  public unregisterCellCanvas(id: string) {
    this.cellCanvases.delete(id);
  }

  public triggerNoteOn = (midi: number, velocity: number = 0.8) => {
    const now = performance.now();
    const pc = ((midi % 12) + 12) % 12;
    const res = resolveMidiToRegisterAndSemitone(midi, this.config.tonic, this.config.keyboardLowestMidi);
    const syllable = SOLFEGE_SYLLABLES[res.semitone];
    const spec = SOLFEGE_SPECS[syllable];
    const ptInfo = PITCH_CLASS_TO_PIANO_TRIANGLE[pc];

    let pitchNames = PITCH_NAMES_DUAL;
    if (this.config.accidentalStyle === 'sharp') pitchNames = PITCH_NAMES_SHARP;
    else if (this.config.accidentalStyle === 'flat') pitchNames = PITCH_NAMES_FLAT;

    const pitchName = pitchNames[pc];
    const interval = INTERVAL_NAMES[res.semitone];

    const noteObj: ActiveNote = {
      midi,
      pitchClass: pc,
      octave: res.octave,
      registerIndex: res.registerIndex,
      velocity,
      startTime: now,
      colorHex: spec.colorHex,
      solfege: syllable,
      pianoTriangle: ptInfo,
    };

    // Synthesize audio
    if (this.config.soundEnabled) {
      synthInstance.noteOn(midi, velocity);
    }

    // Active notes state
    this.activeNotes.set(midi, noteObj);

    // Remove from decaying notes if retriggered
    this.decayingNotes.delete(midi);

    // Spawn cosmetic particles using exact tone circle coordinates if available
    let sparkX: number;
    let sparkY: number;
    let radialAngle: number;

    const coords = this.pitchClockRenderer.getToneCoordinates(
      midi,
      this.config.tonic,
      this.config.keyboardLowestMidi
    );

    let orbitalCellCanvas: HTMLCanvasElement | null = null;
    for (const cell of this.cellCanvases.values()) {
      if (cell.module === 'orbital') {
        orbitalCellCanvas = cell.canvas;
        break;
      }
    }

    if (coords && orbitalCellCanvas && this.overlayCanvas) {
      const cellRect = orbitalCellCanvas.getBoundingClientRect();
      const overlayRect = this.overlayCanvas.getBoundingClientRect();
      sparkX = (cellRect.left - overlayRect.left) + coords.x;
      sparkY = (cellRect.top - overlayRect.top) + coords.y;
      radialAngle = coords.angle;
    } else {
      const angle = getClockAngleRad(res.semitone);
      const vpW = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const vpH = typeof window !== 'undefined' ? window.innerHeight : 1080;
      const radius = Math.min(vpW, vpH) * 0.3 * (1 - res.registerIndex / 10);
      sparkX = vpW / 2 + radius * Math.cos(angle);
      sparkY = vpH / 2 + radius * Math.sin(angle);
      radialAngle = angle;
    }

    if (this.config.particleIntensity > 0) {
      this.cosmeticsEngine.spawnNoteSparks(
        sparkX,
        sparkY,
        spec.colorHex,
        velocity,
        Math.round(20 * this.config.particleIntensity),
        this.config.particleSize,
        this.config.particleVolume,
        this.config.particleGravity,
        this.config.particleOriginDistance,
        radialAngle
      );
    }
    if (this.config.pulseShockwaves) {
      this.cosmeticsEngine.spawnShockwave(sparkX, sparkY, spec.colorHex, 65 + velocity * 30);
    }

    // Add to Note Stream with mode-aware buffer
    const streamItem: StreamItem = {
      id: `${midi}-${now}-${Math.random()}`,
      midi,
      pitchClass: pc,
      octave: res.octave,
      velocity,
      timestamp: now / 1000,
      colorHex: spec.colorHex,
      solfege: syllable,
      pitchName,
      triPitchName: TRI_PITCH_CLASSES[pc],
      interval,
      pianoTriangle: ptInfo,
      glyphType: spec.glyphType,
      rotation: spec.rotation,
    };

    const nowSec = now / 1000;
    if (this.config.streamMode === 'continuous') {
      const maxAgeSec = 60;
      let startIndex = 0;
      while (startIndex < this.streamItems.length && nowSec - this.streamItems[startIndex].timestamp > maxAgeSec) {
        startIndex++;
      }
      if (startIndex > 0) {
        this.streamItems = this.streamItems.slice(startIndex);
      }
      if (this.streamItems.length >= 1200) {
        this.streamItems = this.streamItems.slice(this.streamItems.length - 1199);
      }
      this.streamItems.push(streamItem);
    } else {
      const limit = Math.max(48, (this.config.fixedWindowSize || 8) * 2);
      if (this.streamItems.length >= limit) {
        this.streamItems = this.streamItems.slice(-limit + 1);
      }
      this.streamItems.push(streamItem);
    }

    // Notify active notes listeners
    if (this.activeNotesListeners.size > 0) {
      for (const listener of this.activeNotesListeners) {
        listener(this.activeNotes);
      }
    }
  };

  public triggerNoteOff = (midi: number) => {
    const now = performance.now();

    // Release audio synth voice
    synthInstance.noteOff(midi);

    const active = this.activeNotes.get(midi);
    if (!active) return;

    this.activeNotes.delete(midi);

    // Begin decay animation in mutable map
    const noteCopy = { ...active, releaseTime: now };
    this.decayingNotes.set(midi, { note: noteCopy, decayProgress: 0 });

    // Notify active notes listeners
    if (this.activeNotesListeners.size > 0) {
      for (const listener of this.activeNotesListeners) {
        listener(this.activeNotes);
      }
    }
  };

  private masterLoop = (time: number) => {
    if (!this.isRunning) return;

    const now = performance.now();
    const decayDuration = this.config.decayDurationMs;

    // 1. Tick note decay in-place on mutable map
    if (this.decayingNotes.size > 0) {
      for (const [midi, data] of this.decayingNotes.entries()) {
        const elapsed = now - (data.note.releaseTime || now);
        const progress = Math.min(1.0, elapsed / decayDuration);

        if (progress >= 1.0) {
          this.decayingNotes.delete(midi);
        } else {
          data.decayProgress = progress;
        }
      }
    }

    // 2. Tick scale alignment tracker
    const alignRes = this.scaleTracker.update(
      now,
      this.activeNotes.values(),
      this.decayingNotes.values(),
      this.config
    );

    if (
      this.config.autoTonicEnabled &&
      alignRes.shouldShift &&
      alignRes.newTonic !== undefined &&
      alignRes.newTonic !== this.config.tonic
    ) {
      if (this.onAutoTonicShift) {
        this.onAutoTonicShift(alignRes.newTonic);
      }
    }

    if (now - this.lastFitUpdateTime > 180) {
      this.lastFitUpdateTime = now;
      const fitInfo: ScaleFitInfo = {
        currentTonicFit: alignRes.currentTonicFit,
        bestTonic: alignRes.bestTonic,
        bestTonicFit: alignRes.bestTonicFit,
        scoreMargin: alignRes.scoreMargin,
        shouldShift: alignRes.shouldShift,
      };
      for (const listener of this.scaleFitListeners) {
        listener(fitInfo);
      }
    }

    // 3. Render all registered cell canvases in coordinated lockstep
    for (const cell of this.cellCanvases.values()) {
      const { canvas, ctx, module, configOverrides } = cell;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      if (width <= 0 || height <= 0) continue;

      const effectiveConfig = configOverrides
        ? { ...this.config, ...configOverrides }
        : this.config;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      if (module === 'orbital') {
        this.pitchClockRenderer.render(
          ctx,
          width,
          height,
          this.activeNotes,
          this.decayingNotes,
          effectiveConfig,
          time
        );
      } else if (module === 'triangles') {
        this.pianoTrianglesRenderer.render(
          ctx,
          width,
          height,
          this.activeNotes,
          this.decayingNotes,
          effectiveConfig,
          time
        );
      } else {
        this.streamRenderer.render(
          ctx,
          0,
          0,
          width,
          height,
          this.streamItems,
          effectiveConfig,
          time
        );
      }

      ctx.restore();
    }

    // 4. Update procedural kinetics, sparks, and phosphor physics
    this.cosmeticsEngine.update();

    // 5. Render 2D kinetic sparks & expanding shockwave rings
    if (this.effectsCanvas && this.effectsCtx) {
      const canvas = this.effectsCanvas;
      const ctx = this.effectsCtx;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width > 0 && height > 0) {
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        this.cosmeticsEngine.renderEffects(ctx, this.config.glowBloom);
        ctx.restore();
      }
    }

    // 6. Render Fullscreen Atmospheric Post-Processing
    if (this.webglPipeline && this.webglPipeline.supported) {
      // Hardware GPU Shader Pipeline (WebGL)
      const lights = this.collectFlareLightSources();
      this.webglPipeline.render(this.config, lights, time);
    } else if (this.overlayCanvas && this.overlayCtx) {
      // Canvas 2D Fallback
      const canvas = this.overlayCanvas;
      const ctx = this.overlayCtx;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width > 0 && height > 0) {
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // Analog halation, phosphor ghosts & photorealistic lens flares
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.45;
        this.cosmeticsEngine.renderAnalogArtifacts(
          ctx,
          width,
          height,
          this.activeNotes,
          this.decayingNotes,
          cx,
          cy,
          radius,
          this.config
        );

        // Reactive sparks & shockwaves (if effects canvas not separately rendered)
        if (!this.effectsCanvas) {
          this.cosmeticsEngine.renderEffects(ctx, this.config.glowBloom);
        }

        // Whole-display CRT scanlines & glass curvature vignette
        this.cosmeticsEngine.renderScanlines(
          ctx,
          width,
          height,
          this.config.scanlineIntensity,
          this.config.scanlineDensity,
          this.config.crtVignette
        );

        // Whole-display film grain overlay
        this.cosmeticsEngine.renderFilmGrain(
          ctx,
          width,
          height,
          this.config.filmGrainIntensity,
          this.config.filmGrainSize,
          this.config.filmGrainContrast
        );

        ctx.restore();
      }
    }

    this.animId = requestAnimationFrame(this.masterLoop);
  };

  private collectFlareLightSources(): PostProcessingLight[] {
    const lights: PostProcessingLight[] = [];
    if (
      (this.config.lightBleedIntensity <= 0.01 && this.config.lensFlareIntensity <= 0.01) ||
      (this.activeNotes.size === 0 && this.decayingNotes.size === 0)
    ) {
      return lights;
    }

    const tonic = this.config.tonic;
    const lowestMidi = this.config.keyboardLowestMidi;

    let orbitalCellCanvas: HTMLCanvasElement | null = null;
    for (const cell of this.cellCanvases.values()) {
      if (cell.module === 'orbital') {
        orbitalCellCanvas = cell.canvas;
        break;
      }
    }

    const targetCanvas = this.postProcessingCanvas || this.overlayCanvas;
    let offsetLeft = 0;
    let offsetTop = 0;
    if (orbitalCellCanvas && targetCanvas && typeof window !== 'undefined') {
      const cellRect = orbitalCellCanvas.getBoundingClientRect();
      const targetRect = targetCanvas.getBoundingClientRect();
      offsetLeft = cellRect.left - targetRect.left;
      offsetTop = cellRect.top - targetRect.top;
    }

    // 1. Active notes
    for (const note of this.activeNotes.values()) {
      const coords = this.pitchClockRenderer.getToneCoordinates(note.midi, tonic, lowestMidi);
      let lx: number;
      let ly: number;
      if (coords) {
        lx = offsetLeft + coords.x;
        ly = offsetTop + coords.y;
      } else {
        const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, lowestMidi);
        const angle = getClockAngleRad(res.semitone);
        const vpW = targetCanvas ? targetCanvas.width / (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) : 1920;
        const vpH = targetCanvas ? targetCanvas.height / (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) : 1080;
        const radius = Math.min(vpW, vpH) * 0.3 * (1 - res.registerIndex / 10);
        lx = vpW / 2 + radius * Math.cos(angle);
        ly = vpH / 2 + radius * Math.sin(angle);
      }
      lights.push({
        x: lx,
        y: ly,
        velocity: note.velocity,
        colorHex: note.colorHex,
      });
    }

    // 2. Decaying notes
    for (const { note, decayProgress } of this.decayingNotes.values()) {
      const vel = note.velocity * (1 - decayProgress);
      if (vel <= 0.04) continue;
      const coords = this.pitchClockRenderer.getToneCoordinates(note.midi, tonic, lowestMidi);
      let lx: number;
      let ly: number;
      if (coords) {
        lx = offsetLeft + coords.x;
        ly = offsetTop + coords.y;
      } else {
        const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, lowestMidi);
        const angle = getClockAngleRad(res.semitone);
        const vpW = targetCanvas ? targetCanvas.width / (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) : 1920;
        const vpH = targetCanvas ? targetCanvas.height / (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) : 1080;
        const radius = Math.min(vpW, vpH) * 0.3 * (1 - res.registerIndex / 10);
        lx = vpW / 2 + radius * Math.cos(angle);
        ly = vpH / 2 + radius * Math.sin(angle);
      }
      lights.push({
        x: lx,
        y: ly,
        velocity: vel,
        colorHex: note.colorHex,
      });
    }

    if (lights.length > 8) {
      lights.sort((a, b) => b.velocity - a.velocity);
    }

    return lights;
  }
}

export const renderCoordinatorInstance = new RenderCoordinator(DEFAULT_CONFIG);
