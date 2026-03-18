import { generateTaskBrief } from './task-intelligence';
import type { Task } from './task-types';

function createSeedTask({
  id,
  title,
  rawInput,
  description,
  status,
  priority,
  lane,
  estimatedMinutes,
  createdAt,
  updatedAt,
}: {
  id: string;
  title: string;
  rawInput: string;
  description: string;
  status: Task['status'];
  priority: Task['priority'];
  lane: Task['lane'];
  estimatedMinutes: number;
  createdAt: string;
  updatedAt: string;
}): Task {
  const generated = generateTaskBrief(rawInput, {
    title,
    description,
    priority,
    estimatedMinutes,
  });

  return {
    id,
    title: generated.suggestedTitle,
    raw_input: rawInput,
    description: generated.description,
    goal: generated.goal,
    definition_of_done: generated.definitionOfDone,
    next_action: generated.nextAction,
    why_it_matters: generated.whyItMatters,
    workspace_notes: '',
    subtasks: generated.subtasks,
    clarifying_questions: generated.clarifyingQuestions,
    status,
    priority: generated.priority,
    lane,
    estimated_minutes: generated.estimatedMinutes,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function createSeedTasks(): Task[] {
  const now = Date.now();

  return [
    createSeedTask({
      id: 'task-standup-summary',
      title: 'Turn standup notes into an actionable follow-up list',
      rawInput: 'Please pull the action items from this morning standup and make sure nothing gets dropped.',
      description:
        'Convert the verbal requests from the morning standup into clear owners, due dates, and concrete next actions.',
      status: 'ready',
      priority: 'high',
      lane: 'inbox',
      estimatedMinutes: 20,
      createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 35).toISOString(),
    }),
    createSeedTask({
      id: 'task-partner-deck',
      title: 'Tighten partner pitch deck before investor sync',
      rawInput: 'Need the partner deck cleaned up before the investor call tomorrow.',
      description:
        'Refine the narrative, make metrics sharper, and trim slides that do not support the partner story.',
      status: 'in_progress',
      priority: 'critical',
      lane: 'now',
      estimatedMinutes: 50,
      createdAt: new Date(now - 1000 * 60 * 260).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 16).toISOString(),
    }),
    createSeedTask({
      id: 'task-customer-checkin',
      title: 'Prepare customer renewal check-in agenda',
      rawInput: 'Can you draft what we should cover with Northstar on the renewal call?',
      description:
        'Capture renewal risks, success metrics, and the one question that would unblock expansion.',
      status: 'ready',
      priority: 'high',
      lane: 'next',
      estimatedMinutes: 25,
      createdAt: new Date(now - 1000 * 60 * 180).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 70).toISOString(),
    }),
    createSeedTask({
      id: 'task-handoff-doc',
      title: 'Write handoff notes for onboarding experiment',
      rawInput: 'Let us not lose the onboarding experiment learnings after this sprint.',
      description:
        'Summarize experiment setup, what changed, what worked, and where someone else can pick it up later.',
      status: 'captured',
      priority: 'normal',
      lane: 'later',
      estimatedMinutes: 35,
      createdAt: new Date(now - 1000 * 60 * 360).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 210).toISOString(),
    }),
    createSeedTask({
      id: 'task-pricing-fix',
      title: 'Verify pricing update is reflected across signup surfaces',
      rawInput: 'Ops said the new pricing might still be wrong on one of the signup flows.',
      description:
        'Check the public site, in-product upgrade screen, and any stale support copy that still references the older price.',
      status: 'done',
      priority: 'high',
      lane: 'done',
      estimatedMinutes: 30,
      createdAt: new Date(now - 1000 * 60 * 600).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 420).toISOString(),
    }),
  ];
}
