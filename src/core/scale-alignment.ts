import { AutoTonicMode, VisualiserConfig } from './types';

export interface ScaleModeDefinition {
  name: string;
  intervals: number[];
  description: string;
}

/**
 * Standard modes and scale degrees relative to tonic (semitone 0..11).
 */
export const SCALE_MODE_DEFINITIONS: Record<AutoTonicMode, ScaleModeDefinition> = {
  ionian: {
    name: 'Major (Ionian)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    description: 'Diatonic major scale (Do, Re, Mi, Fa, So, La, Ti)',
  },
  aeolian: {
    name: 'Natural Minor (Aeolian)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    description: 'Natural minor scale (Do, Re, Me, Fa, So, Le, Te)',
  },
  dorian: {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    description: 'Minor mode with natural 6th (Do, Re, Me, Fa, So, La, Te)',
  },
  mixolydian: {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    description: 'Dominant major mode with flat 7th (Do, Re, Mi, Fa, So, La, Te)',
  },
  lydian: {
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    description: 'Major mode with raised 4th (Do, Re, Mi, Fi, So, La, Ti)',
  },
  phrygian: {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    description: 'Minor mode with flat 2nd (Do, Ra, Me, Fa, So, Le, Te)',
  },
  locrian: {
    name: 'Locrian',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    description: 'Diminished mode with flat 5th (Do, Ra, Me, Fa, Fi, Le, Te)',
  },
  'harmonic-minor': {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    description: 'Minor scale with raised leading tone (Do, Re, Me, Fa, So, Le, Ti)',
  },
  'melodic-minor': {
    name: 'Melodic Minor (Jazz)',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    description: 'Ascending jazz minor scale (Do, Re, Me, Fa, So, La, Ti)',
  },
  'pentatonic-major': {
    name: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    description: '5-note major scale (Do, Re, Mi, So, La)',
  },
  'pentatonic-minor': {
    name: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10],
    description: '5-note minor scale (Do, Me, Fa, So, Te)',
  },
  blues: {
    name: 'Blues Scale',
    intervals: [0, 3, 5, 6, 7, 10],
    description: '6-note blues scale with tritone blue note (Do, Me, Fa, Fi, So, Te)',
  },
  custom: {
    name: 'Custom Scale Degrees',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    description: 'User-selected combination of scale degrees',
  },
};

/**
 * Returns the effective set of intervals for a given mode and config.
 */
export function getEffectiveModeIntervals(mode: AutoTonicMode, customDegrees?: number[]): number[] {
  if (mode === 'custom' && customDegrees && customDegrees.length > 0) {
    return customDegrees;
  }
  return SCALE_MODE_DEFINITIONS[mode]?.intervals ?? SCALE_MODE_DEFINITIONS.ionian.intervals;
}

/**
 * Evaluates candidate tonic against a 12-dimensional pitch-class activity vector.
 * Returns both the fit score (for comparative ranking with penalties) and diatonic fit ratio [0..1].
 */
export function calculateDiatonicFitScore(
  activity: number[],
  candidateTonic: number,
  modeIntervals: number[]
): { score: number; diatonicFitRatio: number; inScaleActivity: number; totalActivity: number } {
  const intervalSet = new Set(modeIntervals);
  let score = 0;
  let inScaleActivity = 0;
  let totalActivity = 0;

  for (let pc = 0; pc < 12; pc++) {
    const act = activity[pc];
    if (act <= 0.001) continue;

    totalActivity += act;
    const relSemitone = ((pc - candidateTonic) % 12 + 12) % 12;

    if (intervalSet.has(relSemitone)) {
      // Reward diatonic note, with bonus for structural degrees (tonic 0, fifth 7, third 3/4)
      let degreeWeight = 1.0;
      if (relSemitone === 0) degreeWeight = 1.45; // Tonic anchor
      else if (relSemitone === 7) degreeWeight = 1.25; // Dominant
      else if (relSemitone === 4 || relSemitone === 3) degreeWeight = 1.15; // Mediant

      score += act * degreeWeight;
      inScaleActivity += act;
    } else {
      // Penalize non-diatonic / foreign notes
      score -= act * 1.85;
    }
  }

  const diatonicFitRatio = totalActivity > 0.005 ? inScaleActivity / totalActivity : 1.0;

  return {
    score,
    diatonicFitRatio,
    inScaleActivity,
    totalActivity,
  };
}

/**
 * Evaluates all 12 candidate tonics (0..11) against the current activity vector.
 */
export function evaluateAllTonicCandidates(
  activity: number[],
  modeIntervals: number[]
): Array<{ tonic: number; score: number; diatonicFitRatio: number }> {
  const results: Array<{ tonic: number; score: number; diatonicFitRatio: number }> = [];

  for (let t = 0; t < 12; t++) {
    const fit = calculateDiatonicFitScore(activity, t, modeIntervals);
    results.push({
      tonic: t,
      score: fit.score,
      diatonicFitRatio: fit.diatonicFitRatio,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export interface ScaleAlignmentResult {
  currentTonic: number;
  currentTonicFit: number;
  bestTonic: number;
  bestTonicFit: number;
  scoreMargin: number;
  totalActiveEnergy: number;
  shouldShift: boolean;
  newTonic?: number;
}

/**
 * Real-time tracker for pitch-class activity and musical hysteresis.
 * Evaluates when notes become increasingly non-diatonic under the current tonic
 * and triggers stable, non-thrashing shifts to the optimal target mode alignment.
 */
export class ScaleAlignmentTracker {
  private activityVector: number[] = Array(12).fill(0);
  private lastUpdateTime: number = 0;
  private pendingCandidateTonic: number | null = null;
  private pendingCandidateStartTime: number = 0;

  public reset(): void {
    this.activityVector.fill(0);
    this.lastUpdateTime = 0;
    this.pendingCandidateTonic = null;
    this.pendingCandidateStartTime = 0;
  }

  /**
   * Directly sets the pitch-class activity vector (useful for testing or direct ingestion).
   */
  public setActivityVector(vector: number[]): void {
    for (let i = 0; i < 12; i++) {
      this.activityVector[i] = Math.max(0, vector[i] ?? 0);
    }
  }

  public getActivityVector(): number[] {
    return [...this.activityVector];
  }

  /**
   * Updates activity with current musical events and returns alignment recommendations.
   */
  public update(
    now: number,
    activeNotes: Iterable<{ pitchClass: number; velocity: number }>,
    decayingNotes: Iterable<{ note: { pitchClass: number; velocity: number }; decayProgress: number }>,
    config: VisualiserConfig
  ): ScaleAlignmentResult {
    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = now;
    }
    const dt = Math.max(0, Math.min(1000, now - this.lastUpdateTime));
    this.lastUpdateTime = now;

    // 1. Exponential decay of past activity (4.5s decay window for musical harmonic memory)
    const decayFactor = Math.exp(-dt / 4500);
    for (let i = 0; i < 12; i++) {
      this.activityVector[i] *= decayFactor;
    }

    // 2. Feed sounding active notes
    for (const note of activeNotes) {
      const pc = ((note.pitchClass % 12) + 12) % 12;
      const energy = 0.5 + Math.min(0.5, note.velocity * 0.5);
      this.activityVector[pc] = Math.max(this.activityVector[pc], energy);
    }

    // 3. Feed decaying notes
    for (const { note, decayProgress } of decayingNotes) {
      const pc = ((note.pitchClass % 12) + 12) % 12;
      const energy = (1 - decayProgress) * note.velocity * 0.45;
      this.activityVector[pc] = Math.max(this.activityVector[pc], energy);
    }

    // 4. Calculate effective mode intervals
    const modeIntervals = getEffectiveModeIntervals(config.autoTonicMode, config.autoTonicCustomDegrees);

    // 5. Evaluate current tonic vs best candidates
    const currentTonic = config.tonic;
    const currentEval = calculateDiatonicFitScore(this.activityVector, currentTonic, modeIntervals);
    const candidateRankings = evaluateAllTonicCandidates(this.activityVector, modeIntervals);
    const bestCandidate = candidateRankings[0];

    const totalActiveEnergy = currentEval.totalActivity;
    const scoreMargin = bestCandidate.score - currentEval.score;

    // 6. Hysteresis parameters based on sensitivity
    let hysteresisThreshold = 0.55;
    let debounceMs = 900;

    if (config.autoTonicSensitivity === 'fast') {
      hysteresisThreshold = 0.28;
      debounceMs = 450;
    } else if (config.autoTonicSensitivity === 'conservative') {
      hysteresisThreshold = 0.95;
      debounceMs = 1500;
    }

    let shouldShift = false;
    let newTonic: number | undefined;

    // Must have minimum musical energy and evidence to trigger auto-alignment
    const hasSufficientEnergy = totalActiveEnergy >= 0.4;
    const isDistinctCandidate = bestCandidate.tonic !== currentTonic;
    const exceedsHysteresis = scoreMargin >= hysteresisThreshold;

    if (hasSufficientEnergy && isDistinctCandidate && exceedsHysteresis) {
      if (this.pendingCandidateTonic === bestCandidate.tonic) {
        // Candidate has been consistently winning
        const elapsed = now - this.pendingCandidateStartTime;
        if (elapsed >= debounceMs) {
          shouldShift = true;
          newTonic = bestCandidate.tonic;
          // Reset pending state
          this.pendingCandidateTonic = null;
          this.pendingCandidateStartTime = 0;
        }
      } else {
        // Start debounce clock for new winning candidate
        this.pendingCandidateTonic = bestCandidate.tonic;
        this.pendingCandidateStartTime = now;
      }
    } else {
      // Reverted to current key or below threshold; cancel pending shift
      if (this.pendingCandidateTonic !== null && !isDistinctCandidate) {
        this.pendingCandidateTonic = null;
        this.pendingCandidateStartTime = 0;
      }
    }

    return {
      currentTonic,
      currentTonicFit: currentEval.diatonicFitRatio,
      bestTonic: bestCandidate.tonic,
      bestTonicFit: bestCandidate.diatonicFitRatio,
      scoreMargin,
      totalActiveEnergy,
      shouldShift,
      newTonic,
    };
  }
}
