import type { TaskAiAssistant, TaskClarification } from './ai-types';
import { generateTaskBrief } from '../tasks/task-intelligence';

class MockMissionAiAssistant implements TaskAiAssistant {
  async clarifyTask(rawInput: string): Promise<TaskClarification> {
    const generated = generateTaskBrief(rawInput);

    return {
      suggestedTitle: generated.suggestedTitle,
      outcome: generated.outcome,
      nextAction: generated.next_action,
      confidence: rawInput.trim().split(/\s+/).length > 4 ? 'high' : 'medium',
    };
  }
}

let singletonAssistant: TaskAiAssistant | null = null;

export function getTaskAiAssistant() {
  singletonAssistant ??= new MockMissionAiAssistant();
  return singletonAssistant;
}
