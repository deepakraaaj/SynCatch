import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';

const BRAND_PURPLE = '#6C5CE7';
const BRAND_BLUE = '#3E8BFF';
const SUCCESS_GREEN = '#2BD17E';

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
 * Animated SynCatch breakout check-loop.
 * Features a spinning crescent ring and a checkmark that draws in green upon completion.
 */
export const SynCatchLogoAnimated = forwardRef<SynCatchLogoHandle, SynCatchLogoAnimatedProps>(
  function SynCatchLogoAnimated(
    { className, themed = false, autoPlay = false, loop = false, playOnHover = false, duration = 1200, title = 'SynCatch' },
    ref,
  ) {
  const gradientId = useId();
  const [phase, setPhase] = useState<Phase>(() =>
    // Honour reduced-motion by skipping straight to the resolved (done) state.
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'done'
      : 'idle',
  );
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const start = useCallback(() => {
    clearTimers();
    // Reset to idle without a transition, then kick into the sweep next frame.
    setPhase('idle');
    timers.current.push(
      window.setTimeout(() => {
        setPhase('running');
        timers.current.push(window.setTimeout(() => setPhase('done'), duration));
        if (loop) {
          timers.current.push(window.setTimeout(() => start(), duration + 1000));
        }
      }, 20),
    );
  }, [clearTimers, duration, loop]);

  useImperativeHandle(ref, () => ({ play: start }), [start]);

  const playFromHover = useCallback(() => {
    if (phase !== 'running') {
      start();
    }
  }, [phase, start]);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && (autoPlay || loop)) {
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

      {/* Spinning crescent ring */}
      <path 
        d="M 50 18 A 32 32 0 1 0 82 50" 
        stroke={paint} 
        strokeWidth="8.5" 
        strokeLinecap="round" 
        style={{
          transformOrigin: '50px 50px',
          transform: sweeping ? 'rotate(360deg)' : 'rotate(0deg)',
          transition: sweeping ? `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'transform 200ms ease',
        }}
      />

      {/* Dynamic checkmark: clears during sweep, draws back in green when done */}
      <path 
        d="M 38 52 L 47 61 L 76 32" 
        stroke={done ? SUCCESS_GREEN : paint} 
        strokeWidth="8.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        pathLength={1}
        style={{
          transformOrigin: '50px 50px',
          strokeDasharray: 1,
          strokeDashoffset: sweeping ? 1 : 0,
          transform: done ? 'scale(1.08)' : 'scale(1)',
          transition: sweeping 
            ? 'stroke-dashoffset 200ms cubic-bezier(0.4, 0, 0.2, 1)' 
            : done 
              ? 'stroke-dashoffset 400ms cubic-bezier(0.4, 0, 0.2, 1), stroke 300ms ease, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' 
              : 'transform 200ms ease',
        }}
      />
    </svg>
  );
  },
);
