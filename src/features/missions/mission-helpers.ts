import type { Mission, MissionColor, MissionDraft, MissionStatus } from './mission-types';

export function createMissionId() {
  return `mission-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeMissionDraft(draft: MissionDraft): Mission {
  const timestamp = new Date().toISOString();
  const status = draft.status ?? 'active';

  return {
    id: createMissionId(),
    title: draft.title.trim(),
    description: draft.description?.trim() ?? '',
    emoji: draft.emoji?.trim() || '🎯',
    color: draft.color ?? 'blue',
    objective: draft.objective?.trim() ?? '',
    why_it_matters: draft.whyItMatters?.trim() ?? '',
    definition_of_success: draft.definitionOfSuccess?.trim() ?? '',
    status,
    started_at: status === 'active' ? timestamp : null,
    completed_at: null,
    target_date: draft.targetDate ?? null,
    estimated_hours: draft.estimatedHours ?? 0,
    is_pinned: draft.isPinned ?? false,
    sort_order: draft.sortOrder ?? 0,
    tags: draft.tags ?? [],
    notes: draft.notes?.trim() ?? '',
    created_at: timestamp,
    updated_at: timestamp,
  };
}

interface MissionRecordInput {
  id: string;
  title?: string | null;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  objective?: string | null;
  why_it_matters?: string | null;
  definition_of_success?: string | null;
  status?: MissionStatus;
  started_at?: string | null;
  completed_at?: string | null;
  target_date?: string | null;
  estimated_hours?: number | null;
  is_pinned?: boolean | number | null;
  sort_order?: number | null;
  tags?: string[] | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function hydrateMissionRecord(record: MissionRecordInput): Mission {
  const timestamp = new Date().toISOString();

  return {
    id: record.id,
    title: record.title?.trim() ?? '',
    description: record.description?.trim() ?? '',
    emoji: record.emoji?.trim() || '🎯',
    color: (record.color as MissionColor) ?? 'blue',
    objective: record.objective?.trim() ?? '',
    why_it_matters: record.why_it_matters?.trim() ?? '',
    definition_of_success: record.definition_of_success?.trim() ?? '',
    status: record.status ?? 'active',
    started_at: record.started_at ?? null,
    completed_at: record.completed_at ?? null,
    target_date: record.target_date ?? null,
    estimated_hours: record.estimated_hours ?? 0,
    is_pinned: Boolean(record.is_pinned),
    sort_order: record.sort_order ?? 0,
    tags: Array.isArray(record.tags) ? record.tags : [],
    notes: record.notes?.trim() ?? '',
    created_at: record.created_at ?? timestamp,
    updated_at: record.updated_at ?? record.created_at ?? timestamp,
  };
}

export function sortMissions(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export function getMissionProgress(completedTaskCount: number, totalTaskCount: number): number {
  if (totalTaskCount === 0) return 0;
  return Math.round((completedTaskCount / totalTaskCount) * 100);
}

export function humanizeMissionStatus(status: MissionStatus): string {
  const labels: Record<MissionStatus, string> = {
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
    archived: 'Archived',
  };
  return labels[status];
}

export function deriveCompletedAt(
  prevStatus: MissionStatus,
  nextStatus: MissionStatus,
  existingCompletedAt: string | null,
): string | null {
  if (nextStatus === 'completed' && prevStatus !== 'completed') {
    return new Date().toISOString();
  }
  if (nextStatus !== 'completed') {
    return null;
  }
  return existingCompletedAt;
}

export function deriveStartedAt(
  prevStatus: MissionStatus,
  nextStatus: MissionStatus,
  existingStartedAt: string | null,
): string | null {
  if (nextStatus === 'active' && !existingStartedAt) {
    return new Date().toISOString();
  }
  return existingStartedAt;
}
