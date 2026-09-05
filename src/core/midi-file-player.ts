import { TimedNoteEvent, DEMO_TRACKS } from './demo-tracks';
import { MidiPlaybackState } from './types';
import { midiManagerInstance } from './midi-manager';

export class MidiFilePlayer {
  private notes: TimedNoteEvent[] = [];
  private currentTrackName: string = '';
  private duration: number = 0;
  private currentTime: number = 0;
  private tempoMultiplier: number = 1.0;
  private isPlaying: boolean = false;
  private loop: boolean = true;

  private animFrameId: number | null = null;
  private lastPerfTime: number = 0;
  private activeNoteTimeouts: Set<number> = new Set();
  private currentlySoundingMidi: Set<number> = new Set();
  private stateListeners: Set<(state: MidiPlaybackState) => void> = new Set();
  private lastStateNotifyTime: number = 0;

  constructor() {
    // Default to Concentric Clock Radial Orbit demo track
    this.loadDemoTrack('radial-orbit');
  }

  public loadDemoTrack(trackId: string): boolean {
    const track = DEMO_TRACKS.find(t => t.id === trackId);
    if (!track) return false;

    this.stop();
    this.notes = [...track.notes].sort((a, b) => a.time - b.time);
    this.currentTrackName = track.title;
    this.duration = track.duration;
    this.currentTime = 0;
    this.notifyState();
    return true;
  }

  public loadExternalMidiFile(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer) return resolve(false);

          const parsedNotes = this.parseMidiBuffer(buffer);
          if (parsedNotes.length === 0) {
            console.warn('No playable note events found in MIDI file.');
            return resolve(false);
          }

          this.stop();
          this.notes = parsedNotes.sort((a, b) => a.time - b.time);
          this.currentTrackName = file.name.replace(/\.[^/.]+$/, '');
          const lastNote = this.notes[this.notes.length - 1];
          this.duration = lastNote.time + lastNote.duration + 0.5;
          this.currentTime = 0;
          this.notifyState();
          resolve(true);
        } catch (err) {
          console.error('Failed to parse MIDI file:', err);
          resolve(false);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  public play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastPerfTime = performance.now();
    this.tick();
    this.notifyState();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.releaseAllSounding();
    this.notifyState();
  }

  public stop() {
    this.pause();
    this.currentTime = 0;
    this.releaseAllSounding();
    this.notifyState();
  }

  public seek(time: number) {
    const wasPlaying = this.isPlaying;
    this.pause();
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.notifyState();
    if (wasPlaying) {
      this.play();
    }
  }

  public setTempoMultiplier(mult: number) {
    this.tempoMultiplier = Math.max(0.25, Math.min(3.0, mult));
    this.notifyState();
  }

  public setLoop(loop: boolean) {
    this.loop = loop;
    this.notifyState();
  }

  public getState(): MidiPlaybackState {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      tempoMultiplier: this.tempoMultiplier,
      trackName: this.currentTrackName,
      loop: this.loop,
    };
  }

  public onStateChange(listener: (state: MidiPlaybackState) => void) {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  private notifyState() {
    const state = this.getState();
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }

  private releaseAllSounding() {
    for (const timeoutId of this.activeNoteTimeouts) {
      clearTimeout(timeoutId);
    }
    this.activeNoteTimeouts.clear();

    for (const midi of this.currentlySoundingMidi) {
      midiManagerInstance.triggerNoteOff(midi);
    }
    this.currentlySoundingMidi.clear();
  }

  private tick = () => {
    if (!this.isPlaying) return;

    const now = performance.now();
    const dt = ((now - this.lastPerfTime) / 1000) * this.tempoMultiplier;
    this.lastPerfTime = now;

    const prevTime = this.currentTime;
    this.currentTime += dt;

    // Check notes triggered in window [prevTime, currentTime]
    for (const note of this.notes) {
      if (note.time >= prevTime && note.time < this.currentTime) {
        midiManagerInstance.triggerNoteOn(note.midi, note.velocity);
        this.currentlySoundingMidi.add(note.midi);

        // Schedule NoteOff
        const durMs = (note.duration / this.tempoMultiplier) * 1000;
        const timeoutId = window.setTimeout(() => {
          midiManagerInstance.triggerNoteOff(note.midi);
          this.currentlySoundingMidi.delete(note.midi);
          this.activeNoteTimeouts.delete(timeoutId);
        }, durMs);

        this.activeNoteTimeouts.add(timeoutId);
      }
    }

    if (this.currentTime >= this.duration) {
      if (this.loop) {
        this.currentTime = 0;
        this.notifyState();
      } else {
        this.stop();
        return;
      }
    } else {
      const perfNow = performance.now();
      if (perfNow - this.lastStateNotifyTime >= 50) {
        this.lastStateNotifyTime = perfNow;
        this.notifyState();
      }
    }

    this.animFrameId = requestAnimationFrame(this.tick);
  };

  /**
   * Resilient binary parser for Standard MIDI Files (.mid)
   */
  private parseMidiBuffer(buffer: ArrayBuffer): TimedNoteEvent[] {
    const view = new DataView(buffer);
    let offset = 0;

    // Read header chunk (MThd)
    const headerTag = String.fromCharCode(
      view.getUint8(offset++), view.getUint8(offset++),
      view.getUint8(offset++), view.getUint8(offset++)
    );
    if (headerTag !== 'MThd') {
      throw new Error('Not a valid MIDI file (missing MThd chunk)');
    }

    const headerLength = view.getUint32(offset);
    offset += 4;
    offset += 2; // format (0, 1, or 2)
    const trackCount = view.getUint16(offset);
    offset += 2;
    const timeDivision = view.getUint16(offset);
    offset += 2;

    // Skip any extra header bytes
    offset += (headerLength - 6);

    const ticksPerBeat = (timeDivision & 0x8000) === 0 ? timeDivision : 480;
    let microsecondsPerBeat = 500000; // Default 120 BPM (500,000 micros)

    const rawNoteEvents: Array<{
      tick: number;
      type: 'on' | 'off';
      midi: number;
      velocity: number;
    }> = [];

    // Parse each track
    for (let t = 0; t < trackCount && offset < buffer.byteLength; t++) {
      if (offset + 8 > buffer.byteLength) break;
      const trackTag = String.fromCharCode(
        view.getUint8(offset++), view.getUint8(offset++),
        view.getUint8(offset++), view.getUint8(offset++)
      );
      const trackLength = view.getUint32(offset);
      offset += 4;

      if (trackTag !== 'MTrk') {
        offset += trackLength;
        continue;
      }

      const trackEnd = offset + trackLength;
      let currentTick = 0;
      let runningStatus = 0;

      while (offset < trackEnd) {
        // Variable-length delta tick
        let delta = 0;
        let b = 0;
        do {
          b = view.getUint8(offset++);
          delta = (delta << 7) | (b & 0x7f);
        } while (b & 0x80);

        currentTick += delta;

        let status = view.getUint8(offset);
        if (status < 0x80) {
          status = runningStatus;
        } else {
          status = view.getUint8(offset++);
          runningStatus = status;
        }

        const msgType = status & 0xf0;

        if (status === 0xff) {
          // Meta Event
          const metaType = view.getUint8(offset++);
          let metaLen = 0;
          let mb = 0;
          do {
            mb = view.getUint8(offset++);
            metaLen = (metaLen << 7) | (mb & 0x7f);
          } while (mb & 0x80);

          if (metaType === 0x51 && metaLen === 3) {
            // Set Tempo
            microsecondsPerBeat = (view.getUint8(offset) << 16) | (view.getUint8(offset + 1) << 8) | view.getUint8(offset + 2);
          }
          offset += metaLen;
        } else if (status === 0xf0 || status === 0xf7) {
          // Sysex
          let sysexLen = 0;
          let sb = 0;
          do {
            sb = view.getUint8(offset++);
            sysexLen = (sysexLen << 7) | (sb & 0x7f);
          } while (sb & 0x80);
          offset += sysexLen;
        } else if (msgType === 0x90) {
          // Note On
          const note = view.getUint8(offset++);
          const vel = view.getUint8(offset++);
          rawNoteEvents.push({
            tick: currentTick,
            type: vel > 0 ? 'on' : 'off',
            midi: note,
            velocity: vel / 127,
          });
        } else if (msgType === 0x80) {
          // Note Off
          const note = view.getUint8(offset++);
          offset++; // skip velocity
          rawNoteEvents.push({
            tick: currentTick,
            type: 'off',
            midi: note,
            velocity: 0,
          });
        } else if (msgType === 0xc0 || msgType === 0xd0) {
          // Program Change / Channel Pressure (1 data byte)
          offset += 1;
        } else {
          // CC, Pitch bend, Poly pressure (2 data bytes)
          offset += 2;
        }
      }
    }

    // Match NoteOn and NoteOff into TimedNoteEvent
    rawNoteEvents.sort((a, b) => a.tick - b.tick);
    const activeNoteStarts = new Map<number, Array<{ tick: number; velocity: number }>>();
    const finishedNotes: TimedNoteEvent[] = [];
    const secondsPerTick = microsecondsPerBeat / 1000000 / ticksPerBeat;

    for (const ev of rawNoteEvents) {
      if (ev.type === 'on') {
        const queue = activeNoteStarts.get(ev.midi) || [];
        queue.push({ tick: ev.tick, velocity: ev.velocity });
        activeNoteStarts.set(ev.midi, queue);
      } else if (ev.type === 'off') {
        const queue = activeNoteStarts.get(ev.midi);
        if (queue && queue.length > 0) {
          const start = queue.shift()!;
          const startTime = start.tick * secondsPerTick;
          const duration = Math.max(0.08, (ev.tick - start.tick) * secondsPerTick);
          finishedNotes.push({
            midi: ev.midi,
            velocity: start.velocity,
            time: startTime,
            duration,
          });
          if (queue.length === 0) {
            activeNoteStarts.delete(ev.midi);
          }
        }
      }
    }

    return finishedNotes;
  }
}

export const midiPlayerInstance = new MidiFilePlayer();
