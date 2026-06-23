import { useId, useRef } from 'react';
import { SynCatchLogoAnimated, type SynCatchLogoHandle } from './SynCatchLogoAnimated';

interface SynCatchLogoProps {
  className?: string;
  /** Render the mark in currentColor instead of brand colors (for use on accent fills). */
  monochrome?: boolean;
  /** Adapt the mark to the active theme accent instead of the brand purple/blue. */
  themed?: boolean;
  title?: string;
}

const BRAND_PURPLE = '#6C5CE7';
const BRAND_BLUE = '#3E8BFF';

/**
 * SynCatch brandmark — an iconic breakout check-loop representing capture and focus.
 * Bold, high-contrast, and extremely readable at all viewport sizes.
 */
export function SynCatchLogo({ className, monochrome = false, themed = false, title = 'SynCatch' }: SynCatchLogoProps) {
  const gradientId = useId();

  // Monochrome paints flat in currentColor; otherwise a diagonal gradient
  // (brand purple→blue, or the theme accent pair when `themed`).
  const paint = monochrome ? 'currentColor' : `url(#${gradientId})`;
  const from = themed ? 'rgb(var(--accent-soft))' : BRAND_PURPLE;
  const to = themed ? 'rgb(var(--accent))' : BRAND_BLUE;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      {!monochrome ? (
        <defs>
          <linearGradient id={gradientId} x1="22" y1="14" x2="78" y2="86" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
      ) : null}
      
      {/* Outer crescent ring with breakout gap at top-right */}
      <path 
        d="M 50 18 A 32 32 0 1 0 82 50" 
        stroke={paint} 
        strokeWidth="8.5" 
        strokeLinecap="round" 
      />
      
      {/* Bold checkmark breaking out of the gap */}
      <path 
        d="M 38 52 L 47 61 L 76 32" 
        stroke={paint} 
        strokeWidth="8.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}

/**
 * Full SynCatch wordmark — logo + name. With `themed`, the mark and the "Catch"
 * half of the name follow the theme accent; otherwise they stay brand blue.
 */
export function SynCatchWordmark({
  className,
  logoClassName = 'h-7 w-7',
  textClassName = 'text-base font-bold tracking-tight',
  themed = false,
  animated = false,
}: {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  themed?: boolean;
  /** Use the animated stopwatch mark; it sweeps → ticks when the wordmark is hovered. */
  animated?: boolean;
}) {
  const logoRef = useRef<SynCatchLogoHandle>(null);
  return (
    <div
      className={`flex items-center gap-2 ${className ?? ''}`}
      onMouseEnter={animated ? () => logoRef.current?.play() : undefined}
    >
      {animated ? (
        <SynCatchLogoAnimated ref={logoRef} className={logoClassName} themed={themed} />
      ) : (
        <SynCatchLogo className={logoClassName} themed={themed} />
      )}
      <span className={textClassName}>
        <span className="text-text-primary">Syn</span>
        <span style={{ color: themed ? 'rgb(var(--accent))' : BRAND_BLUE }}>Catch</span>
      </span>
    </div>
  );
}
