export interface TaskClarification {
  suggestedTitle: string;
  subtasks: string[];
  questions: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface TaskAiAssistant {
  clarifyTask(rawInput: string): Promise<TaskClarification>;
}

