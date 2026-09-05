import { useRef, useEffect, useState, memo } from 'react';
import {
  LayoutCellNode,
  VisualiserConfig,
  StreamOrientation,
  StreamDirection,
  VisualiserModuleType,
  LayoutFlexDirection,
} from '../core/types';
import { RenderCoordinator, renderCoordinatorInstance } from '../core/render-coordinator';
import {
  Waves,
  Triangle,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Settings,
  Columns,
  Rows,
  Trash2,
  Copy,
  X,
  Sliders,
  Check,
} from 'lucide-react';

interface CellViewportProps {
  cell: LayoutCellNode;
  config: VisualiserConfig;
  coordinator?: RenderCoordinator;
  onUpdateCell?: (updated: LayoutCellNode) => void;
  // Edit Mode Props
  isEditMode?: boolean;
  canDelete?: boolean;
  onSplitCell?: (targetCellId: string, direction: LayoutFlexDirection, newModule: VisualiserModuleType) => void;
  onRemoveCell?: (targetCellId: string) => void;
  onDuplicateCell?: (targetCellId: string) => void;
}

export const CellViewport = memo<CellViewportProps>(function CellViewport({
  cell,
  config,
  coordinator,
  onUpdateCell,
  isEditMode = false,
  canDelete = false,
  onSplitCell,
  onRemoveCell,
  onDuplicateCell,
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Merge cell-level config overrides onto base config
  const effectiveConfig: VisualiserConfig = {
    ...config,
    ...(cell.configOverrides || {}),
  };

  // Register cell canvas with central RenderCoordinator
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coord = coordinator || renderCoordinatorInstance;
    coord.registerCellCanvas(cell.id, canvas, cell.module, cell.configOverrides);

    return () => {
      coord.unregisterCellCanvas(cell.id);
    };
  }, [cell.id, coordinator]);

  // Keep cell canvas registration updated when module or config overrides change
  useEffect(() => {
    const coord = coordinator || renderCoordinatorInstance;
    coord.updateCellCanvas(cell.id, cell.module, cell.configOverrides);
  }, [cell.id, cell.module, cell.configOverrides, coordinator]);

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
    const nextOrient: StreamOrientation = isVert ? 'horizontal' : 'vertical';
    const nextDir: StreamDirection = nextOrient === 'vertical' ? 'ttb' : 'rtl';
    onUpdateCell({
      ...cell,
      configOverrides: {
        ...(cell.configOverrides || {}),
        orientation: nextOrient,
        direction: nextDir,
      },
    });
  };

  const handleSwitchModule = (nextModule: VisualiserModuleType) => {
    if (!onUpdateCell) return;
    onUpdateCell({
      ...cell,
      module: nextModule,
      title:
        nextModule === 'orbital'
          ? 'Pitch Clock'
          : nextModule === 'triangles'
          ? 'Piano Triangles'
          : 'Note Stream',
      configOverrides:
        nextModule === 'stream'
          ? {
              orientation: 'horizontal',
              direction: 'rtl',
            }
          : undefined,
    });
  };

  const handleUpdateFlex = (newFlex: number) => {
    if (!onUpdateCell) return;
    onUpdateCell({
      ...cell,
      flex: Math.max(1, Math.min(10, newFlex)),
    });
  };

  return (
    <div
      ref={containerRef}
      data-module={cell.module}
      className={`relative w-full h-full min-w-0 min-h-0 overflow-hidden rounded-lg bg-slate-950/20 backdrop-blur-xs group transition-all duration-150 ${
        isEditMode
          ? 'border-2 border-dashed border-purple-500/70 shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/30'
          : 'border border-slate-800/40'
      }`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* NORMAL MODE: Floating Mini Cell Badge / Controls on Hover */}
      {!isEditMode && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-md px-1.5 py-0.5 rounded border border-slate-700/60 text-[10px] text-slate-300 pointer-events-auto z-10">
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 flex items-center">
            {cell.module === 'triangles' && <Triangle className="w-2.5 h-2.5 text-red-400 mr-1 fill-red-500/40" />}
            {cell.title || (cell.module === 'orbital' ? 'Orbital' : cell.module === 'triangles' ? 'Scale Signature' : 'Stream')}
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
      )}

      {/* EDIT MODE: Interactive Control Header Bar */}
      {isEditMode && (
        <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1 z-20 pointer-events-auto bg-[#0b0f19]/90 backdrop-blur-md px-1.5 sm:px-2 py-1 rounded-md border border-purple-500/50 shadow-lg text-xs animate-in fade-in duration-150">
          {/* Left: Module Switcher & Flex Stepper */}
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <select
              value={cell.module}
              onChange={(e) => handleSwitchModule(e.target.value as VisualiserModuleType)}
              className="bg-purple-950/40 hover:bg-purple-900/50 text-[10px] sm:text-[11px] font-semibold text-purple-200 border border-purple-500/60 rounded px-1 sm:px-1.5 py-0.5 focus:outline-none cursor-pointer shrink-0"
            >
              <option value="orbital">🪐 Clock</option>
              <option value="stream">🌊 Stream</option>
              <option value="triangles">▲ Triangles</option>
            </select>

            {/* Flex weight adjuster */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-900/90 rounded border border-slate-700/80 px-1 sm:px-1.5 py-0.5 text-[10px] text-slate-300 shrink-0">
              <span className="text-slate-500 font-mono hidden sm:inline">flex:</span>
              <button
                onClick={() => handleUpdateFlex((cell.flex ?? 1) - 1)}
                disabled={(cell.flex ?? 1) <= 1}
                className="px-0.5 sm:px-1 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 font-bold"
                title="Decrease flex weight"
              >
                -
              </button>
              <span className="font-mono text-purple-400 font-bold">{cell.flex ?? 1}</span>
              <button
                onClick={() => handleUpdateFlex((cell.flex ?? 1) + 1)}
                disabled={(cell.flex ?? 1) >= 10}
                className="px-0.5 sm:px-1 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 font-bold"
                title="Increase flex weight"
              >
                +
              </button>
            </div>

            {cell.title && (
              <span className="text-[10px] text-slate-400 truncate max-w-[60px] sm:max-w-[120px] font-medium hidden sm:inline">
                {cell.title}
              </span>
            )}
          </div>

          {/* Right: Split, Duplicate, Config & Delete Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {/* Configure Cell Gear */}
            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className={`p-1 rounded border transition ${
                isConfigOpen
                  ? 'bg-purple-600 border-purple-400 text-white'
                  : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Configure Cell Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* Split Row (Side-by-side Columns) */}
            {onSplitCell && (
              <button
                onClick={() =>
                  onSplitCell(cell.id, 'row', cell.module === 'orbital' ? 'stream' : 'orbital')
                }
                className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 transition"
                title="Split Cell Horizontally (Side-by-side columns)"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Split Column (Stacked Rows) */}
            {onSplitCell && (
              <button
                onClick={() =>
                  onSplitCell(cell.id, 'column', cell.module === 'orbital' ? 'stream' : 'orbital')
                }
                className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 transition"
                title="Split Cell Vertically (Stacked rows)"
              >
                <Rows className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Duplicate Cell */}
            {onDuplicateCell && (
              <button
                onClick={() => onDuplicateCell(cell.id)}
                className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
                title="Duplicate Cell"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete Cell */}
            {onRemoveCell && (
              <button
                onClick={() => onRemoveCell(cell.id)}
                disabled={!canDelete}
                className={`p-1 rounded border transition ${
                  canDelete
                    ? 'bg-red-950/40 hover:bg-red-900/60 border-red-800/60 text-red-400 hover:text-red-200'
                    : 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
                title={canDelete ? 'Delete Cell' : 'Cannot delete only remaining cell'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* EDIT MODE: In-Cell Configuration Panel / Popover */}
      {isEditMode && isConfigOpen && onUpdateCell && (
        <div className="absolute inset-x-2 top-11 sm:top-12 max-h-[calc(100%-3rem)] sm:max-h-[calc(100%-3.5rem)] overflow-y-auto z-30 bg-[#0d121f]/95 backdrop-blur-xl border border-purple-500/60 rounded-lg p-2.5 sm:p-3 shadow-2xl space-y-2.5 sm:space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-purple-200 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>Cell Configuration ({cell.module})</span>
            </div>
            <button
              onClick={() => setIsConfigOpen(false)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title Input */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-medium block">Cell Title:</label>
            <input
              type="text"
              value={cell.title || ''}
              onChange={(e) => onUpdateCell({ ...cell, title: e.target.value })}
              placeholder={cell.module === 'orbital' ? 'Pitch Clock' : 'Note Stream'}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Flex Weight Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>Flex Proportion (Grow Weight):</span>
              <span className="font-mono text-purple-400 font-bold">{cell.flex ?? 1}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={cell.flex ?? 1}
              onChange={(e) => handleUpdateFlex(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Stream-Specific Options */}
          {cell.module === 'stream' && (
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <label className="text-[11px] text-orange-400 font-medium block uppercase tracking-wider">
                Note Stream Parameters
              </label>

              {/* Orientation Buttons */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-medium">Orientation:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() =>
                      onUpdateCell({
                        ...cell,
                        configOverrides: {
                          ...(cell.configOverrides || {}),
                          orientation: 'horizontal',
                          direction: 'rtl',
                        },
                      })
                    }
                    className={`py-1 px-2 rounded border text-[11px] font-medium transition ${
                      effectiveConfig.orientation === 'horizontal'
                        ? 'bg-purple-600/30 border-purple-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Horizontal Ribbon
                  </button>
                  <button
                    onClick={() =>
                      onUpdateCell({
                        ...cell,
                        configOverrides: {
                          ...(cell.configOverrides || {}),
                          orientation: 'vertical',
                          direction: 'ttb',
                        },
                      })
                    }
                    className={`py-1 px-2 rounded border text-[11px] font-medium transition ${
                      effectiveConfig.orientation === 'vertical'
                        ? 'bg-purple-600/30 border-purple-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Vertical Waterfall
                  </button>
                </div>
              </div>

              {/* Direction Buttons */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-medium">Flow Direction:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {effectiveConfig.orientation === 'horizontal' ? (
                    <>
                      <button
                        onClick={() =>
                          onUpdateCell({
                            ...cell,
                            configOverrides: {
                              ...(cell.configOverrides || {}),
                              direction: 'rtl',
                            },
                          })
                        }
                        className={`py-1 px-2 rounded border text-[10px] font-medium transition ${
                          effectiveConfig.direction === 'rtl'
                            ? 'bg-purple-600/30 border-purple-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Right-to-Left (Default)
                      </button>
                      <button
                        onClick={() =>
                          onUpdateCell({
                            ...cell,
                            configOverrides: {
                              ...(cell.configOverrides || {}),
                              direction: 'ltr',
                            },
                          })
                        }
                        className={`py-1 px-2 rounded border text-[10px] font-medium transition ${
                          effectiveConfig.direction === 'ltr'
                            ? 'bg-purple-600/30 border-purple-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Left-to-Right
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          onUpdateCell({
                            ...cell,
                            configOverrides: {
                              ...(cell.configOverrides || {}),
                              direction: 'ttb',
                            },
                          })
                        }
                        className={`py-1 px-2 rounded border text-[10px] font-medium transition ${
                          effectiveConfig.direction === 'ttb'
                            ? 'bg-purple-600/30 border-purple-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Top-to-Bottom (Waterfall)
                      </button>
                      <button
                        onClick={() =>
                          onUpdateCell({
                            ...cell,
                            configOverrides: {
                              ...(cell.configOverrides || {}),
                              direction: 'btt',
                            },
                          })
                        }
                        className={`py-1 px-2 rounded border text-[10px] font-medium transition ${
                          effectiveConfig.direction === 'btt'
                            ? 'bg-purple-600/30 border-purple-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Bottom-to-Top (Bubbles)
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Stream Mode */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-medium">Window Mode:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() =>
                      onUpdateCell({
                        ...cell,
                        configOverrides: {
                          ...(cell.configOverrides || {}),
                          streamMode: 'continuous',
                        },
                      })
                    }
                    className={`py-1 px-2 rounded border text-[10px] font-medium transition ${
                      effectiveConfig.streamMode === 'continuous'
                        ? 'bg-purple-600/30 border-purple-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Continuous Conveyor
                  </button>
                  <button
                    onClick={() =>
                      onUpdateCell({
                        ...cell,
                        configOverrides: {
                          ...(cell.configOverrides || {}),
                          streamMode: 'fixed',
                        },
                      })
                    }
                    className={`py-1 px-2 rounded border text-[10px] font-medium transition ${
                      effectiveConfig.streamMode === 'fixed'
                        ? 'bg-purple-600/30 border-purple-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Fixed Queue Window
                  </button>
                </div>
              </div>

              {/* Register Filter */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-medium">Pitch Register Filter:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                  {[
                    { id: 'all' as const, label: 'All' },
                    { id: 'bass' as const, label: 'Bass (<C4)' },
                    { id: 'mid' as const, label: 'Mid' },
                    { id: 'treble' as const, label: 'Treble' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() =>
                        onUpdateCell({
                          ...cell,
                          configOverrides: {
                            ...(cell.configOverrides || {}),
                            streamFilterRegister: f.id,
                          },
                        })
                      }
                      className={`py-1 px-1 rounded border text-[10px] text-center font-medium transition ${
                        (effectiveConfig.streamFilterRegister || 'all') === f.id
                          ? 'bg-purple-600/30 border-purple-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Piano Triangles-Specific Options */}
          {cell.module === 'triangles' && (
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <label className="text-[11px] text-red-400 font-medium block uppercase tracking-wider">
                Piano Triangles (Scale Signature)
              </label>

              {/* Vertex Label Selection */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-medium">Vertex Labels:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {[
                    { id: 'syllables', label: 'Solfège (Do)' },
                    { id: 'pitches', label: 'Pitches (D)' },
                    { id: 'triPitches', label: 'Tri-Pitch' },
                    { id: 'intervals', label: 'Degrees (1..7)' },
                    { id: 'none', label: 'None (Pure)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        onUpdateCell({
                          ...cell,
                          configOverrides: {
                            ...(cell.configOverrides || {}),
                            vertexLabelType: opt.id as any,
                            showVertexLabels: opt.id !== 'none',
                          },
                        })
                      }
                      className={`py-1 px-1.5 rounded border text-[10px] font-medium transition ${
                        (effectiveConfig.vertexLabelType === opt.id && effectiveConfig.showVertexLabels) ||
                        (opt.id === 'none' && !effectiveConfig.showVertexLabels)
                          ? 'bg-purple-600/30 border-purple-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Center Anchor Guide Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-300 font-medium">Center Do Guide Axis:</span>
                <button
                  onClick={() =>
                    onUpdateCell({
                      ...cell,
                      configOverrides: {
                        ...(cell.configOverrides || {}),
                        showCenterAnchor: !effectiveConfig.showCenterAnchor,
                      },
                    })
                  }
                  className={`px-2.5 py-0.5 rounded border text-xs font-semibold transition ${
                    effectiveConfig.showCenterAnchor
                      ? 'bg-red-950/60 border-red-500/70 text-red-300'
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}
                >
                  {effectiveConfig.showCenterAnchor ? 'Active' : 'Hidden'}
                </button>
              </div>
            </div>
          )}

          {/* Close button */}
          <div className="pt-2 border-t border-slate-800/80 flex justify-end">
            <button
              onClick={() => setIsConfigOpen(false)}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded transition flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply & Close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
