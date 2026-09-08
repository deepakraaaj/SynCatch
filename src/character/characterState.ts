import { getLocalDateKey } from '../lib/date';
import { MILESTONE_DAYS } from './types';
import type { CharacterMood, CharacterStateInput, CharacterStateResult, MilestoneDays, MomentumTrend } from './types';

function addDays(date: Date, delta: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

/** Builds the set of distinct local-day keys that have >=1 completed task. */
function getCompletedDayKeys(input: CharacterStateInput): Set<string> {
  const keys = new Set<string>();
  for (const task of input.tasks) {
    if (!task.completed_at) continue;
    keys.add(getLocalDateKey(new Date(task.completed_at)));
  }
  return keys;
}

/** Consecutive days ending today (or yesterday, if today has no completion yet). */
function getCurrentStreak(completedDayKeys: Set<string>, now: Date): number {
  let cursor = now;
  if (!completedDayKeys.has(getLocalDateKey(now))) {
    cursor = addDays(now, -1);
  }

  let streak = 0;
  while (completedDayKeys.has(getLocalDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest consecutive run anywhere in the completed-day history. */
function getBestStreak(completedDayKeys: Set<string>): number {
  if (completedDayKeys.size === 0) return 0;

  const sortedDays = [...completedDayKeys]
    .map((key) => new Date(`${key}T00:00:00`).getTime())
    .sort((a, b) => a - b);

  let best = 1;
  let current = 1;
  for (let i = 1; i < sortedDays.length; i += 1) {
    const dayGap = Math.round((sortedDays[i] - sortedDays[i - 1]) / 86_400_000);
    current = dayGap === 1 ? current + 1 : 1;
    best = Math.max(best, current);
  }
  return best;
}

function getDaysInactive(completedDayKeys: Set<string>, now: Date): number {
  if (completedDayKeys.size === 0) return Infinity;

  const todayTime = new Date(getLocalDateKey(now)).getTime();
  let mostRecent = -Infinity;
  for (const key of completedDayKeys) {
    const time = new Date(key).getTime();
    if (time > mostRecent) mostRecent = time;
  }
  return Math.round((todayTime - mostRecent) / 86_400_000);
}

function getMomentum(input: CharacterStateInput, daysInactive: number): { momentum: MomentumTrend; completionsLast7d: number } {
  const { tasks, now } = input;
  const inWindow = (offsetStartDays: number, offsetEndDays: number) => {
    const windowStart = addDays(now, -offsetStartDays);
    const windowEnd = addDays(now, -offsetEndDays);
    return tasks.filter((task) => {
      if (!task.completed_at) return false;
      const completed = new Date(task.completed_at);
      return completed >= new Date(getLocalDateKey(windowStart)) && completed < addDays(new Date(getLocalDateKey(windowEnd)), 1);
    }).length;
  };

  const completionsLast7d = inWindow(6, 0);

  if (daysInactive >= 3) {
    return { momentum: 'dormant', completionsLast7d };
  }

  const completionsPrior7d = inWindow(13, 7);
  if (completionsPrior7d === 0 && completionsLast7d === 0) {
    return { momentum: 'steady', completionsLast7d };
  }
  if (completionsLast7d > completionsPrior7d * 1.2) {
    return { momentum: 'rising', completionsLast7d };
  }
  if (completionsPrior7d > 0 && completionsLast7d < completionsPrior7d * 0.8) {
    return { momentum: 'cooling', completionsLast7d };
  }
  return { momentum: 'steady', completionsLast7d };
}

function resolveMood(params: {
  streak: number;
  bestStreak: number;
  daysInactive: number;
  overdueBurden: number;
}): CharacterMood {
  const { streak, bestStreak, daysInactive, overdueBurden } = params;

  if (overdueBurden >= 5 && daysInactive < 3) return 'attentive';
  if (daysInactive >= 3) return 'dormant';
  if (daysInactive >= 1) return 'settling';
  if (streak === 0 && bestStreak > 0) return 'recovering';
  if (streak >= 21) return 'radiant';
  if (streak >= 7) return 'glowing';
  if (streak >= 3) return 'building';
  return 'steady';
}

function resolveMilestone(streak: number): MilestoneDays | null {
  return (MILESTONE_DAYS.find((days) => days === streak) as MilestoneDays | undefined) ?? null;
}

/**
 * Pure, deterministic resolver: user behavior data in, character state out.
 * No randomness, no LLM, no I/O — safe to call on every render.
 */
export function resolveCharacterState(input: CharacterStateInput): CharacterStateResult {
  const completedDayKeys = getCompletedDayKeys(input);
  const streak = getCurrentStreak(completedDayKeys, input.now);
  const bestStreak = Math.max(getBestStreak(completedDayKeys), streak);
  const daysInactiveRaw = getDaysInactive(completedDayKeys, input.now);
  const daysInactive = Number.isFinite(daysInactiveRaw) ? daysInactiveRaw : 0;

  const todayKey = getLocalDateKey(input.now);
  const completionsToday = input.tasks.filter(
    (task) => task.completed_at && getLocalDateKey(new Date(task.completed_at)) === todayKey,
  ).length;

  const { momentum, completionsLast7d } = getMomentum(input, daysInactive);

  const overdueBurden = input.tasks.filter(
    (task) => task.status !== 'done' && task.due_date && task.due_date < todayKey,
  ).length;

  const mood = resolveMood({ streak, bestStreak, daysInactive, overdueBurden });
  const milestoneReached = resolveMilestone(streak);

  return {
    mood,
    streak,
    bestStreak,
    daysInactive,
    completionsToday,
    completionsLast7d,
    momentum,
    overdueBurden,
    milestoneReached,
  };
}
