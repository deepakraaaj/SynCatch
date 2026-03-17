import { isTauriApp } from '../../lib/tauri';
import { getSqlDatabase } from '../../lib/database';
import { createSeedTasks } from './task-seed';
import { normalizeTaskDraft, sortTasks } from './task-helpers';
import type { Task, TaskDraft } from './task-types';

const LOCAL_STORAGE_KEY = 'missioncontrol-tasks-v1';

interface TaskRepository {
  initialize(): Promise<void>;
  listTasks(): Promise<Task[]>;
  createTask(draft: TaskDraft): Promise<Task>;
  updateTask(task: Task): Promise<void>;
}

type SqlTaskRow = Task;

class BrowserTaskRepository implements TaskRepository {
  async initialize() {
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (!existing) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(createSeedTasks()));
    }
  }

  async listTasks() {
    return sortTasks(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]') as Task[]);
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
          status,
          priority,
          lane,
          estimated_minutes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.title,
          task.raw_input,
          task.description,
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
    return rows;
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
        status,
        priority,
        lane,
        estimated_minutes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.raw_input,
        task.description,
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
