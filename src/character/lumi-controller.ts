import type { LumiExpression } from './lumi-assets';

/** Momentary things Lumi can do in response to an app event. */
export type CompanionReaction = 'idle' | 'smile' | 'notice' | 'focus' | 'celebrate' | 'comfort' | 'sleep';

/**
 * Lumi's resting face. It is the only face with the full rig — open eyes that
 * follow the pointer and blink, a head that turns, legs that walk — so Lumi
 * always rests on it. Other faces are momentary reactions below; mood shows in
 * the dashboard copy instead. (Resting on mood faces lost the eye/head rig:
 * calm and happy have closed eyes, encouraging/excited wink, and thinking/
 * concerned frown.)
 */
export const RESTING_EXPRESSION: LumiExpression = 'neutral';

export const REACTION_TO_EXPRESSION: Record<Exclude<CompanionReaction, 'idle'>, LumiExpression> = {
  // Lumi's big smile, shown whenever you click something in the app.
  smile: 'happy',
  notice: 'encouraging',
  focus: 'focused',
  celebrate: 'celebrating',
  comfort: 'calm',
  sleep: 'sleeping',
};

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

interface ExpressionInput {
  reaction: CompanionReaction;
  focusRunning: boolean;
}

/**
 * The single rule for which face Lumi shows, used by every surface that renders
 * the full character: an active reaction beats focus, focus beats rest.
 */
export function resolveLumiExpression({ reaction, focusRunning }: ExpressionInput): LumiExpression {
  if (reaction !== 'idle') return REACTION_TO_EXPRESSION[reaction];
  if (focusRunning) return 'focused';
  return RESTING_EXPRESSION;
}
