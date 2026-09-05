import React, { useState, useEffect } from 'react';
import {
  X,
  Compass,
  Sparkles,
  Sliders,
  ExternalLink,
  BookOpen,
  Music,
  Eye,
  Layers,
  Zap,
  CheckCircle2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { SOLFEGE_SPECS, SOLFEGE_SYLLABLES } from '../core/ppt-constants';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'overview' | 'concepts' | 'customise' | 'links';

export const STORAGE_KEY_DONT_SHOW_INTRO = 'ppt_dont_show_intro_on_launch_v1';

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY_DONT_SHOW_INTRO) === 'true';
  });

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setDontShowAgain(checked);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_DONT_SHOW_INTRO, checked ? 'true' : 'false');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ppt-info-modal-title"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0b0f19] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#080b13] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.svg"
              alt="PPT Logo"
              className="w-8 h-8 object-contain rounded-md drop-shadow-[0_0_10px_rgba(225,54,16,0.4)] shrink-0"
            />
            <div className="min-w-0">
              <h2 id="ppt-info-modal-title" className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2 truncate">
                <span>PPT Visualiser Primer & Guide</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 hidden sm:inline-block">
                  Prime Period Theory
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Multi-octave geometric music visualiser & interactive theoretical explorer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0 ml-2"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-[#0e1424]/60 px-3 sm:px-5 shrink-0 overflow-x-auto gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-red-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Eye className="w-4 h-4 text-red-400" />
            <span>Visualiser Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('concepts')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'concepts'
                ? 'border-red-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Music className="w-4 h-4 text-amber-400" />
            <span>PPT Musical Concepts</span>
          </button>
          <button
            onClick={() => setActiveTab('customise')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'customise'
                ? 'border-red-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Customisation & Controls</span>
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'links'
                ? 'border-red-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <BookOpen className="w-4 h-4 text-purple-400" />
            <span>Links & Resources</span>
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs sm:text-sm leading-relaxed">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-gradient-to-br from-red-950/40 via-slate-900/60 to-slate-900/40 border border-red-900/40 rounded-xl p-4 sm:p-5">
                <h3 className="text-sm sm:text-base font-bold text-white mb-2 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-red-400" />
                  What is the PPT Visualiser?
                </h3>
                <p className="text-slate-300">
                  The <strong>PPT Visualiser</strong> is an advanced, real-time musical visualiser built around <strong>Prime Period Theory (PPT)</strong>. Rather than depicting music as a conventional flat timeline or linear piano roll, PPT represents musical pitches through <strong>rotational geometry, polar pitch clocks, and tetrachordal triangles</strong>.
                </p>
                <p className="text-slate-400 mt-2 text-xs">
                  Whether listening to built-in classical and modern demo tracks, playing via a connected USB MIDI keyboard, or uploading your own MIDI files, the visualiser translates harmonic structure into dynamic light, phosphorescent trails, and geometric resonance.
                </p>
              </div>

              {/* Three Core Modules */}
              <div>
                <h4 className="font-semibold text-white uppercase text-xs tracking-wider mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-red-400" />
                  Three Distinct Visual Modules
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Orbital Pitch Clock
                    </div>
                    <p className="text-xs text-slate-300">
                      An 8-octave polar clock. Tonic (Do) sits permanently at the 12 o&apos;clock zenith, with registers 1 to 8 organised into concentric orbits. Displays chord polygons, convex hulls, and organic particle sparks.
                    </p>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Piano Triangles
                    </div>
                    <p className="text-xs text-slate-300">
                      Deconstructs the 12 keys of the piano into 4 geometric tetrachords (Down, Left, Up, Right). Illuminates active notes and harmonic clusters directly across physical keyboard geometry.
                    </p>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                      Note Stream Ribbons
                    </div>
                    <p className="text-xs text-slate-300">
                      High-velocity directional note ribbons with configurable orientation (Horizontal RTL/LTR or Vertical TTB/BTT) labeled with Uniform Solfège or Tri-Notation glyphs.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Start Guide */}
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Quick Interaction Tips
                </h4>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Select Demo Music:</strong> Use the track dropdown in the top toolbar to explore classical piano works, jazz progressions, or polyphonic etudes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Connect MIDI:</strong> Plug in any USB MIDI keyboard or controller. The visualiser instantly detects incoming notes with zero setup required.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Change Key (Do):</strong> Click the Tonic selector in the top toolbar to set the musical key, or enable <em>Auto-Alignment</em> to let the visualiser track key changes automatically.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Customise Layout:</strong> Click <em>Edit Layout</em> in the top bar to split views, resize panes, or choose ready-made presets like <em>Signature Trio</em>.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: PPT MUSICAL CONCEPTS */}
          {activeTab === 'concepts' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Concept 1: The Pitch Clock */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-red-500" />
                    1. The 12-Tone Pitch Class Clock
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Do at 12 o&apos;clock
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300">
                  In Prime Period Theory, the 12 chromatic semitones are arranged clockwise in a circular pitch space:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="font-semibold text-red-400">12 o&apos;clock (Zenith) = Do (Tonic)</span>
                    <p className="text-slate-400 mt-1">The fundamental home pitch of the key (0 semitones). All melodic and harmonic distances are perceived relative to this origin.</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-200">6 o&apos;clock (Nadir) = Fi (Tritone)</span>
                    <p className="text-slate-400 mt-1">Exactly 6 semitones away from Do, forming a vertical polar axis of harmonic tension and symmetry across the circle.</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Moving clockwise from 12 o&apos;clock: <strong>Do (0)</strong> &rarr; Ra (1) &rarr; Re (2) &rarr; Me (3) &rarr; Mi (4) &rarr; Fa (5) &rarr; <strong>Fi (6)</strong> &rarr; So (7) &rarr; Le (8) &rarr; La (9) &rarr; Te (10) &rarr; Ti (11).
                </p>
              </div>

              {/* Concept 2: Uniform Solfège */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    2. Uniform Solfège & 4-Fold Symmetry
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                    3 Glyphs &times; 4 Rotations
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300">
                  Traditional music notation relies on historical accidentals (♯, ♭, ♮) that introduce visual asymmetry. Uniform Solfège replaces them with <strong>three elemental geometric glyphs</strong> that rotate in 90° quadrants:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 text-center space-y-1.5">
                    <div className="font-bold text-white uppercase tracking-wider">Base Glyph</div>
                    <div className="text-[11px] text-slate-400">Neutral / Balanced</div>
                    <p className="text-[10px] text-slate-500">Do (0°), Me (90°), Fi (180°), La (270°)</p>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 text-center space-y-1.5">
                    <div className="font-bold text-amber-400 uppercase tracking-wider">Sharp Glyph</div>
                    <div className="text-[11px] text-slate-400">Outward Peak / Clockwise</div>
                    <p className="text-[10px] text-slate-500">Ra (0°), Mi (90°), So (180°), Te (270°)</p>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 text-center space-y-1.5">
                    <div className="font-bold text-cyan-400 uppercase tracking-wider">Flat Glyph</div>
                    <div className="text-[11px] text-slate-400">Inward Dip / Counter-Clockwise</div>
                    <p className="text-[10px] text-slate-500">Ti (0°), Re (90°), Fa (180°), Le (270°)</p>
                  </div>
                </div>

                {/* Solfege Syllables Colour Preview */}
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">12 Chromatic Solfège Degrees:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {SOLFEGE_SYLLABLES.map((syl) => {
                      const spec = SOLFEGE_SPECS[syl];
                      return (
                        <div
                          key={syl}
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-xs font-mono"
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: spec.colorHex }} />
                          <span className="font-bold text-white">{syl}</span>
                          <span className="text-[10px] text-slate-500">+{spec.semitone}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Concept 3: Piano Triangles */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    3. Piano Triangles (Tetrachord Topography)
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                    Down &bull; Left &bull; Up &bull; Right
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300">
                  Piano Triangles map the irregular physical geometry of the piano keyboard into four repeating triangular groups, tiling all 12 chromatic tones:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-center">
                    <span className="font-bold text-red-400 block">Down (D)</span>
                    <span className="text-[10px] text-slate-400">C♯ &bull; D &bull; D♯</span>
                    <p className="text-[9px] text-slate-500 mt-1">Inverted apex pointing down at D</p>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-center">
                    <span className="font-bold text-amber-400 block">Left (L)</span>
                    <span className="text-[10px] text-slate-400">E &bull; F &bull; F♯</span>
                    <p className="text-[9px] text-slate-500 mt-1">Right-angle triangle at E-F</p>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-center">
                    <span className="font-bold text-emerald-400 block">Up (U)</span>
                    <span className="text-[10px] text-slate-400">G &bull; G♯ &bull; A</span>
                    <p className="text-[9px] text-slate-500 mt-1">Equilateral apex pointing up at G♯</p>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-center">
                    <span className="font-bold text-purple-400 block">Right (R)</span>
                    <span className="text-[10px] text-slate-400">A♯ &bull; B &bull; C</span>
                    <p className="text-[9px] text-slate-500 mt-1">Right-angle triangle at B-C</p>
                  </div>
                </div>
              </div>

              {/* Concept 4: Concentric Orbits & Nearest-Address */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-cyan-400" />
                  4. 8 Concentric Orbits & Nearest-Address Octave Wrapping
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  The visualiser renders up to <strong>8 concentric octave orbits</strong> from the lowest bass (Register 1, outermost) to the highest treble (Register 8, innermost).
                </p>
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-xs space-y-1.5">
                  <div className="font-semibold text-slate-200">Nearest-Address Polar Coordinate Wrapping:</div>
                  <p className="text-slate-400">
                    To maintain spatial coherence, notes are addressed relative to the nearest tonic:
                  </p>
                  <div className="font-mono text-[11px] text-cyan-300 bg-slate-900/90 p-2 rounded border border-slate-800">
                    <div>Upper Branch (0 to +6): Do (0), Ra (+1), Re (+2), Me (+3), Mi (+4), Fa (+5), Fi (+6)</div>
                    <div className="mt-1">Lower Branch (-5 to -1): So (-5), Le (-4), La (-3), Te (-2), Ti (-1)</div>
                  </div>
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    This prevents arbitrary register jumps and connects harmonious chord voicings across minimum radial distance.
                  </p>
                </div>
              </div>

              {/* Concept 5: Auto-Alignment */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-red-400" />
                  5. Auto-Alignment of Do (Diatonic Key Tracking)
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  When <strong>Auto-Alignment</strong> is enabled in the settings or header, the engine continuously monitors incoming notes over an organic time decay window. It calculates diatonic correlation scores against 12 candidate tonics and automatically rotates Do to match the musical key of the song in real time.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMISATION & CONTROLS */}
          {activeTab === 'customise' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Layout Engine */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-red-500" />
                  Flexible Layout Engine & Split Panes
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Customise your viewport to your exact workflow using our flexible tree-based split system:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    <span className="font-semibold text-white block mb-1">Layout Presets</span>
                    <p className="text-slate-400">Choose from ready-made presets in the top header toolbar: <em>Signature Trio</em>, <em>Full Orbital Clock</em>, <em>Dual Split</em>, <em>Focus Stream</em>, or <em>Balanced Tryptych</em>.</p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    <span className="font-semibold text-white block mb-1">Edit Mode & Resizing</span>
                    <p className="text-slate-400">Click <strong>Edit Layout</strong> to split any cell horizontally or vertically, swap modules, duplicate cells, or drag border dividers to resize flex ratios.</p>
                  </div>
                </div>
              </div>

              {/* Priority Slots & Labels */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  8 Priority Slots for Clock Labels
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  In the Settings Sidebar, configure the 8 priority slots that govern which labels appear on the pitch clock nodes:
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {['Uniform Solfège (Do, Re...)', 'Tri Pitch-Class (△C, △G...)', 'Absolute Note (C, C♯, D...)', 'Interval (1, ♭3, 5...)', 'MIDI Note Number (60, 62...)', 'None (Clean minimal)'].map((lbl, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]">
                      {lbl}
                    </span>
                  ))}
                </div>
              </div>

              {/* Performance & Eco Mode */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    Performance Profiles & GPU Acceleration
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                    WebGL Pipeline
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300">
                  The visualiser supports WebGL hardware post-processing and fine-grained controls for low-power or battery-operated devices:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-center space-y-1">
                    <span className="font-bold text-purple-400 block">Max Effects</span>
                    <p className="text-[10px] text-slate-400">All 8 shaders, anamorphic lens flares, bloom, and 24fps film grain.</p>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-center space-y-1">
                    <span className="font-bold text-cyan-400 block">Balanced</span>
                    <p className="text-[10px] text-slate-400">Smooth motion trails, glow, and sparks with lighter shadow blur costs.</p>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-center space-y-1">
                    <span className="font-bold text-emerald-400 block">Eco Mode</span>
                    <p className="text-[10px] text-slate-400">Disables intensive blurs and grain for guaranteed 60fps on low-end machines.</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  You can also toggle individual effects (Film Grain, Sparks, Bloom, Motion Trails, Ghosting, Light Bleed, CRT Scanlines, Lens Flares) directly in the Settings sidebar.
                </p>
              </div>

              {/* Deep Linking */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  Deep-Link URL Slugs
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Click the <strong>Share</strong> button in the top toolbar to generate a compact, URL-safe Base64 slug of your exact layout and aesthetic configuration. Anyone opening the link will see your exact custom workspace setup.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: LINKS & RESOURCES */}
          {activeTab === 'links' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-slate-900/40 border border-purple-900/40 rounded-xl p-4 sm:p-5">
                <h3 className="text-sm sm:text-base font-bold text-white mb-2 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  Explore the Broader Theory & Ecosystem
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm">
                  Prime Period Theory provides an entirely fresh mathematical and cognitive framework for understanding harmony, scales, modulation, and instrument interaction. Dive deeper into the core literature, interactive tools, and musical essays below:
                </p>
              </div>

              {/* Primary Outbound Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Prime Period Theory Link Card */}
                <a
                  href="https://ppt.midlifemuso.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700/80 hover:border-red-500/80 rounded-xl p-4 sm:p-5 transition flex flex-col justify-between shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src="/logo.svg" alt="PPT" className="w-6 h-6 object-contain" />
                        <span className="font-bold text-white text-sm">ppt.midlifemuso.com</span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition" />
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      The official compiled documentation for <strong>Prime Period Theory (PPT)</strong>. PPT is a descriptive framework treating pitch, rhythm, and timbre as unified expressions of periodic signals in time, organized through prime-ratio relationships (up to the 11-limit).
                    </p>
                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1 text-slate-400">
                      <div className="text-red-400 font-semibold flex items-center gap-1">
                        <span>A Lens, Not a Law</span>
                      </div>
                      <p>
                        Explore curated foundational topics, interactive Web Components (sequencers, controllers, EventBus), and the human & agent-readable <strong>OKF Knowledge Bundle</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-red-400 group-hover:text-red-300">
                    <span>Visit ppt.midlifemuso.com</span>
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </a>

                {/* Midlife Muso Link Card */}
                <a
                  href="https://midlifemuso.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700/80 hover:border-purple-500/80 rounded-xl p-4 sm:p-5 transition flex flex-col justify-between shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Music className="w-5 h-5 text-purple-400" />
                        <span className="font-bold text-white text-sm">midlifemuso.com</span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-400 transition" />
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Founded by Melbourne multi-instrumentalist Sharim Chua. <strong>Learn music like a language</strong> through an ear-first, intuitive approach to contemporary piano and acoustic fingerstyle guitar.
                    </p>
                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1 text-slate-400">
                      <div className="text-purple-400 font-semibold flex items-center gap-1">
                        <span>Ear-First Pedagogy</span>
                      </div>
                      <p>
                        Moving beyond rote classical drills to deep listening, understanding the <em>why</em> behind harmony, and unlocking creative musical fluency for midlife and beyond.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-purple-400 group-hover:text-purple-300">
                    <span>Visit midlifemuso.com</span>
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </a>
              </div>

              {/* Quick Links to PPT Knowledge Resources */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="font-semibold text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>Key PPT Documentation & Resource Links</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <a
                    href="https://ppt.midlifemuso.com/reference"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/60 transition group flex flex-col justify-between"
                  >
                    <div>
                      <span className="font-bold text-white block group-hover:text-cyan-300 transition-colors">OKF Knowledge Bundle</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Reference library & agent semantic bundle</span>
                    </div>
                    <div className="flex items-center text-[10px] text-cyan-400 font-semibold mt-2">
                      <span>/reference</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </div>
                  </a>

                  <a
                    href="https://ppt.midlifemuso.com/topics"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/60 transition group flex flex-col justify-between"
                  >
                    <div>
                      <span className="font-bold text-white block group-hover:text-amber-300 transition-colors">Curated Topics</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Foundations, perception & acoustic anchors</span>
                    </div>
                    <div className="flex items-center text-[10px] text-amber-400 font-semibold mt-2">
                      <span>/topics</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </div>
                  </a>

                  <a
                    href="https://ppt.midlifemuso.com/components"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-red-500/60 transition group flex flex-col justify-between"
                  >
                    <div>
                      <span className="font-bold text-white block group-hover:text-red-300 transition-colors">Web Components</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Interactive sequencers, dials & EventBus</span>
                    </div>
                    <div className="flex items-center text-[10px] text-red-400 font-semibold mt-2">
                      <span>/components</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </div>
                  </a>
                </div>
              </div>

              {/* How to re-open this modal */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs space-y-2 text-slate-400">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-cyan-400" />
                  How to Access This Guide Anytime
                </div>
                <p>
                  You can reopen this modal at any time by:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>Clicking on the <strong>PPT Visualiser</strong> title and logo in the top toolbar.</li>
                  <li>Clicking the <strong>Walkthrough & Guide</strong> button at the top of the Settings sidebar.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Persistent Checkbox & Close Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-[#080b13] shrink-0 gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={handleCheckboxChange}
              className="rounded bg-slate-900 border-slate-700 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900"
            />
            <span>Don&apos;t show this guide automatically on launch</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-red-900/30 transition"
            >
              Explore Visualiser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
