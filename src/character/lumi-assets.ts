import neutral from '../assets/lumi/neutral.webp';
import happy from '../assets/lumi/happy.webp';
import excited from '../assets/lumi/excited.webp';
import focused from '../assets/lumi/focused.webp';
import thinking from '../assets/lumi/thinking.webp';
import concerned from '../assets/lumi/concerned.webp';
import encouraging from '../assets/lumi/encouraging.webp';
import celebrating from '../assets/lumi/celebrating.webp';
import sleeping from '../assets/lumi/sleeping.webp';
import calm from '../assets/lumi/calm.webp';

/** Lumi's expression set — one pre-rendered artwork per state, never redrawn in CSS/SVG. */
export type LumiExpression =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'focused'
  | 'thinking'
  | 'concerned'
  | 'encouraging'
  | 'celebrating'
  | 'sleeping'
  | 'calm';

export const LUMI_EXPRESSION_ASSET: Record<LumiExpression, string> = {
  neutral,
  happy,
  excited,
  focused,
  thinking,
  concerned,
  encouraging,
  celebrating,
  sleeping,
  calm,
};

/**
 * Maps the character-state engine's behavioral moods (src/character/types.ts)
 * onto Lumi's fixed expression art set. Kept as a single lookup so mood
 * resolution logic never needs to know which artwork exists.
 */
export const MOOD_TO_EXPRESSION: Record<
  'dormant' | 'settling' | 'recovering' | 'attentive' | 'steady' | 'building' | 'glowing' | 'radiant',
  LumiExpression
> = {
  dormant: 'sleeping',
  settling: 'thinking',
  recovering: 'encouraging',
  attentive: 'concerned',
  steady: 'calm',
  building: 'focused',
  glowing: 'happy',
  radiant: 'excited',
};
