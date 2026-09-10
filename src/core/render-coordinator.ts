import {
  ActiveNote,
  StreamItem,
  TonicShiftMarker,
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
  getDecayFadeFactor,
} from './ppt-constants';
import { DEFAULT_CONFIG } from './config';
import { midiManagerInstance } from './midi-manager';
import { synthInstance } from './audio-synth';
import { midiPlayerInstance } from './midi-file-player';
import { CosmeticsEngine } from '../renderers/cosmetics';
import { ScaleAlignmentTracker } from './scale-alignment';
import { PitchClockRenderer } from '../renderers/pitch-clock-canvas';
import { PianoTrianglesRenderer } from '../renderers/piano-triangles-canvas';
import { StreamRenderer } from '../renderers/stream-canvas';
import { StaffStreamRenderer } from '../renderers/staff-stream-canvas';
import { OvertonesRenderer } from '../renderers/overtones-canvas';
import {
  WebGLPostProcessingPipeline,
  PostProcessingLight,
} from '../renderers/webgl-post-processing';

export interface CachedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CellCanvasEntry {
  id: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  module: VisualiserModuleType;
  configOverrides?: Partial<VisualiserConfig>;
  cachedRect?: CachedRect;
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
export type TonicShiftListener = (oldTonic: number, newTonic: number, isAuto: boolean) => void;

export class RenderCoordinator {
  // Live musical & animation state (bypassing React)
  public readonly activeNotes: Map<number, ActiveNote> = new Map();
  public readonly decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }> = new Map();
  public streamItems: StreamItem[] = [];
  public tonicShiftMarkers: TonicShiftMarker[] = [];

  // Dedicated Renderers & Engines
  public readonly cosmeticsEngine: CosmeticsEngine;
  public readonly scaleTracker: ScaleAlignmentTracker;
  public readonly pitchClockRenderer: PitchClockRenderer;
  public readonly pianoTrianglesRenderer: PianoTrianglesRenderer;
  public readonly streamRenderer: StreamRenderer;
  public readonly staffStreamRenderer: StaffStreamRenderer;
  public readonly overtonesRenderer: OvertonesRenderer;

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
  private cachedTargetRect: CachedRect | null = null;

  // Listeners & Callbacks
  private readonly activeNotesListeners: Set<ActiveNotesListener> = new Set();
  private readonly scaleFitListeners: Set<ScaleFitListener> = new Set();
  private readonly tonicShiftListeners: Set<TonicShiftListener> = new Set();
  public onAutoTonicShift?: AutoTonicShiftHandler;
  private lastShiftWasAuto: boolean = false;

  // Animation Frame Loop
  private animId: number | null = null;
  private isRunning: boolean = false;
  private lastFitUpdateTime: number = 0;

  // Real-time focus and multi-instance management
  private mockFocusedState: boolean | null = null;

  // MIDI Unsubscribers
  private unsubMidiOn?: () => void;
  private unsubMidiOff?: () => void;

  private handleFocusChange = () => {
    const focused = this.isWindowFocused();
    if (!focused && (this.config.focusModeEnabled ?? true)) {
      this.clearActiveAndDecayingNotes();
    }
  };

  /**
   * Updates cached DOM bounding client rectangles for all registered cell canvases
   * and the target effects/WebGL canvas. Executed strictly on window resize or canvas registration,
   * completely eliminating DOM layout thrashing and forced reflows from the 60 FPS animation loop.
   */
  public updateAllCachedBounds = () => {
    if (typeof window === 'undefined') return;
    const target = this.postProcessingCanvas || this.effectsCanvas || this.overlayCanvas;
    if (target && typeof target.getBoundingClientRect === 'function') {
      const r = target.getBoundingClientRect();
      this.cachedTargetRect = { left: r.left, top: r.top, width: r.width, height: r.height };
    } else {
      this.cachedTargetRect = null;
    }

    for (const cell of this.cellCanvases.values()) {
      if (cell.canvas && typeof cell.canvas.getBoundingClientRect === 'function') {
        const cr = cell.canvas.getBoundingClientRect();
        cell.cachedRect = { left: cr.left, top: cr.top, width: cr.width, height: cr.height };
      }
    }
  };

  constructor(initialConfig: VisualiserConfig = DEFAULT_CONFIG) {
    this.config = initialConfig;
    this.cosmeticsEngine = new CosmeticsEngine();
    this.scaleTracker = new ScaleAlignmentTracker();
    this.pitchClockRenderer = new PitchClockRenderer();
    this.pianoTrianglesRenderer = new PianoTrianglesRenderer();
    this.streamRenderer = new StreamRenderer();
    this.staffStreamRenderer = new StaffStreamRenderer();
    this.overtonesRenderer = new OvertonesRenderer();

    // Propagate initial focusMode setting to engines
    const focusMode = initialConfig.focusModeEnabled ?? true;
    midiManagerInstance.setFocusMode(focusMode);
    synthInstance.setFocusMode(focusMode);
    midiPlayerInstance.setFocusMode(focusMode);

    // Subscribe to Staff Stream boundary absorption events for particle dissipation mist
    this.staffStreamRenderer.onNoteAbsorbed = (x, y, colorHex, noteSize) => {
      const targetRect = this.cachedTargetRect;
      if (!targetRect) return;

      for (const cell of this.cellCanvases.values()) {
        if (cell.module === 'staff-stream' && cell.cachedRect) {
          const effConfig = cell.configOverrides
            ? { ...this.config, ...cell.configOverrides }
            : this.config;
          if (effConfig.staffAbsorptionEnabled !== false) {
            const cellLeft = cell.cachedRect.left - targetRect.left;
            const cellTop = cell.cachedRect.top - targetRect.top;
            this.cosmeticsEngine.spawnAbsorptionEffect(
              cellLeft + x,
              cellTop + y,
              colorHex,
              noteSize * 2.6
            );
          }
          break;
        }
      }
    };

    // Subscribe to MIDI events directly
    this.unsubMidiOn = midiManagerInstance.onNoteOn((midi, vel) => this.triggerNoteOn(midi, vel));
    this.unsubMidiOff = midiManagerInstance.onNoteOff((midi) => this.triggerNoteOff(midi));

    // Register focus/blur and resize lifecycle listeners
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', this.handleFocusChange);
      window.addEventListener('blur', this.handleFocusChange);
      window.addEventListener('resize', this.updateAllCachedBounds);
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', this.handleFocusChange);
    }

    // Start master animation loop if running in browser environment
    if (typeof window !== 'undefined' && typeof requestAnimationFrame !== 'undefined') {
      this.start();
    }
  }

  public isWindowFocused(): boolean {
    if (this.mockFocusedState !== null) return this.mockFocusedState;
    if (typeof document === 'undefined') return true;
    return document.hasFocus() && !document.hidden;
  }

  public setFocusedForTesting(focused: boolean | null) {
    this.mockFocusedState = focused;
    this.handleFocusChange();
  }

  public clearActiveAndDecayingNotes() {
    if (this.activeNotes.size > 0 || this.decayingNotes.size > 0) {
      this.activeNotes.clear();
      this.decayingNotes.clear();
      synthInstance.stopAll(true);
      for (const listener of this.activeNotesListeners) {
        listener(this.activeNotes);
      }
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
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('focus', this.handleFocusChange);
      window.removeEventListener('blur', this.handleFocusChange);
      window.removeEventListener('resize', this.updateAllCachedBounds);
    }
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', this.handleFocusChange);
    }
    if (this.unsubMidiOn) this.unsubMidiOn();
    if (this.unsubMidiOff) this.unsubMidiOff();
    this.activeNotesListeners.clear();
    this.scaleFitListeners.clear();
    this.tonicShiftListeners.clear();
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
    const focusChanged = config.focusModeEnabled !== this.config.focusModeEnabled;
    const tonicChanged = config.tonic !== this.config.tonic;
    const oldTonic = this.config.tonic;

    this.config = config;

    if (focusChanged) {
      const focusMode = config.focusModeEnabled ?? true;
      midiManagerInstance.setFocusMode(focusMode);
      synthInstance.setFocusMode(focusMode);
      midiPlayerInstance.setFocusMode(focusMode);
      if (!this.isWindowFocused() && focusMode) {
        this.clearActiveAndDecayingNotes();
      }
    }

    if (synthChanged) {
      synthInstance.setMuted(!config.soundEnabled);
      synthInstance.setVolume(config.masterVolume);
      synthInstance.setWaveform(config.synthWaveform);
    }

    if (themeChanged) {
      this.renderBackground();
    }

    if (tonicChanged) {
      this.triggerTonicShift(oldTonic, config.tonic, this.lastShiftWasAuto);
      this.lastShiftWasAuto = false;
    }
  }

  public getConfig(): VisualiserConfig {
    return this.config;
  }

  public resetSession() {
    this.activeNotes.clear();
    this.decayingNotes.clear();
    this.streamItems = [];
    this.tonicShiftMarkers = [];
    this.pitchClockRenderer.resetRevealsAndActivity();
    this.staffStreamRenderer.reset();
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

  public subscribeTonicShift(listener: TonicShiftListener): () => void {
    this.tonicShiftListeners.add(listener);
    return () => {
      this.tonicShiftListeners.delete(listener);
    };
  }

  public triggerTonicShift(oldTonic: number, newTonic: number, isAuto: boolean = false) {
    if (oldTonic === newTonic) return;

    // Always re-align pitch clock tone circles even if kinetic animations are disabled
    this.pitchClockRenderer.remapTonic(newTonic, this.config.keyboardLowestMidi);

    if (this.config.tonicShiftEffectsEnabled !== false) {
      if (!this.cachedTargetRect && typeof window !== 'undefined') {
        this.updateAllCachedBounds();
      }

      // Find orbital clock center and radius on the effects canvas (if available)
      let orbitalCell: CellCanvasEntry | null = null;
      for (const cell of this.cellCanvases.values()) {
        if (cell.module === 'orbital') {
          orbitalCell = cell;
          break;
        }
      }

      let clockCx = (typeof window !== 'undefined' ? window.innerWidth : 1920) / 2;
      let clockCy = (typeof window !== 'undefined' ? window.innerHeight : 1080) / 2;
      let clockRadius = Math.min(clockCx, clockCy) * 0.45;

      if (orbitalCell && orbitalCell.cachedRect && this.cachedTargetRect) {
        const cellRect = orbitalCell.cachedRect;
        const targetRect = this.cachedTargetRect;
        clockCx = (cellRect.left - targetRect.left) + cellRect.width / 2;
        clockCy = (cellRect.top - targetRect.top) + cellRect.height / 2;
        clockRadius = Math.min(cellRect.width, cellRect.height) * 0.45;
      }

      // 1. Cosmetics Engine shockwaves, orbital particles, and HUD banner
      this.cosmeticsEngine.spawnTonicShift(clockCx, clockCy, oldTonic, newTonic, isAuto, clockRadius);

      // 2. Pitch Clock compass sweep arc and Do zenith beacon
      this.pitchClockRenderer.triggerTonicShift(oldTonic, newTonic);

      // 3. Piano Triangles Do anchor beam surge and vertex ripple
      this.pianoTrianglesRenderer.triggerTonicShift(oldTonic, newTonic);

      // 4. Note stream timeline modulation marker
      const nowSec = performance.now() / 1000;
      this.tonicShiftMarkers.push({
        id: `tonic-${performance.now()}`,
        oldTonic,
        newTonic,
        timestamp: nowSec,
        isAuto,
      });

      // Keep maximum 40 recent timeline markers
      if (this.tonicShiftMarkers.length > 40) {
        this.tonicShiftMarkers = this.tonicShiftMarkers.slice(-40);
      }
    }

    // Notify tonic shift listeners (e.g. Virtual Keyboard)
    for (const listener of this.tonicShiftListeners) {
      listener(oldTonic, newTonic, isAuto);
    }
  }

  public registerPostProcessingCanvas(canvas: HTMLCanvasElement) {
    this.postProcessingCanvas = canvas;
    if (this.webglPipeline) {
      this.webglPipeline.destroy();
    }
    this.webglPipeline = new WebGLPostProcessingPipeline(canvas);
    this.updateAllCachedBounds();
  }

  public unregisterPostProcessingCanvas() {
    if (this.webglPipeline) {
      this.webglPipeline.destroy();
      this.webglPipeline = null;
    }
    this.postProcessingCanvas = null;
    this.updateAllCachedBounds();
  }

  public registerEffectsCanvas(canvas: HTMLCanvasElement) {
    this.effectsCanvas = canvas;
    this.effectsCtx = canvas.getContext('2d');
    this.updateAllCachedBounds();
  }

  public unregisterEffectsCanvas() {
    this.effectsCanvas = null;
    this.effectsCtx = null;
    this.updateAllCachedBounds();
  }

  public registerOverlayCanvas(canvas: HTMLCanvasElement) {
    this.overlayCanvas = canvas;
    this.overlayCtx = canvas.getContext('2d');
    this.updateAllCachedBounds();
  }

  public unregisterOverlayCanvas() {
    this.overlayCanvas = null;
    this.overlayCtx = null;
    this.updateAllCachedBounds();
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
    this.updateAllCachedBounds();
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
      this.updateAllCachedBounds();
    }
  }

  public unregisterCellCanvas(id: string) {
    this.cellCanvases.delete(id);
    this.updateAllCachedBounds();
  }

  public isContinuousStreamingActive(): boolean {
    if (this.config.streamMode === 'continuous' || this.config.staffStreamMode === 'continuous') {
      return true;
    }
    for (const cell of this.cellCanvases.values()) {
      if (cell.module === 'stream') {
        const mode = cell.configOverrides?.streamMode ?? this.config.streamMode;
        if (mode === 'continuous') return true;
      }
      if (cell.module === 'staff-stream') {
        const mode = cell.configOverrides?.staffStreamMode ?? this.config.staffStreamMode ?? 'continuous';
        if (mode === 'continuous') return true;
      }
    }
    return false;
  }

  public triggerNoteOn = (midi: number, velocity: number = 0.8) => {
    if ((this.config.focusModeEnabled ?? true) && !this.isWindowFocused()) {
      return;
    }
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

    const targetCanvas = this.effectsCanvas || this.overlayCanvas || this.postProcessingCanvas;
    if (orbitalCellCanvas && targetCanvas && typeof window !== 'undefined') {
      const cellRect = orbitalCellCanvas.getBoundingClientRect();
      const overlayRect = targetCanvas.getBoundingClientRect();
      const clockCx = (cellRect.left - overlayRect.left) + cellRect.width / 2;
      const clockCy = (cellRect.top - overlayRect.top) + cellRect.height / 2;

      if (coords) {
        sparkX = (cellRect.left - overlayRect.left) + coords.x;
        sparkY = (cellRect.top - overlayRect.top) + coords.y;
        radialAngle = coords.angle;
      } else {
        const angle = getClockAngleRad(res.semitone);
        const maxClockRadius = Math.min(cellRect.width, cellRect.height) * 0.45;
        const radius = maxClockRadius * (0.85 - res.registerIndex * 0.08);
        sparkX = clockCx + radius * Math.cos(angle);
        sparkY = clockCy + radius * Math.sin(angle);
        radialAngle = angle;
      }
    } else {
      const angle = getClockAngleRad(res.semitone);
      const vpW = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const vpH = typeof window !== 'undefined' ? window.innerHeight : 1080;
      const radius = Math.min(vpW, vpH) * 0.3 * (1 - res.registerIndex / 10);
      sparkX = vpW / 2 + radius * Math.cos(angle);
      sparkY = vpH / 2 + radius * Math.sin(angle);
      radialAngle = angle;
    }

    const sparksOn = (this.config.sparksEnabled ?? true) && this.config.particleIntensity > 0;
    const shockwavesOn = (this.config.shockwavesEnabled ?? true) && this.config.pulseShockwaves !== false;
    const shockwaveRadiusMult = this.config.shockwaveRadius ?? 1.0;
    const shockwaveSpeedMult = this.config.shockwaveSpeed ?? 1.0;
    const shockwaveDecayDuration = this.config.shockwaveDecayDurationMs ?? 650;

    if (orbitalCellCanvas || this.cellCanvases.size === 0) {
      if (sparksOn) {
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
      if (shockwavesOn) {
        this.cosmeticsEngine.spawnShockwave(
          sparkX,
          sparkY,
          spec.colorHex,
          65 + velocity * 30,
          shockwaveRadiusMult,
          shockwaveSpeedMult,
          shockwaveDecayDuration
        );
      }
    }

    // Additional cell-specific note kinetics
    if (targetCanvas && typeof window !== 'undefined') {
      const overlayRect = targetCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      for (const cell of this.cellCanvases.values()) {
        const effConfig = cell.configOverrides
          ? { ...this.config, ...cell.configOverrides }
          : this.config;

        if (cell.module === 'staff-stream' && sparksOn && effConfig.staffSparksEnabled !== false) {
          const cellRect = cell.canvas.getBoundingClientRect();
          const cellLeft = cellRect.left - overlayRect.left;
          const cellTop = cellRect.top - overlayRect.top;
          const w = cell.canvas.width / dpr;
          const h = cell.canvas.height / dpr;

          const playhead = this.staffStreamRenderer.getPlayheadCoordinatesForMidi(
            midi,
            cellLeft,
            cellTop,
            w,
            h,
            effConfig
          );

          // Spray east (+X): angle 0, cone spread Math.PI * 0.75 (~135 deg fan)
          const volumeMult = this.config.particleVolume ?? 1.0;
          this.cosmeticsEngine.spawnDirectionalSparks(
            playhead.x,
            playhead.y,
            spec.colorHex,
            velocity,
            0,
            Math.PI * 0.75,
            Math.round(18 * this.config.particleIntensity * volumeMult),
            1.0,
            this.config.particleSize,
            this.config.particleGravity
          );
        } else if (cell.module === 'triangles') {
          const cellRect = cell.canvas.getBoundingClientRect();
          const cellLeft = cellRect.left - overlayRect.left;
          const cellTop = cellRect.top - overlayRect.top;
          const coord = this.pianoTrianglesRenderer.getVertexCoordinatesForPc(pc);

          if (coord) {
            const vx = cellLeft + coord.x;
            const vy = cellTop + coord.y;
            if (sparksOn && effConfig.triangleSparksEnabled !== false) {
              this.cosmeticsEngine.spawnNoteSparks(
                vx,
                vy,
                spec.colorHex,
                velocity,
                Math.round(16 * this.config.particleIntensity),
                this.config.particleSize,
                this.config.particleVolume,
                this.config.particleGravity
              );
            }
            if (shockwavesOn && effConfig.triangleShockwavesEnabled !== false) {
              this.cosmeticsEngine.spawnShockwave(
                vx,
                vy,
                spec.colorHex,
                45 + velocity * 25,
                shockwaveRadiusMult,
                shockwaveSpeedMult,
                shockwaveDecayDuration
              );
            }
          }
        } else if (cell.module === 'overtones' && effConfig.overtoneDropletsEnabled !== false) {
          const cellRect = cell.cachedRect || cell.canvas.getBoundingClientRect();
          const cellLeft = cellRect.left - overlayRect.left;
          const cellTop = cellRect.top - overlayRect.top;
          const w = cell.canvas.width / dpr;
          const h = cell.canvas.height / dpr;
          const coords = this.overtonesRenderer.getFundamentalCoordinatesForMidi(
            midi,
            w,
            h,
            effConfig,
            velocity
          );
          if (coords) {
            // 1. Eject upward fountain splash of fluid droplets with velocity-governed impulse
            this.cosmeticsEngine.spawnFluidDroplets(
              cellLeft + coords.x,
              cellTop + coords.y,
              coords.colorHex,
              velocity,
              Math.round(28 * this.config.particleIntensity),
              this.config.particleSize * 1.15,
              1.0,
              0.22
            );

            // 2. Amped up: Burst of kinetic sparks at the fundamental wave crest
            if (effConfig.sparksEnabled !== false) {
              this.cosmeticsEngine.spawnDirectionalSparks(
                cellLeft + coords.x,
                cellTop + coords.y,
                coords.colorHex,
                velocity,
                -Math.PI / 2, // Upward fan cone (-90 deg)
                Math.PI * 0.65, // ~117 deg upward cone
                Math.round(14 * this.config.particleIntensity),
                1.0 + velocity * 0.9, // Sparks ejection speed also strongly governed by velocity!
                this.config.particleSize * 0.95,
                0.35
              );
            }
          }
        }
      }
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
      tonic: this.config.tonic,
      semitone: res.semitone,
    };

    const nowSec = now / 1000;
    if (this.isContinuousStreamingActive()) {
      // Dynamic age retention: ensure notes are never pruned before they have had time to travel
      // across any viewport width (including 4K monitors) at the configured scroll speed.
      const scrollSpeed = Math.min(this.config.scrollSpeed || 160, this.config.staffScrollSpeed || 160);
      const maxTravelSec = Math.ceil(4000 / Math.max(20, scrollSpeed)) + 30;
      const maxAgeSec = Math.max(120, maxTravelSec);

      let startIndex = 0;
      while (startIndex < this.streamItems.length && nowSec - this.streamItems[startIndex].timestamp > maxAgeSec) {
        startIndex++;
      }
      if (startIndex > 0) {
        this.streamItems = this.streamItems.slice(startIndex);
      }
      // Generous buffer limit (10,000 notes) safely accommodating dense polyphony and fast MIDI playback
      if (this.streamItems.length >= 10000) {
        this.streamItems = this.streamItems.slice(this.streamItems.length - 9999);
      }
      this.streamItems.push(streamItem);
    } else {
      // Fixed queue mode across all cells: accommodate polyphonic chords per queue slot
      const fixedSize = Math.max(this.config.fixedWindowSize || 8, this.config.staffFixedWindowSize || 8);
      const limit = Math.max(512, fixedSize * 16);
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
      this.lastShiftWasAuto = true;
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
      } else if (module === 'overtones') {
        this.overtonesRenderer.render(
          ctx,
          width,
          height,
          this.activeNotes,
          this.decayingNotes,
          effectiveConfig,
          time
        );

        // Sustained gentle fluid micro-droplets bubbling off active fundamental wave crests
        const dropletsOn =
          (effectiveConfig.overtoneDropletsEnabled ?? true) &&
          effectiveConfig.particleIntensity > 0;
        if (dropletsOn && this.activeNotes.size > 0 && Math.random() < 0.38) {
          const targetRect = this.cachedTargetRect;
          if (cell.cachedRect && targetRect) {
            const cellLeft = cell.cachedRect.left - targetRect.left;
            const cellTop = cell.cachedRect.top - targetRect.top;
            for (const note of this.activeNotes.values()) {
              // Continuous bubbling probability and vigour scale with note dynamics
              const bubbleProb = 0.25 + note.velocity * 0.55;
              if (note.velocity > 0.05 && Math.random() < bubbleProb) {
                const coords = this.overtonesRenderer.getFundamentalCoordinatesForMidi(
                  note.midi,
                  width,
                  height,
                  effectiveConfig,
                  note.velocity
                );
                if (coords) {
                  this.cosmeticsEngine.spawnFluidDroplets(
                    cellLeft + coords.x,
                    cellTop + coords.y,
                    coords.colorHex,
                    note.velocity * 0.45,
                    Math.random() < note.velocity ? 2 : 1,
                    this.config.particleSize * 0.85,
                    0.65 + note.velocity * 0.45,
                    0.16
                  );
                }
              }
            }
          }
        }
      } else if (module === 'staff-stream') {
        this.staffStreamRenderer.render(
          ctx,
          0,
          0,
          width,
          height,
          this.streamItems,
          effectiveConfig,
          time,
          this.tonicShiftMarkers
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
          time,
          this.tonicShiftMarkers
        );
      }

      ctx.restore();
    }

    // 4. Update procedural kinetics, sparks, and phosphor physics (if any are active)
    const sparksOn = (this.config.sparksEnabled ?? true) && this.config.particleIntensity > 0;
    const shockwavesOn = (this.config.shockwavesEnabled ?? true) && this.config.pulseShockwaves !== false;
    const hasKinetics = sparksOn || shockwavesOn || this.cosmeticsEngine.hasActiveParticles();
    if (hasKinetics) {
      this.cosmeticsEngine.update();
    }

    // 5. Render 2D kinetic sparks & expanding shockwave rings (+ 2D post-processing fallback if WebGL unavailable)
    const effCanvas = this.effectsCanvas || this.overlayCanvas;
    const effCtx = this.effectsCtx || this.overlayCtx;
    const webglActive = !!(this.webglPipeline && this.webglPipeline.supported && this.config.webglEnabled !== false);

    if (effCanvas && effCtx) {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const width = effCanvas.width / dpr;
      const height = effCanvas.height / dpr;

      if (width > 0 && height > 0) {
        effCtx.save();
        effCtx.scale(dpr, dpr);
        effCtx.clearRect(0, 0, width, height);

        // A. Kinetic sparks & shockwaves
        if (hasKinetics) {
          if (!webglActive) {
            // 2D Canvas fallback: render particles and shockwaves on CPU context
            const effectiveGlow = (this.config.glowBloomEnabled ?? true) ? this.config.glowBloom : 0;
            this.cosmeticsEngine.renderEffects(effCtx, effectiveGlow, width, height);
          } else if (this.cosmeticsEngine.hasActiveTonicHUD()) {
            // When WebGL is active, particles and shockwaves run on the GPU!
            // Only render 2D HUD text banner on this context.
            const effectiveGlow = (this.config.glowBloomEnabled ?? true) ? this.config.glowBloom : 0;
            this.cosmeticsEngine.renderHUDOnly(effCtx, effectiveGlow, width, height);
          }
        }

        // B. If WebGL is not active/supported or disabled, render 2D post-processing fallback directly on this context
        if (!webglActive) {
          const lights = this.collectFlareLightSources();
          this.render2DPostProcessingFallback(effCtx, width, height, lights);
        }

        effCtx.restore();
      }
    }

    // 6. Render Fullscreen Atmospheric Post-Processing + Point Sprites + Shockwaves on WebGL (if active)
    if (webglActive && this.webglPipeline) {
      const lights = this.collectFlareLightSources();
      const shockwaves = this.cosmeticsEngine.getActiveShockwaves();
      const { buffer: pBuf, count: pCount } = this.cosmeticsEngine.getParticleGpuData();
      this.webglPipeline.render(this.config, lights, time, shockwaves, pBuf, pCount);
    }

    this.animId = requestAnimationFrame(this.masterLoop);
  };

  private collectFlareLightSources(): PostProcessingLight[] {
    const lights: PostProcessingLight[] = [];
    const flaresOn = (this.config.lensFlareEnabled ?? true) && (this.config.lensFlareIntensity ?? 0) > 0.01;
    const bleedOn = (this.config.lightBleedEnabled ?? true) && (this.config.lightBleedIntensity ?? 0) > 0.01;

    if (
      (!flaresOn && !bleedOn) ||
      (this.activeNotes.size === 0 && this.decayingNotes.size === 0)
    ) {
      return lights;
    }

    if (!this.cachedTargetRect && typeof window !== 'undefined') {
      this.updateAllCachedBounds();
    }

    const tonic = this.config.tonic;
    const lowestMidi = this.config.keyboardLowestMidi;

    let orbitalCell: CellCanvasEntry | null = null;
    for (const cell of this.cellCanvases.values()) {
      if (cell.module === 'orbital') {
        orbitalCell = cell;
        break;
      }
    }

    const targetCanvas = this.postProcessingCanvas || this.effectsCanvas || this.overlayCanvas;
    const targetRect = this.cachedTargetRect;
    let offsetLeft = 0;
    let offsetTop = 0;
    let clockCx = (typeof window !== 'undefined' ? window.innerWidth : 1920) / 2;
    let clockCy = (typeof window !== 'undefined' ? window.innerHeight : 1080) / 2;
    let maxClockRadius = Math.min(clockCx, clockCy) * 0.45;
    let hasOrbitalCell = false;

    if (orbitalCell && orbitalCell.cachedRect && targetRect) {
      offsetLeft = orbitalCell.cachedRect.left - targetRect.left;
      offsetTop = orbitalCell.cachedRect.top - targetRect.top;
      clockCx = offsetLeft + orbitalCell.cachedRect.width / 2;
      clockCy = offsetTop + orbitalCell.cachedRect.height / 2;
      maxClockRadius = Math.min(orbitalCell.cachedRect.width, orbitalCell.cachedRect.height) * 0.45;
      hasOrbitalCell = true;
    }

    // 1. Orbital active notes
    if (hasOrbitalCell || this.cellCanvases.size === 0) {
      for (const note of this.activeNotes.values()) {
        const coords = this.pitchClockRenderer.getToneCoordinates(note.midi, tonic, lowestMidi);
        let lx: number;
        let ly: number;
        if (coords) {
          lx = offsetLeft + coords.x;
          ly = offsetTop + coords.y;
        } else if (hasOrbitalCell) {
          const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, lowestMidi);
          const angle = getClockAngleRad(res.semitone);
          const radius = maxClockRadius * (0.85 - res.registerIndex * 0.08);
          lx = clockCx + radius * Math.cos(angle);
          ly = clockCy + radius * Math.sin(angle);
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

      // 2. Orbital decaying notes
      for (const { note, decayProgress } of this.decayingNotes.values()) {
        const decayEased = getDecayFadeFactor(decayProgress);
        const vel = note.velocity * decayEased;
        if (vel <= 0.0001) continue;
        const coords = this.pitchClockRenderer.getToneCoordinates(note.midi, tonic, lowestMidi);
        let lx: number;
        let ly: number;
        if (coords) {
          lx = offsetLeft + coords.x;
          ly = offsetTop + coords.y;
        } else if (hasOrbitalCell) {
          const res = resolveMidiToRegisterAndSemitone(note.midi, tonic, lowestMidi);
          const angle = getClockAngleRad(res.semitone);
          const radius = maxClockRadius * (0.85 - res.registerIndex * 0.08);
          lx = clockCx + radius * Math.cos(angle);
          ly = clockCy + radius * Math.sin(angle);
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
    }

    // 3. Piano Triangles active vertices
    if (targetRect) {
      for (const cell of this.cellCanvases.values()) {
        if (cell.module === 'triangles' && cell.cachedRect) {
          const effConfig = cell.configOverrides
            ? { ...this.config, ...cell.configOverrides }
            : this.config;
          if (effConfig.triangleLensFlaresEnabled !== false) {
            const cellLeft = cell.cachedRect.left - targetRect.left;
            const cellTop = cell.cachedRect.top - targetRect.top;
            const vertices = this.pianoTrianglesRenderer.getActiveVertexCoordinates();
            for (const v of vertices) {
              lights.push({
                x: cellLeft + v.x,
                y: cellTop + v.y,
                velocity: v.velocity,
                colorHex: v.colorHex,
              });
            }
          }
        }
      }
    }

    if (lights.length > 16) {
      lights.sort((a, b) => b.velocity - a.velocity);
    }

    return lights;
  }

  /**
   * Seamless 2D fallback for atmospheric post-processing (lens flares, CRT scanlines, vignette, film grain)
   * executed directly on the 2D effects context without clearing between passes.
   */
  private render2DPostProcessingFallback(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    lights: PostProcessingLight[]
  ) {
    const bleedOn = (this.config.lightBleedEnabled ?? true) && (this.config.lightBleedIntensity ?? 0) > 0.01;
    const flareOn = (this.config.lensFlareEnabled ?? true) && (this.config.lensFlareIntensity ?? 0) > 0.01;
    const ghostOn = (this.config.ghostingEnabled ?? true) && (this.config.ghostingIntensity ?? 0) > 0.01;
    const scanlinesOn = (this.config.scanlinesEnabled ?? true) && ((this.config.scanlineIntensity ?? 0) > 0.01 || (this.config.crtVignette ?? 0) > 0.01);
    const grainOn = (this.config.filmGrainEnabled ?? true) && (this.config.filmGrainIntensity ?? 0) > 0.01;

    const bleed = bleedOn ? (this.config.lightBleedIntensity ?? 0) : 0;
    const flare = flareOn ? (this.config.lensFlareIntensity ?? 0) : 0;
    const ghost = ghostOn ? (this.config.ghostingIntensity ?? 0) : 0;

    // 1. Analog halation, phosphor ghosts & photorealistic lens flares
    if ((bleed > 0.01 || flare > 0.01 || ghost > 0.01) && lights.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (const light of lights) {
        if (light.velocity <= 0.001) continue;

        // Radial film halation (warm soft glow around active notes)
        if (bleed > 0.01) {
          const halationScale = Math.min(1.0, light.velocity * 14.0);
          const halationR = Math.max(6, (45 * bleed + light.velocity * 50) * halationScale);
          const radGrad = ctx.createRadialGradient(light.x, light.y, 2, light.x, light.y, halationR);
          radGrad.addColorStop(0, hexToRgba(light.colorHex, light.velocity * bleed * 0.55));
          radGrad.addColorStop(0.35, `rgba(251, 146, 60, ${light.velocity * bleed * 0.22})`);
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(light.x, light.y, halationR, 0, Math.PI * 2);
          ctx.fill();

          // Anamorphic horizontal light streak bleed
          const streakHalfW = Math.min(width * 0.45, 120 + 260 * bleed);
          const streakH = Math.max(2, 6 * light.velocity);
          const linGrad = ctx.createLinearGradient(light.x - streakHalfW, light.y, light.x + streakHalfW, light.y);
          linGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          linGrad.addColorStop(0.3, hexToRgba(light.colorHex, light.velocity * bleed * 0.12));
          linGrad.addColorStop(0.5, `rgba(255, 255, 255, ${light.velocity * bleed * 0.5})`);
          linGrad.addColorStop(0.7, hexToRgba(light.colorHex, light.velocity * bleed * 0.12));
          linGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = linGrad;
          ctx.fillRect(light.x - streakHalfW, light.y - streakH / 2, streakHalfW * 2, streakH);
        }

        // Multi-element optical lens flares
        if (flare > 0.01) {
          this.cosmeticsEngine.renderOpticalLensFlares(
            ctx,
            width,
            height,
            [{ x: light.x, y: light.y, color: light.colorHex, velocity: light.velocity }],
            flare,
            this.config.lensFlareStyle ?? 'cinematic'
          );
        }
      }

      ctx.restore();
    }

    // 2. Whole-display CRT scanlines & glass curvature vignette
    if (scanlinesOn) {
      this.cosmeticsEngine.renderScanlines(
        ctx,
        width,
        height,
        this.config.scanlineIntensity,
        this.config.scanlineDensity,
        this.config.crtVignette
      );
    }

    // 3. Whole-display film grain overlay
    if (grainOn) {
      this.cosmeticsEngine.renderFilmGrain(
        ctx,
        width,
        height,
        this.config.filmGrainIntensity,
        this.config.filmGrainSize,
        this.config.filmGrainContrast
      );
    }
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 255;
  const g = parseInt(clean.substring(2, 4), 16) || 255;
  const b = parseInt(clean.substring(4, 6), 16) || 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const renderCoordinatorInstance = new RenderCoordinator(DEFAULT_CONFIG);
