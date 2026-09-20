import React, { useEffect } from 'react';
import { midiManagerInstance } from '../core/midi-manager';

interface MidiPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseVirtualKeyboard: () => void;
}

export const MidiPermissionModal: React.FC<MidiPermissionModalProps> = ({
  isOpen,
  onClose,
  onUseVirtualKeyboard,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    onClose();
    await midiManagerInstance.requestAccess();
  };

  const handleVirtualKeyboard = () => {
    onClose();
    onUseVirtualKeyboard();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="midi-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-700/60 flex items-center justify-center text-red-400 text-xl shadow-inner">
              🎹
            </div>
            <div>
              <h2 id="midi-modal-title" className="text-lg font-semibold text-white tracking-wide">
                Connect MIDI Keyboard
              </h2>
              <p className="text-xs text-slate-400">Web MIDI Permission Request</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            aria-label="Close dialogue"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Plain Language Reassuring Body */}
        <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
          <p>
            To visualise what you play, the app needs permission to listen to notes from your MIDI keyboard or controller.
          </p>
          <p className="text-xs text-slate-400 bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
            This app only reads incoming notes and velocities as you play them. It cannot alter anything on your instrument, install software, or modify device settings.
          </p>
          <p className="text-xs text-slate-400">
            Click <strong className="text-slate-200">Connect MIDI</strong> below, then choose <strong className="text-slate-200">Allow</strong> when your browser prompts you.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            onClick={handleConnect}
            className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium text-sm transition shadow-lg shadow-red-950/40 text-center flex items-center justify-center gap-2"
          >
            <span>Connect MIDI</span>
            <span>→</span>
          </button>
          <button
            onClick={handleVirtualKeyboard}
            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition text-center"
          >
            Use On-Screen Keyboard
          </button>
        </div>
      </div>
    </div>
  );
};
