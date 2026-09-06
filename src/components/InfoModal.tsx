import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { PitchClockDiagram } from './PitchClockDiagram';
import { UniformSolfegeDiagram } from './UniformSolfegeDiagram';
import { PianoTrianglesDiagram } from './PianoTrianglesDiagram';
import { ConcentricOrbitsDiagram } from './ConcentricOrbitsDiagram';
import { TriPitchClassDiagram } from './TriPitchClassDiagram';

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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isManualScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  const scrollToSection = (tab: TabType) => {
    setActiveTab(tab);
    const container = scrollContainerRef.current;
    const target = document.getElementById(`ppt-section-${tab}`);
    if (container && target) {
      isManualScrollRef.current = true;
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      const targetTop = target.offsetTop - container.offsetTop;
      container.scrollTo({ top: Math.max(0, targetTop - 12), behavior: 'smooth' });
      scrollTimeoutRef.current = window.setTimeout(() => {
        isManualScrollRef.current = false;
      }, 700);
    }
  };

  const handleScroll = useCallback(() => {
    if (isManualScrollRef.current || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;

    // If scrolled to the bottom, highlight the final 'links' bookmark
    if (container.scrollHeight - (scrollTop + container.clientHeight) < 40) {
      setActiveTab('links');
      return;
    }

    const sections: TabType[] = ['overview', 'concepts', 'customise', 'links'];
    let currentTab: TabType = 'overview';
    for (const tab of sections) {
      const el = document.getElementById(`ppt-section-${tab}`);
      if (el) {
        const top = el.offsetTop - container.offsetTop;
        if (scrollTop >= top - 60) {
          currentTab = tab;
        }
      }
    }
    setActiveTab(currentTab);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

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

        {/* Navigation Bookmarks Bar */}
        <div className="flex border-b border-slate-800 bg-[#0e1424]/80 backdrop-blur px-3 sm:px-5 shrink-0 overflow-x-auto gap-1 sm:gap-2">
          <button
            onClick={() => scrollToSection('overview')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-red-500 text-white bg-slate-800/50'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Eye className="w-4 h-4 text-red-400" />
            <span>Visualiser Overview</span>
          </button>
          <button
            onClick={() => scrollToSection('concepts')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'concepts'
                ? 'border-amber-500 text-white bg-slate-800/50'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Music className="w-4 h-4 text-amber-400" />
            <span>PPT Musical Concepts</span>
          </button>
          <button
            onClick={() => scrollToSection('customise')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'customise'
                ? 'border-cyan-500 text-white bg-slate-800/50'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Customisation & Controls</span>
          </button>
          <button
            onClick={() => scrollToSection('links')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'links'
                ? 'border-purple-500 text-white bg-slate-800/50'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <BookOpen className="w-4 h-4 text-purple-400" />
            <span>Links & Resources</span>
          </button>
        </div>

        {/* Single Continuous Scrollable Content with Interactive Bookmarks */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 text-xs sm:text-sm leading-relaxed scroll-smooth"
        >
          {/* SECTION 1: OVERVIEW */}
          <section id="ppt-section-overview" className="space-y-6 scroll-mt-2">
            <div className="bg-gradient-to-br from-red-950/40 via-slate-900/60 to-slate-900/40 border border-red-900/40 rounded-xl p-4 sm:p-5">
              <h3 className="text-sm sm:text-base font-bold text-white mb-2 flex items-center gap-2">
                <Compass className="w-5 h-5 text-red-400" />
                What is the PPT Visualiser?
              </h3>
              <p className="text-slate-300">
                The <strong>PPT Visualiser</strong> is an advanced, real-time musical visualiser built around <strong>Prime Period Theory (PPT)</strong>. Rather than depicting music as a conventional flat timeline or linear piano roll, PPT represents musical pitches through <strong>rotational geometry, polar pitch clocks, and geometric piano triangles</strong>.
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
                    Deconstructs the 12 keys of the piano into 4 geometric 3-note triangles (Down, Left, Up, Right). Illuminates active notes and harmonic clusters directly across physical keyboard geometry.
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                    Note Stream Ribbons
                  </div>
                  <p className="text-xs text-slate-300">
                    Flowing note ribbons that stream horizontally (left or right) or vertically (up or down), labelled with Uniform Solfège or Tri-Notation symbols.
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
          </section>

          {/* Section Divider: Concepts */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0b0f19] px-3.5 py-1 rounded-full border border-slate-800 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5 shadow-sm">
                <Music className="w-3.5 h-3.5" />
                <span>Theoretical Foundations</span>
              </span>
            </div>
          </div>

          {/* SECTION 2: PPT MUSICAL CONCEPTS */}
          <section id="ppt-section-concepts" className="space-y-6 scroll-mt-2">
              {/* Concept 1: The Pitch Clock */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-red-500 shrink-0" />
                    <span>1. The 12-Tone Pitch Class Clock</span>
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-red-400 border border-slate-700/60 self-start sm:self-auto">
                    Movable Do at 12 o&apos;clock Zenith
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-300">
                  In Prime Period Theory, the 12 chromatic semitones are arranged clockwise around a circular pitch space. PPT follows a <strong>movable Do</strong> philosophy: whichever key the music is in, that home tonic pitch is positioned at the 12 o&apos;clock zenith as <strong>Do</strong>.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center pt-1">
                  {/* Left: Vector Pitch Clock Diagram */}
                  <div className="lg:col-span-5 flex justify-center w-full min-w-0 shrink-0">
                    <PitchClockDiagram size={230} />
                  </div>

                  {/* Right: Key Geometric Principles */}
                  <div className="lg:col-span-7 space-y-3 text-xs">
                    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-lg border border-slate-800/80 space-y-1.5">
                      <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span>Movable Do Philosophy</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed text-[11.5px]">
                        Whether playing in C, D, or F♯, the home key always rotates to 12 o&apos;clock. This allows musical tension, resolution, and chord function to be perceived consistently across all 12 keys.
                      </p>
                    </div>

                    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-lg border border-slate-800/80 space-y-1.5">
                      <div className="font-semibold text-red-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span>12 o&apos;clock (Zenith) = Do (Tonic)</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed text-[11.5px]">
                        The fundamental home pitch of the key (0 semitones). All melodic and harmonic distances are measured relative to this anchor.
                      </p>
                    </div>

                    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-lg border border-slate-800/80 space-y-1.5">
                      <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>6 o&apos;clock (Nadir) = Fi (Tritone)</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed text-[11.5px]">
                        Exactly 6 semitones away from Do, forming the primary vertical polar axis of harmonic tension and symmetry across the circle.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Concept 2: Uniform Solfège */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>2. Uniform Solfège & 4-Fold Symmetry</span>
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 self-start sm:self-auto">
                    3 Glyphs &times; 4 Rotations = 12 Tones
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Traditional music notation relies on historical accidentals (♯, ♭, ♮) that introduce visual asymmetry. Uniform Solfège replaces them with <strong>three elemental geometric glyphs</strong> that rotate in 90&deg; orthogonal quadrants around <strong>Do as centre (0 st)</strong>. Each 90&deg; rotation corresponds to a distance of 3 semitones (&plusmn;3 st):
                </p>

                {/* Rich Vector Solfège Diagram Component */}
                <UniformSolfegeDiagram />
              </div>

              {/* Concept 3: Tri Pitch-Class Notation */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-cyan-400 shrink-0" />
                    <span>3. Tri Pitch-Class Notation (Absolute Pitch Alternative)</span>
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 self-start sm:self-auto">
                    Default 12TET Polar Naming
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  While Uniform Solfège provides an intuitive <em>relative</em> notation for movable Do, Prime Period Theory uses <strong>Tri Pitch-Class Notation</strong> as its default <em>absolute</em> pitch naming system. Instead of ambiguous enharmonic accidentals (e.g. C♯ vs D♭), each of the five chromatic non-natural notes is uniquely named after its <strong>tritone partner (6 semitones away)</strong> across the pitch circle:
                </p>

                {/* Rich Vector Tri Pitch-Class Diagram Component */}
                <TriPitchClassDiagram />
              </div>

              {/* Concept 4: Piano Triangles */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400 shrink-0" />
                    <span>4. Piano Triangles (Keyboard Topography)</span>
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 self-start sm:self-auto">
                    Down &bull; Left &bull; Up &bull; Right
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  The piano keyboard is physically asymmetrical: an irregular 2-pack (C♯, D♯) and 3-pack (F♯, G♯, A♯) of raised black keys separated by two natural semitone chasms (E–F and B–C). <strong>Piano Triangles</strong> bridge this irregularity by partitioning all 12 chromatic keys into four balanced 3-note geometric units (4 &times; 3 = 12 keys):
                </p>

                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 text-[11.5px] text-slate-400 leading-relaxed">
                  <strong className="text-indigo-300">Triangles vs Tetrachords:</strong> Each Piano Triangle contains exactly <strong>3 notes</strong> (a trichord). While PPT uses triangles in <em>Scale Signatures</em> to link two 4-note scale tetrachords bridged by the central tonic Do, individual Piano Triangles operate as fundamental 3-key geometric units.
                </div>

                {/* Rich Vector Piano Triangles Diagram Component */}
                <PianoTrianglesDiagram />
              </div>

              {/* Concept 5: Concentric Orbits & Nearest-Address */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Eye className="w-5 h-5 text-cyan-400 shrink-0" />
                    <span>5. Concentric Orbits & Octave Wrapping</span>
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 self-start sm:self-auto">
                    Octave Seam at 6 to 7 o&apos;clock
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  The visualiser renders up to <strong>8 concentric octave orbits</strong> from the lowest bass (Register 1, outermost) to the highest treble (Register 8, innermost). Rather than arbitrarily resetting at C, each register is centred symmetrically around <strong>Do</strong>.
                </p>

                {/* Rich Vector Concentric Orbits Diagram */}
                <ConcentricOrbitsDiagram />
              </div>

              {/* Concept 6: Auto-Alignment */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-red-400 shrink-0" />
                  <span>6. Auto-Alignment of Do (Diatonic Key Tracking)</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  When <strong>Auto-Alignment</strong> is enabled in the settings or header toolbar, the engine continuously monitors incoming notes over an organic time decay window. It calculates diatonic correlation scores against all 12 candidate tonics and automatically rotates Do to match the musical key of the song in real time.
                </p>
              </div>
            </section>

            {/* Section Divider: Customise */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#0b0f19] px-3.5 py-1 rounded-full border border-slate-800 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 shadow-sm">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Engine Controls & Customisation</span>
                </span>
              </div>
            </div>

            {/* SECTION 3: CUSTOMISATION & CONTROLS */}
            <section id="ppt-section-customise" className="space-y-6 scroll-mt-2">
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
            </section>

            {/* Section Divider: Links */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#0b0f19] px-3.5 py-1 rounded-full border border-slate-800 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-purple-400 flex items-center gap-1.5 shadow-sm">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Theory Literature & Ecosystem</span>
                </span>
              </div>
            </div>

            {/* SECTION 4: LINKS & RESOURCES */}
            <section id="ppt-section-links" className="space-y-6 scroll-mt-2">
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
                      The official compiled documentation for <strong>Prime Period Theory (PPT)</strong>. PPT is a descriptive framework treating pitch, rhythm, and timbre as unified expressions of periodic signals in time, organised through prime-ratio relationships (up to the 11-limit).
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
            </section>
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
