/**
 * Shared framer-motion variants, gated by the app's `reduceMotion` setting.
 * Callers pass their own `reduceMotion` (from useSettingsStore) — components
 * in src/character stay store-agnostic and simply receive the flag as a prop.
 */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Staggered entrance for a list of sibling sections (dashboard cards, etc). */
export function stagger(index: number, reduceMotion: boolean) {
  return reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, delay: index * 0.06, ease: EASE_OUT },
      };
}

/** Entrance for the sprite itself — a soft scale/opacity settle, no bounce. */
export function spriteEnter(reduceMotion: boolean) {
  return reduceMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.92 },
        animate: { opacity: 1, scale: 1 },
        transition: { duration: 0.4, ease: EASE_OUT },
      };
}

/** A single butterfly drifting up and away — used by ButterflyEffect. */
export function butterflyDrift(reduceMotion: boolean, delaySeconds = 0) {
  return reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12, x: 0 },
        animate: { opacity: [0, 1, 1, 0], y: -64, x: [0, 8, -6, 4] },
        transition: { duration: 2.2, delay: delaySeconds, ease: EASE_OUT },
      };
}

/** Message bubble pop-in, used by CharacterReaction. */
export function messagePop(reduceMotion: boolean) {
  return reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.28, ease: EASE_OUT },
      };
}
