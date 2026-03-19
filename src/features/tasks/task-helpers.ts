import { areGeneratedPlaceholderSubtasks, generateTaskBrief } from './task-intelligence';
import type {
  Task,
  TaskClarifyingQuestion,
  TaskDraft,
  TaskLane,
  TaskPriority,
  TaskStatus,
  TaskSubtask,
} from './task-types';

export function createTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeSubtasks(subtasks: TaskSubtask[] | null | undefined) {
  const normalized = Array.isArray(subtasks)
    ? subtasks
        .filter((subtask) => Boolean(subtask?.id && subtask?.title))
        .map((subtask) => ({
          id: subtask.id,
          title: subtask.title.trim(),
          completed: Boolean(subtask.completed),
        }))
        .filter((subtask) => subtask.title.length > 0)
    : [];

  return areGeneratedPlaceholderSubtasks(normalized) ? [] : normalized;
}

function normalizeQuestions(questions: TaskClarifyingQuestion[] | null | undefined) {
  return Array.isArray(questions)
    ? questions
        .filter((question) => Boolean(question?.id && question?.question))
        .map((question) => ({
          id: question.id,
          question: question.question.trim(),
          answer: question.answer?.trim() ?? '',
        }))
        .filter((question) => question.question.length > 0)
    : [];
}

export function getVisibleSubtasks(subtasks: TaskSubtask[]) {
  return areGeneratedPlaceholderSubtasks(subtasks) ? [] : subtasks;
}

export function deriveStatusFromLane(lane: TaskLane, currentStatus: TaskStatus = 'captured'): TaskStatus {
  if (lane === 'done') {
    return 'done';
  }

  if (lane === 'now') {
    return 'in_progress';
  }

  if (currentStatus === 'done') {
    return 'ready';
  }

  return currentStatus === 'captured' ? 'ready' : currentStatus;
}

export function normalizeTaskDraft(draft: TaskDraft): Task {
  const timestamp = new Date().toISOString();
  const lane = draft.lane ?? 'inbox';
  const status = deriveStatusFromLane(lane, draft.status ?? 'captured');
  const generated = generateTaskBrief(draft.rawInput, {
    title: draft.title,
    description: draft.description,
    goal: draft.goal,
    definitionOfDone: draft.definitionOfDone,
    nextAction: draft.nextAction,
    whyItMatters: draft.whyItMatters,
    subtasks: normalizeSubtasks(draft.subtasks),
    clarifyingQuestions: normalizeQuestions(draft.clarifyingQuestions),
    priority: draft.priority,
    estimatedMinutes: draft.estimatedMinutes,
  });

  return {
    id: createTaskId(),
    title: generated.suggestedTitle,
    raw_input: draft.rawInput.trim(),
    description: generated.description,
    goal: generated.goal,
    definition_of_done: generated.definitionOfDone,
    next_action: generated.nextAction,
    why_it_matters: generated.whyItMatters,
    workspace_notes: draft.workspaceNotes?.trim() ?? '',
    subtasks: generated.subtasks,
    clarifying_questions: generated.clarifyingQuestions,
    status,
    priority: generated.priority,
    lane,
    estimated_minutes: generated.estimatedMinutes,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

interface TaskRecordInput {
  id: string;
  title?: string | null;
  raw_input?: string | null;
  description?: string | null;
  goal?: string | null;
  definition_of_done?: string | null;
  next_action?: string | null;
  why_it_matters?: string | null;
  workspace_notes?: string | null;
  subtasks?: TaskSubtask[] | null;
  clarifying_questions?: TaskClarifyingQuestion[] | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  lane?: TaskLane;
  estimated_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

export function hydrateTaskRecord(record: TaskRecordInput): Task {
  const generated = generateTaskBrief(record.raw_input ?? record.title ?? '', {
    title: record.title ?? undefined,
    description: record.description ?? undefined,
    goal: record.goal ?? undefined,
    definitionOfDone: record.definition_of_done ?? undefined,
    nextAction: record.next_action ?? undefined,
    whyItMatters: record.why_it_matters ?? undefined,
    subtasks: normalizeSubtasks(record.subtasks),
    clarifyingQuestions: normalizeQuestions(record.clarifying_questions),
    priority: record.priority,
    estimatedMinutes: record.estimated_minutes,
  });
  const lane = record.lane ?? 'inbox';
  const status = deriveStatusFromLane(lane, record.status ?? 'captured');
  const timestamp = new Date().toISOString();

  return {
    id: record.id,
    title: generated.suggestedTitle,
    raw_input: record.raw_input?.trim() ?? record.title?.trim() ?? '',
    description: generated.description,
    goal: generated.goal,
    definition_of_done: generated.definitionOfDone,
    next_action: generated.nextAction,
    why_it_matters: generated.whyItMatters,
    workspace_notes: record.workspace_notes?.trim() ?? '',
    subtasks: generated.subtasks,
    clarifying_questions: generated.clarifyingQuestions,
    status,
    priority: generated.priority,
    lane,
    estimated_minutes: generated.estimatedMinutes,
    created_at: record.created_at ?? timestamp,
    updated_at: record.updated_at ?? record.created_at ?? timestamp,
  };
}

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort(
    (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );
}

export function humanizeLane(lane: TaskLane) {
  return lane.charAt(0).toUpperCase() + lane.slice(1);
}

export function humanizePriority(priority: TaskPriority) {
  return priority === 'normal' ? 'Normal' : priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function humanizeStatus(status: TaskStatus) {
  return status.replace('_', ' ');
}

export function getCompletedSubtasks(task: Task) {
  return getVisibleSubtasks(task.subtasks).filter((subtask) => subtask.completed).length;
}

export function getOpenQuestionCount(task: Task) {
  return task.clarifying_questions.filter((question) => !question.answer.trim()).length;
}
