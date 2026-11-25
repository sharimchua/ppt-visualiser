import { PerformanceProfile } from '../core/types';

export interface CanvasDprCaps {
  cellDpr: number;
  bgDpr: number;
  effectsDpr: number;
  webglDpr: number;
}

/**
 * Returns true on handheld/tablet touch devices without a precision fine pointer.
 */
export function isMobileTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const hasFinePointer = window.matchMedia?.('(pointer: fine)').matches;
  return !hasFinePointer && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

/**
 * Returns true on iOS / iPadOS Safari & WebKit devices.
 */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Platform-aware initial graphics profile when the user has not saved a preference.
 * iOS/iPadOS and touch devices default to 'eco' for battery stability;
 * Desktop defaults to 'max' to preserve full desktop post-processing.
 */
export function getDefaultPerformanceProfileForDevice(): PerformanceProfile {
  return isMobileTouchDevice() || isIosDevice() ? 'eco' : 'max';
}

/**
 * Returns device- and profile-calibrated devicePixelRatio caps for 2D and WebGL layers.
 */
export function getCanvasDprCaps(profile: PerformanceProfile = 'max'): CanvasDprCaps {
  const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const mobile = isMobileTouchDevice() || isIosDevice();
  const isEcoOrNone = profile === 'eco' || profile === 'none';

  if (mobile || isEcoOrNone) {
    const cellCap = isEcoOrNone ? 1.25 : 1.5;
    return {
      cellDpr: Math.min(rawDpr, cellCap),
      bgDpr: Math.min(rawDpr, 1.0),
      effectsDpr: Math.min(rawDpr, 1.0),
      webglDpr: Math.min(rawDpr, 1.0),
    };
  }

  return {
    cellDpr: Math.min(rawDpr, 2.0),
    bgDpr: Math.min(rawDpr, 1.5),
    effectsDpr: Math.min(rawDpr, profile === 'max' ? 2.0 : 1.5),
    webglDpr: Math.min(rawDpr, profile === 'max' ? 1.5 : 1.25),
  };
}

/**
 * Maximum active GPU/2D particles permitted per performance profile.
 */
export function getMaxParticlesForProfile(profile: PerformanceProfile): number {
  switch (profile) {
    case 'max':
      return 2048;
    case 'balanced':
      return 512;
    case 'eco':
      return 128;
    case 'none':
    default:
      return 0;
  }
}

/**
 * Returns true if the WebGL post-processing shader pipeline is allowed for this profile.
 */
export function isWebGLAllowedForProfile(profile: PerformanceProfile): boolean {
  return profile === 'max' || profile === 'balanced';
}

/**
 * Returns true if full-screen post-processing (grain, scanlines, flares, bleed, bloom)
 * is allowed for this profile. In 'eco' and 'none', 2D fallback post-processing is also bypassed.
 */
export function isPostProcessingAllowedForProfile(profile: PerformanceProfile): boolean {
  return profile === 'max' || profile === 'balanced';
}
