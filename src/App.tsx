import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_CONFIG, loadSavedConfig, saveConfig, clearSavedConfig } from './core/config';
import {
  VisualiserConfig,
  ActiveNote,
  StreamItem,
  MidiPlaybackState,
  MidiDeviceState,
} from './core/types';
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
} from './core/ppt-constants';
import { midiManagerInstance } from './core/midi-manager';
import { midiPlayerInstance } from './core/midi-file-player';
import { synthInstance } from './core/audio-synth';
import { CosmeticsEngine } from './renderers/cosmetics';
import { ScaleAlignmentTracker } from './core/scale-alignment';
import { ControlToolbar } from './components/ControlToolbar';
import { VisualiserViewport } from './components/VisualiserViewport';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { SettingsDrawer } from './components/SettingsDrawer';
import { decodeLayoutFromSlug, updateCellInTree } from './core/layout-models';
import { LayoutCellNode } from './core/types';

export const App: React.FC = () => {
  const [config, setConfig] = useState<VisualiserConfig>(() => {
    const saved = loadSavedConfig();
    // Check if deep link ?layout=<slug> is in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const layoutSlug = params.get('layout');
      if (layoutSlug) {
        const decoded = decodeLayoutFromSlug(layoutSlug);
        if (decoded) {
          return {
            ...saved,
            activeLayout: decoded.layout,
            ...(decoded.hasAesthetics && decoded.layout.aesthetics ? decoded.layout.aesthetics : {}),
          };
        }
      }
    }
    return saved;
  });
  const [activeNotes, setActiveNotes] = useState<Map<number, ActiveNote>>(new Map());
  const [decayingNotes, setDecayingNotes] = useState<Map<number, { note: ActiveNote; decayProgress: number }>>(new Map());
  const [streamItems, setStreamItems] = useState<StreamItem[]>([]);
  const [playbackState, setPlaybackState] = useState<MidiPlaybackState>(midiPlayerInstance.getState());
  const [deviceState, setDeviceState] = useState<MidiDeviceState>(midiManagerInstance.state);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [scaleFitInfo, setScaleFitInfo] = useState<{
    currentTonicFit: number;
    bestTonic: number;
    bestTonicFit: number;
    scoreMargin: number;
    shouldShift: boolean;
  }>({
    currentTonicFit: 1.0,
    bestTonic: config.tonic,
    bestTonicFit: 1.0,
    scoreMargin: 0,
    shouldShift: false,
  });

  const cosmeticsEngineRef = useRef(new CosmeticsEngine());
  const scaleTrackerRef = useRef(new ScaleAlignmentTracker());
  const idleTimerRef = useRef<number | null>(null);
  const lastFitUpdateRef = useRef<number>(0);

  const activeNotesRef = useRef(activeNotes);
  activeNotesRef.current = activeNotes;
  const decayingNotesRef = useRef(decayingNotes);
  decayingNotesRef.current = decayingNotes;
  const toneCoordLookupRef = useRef<((midi: number) => { x: number; y: number; radius: number; angle: number } | null) | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const handleUpdateCell = useCallback((updatedCell: LayoutCellNode) => {
    setConfig((prev) => {
      if (!prev.activeLayout || !prev.activeLayout.root) return prev;
      const updatedRoot = updateCellInTree(prev.activeLayout.root, updatedCell.id, () => updatedCell);
      return {
        ...prev,
        activeLayout: {
          ...prev.activeLayout,
          root: updatedRoot,
        },
      };
    });
  }, []);

  // Reset session state: clears discovered tones, tone pop scales, organic activity, scale tracker, and note stream
  const handleResetSessionState = useCallback(() => {
    setActiveNotes(new Map());
    setDecayingNotes(new Map());
    setStreamItems([]);
    setResetNonce((n) => n + 1);
    scaleTrackerRef.current.reset();
  }, []);

  // Automatically persist config changes to localStorage
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // Sync Audio Synth settings with config
  useEffect(() => {
    synthInstance.setMuted(!config.soundEnabled);
    synthInstance.setVolume(config.masterVolume);
    synthInstance.setWaveform(config.synthWaveform);
  }, [config.soundEnabled, config.masterVolume, config.synthWaveform]);

  // Listen to MIDI playback & device changes
  useEffect(() => {
    const unsubPlayback = midiPlayerInstance.onStateChange(setPlaybackState);
    const unsubDevice = midiManagerInstance.onStateChange(setDeviceState);

    // Prompt/ensure Web MIDI is initialized on user gesture if browser requires it
    const handleFirstGesture = () => {
      if (!midiManagerInstance.state.isConnected) {
        midiManagerInstance.requestAccess();
      }
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });

    return () => {
      unsubPlayback();
      unsubDevice();
      window.removeEventListener('pointerdown', handleFirstGesture);
    };
  }, []);

  // Handle Note On
  const handleNoteOn = useCallback((midi: number, velocity: number = 0.8) => {
    const now = performance.now();
    const pc = ((midi % 12) + 12) % 12;
    const res = resolveMidiToRegisterAndSemitone(midi, config.tonic, config.keyboardLowestMidi);
    const syllable = SOLFEGE_SYLLABLES[res.semitone];
    const spec = SOLFEGE_SPECS[syllable];
    const ptInfo = PITCH_CLASS_TO_PIANO_TRIANGLE[pc];

    let pitchNames = PITCH_NAMES_DUAL;
    if (config.accidentalStyle === 'sharp') pitchNames = PITCH_NAMES_SHARP;
    else if (config.accidentalStyle === 'flat') pitchNames = PITCH_NAMES_FLAT;

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
    if (config.soundEnabled) {
      synthInstance.noteOn(midi, velocity);
    }

    // Active notes state
    setActiveNotes((prev) => {
      const next = new Map(prev);
      next.set(midi, noteObj);
      return next;
    });

    // Remove from decaying notes if retriggered
    setDecayingNotes((prev) => {
      if (prev.has(midi)) {
        const next = new Map(prev);
        next.delete(midi);
        return next;
      }
      return prev;
    });

    // Spawn cosmetic particles using exact tone circle coordinates if available
    const exact = toneCoordLookupRef.current?.(midi);
    let sparkX: number;
    let sparkY: number;
    let radialAngle: number;

    if (exact) {
      sparkX = exact.x;
      sparkY = exact.y;
      radialAngle = exact.angle;
    } else {
      const angle = getClockAngleRad(res.semitone);
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      const radius = Math.min(vpW, vpH) * 0.3 * (1 - res.registerIndex / 10);
      sparkX = vpW / 2 + radius * Math.cos(angle);
      sparkY = vpH / 2 + radius * Math.sin(angle);
      radialAngle = angle;
    }

    if (config.particleIntensity > 0) {
      cosmeticsEngineRef.current.spawnNoteSparks(
        sparkX,
        sparkY,
        spec.colorHex,
        velocity,
        Math.round(20 * config.particleIntensity),
        config.particleSize,
        config.particleVolume,
        config.particleGravity,
        config.particleOriginDistance,
        radialAngle
      );
    }
    if (config.pulseShockwaves) {
      cosmeticsEngineRef.current.spawnShockwave(sparkX, sparkY, spec.colorHex, 65 + velocity * 30);
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

    setStreamItems((prev) => {
      const nowSec = now / 1000;
      if (config.streamMode === 'continuous') {
        // Continuous mode: keep notes for up to 60 seconds (or up to 1200 items),
        // ensuring notes are only removed once they have naturally scrolled off-screen.
        const maxAgeSec = 60;
        let startIndex = 0;
        while (startIndex < prev.length && nowSec - prev[startIndex].timestamp > maxAgeSec) {
          startIndex++;
        }
        const activeSlice = startIndex > 0 ? prev.slice(startIndex) : prev;
        const capped = activeSlice.length >= 1200 ? activeSlice.slice(activeSlice.length - 1199) : activeSlice;
        return [...capped, streamItem];
      } else {
        // Fixed queue mode: retain enough buffer for smooth conveyor transitions
        const limit = Math.max(48, (config.fixedWindowSize || 8) * 2);
        const trimmed = prev.length >= limit ? prev.slice(-limit + 1) : prev;
        return [...trimmed, streamItem];
      }
    });
  }, [
    config.tonic,
    config.keyboardLowestMidi,
    config.accidentalStyle,
    config.soundEnabled,
    config.particleIntensity,
    config.particleSize,
    config.particleVolume,
    config.particleGravity,
    config.particleOriginDistance,
    config.pulseShockwaves,
    config.streamMode,
    config.fixedWindowSize,
  ]);

  // Handle Note Off
  const handleNoteOff = useCallback((midi: number) => {
    const now = performance.now();

    // Release audio synth voice
    synthInstance.noteOff(midi);

    setActiveNotes((prev) => {
      const active = prev.get(midi);
      if (!active) return prev;

      const next = new Map(prev);
      next.delete(midi);

      // Begin decay animation
      const noteCopy = { ...active, releaseTime: now };
      setDecayingNotes((dPrev) => {
        const dNext = new Map(dPrev);
        dNext.set(midi, { note: noteCopy, decayProgress: 0 });
        return dNext;
      });

      return next;
    });
  }, []);

  // Wire MIDI manager to note triggers
  useEffect(() => {
    const unsubOn = midiManagerInstance.onNoteOn((midi, vel) => handleNoteOn(midi, vel));
    const unsubOff = midiManagerInstance.onNoteOff((midi) => handleNoteOff(midi));
    return () => {
      unsubOn();
      unsubOff();
    };
  }, [handleNoteOn, handleNoteOff]);

  // Decay Progress Animation Loop
  useEffect(() => {
    let animId: number;

    const tickDecay = () => {
      const now = performance.now();
      const currentConfig = configRef.current;
      const decayDuration = currentConfig.decayDurationMs;

      // Update scale alignment tracker with active and decaying notes
      const alignRes = scaleTrackerRef.current.update(
        now,
        activeNotesRef.current.values(),
        decayingNotesRef.current.values(),
        currentConfig
      );

      // Trigger automatic tonic shift if auto-alignment is enabled and recommended
      if (
        currentConfig.autoTonicEnabled &&
        alignRes.shouldShift &&
        alignRes.newTonic !== undefined &&
        alignRes.newTonic !== currentConfig.tonic
      ) {
        setConfig((prev) => ({ ...prev, tonic: alignRes.newTonic! }));
      }

      // Periodically update UI fit status (throttled ~180ms)
      if (now - lastFitUpdateRef.current > 180) {
        lastFitUpdateRef.current = now;
        setScaleFitInfo({
          currentTonicFit: alignRes.currentTonicFit,
          bestTonic: alignRes.bestTonic,
          bestTonicFit: alignRes.bestTonicFit,
          scoreMargin: alignRes.scoreMargin,
          shouldShift: alignRes.shouldShift,
        });
      }

      setDecayingNotes((prev) => {
        if (prev.size === 0) return prev;
        const next = new Map(prev);
        let changed = false;

        for (const [midi, data] of prev.entries()) {
          const elapsed = now - (data.note.releaseTime || now);
          const progress = Math.min(1.0, elapsed / decayDuration);

          if (progress >= 1.0) {
            next.delete(midi);
            changed = true;
          } else {
            next.set(midi, { note: data.note, decayProgress: progress });
            changed = true;
          }
        }

        return changed ? next : prev;
      });

      animId = requestAnimationFrame(tickDecay);
    };

    animId = requestAnimationFrame(tickDecay);
    return () => cancelAnimationFrame(animId);
  }, [config.decayDurationMs]);

  // Fullscreen Management
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.warn);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.warn);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Auto-hide toolbar during fullscreen on mouse idle
  const handleMouseMove = () => {
    setIsMouseIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isFullscreen) {
      idleTimerRef.current = window.setTimeout(() => {
        setIsMouseIdle(true);
      }, 2500);
    }
  };

  // Keyboard shortcut: 'R' to quickly reset session state (discovered tones & organic window)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        handleResetSessionState();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetSessionState]);

  const updateConfig = (partial: Partial<VisualiserConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleResetConfig = () => {
    clearSavedConfig();
    setConfig({ ...DEFAULT_CONFIG });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative w-screen h-screen flex flex-col bg-[#0b0d13] text-slate-100 overflow-hidden select-none font-sans"
    >
      {/* Top Floating / Fixed Toolbar */}
      <div
        className={`transition-all duration-300 z-30 ${
          isFullscreen && isMouseIdle
            ? '-translate-y-full opacity-0 pointer-events-none'
            : 'translate-y-0 opacity-100'
        }`}
      >
        <ControlToolbar
          config={config}
          playbackState={playbackState}
          deviceState={deviceState}
          isFullscreen={isFullscreen}
          onUpdateConfig={updateConfig}
          onPlay={() => midiPlayerInstance.play()}
          onPause={() => midiPlayerInstance.pause()}
          onStop={() => midiPlayerInstance.stop()}
          onSeek={(t) => midiPlayerInstance.seek(t)}
          onSelectTrack={(id) => midiPlayerInstance.loadDemoTrack(id)}
          onFileUpload={(f) => midiPlayerInstance.loadExternalMidiFile(f)}
          onToggleFullscreen={toggleFullscreen}
          onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
          onResetState={handleResetSessionState}
        />
      </div>

      {/* Center Maximized Viewport Canvas */}
      <main className="flex-1 w-full h-full relative overflow-hidden flex">
        <VisualiserViewport
          config={config}
          activeNotes={activeNotes}
          decayingNotes={decayingNotes}
          streamItems={streamItems}
          cosmeticsEngine={cosmeticsEngineRef.current}
          resetSessionCount={resetNonce}
          onUpdateCell={handleUpdateCell}
          onToneCoordinatesResolved={(lookup) => {
            toneCoordLookupRef.current = lookup;
          }}
        />
      </main>

      {/* Bottom Virtual Keyboard */}
      {config.showVirtualKeyboard && (
        <div
          className={`transition-all duration-300 z-20 ${
            isFullscreen && isMouseIdle
              ? 'translate-y-full opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100'
          }`}
        >
          <VirtualKeyboard
            config={config}
            activeNotes={activeNotes}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
          />
        </div>
      )}

      {/* Settings Side Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onUpdateConfig={updateConfig}
        onResetConfig={handleResetConfig}
        onResetReveals={handleResetSessionState}
        scaleFitInfo={scaleFitInfo}
      />
    </div>
  );
};
