import { isTauriApp } from '../../lib/tauri';
import { getSqlDatabase } from '../../lib/database';
import { createSeedTasks } from './task-seed';
import { hydrateTaskRecord, normalizeTaskDraft, sortTasks } from './task-helpers';
import type { Task, TaskDraft } from './task-types';

const LOCAL_STORAGE_KEY = 'missioncontrol-tasks-v1';

interface TaskRepository {
  initialize(): Promise<void>;
  listTasks(): Promise<Task[]>;
  createTask(draft: TaskDraft): Promise<Task>;
  updateTask(task: Task): Promise<void>;
}

interface SqlTaskRow {
  id: string;
  title: string;
  raw_input: string;
  description: string;
  goal: string | null;
  definition_of_done: string | null;
  next_action: string | null;
  why_it_matters: string | null;
  workspace_notes: string | null;
  subtasks_json: string | null;
  clarifying_questions_json: string | null;
  status: Task['status'];
  priority: Task['priority'];
  lane: Task['lane'];
  estimated_minutes: number;
  created_at: string;
  updated_at: string;
}

function serializeTasks(tasks: Task[]) {
  return JSON.stringify(sortTasks(tasks));
}

function parseJsonArray<T>(value: string | null | undefined) {
  if (!value) {
    return [] as T[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function toStoredTask(task: Task) {
  return {
    ...task,
  };
}

function fromSqlRow(row: SqlTaskRow) {
  return hydrateTaskRecord({
    ...row,
    subtasks: parseJsonArray(row.subtasks_json),
    clarifying_questions: parseJsonArray(row.clarifying_questions_json),
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
    localStorage.setItem(LOCAL_STORAGE_KEY, serializeTasks(tasks));
    return tasks;
  }

  async createTask(draft: TaskDraft) {
    const task = normalizeTaskDraft(draft);
    const tasks = await this.listTasks();
    localStorage.setItem(LOCAL_STORAGE_KEY, serializeTasks([task, ...tasks].map(toStoredTask)));
    return task;
  }

  async updateTask(task: Task) {
    const tasks = await this.listTasks();
    const nextTasks = tasks.map((existing) => (existing.id === task.id ? task : existing));
    localStorage.setItem(LOCAL_STORAGE_KEY, serializeTasks(nextTasks.map(toStoredTask)));
  }
}

class SqlTaskRepository implements TaskRepository {
  private async getDatabase() {
    return getSqlDatabase();
  }

  async initialize() {
    const db = await this.getDatabase();
    const countRows = await db.select<{ count: number }>('SELECT COUNT(*) as count FROM tasks');
    const taskCount = countRows[0]?.count ?? 0;

    if (taskCount > 0) {
      return;
    }

    const seedTasks = createSeedTasks();
    for (const task of seedTasks) {
      await db.execute(
        `INSERT INTO tasks (
          id,
          title,
          raw_input,
          description,
          goal,
          definition_of_done,
          next_action,
          why_it_matters,
          workspace_notes,
          subtasks_json,
          clarifying_questions_json,
          status,
          priority,
          lane,
          estimated_minutes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.title,
          task.raw_input,
          task.description,
          task.goal,
          task.definition_of_done,
          task.next_action,
          task.why_it_matters,
          task.workspace_notes,
          JSON.stringify(task.subtasks),
          JSON.stringify(task.clarifying_questions),
          task.status,
          task.priority,
          task.lane,
          task.estimated_minutes,
          task.created_at,
          task.updated_at,
        ],
      );
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

    await db.execute(
      `INSERT INTO tasks (
        id,
        title,
        raw_input,
        description,
        goal,
        definition_of_done,
        next_action,
        why_it_matters,
        workspace_notes,
        subtasks_json,
        clarifying_questions_json,
        status,
        priority,
        lane,
        estimated_minutes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.raw_input,
        task.description,
        task.goal,
        task.definition_of_done,
        task.next_action,
        task.why_it_matters,
        task.workspace_notes,
        JSON.stringify(task.subtasks),
        JSON.stringify(task.clarifying_questions),
        task.status,
        task.priority,
        task.lane,
        task.estimated_minutes,
        task.created_at,
        task.updated_at,
      ],
    );

    return task;
  }

  async updateTask(task: Task) {
    const db = await this.getDatabase();

    await db.execute(
      `UPDATE tasks SET
        title = ?,
        raw_input = ?,
        description = ?,
        goal = ?,
        definition_of_done = ?,
        next_action = ?,
        why_it_matters = ?,
        workspace_notes = ?,
        subtasks_json = ?,
        clarifying_questions_json = ?,
        status = ?,
        priority = ?,
        lane = ?,
        estimated_minutes = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        task.title,
        task.raw_input,
        task.description,
        task.goal,
        task.definition_of_done,
        task.next_action,
        task.why_it_matters,
        task.workspace_notes,
        JSON.stringify(task.subtasks),
        JSON.stringify(task.clarifying_questions),
        task.status,
        task.priority,
        task.lane,
        task.estimated_minutes,
        task.updated_at,
        task.id,
      ],
    );
  }
}

let repositoryPromise: Promise<TaskRepository> | null = null;

export function getTaskRepository() {
  repositoryPromise ??= Promise.resolve(isTauriApp() ? new SqlTaskRepository() : new BrowserTaskRepository());
  return repositoryPromise;
}
