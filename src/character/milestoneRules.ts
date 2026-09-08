import { MILESTONE_DAYS } from './types';
import type { MilestoneDays } from './types';

export { MILESTONE_DAYS };

/** localStorage key for the unauthenticated fallback path. */
export const MILESTONE_LOCAL_STORAGE_KEY = 'lumi-milestones-seen-v1';

/** app_preferences key for the authenticated path (existing generic preferences table). */
export const MILESTONE_PREFERENCE_KEY = 'character_milestones_seen';

export function hasSeenMilestone(days: MilestoneDays, seen: ReadonlySet<number>): boolean {
  return seen.has(days);
}

export function markMilestoneSeen(days: MilestoneDays, seen: ReadonlySet<number>): Set<number> {
  return new Set(seen).add(days);
}

export function parseSeenMilestones(raw: unknown): Set<number> {
  if (!raw) return new Set();
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.seen) ? parsed.seen : [];
    return new Set(list.filter((value: unknown): value is number => typeof value === 'number'));
  } catch {
    return new Set();
  }
}

export function serializeSeenMilestones(seen: ReadonlySet<number>): { seen: number[] } {
  return { seen: [...seen].sort((a, b) => a - b) };
}
