import { useEffect, useRef, useCallback } from 'react';
import { VisualiserConfig } from '../core/types';
import { synthInstance } from '../core/audio-synth';
import { midiManagerInstance } from '../core/midi-manager';
import { renderCoordinatorInstance } from '../core/render-coordinator';

const STAGE_PROTOCOL = 'midlifemuso-stage-v1';
const APP_ID = 'visualiser';

export function isStageEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.parent !== window &&
      new URLSearchParams(window.location.search).get('stage') === '1'
    );
  } catch {
    return false;
  }
}

function postToParent(msg: Record<string, unknown>): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage({ protocol: STAGE_PROTOCOL, appId: APP_ID, ...msg }, '*');
}

interface UseStageBridgeOptions {
  config: VisualiserConfig;
  setConfig: React.Dispatch<React.SetStateAction<VisualiserConfig>>;
}

export function useStageBridge({ config, setConfig }: UseStageBridgeOptions) {
  const embedded = isStageEmbedded();
  const isApplyingRemoteRef = useRef(false);
  const lastSentJsonRef = useRef('');
  const throttleRef = useRef<number | null>(null);
  const setConfigRef = useRef(setConfig);
  setConfigRef.current = setConfig;

  useEffect(() => {
    if (!embedded) return;

    renderCoordinatorInstance.setStageMode(true);
    postToParent({
      type: 'STAGE_READY',
      audioState: synthInstance.getAudioState(),
    });

    renderCoordinatorInstance.onLocalNoteDispatch = (event, midi, velocity) => {
      if (isApplyingRemoteRef.current) return;
      postToParent({
        type: 'APP_ACTION',
        action: event === 'noteOn' ? 'MIDI_NOTE_ON' : 'MIDI_NOTE_OFF',
        payload: { midi, velocity },
      });
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.protocol !== STAGE_PROTOCOL || typeof data.type !== 'string') return;

      switch (data.type) {
        case 'STAGE_INIT': {
          midiManagerInstance.setSuppressed(Boolean(data.suppressLocalMidi));
          break;
        }
        case 'STAGE_UNLOCK_AUDIO': {
          void synthInstance.unlock().then((audioState) => {
            postToParent({ type: 'STAGE_AUDIO_STATE', audioState });
          });
          break;
        }
        case 'STAGE_MIDI': {
          const ev = data.event;
          if (ev === 'noteOn' && typeof data.midi === 'number') {
            const vel = typeof data.velocity === 'number' ? data.velocity : 0.8;
            renderCoordinatorInstance.triggerRemoteNoteOn(data.midi, vel);
          } else if (ev === 'noteOff' && typeof data.midi === 'number') {
            renderCoordinatorInstance.triggerRemoteNoteOff(data.midi);
          } else if (ev === 'allNotesOff') {
            renderCoordinatorInstance.clearActiveAndDecayingNotes();
          }
          break;
        }
        case 'REMOTE_STATE': {
          const st = data.state as Partial<VisualiserConfig> | null;
          if (!st || typeof st !== 'object') break;
          isApplyingRemoteRef.current = true;
          setConfigRef.current((prev) => ({
            ...prev,
            ...st,
          }));
          window.setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 50);
          break;
        }
        case 'REMOTE_ACTION': {
          const action = data.action;
          const payload = data.payload as Record<string, unknown> | undefined;
          isApplyingRemoteRef.current = true;
          if (action === 'RESET_SESSION') {
            renderCoordinatorInstance.resetSession();
          } else if (action === 'MIDI_NOTE_ON' && typeof payload?.midi === 'number') {
            const vel = typeof payload.velocity === 'number' ? payload.velocity : 0.8;
            renderCoordinatorInstance.triggerRemoteNoteOn(payload.midi, vel);
          } else if (action === 'MIDI_NOTE_OFF' && typeof payload?.midi === 'number') {
            renderCoordinatorInstance.triggerRemoteNoteOff(payload.midi);
          }
          window.setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 20);
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      renderCoordinatorInstance.onLocalNoteDispatch = undefined;
      renderCoordinatorInstance.setStageMode(false);
      midiManagerInstance.setSuppressed(false);
    };
  }, [embedded]);

  // Throttled outbound config sync
  useEffect(() => {
    if (!embedded || isApplyingRemoteRef.current) return;
    const encoded = JSON.stringify(config);
    if (encoded === lastSentJsonRef.current) return;

    if (throttleRef.current !== null) {
      window.clearTimeout(throttleRef.current);
    }
    throttleRef.current = window.setTimeout(() => {
      throttleRef.current = null;
      if (isApplyingRemoteRef.current) return;
      lastSentJsonRef.current = encoded;
      postToParent({ type: 'APP_STATE_UPDATE', state: config });
    }, 120);

    return () => {
      if (throttleRef.current !== null) {
        window.clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [embedded, config]);

  const broadcastResetSession = useCallback(() => {
    if (!embedded || isApplyingRemoteRef.current) return;
    postToParent({ type: 'APP_ACTION', action: 'RESET_SESSION' });
  }, [embedded]);

  return { isEmbedded: embedded, broadcastResetSession };
}
