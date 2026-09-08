import { motion } from 'framer-motion';
import { LUMI_EXPRESSION_ASSET } from './lumi-assets';
import type { LumiExpression } from './lumi-assets';

export type LumiSize = 'sm' | 'md' | 'lg' | 'hero';

const SIZE_PX: Record<LumiSize, number> = {
  sm: 32,
  md: 48,
  lg: 96,
  hero: 160,
};

interface LumiProps {
  expression: LumiExpression;
  size?: LumiSize;
  reduceMotion?: boolean;
  className?: string;
  /** Accessible label. Defaults to "Lumi" — pass a more specific label where the moment matters. */
  label?: string;
}

/**
 * Per-expression idle motion. Every variant is a small loop around the
 * artwork's own position/scale — never a redraw, never a distortion of the
 * image itself (no skew/stretch), just gentle presence.
 */
function getMotionProps(expression: LumiExpression, reduceMotion: boolean) {
  if (reduceMotion) return {};

  switch (expression) {
    case 'focused':
      // Very subtle breathing.
      return {
        animate: { scale: [1, 1.015, 1] },
        transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case 'celebrating':
      // Small scale spring on entrance, then settles.
      return {
        initial: { scale: 0.85, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { type: 'spring' as const, stiffness: 300, damping: 14 },
      };
    case 'concerned':
      // Very subtle side movement.
      return {
        animate: { x: [0, -2, 0, 2, 0] },
        transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case 'sleeping':
      // Barely-there breathing, slower than focused.
      return {
        animate: { scale: [1, 1.01, 1] },
        transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const },
      };
    default:
      // Idle float — slight vertical bob, 3-5s loop.
      return {
        animate: { y: [0, -4, 0] },
        transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const },
      };
  }
}

/**
 * Lumi, the Intent Sprite — rendered strictly from pre-made artwork
 * (src/assets/lumi/*.webp). This component only selects the right image for
 * the given expression, sizes it, and applies subtle motion around it. It
 * never redraws or approximates the character in CSS/SVG — quality comes
 * entirely from the art asset.
 */
export function Lumi({ expression, size = 'md', reduceMotion = false, className, label = 'Lumi' }: LumiProps) {
  const px = SIZE_PX[size];
  const motionProps = getMotionProps(expression, reduceMotion);

  return (
    <motion.img
      src={LUMI_EXPRESSION_ASSET[expression]}
      alt={label}
      width={px}
      height={px}
      draggable={false}
      className={`object-contain select-none ${className ?? ''}`}
      style={{ width: px, height: px }}
      {...motionProps}
    />
  );
}
