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

    // Subscribe to MIDI events directly
    this.unsubMidiOn = midiManagerInstance.onNoteOn((midi, vel) => this.triggerNoteOn(midi, vel));
    this.unsubMidiOff = midiManagerInstance.onNoteOff((midi) => this.triggerNoteOff(midi));

    // Register focus/blur lifecycle listeners
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', this.handleFocusChange);
      window.addEventListener('blur', this.handleFocusChange);
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
      // Find orbital clock center and radius on the effects canvas (if available)
      let orbitalCellCanvas: HTMLCanvasElement | null = null;
      for (const cell of this.cellCanvases.values()) {
        if (cell.module === 'orbital') {
          orbitalCellCanvas = cell.canvas;
          break;
        }
      }

      const targetCanvas = this.effectsCanvas || this.overlayCanvas || this.postProcessingCanvas;
      let clockCx = (typeof window !== 'undefined' ? window.innerWidth : 1920) / 2;
      let clockCy = (typeof window !== 'undefined' ? window.innerHeight : 1080) / 2;
      let clockRadius = Math.min(clockCx, clockCy) * 0.45;

      if (orbitalCellCanvas && targetCanvas && typeof window !== 'undefined') {
        const cellRect = orbitalCellCanvas.getBoundingClientRect();
        const targetRect = targetCanvas.getBoundingClientRect();
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
    if (sparksOn && (orbitalCellCanvas || this.cellCanvases.size === 0)) {
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
      if (this.config.pulseShockwaves) {
        this.cosmeticsEngine.spawnShockwave(sparkX, sparkY, spec.colorHex, 65 + velocity * 30);
      }
    }

    // Additional cell-specific note sparks
    if (targetCanvas && typeof window !== 'undefined' && sparksOn) {
      const overlayRect = targetCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      for (const cell of this.cellCanvases.values()) {
        const effConfig = cell.configOverrides
          ? { ...this.config, ...cell.configOverrides }
          : this.config;

        if (cell.module === 'staff-stream' && effConfig.staffSparksEnabled !== false) {
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

          // Spray east (+X): angle 0, cone spread Math.PI * 0.65
          this.cosmeticsEngine.spawnDirectionalSparks(
            playhead.x,
            playhead.y,
            spec.colorHex,
            velocity,
            0,
            Math.PI * 0.65,
            Math.round(18 * this.config.particleIntensity),
            this.config.particleSize,
            this.config.particleVolume,
            this.config.particleGravity
          );
        } else if (cell.module === 'triangles' && effConfig.triangleSparksEnabled !== false) {
          const cellRect = cell.canvas.getBoundingClientRect();
          const cellLeft = cellRect.left - overlayRect.left;
          const cellTop = cellRect.top - overlayRect.top;
          const coord = this.pianoTrianglesRenderer.getVertexCoordinatesForPc(pc);

          if (coord) {
            this.cosmeticsEngine.spawnNoteSparks(
              cellLeft + coord.x,
              cellTop + coord.y,
              spec.colorHex,
              velocity,
              Math.round(16 * this.config.particleIntensity),
              this.config.particleSize,
              this.config.particleVolume,
              this.config.particleGravity
            );
            if (this.config.pulseShockwaves) {
              this.cosmeticsEngine.spawnShockwave(
                cellLeft + coord.x,
                cellTop + coord.y,
                spec.colorHex,
                45 + velocity * 25
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
    const shockwavesOn = this.config.pulseShockwaves;
    const hasKinetics = sparksOn || shockwavesOn || this.cosmeticsEngine.hasActiveParticles();
    if (hasKinetics) {
      this.cosmeticsEngine.update();
    }

    // 5. Render 2D kinetic sparks & expanding shockwave rings (+ 2D post-processing fallback if WebGL unavailable)
    const effCanvas = this.effectsCanvas || this.overlayCanvas;
    const effCtx = this.effectsCtx || this.overlayCtx;

    if (effCanvas && effCtx) {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const width = effCanvas.width / dpr;
      const height = effCanvas.height / dpr;

      if (width > 0 && height > 0) {
        effCtx.save();
        effCtx.scale(dpr, dpr);
        effCtx.clearRect(0, 0, width, height);

        // A. Kinetic sparks & shockwaves (only if active)
        if (hasKinetics) {
          const effectiveGlow = (this.config.glowBloomEnabled ?? true) ? this.config.glowBloom : 0;
          this.cosmeticsEngine.renderEffects(effCtx, effectiveGlow, width, height);
        }

        // B. If WebGL is not active/supported or disabled, render 2D post-processing fallback directly on this context
        const webglActive = this.webglPipeline && this.webglPipeline.supported && this.config.webglEnabled !== false;
        if (!webglActive) {
          const lights = this.collectFlareLightSources();
          this.render2DPostProcessingFallback(effCtx, width, height, lights);
        }

        effCtx.restore();
      }
    }

    // 6. Render Fullscreen Atmospheric Post-Processing on WebGL (if hardware pipeline active and enabled)
    if (this.webglPipeline && this.webglPipeline.supported && this.config.webglEnabled !== false) {
      const lights = this.collectFlareLightSources();
      this.webglPipeline.render(this.config, lights, time);
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

    const tonic = this.config.tonic;
    const lowestMidi = this.config.keyboardLowestMidi;

    let orbitalCellCanvas: HTMLCanvasElement | null = null;
    for (const cell of this.cellCanvases.values()) {
      if (cell.module === 'orbital') {
        orbitalCellCanvas = cell.canvas;
        break;
      }
    }

    const targetCanvas = this.postProcessingCanvas || this.effectsCanvas || this.overlayCanvas;
    let offsetLeft = 0;
    let offsetTop = 0;
    let clockCx = (typeof window !== 'undefined' ? window.innerWidth : 1920) / 2;
    let clockCy = (typeof window !== 'undefined' ? window.innerHeight : 1080) / 2;
    let maxClockRadius = Math.min(clockCx, clockCy) * 0.45;
    let hasOrbitalCell = false;

    if (orbitalCellCanvas && targetCanvas && typeof window !== 'undefined') {
      const cellRect = orbitalCellCanvas.getBoundingClientRect();
      const targetRect = targetCanvas.getBoundingClientRect();
      offsetLeft = cellRect.left - targetRect.left;
      offsetTop = cellRect.top - targetRect.top;
      clockCx = offsetLeft + cellRect.width / 2;
      clockCy = offsetTop + cellRect.height / 2;
      maxClockRadius = Math.min(cellRect.width, cellRect.height) * 0.45;
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
        const vel = note.velocity * (1 - decayProgress);
        if (vel <= 0.04) continue;
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
    if (targetCanvas && typeof window !== 'undefined') {
      const targetRect = targetCanvas.getBoundingClientRect();
      for (const cell of this.cellCanvases.values()) {
        if (cell.module === 'triangles') {
          const effConfig = cell.configOverrides
            ? { ...this.config, ...cell.configOverrides }
            : this.config;
          if (effConfig.triangleLensFlaresEnabled !== false) {
            const cellRect = cell.canvas.getBoundingClientRect();
            const cellLeft = cellRect.left - targetRect.left;
            const cellTop = cellRect.top - targetRect.top;
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

    if (lights.length > 8) {
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
        if (light.velocity <= 0.02) continue;

        // Radial film halation (warm soft glow around active notes)
        if (bleed > 0.01) {
          const halationR = Math.max(35, Math.min(180, 60 * bleed + light.velocity * 50));
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
