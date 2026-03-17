import type { Task, TaskDraft, TaskLane, TaskPriority, TaskStatus } from './task-types';

export function createTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function deriveStatusFromLane(lane: TaskLane, currentStatus: TaskStatus = 'captured'): TaskStatus {
  if (lane === 'done') {
    return 'done';
  }

  if (lane === 'now') {
    return 'in_progress';
  }

  if (currentStatus === 'done') {
    return 'ready';
  }

  return currentStatus === 'captured' ? 'ready' : currentStatus;
}

export function normalizeTaskDraft(draft: TaskDraft): Task {
  const timestamp = new Date().toISOString();
  const lane = draft.lane ?? 'inbox';
  const status = deriveStatusFromLane(lane, draft.status ?? 'captured');
  const title =
    draft.title?.trim() ||
    draft.rawInput
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 72) ||
    'Untitled mission';

  return {
    id: createTaskId(),
    title,
    raw_input: draft.rawInput.trim(),
    description: draft.description?.trim() ?? '',
    status,
    priority: draft.priority ?? 'normal',
    lane,
    estimated_minutes: draft.estimatedMinutes ?? 25,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort(
    (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );
}

export function humanizeLane(lane: TaskLane) {
  return lane.charAt(0).toUpperCase() + lane.slice(1);
}

export function humanizePriority(priority: TaskPriority) {
  return priority === 'normal' ? 'Normal' : priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function humanizeStatus(status: TaskStatus) {
  return status.replace('_', ' ');
}

