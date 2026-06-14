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
 * SynCatch brandmark — a clean, symmetric stopwatch (crown + side buttons +
 * sweep hand) in a single purple→blue brand gradient, signalling a focus /
 * time-tracking tool. Pass `themed` to make the mark track the active theme
 * accent; leave it off for brand moments (sign-in, loader, favicon) where the
 * original colors matter. Drawn on a 100×100 canvas; scale via className.
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
      {/* Side buttons (symmetric) */}
      <line x1="30.7" y1="32" x2="26.2" y2="26.7" stroke={paint} strokeWidth="5" strokeLinecap="round" />
      <line x1="69.3" y1="32" x2="73.8" y2="26.7" stroke={paint} strokeWidth="5" strokeLinecap="round" />
      {/* Crown */}
      <rect x="45.5" y="11" width="9" height="12" rx="3" fill={paint} />
      {/* Watch body */}
      <circle cx="50" cy="55" r="28" fill="none" stroke={paint} strokeWidth="9" />
      {/* Sweep hand + hub */}
      <line x1="50" y1="55" x2="57.5" y2="42" stroke={paint} strokeWidth="5" strokeLinecap="round" />
      <circle cx="50" cy="55" r="4.5" fill={paint} />
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
