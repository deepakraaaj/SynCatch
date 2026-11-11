import type { CharacterMood, ReactionTrigger } from './types';

/**
 * Small deterministic string hash — picks the same message for the same seed
 * every time (no RNG), so a given event on a given day always reads the same,
 * while different events/days naturally vary.
 */
function hashPick<T>(list: readonly T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return list[hash % list.length];
}

/**
 * Reaction copy, keyed by the moment that triggered it. Tone is always
 * recovery-oriented and companion-like — never guilt or shame language.
 */
export const REACTION_MESSAGES: Record<ReactionTrigger, readonly string[]> = {
  taskCompleted: [
    'That counts ✨',
    "Nice. You showed up today.",
    'One tiny step stronger.',
    "That's one down.",
    "We're moving again.",
  ],
  streakContinued: [
    "Look at that momentum.",
    "You're building something here.",
    'Consistency is showing up.',
    "Day after day — that's the whole game.",
  ],
  comeback: [
    'Back at it. That\'s what matters.',
    'No streak lost — just a new one starting.',
    'Your light is still here.',
    "Let's continue from here.",
  ],
  overdueNudge: [
    "A few things are waiting whenever you're ready.",
    'No rush — just a gentle nudge.',
    'Small progress still counts.',
    'One small action can restart the rhythm.',
  ],
};

/** Headline copy shown on the dashboard hero card, keyed by mood. */
export const MOOD_HEADLINES: Record<CharacterMood, string> = {
  dormant: 'Your light is still here.',
  settling: 'One small action keeps things moving.',
  recovering: "Let's continue from here.",
  attentive: "A few things are waiting whenever you're ready.",
  steady: "You're building momentum.",
  building: 'Your rhythm is getting stronger.',
  glowing: "You're building something real.",
  radiant: 'Your intention is taking shape.',
};

/** Supporting line shown under the headline on the dashboard hero card. */
export const MOOD_SUPPORTING_LINE: Record<CharacterMood, string> = {
  dormant: 'Small progress still counts. Start again, just one small step.',
  settling: 'Your momentum paused — easy to pick back up.',
  recovering: 'No streak lost — just a new one starting.',
  attentive: 'A little attention today keeps things light.',
  steady: 'Show up once today. That keeps it alive.',
  building: 'Small steps today, big change tomorrow.',
  glowing: 'Day after day — that\'s the whole game.',
  radiant: "You're becoming who you intended.",
};

export function pickReactionMessage(trigger: ReactionTrigger, seed: string): string {
  return hashPick(REACTION_MESSAGES[trigger], seed);
}

/** What Lumi says the first time you open each view in a session. */
export const VIEW_LINES: Record<string, string> = {
  focus: 'I’ll stay quiet while you lock in.',
  tasks: 'Small finishes create real momentum.',
  missions: 'This is where the bigger story lives.',
  calendar: 'Your rhythm leaves a trail.',
  journal: 'Take your time. I’m listening.',
  notes: 'Catch it before it disappears.',
  insights: 'Patterns are progress you can see.',
  review: 'Notice what worked — not only what remains.',
  settings: 'Make this space feel like yours.',
};

/** Companion lines for specific app events. */
export const COMPANION_LINES = {
  taskCaptured: 'Captured. Now it has a place.',
  focusStart: 'I’ll stay quiet. You only need to be here now.',
  focusResume: 'Welcome back. Let’s continue from here.',
  focusPause: 'A pause is information, not failure.',
  focusDrift: 'Want to return with one tiny action?',
  focusReset: 'Reset complete. Start again whenever you’re ready.',
} as const;
