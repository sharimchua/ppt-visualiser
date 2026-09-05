# Core Architecture & Theory Domain

## Purpose

The `src/core` domain contains the mathematical foundations of Prime Period Theory (PPT), pure music theory data structures, MIDI input/playback engines, Web Audio synthesis, flexbox layout tree models, real-time scale alignment, and the central render coordinator.

## Ownership

- `src/core/ppt-constants.ts` — Canonical PPT specifications: Uniform Solfège, Piano Triangles, Tri Pitch-Class notation, and pitch class mapping.
- `src/core/ppt-math.ts` — Coordinate geometry, clock angles, register wrapping (-5 So to +6 Fi), and polar calculations.
- `src/core/scale-alignment.ts` — Real-time key/scale detection, 12 diatonic mode definitions, and hysteresis debouncing.
- `src/core/layout-models.ts` — Flex tree manipulation, cell splitting, tree pruning, presets, and URL-safe Base64 slug serialization.
- `src/core/render-coordinator.ts` — Decoupled event bus managing note lifecycles, active note sets, and particle physics outside React.
- `src/core/midi-manager.ts` — Web MIDI hardware access and device state tracking.
- `src/core/midi-file-player.ts` — Standard MIDI file playback engine, transport controls, and demo track loader.
- `src/core/audio-synth.ts` — Web Audio API polyphonic sound synthesizer with envelope shaping.
- `src/core/convex-hull.ts` & `src/core/chord-clustering.ts` — Geometric chord clustering and ray generation.
- `src/core/config.ts` — Central configuration defaults, localStorage persistence, and sanitisation.
- `src/core/types.ts` — Core TypeScript interfaces and type definitions.
- `src/core/ppt.test.ts` — Automated test suite.

## Local Contracts

- **Clock Coordinate Convention**: 12 o'clock zenith is strictly $Do$ ($0^\circ$ / $-\pi/2$ radians). 6 o'clock nadir is $Fi$ ($180^\circ$ / $+\pi/2$ radians).
- **Nearest-Address Octave Boundary**: Registers wrap from $So$ (7 o'clock, address $-5$) clockwise through $Do$ ($0$) to $Fi$ (6 o'clock, address $+6$).
- **Uniform Solfège 4-Fold Symmetry**: 3 elemental glyph types (`base`, `sharp`, `flat`) rotated across 4 quadrants ($0^\circ, 90^\circ, 180^\circ, 270^\circ$) represent all 12 chromatic tones.
- **Decoupled Render Lifecycle**: Never route per-frame note events, decay ticks, or particle emissions through React state. All high-frequency data must flow directly through `RenderCoordinator`.
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
