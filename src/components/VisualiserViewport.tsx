import { useRef, useEffect, useState, memo } from 'react';
import {
  VisualiserConfig,
  LayoutCellNode,
  LayoutFlexDirection,
  VisualiserModuleType,
  LayoutMode,
} from '../core/types';
import { RenderCoordinator, renderCoordinatorInstance } from '../core/render-coordinator';
import { FlexLayoutRenderer } from './FlexLayoutRenderer';
import { getAllCellNodes } from '../core/layout-models';
import { Plus, RotateCcw, Share2, Check } from 'lucide-react';

interface VisualiserViewportProps {
  config: VisualiserConfig;
  coordinator?: RenderCoordinator;
  onUpdateCell?: (updated: LayoutCellNode) => void;
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

export const VisualiserViewport = memo<VisualiserViewportProps>(function VisualiserViewport({
  config,
  coordinator,
  onUpdateCell,
  isEditMode = false,
  onToggleEditMode,
  onSplitCell,
  onRemoveCell,
  onDuplicateCell,
  onAddCell,
  onResetLayout,
  onShareLayout,
}) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null);
  const postProcessingCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const coord = coordinator || renderCoordinatorInstance;

  // Register background canvas with coordinator
  useEffect(() => {
    const bg = bgCanvasRef.current;
    if (bg) {
      coord.registerBgCanvas(bg);
    }
    return () => {
      coord.unregisterBgCanvas();
    };
  }, [coord]);

  // Register 2D kinetic effects canvas with coordinator (sparks, shockwaves & 2D fallback)
  useEffect(() => {
    const effects = effectsCanvasRef.current;
    if (effects) {
      coord.registerEffectsCanvas(effects);
    }
    return () => {
      coord.unregisterEffectsCanvas();
    };
  }, [coord]);

  // Register WebGL hardware post-processing shader canvas with coordinator
  useEffect(() => {
    const postProcessing = postProcessingCanvasRef.current;
    if (postProcessing) {
      coord.registerPostProcessingCanvas(postProcessing);
    }
    return () => {
      coord.unregisterPostProcessingCanvas();
    };
  }, [coord]);

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
      if (effectsCanvasRef.current) {
        effectsCanvasRef.current.width = w;
        effectsCanvasRef.current.height = h;
        effectsCanvasRef.current.style.width = `${rect.width}px`;
        effectsCanvasRef.current.style.height = `${rect.height}px`;
      }
      if (postProcessingCanvasRef.current) {
        postProcessingCanvasRef.current.width = w;
        postProcessingCanvasRef.current.height = h;
        postProcessingCanvasRef.current.style.width = `${rect.width}px`;
        postProcessingCanvasRef.current.style.height = `${rect.height}px`;
      }
      coord.renderBackground();
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
  }, [coord]);

  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const layoutRoot = config.activeLayout?.root;
  const allCells = layoutRoot ? getAllCellNodes(layoutRoot) : [];
  const totalCells = allCells.length;
  const canDelete = totalCells > 1;

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col">
      {/* EDIT MODE: Dedicated Top Control Bar (docked in flow so it NEVER obstructs cell controls) */}
      {isEditMode && (
        <div className="flex-shrink-0 w-full bg-[#0b0f19]/95 backdrop-blur-xl border-b border-purple-500/40 px-3 sm:px-4 py-1.5 sm:py-2 z-30 shadow-lg flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Left: Layout Editor Status & Cell Counter Badge */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
              <span className="tracking-wide uppercase text-[11px] font-bold text-purple-200">Layout Editor</span>
            </div>
            <span className="text-[10px] sm:text-[11px] bg-purple-950/70 border border-purple-500/40 text-purple-300 px-2 py-0.5 rounded-full font-mono shrink-0">
              {totalCells} {totalCells === 1 ? 'cell' : 'cells'}
            </span>
          </div>

          {/* Right: Actions (Add Cell, Reset, Share, Done) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Add Cell */}
            {onAddCell && (
              <button
                onClick={() => onAddCell('row', 'stream')}
                className="flex items-center gap-1 text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded-md border border-slate-700 hover:border-purple-500/50 transition cursor-pointer"
                title="Add a new cell to layout"
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">Add Cell</span>
              </button>
            )}

            {/* Reset Layout */}
            {onResetLayout && (
              <button
                onClick={() => onResetLayout()}
                className="flex items-center gap-1 text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded-md border border-slate-700 hover:border-purple-500/50 transition cursor-pointer"
                title="Reset layout to preset"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {/* Share / Export Slug */}
            {onShareLayout && (
              <button
                onClick={() => {
                  onShareLayout();
                  setCopiedShareLink(true);
                  setTimeout(() => setCopiedShareLink(false), 2000);
                }}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  copiedShareLink
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-purple-300 border-slate-700 hover:border-purple-500/50'
                }`}
                title="Export and copy shareable layout link"
              >
                {copiedShareLink ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 text-purple-400" />
                )}
                <span className="hidden sm:inline">{copiedShareLink ? 'Link Copied!' : 'Share'}</span>
              </button>
            )}

            <div className="h-4 w-px bg-slate-700/80 mx-0.5 shrink-0" />

            {/* Done Editing */}
            {onToggleEditMode && (
              <button
                onClick={onToggleEditMode}
                className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-semibold px-3 py-1 rounded-md shadow-[0_0_10px_rgba(168,85,247,0.3)] transition cursor-pointer"
                title="Exit layout edit mode"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Canvas & Cells Viewport Area */}
      <div ref={containerRef} className="relative flex-1 w-full h-full min-h-0 min-w-0 overflow-hidden p-2 sm:p-2.5">
        {/* 1. Global Display Background Canvas (seamless theme across whole display) */}
        <canvas ref={bgCanvasRef} className="absolute inset-0 block w-full h-full pointer-events-none" />

        {/* 2. Flexbox Multi-Cell Layout Engine (renders modular cell hierarchy) */}
        <div className="relative z-10 w-full h-full min-h-0 min-w-0">
          {layoutRoot && (
            <FlexLayoutRenderer
              node={layoutRoot}
              config={config}
              coordinator={coord}
              onUpdateCell={onUpdateCell}
              isEditMode={isEditMode}
              canDelete={canDelete}
              onSplitCell={onSplitCell}
              onRemoveCell={onRemoveCell}
              onDuplicateCell={onDuplicateCell}
            />
          )}
        </div>

        {/* 3. 2D Kinetic Effects Layer (reactive sparks & expanding shockwave rings) */}
        <canvas
          ref={effectsCanvasRef}
          className="absolute inset-0 block w-full h-full pointer-events-none z-20"
        />

        {/* 4. Fullscreen Hardware WebGL Post-Processing Shader (CRT scanlines, barrel curve, lens flares, film grain) */}
        <canvas
          ref={postProcessingCanvasRef}
          className="absolute inset-0 block w-full h-full pointer-events-none z-25"
        />
      </div>
    </div>
  );
});
