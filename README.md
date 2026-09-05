# Prime Period Theory (PPT) Music Visualiser

A high-performance, aesthetic, and kinetic web-based music visualiser for realtime and played-back MIDI signals, grounded in the principles of **Prime Period Theory (PPT)** and **Uniform Solfège**.

Designed for students, performers, composers, and researchers to explore the geometric, harmonic, and ergonomic structures of music in motion.

---

## Key Features & Theoretical Grounding

### 1. 8 Concentric Pitch Clocks (Concentric Octaves)
- **Concentric Layout**: 8 concentric rings representing the roughly 8 octaves of a standard piano keyboard ($A_0$ to $C_8$).
- **Register Progression**: The outermost ring represents the lowest register (Octave 0/1); the innermost ring represents the highest register (Octave 7/8).
- **"Do is D" by Default**: Follows PPT pedagogy for 12TET keyboards ($D$ sits on the axis of physical black/white key symmetry on piano keyboards). Tonic can be reconfigured to any chromatic pitch in realtime.
- **Clock Orientation**: **Do** is anchored strictly at the **12 o'clock** position ($0^\circ$).
- **Nearest-Address Octave Boundary**: The register starts at **7 o'clock (So, $-5$)** and extends clockwise through **Do (0)** to **6 o'clock (Fi, $+6$)**, reflecting the tritone axis boundary of PPT.

### 2. Dual Visualisation Modes
- **Concentric Pitch Clock**:
  - Velocity-proportional glow and spring decay.
  - Active chord connection webbing / rays between simultaneously active tones.
  - Expanding kinetic shockwave ripples on note attacks.
  - Dynamic register discovery mode: smoothly introduces rings outward as notes are discovered across registers.
- **Live Sequential Note Stream**:
  - **Fixed Queue Mode**: Displays a sliding window of $N$ notes (1 to 24).
  - **Single-Window Showcase ($N=1$)**: Special showcase mode that morphs and kinetically rotates Uniform Solfège glyphs between note representations with spring physics.
  - **Continuous Scrolling Mode**: Real-time scrolling conveyor ribbon with note duration indicators and playhead.
  - **Presentation Formats**:
    - **Uniform Solfège Vector Glyphs** (Base, Sharp, Flat with $0^\circ, 90^\circ, 180^\circ, 270^\circ$ canonical rotations).
    - **Piano Triangle SVG Notation** (Down, Left, Up, Right silhouette with active colored vertex circle and ghosted companion vertices).
    - **Solfège Syllables** (`Do`, `Ra`, `Re`, `Me`, `Mi`, `Fa`, `Fi`, `So`, `Le`, `La`, `Te`, `Ti`).
    - **Pitch Names** (Dual $C\sharp/D\flat$, Sharps, or Flats).
    - **Scale Intervals** ($1, \flat 2, 2, \flat 3, 3, 4, \sharp 4/\flat 5, 5, \dots$).

### 3. Kinetic Aesthetics & Cosmetics Suite
- **Procedural Film Grain**: Configurable analog cinematic texture.
- **Background Atmospheres**: *Studio Obsidian*, *Cosmic Abyss*, *Carbon Grid*, and *Velvet Dark*.
- **Reactive Particle System**: Note-strike sparks erupting in the note's canonical Solfège color with velocity physics.
- **Neon Glow Bloom & Motion Trails**: Post-processing glow and motion persistence.

### 4. Input & Audio Integration
- **Web MIDI API**: Zero-latency plug-and-play input for hardware MIDI keyboards and controllers.
- **Polyphonic Web Audio Synthesizer**: Built-in expressive sound synthesis (Warm Poly, Sine, Triangle, Sawtooth with dynamic filter envelope).
- **Interactive Virtual Keyboard**: On-screen keyboard with QWERTY computer keys mapping (`Z`-`M` and `Q`-`I`) and Piano Triangle labels.
- **MIDI File Player & Bundled Demo Tracks**:
  - *J.S. Bach — Prelude in C Major (BWV 846)*
  - *PPT Piano Triangles & Tetrachord Study (Do = D)*
  - *Jazz ii-V-I Progression & Voicings*
  - *Concentric Clock Radial Orbit (88-Key Spiral)*
  - Drag-and-drop support for any standard `.mid` file.

### 5. Viewport-Maximizing Layout & Fullscreen
- **Responsive Scaling**: High-DPI (`devicePixelRatio`) canvas scaling utilizing 100% of viewport width and height.
- **Layout Modes**:
  - *Balanced Duo*: Large pitch clock with integrated note stream.
  - *Clock Monument*: Maximized concentric clock filling the viewport with compact stream HUD.
  - *Stream River*: Prominent horizontal scrolling stream with circular pitch clock radar.
- **Fullscreen Mode**: Complete distraction-free presentation with auto-hiding controls during idle mouse movement.

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation & Development
```bash
# Clone or navigate to the project directory
cd ppt-visualiser

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in any modern browser (Chrome, Edge, Firefox, Safari).

### Running Tests & Verification
```bash
# Run unit tests
npm run test

# Typecheck and build production bundle
npm run build
```

---

## Canonical PPT Solfège Color Palette

| Degree | Syllable | Color | Hex | Nearest-Address |
|---|---|---|---|---|
| 0 | Do | Red | `#E13610` | 0 |
| 1 | Ra / Di | Orange | `#F98016` | +1 |
| 2 | Re | Orange | `#F98016` | +2 |
| 3 | Me / Ri | Yellow | `#F5D432` | +3 |
| 4 | Mi | Yellow | `#F5D432` | +4 |
| 5 | Fa | Green | `#43A440` | +5 |
| 6 | Fi / Se | Obsidian / Black | `#141414` | +6 |
| 7 | So | Deep Blue | `#0032A4` | -5 |
| 8 | Le / Si | Purple | `#5300A4` | -4 |
| 9 | La | Purple | `#5300A4` | -3 |
| 10 | Te / Li | Magenta / Pink | `#F158A4` | -2 |
| 11 | Ti | Magenta / Pink | `#F158A4` | -1 |

---

## Related Projects
- [Prime Period Theory (OKF)](https://github.com/sharimchua/prime-period-theory)
- [PPT Engraver](https://github.com/sharimchua/ppt-engraver)
