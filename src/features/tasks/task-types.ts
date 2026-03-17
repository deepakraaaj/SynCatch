export type TaskStatus = 'captured' | 'clarifying' | 'ready' | 'in_progress' | 'done';
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type TaskLane = 'inbox' | 'now' | 'next' | 'later' | 'done';

export interface Task {
  id: string;
  title: string;
  raw_input: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  lane: TaskLane;
  estimated_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface TaskDraft {
  rawInput: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  lane?: TaskLane;
  estimatedMinutes?: number;
}

