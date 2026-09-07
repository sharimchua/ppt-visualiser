import { VisualiserConfig } from '../core/types';

export interface PostProcessingLight {
  x: number;
  y: number;
  velocity: number;
  colorHex: string;
}

export interface PostProcessingShockwave {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  colorHex: string;
}

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  // Canvas coordinate system has (0,0) at top-left
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const PARTICLE_VERTEX_SHADER_SOURCE = `
attribute vec4 a_particlePosRadius; // x, y, radius, alpha
attribute vec4 a_particleColor;     // r, g, b, coreRatio
uniform vec2 u_resolution;
uniform float u_dpr;
varying vec4 v_color;
varying float v_coreRatio;

void main() {
  vec2 pos = a_particlePosRadius.xy * u_dpr;
  vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
  // Canvas coordinate system has (0,0) at top-left
  clipSpace.y = -clipSpace.y;
  gl_Position = vec4(clipSpace, 0.0, 1.0);
  gl_PointSize = max(1.0, a_particlePosRadius.z * 2.0 * u_dpr);
  v_color = vec4(a_particleColor.rgb, a_particlePosRadius.w);
  v_coreRatio = a_particleColor.a > 0.0 ? a_particleColor.a : 0.4;
}
`;

const PARTICLE_FRAGMENT_SHADER_SOURCE = `
precision mediump float;
varying vec4 v_color;
varying float v_coreRatio;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord) * 2.0;
  if (dist > 1.0) {
    discard;
  }
  float halo = clamp(1.0 - dist, 0.0, 1.0);
  float core = clamp(1.0 - dist / v_coreRatio, 0.0, 1.0);
  float a = halo * v_color.a;
  vec3 rgb = mix(v_color.rgb, vec3(1.0), core * 0.75);
  gl_FragColor = vec4(rgb * a, a);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
varying vec2 v_uv;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_grainIntensity;
uniform float u_grainSize;
uniform float u_grainContrast;
uniform float u_scanlineIntensity;
uniform float u_scanlineDensity;
uniform float u_crtVignette;
uniform float u_crtCurvature;
uniform float u_lightBleed;
uniform float u_lensFlare;
uniform int u_flareStyle; // 0 = anamorphic, 1 = starburst, 2 = cinematic
uniform int u_lightCount;
uniform vec4 u_lights[8]; // x, y, velocity, active
uniform vec3 u_lightColors[8];
uniform vec2 u_opticalCenter;

// Expanding kinetic shockwaves
uniform int u_shockwaveCount;
uniform vec4 u_shockwaves[4]; // x, y, radius, alpha
uniform vec3 u_shockwaveColors[4];

// PRNG hash for procedural animated film grain
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += vec3(dot(p3, p3.yzx + 33.33));
  return fract((p3.x + p3.y) * p3.z);
}

// CRT Barrel distortion
vec2 crtDistort(vec2 uv, float bend) {
  if (bend <= 0.001) return uv;
  vec2 cc = uv - 0.5;
  float dist = dot(cc, cc);
  return uv + cc * (dist * bend);
}

void main() {
  vec2 uv = v_uv;

  // 1. Subtle CRT spherical glass curve
  if (u_crtCurvature > 0.001) {
    uv = crtDistort(uv, u_crtCurvature * 0.15);
  }

  vec2 pixelCoord = uv * u_resolution;

  // Accumulate additive light emission (lens flares, halation, anamorphic streaks, grain)
  vec3 additiveColor = vec3(0.0);
  float additiveAlpha = 0.0;

  // Accumulate subtractive attenuation (CRT scanlines, glass vignette)
  float darkAttenuation = 0.0;

  // --- OPTICAL LENS FLARES & HALATION ---
  if ((u_lightBleed > 0.01 || u_lensFlare > 0.01) && u_lightCount > 0) {
    for (int i = 0; i < 8; i++) {
      if (i >= u_lightCount) break;
      vec2 lightPos = u_lights[i].xy;
      float vel = u_lights[i].z;
      vec3 lightColor = u_lightColors[i];

      vec2 d = pixelCoord - lightPos;
      float dist = length(d);

      // A. Radial Film Halation (warm soft glow around active notes)
      if (u_lightBleed > 0.01 && vel > 0.02) {
        float halationR = 40.0 * u_lightBleed + vel * 50.0;
        float hFalloff = exp(-dist / halationR);
        vec3 halationColor = mix(lightColor, vec3(0.98, 0.57, 0.24), 0.35); // 35mm warm halation tint
        float hAlpha = hFalloff * vel * u_lightBleed * 0.55;
        additiveColor += halationColor * hAlpha;
        additiveAlpha = max(additiveAlpha, hAlpha);

        // Anamorphic horizontal light bleed streak
        float streakHalfW = min(u_resolution.x * 0.45, 120.0 + 260.0 * u_lightBleed);
        float streakH = max(2.0, 6.0 * vel);
        if (abs(d.y) < streakH * 2.0 && abs(d.x) < streakHalfW) {
          float sX = clamp(1.0 - abs(d.x) / streakHalfW, 0.0, 1.0);
          float sY = clamp(1.0 - abs(d.y) / (streakH * 2.0), 0.0, 1.0);
          float sAlpha = sX * sY * vel * u_lightBleed * 0.45;
          additiveColor += lightColor * sAlpha;
          additiveAlpha = max(additiveAlpha, sAlpha);
        }
      }

      // B. Multi-Element Optical Lens Flares
      if (u_lensFlare > 0.01 && vel > 0.02) {
        float flareAlpha = vel * u_lensFlare;

        // Central radiant optical core disc
        float coreR = max(8.0, 18.0 * u_lensFlare * (0.6 + vel * 0.6));
        float coreFalloff = exp(-dist / (coreR * 0.7));
        float cAlpha = coreFalloff * flareAlpha * 0.95;
        additiveColor += vec3(1.0) * cAlpha + lightColor * (cAlpha * 0.6);
        additiveAlpha = max(additiveAlpha, cAlpha);

        // 1. Starburst diffraction rays (style 1: starburst, 2: cinematic)
        if (u_flareStyle == 1 || u_flareStyle == 2) {
          float rayLen = min(u_resolution.x * 0.35, 70.0 + 160.0 * u_lensFlare * vel);
          if (dist < rayLen && dist > 1.0) {
            float angle = atan(d.y, d.x);
            // 6-pointed starburst diffraction pattern
            float rayPattern = pow(max(0.0, abs(cos(angle * 3.0 + 0.2618))), 18.0);
            float rFalloff = clamp(1.0 - dist / rayLen, 0.0, 1.0);
            float rAlpha = rayPattern * rFalloff * flareAlpha * 0.85;
            vec3 rayCol = mix(lightColor, vec3(1.0), 0.55);
            additiveColor += rayCol * rAlpha;
            additiveAlpha = max(additiveAlpha, rAlpha);
          }
        }

        // 2. Anamorphic wide horizontal optical streak (style 0: anamorphic, 2: cinematic)
        if (u_flareStyle == 0 || u_flareStyle == 2) {
          float aStreakW = min(u_resolution.x * 0.72, 220.0 + 460.0 * u_lensFlare);
          float aStreakH = max(3.0, 5.0 * vel);
          if (abs(d.y) < aStreakH * 2.5 && abs(d.x) < aStreakW) {
            float aX = clamp(1.0 - abs(d.x) / aStreakW, 0.0, 1.0);
            float aY = clamp(1.0 - abs(d.y) / (aStreakH * 2.5), 0.0, 1.0);
            float aAlpha = pow(aX, 2.0) * aY * flareAlpha * 0.75;
            vec3 streakCol = mix(lightColor, vec3(0.22, 0.74, 0.97), 0.4); // Sci-fi cyan anamorphic edge
            additiveColor += streakCol * aAlpha;
            additiveAlpha = max(additiveAlpha, aAlpha);
          }
        }

        // 3. Aperture reflection ghosts reflected across optical center (style 2: cinematic)
        if (u_flareStyle == 2) {
          vec2 optDelta = u_opticalCenter - lightPos;
          // Ghost 1 at 0.4x reflection
          vec2 gPos1 = lightPos + optDelta * 1.4;
          float gDist1 = length(pixelCoord - gPos1);
          float gR1 = 14.0 * (0.8 + vel * 0.4) * u_lensFlare;
          if (gDist1 < gR1) {
            float gA1 = (1.0 - gDist1 / gR1) * flareAlpha * 0.18;
            additiveColor += lightColor * gA1;
            additiveAlpha = max(additiveAlpha, gA1);
          }
          // Ghost 2 at 0.75x reflection
          vec2 gPos2 = lightPos + optDelta * 1.75;
          float gDist2 = length(pixelCoord - gPos2);
          float gR2 = 24.0 * (0.8 + vel * 0.4) * u_lensFlare;
          if (gDist2 < gR2) {
            float gA2 = (1.0 - gDist2 / gR2) * flareAlpha * 0.12;
            additiveColor += vec3(0.22, 0.74, 0.97) * gA2;
            additiveAlpha = max(additiveAlpha, gA2);
          }
        }
      }
    }
  }

  // --- EXPANDING KINETIC SHOCKWAVES ---
  if (u_shockwaveCount > 0) {
    for (int i = 0; i < 4; i++) {
      if (i >= u_shockwaveCount) break;
      vec2 swPos = u_shockwaves[i].xy;
      float swRadius = u_shockwaves[i].z;
      float swAlpha = u_shockwaves[i].w;
      vec3 swCol = u_shockwaveColors[i];

      if (swAlpha > 0.01 && swRadius > 1.0) {
        float d = length(pixelCoord - swPos);
        float ringDist = abs(d - swRadius);
        float ringWidth = max(2.5, swRadius * 0.045);
        if (ringDist < ringWidth * 2.5) {
          float ringFalloff = clamp(1.0 - ringDist / (ringWidth * 2.5), 0.0, 1.0);
          float rA = pow(ringFalloff, 1.8) * swAlpha;
          // Inner bright crest + outer glow
          vec3 col = mix(swCol, vec3(1.0), clamp(1.0 - ringDist / ringWidth, 0.0, 1.0) * 0.65);
          additiveColor += col * rA;
          additiveAlpha = max(additiveAlpha, rA);
        }
      }
    }
  }

  // --- PROCEDURAL ANIMATED FILM GRAIN ---
  if (u_grainIntensity > 0.01) {
    // Authentic 24fps cadence: lock temporal step
    float timeStep = floor(u_time * 24.0) / 24.0;
    float grainScale = max(1.0, u_grainSize);
    vec2 grainCoord = floor(pixelCoord / grainScale);

    float noise = hash(grainCoord + vec2(timeStep * 137.15, timeStep * 269.83));
    // Apply contrast curve: higher contrast produces punchier grit
    float contrast = clamp(u_grainContrast, 0.0, 1.0);
    noise = (noise - 0.5) * (1.0 + contrast * 1.5) + 0.5;
    noise = clamp(noise, 0.0, 1.0);

    float gAlpha = u_grainIntensity * (0.12 + contrast * 0.18);
    vec3 grainCol = vec3(noise);
    additiveColor += grainCol * gAlpha;
    additiveAlpha = max(additiveAlpha, gAlpha * 0.7);
  }

  // --- CRT SCANLINES ---
  if (u_scanlineIntensity > 0.01) {
    // Frequency steps based on scanlineDensity: 1=Fine, 2=Standard, 3=Retro, 4=Coarse Arcade
    float stepSize = 3.0;
    if (u_scanlineDensity <= 1.5) stepSize = 2.0;
    else if (u_scanlineDensity <= 2.5) stepSize = 3.0;
    else if (u_scanlineDensity <= 3.5) stepSize = 4.0;
    else stepSize = 6.0;

    float scanlineVal = sin(pixelCoord.y * (6.2831853 / stepSize));
    // Darken alternating raster lines
    float scanlineDarkness = (0.5 - 0.5 * scanlineVal) * u_scanlineIntensity * 0.55;
    darkAttenuation += scanlineDarkness;
  }

  // --- CRT SCREEN VIGNETTE / GLASS CURVE FALLOFF ---
  if (u_crtVignette > 0.01) {
    vec2 vCenter = abs(uv - 0.5) * 2.0;
    float vDist = dot(vCenter, vCenter);
    float vAlpha = smoothstep(0.4, 1.4, vDist) * u_crtVignette * 0.85;
    darkAttenuation += vAlpha;
  }

  // Final Output Composition (Premultiplied Alpha: additive color adds light, darkAttenuation subtracts)
  darkAttenuation = clamp(darkAttenuation, 0.0, 1.0);
  vec3 finalColor = additiveColor * (1.0 - darkAttenuation * 0.7);
  float finalAlpha = clamp(darkAttenuation * 0.85, 0.0, 1.0);

  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

function parseHexColor(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = (parseInt(clean.substring(0, 2), 16) || 255) / 255;
  const g = (parseInt(clean.substring(2, 4), 16) || 255) / 255;
  const b = (parseInt(clean.substring(4, 6), 16) || 255) / 255;
  return [r, g, b];
}

export class WebGLPostProcessingPipeline {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private isSupported: boolean = false;

  // Particle Point Sprite Program
  private particleProgram: WebGLProgram | null = null;
  private particleBuffer: WebGLBuffer | null = null;
  private uParticleResolutionLoc: WebGLUniformLocation | null = null;
  private uParticleDprLoc: WebGLUniformLocation | null = null;
  private aParticlePosRadiusLoc: number = -1;
  private aParticleColorLoc: number = -1;

  // Cached Post-Processing Uniform Locations
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uGrainIntensityLoc: WebGLUniformLocation | null = null;
  private uGrainSizeLoc: WebGLUniformLocation | null = null;
  private uGrainContrastLoc: WebGLUniformLocation | null = null;
  private uScanlineIntensityLoc: WebGLUniformLocation | null = null;
  private uScanlineDensityLoc: WebGLUniformLocation | null = null;
  private uCrtVignetteLoc: WebGLUniformLocation | null = null;
  private uCrtCurvatureLoc: WebGLUniformLocation | null = null;
  private uLightBleedLoc: WebGLUniformLocation | null = null;
  private uLensFlareLoc: WebGLUniformLocation | null = null;
  private uFlareStyleLoc: WebGLUniformLocation | null = null;
  private uLightCountLoc: WebGLUniformLocation | null = null;
  private uLightsLoc: WebGLUniformLocation | null = null;
  private uLightColorsLoc: WebGLUniformLocation | null = null;
  private uOpticalCenterLoc: WebGLUniformLocation | null = null;

  // Shockwave Uniform Locations
  private uShockwaveCountLoc: WebGLUniformLocation | null = null;
  private uShockwavesLoc: WebGLUniformLocation | null = null;
  private uShockwaveColorsLoc: WebGLUniformLocation | null = null;

  // Preallocated Scratch Buffers (zero per-frame memory allocation)
  private lightsData = new Float32Array(32); // 8 * 4
  private lightColorsData = new Float32Array(24); // 8 * 3
  private shockwavesData = new Float32Array(16); // 4 * 4
  private shockwaveColorsData = new Float32Array(12); // 4 * 3

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initGL();
  }

  public get supported(): boolean {
    return this.isSupported;
  }

  private initGL() {
    try {
      const gl = (
        this.canvas.getContext('webgl', {
          alpha: true,
          premultipliedAlpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: false,
        }) ||
        this.canvas.getContext('experimental-webgl', {
          alpha: true,
          premultipliedAlpha: true,
        })
      ) as WebGLRenderingContext | null;

      if (!gl) {
        this.isSupported = false;
        return;
      }

      this.gl = gl;

      // 1. Compile post-processing fullscreen quad shaders
      const vertShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fragShader = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

      if (!vertShader || !fragShader) {
        this.isSupported = false;
        return;
      }

      const program = gl.createProgram();
      if (!program) {
        this.isSupported = false;
        return;
      }

      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('[WebGL] Shader link failed:', gl.getProgramInfoLog(program));
        this.isSupported = false;
        return;
      }

      this.program = program;

      // Fullscreen quad buffer [-1, 1]
      const positions = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0,
      ]);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      this.quadBuffer = buffer;

      // Cache post-processing uniform locations
      this.uResolutionLoc = gl.getUniformLocation(program, 'u_resolution');
      this.uTimeLoc = gl.getUniformLocation(program, 'u_time');
      this.uGrainIntensityLoc = gl.getUniformLocation(program, 'u_grainIntensity');
      this.uGrainSizeLoc = gl.getUniformLocation(program, 'u_grainSize');
      this.uGrainContrastLoc = gl.getUniformLocation(program, 'u_grainContrast');
      this.uScanlineIntensityLoc = gl.getUniformLocation(program, 'u_scanlineIntensity');
      this.uScanlineDensityLoc = gl.getUniformLocation(program, 'u_scanlineDensity');
      this.uCrtVignetteLoc = gl.getUniformLocation(program, 'u_crtVignette');
      this.uCrtCurvatureLoc = gl.getUniformLocation(program, 'u_crtCurvature');
      this.uLightBleedLoc = gl.getUniformLocation(program, 'u_lightBleed');
      this.uLensFlareLoc = gl.getUniformLocation(program, 'u_lensFlare');
      this.uFlareStyleLoc = gl.getUniformLocation(program, 'u_flareStyle');
      this.uLightCountLoc = gl.getUniformLocation(program, 'u_lightCount');
      this.uLightsLoc = gl.getUniformLocation(program, 'u_lights');
      this.uLightColorsLoc = gl.getUniformLocation(program, 'u_lightColors');
      this.uOpticalCenterLoc = gl.getUniformLocation(program, 'u_opticalCenter');

      // Cache shockwave uniform locations
      this.uShockwaveCountLoc = gl.getUniformLocation(program, 'u_shockwaveCount');
      this.uShockwavesLoc = gl.getUniformLocation(program, 'u_shockwaves');
      this.uShockwaveColorsLoc = gl.getUniformLocation(program, 'u_shockwaveColors');

      // 2. Compile kinetic particle point sprite shaders
      const partVertShader = this.compileShader(gl.VERTEX_SHADER, PARTICLE_VERTEX_SHADER_SOURCE);
      const partFragShader = this.compileShader(gl.FRAGMENT_SHADER, PARTICLE_FRAGMENT_SHADER_SOURCE);
      if (partVertShader && partFragShader) {
        const pProg = gl.createProgram();
        if (pProg) {
          gl.attachShader(pProg, partVertShader);
          gl.attachShader(pProg, partFragShader);
          gl.linkProgram(pProg);
          if (gl.getProgramParameter(pProg, gl.LINK_STATUS)) {
            this.particleProgram = pProg;
            this.particleBuffer = gl.createBuffer();
            this.uParticleResolutionLoc = gl.getUniformLocation(pProg, 'u_resolution');
            this.uParticleDprLoc = gl.getUniformLocation(pProg, 'u_dpr');
            this.aParticlePosRadiusLoc = gl.getAttribLocation(pProg, 'a_particlePosRadius');
            this.aParticleColorLoc = gl.getAttribLocation(pProg, 'a_particleColor');
          }
        }
      }

      this.isSupported = true;
    } catch (e) {
      console.warn('[WebGL] Post-processing initialisation failed, falling back to 2D Canvas:', e);
      this.isSupported = false;
    }
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.warn('[WebGL] Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  public render(
    config: VisualiserConfig,
    lights: PostProcessingLight[],
    time: number,
    shockwaves: PostProcessingShockwave[] = [],
    particleBuffer?: Float32Array,
    particleCount: number = 0
  ) {
    if (!this.isSupported || !this.gl || !this.program || !this.quadBuffer) return;
    if (config.webglEnabled === false) return;

    const gl = this.gl;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = this.canvas.width;
    const height = this.canvas.height;

    if (width <= 0 || height <= 0) return;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Alpha blending (Premultiplied alpha pipeline)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 1. Draw GPU Point Sprite Particles in a single draw call
    if (
      this.particleProgram &&
      this.particleBuffer &&
      particleBuffer &&
      particleCount > 0 &&
      this.aParticlePosRadiusLoc >= 0 &&
      this.aParticleColorLoc >= 0
    ) {
      gl.useProgram(this.particleProgram);
      gl.uniform2f(this.uParticleResolutionLoc, width, height);
      gl.uniform1f(this.uParticleDprLoc, dpr);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
      // Upload interleaved particle data: [x, y, radius, alpha, r, g, b, coreRatio]
      gl.bufferData(gl.ARRAY_BUFFER, particleBuffer.subarray(0, particleCount * 8), gl.DYNAMIC_DRAW);

      const stride = 32; // 8 floats * 4 bytes
      gl.enableVertexAttribArray(this.aParticlePosRadiusLoc);
      gl.vertexAttribPointer(this.aParticlePosRadiusLoc, 4, gl.FLOAT, false, stride, 0);

      gl.enableVertexAttribArray(this.aParticleColorLoc);
      gl.vertexAttribPointer(this.aParticleColorLoc, 4, gl.FLOAT, false, stride, 16);

      gl.drawArrays(gl.POINTS, 0, particleCount);

      if (typeof gl.disableVertexAttribArray === 'function') {
        gl.disableVertexAttribArray(this.aParticlePosRadiusLoc);
        gl.disableVertexAttribArray(this.aParticleColorLoc);
      }
    }

    // 2. Fullscreen Post-Processing Quad (CRT, scanlines, lens flares, light bleed, grain, shockwaves)
    const grainOn = (config.filmGrainEnabled ?? true) && (config.filmGrainIntensity > 0);
    const scanlinesOn = (config.scanlinesEnabled ?? true) && ((config.scanlineIntensity ?? 0) > 0);
    const vignetteOn = (config.scanlinesEnabled ?? true) && ((config.crtVignette ?? 0) > 0);
    const lightBleedOn = (config.lightBleedEnabled ?? true) && ((config.lightBleedIntensity ?? 0) > 0);
    const lensFlareOn = (config.lensFlareEnabled ?? true) && ((config.lensFlareIntensity ?? 0) > 0);
    const shockwaveCount = Math.min(4, shockwaves.length);

    // If all visual post-processing effects and shockwaves are toggled off, exit immediately!
    // Low-end GPUs incur ZERO rasterisation or fragment shader load.
    if (!grainOn && !scanlinesOn && !vignetteOn && !lightBleedOn && !lensFlareOn && shockwaveCount === 0) {
      return;
    }

    gl.useProgram(this.program);

    // Bind Quad Attributes
    const posAttr = gl.getAttribLocation(this.program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Set Uniforms
    gl.uniform2f(this.uResolutionLoc, width, height);
    gl.uniform1f(this.uTimeLoc, time / 1000);

    gl.uniform1f(this.uGrainIntensityLoc, grainOn ? (config.filmGrainIntensity ?? 0) : 0);
    gl.uniform1f(this.uGrainSizeLoc, config.filmGrainSize ?? 1);
    gl.uniform1f(this.uGrainContrastLoc, config.filmGrainContrast ?? 0.5);

    gl.uniform1f(this.uScanlineIntensityLoc, scanlinesOn ? (config.scanlineIntensity ?? 0) : 0);
    gl.uniform1f(this.uScanlineDensityLoc, config.scanlineDensity ?? 2);
    gl.uniform1f(this.uCrtVignetteLoc, vignetteOn ? (config.crtVignette ?? 0) : 0);
    gl.uniform1f(this.uCrtCurvatureLoc, vignetteOn ? 0.35 : 0.0);

    gl.uniform1f(this.uLightBleedLoc, lightBleedOn ? (config.lightBleedIntensity ?? 0) : 0);
    gl.uniform1f(this.uLensFlareLoc, lensFlareOn ? (config.lensFlareIntensity ?? 0) : 0);

    const styleIdx =
      config.lensFlareStyle === 'starburst'
        ? 1
        : config.lensFlareStyle === 'cinematic'
        ? 2
        : 0;
    gl.uniform1i(this.uFlareStyleLoc, styleIdx);

    gl.uniform2f(this.uOpticalCenterLoc, width / 2, height / 2);

    // Pack up to 8 lights into uniform arrays (only if flares or light bleed are active)
    const maxLights = (lensFlareOn || lightBleedOn) ? Math.min(8, lights.length) : 0;
    gl.uniform1i(this.uLightCountLoc, maxLights);

    if (maxLights > 0) {
      for (let i = 0; i < maxLights; i++) {
        const l = lights[i];
        this.lightsData[i * 4 + 0] = l.x * dpr;
        this.lightsData[i * 4 + 1] = l.y * dpr;
        this.lightsData[i * 4 + 2] = l.velocity;
        this.lightsData[i * 4 + 3] = 1.0;

        const rgb = parseHexColor(l.colorHex);
        this.lightColorsData[i * 3 + 0] = rgb[0];
        this.lightColorsData[i * 3 + 1] = rgb[1];
        this.lightColorsData[i * 3 + 2] = rgb[2];
      }

      gl.uniform4fv(this.uLightsLoc, this.lightsData);
      gl.uniform3fv(this.uLightColorsLoc, this.lightColorsData);
    }

    // Pack shockwaves into uniform arrays
    gl.uniform1i(this.uShockwaveCountLoc, shockwaveCount);
    if (shockwaveCount > 0) {
      for (let i = 0; i < shockwaveCount; i++) {
        const sw = shockwaves[i];
        this.shockwavesData[i * 4 + 0] = sw.x * dpr;
        this.shockwavesData[i * 4 + 1] = sw.y * dpr;
        this.shockwavesData[i * 4 + 2] = sw.radius * dpr;
        this.shockwavesData[i * 4 + 3] = sw.alpha;

        const rgb = parseHexColor(sw.colorHex);
        this.shockwaveColorsData[i * 3 + 0] = rgb[0];
        this.shockwaveColorsData[i * 3 + 1] = rgb[1];
        this.shockwaveColorsData[i * 3 + 2] = rgb[2];
      }

      gl.uniform4fv(this.uShockwavesLoc, this.shockwavesData);
      gl.uniform3fv(this.uShockwaveColorsLoc, this.shockwaveColorsData);
    }

    // Execute single fullscreen quad draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  public destroy() {
    if (!this.gl) return;
    const gl = this.gl;
    if (this.quadBuffer) {
      gl.deleteBuffer(this.quadBuffer);
      this.quadBuffer = null;
    }
    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.particleBuffer) {
      gl.deleteBuffer(this.particleBuffer);
      this.particleBuffer = null;
    }
    if (this.particleProgram) {
      gl.deleteProgram(this.particleProgram);
      this.particleProgram = null;
    }
    this.gl = null;
    this.isSupported = false;
  }
}
