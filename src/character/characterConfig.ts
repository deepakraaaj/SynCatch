import type { CharacterMood, GlowIntensity } from './types';

interface MoodVisual {
  glowIntensity: GlowIntensity;
}

/**
 * Per-mood glow configuration. Deliberately contains no color values — glow
 * color always comes from the active theme's CSS variables at render time
 * (see LumiGlow.tsx), so this config never needs to know about themes.
 *
 * Posture/motion is owned by the art asset + Lumi's per-expression animation
 * (see lumi-assets.ts's MOOD_TO_EXPRESSION and Lumi.tsx) — this file only
 * controls how strongly Lumi glows in each mood.
 */
export const MOOD_VISUALS: Record<CharacterMood, MoodVisual> = {
  dormant: { glowIntensity: 'none' },
  settling: { glowIntensity: 'soft' },
  recovering: { glowIntensity: 'soft' },
  attentive: { glowIntensity: 'soft' },
  steady: { glowIntensity: 'medium' },
  building: { glowIntensity: 'medium' },
  glowing: { glowIntensity: 'strong' },
  radiant: { glowIntensity: 'strong' },
};

export const SPRITE_SIZE_PX: Record<'sm' | 'md' | 'lg' | 'hero', number> = {
  sm: 32,
  md: 48,
  lg: 96,
  hero: 160,
};
