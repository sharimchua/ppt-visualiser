import React, { useRef, useEffect } from 'react';
import { VisualiserConfig, ActiveNote, StreamItem } from '../core/types';
import { PitchClockRenderer } from '../renderers/pitch-clock-canvas';
import { StreamRenderer } from '../renderers/stream-canvas';
import { CosmeticsEngine } from '../renderers/cosmetics';

interface VisualiserViewportProps {
  config: VisualiserConfig;
  activeNotes: Map<number, ActiveNote>;
  decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>;
  streamItems: StreamItem[];
  cosmeticsEngine: CosmeticsEngine;
  resetSessionCount?: number;
}

export const VisualiserViewport: React.FC<VisualiserViewportProps> = ({
  config,
  activeNotes,
  decayingNotes,
  streamItems,
  cosmeticsEngine,
  resetSessionCount = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pitchClockRendererRef = useRef(new PitchClockRenderer());
  const streamRendererRef = useRef(new StreamRenderer());

  useEffect(() => {
    if (resetSessionCount > 0) {
      pitchClockRendererRef.current.resetRevealsAndActivity();
    }
  }, [resetSessionCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = (time: number) => {
      // Dimensions
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width <= 0 || height <= 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Cosmetics: Render Background & Theme
      cosmeticsEngine.renderBackground(ctx, width, height, config.backgroundTheme, config.motionTrails);

      // 2. Update Cosmetics physics (particles, shockwaves)
      cosmeticsEngine.update();

      // 3. Responsive Window-Maximizing Layout Calculation
      const layout = config.layoutMode;
      let clockCx = width / 2;
      let clockCy = height / 2;
      let clockRadius = Math.min(width, height) * 0.45;

      if (layout === 'monument') {
        // Clock Monument: Pitch Clock takes maximized area, stream is compact bottom bar
        const streamHeight = Math.max(65, Math.min(100, height * 0.14));
        const clockHeight = height - streamHeight - 12;
        clockCx = width / 2;
        clockCy = clockHeight / 2;
        clockRadius = Math.min(width, clockHeight) * 0.45;

        ctx.save();
        pitchClockRendererRef.current.render(
          ctx,
          width,
          clockHeight,
          activeNotes,
          decayingNotes,
          config,
          time
        );
        ctx.restore();

        // Stream bar at bottom
        const streamWidth = Math.min(width - 40, 1100);
        const streamX = (width - streamWidth) / 2;
        const streamY = height - streamHeight - 8;

        streamRendererRef.current.render(
          ctx,
          streamX,
          streamY,
          streamWidth,
          streamHeight,
          streamItems,
          config,
          time
        );
      } else if (layout === 'river') {
        // Stream River: Dominant central scrolling stream, clock radar in corner
        const streamHeight = Math.min(height * 0.55, 300);
        const streamY = (height - streamHeight) / 2;
        const streamWidth = width - 40;
        const streamX = 20;

        streamRendererRef.current.render(
          ctx,
          streamX,
          streamY,
          streamWidth,
          streamHeight,
          streamItems,
          config,
          time
        );

        // Circular Pitch Clock Radar
        const radarSize = Math.min(width * 0.28, height * 0.32, 220);
        clockCx = (width - radarSize - 20) + radarSize / 2;
        clockCy = 20 + radarSize / 2;
        clockRadius = radarSize * 0.45;

        ctx.save();
        ctx.translate(width - radarSize - 20, 20);
        pitchClockRendererRef.current.render(
          ctx,
          radarSize,
          radarSize,
          activeNotes,
          decayingNotes,
          config,
          time
        );
        ctx.restore();
      } else {
        // Balanced Duo: Pitch Clock centered, Stream ribbon below
        const isLandscape = width > height * 1.3;
        if (isLandscape) {
          // Horizontal split: Pitch clock in left 62%, stream in right 38%
          const clockWidth = width * 0.62;
          clockCx = clockWidth / 2;
          clockCy = height / 2;
          clockRadius = Math.min(clockWidth, height) * 0.45;

          pitchClockRendererRef.current.render(
            ctx,
            clockWidth,
            height,
            activeNotes,
            decayingNotes,
            config,
            time
          );

          const streamX = clockWidth + 10;
          const streamWidth = width - clockWidth - 25;
          const streamHeight = height - 40;
          const streamY = 20;

          streamRendererRef.current.render(
            ctx,
            streamX,
            streamY,
            streamWidth,
            streamHeight,
            streamItems,
            config,
            time
          );
        } else {
          // Vertical split: Pitch clock on top (72%), stream at bottom (28%)
          const streamHeight = Math.max(80, Math.min(130, height * 0.22));
          const clockHeight = height - streamHeight - 16;
          clockCx = width / 2;
          clockCy = clockHeight / 2;
          clockRadius = Math.min(width, clockHeight) * 0.45;

          pitchClockRendererRef.current.render(
            ctx,
            width,
            clockHeight,
            activeNotes,
            decayingNotes,
            config,
            time
          );

          const streamWidth = Math.min(width - 24, 1200);
          const streamX = (width - streamWidth) / 2;
          const streamY = height - streamHeight - 8;

          streamRendererRef.current.render(
            ctx,
            streamX,
            streamY,
            streamWidth,
            streamHeight,
            streamItems,
            config,
            time
          );
        }
      }

      // 4. Render Analog Artifacts: Light Bleed / Halation & Phosphor Ghosting
      cosmeticsEngine.renderAnalogArtifacts(
        ctx,
        width,
        height,
        activeNotes,
        decayingNotes,
        clockCx,
        clockCy,
        clockRadius,
        config
      );

      // 5. Render Cosmetic Effects: Particles & Shockwaves
      cosmeticsEngine.renderEffects(ctx, config.glowBloom);

      // 6. Render Film Grain Overlay with Size & Contrast
      cosmeticsEngine.renderFilmGrain(
        ctx,
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
  }, [config, activeNotes, decayingNotes, streamItems, cosmeticsEngine]);

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

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />
    </div>
  );
};
