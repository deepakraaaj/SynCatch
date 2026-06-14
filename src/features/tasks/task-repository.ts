import { isTauriApp } from '../../lib/tauri';
import { getSqlDatabase } from '../../lib/database';
import { createSeedTasks } from './task-seed';
import { hydrateTaskRecord, normalizeTaskDraft, sortTasks } from './task-helpers';
import type { Task, TaskDraft, TaskEnergy } from './task-types';
import { useAuthStore } from '../auth/auth-store';
import { enqueueSync } from '../../lib/sync-outbox';

const LOCAL_STORAGE_KEY = 'missioncontrol-tasks-v2';

interface TaskRepository {
  initialize(): Promise<void>;
  listTasks(): Promise<Task[]>;
  createTask(draft: TaskDraft): Promise<Task>;
  updateTask(task: Task): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
}

interface SqlTaskRow {
  id: string;
  mission_id: string | null;
  parent_task_id: string | null;
  title: string;
  outcome: string;
  next_action: string;
  notes: string;
  completion_note: string;
  status: Task['status'];
  priority: Task['priority'];
  lane: Task['lane'];
  energy: TaskEnergy;
  estimated_minutes: number;
  due_date: string | null;
  scheduled_for: string | null;
  tags_json: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function parseTagsJson(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function fromSqlRow(row: SqlTaskRow): Task {
  return hydrateTaskRecord({
    ...row,
    tags: parseTagsJson(row.tags_json),
  });
}

class BrowserTaskRepository implements TaskRepository {
  async initialize() {
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!existing) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(createSeedTasks()));
    }
  }

  async listTasks() {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]') as Task[];
    const tasks = sortTasks(parsed.map((task) => hydrateTaskRecord(task)));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortTasks(tasks)));
    return tasks;
  }

  async createTask(draft: TaskDraft) {
    const task = normalizeTaskDraft(draft);
    const tasks = await this.listTasks();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortTasks([task, ...tasks])));
    return task;
  }

  async updateTask(task: Task) {
    const tasks = await this.listTasks();
    const nextTasks = tasks.map((existing) => (existing.id === task.id ? task : existing));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortTasks(nextTasks)));
  }

  async deleteTask(taskId: string) {
    const tasks = await this.listTasks();
    const nextTasks = tasks.filter((task) => task.id !== taskId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortTasks(nextTasks)));
  }
}

const TASK_INSERT_SQL = `INSERT INTO tasks (
  id, mission_id, parent_task_id, title, outcome, next_action, notes, completion_note,
  status, priority, lane, energy, estimated_minutes,
  due_date, scheduled_for, tags_json, completed_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function taskInsertParams(task: Task) {
  return [
    task.id,
    task.mission_id,
    task.parent_task_id,
    task.title,
    task.outcome,
    task.next_action,
    task.notes,
    task.completion_note,
    task.status,
    task.priority,
    task.lane,
    task.energy,
    task.estimated_minutes,
    task.due_date,
    task.scheduled_for,
    JSON.stringify(task.tags),
    task.completed_at,
    task.created_at,
    task.updated_at,
  ];
}

const TASK_UPDATE_SQL = `UPDATE tasks SET
  mission_id = ?, parent_task_id = ?, title = ?, outcome = ?, next_action = ?, notes = ?, completion_note = ?,
  status = ?, priority = ?, lane = ?, energy = ?, estimated_minutes = ?,
  due_date = ?, scheduled_for = ?, tags_json = ?, completed_at = ?, updated_at = ?
WHERE id = ?`;

function taskUpdateParams(task: Task) {
  return [
    task.mission_id,
    task.parent_task_id,
    task.title,
    task.outcome,
    task.next_action,
    task.notes,
    task.completion_note,
    task.status,
    task.priority,
    task.lane,
    task.energy,
    task.estimated_minutes,
    task.due_date,
    task.scheduled_for,
    JSON.stringify(task.tags),
    task.completed_at,
    task.updated_at,
    task.id,
  ];
}

class SqlTaskRepository implements TaskRepository {
  private async getDatabase() {
    return getSqlDatabase();
  }

  async initialize() {
    const db = await this.getDatabase();
    const countRows = await db.select<{ count: number }>('SELECT COUNT(*) as count FROM tasks');
    const taskCount = countRows[0]?.count ?? 0;
    if (taskCount > 0) return;

    const seedTasks = createSeedTasks();
    for (const task of seedTasks) {
      await db.execute(TASK_INSERT_SQL, taskInsertParams(task));
    }
  }

  async listTasks() {
    const db = await this.getDatabase();
    const rows = await db.select<SqlTaskRow>('SELECT * FROM tasks ORDER BY updated_at DESC');
    return rows.map(fromSqlRow);
  }

  async createTask(draft: TaskDraft) {
    const task = normalizeTaskDraft(draft);
    const db = await this.getDatabase();
    await db.execute(TASK_INSERT_SQL, taskInsertParams(task));
    void enqueueSync('tasks', task.id, 'upsert', {
      ...task,
      tags_json: JSON.stringify(task.tags),
    });
    return task;
  }

  async updateTask(task: Task) {
    const db = await this.getDatabase();
    await db.execute(TASK_UPDATE_SQL, taskUpdateParams(task));
    void enqueueSync('tasks', task.id, 'upsert', {
      ...task,
      tags_json: JSON.stringify(task.tags),
    });
  }

  async deleteTask(taskId: string) {
    const db = await this.getDatabase();
    await db.execute('DELETE FROM tasks WHERE id = ? OR parent_task_id = ?', [taskId, taskId]);
    void enqueueSync('tasks', taskId, 'delete', { id: taskId });
  }
}

class SupabaseTaskRepository implements TaskRepository {
  async initialize() {}

  async listTasks() {
    const { selectTasksByUser } = await import('../../lib/supabase');
    return await selectTasksByUser();
  }

  async createTask(draft: TaskDraft) {
    const { insertTask } = await import('../../lib/supabase');
    const task = normalizeTaskDraft(draft);
    await insertTask(task);
    return task;
  }

  async updateTask(task: Task) {
    const { updateTask } = await import('../../lib/supabase');
    await updateTask(task);
  }

  async deleteTask(taskId: string) {
    const { deleteTask } = await import('../../lib/supabase');
    await deleteTask(taskId);
  }
}

let repositoryPromise: Promise<TaskRepository> | null = null;
const SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL);

export function getTaskRepository() {
  repositoryPromise ??= Promise.resolve(
    SUPABASE_CONFIGURED && !useAuthStore.getState().localMode
      ? new SupabaseTaskRepository()
      : isTauriApp()
        ? new SqlTaskRepository()
        : new BrowserTaskRepository(),
  );
  return repositoryPromise;
}
