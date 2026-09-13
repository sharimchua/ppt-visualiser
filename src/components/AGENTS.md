# React Components & UI Presentation Domain

## Purpose

The `src/components` domain contains the React user interface layer, including the master application shell, control toolbars, settings drawer, responsive flexbox layout renderer, canvas viewport mountings, virtual keyboard, and the introductory primer modal.

## Ownership

- `src/App.tsx` — Root application component, config synchronisation, URL slug state, full-screen handling, mouse idle management, floating responsive virtual piano toggle button, and demo song launch from the primer modal.
- `src/components/ControlToolbar.tsx` — Top header toolbar containing transport controls, tonic/scale selector, track picker (inbuilt demos and uploaded tracks from local storage), layout menu (including Rhythm Studio & Debug preset), and deep link sharing.
- `src/components/VisualiserViewport.tsx` — Container managing the flexible layout canvas hierarchy and layout edit mode.
- `src/components/FlexLayoutRenderer.tsx` — Recursive split-container renderer supporting draggable flex dividers, cell splitting, duplication, and removal.
- `src/components/CellViewport.tsx` — Individual cell wrapper mounting specific canvas renderers (Orbital Clock, Piano Triangles, Note Stream, Overtone Waves, Staff Stream, Rhythm Orbit, Rhythm Debug) with local HUD controls, conveyor mode toggles, fixed queue length sliders (2..24), staff-specific configuration, rhythm-specific configuration (track modes, note window size, quantisation, auto-tempo, BPM readout, notehead symbols), and granular visual effect toggles.
- `src/components/VirtualKeyboard.tsx` — Interactive velocity-sensitive virtual piano with customisable keyboard range presets (25-key up to full 88-key acoustic piano), dynamic 2-octave QWERTY computer keybindings positioned above solfège, bottom-edge tonic Do indicator, left-aligned octave labels, window horizontal space calculation with fit/fixed width toggle, direct dismiss toggle button, Uniform Solfège colouring, and kinetic tonic-shift glow ring/border flashes upon modulation.
- `src/components/SettingsDrawer.tsx` — Slide-out settings sidebar providing granular controls for pitch clock, virtual piano keyboard range presets, overtones wave simulation, Staff Stream notation, Rhythm Orbit visualiser (track distribution mode, fixed track count, note window size, manual BPM slider, auto-tempo autodetection toggle, quantisation tolerance, central BPM readout, notehead symbols), cosmetics (including reactive note sparks, note activation shockwaves with expansion radius, speed, and dissolve duration sliders, piano triangle sparks and lens flares, halation and starburst decay duration sliders 200ms–3500ms), display effect toggles (including kinetic tonic shift effects), priority slots, themes, audio synthesiser, and real-time focus mode.
- `src/components/InfoModal.tsx` — Comprehensive introduction and theory guide modal dialogue featuring continuous single-piece scrolling, interactive top bookmark navigation, documentation of all 6 cell types (Orbital Clock, Piano Triangles, Note Stream, Overtone Waves, Staff Stream, Rhythm Orbit), rich vector diagrams for PPT concepts, Concept 2 on Why Default Do = D, Concept 9 on the Philosophy of PPT Geometric Noteheads, Concept 10 on Staff Stream Notation, Concept 11 on Rhythm Orbit Polar Clock & Dual Hysteresis Tempo Autodetection, and a "Play Demo" call-to-action button launching the "Boot Up" demo track.
- `src/components/PitchClockDiagram.tsx` — Interactive SVG polar pitch clock diagram rendering 12 radial pitch classes, movable Do zenith, and Fi nadir.
- `src/components/UniformSolfegeDiagram.tsx` — Visual vector diagram explaining the 3 root glyphs and the 4-fold 90° symmetry matrix.
- `src/components/PianoTrianglesDiagram.tsx` — Vector diagram presenting the 4 geometric piano triangles and 2-octave keyboard with drawn vector overlays.
- `src/components/ConcentricOrbitsDiagram.tsx` — Vector diagram displaying 8 concentric octave registers and the 6-to-7 o'clock radial octave seam.
- `src/components/TriPitchClassDiagram.tsx` — Interactive vector diagram presenting PPT Tri Pitch-Class Notation as the default 12TET absolute alternative to sharps and flats.
- `src/components/PptNoteheadDiagram.tsx` — Interactive vector diagram presenting the 8 canonical geometric notehead shapes, 12 chromatic degrees, tactile white vs black piano key indicators, and the underlying harmonic philosophy.

## Local Contracts

- **English (Australian) Spelling Mandate**: All user-visible text, button labels, badges, tooltips, dialogue copy, and help text must strictly follow English (Australian) spelling (*visualiser*, *initialise*, *customise*, *colour*, *centre*, *maximise*, *minimise*, *prioritise*, *analogue*, *organise*, *harmonise*, *analyse*, *dialogue*, *behaviour*).
- **Decoupled Playback State**: Components must not poll or re-render on every MIDI note event. High-frequency note drawing is encapsulated inside canvas contexts. Only user configuration, transport state (play/pause), and active MIDI device connections trigger React renders.
- **Outbound Link Destinations**:
  - Theory documentation: `https://ppt.midlifemuso.com` (and its reference library `https://ppt.midlifemuso.com/reference`).
  - Music coaching & pedagogy: `https://midlifemuso.com`.
- **Responsive Geometry**: UI elements, drawer dropdowns, header buttons, modal bookmark navigation tabs, and vector theory diagrams must resize responsively without horizontal overflowing or boundary clipping on narrow mobile viewports. Row containers adapt flexibly to columns on mobile portrait viewports (< 640px) to prevent viewport compression. The multi-cell flex layout engine (`.layout-flex-node`) dynamically moderates high imbalanced flex weights across compact/tablet (spread 0.45x) and mobile/constrained-height (spread 0.2x) breakpoints while preserving heavier desktop weights, backed by defensive minimum cell dimensions (minimum 96px height) to prevent cells from being squeezed out.
- **Non-Obstructive Layout Edit Mode**: Layout edit mode controls (status indicator, cell count, add cell, reset, share, done) are docked in normal document flow above the canvas viewport rather than floating over cells. This guarantees that cell-level controls (e.g. module dropdown selector, flex weight stepper, and cell split/delete actions) remain fully accessible and completely unobstructed regardless of the number or direction of cell splits.

## Work Guidance

- Use Tailwind CSS adhering to the application's established dark aesthetic (`#0b0f19` backdrop, `slate-800` borders, `red-500` / `red-600` accent highlights).
- Wrap pure presentational controls in `React.memo` where appropriate to prevent unnecessary reconciliation overhead during MIDI playback.

## Verification

```bash
npm run build
npm test
```

## Child DOX Index

None.
