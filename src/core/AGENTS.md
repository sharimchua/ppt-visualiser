# Core Architecture & Theory Domain

## Purpose

The `src/core` domain contains the mathematical foundations of Prime Period Theory (PPT), pure music theory data structures, MIDI input/playback engines, Web Audio synthesis, flexbox layout tree models, real-time scale alignment, and the central render coordinator.

## Ownership

- `src/core/ppt-constants.ts` — Canonical PPT specifications: Uniform Solfège, Piano Triangles, Tri Pitch-Class notation, PPT geometric notehead taxonomy (`PPT_NOTEHEAD_SPECS`), diatonic staff step mapping (`midiToDiatonicStaffNote`), canonical key signatures (`TONIC_TO_KEY_SIGNATURE`), and virtual piano range presets.
- `src/core/ppt-math.ts` — Coordinate geometry, clock angles, register wrapping (-5 So to +6 Fi), and polar calculations.
- `src/core/scale-alignment.ts` — Real-time key/scale detection, 12 diatonic mode definitions, and hysteresis debouncing.
- `src/core/layout-models.ts` — Flex tree manipulation, cell splitting, tree pruning, presets (including Harmonic Waves), and URL-safe Base64 slug serialisation.
- `src/core/render-coordinator.ts` — Decoupled event bus managing note lifecycles, active note sets, Staff Stream session resets, and particle physics outside React.
- `src/core/midi-manager.ts` — Web MIDI hardware access and device state tracking.
- `src/core/midi-file-player.ts` — Standard MIDI file playback engine, transport controls, and demo track loader.
- `src/core/custom-midi-store.ts` — Local storage persistence, quota eviction, and event subscriptions for uploaded user MIDI tracks.
- `src/core/audio-synth.ts` — Web Audio API polyphonic sound synthesiser with envelope shaping.
- `src/core/convex-hull.ts` & `src/core/chord-clustering.ts` — Geometric chord clustering and ray generation.
- `src/core/config.ts` — Central configuration defaults, localStorage persistence, and sanitisation (including Staff Stream and 8-note default fixed window length).
- `src/core/types.ts` — Core TypeScript interfaces and type definitions (including `StaffStreamModuleConfig`, `StaffSize`, `StaffClef`).
- `src/core/ppt.test.ts` — Automated test suite.

## Local Contracts

- **Clock Coordinate Convention**: 12 o'clock zenith is strictly $Do$ ($0^\circ$ / $-\pi/2$ radians). 6 o'clock nadir is $Fi$ ($180^\circ$ / $+\pi/2$ radians).
- **Nearest-Address Octave Boundary**: Registers wrap from $So$ (7 o'clock, address $-5$) clockwise through $Do$ ($0$) to $Fi$ (6 o'clock, address $+6$).
- **Uniform Solfège 4-Fold Symmetry**: 3 elemental glyph types (`base`, `sharp`, `flat`) rotated across 4 quadrants ($0^\circ, 90^\circ, 180^\circ, 270^\circ$) represent all 12 chromatic tones.
- **PPT Notehead Taxonomy**: 12 chromatic degrees relative to active tonic $Do$ map to 8 geometric shapes (Circle, Diamond, Square, Triangle Down, Triangle Up, Semicircle Left, Cross, Semicircle Right) rendered with canonical Solfège palette colours.
- **Diatonic Staff Coordinates**: Middle C (C4, MIDI 60) represents step 0. In Grand Staff, Middle C is the shared virtual ledger line connecting top staff (line 1 = E4, step 2) and bottom staff (line 5 = A3, step -2). Fixed conveyor queue window sizes default to 8 notes (clamped 2..32).
- **Decoupled Render Lifecycle**: Never route per-frame note events, decay ticks, or particle emissions through React state. All high-frequency data must flow directly through `RenderCoordinator`.
- **Zero-Thrashing Bounding Rect Cache**: Never invoke `.getBoundingClientRect()` inside the per-frame 60 FPS animation loop. Bounding client rectangles for cells and the target post-processing canvas are measured and cached (`cachedRect`) upon registration, update, or window resize, completely eliminating layout reflow thrashing.
- **Tonic Shift Kinetic Decoupling**: Tonic changes (both manual user selections and real-time auto-alignment) trigger coordinated kinetic events directly through `RenderCoordinator.triggerTonicShift()`, propagating shockwaves, compass modulation arcs, Do anchor pulses, and stream timeline barriers without React reconciliation overhead. Pitch clock tone circles are immediately remapped across all registers to align with the new tonic, eliminating phantom lingering circles.
- **Cosmetics Viewport Origin Alignment**: Particle spark physics and bloom light fallbacks must always calculate coordinate space relative to the active module's canvas bounding rect (`orbitalCellCanvas`) rather than the global viewport window centre, ensuring initial dynamic effects start exactly at node centres.
- **Continuous Stream Buffer Retention**: When continuous streaming is active across any module (`streamMode === 'continuous'`, `staffStreamMode === 'continuous'`, or cell overrides via `isContinuousStreamingActive()`), `RenderCoordinator` retains up to 10,000 notes and dynamically computes timestamp age pruning based on active scroll speeds ($\ge 120\text{s}$) across wide displays. Fixed queue mode safely reserves up to 512 items accommodating multi-note chord clusters.
- **Pure Tree Operations**: Operations in `layout-models.ts` (`splitCellInTree`, `removeCellFromTree`, `duplicateCellInTree`, `encodeLayoutToSlug`, `decodeLayoutFromSlug`) must remain pure and immutably return updated tree structures.

## Work Guidance

- **Language & Spelling**: Adhere strictly to English (Australian) spelling for all comments, docstrings, and diagnostic messages (*visualiser*, *initialise*, *customise*, *colour*, *centre*, *maximise*, *minimise*, *prioritise*, *analogue*, *organise*, *harmonise*, *analyse*).
- **Test-Driven Rigour**: Any alteration to musical geometry, scale correlation scoring, layout algorithms, or slug serialization must include accompanying unit test cases in `src/core/ppt.test.ts`.

## Verification

```bash
npm test
```
All tests in `src/core/ppt.test.ts` must pass with zero failures.

## Child DOX Index

None.
