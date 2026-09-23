import type { LumiExpression } from './lumi-assets';
import type { CharacterMood } from './types';

/** Momentary things Lumi can do in response to an app event. */
export type CompanionReaction = 'idle' | 'notice' | 'focus' | 'celebrate' | 'comfort' | 'sleep';

/**
 * Resting expression per behavioral mood (src/character/types.ts). Deliberately
 * avoids the sad `concerned` art for everyday states — overdue work reads as
 * `thinking`, long inactivity as `calm`, never as guilt.
 */
export const MOOD_TO_EXPRESSION: Record<CharacterMood, LumiExpression> = {
  dormant: 'calm',
  settling: 'neutral',
  recovering: 'encouraging',
  attentive: 'thinking',
  steady: 'neutral',
  building: 'encouraging',
  glowing: 'happy',
  radiant: 'excited',
};

export const REACTION_TO_EXPRESSION: Record<Exclude<CompanionReaction, 'idle'>, LumiExpression> = {
  notice: 'encouraging',
  focus: 'focused',
  celebrate: 'celebrating',
  comfort: 'calm',
  sleep: 'sleeping',
};

/** A lower-priority reaction never interrupts a higher one that is still playing. */
export const REACTION_PRIORITY: Record<CompanionReaction, number> = {
  idle: 1,
  sleep: 1,
  notice: 2,
  comfort: 2,
  focus: 2,
  celebrate: 3,
};

const REACTION_BASE_MS: Record<CompanionReaction, number> = {
  idle: 3800,
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
  mood: CharacterMood;
}

/**
 * The single rule for which face Lumi shows, used by every surface that renders
 * the full character: an active reaction beats focus, focus beats mood.
 */
export function resolveLumiExpression({ reaction, focusRunning, mood }: ExpressionInput): LumiExpression {
  if (reaction !== 'idle') return REACTION_TO_EXPRESSION[reaction];
  if (focusRunning) return 'focused';
  return MOOD_TO_EXPRESSION[mood];
}
