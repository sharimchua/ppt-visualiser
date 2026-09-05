# React Components & UI Presentation Domain

## Purpose

The `src/components` domain contains the React user interface layer, including the master application shell, control toolbars, settings drawer, responsive flexbox layout renderer, canvas viewport mountings, virtual keyboard, and the introductory primer modal.

## Ownership

- `src/App.tsx` — Root application component, config synchronization, URL slug state, full-screen handling, and mouse idle management.
- `src/components/ControlToolbar.tsx` — Top header toolbar containing transport controls, tonic/scale selector, track picker, layout menu, and deep link sharing.
- `src/components/VisualiserViewport.tsx` — Container managing the flexible layout canvas hierarchy and layout edit mode.
- `src/components/FlexLayoutRenderer.tsx` — Recursive split-container renderer supporting draggable flex dividers, cell splitting, duplication, and removal.
- `src/components/CellViewport.tsx` — Individual cell wrapper mounting specific canvas renderers (Orbital Clock, Piano Triangles, Note Stream) with local HUD controls.
- `src/components/VirtualKeyboard.tsx` — 88-key interactive velocity-sensitive piano keyboard with computer keybindings and Uniform Solfège colouring.
- `src/components/SettingsDrawer.tsx` — Slide-out settings sidebar providing granular controls for pitch clock, cosmetics, display effect toggles, priority slots, themes, and audio synth.
- `src/components/InfoModal.tsx` — Comprehensive introduction and theory guide modal dialog covering PPT concepts, customisation, and community links.

## Local Contracts

- **English (Australian) Spelling Mandate**: All user-visible text, button labels, badges, tooltips, dialogue copy, and help text must strictly follow English (Australian) spelling (*visualiser*, *initialise*, *customise*, *colour*, *centre*, *maximise*, *minimise*, *prioritise*, *analogue*, *organise*, *harmonise*, *analyse*, *dialogue*, *behaviour*).
- **Decoupled Playback State**: Components must not poll or re-render on every MIDI note event. High-frequency note drawing is encapsulated inside canvas contexts. Only user configuration, transport state (play/pause), and active MIDI device connections trigger React renders.
- **Outbound Link Destinations**:
  - Theory documentation: `https://ppt.midlifemuso.com` (and its reference library `https://ppt.midlifemuso.com/reference`).
  - Music coaching & pedagogy: `https://midlifemuso.com`.
- **Responsive Geometry**: UI elements, drawer dropdowns, and header buttons must resize responsively without horizontal overflowing or boundary clipping on narrow viewports.

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
