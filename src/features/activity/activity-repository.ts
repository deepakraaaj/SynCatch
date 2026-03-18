import { getSqlDatabase } from '../../lib/database';
import { ACTIVITY_CHANGED_EVENT, emitAppEvent, isTauriApp } from '../../lib/tauri';

const LOCAL_STORAGE_KEY = 'missioncontrol-activity-log-v1';

export type ActivityAction =
  | 'hud_opened'
  | 'task_selected'
  | 'task_created'
  | 'task_updated'
  | 'task_lane_changed'
  | 'task_completed'
  | 'focus_started'
  | 'focus_resumed'
  | 'focus_paused'
  | 'focus_status_changed'
  | 'hud_mode_toggled'
  | 'hud_transparency_toggled'
  | 'distraction_logged';

export type ActivitySource = 'main' | 'hud' | 'quick-add' | 'system';

export interface ActivityLogDraft {
  action: ActivityAction;
  source?: ActivitySource;
  taskId?: string | null;
  details?: Record<string, unknown>;
}

export interface ActivityLogEntry {
  id: string;
  action: ActivityAction;
  source: ActivitySource;
  task_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface ActivityRepository {
  logActivity: (draft: ActivityLogDraft) => Promise<void>;
  listRecentActivity: (limit?: number) => Promise<ActivityLogEntry[]>;
}

interface SqlActivityRow {
  id: string;
  action: ActivityAction;
  source: ActivitySource;
  task_id: string | null;
  details: string;
  created_at: string;
}

function createActivityLogId() {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseDetails(details: string | null | undefined) {
  if (!details) {
    return {};
  }

  try {
    const parsed = JSON.parse(details) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeDraft(draft: ActivityLogDraft) {
  return {
    id: createActivityLogId(),
    action: draft.action,
    source: draft.source ?? 'system',
    task_id: draft.taskId ?? null,
    details: JSON.stringify(draft.details ?? {}),
    created_at: new Date().toISOString(),
  };
}

function parseStoredEntries(raw: string | null) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<
      Omit<ActivityLogEntry, 'details'> & { details?: Record<string, unknown> | string }
    >;

    return parsed.map((entry) => ({
      ...entry,
      details:
        typeof entry.details === 'string' ? parseDetails(entry.details) : (entry.details ?? {}),
    }));
  } catch {
    return [];
  }
}

class BrowserActivityRepository implements ActivityRepository {
  async logActivity(draft: ActivityLogDraft) {
    const nextEntry = normalizeDraft(draft);
    const existing = parseStoredEntries(localStorage.getItem(LOCAL_STORAGE_KEY));
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([{ ...nextEntry, details: parseDetails(nextEntry.details) }, ...existing]),
    );
  }

  async listRecentActivity(limit = 50) {
    return parseStoredEntries(localStorage.getItem(LOCAL_STORAGE_KEY)).slice(0, limit);
  }
}

class SqlActivityRepository implements ActivityRepository {
  async logActivity(draft: ActivityLogDraft) {
    const entry = normalizeDraft(draft);
    const db = await getSqlDatabase();

    await db.execute(
      `INSERT INTO activity_log (
        id,
        action,
        source,
        task_id,
        details,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.action, entry.source, entry.task_id, entry.details, entry.created_at],
    );
  }

  async listRecentActivity(limit = 50) {
    const db = await getSqlDatabase();
    const rows = await db.select<SqlActivityRow>(
      `SELECT
         id,
         action,
         source,
         task_id,
         details,
         created_at
       FROM activity_log
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit],
    );

    return rows.map((row) => ({
      ...row,
      details: parseDetails(row.details),
    }));
  }
}

let repositoryPromise: Promise<ActivityRepository> | null = null;

export function getActivityRepository() {
  repositoryPromise ??= Promise.resolve(
    isTauriApp() ? new SqlActivityRepository() : new BrowserActivityRepository(),
  );
  return repositoryPromise;
}

export async function logActivity(draft: ActivityLogDraft) {
  const repository = await getActivityRepository();
  await repository.logActivity(draft);
  await emitAppEvent(ACTIVITY_CHANGED_EVENT, {
    action: draft.action,
    taskId: draft.taskId ?? null,
    at: new Date().toISOString(),
  });
}

export async function listRecentActivity(limit?: number) {
  const repository = await getActivityRepository();
  return repository.listRecentActivity(limit);
}
