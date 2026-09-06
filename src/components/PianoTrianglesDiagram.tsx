import React, { useState } from 'react';
import { TRIANGLE_VERTEX_COORDINATES } from '../core/ppt-constants';
import { PianoTriangleType, PianoTrianglePoint } from '../core/types';

const TRIANGLE_DETAILS: Record<
  PianoTriangleType,
  {
    title: string;
    subtitle: string;
    notes: [string, string, string]; // [pt1, pt2, pt3]
    description: string;
    accentColor: string;
    fillColor: string;
    bgGlow: string;
  }
> = {
  D: {
    title: 'Down (D)',
    subtitle: 'Inverted Apex @ D',
    notes: ['C♯ (1)', 'D (2)', 'D♯ (3)'],
    description: 'Bridges the 2-black-key cluster (C♯–D♯), dipping downward into white key D.',
    accentColor: '#EF4444', // Red-500
    fillColor: 'rgba(239, 68, 68, 0.25)',
    bgGlow: 'rgba(239, 68, 68, 0.2)',
  },
  L: {
    title: 'Left (L)',
    subtitle: 'Right Angle @ E–F',
    notes: ['E (1)', 'F (2)', 'F♯ (3)'],
    description: 'Anchors the first natural semitone chasm (E–F), ascending to black key F♯.',
    accentColor: '#F59E0B', // Amber-500
    fillColor: 'rgba(245, 158, 11, 0.25)',
    bgGlow: 'rgba(245, 158, 11, 0.2)',
  },
  U: {
    title: 'Up (U)',
    subtitle: 'Equilateral Apex @ G♯',
    notes: ['G (1)', 'G♯ (2)', 'A (3)'],
    description: 'Centres on the 3-black-key cluster, with its apex pointing upward at G♯.',
    accentColor: '#10B981', // Emerald-500
    fillColor: 'rgba(16, 185, 129, 0.25)',
    bgGlow: 'rgba(16, 185, 129, 0.2)',
  },
  R: {
    title: 'Right (R)',
    subtitle: 'Right Angle @ B–C',
    notes: ['A♯ (1)', 'B (2)', 'C (3)'],
    description: 'Anchors the second natural semitone chasm (B–C), descending from black key A♯.',
    accentColor: '#8B5CF6', // Purple-500
    fillColor: 'rgba(139, 92, 246, 0.25)',
    bgGlow: 'rgba(139, 92, 246, 0.2)',
  },
};

// 2-Octave Keyboard Setup: 15 white keys (C3 to C5) & 10 black keys
// Width = 1500 (100 per white key), Height = 170
interface TriangleInstance {
  type: PianoTriangleType;
  octave: number;
  path: string;
  points: { pt: PianoTrianglePoint; x: number; y: number; label: string }[];
}

const TRIANGLE_INSTANCES: TriangleInstance[] = [
  // --- OCTAVE 1 ---
  {
    type: 'D',
    octave: 1,
    path: 'M 100,45 L 200,45 L 150,135 Z',
    points: [
      { pt: 1, x: 100, y: 45, label: 'C♯' },
      { pt: 2, x: 150, y: 135, label: 'D' },
      { pt: 3, x: 200, y: 45, label: 'D♯' },
    ],
  },
  {
    type: 'L',
    octave: 1,
    path: 'M 250,135 L 385,135 L 385,45 Z',
    points: [
      { pt: 1, x: 250, y: 135, label: 'E' },
      { pt: 2, x: 385, y: 135, label: 'F' },
      { pt: 3, x: 385, y: 45, label: 'F♯' },
    ],
  },
  {
    type: 'U',
    octave: 1,
    path: 'M 450,135 L 500,45 L 550,135 Z',
    points: [
      { pt: 1, x: 450, y: 135, label: 'G' },
      { pt: 2, x: 500, y: 45, label: 'G♯' },
      { pt: 3, x: 550, y: 135, label: 'A' },
    ],
  },
  {
    type: 'R',
    octave: 1,
    path: 'M 615,45 L 615,135 L 750,135 Z',
    points: [
      { pt: 1, x: 615, y: 45, label: 'A♯' },
      { pt: 2, x: 615, y: 135, label: 'B' },
      { pt: 3, x: 750, y: 135, label: 'C' },
    ],
  },

  // --- OCTAVE 2 ---
  {
    type: 'D',
    octave: 2,
    path: 'M 800,45 L 900,45 L 850,135 Z',
    points: [
      { pt: 1, x: 800, y: 45, label: 'C♯' },
      { pt: 2, x: 850, y: 135, label: 'D' },
      { pt: 3, x: 900, y: 45, label: 'D♯' },
    ],
  },
  {
    type: 'L',
    octave: 2,
    path: 'M 950,135 L 1085,135 L 1085,45 Z',
    points: [
      { pt: 1, x: 950, y: 135, label: 'E' },
      { pt: 2, x: 1085, y: 135, label: 'F' },
      { pt: 3, x: 1085, y: 45, label: 'F♯' },
    ],
  },
  {
    type: 'U',
    octave: 2,
    path: 'M 1150,135 L 1200,45 L 1250,135 Z',
    points: [
      { pt: 1, x: 1150, y: 135, label: 'G' },
      { pt: 2, x: 1200, y: 45, label: 'G♯' },
      { pt: 3, x: 1250, y: 135, label: 'A' },
    ],
  },
  {
    type: 'R',
    octave: 2,
    path: 'M 1315,45 L 1315,135 L 1450,135 Z',
    points: [
      { pt: 1, x: 1315, y: 45, label: 'A♯' },
      { pt: 2, x: 1315, y: 135, label: 'B' },
      { pt: 3, x: 1450, y: 135, label: 'C' },
    ],
  },
];

const WHITE_KEYS_DATA = [
  { index: 0, name: 'C3' },
  { index: 1, name: 'D3' },
  { index: 2, name: 'E3' },
  { index: 3, name: 'F3' },
  { index: 4, name: 'G3' },
  { index: 5, name: 'A3' },
  { index: 6, name: 'B3' },
  { index: 7, name: 'C4' },
  { index: 8, name: 'D4' },
  { index: 9, name: 'E4' },
  { index: 10, name: 'F4' },
  { index: 11, name: 'G4' },
  { index: 12, name: 'A4' },
  { index: 13, name: 'B4' },
  { index: 14, name: 'C5' },
];

const BLACK_KEYS_DATA = [
  { x: 100, name: 'C♯3' },
  { x: 200, name: 'D♯3' },
  { x: 400, name: 'F♯3' },
  { x: 500, name: 'G♯3' },
  { x: 600, name: 'A♯3' },
  { x: 800, name: 'C♯4' },
  { x: 900, name: 'D♯4' },
  { x: 1100, name: 'F♯4' },
  { x: 1200, name: 'G♯4' },
  { x: 1300, name: 'A♯4' },
];

export const PianoTrianglesDiagram: React.FC = () => {
  const [selectedTriangle, setSelectedTriangle] = useState<PianoTriangleType | null>(null);

  return (
    <div className="space-y-4 select-none">
      {/* 1. Four Geometric Triangles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(['D', 'L', 'U', 'R'] as PianoTriangleType[]).map((type) => {
          const detail = TRIANGLE_DETAILS[type];
          const geom = TRIANGLE_VERTEX_COORDINATES[type];
          const isSelected = selectedTriangle === type;

          return (
            <div
              key={type}
              onClick={() => setSelectedTriangle(isSelected ? null : type)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900 border-white shadow-xl scale-[1.02]'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-600 hover:bg-slate-900/60'
              }`}
              style={{
                boxShadow: isSelected ? `0 0 20px ${detail.bgGlow}` : undefined,
              }}
            >
              <div className="space-y-2">
                {/* Vector Triangle Diagram */}
                <div className="w-full h-24 flex items-center justify-center bg-slate-900/90 rounded-lg border border-slate-800 p-2">
                  <svg
                    viewBox="0 0 100 100"
                    className="w-20 h-20 overflow-visible"
                    role="img"
                    aria-label={`Piano Triangle ${detail.title}`}
                  >
                    {/* Triangle Silhouette */}
                    <path
                      d={geom.path}
                      fill={isSelected ? detail.fillColor : 'rgba(30, 41, 59, 0.4)'}
                      stroke={detail.accentColor}
                      strokeWidth={isSelected ? 3.5 : 2.5}
                      strokeLinejoin="round"
                    />

                    {/* Three Numbered Vertices */}
                    {([1, 2, 3] as PianoTrianglePoint[]).map((pt) => {
                      const coords = geom.points[pt];

                      return (
                        <g key={pt}>
                          <circle
                            cx={coords.x}
                            cy={coords.y}
                            r={8.5}
                            fill={detail.accentColor}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                          />
                          <text
                            x={coords.x}
                            y={coords.y + 3.5}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="8px"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {pt}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Card Title & Subtitle */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider" style={{ color: detail.accentColor }}>
                      {detail.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      3-Note Triangle
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-300 font-medium block">
                    {detail.subtitle}
                  </span>
                </div>

                {/* Vertices List */}
                <div className="flex items-center justify-between text-[10.5px] font-mono bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                  {detail.notes.map((n, i) => (
                    <span key={i} className="text-slate-300 font-semibold">
                      {n}
                    </span>
                  ))}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {detail.description}
                </p>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono text-center">
                {isSelected ? 'Click to deselect' : 'Click to overlay on keyboard'}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Physical Keyboard Topography Strip with Drawn Overlays (Two Octaves: C3 to C5) */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Two-Octave Keyboard Geometric Overlay</span>
              <span className="text-[11px] font-normal text-amber-400 font-mono">(C3 to C5 &bull; 8 Geometric Triangles)</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Notice how all 4 geometric triangles tile continuously across physical piano keys without gaps:
            </p>
          </div>

          <div className="flex items-center gap-2.5 text-[11px] font-mono">
            <button
              onClick={() => setSelectedTriangle(selectedTriangle === 'D' ? null : 'D')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition ${
                selectedTriangle === 'D' ? 'border-red-400 bg-red-950/60 text-red-300' : 'border-slate-800 text-red-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500" /> D
            </button>
            <button
              onClick={() => setSelectedTriangle(selectedTriangle === 'L' ? null : 'L')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition ${
                selectedTriangle === 'L' ? 'border-amber-400 bg-amber-950/60 text-amber-300' : 'border-slate-800 text-amber-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" /> L
            </button>
            <button
              onClick={() => setSelectedTriangle(selectedTriangle === 'U' ? null : 'U')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition ${
                selectedTriangle === 'U' ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300' : 'border-slate-800 text-emerald-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> U
            </button>
            <button
              onClick={() => setSelectedTriangle(selectedTriangle === 'R' ? null : 'R')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition ${
                selectedTriangle === 'R' ? 'border-purple-400 bg-purple-950/60 text-purple-300' : 'border-slate-800 text-purple-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-500" /> R
            </button>
          </div>
        </div>

        {/* Scalable SVG Two-Octave Keyboard with Drawn Geometric Overlays */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 overflow-hidden shadow-inner">
          <svg
            viewBox="0 0 1500 170"
            className="w-full h-auto max-h-48 overflow-visible"
            role="img"
            aria-label="Two-octave piano keyboard with geometric triangle overlays"
          >
            {/* --- LAYER 1: 15 White Keys --- */}
            {WHITE_KEYS_DATA.map((k) => (
              <g key={k.index}>
                <rect
                  x={k.index * 100 + 1}
                  y={0}
                  width={98}
                  height={168}
                  rx={4}
                  fill="#f8fafc"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                />
                <text
                  x={k.index * 100 + 50}
                  y={160}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="15px"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {k.name}
                </text>
              </g>
            ))}

            {/* --- LAYER 2: 10 Black Keys --- */}
            {BLACK_KEYS_DATA.map((bk, i) => (
              <g key={i}>
                <rect
                  x={bk.x - 30}
                  y={0}
                  width={60}
                  height={98}
                  rx={3}
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth={2}
                />
                <text
                  x={bk.x}
                  y={86}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="12px"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {bk.name}
                </text>
              </g>
            ))}

            {/* --- LAYER 3: Drawn Vector Triangle Overlays --- */}
            {TRIANGLE_INSTANCES.map((inst, idx) => {
              const detail = TRIANGLE_DETAILS[inst.type];
              const isMatch = selectedTriangle === null || selectedTriangle === inst.type;
              const isExplicit = selectedTriangle === inst.type;

              const strokeColor = detail.accentColor;
              const fillColor = isExplicit ? detail.fillColor : isMatch ? `${detail.accentColor}25` : 'transparent';
              const strokeOpacity = isExplicit ? 1 : isMatch ? 0.85 : 0.2;
              const fillOpacity = isExplicit ? 1 : isMatch ? 0.7 : 0.05;

              return (
                <g
                  key={idx}
                  className="cursor-pointer transition-all duration-150"
                  onClick={() => setSelectedTriangle(selectedTriangle === inst.type ? null : inst.type)}
                >
                  {/* Triangle Boundary Polygon */}
                  <path
                    d={inst.path}
                    fill={fillColor}
                    fillOpacity={fillOpacity}
                    stroke={strokeColor}
                    strokeWidth={isExplicit ? 4.5 : 3}
                    strokeOpacity={strokeOpacity}
                    strokeLinejoin="round"
                  />

                  {/* Vertices (Visible when matching or highlighted) */}
                  {inst.points.map((p) => (
                    <g key={p.pt}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isExplicit ? 13 : 10.5}
                        fill={isMatch ? detail.accentColor : '#475569'}
                        fillOpacity={isMatch ? 1 : 0.3}
                        stroke="#ffffff"
                        strokeWidth={isExplicit ? 2.5 : 1.5}
                        strokeOpacity={isMatch ? 1 : 0.3}
                      />
                      <text
                        x={p.x}
                        y={p.y + (isExplicit ? 4.5 : 4)}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={isExplicit ? '11px' : '9.5px'}
                        fontFamily="monospace"
                        fontWeight="bold"
                        fillOpacity={isMatch ? 1 : 0.4}
                      >
                        {p.pt}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Stable Fixed Height (h-8) Status Ribbon to Prevent Layout Shift */}
        <div className="h-8 flex items-center justify-center text-[11px] font-mono text-center text-slate-300 bg-slate-900/60 rounded px-3 border border-slate-800/60 overflow-hidden">
          {selectedTriangle ? (
            <div className="animate-in fade-in duration-100 flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TRIANGLE_DETAILS[selectedTriangle].accentColor }} />
              <strong style={{ color: TRIANGLE_DETAILS[selectedTriangle].accentColor }}>
                {TRIANGLE_DETAILS[selectedTriangle].title}:
              </strong>
              <span className="text-slate-300 truncate">{TRIANGLE_DETAILS[selectedTriangle].description}</span>
            </div>
          ) : (
            <span className="text-slate-400 truncate">
              Click any triangle card or button above to isolate its geometric overlay across both octaves
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
