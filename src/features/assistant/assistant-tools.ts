// Tool layer: maps the LLM's function calls onto the app's zustand stores.
// Each tool has a JSON-schema definition (sent to the model) and an executor
// (run when the model calls it). Executors return a short JSON-serializable
// result that is fed back to the model.

import type { ToolDefinition } from '../../lib/cerebras';
import { useTaskStore } from '../tasks/task-store';
import { useMissionStore } from '../missions/mission-store';
import { useJournalStore } from '../journal/journal-store';
import { useSessionStore } from '../sessions/session-store';
import { toLocalDateString } from '../journal/journal-helpers';
import type { TaskLane, TaskPriority } from '../tasks/task-types';
import type { JournalEntryKind } from '../journal/journal-types';

const VALID_LANES: TaskLane[] = ['inbox', 'now', 'next', 'later', 'done'];
const VALID_PRIORITIES: TaskPriority[] = ['critical', 'high', 'normal', 'low'];
const VALID_JOURNAL_KINDS: JournalEntryKind[] = ['regret', 'manifestation', 'best_moment', 'lesson'];

// Resolve a task either by id or a fuzzy title match.
function findTask(ref: string) {
  const tasks = useTaskStore.getState().tasks;
  const byId = tasks.find((t) => t.id === ref);
  if (byId) return byId;
  const needle = ref.trim().toLowerCase();
  return (
    tasks.find((t) => t.title.toLowerCase() === needle) ??
    tasks.find((t) => t.title.toLowerCase().includes(needle)) ??
    null
  );
}

function findMission(ref: string) {
  const missions = useMissionStore.getState().missions;
  const byId = missions.find((m) => m.id === ref);
  if (byId) return byId;
  const needle = ref.trim().toLowerCase();
  return (
    missions.find((m) => m.title.toLowerCase() === needle) ??
    missions.find((m) => m.title.toLowerCase().includes(needle)) ??
    null
  );
}

export interface ToolHandler {
  definition: ToolDefinition;
  run: (args: Record<string, any>) => Promise<unknown> | unknown;
}

export const ASSISTANT_TOOLS: ToolHandler[] = [
  {
    definition: {
      type: 'function',
      function: {
        name: 'list_tasks',
        description: 'List the user\'s tasks. Optionally filter by lane or status. Use this before updating/completing/deleting a task to find its id.',
        parameters: {
          type: 'object',
          properties: {
            lane: { type: 'string', enum: VALID_LANES, description: 'Filter by lane (inbox/now/next/later/done)' },
          },
        },
      },
    },
    run: ({ lane }) => {
      let tasks = useTaskStore.getState().tasks;
      if (lane) tasks = tasks.filter((t) => t.lane === lane);
      return tasks.slice(0, 40).map((t) => ({
        id: t.id,
        title: t.title,
        lane: t.lane,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
      }));
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'create_task',
        description: 'Create a new task.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short task title (required)' },
            notes: { type: 'string', description: 'Optional freeform notes/context' },
            priority: { type: 'string', enum: VALID_PRIORITIES },
            lane: { type: 'string', enum: VALID_LANES, description: 'Defaults to inbox' },
            due_date: { type: 'string', description: 'Due date as YYYY-MM-DD' },
            estimated_minutes: { type: 'number' },
            mission_title: { type: 'string', description: 'Attach to a mission by title' },
          },
          required: ['title'],
        },
      },
    },
    run: async ({ title, notes, priority, lane, due_date, estimated_minutes, mission_title }) => {
      const mission = mission_title ? findMission(mission_title) : null;
      const task = await useTaskStore.getState().createTask({
        title,
        notes,
        priority,
        lane,
        due_date: due_date ?? null,
        estimated_minutes,
        mission_id: mission?.id ?? null,
      });
      return { created: true, id: task.id, title: task.title };
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'complete_task',
        description: 'Mark a task as done. Identify it by id or title.',
        parameters: {
          type: 'object',
          properties: { task: { type: 'string', description: 'Task id or title' } },
          required: ['task'],
        },
      },
    },
    run: async ({ task }) => {
      const found = findTask(task);
      if (!found) return { error: `No task matching "${task}"` };
      await useTaskStore.getState().markDone(found.id);
      return { completed: true, id: found.id, title: found.title };
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'update_task',
        description: 'Update fields on an existing task (title, notes, priority, lane, due_date).',
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Task id or title' },
            title: { type: 'string' },
            notes: { type: 'string' },
            priority: { type: 'string', enum: VALID_PRIORITIES },
            lane: { type: 'string', enum: VALID_LANES },
            due_date: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['task'],
        },
      },
    },
    run: async ({ task, title, notes, priority, lane, due_date }) => {
      const found = findTask(task);
      if (!found) return { error: `No task matching "${task}"` };
      await useTaskStore.getState().saveTask({
        ...found,
        title: title ?? found.title,
        notes: notes ?? found.notes,
        priority: priority ?? found.priority,
        lane: lane ?? found.lane,
        due_date: due_date ?? found.due_date,
        updated_at: new Date().toISOString(),
      });
      return { updated: true, id: found.id, title: title ?? found.title };
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'delete_task',
        description: 'Delete a task permanently. Identify it by id or title.',
        parameters: {
          type: 'object',
          properties: { task: { type: 'string', description: 'Task id or title' } },
          required: ['task'],
        },
      },
    },
    run: async ({ task }) => {
      const found = findTask(task);
      if (!found) return { error: `No task matching "${task}"` };
      await useTaskStore.getState().deleteTask(found.id);
      return { deleted: true, id: found.id, title: found.title };
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'list_missions',
        description: 'List the user\'s missions (projects).',
        parameters: { type: 'object', properties: {} },
      },
    },
    run: () =>
      useMissionStore.getState().missions.slice(0, 30).map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
      })),
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'create_mission',
        description: 'Create a new mission (project).',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            objective: { type: 'string' },
          },
          required: ['title'],
        },
      },
    },
    run: async ({ title, description, objective }) => {
      const mission = await useMissionStore.getState().createMission({ title, description, objective });
      return { created: true, id: mission.id, title: mission.title };
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'create_journal_entry',
        description: 'Add a journal entry for a given day. kind is one of best_moment, manifestation, regret, lesson.',
        parameters: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: VALID_JOURNAL_KINDS },
            content: { type: 'string' },
            entry_date: { type: 'string', description: 'YYYY-MM-DD; defaults to today' },
          },
          required: ['kind', 'content'],
        },
      },
    },
    run: async ({ kind, content, entry_date }) => {
      const entry = await useJournalStore.getState().createEntry({
        kind,
        content,
        entry_date: entry_date ?? toLocalDateString(new Date()),
      });
      return { created: true, id: entry.id, kind: entry.kind };
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'set_mood_and_gratitude',
        description: "Set the user's mood (1-5) and/or gratitude note for a day.",
        parameters: {
          type: 'object',
          properties: {
            mood: { type: 'number', description: '1 (struggling) to 5 (thriving)' },
            gratitude: { type: 'string' },
            entry_date: { type: 'string', description: 'YYYY-MM-DD; defaults to today' },
          },
        },
      },
    },
    run: async ({ mood, gratitude, entry_date }) => {
      const date = entry_date ?? toLocalDateString(new Date());
      const existing = useJournalStore.getState().days.find((d) => d.entry_date === date);
      await useJournalStore.getState().saveDay({
        entry_date: date,
        mood: mood ?? existing?.mood ?? 0,
        gratitude: gratitude ?? existing?.gratitude ?? '',
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { saved: true, entry_date: date };
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'start_focus_session',
        description: 'Start a focus timer for a task. Identify the task by id or title.',
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Task id or title' },
            minutes: { type: 'number', description: 'Defaults to 25' },
          },
          required: ['task'],
        },
      },
    },
    run: ({ task, minutes }) => {
      const found = findTask(task);
      if (!found) return { error: `No task matching "${task}"` };
      useSessionStore.getState().startSession({
        taskId: found.id,
        taskTitle: found.title,
        minutes: minutes ?? 25,
        presetId: 'focus',
      });
      return { started: true, task: found.title, minutes: minutes ?? 25 };
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'stop_focus_session',
        description: 'Stop / complete the currently running focus session.',
        parameters: { type: 'object', properties: {} },
      },
    },
    run: () => {
      const { activeSessionId, completeActiveSession } = useSessionStore.getState();
      if (!activeSessionId) return { error: 'No active focus session' };
      completeActiveSession();
      return { stopped: true };
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'get_today_summary',
        description: 'Get a summary of today: task counts by lane, active focus session, and journal entries logged today.',
        parameters: { type: 'object', properties: {} },
      },
    },
    run: () => {
      const today = toLocalDateString(new Date());
      const tasks = useTaskStore.getState().tasks;
      const byLane: Record<string, number> = {};
      tasks.forEach((t) => {
        byLane[t.lane] = (byLane[t.lane] ?? 0) + 1;
      });
      const { sessions, activeSessionId } = useSessionStore.getState();
      const active = sessions.find((s) => s.id === activeSessionId);
      const journalToday = useJournalStore.getState().entries.filter((e) => e.entry_date === today);
      return {
        date: today,
        tasks_by_lane: byLane,
        total_tasks: tasks.length,
        active_focus: active ? { task: active.task_title, status: active.status } : null,
        journal_entries_today: journalToday.length,
      };
    },
  },
];

export const ASSISTANT_TOOL_DEFINITIONS: ToolDefinition[] = ASSISTANT_TOOLS.map((t) => t.definition);

export async function executeTool(name: string, args: Record<string, any>): Promise<unknown> {
  const tool = ASSISTANT_TOOLS.find((t) => t.definition.function.name === name);
  if (!tool) return { error: `Unknown tool: ${name}` };
  try {
    return await tool.run(args);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
