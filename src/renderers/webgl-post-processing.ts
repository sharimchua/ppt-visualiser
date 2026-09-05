import { VisualiserConfig } from '../core/types';

export interface PostProcessingLight {
  x: number;
  y: number;
  velocity: number;
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

// PRNG hash for procedural animated film grain
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
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
          float sX = 1.0 - abs(d.x) / streakHalfW;
          float sY = 1.0 - abs(d.y) / (streakH * 2.0);
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
            float rayPattern = pow(abs(cos(angle * 3.0 + 0.2618)), 18.0);
            float rFalloff = (1.0 - dist / rayLen);
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
            float aX = 1.0 - abs(d.x) / aStreakW;
            float aY = 1.0 - abs(d.y) / (aStreakH * 2.5);
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

  // Final Output Composition
  darkAttenuation = clamp(darkAttenuation, 0.0, 1.0);
  vec3 finalColor = additiveColor * (1.0 - darkAttenuation * 0.7);
  float finalAlpha = clamp(additiveAlpha + darkAttenuation * 0.85, 0.0, 1.0);

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

  // Cached Uniform Locations
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
          premultipliedAlpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: false,
        }) ||
        this.canvas.getContext('experimental-webgl', {
          alpha: true,
          premultipliedAlpha: false,
        })
      ) as WebGLRenderingContext | null;

      if (!gl) {
        this.isSupported = false;
        return;
      }

      this.gl = gl;

      // Compile shaders
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

      // Cache uniform locations
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

      this.isSupported = true;
    } catch (e) {
      console.warn('[WebGL] Post-processing initialization failed, falling back to 2D Canvas:', e);
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
    time: number
  ) {
    if (!this.isSupported || !this.gl || !this.program || !this.quadBuffer) return;

    const gl = this.gl;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = this.canvas.width;
    const height = this.canvas.height;

    if (width <= 0 || height <= 0) return;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);

    // Bind Quad Attributes
    const posAttr = gl.getAttribLocation(this.program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Set Uniforms
    gl.uniform2f(this.uResolutionLoc, width, height);
    gl.uniform1f(this.uTimeLoc, time / 1000);

    gl.uniform1f(this.uGrainIntensityLoc, config.filmGrainIntensity ?? 0);
    gl.uniform1f(this.uGrainSizeLoc, config.filmGrainSize ?? 1);
    gl.uniform1f(this.uGrainContrastLoc, config.filmGrainContrast ?? 0.5);

    gl.uniform1f(this.uScanlineIntensityLoc, config.scanlineIntensity ?? 0);
    gl.uniform1f(this.uScanlineDensityLoc, config.scanlineDensity ?? 2);
    gl.uniform1f(this.uCrtVignetteLoc, config.crtVignette ?? 0);
    gl.uniform1f(this.uCrtCurvatureLoc, config.crtVignette ? 0.35 : 0.0);

    gl.uniform1f(this.uLightBleedLoc, config.lightBleedIntensity ?? 0);
    gl.uniform1f(this.uLensFlareLoc, config.lensFlareIntensity ?? 0);

    const styleIdx =
      config.lensFlareStyle === 'starburst'
        ? 1
        : config.lensFlareStyle === 'cinematic'
        ? 2
        : 0;
    gl.uniform1i(this.uFlareStyleLoc, styleIdx);

    gl.uniform2f(this.uOpticalCenterLoc, width / 2, height / 2);

    // Pack up to 8 lights into uniform arrays
    const maxLights = Math.min(8, lights.length);
    gl.uniform1i(this.uLightCountLoc, maxLights);

    if (maxLights > 0) {
      const lightsData = new Float32Array(32); // 8 * 4
      const colorsData = new Float32Array(24); // 8 * 3

      for (let i = 0; i < maxLights; i++) {
        const l = lights[i];
        lightsData[i * 4 + 0] = l.x * dpr;
        lightsData[i * 4 + 1] = l.y * dpr;
        lightsData[i * 4 + 2] = l.velocity;
        lightsData[i * 4 + 3] = 1.0;

        const rgb = parseHexColor(l.colorHex);
        colorsData[i * 3 + 0] = rgb[0];
        colorsData[i * 3 + 1] = rgb[1];
        colorsData[i * 3 + 2] = rgb[2];
      }

      gl.uniform4fv(this.uLightsLoc, lightsData);
      gl.uniform3fv(this.uLightColorsLoc, colorsData);
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
    this.gl = null;
    this.isSupported = false;
  }
}
