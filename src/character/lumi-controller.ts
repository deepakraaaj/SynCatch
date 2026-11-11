/** Momentary things Lumi can do in response to an app event. */
export type CompanionReaction = 'idle' | 'smile' | 'notice' | 'focus' | 'celebrate' | 'comfort' | 'sleep';

/** A lower-priority reaction never interrupts a higher one that is still playing. */
export const REACTION_PRIORITY: Record<CompanionReaction, number> = {
  idle: 1,
  smile: 1,
  sleep: 1,
  notice: 2,
  comfort: 2,
  focus: 2,
  celebrate: 3,
};

const REACTION_BASE_MS: Record<CompanionReaction, number> = {
  idle: 3800,
  smile: 1600,
  sleep: 3200,
  notice: 3200,
  comfort: 3400,
  focus: 3400,
  celebrate: 3800,
};

/** How long a reaction (and its line) stays up — longer lines get time to be read. */
export function reactionDurationMs(reaction: CompanionReaction, text?: string) {
  return Math.max(REACTION_BASE_MS[reaction], text ? 1800 + text.length * 45 : 0);
}
