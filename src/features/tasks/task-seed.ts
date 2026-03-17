import type { Task } from './task-types';

export function createSeedTasks(): Task[] {
  const now = Date.now();

  return [
    {
      id: 'task-standup-summary',
      title: 'Turn standup notes into an actionable follow-up list',
      raw_input: 'Please pull the action items from this morning standup and make sure nothing gets dropped.',
      description:
        'Convert the verbal requests from the morning standup into clear owners, due dates, and concrete next actions.',
      status: 'ready',
      priority: 'high',
      lane: 'inbox',
      estimated_minutes: 20,
      created_at: new Date(now - 1000 * 60 * 90).toISOString(),
      updated_at: new Date(now - 1000 * 60 * 35).toISOString(),
    },
    {
      id: 'task-partner-deck',
      title: 'Tighten partner pitch deck before investor sync',
      raw_input: 'Need the partner deck cleaned up before the investor call tomorrow.',
      description:
        'Refine the narrative, make metrics sharper, and trim slides that do not support the partner story.',
      status: 'in_progress',
      priority: 'critical',
      lane: 'now',
      estimated_minutes: 50,
      created_at: new Date(now - 1000 * 60 * 260).toISOString(),
      updated_at: new Date(now - 1000 * 60 * 16).toISOString(),
    },
    {
      id: 'task-customer-checkin',
      title: 'Prepare customer renewal check-in agenda',
      raw_input: 'Can you draft what we should cover with Northstar on the renewal call?',
      description:
        'Capture renewal risks, success metrics, and the one question that would unblock expansion.',
      status: 'ready',
      priority: 'high',
      lane: 'next',
      estimated_minutes: 25,
      created_at: new Date(now - 1000 * 60 * 180).toISOString(),
      updated_at: new Date(now - 1000 * 60 * 70).toISOString(),
    },
    {
      id: 'task-handoff-doc',
      title: 'Write handoff notes for onboarding experiment',
      raw_input: 'Let us not lose the onboarding experiment learnings after this sprint.',
      description:
        'Summarize experiment setup, what changed, what worked, and where someone else can pick it up later.',
      status: 'captured',
      priority: 'normal',
      lane: 'later',
      estimated_minutes: 35,
      created_at: new Date(now - 1000 * 60 * 360).toISOString(),
      updated_at: new Date(now - 1000 * 60 * 210).toISOString(),
    },
    {
      id: 'task-pricing-fix',
      title: 'Verify pricing update is reflected across signup surfaces',
      raw_input: 'Ops said the new pricing might still be wrong on one of the signup flows.',
      description:
        'Check the public site, in-product upgrade screen, and any stale support copy that still references the older price.',
      status: 'done',
      priority: 'high',
      lane: 'done',
      estimated_minutes: 30,
      created_at: new Date(now - 1000 * 60 * 600).toISOString(),
      updated_at: new Date(now - 1000 * 60 * 420).toISOString(),
    },
  ];
}

