import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTaskStore } from '../features/tasks/task-store';
import { useAuthStore } from '../features/auth/auth-store';
import { selectPreference, upsertPreference } from '../lib/supabase';
import { resolveCharacterState } from './characterState';
import {
  MILESTONE_LOCAL_STORAGE_KEY,
  MILESTONE_PREFERENCE_KEY,
  hasSeenMilestone,
  markMilestoneSeen,
  parseSeenMilestones,
  serializeSeenMilestones,
} from './milestoneRules';
import type { CharacterStateResult } from './types';

export interface UseCharacterStateResult {
  state: CharacterStateResult;
  /** True once for a not-yet-acknowledged milestone reached this session. */
  shouldShowMilestone: boolean;
  /** Call after the milestone celebration has actually played, to persist the dedupe. */
  acknowledgeMilestone: () => void;
}

/**
 * Centralized character-state hook — the only place in the character system
 * that performs I/O (reading tasks from the store, reading/writing the
 * milestone-seen dedupe). Everything else in src/character/ stays pure.
 */
export function useCharacterState(): UseCharacterStateResult {
  const tasks = useTaskStore((s) => s.tasks);
  const session = useAuthStore((s) => s.session);
  const [seenMilestones, setSeenMilestones] = useState<Set<number>>(new Set());
  const [hydratedSeen, setHydratedSeen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSeen() {
      if (session?.user?.id) {
        try {
          const raw = await selectPreference(MILESTONE_PREFERENCE_KEY);
          if (!cancelled) setSeenMilestones(parseSeenMilestones(raw ? JSON.parse(raw) : null));
          return;
        } catch {
          // Fall through to localStorage if the remote read fails.
        }
      }
      try {
        const raw = localStorage.getItem(MILESTONE_LOCAL_STORAGE_KEY);
        if (!cancelled) setSeenMilestones(parseSeenMilestones(raw));
      } catch {
        // localStorage unavailable (e.g. private mode) — default to empty, non-fatal.
      }
    }

    void hydrateSeen().finally(() => {
      if (!cancelled) setHydratedSeen(true);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const state = useMemo(() => resolveCharacterState({ tasks, now: new Date() }), [tasks]);

  const shouldShowMilestone = Boolean(
    hydratedSeen && state.milestoneReached && !hasSeenMilestone(state.milestoneReached, seenMilestones),
  );

  const acknowledgeMilestone = useCallback(() => {
    if (!state.milestoneReached) return;
    const next = markMilestoneSeen(state.milestoneReached, seenMilestones);
    setSeenMilestones(next);

    try {
      localStorage.setItem(MILESTONE_LOCAL_STORAGE_KEY, JSON.stringify(serializeSeenMilestones(next).seen));
    } catch {
      // Non-fatal — in-memory state still reflects the acknowledgement this session.
    }

    if (session?.user?.id) {
      void upsertPreference(MILESTONE_PREFERENCE_KEY, serializeSeenMilestones(next)).catch(() => {
        // Non-fatal — local dedupe still prevents re-showing this session.
      });
    }
  }, [session?.user?.id, seenMilestones, state.milestoneReached]);

  return { state, shouldShowMilestone, acknowledgeMilestone };
}
