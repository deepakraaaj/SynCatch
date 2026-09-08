import type { Task } from '../features/tasks/task-types';

/**
 * Intent Sprite ("Lumi") character moods.
 *
 * Deliberately no "angry"/punitive states — concern is expressed as `attentive`
 * (a gentle nudge) and inactivity as `dormant`/`settling`, never as guilt.
 */
export type CharacterMood =
  | 'dormant' // 3+ days inactive — quiet, resting, not angry
  | 'settling' // 1-2 days inactive — gentle re-entry
  | 'recovering' // streak just broke (within the last 2 days) — reframed positively
  | 'attentive' // several open tasks overdue — a supportive nudge, not a scold
  | 'steady' // active, streak 1-2, nothing special yet
  | 'building' // streak 3-6, momentum forming
  | 'glowing' // streak 7-20, sustained consistency
  | 'radiant'; // streak 21+, strong sustained momentum

export type MomentumTrend = 'rising' | 'steady' | 'cooling' | 'dormant';

export type MilestoneDays = 7 | 21 | 30;

export const MILESTONE_DAYS: readonly MilestoneDays[] = [7, 21, 30];

export interface CharacterStateInput {
  tasks: Task[];
  now: Date;
}

export interface CharacterStateResult {
  mood: CharacterMood;
  /** Consecutive local days (through today or yesterday) with >=1 completed task. */
  streak: number;
  /** Longest such run ever observed in the given task history. */
  bestStreak: number;
  /** Days since the most recently completed task's day (0 = completed something today). */
  daysInactive: number;
  completionsToday: number;
  completionsLast7d: number;
  momentum: MomentumTrend;
  /** Count of open tasks past their due date — feeds `attentive`, never `dormant`-style shame. */
  overdueBurden: number;
  /** Set only on the exact computation where `streak` first equals a milestone threshold. */
  milestoneReached: MilestoneDays | null;
}

/** Reaction triggers used to pick character-voiced copy for a specific moment. */
export type ReactionTrigger = 'taskCompleted' | 'streakContinued' | 'comeback' | 'overdueNudge';

export type SpriteSize = 'sm' | 'md' | 'lg' | 'hero';

export type GlowIntensity = 'none' | 'soft' | 'medium' | 'strong';
