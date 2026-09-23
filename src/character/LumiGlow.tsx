import { motion } from 'framer-motion';
import { REACTION_GLOW, type CompanionReaction } from './lumi-controller';

/** Reactions that deserve a brighter, bigger glow — the "joy" beats. */
const BRIGHT: Partial<Record<CompanionReaction, true>> = { celebrate: true, smile: true };

interface LumiGlowProps {
  reaction: CompanionReaction;
  reduceMotion?: boolean;
}

/**
 * Joy's soft radiant glow, behind Lumi's artwork: a breathing radial halo
 * whose colour and brightness follow the current reaction (see
 * REACTION_GLOW) — gold for joy, violet for focus, calm teal at rest. Pure
 * CSS/motion, layered behind the character; never touches the art itself.
 */
export function LumiGlow({ reaction, reduceMotion = false }: LumiGlowProps) {
  const color = REACTION_GLOW[reaction];
  const bright = Boolean(BRIGHT[reaction]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-[-35%] -z-10 rounded-full"
      animate={
        reduceMotion
          ? { opacity: bright ? 0.85 : 0.55 }
          : { opacity: bright ? [0.6, 0.95, 0.6] : [0.4, 0.6, 0.4], scale: bright ? [1, 1.12, 1] : [1, 1.05, 1] }
      }
      transition={reduceMotion ? { duration: 0.3 } : { duration: bright ? 1.1 : 3.2, repeat: Infinity, ease: 'easeInOut' }}
      style={{ background: `radial-gradient(circle, rgb(${color} / 0.55) 0%, rgb(${color} / 0.16) 45%, transparent 72%)` }}
    />
  );
}
