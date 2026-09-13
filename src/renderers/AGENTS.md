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
- `src/renderers/rhythm-orbit-canvas.ts` — 2D Canvas Rhythm Orbit polar visualiser: Prime-Family pattern-cycle revolutions (Du, Tri, DuTri, Qui, Sep), concentric stream tracks with dynamic register centroid sorting, per-stream metric spoke grids, independent scanning hands with prime-family palette colours, radiant golden-white polyrhythmic convergence pulses (*sam*), notehead rendering (PPT geometric or Uniform Solfège), central BPM readout, tuner offset drift needle, and polyrhythm metre badge display.
- `src/renderers/rhythm-debug-canvas.ts` — 2D Canvas Rhythm Engine Telemetry & Diagnostics renderer: real-time auditory stream segregation, track allocations, centroid pitch, live cycle phase sweepers, prime-family candidate metre probability rankings, recent strokes window log, and polyrhythmic convergence monitors.
- `src/renderers/cosmetics.ts` — Canvas 2D effects engine and GPU particle/shockwave data provider (preallocated GPU particle streaming buffers, kinetic note sparks physics, analogue light bleed, halation, optical lens flare starbursts, and tonic shift shockwaves/HUD badges).
- `src/renderers/webgl-post-processing.ts` — GPU WebGL shader pipeline: Point Sprite particle engine (`gl.POINTS`), analytical expanding shockwaves, CRT scanlines, chromatic phosphor ghosts, bloom, and 24fps procedural film grain.

## Local Contracts

- **60 FPS Performance Target**: Drawing routines must execute within a strict ~16.6ms per-frame budget.
- **Rhythm Debug Telemetry & Diagnostics Contracts**:
  - `RhythmDebugRenderer` executes on 2D Canvas at 60 FPS without React reconciliation or DOM layout churn.
  - Multi-stream responsive layout: Adapts flexibly between multi-column side-by-side stream cards on wide viewports ($\ge 580$px) and stacked cards on constrained viewports.
  - Candidate metre probability bar charts: Visualises normalised candidate likelihoods color-coded by Prime Period Theory prime families (Du `#38bdf8`, Tri `#f59e0b`, DuTri `#10b981`, Qui `#8b5cf6`, Sep `#f43f5e`) with cubic contrast scaling.
  - Live cycle sweeper strip: Sweeps the active scanning hand linearly from slot 0 ($Do$) across slot divisions with real-time hit markers for played strokes.
  - Polyrhythm telemetry: Computes cross-stream ratios and highlights convergence transits (*sam*) in real time.
  - Cross-stream reference indicator & polyrhythm resonance badges: Stream cards display their active companion anchor stream reference (`| REF: STR <id> (<ratio>)`) in the header and flag candidate rows with amber `⚡RES` badges when cross-stream polyrhythmic resonance bonuses are active.
- **Rhythm Orbit Graphics & Kinetics Contracts**:
  - Scanning hands sweep clockwise matching each stream's detected pattern cycle period ($T_{\text{cycle}} = N \times T_{\text{slot}}$) anchored to 12 o'clock ($Do$, slot 0). Each stream hand renders in its designated prime-family colour (Du sky blue `#38bdf8`, Tri amber `#f59e0b`, DuTri emerald `#10b981`, Qui violet `#8b5cf6`, Sep crimson `#f43f5e`) with a soft triangular gradient trail fading over the trailing quadrant ($-\pi/2$). When pulse is inactive or awaiting further notes, hands rest parked pointing at 12 o'clock ($Do$) awaiting onset data.
  - Polyrhythmic convergence pulses (*sam*): when multiple active stream hands coincide at 12 o'clock within a convergence time window, a radiant golden-white dual-ring expansion pulse ripples outward with Hann cosine decay, celebrating metric alignment across polyrhythmic metres.
  - Concentric stream tracks render with low opacity guide rings (`rgba(148, 163, 184, 0.14)`), with radial spokes demarcating each track's detected prime-family subdivisions ($N$ spokes per track ring). Pitch registers are sorted concentrically by auditory stream centroid.
  - Active noteheads render on their respective stream tracks, visually quantised onto the detected prime-family grid slots ($0..N-1$) with Solfège colour, physical key contrast outline, and optional Uniform Solfège glyph rendering.
  - Polyrhythmic status badge: when multiple concurrent streams are active with differing slot counts, a styled polyrhythm badge (e.g. `4:3 POLYRHYTHM`) is displayed below the central BPM readout.
  - Dual kinetic animations for tempo shifts:
    - Duple modulation ($2\times, 0.5\times$): gentle ripple animation (~400ms) with subtle perimeter sheen.
    - Arbitrary modulation: full elastic ring expansion/contraction ($1.12 \to 1.0$) with shockwave ring and tuner needle alignment.
- **Zero React Reconciliation in Render Loops**: Never trigger React state updates or hook dispatches inside animation frames. Renderers subscribe to `RenderCoordinator` or read directly from the canvas viewport.
- **GPU Point Sprite Particle & Analytical Shockwave Pipeline**: Point sprite particle rendering is offloaded directly to the GPU via interleaved `Float32Array` buffers (preallocated to 2,048 particles $\times 8$ floats via `CosmeticsEngine.MAX_GPU_PARTICLES`) in a single draw call (`gl.POINTS`) when WebGL is active, completely bypassing 2D Canvas CPU `ctx.arc()` and `ctx.fill()` rendering loops. The particle pool implements proactive FIFO capacity eviction to ensure incoming high-density note bursts (such as rapid chromatic runs, arpeggios, and dense polyphony) never starve newly struck sparks and boundary absorption effects. Expanding shockwaves are evaluated analytically directly in the fullscreen post-processing fragment shader, prioritising the highest-alpha wavefronts when polyphonic saturation occurs. When WebGL is unavailable, headless, or disabled, `CosmeticsEngine` provides a seamless 2D Canvas fallback.
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
  - Solfège Notehead Context Consistency: Staff Stream noteheads rendered along the conveyor queue strictly preserve their Solfège degree, geometric shape, and colour from the tonic context at their onset timestamp rather than retrospectively mutating upon manual or automatic tonic shifts (`resolveItemSemitoneFromTonic`). Timeline modulation barriers stamp the modulation boundary along the scroll continuum so future notes entering at the playhead reflect the newly active tonic while historical notes remain contextual and consistent.
  - Fa (`semicircle-left`) and So (`semicircle-right`) noteheads feature widened semi-elliptical horizontal profiles ($1.6r$) to maintain consistent visual weight matching circular, diamond, and square noteheads.
  - Clefs and accidentals render via SMuFL vector paths (Bravura reference) scaled to 1 staff space = 250 units, anchored mathematically to traditional score lines: G clef spiral on Line 2 ($G4$), F clef dots in spaces 3 & 4 framing Line 4 ($F3$), C clef central notch on Line 3 (Alto) or Line 4 (Tenor).
  - Dynamic clef selection scores candidate clefs to minimise ledger lines, applying a $+8$ bias hysteresis to the active clef to prevent rapid flickering on passing tones.
  - Alto and Tenor C-clefs are restricted to Single Staff configuration when `includeCClefs` is toggled on.
  - Voice leading gradient lines follow strict 1-to-1 SATB horizontal voice leading: Soprano/melody connects to Soprano, Bass connects to Bass, and inner voices pair by minimum pitch distance, eliminating monophonic chord zig-zags.
  - Staff Stream visual kinetics:
    - Note entrance: elastic scale pop ($1.4 \to 1.0$) and radiant strike flash at the playhead line (`noteEntranceAnimation`).
    - Origin sparks: directional eastward particle sparks emerging out the right side of the playhead line (`staffSparksEnabled`).
    - Boundary absorption: elastic area-conserving squish (`scale(squishX, squishY)` where horizontal flattening causes vertical bulging), multi-layer dynamic meniscus contour with Solfège-tinted radiant gradient, specular contact flash, and westward particle dissipation mist triggered once per notehead via `onNoteAbsorbed` (`staffAbsorptionEnabled`).
    - Voice leading undulation: dynamic harmonic standing wave modulation with an envelope of $\sin(\pi t)$ strictly preserving notehead contact at $t=0$ and $t=1$, dual-layer ambient bloom and core strokes, and travelling counterpoint energy pulse beads (`voiceLeadingUndulation`).
- **Piano Triangles Visual Kinetics & Flare Integration**:
  - Active vertices render a bright specular core pip and an expanding harmonic shockwave ring.
  - Active vertex coordinates and pitch-class positions are tracked and exposed via `getActiveVertexCoordinates()` and `getVertexCoordinatesForPc()`, retaining decaying vertices with proportional velocities across key release to ensure post-processing lens flares and halos decay smoothly without popping off (`triangleSparksEnabled`, `triangleShockwavesEnabled`, `triangleLensFlaresEnabled`).
  - Active vertices deduplicate repeated triangle pitch classes across tetrachord chains, prioritizing authentic scale tones over chromatic resting points to ensure flares, halos, and sparks remain 1:1 with played notes.
  - WebGL post-processing lights and shockwaves use undistorted screen coordinates ($v\_uv \times u\_resolution$) decoupled from CRT glass curvature, guaranteeing that off-centre cells (like Piano Triangles) align optical flares and halation directly with their 2D circular vertices without radial barrel drift.
- **Note Activation Shockwave Rings & Decoupled Kinetics**:
  - Expanding circular shockwave rings are decoupled from Note Spark particle physics, operating under an independent lifecycle with smooth cubic expansion deceleration and canonical Hann window cosine decay ($0.5 \cdot (1 + \cos(\pi \cdot t))$). Rings expand outward with natural initial momentum, decelerate, and dissolve asymptotically to zero opacity at termination without radius clipping pops (`shockwavesEnabled`, `shockwaveRadius`, `shockwaveSpeed`, `shockwaveDecayDurationMs`, `triangleShockwavesEnabled`).
- **Overtones Fluid Simulation & Droplet Particle Ejection**:
  - Preallocate `Float32Array` heightfield and dissonance buffers; wave envelope widths scale inversely with frequency (wider bass swells, tighter treble peaks); when dissonance is toggled on, space is dynamically reserved below the horizontal baseline and acoustic roughness is rendered as a stylised inverted subterranean white wave with jagged auditory beating texture using consistent absolute psychoacoustic scaling weighted by musical interval dissonance; zero per-frame garbage collection.
  - Fluid Droplet Particles & Crest Sparks: Fundamental wave crest coordinates $(x, y)$ are derived via `getFundamentalCoordinatesForMidi()`. Note strike triggers an upward geyser fountain of fluid droplets with ejection velocity and count strongly governed by note dynamics ($0.35 + v^{1.35} \times 2.25$), arcing naturally under gravity with subtle fluid drag ($0.982$) and specular glints, accompanied by a radiant burst of directional crest sparks; held notes emit continuous velocity-scaled effervescence and micro-droplet mist, streamed directly to the GPU point sprite pipeline (`overtoneDropletsEnabled`, `sparksEnabled`).
- **Smooth Optical Falloffs & Halo Decay**:
  - Halos and optical lens flares evaluate note release progress through a canonical smooth Hann window cosine envelope (`getDecayFadeFactor(decayProgress)` = $0.5 \cdot (1 + \cos(\pi \cdot t))$), delivering zero initial release drop-off ($f'(0) = 0$), a gentle photographic half-life around $t = 0.5$, and an asymptotic zero-derivative dissolve to black ($f'(1) = 0$) that prevents abrupt pop-offs and threshold drop-offs.
  - Pitch Clock ring nodes smoothly blend decaying white borders into resting Solfège borders and fade `ctx.shadowBlur` gracefully to zero.
  - WebGL post-processing shaders support 16 simultaneous dynamic light sources (expanded from 8) to prevent chord eviction popping, maintain natural halo radii during decay without pinprick collapse, clamp starburst ray lengths, and apply subpixel-aliasing-resistant anamorphic flare streaks.
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
