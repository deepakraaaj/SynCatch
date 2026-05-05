import { getSqlDatabase } from '../../lib/database';
import { isTauriApp } from '../../lib/tauri';
import type { FocusSyncState } from './focus-store';
import { useAuthStore } from '../auth/auth-store';

const FOCUS_STORAGE_KEY = 'missioncontrol-focus';

const DEFAULT_FOCUS_STATE: FocusSyncState = {
  currentMissionId: null,
  focusSessionStart: null,
  focusElapsedSeconds: 0,
  focusSessionDuration: 45,
  focusConfirmationPrompts: 2,
  manualFocusReset: 0,
  status: 'idle',
  hudMode: 'compact',
  hudTransparency: 'standard',
};

interface FocusRepository {
  loadState(): Promise<FocusSyncState>;
  saveState(state: FocusSyncState): Promise<void>;
}

function mergeParsedState(raw: string | null): FocusSyncState {
  if (!raw) {
    return DEFAULT_FOCUS_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const candidate =
      parsed && typeof parsed === 'object' && 'state' in parsed
        ? (parsed as { state?: unknown }).state
        : parsed;

    if (!candidate || typeof candidate !== 'object') {
      return DEFAULT_FOCUS_STATE;
    }

    return {
      ...DEFAULT_FOCUS_STATE,
      ...(candidate as Partial<FocusSyncState>),
    };
  } catch {
    return DEFAULT_FOCUS_STATE;
  }
}

class BrowserFocusRepository implements FocusRepository {
  async loadState() {
    return mergeParsedState(localStorage.getItem(FOCUS_STORAGE_KEY));
  }

  async saveState(state: FocusSyncState) {
    localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(state));
  }
}

interface SqlFocusRow {
  current_active_mission: string | null;
  focus_session_start_time: string | null;
  focus_elapsed_seconds: number;
  focus_session_duration: number;
  focus_confirmation_prompts: number;
  manual_focus_reset: number;
  status: FocusSyncState['status'];
  hud_mode: FocusSyncState['hudMode'];
  hud_transparency: FocusSyncState['hudTransparency'];
}

class SqlFocusRepository implements FocusRepository {
  private async ensureRow() {
    const db = await getSqlDatabase();
    const timestamp = new Date().toISOString();

    await db.execute(
      `INSERT OR IGNORE INTO focus_state (
        singleton,
        current_active_mission,
        focus_session_start_time,
        focus_elapsed_seconds,
        focus_session_duration,
        focus_confirmation_prompts,
        manual_focus_reset,
        status,
        hud_mode,
        hud_transparency,
        updated_at
      ) VALUES (1, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_FOCUS_STATE.focusElapsedSeconds,
        DEFAULT_FOCUS_STATE.focusSessionDuration,
        DEFAULT_FOCUS_STATE.focusConfirmationPrompts,
        DEFAULT_FOCUS_STATE.manualFocusReset,
        DEFAULT_FOCUS_STATE.status,
        DEFAULT_FOCUS_STATE.hudMode,
        DEFAULT_FOCUS_STATE.hudTransparency,
        timestamp,
      ],
    );
  }

  async loadState() {
    await this.ensureRow();

    const db = await getSqlDatabase();
    const rows = await db.select<SqlFocusRow>(
      `SELECT
         current_active_mission,
         focus_session_start_time,
         focus_elapsed_seconds,
         focus_session_duration,
         focus_confirmation_prompts,
         manual_focus_reset,
         status,
         hud_mode,
         hud_transparency
       FROM focus_state
       WHERE singleton = 1
       LIMIT 1`,
    );
    const row = rows[0];

    if (!row) {
      return DEFAULT_FOCUS_STATE;
    }

    return {
      currentMissionId: row.current_active_mission,
      focusSessionStart: row.focus_session_start_time,
      focusElapsedSeconds: row.focus_elapsed_seconds,
      focusSessionDuration: row.focus_session_duration,
      focusConfirmationPrompts: row.focus_confirmation_prompts,
      manualFocusReset: row.manual_focus_reset,
      status: row.status,
      hudMode: row.hud_mode,
      hudTransparency: row.hud_transparency,
    };
  }

  async saveState(state: FocusSyncState) {
    await this.ensureRow();

    const db = await getSqlDatabase();
    await db.execute(
      `UPDATE focus_state SET
         current_active_mission = ?,
         focus_session_start_time = ?,
         focus_elapsed_seconds = ?,
         focus_session_duration = ?,
         focus_confirmation_prompts = ?,
         manual_focus_reset = ?,
         status = ?,
         hud_mode = ?,
         hud_transparency = ?,
         updated_at = ?
       WHERE singleton = 1`,
      [
        state.currentMissionId,
        state.focusSessionStart,
        state.focusElapsedSeconds,
        state.focusSessionDuration,
        state.focusConfirmationPrompts,
        state.manualFocusReset,
        state.status,
        state.hudMode,
        state.hudTransparency,
        new Date().toISOString(),
      ],
    );
  }
}

class SupabaseFocusRepository implements FocusRepository {
  async loadState() {
    const { selectFocusState } = await import('../../lib/supabase');
    const state = await selectFocusState();
    return state || DEFAULT_FOCUS_STATE;
  }

  async saveState(state: FocusSyncState) {
    const { upsertFocusState } = await import('../../lib/supabase');
    await upsertFocusState(state);
  }
}

let repositoryPromise: Promise<FocusRepository> | undefined;

const SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL);

export function getFocusRepository(): Promise<FocusRepository> {
  if (!repositoryPromise) {
    repositoryPromise = Promise.resolve(
      SUPABASE_CONFIGURED && !useAuthStore.getState().localMode
        ? new SupabaseFocusRepository()
        : isTauriApp()
          ? new SqlFocusRepository()
          : new BrowserFocusRepository(),
    );
  }

  return repositoryPromise;
}
