import { showToast } from '../features/toasts/toast-store';
import { pickReactionMessage } from './characterMessages';
import type { CharacterStateResult } from './types';

/**
 * Pushes a character-voiced completion toast via the existing toast system
 * (no changes needed to toast-store.ts / toast-viewport.tsx — only the copy
 * changes from a generic "Task completed" to something Lumi would say).
 */
export function pushCharacterCompletionToast(taskTitle: string, taskId: string, state: CharacterStateResult) {
  const trigger =
    state.mood === 'recovering' ? 'comeback' : state.streak >= 2 ? 'streakContinued' : 'taskCompleted';

  const message = pickReactionMessage(trigger, taskId);
  showToast({ title: message, description: taskTitle, tone: 'success' });
}
