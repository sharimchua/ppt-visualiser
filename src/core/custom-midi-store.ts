import { TimedNoteEvent, DemoTrack, DEMO_TRACKS } from './demo-tracks';

export interface CustomMidiTrack {
  id: string;
  title: string;
  composer: string;
  category: string;
  duration: number;
  notes: TimedNoteEvent[];
  filename?: string;
  timestamp: number;
}

export const CUSTOM_MIDI_STORAGE_KEY = 'ppt_custom_midi_tracks_v1';
const MAX_CUSTOM_TRACKS = 20;

type CustomTrackChangeListener = (tracks: CustomMidiTrack[]) => void;
const listeners = new Set<CustomTrackChangeListener>();

function notifyListeners(tracks: CustomMidiTrack[]) {
  for (const listener of listeners) {
    try {
      listener(tracks);
    } catch (err) {
      console.error('[CustomMidiStore] Listener error:', err);
    }
  }
}

/**
 * Subscribe to custom MIDI tracks changes (additions, deletions, updates).
 */
export function subscribeCustomTracks(listener: CustomTrackChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Loads all saved custom MIDI tracks from localStorage.
 */
export function loadSavedCustomTracks(): CustomMidiTrack[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_MIDI_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Sanitise and validate track entries
    return parsed.filter((t): t is CustomMidiTrack => {
      return (
        typeof t === 'object' &&
        t !== null &&
        typeof t.id === 'string' &&
        typeof t.title === 'string' &&
        Array.isArray(t.notes) &&
        typeof t.duration === 'number'
      );
    });
  } catch (err) {
    console.warn('[CustomMidiStore] Failed to parse custom tracks from localStorage:', err);
    return [];
  }
}

/**
 * Saves a custom MIDI track to localStorage.
 * Manages quota by capping total tracks and evicting oldest if storage limits are reached.
 */
export function saveCustomTrack(track: CustomMidiTrack): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    let tracks = loadSavedCustomTracks();

    // Replace if ID matches, or prepend if new
    const existingIndex = tracks.findIndex((t) => t.id === track.id || t.title === track.title);
    if (existingIndex >= 0) {
      tracks[existingIndex] = track;
    } else {
      tracks.unshift(track);
    }

    // Limit maximum count
    if (tracks.length > MAX_CUSTOM_TRACKS) {
      tracks = tracks.slice(0, MAX_CUSTOM_TRACKS);
    }

    // Attempt saving with quota degradation if necessary
    let saved = false;
    while (tracks.length > 0) {
      try {
        window.localStorage.setItem(CUSTOM_MIDI_STORAGE_KEY, JSON.stringify(tracks));
        saved = true;
        break;
      } catch (quotaErr) {
        console.warn('[CustomMidiStore] Storage quota exceeded, evicting oldest custom track:', quotaErr);
        tracks.pop(); // Remove oldest
      }
    }

    if (saved) {
      notifyListeners(tracks);
      return true;
    }
    return false;
  } catch (err) {
    console.error('[CustomMidiStore] Error saving custom track:', err);
    return false;
  }
}

/**
 * Deletes a custom MIDI track by ID from localStorage.
 */
export function deleteCustomTrack(trackId: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const tracks = loadSavedCustomTracks();
    const filtered = tracks.filter((t) => t.id !== trackId);
    if (filtered.length === tracks.length) {
      return false; // Track was not found
    }

    window.localStorage.setItem(CUSTOM_MIDI_STORAGE_KEY, JSON.stringify(filtered));
    notifyListeners(filtered);
    return true;
  } catch (err) {
    console.error('[CustomMidiStore] Error deleting custom track:', err);
    return false;
  }
}

/**
 * Clears all custom MIDI tracks from localStorage.
 */
export function clearAllCustomTracks(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(CUSTOM_MIDI_STORAGE_KEY);
    notifyListeners([]);
  } catch (err) {
    console.error('[CustomMidiStore] Error clearing custom tracks:', err);
  }
}

/**
 * Finds a track by ID across both custom tracks and inbuilt demo tracks.
 */
export function findAnyTrackById(trackId: string): DemoTrack | CustomMidiTrack | undefined {
  const customTracks = loadSavedCustomTracks();
  const customMatch = customTracks.find((t) => t.id === trackId);
  if (customMatch) return customMatch;

  return DEMO_TRACKS.find((t) => t.id === trackId);
}
