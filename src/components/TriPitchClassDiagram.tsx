import React, { useState } from 'react';
import {
  TRI_PITCH_CLASSES,
  TRI_PITCH_CLASSES_SPOKEN,
  PITCH_NAMES_DUAL,
} from '../core/ppt-constants';

interface TritonePair {
  id: string;
  naturalPitch: number;
  naturalName: string;
  accidentalPitch?: number;
  accidentalName?: string;
  isNaturalPair?: boolean;
  description: string;
}

const TRITONE_PAIRS: TritonePair[] = [
  {
    id: 'C-Fsharp',
    naturalPitch: 0,
    naturalName: 'C',
    accidentalPitch: 6,
    accidentalName: '△C',
    description: 'C pairs with F♯/G♭ (△C, Tri-C). 6 semitones across the circle.',
  },
  {
    id: 'D-Gsharp',
    naturalPitch: 2,
    naturalName: 'D',
    accidentalPitch: 8,
    accidentalName: '△D',
    description: 'D pairs with G♯/A♭ (△D, Tri-D). 6 semitones across the circle.',
  },
  {
    id: 'E-Asharp',
    naturalPitch: 4,
    naturalName: 'E',
    accidentalPitch: 10,
    accidentalName: '△E',
    description: 'E pairs with A♯/B♭ (△E, Tri-E). 6 semitones across the circle.',
  },
  {
    id: 'G-Csharp',
    naturalPitch: 7,
    naturalName: 'G',
    accidentalPitch: 1,
    accidentalName: '△G',
    description: 'G pairs with C♯/D♭ (△G, Tri-G). 6 semitones across the circle.',
  },
  {
    id: 'A-Dsharp',
    naturalPitch: 9,
    naturalName: 'A',
    accidentalPitch: 3,
    accidentalName: '△A',
    description: 'A pairs with D♯/E♭ (△A, Tri-A). 6 semitones across the circle.',
  },
  {
    id: 'B-F',
    naturalPitch: 11,
    naturalName: 'B',
    accidentalPitch: 5,
    accidentalName: 'F',
    isNaturalPair: true,
    description: 'B & F are both natural white keys! As a natural tritone pair, neither receives a △ prefix.',
  },
];

export const TriPitchClassDiagram: React.FC = () => {
  const [hoveredPitch, setHoveredPitch] = useState<number | null>(null);

  // Find partner pitch (tritone is exactly (pitch + 6) % 12)
  const partnerPitch = hoveredPitch !== null ? (hoveredPitch + 6) % 12 : null;

  return (
    <div className="space-y-4 select-none">
      {/* 1. Explanatory Context Banner */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
            <span>The 12-Tone Tri Pitch-Class Sequence</span>
            <span className="text-[11px] font-normal text-cyan-400 font-mono">(Default Absolute Pitch Notation)</span>
          </h4>
          <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 self-start sm:self-auto">
            Tritone = &plusmn;6 Semitones
          </span>
        </div>
        <p className="text-[11.5px] text-slate-300 leading-relaxed">
          Traditional music notation suffers from enharmonic confusion (e.g. is a note F♯ or G♭? C♯ or D♭?).
          In Prime Period Theory, <strong>Tri Pitch-Class Notation</strong> is the default absolute alternative:
          natural notes retain their names (C, D, E, F, G, A, B), while the 5 non-natural pitches are uniquely named
          after their <strong>tritone counterpart (6 semitones away)</strong> with a triangle (&bigtriangleup;) symbol or spoken &quot;Tri-&quot; prefix.
        </p>
      </div>

      {/* 2. The 12 Chromatic Pitch Classes Grid */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span>Click or hover any pitch class to illuminate its tritone polar partner:</span>
          <span className="text-slate-500 text-[10px] hidden sm:inline">12TET Polar Spanning</span>
        </div>

        {/* 12 Pitch Class Cards */}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
          {TRI_PITCH_CLASSES.map((triName, pitch) => {
            const isNatural = !triName.startsWith('△');
            const isHovered = hoveredPitch === pitch;
            const isPartner = partnerPitch === pitch;
            const traditional = PITCH_NAMES_DUAL[pitch];
            const spoken = TRI_PITCH_CLASSES_SPOKEN[pitch];

            return (
              <div
                key={pitch}
                onMouseEnter={() => setHoveredPitch(pitch)}
                onMouseLeave={() => setHoveredPitch(null)}
                className={`p-2 rounded-lg border transition-all flex flex-col items-center justify-between text-center cursor-pointer ${
                  isHovered
                    ? 'bg-cyan-950/80 border-cyan-400 ring-2 ring-cyan-400/50 shadow-lg scale-105 z-10'
                    : isPartner
                    ? 'bg-amber-950/70 border-amber-400 ring-1 ring-amber-400/40'
                    : isNatural
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                    : 'bg-slate-950/90 border-slate-800/80 hover:border-slate-600'
                }`}
              >
                <div className="text-[9px] font-mono text-slate-500 mb-0.5">
                  #{pitch}
                </div>
                <div
                  className={`text-sm sm:text-base font-bold font-mono tracking-tight ${
                    isHovered
                      ? 'text-cyan-300'
                      : isPartner
                      ? 'text-amber-300'
                      : !isNatural
                      ? 'text-cyan-400'
                      : 'text-white'
                  }`}
                >
                  {triName}
                </div>
                <div className="text-[9.5px] font-mono text-slate-400 truncate w-full mt-1">
                  {spoken}
                </div>
                <div className="text-[9px] font-mono text-slate-500 truncate w-full">
                  {traditional}
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Six Tritone Pairs Polar Layout */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="text-[11px] font-mono text-slate-400">
            The 6 Canonical Tritone Polar Axes:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {TRITONE_PAIRS.map((pair) => {
              const isActive =
                hoveredPitch === pair.naturalPitch ||
                hoveredPitch === pair.accidentalPitch;

              return (
                <div
                  key={pair.id}
                  onMouseEnter={() => setHoveredPitch(pair.naturalPitch)}
                  onMouseLeave={() => setHoveredPitch(null)}
                  className={`p-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 border-cyan-400/80 shadow-md'
                      : 'bg-slate-950/60 border-slate-800/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-slate-700 text-white">
                      {pair.naturalName}
                    </span>
                    <span className="text-slate-500 font-mono text-xs">&harr;</span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                        pair.isNaturalPair
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-cyan-950/80 border-cyan-800 text-cyan-300'
                      }`}
                    >
                      {pair.accidentalName}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    {pair.isNaturalPair ? 'Natural Pair' : '6 st Tritone'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fixed Height (h-10) Detail Ribbon to Prevent Layout Shift */}
        <div className="pt-2 border-t border-slate-800/80 h-10 flex items-center justify-center text-xs overflow-hidden">
          {hoveredPitch !== null && partnerPitch !== null ? (
            <div className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-slate-900/90 border border-slate-700/80 text-slate-300 font-mono text-[11px] animate-in fade-in duration-100">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-cyan-400" />
                <span className="font-bold text-white text-xs">
                  {TRI_PITCH_CLASSES[hoveredPitch]} ({TRI_PITCH_CLASSES_SPOKEN[hoveredPitch]})
                </span>
                <span className="text-slate-400 truncate">
                  Traditional: {PITCH_NAMES_DUAL[hoveredPitch]}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-[10.5px] shrink-0">
                <span>Tritone Partner:</span>
                <strong className="text-amber-300">
                  {TRI_PITCH_CLASSES[partnerPitch]} (#{partnerPitch})
                </strong>
                {hoveredPitch === 5 || hoveredPitch === 11 ? (
                  <span className="text-emerald-400">(Natural Pair)</span>
                ) : (
                  <span className="text-cyan-400">(&plusmn;6 st)</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 font-mono text-center truncate">
              Hover any pitch class or tritone pair to inspect its relationship and spoken name
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
