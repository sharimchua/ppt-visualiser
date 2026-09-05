import { MidiDeviceState } from './types';

export type NoteOnCallback = (midi: number, velocity: number) => void;
export type NoteOffCallback = (midi: number) => void;

export class MidiManager {
  private midiAccess: MIDIAccess | null = null;
  private noteOnCallbacks: Set<NoteOnCallback> = new Set();
  private noteOffCallbacks: Set<NoteOffCallback> = new Set();
  private stateChangeCallbacks: Set<(state: MidiDeviceState) => void> = new Set();

  public state: MidiDeviceState = {
    inputs: [],
    selectedInputId: 'all', // Listen to all inputs by default
    isConnected: false,
  };

  private boundMessageHandler = (event: Event) => {
    this.handleMidiMessage(event as MIDIMessageEvent);
  };

  constructor() {
    // Attempt non-blocking request on startup
    this.requestAccess();
  }

  public async requestAccess(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      console.warn('[Web MIDI] navigator.requestMIDIAccess not supported in this browser.');
      this.state.isConnected = false;
      this.notifyState();
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      console.log('[Web MIDI] Access granted. Inputs found:', this.midiAccess.inputs.size);

      this.updateInputs();

      this.midiAccess.onstatechange = (e: Event) => {
        const port = (e as MIDIConnectionEvent).port;
        console.log(`[Web MIDI] Device state change: ${port?.name} (${port?.state}, ${port?.connection})`);
        this.updateInputs();
      };

      return true;
    } catch (err) {
      console.warn('[Web MIDI] Access failed or permission denied:', err);
      this.state.isConnected = false;
      this.notifyState();
      return false;
    }
  }

  private updateInputs() {
    if (!this.midiAccess) return;

    const inputList: Array<{ id: string; name: string; manufacturer?: string }> = [];
    
    // Unbind all existing listeners
    for (const input of this.midiAccess.inputs.values()) {
      input.onmidimessage = null;
      input.removeEventListener('midimessage', this.boundMessageHandler);
    }

    for (const input of this.midiAccess.inputs.values()) {
      inputList.push({
        id: input.id,
        name: input.name || `MIDI Port ${input.id}`,
        manufacturer: input.manufacturer || undefined,
      });

      // If 'all' is selected or this specific device is selected, attach listeners
      if (this.state.selectedInputId === 'all' || this.state.selectedInputId === input.id) {
        this.bindInput(input);
      }
    }

    this.state.inputs = inputList;
    this.state.isConnected = inputList.length > 0;

    // Default to 'all' if not set
    if (!this.state.selectedInputId) {
      this.state.selectedInputId = 'all';
      // Re-bind all
      for (const input of this.midiAccess.inputs.values()) {
        this.bindInput(input);
      }
    }

    this.notifyState();
  }

  private bindInput(input: MIDIInput) {
    console.log(`[Web MIDI] Binding listener to input: ${input.name} (${input.id})`);
    input.onmidimessage = this.boundMessageHandler;
    input.addEventListener('midimessage', this.boundMessageHandler);
  }

  public selectInput(id: string) {
    this.state.selectedInputId = id;
    if (this.midiAccess) {
      this.updateInputs();
    }
  }

  private handleMidiMessage(event: MIDIMessageEvent) {
    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data.length > 2 ? data[2] / 127 : 0.8;

    if (status === 0x90 && velocity > 0) {
      // Note On
      console.log(`[Web MIDI NoteOn] Note: ${note}, Velocity: ${Math.round(velocity * 127)}`);
      this.triggerNoteOn(note, velocity);
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      // Note Off
      console.log(`[Web MIDI NoteOff] Note: ${note}`);
      this.triggerNoteOff(note);
    }
  }

  public triggerNoteOn(midi: number, velocity: number = 0.8) {
    for (const cb of this.noteOnCallbacks) {
      cb(midi, velocity);
    }
  }

  public triggerNoteOff(midi: number) {
    for (const cb of this.noteOffCallbacks) {
      cb(midi);
    }
  }

  public onNoteOn(cb: NoteOnCallback) {
    this.noteOnCallbacks.add(cb);
    return () => this.noteOnCallbacks.delete(cb);
  }

  public onNoteOff(cb: NoteOffCallback) {
    this.noteOffCallbacks.add(cb);
    return () => this.noteOffCallbacks.delete(cb);
  }

  public onStateChange(cb: (state: MidiDeviceState) => void) {
    this.stateChangeCallbacks.add(cb);
    cb(this.state);
    return () => this.stateChangeCallbacks.delete(cb);
  }

  private notifyState() {
    for (const cb of this.stateChangeCallbacks) {
      cb(this.state);
    }
  }
}

export const midiManagerInstance = new MidiManager();
