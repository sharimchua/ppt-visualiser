import React, { useRef, useEffect } from 'react';
import {
  VisualiserConfig,
  ActiveNote,
  StreamItem,
  LayoutCellNode,
  LayoutFlexDirection,
  VisualiserModuleType,
  LayoutMode,
} from '../core/types';
import { PitchClockRenderer } from '../renderers/pitch-clock-canvas';
import { StreamRenderer } from '../renderers/stream-canvas';
import { PianoTrianglesRenderer } from '../renderers/piano-triangles-canvas';
import { CosmeticsEngine } from '../renderers/cosmetics';
import { FlexLayoutRenderer } from './FlexLayoutRenderer';
import { getAllCellNodes } from '../core/layout-models';
import { Plus, RotateCcw, Share2, Check } from 'lucide-react';

interface VisualiserViewportProps {
  config: VisualiserConfig;
  activeNotes: Map<number, ActiveNote>;
  decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>;
  streamItems: StreamItem[];
  cosmeticsEngine: CosmeticsEngine;
  resetSessionCount?: number;
  onUpdateCell?: (updated: LayoutCellNode) => void;
  onToneCoordinatesResolved?: (lookup: (midi: number) => { x: number; y: number; radius: number; angle: number } | null) => void;
  // Layout Edit Mode Props
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  onSplitCell?: (targetCellId: string, direction: LayoutFlexDirection, newModule: VisualiserModuleType) => void;
  onRemoveCell?: (targetCellId: string) => void;
  onDuplicateCell?: (targetCellId: string) => void;
  onAddCell?: (direction: LayoutFlexDirection, newModule: VisualiserModuleType) => void;
  onResetLayout?: (presetKey?: LayoutMode) => void;
  onShareLayout?: () => void;
}

export const VisualiserViewport: React.FC<VisualiserViewportProps> = ({
  config,
  activeNotes,
  decayingNotes,
  streamItems,
  cosmeticsEngine,
  resetSessionCount = 0,
  onUpdateCell,
  onToneCoordinatesResolved,
  isEditMode = false,
  onToggleEditMode,
  onSplitCell,
  onRemoveCell,
  onDuplicateCell,
  onAddCell,
  onResetLayout,
  onShareLayout,
}) => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pitchClockRendererRef = useRef(new PitchClockRenderer());
  const streamRendererRef = useRef(new StreamRenderer());
  const pianoTrianglesRendererRef = useRef(new PianoTrianglesRenderer());

  useEffect(() => {
    if (resetSessionCount > 0) {
      pitchClockRendererRef.current.resetRevealsAndActivity();
    }
  }, [resetSessionCount]);

  useEffect(() => {
    if (onToneCoordinatesResolved) {
      onToneCoordinatesResolved((midi: number) => {
        const container = containerRef.current;
        if (!container) return null;
        const coords = pitchClockRendererRef.current.getToneCoordinates(
          midi,
          config.tonic,
          config.keyboardLowestMidi
        );
        if (!coords) return null;

        // PitchClockRenderer coordinates are local to its cell. Find the orbital cell element:
        const orbitalCellEl = container.querySelector('[data-module="orbital"]') as HTMLElement | null;
        if (orbitalCellEl) {
          const cellRect = orbitalCellEl.getBoundingClientRect();
          const vpRect = container.getBoundingClientRect();
          return {
            x: (cellRect.left - vpRect.left) + coords.x,
            y: (cellRect.top - vpRect.top) + coords.y,
            radius: coords.radius,
            angle: coords.angle,
          };
        }

        // Fallback to container center
        return {
          x: coords.x,
          y: coords.y,
          radius: coords.radius,
          angle: coords.angle,
        };
      });
    }
  }, [config.tonic, config.keyboardLowestMidi, onToneCoordinatesResolved]);

  // Unified global background canvas render loop
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width <= 0 || height <= 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Render seamless global theme gradient
      cosmeticsEngine.renderBackground(ctx, width, height, config.backgroundTheme);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [config.backgroundTheme, cosmeticsEngine]);

  // Unified whole-display cosmetics overlay loop (film grain, CRT scanlines, optical lens flares)
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width <= 0 || height <= 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Advance procedural grain, kinetics, and phosphor physics
      cosmeticsEngine.update();

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const overlayCtx = ctx;

      // Analog halation & phosphor ghosts
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.45;
      cosmeticsEngine.renderAnalogArtifacts(
        overlayCtx,
        width,
        height,
        activeNotes,
        decayingNotes,
        cx,
        cy,
        radius,
        config
      );

      // Reactive sparks & shockwaves
      cosmeticsEngine.renderEffects(overlayCtx, config.glowBloom);

      // Whole-display CRT scanlines & glass curvature vignette
      cosmeticsEngine.renderScanlines(
        overlayCtx,
        width,
        height,
        config.scanlineIntensity,
        config.scanlineDensity,
        config.crtVignette
      );

      // Whole-display film grain overlay (seamlessly spans all cells)
      cosmeticsEngine.renderFilmGrain(
        overlayCtx,
        width,
        height,
        config.filmGrainIntensity,
        config.filmGrainSize,
        config.filmGrainContrast
      );

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    config,
    activeNotes,
    decayingNotes,
    cosmeticsEngine,
  ]);

  // High-DPI canvas resizing
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (!container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);

      if (bgCanvasRef.current) {
        bgCanvasRef.current.width = w;
        bgCanvasRef.current.height = h;
        bgCanvasRef.current.style.width = `${rect.width}px`;
        bgCanvasRef.current.style.height = `${rect.height}px`;
      }
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = w;
        overlayCanvasRef.current.height = h;
        overlayCanvasRef.current.style.width = `${rect.width}px`;
        overlayCanvasRef.current.style.height = `${rect.height}px`;
      }
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

  const layoutRoot = config.activeLayout?.root;
  const allCells = layoutRoot ? getAllCellNodes(layoutRoot) : [];
  const totalCells = allCells.length;
  const canDelete = totalCells > 1;

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden p-2.5">
      {/* 1. Global Display Background Canvas (seamless theme across whole display) */}
      <canvas ref={bgCanvasRef} className="absolute inset-0 block w-full h-full pointer-events-none" />

      {/* 2. Flexbox Multi-Cell Layout Engine (renders modular cell hierarchy) */}
      <div className="relative z-10 w-full h-full">
        {layoutRoot && (
          <FlexLayoutRenderer
            node={layoutRoot}
            config={config}
            activeNotes={activeNotes}
            decayingNotes={decayingNotes}
            streamItems={streamItems}
            pitchClockRenderer={pitchClockRendererRef.current}
            streamRenderer={streamRendererRef.current}
            pianoTrianglesRenderer={pianoTrianglesRendererRef.current}
            onUpdateCell={onUpdateCell}
            isEditMode={isEditMode}
            canDelete={canDelete}
            onSplitCell={onSplitCell}
            onRemoveCell={onRemoveCell}
            onDuplicateCell={onDuplicateCell}
          />
        )}
      </div>

      {/* 3. Global Whole-Display Cosmetics & Atmosphere Overlay (film grain, light bleed, phosphor ghosting) */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 block w-full h-full pointer-events-none z-20"
      />

      {/* 4. EDIT MODE: Top Floating Status & Action Pill Bar */}
      {isEditMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#0b0f19]/95 backdrop-blur-xl border border-purple-500/70 shadow-2xl px-3 py-1.5 rounded-full animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 pl-1">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span>Layout Editor</span>
            <span className="text-[11px] text-slate-400 font-mono font-normal">
              ({totalCells} {totalCells === 1 ? 'cell' : 'cells'})
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700/80 mx-1" />

          {/* Quick Add Cell */}
          {onAddCell && (
            <button
              onClick={() => onAddCell('row', 'stream')}
              className="flex items-center gap-1 text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded-full border border-slate-700 transition"
              title="Add a new cell to layout"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span>Add Cell</span>
            </button>
          )}

          {/* Reset Layout */}
          {onResetLayout && (
            <button
              onClick={() => onResetLayout()}
              className="flex items-center gap-1 text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded-full border border-slate-700 transition"
              title="Reset layout to preset"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset</span>
            </button>
          )}

          {/* Share / Export Slug */}
          {onShareLayout && (
            <button
              onClick={onShareLayout}
              className="flex items-center gap-1 text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-purple-300 px-2.5 py-1 rounded-full border border-slate-700 transition"
              title="Export custom layout link"
            >
              <Share2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Share</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-700/80 mx-1" />

          {/* Done Editing */}
          {onToggleEditMode && (
            <button
              onClick={onToggleEditMode}
              className="flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-500 text-white font-medium px-3 py-1 rounded-full shadow transition"
              title="Exit layout edit mode"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
