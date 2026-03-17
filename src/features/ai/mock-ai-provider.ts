import type { TaskAiAssistant, TaskClarification } from './ai-types';

function titleCase(input: string) {
  return input
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && ['and', 'or', 'the', 'for', 'to', 'of'].includes(word.toLowerCase())) {
        return word.toLowerCase();
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function cleanInput(rawInput: string) {
  return rawInput
    .replace(/\s+/g, ' ')
    .replace(/^(please|can you|could you|remember to|need to)\s+/i, '')
    .trim();
}

function buildSubtasks(input: string) {
  const generic = [
    'Clarify the concrete deliverable',
    'Block the smallest next action',
    'Capture a review checkpoint',
  ];

  const lowered = input.toLowerCase();

  if (lowered.includes('launch') || lowered.includes('rollout')) {
    return ['Define success criteria', 'Confirm owners and dependencies', 'Outline launch-ready checklist'];
  }

  if (lowered.includes('call') || lowered.includes('meet')) {
    return ['Write the desired outcome', 'Collect context before the conversation', 'Send a follow-up action summary'];
  }

  if (lowered.includes('deck') || lowered.includes('slides') || lowered.includes('presentation')) {
    return ['Shape the narrative arc', 'List the essential proof points', 'Decide what needs design polish'];
  }

  return generic;
}

function buildQuestions(input: string) {
  const questions = ['What does done look like for this task?'];
  const lowered = input.toLowerCase();

  if (!/\b(today|tomorrow|friday|monday|deadline|eod|eow|asap)\b/i.test(lowered)) {
    questions.push('When does this need to be completed?');
  }

  if (!/\bwith\b|\bfor\b|\bowner\b|\bteam\b/i.test(lowered)) {
    questions.push('Who else is involved or needs to review it?');
  }

  if (!/\bship\b|\bsend\b|\bdeliver\b|\bpublish\b|\bfix\b/i.test(lowered)) {
    questions.push('What is the next visible action that would move it forward?');
  }

  return questions.slice(0, 3);
}

class MockMissionAiAssistant implements TaskAiAssistant {
  async clarifyTask(rawInput: string): Promise<TaskClarification> {
    const cleaned = cleanInput(rawInput);
    const firstPhrase = cleaned.split(/[.!?]/)[0] ?? cleaned;
    const compact = firstPhrase.slice(0, 72).trim();

    const suggestedTitle = titleCase(
      compact.length > 0 ? compact : 'Capture and Clarify New Task',
    );

    return {
      suggestedTitle,
      subtasks: buildSubtasks(cleaned),
      questions: buildQuestions(cleaned),
      confidence: cleaned.split(' ').length > 4 ? 'high' : 'medium',
    };
  }
}

let singletonAssistant: TaskAiAssistant | null = null;

export function getTaskAiAssistant() {
  singletonAssistant ??= new MockMissionAiAssistant();
  return singletonAssistant;
}

