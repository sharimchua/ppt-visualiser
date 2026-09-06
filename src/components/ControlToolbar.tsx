import { useRef, useState, useEffect, memo } from 'react';
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
  Trash2,
  Layers,
  LayoutGrid,
  Radio,
  Music2,
  RotateCcw,
  Share2,
  Check,
  Link,
  Copy,
  MoreHorizontal,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import { VisualiserConfig, MidiPlaybackState, MidiDeviceState, LayoutMode } from '../core/types';
import { DEMO_TRACKS } from '../core/demo-tracks';
import {
  CustomMidiTrack,
  loadSavedCustomTracks,
  subscribeCustomTracks,
  findAnyTrackById,
} from '../core/custom-midi-store';
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
  onDeleteCustomTrack?: (trackId: string) => void;
  onToggleFullscreen: () => void;
  onToggleSettings: () => void;
  onResetState?: () => void;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  onOpenInfoModal?: () => void;
}

const TONIC_PITCHES = [
  { value: 0, label: 'C', short: 'C' },
  { value: 1, label: 'C♯ / D♭', short: 'C♯' },
  { value: 2, label: 'D (Default PPT)', short: 'D' },
  { value: 3, label: 'D♯ / E♭', short: 'E♭' },
  { value: 4, label: 'E', short: 'E' },
  { value: 5, label: 'F', short: 'F' },
  { value: 6, label: 'F♯ / G♭', short: 'F♯' },
  { value: 7, label: 'G', short: 'G' },
  { value: 8, label: 'G♯ / A♭', short: 'A♭' },
  { value: 9, label: 'A', short: 'A' },
  { value: 10, label: 'A♯ / B♭', short: 'B♭' },
  { value: 11, label: 'B', short: 'B' },
];

export const ControlToolbar = memo<ControlToolbarProps>(function ControlToolbar({
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
  onDeleteCustomTrack,
  onToggleFullscreen,
  onToggleSettings,
  onResetState,
  isEditMode = false,
  onToggleEditMode,
  onOpenInfoModal,
}) {
  const [showTonicMenu, setShowTonicMenu] = useState(false);
  const [showMidiMenu, setShowMidiMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [includeAestheticsInSlug, setIncludeAestheticsInSlug] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [customTracks, setCustomTracks] = useState<CustomMidiTrack[]>(() => loadSavedCustomTracks());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeCustomTracks((tracks) => {
      setCustomTracks([...tracks]);
    });
  }, []);

  const selectedTrackId =
    playbackState.trackId ||
    DEMO_TRACKS.find((t) => t.title === playbackState.trackName)?.id ||
    customTracks.find((t) => t.title === playbackState.trackName)?.id ||
    '';

  const activeTrack =
    findAnyTrackById(selectedTrackId) ||
    DEMO_TRACKS.find((t) => t.title === playbackState.trackName) ||
    customTracks.find((t) => t.title === playbackState.trackName);

  const isCustomTrack = customTracks.some((t) => t.id === selectedTrackId);

  const currentTonic = TONIC_PITCHES.find((t) => t.value === config.tonic) || TONIC_PITCHES[2];

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <header className="w-full bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-800/80 px-2 sm:px-4 py-1.5 sm:py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-3 select-none z-30 shadow-lg">
      {/* Top Row on Mobile / Left Group on Desktop: Brand + Elegant Tonic Selector */}
      <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onOpenInfoModal}
          className="flex items-center gap-1.5 sm:gap-2 min-w-0 text-left hover:opacity-95 transition group cursor-pointer"
          title="Open Visualiser Primer & Theory Guide"
        >
          <img
            src="/logo.svg"
            alt="PPT Logo"
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-md drop-shadow-[0_0_8px_rgba(225,54,16,0.35)] flex-shrink-0 select-none group-hover:scale-105 transition-transform"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm tracking-wide text-white truncate block group-hover:text-red-400 transition-colors">
                <span className="sm:hidden">PPT</span>
                <span className="hidden sm:inline">PPT Visualiser</span>
              </span>
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400 transition hidden sm:inline-block shrink-0" />
            </div>
            <p className="text-[10px] text-slate-400 hidden 2xl:block">Prime Period Theory</p>
          </div>
        </button>

        {/* Elegant Collapsible Tonic ("Do") Selector */}
        <div className="relative">
          <button
            onClick={() => setShowTonicMenu((prev) => !prev)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-md text-xs font-semibold border transition shrink-0 ${
              config.autoTonicEnabled
                ? 'bg-red-950/70 border-red-500/80 text-red-300 shadow-sm shadow-red-900/30'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/80 text-slate-200'
            }`}
            title={`Current Tonic (Do): ${currentTonic.label}. Click to change key or toggle auto-alignment.`}
          >
            <span className="text-slate-400 font-normal text-[11px]">Do:</span>
            <span className="text-red-400 font-bold">{currentTonic.short}</span>
            {config.autoTonicEnabled && (
              <span className="text-[10px] text-amber-400 font-bold" title="Auto-alignment active">⚡</span>
            )}
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showTonicMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* Elegant Tonic & Scale Auto-Alignment Popover */}
          {showTonicMenu && (
            <div className="absolute left-0 top-full mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-[#0e1320] border border-slate-700 rounded-lg shadow-2xl p-3 z-50 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <img src="/logo.svg" alt="PPT Logo" className="w-4 h-4 object-contain" />
                  <span>Tonic / Key ("Do")</span>
                </div>
                <button
                  onClick={() => setShowTonicMenu(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Auto-Alignment Toggle */}
              <div className="flex items-center justify-between p-2 rounded-md bg-slate-800/60 border border-slate-700/60">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-200">
                    <span>⚡ Auto-Align Tonic</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {config.autoTonicEnabled
                      ? `Active (${SCALE_MODE_DEFINITIONS[config.autoTonicMode]?.name || 'Ionian'})`
                      : 'Off (Manual selection)'}
                  </div>
                </div>
                <button
                  onClick={() => onUpdateConfig({ autoTonicEnabled: !config.autoTonicEnabled })}
                  className={`px-2 py-1 rounded text-xs font-semibold transition border ${
                    config.autoTonicEnabled
                      ? 'bg-red-600 border-red-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {config.autoTonicEnabled ? 'Enabled' : 'Enable'}
                </button>
              </div>

              {/* 12-Tone Selection Grid */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Select Key Centre (Do):
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {TONIC_PITCHES.map((item) => {
                    const isCurrent = config.tonic === item.value;
                    return (
                      <button
                        key={item.value}
                        onClick={() => {
                          onUpdateConfig({ tonic: item.value, autoTonicEnabled: false });
                          setShowTonicMenu(false);
                        }}
                        className={`py-1.5 px-1 rounded text-center text-xs font-semibold transition border ${
                          isCurrent
                            ? 'bg-red-600 border-red-400 text-white shadow-[0_0_8px_rgba(225,54,16,0.4)]'
                            : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                        title={item.label}
                      >
                        <div>{item.short}</div>
                        {item.value === 2 && (
                          <div className="text-[8px] font-normal text-red-200 opacity-80">PPT</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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

                {/* Virtual Keyboard */}
                <button
                  onClick={() => {
                    onUpdateConfig({ showVirtualKeyboard: !config.showVirtualKeyboard });
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 transition"
                >
                  <div className="flex items-center gap-2">
                    <Music2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Virtual Keyboard</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {config.showVirtualKeyboard ? 'Hide' : 'Show'}
                  </span>
                </button>

                {/* Download Track MIDI */}
                {activeTrack && (
                  <button
                    onClick={() => {
                      downloadNotesAsMidiFile(
                        activeTrack.notes,
                        `${activeTrack.id}.mid`,
                        `${activeTrack.title} (${activeTrack.composer})`
                      );
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download Track MIDI</span>
                  </button>
                )}

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
          className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition shadow-lg shadow-red-600/30 flex-shrink-0 touch-manipulation"
          title={playbackState.isPlaying ? 'Pause' : 'Play'}
        >
          {playbackState.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition flex-shrink-0 touch-manipulation"
          title="Stop & Rewind"
        >
          <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Track selector */}
        <div className="relative flex-1 min-w-0 max-w-full md:max-w-[180px] lg:max-w-[210px] xl:max-w-[240px]">
          <select
            value={selectedTrackId}
            onChange={(e) => onSelectTrack(e.target.value)}
            className="w-full bg-slate-800/80 hover:bg-slate-800 text-[11px] sm:text-xs text-slate-200 rounded-md px-2 py-1.5 border border-slate-700 focus:outline-none truncate cursor-pointer touch-manipulation"
          >
            {/* Uploaded Tracks (from localStorage) */}
            {customTracks.length > 0 && (
              <optgroup label="Uploaded Tracks" className="bg-slate-900 text-purple-400 font-semibold text-[11px]">
                {customTracks.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200 font-normal text-xs">
                    {t.title}
                  </option>
                ))}
              </optgroup>
            )}

            {/* Fallback option if active track is not yet indexed */}
            {selectedTrackId &&
              !DEMO_TRACKS.some((t) => t.id === selectedTrackId) &&
              !customTracks.some((t) => t.id === selectedTrackId) && (
                <option value={selectedTrackId} className="bg-slate-900 text-slate-200 font-normal text-xs">
                  {playbackState.trackName || 'Uploaded MIDI'}
                </option>
              )}

            {/* Inbuilt Demo Tracks */}
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

        {/* Delete Uploaded Track (shown when an uploaded custom track is currently active) */}
        {isCustomTrack && onDeleteCustomTrack && (
          <button
            onClick={() => onDeleteCustomTrack(selectedTrackId)}
            title="Delete uploaded track from local storage"
            className="p-1.5 rounded-md hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-700/60 hover:border-red-600/60 transition flex-shrink-0 touch-manipulation"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}

        {/* Upload MIDI File */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Upload standard MIDI file (.mid)"
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition flex-shrink-0 touch-manipulation"
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Download Current Track MIDI File (Desktop / Tablet only; on mobile it's in More menu) */}
        {activeTrack && (
          <button
            onClick={() => {
              downloadNotesAsMidiFile(
                activeTrack.notes,
                `${activeTrack.id}.mid`,
                `${activeTrack.title} (${activeTrack.composer})`
              );
            }}
            title="Download track MIDI (.mid)"
            className="hidden sm:block p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-purple-300 border border-slate-700/60 transition flex-shrink-0 touch-manipulation"
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
            if (file) {
              onFileUpload(file);
              e.target.value = '';
            }
          }}
        />

        {/* Sound toggle */}
        <button
          onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
          className={`p-1.5 rounded-md border transition flex-shrink-0 touch-manipulation ${
            config.soundEnabled
              ? 'bg-slate-800 border-slate-600 text-slate-200'
              : 'border-slate-700 text-slate-500 hover:text-slate-300'
          }`}
          title={config.soundEnabled ? 'Mute' : 'Unmute'}
        >
          {config.soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </button>

        {/* Progress Bar & Time (Shown only on wide desktop to prevent crampedness) */}
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

      {/* Desktop Right Group: Layout Switcher, Edit Mode & Tools */}
      <div className="hidden md:flex items-center gap-1.5 lg:gap-2 flex-shrink-0">
        {/* MIDI Hardware Status & Device Selector:
            - If connected: show compact live status badge
            - If disconnected: deprioritized from narrow screens, only shown on 2xl+ (accessible via More Tools and Settings)
        */}
        {deviceState.isConnected ? (
          <button
            onClick={() => {
              midiManagerInstance.requestAccess();
              setShowMidiMenu(true);
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-mono border bg-emerald-950/70 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/80 transition cursor-pointer"
            title={`${deviceState.inputs.length} MIDI Device(s) connected. Click to configure.`}
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span className="hidden 2xl:inline">{deviceState.inputs.length} MIDI In</span>
          </button>
        ) : (
          <button
            onClick={() => {
              midiManagerInstance.requestAccess();
              setShowMidiMenu(true);
            }}
            className="hidden 2xl:flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-mono border bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/60 transition cursor-pointer"
            title="Connect MIDI hardware controller"
          >
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            <span>Connect MIDI</span>
          </button>
        )}

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
            <span className="capitalize hidden lg:inline">
              {config.activeLayout?.id.startsWith('custom')
                ? (config.activeLayout?.name || 'Custom Layout')
                : config.layoutMode.replace('-', ' ')}
            </span>
          </button>

          {showLayoutMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-[#0e1320] border border-slate-700 rounded-lg shadow-2xl p-2 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150">
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
            <span className="hidden xl:inline">{isEditMode ? 'Editing' : 'Edit Layout'}</span>
          </button>
        )}

        {/* More Tools Menu on Tablet / Narrow Desktop (md:block xl:hidden) */}
        <div className="relative hidden md:block xl:hidden">
          <button
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="p-1.5 rounded-md border border-slate-700/70 bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-700/80 transition"
            title="More Tools"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-[#0e1320] border border-slate-700 rounded-lg shadow-2xl p-2.5 z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-bold text-slate-200">More Tools</span>
                <button onClick={() => setShowMoreMenu(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              {/* MIDI Hardware */}
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

              {/* Virtual Keyboard */}
              <button
                onClick={() => {
                  onUpdateConfig({ showVirtualKeyboard: !config.showVirtualKeyboard });
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 transition"
              >
                <div className="flex items-center gap-2">
                  <Music2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Virtual Keyboard</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {config.showVirtualKeyboard ? 'Hide' : 'Show'}
                </span>
              </button>

              {/* Fullscreen */}
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

        {/* Direct Tools on Wide Screens (xl+) */}
        <button
          onClick={() => setShowShareMenu(true)}
          className="hidden xl:block p-1.5 rounded-md border border-slate-700/70 bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-700/80 transition cursor-pointer"
          title="Share Layout & Deep Link"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onUpdateConfig({ showVirtualKeyboard: !config.showVirtualKeyboard })}
          className={`hidden xl:block p-1.5 rounded-md border transition ${
            config.showVirtualKeyboard
              ? 'bg-slate-800 border-slate-600 text-white'
              : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Toggle On-Screen Keyboard"
        >
          <Music2 className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleFullscreen}
          className="hidden xl:block p-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Mode'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {onResetState && (
          <button
            onClick={onResetState}
            className="hidden 2xl:flex p-1.5 rounded-md border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-red-400 hover:border-red-500/50 transition items-center gap-1"
            title="Reset Tone Reveals & Organic Activity (Shortcut: R)"
          >
            <RotateCcw className="w-4 h-4 text-red-400" />
            <span className="text-[11px] font-medium text-slate-300">Reset</span>
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

      {/* Floating Dialog: MIDI Input Devices (Accessible from both desktop and mobile without boundary clipping) */}
      {showMidiMenu && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-80 max-w-full bg-[#0e1320] border border-slate-700 rounded-xl shadow-2xl p-3.5 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <Radio className={`w-4 h-4 ${deviceState.isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                MIDI Hardware Input Ports
              </span>
              <button
                onClick={() => setShowMidiMenu(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {deviceState.inputs.length === 0 ? (
              <div className="text-slate-400 space-y-2.5 py-1">
                <p className="text-[11px] leading-relaxed">
                  No hardware MIDI devices detected yet. Plug in your USB MIDI keyboard and click below:
                </p>
                <button
                  onClick={() => midiManagerInstance.requestAccess()}
                  className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition text-center shadow"
                >
                  Rescan / Request MIDI Access
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400">Select active port (or listen to all):</p>
                <button
                  onClick={() => {
                    midiManagerInstance.selectInput('all');
                    setShowMidiMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
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
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
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
                  className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition text-center"
                >
                  Rescan MIDI Devices
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Dialog: Share Layout Deep Link (Accessible from all breakpoints) */}
      {showShareMenu && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-80 max-w-full bg-[#0e1320] border border-slate-700 rounded-xl shadow-2xl p-3.5 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-purple-400" />
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
              Generate a deep-link URL encoding your active layout cells and module settings:
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
                          filmGrainEnabled: config.filmGrainEnabled,
                          filmGrainIntensity: config.filmGrainIntensity,
                          filmGrainSize: config.filmGrainSize,
                          filmGrainContrast: config.filmGrainContrast,
                          sparksEnabled: config.sparksEnabled,
                          particleIntensity: config.particleIntensity,
                          glowBloomEnabled: config.glowBloomEnabled,
                          glowBloom: config.glowBloom,
                          motionTrailsEnabled: config.motionTrailsEnabled,
                          motionTrails: config.motionTrails,
                          ghostingEnabled: config.ghostingEnabled,
                          ghostingIntensity: config.ghostingIntensity,
                          lightBleedEnabled: config.lightBleedEnabled,
                          lightBleedIntensity: config.lightBleedIntensity,
                          scanlinesEnabled: config.scanlinesEnabled,
                          scanlineIntensity: config.scanlineIntensity,
                          scanlineDensity: config.scanlineDensity,
                          crtVignette: config.crtVignette,
                          lensFlareEnabled: config.lensFlareEnabled,
                          lensFlareIntensity: config.lensFlareIntensity,
                          lensFlareStyle: config.lensFlareStyle,
                          clockLabelPriorities: config.clockLabelPriorities,
                          glyphContrastMode: config.glyphContrastMode,
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
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition flex items-center justify-center gap-1.5 shadow"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</span>
              </button>
            </div>

            {copiedLink && (
              <p className="text-[10px] text-emerald-400 text-center font-mono">
                URL contains customised layout tree!
              </p>
            )}
          </div>
        </div>
      )}
    </header>
  );
});
