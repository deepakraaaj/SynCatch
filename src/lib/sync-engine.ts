import { isTauriApp, subscribeAppEvent, TASKS_CHANGED_EVENT } from './tauri';
import { useAuthStore } from '../features/auth/auth-store';
import { useSyncStore } from '../features/sync/sync-store';
import {
  selectTasksByUser,
  selectMissionsByUser,
  selectJournalEntries,
  selectJournalDays,
  selectNotesByUser,
  selectNoteCategoriesByUser,
  upsertTask,
  upsertMission,
  upsertJournalEntry,
  upsertJournalDay,
  upsertNote,
  upsertNoteCategory,
  deleteTask as deleteTaskCloud,
  deleteMission as deleteMissionCloud,
  deleteJournalEntry as deleteJournalEntryCloud,
  deleteNoteRow as deleteNoteCloud,
  deleteNoteCategory as deleteNoteCategoryCloud,
} from './supabase';
import { useTaskStore } from '../features/tasks/task-store';
import { useMissionStore } from '../features/missions/mission-store';
import { useJournalStore } from '../features/journal/journal-store';
import { useNoteStore } from '../features/notes/note-store';

export interface SyncStatus {
  pendingCount: number;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  lastError: string | null;
}

interface OutboxRow {
  id: string;
  table_name: string;
  row_id: string;
  operation: 'upsert' | 'delete';
  payload: string;
  created_at: string;
  synced_at: string | null;
  attempts: number;
  last_error: string | null;
}

class SyncEngine {
  private isSyncing = false;
  private lastError: string | null = null;

  start(): void {
    if (!isTauriApp()) return;

    // Online event listener
    window.addEventListener('online', () => void this.flush());

    // App event subscriptions
    subscribeAppEvent(TASKS_CHANGED_EVENT, () => void this.flush());

    // 5-minute fallback interval
    setInterval(() => void this.flush(), 5 * 60 * 1000);

    // Initial status update
    this.updateStatus();
  }

  async flush(): Promise<void> {
    if (!isTauriApp()) return;
    if (this.isSyncing) return;

    const { session, localMode } = useAuthStore.getState();
    if (!session || localMode || !navigator.onLine) return;

    this.isSyncing = true;
    this.lastError = null;

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Read pending outbox rows (up to 50)
      const rows = await invoke<OutboxRow[]>('plugin:sql|select', {
        database: 'sqlite:mission-control.db',
        query: `
          SELECT * FROM sync_outbox
          WHERE synced_at IS NULL AND attempts < 5
          ORDER BY created_at ASC
          LIMIT 50
        `,
      });

      for (const row of rows) {
        try {
          await this.transformAndPush(row, session.user.id);

          // Mark as synced
          await invoke('plugin:sql|execute', {
            database: 'sqlite:mission-control.db',
            query: `
              UPDATE sync_outbox SET synced_at = ? WHERE id = ?
            `,
            values: [new Date().toISOString(), row.id],
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);

          // Increment attempts and store error
          await invoke('plugin:sql|execute', {
            database: 'sqlite:mission-control.db',
            query: `
              UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?
            `,
            values: [errorMsg, row.id],
          });

          this.lastError = errorMsg;
        }
      }

      // Update localStorage with last sync time
      localStorage.setItem('mc-last-synced-at', new Date().toISOString());
      this.updateStatus();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.lastError = errorMsg;
      this.updateStatus();
    } finally {
      this.isSyncing = false;
    }
  }

  async downloadAll(): Promise<void> {
    if (!isTauriApp()) return;

    const { session, localMode } = useAuthStore.getState();
    if (!session || localMode) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Pull all tasks
      const tasks = await selectTasksByUser();
      for (const task of tasks) {
        const payload = {
          id: task.id,
          mission_id: task.mission_id,
          parent_task_id: task.parent_task_id,
          title: task.title,
          outcome: task.outcome,
          next_action: task.next_action,
          notes: task.notes,
          completion_note: task.completion_note,
          status: task.status,
          priority: task.priority,
          lane: task.lane,
          energy: task.energy,
          estimated_minutes: task.estimated_minutes,
          due_date: task.due_date,
          scheduled_for: task.scheduled_for,
          tags_json: JSON.stringify(task.tags),
          completed_at: task.completed_at,
          created_at: task.created_at,
          updated_at: task.updated_at,
        };

        await invoke('plugin:sql|execute', {
          database: 'sqlite:mission-control.db',
          query: `
            INSERT OR REPLACE INTO tasks (
              id, mission_id, parent_task_id, title, outcome, next_action, notes, completion_note,
              status, priority, lane, energy, estimated_minutes, due_date,
              scheduled_for, tags_json, completed_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          values: [
            payload.id,
            payload.mission_id,
            payload.parent_task_id,
            payload.title,
            payload.outcome,
            payload.next_action,
            payload.notes,
            payload.completion_note,
            payload.status,
            payload.priority,
            payload.lane,
            payload.energy,
            payload.estimated_minutes,
            payload.due_date,
            payload.scheduled_for,
            payload.tags_json,
            payload.completed_at,
            payload.created_at,
            payload.updated_at,
          ],
        });
      }

      // Pull all missions
      const missions = await selectMissionsByUser();
      for (const mission of missions) {
        const payload = {
          id: mission.id,
          title: mission.title,
          description: mission.description,
          emoji: mission.emoji,
          color: mission.color,
          objective: mission.objective,
          why_it_matters: mission.why_it_matters,
          definition_of_success: mission.definition_of_success,
          status: mission.status,
          started_at: mission.started_at,
          completed_at: mission.completed_at,
          target_date: mission.target_date,
          estimated_hours: mission.estimated_hours,
          is_pinned: mission.is_pinned ? 1 : 0,
          sort_order: mission.sort_order,
          tags_json: JSON.stringify(mission.tags),
          notes: mission.notes,
          created_at: mission.created_at,
          updated_at: mission.updated_at,
        };

        await invoke('plugin:sql|execute', {
          database: 'sqlite:mission-control.db',
          query: `
            INSERT OR REPLACE INTO missions (
              id, title, description, emoji, color, objective, why_it_matters,
              definition_of_success, status, started_at, completed_at, target_date,
              estimated_hours, is_pinned, sort_order, tags_json, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          values: [
            payload.id,
            payload.title,
            payload.description,
            payload.emoji,
            payload.color,
            payload.objective,
            payload.why_it_matters,
            payload.definition_of_success,
            payload.status,
            payload.started_at,
            payload.completed_at,
            payload.target_date,
            payload.estimated_hours,
            payload.is_pinned,
            payload.sort_order,
            payload.tags_json,
            payload.notes,
            payload.created_at,
            payload.updated_at,
          ],
        });
      }

      // Pull all journal entries
      const journalEntries = await selectJournalEntries();
      for (const entry of journalEntries) {
        await invoke('plugin:sql|execute', {
          database: 'sqlite:mission-control.db',
          query: `
            INSERT OR REPLACE INTO journal_entries (
              id, kind, content, entry_date, linked_entry_id, mission_id, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          values: [
            entry.id,
            entry.kind,
            entry.content,
            entry.entry_date,
            entry.linked_entry_id,
            entry.mission_id,
            entry.sort_order,
            entry.created_at,
            entry.updated_at,
          ],
        });
      }

      // Pull all journal days
      const journalDays = await selectJournalDays();
      for (const day of journalDays) {
        await invoke('plugin:sql|execute', {
          database: 'sqlite:mission-control.db',
          query: `
            INSERT OR REPLACE INTO journal_days (
              entry_date, mood, gratitude, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?)
          `,
          values: [
            day.entry_date,
            day.mood,
            day.gratitude,
            day.created_at,
            day.updated_at,
          ],
        });
      }

      // Pull all note categories
      const noteCategories = await selectNoteCategoriesByUser();
      for (const category of noteCategories) {
        await invoke('plugin:sql|execute', {
          database: 'sqlite:mission-control.db',
          query: `
            INSERT OR REPLACE INTO note_categories (
              id, label, color, icon, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          values: [
            category.id,
            category.label,
            category.color,
            category.icon,
            category.sort_order,
            category.created_at,
            category.updated_at,
          ],
        });
      }

      // Pull all notes
      const notes = await selectNotesByUser();
      for (const note of notes) {
        await invoke('plugin:sql|execute', {
          database: 'sqlite:mission-control.db',
          query: `
            INSERT OR REPLACE INTO notes (
              id, title, content, category_id, mission_id, pinned, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          values: [
            note.id,
            note.title,
            note.content,
            note.category_id,
            note.mission_id,
            note.pinned ? 1 : 0,
            note.sort_order,
            note.created_at,
            note.updated_at,
          ],
        });
      }

      // Reload stores from SQLite
      void useTaskStore.getState().refresh(true);
      void useMissionStore.getState().refresh();
      void useJournalStore.getState().refresh();
      void useNoteStore.getState().refresh();

      localStorage.setItem('mc-last-synced-at', new Date().toISOString());
      this.updateStatus();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.lastError = errorMsg;
      this.updateStatus();
    }
  }

  getStatus(): SyncStatus {
    const lastSyncedAt = localStorage.getItem('mc-last-synced-at');
    return {
      pendingCount: 0, // Will be updated via _update
      lastSyncedAt,
      isSyncing: this.isSyncing,
      lastError: this.lastError,
    };
  }

  private async updateStatus(): Promise<void> {
    if (!isTauriApp()) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      const pendingRows = await invoke<Array<{ count: number }>>('plugin:sql|select', {
        database: 'sqlite:mission-control.db',
        query: `
          SELECT COUNT(*) as count FROM sync_outbox
          WHERE synced_at IS NULL AND attempts < 5
        `,
      });

      const pendingCount = pendingRows[0]?.count ?? 0;
      const lastSyncedAt = localStorage.getItem('mc-last-synced-at');

      useSyncStore.getState()._update({
        pendingCount,
        lastSyncedAt,
        isSyncing: this.isSyncing,
        lastError: this.lastError,
      });
    } catch (error) {
      console.error('Failed to update sync status:', error);
    }
  }

  private async transformAndPush(
    row: OutboxRow,
    userId: string,
  ): Promise<void> {
    const payload = JSON.parse(row.payload);

    if (row.operation === 'delete') {
      // Handle deletes
      if (row.table_name === 'tasks') {
        await deleteTaskCloud(row.row_id);
      } else if (row.table_name === 'missions') {
        await deleteMissionCloud(row.row_id);
      } else if (row.table_name === 'journal_entries') {
        await deleteJournalEntryCloud(row.row_id);
      } else if (row.table_name === 'notes') {
        await deleteNoteCloud(row.row_id);
      } else if (row.table_name === 'note_categories') {
        await deleteNoteCategoryCloud(row.row_id);
      }
    } else {
      // Handle upserts with field transforms
      if (row.table_name === 'tasks') {
        const transformed = {
          ...payload,
          user_id: userId,
          tags: JSON.parse(payload.tags_json ?? '[]'),
        };
        delete transformed.tags_json;
        await upsertTask(transformed as any);
      } else if (row.table_name === 'missions') {
        const transformed = {
          ...payload,
          user_id: userId,
          tags: JSON.parse(payload.tags_json ?? '[]'),
          is_pinned: Boolean(payload.is_pinned),
        };
        delete transformed.tags_json;
        await upsertMission(transformed as any);
      } else if (row.table_name === 'journal_entries') {
        const transformed = {
          ...payload,
          user_id: userId,
        };
        await upsertJournalEntry(transformed as any);
      } else if (row.table_name === 'journal_days') {
        const transformed = {
          ...payload,
          user_id: userId,
        };
        await upsertJournalDay(transformed as any);
      } else if (row.table_name === 'notes') {
        const transformed = {
          ...payload,
          user_id: userId,
          pinned: Boolean(payload.pinned),
        };
        await upsertNote(transformed as any);
      } else if (row.table_name === 'note_categories') {
        const transformed = {
          ...payload,
          user_id: userId,
        };
        await upsertNoteCategory(transformed as any);
      }
    }
  }
}

export const syncEngine = new SyncEngine();
