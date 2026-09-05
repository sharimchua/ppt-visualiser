import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  Upload,
  Download,
  Layers,
  LayoutGrid,
  Radio,
  Music2,
  Disc3,
  RotateCcw,
  Share2,
  Check,
  Link,
  Copy,
  MoreHorizontal,
} from 'lucide-react';
import { VisualiserConfig, MidiPlaybackState, MidiDeviceState, LayoutMode } from '../core/types';
import { DEMO_TRACKS } from '../core/demo-tracks';
import { downloadNotesAsMidiFile } from '../core/midi-encoder';
import { midiManagerInstance } from '../core/midi-manager';
import { SCALE_MODE_DEFINITIONS } from '../core/scale-alignment';
import { PRESET_LAYOUTS, encodeLayoutToSlug } from '../core/layout-models';

interface ControlToolbarProps {
  config: VisualiserConfig;
  playbackState: MidiPlaybackState;
  deviceState: MidiDeviceState;
  isFullscreen: boolean;
  onUpdateConfig: (partial: Partial<VisualiserConfig>) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onSelectTrack: (trackId: string) => void;
  onFileUpload: (file: File) => void;
  onToggleFullscreen: () => void;
  onToggleSettings: () => void;
  onResetState?: () => void;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
}

const TONIC_OPTIONS = [
  { label: 'D (Default PPT)', value: 2 },
  { label: 'C', value: 0 },
  { label: 'C♯ / D♭', value: 1 },
  { label: 'D♯ / E♭', value: 3 },
  { label: 'E', value: 4 },
  { label: 'F', value: 5 },
  { label: 'F♯ / G♭', value: 6 },
  { label: 'G', value: 7 },
  { label: 'G♯ / A♭', value: 8 },
  { label: 'A', value: 9 },
  { label: 'A♯ / B♭', value: 10 },
  { label: 'B', value: 11 },
];

export const ControlToolbar: React.FC<ControlToolbarProps> = ({
  config,
  playbackState,
  deviceState,
  isFullscreen,
  onUpdateConfig,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSelectTrack,
  onFileUpload,
  onToggleFullscreen,
  onToggleSettings,
  onResetState,
  isEditMode = false,
  onToggleEditMode,
}) => {
  const [showMidiMenu, setShowMidiMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [includeAestheticsInSlug, setIncludeAestheticsInSlug] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <header className="w-full bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-800/80 px-2.5 sm:px-4 py-1.5 sm:py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-3 select-none z-30 shadow-lg">
      {/* Top Row on Mobile / Left Group on Desktop: Brand + Tonic Selector */}
      <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-red-500/20 flex-shrink-0">
            <Disc3 className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-spin-slow" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm tracking-wide text-white truncate">
                <span className="sm:hidden">PPT</span>
                <span className="hidden sm:inline">PPT Visualiser</span>
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1 sm:px-1.5 py-0.2 bg-red-950/80 text-red-400 border border-red-800/50 rounded flex-shrink-0">
                Do = D
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden xl:block">Prime Period Theory Visualiser</p>
          </div>
        </div>

        {/* Tonic Selector */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-800/60 rounded-lg px-1.5 sm:px-2 py-1 border border-slate-700/50 flex-shrink-0">
          <span className="text-[11px] sm:text-xs text-slate-400 font-medium">Do:</span>
          <select
            value={config.tonic}
            onChange={(e) => onUpdateConfig({ tonic: parseInt(e.target.value, 10) })}
            className="bg-transparent text-[11px] sm:text-xs font-semibold text-red-400 focus:outline-none cursor-pointer"
          >
            {TONIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                {opt.label}
              </option>
            ))}
          </select>
          {/* Quick Auto-Alignment Toggle */}
          <button
            onClick={() => onUpdateConfig({ autoTonicEnabled: !config.autoTonicEnabled })}
            className={`px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono transition border ${
              config.autoTonicEnabled
                ? 'bg-red-600/30 border-red-500 text-red-300 font-bold shadow-sm shadow-red-900/40'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-300'
            }`}
            title={config.autoTonicEnabled ? `Auto-Alignment active (${SCALE_MODE_DEFINITIONS[config.autoTonicMode]?.name || 'Mode'})` : 'Enable Auto-Alignment of Do'}
          >
            {config.autoTonicEnabled ? '⚡ Auto' : 'Auto'}
          </button>
        </div>

        {/* Mobile-Only Top Right Tools: Edit Layout + More Menu + Settings */}
        <div className="flex md:hidden items-center gap-1 flex-shrink-0">
          {onToggleEditMode && (
            <button
              onClick={onToggleEditMode}
              className={`p-1.5 rounded-md border transition ${
                isEditMode
                  ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                  : 'border-slate-700/70 bg-slate-800/70 text-purple-300 hover:text-white'
              }`}
              title="Edit Layout"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Mobile Overflow Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className="p-1.5 rounded-md border border-slate-700/70 bg-slate-800/70 text-slate-300 hover:text-white transition"
              title="More Tools & Presets"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-[#0e1320] border border-slate-700 rounded-lg shadow-2xl p-2.5 z-50 text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-bold text-slate-200">Tools & Presets</span>
                  <button onClick={() => setShowMoreMenu(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                {/* MIDI Devices */}
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    midiManagerInstance.requestAccess();
                    setShowMidiMenu(true);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 transition"
                >
                  <div className="flex items-center gap-2">
                    <Radio className={`w-3.5 h-3.5 ${deviceState.isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                    <span>MIDI Hardware</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1 rounded ${deviceState.isConnected ? 'bg-emerald-950 text-emerald-300' : 'text-slate-500'}`}>
                    {deviceState.isConnected ? `${deviceState.inputs.length} In` : 'Off'}
                  </span>
                </button>

                {/* Layout Presets */}
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowLayoutMenu(true);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 transition"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-red-400" />
                    <span>Layout Preset</span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[90px] capitalize">
                    {config.activeLayout?.id.startsWith('custom') ? 'Custom' : config.layoutMode}
                  </span>
                </button>

                {/* Share Layout */}
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowShareMenu(true);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 transition"
                >
                  <Share2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Share Layout Link</span>
                </button>

                {/* Fullscreen Toggle */}
                <button
                  onClick={() => {
                    onToggleFullscreen();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 transition"
                >
                  <div className="flex items-center gap-2">
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-amber-400" /> : <Maximize2 className="w-3.5 h-3.5 text-amber-400" />}
                    <span>Fullscreen</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {isFullscreen ? 'Exit' : 'Enter'}
                  </span>
                </button>

                {/* Reset State */}
                {onResetState && (
                  <button
                    onClick={() => {
                      onResetState();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-slate-700/80 text-red-300 hover:text-red-200 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                    <span>Reset Tone Reveals (R)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onToggleSettings}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 transition"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2 on Mobile / Center Group on Desktop: Playback Transport Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 justify-between md:justify-center">
        {/* Play/Pause Button */}
        <button
          onClick={() => (playbackState.isPlaying ? onPause() : onPlay())}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition shadow-lg shadow-red-600/30 flex-shrink-0"
          title={playbackState.isPlaying ? 'Pause' : 'Play'}
        >
          {playbackState.isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />}
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          className="p-1 sm:p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition flex-shrink-0"
          title="Stop & Rewind"
        >
          <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Track selector */}
        <div className="relative flex-1 min-w-0 max-w-full md:max-w-[210px] lg:max-w-[240px]">
          <select
            value={DEMO_TRACKS.some(t => t.title === playbackState.trackName) ? DEMO_TRACKS.find(t => t.title === playbackState.trackName)?.id : ''}
            onChange={(e) => onSelectTrack(e.target.value)}
            className="w-full bg-slate-800/80 hover:bg-slate-800 text-[11px] sm:text-xs text-slate-200 rounded-md px-2 py-1 sm:py-1.5 border border-slate-700 focus:outline-none truncate cursor-pointer"
          >
            {Array.from(new Set(DEMO_TRACKS.map((t) => t.category))).map((category) => (
              <optgroup key={category} label={category} className="bg-slate-900 text-slate-400 font-semibold text-[11px]">
                {DEMO_TRACKS.filter((t) => t.category === category).map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200 font-normal text-xs">
                    {t.title} – {t.composer}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Upload MIDI File */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Upload standard MIDI file (.mid)"
          className="p-1 sm:p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition flex-shrink-0"
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Download Current Track MIDI File */}
        {DEMO_TRACKS.some((t) => t.title === playbackState.trackName) && (
          <button
            onClick={() => {
              const currentTrack = DEMO_TRACKS.find((t) => t.title === playbackState.trackName);
              if (currentTrack) {
                downloadNotesAsMidiFile(
                  currentTrack.notes,
                  `${currentTrack.id}.mid`,
                  `${currentTrack.title} (${currentTrack.composer})`
                );
              }
            }}
            title="Download demo track (.mid)"
            className="p-1 sm:p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-purple-300 border border-slate-700/60 transition flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".mid,.midi"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileUpload(file);
          }}
        />

        {/* Mobile Sound & Keyboard quick toggles */}
        <button
          onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
          className={`md:hidden p-1 sm:p-1.5 rounded-md border transition flex-shrink-0 ${
            config.soundEnabled
              ? 'bg-slate-800 border-slate-600 text-slate-200'
              : 'border-slate-700 text-slate-500 hover:text-slate-300'
          }`}
          title={config.soundEnabled ? 'Mute' : 'Unmute'}
        >
          {config.soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </button>

        <button
          onClick={() => onUpdateConfig({ showVirtualKeyboard: !config.showVirtualKeyboard })}
          className={`md:hidden p-1 sm:p-1.5 rounded-md border transition flex-shrink-0 ${
            config.showVirtualKeyboard
              ? 'bg-slate-800 border-slate-600 text-white'
              : 'border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle On-Screen Keyboard"
        >
          <Music2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Progress Bar & Time (Desktop only) */}
        <div className="hidden xl:flex items-center gap-2 flex-1 min-w-[110px]">
          <span className="text-[11px] font-mono text-slate-400 w-9 text-right">
            {formatTime(playbackState.currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={playbackState.duration || 1}
            step={0.1}
            value={playbackState.currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
          <span className="text-[11px] font-mono text-slate-400 w-9">
            {formatTime(playbackState.duration)}
          </span>
        </div>
      </div>

      {/* Desktop Right Group: Layout Switcher, Sound & Settings */}
      <div className="hidden md:flex items-center gap-1.5 lg:gap-2 flex-shrink-0">
        {/* MIDI Hardware Status & Device Selector Popover */}
        <div className="relative">
          <button
            onClick={() => {
              midiManagerInstance.requestAccess();
              setShowMidiMenu(prev => !prev);
            }}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-mono border transition cursor-pointer ${
              deviceState.isConnected
                ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/80'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/60'
            }`}
            title="Click to select MIDI input or request permissions"
          >
            <Radio className={`w-3.5 h-3.5 ${deviceState.isConnected ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
            <span className="hidden xl:inline">{deviceState.isConnected ? `${deviceState.inputs.length} MIDI In` : 'Connect MIDI'}</span>
            {deviceState.isConnected && <span className="xl:hidden w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </button>

          {showMidiMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-[#0e1320] border border-slate-700 rounded-lg shadow-2xl p-3 z-50 text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-200">MIDI Input Ports</span>
                <button
                  onClick={() => setShowMidiMenu(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {deviceState.inputs.length === 0 ? (
                <div className="text-slate-400 space-y-2 py-1">
                  <p className="text-[11px] leading-relaxed">
                    No hardware MIDI devices detected yet. Plug in your USB MIDI keyboard and click below:
                  </p>
                  <button
                    onClick={() => midiManagerInstance.requestAccess()}
                    className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-medium transition text-center"
                  >
                    Rescan / Request MIDI Access
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-400">Select active port (or listen to all):</p>
                  <button
                    onClick={() => {
                      midiManagerInstance.selectInput('all');
                      setShowMidiMenu(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded transition flex items-center justify-between ${
                      deviceState.selectedInputId === 'all'
                        ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-medium'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span>All Connected Ports (Recommended)</span>
                    {deviceState.selectedInputId === 'all' && <span>✓</span>}
                  </button>

                  {deviceState.inputs.map(input => (
                    <button
                      key={input.id}
                      onClick={() => {
                        midiManagerInstance.selectInput(input.id);
                        setShowMidiMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded transition flex items-center justify-between ${
                        deviceState.selectedInputId === input.id
                          ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-medium'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="truncate">{input.name}</span>
                      {deviceState.selectedInputId === input.id && <span>✓</span>}
                    </button>
                  ))}

                  <button
                    onClick={() => midiManagerInstance.requestAccess()}
                    className="w-full mt-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition text-center"
                  >
                    Rescan MIDI Devices
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Layout Mode Picker Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowLayoutMenu((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
              config.activeLayout?.id.startsWith('custom')
                ? 'border-purple-500/60 bg-purple-950/30 text-purple-200 hover:bg-purple-900/40'
                : 'border-slate-700/70 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
            }`}
            title="Switch Layout Preset"
          >
            <Layers className="w-3.5 h-3.5 text-red-400" />
            <span className="capitalize hidden xl:inline">
              {config.activeLayout?.id.startsWith('custom')
                ? (config.activeLayout?.name || 'Custom Layout')
                : config.layoutMode.replace('-', ' ')}
            </span>
          </button>

          {showLayoutMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-[#0e1320] border border-slate-700 rounded-lg shadow-2xl p-2 z-50 text-xs space-y-1">
              <div className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider px-2 py-1 border-b border-slate-800">
                Flexbox Layout Presets
              </div>
              {config.activeLayout?.id.startsWith('custom') && (
                <div className="w-full text-left px-2.5 py-1.5 rounded bg-purple-950/50 border border-purple-500/40 text-purple-200 flex items-center justify-between text-xs font-medium">
                  <span>{config.activeLayout?.name || 'Custom Layout'}</span>
                  <span className="text-purple-400 font-bold">✓</span>
                </div>
              )}
              {(['balanced', 'signature', 'monument', 'river', 'waterfall', 'dual-stream', 'orbital-focus'] as LayoutMode[]).map((mode) => {
                const preset = PRESET_LAYOUTS[mode];
                const isSelected = !config.activeLayout?.id.startsWith('custom') && config.layoutMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      onUpdateConfig({
                        layoutMode: mode,
                        activeLayout: preset,
                      });
                      setShowLayoutMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded transition flex items-center justify-between text-xs ${
                      isSelected
                        ? 'bg-red-600 text-white font-medium shadow'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{preset.name}</span>
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Layout Edit Mode Toggle Button */}
        {onToggleEditMode && (
          <button
            onClick={onToggleEditMode}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
              isEditMode
                ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)] ring-1 ring-purple-400/50'
                : 'border-slate-700/70 bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-700/80'
            }`}
            title={isEditMode ? 'Exit Layout Edit Mode' : 'Enter Layout Edit Mode (Add, split, configure, and remove cells)'}
          >
            <LayoutGrid className={`w-3.5 h-3.5 ${isEditMode ? 'text-white animate-pulse' : 'text-purple-400'}`} />
            <span className="hidden lg:inline">{isEditMode ? 'Editing' : 'Edit Layout'}</span>
          </button>
        )}

        {/* Share Layout & Deep Link Popover */}
        <div className="relative">
          <button
            onClick={() => setShowShareMenu((prev) => !prev)}
            className="p-1.5 rounded-md border border-slate-700/70 bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-700/80 transition cursor-pointer"
            title="Share Layout & Deep Link"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          {showShareMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-[#0e1320] border border-slate-700 rounded-lg shadow-2xl p-3 z-50 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-red-400" />
                  Share Layout Link
                </span>
                <button
                  onClick={() => setShowShareMenu(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Generate a deep-link slug encoding your active layout cells and module settings:
              </p>

              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAestheticsInSlug}
                  onChange={(e) => setIncludeAestheticsInSlug(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-red-600 focus:ring-0 cursor-pointer"
                />
                <span>Include Visual Aesthetics & Theme</span>
              </label>

              <div className="pt-1">
                <button
                  onClick={() => {
                    const layout = {
                      ...config.activeLayout,
                      aesthetics: includeAestheticsInSlug
                        ? {
                            backgroundTheme: config.backgroundTheme,
                            filmGrainIntensity: config.filmGrainIntensity,
                            filmGrainSize: config.filmGrainSize,
                            filmGrainContrast: config.filmGrainContrast,
                            particleIntensity: config.particleIntensity,
                            glowBloom: config.glowBloom,
                            motionTrails: config.motionTrails,
                            ghostingIntensity: config.ghostingIntensity,
                            lightBleedIntensity: config.lightBleedIntensity,
                            scanlineIntensity: config.scanlineIntensity,
                            scanlineDensity: config.scanlineDensity,
                            crtVignette: config.crtVignette,
                            lensFlareIntensity: config.lensFlareIntensity,
                            lensFlareStyle: config.lensFlareStyle,
                          }
                        : undefined,
                    };
                    const slug = encodeLayoutToSlug(layout, includeAestheticsInSlug);
                    const url = `${window.location.origin}${window.location.pathname}#layout=${slug}`;
                    navigator.clipboard.writeText(url).then(() => {
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    });
                  }}
                  className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium transition flex items-center justify-center gap-1.5 shadow"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</span>
                </button>
              </div>

              {copiedLink && (
                <p className="text-[10px] text-emerald-400 text-center font-mono">
                  URL contains customized layout tree!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sound Toggle Button */}
        <button
          onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
          className={`p-1.5 rounded-md border transition ${
            config.soundEnabled
              ? 'bg-slate-800 border-slate-600 text-slate-200'
              : 'border-slate-700 text-slate-500 hover:text-slate-300'
          }`}
          title={config.soundEnabled ? 'Mute Synthesizer' : 'Unmute Synthesizer'}
        >
          {config.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Virtual Keyboard Toggle */}
        <button
          onClick={() => onUpdateConfig({ showVirtualKeyboard: !config.showVirtualKeyboard })}
          className={`p-1.5 rounded-md border transition ${
            config.showVirtualKeyboard
              ? 'bg-slate-800 border-slate-600 text-white'
              : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Toggle On-Screen Keyboard"
        >
          <Music2 className="w-4 h-4" />
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Mode'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Reset State & Reveals Button */}
        {onResetState && (
          <button
            onClick={onResetState}
            className="p-1.5 rounded-md border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-red-400 hover:border-red-500/50 transition flex items-center gap-1"
            title="Reset Tone Reveals & Organic Activity (Shortcut: R)"
          >
            <RotateCcw className="w-4 h-4 text-red-400" />
            <span className="hidden xl:inline text-[11px] font-medium text-slate-300">Reset</span>
          </button>
        )}

        {/* Settings Drawer Button */}
        <button
          onClick={onToggleSettings}
          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 transition shadow"
          title="Open Visualiser Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
