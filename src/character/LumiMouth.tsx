import { motion } from 'framer-motion';

/** Ink color of the drawn mouth/lashes elsewhere on the art (sampled from neutral.webp). */
const INK = '#0b0400';
/** Neutral's mouth, in the 512px normalized canvas (measured from the art). Masked out and redrawn wider. */
const MOUTH = { cx: 252.5, cy: 310.5, skin: '#fbe7c3' };

interface LumiMouthProps {
  active: boolean;
  reduceMotion?: boolean;
}

/**
 * A brighter, wider smile drawn over neutral's small closed mouth — used only
 * while Lumi is walking, since neutral is the one face with legs and the eye
 * rig, but its resting mouth reads flat in motion. Same technique as
 * LumiEyes: mask a patch of the art with the sampled skin tone, redraw in the
 * art's own ink color. Never touches any other expression.
 */
export function LumiMouth({ active, reduceMotion = false }: LumiMouthProps) {
  const { cx, cy, skin } = MOUTH;

  return (
    <svg viewBox="0 0 512 512" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <motion.g
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.15 }}
      >
        {/* Cover the drawn closed mouth with the surrounding cheek tone. */}
        <ellipse cx={cx} cy={cy - 1} rx={17} ry={8} fill={skin} />
        {/* A wider, upturned smile in the art's own ink — open just enough to feel bright, not gaping. */}
        <motion.path
          d={`M${cx - 15},${cy - 1}
              Q${cx - 8},${cy + 7} ${cx},${cy + 6}
              Q${cx + 8},${cy + 7} ${cx + 15},${cy - 1}
              Q${cx + 8},${cy + 3} ${cx},${cy + 3}
              Q${cx - 8},${cy + 3} ${cx - 15},${cy - 1}Z`}
          fill={INK}
          animate={reduceMotion || !active ? undefined : { scaleX: [1, 1.04, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      </motion.g>
    </svg>
  );
}
