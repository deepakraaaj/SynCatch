import { getSupabaseClient } from './auth';
import type { Task } from '../features/tasks/task-types';
import type { Mission } from '../features/missions/mission-types';
import type { FocusSyncState } from '../features/focus/focus-store';
import type { ActivityLogEntry } from '../features/activity/activity-repository';
import type { WorkSession } from '../features/sessions/session-types';
import type { Collaborator } from '../features/collaborators/collaborator-types';
import { hydrateCollaboratorRecord } from '../features/collaborators/collaborator-helpers';

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
  const { hydrateTaskRecord } = await import('../features/tasks/task-helpers');

  const { data, error } = await (client
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false }) as any);

  if (error) throw error;

  return (data ?? []).map((row: any) =>
    hydrateTaskRecord({
      id: row.id,
      mission_id: row.mission_id ?? null,
      parent_task_id: row.parent_task_id ?? null,
      title: row.title,
      outcome: row.outcome ?? '',
      next_action: row.next_action ?? '',
      notes: row.notes ?? '',
      completion_note: row.completion_note ?? '',
      status: row.status,
      priority: row.priority,
      lane: row.lane,
      energy: row.energy ?? 'shallow',
      estimated_minutes: row.estimated_minutes,
      due_date: row.due_date ?? null,
      scheduled_for: row.scheduled_for ?? null,
      tags: row.tags ?? [],
      assignee_ids: row.assignee_ids ?? [],
      completed_at: row.completed_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
  );
}

export async function insertTask(task: Task): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('tasks').insert({
    id: task.id,
    user_id: userId,
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
    tags: task.tags,
    assignee_ids: task.assignee_ids,
    completed_at: task.completed_at,
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
      tags: task.tags,
      assignee_ids: task.assignee_ids,
      completed_at: task.completed_at,
      updated_at: task.updated_at,
    })
    .eq('id', task.id)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function deleteTask(taskId: string): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function upsertTask(task: any): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await (client.from('tasks').upsert({
    id: task.id,
    user_id: task.user_id,
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
    tags: task.tags,
    assignee_ids: task.assignee_ids,
    completed_at: task.completed_at,
    created_at: task.created_at,
    updated_at: task.updated_at,
  }, { onConflict: 'id' }) as any);

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

// Mission queries
export async function selectMissionsByUser(): Promise<Mission[]> {
  const userId = await getUserId();
  const client = getSupabaseClient();
  const { hydrateMissionRecord } = await import('../features/missions/mission-helpers');

  const { data, error } = await (client
    .from('missions')
    .select('*')
    .eq('user_id', userId)
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false }) as any);

  if (error) throw error;

  return (data ?? []).map((row: any) =>
    hydrateMissionRecord({
      ...row,
      tags: row.tags ?? [],
    }),
  );
}

export async function insertMission(mission: Mission): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('missions').insert({
    id: mission.id,
    user_id: userId,
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
    is_pinned: mission.is_pinned,
    sort_order: mission.sort_order,
    tags: mission.tags,
    notes: mission.notes,
    created_at: mission.created_at,
    updated_at: mission.updated_at,
  }) as any);

  if (error) throw error;
}

export async function updateMission(mission: Mission): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client
    .from('missions')
    .update({
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
      is_pinned: mission.is_pinned,
      sort_order: mission.sort_order,
      tags: mission.tags,
      notes: mission.notes,
      updated_at: mission.updated_at,
    })
    .eq('id', mission.id)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function deleteMission(missionId: string): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client
    .from('missions')
    .delete()
    .eq('id', missionId)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function upsertMission(mission: any): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await (client.from('missions').upsert({
    id: mission.id,
    user_id: mission.user_id,
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
    is_pinned: mission.is_pinned,
    sort_order: mission.sort_order,
    tags: mission.tags,
    notes: mission.notes,
    created_at: mission.created_at,
    updated_at: mission.updated_at,
  }, { onConflict: 'id' }) as any);

  if (error) throw error;
}

// Collaborator discovery — resolve a person by their EXACT email only.
// There is no directory / name browsing on purpose (see migration 008).
export interface UserProfileResult {
  id: string;
  display_name: string;
  email: string;
}

export async function findUserByEmail(email: string): Promise<UserProfileResult | null> {
  const lookup = email.trim();
  if (!lookup) return null;

  const client = getSupabaseClient();
  const currentUserId = await getUserId();

  const { data, error } = await (client.rpc('find_user_by_email', { lookup_email: lookup }) as any);

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.id) return null;
  // Don't let someone "invite themselves".
  if (row.id === currentUserId) return null;

  return {
    id: row.id,
    display_name: row.display_name ?? '',
    email: row.email ?? '',
  };
}

// Collaborator (roster) queries
export async function selectCollaborators(): Promise<Collaborator[]> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { data, error } = await (client
    .from('collaborators')
    .select('*')
    .eq('user_id', userId)
    .order('display_name', { ascending: true }) as any);

  if (error) throw error;

  return (data ?? []).map((row: any) =>
    hydrateCollaboratorRecord({
      id: row.id,
      user_id: row.collaborator_user_id,
      display_name: row.display_name ?? '',
      email: row.email ?? '',
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
  );
}

export async function insertCollaborator(collaborator: Collaborator): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('collaborators').upsert(
    {
      id: collaborator.id,
      user_id: userId,
      collaborator_user_id: collaborator.user_id,
      display_name: collaborator.display_name,
      email: collaborator.email,
      created_at: collaborator.created_at,
      updated_at: collaborator.updated_at,
    },
    { onConflict: 'user_id,collaborator_user_id' },
  ) as any);

  if (error) throw error;
}

export async function deleteCollaborator(collaboratorId: string): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client
    .from('collaborators')
    .delete()
    .eq('id', collaboratorId)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function upsertCollaborator(collaborator: any): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await (client.from('collaborators').upsert(
    {
      id: collaborator.id,
      user_id: collaborator.owner_user_id ?? collaborator.user_id,
      collaborator_user_id: collaborator.collaborator_user_id ?? collaborator.user_id,
      display_name: collaborator.display_name,
      email: collaborator.email,
      created_at: collaborator.created_at,
      updated_at: collaborator.updated_at,
    },
    { onConflict: 'id' },
  ) as any);

  if (error) throw error;
}

export async function deleteCollaboratorCloud(collaboratorId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await (client.from('collaborators').delete().eq('id', collaboratorId) as any);
  if (error) throw error;
}

// Journal queries
export async function selectJournalEntries(entryDate?: string): Promise<any[]> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  let query = client.from('journal_entries').select('*').eq('user_id', userId);

  if (entryDate) {
    query = query.eq('entry_date', entryDate);
  }

  const { data, error } = await (query
    .order('entry_date', { ascending: false })
    .order('sort_order', { ascending: true }) as any);

  if (error) throw error;
  return data ?? [];
}

export async function insertJournalEntry(entry: any): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('journal_entries').insert({
    id: entry.id,
    user_id: userId,
    kind: entry.kind,
    content: entry.content,
    entry_date: entry.entry_date,
    linked_entry_id: entry.linked_entry_id,
    mission_id: entry.mission_id,
    sort_order: entry.sort_order,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  }) as any);

  if (error) throw error;
}

export async function updateJournalEntry(entry: any): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client
    .from('journal_entries')
    .update({
      kind: entry.kind,
      content: entry.content,
      entry_date: entry.entry_date,
      linked_entry_id: entry.linked_entry_id,
      mission_id: entry.mission_id,
      sort_order: entry.sort_order,
      updated_at: entry.updated_at,
    })
    .eq('id', entry.id)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function deleteJournalEntry(entryId: string): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client
    .from('journal_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function upsertJournalEntry(entry: any): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await (client.from('journal_entries').upsert({
    id: entry.id,
    user_id: entry.user_id,
    kind: entry.kind,
    content: entry.content,
    entry_date: entry.entry_date,
    linked_entry_id: entry.linked_entry_id,
    mission_id: entry.mission_id,
    sort_order: entry.sort_order,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  }, { onConflict: 'id' }) as any);

  if (error) throw error;
}

export async function selectJournalDays(): Promise<any[]> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { data, error } = await (client
    .from('journal_days')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false }) as any);

  if (error) throw error;
  return data ?? [];
}

export async function upsertJournalDay(day: any): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('journal_days').upsert(
    {
      user_id: userId,
      entry_date: day.entry_date,
      mood: day.mood,
      gratitude: day.gratitude,
      created_at: day.created_at,
      updated_at: day.updated_at,
    },
    { onConflict: 'user_id,entry_date' },
  ) as any);

  if (error) throw error;
}

// Note category queries
export async function selectNoteCategoriesByUser(): Promise<any[]> {
  const userId = await getUserId();
  const client = getSupabaseClient();
  const { hydrateNoteCategoryRecord } = await import('../features/notes/note-helpers');

  const { data, error } = await (client
    .from('note_categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true }) as any);

  if (error) throw error;

  return (data ?? []).map((row: any) => hydrateNoteCategoryRecord(row));
}

export async function insertNoteCategory(category: any): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('note_categories').insert({
    id: category.id,
    user_id: userId,
    label: category.label,
    color: category.color,
    icon: category.icon,
    sort_order: category.sort_order,
    created_at: category.created_at,
    updated_at: category.updated_at,
  }) as any);

  if (error) throw error;
}

export async function updateNoteCategory(category: any): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client
    .from('note_categories')
    .update({
      label: category.label,
      color: category.color,
      icon: category.icon,
      sort_order: category.sort_order,
      updated_at: category.updated_at,
    })
    .eq('id', category.id)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function deleteNoteCategory(categoryId: string): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();
  const { GENERAL_CATEGORY_ID } = await import('../features/notes/note-helpers');

  const { error: reassignError } = await (client
    .from('notes')
    .update({ category_id: GENERAL_CATEGORY_ID })
    .eq('category_id', categoryId)
    .eq('user_id', userId) as any);

  if (reassignError) throw reassignError;

  const { error } = await (client
    .from('note_categories')
    .delete()
    .eq('id', categoryId)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function upsertNoteCategory(category: any): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await (client.from('note_categories').upsert({
    id: category.id,
    user_id: category.user_id,
    label: category.label,
    color: category.color,
    icon: category.icon,
    sort_order: category.sort_order,
    created_at: category.created_at,
    updated_at: category.updated_at,
  }, { onConflict: 'id' }) as any);

  if (error) throw error;
}

// Note queries
export async function selectNotesByUser(): Promise<any[]> {
  const userId = await getUserId();
  const client = getSupabaseClient();
  const { hydrateNoteRecord } = await import('../features/notes/note-helpers');

  const { data, error } = await (client
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false }) as any);

  if (error) throw error;

  return (data ?? []).map((row: any) => hydrateNoteRecord(row));
}

export async function insertNote(note: any): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client.from('notes').insert({
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    category_id: note.category_id,
    mission_id: note.mission_id,
    pinned: note.pinned,
    sort_order: note.sort_order,
    created_at: note.created_at,
    updated_at: note.updated_at,
  }) as any);

  if (error) throw error;
}

export async function updateNoteRow(note: any): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client
    .from('notes')
    .update({
      title: note.title,
      content: note.content,
      category_id: note.category_id,
      mission_id: note.mission_id,
      pinned: note.pinned,
      sort_order: note.sort_order,
      updated_at: note.updated_at,
    })
    .eq('id', note.id)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function deleteNoteRow(noteId: string): Promise<void> {
  const userId = await getUserId();
  const client = getSupabaseClient();

  const { error } = await (client
    .from('notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', userId) as any);

  if (error) throw error;
}

export async function upsertNote(note: any): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await (client.from('notes').upsert({
    id: note.id,
    user_id: note.user_id,
    title: note.title,
    content: note.content,
    category_id: note.category_id,
    mission_id: note.mission_id,
    pinned: note.pinned,
    sort_order: note.sort_order,
    created_at: note.created_at,
    updated_at: note.updated_at,
  }, { onConflict: 'id' }) as any);

  if (error) throw error;
}
