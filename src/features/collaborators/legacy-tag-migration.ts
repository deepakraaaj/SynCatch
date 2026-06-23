import type { Task } from '../tasks/task-types';
import { useCollaboratorStore } from './collaborator-store';

const MIGRATED_KEY = 'missioncontrol-assignee-tags-migrated';

// The old CollaborationView encoded assignees as task tags:
//   assignee_user_id:<id>  (preferred)  /  assignee:<id>  (older)  plus a bare 'team' tag.
// This one-time pass lifts those into the first-class assignee_ids field, strips the
// magic tags, and seeds the collaborator roster with whatever user IDs it finds.
function extractAssigneeId(tag: string): string | null {
  if (tag.startsWith('assignee_user_id:')) return tag.slice('assignee_user_id:'.length).trim() || null;
  if (tag.startsWith('assignee:')) return tag.slice('assignee:'.length).trim() || null;
  return null;
}

function isLegacyAssigneeTag(tag: string): boolean {
  return tag === 'team' || extractAssigneeId(tag) !== null;
}

export async function migrateLegacyAssigneeTags(
  tasks: Task[],
  updateTask: (task: Task) => Promise<void>,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.localStorage.getItem(MIGRATED_KEY)) return false;

  let changed = false;
  const discoveredIds = new Set<string>();

  try {
    for (const task of tasks) {
      const extracted = task.tags.map(extractAssigneeId).filter((id): id is string => Boolean(id));
      const hasLegacyTag = task.tags.some(isLegacyAssigneeTag);
      if (!hasLegacyTag && extracted.length === 0) continue;

      extracted.forEach((id) => discoveredIds.add(id));

      const nextTags = task.tags.filter((tag) => !isLegacyAssigneeTag(tag));
      const nextAssignees = Array.from(new Set([...task.assignee_ids, ...extracted]));

      const tagsChanged = nextTags.length !== task.tags.length;
      const assigneesChanged = nextAssignees.length !== task.assignee_ids.length;
      if (tagsChanged || assigneesChanged) {
        await updateTask({ ...task, tags: nextTags, assignee_ids: nextAssignees });
        changed = true;
      }
    }

    // Make sure every assignee we found exists in the roster.
    if (discoveredIds.size > 0) {
      const add = useCollaboratorStore.getState().addCollaborator;
      for (const userId of discoveredIds) {
        await add({ user_id: userId });
      }
    }
  } catch {
    // best-effort; don't block task hydration on migration trouble
  } finally {
    window.localStorage.setItem(MIGRATED_KEY, '1');
  }

  return changed;
}
