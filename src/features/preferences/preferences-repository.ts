import { getSqlDatabase } from '../../lib/database';
import { isTauriApp } from '../../lib/tauri';
import {
  DEFAULT_SETTINGS_SNAPSHOT,
  DEFAULT_THEME_SNAPSHOT,
  type SettingsSnapshot,
  type ThemeSnapshot,
} from './preferences-types';
import { useAuthStore } from '../auth/auth-store';

const THEME_STORAGE_KEY = 'missioncontrol-theme';
const SETTINGS_STORAGE_KEY = 'missioncontrol-settings';
const THEME_PREFERENCE_KEY = 'theme';
const SETTINGS_PREFERENCE_KEY = 'settings';

interface PreferencesRepository {
  loadTheme(): Promise<ThemeSnapshot | null>;
  saveTheme(snapshot: ThemeSnapshot): Promise<void>;
  loadSettings(): Promise<SettingsSnapshot>;
  saveSettings(snapshot: SettingsSnapshot): Promise<void>;
}

function mergeParsedState<T extends object>(raw: string | null, defaults: T): T {
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const candidate =
      parsed && typeof parsed === 'object' && 'state' in parsed
        ? (parsed as { state?: unknown }).state
        : parsed;

    if (!candidate || typeof candidate !== 'object') {
      return defaults;
    }

    return {
      ...defaults,
      ...(candidate as Partial<T>),
    } as T;
  } catch {
    return defaults;
  }
}

class BrowserPreferencesRepository implements PreferencesRepository {
  async loadTheme(): Promise<ThemeSnapshot | null> {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return mergeParsedState(raw, DEFAULT_THEME_SNAPSHOT);
  }

  async saveTheme(snapshot: ThemeSnapshot) {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(snapshot));
  }

  async loadSettings(): Promise<SettingsSnapshot> {
    return mergeParsedState(localStorage.getItem(SETTINGS_STORAGE_KEY), DEFAULT_SETTINGS_SNAPSHOT);
  }

  async saveSettings(snapshot: SettingsSnapshot) {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(snapshot));
  }
}

class SqlPreferencesRepository implements PreferencesRepository {
  private async loadPreferenceValue(key: string): Promise<string | null> {
    const db = await getSqlDatabase();
    const rows = await db.select<{ value: string }>(
      'SELECT value FROM app_preferences WHERE key = ? LIMIT 1',
      [key],
    );
    return rows[0]?.value ?? null;
  }

  private async loadPreference<T extends object>(key: string, defaults: T): Promise<T | null> {
    const value = await this.loadPreferenceValue(key);

    if (!value) {
      return null;
    }

    return mergeParsedState(value, defaults);
  }

  private async savePreference<T extends object>(key: string, snapshot: T): Promise<void> {
    const db = await getSqlDatabase();
    const timestamp = new Date().toISOString();

    await db.execute(
      `INSERT INTO app_preferences (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [key, JSON.stringify(snapshot), timestamp],
    );
  }

  async loadTheme(): Promise<ThemeSnapshot | null> {
    return this.loadPreference<ThemeSnapshot>(THEME_PREFERENCE_KEY, DEFAULT_THEME_SNAPSHOT);
  }

  async saveTheme(snapshot: ThemeSnapshot) {
    await this.savePreference(THEME_PREFERENCE_KEY, snapshot);
  }

  async loadSettings(): Promise<SettingsSnapshot> {
    return (
      (await this.loadPreference<SettingsSnapshot>(
        SETTINGS_PREFERENCE_KEY,
        DEFAULT_SETTINGS_SNAPSHOT,
      )) ?? DEFAULT_SETTINGS_SNAPSHOT
    );
  }

  async saveSettings(snapshot: SettingsSnapshot) {
    await this.savePreference(SETTINGS_PREFERENCE_KEY, snapshot);
  }
}

class SupabasePreferencesRepository implements PreferencesRepository {
  async loadTheme(): Promise<ThemeSnapshot | null> {
    const { selectPreference } = await import('../../lib/supabase');
    const value = await selectPreference('theme');
    if (!value) return null;
    return JSON.parse(value) as ThemeSnapshot;
  }

  async saveTheme(snapshot: ThemeSnapshot) {
    const { upsertPreference } = await import('../../lib/supabase');
    await upsertPreference('theme', snapshot);
  }

  async loadSettings(): Promise<SettingsSnapshot> {
    const { selectPreference } = await import('../../lib/supabase');
    const value = await selectPreference('settings');
    if (!value) return DEFAULT_SETTINGS_SNAPSHOT;
    return JSON.parse(value) as SettingsSnapshot;
  }

  async saveSettings(snapshot: SettingsSnapshot) {
    const { upsertPreference } = await import('../../lib/supabase');
    await upsertPreference('settings', snapshot);
  }
}

let repositoryPromise: Promise<PreferencesRepository> | undefined;

const SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL);

export function getPreferencesRepository(): Promise<PreferencesRepository> {
  if (!repositoryPromise) {
    repositoryPromise = Promise.resolve(
      SUPABASE_CONFIGURED && !useAuthStore.getState().localMode
        ? new SupabasePreferencesRepository()
        : isTauriApp()
          ? new SqlPreferencesRepository()
          : new BrowserPreferencesRepository(),
    );
  }

  return repositoryPromise;
}
