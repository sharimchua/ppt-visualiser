import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_TRACKS } from '../src/core/demo-tracks';
import { encodeNotesToMidi } from '../src/core/midi-encoder';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, '../public/demo-midi');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log(`Generating ${DEMO_TRACKS.length} Standard MIDI Files (.mid) into ${targetDir}...`);

for (const track of DEMO_TRACKS) {
  const filePath = path.join(targetDir, `${track.id}.mid`);
  const midiBytes = encodeNotesToMidi(track.notes, `${track.title} (${track.composer})`);
  fs.writeFileSync(filePath, Buffer.from(midiBytes));
  console.log(`✓ Wrote ${track.id}.mid (${midiBytes.length} bytes, ${track.notes.length} notes, ${track.category})`);
}

console.log('All MIDI files successfully generated!');
