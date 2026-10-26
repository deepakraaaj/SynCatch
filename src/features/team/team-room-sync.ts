import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../lib/auth';
import { useTeamStore } from './team-store';
import { useTeamRoomStore } from './team-room-store';
import {
  TEAM_TABLES,
  type TeamCollection,
  deleteRows,
  loadRowsByIds,
  loadTeamWorkspace,
  serializeRow,
  upsertRows,
} from './team-repository';
import type { TeamPersona, TeamRole, TeamWorkspaceData } from './team-types';

/**
 * Live sync between the team store and Supabase.
 *
 * The store stays the in-memory copy that views read from, but it is never the
 * origin of anything: it is filled from the backend on connect, and every local
 * change is diffed by id and written straight back to the matching table. There
 * is no bundled seed and no localStorage — an empty room renders empty.
 *
 * Teammates hear about changes over Realtime Broadcast, not postgres_changes:
 * after a write lands, the writer announces which ids changed and everyone else
 * refetches those rows. Broadcast never touches the database, so the free
 * instance is not stuck decoding the WAL all day, and the message carries ids
 * only — row data still comes through RLS.
 */

const COLLECTIONS = Object.keys(TEAM_TABLES) as TeamCollection[];

/** Order is persisted for these, so a move is a change even when the item is not. */
const ORDERED: ReadonlySet<TeamCollection> = new Set<TeamCollection>([
  'teamMissions',
  'workflows',
  'diagrams',
]);

let unsubscribeStore: (() => void) | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let currentRoomId: string | null = null;
let applyingRemoteState = false;
let flushTimer: number | null = null;
let pending: Map<TeamCollection, { upsert: Set<string>; remove: Set<string> }> = new Map();

const setStatus = (
  backendSyncStatus: 'offline' | 'loading' | 'syncing' | 'synced' | 'error',
  backendSyncError: string | null = null,
) => useTeamStore.setState({ backendSyncStatus, backendSyncError });

const applyRemote = (updater: () => Partial<ReturnType<typeof useTeamStore.getState>>) => {
  applyingRemoteState = true;
  useTeamStore.setState(updater());
  queueMicrotask(() => {
    applyingRemoteState = false;
  });
};

// ──────────────────────────────────────────
// Personas come from the room's approved members, not from a bundled roster.

const PERSONA_COLORS = ['emerald', 'blue', 'amber', 'purple', 'pink', 'teal'];

const ROOM_ROLE_TO_TEAM_ROLE: Record<string, TeamRole> = {
  owner: 'Tech Lead',
  admin: 'Operations Partner',
  member: 'General Member',
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '??';

async function syncPersonas(roomId: string): Promise<void> {
  const roomStore = useTeamRoomStore.getState();
  await roomStore.loadMembers(roomId);
  const members = useTeamRoomStore.getState().members.filter((m) => m.status === 'approved');

  const personas: TeamPersona[] = members.map((member, index) => ({
    id: member.userId,
    name: member.displayName || member.email || 'Teammate',
    role: ROOM_ROLE_TO_TEAM_ROLE[member.role] ?? 'General Member',
    initials: initialsOf(member.displayName || member.email || '?'),
    color: PERSONA_COLORS[index % PERSONA_COLORS.length],
    email: member.email,
  }));

  const client = getSupabaseClient();
  const { data } = await client.auth.getUser();
  const self = personas.find((persona) => persona.id === data.user?.id);

  useTeamStore.setState({
    personas,
    ...(self ? { activePersona: self } : {}),
  });
}

// ──────────────────────────────────────────
// Diff & flush

const queue = (collection: TeamCollection, kind: 'upsert' | 'remove', id: string) => {
  let entry = pending.get(collection);
  if (!entry) {
    entry = { upsert: new Set(), remove: new Set() };
    pending.set(collection, entry);
  }
  // A row cannot be both created and deleted in one flush; last intent wins.
  if (kind === 'upsert') entry.remove.delete(id);
  else entry.upsert.delete(id);
  entry[kind].add(id);
};

/** Queues every id whose object identity, or persisted position, changed. */
const diffCollection = (
  collection: TeamCollection,
  next: readonly { id: string }[],
  previous: readonly { id: string }[],
) => {
  const before = new Map(previous.map((item, index) => [item.id, { item, index }]));

  next.forEach((item, index) => {
    const prior = before.get(item.id);
    const moved = ORDERED.has(collection) && prior?.index !== index;
    if (!prior || prior.item !== item || moved) queue(collection, 'upsert', item.id);
    before.delete(item.id);
  });

  before.forEach((_, id) => queue(collection, 'remove', id));
};

async function flush(roomId: string): Promise<void> {
  const batch = pending;
  pending = new Map();
  if (batch.size === 0) return;

  setStatus('syncing');
  try {
    const state = useTeamStore.getState();

    // Projects first: every other table has a FK onto them, and deletes last for
    // the same reason.
    const ordered = [...batch.keys()].sort(
      (a, b) => (a === 'teamMissions' ? -1 : 0) - (b === 'teamMissions' ? -1 : 0),
    );

    for (const collection of ordered) {
      const entry = batch.get(collection)!;
      if (entry.upsert.size === 0) continue;
      const items = state[collection] as readonly { id: string }[];
      const rows = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => entry.upsert.has(item.id))
        .map(({ item, index }) => serializeRow(collection, roomId, item, index));
      await upsertRows(collection, roomId, rows);
    }

    for (const collection of [...ordered].reverse()) {
      const entry = batch.get(collection)!;
      if (entry.remove.size === 0) continue;
      await deleteRows(collection, roomId, [...entry.remove]);
    }

    batch.forEach((entry, collection) => {
      const announcement: ChangeAnnouncement = { collection, upserted: [...entry.upsert], removed: [...entry.remove] };
      void realtimeChannel?.send({ type: 'broadcast', event: CHANGE_EVENT, payload: announcement });
    });

    setStatus('synced');
  } catch (error) {
    // Put the batch back so a transient failure retries on the next change.
    batch.forEach((entry, collection) => {
      entry.upsert.forEach((id) => queue(collection, 'upsert', id));
      entry.remove.forEach((id) => queue(collection, 'remove', id));
    });
    const message = error instanceof Error ? error.message : 'Could not save the team workspace.';
    console.error('Team workspace sync failed:', message);
    setStatus('error', message);
  }
}

const scheduleFlush = (roomId: string) => {
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flush(roomId), 500);
};

// ──────────────────────────────────────────
// Realtime

const CHANGE_EVENT = 'rows-changed';

interface ChangeAnnouncement {
  collection: TeamCollection;
  upserted: string[];
  removed: string[];
}

async function applyAnnouncement(roomId: string, { collection, upserted, removed }: ChangeAnnouncement) {
  if (!COLLECTIONS.includes(collection)) return;
  const fresh = (await loadRowsByIds(collection, roomId, upserted)) as readonly { id: string }[];
  if (roomId !== currentRoomId) return;

  applyRemote(() => {
    const gone = new Set(removed);
    const byId = new Map(fresh.map((item) => [item.id, item]));
    const list = (useTeamStore.getState()[collection] as readonly { id: string }[]).filter((item) => !gone.has(item.id));
    const next = list.map((item) => byId.get(item.id) ?? item);
    const added = fresh.filter((item) => !list.some((existing) => existing.id === item.id));
    return { [collection]: [...added, ...next] } as any;
  });
}

function subscribeRealtime(roomId: string): RealtimeChannel {
  const client = getSupabaseClient();
  const channel = client.channel(`team-workspace-${roomId}`);

  channel.on('broadcast', { event: CHANGE_EVENT }, ({ payload }) => {
    if (roomId !== currentRoomId) return;
    applyAnnouncement(roomId, payload as ChangeAnnouncement).catch((error: unknown) => {
      console.error('Team workspace refresh failed:', error instanceof Error ? error.message : error);
    });
  });

  return channel.subscribe();
}

// ──────────────────────────────────────────
// Public API

export async function connectTeamRoomSync(roomId: string): Promise<void> {
  disconnectTeamRoomSync();
  setStatus('loading');
  currentRoomId = roomId;

  try {
    const workspace = await loadTeamWorkspace(roomId);
    applyRemote(() => ({
      ...workspace,
      selectedTeamMissionId:
        useTeamStore.getState().selectedTeamMissionId &&
        workspace.teamMissions.some((m) => m.id === useTeamStore.getState().selectedTeamMissionId)
          ? useTeamStore.getState().selectedTeamMissionId
          : workspace.teamMissions[0]?.id ?? null,
    }));

    await syncPersonas(roomId);
    setStatus('synced');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load the team workspace.';
    console.error('Team workspace load failed:', message);
    setStatus('error', message);
    throw error;
  }

  unsubscribeStore = useTeamStore.subscribe((state, previous) => {
    if (applyingRemoteState || !currentRoomId) return;
    let changed = false;
    for (const collection of COLLECTIONS) {
      const next = state[collection] as readonly { id: string }[];
      const before = previous[collection] as readonly { id: string }[];
      if (next === before) continue;
      diffCollection(collection, next, before);
      changed = true;
    }
    if (changed) scheduleFlush(currentRoomId);
  });

  realtimeChannel = subscribeRealtime(roomId);
}

export function disconnectTeamRoomSync(): void {
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = null;
  pending = new Map();
  if (realtimeChannel) void getSupabaseClient().removeChannel(realtimeChannel);
  realtimeChannel = null;
  currentRoomId = null;

  const cleared: TeamWorkspaceData = {
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
  useTeamStore.setState({
    ...cleared,
    selectedTeamMissionId: null,
    backendSyncStatus: 'offline',
    backendSyncError: null,
  });
}
