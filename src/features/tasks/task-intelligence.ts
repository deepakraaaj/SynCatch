import type {
  TaskClarifyingQuestion,
  TaskDraft,
  TaskPriority,
  TaskSubtask,
} from './task-types';

type TaskShape = 'generic' | 'implementation' | 'discussion' | 'document' | 'research' | 'review';

export interface GeneratedTaskBrief {
  suggestedTitle: string;
  description: string;
  goal: string;
  definitionOfDone: string;
  nextAction: string;
  whyItMatters: string;
  subtasks: TaskSubtask[];
  clarifyingQuestions: TaskClarifyingQuestion[];
  priority: TaskPriority;
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

  if (!cleaned) {
    return '';
  }

  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}.`;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
}

function buildId(prefix: string, seed: string, index: number) {
  return `${prefix}-${slugify(seed || prefix)}-${index + 1}`;
}

function isMeaningfulAnswer(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function inferShape(input: string): TaskShape {
  const lowered = input.toLowerCase();

  if (/\b(call|meet|meeting|sync|discuss|talk|reply|send)\b/.test(lowered)) {
    return 'discussion';
  }

  if (/\b(write|document|doc|notes|spec|summary|plan)\b/.test(lowered)) {
    return 'document';
  }

  if (/\b(research|investigate|analyze|explore|compare)\b/.test(lowered)) {
    return 'research';
  }

  if (/\b(review|check|verify|test|audit|validate)\b/.test(lowered)) {
    return 'review';
  }

  if (/\b(build|create|fix|update|implement|change|refactor|prepare)\b/.test(lowered)) {
    return 'implementation';
  }

  return 'generic';
}

function inferPriority(input: string, fallback: TaskPriority = 'normal') {
  const lowered = input.toLowerCase();

  if (/\b(urgent|asap|critical|blocker|today|eod|immediately|right away)\b/.test(lowered)) {
    return 'critical';
  }

  if (/\b(tomorrow|soon|important|high priority|follow up|fix)\b/.test(lowered)) {
    return 'high';
  }

  return fallback;
}

function inferEstimatedMinutes(shape: TaskShape, input: string, fallback = 25) {
  const lowered = input.toLowerCase();

  if (/\b(quick|small|minor|tiny)\b/.test(lowered)) {
    return 10;
  }

  if (/\b(urgent|asap|deep|detailed)\b/.test(lowered)) {
    return 45;
  }

  switch (shape) {
    case 'discussion':
      return 20;
    case 'document':
      return 30;
    case 'research':
      return 40;
    case 'review':
      return 25;
    case 'implementation':
      return 35;
    default:
      return fallback;
  }
}

function suggestTitle(input: string) {
  const firstPhrase = cleanInput(input).split(/[.!?]/)[0] ?? '';
  const trimmed = firstPhrase.slice(0, 72).trim();

  if (!trimmed) {
    return 'New Task';
  }

  return titleCase(trimmed);
}

function buildDescription(input: string) {
  return toSentence(`Turn "${cleanInput(input) || 'this task'}" into a clear, usable output`);
}

function buildGoal(input: string) {
  return toSentence(`Finish ${cleanInput(input) || 'this task'} with a result someone can act on`);
}

function buildDefinitionOfDone(shape: TaskShape) {
  switch (shape) {
    case 'discussion':
      return 'The message, meeting, or conversation has a clear outcome and the next step is obvious.';
    case 'document':
      return 'The document is complete enough to read, share, and use without a live explanation.';
    case 'research':
      return 'The key question is answered and the result points to a clear next move.';
    case 'review':
      return 'The item has been checked, the outcome is recorded, and any issue is clearly called out.';
    case 'implementation':
      return 'The work is applied, checked once, and left in a usable state.';
    default:
      return 'The task has a concrete output and the next step is clear.';
  }
}

function buildNextAction(shape: TaskShape, input: string) {
  const cleaned = cleanInput(input) || 'this task';

  switch (shape) {
    case 'discussion':
      return toSentence(`Write the outcome you need from ${cleaned}, then prepare the key points`);
    case 'document':
      return 'Write a short outline first, then fill the most important section before polishing anything else.';
    case 'research':
      return 'Write down the one question you are trying to answer, then gather only the strongest evidence first.';
    case 'review':
      return 'Open the item, check the most important part first, and note the result immediately.';
    case 'implementation':
      return 'Start with the smallest concrete change that moves the task forward.';
    default:
      return 'Turn the task into the smallest concrete step you can do right now.';
  }
}

function buildWhyItMatters() {
  return 'Clear tasks reduce context switching and make it easier to finish work without rethinking the same thing twice.';
}

function buildSubtaskTitles(shape: TaskShape) {
  switch (shape) {
    case 'discussion':
      return [
        'Define the outcome you need',
        'Gather the key points or context',
        'Send, discuss, or follow up with the next step',
      ];
    case 'document':
      return [
        'Draft a simple outline',
        'Fill the most important section',
        'Review and clean up before sharing',
      ];
    case 'research':
      return [
        'Frame the question',
        'Collect the strongest evidence',
        'Summarize the answer and next move',
      ];
    case 'review':
      return [
        'Open the item to review',
        'Check the critical parts',
        'Record the outcome clearly',
      ];
    case 'implementation':
      return [
        'Define the exact change',
        'Make the smallest useful update',
        'Check the result once before closing',
      ];
    default:
      return [
        'Define the expected output',
        'Do the next concrete step',
        'Check that the result is usable',
      ];
  }
}

function buildSubtasks(seed: string, shape: TaskShape) {
  return buildSubtaskTitles(shape).map((title, index) => ({
    id: buildId('subtask', seed, index),
    title,
    completed: false,
  }));
}

function buildQuestions(seed: string, input: string) {
  const cleaned = cleanInput(input);
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  const lowered = cleaned.toLowerCase();

  let question = '';

  if (wordCount <= 3 || cleaned.length < 18) {
    question = 'What should exist when this task is done?';
  } else if (/\b(this|that|it|thing|stuff)\b/.test(lowered)) {
    question = 'What result do you want from this task?';
  }

  return question
    ? [
        {
          id: buildId('question', cleaned || seed, 0),
          question,
          answer: '',
        },
      ]
    : [];
}

function answeredQuestions(questions: TaskClarifyingQuestion[] | undefined) {
  return (questions ?? []).filter((question) => question.answer.trim().length > 0);
}

function firstAnswer(questions: TaskClarifyingQuestion[] | undefined) {
  return answeredQuestions(questions)[0]?.answer.trim();
}

export function generateTaskBrief(
  rawInput: string,
  draft: Partial<
    TaskDraft & {
      subtasks: TaskSubtask[];
      clarifyingQuestions: TaskClarifyingQuestion[];
      priority: TaskPriority;
      estimatedMinutes: number;
    }
  > = {},
): GeneratedTaskBrief {
  const questions = draft.clarifyingQuestions ?? [];
  const answer = firstAnswer(questions);
  const cleaned = cleanInput([rawInput || draft.title || '', answer ?? ''].filter(Boolean).join(' '));
  const seed = draft.title || cleaned || 'task';
  const shape = inferShape(cleaned);
  const suggestedTitle = draft.title?.trim() || suggestTitle(cleaned);
  const description = isMeaningfulAnswer(draft.description)
    ? toSentence(draft.description ?? '')
    : buildDescription(cleaned);
  const goal = isMeaningfulAnswer(draft.goal)
    ? toSentence(draft.goal ?? '')
    : answer
      ? toSentence(answer)
      : buildGoal(cleaned);
  const definitionOfDone = isMeaningfulAnswer(draft.definitionOfDone)
    ? toSentence(draft.definitionOfDone ?? '')
    : buildDefinitionOfDone(shape);
  const nextAction = isMeaningfulAnswer(draft.nextAction)
    ? toSentence(draft.nextAction ?? '')
    : buildNextAction(shape, cleaned);
  const whyItMatters = isMeaningfulAnswer(draft.whyItMatters)
    ? toSentence(draft.whyItMatters ?? '')
    : buildWhyItMatters();

  return {
    suggestedTitle,
    description,
    goal,
    definitionOfDone,
    nextAction,
    whyItMatters,
    subtasks:
      draft.subtasks && draft.subtasks.length > 0
        ? draft.subtasks
        : buildSubtasks(seed, shape),
    clarifyingQuestions:
      draft.clarifyingQuestions && draft.clarifyingQuestions.length > 0
        ? draft.clarifyingQuestions
        : buildQuestions(seed, cleaned),
    priority: draft.priority ?? inferPriority(cleaned),
    estimatedMinutes: draft.estimatedMinutes ?? inferEstimatedMinutes(shape, cleaned),
  };
}
