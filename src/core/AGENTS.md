# Core Architecture & Theory Domain

## Purpose

The `src/core` domain contains the mathematical foundations of Prime Period Theory (PPT), pure music theory data structures, MIDI input/playback engines, Web Audio synthesis, flexbox layout tree models, real-time scale alignment, and the central render coordinator.

## Ownership

- `src/core/ppt-constants.ts` — Canonical PPT specifications: Uniform Solfège, Piano Triangles, Tri Pitch-Class notation, PPT geometric notehead taxonomy (`PPT_NOTEHEAD_SPECS`), diatonic staff step mapping (`midiToDiatonicStaffNote`), canonical key signatures (`TONIC_TO_KEY_SIGNATURE`), and virtual piano range presets.
- `src/core/ppt-math.ts` — Coordinate geometry, clock angles, register wrapping (-5 So to +6 Fi), and polar calculations.
- `src/core/scale-alignment.ts` — Real-time key/scale detection, 12 diatonic mode definitions, and hysteresis debouncing.
- `src/core/layout-models.ts` — Flex tree manipulation, cell splitting, tree pruning, presets (including Harmonic Waves and Rhythm Studio & Debug), and URL-safe Base64 slug serialisation.
- `src/core/render-coordinator.ts` — Decoupled event bus managing note lifecycles, active note sets, Staff Stream session resets, Rhythm Debug telemetry dispatch, and particle physics outside React.
- `src/core/midi-manager.ts` — Web MIDI hardware access and device state tracking.
- `src/core/midi-file-player.ts` — Standard MIDI file playback engine, transport controls, and demo track loader.
- `src/core/custom-midi-store.ts` — Local storage persistence, quota eviction, and event subscriptions for uploaded user MIDI tracks.
- `src/core/audio-synth.ts` — Web Audio API polyphonic sound synthesiser with envelope shaping.
- `src/core/convex-hull.ts` & `src/core/chord-clustering.ts` — Geometric chord clustering and ray generation.
- `src/core/rhythm-engine.ts` — Prime-family rhythm engine featuring auditory stream segregation via register centroid EMA ($\alpha = 0.3$, 14 semitones capture radius), window-wide statistical grid fitting (`fitStreamToGrid`), candidate metre probability evaluations (`MetreCandidateEvaluation`, `getCandidateMetresForStream`), canonical Prime Period Theory prime-family classification (`classifyMetre`: Du, Tri, Qui, Sep, DuTri), stream-specific chord clustering (65ms window), metric dynamic accent contrast, dual-threshold tempo hysteresis (duple vs arbitrary modulation), polyrhythmic convergence detection, and concentric pitch track allocation.
- `src/core/config.ts` — Central configuration defaults, localStorage persistence, and sanitisation (including Staff Stream, Rhythm Orbit, and 8-note default fixed window length).
- `src/core/types.ts` — Core TypeScript interfaces and type definitions (including `RhythmOrbitModuleConfig`, `VisualiserModuleType` with `rhythm-debug`, `LayoutMode`, `StaffStreamModuleConfig`, `StaffSize`, `StaffClef`).
- `src/core/ppt.test.ts` — Automated test suite.

## Local Contracts

- **Clock Coordinate Convention**: 12 o'clock zenith is strictly $Do$ ($0^\circ$ / $-\pi/2$ radians). 6 o'clock nadir is $Fi$ ($180^\circ$ / $+\pi/2$ radians).
- **Rhythm Orbit Polar Geometry, Prime-Family Metres & Polyrhythmic Stream Segregation**:
  - Cycle-based revolution: The clock revolution represents a complete metric pattern cycle (e.g. 1 bar / phrase), departing from 1-beat rotations to reveal broader rhythmic shapes, polymetric structures, and hemiolas. 12 o'clock zenith is always cycle start (slot 0 / $Do$).
  - Auditory stream segregation by register proximity: Notes are segregated into independent rhythmic streams based on register centroid proximity (capture radius of 14 semitones). Centroids update via smooth EMA ($\alpha = 0.3$), naturally keeping bass lines in a single stream across harmonic root changes (e.g. C2 to F2) while polyphonic chords in different registers (e.g. C2 bass vs C5 treble) form distinct polyrhythmic streams.
  - Stream-aware chord clustering: Simultaneous or rolled notes within 65ms (`CHORD_WINDOW_SEC`) in the same stream cluster into a single `RhythmStroke`, preserving polyphonic voicings without corrupting tempo or metre detection.
  - Prime-family metre classification (`classifyMetre`): Divisions of the cycle map directly to Prime Period Theory (PPT) prime families:
    - Du (Prime 2): 2, 4, 8, 16, 32 slots (binary subdivision, common duple/quadruple time)
    - Tri (Prime 3): 3, 9, 27 slots (ternary subdivision, waltz time)
    - DuTri (Compound $2 \times 3$): 6, 12, 24 slots (compound duple/triple, 6/8, 12/8)
    - Qui (Prime 5): 5, 10, 25 slots (quintuple time)
    - Sep (Prime 7): 7, 14 slots (septuple time)
  - Window-wide statistical grid fitting (`fitStreamToGrid`): Stream strokes are evaluated collectively across candidate beat periods and prime-family configurations using Gaussian motor timing tolerance ($\sigma = 0.18$), Occam's razor slot utilisation efficiency (penalising unplayed ghost slots), and metric dynamic accent contrast (rewarding downbeats with higher dynamic velocities). A single mistimed stroke is outvoted by the statistical consensus of the window.
  - Phase-lock downbeat anchor continuity: Streams maintain metric downbeat stability across continuous playing and FIFO note evictions by projecting established downbeat anchors forward by integer multiples of the cycle period ($t_{\text{projected}} = t_{\text{anchor}} + \text{round}((t_0 - t_{\text{anchor}}) / T_{\text{cycle}}) \times T_{\text{cycle}}$). Candidate anchors aligned with the established phase receive a $+20\%$ continuity bonus, completely preventing 90° or 180° playhead phase skips during continuous arpeggiation loops.
  - Harmonic & pitch cycle periodicity: When strokes recurring in the same slot across consecutive cycles share the same Solfège pitch class (e.g. arpeggiated 7th chords or repeating melodic riffs), candidate configurations matching the melodic cycle receive a $+25\%$ periodicity bonus. Gated by $\ge 2$ distinct pitch classes to eliminate false periodicity artifacts on monotone streams.
  - Rhythm buffer compaction & note window scaling: The active visual stroke buffer scales from 4 to 64 notes (default 24). Evicted strokes are continuously compacted into `stream.compactedContext` (`CompactedRhythmContext`: cycle counter, total evicted strokes, slot histogram, and historical downbeat hits), preserving statistical rhythmic history and long-term downbeat tracking without memory leaks.
  - Cross-stream metric context & polyrhythmic resonance: Streams establish metric anchors from high-confidence companion streams. When a companion stream has an established Du metre (e.g. 4/4 or 2/4), a candidate Tri metre (3 or 6 slots) that co-cycles with or forms a harmonic integer ratio (e.g. 3:4 or 3:2) against the anchor cycle receives a $+35\%$ co-cycle or $+20\%$ polyrhythmic resonance bonus, enabling effortless detection of polyrhythms while solo Tri priors remain conservatively balanced to prevent unaccented even notes from fluctuating between Du and Tri.
  - Metre candidate probability evaluations (`fitStreamToGrid` & `MetreCandidateEvaluation`): Returns ranked prime-family candidate configurations with cubic power contrast weighting, normalised relative probabilities (summing to 1.0), slot utilisation percentages, and dynamic contrast ratios, exposed via `StreamMetreState` and `getCandidateMetresForStream` for real-time telemetry inspection.
  - Polyrhythmic convergence detection: When two or more active streams with distinct metres simultaneously align near the 12 o'clock zenith ($\pm 3.5\%$ angular phase tolerance), the engine flags `convergenceOccurred` and lists `convergenceStreamIds`, enabling the visualiser to trigger dramatic LCM resolution pulses (*sam*).
  - 60–120 BPM tactus plateau & octave folding: Auto-tempo detection anchors across a uniform 60 to 120 BPM human tactus plateau (rolling off gently below 60 and above 120 BPM), folding rapid or slow stroke intervals via `foldBpmToTactusRange` into this window.
  - Concentric pitch tracks: Lowest played notes and streams are assigned to outer tracks (track 0), highest notes to inner tracks. Supports dynamic mode (expands up to 8 tracks) and fixed mode.
  - Dual hysteresis thresholds for tempo adjustment: High inertia retention (+18% bonus on current BPM), minimum diff $\ge 5$ BPM, and minimum window size of 4 strokes prevent erratic jumps. Duple modulations (powers of 2) require 500ms debounce and 0.08 score margin; arbitrary non-duple shifts require 1200ms debounce and 0.12 score margin.
  - Idle pulse deceleration: When no notes arrive within 3.5s, pulse smoothly decelerates to idle without abrupt stops.
- **Nearest-Address Octave Boundary**: Registers wrap from $So$ (7 o'clock, address $-5$) clockwise through $Do$ ($0$) to $Fi$ (6 o'clock, address $+6$).
- **Uniform Solfège 4-Fold Symmetry**: 3 elemental glyph types (`base`, `sharp`, `flat`) rotated across 4 quadrants ($0^\circ, 90^\circ, 180^\circ, 270^\circ$) represent all 12 chromatic tones.
- **PPT Notehead Taxonomy**: 12 chromatic degrees relative to active tonic $Do$ map to 8 geometric shapes (Circle, Diamond, Square, Triangle Down, Triangle Up, Semicircle Left, Cross, Semicircle Right) rendered with canonical Solfège palette colours.
- **Diatonic Staff Coordinates**: Middle C (C4, MIDI 60) represents step 0. In Grand Staff, Middle C is the shared virtual ledger line connecting top staff (line 1 = E4, step 2) and bottom staff (line 5 = A3, step -2). Fixed conveyor queue window sizes default to 8 notes (clamped 2..32).
- **Decoupled Render Lifecycle**: Never route per-frame note events, decay ticks, or particle emissions through React state. All high-frequency data must flow directly through `RenderCoordinator`.
- **Zero-Thrashing Bounding Rect Cache**: Never invoke `.getBoundingClientRect()` inside the per-frame 60 FPS animation loop. Bounding client rectangles for cells and the target post-processing canvas are measured and cached (`cachedRect`) upon registration, update, or window resize, completely eliminating layout reflow thrashing.
- **Tonic Shift Kinetic Decoupling**: Tonic changes (both manual user selections and real-time auto-alignment) trigger coordinated kinetic events directly through `RenderCoordinator.triggerTonicShift()`, propagating shockwaves, compass modulation arcs, Do anchor pulses, and stream timeline barriers without React reconciliation overhead. Pitch clock tone circles are immediately remapped across all registers to align with the new tonic, eliminating phantom lingering circles.
- **Cosmetics Viewport Origin Alignment**: Particle spark physics and bloom light fallbacks must always calculate coordinate space relative to the active module's canvas bounding rect (`orbitalCellCanvas`) rather than the global viewport window centre, ensuring initial dynamic effects start exactly at node centres.
- **Continuous Stream Buffer Retention**: When continuous streaming is active across any module (`streamMode === 'continuous'`, `staffStreamMode === 'continuous'`, or cell overrides via `isContinuousStreamingActive()`), `RenderCoordinator` retains up to 10,000 notes and dynamically computes timestamp age pruning based on active scroll speeds ($\ge 120\text{s}$) across wide displays. Fixed queue mode safely reserves up to 512 items accommodating multi-note chord clusters. Stream items record their strike-time tonic and Solfège semitone context, ensuring historical stream noteheads retain immutable Solfège heads across subsequent tonic modulations.
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
