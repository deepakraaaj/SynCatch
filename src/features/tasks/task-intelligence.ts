import type { TaskPriority, TaskEnergy } from './task-types';

type TaskShape = 'generic' | 'implementation' | 'discussion' | 'document' | 'research' | 'review';

export interface GeneratedTaskBrief {
  suggestedTitle: string;
  outcome: string;
  next_action: string;
  priority: TaskPriority;
  energy: TaskEnergy;
  estimatedMinutes: number;
}

function compactWhitespace(input: string) {
  return input.replace(/\s+/g, ' ').trim();
}

function cleanInput(rawInput: string) {
  return compactWhitespace(
    rawInput
      .replace(/^(please|can you|could you|need to|remember to|todo:?|task:?|let us|let's)\s+/i, '')
      .replace(/^-\s*/, ''),
  );
}

function titleCase(input: string) {
  return input
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && ['and', 'or', 'the', 'for', 'to', 'of', 'with', 'a', 'an'].includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function toSentence(input: string) {
  const cleaned = compactWhitespace(input).replace(/[.!?]+$/, '');
  if (!cleaned) return '';
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}.`;
}

function inferShape(input: string): TaskShape {
  const lowered = input.toLowerCase();

  if (/\b(call|meet|meeting|sync|discuss|talk|reply|send)\b/.test(lowered)) return 'discussion';
  if (/\b(write|document|doc|notes|spec|summary|plan)\b/.test(lowered)) return 'document';
  if (/\b(research|investigate|analyze|explore|compare)\b/.test(lowered)) return 'research';
  if (/\b(review|check|verify|test|audit|validate)\b/.test(lowered)) return 'review';
  if (/\b(build|create|fix|update|implement|change|refactor|prepare)\b/.test(lowered)) return 'implementation';

  return 'generic';
}

function inferPriority(input: string, fallback: TaskPriority = 'normal'): TaskPriority {
  const lowered = input.toLowerCase();

  if (/\b(urgent|asap|critical|blocker|today|eod|immediately|right away)\b/.test(lowered)) return 'critical';
  if (/\b(tomorrow|soon|important|high priority|follow up|fix)\b/.test(lowered)) return 'high';

  return fallback;
}

function inferEnergy(shape: TaskShape): TaskEnergy {
  switch (shape) {
    case 'research':
    case 'implementation':
      return 'deep';
    case 'document':
      return 'shallow';
    case 'discussion':
    case 'review':
    default:
      return 'admin';
  }
}

function inferEstimatedMinutes(shape: TaskShape, input: string, fallback = 25) {
  const lowered = input.toLowerCase();

  if (/\b(quick|small|minor|tiny)\b/.test(lowered)) return 10;
  if (/\b(urgent|asap|deep|detailed)\b/.test(lowered)) return 45;

  switch (shape) {
    case 'discussion': return 20;
    case 'document': return 30;
    case 'research': return 40;
    case 'review': return 25;
    case 'implementation': return 35;
    default: return fallback;
  }
}

function suggestTitle(input: string) {
  const firstPhrase = cleanInput(input).split(/[.!?]/)[0] ?? '';
  const trimmed = firstPhrase.slice(0, 72).trim();
  if (!trimmed) return 'New Task';
  return titleCase(trimmed);
}

function buildOutcome(shape: TaskShape): string {
  switch (shape) {
    case 'discussion':
      return 'A clear outcome from the conversation with an obvious next step.';
    case 'document':
      return 'A complete document ready to share without a live explanation.';
    case 'research':
      return 'The key question answered and pointing to a clear next move.';
    case 'review':
      return 'All critical parts checked with the outcome clearly recorded.';
    case 'implementation':
      return 'The change applied, verified, and left in a usable state.';
    default:
      return 'A concrete output with the next step obvious.';
  }
}

function buildNextAction(shape: TaskShape, input: string): string {
  const cleaned = cleanInput(input) || 'this task';

  switch (shape) {
    case 'discussion':
      return toSentence(`Write the outcome you need from ${cleaned}, then prepare the key points`);
    case 'document':
      return 'Write a short outline, then fill the most important section first.';
    case 'research':
      return 'Write down the one question you are answering, then gather the strongest evidence.';
    case 'review':
      return 'Open the item, check the most important part first, and note the result.';
    case 'implementation':
      return 'Start with the smallest concrete change that moves the task forward.';
    default:
      return 'Turn the task into the smallest concrete step you can do right now.';
  }
}

export function generateTaskBrief(
  rawInput: string,
  draft: Partial<{
    outcome: string;
    next_action: string;
    priority: TaskPriority;
    energy: TaskEnergy;
    estimatedMinutes: number;
  }> = {},
): GeneratedTaskBrief {
  const cleaned = cleanInput(rawInput);
  const shape = inferShape(cleaned);

  return {
    suggestedTitle: suggestTitle(cleaned),
    outcome: draft.outcome?.trim() ? toSentence(draft.outcome) : buildOutcome(shape),
    next_action: draft.next_action?.trim() ? toSentence(draft.next_action) : buildNextAction(shape, cleaned),
    priority: draft.priority ?? inferPriority(cleaned),
    energy: draft.energy ?? inferEnergy(shape),
    estimatedMinutes: draft.estimatedMinutes ?? inferEstimatedMinutes(shape, cleaned),
  };
}
