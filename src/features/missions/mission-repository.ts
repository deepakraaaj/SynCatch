import { isTauriApp } from '../../lib/tauri';
import { getSqlDatabase } from '../../lib/database';
import { hydrateMissionRecord, normalizeMissionDraft, sortMissions } from './mission-helpers';
import type { Mission, MissionDraft } from './mission-types';
import { useAuthStore } from '../auth/auth-store';

const LOCAL_STORAGE_KEY = 'missioncontrol-missions-v1';

interface MissionRepository {
  listMissions(): Promise<Mission[]>;
  createMission(draft: MissionDraft): Promise<Mission>;
  updateMission(mission: Mission): Promise<void>;
  deleteMission(missionId: string): Promise<void>;
}

interface SqlMissionRow {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  objective: string;
  why_it_matters: string;
  definition_of_success: string;
  status: Mission['status'];
  started_at: string | null;
  completed_at: string | null;
  target_date: string | null;
  estimated_hours: number;
  is_pinned: number;
  sort_order: number;
  tags_json: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

function parseTagsJson(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function fromSqlRow(row: SqlMissionRow): Mission {
  return hydrateMissionRecord({
    ...row,
    is_pinned: Boolean(row.is_pinned),
    tags: parseTagsJson(row.tags_json),
  });
}

class BrowserMissionRepository implements MissionRepository {
  private load(): Mission[] {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Mission[];
    return sortMissions(parsed.map(hydrateMissionRecord));
  }

  private save(missions: Mission[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortMissions(missions)));
  }

  async listMissions() {
    return this.load();
  }

  async createMission(draft: MissionDraft) {
    const mission = normalizeMissionDraft(draft);
    this.save([mission, ...this.load()]);
    return mission;
  }

  async updateMission(mission: Mission) {
    const missions = this.load();
    this.save(missions.map((m) => (m.id === mission.id ? mission : m)));
  }

  async deleteMission(missionId: string) {
    this.save(this.load().filter((m) => m.id !== missionId));
  }
}

class SqlMissionRepository implements MissionRepository {
  private async db() {
    return getSqlDatabase();
  }

  async listMissions() {
    const db = await this.db();
    const rows = await db.select<SqlMissionRow>(
      'SELECT * FROM missions ORDER BY is_pinned DESC, sort_order ASC, updated_at DESC',
    );
    return rows.map(fromSqlRow);
  }

  async createMission(draft: MissionDraft) {
    const mission = normalizeMissionDraft(draft);
    const db = await this.db();
    await db.execute(
      `INSERT INTO missions (
        id, title, description, emoji, color,
        objective, why_it_matters, definition_of_success,
        status, started_at, completed_at, target_date,
        estimated_hours, is_pinned, sort_order, tags_json, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mission.id,
        mission.title,
        mission.description,
        mission.emoji,
        mission.color,
        mission.objective,
        mission.why_it_matters,
        mission.definition_of_success,
        mission.status,
        mission.started_at,
        mission.completed_at,
        mission.target_date,
        mission.estimated_hours,
        mission.is_pinned ? 1 : 0,
        mission.sort_order,
        JSON.stringify(mission.tags),
        mission.notes,
        mission.created_at,
        mission.updated_at,
      ],
    );
    return mission;
  }

  async updateMission(mission: Mission) {
    const db = await this.db();
    await db.execute(
      `UPDATE missions SET
        title = ?, description = ?, emoji = ?, color = ?,
        objective = ?, why_it_matters = ?, definition_of_success = ?,
        status = ?, started_at = ?, completed_at = ?, target_date = ?,
        estimated_hours = ?, is_pinned = ?, sort_order = ?,
        tags_json = ?, notes = ?, updated_at = ?
      WHERE id = ?`,
      [
        mission.title,
        mission.description,
        mission.emoji,
        mission.color,
        mission.objective,
        mission.why_it_matters,
        mission.definition_of_success,
        mission.status,
        mission.started_at,
        mission.completed_at,
        mission.target_date,
        mission.estimated_hours,
        mission.is_pinned ? 1 : 0,
        mission.sort_order,
        JSON.stringify(mission.tags),
        mission.notes,
        mission.updated_at,
        mission.id,
      ],
    );
  }

  async deleteMission(missionId: string) {
    const db = await this.db();
    await db.execute('DELETE FROM missions WHERE id = ?', [missionId]);
  }
}

class SupabaseMissionRepository implements MissionRepository {
  async listMissions() {
    const { selectMissionsByUser } = await import('../../lib/supabase');
    return selectMissionsByUser();
  }

  async createMission(draft: MissionDraft) {
    const { insertMission } = await import('../../lib/supabase');
    const mission = normalizeMissionDraft(draft);
    await insertMission(mission);
    return mission;
  }

  async updateMission(mission: Mission) {
    const { updateMission } = await import('../../lib/supabase');
    await updateMission(mission);
  }

  async deleteMission(missionId: string) {
    const { deleteMission } = await import('../../lib/supabase');
    await deleteMission(missionId);
  }
}

let repositoryPromise: Promise<MissionRepository> | null = null;

const SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL);

export function getMissionRepository(): Promise<MissionRepository> {
  repositoryPromise ??= Promise.resolve(
    SUPABASE_CONFIGURED && !useAuthStore.getState().localMode
      ? new SupabaseMissionRepository()
      : isTauriApp()
        ? new SqlMissionRepository()
        : new BrowserMissionRepository(),
  );
  return repositoryPromise;
}
