interface SynCatchLogoProps {
  className?: string;
  /** Render both rings in currentColor instead of brand colors (for use on accent fills). */
  monochrome?: boolean;
  /** Adapt the rings to the active theme accent instead of the brand purple/blue. */
  themed?: boolean;
  title?: string;
}

const BRAND_PURPLE = '#6C5CE7';
const BRAND_BLUE = '#3E8BFF';

/**
 * SynCatch brandmark — two interlocking loops representing "capture & sync".
 * Brand colors: purple #6C5CE7 (Syn) + blue #3E8BFF (Catch).
 * Pass `themed` to make the rings track the active theme accent; leave it off
 * for brand moments (sign-in, loader, favicon) where the original colors matter.
 * Drawn on a 100×100 canvas; scale with width/height via className.
 */
export function SynCatchLogo({ className, monochrome = false, themed = false, title = 'SynCatch' }: SynCatchLogoProps) {
  let left: string;
  let right: string;
  if (monochrome) {
    left = 'currentColor';
    right = 'currentColor';
  } else if (themed) {
    left = 'rgb(var(--accent-soft))';
    right = 'rgb(var(--accent))';
  } else {
    left = BRAND_PURPLE;
    right = BRAND_BLUE;
  }

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
      {/* Purple loop (Syn) */}
      <circle cx="38" cy="50" r="21" fill="none" stroke={left} strokeWidth="12" />
      {/* Blue loop (Catch) — drawn on top */}
      <circle cx="62" cy="50" r="21" fill="none" stroke={right} strokeWidth="12" />
      {/* Weave: bring a short left arc back over the right ring at the lower crossing */}
      {!monochrome ? (
        <path d="M 50 67 A 21 21 0 0 1 38 71" fill="none" stroke={left} strokeWidth="12" strokeLinecap="butt" />
      ) : null}
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
}: {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  themed?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <SynCatchLogo className={logoClassName} themed={themed} />
      <span className={textClassName}>
        <span className="text-text-primary">Syn</span>
        <span style={{ color: themed ? 'rgb(var(--accent))' : BRAND_BLUE }}>Catch</span>
      </span>
    </div>
  );
}
