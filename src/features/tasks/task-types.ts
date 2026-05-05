export type TaskStatus = 'captured' | 'clarifying' | 'ready' | 'in_progress' | 'done';
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type TaskLane = 'inbox' | 'now' | 'next' | 'later' | 'done';
export type TaskEnergy = 'deep' | 'shallow' | 'admin';

export interface Task {
  id: string;
  mission_id: string | null;
  parent_task_id: string | null;
  title: string;
  // What "done" concretely looks like — replaces goal + definition_of_done
  outcome: string;
  // Smallest concrete first step
  next_action: string;
  // Freeform context, links, scratch — replaces description + workspace_notes
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  lane: TaskLane;
  // Helps match task to the right mental state when scheduling
  energy: TaskEnergy;
  estimated_minutes: number;
  due_date: string | null;       // ISO date YYYY-MM-DD
  scheduled_for: string | null;  // ISO date YYYY-MM-DD
  tags: string[];
  completed_at: string | null;   // ISO timestamp; set when moved to done
  created_at: string;
  updated_at: string;
}

export interface TaskDraft {
  mission_id?: string | null;
  parent_task_id?: string | null;
  title: string;
  outcome?: string;
  next_action?: string;
  notes?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  lane?: TaskLane;
  energy?: TaskEnergy;
  estimated_minutes?: number;
  due_date?: string | null;
  scheduled_for?: string | null;
  tags?: string[];
}
