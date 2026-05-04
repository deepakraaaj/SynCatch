import { getSupabaseClient } from './auth';
import type { Task } from '../features/tasks/task-types';
import type { FocusSyncState } from '../features/focus/focus-store';
import type { ActivityLogEntry } from '../features/activity/activity-repository';
import type { WorkSession } from '../features/sessions/session-types';

export async function getSupabaseUser() {
  const client = getSupabaseClient();
  const { data } = await client.auth.getUser();
  return data.user;
}

export async function getUserId(): Promise<string> {
  const user = await getSupabaseUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.id;
}

// Tasks queries
export async function selectTasksByUser(): Promise<Task[]> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { data, error } = await (client
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false }) as any);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    raw_input: row.raw_input,
    description: row.description,
    goal: row.goal,
    definition_of_done: row.definition_of_done,
    next_action: row.next_action,
    why_it_matters: row.why_it_matters,
    workspace_notes: row.workspace_notes,
    subtasks: row.subtasks_json ?? [],
    clarifying_questions: row.clarifying_questions_json ?? [],
    status: row.status,
    priority: row.priority,
    lane: row.lane,
    estimated_minutes: row.estimated_minutes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function insertTask(task: Task): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('tasks').insert({
    id: task.id,
    user_id: userId,
    title: task.title,
    raw_input: task.raw_input,
    description: task.description,
    goal: task.goal,
    definition_of_done: task.definition_of_done,
    next_action: task.next_action,
    why_it_matters: task.why_it_matters,
    workspace_notes: task.workspace_notes,
    subtasks_json: task.subtasks,
    clarifying_questions_json: task.clarifying_questions,
    status: task.status,
    priority: task.priority,
    lane: task.lane,
    estimated_minutes: task.estimated_minutes,
    created_at: task.created_at,
    updated_at: task.updated_at,
  }) as any);

  if (error) throw error;
}

export async function updateTask(task: Task): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client
    .from('tasks')
    .update({
      title: task.title,
      raw_input: task.raw_input,
      description: task.description,
      goal: task.goal,
      definition_of_done: task.definition_of_done,
      next_action: task.next_action,
      why_it_matters: task.why_it_matters,
      workspace_notes: task.workspace_notes,
      subtasks_json: task.subtasks,
      clarifying_questions_json: task.clarifying_questions,
      status: task.status,
      priority: task.priority,
      lane: task.lane,
      estimated_minutes: task.estimated_minutes,
      updated_at: task.updated_at,
    })
    .eq('id', task.id)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

// Focus state queries
export async function selectFocusState(): Promise<FocusSyncState | null> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { data, error } = await (client
    .from('focus_state')
    .select('*')
    .eq('user_id', userId)
    .single() as any);

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found

  if (!data) return null;

  return {
    currentMissionId: data.current_active_mission,
    focusSessionStart: data.focus_session_start_time,
    focusElapsedSeconds: data.focus_elapsed_seconds,
    focusSessionDuration: data.focus_session_duration,
    focusConfirmationPrompts: data.focus_confirmation_prompts,
    manualFocusReset: data.manual_focus_reset,
    status: data.status,
    hudMode: data.hud_mode,
    hudTransparency: data.hud_transparency,
  };
}

export async function upsertFocusState(state: FocusSyncState): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('focus_state').upsert(
    {
      user_id: userId,
      current_active_mission: state.currentMissionId,
      focus_session_start_time: state.focusSessionStart,
      focus_elapsed_seconds: state.focusElapsedSeconds,
      focus_session_duration: state.focusSessionDuration,
      focus_confirmation_prompts: state.focusConfirmationPrompts,
      manual_focus_reset: state.manualFocusReset,
      status: state.status,
      hud_mode: state.hudMode,
      hud_transparency: state.hudTransparency,
    },
    { onConflict: 'user_id' },
  ) as any);

  if (error) throw error;
}

// Preferences queries
export async function selectPreference(key: string): Promise<string | null> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { data, error } = await (client
    .from('app_preferences')
    .select('value')
    .eq('user_id', userId)
    .eq('key', key)
    .single() as any);

  if (error && error.code !== 'PGRST116') throw error;

  return data ? JSON.stringify((data as any).value) : null;
}

export async function upsertPreference(key: string, value: unknown): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('app_preferences').upsert(
    {
      user_id: userId,
      key,
      value,
    },
    { onConflict: 'user_id,key' },
  ) as any);

  if (error) throw error;
}

// Activity log queries
export async function insertActivity(entry: Omit<ActivityLogEntry, 'created_at'>): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('activity_log').insert({
    id: entry.id,
    user_id: userId,
    action: entry.action,
    source: entry.source,
    task_id: entry.task_id,
    details: entry.details,
  }) as any);

  if (error) throw error;
}

export async function selectRecentActivity(limit: number = 50): Promise<ActivityLogEntry[]> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { data, error } = await (client
    .from('activity_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit) as any);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    action: row.action,
    source: row.source,
    task_id: row.task_id,
    details: row.details ?? {},
    created_at: row.created_at,
  }));
}

// Work session queries
export async function upsertWorkSession(session: WorkSession): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('work_sessions').upsert(
    {
      id: session.id,
      user_id: userId,
      task_id: session.task_id,
      task_title: session.task_title,
      preset_id: session.preset_id,
      planned_minutes: session.planned_minutes,
      status: session.status,
      segments: session.segments,
      captures: session.captures,
      started_at: session.started_at,
      ended_at: session.ended_at,
      updated_at: session.updated_at,
    },
    { onConflict: 'id' },
  ) as any);

  if (error) throw error;
}

export async function selectWorkSessions(): Promise<WorkSession[]> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { data, error } = await (client
    .from('work_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false }) as any);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    task_id: row.task_id,
    task_title: row.task_title,
    preset_id: row.preset_id,
    planned_minutes: row.planned_minutes,
    status: row.status,
    segments: row.segments ?? [],
    captures: row.captures ?? [],
    started_at: row.started_at,
    ended_at: row.ended_at,
    updated_at: row.updated_at,
  }));
}
