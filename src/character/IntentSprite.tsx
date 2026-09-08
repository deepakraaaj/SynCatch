import { Lumi } from './Lumi';
import { LumiGlow } from './LumiGlow';
import { MOOD_VISUALS, SPRITE_SIZE_PX } from './characterConfig';
import { MOOD_TO_EXPRESSION } from './lumi-assets';
import type { CharacterMood, SpriteSize } from './types';

interface IntentSpriteProps {
  mood: CharacterMood;
  size?: SpriteSize;
  reduceMotion?: boolean;
  className?: string;
  title?: string;
}

/**
 * Lumi, the Intent Sprite — SynCatch's living companion, rendered from
 * pre-made artwork (src/assets/lumi/*.webp via the Lumi component). This
 * wrapper only maps a behavioral `mood` (from the character-state engine) to
 * one of Lumi's fixed expressions and layers a theme-adaptive glow around it
 * — it never draws any part of the character itself.
 */
export function IntentSprite({ mood, size = 'md', reduceMotion = false, className, title = 'Lumi' }: IntentSpriteProps) {
  const visual = MOOD_VISUALS[mood];
  const px = SPRITE_SIZE_PX[size];
  const expression = MOOD_TO_EXPRESSION[mood];

  return (
    <LumiGlow intensity={visual.glowIntensity} sizePx={px} className={className}>
      <Lumi expression={expression} size={size} reduceMotion={reduceMotion} label={title} />
    </LumiGlow>
  );
}
