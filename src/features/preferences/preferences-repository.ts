import { getSqlDatabase } from '../../lib/database';
import { isTauriApp } from '../../lib/tauri';
import {
  DEFAULT_SETTINGS_SNAPSHOT,
  DEFAULT_THEME_SNAPSHOT,
  type SettingsSnapshot,
  type ThemeSnapshot,
} from './preferences-types';

const THEME_STORAGE_KEY = 'missioncontrol-theme';
const SETTINGS_STORAGE_KEY = 'missioncontrol-settings';
const THEME_PREFERENCE_KEY = 'theme';
const SETTINGS_PREFERENCE_KEY = 'settings';

interface PreferencesRepository {
  loadTheme(): Promise<ThemeSnapshot>;
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
  async loadTheme(): Promise<ThemeSnapshot> {
    return mergeParsedState(localStorage.getItem(THEME_STORAGE_KEY), DEFAULT_THEME_SNAPSHOT);
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
  private async loadPreference<T extends object>(key: string, defaults: T): Promise<T> {
    const db = await getSqlDatabase();
    const rows = await db.select<{ value: string }>(
      'SELECT value FROM app_preferences WHERE key = ? LIMIT 1',
      [key],
    );
    const value = rows[0]?.value;

    return mergeParsedState(value ?? null, defaults);
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

  async loadTheme(): Promise<ThemeSnapshot> {
    return this.loadPreference<ThemeSnapshot>(THEME_PREFERENCE_KEY, DEFAULT_THEME_SNAPSHOT);
  }

  async saveTheme(snapshot: ThemeSnapshot) {
    await this.savePreference(THEME_PREFERENCE_KEY, snapshot);
  }

  async loadSettings(): Promise<SettingsSnapshot> {
    return this.loadPreference<SettingsSnapshot>(
      SETTINGS_PREFERENCE_KEY,
      DEFAULT_SETTINGS_SNAPSHOT,
    );
  }

  async saveSettings(snapshot: SettingsSnapshot) {
    await this.savePreference(SETTINGS_PREFERENCE_KEY, snapshot);
  }
}

let repositoryPromise: Promise<PreferencesRepository> | undefined;

export function getPreferencesRepository(): Promise<PreferencesRepository> {
  if (!repositoryPromise) {
    repositoryPromise = Promise.resolve(
      isTauriApp() ? new SqlPreferencesRepository() : new BrowserPreferencesRepository(),
    );
  }

  return repositoryPromise;
}
