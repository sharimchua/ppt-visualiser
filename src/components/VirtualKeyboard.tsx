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

// 49-key range: C2 (36) to C6 (84), or 3 octaves around Middle C (48 to 72)
const START_MIDI = 48; // C3
const END_MIDI = 72;   // C5

const KEYBOARD_SHORTCUTS: Record<string, number> = {
  // Lower octave: C3 to B3
  'z': 48, 's': 49, 'x': 50, 'd': 51, 'c': 52, 'v': 53, 'g': 54, 'b': 55, 'h': 56, 'n': 57, 'j': 58, 'm': 59,
  // Upper octave: C4 to E5
  'q': 60, '2': 61, 'w': 62, '3': 63, 'e': 64, 'r': 65, '5': 66, 't': 67, '6': 68, 'y': 69, '7': 70, 'u': 71, 'i': 72
};

interface KeyItem {
  midi: number;
  pc: number;
  isBlack: boolean;
  semitone: number;
  syllable: string;
  colorHex: string;
  isActive: boolean;
  ptInfo: any;
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

    keys.push({
      midi,
      pc,
      isBlack,
      semitone,
      syllable,
      colorHex,
      isActive,
      ptInfo,
    });
  }

  return (
    <div className="w-full bg-[#0e121b]/90 backdrop-blur border-t border-slate-800/80 px-4 py-2 flex flex-col items-center select-none shadow-2xl">
      <div className="flex items-center justify-between w-full max-w-4xl mb-1.5 px-2 text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-slate-300">Virtual Keyboard</span>
          <span className="text-[10px] text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
            QWERTY Keys: Z-M & Q-I
          </span>
        </span>
        <span className="text-[11px] text-slate-400 font-mono">
          Tonic <span className="text-red-400 font-bold">Do</span> = {SOLFEGE_SYLLABLES[0]} ({['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][config.tonic]})
        </span>
      </div>

      <div className="relative flex justify-center w-full max-w-4xl h-24 overflow-x-auto pb-1">
        {keys.map((key) => {
          if (key.isBlack) return null; // Rendered in layer over white keys

          return (
            <div
              key={key.midi}
              onMouseDown={() => onNoteOn(key.midi, 0.9)}
              onMouseUp={() => onNoteOff(key.midi)}
              onMouseLeave={() => key.isActive && onNoteOff(key.midi)}
              onTouchStart={(e) => { e.preventDefault(); onNoteOn(key.midi, 0.9); }}
              onTouchEnd={(e) => { e.preventDefault(); onNoteOff(key.midi); }}
              className={`relative flex-1 min-w-[28px] max-w-[42px] h-full rounded-b border-b-2 transition-all duration-75 cursor-pointer flex flex-col justify-end items-center pb-2 ${
                key.isActive
                  ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.6)] translate-y-[2px]'
                  : 'bg-gradient-to-b from-slate-200 to-slate-100 hover:from-white hover:to-slate-200 border-slate-400'
              }`}
              style={{
                backgroundColor: key.isActive ? key.colorHex : undefined,
              }}
            >
              {/* Syllable and Piano Triangle SVG Label */}
              <div className="flex flex-col items-center gap-0.5 pointer-events-none">
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
                      )
                    }}
                  />
                ) : (
                  <span
                    className={`text-[9px] font-bold ${
                      key.isActive ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    {key.syllable}
                  </span>
                )}
                <span
                  className={`text-[8px] font-mono ${
                    key.isActive ? 'text-white/80' : 'text-slate-500'
                  }`}
                >
                  {key.semitone === 0 ? '•' : ''}
                </span>
              </div>
            </div>
          );
        })}

        {/* Black Keys Layer */}
        <div className="absolute inset-0 flex justify-center pointer-events-none max-w-4xl mx-auto">
          {keys.map((key, idx) => {
            if (!key.isBlack) return null;

            // Compute offset percentage based on position between adjacent white keys
            const whiteIndex = keys.slice(0, idx).filter(k => !k.isBlack).length;
            const totalWhite = keys.filter(k => !k.isBlack).length;
            const leftPercent = (whiteIndex / totalWhite) * 100;

            return (
              <div
                key={key.midi}
                onMouseDown={() => onNoteOn(key.midi, 0.9)}
                onMouseUp={() => onNoteOff(key.midi)}
                onMouseLeave={() => key.isActive && onNoteOff(key.midi)}
                onTouchStart={(e) => { e.preventDefault(); onNoteOn(key.midi, 0.9); }}
                onTouchEnd={(e) => { e.preventDefault(); onNoteOff(key.midi); }}
                className={`absolute pointer-events-auto h-[62%] w-[18px] sm:w-[24px] rounded-b border-b transition-all duration-75 cursor-pointer flex flex-col justify-end items-center pb-1 z-10 -ml-[9px] sm:-ml-[12px] ${
                  key.isActive
                    ? 'border-white shadow-[0_0_16px_rgba(255,255,255,0.7)] translate-y-[2px]'
                    : 'bg-gradient-to-b from-slate-900 to-[#121620] hover:to-slate-800 border-black'
                }`}
                style={{
                  left: `${leftPercent}%`,
                  backgroundColor: key.isActive ? key.colorHex : undefined,
                }}
              >
                <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                  <span
                    className="text-[8px] font-bold text-white leading-tight"
                    style={{ color: key.isActive ? '#ffffff' : key.colorHex }}
                  >
                    {key.syllable}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
