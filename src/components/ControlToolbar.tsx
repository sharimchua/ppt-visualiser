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
  Layers,
  Radio,
  Music2,
  Disc3,
  RotateCcw,
  Share2,
  Check,
  Link,
  Copy,
} from 'lucide-react';
import { VisualiserConfig, MidiPlaybackState, MidiDeviceState, LayoutMode } from '../core/types';
import { DEMO_TRACKS } from '../core/demo-tracks';
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
}) => {
  const [showMidiMenu, setShowMidiMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [includeAestheticsInSlug, setIncludeAestheticsInSlug] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <header className="w-full bg-[#0b0f19]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2 flex items-center justify-between gap-4 select-none z-30 shadow-lg">
      {/* Left: Brand & Tonic Selection */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Disc3 className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">PPT Visualiser</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-red-950/80 text-red-400 border border-red-800/50 rounded">
                Do = D
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Prime Period Theory Visualiser</p>
          </div>
        </div>

        {/* Tonic Selector */}
        <div className="flex items-center gap-1.5 ml-2 bg-slate-800/60 rounded-lg px-2 py-1 border border-slate-700/50">
          <span className="text-xs text-slate-400 font-medium">Tonic Do:</span>
          <select
            value={config.tonic}
            onChange={(e) => onUpdateConfig({ tonic: parseInt(e.target.value, 10) })}
            className="bg-transparent text-xs font-semibold text-red-400 focus:outline-none cursor-pointer"
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
            className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition border ${
              config.autoTonicEnabled
                ? 'bg-red-600/30 border-red-500 text-red-300 font-bold shadow-sm shadow-red-900/40'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-300'
            }`}
            title={config.autoTonicEnabled ? `Auto-Alignment active (${SCALE_MODE_DEFINITIONS[config.autoTonicMode]?.name || 'Mode'})` : 'Enable Auto-Alignment of Do'}
          >
            {config.autoTonicEnabled ? '⚡ Auto' : 'Auto'}
          </button>
        </div>
      </div>

      {/* Center: Playback Transport Controls */}
      <div className="flex items-center gap-3 max-w-xl flex-1 justify-center">
        {/* Track selector */}
        <div className="relative flex items-center">
          <select
            value={DEMO_TRACKS.some(t => t.title === playbackState.trackName) ? DEMO_TRACKS.find(t => t.title === playbackState.trackName)?.id : ''}
            onChange={(e) => onSelectTrack(e.target.value)}
            className="bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-200 rounded-md px-2.5 py-1.5 border border-slate-700 focus:outline-none max-w-[170px] sm:max-w-[220px] truncate cursor-pointer"
          >
            <optgroup label="Bundled PPT Studies">
              {DEMO_TRACKS.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                  {t.title}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Upload MIDI File */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Upload standard MIDI file (.mid)"
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition"
        >
          <Upload className="w-4 h-4" />
        </button>
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

        {/* Play/Pause Button */}
        <button
          onClick={() => (playbackState.isPlaying ? onPause() : onPlay())}
          className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition shadow-lg shadow-red-600/30"
          title={playbackState.isPlaying ? 'Pause' : 'Play'}
        >
          {playbackState.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          title="Stop & Rewind"
        >
          <Square className="w-4 h-4" />
        </button>

        {/* Progress Bar & Time */}
        <div className="hidden md:flex items-center gap-2 flex-1 min-w-[120px]">
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

      {/* Right: Layout Switcher, Sound & Settings */}
      <div className="flex items-center gap-2">
        {/* MIDI Hardware Status & Device Selector Popover */}
        <div className="relative">
          <button
            onClick={() => {
              midiManagerInstance.requestAccess();
              setShowMidiMenu(prev => !prev);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono border transition cursor-pointer ${
              deviceState.isConnected
                ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/80'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/60'
            }`}
            title="Click to select MIDI input or request permissions"
          >
            <Radio className={`w-3.5 h-3.5 ${deviceState.isConnected ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
            <span>{deviceState.isConnected ? `${deviceState.inputs.length} MIDI In` : 'Connect MIDI'}</span>
          </button>

          {showMidiMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#0e1320] border border-slate-700 rounded-lg shadow-2xl p-3 z-50 text-xs space-y-2.5">
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
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border border-slate-700/70 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80 transition cursor-pointer"
            title="Switch Layout Preset"
          >
            <Layers className="w-3.5 h-3.5 text-red-400" />
            <span className="capitalize">{config.layoutMode.replace('-', ' ')}</span>
          </button>

          {showLayoutMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[#0e1320] border border-slate-700 rounded-lg shadow-2xl p-2 z-50 text-xs space-y-1">
              <div className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider px-2 py-1 border-b border-slate-800">
                Flexbox Layout Presets
              </div>
              {(['balanced', 'monument', 'river', 'waterfall', 'dual-stream', 'orbital-focus'] as LayoutMode[]).map((mode) => {
                const preset = PRESET_LAYOUTS[mode];
                const isSelected = config.layoutMode === mode;
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
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#0e1320] border border-slate-700 rounded-lg shadow-2xl p-3 z-50 text-xs space-y-3">
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
                          }
                        : undefined,
                    };
                    const slug = encodeLayoutToSlug(layout, includeAestheticsInSlug);
                    const url = `${window.location.origin}${window.location.pathname}?layout=${slug}`;
                    navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-medium transition flex items-center justify-center gap-1.5 text-xs shadow-md shadow-red-600/20"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Deep Link URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sound Mute Button */}
        <button
          onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
          className={`p-1.5 rounded-md border transition ${
            config.soundEnabled
              ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
              : 'border-red-900/60 bg-red-950/40 text-red-400'
          }`}
          title={config.soundEnabled ? 'Mute Audio Synth' : 'Unmute Audio Synth'}
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
