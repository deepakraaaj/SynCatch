import { create } from 'zustand';
import { logActivity } from '../activity/activity-repository';
import type { ActivitySource } from '../activity/activity-repository';
import { emitAppEvent, TASKS_CHANGED_EVENT } from '../../lib/tauri';
import { deriveStatusFromLane, sortTasks } from './task-helpers';
import { getTaskRepository } from './task-repository';
import type { Task, TaskDraft, TaskLane } from './task-types';

interface TaskStore {
  tasks: Task[];
  selectedTaskId: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  createTask: (draft: TaskDraft, source?: ActivitySource) => Promise<Task>;
  selectTask: (taskId: string | null) => void;
  saveTask: (task: Task, source?: ActivitySource) => Promise<void>;
  moveTaskToLane: (taskId: string, lane: TaskLane, source?: ActivitySource) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string, source?: ActivitySource) => Promise<void>;
  answerQuestion: (taskId: string, questionId: string, answer: string, source?: ActivitySource) => Promise<void>;
  markDone: (taskId: string, source?: ActivitySource) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  hydrated: false,
  loading: false,
  error: null,
  hydrate: async () => {
    if (get().hydrated || get().loading) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const repository = await getTaskRepository();
      await repository.initialize();
      const tasks = sortTasks(await repository.listTasks());
      set({
        tasks,
        hydrated: true,
        loading: false,
        selectedTaskId: get().selectedTaskId ?? tasks[0]?.id ?? null,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load missions',
      });
    }
  },
  refresh: async () => {
    set({ loading: true, error: null });

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
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to refresh missions',
      });
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
      details: {
        lane: task.lane,
        priority: task.priority,
        title: task.title,
      },
    });
    await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'created', taskId: task.id });
    return task;
  },
  selectTask: (selectedTaskId) => set({ selectedTaskId }),
  saveTask: async (task, source = 'system') => {
    const repository = await getTaskRepository();
    const nextTask: Task = {
      ...task,
      updated_at: new Date().toISOString(),
    };

    await repository.updateTask(nextTask);
    set({
      tasks: sortTasks(get().tasks.map((item) => (item.id === task.id ? nextTask : item))),
      selectedTaskId: task.id,
    });
    await logActivity({
      action: 'task_updated',
      source,
      taskId: task.id,
      details: {
        lane: task.lane,
        title: task.title,
      },
    });
    await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'updated', taskId: task.id });
  },
  moveTaskToLane: async (taskId, lane, source = 'system') => {
    const task = get().tasks.find((item) => item.id === taskId);

    if (!task || task.lane === lane) {
      return;
    }

    const nextTask: Task = {
      ...task,
      lane,
      status: deriveStatusFromLane(lane, task.status),
      updated_at: new Date().toISOString(),
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
        details: {
          fromLane: task.lane,
          toLane: lane,
        },
      });
      await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'moved', taskId, lane });
    } catch (error) {
      set((state) => ({
        tasks: sortTasks(state.tasks.map((item) => (item.id === taskId ? task : item))),
        error: error instanceof Error ? error.message : 'Unable to move mission',
      }));
    }
  },
  toggleSubtask: async (taskId, subtaskId, source = 'system') => {
    const task = get().tasks.find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    const nextTask: Task = {
      ...task,
      subtasks: task.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask,
      ),
      updated_at: new Date().toISOString(),
    };

    const repository = await getTaskRepository();
    await repository.updateTask(nextTask);
    set({
      tasks: sortTasks(get().tasks.map((item) => (item.id === taskId ? nextTask : item))),
    });
    await logActivity({
      action: 'task_updated',
      source,
      taskId,
      details: {
        field: 'subtasks',
      },
    });
    await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'updated', taskId });
  },
  answerQuestion: async (taskId, questionId, answer, source = 'system') => {
    const task = get().tasks.find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    const nextTask: Task = {
      ...task,
      clarifying_questions: task.clarifying_questions.map((question) =>
        question.id === questionId ? { ...question, answer: answer.trim() } : question,
      ),
      updated_at: new Date().toISOString(),
    };

    const repository = await getTaskRepository();
    await repository.updateTask(nextTask);
    set({
      tasks: sortTasks(get().tasks.map((item) => (item.id === taskId ? nextTask : item))),
    });
    await logActivity({
      action: 'task_updated',
      source,
      taskId,
      details: {
        field: 'clarifying_questions',
      },
    });
    await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'updated', taskId });
  },
  markDone: async (taskId, source = 'system') => {
    const repository = await getTaskRepository();
    const task = get().tasks.find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    const nextTask: Task = {
      ...task,
      lane: 'done',
      status: 'done',
      updated_at: new Date().toISOString(),
    };

    await repository.updateTask(nextTask);
    set({
      tasks: sortTasks(get().tasks.map((item) => (item.id === taskId ? nextTask : item))),
    });
    await logActivity({
      action: 'task_completed',
      source,
      taskId,
      details: {
        fromLane: task.lane,
        title: task.title,
      },
    });
    await emitAppEvent(TASKS_CHANGED_EVENT, { type: 'done', taskId });
  },
}));
