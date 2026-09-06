import React, { useState } from 'react';

export const ConcentricOrbitsDiagram: React.FC = () => {
  const [selectedRegister, setSelectedRegister] = useState<number | null>(4); // Default to middle register 4 (C4 octave)

  const cx = 150;
  const cy = 160;
  // 8 orbits radii from outermost (Register 1, Bass) to innermost (Register 8, Treble)
  const orbits = [120, 106, 92, 78, 64, 50, 36, 22];

  // Generates SVG path for a Do-centered register arc from 7 o'clock (So, 120deg)
  // around clockwise past 12 o'clock (-90deg) to 6 o'clock (Fi, 90deg).
  function getRegisterArcPath(r: number): string {
    const startAngle = (120 * Math.PI) / 180; // 7 o'clock (So)
    const endAngle = (90 * Math.PI) / 180;   // 6 o'clock (Fi)
    const startX = cx + Math.cos(startAngle) * r;
    const startY = cy + Math.sin(startAngle) * r;
    const endX = cx + Math.cos(endAngle) * r;
    const endY = cy + Math.sin(endAngle) * r;

    // Sweeps clockwise from 120deg through -90deg (12 o'clock) to 90deg (total 330deg sweep)
    return `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${endX} ${endY}`;
  }

  // Generates smooth transition arc stepping inward from register r1 at 6 o'clock (Fi, 90deg)
  // to register r2 at 7 o'clock (So, 120deg)
  function getTransitionArc(r1: number, r2: number): string {
    const p1x = cx + Math.cos((90 * Math.PI) / 180) * r1;
    const p1y = cy + Math.sin((90 * Math.PI) / 180) * r1;
    const p2x = cx + Math.cos((120 * Math.PI) / 180) * r2;
    const p2y = cy + Math.sin((120 * Math.PI) / 180) * r2;
    return `M ${p1x} ${p1y} C ${p1x + 8} ${p1y + 8}, ${p2x} ${p2y + 8}, ${p2x} ${p2y}`;
  }

  return (
    <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-950/80 border border-slate-800/90 rounded-xl select-none space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2 border-b border-slate-800/80 pb-2.5">
        <div>
          <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
            <span>Concentric Octave Orbits</span>
            <span className="text-[11px] font-normal text-cyan-400 font-mono">(8 Registers &bull; Do Centered)</span>
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            Note progression flows clockwise from 7 o&apos;clock (So, -5) past 12 o&apos;clock (Do, 0) to 6 o&apos;clock (Fi, +6).
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 self-start sm:self-auto">
          <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60">
            Reg 1: Bass (Outer)
          </span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/60">
            Reg 8: Treble (Inner)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center w-full">
        {/* SVG Concentric Radar with Smooth Note Progression Arcs */}
        <div className="md:col-span-6 flex justify-center">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72">
            <svg
              viewBox="0 0 300 320"
              className="w-full h-full overflow-visible"
              role="img"
              aria-label="Concentric 8-Octave Orbits Diagram with collision-free labels"
            >
              {/* Permanent Clear Top Zenith Badge (No overlap with circle top at y=40) */}
              <rect
                x={cx - 70}
                y={6}
                width={140}
                height={18}
                rx={9}
                fill="rgba(15, 23, 42, 0.9)"
                stroke="rgba(225, 54, 16, 0.4)"
                strokeWidth={1}
              />
              <text
                x={cx}
                y={18.5}
                textAnchor="middle"
                fill="#f87171"
                fontSize="9px"
                fontFamily="monospace"
                fontWeight="bold"
                className="select-none"
              >
                12 o&apos;clock &bull; Do Zenith
              </text>

              {/* Permanent Clear Bottom Step Badge (No overlap with circle bottom at y=280) */}
              <rect
                x={cx - 85}
                y={296}
                width={170}
                height={18}
                rx={9}
                fill="rgba(15, 23, 42, 0.9)"
                stroke="rgba(244, 63, 94, 0.4)"
                strokeWidth={1}
              />
              <text
                x={cx}
                y={308.5}
                textAnchor="middle"
                fill="#f43f5e"
                fontSize="9px"
                fontFamily="monospace"
                fontWeight="bold"
                className="select-none"
              >
                Octave Step: Fi (+6) &rarr; So (-5)
              </text>

              {/* 8 Concentric Orbit Guide Rings */}
              {orbits.map((r, i) => {
                const reg = i + 1;
                const isSelected = selectedRegister === reg;

                return (
                  <circle
                    key={reg}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={isSelected ? 'rgba(56, 189, 248, 0.35)' : 'rgba(51, 65, 85, 0.25)'}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeDasharray={isSelected ? undefined : '2 3'}
                  />
                );
              })}

              {/* Central Treble Hub */}
              <circle cx={cx} cy={cy} r="6" fill="#0284c7" />
              <circle cx={cx} cy={cy} r="14" fill="none" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />

              {/* 12 o'clock Zenith Axis Guide Line */}
              <line
                x1={cx}
                y1={cy - 124}
                x2={cx}
                y2={cy - 16}
                stroke="rgba(225, 54, 16, 0.35)"
                strokeWidth="1.2"
                strokeDasharray="3 2"
              />

              {/* Active Concentric Note Progression Arcs */}
              {orbits.map((r, i) => {
                const reg = i + 1;
                const isPrimary = selectedRegister === reg;

                const strokeColor = isPrimary
                  ? '#38bdf8'
                  : selectedRegister === null
                  ? 'rgba(56, 189, 248, 0.5)'
                  : 'rgba(51, 65, 85, 0.2)';

                const strokeWidth = isPrimary ? 3.5 : selectedRegister === null ? 2 : 1.2;

                return (
                  <g
                    key={reg}
                    className="cursor-pointer transition-all duration-150"
                    onClick={() => setSelectedRegister(selectedRegister === reg ? null : reg)}
                  >
                    {/* The 330-degree circular arc centered on Do */}
                    <path
                      d={getRegisterArcPath(r)}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />

                    {/* Step-in transition to next inner ring at boundary */}
                    {i < orbits.length - 1 && (
                      <path
                        d={getTransitionArc(r, orbits[i + 1])}
                        fill="none"
                        stroke={isPrimary ? '#f43f5e' : 'rgba(244, 63, 94, 0.4)'}
                        strokeWidth={isPrimary ? 2.5 : 1.2}
                        strokeDasharray={isPrimary ? undefined : '2 2'}
                      />
                    )}

                    {/* Do node at 12 o'clock on each active orbit */}
                    {(isPrimary || selectedRegister === null) && (
                      <circle
                        cx={cx}
                        cy={cy - r}
                        r={isPrimary ? 4.5 : 2.5}
                        fill="#E13610"
                        stroke="#ffffff"
                        strokeWidth={1}
                      />
                    )}
                  </g>
                );
              })}

              {/* Highlight Nodes for Selected Register */}
              {selectedRegister && (
                (() => {
                  const r = orbits[selectedRegister - 1];
                  const soX = cx + Math.cos((120 * Math.PI) / 180) * r;
                  const soY = cy + Math.sin((120 * Math.PI) / 180) * r;
                  const fiX = cx + Math.cos((90 * Math.PI) / 180) * r;
                  const fiY = cy + Math.sin((90 * Math.PI) / 180) * r;

                  return (
                    <g className="pointer-events-none animate-in fade-in duration-100">
                      {/* So (-5) node at 7 o'clock start */}
                      <circle cx={soX} cy={soY} r={5} fill="#0032A4" stroke="#ffffff" strokeWidth="1.5" />

                      {/* Do (0) node at 12 o'clock Zenith */}
                      <circle cx={cx} cy={cy - r} r={6} fill="#E13610" stroke="#ffffff" strokeWidth="2" />

                      {/* Fi (+6) node at 6 o'clock Nadir */}
                      <circle cx={fiX} cy={fiY} r={5} fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
                    </g>
                  );
                })()
              )}
            </svg>
          </div>
        </div>

        {/* Conceptual Breakdown Cards */}
        <div className="md:col-span-6 space-y-2.5 text-xs">
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
            <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Concentric Arc Trajectory</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              Each octave forms a clean circular arc spanning 330&deg; from <strong>So (-5)</strong> at 7 o&apos;clock around clockwise past <strong>Do (0)</strong> to <strong>Fi (+6)</strong> at 6 o&apos;clock.
            </p>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
            <div className="font-semibold text-rose-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Stepping Across the Seam</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              The gap between 6 o&apos;clock and 7 o&apos;clock is the octave step seam. Crossing from <strong>Fi</strong> to <strong>So</strong> steps smoothly inward to the next concentric register.
            </p>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
            <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Harmonic Proximity</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              Because registers are centered on <strong>Do</strong>, common chord voicings (like triads and 7ths) remain on the same orbit or minimal radial distance without awkward register jumps.
            </p>
          </div>
        </div>
      </div>

      {/* Register Selector Ribbon - Stable Fixed Height (h-9) with Clear Non-Overlapping Labels */}
      <div className="w-full h-9 flex items-center justify-between px-3 rounded bg-slate-900/90 border border-slate-800/80 text-[11px] font-mono text-slate-300 overflow-hidden">
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[10px] mr-1 hidden sm:inline">Inspect:</span>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((reg) => (
            <button
              key={reg}
              onClick={() => setSelectedRegister(selectedRegister === reg ? null : reg)}
              className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold transition ${
                selectedRegister === reg
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              R{reg}
            </button>
          ))}
        </div>

        <div className="text-[10.5px] text-cyan-300 truncate">
          {selectedRegister ? (
            <span className="flex items-center gap-1.5">
              <span className="text-slate-400">R{selectedRegister} Span:</span>
              <span className="text-blue-400 font-bold">So (-5)</span>
              <span className="text-slate-500">&rarr;</span>
              <span className="text-red-400 font-bold">Do (0)</span>
              <span className="text-slate-500">&rarr;</span>
              <span className="text-slate-200 font-bold">Fi (+6)</span>
            </span>
          ) : (
            <span className="text-slate-400">Showing all 8 concentric registers</span>
          )}
        </div>
      </div>
    </div>
  );
};
