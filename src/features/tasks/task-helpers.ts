import { generateTaskBrief } from './task-intelligence';
import type { Task, TaskDraft, TaskEnergy, TaskLane, TaskPriority, TaskStatus } from './task-types';

export function createTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function deriveStatusFromLane(lane: TaskLane, currentStatus: TaskStatus = 'captured'): TaskStatus {
  if (lane === 'done') return 'done';
  if (lane === 'now') return 'in_progress';
  if (currentStatus === 'done') return 'ready';
  return currentStatus === 'captured' ? 'ready' : currentStatus;
}

export function normalizeTaskDraft(draft: TaskDraft): Task {
  const timestamp = new Date().toISOString();
  const lane = draft.lane ?? 'inbox';
  const status = deriveStatusFromLane(lane, draft.status ?? 'captured');
  const generated = generateTaskBrief(draft.title, {
    outcome: draft.outcome,
    next_action: draft.next_action,
    priority: draft.priority,
    energy: draft.energy,
    estimatedMinutes: draft.estimated_minutes,
  });

  return {
    id: createTaskId(),
    mission_id: draft.mission_id ?? null,
    parent_task_id: draft.parent_task_id ?? null,
    title: generated.suggestedTitle,
    outcome: generated.outcome,
    next_action: generated.next_action,
    notes: draft.notes?.trim() ?? '',
    status,
    priority: generated.priority,
    lane,
    energy: generated.energy,
    estimated_minutes: generated.estimatedMinutes,
    due_date: draft.due_date ?? null,
    scheduled_for: draft.scheduled_for ?? null,
    tags: draft.tags ?? [],
    completed_at: status === 'done' ? timestamp : null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

interface TaskRecordInput {
  id: string;
  mission_id?: string | null;
  parent_task_id?: string | null;
  title?: string | null;
  outcome?: string | null;
  next_action?: string | null;
  notes?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  lane?: TaskLane;
  energy?: TaskEnergy;
  estimated_minutes?: number;
  due_date?: string | null;
  scheduled_for?: string | null;
  tags?: string[];
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function hydrateTaskRecord(record: TaskRecordInput): Task {
  const generated = generateTaskBrief(record.title ?? '', {
    outcome: record.outcome ?? undefined,
    next_action: record.next_action ?? undefined,
    priority: record.priority,
    energy: record.energy ?? undefined,
    estimatedMinutes: record.estimated_minutes,
  });
  const lane = record.lane ?? 'inbox';
  const status = deriveStatusFromLane(lane, record.status ?? 'captured');
  const timestamp = new Date().toISOString();

  return {
    id: record.id,
    mission_id: record.mission_id ?? null,
    parent_task_id: record.parent_task_id ?? null,
    title: generated.suggestedTitle,
    outcome: generated.outcome,
    next_action: generated.next_action,
    notes: record.notes?.trim() ?? '',
    status,
    priority: generated.priority,
    lane,
    energy: record.energy ?? generated.energy,
    estimated_minutes: generated.estimatedMinutes,
    due_date: record.due_date ?? null,
    scheduled_for: record.scheduled_for ?? null,
    tags: Array.isArray(record.tags) ? record.tags : [],
    completed_at: record.completed_at ?? (status === 'done' ? (record.updated_at ?? timestamp) : null),
    created_at: record.created_at ?? timestamp,
    updated_at: record.updated_at ?? timestamp,
  };
}

// Returns all immediate children of a task (one level deep)
export function getSubtasks(tasks: Task[], parentId: string): Task[] {
  return tasks.filter((t) => t.parent_task_id === parentId);
}

// Returns only root-level tasks (no parent)
export function getRootTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.parent_task_id === null);
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

export function humanizeEnergy(energy: TaskEnergy) {
  return energy.charAt(0).toUpperCase() + energy.slice(1);
}

export function getCompletedSubtasks(subtasks: Task[]): number {
  return subtasks.filter((t) => t.status === 'done' || t.lane === 'done').length;
}
