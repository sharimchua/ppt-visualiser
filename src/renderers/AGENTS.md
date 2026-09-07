# Renderers & Graphics Domain

## Purpose

The `src/renderers` domain contains all high-performance 2D Canvas and WebGL graphics engines responsible for visualizing musical structures, polar pitch clocks, piano triangles, note ribbons, and analog kinetic cosmetics.

## Ownership

- `src/renderers/pitch-clock-canvas.ts` — 8-octave concentric polar clock renderer, node layout, chord rays, convex hull polygons, and ring labels.
- `src/renderers/piano-triangles-canvas.ts` — Piano keyboard topography renderer (Scale Signature tetrachord mode and 4-triangle matrix).
- `src/renderers/stream-canvas.ts` — High-velocity directional note ribbon renderer (horizontal LTR/RTL, vertical TTB/BTT) and timeline modulation markers.
- `src/renderers/staff-stream-canvas.ts` — 2D Canvas Staff Stream renderer: Single & Grand Staff, polyphonic chord onsets, SMuFL vector clefs anchored to staff lines, traditional key signature alignment, SATB 1-to-1 voice leading gradient curves, dynamic clef line-prioritisation scoring with hysteresis, and strictly Right-to-Left streaming.
- `src/renderers/smufl-glyphs.ts` — Standard SMuFL (Bravura reference) vector glyph outlines for clefs (`gClef`, `fClef`, `cClef`) and accidentals (`accidentalSharp`, `accidentalFlat`, `accidentalNatural`) with exact staff-space unit scaling.
- `src/renderers/notehead-renderer.ts` — Canvas 2D Prime Period Theory notehead drawing routines (Circle, Diamond, Square, Triangle Down, Triangle Up, Semicircle Left, Cross, Semicircle Right), Solfège colouring, contrast borders, and SMuFL accidental glyphs.
- `src/renderers/overtones-canvas.ts` — 7-harmonic-partial kinetic fluid wave simulation renderer, Uniform Solfège colouring, velocity dynamics, and Plomp-Levelt psychoacoustic dissonance curves.
- `src/renderers/cosmetics.ts` — Canvas 2D effects engine and GPU particle/shockwave data provider (preallocated GPU particle streaming buffers, kinetic note sparks physics, analogue light bleed, halation, optical lens flare starbursts, and tonic shift shockwaves/HUD badges).
- `src/renderers/webgl-post-processing.ts` — GPU WebGL shader pipeline: Point Sprite particle engine (`gl.POINTS`), analytical expanding shockwaves, CRT scanlines, chromatic phosphor ghosts, bloom, and 24fps procedural film grain.

## Local Contracts

- **60 FPS Performance Target**: Drawing routines must execute within a strict ~16.6ms per-frame budget.
- **Zero React Reconciliation in Render Loops**: Never trigger React state updates or hook dispatches inside animation frames. Renderers subscribe to `RenderCoordinator` or read directly from the canvas viewport.
- **GPU Point Sprite Particle & Analytical Shockwave Pipeline**: Point sprite particle rendering is offloaded directly to the GPU via interleaved `Float32Array` buffers in a single draw call (`gl.POINTS`) when WebGL is active, completely bypassing 2D Canvas CPU `ctx.arc()` and `ctx.fill()` rendering loops. Expanding shockwaves are evaluated analytically directly in the fullscreen post-processing fragment shader. When WebGL is unavailable, headless, or disabled, `CosmeticsEngine` provides a seamless 2D Canvas fallback.
- **Zero Software Blurs in High-Frequency Paths**: Software CPU Gaussian blurs (`ctx.shadowBlur`) are strictly prohibited in per-frame animation loops (including voice leading counterpoint pulse beads, piano triangle active and decaying vertices, and expanding shockwave rings), replaced with high-performance concentric dual-disc fills and strokes while optical bleed is delegated to the GPU.
- **Voice Leading Memory Preallocation**: Static scratch arrays (`scratchPathX`, `scratchPathY`) are preallocated on `StaffStreamRenderer` to eliminate all per-frame heap object allocations during voice leading harmonic standing wave evaluation.
- **Staff Stream Flow & Notation Contracts**:
  - Staff Stream strictly enforces Right-to-Left (RTL) horizontal conveyor flow; vertical and LTR modes are disallowed.
  - Grand Staff spacing reserves exactly $2 \times \text{lineSpacing}$ between staves such that the 1st ledger line below the top staff is identical to the 1st ledger line above the bottom staff ($C4 / \text{Middle C}$).
  - Grand Staff clefs feature stylised overlap compositing: Treble clef is predominantly white with a black outline, Bass clef is predominantly black with a white outline, and their intersection is composited in grey (`#94a3b8`) via dedicated scratch buffers with generous bounding box padding preventing any right-edge clipping.
  - Staff lines (`rgba(226, 232, 240, 0.75)`) and ledger lines (`rgba(248, 250, 252, 0.92)`) maintain high luminosity for clear readability on dark backgrounds.
  - A left termination marker (`rgba(56, 189, 248, 0.75)`) is positioned strictly to the right of the clef, complementing the red playhead origin line on the right; in continuous mode, rendering is strictly clipped between the termination line and playhead so noteheads and voice leading lines disappear cleanly at the boundary without overlapping the clefs. Staff Stream strictly renders discrete noteheads at onsets without note offset duration ribbons.
  - Mode-specific accidental & key signature handling: continuous mode suppresses accidentals and key signatures to prevent visual clutter during dynamic streaming; fixed queue (grid) mode retains accidentals and key signatures positioned cleanly after the clef for traditional score engraving readability.
  - Accidental scaling & kerning: accidentals scale canonically to $0.65 \times \text{staffSpace}$ (producing standard $2.6s$ sharp and $2.3s$ flat height without overpowering staff lines) and are horizontally centered with an explicit $\ge 5\text{px}$ kerning margin from the outermost notehead contour, preventing collision or overlap.
  - Mode-specific notehead chord displacement: continuous mode strictly aligns all chord noteheads with onset time (zero horizontal displacement); fixed queue mode displaces adjacent seconds horizontally to prevent notehead collisions.
  - Notehead styling for physical piano keys: white piano keys ($C, D, E, F, G, A, B$) feature solid Solfège fill with a crisp white outline (`#ffffff`); black piano keys ($C\sharp, D\sharp, F\sharp, G\sharp, A\sharp$) feature a deep obsidian body (`#090d16`) framed by a luminous neon Solfège boundary outline and radiant centre pip for immediate, unambiguous recognition and maximum visual intensity.
  - Fa (`semicircle-left`) and So (`semicircle-right`) noteheads feature widened semi-elliptical horizontal profiles ($1.6r$) to maintain consistent visual weight matching circular, diamond, and square noteheads.
  - Clefs and accidentals render via SMuFL vector paths (Bravura reference) scaled to 1 staff space = 250 units, anchored mathematically to traditional score lines: G clef spiral on Line 2 ($G4$), F clef dots in spaces 3 & 4 framing Line 4 ($F3$), C clef central notch on Line 3 (Alto) or Line 4 (Tenor).
  - Dynamic clef selection scores candidate clefs to minimise ledger lines, applying a $+8$ bias hysteresis to the active clef to prevent rapid flickering on passing tones.
  - Alto and Tenor C-clefs are restricted to Single Staff configuration when `includeCClefs` is toggled on.
  - Voice leading gradient lines follow strict 1-to-1 SATB horizontal voice leading: Soprano/melody connects to Soprano, Bass connects to Bass, and inner voices pair by minimum pitch distance, eliminating monophonic chord zig-zags.
  - Staff Stream visual kinetics:
    - Note entrance: elastic scale pop ($1.4 \to 1.0$) and radiant strike flash at the playhead line (`noteEntranceAnimation`).
    - Origin sparks: directional eastward particle sparks emerging out the right side of the playhead line (`staffSparksEnabled`).
    - Boundary absorption: horizontal squish and cyan dissipation ripple when noteheads meet the left termination marker (`staffAbsorptionEnabled`).
    - Voice leading undulation: dynamic harmonic standing wave modulation with an envelope of $\sin(\pi t)$ strictly preserving notehead contact at $t=0$ and $t=1$, dual-layer ambient bloom and core strokes, and travelling counterpoint energy pulse beads (`voiceLeadingUndulation`).
- **Piano Triangles Visual Kinetics & Flare Integration**:
  - Active vertices render a bright specular core pip and an expanding harmonic shockwave ring.
  - Active vertex coordinates and pitch-class positions are tracked and exposed via `getActiveVertexCoordinates()` and `getVertexCoordinatesForPc()`, allowing the WebGL post-processing shader pipeline to project optical lens flares and `CosmeticsEngine` to trigger particle spark bursts directly on active keyboard vertices (`triangleSparksEnabled`, `triangleLensFlaresEnabled`).
- **Overtones Fluid Simulation**: Preallocate `Float32Array` heightfield and dissonance buffers; wave envelope widths scale inversely with frequency (wider bass swells, tighter treble peaks); when dissonance is toggled on, space is dynamically reserved below the horizontal baseline and acoustic roughness is rendered as a stylised inverted subterranean white wave with jagged auditory beating texture using consistent absolute psychoacoustic scaling weighted by musical interval dissonance (preventing auto-normalization, so consonant intervals like perfect 5ths and 3rds produce subtle ripples while tritones and minor 2nds plunge deeply); zero per-frame garbage collection.
- **Immediate Cost Bypasses on Disabled Effects**:
  - In `webgl-post-processing.ts`, if post-processing effects are disabled, `render()` must immediately early-exit with zero shader passes and zero draw calls.
  - In `pitch-clock-canvas.ts`, if `glowBloomEnabled` is false, `ctx.shadowBlur` must remain strictly 0 to eliminate software Gaussian blur rasterisation costs in 2D contexts.
  - If `sparksEnabled` or module-level spark toggles (`staffSparksEnabled`, `triangleSparksEnabled`) are false, particle physics routines must be skipped entirely.
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
