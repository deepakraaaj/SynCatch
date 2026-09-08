import { motion } from 'framer-motion';
import sparkle1 from '../assets/effects/sparkle_1.webp';
import sparkle2 from '../assets/effects/sparkle_2.webp';
import sparkle3 from '../assets/effects/sparkle_3.webp';
import confetti from '../assets/effects/confetti.webp';
import heartParticles from '../assets/effects/heart_particles.webp';
import chestGlowIdle from '../assets/effects/chest_glow_idle.webp';
import chestGlowStrong from '../assets/effects/chest_glow_strong.webp';
import magicTrailGold from '../assets/effects/magic_trail_gold.webp';
import magicTrailTeal from '../assets/effects/magic_trail_teal.webp';

export const EFFECT_ASSETS = {
  sparkle1,
  sparkle2,
  sparkle3,
  confetti,
  heartParticles,
  chestGlowIdle,
  chestGlowStrong,
  magicTrailGold,
  magicTrailTeal,
} as const;

export type EffectName = keyof typeof EFFECT_ASSETS;

interface SparkleBurstProps {
  className?: string;
  size?: number;
  reduceMotion?: boolean;
}

/**
 * Micro sparkle burst that floats and scales on positive actions (saved, completed, created).
 */
export function SparkleBurst({ className, size = 20, reduceMotion = false }: SparkleBurstProps) {
  if (reduceMotion) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4, y: 4 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0.4, 1.15, 0.9],
        y: [4, -12],
      }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className={`pointer-events-none absolute select-none ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src={EFFECT_ASSETS.sparkle1}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain filter drop-shadow-[0_0_6px_rgba(255,215,0,0.5)]"
      />
    </motion.div>
  );
}

/**
 * Micro confetti burst for celebratory moments (milestones, first note created, big tasks).
 */
export function ConfettiBurst({ className, size = 36, reduceMotion = false }: SparkleBurstProps) {
  if (reduceMotion) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1.2, 1],
        rotate: [ -10, 10, 0 ],
        y: [0, -18],
      }}
      transition={{ duration: 1.1, ease: 'easeOut' }}
      className={`pointer-events-none absolute select-none ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src={EFFECT_ASSETS.confetti}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
      />
    </motion.div>
  );
}
