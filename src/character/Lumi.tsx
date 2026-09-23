import { AnimatePresence, motion, useMotionValue, useTransform, type TargetAndTransition, type Transition } from 'framer-motion';
import { useState } from 'react';
import { cn } from '../lib/cn';
import { LUMI_BADGE_ASSET, LUMI_EXPRESSION_ASSET, type LumiExpression } from './lumi-assets';
import { LumiEyes, type LumiGaze } from './LumiEyes';
import { LumiMesh } from './LumiMesh';
import { LUMI_RIG } from './lumi-rig';
import type { LumiHeadMotion } from './useLumiGaze';

export type LumiSize = 'sm' | 'md' | 'lg' | 'hero';
export type LumiMotion = 'idle' | 'walk' | 'none';

const SIZE_PX: Record<LumiSize, number> = {
  sm: 32,
  md: 48,
  lg: 96,
  hero: 160,
};

/** At or below this size the full body is unreadable, so the head-crop badge art is used. */
const BADGE_MAX_PX = 48;

/**
 * How far the head moves (512px canvas units). Turning toward the pointer is
 * a tilt around the neck plus a small shift toward it; `cockDeg`/`nodPx` are
 * the extra tilt and lift of a click reaction (see useLumiGaze).
 */
const HEAD = { turnDeg: 7, cockDeg: 8, shiftX: 8, shiftY: 5, nodPx: 12 };

// Ambient loop for faces without a neck rig. A gently breathing chest reads
// as alive; moving or pulsing the whole picture reads as a sticker. (Rigged
// faces breathe inside the mesh, see LumiMesh.)
const BREATH: { animate: TargetAndTransition; transition: Transition } = {
  animate: { scaleY: [1, 1.014, 1] },
  transition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
};

interface LumiProps {
  expression: LumiExpression;
  /** Preset, exact px, or 'fill' to take the parent's box. */
  size?: LumiSize | number | 'fill';
  /** Defaults to 'badge' at <=48px and 'full' above. */
  variant?: 'full' | 'badge';
  /** Defaults to 'idle' for full art and 'none' for badges. 'walk' plays the walk cycle (standing pose). */
  motion?: LumiMotion;
  /** While walking: -1 heading left, 1 heading right, 0 in place. */
  walkDirection?: number;
  reduceMotion?: boolean;
  className?: string;
  /** Accessible label. Pass '' when Lumi is decorative next to text that already says it all. */
  label?: string;
  /** Where the eyes look (see useLumiGaze). Full art only; ignored under reduced motion. */
  gaze?: LumiGaze;
  /** Head turn + click reactions (see useLumiGaze). Moves only the head. */
  headGaze?: LumiHeadMotion;
}

/**
 * Lumi, the Intent Sprite — the only component that renders the character.
 * It picks the pre-made artwork for an expression (src/assets/lumi), sizes it,
 * and cross-fades between expressions. Resting expressions render on a warp
 * mesh (LumiMesh) so the head turns toward the pointer and reacts to clicks
 * while the body stays planted and breathes — bent, never cut. Open eyes blink
 * and glance via the eye rig (LumiEyes). Nothing is redrawn in CSS/SVG.
 */
export function Lumi({ expression, size = 'md', variant, motion: motionKind, walkDirection = 0, reduceMotion = false, className, label = 'Lumi', gaze, headGaze }: LumiProps) {
  const px = typeof size === 'number' ? size : size === 'fill' ? null : SIZE_PX[size];
  const resolvedVariant = variant ?? (px !== null && px <= BADGE_MAX_PX ? 'badge' : 'full');
  const resolvedMotion = reduceMotion ? 'none' : motionKind ?? (resolvedVariant === 'badge' ? 'none' : 'idle');
  const src = (resolvedVariant === 'badge' ? LUMI_BADGE_ASSET : LUMI_EXPRESSION_ASSET)[expression];
  const rig = resolvedVariant === 'full' && !reduceMotion ? LUMI_RIG[expression] : undefined;
  const [meshFailed, setMeshFailed] = useState(false);
  const head = rig?.head && !meshFailed ? rig.head : undefined;
  const breathing = resolvedMotion === 'idle';

  const still = useMotionValue(0);
  const turnX = headGaze?.x ?? still;
  const turnY = headGaze?.y ?? still;
  const nod = headGaze?.nod ?? still;
  const cock = headGaze?.cock ?? still;
  const headRotate = useTransform([turnX, cock], ([x, c]: number[]) => x * HEAD.turnDeg + c * HEAD.cockDeg);
  const headShiftX = useTransform(turnX, (x) => x * HEAD.shiftX);
  const headShiftY = useTransform([turnY, nod], ([y, n]: number[]) => y * HEAD.shiftY - n * HEAD.nodPx);

  const image = 'absolute inset-0 h-full w-full object-contain';

  return (
    <motion.span
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn('relative block shrink-0 select-none', px === null && 'h-full w-full', className)}
      style={px === null ? undefined : { width: px, height: px }}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={src}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
        >
          {rig && head ? (
            <LumiMesh
              src={src}
              rig={{ ...rig, head }}
              pose={{ rotate: headRotate, shiftX: headShiftX, shiftY: headShiftY }}
              breathing={breathing || resolvedMotion === 'walk'}
              walking={resolvedMotion === 'walk'}
              walkDirection={walkDirection}
              gaze={gaze}
              onUnsupported={() => setMeshFailed(true)}
            />
          ) : (
            <motion.span
              className="absolute inset-0"
              style={{ originY: 1 }}
              animate={breathing ? BREATH.animate : undefined}
              transition={breathing ? BREATH.transition : undefined}
            >
              <img src={src} alt="" draggable={false} className={image} />
              {rig?.eyes.length ? <LumiEyes src={src} rig={rig} gaze={gaze} /> : null}
            </motion.span>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
