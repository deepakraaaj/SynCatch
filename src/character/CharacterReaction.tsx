import { motion } from 'framer-motion';
import { IntentSprite } from './IntentSprite';
import { pickReactionMessage } from './characterMessages';
import { messagePop } from '../lib/motion';
import type { CharacterMood, ReactionTrigger } from './types';

interface CharacterReactionProps {
  mood: CharacterMood;
  trigger: ReactionTrigger;
  /** Deterministic seed (e.g. task id or day key) so the same event always shows the same line. */
  seed: string;
  reduceMotion?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Lumi + a short character-voiced message bubble — used inline for completion
 * moments and comeback beats. `aria-live="polite"` announces the message
 * without stealing focus from whatever the user is doing.
 */
export function CharacterReaction({ mood, trigger, seed, reduceMotion = false, size = 'sm', className }: CharacterReactionProps) {
  const message = pickReactionMessage(trigger, seed);

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <IntentSprite mood={mood} size={size} reduceMotion={reduceMotion} />
      <motion.p
        aria-live="polite"
        className="rounded-[18px] border border-borderSoft/40 bg-panel2 px-3 py-1.5 text-[13px] font-medium text-text-primary"
        {...messagePop(reduceMotion)}
      >
        {message}
      </motion.p>
    </div>
  );
}
