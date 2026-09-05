import { ActiveNote } from './types';

export interface ChordCandidateNote {
  note: ActiveNote;
  alpha: number;
  isDecaying: boolean;
}

export interface ChordCluster {
  id: string;
  notes: ChordCandidateNote[];
  isDecaying: boolean;
  baseStartTime?: number;
}

/**
 * Resolves active and decaying chord voicing groups:
 * 1. Active Voicing: All concurrently held notes in activeNotes form the living chord geometry.
 *    - Adding chord tones expands the geometry.
 *    - Releasing chord tones reduces the geometry.
 *    - Active voicings require >= 2 held notes.
 * 2. Decaying Voicings: Notes in decayingNotes that were released together (or struck together)
 *    fade out as cohesive released chord shapes.
 *    - Isolated decaying melody notes (cluster size < 2) produce no rays.
 *    - Decaying chords are NEVER connected to currently active notes, keeping harmonies isolated.
 */
export function resolveChordVoicingGroups(
  activeNotes: Map<number, ActiveNote>,
  decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>,
  releaseWindowMs: number = 120,
  onsetWindowMs: number = 85
): ChordCluster[] {
  const groups: ChordCluster[] = [];

  // 1. Active Held Voicing Group
  // Concurrently held notes represent the real-time active harmonic voicing.
  // When a user holds keys and adds more notes, the geometry expands.
  // When keys are released, the geometry reduces.
  if (activeNotes.size >= 2) {
    const activeCandidates: ChordCandidateNote[] = [];
    for (const note of activeNotes.values()) {
      activeCandidates.push({
        note,
        alpha: 0.85 * note.velocity,
        isDecaying: false,
      });
    }
    groups.push({
      id: 'active_voicing',
      notes: activeCandidates,
      isDecaying: false,
    });
  }

  // 2. Decaying Released Voicing Groups
  // Notes that were released together as a chord voicing fade out as a cohesive chord shape.
  // They are strictly isolated from currently active notes so different harmonies never tangle.
  if (decayingNotes.size >= 2) {
    const decayingCandidates: ChordCandidateNote[] = [];
    for (const { note, decayProgress } of decayingNotes.values()) {
      decayingCandidates.push({
        note,
        alpha: (1 - decayProgress) * 0.5 * note.velocity,
        isDecaying: true,
      });
    }

    // Sort chronologically by releaseTime (fallback to startTime if unreleased/unset)
    decayingCandidates.sort((a, b) => {
      const timeA = a.note.releaseTime ?? a.note.startTime;
      const timeB = b.note.releaseTime ?? b.note.startTime;
      return timeA - timeB;
    });

    let currentGroup: ChordCandidateNote[] = [decayingCandidates[0]];

    for (let i = 1; i < decayingCandidates.length; i++) {
      const prev = decayingCandidates[i - 1];
      const curr = decayingCandidates[i];

      const prevRelease = prev.note.releaseTime ?? prev.note.startTime;
      const currRelease = curr.note.releaseTime ?? curr.note.startTime;

      // Group together if released together OR struck together
      const releasedTogether = Math.abs(currRelease - prevRelease) <= releaseWindowMs;
      const struckTogether = Math.abs(curr.note.startTime - prev.note.startTime) <= onsetWindowMs;

      if (releasedTogether || struckTogether) {
        currentGroup.push(curr);
      } else {
        if (currentGroup.length >= 2) {
          groups.push({
            id: `decaying_${currentGroup[0].note.releaseTime ?? currentGroup[0].note.startTime}`,
            notes: currentGroup,
            isDecaying: true,
          });
        }
        currentGroup = [curr];
      }
    }

    if (currentGroup.length >= 2) {
      groups.push({
        id: `decaying_${currentGroup[0].note.releaseTime ?? currentGroup[0].note.startTime}`,
        notes: currentGroup,
        isDecaying: true,
      });
    }
  }

  return groups;
}

/**
 * Legacy onset clustering for simultaneous note candidates (|ΔstartTime| <= windowMs).
 */
export function clusterSimultaneousNotes(
  candidates: ChordCandidateNote[],
  windowMs: number = 85
): ChordCluster[] {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => a.note.startTime - b.note.startTime);

  const clusters: ChordCluster[] = [];
  let currentGroup: ChordCandidateNote[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (Math.abs(curr.note.startTime - prev.note.startTime) <= windowMs) {
      currentGroup.push(curr);
    } else {
      if (currentGroup.length >= 2) {
        clusters.push({
          id: `chord_${currentGroup[0].note.startTime}`,
          notes: currentGroup,
          isDecaying: currentGroup[0].isDecaying,
          baseStartTime: currentGroup[0].note.startTime,
        });
      }
      currentGroup = [curr];
    }
  }

  if (currentGroup.length >= 2) {
    clusters.push({
      id: `chord_${currentGroup[0].note.startTime}`,
      notes: currentGroup,
      isDecaying: currentGroup[0].isDecaying,
      baseStartTime: currentGroup[0].note.startTime,
    });
  }

  return clusters;
}
