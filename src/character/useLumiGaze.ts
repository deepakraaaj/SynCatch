import { animate, useMotionValue, useSpring, type MotionValue } from 'framer-motion';
import { useEffect, useMemo, type RefObject } from 'react';
import type { LumiGaze } from './LumiEyes';
import { subscribeLumiClickPulses, type ClickPulse } from './lumi-click-reactions';

/** Pointer distance (px) at which gaze and head turn reach full travel. */
const REACH_PX = { x: 240, y: 190 };
/** After this long without pointer movement Lumi looks back ahead. */
const REST_AFTER_MS = 2500;
/** Minimum gap between click reactions, so rapid clicking doesn't stack them. */
const CLICK_GAP_MS = 220;
// Stiff and well-damped: eyes should snap to a target (~100ms), not wobble.
const EYE_SPRING = { stiffness: 320, damping: 32, mass: 0.6 };
// Softer and slower than the eyes: the head follows a beat after the glance,
// the way a real head follows the eyes instead of snapping with them.
const HEAD_SPRING = { stiffness: 130, damping: 16, mass: 1 };

/**
 * Where the head is pointed (x/y, -1..1) plus short click reactions layered
 * on top: `nod` lifts the head (0..~1.4), `cock` tilts it (-1..1). Lumi.tsx
 * turns these into rotation/offset of the separate head layer.
 */
export interface LumiHeadMotion extends LumiGaze {
  nod: MotionValue<number>;
  cock: MotionValue<number>;
}

// Click reactions per kind of click, as keyframes for `nod` and `cock`.
// `toward` is ±1: the side of Lumi the click happened on.
function clickReaction(pulse: ClickPulse, toward: number): { nod: number[]; cock: number[]; duration: number } {
  switch (pulse) {
    case 'submit': // something was made — happy double nod
      return { nod: [0, 1.4, 0, 0.9, 0], cock: [0, 0, 0, 0, 0], duration: 0.6 };
    case 'delete': // something went away — little head shake
      return { nod: [0, 0.3, 0.3, 0.2, 0], cock: [0, -1, 1, -0.6, 0], duration: 0.55 };
    case 'toggle':
      return { nod: [0, 0.8, 0], cock: [0, toward * 0.6, 0], duration: 0.4 };
    default: // poke / open — perks up and cocks its head toward the click
      return { nod: [0, 1, 0], cock: [0, toward, 0], duration: 0.45 };
  }
}

/**
 * Makes Lumi pay attention like a pet: eyes snap toward the pointer, the head
 * turns a beat later, and any click in the app makes the head look at what
 * was clicked and react to it. `target` is the element Lumi is drawn in; the
 * gaze origin is its head (upper part of the box).
 */
export function useLumiGaze(target: RefObject<Element | null>, enabled: boolean): LumiGaze & { head: LumiHeadMotion } {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const eyeX = useSpring(rawX, EYE_SPRING);
  const eyeY = useSpring(rawY, EYE_SPRING);
  const headX = useSpring(rawX, HEAD_SPRING);
  const headY = useSpring(rawY, HEAD_SPRING);
  const nod = useMotionValue(0);
  const cock = useMotionValue(0);

  useEffect(() => {
    if (!enabled) {
      rawX.set(0);
      rawY.set(0);
      return;
    }
    let frame = 0;
    let rest: number | undefined;
    let latest: { clientX: number; clientY: number } | null = null;
    let lastClick = 0;

    const lookAt = (point: { clientX: number; clientY: number }) => {
      const box = target.current?.getBoundingClientRect();
      if (!box) return 1;
      const originX = box.left + box.width / 2;
      const originY = box.top + box.height * 0.55;
      rawX.set(Math.max(-1, Math.min(1, (point.clientX - originX) / REACH_PX.x)));
      rawY.set(Math.max(-1, Math.min(1, (point.clientY - originY) / REACH_PX.y)));
      window.clearTimeout(rest);
      rest = window.setTimeout(() => {
        rawX.set(0);
        rawY.set(0);
      }, REST_AFTER_MS);
      return point.clientX < originX ? -1 : 1;
    };

    const onMove = (event: PointerEvent) => {
      latest = event;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (latest) lookAt(latest);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const unsubscribe = subscribeLumiClickPulses((pulse, event) => {
      const now = Date.now();
      if (now - lastClick < CLICK_GAP_MS) return;
      lastClick = now;
      const reaction = clickReaction(pulse, lookAt(event));
      void animate(nod, reaction.nod, { duration: reaction.duration, ease: 'easeOut' });
      void animate(cock, reaction.cock, { duration: reaction.duration, ease: 'easeOut' });
    });

    return () => {
      window.removeEventListener('pointermove', onMove);
      unsubscribe();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(rest);
    };
  }, [cock, enabled, nod, rawX, rawY, target]);

  return useMemo(
    () => ({ x: eyeX, y: eyeY, head: { x: headX, y: headY, nod, cock } }),
    [cock, eyeX, eyeY, headX, headY, nod],
  );
}
