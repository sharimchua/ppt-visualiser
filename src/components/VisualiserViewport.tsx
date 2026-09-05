import React, { useRef, useEffect } from 'react';
import { VisualiserConfig, ActiveNote, StreamItem, LayoutCellNode } from '../core/types';
import { PitchClockRenderer } from '../renderers/pitch-clock-canvas';
import { StreamRenderer } from '../renderers/stream-canvas';
import { CosmeticsEngine } from '../renderers/cosmetics';
import { FlexLayoutRenderer } from './FlexLayoutRenderer';

interface VisualiserViewportProps {
  config: VisualiserConfig;
  activeNotes: Map<number, ActiveNote>;
  decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>;
  streamItems: StreamItem[];
  cosmeticsEngine: CosmeticsEngine;
  resetSessionCount?: number;
  onUpdateCell?: (updated: LayoutCellNode) => void;
  onToneCoordinatesResolved?: (lookup: (midi: number) => { x: number; y: number; radius: number; angle: number } | null) => void;
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
}) => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pitchClockRendererRef = useRef(new PitchClockRenderer());
  const streamRendererRef = useRef(new StreamRenderer());

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
  }, [onToneCoordinatesResolved, config.tonic, config.keyboardLowestMidi]);

  // Global whole-display cosmetics & atmosphere rendering loop
  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!bgCanvas || !overlayCanvas) return;

    const bgCtx = bgCanvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!bgCtx || !overlayCtx) return;

    let animId: number;

    const render = (_time: number) => {
      const dpr = window.devicePixelRatio || 1;
      const width = bgCanvas.width / dpr;
      const height = bgCanvas.height / dpr;

      if (width <= 0 || height <= 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      // 1. Render Global Display Background & Theme on background canvas
      bgCtx.save();
      bgCtx.scale(dpr, dpr);
      cosmeticsEngine.renderBackground(bgCtx, width, height, config.backgroundTheme, config.motionTrails);
      bgCtx.restore();

      // 2. Update Cosmetics Physics (particles, shockwaves)
      cosmeticsEngine.update();

      // 3. Render Global Cosmetics & Analog Artifacts on top overlay canvas
      overlayCtx.save();
      overlayCtx.scale(dpr, dpr);
      overlayCtx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.45;

      // Analog artifacts (light bleed halation, phosphor ghosting)
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

      overlayCtx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [config, activeNotes, decayingNotes, cosmeticsEngine]);

  // High-DPI canvas resizing
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const bgCanvas = bgCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!container || !bgCanvas || !overlayCanvas) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const pixelWidth = rect.width * dpr;
      const pixelHeight = rect.height * dpr;

      bgCanvas.width = pixelWidth;
      bgCanvas.height = pixelHeight;
      bgCanvas.style.width = `${rect.width}px`;
      bgCanvas.style.height = `${rect.height}px`;

      overlayCanvas.width = pixelWidth;
      overlayCanvas.height = pixelHeight;
      overlayCanvas.style.width = `${rect.width}px`;
      overlayCanvas.style.height = `${rect.height}px`;
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
            onUpdateCell={onUpdateCell}
          />
        )}
      </div>

      {/* 3. Global Whole-Display Cosmetics & Atmosphere Overlay (film grain, light bleed, phosphor ghosting) */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 block w-full h-full pointer-events-none z-20"
      />
    </div>
  );
};

