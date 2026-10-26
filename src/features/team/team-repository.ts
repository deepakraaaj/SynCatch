import { getSupabaseClient } from '../../lib/auth';
import type {
  Lead,
  ProblemItem,
  TeamChatMessage,
  TeamMissionItem,
  TeamNote,
  TeamTask,
  TeamWorkspaceData,
  VisualDiagram,
  WorkLink,
  WorkflowSOP,
} from './team-types';

/**
 * Supabase access for the team workspace.
 *
 * Every collection is a real table keyed by `room_id`, so a room's workspace is
 * loaded with nine parallel selects and written back one row at a time. Nothing
 * here reads from or falls back to bundled constants — the backend is the only
 * source of truth.
 */

/** Table name per store collection, in dependency order for writes. */
export const TEAM_TABLES = {
  teamMissions: 'team_projects',
  leads: 'team_leads',
  workflows: 'team_workflows',
  workLinks: 'team_work_links',
  problems: 'team_problems',
  diagrams: 'team_diagrams',
  teamNotes: 'team_notes',
  teamTasks: 'team_tasks',
  chatMessages: 'team_chat_messages',
} as const satisfies Record<keyof TeamWorkspaceData, string>;

export type TeamCollection = keyof typeof TEAM_TABLES;

/** Collections whose array order is meaningful and therefore persisted. */
const ORDERED: ReadonlySet<TeamCollection> = new Set<TeamCollection>([
  'teamMissions',
  'workflows',
  'diagrams',
]);

type Row = Record<string, any>;

// ──────────────────────────────────────────
// Row → app type

const toMission = (r: Row): TeamMissionItem => ({
  id: r.id,
  title: r.title,
  description: r.description ?? '',
  iconName: r.icon_name ?? 'Target',
  color: r.color ?? 'emerald',
  objective: r.objective ?? '',
  why_it_matters: r.why_it_matters ?? '',
  definition_of_success: r.definition_of_success ?? '',
  customer_segment: r.customer_segment ?? undefined,
  revenue_model: r.revenue_model ?? undefined,
  status: r.status,
  is_pinned: r.is_pinned ?? false,
  target_date: r.target_date ?? '',
  tags: r.tags ?? [],
  member_ids: r.member_ids ?? undefined,
});

const toLead = (r: Row): Lead => ({
  id: r.id,
  missionId: r.project_id,
  businessName: r.business_name,
  category: r.category,
  ownerName: r.owner_name ?? '',
  phone: r.phone ?? '',
  location: r.location ?? '',
  locationUrl: r.location_url ?? undefined,
  status: r.status,
  notes: r.notes ?? '',
  nextFollowUp: r.next_follow_up ?? undefined,
  pilotStartDate: r.pilot_start_date ?? undefined,
  pilotEndDate: r.pilot_end_date ?? undefined,
  monthlyValue: r.monthly_value ?? undefined,
  createdBy: r.created_by ?? '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toWorkflow = (r: Row): WorkflowSOP => ({
  id: r.id,
  missionId: r.project_id,
  title: r.title,
  description: r.description ?? '',
  targetOutcome: r.target_outcome ?? '',
  steps: r.steps ?? [],
  status: r.status,
});

const toWorkLink = (r: Row): WorkLink => ({
  id: r.id,
  missionId: r.project_id,
  title: r.title,
  url: r.url,
  category: r.category,
  description: r.description ?? undefined,
  addedBy: r.added_by ?? undefined,
  createdAt: r.created_at,
});

const toProblem = (r: Row): ProblemItem => ({
  id: r.id,
  missionId: r.project_id,
  audienceCategory: r.audience_category ?? '',
  title: r.title,
  description: r.description ?? '',
  source: r.source ?? '',
  severity: r.severity,
  status: r.status,
  tags: r.tags ?? [],
  loggedBy: r.logged_by ?? '',
  createdAt: r.created_at,
  solvedNotes: r.solved_notes ?? undefined,
  evidence: r.evidence ?? undefined,
  impact: r.impact ?? undefined,
  nextAction: r.next_action ?? undefined,
  owner: r.owner ?? undefined,
  dueDate: r.due_date ?? undefined,
  occurrenceCount: r.occurrence_count ?? undefined,
});

const toDiagram = (r: Row): VisualDiagram => ({
  id: r.id,
  missionId: r.project_id,
  title: r.title,
  description: r.description ?? '',
  diagramType: r.diagram_type,
  nodes: r.nodes ?? [],
  edges: r.edges ?? [],
  updatedAt: r.updated_at,
});

const toNote = (r: Row): TeamNote => ({
  id: r.id,
  missionId: r.project_id,
  title: r.title,
  content: r.content ?? '',
  category: r.category,
  pinned: r.pinned ?? false,
  author: r.author ?? '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toTask = (r: Row): TeamTask => ({
  id: r.id,
  missionId: r.project_id,
  title: r.title,
  outcome: r.outcome ?? undefined,
  status: r.status,
  priority: r.priority,
  assigneeRole: r.assignee_role,
  dueDate: r.due_date ?? undefined,
  createdAt: r.created_at,
  completedAt: r.completed_at ?? undefined,
});

const toChatMessage = (r: Row): TeamChatMessage => ({
  id: r.id,
  missionId: r.project_id,
  kind: r.kind,
  authorName: r.author_name ?? '',
  body: r.body ?? '',
  refs: r.refs ?? [],
  reactions: r.reactions ?? [],
  parentId: r.parent_id ?? undefined,
  mentions: r.mentions ?? [],
  spawned: r.spawned ?? undefined,
  createdAt: r.created_at,
  editedAt: r.edited_at ?? undefined,
});

const HYDRATORS: { [K in TeamCollection]: (row: Row) => TeamWorkspaceData[K][number] } = {
  teamMissions: toMission,
  leads: toLead,
  workflows: toWorkflow,
  workLinks: toWorkLink,
  problems: toProblem,
  diagrams: toDiagram,
  teamNotes: toNote,
  teamTasks: toTask,
  chatMessages: toChatMessage,
};

// ──────────────────────────────────────────
// App type → row

const base = (roomId: string, item: any, index: number, collection: TeamCollection) => {
  const row: Row = { id: item.id, room_id: roomId };
  if (collection !== 'teamMissions') row.project_id = item.missionId;
  if (ORDERED.has(collection)) row.sort_order = index;
  return row;
};

const SERIALIZERS: Record<TeamCollection, (item: any) => Row> = {
  teamMissions: (m: TeamMissionItem) => ({
    title: m.title,
    description: m.description ?? '',
    icon_name: m.iconName ?? 'Target',
    color: m.color ?? 'emerald',
    objective: m.objective ?? '',
    why_it_matters: m.why_it_matters ?? '',
    definition_of_success: m.definition_of_success ?? '',
    customer_segment: m.customer_segment ?? null,
    revenue_model: m.revenue_model ?? null,
    status: m.status,
    is_pinned: m.is_pinned ?? false,
    target_date: m.target_date ?? '',
    tags: m.tags ?? [],
    member_ids: m.member_ids ?? [],
    updated_at: new Date().toISOString(),
  }),
  leads: (l: Lead) => ({
    business_name: l.businessName,
    category: l.category,
    owner_name: l.ownerName ?? '',
    phone: l.phone ?? '',
    location: l.location ?? '',
    location_url: l.locationUrl ?? null,
    status: l.status,
    notes: l.notes ?? '',
    next_follow_up: l.nextFollowUp ?? null,
    pilot_start_date: l.pilotStartDate ?? null,
    pilot_end_date: l.pilotEndDate ?? null,
    monthly_value: l.monthlyValue ?? null,
    created_by: l.createdBy ?? '',
    created_at: l.createdAt,
    updated_at: l.updatedAt ?? new Date().toISOString(),
  }),
  workflows: (w: WorkflowSOP) => ({
    title: w.title,
    description: w.description ?? '',
    target_outcome: w.targetOutcome ?? '',
    steps: w.steps ?? [],
    status: w.status,
    updated_at: new Date().toISOString(),
  }),
  workLinks: (w: WorkLink) => ({
    title: w.title,
    url: w.url,
    category: w.category,
    description: w.description ?? null,
    added_by: w.addedBy ?? null,
    created_at: w.createdAt,
  }),
  problems: (p: ProblemItem) => ({
    audience_category: p.audienceCategory ?? '',
    title: p.title,
    description: p.description ?? '',
    source: p.source ?? '',
    severity: p.severity,
    status: p.status,
    tags: p.tags ?? [],
    logged_by: p.loggedBy ?? '',
    solved_notes: p.solvedNotes ?? null,
    evidence: p.evidence ?? null,
    impact: p.impact ?? null,
    next_action: p.nextAction ?? null,
    owner: p.owner ?? null,
    due_date: p.dueDate ?? null,
    occurrence_count: p.occurrenceCount ?? null,
    created_at: p.createdAt,
    updated_at: new Date().toISOString(),
  }),
  diagrams: (d: VisualDiagram) => ({
    title: d.title,
    description: d.description ?? '',
    diagram_type: d.diagramType,
    nodes: d.nodes ?? [],
    edges: d.edges ?? [],
    updated_at: d.updatedAt ?? new Date().toISOString(),
  }),
  teamNotes: (n: TeamNote) => ({
    title: n.title,
    content: n.content ?? '',
    category: n.category,
    pinned: n.pinned ?? false,
    author: n.author ?? '',
    created_at: n.createdAt,
    updated_at: n.updatedAt ?? new Date().toISOString(),
  }),
  teamTasks: (t: TeamTask) => ({
    title: t.title,
    outcome: t.outcome ?? null,
    status: t.status,
    priority: t.priority,
    assignee_role: t.assigneeRole,
    due_date: t.dueDate ?? null,
    created_at: t.createdAt,
    completed_at: t.completedAt ?? null,
  }),
  chatMessages: (c: TeamChatMessage) => ({
    kind: c.kind,
    author_name: c.authorName ?? '',
    body: c.body ?? '',
    refs: c.refs ?? [],
    reactions: c.reactions ?? [],
    parent_id: c.parentId ?? null,
    mentions: c.mentions ?? [],
    spawned: c.spawned ?? null,
    created_at: c.createdAt,
    edited_at: c.editedAt ?? null,
  }),
};

export const serializeRow = (
  collection: TeamCollection,
  roomId: string,
  item: any,
  index: number,
): Row => ({
  ...base(roomId, item, index, collection),
  ...SERIALIZERS[collection](item),
});

// ──────────────────────────────────────────
// Reads

const EMPTY: TeamWorkspaceData = {
  teamMissions: [],
  leads: [],
  workflows: [],
  workLinks: [],
  problems: [],
  diagrams: [],
  teamNotes: [],
  teamTasks: [],
  chatMessages: [],
};

/** Per-collection ordering, so what the user sees is stable across reloads. */
const ORDER_BY: Record<TeamCollection, { column: string; ascending: boolean }> = {
  teamMissions: { column: 'sort_order', ascending: true },
  leads: { column: 'updated_at', ascending: false },
  workflows: { column: 'sort_order', ascending: true },
  workLinks: { column: 'created_at', ascending: false },
  problems: { column: 'created_at', ascending: false },
  diagrams: { column: 'sort_order', ascending: true },
  teamNotes: { column: 'updated_at', ascending: false },
  teamTasks: { column: 'created_at', ascending: false },
  chatMessages: { column: 'created_at', ascending: true },
};

/** Loads every collection for a room in parallel. */
export async function loadTeamWorkspace(roomId: string): Promise<TeamWorkspaceData> {
  const client = getSupabaseClient();
  const collections = Object.keys(TEAM_TABLES) as TeamCollection[];

  const results = await Promise.all(
    collections.map(async (collection) => {
      const order = ORDER_BY[collection];
      const { data, error } = await (client
        .from(TEAM_TABLES[collection])
        .select('*')
        .eq('room_id', roomId)
        .order(order.column, { ascending: order.ascending }) as any);
      if (error) throw error;
      return [collection, (data ?? []).map(HYDRATORS[collection] as (row: Row) => any)] as const;
    }),
  );

  return { ...EMPTY, ...Object.fromEntries(results) } as TeamWorkspaceData;
}

/** Refetches rows a teammate announced over broadcast, as app types. */
export async function loadRowsByIds<K extends TeamCollection>(
  collection: K,
  roomId: string,
  ids: string[],
): Promise<TeamWorkspaceData[K]> {
  if (ids.length === 0) return [] as unknown as TeamWorkspaceData[K];
  const client = getSupabaseClient();
  const { data, error } = await (client
    .from(TEAM_TABLES[collection])
    .select('*')
    .eq('room_id', roomId)
    .in('id', ids) as any);
  if (error) throw error;
  return (data ?? []).map(HYDRATORS[collection] as (row: Row) => any) as TeamWorkspaceData[K];
}

// ──────────────────────────────────────────
// Writes

export async function upsertRows(
  collection: TeamCollection,
  roomId: string,
  rows: Row[],
): Promise<void> {
  if (rows.length === 0) return;
  const client = getSupabaseClient();
  const { error } = await (client
    .from(TEAM_TABLES[collection])
    .upsert(rows, { onConflict: 'id' }) as any);
  if (error) throw error;
}

export async function deleteRows(
  collection: TeamCollection,
  roomId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const client = getSupabaseClient();
  const { error } = await (client
    .from(TEAM_TABLES[collection])
    .delete()
    .eq('room_id', roomId)
    .in('id', ids) as any);
  if (error) throw error;
}

/**
 * Populates a room with the turf booking workspace. The content itself lives in
 * the `seed_turf_workspace` migration, never in the client bundle.
 */
export async function seedTurfWorkspace(roomId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await (client.rpc('seed_turf_workspace', { target_room: roomId }) as any);
  if (error) throw error;
}
