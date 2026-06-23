import { isTauriApp } from '../../lib/tauri';
import { getSqlDatabase } from '../../lib/database';
import { useAuthStore } from '../auth/auth-store';
import { enqueueSync } from '../../lib/sync-outbox';
import {
  hydrateCollaboratorRecord,
  normalizeCollaboratorDraft,
  sortCollaborators,
} from './collaborator-helpers';
import type { Collaborator, CollaboratorDraft } from './collaborator-types';

const LOCAL_STORAGE_KEY = 'missioncontrol-collaborators-v1';

interface CollaboratorRepository {
  listCollaborators(): Promise<Collaborator[]>;
  createCollaborator(draft: CollaboratorDraft): Promise<Collaborator>;
  deleteCollaborator(collaboratorId: string): Promise<void>;
}

interface SqlCollaboratorRow {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

class BrowserCollaboratorRepository implements CollaboratorRepository {
  private load(): Collaborator[] {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Collaborator[];
      return sortCollaborators(parsed.map(hydrateCollaboratorRecord));
    } catch {
      return [];
    }
  }

  private save(collaborators: Collaborator[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortCollaborators(collaborators)));
  }

  async listCollaborators() {
    return this.load();
  }

  async createCollaborator(draft: CollaboratorDraft) {
    const collaborator = normalizeCollaboratorDraft(draft);
    const existing = this.load();
    if (existing.some((c) => c.user_id === collaborator.user_id)) {
      return existing.find((c) => c.user_id === collaborator.user_id)!;
    }
    this.save([collaborator, ...existing]);
    return collaborator;
  }

  async deleteCollaborator(collaboratorId: string) {
    this.save(this.load().filter((c) => c.id !== collaboratorId));
  }
}

class SqlCollaboratorRepository implements CollaboratorRepository {
  private async db() {
    return getSqlDatabase();
  }

  async listCollaborators() {
    const db = await this.db();
    const rows = await db.select<SqlCollaboratorRow>(
      'SELECT * FROM collaborators ORDER BY display_name ASC, user_id ASC',
    );
    return sortCollaborators(rows.map(hydrateCollaboratorRecord));
  }

  async createCollaborator(draft: CollaboratorDraft) {
    const collaborator = normalizeCollaboratorDraft(draft);
    const db = await this.db();
    // Upsert on user_id so adding the same person twice is a no-op.
    await db.execute(
      `INSERT INTO collaborators (id, user_id, display_name, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         email = excluded.email,
         updated_at = excluded.updated_at`,
      [
        collaborator.id,
        collaborator.user_id,
        collaborator.display_name,
        collaborator.email,
        collaborator.created_at,
        collaborator.updated_at,
      ],
    );
    void enqueueSync('collaborators', collaborator.id, 'upsert', { ...collaborator });
    return collaborator;
  }

  async deleteCollaborator(collaboratorId: string) {
    const db = await this.db();
    await db.execute('DELETE FROM collaborators WHERE id = ?', [collaboratorId]);
    void enqueueSync('collaborators', collaboratorId, 'delete', { id: collaboratorId });
  }
}

class SupabaseCollaboratorRepository implements CollaboratorRepository {
  async listCollaborators() {
    const { selectCollaborators } = await import('../../lib/supabase');
    return selectCollaborators();
  }

  async createCollaborator(draft: CollaboratorDraft) {
    const { insertCollaborator } = await import('../../lib/supabase');
    const collaborator = normalizeCollaboratorDraft(draft);
    await insertCollaborator(collaborator);
    return collaborator;
  }

  async deleteCollaborator(collaboratorId: string) {
    const { deleteCollaborator } = await import('../../lib/supabase');
    await deleteCollaborator(collaboratorId);
  }
}

let repositoryPromise: Promise<CollaboratorRepository> | null = null;

const SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL);

export function getCollaboratorRepository(): Promise<CollaboratorRepository> {
  repositoryPromise ??= Promise.resolve(
    SUPABASE_CONFIGURED && !useAuthStore.getState().localMode
      ? new SupabaseCollaboratorRepository()
      : isTauriApp()
        ? new SqlCollaboratorRepository()
        : new BrowserCollaboratorRepository(),
  );
  return repositoryPromise;
}
