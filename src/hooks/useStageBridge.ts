import { useEffect, useRef, useCallback } from 'react';
import { VisualiserConfig } from '../core/types';
import { pickSyncableConfig } from '../core/stage-sync-utils';
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

function getInitialRole(): 'teacher' | 'student' {
  if (typeof window === 'undefined') return 'student';
  return new URLSearchParams(window.location.search).get('role') === 'teacher'
    ? 'teacher'
    : 'student';
}

function postToParent(msg: Record<string, unknown>): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage({ protocol: STAGE_PROTOCOL, appId: APP_ID, ...msg }, '*');
}

function mountAudioPromptPill(onTap: () => void) {
  let el: HTMLButtonElement | null = null;
  const hide = () => {
    if (el) {
      el.remove();
      el = null;
    }
  };
  const show = () => {
    if (el || typeof document === 'undefined' || !document.body) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Tap to Enable Sound';
    btn.style.cssText =
      'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      'padding:10px 18px;border-radius:9999px;border:1px solid rgba(34,211,238,0.55);' +
      'background:rgba(15,23,42,0.95);color:#67e8f9;font:600 13px/1.2 system-ui,sans-serif;' +
      'box-shadow:0 10px 28px rgba(0,0,0,0.45);cursor:pointer;backdrop-filter:blur(8px);';
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onTap();
    });
    document.body.appendChild(btn);
    el = btn;
  };
  return { show, hide, destroy: hide };
}

interface UseStageBridgeOptions {
  config: VisualiserConfig;
  setConfig: React.Dispatch<React.SetStateAction<VisualiserConfig>>;
}

export function useStageBridge({ config, setConfig }: UseStageBridgeOptions) {
  const embedded = isStageEmbedded();
  const isApplyingRemoteRef = useRef(false);
  const roleRef = useRef<'teacher' | 'student'>(getInitialRole());
  const lastSentJsonRef = useRef(JSON.stringify(pickSyncableConfig(config)));
  const throttleRef = useRef<number | null>(null);
  const setConfigRef = useRef(setConfig);
  setConfigRef.current = setConfig;
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!embedded) return;

    renderCoordinatorInstance.setStageMode(true);

    const pushCurrentState = () => {
      const syncable = pickSyncableConfig(configRef.current);
      const encoded = JSON.stringify(syncable);
      lastSentJsonRef.current = encoded;
      postToParent({ type: 'APP_STATE_UPDATE', state: syncable });
    };

    const handleGestureUnlock = () => {
      if (synthInstance.getAudioState() === 'running') {
        prompt.hide();
        return;
      }
      void synthInstance.unlock().then((audioState) => {
        postToParent({ type: 'STAGE_AUDIO_STATE', audioState });
        if (audioState === 'running') {
          prompt.hide();
        }
      });
    };

    const prompt = mountAudioPromptPill(handleGestureUnlock);
    const onPointerUnlock = () => {
      if (synthInstance.getAudioState() !== 'running') {
        handleGestureUnlock();
      }
    };
    window.addEventListener('pointerdown', onPointerUnlock, true);

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
          roleRef.current = data.role === 'teacher' ? 'teacher' : 'student';
          midiManagerInstance.setSuppressed(Boolean(data.suppressLocalMidi));
          if (typeof data.ecoMode === 'boolean') {
            const nextProfile = data.ecoMode ? 'eco' : 'max';
            setConfigRef.current((prev) =>
              prev.performanceProfile === nextProfile
                ? prev
                : { ...prev, performanceProfile: nextProfile }
            );
          }
          if (roleRef.current === 'teacher') {
            pushCurrentState();
          }
          break;
        }
        case 'STAGE_ECO_MODE': {
          if (typeof data.ecoMode === 'boolean') {
            const nextProfile = data.ecoMode ? 'eco' : 'max';
            setConfigRef.current((prev) =>
              prev.performanceProfile === nextProfile
                ? prev
                : { ...prev, performanceProfile: nextProfile }
            );
          }
          break;
        }
        case 'STAGE_REQUEST_STATE': {
          if (roleRef.current === 'teacher') {
            pushCurrentState();
          }
          break;
        }
        case 'STAGE_UNLOCK_AUDIO': {
          void synthInstance.unlock().then((audioState) => {
            postToParent({ type: 'STAGE_AUDIO_STATE', audioState });
            if (audioState !== 'running') {
              prompt.show();
            } else {
              prompt.hide();
            }
          });
          break;
        }
        case 'STAGE_MIDI': {
          const ev = data.event;
          if (ev === 'noteOn' && typeof data.midi === 'number') {
            const vel = typeof data.velocity === 'number' ? data.velocity : 0.8;
            renderCoordinatorInstance.triggerRemoteNoteOn(data.midi, vel);
            if (synthInstance.getAudioState() !== 'running') {
              prompt.show();
            }
          } else if (ev === 'noteOff' && typeof data.midi === 'number') {
            renderCoordinatorInstance.triggerRemoteNoteOff(data.midi);
          } else if (ev === 'allNotesOff') {
            renderCoordinatorInstance.clearActiveAndDecayingNotes();
          }
          break;
        }
        case 'REMOTE_STATE': {
          const rawState = data.state as Partial<VisualiserConfig> | null;
          if (!rawState || typeof rawState !== 'object') break;
          const st = pickSyncableConfig(rawState);
          isApplyingRemoteRef.current = true;
          setConfigRef.current((prev) => {
            const merged = { ...prev, ...st };
            lastSentJsonRef.current = JSON.stringify(pickSyncableConfig(merged));
            return merged;
          });
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
            if (synthInstance.getAudioState() !== 'running') {
              prompt.show();
            }
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
      window.removeEventListener('pointerdown', onPointerUnlock, true);
      prompt.destroy();
      renderCoordinatorInstance.onLocalNoteDispatch = undefined;
      renderCoordinatorInstance.setStageMode(false);
      midiManagerInstance.setSuppressed(false);
    };
  }, [embedded]);

  // Throttled outbound config sync (musical & layout state only; cosmetics stay device-local)
  useEffect(() => {
    if (!embedded || isApplyingRemoteRef.current) return;
    const syncable = pickSyncableConfig(config);
    const encoded = JSON.stringify(syncable);
    if (encoded === lastSentJsonRef.current) return;

    if (throttleRef.current !== null) {
      window.clearTimeout(throttleRef.current);
    }
    throttleRef.current = window.setTimeout(() => {
      throttleRef.current = null;
      if (isApplyingRemoteRef.current) return;
      lastSentJsonRef.current = encoded;
      postToParent({ type: 'APP_STATE_UPDATE', state: syncable });
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
