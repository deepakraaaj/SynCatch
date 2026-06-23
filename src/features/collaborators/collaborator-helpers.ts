import type { Collaborator, CollaboratorDraft } from './collaborator-types';

export function createCollaboratorId() {
  return `collab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeCollaboratorDraft(draft: CollaboratorDraft): Collaborator {
  const timestamp = new Date().toISOString();
  return {
    id: createCollaboratorId(),
    user_id: draft.user_id.trim(),
    display_name: draft.display_name?.trim() ?? '',
    email: draft.email?.trim() ?? '',
    created_at: timestamp,
    updated_at: timestamp,
  };
}

interface CollaboratorRecordInput {
  id: string;
  user_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function hydrateCollaboratorRecord(record: CollaboratorRecordInput): Collaborator {
  const timestamp = new Date().toISOString();
  return {
    id: record.id,
    user_id: (record.user_id ?? '').trim(),
    display_name: record.display_name?.trim() ?? '',
    email: record.email?.trim() ?? '',
    created_at: record.created_at ?? timestamp,
    updated_at: record.updated_at ?? timestamp,
  };
}

export function sortCollaborators(collaborators: Collaborator[]) {
  return [...collaborators].sort((left, right) => {
    const leftLabel = (left.display_name || left.user_id).toLowerCase();
    const rightLabel = (right.display_name || right.user_id).toLowerCase();
    return leftLabel.localeCompare(rightLabel);
  });
}

// Short, friendly label for a collaborator chip.
export function collaboratorLabel(collaborator: Collaborator): string {
  if (collaborator.display_name) return collaborator.display_name;
  return shortUserId(collaborator.user_id);
}

export function shortUserId(userId: string): string {
  if (!userId) return 'Unknown';
  if (userId.length <= 16) return userId;
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}
