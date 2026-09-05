import React, { useEffect } from 'react';
import { PITCH_CLASS_TO_PIANO_TRIANGLE, SOLFEGE_SYLLABLES, SOLFEGE_SPECS } from '../core/ppt-constants';
import { ActiveNote, VisualiserConfig, PianoTriangleType, PianoTrianglePoint } from '../core/types';
import { createPianoTriangleSvg } from '../renderers/glyph-renderer';

interface VirtualKeyboardProps {
  config: VisualiserConfig;
  activeNotes: Map<number, ActiveNote>;
  onNoteOn: (midi: number, velocity?: number) => void;
  onNoteOff: (midi: number) => void;
}

// 25-key range: C3 (48) to C5 (72) (2 octaves)
const START_MIDI = 48; // C3
const END_MIDI = 72;   // C5

const KEYBOARD_SHORTCUTS: Record<string, number> = {
  // Lower octave: C3 to B3
  'z': 48, 's': 49, 'x': 50, 'd': 51, 'c': 52, 'v': 53, 'g': 54, 'b': 55, 'h': 56, 'n': 57, 'j': 58, 'm': 59,
  // Upper octave: C4 to C5
  'q': 60, '2': 61, 'w': 62, '3': 63, 'e': 64, 'r': 65, '5': 66, 't': 67, '6': 68, 'y': 69, '7': 70, 'u': 71, 'i': 72
};

const MIDI_TO_SHORTCUT: Record<number, string> = {
  48: 'Z', 49: 'S', 50: 'X', 51: 'D', 52: 'C', 53: 'V', 54: 'G', 55: 'B', 56: 'H', 57: 'N', 58: 'J', 59: 'M',
  60: 'Q', 61: '2', 62: 'W', 63: '3', 64: 'E', 65: 'R', 66: '5', 67: 'T', 68: '6', 69: 'Y', 70: '7', 71: 'U', 72: 'I',
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
}) => {
  // Keyboard listener for QWERTY playing
  useEffect(() => {
    const activeKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      const midi = KEYBOARD_SHORTCUTS[key];
      if (midi !== undefined && !activeKeys.has(key)) {
        activeKeys.add(key);
        onNoteOn(midi, 0.85);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const midi = KEYBOARD_SHORTCUTS[key];
      if (midi !== undefined) {
        activeKeys.delete(key);
        onNoteOff(midi);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onNoteOn, onNoteOff]);

  const keys: KeyItem[] = [];
  for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
    const pc = midi % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(pc);
    const semitone = ((pc - config.tonic) % 12 + 12) % 12;
    const syllable = SOLFEGE_SYLLABLES[semitone];
    const colorHex = SOLFEGE_SPECS[syllable].colorHex;
    const isActive = activeNotes.has(midi);
    const ptInfo = PITCH_CLASS_TO_PIANO_TRIANGLE[pc];
    const shortcut = MIDI_TO_SHORTCUT[midi];

    let octaveLabel: string | undefined;
    if (pc === 0) {
      const octave = Math.floor(midi / 12) - 1;
      octaveLabel = octave === 4 ? 'C4' : `C${octave}`;
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

  const tonicNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

  return (
    <div className="w-full bg-[#0e121b]/95 backdrop-blur-md border-t border-slate-800/80 px-4 py-2.5 flex flex-col items-center select-none shadow-2xl">
      <div className="flex items-center justify-between w-full max-w-4xl mb-2 px-1 text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Virtual Keyboard</span>
          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60 font-mono">
            QWERTY: Z–M (C3–B3) & Q–I (C4–C5)
          </span>
        </span>
        <span className="text-[11px] text-slate-400 font-mono">
          Tonic <span className="text-red-400 font-bold">Do</span> = {tonicNames[config.tonic]}
        </span>
      </div>

      <div className="w-full flex justify-center overflow-x-auto pb-1 px-1">
        {/* Exact shared bounding container for both white and black key layers */}
        <div className="relative flex h-28 w-full max-w-4xl min-w-[560px] select-none rounded-b-md shadow-2xl bg-slate-950">
          {/* White Keys Row */}
          <div className="flex w-full h-full">
            {whiteKeys.map((key, i) => {
              const isFirst = i === 0;
              const isLast = i === totalWhite - 1;

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
                  className={`relative flex-1 h-full border-r border-slate-300/80 last:border-r-0 transition-all duration-75 cursor-pointer flex flex-col justify-end items-center pb-2 select-none ${
                    isFirst ? 'rounded-bl-md' : ''
                  } ${isLast ? 'rounded-br-md' : ''} ${
                    key.isActive
                      ? 'border-b-2 border-white shadow-[0_0_18px_rgba(255,255,255,0.7)] translate-y-[2px]'
                      : 'bg-gradient-to-b from-white via-slate-50 to-slate-200 hover:from-white hover:to-slate-100 border-b-4 border-slate-400/90 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.1)]'
                  }`}
                  style={{
                    backgroundColor: key.isActive ? key.colorHex : undefined,
                  }}
                >
                  {/* Octave Marker (C3, C4, C5) */}
                  {key.octaveLabel && (
                    <span
                      className={`absolute top-2 text-[9px] font-bold font-mono tracking-tighter ${
                        key.isActive ? 'text-white/90' : 'text-slate-400'
                      }`}
                    >
                      {key.octaveLabel}
                    </span>
                  )}

                  {/* Syllable and Piano Triangle SVG Label */}
                  <div className="flex flex-col items-center gap-1 pointer-events-none w-full px-0.5">
                    {config.showPianoTriangles ? (
                      <div
                        className="w-4 h-4"
                        dangerouslySetInnerHTML={{
                          __html: createPianoTriangleSvg(
                            key.ptInfo.triangle as PianoTriangleType,
                            key.ptInfo.point as PianoTrianglePoint,
                            16,
                            key.colorHex,
                            key.isActive ? '#ffffff' : '#334155'
                          ),
                        }}
                      />
                    ) : (
                      <span
                        className={`text-[10px] font-bold leading-none ${
                          key.isActive ? 'text-white' : 'text-slate-800'
                        }`}
                      >
                        {key.syllable}
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      {key.shortcut && (
                        <span
                          className={`text-[8.5px] font-mono font-medium px-1 rounded ${
                            key.isActive
                              ? 'bg-black/20 text-white'
                              : 'bg-slate-200/80 text-slate-600'
                          }`}
                        >
                          {key.shortcut}
                        </span>
                      )}
                      {key.semitone === 0 && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]"
                          title="Tonic (Do)"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Black Keys Layer - matching coordinate space with exact centering on seams */}
          <div className="absolute inset-0 pointer-events-none">
            {keys.map((key) => {
              if (!key.isBlack) return null;

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
                  className={`absolute pointer-events-auto h-[63%] rounded-b-[4px] transition-all duration-75 cursor-pointer flex flex-col justify-end items-center pb-1.5 z-20 -translate-x-1/2 select-none ${
                    key.isActive
                      ? 'border-b-2 border-white shadow-[0_0_18px_rgba(255,255,255,0.85)] translate-y-[2px]'
                      : 'bg-gradient-to-b from-neutral-800 via-neutral-900 to-black hover:from-neutral-700 hover:to-neutral-900 border-x border-b border-black/90 shadow-[0_4px_6px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)]'
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${blackKeyWidthPercent}%`,
                    backgroundColor: key.isActive ? key.colorHex : undefined,
                  }}
                >
                  <div className="flex flex-col items-center gap-0.5 pointer-events-none w-full px-0.5">
                    {config.showPianoTriangles ? (
                      <div
                        className="w-3.5 h-3.5 mb-0.5"
                        dangerouslySetInnerHTML={{
                          __html: createPianoTriangleSvg(
                            key.ptInfo.triangle as PianoTriangleType,
                            key.ptInfo.point as PianoTrianglePoint,
                            13,
                            key.colorHex,
                            key.isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                            true
                          ),
                        }}
                      />
                    ) : (
                      <span
                        className="text-[8.5px] font-bold leading-tight"
                        style={{ color: key.isActive ? '#ffffff' : key.colorHex }}
                      >
                        {key.syllable}
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      {key.shortcut && (
                        <span
                          className={`text-[8px] font-mono font-medium leading-none px-0.5 rounded ${
                            key.isActive
                              ? 'bg-black/30 text-white'
                              : 'text-slate-400/80'
                          }`}
                        >
                          {key.shortcut}
                        </span>
                      )}
                      {key.semitone === 0 && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]"
                          title="Tonic (Do)"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
