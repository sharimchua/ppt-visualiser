import { TimedNoteEvent } from './demo-tracks';

/**
 * Encodes an array of TimedNoteEvent objects into a Standard MIDI File (SMF Format 0) byte array.
 * Produces 100% compliant, standard .mid binary data suitable for DAW import, web download, or playback.
 */
export function encodeNotesToMidi(
  notes: TimedNoteEvent[],
  trackName: string = 'PPT Visualiser Demo',
  bpm: number = 120
): Uint8Array {
  const ticksPerBeat = 480;
  const microsPerBeat = Math.round(60000000 / bpm);
  const ticksPerSecond = (ticksPerBeat * 1000000) / microsPerBeat;

  // Flatten notes into On and Off events
  interface RawEvent {
    tick: number;
    type: 'on' | 'off';
    midi: number;
    velocity: number;
  }

  const events: RawEvent[] = [];
  for (const n of notes) {
    const onTick = Math.max(0, Math.round(n.time * ticksPerSecond));
    const offTick = Math.max(onTick + 1, Math.round((n.time + n.duration) * ticksPerSecond));
    events.push({
      tick: onTick,
      type: 'on',
      midi: Math.max(0, Math.min(127, Math.round(n.midi))),
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity * 127))),
    });
    events.push({
      tick: offTick,
      type: 'off',
      midi: Math.max(0, Math.min(127, Math.round(n.midi))),
      velocity: 0,
    });
  }

  // Sort events by tick. For events at identical tick, Off comes before On to prevent voice choking
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.type === 'off' && b.type === 'on') return -1;
    if (a.type === 'on' && b.type === 'off') return 1;
    return a.midi - b.midi;
  });

  const trackBytes: number[] = [];

  // Helper to append variable-length quantity
  function writeVLQ(value: number) {
    const buffer: number[] = [];
    buffer.push(value & 0x7f);
    let v = value >>> 7;
    while (v > 0) {
      buffer.unshift((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    for (const b of buffer) trackBytes.push(b);
  }

  // Track Name meta event at tick 0
  writeVLQ(0);
  trackBytes.push(0xff, 0x03);
  const nameBytes = Array.from(new TextEncoder().encode(trackName));
  writeVLQ(nameBytes.length);
  trackBytes.push(...nameBytes);

  // Set Tempo meta event at tick 0
  writeVLQ(0);
  trackBytes.push(0xff, 0x51, 0x03);
  trackBytes.push((microsPerBeat >> 16) & 0xff);
  trackBytes.push((microsPerBeat >> 8) & 0xff);
  trackBytes.push(microsPerBeat & 0xff);

  // Note events
  let lastTick = 0;
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - lastTick);
    writeVLQ(delta);
    lastTick = ev.tick;

    if (ev.type === 'on') {
      trackBytes.push(0x90, ev.midi, ev.velocity);
    } else {
      trackBytes.push(0x80, ev.midi, 0x40);
    }
  }

  // End of Track meta event
  writeVLQ(0);
  trackBytes.push(0xff, 0x2f, 0x00);

  // Build full SMF Format 0 file
  const totalLength = 14 + 8 + trackBytes.length;
  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer);

  // MThd chunk
  out.set([0x4d, 0x54, 0x68, 0x64], 0); // "MThd"
  view.setUint32(4, 6); // header length
  view.setUint16(8, 0); // format 0
  view.setUint16(10, 1); // 1 track
  view.setUint16(12, ticksPerBeat); // division

  // MTrk chunk
  out.set([0x4d, 0x54, 0x72, 0x6b], 14); // "MTrk"
  view.setUint32(18, trackBytes.length);
  out.set(trackBytes, 22);

  return out;
}

/**
 * Triggers a browser file download of a TimedNoteEvent sequence as a standard .mid file.
 */
export function downloadNotesAsMidiFile(notes: TimedNoteEvent[], filename: string, title?: string): void {
  const bytes = encodeNotesToMidi(notes, title || filename);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.mid') ? filename : `${filename}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
