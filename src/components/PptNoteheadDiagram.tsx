import React, { useState } from 'react';
import { PPT_NOTEHEAD_SPECS, PptNoteheadShape } from '../core/ppt-constants';

interface NoteheadVectorProps {
  shape: PptNoteheadShape;
  colorHex: string;
  size?: number;
  isBlackKey?: boolean;
  className?: string;
}

export const NoteheadVector: React.FC<NoteheadVectorProps> = ({
  shape,
  colorHex,
  size = 36,
  isBlackKey = false,
  className = '',
}) => {
  const isFi = colorHex.toLowerCase() === '#141414';
  const fillColor = isFi ? '#141414' : colorHex;
  const outlineColor = isBlackKey ? '#090d16' : (isFi ? '#ffffff' : '#ffffff');
  const outlineWidth = isBlackKey ? 2.5 : 2.0;

  const renderShape = () => {
    switch (shape) {
      case 'circle':
        return (
          <circle
            cx="0"
            cy="0"
            r="15"
            fill={fillColor}
            stroke={outlineColor}
            strokeWidth={outlineWidth}
          />
        );
      case 'diamond':
        return (
          <polygon
            points="-18,0 0,-15 18,0 0,15"
            fill={fillColor}
            stroke={outlineColor}
            strokeWidth={outlineWidth}
          />
        );
      case 'square':
        return (
          <rect
            x="-13.5"
            y="-12"
            width="27"
            height="24"
            rx="1.5"
            fill={fillColor}
            stroke={outlineColor}
            strokeWidth={outlineWidth}
          />
        );
      case 'triangle-down':
        return (
          <polygon
            points="-17.6,-13.6 17.6,-13.6 0,16.8"
            fill={fillColor}
            stroke={outlineColor}
            strokeWidth={outlineWidth}
          />
        );
      case 'triangle-up':
        return (
          <polygon
            points="-17.6,13.6 17.6,13.6 0,-16.8"
            fill={fillColor}
            stroke={outlineColor}
            strokeWidth={outlineWidth}
          />
        );
      case 'semicircle-left':
        return (
          <path
            d="M 12.8 -15.2 L 12.8 15.2 C -1.3 15.2 -12.8 8.4 -12.8 0 C -12.8 -8.4 -1.3 -15.2 12.8 -15.2 Z"
            fill={fillColor}
            stroke={outlineColor}
            strokeWidth={outlineWidth}
          />
        );
      case 'semicircle-right':
        return (
          <path
            d="M -12.8 15.2 L -12.8 -15.2 C 1.3 -15.2 12.8 -8.4 12.8 0 C 12.8 8.4 1.3 15.2 -12.8 15.2 Z"
            fill={fillColor}
            stroke={outlineColor}
            strokeWidth={outlineWidth}
          />
        );
      case 'cross':
        return (
          <g>
            <circle
              cx="0"
              cy="0"
              r="15"
              fill={fillColor}
              stroke={outlineColor}
              strokeWidth={outlineWidth}
            />
            <line
              x1="-9"
              y1="-9"
              x2="9"
              y2="9"
              stroke="#f8fafc"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <line
              x1="9"
              y1="-9"
              x2="-9"
              y2="9"
              stroke="#f8fafc"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>
        );
    }
  };

  return (
    <svg
      viewBox="-24 -24 48 48"
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      style={{ overflow: 'visible' }}
    >
      {renderShape()}
      {isBlackKey && (
        <circle cx="0" cy="0" r="4.2" fill="#090d16" />
      )}
    </svg>
  );
};

export const PptNoteheadDiagram: React.FC = () => {
  const [selectedSemitone, setSelectedSemitone] = useState<number>(0);
  const [showBlackKeyStyle, setShowBlackKeyStyle] = useState<boolean>(false);

  const activeSpec = PPT_NOTEHEAD_SPECS[selectedSemitone];

  const PHILOSOPHY_DESCRIPTIONS: Record<number, { title: string; desc: string; role: string }> = {
    0: {
      title: 'Do (Tonic) • Complete Unity & Gravitational Rest',
      desc: 'The circle symbolises perfection, completeness, and gravitational equilibrium. As the home centre of the key, Do provides the tonal anchor from which all melodic motion originates and to which it inevitably returns.',
      role: 'Home Tonic / Harmonic Centre',
    },
    1: {
      title: 'Ra (Minor 2nd) • Acute Diagonal Tension',
      desc: 'The diamond introduces dynamic diagonal asymmetry. Angled at 45°, its vertices evoke acute tension pressing inward towards the stable tonic circle.',
      role: 'Phrygian Flatted Second / Neapolitan Tendency',
    },
    2: {
      title: 'Re (Major 2nd) • Stable Stepwise Step',
      desc: 'The square represents structural order and balanced horizontal stability. Re acts as a reliable passing tone and whole-step step forward in the scale.',
      role: 'Supertonic / Whole-Step Step',
    },
    3: {
      title: 'Me (Minor 3rd) • Inverted Downward Gravity',
      desc: 'The downward-pointing triangle conveys sadness, introspection, and downward gravitational pull characteristic of the minor third quality.',
      role: 'Minor Third / Melancholy Valence',
    },
    4: {
      title: 'Mi (Major 3rd) • Upward Brightness & Ascent',
      desc: 'The upward-pointing triangle conveys brightness, elevation, and affirmative harmonic energy. Its apex directs melodic momentum upward toward the fourth.',
      role: 'Major Third / Uplifting Valence',
    },
    5: {
      title: 'Fa (Perfect 4th) • Leftward Pull Back to Do',
      desc: 'The semicircle opening to the right with its curved bulb pointing leftward symbolises a nostalgic backward glance towards the tonic Do.',
      role: 'Subdominant / Leftward Balance',
    },
    6: {
      title: 'Fi (Tritone) • The Polar Symmetry Axis',
      desc: 'The four-point cross symbolises the great divide: exactly 6 semitones away from Do at the 6 o\'clock nadir, creating maximum harmonic tension across the polar diameter.',
      role: 'Tritone Nadir / Polar Contrast',
    },
    7: {
      title: 'So (Perfect 5th) • Rightward Dominant Momentum',
      desc: 'The semicircle opening to the left with its curved bulb pointing rightward symbolises forward dominant momentum, propelling the harmony towards cadential resolution.',
      role: 'Dominant / Forward Drive',
    },
    8: {
      title: 'Le (Minor 6th) • Downward Sighing Gravity',
      desc: 'Like the minor third, the downward-pointing triangle captures the sighing minor quality, pulling gravity down towards the dominant So.',
      role: 'Minor Sixth / Aeolian Sigh',
    },
    9: {
      title: 'La (Major 6th) • Upward Open Elevation',
      desc: 'The upward-pointing triangle captures the expansive, pastoral brightness of the major sixth, lifting the melodic contour upward towards the leading tone.',
      role: 'Major Sixth / Pastoral Ascent',
    },
    10: {
      title: 'Te (Minor 7th) • Subtonic Diagonal Tension',
      desc: 'The diamond silhouette echoes Ra in diagonal tension, standing a whole step below the octave and defining the bluesy, mixolydian character.',
      role: 'Subtonic / Mixolydian Flare',
    },
    11: {
      title: 'Ti (Major 7th) • Leading Tone Upward Urge',
      desc: 'The square silhouette provides strong geometric presence right below the tonic, delivering decisive semitone leading-tone aspiration towards Do.',
      role: 'Leading Tone / Urgent Resolution',
    },
  };

  const selectedInfo = PHILOSOPHY_DESCRIPTIONS[selectedSemitone];

  return (
    <div className="space-y-4">
      {/* Overview Cards: Core Philosophical Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 space-y-1">
          <span className="font-bold text-red-400 block">Form Follows Function</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            In standard notation, every notehead is an identical black oval. PPT assigns distinct geometric silhouettes and Solfège colours to each interval, instantly communicating harmonic meaning.
          </p>
        </div>
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 space-y-1">
          <span className="font-bold text-amber-400 block">Directional Valence</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Major intervals point upward (Mi, La &Delta; Up); minor intervals point downward (Me, Le &Delta; Down); 4ths and 5ths face left and right (Fa, So semicircles); Do rests as a balanced circle.
          </p>
        </div>
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 space-y-1">
          <span className="font-bold text-emerald-400 block">Keyboard Topography</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            White piano keys feature crisp white outlines; black piano keys feature bold black outlines with a solid black centre dot, revealing physical keyboard locations without deciphering accidentals.
          </p>
        </div>
      </div>

      {/* Interactive 12-Tone Chromatic Matrix */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              12-Tone Geometric Taxonomy
            </span>
            <span className="text-[11px] text-slate-400">
              Click any notehead to explore its harmonic philosophy and geometric rationale
            </span>
          </div>

          {/* Piano Key Visualiser Toggle */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setShowBlackKeyStyle(false)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                !showBlackKeyStyle
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              White Key Style
            </button>
            <button
              onClick={() => setShowBlackKeyStyle(true)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition flex items-center gap-1 ${
                showBlackKeyStyle
                  ? 'bg-purple-600/40 border border-purple-500/60 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-900 border border-slate-600" />
              Black Key Style
            </button>
          </div>
        </div>

        {/* 12 Notehead Buttons Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-1.5 sm:gap-2">
          {PPT_NOTEHEAD_SPECS.map((spec) => {
            const isSelected = selectedSemitone === spec.semitone;
            return (
              <button
                key={spec.semitone}
                onClick={() => setSelectedSemitone(spec.semitone)}
                className={`p-2 rounded-lg border transition flex flex-col items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-800/90 border-white shadow-[0_0_12px_rgba(255,255,255,0.2)] ring-1 ring-white/60 z-10'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="h-8 flex items-center justify-center">
                  <NoteheadVector
                    shape={spec.shape}
                    colorHex={spec.colorHex}
                    size={28}
                    isBlackKey={showBlackKeyStyle}
                  />
                </div>
                <div className="text-center leading-tight">
                  <span className="font-bold text-[11px] text-white block">
                    {spec.syllable}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 block">
                    {spec.semitone} st
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Detail Card for Selected Notehead */}
        {selectedInfo && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2">
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0 self-center sm:self-auto">
              <NoteheadVector
                shape={activeSpec.shape}
                colorHex={activeSpec.colorHex}
                size={42}
                isBlackKey={showBlackKeyStyle}
              />
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-white text-xs sm:text-sm">
                  {selectedInfo.title}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700/60">
                  {selectedInfo.role}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Shape: <strong className="text-slate-200 capitalize">{activeSpec.shape.replace('-', ' ')}</strong>
                </span>
              </div>
              <p className="text-[11.5px] text-slate-300 leading-relaxed">
                {selectedInfo.desc}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tactile Keyboard Mapping Explanation */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300 space-y-2">
        <h5 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Tactile Keyboard Recognition Without Accidental Deciphering
        </h5>
        <p className="text-[11.5px] text-slate-400 leading-relaxed">
          Standard musical notation forces performers to read a note on a line or space, check the clef, check the key signature at the start of the system, and check for inline accidentals before knowing whether to play a white or black piano key.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 flex items-center gap-3">
            <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
              <NoteheadVector shape="circle" colorHex="#E13610" size={26} isBlackKey={false} />
            </div>
            <div className="text-[11px]">
              <strong className="text-white block">White Piano Key</strong>
              <span className="text-slate-400">Pure white boundary outline (`#ffffff`).</span>
            </div>
          </div>
          <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 flex items-center gap-3">
            <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
              <NoteheadVector shape="circle" colorHex="#E13610" size={26} isBlackKey={true} />
            </div>
            <div className="text-[11px]">
              <strong className="text-white block">Black Piano Key</strong>
              <span className="text-slate-400">Black boundary outline with solid black centre dot (`#090d16`).</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
