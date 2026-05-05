export interface TaskClarification {
  suggestedTitle: string;
  outcome: string;
  nextAction: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface TaskAiAssistant {
  clarifyTask(rawInput: string): Promise<TaskClarification>;
}
