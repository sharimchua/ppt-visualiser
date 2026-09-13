import {
  RhythmQuantisationMode,
  VisualiserConfig,
} from './types';

export type PrimeFamily = 'du' | 'tri' | 'qui' | 'sep' | 'dutri' | 'unknown';

export interface DetectedMetre {
  family: PrimeFamily;
  slots: number; // Number of subdivisions/slots around the cycle (e.g. 2, 4, 8, 3, 6, 9, 5, 7, 12)
  cyclePeriod: number; // Duration of one complete revolution in seconds
  cycleBeats: number; // Tactus beats per revolution (e.g. 4 for 4/4, 3 for 3/4)
  confidence: number; // 0..1 evidence accumulation progress
  anchor: number; // Timestamp of cycle start (12 o'clock zenith) in seconds
}

export interface MetreCandidateEvaluation {
  family: PrimeFamily;
  slots: number;
  cycleBeats: number;
  score: number;
  normalizedProbability: number; // 0..1 relative probability
  slotUtilization: number; // 0..1
  downbeatHits: number;
  dynamicContrast: number;
  cyclePeriod: number;
  bpm: number;
  polyrhythmResonance?: boolean; // Indicates polyrhythmic resonance with cross-stream anchor
}

export interface CrossStreamContext {
  anchorStreamId: number;
  anchorMetre: DetectedMetre;
  anchorCentroidMidi: number;
  anchorPeriod: number;
  anchorBeatPeriod: number;
  anchorTimestamp: number;
}

export interface StreamMetreState extends DetectedMetre {
  streamId: number;
  trackIndex: number;
  centroidMidi: number;
  isPulseActive: boolean;
  pulsePhase: number; // 0..1 current hand angle in cycle
  downbeatOccurred: boolean; // Cycle start transit
  candidateEvaluations?: MetreCandidateEvaluation[];
  strokes?: readonly RhythmStroke[];
  timeSinceLastActivity?: number;
  crossStreamAnchor?: {
    streamId: number;
    family: PrimeFamily;
    slots: number;
    ratio?: string;
  };
}

export interface RhythmOnsetRecord {
  id: string;
  midi: number;
  velocity: number;
  timestamp: number; // in seconds
  quantisedPosition: number; // 0..slots-0.001
  nearestPosition: number; // 0..slots-1
  trackIndex: number; // 0..7 (0 = outermost, 7 = innermost)
  streamId?: number;
}

export type TempoShiftType = 'duple' | 'arbitrary';

export interface TempoShiftEvent {
  oldBpm: number;
  newBpm: number;
  shiftType: TempoShiftType;
  timestamp: number;
}

export interface RhythmStroke {
  id: string;
  timestamp: number; // Earliest timestamp of notes in this stroke
  nearestPosition: number;
  quantisedPosition: number;
  notes: RhythmOnsetRecord[];
  registerCentroid?: number;
  streamId?: number;
}

export interface RhythmStream {
  id: number;
  centroidMidi: number;
  trackIndex: number;
  strokes: RhythmStroke[];
  lastActivityTime: number;
  detectedMetre: DetectedMetre;
  pendingMetre: DetectedMetre | null;
  pendingMetreStartTime: number;
  isPulseActive: boolean;
  lastHandPhase: number;
  idleDecayFactor: number;
  lastCandidateEvaluations?: MetreCandidateEvaluation[];
  compactedContext?: CompactedRhythmContext;
}

export interface CompactedRhythmContext {
  accumulatedCycles: number;
  totalEvictedStrokes: number;
  slotHistogram: number[];
  historicalDownbeatHits: number;
}

export interface RhythmAlignmentResult {
  currentBpm: number;
  bestBpm: number;
  shouldShift: boolean;
  shiftType?: TempoShiftType;
  newBpm?: number;
  tunerOffset: number; // -1..+1 (needle deflection: negative = slower, positive = faster)
  tunerConfidence: number; // 0..1 (evidence accumulation progress)
  isPulseActive: boolean;
  pulsePhase: number; // 0..1 (current position of scanning hand in beat cycle)
  downbeatOccurred: boolean;
  // Per-stream metres for polyrhythmic visualisation
  streams: StreamMetreState[];
  // Global convergence pulse when 2+ active streams align at 12 o'clock
  convergenceOccurred: boolean;
  convergenceStreamIds: number[];
}

/**
 * Classifies a slot count into its canonical Prime Period Theory (PPT) Prime Family:
 * - Du (Prime 2): Powers of 2 (2, 4, 8, 16, 32)
 * - Tri (Prime 3): Powers of 3 (3, 9, 27)
 * - DuTri (Compound 2x3): Divisions of 6, 12, 24
 * - Qui (Prime 5): Divisions of 5, 10, 25
 * - Sep (Prime 7): Divisions of 7, 14
 */
export function classifyMetre(slots: number): PrimeFamily {
  if (slots === 2 || slots === 4 || slots === 8 || slots === 16 || slots === 32) {
    return 'du';
  }
  if (slots === 3 || slots === 9 || slots === 27) {
    return 'tri';
  }
  if (slots === 6 || slots === 12 || slots === 24) {
    return 'dutri';
  }
  if (slots === 5 || slots === 10 || slots === 25) {
    return 'qui';
  }
  if (slots === 7 || slots === 14) {
    return 'sep';
  }
  return 'unknown';
}

/**
 * Fits a stream's window of strokes against candidate prime-family grids to discover
 * the optimal cycle period, slot count, and downbeat anchor.
 * Supports active metre retention inertia and cross-stream polyrhythmic resonance.
 */
export function fitStreamToGrid(
  strokes: RhythmStroke[],
  baseBpm: number = 120,
  activeMetre?: DetectedMetre | null,
  crossStreamContext?: CrossStreamContext | null
): {
  bestMetre: DetectedMetre;
  slotAssignments: number[];
  quantisedPositions: number[];
  fitness: number;
  candidateEvaluations: MetreCandidateEvaluation[];
} {
  const safeBpm = Math.max(40, Math.min(240, baseBpm));
  const defaultPeriod = (60 / safeBpm) * 4;
  const defaultMetre: DetectedMetre = {
    family: 'du',
    slots: 4,
    cyclePeriod: defaultPeriod,
    cycleBeats: 4,
    confidence: 0,
    anchor: strokes.length > 0 ? strokes[0].timestamp : 0,
  };

  const createDefaultEvaluations = (): MetreCandidateEvaluation[] => [
    { family: 'du', slots: 4, cycleBeats: 4, score: 1.28, normalizedProbability: 0.40, slotUtilization: 1.0, downbeatHits: 1, dynamicContrast: 1.0, cyclePeriod: defaultPeriod, bpm: safeBpm },
    { family: 'du', slots: 2, cycleBeats: 2, score: 1.22, normalizedProbability: 0.28, slotUtilization: 1.0, downbeatHits: 1, dynamicContrast: 1.0, cyclePeriod: defaultPeriod / 2, bpm: safeBpm },
    { family: 'tri', slots: 3, cycleBeats: 3, score: 1.06, normalizedProbability: 0.15, slotUtilization: 1.0, downbeatHits: 1, dynamicContrast: 1.0, cyclePeriod: (60 / safeBpm) * 3, bpm: safeBpm },
    { family: 'dutri', slots: 6, cycleBeats: 2, score: 1.12, normalizedProbability: 0.11, slotUtilization: 0.8, downbeatHits: 1, dynamicContrast: 1.0, cyclePeriod: defaultPeriod, bpm: safeBpm },
    { family: 'qui', slots: 5, cycleBeats: 5, score: 0.98, normalizedProbability: 0.04, slotUtilization: 0.7, downbeatHits: 1, dynamicContrast: 1.0, cyclePeriod: (60 / safeBpm) * 5, bpm: safeBpm },
    { family: 'sep', slots: 7, cycleBeats: 7, score: 0.92, normalizedProbability: 0.02, slotUtilization: 0.6, downbeatHits: 1, dynamicContrast: 1.0, cyclePeriod: (60 / safeBpm) * 7, bpm: safeBpm },
  ];

  if (strokes.length === 0) {
    return {
      bestMetre: defaultMetre,
      slotAssignments: [],
      quantisedPositions: [],
      fitness: 0,
      candidateEvaluations: createDefaultEvaluations(),
    };
  }

  if (strokes.length === 1) {
    return {
      bestMetre: {
        ...defaultMetre,
        anchor: strokes[0].timestamp,
        confidence: 0.5,
      },
      slotAssignments: [0],
      quantisedPositions: [0],
      fitness: 1.0,
      candidateEvaluations: createDefaultEvaluations(),
    };
  }

  const beatPeriod = 60 / safeBpm;
  const candidateBeats = new Set<number>();
  candidateBeats.add(beatPeriod);

  // Test anchor candidates:
  const anchorCandidates: number[] = [];

  // 1. Phase-Lock Anchor Continuity: Project stream's established downbeat anchor forward by full integer cycles
  let projectedActiveAnchor: number | null = null;
  if (
    activeMetre &&
    activeMetre.anchor > 0 &&
    activeMetre.cyclePeriod > 0 &&
    activeMetre.confidence >= 0.55 &&
    strokes.length > 3
  ) {
    const period = activeMetre.cyclePeriod;
    const cyclesAhead = Math.round((strokes[0].timestamp - activeMetre.anchor) / period);
    projectedActiveAnchor = activeMetre.anchor + cyclesAhead * period;
    anchorCandidates.push(projectedActiveAnchor);
  }

  // 2. Initial stroke of window is always primary candidate
  if (!anchorCandidates.includes(strokes[0].timestamp)) {
    anchorCandidates.push(strokes[0].timestamp);
  }

  // 3. Loudest stroke if distinctly accented over the initial stroke
  const firstVel = strokes[0].notes.reduce((acc, n) => acc + n.velocity, 0) / strokes[0].notes.length;
  let maxVel = firstVel;
  let maxVelTime = strokes[0].timestamp;
  for (let i = 1; i < strokes.length; i++) {
    const s = strokes[i];
    const v = s.notes.reduce((acc, n) => acc + n.velocity, 0) / s.notes.length;
    if (v > maxVel + 0.05) {
      maxVel = v;
      maxVelTime = s.timestamp;
    }
  }
  if (!anchorCandidates.includes(maxVelTime)) {
    anchorCandidates.push(maxVelTime);
  }

  // Cross-stream anchor and cycle period candidates
  if (crossStreamContext && crossStreamContext.anchorPeriod > 0) {
    const anchorCyclePeriod = crossStreamContext.anchorPeriod;
    const anchorBeatPeriod = crossStreamContext.anchorBeatPeriod;

    // Shared beat duration
    if (anchorBeatPeriod >= 0.18 && anchorBeatPeriod <= 2.5) {
      candidateBeats.add(anchorBeatPeriod);
    }

    // Polyrhythmic co-cycle beat candidates: T_cycle = T_anchorCyclePeriod
    // For 3:4 or 3:2, candidate beat = anchorCyclePeriod / 3
    if (anchorCyclePeriod / 3 >= 0.18 && anchorCyclePeriod / 3 <= 2.5) {
      candidateBeats.add(anchorCyclePeriod / 3);
    }
    // For 4:3, candidate beat = anchorCyclePeriod / 4
    if (anchorCyclePeriod / 4 >= 0.18 && anchorCyclePeriod / 4 <= 2.5) {
      candidateBeats.add(anchorCyclePeriod / 4);
    }
    // For 2-slot co-cycle, candidate beat = anchorCyclePeriod / 2
    if (anchorCyclePeriod / 2 >= 0.18 && anchorCyclePeriod / 2 <= 2.5) {
      candidateBeats.add(anchorCyclePeriod / 2);
    }

    // Include cross-stream downbeat anchor
    if (crossStreamContext.anchorTimestamp > 0) {
      anchorCandidates.push(crossStreamContext.anchorTimestamp);
    }
  }

  // Collect consecutive intervals
  const iois: number[] = [];
  for (let i = 1; i < strokes.length; i++) {
    const dt = strokes[i].timestamp - strokes[i - 1].timestamp;
    if (dt >= 0.05 && dt <= 4.0) {
      iois.push(dt);
    }
  }

  if (iois.length > 0) {
    const sorted = [...iois].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = iois.reduce((a, b) => a + b, 0) / iois.length;

    candidateBeats.add(median);
    candidateBeats.add(mean);
    if (median * 2 <= 2.5) candidateBeats.add(median * 2);
    if (median / 2 >= 0.18) candidateBeats.add(median / 2);
  }

  // Canonical prime-family metre configurations
  // Duple metres are calibrated as baseline default for unaccented isochronous notes
  const METRE_CONFIGS: Array<{
    family: PrimeFamily;
    slots: number;
    cycleBeats: number;
    prior: number;
  }> = [
    { family: 'du', slots: 4, cycleBeats: 4, prior: 1.25 },     // 4/4 common time
    { family: 'du', slots: 2, cycleBeats: 2, prior: 1.15 },     // 2/4 duple
    { family: 'du', slots: 8, cycleBeats: 4, prior: 1.12 },     // 4/4 with 8th notes
    { family: 'du', slots: 16, cycleBeats: 4, prior: 1.05 },    // 4/4 with 16th notes
    { family: 'tri', slots: 3, cycleBeats: 3, prior: 1.08 },    // 3/4 waltz / ternary
    { family: 'tri', slots: 6, cycleBeats: 3, prior: 1.06 },    // 3/4 with 8ths
    { family: 'tri', slots: 9, cycleBeats: 3, prior: 0.98 },    // 3/4 compound triplets
    { family: 'dutri', slots: 6, cycleBeats: 2, prior: 1.12 },  // 6/8 compound duple
    { family: 'dutri', slots: 12, cycleBeats: 4, prior: 1.06 }, // 12/8 compound quadruple
    { family: 'qui', slots: 5, cycleBeats: 5, prior: 0.98 },    // 5/4 quintuple
    { family: 'qui', slots: 10, cycleBeats: 5, prior: 0.92 },   // 5/8 quintuple
    { family: 'sep', slots: 7, cycleBeats: 7, prior: 0.92 },    // 7/4 septuple
    { family: 'sep', slots: 14, cycleBeats: 7, prior: 0.88 },   // 7/8 septuple
  ];

  let bestScore = -Infinity;
  let bestMetre = defaultMetre;
  let bestSlots = 4;
  let bestAnchor = strokes[0].timestamp;
  let bestCyclePeriod = defaultPeriod;

  const candidateMap = new Map<string, MetreCandidateEvaluation>();

  for (const b of candidateBeats) {
    if (b < 0.18 || b > 2.5) continue;

    for (const cfg of METRE_CONFIGS) {
      const cyclePeriod = b * cfg.cycleBeats;
      if (cyclePeriod < 0.5 || cyclePeriod > 10.0) continue;

      for (const anchor of anchorCandidates) {
        let fitSum = 0;
        let downbeatHits = 0;
        let downbeatVelSum = 0;
        let downbeatCount = 0;
        let offbeatVelSum = 0;
        let offbeatCount = 0;
        let maxDownbeatVel = 0;
        let maxOffbeatVel = 0;

        for (const stroke of strokes) {
          const t = stroke.timestamp;
          const rawPhase = (((t - anchor) / cyclePeriod) % 1.0 + 1.0) % 1.0;
          const idealSlot = Math.round(rawPhase * cfg.slots) % cfg.slots;
          const slotPhase = idealSlot / cfg.slots;
          let diff = Math.abs(rawPhase - slotPhase);
          if (diff > 0.5) diff = 1.0 - diff;
          const slotError = diff * cfg.slots; // 0..0.5 slots

          // Gaussian fit with motor timing tolerance
          const fit = Math.exp(-Math.pow(slotError / 0.18, 2));
          const avgVel = stroke.notes.reduce((sum, n) => sum + n.velocity, 0) / stroke.notes.length;
          fitSum += fit * (0.6 + 0.4 * avgVel);

          if (idealSlot === 0) {
            downbeatHits++;
            downbeatVelSum += avgVel;
            downbeatCount++;
            if (avgVel > maxDownbeatVel) maxDownbeatVel = avgVel;
          } else {
            offbeatVelSum += avgVel;
            offbeatCount++;
            if (avgVel > maxOffbeatVel) maxOffbeatVel = avgVel;
          }
        }

        // Structural downbeat reinforcement
        let score = (fitSum / strokes.length) * cfg.prior;
        if (downbeatHits > 0) {
          score *= 1.0 + Math.min(0.25, (downbeatHits / strokes.length) * 0.25);
        }

        // Metric dynamic accent contrast: reward downbeats that are accented relative to offbeats.
        // Downbeat must be prominent: if an offbeat is as loud as the downbeat, it is an offbeat
        // syncopation rather than an intentional metric downbeat accent.
        let contrast = 1.0;
        if (downbeatCount > 0 && offbeatCount > 0 && maxDownbeatVel > maxOffbeatVel * 1.05) {
          const meanDownbeat = downbeatVelSum / downbeatCount;
          const meanOffbeat = offbeatVelSum / offbeatCount;
          if (meanDownbeat > meanOffbeat) {
            contrast = meanDownbeat / meanOffbeat;
            score *= 1.0 + Math.min(0.40, (contrast - 1.0) * 0.6);
          }
        }

        // Harmonic / Pitch Cycle Periodicity:
        // When strokes repeating in the same slot across consecutive cycles share the same pitch class
        // Harmonic / Pitch Cycle Periodicity:
        // When strokes repeating in the same slot across consecutive cycles share the same pitch class
        // (e.g. arpeggiated chords or repeating riffs), reward the candidate whose slot count
        // matches the melodic periodicity (+25% bonus).
        if (strokes.length >= cfg.slots + 1) {
          const slotPitchClasses = new Map<number, number[]>();
          const uniquePitchClasses = new Set<number>();
          for (let i = 0; i < strokes.length; i++) {
            const stroke = strokes[i];
            const t = stroke.timestamp;
            const rawPhase = (((t - anchor) / cyclePeriod) % 1.0 + 1.0) % 1.0;
            const slot = Math.round(rawPhase * cfg.slots) % cfg.slots;
            const pitch = stroke.registerCentroid ?? (stroke.notes[0] ? stroke.notes[0].midi : 60);
            const pc = ((Math.round(pitch) % 12) + 12) % 12;
            uniquePitchClasses.add(pc);
            let list = slotPitchClasses.get(slot);
            if (!list) {
              list = [];
              slotPitchClasses.set(slot, list);
            }
            list.push(pc);
          }

          // Pitch cycle periodicity only applies when strokes contain varying melodic/harmonic pitch classes (>= 2)
          if (uniquePitchClasses.size >= 2) {
            let matchedSlots = 0;
            let evaluatedSlots = 0;
            for (const pcs of slotPitchClasses.values()) {
              if (pcs.length >= 2) {
                evaluatedSlots++;
                const firstPc = pcs[0];
                if (pcs.every((pc) => pc === firstPc)) {
                  matchedSlots++;
                }
              }
            }

            const minEvaluated = cfg.slots <= 3 ? 2 : 1;
            if (evaluatedSlots >= minEvaluated && matchedSlots === evaluatedSlots) {
              score *= 1.25;
            }
          }
        }

        // Slot coverage efficiency: penalise empty unplayed slots to prefer simpler prime families (Occam's razor)
        const slotUtilization = Math.min(1.0, strokes.length / cfg.slots);
        score *= Math.pow(slotUtilization, 0.35);

        // Retention Inertia: +15% bonus if matching stream's currently active metre with established history
        if (
          activeMetre &&
          strokes.length >= 8 &&
          activeMetre.confidence >= 0.75 &&
          activeMetre.family === cfg.family &&
          activeMetre.slots === cfg.slots
        ) {
          score *= 1.15;
        }

        // Phase-Lock Anchor Continuity: +20% bonus if candidate anchor preserves established downbeat grid phase
        if (
          activeMetre &&
          activeMetre.anchor > 0 &&
          activeMetre.cyclePeriod > 0 &&
          strokes.length > 4 &&
          activeMetre.confidence >= 0.55
        ) {
          const rawPhaseDiff = Math.abs(
            (((anchor - activeMetre.anchor) / cyclePeriod) % 1.0 + 1.0) % 1.0
          );
          const isPhaseAligned = rawPhaseDiff < 0.06 || rawPhaseDiff > 0.94;
          if (isPhaseAligned) {
            score *= 1.20;
          }
        }

        // Cross-Stream Polyrhythmic Resonance:
        // When anchor stream is Du (e.g. 4/4 or 2/4) and this candidate is Tri (3 or 6 slots)
        // or vice-versa, reward candidates that resonate with the anchor cycle period or downbeat!
        let hasPolyrhythmResonance = false;
        if (crossStreamContext && crossStreamContext.anchorPeriod > 0) {
          const cycleRatio = cyclePeriod / crossStreamContext.anchorPeriod;
          const isCoCycle = Math.abs(cycleRatio - 1.0) <= 0.08;
          const isPolyrhythmicRatio =
            Math.abs(cycleRatio - 0.75) <= 0.06 ||
            Math.abs(cycleRatio - 1.333) <= 0.08;

          if (
            (crossStreamContext.anchorMetre.family === 'du' && (cfg.family === 'tri' || cfg.family === 'dutri')) ||
            (crossStreamContext.anchorMetre.family === 'tri' && cfg.family === 'du')
          ) {
            if (isCoCycle) {
              score *= 1.35;
              hasPolyrhythmResonance = true;
            } else if (isPolyrhythmicRatio) {
              score *= 1.20;
              hasPolyrhythmResonance = true;
            }
          }
        }

        // Record best evaluation for this configuration
        const key = `${cfg.family}-${cfg.slots}-${cfg.cycleBeats}`;
        const existing = candidateMap.get(key);
        if (!existing || score > existing.score) {
          candidateMap.set(key, {
            family: cfg.family,
            slots: cfg.slots,
            cycleBeats: cfg.cycleBeats,
            score,
            normalizedProbability: 0,
            slotUtilization,
            downbeatHits,
            dynamicContrast: contrast,
            cyclePeriod,
            bpm: Math.round(60 / (cyclePeriod / cfg.cycleBeats)),
            polyrhythmResonance: hasPolyrhythmResonance,
          });
        }

        if (score > bestScore + 1e-5) {
          bestScore = score;
          bestSlots = cfg.slots;
          bestCyclePeriod = cyclePeriod;
          bestAnchor = anchor;
          bestMetre = {
            family: cfg.family,
            slots: cfg.slots,
            cyclePeriod,
            cycleBeats: cfg.cycleBeats,
            confidence: Math.min(1.0, (score / 1.3) * Math.min(1.0, strokes.length / 4)),
            anchor,
          };
        }
      }
    }
  }

  // Calculate slot assignments for all strokes
  const slotAssignments: number[] = [];
  const quantisedPositions: number[] = [];

  for (const stroke of strokes) {
    const rawPhase = (((stroke.timestamp - bestAnchor) / bestCyclePeriod) % 1.0 + 1.0) % 1.0;
    const slot = Math.round(rawPhase * bestSlots) % bestSlots;
    slotAssignments.push(slot);
    quantisedPositions.push(rawPhase * bestSlots);
  }

  // Normalise candidate probabilities with contrast scaling and sort descending
  const candidateEvaluations = Array.from(candidateMap.values());
  const weights = candidateEvaluations.map((c) => Math.pow(Math.max(0, c.score), 3.0));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < candidateEvaluations.length; i++) {
    candidateEvaluations[i].normalizedProbability = weightSum > 0
      ? weights[i] / weightSum
      : 1 / Math.max(1, candidateEvaluations.length);
  }
  candidateEvaluations.sort((a, b) => b.score - a.score);

  return {
    bestMetre,
    slotAssignments,
    quantisedPositions,
    fitness: bestScore,
    candidateEvaluations,
  };
}

/**
 * Simplicity weights for 12-position rhythmic circle:
 * - Position 0 (Do): Downbeat (cardinal weight 1.50)
 * - Position 6 (Fi): 8th note offbeat (halfway, weight 1.40)
 * - Positions 3 (Me) & 9 (La): 16th note subdivisions (weight 1.35)
 * - Positions 4 (Mi) & 8 (Le): Triplet subdivisions (weight 1.35)
 * - Positions 2 (Re) & 10 (Te): Sextuplet / 16th triplet subdivisions (weight 1.15)
 * - Positions 1 (Ra), 5 (Fa), 7 (So), 11 (Ti): Crush notes / syncopations (weight 0.80)
 */
export const RHYTHM_POSITION_WEIGHTS = [
  1.50, // 0: Do (Downbeat - primary pulse anchor)
  0.80, // 1: Ra (Grace / downbeat push)
  1.15, // 2: Re (Sextuplet 1)
  1.35, // 3: Me (16th note subdivision 1)
  1.35, // 4: Mi (Triplet subdivision 1)
  0.80, // 5: Fa (Offbeat lead-in)
  1.40, // 6: Fi (Halfway 8th note offbeat)
  0.80, // 7: So (Offbeat push)
  1.35, // 8: Le (Triplet subdivision 2)
  1.35, // 9: La (16th note subdivision 3)
  1.15, // 10: Te (Sextuplet 5)
  0.80, // 11: Ti (Downbeat anticipation / crush)
];

/**
 * Folds a raw BPM into the canonical 60-120 BPM tactus range via octave doubling/halving.
 */
export function foldBpmToTactusRange(rawBpm: number, minBpm = 60, maxBpm = 120): number {
  let bpm = Math.round(rawBpm);
  if (bpm <= 0) return 90;
  while (bpm < minBpm - 3 && bpm * 2 <= maxBpm + 40) {
    bpm *= 2;
  }
  while (bpm > maxBpm + 3 && Math.round(bpm / 2) >= minBpm - 20) {
    bpm = Math.round(bpm / 2);
  }
  return Math.max(40, Math.min(240, bpm));
}

/**
 * Canonical musical interval steps expressed as 12-spoke clock distances.
 * Used by relative interval quantisation to snap elapsed time between strokes
 * to the nearest musically meaningful subdivision of the beat.
 */
export const MUSICAL_INTERVAL_STEPS = [
  2,  // 1/6 beat: Sextuplet
  3,  // 1/4 beat: 16th note
  4,  // 1/3 beat: Triplet 8th
  6,  // 1/2 beat: 8th note
  8,  // 2/3 beat: Two triplet 8ths
  9,  // 3/4 beat: Dotted 8th
  12, // 1 beat: Quarter note
  18, // 1.5 beats: Dotted quarter
  24, // 2 beats: Half note
];

/**
 * Quantises a raw inter-stroke interval (seconds) to the nearest musical
 * subdivision step around the 12-position clock, given the current beat period.
 * Returns the quantised step in spokes and the residual error in spokes.
 */
export function quantiseIntervalToMusicalStep(
  dt: number,
  beatPeriod: number
): { step: number; spokeDiff: number; errorSpokes: number } {
  const rawSpokes = (dt / beatPeriod) * 12;
  let bestStep = 12;
  let minDiff = Infinity;

  for (const step of MUSICAL_INTERVAL_STEPS) {
    const diff = Math.abs(rawSpokes - step);
    if (diff < minDiff) {
      minDiff = diff;
      bestStep = step;
    }
  }

  // Also test integer-beat multiples (2, 3, 4â€¦ beats) for long intervals
  const roundBeats = Math.round(dt / beatPeriod);
  if (roundBeats >= 1) {
    const fullBeatSpokes = roundBeats * 12;
    const diff = Math.abs(rawSpokes - fullBeatSpokes);
    if (diff < minDiff) {
      minDiff = diff;
      bestStep = fullBeatSpokes;
    }
  }

  return {
    step: bestStep,
    spokeDiff: bestStep % 12,
    errorSpokes: minDiff,
  };
}

/**
 * Evaluates whether a tempo ratio represents a duple modulation (powers of 2: 2x, 0.5x, 4x, 0.25x).
 */
export function isDupleRatio(ratio: number, tolerance: number = 0.07): boolean {
  const dupleTargets = [0.25, 0.5, 2.0, 4.0];
  for (const target of dupleTargets) {
    if (Math.abs(ratio - target) / target <= tolerance) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves the nearest 12-position spoke with tempo-aware tolerance.
 * At faster tempos, human micro-timing jitter (35-45ms) represents a larger fraction of a beat,
 * so the capture radius around cardinal spokes (Do, Fi, Me, La, Mi, Le) scales proportionally,
 * preventing slight timing offsets from being mistakenly inferred as accidental neighbors (Ra, Ti, Fa, So).
 */
export function resolveTempoAwareNearestSpoke(rawPosition: number, bpm: number = 90): number {
  const period = 60 / Math.max(40, Math.min(240, bpm));
  // Scaled capture radius based on 40ms human motor timing window
  const captureRadius = Math.max(0.55, Math.min(1.15, (0.040 / period) * 12));

  // 1. Check primary downbeat: Position 0 (Do)
  let distDo = Math.abs(rawPosition - 0);
  if (distDo > 6) distDo = 12 - distDo;
  if (distDo <= captureRadius) {
    return 0;
  }

  // 2. Check 8th-note offbeat: Position 6 (Fi)
  let distFi = Math.abs(rawPosition - 6);
  if (distFi > 6) distFi = 12 - distFi;
  if (distFi <= captureRadius) {
    return 6;
  }

  // 3. Check 16th and triplet subdivisions: Me (3), La (9), Mi (4), Le (8)
  for (const spoke of [3, 9, 4, 8]) {
    let d = Math.abs(rawPosition - spoke);
    if (d > 6) d = 12 - d;
    if (d <= captureRadius * 0.85) {
      return spoke;
    }
  }

  // 4. Check sextuplet subdivisions: Re (2), Te (10)
  for (const spoke of [2, 10]) {
    let d = Math.abs(rawPosition - spoke);
    if (d > 6) d = 12 - d;
    if (d <= captureRadius * 0.75) {
      return spoke;
    }
  }

  // 5. Fall back to standard nearest spoke
  return Math.round(rawPosition) % 12;
}

/**
 * Maps a continuous rhythm phase [0..1) to a 12-position clock position [0..12) with quantisation.
 */
export function quantiseRhythmPhase(
  phase: number,
  mode: RhythmQuantisationMode = 'subtle',
  bpm: number = 90
): { quantisedPosition: number; nearestPosition: number } {
  // Normalise phase to [0..1)
  const normPhase = ((phase % 1.0) + 1.0) % 1.0;
  const rawPosition = normPhase * 12;
  const nearestPosition = resolveTempoAwareNearestSpoke(rawPosition, bpm);

  if (mode === 'strict') {
    return {
      quantisedPosition: nearestPosition,
      nearestPosition,
    };
  }

  if (mode === 'none') {
    return {
      quantisedPosition: rawPosition,
      nearestPosition,
    };
  }

  // 'subtle' mode: blend 65% towards nearest integer grid position
  let diff = nearestPosition - rawPosition;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  const blended = (rawPosition + diff * 0.65 + 12) % 12;

  return {
    quantisedPosition: blended,
    nearestPosition,
  };
}

export class RhythmEngine {
  private onsets: RhythmOnsetRecord[] = [];
  private strokes: RhythmStroke[] = [];
  private streams: RhythmStream[] = [];
  private nextStreamId: number = 0;
  private currentBpm: number = 120;
  private downbeatPhaseAnchor: number = 0; // Timestamp of downbeat anchor in seconds
  private lastUpdateTime: number = 0;
  private lastNoteTime: number = 0;

  // Chord stroke clustering window (65ms accommodates natural rolled chords)
  private static readonly CHORD_WINDOW_SEC = 0.065;

  // Stream segregation parameters
  private static readonly STREAM_CAPTURE_RADIUS = 14; // 14 semitones
  private static readonly STREAM_CENTROID_ALPHA = 0.3;
  private static readonly MAX_STREAMS = 8;

  // Hysteresis & Evidence Accumulator
  private pendingCandidateBpm: number | null = null;
  private pendingCandidateStartTime: number = 0;
  private pendingCandidateShiftType: TempoShiftType = 'arbitrary';
  private pendingCandidateAnchor: number = 0;

  // Pulse & Scanning State
  private lastHandPhase: number = 0;
  private isPulseActive: boolean = false;
  private idleDecayFactor: number = 1.0;

  constructor(initialBpm: number = 120) {
    this.currentBpm = Math.max(40, Math.min(240, initialBpm));
  }

  public reset(): void {
    this.onsets = [];
    this.strokes = [];
    this.streams = [];
    this.nextStreamId = 0;
    this.lastUpdateTime = 0;
    this.lastNoteTime = 0;
    this.pendingCandidateBpm = null;
    this.pendingCandidateStartTime = 0;
    this.lastHandPhase = 0;
    this.isPulseActive = false;
    this.idleDecayFactor = 1.0;
  }

  public getCurrentBpm(): number {
    return this.currentBpm;
  }

  public setManualBpm(bpm: number, config?: VisualiserConfig): void {
    this.currentBpm = Math.max(40, Math.min(240, Math.round(bpm)));
    this.pendingCandidateBpm = null;
    this.pendingCandidateStartTime = 0;
    if (config) {
      this.recomputeStrokePositions();
    }
  }

  public getOnsets(): readonly RhythmOnsetRecord[] {
    return this.onsets;
  }

  public getStrokes(): readonly RhythmStroke[] {
    return this.strokes;
  }

  public getStreams(): readonly RhythmStream[] {
    return this.streams;
  }

  public getCandidateMetresForStream(streamId: number): readonly MetreCandidateEvaluation[] {
    const stream = this.streams.find((s) => s.id === streamId);
    if (!stream) return [];
    if (!stream.lastCandidateEvaluations && stream.strokes.length > 0) {
      const crossContext = this.getCrossStreamContext(stream.id);
      const fit = fitStreamToGrid(stream.strokes, this.currentBpm, stream.detectedMetre, crossContext);
      stream.lastCandidateEvaluations = fit.candidateEvaluations;
    }
    return stream.lastCandidateEvaluations ?? [];
  }

  /**
   * Resolves the primary cross-stream metric reference context for a given stream ID.
   * Finds the active companion stream with highest confidence (>= 0.45) and at least 3 strokes.
   */
  public getCrossStreamContext(targetStreamId: number): CrossStreamContext | null {
    let bestCompanion: RhythmStream | null = null;
    let highestConfidence = -1;

    for (const s of this.streams) {
      if (s.id === targetStreamId) continue;
      if (s.strokes.length >= 3 && s.detectedMetre.confidence > highestConfidence) {
        highestConfidence = s.detectedMetre.confidence;
        bestCompanion = s;
      }
    }

    if (!bestCompanion || highestConfidence < 0.45) {
      return null;
    }

    const anchorMetre = bestCompanion.detectedMetre;
    const anchorBeatPeriod = anchorMetre.cyclePeriod / Math.max(1, anchorMetre.cycleBeats);

    return {
      anchorStreamId: bestCompanion.id,
      anchorMetre,
      anchorCentroidMidi: bestCompanion.centroidMidi,
      anchorPeriod: anchorMetre.cyclePeriod,
      anchorBeatPeriod,
      anchorTimestamp: anchorMetre.anchor,
    };
  }

  /**
   * Returns a sorted array of distinct stroke timestamps from the stroke buffer.
   */
  public getDistinctOnsetTimes(): number[] {
    return this.strokes.map((s) => s.timestamp);
  }

  /**
   * Recalculates spoke positions of all strokes and their notes using window grid fitting.
   */
  private recomputeStrokePositions(): void {
    if (this.strokes.length === 0) return;

    for (const stream of this.streams) {
      if (stream.strokes.length === 0) continue;
      const crossContext = this.getCrossStreamContext(stream.id);
      const fit = fitStreamToGrid(
        stream.strokes,
        this.currentBpm,
        stream.detectedMetre,
        crossContext
      );
      stream.detectedMetre = fit.bestMetre;
      stream.lastCandidateEvaluations = fit.candidateEvaluations;
      for (let i = 0; i < stream.strokes.length; i++) {
        const stroke = stream.strokes[i];
        stroke.nearestPosition = fit.slotAssignments[i];
        stroke.quantisedPosition = fit.quantisedPositions[i];
        for (const note of stroke.notes) {
          note.nearestPosition = stroke.nearestPosition;
          note.quantisedPosition = stroke.quantisedPosition;
        }
      }
    }

    // Re-anchor downbeat phase to keep clock hand synchronised
    if (this.strokes.length > 0) {
      const lastStroke = this.strokes[this.strokes.length - 1];
      const stream = this.streams.find((s) => s.id === lastStroke.streamId) ?? this.streams[0];
      if (stream && stream.detectedMetre.slots > 0) {
        const cycleFraction = lastStroke.nearestPosition / stream.detectedMetre.slots;
        this.downbeatPhaseAnchor = lastStroke.timestamp - cycleFraction * stream.detectedMetre.cyclePeriod;
      } else {
        const updatedPeriod = 60 / this.currentBpm;
        this.downbeatPhaseAnchor = lastStroke.timestamp - (lastStroke.nearestPosition / 12) * updatedPeriod;
      }
    }
  }

  /**
   * Ingests a new note onset into the rhythm buffer.
   * Clusters chord notes within 65ms into a single stroke.
   * Assigns distinct strokes to auditory streams via register-proximity centroids.
   * Fits streams against prime-family grids to determine cycle metre.
   */
  public recordOnset(
    midi: number,
    velocity: number,
    nowSec: number,
    config: VisualiserConfig
  ): RhythmOnsetRecord {
    const autoTempo = config.rhythmAutoTempoEnabled ?? true;

    this.lastNoteTime = nowSec;
    this.idleDecayFactor = 1.0;

    // Prune stale strokes/notes older than window limit
    this.pruneAndAssignTracks(nowSec, config);

    const strokeMidi = midi;

    // 1. Auditory Stream Segregation: Match note to stream by register centroid
    let matchedStream: RhythmStream | null = null;
    let minDistance = Infinity;

    for (const s of this.streams) {
      if (nowSec - s.lastActivityTime <= 8.0) {
        const dist = Math.abs(s.centroidMidi - strokeMidi);
        if (dist <= RhythmEngine.STREAM_CAPTURE_RADIUS && dist < minDistance) {
          minDistance = dist;
          matchedStream = s;
        }
      }
    }

    // 2. Check for chord clustering WITHIN the matched stream
    const lastStreamStroke =
      matchedStream && matchedStream.strokes.length > 0
        ? matchedStream.strokes[matchedStream.strokes.length - 1]
        : null;
    const isChordNote =
      lastStreamStroke !== null &&
      nowSec >= lastStreamStroke.timestamp &&
      nowSec - lastStreamStroke.timestamp <= RhythmEngine.CHORD_WINDOW_SEC;

    // ─── Chord note within same register stream: cluster into existing stroke ───
    if (isChordNote && lastStreamStroke && matchedStream) {
      const record: RhythmOnsetRecord = {
        id: `${midi}-${nowSec}-${Math.random()}`,
        midi,
        velocity,
        timestamp: nowSec,
        quantisedPosition: lastStreamStroke.quantisedPosition,
        nearestPosition: lastStreamStroke.nearestPosition,
        trackIndex: matchedStream.trackIndex,
        streamId: matchedStream.id,
      };
      lastStreamStroke.notes.push(record);
      // Update stroke centroid
      const sumMidi = lastStreamStroke.notes.reduce((s, n) => s + n.midi, 0);
      lastStreamStroke.registerCentroid = sumMidi / lastStreamStroke.notes.length;
      matchedStream.centroidMidi =
        matchedStream.centroidMidi * (1 - RhythmEngine.STREAM_CENTROID_ALPHA) +
        strokeMidi * RhythmEngine.STREAM_CENTROID_ALPHA;
      this.onsets.push(record);
      this.pruneAndAssignTracks(nowSec, config);
      return record;
    }

    // ─── Distinct rhythmic stroke ───
    const lastStroke = this.strokes.length > 0 ? this.strokes[this.strokes.length - 1] : null;

    // 3. Initial tempo establishment on first and second strokes
    if (this.strokes.length === 0) {
      this.downbeatPhaseAnchor = nowSec;
      this.isPulseActive = !autoTempo;
      this.lastHandPhase = 0;
    } else if (!this.isPulseActive && lastStroke) {
      const dt = nowSec - lastStroke.timestamp;
      if (dt >= 0.18 && dt <= 2.5) {
        const rawBpm = 60 / dt;
        const detectedBpm = autoTempo
          ? foldBpmToTactusRange(rawBpm)
          : Math.max(40, Math.min(240, Math.round(rawBpm)));
        if (autoTempo) {
          this.currentBpm = detectedBpm;
        }
        this.downbeatPhaseAnchor = lastStroke.timestamp;
        this.isPulseActive = true;
        this.lastHandPhase = 0;
      } else {
        this.downbeatPhaseAnchor = nowSec;
      }
    }

    if (matchedStream) {
      // Smoothly update stream centroid via EMA
      matchedStream.centroidMidi =
        matchedStream.centroidMidi * (1 - RhythmEngine.STREAM_CENTROID_ALPHA) +
        strokeMidi * RhythmEngine.STREAM_CENTROID_ALPHA;
      matchedStream.lastActivityTime = nowSec;
      matchedStream.isPulseActive = this.isPulseActive;
    } else {
      // Allocate a new stream
      if (this.streams.length >= RhythmEngine.MAX_STREAMS) {
        this.streams.sort((a, b) => a.lastActivityTime - b.lastActivityTime);
        this.streams.shift();
      }
      const defaultPeriod = (60 / this.currentBpm) * 4;
      matchedStream = {
        id: this.nextStreamId++,
        centroidMidi: strokeMidi,
        trackIndex: 0,
        strokes: [],
        lastActivityTime: nowSec,
        detectedMetre: {
          family: 'du',
          slots: 4,
          cyclePeriod: defaultPeriod,
          cycleBeats: 4,
          confidence: 0.5,
          anchor: nowSec,
        },
        pendingMetre: null,
        pendingMetreStartTime: 0,
        isPulseActive: this.isPulseActive,
        lastHandPhase: 0,
        idleDecayFactor: 1.0,
      };
      this.streams.push(matchedStream);
    }

    // Create record and stroke
    const record: RhythmOnsetRecord = {
      id: `${midi}-${nowSec}-${Math.random()}`,
      midi,
      velocity,
      timestamp: nowSec,
      quantisedPosition: 0,
      nearestPosition: 0,
      trackIndex: matchedStream.trackIndex,
      streamId: matchedStream.id,
    };
    this.onsets.push(record);

    const newStroke: RhythmStroke = {
      id: `stroke-${nowSec}-${Math.random()}`,
      timestamp: nowSec,
      nearestPosition: 0,
      quantisedPosition: 0,
      notes: [record],
      registerCentroid: strokeMidi,
      streamId: matchedStream.id,
    };
    this.strokes.push(newStroke);
    matchedStream.strokes.push(newStroke);

    // 3. Statistical window grid fitting for the matched stream with cross-stream context
    const crossContext = this.getCrossStreamContext(matchedStream.id);
    const fit = fitStreamToGrid(
      matchedStream.strokes,
      this.currentBpm,
      matchedStream.detectedMetre,
      crossContext
    );
    matchedStream.lastCandidateEvaluations = fit.candidateEvaluations;

    // Metre hysteresis: during initial strokes (<= 6) or when high confidence detected, adapt immediately to establish pattern.
    // Beyond 6 strokes, require confirmation across consecutive strokes before switching metres.
    if (matchedStream.strokes.length <= 6 || fit.bestMetre.confidence >= 0.8) {
      matchedStream.detectedMetre = fit.bestMetre;
      matchedStream.pendingMetre = null;
    } else if (
      fit.bestMetre.slots === matchedStream.detectedMetre.slots &&
      fit.bestMetre.family === matchedStream.detectedMetre.family
    ) {
      // Same metre: update cycle period, anchor, and confidence smoothly
      matchedStream.detectedMetre.cyclePeriod = fit.bestMetre.cyclePeriod;
      matchedStream.detectedMetre.anchor = fit.bestMetre.anchor;
      matchedStream.detectedMetre.confidence = fit.bestMetre.confidence;
      matchedStream.pendingMetre = null;
    } else {
      // Different metre: require persistence across consecutive strokes or decisive margin
      if (
        matchedStream.pendingMetre &&
        matchedStream.pendingMetre.slots === fit.bestMetre.slots &&
        matchedStream.pendingMetre.family === fit.bestMetre.family
      ) {
        matchedStream.detectedMetre = fit.bestMetre;
        matchedStream.pendingMetre = null;
      } else {
        matchedStream.pendingMetre = fit.bestMetre;
        matchedStream.pendingMetreStartTime = nowSec;
      }
    }

    for (let i = 0; i < matchedStream.strokes.length; i++) {
      const st = matchedStream.strokes[i];
      st.nearestPosition = fit.slotAssignments[i];
      st.quantisedPosition = fit.quantisedPositions[i];
      for (const n of st.notes) {
        n.nearestPosition = st.nearestPosition;
        n.quantisedPosition = st.quantisedPosition;
        n.streamId = matchedStream.id;
      }
    }

    // Soft rubato adaptation of global tempo from stream fit
    if (autoTempo && matchedStream.detectedMetre.confidence >= 0.55 && matchedStream.detectedMetre.cycleBeats > 0) {
      const impliedBpm = (matchedStream.detectedMetre.cycleBeats * 60) / matchedStream.detectedMetre.cyclePeriod;
      const folded = foldBpmToTactusRange(Math.round(impliedBpm));
      const ratio = folded / this.currentBpm;
      if (ratio >= 0.70 && ratio <= 1.30) {
        this.currentBpm = Math.round(this.currentBpm * 0.88 + folded * 0.12);
      }
    }

    // Elastic anchor tracking
    const cyclePeriod = matchedStream.detectedMetre.cyclePeriod;
    const cycleFraction = record.nearestPosition / Math.max(1, matchedStream.detectedMetre.slots);
    this.downbeatPhaseAnchor = nowSec - cycleFraction * cyclePeriod;

    this.pruneAndAssignTracks(nowSec, config);
    return record;
  }

  /**
   * Prunes expired strokes from streams and calculates concentric track distribution.
   * Streams are ordered by centroid pitch: lowest centroid -> track 0 (outermost).
   */
  private pruneAndAssignTracks(nowSec: number, config?: VisualiserConfig): void {
    const maxWindowStrokes = Math.max(4, Math.min(64, config?.rhythmNoteWindowSize ?? 24));
    const maxAgeSec = 8.0;

    // Prune per stream and compact evicted strokes into stream's compacted context
    for (const stream of this.streams) {
      const activeStrokes: RhythmStroke[] = [];
      const evictedStrokes: RhythmStroke[] = [];

      for (const s of stream.strokes) {
        if (nowSec - s.timestamp <= maxAgeSec) {
          activeStrokes.push(s);
        } else {
          evictedStrokes.push(s);
        }
      }

      let retained = activeStrokes;
      if (activeStrokes.length > maxWindowStrokes) {
        const excess = activeStrokes.length - maxWindowStrokes;
        evictedStrokes.push(...activeStrokes.slice(0, excess));
        retained = activeStrokes.slice(excess);
      }

      // Compact evicted strokes into stream's lightweight rhythm accumulator
      if (evictedStrokes.length > 0) {
        if (!stream.compactedContext) {
          stream.compactedContext = {
            accumulatedCycles: 0,
            totalEvictedStrokes: 0,
            slotHistogram: new Array(Math.max(1, stream.detectedMetre.slots)).fill(0),
            historicalDownbeatHits: 0,
          };
        }
        const hist = stream.compactedContext.slotHistogram;
        for (const es of evictedStrokes) {
          const slot = Math.abs(es.nearestPosition) % Math.max(1, hist.length);
          hist[slot] = (hist[slot] ?? 0) + 1;
          if (slot === 0) {
            stream.compactedContext.historicalDownbeatHits++;
          }
        }
        stream.compactedContext.totalEvictedStrokes += evictedStrokes.length;
        if (stream.detectedMetre.slots > 0) {
          stream.compactedContext.accumulatedCycles = Math.floor(
            stream.compactedContext.totalEvictedStrokes / stream.detectedMetre.slots
          );
        }
      }

      stream.strokes = retained;
    }

    // Evict inactive streams
    this.streams = this.streams.filter(
      (s) => nowSec - s.lastActivityTime <= maxAgeSec && s.strokes.length > 0
    );

    // Synchronize global strokes buffer across all streams with scaled capacity
    const globalCapacity = Math.max(32, Math.min(128, maxWindowStrokes * Math.max(1, this.streams.length)));
    this.strokes = this.streams
      .flatMap((s) => s.strokes)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (this.strokes.length > globalCapacity) {
      this.strokes = this.strokes.slice(-globalCapacity);
    }

    // Rebuild flat onsets array
    this.onsets = [];
    for (const stroke of this.strokes) {
      for (const note of stroke.notes) {
        this.onsets.push(note);
      }
    }

    if (this.onsets.length === 0) return;

    const isDynamic = (config?.rhythmTrackMode ?? 'dynamic') === 'dynamic';

    if (isDynamic) {
      // Dynamic mode: collect unique MIDI pitches active in the window sorted lowest to highest
      const uniquePitches = Array.from(
        new Set(this.onsets.map((n) => n.midi))
      ).sort((a, b) => a - b);

      // Maximum 8 dynamic tracks
      const trackCount = Math.min(8, uniquePitches.length);
      const pitchToTrack = new Map<number, number>();

      for (let i = 0; i < uniquePitches.length; i++) {
        // Lowest pitch -> track 0 (outermost); Highest pitch -> track trackCount - 1 (innermost)
        const assignedTrack = Math.min(
          trackCount - 1,
          Math.floor((i / Math.max(1, uniquePitches.length - 1)) * (trackCount - 1))
        );
        pitchToTrack.set(uniquePitches[i], assignedTrack);
      }

      for (const onset of this.onsets) {
        onset.trackIndex = pitchToTrack.get(onset.midi) ?? 0;
      }
    } else {
      // Fixed mode: evenly divide active keyboard range into fixed number of tracks
      const fixedCount = Math.max(1, Math.min(8, config?.rhythmTrackCount ?? 4));
      const lowest = config?.keyboardLowestMidi ?? 21;
      const highest = config?.keyboardHighestMidi ?? 108;
      const range = Math.max(12, highest - lowest);

      for (const onset of this.onsets) {
        const normalised = Math.max(0, Math.min(1, (onset.midi - lowest) / range));
        // Inverted: lowest pitch -> track 0 (outermost); highest pitch -> fixedCount - 1 (innermost)
        onset.trackIndex = Math.min(
          fixedCount - 1,
          Math.floor(normalised * fixedCount)
        );
      }
    }

    // Sync stream trackIndex from the average trackIndex of its notes
    for (const stream of this.streams) {
      if (stream.strokes.length > 0) {
        const notes = stream.strokes.flatMap((s) => s.notes);
        if (notes.length > 0) {
          stream.trackIndex = Math.round(
            notes.reduce((sum, n) => sum + n.trackIndex, 0) / notes.length
          );
        }
      }
    }
  }

  /**
   * Evaluates candidate BPMs against the current window of strokes to discover the simplest rhythmic fit.
   * Operates on distinct strokes (1 chord = 1 beat), eliminating chord weighting bias.
   */
  public evaluateCandidateTempos(
    _nowSec?: number,
    _config?: VisualiserConfig
  ): {
    bestBpm: number;
    bestScore: number;
    currentScore: number;
    bestAnchor: number;
  } {
    if (this.strokes.length < 2) {
      return {
        bestBpm: this.currentBpm,
        bestScore: 1.0,
        currentScore: 1.0,
        bestAnchor: this.downbeatPhaseAnchor,
      };
    }

    const candidateSet = new Set<number>();
    const strokeTimes = this.getDistinctOnsetTimes();

    // 1. Grid of musical tempos focused on the canonical 60..120 BPM tactus range
    for (let bpm = 60; bpm <= 120; bpm += 2) {
      candidateSet.add(bpm);
    }
    // Peripheral tempos
    for (let bpm = 48; bpm < 60; bpm += 4) candidateSet.add(bpm);
    for (let bpm = 124; bpm <= 160; bpm += 4) candidateSet.add(bpm);

    // 2. Compute full-window interval statistics from stroke times (not individual notes)
    const intervals: number[] = [];
    for (let i = 1; i < strokeTimes.length; i++) {
      const dt = strokeTimes[i] - strokeTimes[i - 1];
      if (dt >= 0.15 && dt <= 3.0) {
        intervals.push(dt);
      }
    }

    if (intervals.length > 0) {
      // Full window span average IOI (averages out all internal microtiming variations)
      const windowSpan = strokeTimes[strokeTimes.length - 1] - strokeTimes[0];
      const meanIOI = windowSpan / Math.max(1, strokeTimes.length - 1);
      const meanBpm = foldBpmToTactusRange(60 / meanIOI);
      candidateSet.add(meanBpm);
      candidateSet.add(foldBpmToTactusRange(meanBpm * 2));
      candidateSet.add(foldBpmToTactusRange(meanBpm * 0.5));

      // Median IOI across the window (robust to outlier stroke or syncopation)
      const sorted = [...intervals].sort((a, b) => a - b);
      const medianIOI = sorted[Math.floor(sorted.length / 2)];
      const medianBpm = foldBpmToTactusRange(60 / medianIOI);
      candidateSet.add(medianBpm);
      candidateSet.add(foldBpmToTactusRange(medianBpm * 2));
      candidateSet.add(foldBpmToTactusRange(medianBpm * 0.5));

      // Check for multi-level subdivision clustering (e.g. mixture of 8th notes and quarters)
      const shorter = intervals.filter((v) => v < medianIOI * 0.75);
      if (shorter.length >= 2) {
        const avgShort = shorter.reduce((s, v) => s + v, 0) / shorter.length;
        candidateSet.add(foldBpmToTactusRange(60 / avgShort));
      }
      const longer = intervals.filter((v) => v > medianIOI * 1.35);
      if (longer.length >= 2) {
        const avgLong = longer.reduce((s, v) => s + v, 0) / longer.length;
        candidateSet.add(foldBpmToTactusRange(60 / avgLong));
      }
    }

    // 3. Always include current BPM and duple multiples
    candidateSet.add(this.currentBpm);
    if (this.currentBpm * 2 <= 240) candidateSet.add(Math.round(this.currentBpm * 2));
    if (this.currentBpm * 0.5 >= 40) candidateSet.add(Math.round(this.currentBpm * 0.5));

    let bestBpm = this.currentBpm;
    let bestScore = -1;
    let currentScore = 0;
    let winningAnchor = this.downbeatPhaseAnchor;

    for (const bpm of candidateSet) {
      if (bpm < 40 || bpm > 240) continue;
      const { score, bestAnchor } = this.scoreTempoSimplicity(bpm);

      if (bpm === this.currentBpm) {
        currentScore = score;
      }

      if (score > bestScore) {
        bestScore = score;
        bestBpm = bpm;
        winningAnchor = bestAnchor;
      }
    }

    return {
      bestBpm,
      bestScore,
      currentScore,
      bestAnchor: winningAnchor,
    };
  }

  /**
   * Scores how well recent strokes fall onto the canonical 12-position polar grid for a candidate BPM.
   * Evaluates one score per stroke (not per note), eliminating chord weighting bias.
   */
  private scoreTempoSimplicity(candidateBpm: number): { score: number; bestAnchor: number } {
    const period = 60 / candidateBpm;
    const strokeTimes = this.getDistinctOnsetTimes();
    const testAnchors = strokeTimes.slice(-4);
    if (testAnchors.length === 0) {
      testAnchors.push(this.downbeatPhaseAnchor);
    }

    // Tempo-aware micro-timing tolerance based on 40ms human motor timing window
    const sigmaSpoke = Math.max(0.40, Math.min(1.05, (0.040 / period) * 12));
    const captureRadius = Math.max(0.55, Math.min(1.15, (0.045 / period) * 12));

    let maxAlignmentScore = 0;
    let bestAnchor = this.downbeatPhaseAnchor;

    for (const anchor of testAnchors) {
      let anchorScore = 0;
      const occupiedPositions = new Set<number>();
      let downbeatCount = 0;

      // Score each stroke once (not each note)
      for (const stroke of this.strokes) {
        const elapsed = stroke.timestamp - anchor;
        const phase = ((elapsed / period) % 1.0 + 1.0) % 1.0;
        const rawPos = phase * 12;

        // Tempo-aware nearest spoke resolution
        const nearest = resolveTempoAwareNearestSpoke(rawPos, candidateBpm);

        let dist = Math.abs(rawPos - nearest);
        if (dist > 6) dist = 12 - dist;

        // Tempo-aware Gaussian fitness curve
        const fit = Math.exp(-Math.pow(dist / sigmaSpoke, 2));
        const weight = RHYTHM_POSITION_WEIGHTS[nearest] ?? 1.0;

        // Use average velocity of notes in the stroke
        const avgVel = stroke.notes.reduce((s, n) => s + n.velocity, 0) / Math.max(1, stroke.notes.length);

        if (dist <= captureRadius) {
          occupiedPositions.add(nearest);
          if (nearest === 0) {
            downbeatCount++;
          }
        }

        anchorScore += fit * weight * (0.5 + avgVel * 0.5);
      }

      // Reward even subdivision distributions across the 12 positions:
      // - Pure downbeat pulse (every stroke lands on Do 0, or dominant >= 70% downbeat pulse)
      // - Quadripartite (16th notes: Do 0, Me 3, Fi 6, La 9)
      // - Tripartite (Triplets: Do 0, Mi 4, Le 8)
      // - Bipartite (8th notes: Do 0, Fi 6)
      const hasBipartite = occupiedPositions.has(0) && occupiedPositions.has(6);
      const hasTripartite = occupiedPositions.has(0) && occupiedPositions.has(4) && occupiedPositions.has(8);
      const hasQuadripartite =
        occupiedPositions.has(0) &&
        occupiedPositions.has(3) &&
        occupiedPositions.has(6) &&
        occupiedPositions.has(9);
      const isPureDownbeat =
        (occupiedPositions.size === 1 && occupiedPositions.has(0)) ||
        (downbeatCount >= 3 && downbeatCount / Math.max(1, this.strokes.length) >= 0.70);

      if (isPureDownbeat) {
        anchorScore *= 1.20;
      } else if (hasQuadripartite) {
        anchorScore *= 1.20;
      } else if (hasTripartite) {
        anchorScore *= 1.18;
      } else if (hasBipartite) {
        anchorScore *= 1.15;
      }

      if (anchorScore > maxAlignmentScore) {
        maxAlignmentScore = anchorScore;
        bestAnchor = anchor;
      }
    }

    let totalScore = maxAlignmentScore / Math.max(1, this.strokes.length);

    // Beat density factor: reward candidate tempos where each beat has a stroke
    // and penalise candidate tempos that assume unplayed, empty ghost beats
    if (strokeTimes.length >= 2) {
      const span = strokeTimes[strokeTimes.length - 1] - strokeTimes[0];
      if (span > 0) {
        const expectedBeats = Math.round(span / period) + 1;
        const density = Math.min(1.0, strokeTimes.length / Math.max(1, expectedBeats));
        totalScore *= Math.sqrt(density);
      }
    }

    // Tactus preference prior: uniform plateau across canonical 60..120 BPM tactus range,
    // rolling off gently below 60 BPM and above 120 BPM
    let tactusFactor = 1.0;
    if (candidateBpm < 60) {
      tactusFactor = Math.max(0.25, 1.0 - (60 - candidateBpm) * 0.035);
    } else if (candidateBpm > 120) {
      tactusFactor = Math.max(0.25, 1.0 - (candidateBpm - 120) * 0.025);
    }
    totalScore *= (0.75 + 0.25 * tactusFactor);

    // Retention inertia: bias current BPM (+18%) to eliminate erratic jumps on human timing variation
    if (candidateBpm === this.currentBpm) {
      totalScore *= 1.18;
    } else {
      const ratioToCurrent = candidateBpm / this.currentBpm;
      if (isDupleRatio(ratioToCurrent)) {
        totalScore *= 1.04;
      }
    }

    return { score: totalScore, bestAnchor };
  }

  /**
   * Main per-frame update method called by RenderCoordinator.
   */
  public update(
    nowMs: number = (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    config?: VisualiserConfig
  ): RhythmAlignmentResult {
    const nowSec = nowMs / 1000;
    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = nowSec;
    }
    this.lastUpdateTime = nowSec;

    // 1. Idle detection: if no notes played in the last 3.5 seconds, smoothly decelerate pulse
    const idleTime = nowSec - this.lastNoteTime;
    if (this.isPulseActive && idleTime > 3.5) {
      const idleElapsed = idleTime - 3.5;
      this.idleDecayFactor = Math.max(0, 1.0 - idleElapsed * 0.65);
      if (this.idleDecayFactor <= 0.01) {
        this.isPulseActive = false;
      }
    }

    // Prune expired strokes from window
    this.pruneAndAssignTracks(nowSec, config);

    // 2. Pulse phase calculation
    let rawPhase = 0;
    let downbeatOccurred = false;

    if (this.isPulseActive) {
      const effectiveBpm = Math.max(20, this.currentBpm * this.idleDecayFactor);
      const beatPeriod = 60 / effectiveBpm;
      const elapsedSinceAnchor = nowSec - this.downbeatPhaseAnchor;
      rawPhase = ((elapsedSinceAnchor / beatPeriod) % 1.0 + 1.0) % 1.0;
      downbeatOccurred = rawPhase < this.lastHandPhase;
      this.lastHandPhase = rawPhase;
    } else {
      rawPhase = 0;
      this.lastHandPhase = 0;
    }

    // 3. Tempo Autodetection with Dual Hysteresis Thresholds
    let shouldShift = false;
    let shiftType: TempoShiftType | undefined;
    let newBpm: number | undefined;
    let tunerOffset = 0;
    let tunerConfidence = 0;

    const autoTempo = config?.rhythmAutoTempoEnabled ?? true;

    // Require pulse to be active and at least 4 strokes in window for statistical confidence
    if (autoTempo && this.isPulseActive && this.strokes.length >= 4) {
      const { bestBpm, bestScore, currentScore, bestAnchor } =
        this.evaluateCandidateTempos(nowSec, config);
      const bpmDiff = Math.abs(bestBpm - this.currentBpm);

      // Require significant tempo difference (>= 5 BPM) to prevent jitter
      if (bpmDiff >= 5) {
        const ratio = bestBpm / this.currentBpm;
        const isDuple = isDupleRatio(ratio);

        // Debounce durations:
        // Duple modulation (powers of 2): 500ms with 0.08 margin
        // Arbitrary modulation: 1200ms with 0.12 margin
        const debounceDurationMs = isDuple ? 500 : 1200;
        const requiredScoreMargin = isDuple ? 0.08 : 0.12;
        const candidateType: TempoShiftType = isDuple ? 'duple' : 'arbitrary';

        const scoreMargin = bestScore - currentScore;

        if (scoreMargin >= requiredScoreMargin) {
          if (this.pendingCandidateBpm === bestBpm) {
            const elapsedDebounce = nowMs - this.pendingCandidateStartTime;
            tunerConfidence = Math.min(1.0, elapsedDebounce / debounceDurationMs);

            if (elapsedDebounce >= debounceDurationMs) {
              shouldShift = true;
              shiftType = this.pendingCandidateShiftType;
              newBpm = bestBpm;
              this.currentBpm = bestBpm;
              this.downbeatPhaseAnchor = this.pendingCandidateAnchor;
              this.pendingCandidateBpm = null;
              this.pendingCandidateStartTime = 0;
              this.recomputeStrokePositions();
            }
          } else {
            // New winning candidate: begin debounce clock
            this.pendingCandidateBpm = bestBpm;
            this.pendingCandidateStartTime = nowMs;
            this.pendingCandidateShiftType = candidateType;
            this.pendingCandidateAnchor = bestAnchor;
            tunerConfidence = 0.05;
          }
        } else {
          // Margin insufficient: cancel pending shift
          if (this.pendingCandidateBpm !== null) {
            this.pendingCandidateBpm = null;
            this.pendingCandidateStartTime = 0;
          }
        }
      } else {
        // Below minimum diff: reset pending shift
        this.pendingCandidateBpm = null;
        this.pendingCandidateStartTime = 0;
      }

      // Calculate tuner offset indicator if a candidate is pending
      if (this.pendingCandidateBpm !== null) {
        const diff = this.pendingCandidateBpm - this.currentBpm;
        // Clamp to [-1, 1] over a +/- 24 BPM deviation range
        tunerOffset = Math.max(-1.0, Math.min(1.0, diff / 24.0));
      }
    } else {
      this.pendingCandidateBpm = null;
      this.pendingCandidateStartTime = 0;
    }

    // Build per-stream metre states and calculate per-stream pulse phases
    const streamStates: StreamMetreState[] = this.streams.map((s) => {
      const crossContext = this.getCrossStreamContext(s.id);

      // Periodic metre re-fitting if stream has at least 3 strokes
      if (s.strokes.length >= 3) {
        const fit = fitStreamToGrid(s.strokes, this.currentBpm, s.detectedMetre, crossContext);
        s.lastCandidateEvaluations = fit.candidateEvaluations;
        if (fit.bestMetre.slots !== s.detectedMetre.slots && fit.fitness > 0.65) {
          if (s.pendingMetre && s.pendingMetre.slots === fit.bestMetre.slots) {
            if (nowMs - s.pendingMetreStartTime >= 1200) {
              s.detectedMetre = fit.bestMetre;
              s.pendingMetre = null;
            }
          } else {
            s.pendingMetre = fit.bestMetre;
            s.pendingMetreStartTime = nowMs;
          }
        } else if (fit.fitness > 0.6) {
          s.detectedMetre.cyclePeriod = fit.bestMetre.cyclePeriod;
          s.detectedMetre.anchor = fit.bestMetre.anchor;
          s.pendingMetre = null;
        }
      }

      const period = s.detectedMetre.cyclePeriod;
      const elapsed = nowSec - s.detectedMetre.anchor;
      const rawStreamPhase = ((elapsed / period) % 1.0 + 1.0) % 1.0;
      const streamDownbeat = rawStreamPhase < s.lastHandPhase;
      s.lastHandPhase = rawStreamPhase;

      let crossStreamAnchorInfo = undefined;
      if (crossContext) {
        crossStreamAnchorInfo = {
          streamId: crossContext.anchorStreamId,
          family: crossContext.anchorMetre.family,
          slots: crossContext.anchorMetre.slots,
          ratio: `${s.detectedMetre.slots}:${crossContext.anchorMetre.slots}`,
        };
      }

      return {
        ...s.detectedMetre,
        streamId: s.id,
        trackIndex: s.trackIndex,
        centroidMidi: s.centroidMidi,
        isPulseActive: this.isPulseActive && s.strokes.length > 0,
        pulsePhase: rawStreamPhase,
        downbeatOccurred: streamDownbeat,
        candidateEvaluations:
          s.lastCandidateEvaluations ??
          (s.strokes.length > 0
            ? fitStreamToGrid(s.strokes, this.currentBpm, s.detectedMetre, crossContext).candidateEvaluations
            : []),
        strokes: s.strokes,
        timeSinceLastActivity: nowSec - s.lastActivityTime,
        crossStreamAnchor: crossStreamAnchorInfo,
      };
    });

    // Convergence pulse detection when 2+ active streams align at 12 o'clock zenith (within +/- 3% of 0)
    let convergenceOccurred = false;
    const convergenceStreamIds: number[] = [];
    if (streamStates.length >= 2) {
      const aligned = streamStates.filter(
        (st) => st.isPulseActive && (st.pulsePhase < 0.035 || st.pulsePhase > 0.965)
      );
      if (aligned.length >= 2) {
        convergenceOccurred = true;
        for (const a of aligned) {
          convergenceStreamIds.push(a.streamId);
        }
      }
    }

    return {
      currentBpm: this.currentBpm,
      bestBpm: this.pendingCandidateBpm ?? this.currentBpm,
      shouldShift,
      shiftType,
      newBpm,
      tunerOffset,
      tunerConfidence,
      isPulseActive: this.isPulseActive,
      pulsePhase: rawPhase,
      downbeatOccurred,
      streams: streamStates,
      convergenceOccurred,
      convergenceStreamIds,
    };
  }
}

