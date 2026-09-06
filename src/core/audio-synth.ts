import { SynthWaveform } from './types';

interface Voice {
  midi: number;
  osc: OscillatorNode;
  subOsc?: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  releaseTime: number;
}

export class AudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeVoices: Map<number, Voice> = new Map();
  private isMuted: boolean = false;
  private volume: number = 0.75;
  private waveform: SynthWaveform = 'warm-poly';

  // Focus and multi-instance lifecycle management
  private focusModeEnabled: boolean = true;
  private mockFocusedState: boolean | null = null;

  private handleFocusChange = () => {
    const focused = this.isWindowFocused();
    if (!focused && this.focusModeEnabled) {
      this.stopAll(true);
    }
  };

  constructor() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', this.handleFocusChange);
      window.addEventListener('blur', this.handleFocusChange);
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', this.handleFocusChange);
    }
  }

  public isWindowFocused(): boolean {
    if (this.mockFocusedState !== null) return this.mockFocusedState;
    if (typeof document === 'undefined') return true;
    return document.hasFocus() && !document.hidden;
  }

  public setFocusMode(enabled: boolean) {
    this.focusModeEnabled = enabled;
    if (!this.isWindowFocused() && enabled) {
      this.stopAll(true);
    }
  }

  public getFocusMode(): boolean {
    return this.focusModeEnabled;
  }

  public setFocusedForTesting(focused: boolean | null) {
    this.mockFocusedState = focused;
    if (focused === false && this.focusModeEnabled) {
      this.stopAll(true);
    }
  }

  private initContext() {
    if (!this.ctx) {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public setWaveform(waveform: SynthWaveform) {
    this.waveform = waveform;
  }

  public noteOn(midi: number, velocity: number = 0.8) {
    if (this.focusModeEnabled && !this.isWindowFocused()) {
      return;
    }
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    // Release any existing voice on this MIDI note
    if (this.activeVoices.has(midi)) {
      this.noteOff(midi);
    }

    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const now = this.ctx.currentTime;

    // Gain Envelope
    const voiceGain = this.ctx.createGain();
    const peakGain = Math.max(0.01, Math.min(1, velocity)) * 0.35;
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.exponentialRampToValueAtTime(peakGain, now + 0.008); // snappy attack
    voiceGain.gain.exponentialRampToValueAtTime(peakGain * 0.75, now + 0.18); // decay to sustain

    // Dynamic Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = Math.min(12000, freq * (2.5 + velocity * 3.5));
    filter.frequency.setValueAtTime(cutoff, now);
    filter.Q.setValueAtTime(2.0, now);

    // Oscillators
    let osc: OscillatorNode;
    let subOsc: OscillatorNode | undefined;

    if (this.waveform === 'warm-poly') {
      // Primary triangle with slight detuned sub/overtone for analog warmth
      osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq * 0.5, now); // 1 octave below sub-bass
      subOsc.detune.setValueAtTime(4, now);

      subOsc.connect(filter);
      subOsc.start(now);
    } else {
      osc = this.ctx.createOscillator();
      osc.type = this.waveform;
      osc.frequency.setValueAtTime(freq, now);
    }

    osc.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(this.masterGain);
    osc.start(now);

    this.activeVoices.set(midi, {
      midi,
      osc,
      subOsc,
      filter,
      gain: voiceGain,
      releaseTime: 0.35,
    });
  }

  public noteOff(midi: number) {
    if (!this.ctx) return;
    const voice = this.activeVoices.get(midi);
    if (!voice) return;

    const now = this.ctx.currentTime;
    const release = voice.releaseTime;

    // Smooth exponential release ramp
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.00001, now + release);

    // Stop and disconnect
    voice.osc.stop(now + release + 0.05);
    if (voice.subOsc) {
      voice.subOsc.stop(now + release + 0.05);
    }

    setTimeout(() => {
      voice.osc.disconnect();
      if (voice.subOsc) voice.subOsc.disconnect();
      voice.filter.disconnect();
      voice.gain.disconnect();
    }, (release + 0.1) * 1000);

    this.activeVoices.delete(midi);
  }

  public stopAll(immediate: boolean = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [midi, voice] of this.activeVoices.entries()) {
      if (immediate) {
        try {
          voice.gain.gain.cancelScheduledValues(now);
          voice.gain.gain.setValueAtTime(0.00001, now);
          voice.osc.stop(now + 0.01);
          if (voice.subOsc) voice.subOsc.stop(now + 0.01);
          voice.osc.disconnect();
          if (voice.subOsc) voice.subOsc.disconnect();
          voice.filter.disconnect();
          voice.gain.disconnect();
        } catch {
          // Ignore if oscillator was already stopped
        }
      } else {
        this.noteOff(midi);
      }
    }
    if (immediate) {
      this.activeVoices.clear();
    }
  }

  public destroy() {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('focus', this.handleFocusChange);
      window.removeEventListener('blur', this.handleFocusChange);
    }
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', this.handleFocusChange);
    }
    this.stopAll(true);
  }
}

export const synthInstance = new AudioSynth();
