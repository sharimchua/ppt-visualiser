import React, { useState } from 'react';
import { PATH_BASE, PATH_SHARP, PATH_FLAT, SOLFEGE_SPECS } from '../core/ppt-constants';
import { GlyphType } from '../core/types';

interface GlyphCellProps {
  syllable: string;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

const GlyphVector: React.FC<{
  glyphType: GlyphType;
  rotation: number;
  colorHex: string;
  size?: number;
}> = ({ glyphType, rotation, colorHex, size = 32 }) => {
  let pathD = PATH_BASE;
  if (glyphType === 'sharp') pathD = PATH_SHARP;
  else if (glyphType === 'flat') pathD = PATH_FLAT;

  const isFi = colorHex.toLowerCase() === '#141414';
  const fillColor = isFi ? '#0f172a' : colorHex;
  const strokeColor = isFi ? '#f8fafc' : '#ffffff';
  const strokeWidth = isFi ? 6 : 3.5;

  return (
    <svg
      viewBox="-120 -120 240 240"
      width={size}
      height={size}
      className="shrink-0 transition-transform duration-200"
      style={{
        transform: `rotate(${rotation}deg)`,
        overflow: 'visible',
      }}
    >
      <path
        d={pathD}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        transform="scale(1, -1)"
      />
    </svg>
  );
};

const GlyphCell: React.FC<GlyphCellProps> = ({ syllable, isHovered, onHover, onLeave }) => {
  const spec = SOLFEGE_SPECS[syllable];
  const isFi = spec.colorHex.toLowerCase() === '#141414';
  const offsetStr = spec.nearestAddress > 0 ? `+${spec.nearestAddress}` : `${spec.nearestAddress}`;

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`relative p-2 rounded-lg border transition-all flex flex-col items-center gap-1 cursor-pointer select-none ${
        isHovered
          ? 'bg-slate-800 border-white shadow-[0_0_12px_rgba(255,255,255,0.25)] ring-1 ring-white/60 z-10'
          : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-600'
      }`}
    >
      <GlyphVector
        glyphType={spec.glyphType}
        rotation={spec.rotation}
        colorHex={spec.colorHex}
        size={36}
      />
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`text-xs font-bold font-mono ${isFi ? 'text-slate-200' : 'text-white'}`}>
          {syllable}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {offsetStr}
        </span>
      </div>
      <span className="text-[9px] text-slate-500 font-mono">
        {spec.rotation}&deg;
      </span>
    </div>
  );
};

export const UniformSolfegeDiagram: React.FC = () => {
  const [activeSyllable, setActiveSyllable] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* 1. The Three Elemental Glyphs (Root Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Base Glyph */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 flex items-center justify-center rounded-lg bg-slate-900/90 border border-slate-800">
            <GlyphVector glyphType="base" rotation={0} colorHex="#E13610" size={44} />
          </div>
          <div>
            <span className="font-bold text-white text-xs uppercase tracking-wider block">
              1. Base Glyph
            </span>
            <span className="text-[11px] text-red-400 font-medium">Neutral / Diamond Cross</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Reflectively symmetric across both axes. Represents foundational minor-third anchors around Do (0 st): <strong>Do (0&deg;, 0 st)</strong>, <strong>Me (90&deg;, +3 st)</strong>, <strong>Fi (180&deg;, +6 st)</strong>, <strong>La (270&deg;, -3 st)</strong>.
          </p>
        </div>

        {/* Sharp Glyph */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 flex items-center justify-center rounded-lg bg-slate-900/90 border border-slate-800">
            <GlyphVector glyphType="sharp" rotation={0} colorHex="#F98016" size={44} />
          </div>
          <div>
            <span className="font-bold text-amber-400 text-xs uppercase tracking-wider block">
              2. Sharp Glyph (+1)
            </span>
            <span className="text-[11px] text-amber-300 font-medium">Clockwise Outward Peak</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Asymmetric outward apex pointing clockwise in the direction of ascending pitch (+1 semitone tilt): <strong>Ra (0&deg;, +1 st)</strong>, <strong>Mi (90&deg;, +4 st)</strong>, <strong>So (180&deg;, -5 st)</strong>, <strong>Te (270&deg;, -2 st)</strong>.
          </p>
        </div>

        {/* Flat Glyph */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 flex items-center justify-center rounded-lg bg-slate-900/90 border border-slate-800">
            <GlyphVector glyphType="flat" rotation={0} colorHex="#F158A4" size={44} />
          </div>
          <div>
            <span className="font-bold text-cyan-400 text-xs uppercase tracking-wider block">
              3. Flat Glyph (-1)
            </span>
            <span className="text-[11px] text-cyan-300 font-medium">Counter-Clockwise Inward Dip</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Concave notch receding counter-clockwise against pitch progression (-1 semitone dip): <strong>Ti (0&deg;, -1 st)</strong>, <strong>Re (90&deg;, +2 st)</strong>, <strong>Fa (180&deg;, +5 st)</strong>, <strong>Le (270&deg;, -4 st)</strong>.
          </p>
        </div>
      </div>

      {/* 2. The 4-Fold Symmetry Matrix (3 Glyphs x 4 Rotations) */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/80 pb-2.5">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>The 4-Fold Symmetry Matrix</span>
              <span className="text-[11px] font-normal text-amber-400 font-mono">(3 Glyphs &times; 4 Quadrants = 12 Tones)</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Every 90&deg; clockwise rotation advances +3 semitones around the circle. Do is the centre (0 st), La is -3 st, and So is the lowest bound at -5 st.
            </p>
          </div>
          <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 self-start sm:self-auto">
            90&deg; = &plusmn;3 Semitones
          </span>
        </div>

        {/* Matrix Grid */}
        <div className="overflow-x-auto py-1.5 px-0.5">
          <div className="min-w-[480px] space-y-2">
            {/* Header Columns */}
            <div className="grid grid-cols-5 gap-2 text-[11px] font-mono text-slate-400 text-center px-1">
              <div className="text-left font-bold text-slate-300">Glyph Type</div>
              <div className="bg-slate-900/60 py-1 rounded border border-slate-800/60">0&deg; (0 st Anchor)</div>
              <div className="bg-slate-900/60 py-1 rounded border border-slate-800/60">90&deg; (+3 st CW)</div>
              <div className="bg-slate-900/60 py-1 rounded border border-slate-800/60">180&deg; (+6 / -5 st)</div>
              <div className="bg-slate-900/60 py-1 rounded border border-slate-800/60">270&deg; (-3 st CCW)</div>
            </div>

            {/* Row 1: Base */}
            <div className="grid grid-cols-5 gap-2 items-center">
              <div className="text-xs font-bold text-slate-200">
                <span>Base</span>
                <span className="text-[10px] text-slate-500 block font-normal font-mono">0 st offset</span>
              </div>
              <GlyphCell
                syllable="Do"
                isHovered={activeSyllable === 'Do'}
                onHover={() => setActiveSyllable('Do')}
                onLeave={() => setActiveSyllable(null)}
              />
              <GlyphCell
                syllable="Me"
                isHovered={activeSyllable === 'Me'}
                onHover={() => setActiveSyllable('Me')}
                onLeave={() => setActiveSyllable(null)}
              />
              <GlyphCell
                syllable="Fi"
                isHovered={activeSyllable === 'Fi'}
                onHover={() => setActiveSyllable('Fi')}
                onLeave={() => setActiveSyllable(null)}
              />
              <GlyphCell
                syllable="La"
                isHovered={activeSyllable === 'La'}
                onHover={() => setActiveSyllable('La')}
                onLeave={() => setActiveSyllable(null)}
              />
            </div>

            {/* Row 2: Sharp */}
            <div className="grid grid-cols-5 gap-2 items-center">
              <div className="text-xs font-bold text-amber-400">
                <span>Sharp</span>
                <span className="text-[10px] text-amber-500/80 block font-normal font-mono">+1 st offset</span>
              </div>
              <GlyphCell
                syllable="Ra"
                isHovered={activeSyllable === 'Ra'}
                onHover={() => setActiveSyllable('Ra')}
                onLeave={() => setActiveSyllable(null)}
              />
              <GlyphCell
                syllable="Mi"
                isHovered={activeSyllable === 'Mi'}
                onHover={() => setActiveSyllable('Mi')}
                onLeave={() => setActiveSyllable(null)}
              />
              <GlyphCell
                syllable="So"
                isHovered={activeSyllable === 'So'}
                onHover={() => setActiveSyllable('So')}
                onLeave={() => setActiveSyllable(null)}
              />
              <GlyphCell
                syllable="Te"
                isHovered={activeSyllable === 'Te'}
                onHover={() => setActiveSyllable('Te')}
                onLeave={() => setActiveSyllable(null)}
              />
            </div>

            {/* Row 3: Flat */}
            <div className="grid grid-cols-5 gap-2 items-center">
              <div className="text-xs font-bold text-cyan-400">
                <span>Flat</span>
                <span className="text-[10px] text-cyan-500/80 block font-normal font-mono">-1 st offset</span>
              </div>
              <GlyphCell
                syllable="Ti"
                isHovered={activeSyllable === 'Ti'}
                onHover={() => setActiveSyllable('Ti')}
                onLeave={() => setActiveSyllable(null)}
              />
              <GlyphCell
                syllable="Re"
                isHovered={activeSyllable === 'Re'}
                onHover={() => setActiveSyllable('Re')}
                onLeave={() => setActiveSyllable(null)}
              />
              <GlyphCell
                syllable="Fa"
                isHovered={activeSyllable === 'Fa'}
                onHover={() => setActiveSyllable('Fa')}
                onLeave={() => setActiveSyllable(null)}
              />
              <GlyphCell
                syllable="Le"
                isHovered={activeSyllable === 'Le'}
                onHover={() => setActiveSyllable('Le')}
                onLeave={() => setActiveSyllable(null)}
              />
            </div>
          </div>
        </div>

        {/* Hover Inspector Banner - Stable Fixed Height to Prevent Layout Shift */}
        <div className="pt-2 border-t border-slate-800/80 h-10 flex items-center justify-center text-xs overflow-hidden">
          {activeSyllable ? (
            (() => {
              const spec = SOLFEGE_SPECS[activeSyllable];
              const offsetStr = spec.nearestAddress > 0 ? `+${spec.nearestAddress}` : `${spec.nearestAddress}`;
              return (
                <div className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-slate-900/90 border border-slate-700/80 text-slate-300 font-mono text-[11px] animate-in fade-in duration-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: spec.colorHex }} />
                    <span className="font-bold text-white text-xs">{activeSyllable}</span>
                    <span className="text-amber-400 font-semibold">{offsetStr} st</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 text-[10.5px]">
                    <span>Rotation: <strong className="text-amber-300">{spec.rotation}&deg;</strong></span>
                    <span className="hidden sm:inline">Centre Do Offset: <strong className="text-cyan-300">{offsetStr} st</strong></span>
                    <span className="capitalize text-slate-300">{spec.glyphType}</span>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="text-[11px] text-slate-400 font-mono text-center truncate">
              Hover any syllable to inspect its rotation and centred offset from Do (0 st, lowest So at -5 st)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
