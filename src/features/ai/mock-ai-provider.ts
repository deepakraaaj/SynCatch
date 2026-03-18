import type { TaskAiAssistant, TaskClarification } from './ai-types';
import { generateTaskBrief } from '../tasks/task-intelligence';

class MockMissionAiAssistant implements TaskAiAssistant {
  async clarifyTask(rawInput: string): Promise<TaskClarification> {
    const generated = generateTaskBrief(rawInput);

    return {
      suggestedTitle: generated.suggestedTitle,
      description: generated.description,
      goal: generated.goal,
      definitionOfDone: generated.definitionOfDone,
      nextAction: generated.nextAction,
      whyItMatters: generated.whyItMatters,
      subtasks: generated.subtasks,
      questions: generated.clarifyingQuestions,
      confidence: rawInput.trim().split(/\s+/).length > 4 ? 'high' : 'medium',
    };
  }
}

let singletonAssistant: TaskAiAssistant | null = null;

export function getTaskAiAssistant() {
  singletonAssistant ??= new MockMissionAiAssistant();
  return singletonAssistant;
}
