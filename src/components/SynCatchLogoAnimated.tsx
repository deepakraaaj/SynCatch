import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';

const BRAND_PURPLE = '#6C5CE7';
const BRAND_BLUE = '#3E8BFF';
const SUCCESS_GREEN = '#2BD17E';
const RADIUS = 28;

type Phase = 'idle' | 'running' | 'done';

/** Imperative handle so a parent (e.g. a wordmark) can replay the animation. */
export interface SynCatchLogoHandle {
  play: () => void;
}

interface SynCatchLogoAnimatedProps {
  className?: string;
  /** Track the active theme accent instead of the brand purple/blue. */
  themed?: boolean;
  /** Start the sweep automatically on mount. */
  autoPlay?: boolean;
  /** Loop the sweep → tick → reset cycle (implies autoPlay). */
  loop?: boolean;
  /** Replay the sweep when the pointer enters the mark. */
  playOnHover?: boolean;
  /** Sweep duration in ms. */
  duration?: number;
  title?: string;
}

/**
 * Animated SynCatch stopwatch — clicking the crown, hovering (`playOnHover`),
 * `autoPlay`, or the imperative `play()` handle sweeps the hand one progress
 * lap, then resolves into a checkmark ("caught & synced"). Pure CSS transitions
 * driven by a small phase state machine. The static {@link SynCatchLogo} stays
 * the source for baked app icons; use this only for live UI moments (loader,
 * sign-in, sidebar wordmark, empty states).
 */
export const SynCatchLogoAnimated = forwardRef<SynCatchLogoHandle, SynCatchLogoAnimatedProps>(
  function SynCatchLogoAnimated(
    { className, themed = false, autoPlay = false, loop = false, playOnHover = false, duration = 1800, title = 'SynCatch' },
    ref,
  ) {
  const gradientId = useId();
  const [phase, setPhase] = useState<Phase>(() =>
    // Honour reduced-motion by skipping straight to the resolved (tick) state.
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'done'
      : 'idle',
  );
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const startRef = useRef<() => void>(() => {});
  const start = useCallback(() => {
    clearTimers();
    // Reset to idle without a transition, then kick into the sweep next frame.
    setPhase('idle');
    timers.current.push(
      window.setTimeout(() => {
        setPhase('running');
        timers.current.push(window.setTimeout(() => setPhase('done'), duration));
        if (loop) {
          timers.current.push(window.setTimeout(() => startRef.current(), duration + 1100));
        }
      }, 20),
    );
  }, [clearTimers, duration, loop]);
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  useImperativeHandle(ref, () => ({ play: start }), [start]);

  // Hover replay shouldn't restart an in-flight sweep.
  const playFromHover = useCallback(() => {
    if (phase !== 'running') {
      start();
    }
  }, [phase, start]);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && (autoPlay || loop)) {
      // Defer one tick so the first state change isn't synchronous to the effect.
      const kick = window.setTimeout(start, 0);
      return () => {
        window.clearTimeout(kick);
        clearTimers();
      };
    }
    return clearTimers;
  }, [autoPlay, loop, start, clearTimers]);

  const from = themed ? 'rgb(var(--accent-soft))' : BRAND_PURPLE;
  const to = themed ? 'rgb(var(--accent))' : BRAND_BLUE;
  const paint = `url(#${gradientId})`;

  const sweeping = phase === 'running';
  const done = phase === 'done';

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="button"
      aria-label={`${title} — replay animation`}
      tabIndex={0}
      className={className}
      style={{ cursor: 'pointer' }}
      onClick={start}
      onMouseEnter={playOnHover ? playFromHover : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="22" y1="14" x2="78" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>

      {/* Crown — depresses slightly while the clock runs */}
      <rect
        x="45.5"
        y="11"
        width="9"
        height="12"
        rx="3"
        fill={paint}
        style={{
          transition: 'transform 140ms ease',
          transform: phase === 'idle' ? 'none' : 'translateY(2px)',
        }}
      />
      {/* Side buttons (symmetric) */}
      <line x1="30.7" y1="32" x2="26.2" y2="26.7" stroke={paint} strokeWidth="5" strokeLinecap="round" />
      <line x1="69.3" y1="32" x2="73.8" y2="26.7" stroke={paint} strokeWidth="5" strokeLinecap="round" />

      {/* Faint track ring */}
      <circle cx="50" cy="55" r={RADIUS} fill="none" stroke={paint} strokeWidth="9" opacity="0.18" />
      {/* Progress ring — sweeps from the top */}
      <circle
        cx="50"
        cy="55"
        r={RADIUS}
        fill="none"
        stroke={paint}
        strokeWidth="9"
        strokeLinecap="round"
        pathLength={1}
        transform="rotate(-90 50 55)"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: phase === 'idle' ? 1 : 0,
          transition: sweeping ? `stroke-dashoffset ${duration}ms linear` : 'none',
        }}
      />

      {/* Sweep hand + hub — fade out once the tick lands */}
      <g
        style={{
          opacity: done ? 0 : 1,
          transformBox: 'view-box',
          transformOrigin: '50px 55px',
          transform: phase === 'idle' ? 'rotate(0deg)' : 'rotate(360deg)',
          transition: sweeping ? `transform ${duration}ms linear, opacity 180ms ease` : 'opacity 180ms ease',
        }}
      >
        <line x1="50" y1="55" x2="50" y2="34" stroke={paint} strokeWidth="5" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="55" r="4.5" fill={paint} style={{ opacity: done ? 0 : 1, transition: 'opacity 180ms ease' }} />

      {/* Checkmark — draws in green when done ("caught & synced ✓") */}
      <path
        d="M 39 56 L 46.5 63.5 L 62 46.5"
        fill="none"
        stroke={SUCCESS_GREEN}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: done ? 0 : 1,
          opacity: done ? 1 : 0,
          transition: done ? 'stroke-dashoffset 360ms ease 60ms, opacity 120ms ease' : 'none',
        }}
      />
    </svg>
  );
  },
);
