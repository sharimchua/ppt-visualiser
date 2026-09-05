import React, { useRef, useEffect } from 'react';
import { LayoutCellNode, VisualiserConfig, ActiveNote, StreamItem } from '../core/types';
import { PitchClockRenderer } from '../renderers/pitch-clock-canvas';
import { StreamRenderer } from '../renderers/stream-canvas';
import { Waves, ArrowRight, ArrowLeft, ArrowDown, ArrowUp } from 'lucide-react';

interface CellViewportProps {
  cell: LayoutCellNode;
  config: VisualiserConfig;
  activeNotes: Map<number, ActiveNote>;
  decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>;
  streamItems: StreamItem[];
  pitchClockRenderer: PitchClockRenderer;
  streamRenderer: StreamRenderer;
  onUpdateCell?: (updated: LayoutCellNode) => void;
}

export const CellViewport: React.FC<CellViewportProps> = ({
  cell,
  config,
  activeNotes,
  decayingNotes,
  streamItems,
  pitchClockRenderer,
  streamRenderer,
  onUpdateCell,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Merge cell-level config overrides onto base config
  const effectiveConfig: VisualiserConfig = {
    ...config,
    ...(cell.configOverrides || {}),
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = (time: number) => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width <= 0 || height <= 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear cell canvas (transparent backdrop so global cosmetics shine through)
      ctx.clearRect(0, 0, width, height);

      if (cell.module === 'orbital') {
        pitchClockRenderer.render(
          ctx,
          width,
          height,
          activeNotes,
          decayingNotes,
          effectiveConfig,
          time
        );
      } else {
        streamRenderer.render(
          ctx,
          0,
          0,
          width,
          height,
          streamItems,
          effectiveConfig,
          time
        );
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [cell, effectiveConfig, activeNotes, decayingNotes, streamItems, pitchClockRenderer, streamRenderer]);

  // Handle high-DPI canvas resizing
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleToggleDirection = () => {
    if (!onUpdateCell || cell.module !== 'stream') return;
    const isVert = effectiveConfig.orientation === 'vertical';
    let nextDir = effectiveConfig.direction;
    if (isVert) {
      nextDir = effectiveConfig.direction === 'ttb' ? 'btt' : 'ttb';
    } else {
      nextDir = effectiveConfig.direction === 'rtl' ? 'ltr' : 'rtl';
    }
    onUpdateCell({
      ...cell,
      configOverrides: {
        ...(cell.configOverrides || {}),
        direction: nextDir,
      },
    });
  };

  const handleToggleOrientation = () => {
    if (!onUpdateCell || cell.module !== 'stream') return;
    const isVert = effectiveConfig.orientation === 'vertical';
    const nextOrient = isVert ? 'horizontal' : 'vertical';
    const nextDir = nextOrient === 'vertical' ? 'ttb' : 'rtl';
    onUpdateCell({
      ...cell,
      configOverrides: {
        ...(cell.configOverrides || {}),
        orientation: nextOrient,
        direction: nextDir,
      },
    });
  };

  return (
    <div
      ref={containerRef}
      data-module={cell.module}
      className="relative w-full h-full min-w-0 min-h-0 overflow-hidden rounded-lg bg-slate-950/20 border border-slate-800/40 backdrop-blur-xs group"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* Floating Mini Cell Badge / Controls */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-md px-1.5 py-0.5 rounded border border-slate-700/60 text-[10px] text-slate-300 pointer-events-auto">
        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
          {cell.title || (cell.module === 'orbital' ? 'Orbital' : 'Stream')}
        </span>

        {cell.module === 'stream' && onUpdateCell && (
          <div className="flex items-center gap-1 border-l border-slate-700/80 pl-1">
            <button
              onClick={handleToggleOrientation}
              className="p-0.5 hover:bg-slate-800 rounded hover:text-white transition"
              title={`Switch orientation (${effectiveConfig.orientation})`}
            >
              {effectiveConfig.orientation === 'vertical' ? (
                <Waves className="w-3 h-3 text-orange-400 rotate-90" />
              ) : (
                <Waves className="w-3 h-3 text-orange-400" />
              )}
            </button>
            <button
              onClick={handleToggleDirection}
              className="p-0.5 hover:bg-slate-800 rounded hover:text-white transition font-mono text-[9px]"
              title={`Switch stream direction (${effectiveConfig.direction})`}
            >
              {effectiveConfig.direction === 'rtl' && <ArrowLeft className="w-3 h-3" />}
              {effectiveConfig.direction === 'ltr' && <ArrowRight className="w-3 h-3" />}
              {effectiveConfig.direction === 'ttb' && <ArrowDown className="w-3 h-3" />}
              {effectiveConfig.direction === 'btt' && <ArrowUp className="w-3 h-3" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
