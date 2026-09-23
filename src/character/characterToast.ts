import { showToast } from '../features/toasts/toast-store';
import { announceLumi } from './companion-store';
import { pickReactionMessage } from './characterMessages';
import type { CharacterStateResult } from './types';

/**
 * Celebrates a completed task in Lumi's voice — spoken by the floating
 * companion when it is on stage, otherwise as a toast. Never both.
 */
export function announceTaskCompletion(taskTitle: string, taskId: string, state: CharacterStateResult) {
  const trigger =
    state.mood === 'recovering' ? 'comeback' : state.streak >= 2 ? 'streakContinued' : 'taskCompleted';

  const message = pickReactionMessage(trigger, taskId);
  announceLumi('celebrate', { text: message, detail: taskTitle }, () =>
    showToast({ title: message, description: taskTitle, tone: 'success' }),
  );
}
