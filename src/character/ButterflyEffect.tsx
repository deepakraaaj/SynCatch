import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { butterflyDrift } from '../lib/motion';
import type { MilestoneDays } from './types';

interface ButterflyEffectProps {
  level: MilestoneDays;
  reduceMotion?: boolean;
  /** Called once the celebration has actually finished playing (or immediately, if reduced motion). */
  onComplete: () => void;
}

const BUTTERFLY_COUNT: Record<MilestoneDays, number> = { 7: 1, 21: 3, 30: 5 };

function Butterfly({ index, reduceMotion }: { index: number; reduceMotion: boolean }) {
  const offsetX = (index - 1) * 18;
  return (
    <motion.svg
      viewBox="0 0 40 40"
      width={22}
      height={22}
      aria-hidden="true"
      style={{ position: 'absolute', left: `calc(50% + ${offsetX}px)`, bottom: 0 }}
      {...butterflyDrift(reduceMotion, index * 0.15)}
    >
      <path d="M20 20 C 8 6, 2 10, 6 20 C 2 30, 8 34, 20 20 Z" fill="rgb(var(--accent) / 0.85)" />
      <path d="M20 20 C 32 6, 38 10, 34 20 C 38 30, 32 34, 20 20 Z" fill="rgb(var(--accent-soft) / 0.6)" />
      <rect x="19" y="14" width="2" height="12" rx="1" fill="rgb(var(--text-primary) / 0.4)" />
    </motion.svg>
  );
}

/**
 * Rare transformation moment — fires only on 7/21/30-day consistency
 * milestones (see milestoneRules.ts). Never the default state; showing up
 * here is what keeps the butterfly symbol meaningful.
 */
export function ButterflyEffect({ level, reduceMotion = false, onComplete }: ButterflyEffectProps) {
  useEffect(() => {
    const timeoutMs = reduceMotion ? 0 : 2400;
    const timer = window.setTimeout(onComplete, timeoutMs);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  if (reduceMotion) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[12px] font-semibold text-accent"
      >
        Transformation milestone reached
      </div>
    );
  }

  return (
    <div className="relative h-0 w-full" aria-hidden="true">
      <AnimatePresence>
        {Array.from({ length: BUTTERFLY_COUNT[level] }, (_, index) => (
          <Butterfly key={index} index={index} reduceMotion={reduceMotion} />
        ))}
      </AnimatePresence>
    </div>
  );
}
