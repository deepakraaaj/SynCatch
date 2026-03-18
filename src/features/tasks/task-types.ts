export type TaskStatus = 'captured' | 'clarifying' | 'ready' | 'in_progress' | 'done';
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type TaskLane = 'inbox' | 'now' | 'next' | 'later' | 'done';

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskClarifyingQuestion {
  id: string;
  question: string;
  answer: string;
}

export interface Task {
  id: string;
  title: string;
  raw_input: string;
  description: string;
  goal: string;
  definition_of_done: string;
  next_action: string;
  why_it_matters: string;
  workspace_notes: string;
  subtasks: TaskSubtask[];
  clarifying_questions: TaskClarifyingQuestion[];
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
  goal?: string;
  definitionOfDone?: string;
  nextAction?: string;
  whyItMatters?: string;
  workspaceNotes?: string;
  subtasks?: TaskSubtask[];
  clarifyingQuestions?: TaskClarifyingQuestion[];
  status?: TaskStatus;
  priority?: TaskPriority;
  lane?: TaskLane;
  estimatedMinutes?: number;
}
