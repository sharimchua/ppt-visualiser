# Renderers & Graphics Domain

## Purpose

The `src/renderers` domain contains all high-performance 2D Canvas and WebGL graphics engines responsible for visualizing musical structures, polar pitch clocks, piano triangles, note ribbons, and analog kinetic cosmetics.

## Ownership

- `src/renderers/pitch-clock-canvas.ts` — 8-octave concentric polar clock renderer, node layout, chord rays, convex hull polygons, and ring labels.
- `src/renderers/piano-triangles-canvas.ts` — Piano keyboard topography renderer (Scale Signature tetrachord mode and 4-triangle matrix).
- `src/renderers/stream-canvas.ts` — High-velocity directional note ribbon renderer (horizontal LTR/RTL, vertical TTB/BTT).
- `src/renderers/cosmetics.ts` — Canvas 2D effects engine (kinetic note sparks physics, analogue light bleed, halation, and optical lens flare starbursts).
- `src/renderers/webgl-post-processing.ts` — GPU WebGL fragment shader pipeline (CRT scanlines, chromatic phosphor ghosts, bloom, and 24fps procedural film grain).

## Local Contracts

- **60 FPS Performance Target**: Drawing routines must execute within a strict ~16.6ms per-frame budget.
- **Zero React Reconciliation in Render Loops**: Never trigger React state updates or hook dispatches inside animation frames. Renderers subscribe to `RenderCoordinator` or read directly from the canvas viewport.
- **Immediate Cost Bypasses on Disabled Effects**:
  - In `webgl-post-processing.ts`, if post-processing effects are disabled, `render()` must immediately early-exit with zero shader passes and zero draw calls.
  - In `pitch-clock-canvas.ts`, if `glowBloomEnabled` is false, `ctx.shadowBlur` must remain strictly 0 to eliminate software Gaussian blur rasterisation costs in 2D contexts.
  - If `sparksEnabled` is false, particle physics loops must be skipped entirely.
- **High-DPI Awareness**: All canvases must scale by `window.devicePixelRatio` for razor-sharp rendering on Retina/HiDPI screens without visual blurring.
- **Responsive Geometry & Soft-Centering**: When rendering in constrained viewports or mobile dimensions, canvas renderers must scale vertices and typography proportionally. In `piano-triangles-canvas.ts`, soft-centering prevents severe down-scaling of off-centre tonics, and idle chromatic labels are suppressed below 48px to eliminate collision.

## Work Guidance

- **Language & Spelling**: English (Australian) spelling conventions must be used in all code comments and documentation (*visualiser*, *initialise*, *customise*, *colour*, *centre*, *maximise*, *minimise*, *prioritise*, *analogue*, *organise*, *harmonise*, *analyse*).
- **GC Management**: Pre-allocate math vectors, avoid object creation in per-frame rendering loops, and reuse scratch objects to minimize garbage collection pauses.

## Verification

```bash
npm test
npm run build
```

## Child DOX Index

None.
