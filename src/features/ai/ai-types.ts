import type { TaskClarifyingQuestion, TaskSubtask } from '../tasks/task-types';

export interface TaskClarification {
  suggestedTitle: string;
  description: string;
  goal: string;
  definitionOfDone: string;
  nextAction: string;
  whyItMatters: string;
  subtasks: TaskSubtask[];
  questions: TaskClarifyingQuestion[];
  confidence: 'low' | 'medium' | 'high';
}

export interface TaskAiAssistant {
  clarifyTask(rawInput: string): Promise<TaskClarification>;
}
