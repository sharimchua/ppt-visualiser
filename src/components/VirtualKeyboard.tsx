import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Piano, Minus, Plus, Maximize2, Minimize2 } from 'lucide-react';
import {
  PITCH_CLASS_TO_PIANO_TRIANGLE,
  SOLFEGE_SYLLABLES,
  SOLFEGE_SPECS,
  PIANO_RANGE_PRESETS,
} from '../core/ppt-constants';
import { ActiveNote, VisualiserConfig, PianoTriangleType, PianoTrianglePoint } from '../core/types';
import { createPianoTriangleSvg } from '../renderers/glyph-renderer';

interface VirtualKeyboardProps {
  config: VisualiserConfig;
  activeNotes: Map<number, ActiveNote>;
  onNoteOn: (midi: number, velocity?: number) => void;
  onNoteOff: (midi: number) => void;
  onUpdateConfig?: (partial: Partial<VisualiserConfig>) => void;
}

// 2-octave QWERTY computer keyboard offsets relative to base MIDI note (48 = C3 by default)
const QWERTY_SEMITONE_OFFSETS: Record<string, number> = {
  // Lower octave: semitones 0 to 11 (C to B)
  'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4, 'v': 5, 'g': 6, 'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11,
  // Upper octave: semitones 12 to 24 (C to C)
  'q': 12, '2': 13, 'w': 14, '3': 15, 'e': 16, 'r': 17, '5': 18, 't': 19, '6': 20, 'y': 21, '7': 22, 'u': 23, 'i': 24,
};

const OFFSET_TO_QWERTY_BADGE: Record<number, string> = {
  0: 'Z', 1: 'S', 2: 'X', 3: 'D', 4: 'C', 5: 'V', 6: 'G', 7: 'B', 8: 'H', 9: 'N', 10: 'J', 11: 'M',
  12: 'Q', 13: '2', 14: 'W', 15: '3', 16: 'E', 17: 'R', 18: '5', 19: 'T', 20: '6', 21: 'Y', 22: '7', 23: 'U', 24: 'I',
};

// Subtle acoustic piano key offsets so white key heads (cutouts) have balanced widths
function getBlackKeyOffset(pc: number): number {
  switch (pc) {
    case 1: // C#
      return -0.06;
    case 3: // D#
      return 0.06;
    case 6: // F#
      return -0.07;
    case 8: // G#
      return 0.0;
    case 10: // A#
      return 0.07;
    default:
      return 0;
  }
}

interface KeyItem {
  midi: number;
  pc: number;
  isBlack: boolean;
  semitone: number;
  syllable: string;
  colorHex: string;
  isActive: boolean;
  ptInfo: any;
  shortcut?: string;
  octaveLabel?: string;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  config,
  activeNotes,
  onNoteOn,
  onNoteOff,
  onUpdateConfig,
}) => {
  const [flashingTonic, setFlashingTonic] = useState<number | null>(null);
  const [octaveOffset, setOctaveOffset] = useState<number>(0);
  const activeQwertyKeysRef = useRef<Map<string, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  // Measure available horizontal space of the window/container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      if (el) {
        setAvailableWidth(el.clientWidth);
      }
    };

    measure();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setAvailableWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Octave shifter callback with note safety (clears sounding keys to prevent stuck notes)
  const shiftOctave = useCallback(
    (delta: number) => {
      setOctaveOffset((current) => {
        const next = Math.max(-2, Math.min(3, current + delta));
        if (next !== current) {
          activeQwertyKeysRef.current.forEach((midi) => {
            onNoteOff(midi);
          });
          activeQwertyKeysRef.current.clear();
        }
        return next;
      });
    },
    [onNoteOff]
  );

  // Trigger kinetic flash on all matching keys when tonic changes
  useEffect(() => {
    if (config.tonicShiftEffectsEnabled === false) return;
    setFlashingTonic(config.tonic);
    const timer = window.setTimeout(() => {
      setFlashingTonic(null);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [config.tonic, config.tonicShiftEffectsEnabled]);

  // Keyboard listener for QWERTY playing and octave shifting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Octave shift shortcuts (+ / -)
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'Equal') {
        e.preventDefault();
        shiftOctave(1);
        return;
      }
      if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus') {
        e.preventDefault();
        shiftOctave(-1);
        return;
      }

      if (e.repeat) return;

      const key = e.key.toLowerCase();
      const semitoneOffset = QWERTY_SEMITONE_OFFSETS[key];
      if (semitoneOffset !== undefined && !activeQwertyKeysRef.current.has(key)) {
        const baseMidi = 48 + octaveOffset * 12;
        const midi = baseMidi + semitoneOffset;
        activeQwertyKeysRef.current.set(key, midi);
        onNoteOn(midi, 0.85);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const playingMidi = activeQwertyKeysRef.current.get(key);
      if (playingMidi !== undefined) {
        activeQwertyKeysRef.current.delete(key);
        onNoteOff(playingMidi);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [octaveOffset, shiftOctave, onNoteOn, onNoteOff]);

  const startMidi = config.virtualKeyboardStartMidi ?? 48;
  const endMidi = config.virtualKeyboardEndMidi ?? 72;
  const baseMidi = 48 + octaveOffset * 12;

  const keys: KeyItem[] = [];
  for (let midi = startMidi; midi <= endMidi; midi++) {
    const pc = midi % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(pc);
    const semitone = ((pc - config.tonic) % 12 + 12) % 12;
    const syllable = SOLFEGE_SYLLABLES[semitone];
    const colorHex = SOLFEGE_SPECS[syllable].colorHex;
    const isActive = activeNotes.has(midi);
    const ptInfo = PITCH_CLASS_TO_PIANO_TRIANGLE[pc];

    // Shortcut badge shown dynamically only if note falls within currently active 2-octave QWERTY range
    const offsetFromBase = midi - baseMidi;
    const shortcut =
      offsetFromBase >= 0 && offsetFromBase <= 24
        ? OFFSET_TO_QWERTY_BADGE[offsetFromBase]
        : undefined;

    let octaveLabel: string | undefined;
    if (pc === 0) {
      const octave = Math.floor(midi / 12) - 1;
      octaveLabel = `C${octave}`;
    } else if (midi === 21) {
      octaveLabel = 'A0';
    }

    keys.push({
      midi,
      pc,
      isBlack,
      semitone,
      syllable,
      colorHex,
      isActive,
      ptInfo,
      shortcut,
      octaveLabel,
    });
  }

  const whiteKeys = keys.filter((k) => !k.isBlack);
  const totalWhite = whiteKeys.length;
  const blackKeyWidthPercent = (1 / totalWhite) * 58;

  const isStretched = Boolean(config.virtualKeyboardStretchWidth);
  // Calculate horizontal space: in stretch mode, uses available container width; in fixed mode, caps at 1152px (max-w-6xl)
  const effectiveContainerWidth = isStretched
    ? Math.max(300, availableWidth - 32)
    : Math.min(1152, Math.max(300, availableWidth - 32));
  const effectiveKeyWidth = totalWhite > 0 ? effectiveContainerWidth / totalWhite : 24;
  const isCompact = effectiveKeyWidth < 26;

  const tonicNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const startOctave = 3 + octaveOffset;
  const endOctave = 5 + octaveOffset;

  return (
    <div
      ref={containerRef}
      className="w-full bg-[#0e121b]/95 backdrop-blur-md border-t border-slate-800/80 px-4 py-2.5 flex flex-col items-center select-none shadow-2xl"
    >
      {/* Header Toolbar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 w-full mb-2 px-1 text-xs text-slate-400 transition-[max-width] duration-200 ${
          isStretched ? 'max-w-none' : 'max-w-6xl'
        }`}
      >
        {/* Left: Piano branding, range presets, and stretch toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Piano className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Virtual Piano</span>
          </div>

          {/* Range Presets */}
          {onUpdateConfig && (
            <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded-md border border-slate-800/80 shadow-inner">
              {PIANO_RANGE_PRESETS.map((preset) => {
                const isSelected = startMidi === preset.startMidi && endMidi === preset.endMidi;
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
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-600 text-white font-bold shadow-[0_0_8px_rgba(8,145,178,0.5)]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                    }`}
                    title={`${preset.name} (${preset.rangeLabel})`}
                  >
                    {preset.shortName}
                  </button>
                );
              })}
            </div>
          )}

          {/* Width Mode Toggle (Stretch to window vs Fixed 1152px) */}
          {onUpdateConfig && (
            <button
              type="button"
              onClick={() =>
                onUpdateConfig({
                  virtualKeyboardStretchWidth: !isStretched,
                })
              }
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer ${
                isStretched
                  ? 'bg-cyan-600/30 border-cyan-500 text-cyan-200 font-medium shadow-[0_0_8px_rgba(8,145,178,0.3)]'
                  : 'bg-slate-900/90 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
              }`}
              title={
                isStretched
                  ? 'Stretched to window width (Click to switch to fixed 1152px centre layout)'
                  : 'Fixed 1152px width (Click to stretch across full window width)'
              }
              aria-label={isStretched ? 'Switch to fixed width piano' : 'Stretch piano to window width'}
            >
              {isStretched ? (
                <>
                  <Minimize2 className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>Fixed</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Stretch</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right: Octave shifter and tonic indicator */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Octave Shifter Stepper */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2 py-0.5 rounded-md border border-slate-800/80 shadow-inner">
            <span className="text-[10px] text-slate-400 font-medium">QWERTY:</span>
            <button
              type="button"
              onClick={() => shiftOctave(-1)}
              disabled={octaveOffset <= -2}
              className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Shift Octave Down (Minus key: -)"
              aria-label="Shift octave down"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span
              className="text-[10px] font-mono font-bold text-cyan-400 min-w-[42px] text-center select-none"
              title={`2-octave computer keyboard mapping: C${startOctave}–C${endOctave} (Shift: ${
                octaveOffset > 0 ? `+${octaveOffset}` : octaveOffset
              })`}
            >
              C{startOctave}–C{endOctave}
            </span>
            <button
              type="button"
              onClick={() => shiftOctave(1)}
              disabled={octaveOffset >= 3}
              className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Shift Octave Up (Plus key: +)"
              aria-label="Shift octave up"
            >
              <Plus className="w-3 h-3" />
            </button>
            <span className="text-[9px] text-slate-500 font-mono pl-0.5 hidden sm:inline">
              [- / +]
            </span>
          </div>

          {/* Tonic readout */}
          <span className="text-[11px] text-slate-400 font-mono">
            Tonic <span className="text-red-400 font-bold">Do</span> = {tonicNames[config.tonic]}
          </span>
        </div>
      </div>

      {/* Keyboard Keys Viewport */}
      <div className="w-full flex justify-center overflow-x-auto pb-1 px-1">
        {/* Exact shared bounding container for both white and black key layers */}
        <div
          className={`relative flex h-28 w-full select-none rounded-b-md shadow-2xl bg-slate-950 transition-[max-width] duration-200 ${
            isStretched ? 'max-w-none' : 'max-w-6xl'
          }`}
          style={{
            minWidth: `${Math.max(500, totalWhite * (isCompact ? 16 : 22))}px`,
          }}
        >
          {/* White Keys Layer */}
          <div className="flex w-full h-full">
            {whiteKeys.map((key, i) => {
              const isFirst = i === 0;
              const isLast = i === totalWhite - 1;
              const isTonic = key.semitone === 0;

              return (
                <div
                  key={key.midi}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onNoteOn(key.midi, 0.9);
                  }}
                  onMouseUp={() => onNoteOff(key.midi)}
                  onMouseEnter={(e) => {
                    if (e.buttons === 1) {
                      onNoteOn(key.midi, 0.9);
                    }
                  }}
                  onMouseLeave={() => {
                    if (key.isActive) onNoteOff(key.midi);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    onNoteOn(key.midi, 0.9);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    onNoteOff(key.midi);
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    onNoteOff(key.midi);
                  }}
                  className={`relative flex-1 h-full border-r border-slate-300/80 last:border-r-0 transition-all duration-300 cursor-pointer flex flex-col justify-end items-center pb-2 select-none ${
                    isFirst ? 'rounded-bl-md' : ''
                  } ${isLast ? 'rounded-br-md' : ''} ${
                    key.isActive
                      ? 'border-b-2 border-white shadow-[0_0_18px_rgba(255,255,255,0.7)] translate-y-[2px]'
                      : key.pc === flashingTonic
                      ? 'ring-2 ring-inset ring-[#E13610] shadow-[0_0_16px_rgba(225,54,16,0.65)] bg-gradient-to-b from-rose-50 via-white to-slate-200 border-b-4 border-[#E13610]'
                      : isTonic
                      ? 'bg-gradient-to-b from-white via-slate-50 to-rose-50/50 hover:from-white hover:to-rose-100/50 border-b-4 border-[#E13610] shadow-[inset_0_-1px_2px_rgba(0,0,0,0.1),0_2px_6px_rgba(225,54,16,0.4)]'
                      : 'bg-gradient-to-b from-white via-slate-50 to-slate-200 hover:from-white hover:to-slate-100 border-b-4 border-slate-400/90 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.1)]'
                  }`}
                  style={{
                    backgroundColor: key.isActive ? key.colorHex : undefined,
                  }}
                >
                  {/* Octave Marker (C1, C2, C3, C4... A0) - Left aligned to avoid bleeding into C# */}
                  {key.octaveLabel && (
                    <span
                      className={`absolute top-1.5 left-1.5 text-[9px] font-bold font-mono tracking-tighter pointer-events-none ${
                        key.isActive ? 'text-white/90' : 'text-slate-400'
                      }`}
                    >
                      {key.octaveLabel}
                    </span>
                  )}

                  {/* Key Labels: Keybindings shifted up, Solfège at bottom level */}
                  <div className="flex flex-col items-center gap-1 pointer-events-none w-full px-0.5">
                    {/* QWERTY Shortcut Keybinding Badge (above solfège) */}
                    {key.shortcut && (
                      <span
                        className={`font-mono font-medium rounded ${
                          isCompact ? 'text-[7px] px-0.5' : 'text-[8.5px] px-1'
                        } ${
                          key.isActive
                            ? 'bg-black/20 text-white'
                            : 'bg-slate-200/80 text-slate-600'
                        }`}
                      >
                        {key.shortcut}
                      </span>
                    )}

                    {/* Solfège Label (bottom level): Piano triangle SVG or syllable text */}
                    {config.showPianoTriangles ? (
                      <div
                        className={isCompact ? 'w-3 h-3' : 'w-4 h-4'}
                        dangerouslySetInnerHTML={{
                          __html: createPianoTriangleSvg(
                            key.ptInfo.triangle as PianoTriangleType,
                            key.ptInfo.point as PianoTrianglePoint,
                            isCompact ? 12 : 16,
                            key.colorHex,
                            key.isActive ? '#ffffff' : '#334155'
                          ),
                        }}
                      />
                    ) : (
                      <span
                        className={`font-bold leading-none ${
                          isCompact ? 'text-[8.5px]' : 'text-[10px]'
                        } ${key.isActive ? 'text-white' : 'text-slate-800'}`}
                      >
                        {key.syllable}
                      </span>
                    )}
                  </div>

                  {/* Tonic Do Red Bottom Edge */}
                  {isTonic && (
                    <div
                      className="absolute bottom-0 inset-x-0 h-1 bg-[#E13610] rounded-b-[inherit] shadow-[0_-1px_6px_rgba(225,54,16,0.7)] pointer-events-none z-10"
                      title="Tonic (Do)"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Black Keys Layer - matching coordinate space with exact centering on seams */}
          <div className="absolute inset-0 pointer-events-none">
            {keys.map((key) => {
              if (!key.isBlack) return null;
              const isTonic = key.semitone === 0;

              // Compute offset percentage based on white key seam and acoustic offsets
              const whiteIndex = keys.slice(0, keys.indexOf(key)).filter((k) => !k.isBlack).length;
              const offset = getBlackKeyOffset(key.pc);
              const leftPercent = ((whiteIndex + offset) / totalWhite) * 100;

              return (
                <div
                  key={key.midi}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onNoteOn(key.midi, 0.9);
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    onNoteOff(key.midi);
                  }}
                  onMouseEnter={(e) => {
                    if (e.buttons === 1) {
                      onNoteOn(key.midi, 0.9);
                    }
                  }}
                  onMouseLeave={() => {
                    if (key.isActive) onNoteOff(key.midi);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onNoteOn(key.midi, 0.9);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onNoteOff(key.midi);
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onNoteOff(key.midi);
                  }}
                  className={`absolute pointer-events-auto h-[63%] rounded-b-[4px] transition-all duration-300 cursor-pointer flex flex-col justify-end items-center pb-1.5 z-20 -translate-x-1/2 select-none ${
                    key.isActive
                      ? 'border-b-2 border-white shadow-[0_0_18px_rgba(255,255,255,0.85)] translate-y-[2px]'
                      : key.pc === flashingTonic
                      ? 'ring-2 ring-[#E13610] shadow-[0_0_18px_rgba(225,54,16,0.85)] bg-gradient-to-b from-neutral-700 to-red-950 border-x border-b border-red-600'
                      : isTonic
                      ? 'bg-gradient-to-b from-neutral-800 via-neutral-900 to-red-950/40 hover:from-neutral-700 hover:to-neutral-900 border-x border-x-black/90 border-b-[3.5px] border-b-[#E13610] shadow-[0_4px_6px_rgba(0,0,0,0.5),0_2px_6px_rgba(225,54,16,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)]'
                      : 'bg-gradient-to-b from-neutral-800 via-neutral-900 to-black hover:from-neutral-700 hover:to-neutral-900 border-x border-b border-black/90 shadow-[0_4px_6px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)]'
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${blackKeyWidthPercent}%`,
                    backgroundColor: key.isActive ? key.colorHex : undefined,
                  }}
                >
                  {/* Key Labels: Keybindings shifted up, Solfège at bottom level */}
                  <div className="flex flex-col items-center gap-0.5 pointer-events-none w-full px-0.5">
                    {/* QWERTY Shortcut Keybinding Badge (above solfège) */}
                    {key.shortcut && (
                      <span
                        className={`font-mono font-medium leading-none px-0.5 rounded ${
                          isCompact ? 'text-[6.5px]' : 'text-[8px]'
                        } ${
                          key.isActive ? 'bg-black/30 text-white' : 'text-slate-400/80'
                        }`}
                      >
                        {key.shortcut}
                      </span>
                    )}

                    {/* Solfège Label (bottom level): Piano triangle SVG or syllable text */}
                    {config.showPianoTriangles ? (
                      <div
                        className={isCompact ? 'w-2.5 h-2.5 mb-0.5' : 'w-3.5 h-3.5 mb-0.5'}
                        dangerouslySetInnerHTML={{
                          __html: createPianoTriangleSvg(
                            key.ptInfo.triangle as PianoTriangleType,
                            key.ptInfo.point as PianoTrianglePoint,
                            isCompact ? 10 : 13,
                            key.colorHex,
                            key.isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                            true
                          ),
                        }}
                      />
                    ) : (
                      <span
                        className={`font-bold leading-tight ${
                          isCompact ? 'text-[7.5px]' : 'text-[8.5px]'
                        }`}
                        style={{ color: key.isActive ? '#ffffff' : key.colorHex }}
                      >
                        {key.syllable}
                      </span>
                    )}
                  </div>

                  {/* Tonic Do Red Bottom Edge */}
                  {isTonic && (
                    <div
                      className="absolute bottom-0 inset-x-0 h-[3px] bg-[#E13610] rounded-b-[inherit] shadow-[0_0_6px_rgba(225,54,16,0.8)] pointer-events-none z-10"
                      title="Tonic (Do)"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

