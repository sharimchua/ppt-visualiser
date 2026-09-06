import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_CONFIG, loadSavedConfig, saveConfig, clearSavedConfig } from './core/config';
import {
  VisualiserConfig,
  ActiveNote,
  MidiPlaybackState,
  MidiDeviceState,
  LayoutCellNode,
  LayoutFlexDirection,
  VisualiserModuleType,
  LayoutMode,
} from './core/types';
import { midiManagerInstance } from './core/midi-manager';
import { midiPlayerInstance } from './core/midi-file-player';
import { synthInstance } from './core/audio-synth';
import { renderCoordinatorInstance, ScaleFitInfo } from './core/render-coordinator';
import { ControlToolbar } from './components/ControlToolbar';
import { VisualiserViewport } from './components/VisualiserViewport';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { SettingsDrawer } from './components/SettingsDrawer';
import { InfoModal } from './components/InfoModal';
import {
  decodeLayoutFromSlug,
  updateCellInTree,
  splitCellInTree,
  removeCellFromTree,
  duplicateCellInTree,
  addCellToTree,
  PRESET_LAYOUTS,
} from './core/layout-models';

// Helper to extract layout slug from URL query or hash
function extractLayoutSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get('layout');
  if (querySlug) return querySlug;

  if (window.location.hash) {
    const match = window.location.hash.match(/layout=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export const App: React.FC = () => {
  const [config, setConfig] = useState<VisualiserConfig>(() => {
    const saved = loadSavedConfig();
    // Check if deep link ?layout=<slug> or #layout=<slug> is in URL
    const layoutSlug = extractLayoutSlugFromUrl();
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
    return saved;
  });

  const [activeNotesForKeyboard, setActiveNotesForKeyboard] = useState<Map<number, ActiveNote>>(new Map());
  const [playbackState, setPlaybackState] = useState<MidiPlaybackState>(midiPlayerInstance.getState());
  const [deviceState, setDeviceState] = useState<MidiDeviceState>(midiManagerInstance.state);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const [isEditLayoutMode, setIsEditLayoutMode] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const dontShow = localStorage.getItem('ppt_dont_show_intro_on_launch_v1') === 'true';
    const hasSeen = localStorage.getItem('ppt_has_seen_intro_modal_v1') === 'true';
    return !dontShow && !hasSeen;
  });

  const handleCloseInfoModal = useCallback(() => {
    setIsInfoModalOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ppt_has_seen_intro_modal_v1', 'true');
    }
  }, []);

  const [scaleFitInfo, setScaleFitInfo] = useState<ScaleFitInfo>({
    currentTonicFit: 1.0,
    bestTonic: config.tonic,
    bestTonicFit: 1.0,
    scoreMargin: 0,
    shouldShift: false,
  });

  const idleTimerRef = useRef<number | null>(null);

  // Synchronise config updates with RenderCoordinator & localStorage
  useEffect(() => {
    saveConfig(config);
    renderCoordinatorInstance.setConfig(config);
  }, [config]);

  // Handle URL hash changes dynamically (#layout=<slug>)
  useEffect(() => {
    const handleHashChange = () => {
      const layoutSlug = extractLayoutSlugFromUrl();
      if (layoutSlug) {
        const decoded = decodeLayoutFromSlug(layoutSlug);
        if (decoded) {
          setConfig((prev) => ({
            ...prev,
            activeLayout: decoded.layout,
            ...(decoded.hasAesthetics && decoded.layout.aesthetics ? decoded.layout.aesthetics : {}),
          }));
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Subscribe to Scale Alignment updates and handle Auto-Tonic shifting
  useEffect(() => {
    renderCoordinatorInstance.onAutoTonicShift = (newTonic: number) => {
      setConfig((prev) => ({ ...prev, tonic: newTonic }));
    };
    return renderCoordinatorInstance.subscribeScaleFit(setScaleFitInfo);
  }, []);

  // Subscribe to active notes for Virtual Keyboard only when keyboard is shown
  useEffect(() => {
    if (!config.showVirtualKeyboard) return;
    return renderCoordinatorInstance.subscribeActiveNotes((notes) => {
      setActiveNotesForKeyboard(new Map(notes));
    });
  }, [config.showVirtualKeyboard]);

  // Sync Audio Synth settings with config
  useEffect(() => {
    synthInstance.setMuted(!config.soundEnabled);
    synthInstance.setVolume(config.masterVolume);
    synthInstance.setWaveform(config.synthWaveform);
    synthInstance.setFocusMode(config.focusModeEnabled ?? true);
  }, [config.soundEnabled, config.masterVolume, config.synthWaveform, config.focusModeEnabled]);

  // Listen to MIDI playback & device changes
  useEffect(() => {
    const unsubPlayback = midiPlayerInstance.onStateChange(setPlaybackState);
    const unsubDevice = midiManagerInstance.onStateChange(setDeviceState);

    // Prompt/ensure Web MIDI is initialised on user gesture if browser requires it
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

  const handleUpdateCell = useCallback((updatedCell: LayoutCellNode) => {
    setConfig((prev) => {
      if (!prev.activeLayout || !prev.activeLayout.root) return prev;
      const updatedRoot = updateCellInTree(prev.activeLayout.root, updatedCell.id, () => updatedCell);
      return {
        ...prev,
        activeLayout: {
          ...prev.activeLayout,
          id: prev.activeLayout.id.startsWith('custom') ? prev.activeLayout.id : `custom-${Date.now().toString(36)}`,
          name: prev.activeLayout.id.startsWith('custom') ? prev.activeLayout.name : 'Custom Layout',
          root: updatedRoot,
        },
      };
    });
  }, []);

  const handleSplitCell = useCallback(
    (targetCellId: string, direction: LayoutFlexDirection, newModule: VisualiserModuleType) => {
      setConfig((prev) => {
        if (!prev.activeLayout || !prev.activeLayout.root) return prev;
        const updatedRoot = splitCellInTree(prev.activeLayout.root, targetCellId, direction, newModule);
        return {
          ...prev,
          activeLayout: {
            ...prev.activeLayout,
            id: prev.activeLayout.id.startsWith('custom') ? prev.activeLayout.id : `custom-${Date.now().toString(36)}`,
            name: prev.activeLayout.id.startsWith('custom') ? prev.activeLayout.name : 'Custom Layout',
            root: updatedRoot,
          },
        };
      });
    },
    []
  );

  const handleRemoveCell = useCallback((targetCellId: string) => {
    setConfig((prev) => {
      if (!prev.activeLayout || !prev.activeLayout.root) return prev;
      const updatedRoot = removeCellFromTree(prev.activeLayout.root, targetCellId);
      return {
        ...prev,
        activeLayout: {
          ...prev.activeLayout,
          id: prev.activeLayout.id.startsWith('custom') ? prev.activeLayout.id : `custom-${Date.now().toString(36)}`,
          name: prev.activeLayout.id.startsWith('custom') ? prev.activeLayout.name : 'Custom Layout',
          root: updatedRoot,
        },
      };
    });
  }, []);

  const handleDuplicateCell = useCallback((targetCellId: string) => {
    setConfig((prev) => {
      if (!prev.activeLayout || !prev.activeLayout.root) return prev;
      const updatedRoot = duplicateCellInTree(prev.activeLayout.root, targetCellId);
      return {
        ...prev,
        activeLayout: {
          ...prev.activeLayout,
          id: prev.activeLayout.id.startsWith('custom') ? prev.activeLayout.id : `custom-${Date.now().toString(36)}`,
          name: prev.activeLayout.id.startsWith('custom') ? prev.activeLayout.name : 'Custom Layout',
          root: updatedRoot,
        },
      };
    });
  }, []);

  const handleAddCell = useCallback(
    (direction: LayoutFlexDirection = 'row', module: VisualiserModuleType = 'stream') => {
      setConfig((prev) => {
        if (!prev.activeLayout || !prev.activeLayout.root) return prev;
        const updatedRoot = addCellToTree(prev.activeLayout.root, direction, module);
        return {
          ...prev,
          activeLayout: {
            ...prev.activeLayout,
            id: prev.activeLayout.id.startsWith('custom') ? prev.activeLayout.id : `custom-${Date.now().toString(36)}`,
            name: prev.activeLayout.id.startsWith('custom') ? prev.activeLayout.name : 'Custom Layout',
            root: updatedRoot,
          },
        };
      });
    },
    []
  );

  const handleResetLayout = useCallback((presetKey: LayoutMode = 'balanced') => {
    const preset = PRESET_LAYOUTS[presetKey] || PRESET_LAYOUTS['balanced'];
    setConfig((prev) => ({
      ...prev,
      layoutMode: presetKey,
      activeLayout: preset,
    }));
  }, []);

  // Reset session state: clears discovered tones, active notes, scale tracker, and note stream
  const handleResetSessionState = useCallback(() => {
    renderCoordinatorInstance.resetSession();
  }, []);

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
          isEditMode={isEditLayoutMode}
          onToggleEditMode={() => setIsEditLayoutMode((prev) => !prev)}
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
          onOpenInfoModal={() => setIsInfoModalOpen(true)}
        />
      </div>

      {/* Centre Maximised Viewport Canvas */}
      <main className="flex-1 w-full h-full relative overflow-hidden flex">
        <VisualiserViewport
          config={config}
          coordinator={renderCoordinatorInstance}
          isEditMode={isEditLayoutMode}
          onToggleEditMode={() => setIsEditLayoutMode((prev) => !prev)}
          onSplitCell={handleSplitCell}
          onRemoveCell={handleRemoveCell}
          onDuplicateCell={handleDuplicateCell}
          onAddCell={handleAddCell}
          onResetLayout={handleResetLayout}
          onUpdateCell={handleUpdateCell}
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
            activeNotes={activeNotesForKeyboard}
            onNoteOn={renderCoordinatorInstance.triggerNoteOn}
            onNoteOff={renderCoordinatorInstance.triggerNoteOff}
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
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        scaleFitInfo={scaleFitInfo}
      />

      {/* Introduction & Information Modal */}
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={handleCloseInfoModal}
      />
    </div>
  );
};

