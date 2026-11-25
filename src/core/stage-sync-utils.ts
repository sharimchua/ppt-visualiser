import { VisualiserConfig } from './types';

/**
 * Keys that stay strictly local to each participant's device in a Stage room:
 * GPU/battery profile, visual post-processing cosmetics, audio output, and focus mode.
 */
const DEVICE_LOCAL_CONFIG_KEYS: ReadonlySet<keyof VisualiserConfig> = new Set([
  'performanceProfile',
  'backgroundTheme',
  'webglEnabled',
  'filmGrainEnabled',
  'filmGrainIntensity',
  'filmGrainSize',
  'filmGrainContrast',
  'sparksEnabled',
  'particleIntensity',
  'particleSize',
  'particleVolume',
  'particleGravity',
  'particleOriginDistance',
  'shockwavesEnabled',
  'shockwaveRadius',
  'shockwaveSpeed',
  'shockwaveDecayDurationMs',
  'glowBloomEnabled',
  'glowBloom',
  'tonicShiftEffectsEnabled',
  'motionTrailsEnabled',
  'motionTrails',
  'ghostingEnabled',
  'ghostingIntensity',
  'lightBleedEnabled',
  'lightBleedIntensity',
  'scanlinesEnabled',
  'scanlineIntensity',
  'scanlineDensity',
  'crtVignette',
  'lensFlareEnabled',
  'lensFlareIntensity',
  'lensFlareStyle',
  'soundEnabled',
  'masterVolume',
  'focusModeEnabled',
]);

/**
 * Extracts only the musical, notation, layout, and controller settings safe to
 * synchronise across teacher and student devices on Stage.
 */
export function pickSyncableConfig(
  config: Partial<VisualiserConfig>
): Partial<VisualiserConfig> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (!DEVICE_LOCAL_CONFIG_KEYS.has(key as keyof VisualiserConfig)) {
      result[key] = value;
    }
  }
  return result as Partial<VisualiserConfig>;
}
