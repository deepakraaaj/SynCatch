import { showToast } from '../features/toasts/toast-store';
import { pickReactionMessage } from './characterMessages';
import type { CharacterStateResult } from './types';

/** Celebrates a completed task in Lumi's voice, as a toast. */
export function announceTaskCompletion(taskTitle: string, taskId: string, state: CharacterStateResult) {
  const trigger =
    state.mood === 'recovering' ? 'comeback' : state.streak >= 2 ? 'streakContinued' : 'taskCompleted';

  const message = pickReactionMessage(trigger, taskId);
  showToast({ title: message, description: taskTitle, tone: 'success' });
}
