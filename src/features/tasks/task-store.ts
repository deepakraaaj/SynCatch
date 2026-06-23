import { create } from 'zustand';
import { logActivity } from '../activity/activity-repository';
import type { ActivitySource } from '../activity/activity-repository';
import { emitAppEvent, TASKS_CHANGED_EVENT } from '../../lib/tauri';
import { deriveStatusFromLane, sortTasks } from './task-helpers';
import { getTaskRepository } from './task-repository';
import type { Task, TaskDraft, TaskLane } from './task-types';
import { showSuccessToast } from '../toasts/toast-store';

interface TaskStore {
  tasks: Task[];
  selectedTaskId: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  createTask: (draft: TaskDraft, source?: ActivitySource) => Promise<Task>;
  createSubtask: (parentTaskId: string, draft: Omit<TaskDraft, 'parent_task_id'>, source?: ActivitySource) => Promise<Task>;
  selectTask: (taskId: string | null) => void;
  saveTask: (task: Task, source?: ActivitySource) => Promise<void>;
  moveTaskToLane: (taskId: string, lane: TaskLane, source?: ActivitySource) => Promise<void>;
  markDone: (taskId: string, source?: ActivitySource) => Promise<void>;
  deleteTask: (taskId: string, source?: ActivitySource) => Promise<void>;
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

  createTask: async (draft, source = 'system') => {
    const repository = await getTaskRepository();
    const task = await repository.createTask(draft);
    const tasks = sortTasks([task, ...get().tasks]);
    set({ tasks, selectedTaskId: task.id });
    await logActivity({
      action: 'task_created',
      source,
      taskId: task.id,
      details: { lane: task.lane, priority: task.priority, title: task.title },
    });
    await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'created', taskId: task.id });
    showSuccessToast('Task created', task.title);
    return task;
  },

  createSubtask: async (parentTaskId, draft, source = 'system') => {
    return get().createTask({ ...draft, parent_task_id: parentTaskId }, source);
  },

  selectTask: (selectedTaskId) => set({ selectedTaskId }),

  saveTask: async (task, source = 'system') => {
    const repository = await getTaskRepository();
    const nextTask: Task = { ...task, updated_at: new Date().toISOString() };
    await repository.updateTask(nextTask);
    set({
      tasks: sortTasks(get().tasks.map((item) => (item.id === task.id ? nextTask : item))),
      selectedTaskId: task.id,
    });
    await logActivity({
      action: 'task_updated',
      source,
      taskId: task.id,
      details: { lane: task.lane, title: task.title },
    });
    await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'updated', taskId: task.id });
  },

  moveTaskToLane: async (taskId, lane, source = 'system') => {
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
      await logActivity({
        action: 'task_lane_changed',
        source,
        taskId,
        details: { fromLane: task.lane, toLane: lane },
      });
      await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'moved', taskId, lane });
      if (lane === 'done') {
        showSuccessToast('Task completed', task.title);
      }
    } catch (error) {
      set((state) => ({
        tasks: sortTasks(state.tasks.map((item) => (item.id === taskId ? task : item))),
        error: error instanceof Error ? error.message : 'Unable to move task',
      }));
    }
  },

  markDone: async (taskId, source = 'system') => {
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
      await logActivity({
        action: 'task_completed',
        source,
        taskId,
        details: { fromLane: task.lane, title: task.title },
      });
      await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'done', taskId });
      showSuccessToast('Task completed', task.title);
    } catch (error) {
      set({ tasks: previousTasks, error: error instanceof Error ? error.message : 'Unable to complete task' });
    }
  },

  deleteTask: async (taskId, source = 'system') => {
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
      
      await logActivity({
        action: 'task_deleted',
        source,
        taskId,
        details: { title: task.title },
      });
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
