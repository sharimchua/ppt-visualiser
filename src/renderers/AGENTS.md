# Renderers & Graphics Domain

## Purpose

The `src/renderers` domain contains all high-performance 2D Canvas and WebGL graphics engines responsible for visualizing musical structures, polar pitch clocks, piano triangles, note ribbons, and analog kinetic cosmetics.

## Ownership

- `src/renderers/pitch-clock-canvas.ts` — 8-octave concentric polar clock renderer, node layout, chord rays, convex hull polygons, and ring labels.
- `src/renderers/piano-triangles-canvas.ts` — Piano keyboard topography renderer (Scale Signature tetrachord mode and 4-triangle matrix).
- `src/renderers/stream-canvas.ts` — High-velocity directional note ribbon renderer (horizontal LTR/RTL, vertical TTB/BTT) and timeline modulation markers.
- `src/renderers/overtones-canvas.ts` — 7-harmonic-partial kinetic fluid wave simulation renderer, Uniform Solfège colouring, velocity dynamics, and Plomp-Levelt psychoacoustic dissonance curves.
- `src/renderers/cosmetics.ts` — Canvas 2D effects engine (kinetic note sparks physics, analogue light bleed, halation, optical lens flare starbursts, and tonic shift shockwaves/HUD badges).
- `src/renderers/webgl-post-processing.ts` — GPU WebGL fragment shader pipeline (CRT scanlines, chromatic phosphor ghosts, bloom, and 24fps procedural film grain).

## Local Contracts

- **60 FPS Performance Target**: Drawing routines must execute within a strict ~16.6ms per-frame budget.
- **Zero React Reconciliation in Render Loops**: Never trigger React state updates or hook dispatches inside animation frames. Renderers subscribe to `RenderCoordinator` or read directly from the canvas viewport.
- **Overtones Fluid Simulation**: Preallocate `Float32Array` heightfield and dissonance buffers; wave envelope widths scale inversely with frequency (wider bass swells, tighter treble peaks); when dissonance is toggled on, space is dynamically reserved below the horizontal baseline and acoustic roughness is rendered as a stylised inverted subterranean white wave with jagged auditory beating texture using consistent absolute psychoacoustic scaling weighted by musical interval dissonance (preventing auto-normalization, so consonant intervals like perfect 5ths and 3rds produce subtle ripples while tritones and minor 2nds plunge deeply); zero per-frame garbage collection.
- **Immediate Cost Bypasses on Disabled Effects**:
  - In `webgl-post-processing.ts`, if post-processing effects are disabled, `render()` must immediately early-exit with zero shader passes and zero draw calls.
  - In `pitch-clock-canvas.ts`, if `glowBloomEnabled` is false, `ctx.shadowBlur` must remain strictly 0 to eliminate software Gaussian blur rasterisation costs in 2D contexts.
  - If `sparksEnabled` is false, particle physics loops must be skipped entirely.
  - If `tonicShiftEffectsEnabled` is false, tonic shift shockwaves, perimeter modulation arcs, Do anchor surges, and timeline barrier rendering must be completely bypassed with zero CPU/GPU overhead.
- **Responsive Geometry & Soft-Centering**: When rendering in constrained viewports or mobile dimensions, canvas renderers must scale vertices and typography proportionally. In `piano-triangles-canvas.ts`, soft-centering prevents severe down-scaling of off-centre tonics, and idle chromatic labels are suppressed below 48px to eliminate collision.
- **Pitch Clock Tonic Remapping & Predictive Origin Geometry**: Pitch clock tracks physical MIDI note discoveries as ground truth, deterministically recalculating tone keys, organic radii distributions, and pop animations whenever tonic modulates (automatically or manually) to prevent stale phantom tone circles. In `getToneCoordinates`, if a tone node has not yet completed a canvas draw pass, coordinates are predictively resolved from the active orbit layout to ensure cosmetic particle bursts originate precisely on-node from the initial strike.

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
