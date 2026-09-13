import { X, Sliders, Eye, Sparkles, Volume2, HelpCircle, RotateCcw, Compass, Layers, Tv, Zap, BookOpen, ChevronRight, Activity, Piano, Music, Timer } from 'lucide-react';
import { VisualiserConfig, BackgroundTheme, SynthWaveform, ClockLabelType, AutoTonicMode, AutoTonicSensitivity, LayoutMode, LensFlareStyle, StaffClef } from '../core/types';
import { SCALE_MODE_DEFINITIONS } from '../core/scale-alignment';
import { SOLFEGE_SYLLABLES, INTERVAL_NAMES, PIANO_RANGE_PRESETS } from '../core/ppt-constants';
import { PRESET_LAYOUTS } from '../core/layout-models';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: VisualiserConfig;
  onUpdateConfig: (partial: Partial<VisualiserConfig>) => void;
  onResetConfig?: () => void;
  onResetReveals?: () => void;
  onOpenInfoModal?: () => void;
  scaleFitInfo?: {
    currentTonicFit: number;
    bestTonic: number;
    bestTonicFit: number;
    scoreMargin: number;
    shouldShift: boolean;
  };
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onResetConfig,
  onResetReveals,
  onOpenInfoModal,
  scaleFitInfo,
}) => {
  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 w-full sm:w-96 max-w-full bg-[#0b0e17]/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-red-500" />
          <h2 className="font-bold text-slate-100 text-sm tracking-wide">Visualiser Settings</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
        {/* Walkthrough & Theory Primer Banner */}
        <button
          onClick={onOpenInfoModal}
          className="w-full flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-red-950/40 via-slate-900/70 to-purple-950/40 border border-slate-700/80 hover:border-red-500/80 text-left transition group shadow-md cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-md bg-red-950/80 border border-red-800/60 text-red-400 group-hover:scale-105 transition-transform shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white text-xs group-hover:text-red-300 transition-colors truncate">
                Visualiser Walkthrough & Theory
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                Concepts, customisation & links
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-white transition-all shrink-0 ml-1" />
        </button>

        {/* SECTION 1: CONCENTRIC PITCH CLOCK */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs uppercase tracking-wider">
            <Eye className="w-4 h-4 text-red-400" />
            <span>8-Octave Pitch Clock</span>
          </div>

          {/* Auto-Alignment of Do (Scale / Key Tracking) */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-red-400" />
                <label className="block font-medium text-slate-200">Auto-Alignment of Do</label>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoTonicEnabled}
                  onChange={(e) => onUpdateConfig({ autoTonicEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {config.autoTonicEnabled && (
              <div className="space-y-3 pt-1 border-t border-slate-800/60 animate-in fade-in duration-150">
                {/* Mode Selector */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400 font-medium">Target Mode / Scale:</span>
                    <span className="font-mono text-red-400 text-[10px]">
                      {SCALE_MODE_DEFINITIONS[config.autoTonicMode]?.intervals.length} notes
                    </span>
                  </div>
                  <select
                    value={config.autoTonicMode}
                    onChange={(e) => onUpdateConfig({ autoTonicMode: e.target.value as AutoTonicMode })}
                    className="w-full bg-slate-900 text-[11px] text-slate-200 rounded px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {Object.entries(SCALE_MODE_DEFINITIONS).map(([key, def]) => (
                      <option key={key} value={key} className="bg-slate-900 text-slate-200">
                        {def.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 italic">
                    {SCALE_MODE_DEFINITIONS[config.autoTonicMode]?.description}
                  </p>
                </div>

                {/* Custom 12-Tone Scale Degree Checkboxes (if mode is custom) */}
                {config.autoTonicMode === 'custom' && (
                  <div className="space-y-1.5 p-2 bg-slate-800/40 rounded border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Custom Scale Degrees relative to Do:
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((st) => {
                        const isChecked = config.autoTonicCustomDegrees?.includes(st) ?? false;
                        const syllable = SOLFEGE_SYLLABLES[st];
                        const interval = INTERVAL_NAMES[st];
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              const current = config.autoTonicCustomDegrees ?? [0, 2, 4, 5, 7, 9, 11];
                              let next: number[];
                              if (isChecked) {
                                if (current.length <= 1) return;
                                next = current.filter((d) => d !== st);
                              } else {
                                next = [...current, st].sort((a, b) => a - b);
                              }
                              onUpdateConfig({ autoTonicCustomDegrees: next });
                            }}
                            className={`py-1 px-1 rounded text-center text-[10px] font-mono transition border ${
                              isChecked
                                ? 'bg-red-600/30 border-red-500 text-white font-bold'
                                : 'bg-slate-900/60 border-slate-700 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            <div>{syllable}</div>
                            <div className="text-[8px] opacity-75">{interval}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Alignment Sensitivity / Inertia */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400 font-medium">Hysteresis & Stability:</span>
                    <span className="text-slate-400 font-mono text-[10px] capitalize">
                      {config.autoTonicSensitivity}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'fast', label: 'Fast', desc: '450ms debounce, agile for modulation' },
                      { id: 'balanced', label: 'Balanced', desc: '900ms debounce, standard stability' },
                      { id: 'conservative', label: 'Conservative', desc: '1500ms debounce, high inertia' },
                    ].map((sens) => (
                      <button
                        key={sens.id}
                        type="button"
                        onClick={() => onUpdateConfig({ autoTonicSensitivity: sens.id as AutoTonicSensitivity })}
                        className={`py-1 px-1.5 rounded border text-[10px] text-center transition ${
                          config.autoTonicSensitivity === sens.id
                            ? 'bg-red-600/30 border-red-500 text-white font-medium'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                        }`}
                        title={sens.desc}
                      >
                        {sens.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Diatonic Fit Meter */}
                {scaleFitInfo && (
                  <div className="space-y-1 pt-1 border-t border-slate-800/60">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400">Current Diatonic Fit ({['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][config.tonic]}):</span>
                      <span className="font-mono font-bold text-red-400">
                        {Math.round(scaleFitInfo.currentTonicFit * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-red-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${Math.round(scaleFitInfo.currentTonicFit * 100)}%` }}
                      />
                    </div>
                    {scaleFitInfo.bestTonic !== config.tonic && (
                      <div className="flex justify-between items-center text-[9px] text-amber-400/90 font-mono">
                        <span>Candidate: {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][scaleFitInfo.bestTonic]} ({Math.round(scaleFitInfo.bestTonicFit * 100)}% fit)</span>
                        <span>Evaluating...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] text-slate-500 italic">
              When enabled, the system continuously analyzes active notes. If non-diatonic notes increase, Do automatically shifts to align with the target mode, with musical hysteresis preventing thrashing on passing tones.
            </p>
          </div>

          {/* Dynamic Tone Reveal Mode */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <div className="flex justify-between items-center">
              <label className="block font-medium text-slate-300">Tone Circle Reveal</label>
              {onResetReveals && (
                <button
                  onClick={onResetReveals}
                  className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 font-mono transition"
                  title="Reset discovered tones and organic window"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset (R)</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateConfig({ toneRevealMode: 'played' })}
                className={`py-1.5 px-2 rounded border text-center transition ${
                  config.toneRevealMode === 'played'
                    ? 'bg-red-600/30 border-red-500 text-white font-medium'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                Played Tones Only
              </button>
              <button
                onClick={() => onUpdateConfig({ toneRevealMode: 'all' })}
                className={`py-1.5 px-2 rounded border text-center transition ${
                  config.toneRevealMode === 'all'
                    ? 'bg-red-600/30 border-red-500 text-white font-medium'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                All 12 Tones
              </button>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              {config.toneRevealMode === 'played'
                ? 'Only tones that have been activated appear on screen, dynamically populating as you play.'
                : 'All 12 chromatic tones are permanently displayed on active rings.'}
            </p>
            {onResetReveals && (
              <button
                onClick={onResetReveals}
                className="w-full mt-1.5 py-1 px-2 rounded border border-red-500/30 bg-red-600/15 hover:bg-red-600/25 text-red-300 font-medium transition flex items-center justify-center gap-1.5 text-[11px]"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                <span>Clear Discovered Tones & Activity</span>
              </button>
            )}
          </div>

          {/* Octave Register Range & Spacing */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center">
              <label className="block font-medium text-slate-300">Octave Register Range</label>
              <span className="font-mono text-red-400 font-bold">
                Oct {config.startOctave} – {config.endOctave}
              </span>
            </div>

            {/* Visual Octave Span Badges */}
            <div className="grid grid-cols-8 gap-1 pt-0.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((oct) => {
                const isSelected = oct >= config.startOctave && oct <= config.endOctave;
                return (
                  <button
                    key={oct}
                    onClick={() => {
                      if (oct < config.startOctave) {
                        onUpdateConfig({ startOctave: oct });
                      } else if (oct > config.endOctave) {
                        onUpdateConfig({ endOctave: oct });
                      } else {
                        // Toggle or set single
                        onUpdateConfig({ startOctave: oct, endOctave: oct });
                      }
                    }}
                    className={`py-1 text-center rounded text-[10px] font-mono transition ${
                      isSelected
                        ? 'bg-red-600/40 border border-red-500 text-white font-bold'
                        : 'bg-slate-800/30 border border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {oct}
                  </button>
                );
              })}
            </div>

            {/* Range Sliders */}
            <div className="space-y-2 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Start Octave (Outermost):</span>
                  <span className="font-mono text-slate-200">Oct {config.startOctave}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={config.startOctave}
                  onChange={(e) => {
                    const newStart = parseInt(e.target.value, 10);
                    onUpdateConfig({
                      startOctave: newStart,
                      endOctave: Math.max(newStart, config.endOctave),
                    });
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-red-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>End Octave (Innermost):</span>
                  <span className="font-mono text-slate-200">Oct {config.endOctave}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={config.endOctave}
                  onChange={(e) => {
                    const newEnd = parseInt(e.target.value, 10);
                    onUpdateConfig({
                      endOctave: newEnd,
                      startOctave: Math.min(newEnd, config.startOctave),
                    });
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-red-500"
                />
              </div>
            </div>

            {/* Show Octave Numbers Toggle */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-300">Show Octave Numbers (1–8):</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showOctaveNumbers}
                  onChange={(e) => onUpdateConfig({ showOctaveNumbers: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          </div>

          {/* Keyboard / Instrument Physical Range */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center">
              <label className="block font-medium text-slate-300">Keyboard / Instrument Range</label>
              <span className="font-mono text-red-400 font-bold text-[11px]">
                MIDI {config.keyboardLowestMidi} – {config.keyboardHighestMidi}
              </span>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-5 gap-1">
              {[
                { label: '88-Key', low: 21, high: 108 },
                { label: '76-Key', low: 28, high: 103 },
                { label: '61-Key', low: 36, high: 96 },
                { label: '49-Key', low: 48, high: 96 },
                { label: 'Full MIDI', low: 0, high: 127 },
              ].map((p) => {
                const isActive = config.keyboardLowestMidi === p.low && config.keyboardHighestMidi === p.high;
                return (
                  <button
                    key={p.label}
                    onClick={() => onUpdateConfig({ keyboardLowestMidi: p.low, keyboardHighestMidi: p.high })}
                    className={`py-1 px-1 rounded border text-[10px] text-center transition ${
                      isActive
                        ? 'bg-red-600/30 border-red-500 text-white font-medium'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Lowest and Highest controls */}
            <div className="space-y-2 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Lowest Physical Note:</span>
                  <span className="font-mono text-slate-200">
                    {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((config.keyboardLowestMidi % 12) + 12) % 12]} (MIDI {config.keyboardLowestMidi})
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.min(100, config.keyboardHighestMidi - 12)}
                  step={1}
                  value={config.keyboardLowestMidi}
                  onChange={(e) => {
                    const newLow = parseInt(e.target.value, 10);
                    onUpdateConfig({ keyboardLowestMidi: newLow });
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-red-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Highest Physical Note:</span>
                  <span className="font-mono text-slate-200">
                    {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((config.keyboardHighestMidi % 12) + 12) % 12]} (MIDI {config.keyboardHighestMidi})
                  </span>
                </div>
                <input
                  type="range"
                  min={Math.max(24, config.keyboardLowestMidi + 12)}
                  max={127}
                  step={1}
                  value={config.keyboardHighestMidi}
                  onChange={(e) => {
                    const newHigh = parseInt(e.target.value, 10);
                    onUpdateConfig({ keyboardHighestMidi: newHigh });
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-red-500"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic">
              Defines the physical boundaries of the instrument. In PPT, octaves are centred on Do (12 o'clock) and span ascending from So (7 o'clock) to Fi (6 o'clock). Non-existent physical keys (e.g. G0 below an 88-key piano when Do is C) are omitted without distorting ring assignment.
            </p>
          </div>

          {/* Visual Weight & Register Priority */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <label className="block font-medium text-slate-300">Visual Weight & Register Spacing</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'organic', label: 'Organic Window' },
                { id: 'discovered', label: 'Discovered' },
                { id: 'fixed8', label: 'Fixed Range' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onUpdateConfig({ registerWeightMode: opt.id as any })}
                  className={`py-1.5 px-1 rounded border text-[11px] text-center transition ${
                    config.registerWeightMode === opt.id
                      ? 'bg-red-600/30 border-red-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 italic">
              {config.registerWeightMode === 'organic'
                ? 'Dynamic living window: played tones and active registers smoothly fade away after the decay window passes, letting the layout re-balance.'
                : config.registerWeightMode === 'discovered'
                ? 'Cumulative discovery: played tones and octaves stay permanently exposed throughout the session until Reset.'
                : 'Fixed layout: maintains the exact start and end octave range selected above.'}
            </p>

            {/* Inactive Register Display */}
            {config.registerWeightMode !== 'fixed8' && (
              <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                <label className="text-[11px] text-slate-400 block font-medium">Inactive Octaves:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onUpdateConfig({ inactiveRegisterDisplay: 'hidden' })}
                    className={`py-1 px-1.5 rounded border text-[10px] text-center transition ${
                      config.inactiveRegisterDisplay === 'hidden'
                        ? 'bg-red-600/30 border-red-500 text-white font-medium'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Omit (Maximize Space)
                  </button>
                  <button
                    onClick={() => onUpdateConfig({ inactiveRegisterDisplay: 'faint' })}
                    className={`py-1 px-1.5 rounded border text-[10px] text-center transition ${
                      config.inactiveRegisterDisplay === 'faint'
                        ? 'bg-red-600/30 border-red-500 text-white font-medium'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Compress Faint
                  </button>
                </div>
              </div>
            )}

            {config.registerWeightMode === 'organic' && (
              <div className="pt-2 space-y-1">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Activity Decay Window:</span>
                  <span className="font-mono text-red-400">{config.organicWindowDurationSec}s</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={30}
                  step={1}
                  value={config.organicWindowDurationSec}
                  onChange={(e) => onUpdateConfig({ organicWindowDurationSec: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-red-500"
                />
              </div>
            )}
          </div>

          {/* Clock Node Label Priority Slots */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center">
              <label className="block font-medium text-slate-300">Clock Node Label Priorities</label>
              <span className="text-[10px] text-slate-400 font-mono">8 Orbit Slots</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Assigned from outermost/largest orbit (Slot 1) inward to innermost/smallest orbit (Slot 8). Setting all slots identical applies a uniform label across all octaves.
            </p>

            {/* Presets */}
            <div className="space-y-1 pt-0.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Presets:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    onUpdateConfig({
                      clockLabelPriorities: [
                        'pitches',
                        'triPitches',
                        'syllables',
                        'glyphs',
                        'triangles',
                        'intervals',
                        'none',
                        'none',
                      ],
                    })
                  }
                  className="py-1 px-1.5 rounded border border-red-500/50 bg-red-600/20 hover:bg-red-600/30 text-[10px] text-red-300 transition text-center font-medium"
                >
                  Default Hierarchy
                </button>
                <button
                  onClick={() => onUpdateConfig({ clockLabelPriorities: Array(8).fill('pitches') })}
                  className="py-1 px-1.5 rounded border border-slate-700/60 bg-slate-800/40 hover:bg-slate-700/50 text-[10px] text-slate-300 transition text-center"
                >
                  All Pitch Names
                </button>
                <button
                  onClick={() => onUpdateConfig({ clockLabelPriorities: Array(8).fill('triPitches') })}
                  className="py-1 px-1.5 rounded border border-slate-700/60 bg-slate-800/40 hover:bg-slate-700/50 text-[10px] text-slate-300 transition text-center"
                >
                  All Tri Pitch (△X)
                </button>
                <button
                  onClick={() => onUpdateConfig({ clockLabelPriorities: Array(8).fill('syllables') })}
                  className="py-1 px-1.5 rounded border border-slate-700/60 bg-slate-800/40 hover:bg-slate-700/50 text-[10px] text-slate-300 transition text-center"
                >
                  All Solfège Names
                </button>
                <button
                  onClick={() => onUpdateConfig({ clockLabelPriorities: Array(8).fill('glyphs') })}
                  className="py-1 px-1.5 rounded border border-slate-700/60 bg-slate-800/40 hover:bg-slate-700/50 text-[10px] text-slate-300 transition text-center"
                >
                  All Uniform Solfège
                </button>
                <button
                  onClick={() => onUpdateConfig({ clockLabelPriorities: Array(8).fill('triangles') })}
                  className="py-1 px-1.5 rounded border border-slate-700/60 bg-slate-800/40 hover:bg-slate-700/50 text-[10px] text-slate-300 transition text-center"
                >
                  All Piano Triangles
                </button>
              </div>
            </div>

            {/* 8 Priority Slots */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 uppercase tracking-wider font-semibold">Priority Slots (Outer → Inner)</span>
                <span className="text-slate-500 font-mono text-[9px]">S1 (Max) → S8 (Min)</span>
              </div>
              <div className="space-y-1.5 bg-slate-950/40 p-2 rounded-lg border border-slate-800/80">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
                  const defaultSlots: ClockLabelType[] = ['pitches', 'triPitches', 'syllables', 'glyphs', 'triangles', 'intervals', 'none', 'none'];
                  const currentVal = config.clockLabelPriorities?.[idx] ?? defaultSlots[idx];
                  const slotLabel =
                    idx === 0
                      ? 'Slot 1 (Outermost)'
                      : idx === 7
                      ? 'Slot 8 (Innermost)'
                      : `Slot ${idx + 1}`;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2.5 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800 hover:border-slate-700 transition"
                    >
                      <span className="font-mono text-[11px] text-slate-300 font-medium whitespace-nowrap">
                        {slotLabel}
                      </span>
                      <select
                        value={currentVal}
                        onChange={(e) => {
                          const updated = [...(config.clockLabelPriorities || defaultSlots)];
                          updated[idx] = e.target.value as ClockLabelType;
                          onUpdateConfig({ clockLabelPriorities: updated });
                        }}
                        className="bg-slate-950 text-[11px] text-slate-200 rounded px-2 py-1 border border-slate-700/80 focus:outline-none focus:border-red-500 cursor-pointer flex-1 min-w-0"
                      >
                        <option value="pitches">Pitch Names</option>
                        <option value="triPitches">Tri Pitch Class (△X)</option>
                        <option value="syllables">Solfège Names</option>
                        <option value="glyphs">Uniform Solfège</option>
                        <option value="triangles">Piano Triangles</option>
                        <option value="intervals">Intervals</option>
                        <option value="none">None (Dot)</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Decay Duration */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-1">
            <div className="flex justify-between items-center text-slate-300">
              <span className="font-medium">Note Glow Decay:</span>
              <span className="font-mono text-red-400">
                {(config.decayDurationMs / 1000).toFixed(1)}s ({config.decayDurationMs}ms)
              </span>
            </div>
            <input
              type="range"
              min={200}
              max={3500}
              step={50}
              value={config.decayDurationMs}
              onChange={(e) => onUpdateConfig({ decayDurationMs: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-red-500"
            />
          </div>

          {/* Chord Rays & Geometry */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">Chord Connection Rays</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.connectChordRays}
                  onChange={(e) => onUpdateConfig({ connectChordRays: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {config.connectChordRays && (
              <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>Chord Geometry:</span>
                  <span className="font-mono text-red-400">
                    {config.chordRayMode === 'hull' ? 'Convex Hull' : 'Star Web'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onUpdateConfig({ chordRayMode: 'hull' })}
                    className={`py-1 px-2 rounded border text-[11px] text-center transition ${
                      config.chordRayMode === 'hull'
                        ? 'bg-red-600/30 border-red-500 text-white font-medium'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Convex Hull
                  </button>
                  <button
                    onClick={() => onUpdateConfig({ chordRayMode: 'web' })}
                    className={`py-1 px-2 rounded border text-[11px] text-center transition ${
                      config.chordRayMode === 'web'
                        ? 'bg-red-600/30 border-red-500 text-white font-medium'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Star Web
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  {config.chordRayMode === 'hull'
                    ? 'Convex Hull outlines the perimeter of simultaneous chord voicings with zero self-intersecting lines.'
                    : 'Star Web connects all sounding notes in the simultaneous chord cluster.'}
                </p>
              </div>
            )}
          </div>

          {/* Radial Movement Trails & Shockwaves */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-300 font-medium block">Radial Movement Trails</span>
                <span className="text-[10px] text-slate-400 block">Arc trails between melodic notes on the same octave</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-2 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.showRadialMovementTrails}
                  onChange={(e) => onUpdateConfig({ showRadialMovementTrails: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div>
                <span className="text-slate-300 font-medium block">Sustained Tone Pulse Rings</span>
                <span className="text-[10px] text-slate-400 block">Rhythmic pulsing concentric rings around held notes</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                <input
                  type="checkbox"
                  checked={config.pulseShockwaves}
                  onChange={(e) => onUpdateConfig({ pulseShockwaves: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* SECTION 2: LIVE NOTE STREAM */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-orange-400" />
            <span>Sequential Note Stream</span>
          </div>

          {/* Stream Mode */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <label className="block font-medium text-slate-300">Stream Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateConfig({ streamMode: 'fixed' })}
                className={`py-1.5 px-2 rounded border text-center transition ${
                  config.streamMode === 'fixed'
                    ? 'bg-orange-600/30 border-orange-500 text-white font-medium'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                Fixed Length Queue
              </button>
              <button
                onClick={() => onUpdateConfig({ streamMode: 'continuous' })}
                className={`py-1.5 px-2 rounded border text-center transition ${
                  config.streamMode === 'continuous'
                    ? 'bg-orange-600/30 border-orange-500 text-white font-medium'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                Continuous Scroll
              </button>
            </div>
          </div>

          {/* Stream Orientation & Flow Direction */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <label className="block font-medium text-slate-300">Orientation & Flow Direction</label>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Conveyor Orientation:</span>
                <span className="font-mono text-orange-400 capitalize">{config.orientation}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    onUpdateConfig({
                      orientation: 'horizontal',
                      direction: config.direction === 'ttb' || config.direction === 'btt' ? 'rtl' : config.direction,
                    })
                  }
                  className={`py-1.5 px-2 rounded border text-center transition ${
                    config.orientation === 'horizontal'
                      ? 'bg-orange-600/30 border-orange-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Horizontal
                </button>
                <button
                  onClick={() =>
                    onUpdateConfig({
                      orientation: 'vertical',
                      direction: config.direction === 'rtl' || config.direction === 'ltr' ? 'ttb' : config.direction,
                    })
                  }
                  className={`py-1.5 px-2 rounded border text-center transition ${
                    config.orientation === 'vertical'
                      ? 'bg-orange-600/30 border-orange-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Vertical
                </button>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                <span>Flow Direction:</span>
                <span className="font-mono text-orange-400 uppercase">{config.direction}</span>
              </div>
              {config.orientation === 'horizontal' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onUpdateConfig({ direction: 'rtl' })}
                    className={`py-1.5 px-2 rounded border text-center transition ${
                      config.direction === 'rtl'
                        ? 'bg-orange-600/30 border-orange-500 text-white font-medium'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Right to Left (RTL)
                  </button>
                  <button
                    onClick={() => onUpdateConfig({ direction: 'ltr' })}
                    className={`py-1.5 px-2 rounded border text-center transition ${
                      config.direction === 'ltr'
                        ? 'bg-orange-600/30 border-orange-500 text-white font-medium'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Left to Right (LTR)
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onUpdateConfig({ direction: 'ttb' })}
                    className={`py-1.5 px-2 rounded border text-center transition ${
                      config.direction === 'ttb'
                        ? 'bg-orange-600/30 border-orange-500 text-white font-medium'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Waterfall (Top to Bottom)
                  </button>
                  <button
                    onClick={() => onUpdateConfig({ direction: 'btt' })}
                    className={`py-1.5 px-2 rounded border text-center transition ${
                      config.direction === 'btt'
                        ? 'bg-orange-600/30 border-orange-500 text-white font-medium'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Upward (Bottom to Top)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Window Size Slider */}
          {config.streamMode === 'fixed' && (
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-1">
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-medium">Fixed Window Size:</span>
                <span className="font-mono text-orange-400">
                  {config.fixedWindowSize === 1 ? '1 (Kinetic Rotation Mode)' : `${config.fixedWindowSize} notes`}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={24}
                step={1}
                value={config.fixedWindowSize}
                onChange={(e) => onUpdateConfig({ fixedWindowSize: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-orange-500"
              />
              {config.fixedWindowSize === 1 && (
                <div className="mt-2 p-2 rounded bg-orange-950/40 border border-orange-800/60 flex items-start gap-1.5 text-[10px] text-orange-300">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Single-Window Showcase active:</strong> Morphs and smoothly rotates Uniform Solfège glyphs between note representations!
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Stream Presentation Format */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <label className="block font-medium text-slate-300">Stream Presentation Format</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'glyphs', label: 'Uniform Solfège' },
                { id: 'pianoTriangles', label: 'Piano Triangles' },
                { id: 'syllables', label: 'Solfège Syllables' },
                { id: 'pitchNames', label: 'Pitch Names' },
                { id: 'triPitches', label: 'Tri Pitch (△X)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onUpdateConfig({ presentationFormat: opt.id as any })}
                  className={`py-1 px-2 rounded border text-[11px] transition ${
                    config.presentationFormat === opt.id
                      ? 'bg-orange-600/30 border-orange-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Register Filters */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <label className="block font-medium text-slate-300">Stream Register Filter</label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'bass', label: 'Bass' },
                { id: 'mid', label: 'Mid' },
                { id: 'treble', label: 'Treble' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onUpdateConfig({ streamFilterRegister: opt.id as any })}
                  className={`py-1 px-1.5 rounded border text-[11px] text-center transition ${
                    config.streamFilterRegister === opt.id
                      ? 'bg-orange-600/30 border-orange-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION: STAFF STREAM NOTATION */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs uppercase tracking-wider">
            <Music className="w-4 h-4 text-amber-400" />
            <span>Staff Stream Notation</span>
          </div>

          {/* Staff Size */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <label className="block font-medium text-slate-300">Staff Size</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateConfig({ staffSize: 'grand' })}
                className={`py-1.5 px-2 rounded border text-center transition ${
                  (config.staffSize || 'grand') === 'grand'
                    ? 'bg-amber-600/30 border-amber-500 text-white font-medium'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                Grand Staff (10 Lines)
              </button>
              <button
                onClick={() => onUpdateConfig({ staffSize: 'single' })}
                className={`py-1.5 px-2 rounded border text-center transition ${
                  config.staffSize === 'single'
                    ? 'bg-amber-600/30 border-amber-500 text-white font-medium'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                Single Staff (5 Lines)
              </button>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              {config.staffSize === 'single'
                ? 'Single 5-line staff with dynamic clef adaptation (Treble, Bass, and optional C-clefs).'
                : 'Adjacent Treble and Bass staves with Middle C shared as the 1st ledger line between them.'}
            </p>
          </div>

          {/* Staff Stream Mode */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <label className="block font-medium text-slate-300">Conveyor Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateConfig({ staffStreamMode: 'continuous' })}
                className={`py-1.5 px-2 rounded border text-center transition ${
                  (config.staffStreamMode || 'continuous') === 'continuous'
                    ? 'bg-amber-600/30 border-amber-500 text-white font-medium'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                Continuous Scroll
              </button>
              <button
                onClick={() => onUpdateConfig({ staffStreamMode: 'fixed' })}
                className={`py-1.5 px-2 rounded border text-center transition ${
                  config.staffStreamMode === 'fixed'
                    ? 'bg-amber-600/30 border-amber-500 text-white font-medium'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                Fixed Queue
              </button>
            </div>
          </div>

          {/* Fixed Queue Window Length */}
          {config.staffStreamMode === 'fixed' && (
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-1">
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-medium">Fixed Queue Length:</span>
                <span className="font-mono text-amber-400 font-bold">
                  {config.staffFixedWindowSize ?? 8} notes
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={24}
                step={1}
                value={config.staffFixedWindowSize ?? 8}
                onChange={(e) => onUpdateConfig({ staffFixedWindowSize: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
              />
              <p className="text-[10px] text-slate-500 italic">
                Controls the number of discrete notes shown on the staff queue simultaneously.
              </p>
            </div>
          )}

          {/* Clef Selection */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <div className="flex justify-between items-center text-[11px] text-slate-300">
              <span className="font-medium">Clef Selection:</span>
              <span className="font-mono text-amber-400 capitalize">{config.staffClef || 'dynamic'}</span>
            </div>
            <select
              value={config.staffClef || 'dynamic'}
              onChange={(e) => onUpdateConfig({ staffClef: e.target.value as StaffClef })}
              className="w-full bg-slate-800/80 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="dynamic">Dynamic (Prioritises Staff Lines)</option>
              <option value="treble">Treble (G-clef)</option>
              <option value="treble_8va">Treble 8va (Octave Up)</option>
              <option value="treble_8vb">Treble 8vb (Octave Down)</option>
              <option value="bass">Bass (F-clef)</option>
              <option value="bass_8va">Bass 8va (Octave Up)</option>
              <option value="bass_8vb">Bass 8vb (Octave Down)</option>
              {config.staffSize === 'single' && config.includeCClefs && (
                <>
                  <option value="alto">Alto (C-clef Line 3)</option>
                  <option value="tenor">Tenor (C-clef Line 4)</option>
                </>
              )}
            </select>

            {config.staffSize === 'single' && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <div>
                  <span className="text-slate-300 font-medium block">Enable C-Clefs</span>
                  <span className="text-[10px] text-slate-400 block">Include Alto &amp; Tenor in dynamic evaluation</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.includeCClefs || false}
                    onChange={(e) => onUpdateConfig({ includeCClefs: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
            )}
          </div>

          {/* Key Signature & Voice Leading Lines */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-300 font-medium block">Key Signature</span>
                <span className="text-[10px] text-slate-400 block">Display sharps/flats after clef</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.showKeySignature || false}
                  onChange={(e) => onUpdateConfig({ showKeySignature: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div>
                <span className="text-slate-300 font-medium block">Voice Leading Lines</span>
                <span className="text-[10px] text-slate-400 block">Chromatic Solfège gradient trails between onsets</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.showVoiceLeadingLines !== false}
                  onChange={(e) => onUpdateConfig({ showVoiceLeadingLines: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div>
                <span className="text-slate-300 font-medium block">Voice Leading Undulation</span>
                <span className="text-[10px] text-slate-400 block">Harmonic wave undulation &amp; travelling counterpoint pulses</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.voiceLeadingUndulation !== false}
                  onChange={(e) => onUpdateConfig({ voiceLeadingUndulation: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div>
                <span className="text-slate-300 font-medium block">Note Entrance Pop &amp; Flash</span>
                <span className="text-[10px] text-slate-400 block">Elastic scale pop &amp; radiant flash at origin line</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.noteEntranceAnimation !== false}
                  onChange={(e) => onUpdateConfig({ noteEntranceAnimation: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div>
                <span className="text-slate-300 font-medium block">Origin Spark Spray</span>
                <span className="text-[10px] text-slate-400 block">Directional eastward sparks shooting from playhead</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.staffSparksEnabled !== false}
                  onChange={(e) => onUpdateConfig({ staffSparksEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div>
                <span className="text-slate-300 font-medium block">Termination Dissipation</span>
                <span className="text-[10px] text-slate-400 block">Horizontal squish &amp; cyan ripple at boundary</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.staffAbsorptionEnabled !== false}
                  onChange={(e) => onUpdateConfig({ staffAbsorptionEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* SECTION 3: COSMETICS & KINETIC AESTHETICS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between font-semibold text-slate-200 text-xs uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Cosmetics & Kinetic Effects</span>
            </div>
            <span className="font-mono text-[10px] text-purple-400 font-normal">
              {[
                config.filmGrainEnabled ?? true,
                config.lightBleedEnabled ?? true,
                config.ghostingEnabled ?? true,
                config.scanlinesEnabled ?? true,
                config.lensFlareEnabled ?? true,
                config.sparksEnabled ?? true,
                config.glowBloomEnabled ?? true,
                config.motionTrailsEnabled ?? true,
              ].filter(Boolean).length}/8 active
            </span>
          </div>

          {/* Quick Performance Profiles & Hardware Accel */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2.5">
            <div className="flex justify-between items-center text-slate-300">
              <div className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[11px] font-medium text-slate-300">Rendering Cost Control</span>
              </div>
              <span className="text-[9px] text-slate-500 font-mono">Quick Profiles</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({
                    filmGrainEnabled: true,
                    lightBleedEnabled: true,
                    ghostingEnabled: true,
                    scanlinesEnabled: true,
                    lensFlareEnabled: true,
                    sparksEnabled: true,
                    glowBloomEnabled: true,
                    motionTrailsEnabled: true,
                    tonicShiftEffectsEnabled: true,
                    overtoneDropletsEnabled: true,
                  })
                }
                className="py-1.5 px-1 rounded border border-purple-500/50 bg-purple-600/20 hover:bg-purple-600/30 text-[10px] text-purple-300 font-medium transition text-center"
              >
                Max Effects
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({
                    filmGrainEnabled: true,
                    lightBleedEnabled: true,
                    ghostingEnabled: false,
                    scanlinesEnabled: true,
                    lensFlareEnabled: true,
                    sparksEnabled: true,
                    glowBloomEnabled: true,
                    motionTrailsEnabled: true,
                    tonicShiftEffectsEnabled: true,
                    overtoneDropletsEnabled: true,
                  })
                }
                className="py-1.5 px-1 rounded border border-slate-700/60 bg-slate-800/40 hover:bg-slate-700/50 text-[10px] text-slate-300 font-medium transition text-center"
              >
                Balanced
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({
                    filmGrainEnabled: false,
                    lightBleedEnabled: false,
                    ghostingEnabled: false,
                    scanlinesEnabled: false,
                    lensFlareEnabled: false,
                    sparksEnabled: false,
                    glowBloomEnabled: false,
                    motionTrailsEnabled: false,
                    tonicShiftEffectsEnabled: false,
                    overtoneDropletsEnabled: false,
                  })
                }
                className="py-1.5 px-1 rounded border border-emerald-500/50 bg-emerald-600/20 hover:bg-emerald-600/30 text-[10px] text-emerald-300 font-medium transition text-center"
              >
                Eco Mode
              </button>
            </div>

            {/* Hardware WebGL Pipeline Switch */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-300 block font-medium">Hardware WebGL Pipeline</span>
                <span className="text-[9px] text-slate-500 block">GPU fragment shaders for fullscreen optics</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                <input
                  type="checkbox"
                  checked={config.webglEnabled ?? true}
                  onChange={(e) => onUpdateConfig({ webglEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>

          {/* Background Theme */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <label className="block font-medium text-slate-300">Background Aesthetic</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'studio-obsidian', label: 'Studio Obsidian' },
                { id: 'cosmic-abyss', label: 'Cosmic Abyss' },
                { id: 'carbon-grid', label: 'Carbon Grid' },
                { id: 'velvet-dark', label: 'Velvet Dark' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => onUpdateConfig({ backgroundTheme: theme.id as BackgroundTheme })}
                  className={`py-1 px-2 rounded border text-[11px] transition ${
                    config.backgroundTheme === theme.id
                      ? 'bg-purple-600/30 border-purple-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* 1. Procedural Film Grain */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Procedural Film Grain</span>
                <span className="text-[10px] text-slate-400 block">Analogue 24fps film emulsion texture</span>
              </div>
              <div className="flex items-center gap-2">
                {!(config.filmGrainEnabled ?? true) && (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.filmGrainEnabled ?? true}
                    onChange={(e) => onUpdateConfig({ filmGrainEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            {(config.filmGrainEnabled ?? true) && (
              <div className="space-y-3 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Grain Opacity:</span>
                    <span className="font-mono text-purple-400">{Math.round(config.filmGrainIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.filmGrainIntensity}
                    onChange={(e) => onUpdateConfig({ filmGrainIntensity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Grain Size / Gauge */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                  <label className="text-[11px] text-slate-400 block font-medium">Grain Gauge / Scale:</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { size: 1, label: '35mm' },
                      { size: 2, label: '16mm' },
                      { size: 3, label: '8mm' },
                      { size: 4, label: 'Chunky' },
                    ].map((g) => (
                      <button
                        key={g.size}
                        onClick={() => onUpdateConfig({ filmGrainSize: g.size })}
                        className={`py-1 px-1 rounded border text-[10px] text-center font-medium transition ${
                          (config.filmGrainSize ?? 1) === g.size
                            ? 'bg-purple-600/30 border-purple-500 text-white'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grain Contrast Slider */}
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Grain Contrast / Grit:</span>
                    <span className="font-mono text-purple-400">
                      {Math.round((config.filmGrainContrast ?? 0.5) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.filmGrainContrast ?? 0.5}
                    onChange={(e) => onUpdateConfig({ filmGrainContrast: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>Soft Organic</span>
                    <span>Gritty High-Contrast</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Light Bleed & Halation */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Light Bleed & Halation</span>
                <span className="text-[10px] text-slate-400 block">Warm film corona & anamorphic streaks</span>
              </div>
              <div className="flex items-center gap-2">
                {!(config.lightBleedEnabled ?? true) && (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.lightBleedEnabled ?? true}
                    onChange={(e) => onUpdateConfig({ lightBleedEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            {(config.lightBleedEnabled ?? true) && (
              <div className="space-y-3 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Light Bleed Intensity:</span>
                    <span className="font-mono text-purple-400">
                      {Math.round((config.lightBleedIntensity ?? 0.25) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.lightBleedIntensity ?? 0.25}
                    onChange={(e) => onUpdateConfig({ lightBleedIntensity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Halation Decay Duration */}
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Halation Decay Duration:</span>
                    <span className="font-mono text-purple-400">
                      {(config.decayDurationMs / 1000).toFixed(1)}s ({config.decayDurationMs}ms)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={3500}
                    step={50}
                    value={config.decayDurationMs}
                    onChange={(e) => onUpdateConfig({ decayDurationMs: parseInt(e.target.value, 10) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Phosphor Ghosting */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Phosphor Ghosting</span>
                <span className="text-[10px] text-slate-400 block">Oscilloscope CRT chromatic decay trails</span>
              </div>
              <div className="flex items-center gap-2">
                {!(config.ghostingEnabled ?? true) && (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.ghostingEnabled ?? true}
                    onChange={(e) => onUpdateConfig({ ghostingEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            {(config.ghostingEnabled ?? true) && (
              <div className="space-y-1 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Phosphor Persistence:</span>
                  <span className="font-mono text-purple-400">
                    {Math.round((config.ghostingIntensity ?? 0.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.ghostingIntensity ?? 0.0}
                  onChange={(e) => onUpdateConfig({ ghostingIntensity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            )}
          </div>

          {/* 4. CRT Scanlines & Glass Optics */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div className="flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-purple-400" />
                <div>
                  <span className="font-medium block">CRT Scanlines & Glass Optics</span>
                  <span className="text-[10px] text-slate-400 block">Subpixel raster lines & tube curvature</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!(config.scanlinesEnabled ?? true) && (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.scanlinesEnabled ?? true}
                    onChange={(e) => onUpdateConfig({ scanlinesEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            {(config.scanlinesEnabled ?? true) && (
              <div className="space-y-3 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Scanline Opacity:</span>
                    <span className="font-mono text-purple-400">
                      {Math.round((config.scanlineIntensity ?? 0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.scanlineIntensity ?? 0}
                    onChange={(e) => onUpdateConfig({ scanlineIntensity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Scanline Density */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                  <label className="text-[11px] text-slate-400 block font-medium">Line Pitch / Density:</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { density: 1, label: 'Fine (1px)' },
                      { density: 2, label: 'Standard' },
                      { density: 3, label: 'Retro' },
                      { density: 4, label: 'Arcade' },
                    ].map((d) => (
                      <button
                        key={d.density}
                        onClick={() => onUpdateConfig({ scanlineDensity: d.density })}
                        className={`py-1 px-1 rounded border text-[10px] text-center font-medium transition ${
                          (config.scanlineDensity ?? 2) === d.density
                            ? 'bg-purple-600/30 border-purple-500 text-white'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CRT Screen Vignette */}
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>CRT Screen Curvature Vignette:</span>
                    <span className="font-mono text-purple-400">
                      {Math.round((config.crtVignette ?? 0.2) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.crtVignette ?? 0.2}
                    onChange={(e) => onUpdateConfig({ crtVignette: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Optical Lens Flare & Starburst */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Optical Lens Flare & Starburst</span>
                <span className="text-[10px] text-slate-400 block">Diffraction starbursts, streaks & ghosts</span>
              </div>
              <div className="flex items-center gap-2">
                {!(config.lensFlareEnabled ?? true) && (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.lensFlareEnabled ?? true}
                    onChange={(e) => onUpdateConfig({ lensFlareEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            {(config.lensFlareEnabled ?? true) && (
              <div className="space-y-3 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Lens Flare Brightness:</span>
                    <span className="font-mono text-purple-400">
                      {Math.round((config.lensFlareIntensity ?? 0.35) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.lensFlareIntensity ?? 0.35}
                    onChange={(e) => onUpdateConfig({ lensFlareIntensity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Flare Style Buttons */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                  <label className="text-[11px] text-slate-400 block font-medium">Optical Optics Preset:</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { style: 'cinematic' as LensFlareStyle, label: 'Cinematic' },
                      { style: 'anamorphic' as LensFlareStyle, label: 'Anamorphic' },
                      { style: 'starburst' as LensFlareStyle, label: 'Starburst' },
                    ].map((item) => (
                      <button
                        key={item.style}
                        onClick={() => onUpdateConfig({ lensFlareStyle: item.style })}
                        className={`py-1 px-1 rounded border text-[10px] text-center font-medium transition ${
                          (config.lensFlareStyle ?? 'cinematic') === item.style
                            ? 'bg-purple-600/30 border-purple-500 text-white'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Piano Triangles Lens Flares Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <div>
                    <span className="text-[11px] text-slate-300 block font-medium">Piano Triangles Lens Flares</span>
                    <span className="text-[9px] text-slate-400 block">Diffraction flares on active keyboard triangle vertices</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={config.triangleLensFlaresEnabled !== false}
                      onChange={(e) => onUpdateConfig({ triangleLensFlaresEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {/* Flare Decay Duration Slider */}
                <div className="space-y-1 pt-2 border-t border-slate-800/60">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Flare & Starburst Decay Duration:</span>
                    <span className="font-mono text-purple-400">
                      {(config.decayDurationMs / 1000).toFixed(1)}s ({config.decayDurationMs}ms)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={3500}
                    step={50}
                    value={config.decayDurationMs}
                    onChange={(e) => onUpdateConfig({ decayDurationMs: parseInt(e.target.value, 10) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 6. Reactive Note Sparks Physics */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Reactive Note Sparks Physics</span>
                <span className="text-[10px] text-slate-400 block">Dynamic kinetic particle bursts</span>
              </div>
              <div className="flex items-center gap-2">
                {!(config.sparksEnabled ?? true) && (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.sparksEnabled ?? true}
                    onChange={(e) => onUpdateConfig({ sparksEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            {(config.sparksEnabled ?? true) && (
              <div className="space-y-3 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Sparks Master Intensity:</span>
                    <span className="font-mono text-purple-400">{Math.round(config.particleIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.particleIntensity}
                    onChange={(e) => onUpdateConfig({ particleIntensity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Particle Size Multiplier */}
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Particle Size:</span>
                    <span className="font-mono text-purple-400">{(config.particleSize ?? 1.0).toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    value={config.particleSize ?? 1.0}
                    onChange={(e) => onUpdateConfig({ particleSize: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Particle Volume / Count Multiplier */}
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Sparks Volume / Count:</span>
                    <span className="font-mono text-purple-400">{(config.particleVolume ?? 1.0).toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={3.0}
                    step={0.1}
                    value={config.particleVolume ?? 1.0}
                    onChange={(e) => onUpdateConfig({ particleVolume: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Particle Gravity */}
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Physics Gravity:</span>
                    <span className="font-mono text-purple-400">
                      {(config.particleGravity ?? 0.15) > 0 ? '+' : ''}{(config.particleGravity ?? 0.15).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-2.0}
                    max={2.0}
                    step={0.05}
                    value={config.particleGravity ?? 0.15}
                    onChange={(e) => onUpdateConfig({ particleGravity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>Float Upwards</span>
                    <span>Zero-G</span>
                    <span>Downward Fall</span>
                  </div>
                </div>

                {/* Origin Distance Offset */}
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Origin Offset from Tone Node:</span>
                    <span className="font-mono text-purple-400">{config.particleOriginDistance ?? 0}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={2}
                    value={config.particleOriginDistance ?? 0}
                    onChange={(e) => onUpdateConfig({ particleOriginDistance: parseInt(e.target.value, 10) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Piano Triangles Sparks Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <div>
                    <span className="text-[11px] text-slate-300 block font-medium">Piano Triangles Vertex Sparks</span>
                    <span className="text-[9px] text-slate-400 block">Directional particle bursts on active triangle vertices</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={config.triangleSparksEnabled !== false}
                      onChange={(e) => onUpdateConfig({ triangleSparksEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 6b. Note Activation Shockwaves */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Note Activation Shockwaves</span>
                <span className="text-[10px] text-slate-400 block">Expanding kinetic rings with smooth Hann window dissolve</span>
              </div>
              <div className="flex items-center gap-2">
                {!(config.shockwavesEnabled ?? true) && (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.shockwavesEnabled ?? true}
                    onChange={(e) => onUpdateConfig({ shockwavesEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            {(config.shockwavesEnabled ?? true) && (
              <div className="space-y-3 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
                {/* Max Expansion Radius */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Expansion Radius:</span>
                    <span className="font-mono text-purple-400">{Math.round((config.shockwaveRadius ?? 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={2.5}
                    step={0.05}
                    value={config.shockwaveRadius ?? 1.0}
                    onChange={(e) => onUpdateConfig({ shockwaveRadius: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Expansion Speed */}
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Expansion Speed:</span>
                    <span className="font-mono text-purple-400">{(config.shockwaveSpeed ?? 1.0).toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={2.5}
                    step={0.05}
                    value={config.shockwaveSpeed ?? 1.0}
                    onChange={(e) => onUpdateConfig({ shockwaveSpeed: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Decay / Dissolve Duration */}
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Dissolve Duration:</span>
                    <span className="font-mono text-purple-400">{config.shockwaveDecayDurationMs ?? 650}ms</span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={2000}
                    step={50}
                    value={config.shockwaveDecayDurationMs ?? 650}
                    onChange={(e) => onUpdateConfig({ shockwaveDecayDurationMs: parseInt(e.target.value, 10) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Piano Triangles Shockwaves Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <div>
                    <span className="text-[11px] text-slate-300 block font-medium">Piano Triangles Vertex Shockwaves</span>
                    <span className="text-[9px] text-slate-400 block">Expanding rings on active triangle vertices</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={config.triangleShockwavesEnabled !== false}
                      onChange={(e) => onUpdateConfig({ triangleShockwavesEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 7. Neon Glow Bloom */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Neon Glow Bloom</span>
                <span className="text-[10px] text-slate-400 block">Radial radiant bloom around active nodes</span>
              </div>
              <div className="flex items-center gap-2">
                {!(config.glowBloomEnabled ?? true) && (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.glowBloomEnabled ?? true}
                    onChange={(e) => onUpdateConfig({ glowBloomEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            {(config.glowBloomEnabled ?? true) && (
              <div className="space-y-1 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Bloom Intensity:</span>
                  <span className="font-mono text-purple-400">{Math.round(config.glowBloom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.5}
                  step={0.05}
                  value={config.glowBloom}
                  onChange={(e) => onUpdateConfig({ glowBloom: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            )}
          </div>

          {/* 8. Motion Trail Persistence */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Motion Trail Persistence</span>
                <span className="text-[10px] text-slate-400 block">Smooth frame-to-frame persistence trails</span>
              </div>
              <div className="flex items-center gap-2">
                {!(config.motionTrailsEnabled ?? true) && (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.motionTrailsEnabled ?? true}
                    onChange={(e) => onUpdateConfig({ motionTrailsEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            {(config.motionTrailsEnabled ?? true) && (
              <div className="space-y-1 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Trail Persistence:</span>
                  <span className="font-mono text-purple-400">{Math.round(config.motionTrails * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.7}
                  step={0.05}
                  value={config.motionTrails}
                  onChange={(e) => onUpdateConfig({ motionTrails: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            )}
          </div>

          {/* 9. Tonic Shift Kinetics */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Tonic Shift Kinetics</span>
                <span className="text-[10px] text-slate-400 block">Shockwaves, modulation sweeps & stream markers</span>
              </div>
              <div className="flex items-center gap-2">
                {!(config.tonicShiftEffectsEnabled ?? true) && (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config.tonicShiftEffectsEnabled ?? true}
                    onChange={(e) => onUpdateConfig({ tonicShiftEffectsEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-800/60 pt-2">
              Triggers a luminous compass sweep arc and Do zenith beacon on the pitch clock, a vertical laser surge on piano triangles, a timeline modulation barrier in the note stream, and an HUD badge whenever tonic is changed.
            </p>
          </div>
        </section>

        {/* SECTION 4: SOUND SYNTHESIZER */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs uppercase tracking-wider">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>Audio Synthesiser</span>
          </div>

          {/* Master Volume */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <div className="flex justify-between items-center text-slate-400 text-[11px]">
              <span>Master Volume:</span>
              <span className="font-mono text-emerald-400">{Math.round(config.masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.masterVolume}
              onChange={(e) => onUpdateConfig({ masterVolume: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Real-time Focus Mode */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Real-time Focus Mode</span>
                <span className="text-[10px] text-slate-400 block">Only visualise and play audio when window is focused</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.focusModeEnabled ?? true}
                  onChange={(e) => onUpdateConfig({ focusModeEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Discards background MIDI events and mutes audio when switching away, preventing event backlog bursts and duplicate sounds across multiple instances.
            </p>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-2">
            <label className="block font-medium text-slate-300">Waveform Timbre</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'warm-poly', label: 'Warm Poly' },
                { id: 'sine', label: 'Pure Sine' },
                { id: 'triangle', label: 'Triangle' },
                { id: 'sawtooth', label: 'Sawtooth' },
              ].map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => onUpdateConfig({ synthWaveform: wf.id as SynthWaveform })}
                  className={`py-1 px-2 rounded border text-[11px] transition ${
                    config.synthWaveform === wf.id
                      ? 'bg-emerald-600/30 border-emerald-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {wf.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION: OVERTONES & FLUID WAVE SIMULATION */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs uppercase tracking-wider">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Overtones Wave Simulation</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Dissonance / Roughness Curve</span>
                <span className="text-[10px] text-slate-400 block">Visualise acoustic interference &amp; Plomp-Levelt crunch</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.showDissonanceCurve ?? true}
                  onChange={(e) => onUpdateConfig({ showDissonanceCurve: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <div>
                <span className="font-medium block">Solfège &amp; Multiplier Badges</span>
                <span className="text-[10px] text-slate-400 block">Show pitch syllable and harmonic numbers (1×..7×)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.showOvertoneLabels ?? true}
                  onChange={(e) => onUpdateConfig({ showOvertoneLabels: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-medium block">Fluid Droplet Ejection</span>
                <span className="text-[10px] text-slate-400 block">Eject upward fluid droplets and mist from fundamental wave crests</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.overtoneDropletsEnabled ?? true}
                  onChange={(e) => onUpdateConfig({ overtoneDropletsEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="font-medium">Fluid Ripple Speed</span>
                <span className="font-mono text-cyan-400">{(config.fluidSpeed ?? 1.0).toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.1"
                value={config.fluidSpeed ?? 1.0}
                onChange={(e) => onUpdateConfig({ fluidSpeed: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="font-medium">Wave Fluidity (Undulation)</span>
                <span className="font-mono text-cyan-400">{Math.round((config.waveFluidity ?? 0.8) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={config.waveFluidity ?? 0.8}
                onChange={(e) => onUpdateConfig({ waveFluidity: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>
        </section>

        {/* SECTION: RHYTHM ORBIT */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs uppercase tracking-wider">
            <Timer className="w-4 h-4 text-rose-400" />
            <span>Rhythm Orbit Visualiser</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            {/* Track Mode */}
            <div>
              <label className="block font-medium text-slate-300 mb-1">Track Distribution Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onUpdateConfig({ rhythmTrackMode: 'dynamic' })}
                  className={`py-1.5 px-2 rounded border text-center transition ${
                    (config.rhythmTrackMode ?? 'dynamic') === 'dynamic'
                      ? 'bg-rose-600/30 border-rose-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Dynamic (Up to 8)
                </button>
                <button
                  onClick={() => onUpdateConfig({ rhythmTrackMode: 'fixed' })}
                  className={`py-1.5 px-2 rounded border text-center transition ${
                    config.rhythmTrackMode === 'fixed'
                      ? 'bg-rose-600/30 border-rose-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fixed Range
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 italic">
                {config.rhythmTrackMode === 'fixed'
                  ? 'Allocates notes evenly across a static number of concentric pitch tracks.'
                  : 'Expands dynamic tracks as new distinct pitches are played in the active timing window.'}
              </p>
            </div>

            {/* Fixed Track Count Slider */}
            {config.rhythmTrackMode === 'fixed' && (
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="font-medium">Fixed Track Count</span>
                  <span className="font-mono text-rose-400">{config.rhythmTrackCount ?? 4} tracks</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={config.rhythmTrackCount ?? 4}
                  onChange={(e) => onUpdateConfig({ rhythmTrackCount: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-rose-500"
                />
              </div>
            )}

            {/* Notehead Style */}
            <div>
              <label className="block font-medium text-slate-300 mb-1">Notehead Symbol Taxonomy</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onUpdateConfig({ rhythmNoteheadStyle: 'ppt' })}
                  className={`py-1.5 px-2 rounded border text-center transition ${
                    (config.rhythmNoteheadStyle ?? 'ppt') === 'ppt'
                      ? 'bg-rose-600/30 border-rose-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  PPT Geometric
                </button>
                <button
                  onClick={() => onUpdateConfig({ rhythmNoteheadStyle: 'solfege' })}
                  className={`py-1.5 px-2 rounded border text-center transition ${
                    config.rhythmNoteheadStyle === 'solfege'
                      ? 'bg-rose-600/30 border-rose-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Uniform Solfège
                </button>
              </div>
            </div>

            {/* Quantisation Mode */}
            <div>
              <label className="block font-medium text-slate-300 mb-1">Quantisation Tolerance</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['none', 'subtle', 'strict'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => onUpdateConfig({ rhythmQuantisation: q })}
                    className={`py-1 px-2 rounded border text-center text-xs capitalize transition ${
                      (config.rhythmQuantisation ?? 'subtle') === q
                        ? 'bg-rose-600/30 border-rose-500 text-white font-medium'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1 italic">
                Subtle mode applies soft snapping towards 12-position divisions while respecting natural performance feel.
              </p>
            </div>

            {/* Auto-Tempo Detection */}
            <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-medium block">Real-time Auto-Tempo Detection</span>
                <span className="text-[10px] text-slate-400 block">Dual-threshold hysteresis (fast duple modulation vs stable non-duple shifts)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.rhythmAutoTempoEnabled ?? true}
                  onChange={(e) => onUpdateConfig({ rhythmAutoTempoEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {/* Manual Base BPM */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="font-medium">Tempo Base (BPM)</span>
                <span className="font-mono text-rose-400">{config.rhythmManualBpm ?? 120} BPM</span>
              </div>
              <input
                type="range"
                min="40"
                max="240"
                step="1"
                value={config.rhythmManualBpm ?? 120}
                onChange={(e) => onUpdateConfig({ rhythmManualBpm: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-rose-500"
              />
            </div>

            {/* Note Window Size */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="font-medium">Timing Note Window</span>
                <span className="font-mono text-rose-400">{config.rhythmNoteWindowSize ?? 24} notes</span>
              </div>
              <input
                type="range"
                min="4"
                max="64"
                step="1"
                value={config.rhythmNoteWindowSize ?? 24}
                onChange={(e) => onUpdateConfig({ rhythmNoteWindowSize: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-rose-500"
              />
            </div>

            {/* Central BPM Readout */}
            <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-medium block">Central BPM Readout</span>
                <span className="text-[10px] text-slate-400 block">Display detected tempo in the centre of the orbit</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.rhythmShowBpm ?? true}
                  onChange={(e) => onUpdateConfig({ rhythmShowBpm: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {/* Tuner Indicator Gauge */}
            <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-medium block">Tuner-Style Shift Gauge</span>
                <span className="text-[10px] text-slate-400 block">Visual needle offset from Do indicating pending tempo drift</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.rhythmShowTunerIndicator ?? true}
                  onChange={(e) => onUpdateConfig({ rhythmShowTunerIndicator: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {/* Downbeat Perimeter Pulses */}
            <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-medium block">Downbeat Perimeter Pulses</span>
                <span className="text-[10px] text-slate-400 block">Radial shockwave ring emission each time the hand crosses 12 o'clock</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={config.rhythmDownbeatPulses ?? true}
                  onChange={(e) => onUpdateConfig({ rhythmDownbeatPulses: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* SECTION: VIRTUAL PIANO KEYBOARD */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs uppercase tracking-wider">
            <Piano className="w-4 h-4 text-cyan-400" />
            <span>Virtual Piano Keyboard</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            {/* Visibility Toggle */}
            <div className="flex justify-between items-center">
              <label className="block font-medium text-slate-200">Show Virtual Piano</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showVirtualKeyboard}
                  onChange={(e) => onUpdateConfig({ showVirtualKeyboard: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Piano Range Presets */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400 font-medium">Keyboard Range:</span>
                <span className="font-mono text-cyan-400 text-[10px]">
                  {PIANO_RANGE_PRESETS.find(
                    (p) =>
                      (config.virtualKeyboardStartMidi ?? 48) === p.startMidi &&
                      (config.virtualKeyboardEndMidi ?? 72) === p.endMidi
                  )?.name ?? `${config.virtualKeyboardStartMidi ?? 48}–${config.virtualKeyboardEndMidi ?? 72}`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {PIANO_RANGE_PRESETS.map((preset) => {
                  const isSelected =
                    (config.virtualKeyboardStartMidi ?? 48) === preset.startMidi &&
                    (config.virtualKeyboardEndMidi ?? 72) === preset.endMidi;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        onUpdateConfig({
                          virtualKeyboardStartMidi: preset.startMidi,
                          virtualKeyboardEndMidi: preset.endMidi,
                        })
                      }
                      className={`py-1.5 px-1 rounded border text-[10px] text-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-600/30 border-cyan-500 text-white font-medium shadow-[0_0_8px_rgba(8,145,178,0.3)]'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold">{preset.shortName}</div>
                      <div className="text-[8px] opacity-70">{preset.rangeLabel}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Piano Triangles Glyph Toggle */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-800/60">
              <div>
                <label className="block font-medium text-slate-200">Show Piano Triangles</label>
                <span className="text-[10px] text-slate-500">Render PPT geometric triangle glyphs on keys</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showPianoTriangles}
                  onChange={(e) => onUpdateConfig({ showPianoTriangles: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Fit to Window Width Toggle */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-800/60">
              <div>
                <label className="block font-medium text-slate-200">Fit to Window Width</label>
                <span className="text-[10px] text-slate-500">Fit virtual piano to available window width or retain fixed 1152px centre layout</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(config.virtualKeyboardStretchWidth)}
                  onChange={(e) => onUpdateConfig({ virtualKeyboardStretchWidth: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <p className="text-[10px] text-slate-500 italic">
              Computer keyboard keys (Z–M and Q–I) map to a 2-octave playable window. Use + and - keys to shift octaves dynamically.
            </p>
          </div>
        </section>

        {/* SECTION 5: LAYOUT & DEEP LINK SLUGS */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs uppercase tracking-wider">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>Layout Architecture & Slugs</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70 space-y-3">
            <label className="block font-medium text-slate-300">Active Layout Preset</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['balanced', 'signature', 'harmonic', 'monument', 'river', 'waterfall', 'dual-stream', 'orbital-focus'] as LayoutMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onUpdateConfig({ layoutMode: mode, activeLayout: PRESET_LAYOUTS[mode] })}
                  className={`py-1.5 px-2 rounded border text-[11px] capitalize transition ${
                    config.layoutMode === mode
                      ? 'bg-sky-600/30 border-sky-500 text-white font-medium'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode.replace('-', ' ')}
                </button>
              ))}
            </div>

            <p className="text-[10px] text-slate-500 italic">
              {config.activeLayout?.description || 'Flexbox layout with modular cells.'}
            </p>
          </div>
        </section>
      </div>

      {/* Footer: Reset & Autosave status */}
      <div className="p-3.5 border-t border-slate-800 bg-[#080b12] flex items-center justify-between">
        <button
          onClick={onResetConfig}
          className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1.5 transition cursor-pointer"
          title="Reset all settings to default PPT layout"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Defaults</span>
        </button>
        <span className="text-[10px] text-slate-500 font-mono">Autosaved to browser</span>
      </div>
    </aside>
  );
};
