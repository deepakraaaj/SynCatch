import { create } from 'zustand';
import { emitAppEvent, TASKS_CHANGED_EVENT } from '../../lib/tauri';
import { deriveStatusFromLane, sortTasks } from './task-helpers';
import { getTaskRepository } from './task-repository';
import type { Task, TaskDraft, TaskLane } from './task-types';
import { showSuccessToast } from '../toasts/toast-store';
import { resolveCharacterState } from '../../character/characterState';
import { pushCharacterCompletionToast } from '../../character/characterToast';

interface TaskStore {
  tasks: Task[];
  selectedTaskId: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  createTask: (draft: TaskDraft) => Promise<Task>;
  createSubtask: (parentTaskId: string, draft: Omit<TaskDraft, 'parent_task_id'>) => Promise<Task>;
  selectTask: (taskId: string | null) => void;
  saveTask: (task: Task) => Promise<void>;
  moveTaskToLane: (taskId: string, lane: TaskLane) => Promise<void>;
  markDone: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  hydrated: false,
  loading: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated || get().loading) return;
    set({ loading: true, error: null });
    try {
      const repository = await getTaskRepository();
      await repository.initialize();
      let tasks = sortTasks(await repository.listTasks());

      // One-time lift of legacy assignee tags into the first-class assignee_ids field.
      const { migrateLegacyAssigneeTags } = await import('../collaborators/legacy-tag-migration');
      const migrated = await migrateLegacyAssigneeTags(tasks, (task) => repository.updateTask(task));
      if (migrated) {
        tasks = sortTasks(await repository.listTasks());
      }

      set({
        tasks,
        hydrated: true,
        loading: false,
        selectedTaskId: get().selectedTaskId ?? tasks[0]?.id ?? null,
      });
    } catch (error) {
      // Still mark hydrated so the app renders (empty + error) instead of hanging on the loader.
      set({ hydrated: true, loading: false, error: error instanceof Error ? error.message : 'Unable to load tasks' });
    }
  },

  refresh: async (silent = false) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const repository = await getTaskRepository();
      const tasks = sortTasks(await repository.listTasks());
      set({
        tasks,
        loading: false,
        hydrated: true,
        selectedTaskId: tasks.some((task) => task.id === get().selectedTaskId)
          ? get().selectedTaskId
          : tasks[0]?.id ?? null,
      });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Unable to refresh tasks' });
    }
  },

  createTask: async (draft) => {
    const repository = await getTaskRepository();
    const task = await repository.createTask(draft);
    const tasks = sortTasks([task, ...get().tasks]);
    set({ tasks, selectedTaskId: task.id });
    await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'created', taskId: task.id });
    showSuccessToast('Task created', task.title);
    return task;
  },

  createSubtask: async (parentTaskId, draft) => {
    return get().createTask({ ...draft, parent_task_id: parentTaskId });
  },

  selectTask: (selectedTaskId) => set({ selectedTaskId }),

  saveTask: async (task) => {
    const repository = await getTaskRepository();
    const nextTask: Task = { ...task, updated_at: new Date().toISOString() };
    await repository.updateTask(nextTask);
    set({
      tasks: sortTasks(get().tasks.map((item) => (item.id === task.id ? nextTask : item))),
      selectedTaskId: task.id,
    });
    await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'updated', taskId: task.id });
  },

  moveTaskToLane: async (taskId, lane) => {
    const task = get().tasks.find((item) => item.id === taskId);
    if (!task || task.lane === lane) return;

    const now = new Date().toISOString();
    const nextTask: Task = {
      ...task,
      lane,
      status: deriveStatusFromLane(lane, task.status),
      completed_at: lane === 'done' ? (task.completed_at ?? now) : task.completed_at,
      updated_at: now,
    };

    set({
      tasks: sortTasks(get().tasks.map((item) => (item.id === taskId ? nextTask : item))),
      selectedTaskId: taskId,
      error: null,
    });

    try {
      const repository = await getTaskRepository();
      await repository.updateTask(nextTask);
      await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'moved', taskId, lane });
      if (lane === 'done') {
        const state = resolveCharacterState({ tasks: get().tasks, now: new Date() });
        pushCharacterCompletionToast(task.title, task.id, state);
      }
    } catch (error) {
      set((state) => ({
        tasks: sortTasks(state.tasks.map((item) => (item.id === taskId ? task : item))),
        error: error instanceof Error ? error.message : 'Unable to move task',
      }));
    }
  },

  markDone: async (taskId) => {
    const repository = await getTaskRepository();
    const task = get().tasks.find((item) => item.id === taskId);
    if (!task) return;

    const now = new Date().toISOString();
    const nextTask: Task = {
      ...task,
      lane: 'done',
      status: 'done',
      completed_at: task.completed_at ?? now,
      updated_at: now,
    };

    // Optimistic update
    const previousTasks = get().tasks;
    set({ tasks: sortTasks(previousTasks.map((item) => (item.id === taskId ? nextTask : item))) });

    try {
      const repository = await getTaskRepository();
      await repository.updateTask(nextTask);
      await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'done', taskId });
      const state = resolveCharacterState({ tasks: get().tasks, now: new Date() });
      pushCharacterCompletionToast(task.title, task.id, state);
    } catch (error) {
      set({ tasks: previousTasks, error: error instanceof Error ? error.message : 'Unable to complete task' });
    }
  },

  deleteTask: async (taskId) => {
    const task = get().tasks.find((item) => item.id === taskId);
    if (!task) return;

    // Optimistic update
    const previousTasks = get().tasks;
    const previousSelectedId = get().selectedTaskId;

    set((state) => {
      const nextTasks = state.tasks.filter((t) => t.id !== taskId);
      return {
        tasks: sortTasks(nextTasks),
        selectedTaskId: state.selectedTaskId === taskId
          ? (nextTasks[0]?.id ?? null)
          : state.selectedTaskId,
      };
    });

    try {
      const repository = await getTaskRepository();
      await repository.deleteTask(taskId);

      await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'deleted', taskId });
      showSuccessToast('Task deleted', task.title);
    } catch (error) {
      set({
        tasks: previousTasks,
        selectedTaskId: previousSelectedId,
        error: error instanceof Error ? error.message : 'Unable to delete task'
      });
    }
  },
}));
