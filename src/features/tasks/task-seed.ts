import { generateTaskBrief } from './task-intelligence';
import { deriveStatusFromLane } from './task-helpers';
import type { Task } from './task-types';

function createSeedTask({
  id,
  title,
  outcome,
  next_action,
  notes,
  status,
  priority,
  lane,
  energy,
  estimatedMinutes,
  createdAt,
  updatedAt,
}: {
  id: string;
  title: string;
  outcome?: string;
  next_action?: string;
  notes?: string;
  status: Task['status'];
  priority: Task['priority'];
  lane: Task['lane'];
  energy?: Task['energy'];
  estimatedMinutes: number;
  createdAt: string;
  updatedAt: string;
}): Task {
  const generated = generateTaskBrief(title, { outcome, next_action, priority, estimatedMinutes });
  const derivedStatus = deriveStatusFromLane(lane, status);

  return {
    id,
    mission_id: null,
    parent_task_id: null,
    title: generated.suggestedTitle,
    outcome: generated.outcome,
    next_action: generated.next_action,
    notes: notes ?? '',
    status: derivedStatus,
    priority: generated.priority,
    lane,
    energy: energy ?? generated.energy,
    estimated_minutes: generated.estimatedMinutes,
    due_date: null,
    scheduled_for: null,
    tags: [],
    completed_at: derivedStatus === 'done' ? updatedAt : null,
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
      outcome: 'A list of action items with owners and due dates, ready to share.',
      next_action: 'Open standup notes and extract every commitment made.',
      notes: 'Pull action items from this morning standup so nothing gets dropped.',
      status: 'ready',
      priority: 'high',
      lane: 'inbox',
      energy: 'admin',
      estimatedMinutes: 20,
      createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 35).toISOString(),
    }),
    createSeedTask({
      id: 'task-partner-deck',
      title: 'Tighten partner pitch deck before investor sync',
      outcome: 'Deck reviewed, narrative sharp, and metrics accurate before the call.',
      next_action: 'Open slide 3 and tighten the problem statement to two sentences.',
      notes: 'Investor call is tomorrow. Refine narrative, sharpen metrics, cut slides that do not support the partner story.',
      status: 'in_progress',
      priority: 'critical',
      lane: 'now',
      energy: 'deep',
      estimatedMinutes: 50,
      createdAt: new Date(now - 1000 * 60 * 260).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 16).toISOString(),
    }),
    createSeedTask({
      id: 'task-customer-checkin',
      title: 'Prepare customer renewal check-in agenda',
      outcome: 'Agenda sent to Northstar with renewal risks, success metrics, and the expansion question ready.',
      next_action: 'Draft the three renewal risks with one supporting data point each.',
      notes: 'Renewal call agenda for Northstar. Cover renewal risks, success metrics, and the one question that would unblock expansion.',
      status: 'ready',
      priority: 'high',
      lane: 'next',
      energy: 'shallow',
      estimatedMinutes: 25,
      createdAt: new Date(now - 1000 * 60 * 180).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 70).toISOString(),
    }),
    createSeedTask({
      id: 'task-handoff-doc',
      title: 'Write handoff notes for onboarding experiment',
      outcome: 'Document complete with experiment setup, results, what worked, and a clear pickup point.',
      next_action: 'Write the three-sentence experiment summary before anything else.',
      notes: 'Onboarding experiment learnings from this sprint. Summarize setup, what changed, what worked, and where someone can pick it up later.',
      status: 'captured',
      priority: 'normal',
      lane: 'later',
      energy: 'shallow',
      estimatedMinutes: 35,
      createdAt: new Date(now - 1000 * 60 * 360).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 210).toISOString(),
    }),
    createSeedTask({
      id: 'task-pricing-fix',
      title: 'Verify pricing update across all signup surfaces',
      outcome: 'All three surfaces show correct pricing and support copy is updated.',
      next_action: 'Check the public site pricing page first.',
      notes: 'Ops flagged that new pricing might still be wrong on one signup flow. Check public site, in-product upgrade screen, and support copy.',
      status: 'done',
      priority: 'high',
      lane: 'done',
      energy: 'admin',
      estimatedMinutes: 30,
      createdAt: new Date(now - 1000 * 60 * 600).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 420).toISOString(),
    }),
  ];
}
