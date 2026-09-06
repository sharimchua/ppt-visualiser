import React, { useState } from 'react';
import { SOLFEGE_SYLLABLES, SOLFEGE_SPECS, getClockAngleRad } from '../core/ppt-constants';

interface PitchClockDiagramProps {
  size?: number;
}

export const PitchClockDiagram: React.FC<PitchClockDiagramProps> = ({ size = 230 }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const radius = 96;
  const cx = 150;
  const cy = 165;

  return (
    <div className="w-full max-w-[260px] min-w-0 mx-auto flex flex-col items-center justify-center p-3 bg-slate-950/80 border border-slate-800/90 rounded-xl select-none shrink-0 overflow-hidden shadow-lg">
      <div className="relative w-full" style={{ maxWidth: `${size}px`, aspectRatio: '300/330' }}>
        <svg
          viewBox="0 0 300 330"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label="Prime Period Theory 12-Tone Pitch Class Clock with Movable Do"
        >
          {/* Subtle Outer Dial Ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(51, 65, 85, 0.4)"
            strokeWidth="2"
            strokeDasharray="3 3"
          />

          {/* Inner Accent Ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius - 28}
            fill="rgba(15, 23, 42, 0.4)"
            stroke="rgba(51, 65, 85, 0.25)"
            strokeWidth="1"
          />

          {/* Vertical Polar Diameter Axis (Do at 12 o'clock <-> Fi at 6 o'clock) */}
          <line
            x1={cx}
            y1={cy - radius + 14}
            x2={cx}
            y2={cy + radius - 14}
            stroke="rgba(225, 54, 16, 0.3)"
            strokeWidth="2"
            strokeDasharray="4 3"
          />

          {/* Polar Axis Labels (Clear air above Do and below Fi) */}
          <g>
            <rect
              x={cx - 75}
              y={14}
              width={150}
              height={20}
              rx={10}
              fill="rgba(15, 23, 42, 0.9)"
              stroke="rgba(225, 54, 16, 0.4)"
              strokeWidth="1"
            />
            <text
              x={cx}
              y={28}
              textAnchor="middle"
              className="text-[10px] font-bold fill-red-400 uppercase tracking-wider select-none font-mono"
            >
              12 o&apos;clock &bull; Zenith (Do)
            </text>
          </g>

          <g>
            <rect
              x={cx - 75}
              y={296}
              width={150}
              height={20}
              rx={10}
              fill="rgba(15, 23, 42, 0.9)"
              stroke="rgba(148, 163, 184, 0.4)"
              strokeWidth="1"
            />
            <text
              x={cx}
              y={310}
              textAnchor="middle"
              className="text-[10px] font-bold fill-slate-300 uppercase tracking-wider select-none font-mono"
            >
              6 o&apos;clock &bull; Nadir (Fi)
            </text>
          </g>

          {/* Center Hub with Movable Do Indicator */}
          <circle cx={cx} cy={cy} r="5" fill="rgba(148, 163, 184, 0.8)" />
          <circle cx={cx} cy={cy} r="18" fill="none" stroke="rgba(71, 85, 105, 0.3)" strokeWidth="1" />
          <text
            x={cx}
            y={cy - 22}
            textAnchor="middle"
            fill="rgba(148, 163, 184, 0.8)"
            fontSize="8.5px"
            fontWeight="bold"
            fontFamily="monospace"
          >
            Movable Do
          </text>

          {/* Directional Arc Arrow (Clockwise Flow) */}
          <path
            d={`M ${cx + 34} ${cy - 10} A 36 36 0 0 1 ${cx + 10} ${cy + 34}`}
            fill="none"
            stroke="rgba(245, 212, 50, 0.5)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
          <polygon
            points={`${cx + 7},${cy + 34} ${cx + 13},${cy + 38} ${cx + 14},${cy + 30}`}
            fill="rgba(245, 212, 50, 0.8)"
          />

          {/* 12 Chromatic Tone Nodes */}
          {SOLFEGE_SYLLABLES.map((syl, i) => {
            const spec = SOLFEGE_SPECS[syl];
            const angleRad = getClockAngleRad(spec.semitone);
            const nx = cx + Math.cos(angleRad) * radius;
            const ny = cy + Math.sin(angleRad) * radius;
            const isDo = spec.semitone === 0;
            const isFi = spec.semitone === 6;
            const isHovered = hoveredIndex === i;

            const isFiObsidian = spec.colorHex.toLowerCase() === '#141414';
            const nodeFill = isFiObsidian ? '#1e293b' : spec.colorHex;
            const nodeStroke = isDo
              ? '#ffffff'
              : isFiObsidian
              ? '#f8fafc'
              : isHovered
              ? '#ffffff'
              : 'rgba(15, 23, 42, 0.8)';

            return (
              <g
                key={syl}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Connecting Spoke Line */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={nx}
                  y2={ny}
                  stroke={isHovered ? spec.colorHex : 'rgba(71, 85, 105, 0.2)'}
                  strokeWidth={isHovered ? 1.5 : 1}
                />

                {/* Glow ring for hovered or Do/Fi */}
                {(isHovered || isDo || isFi) && (
                  <circle
                    cx={nx}
                    cy={ny}
                    r={isDo ? 16 : 14}
                    fill="none"
                    stroke={spec.colorHex}
                    strokeWidth="1.5"
                    strokeOpacity={isHovered ? 0.9 : 0.4}
                  />
                )}

                {/* Node Circle */}
                <circle
                  cx={nx}
                  cy={ny}
                  r={isDo ? 13 : 11}
                  fill={nodeFill}
                  stroke={nodeStroke}
                  strokeWidth={isDo ? 2.5 : isFiObsidian ? 2 : 1.5}
                />

                {/* Syllable Label */}
                <text
                  x={nx}
                  y={ny + 3.5}
                  textAnchor="middle"
                  fill={isFiObsidian ? '#f8fafc' : '#ffffff'}
                  fontSize={isDo ? '9.5px' : '8.5px'}
                  fontWeight="bold"
                  fontFamily="monospace"
                  className="pointer-events-none select-none"
                >
                  {syl}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Detail Ribbon - Strict Fixed Width & Height with Zero Layout Shift */}
      <div className="w-full mt-2 pt-1.5 border-t border-slate-800/80 h-8 flex items-center justify-center text-center text-xs overflow-hidden min-w-0">
        {hoveredIndex !== null ? (
          (() => {
            const syl = SOLFEGE_SYLLABLES[hoveredIndex];
            const spec = SOLFEGE_SPECS[syl];
            return (
              <div className="flex items-center justify-center gap-1.5 text-[10.5px] animate-in fade-in duration-100 font-mono truncate px-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: spec.colorHex }} />
                <span className="font-bold text-white">{syl}</span>
                <span className="text-slate-400">+{spec.semitone} st</span>
                <span className="text-amber-400 capitalize text-[10px]">
                  ({spec.glyphType} @ {spec.rotation}&deg;)
                </span>
              </div>
            );
          })()
        ) : (
          <div className="text-[10px] text-slate-400 font-mono truncate text-center px-1">
            Hover a degree to inspect
          </div>
        )}
      </div>
    </div>
  );
};
