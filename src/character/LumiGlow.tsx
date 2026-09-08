import type { PropsWithChildren } from 'react';
import type { GlowIntensity } from './types';

const GLOW_ALPHA: Record<GlowIntensity, number> = {
  none: 0,
  soft: 0.14,
  medium: 0.22,
  strong: 0.32,
};

interface LumiGlowProps {
  intensity: GlowIntensity;
  sizePx: number;
  className?: string;
}

/**
 * Glow effect wrapper — kept separate from the Lumi artwork itself per the
 * "art asset, not CSS illustration" rule: this only paints a soft halo
 * behind/around the image, it never draws any part of the character.
 * Glow color/intensity is theme-adaptive (rgb(var(--accent)...)) and boosted
 * on light-mode themes via --lumi-glow-multiplier (src/styles/globals.css).
 */
export function LumiGlow({ intensity, sizePx, className, children }: PropsWithChildren<LumiGlowProps>) {
  const alpha = GLOW_ALPHA[intensity];

  // Layered, increasingly-transparent shadows read as a soft atmospheric
  // glow; a single shadow at this size reads as a hard-edged ring instead.
  const boxShadow =
    alpha > 0
      ? [0.55, 0.32, 0.16]
          .map(
            (falloff, i) =>
              `0 0 calc(${sizePx * (0.22 + i * 0.18)}px * var(--lumi-glow-multiplier, 1)) rgb(var(--accent) / calc(${alpha * falloff} * var(--lumi-glow-multiplier, 1)))`,
          )
          .join(', ')
      : undefined;

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        borderRadius: '9999px',
        boxShadow,
      }}
    >
      {children}
    </div>
  );
}
