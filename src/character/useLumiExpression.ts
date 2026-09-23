import { useMemo } from 'react';
import { useFocusStore } from '../features/focus/focus-store';
import { useTaskStore } from '../features/tasks/task-store';
import { resolveCharacterState } from './characterState';
import { useCompanionStore } from './companion-store';
import { resolveLumiExpression } from './lumi-controller';
import type { LumiExpression } from './lumi-assets';
import type { CharacterMood } from './types';

/**
 * The expression every full-size Lumi should be showing right now. Pass `mood`
 * when the caller already resolved character state, to skip recomputing it.
 */
export function useLumiExpression(mood?: CharacterMood): LumiExpression {
  const reaction = useCompanionStore((state) => state.reaction);
  const focusRunning = useFocusStore((state) => Boolean(state.focusSessionStart) || state.status === 'locked-in');
  const tasks = useTaskStore((state) => state.tasks);
  const resolvedMood = useMemo(
    () => mood ?? resolveCharacterState({ tasks, now: new Date() }).mood,
    [mood, tasks],
  );
  return resolveLumiExpression({ reaction, focusRunning, mood: resolvedMood });
}
