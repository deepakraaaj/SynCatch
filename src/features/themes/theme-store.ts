import { create } from 'zustand';
import { emitAppEvent, THEME_CHANGED_EVENT } from '../../lib/tauri';
import { getPreferencesRepository } from '../preferences/preferences-repository';
import { DEFAULT_THEME_SNAPSHOT, type ThemeSnapshot } from '../preferences/preferences-types';
import type { ThemeId } from './themes';

interface ThemeState extends ThemeSnapshot {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (themeId: ThemeId) => void;
  syncFromExternal: (state: ThemeSnapshot) => void;
}

async function persistTheme(snapshot: ThemeSnapshot) {
  try {
    const repository = await getPreferencesRepository();
    await repository.saveTheme(snapshot);
  } catch (error) {
    console.error('Unable to persist theme', error);
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  ...DEFAULT_THEME_SNAPSHOT,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) {
      return;
    }

    try {
      const repository = await getPreferencesRepository();
      const snapshot = await repository.loadTheme();
      set({ ...snapshot, hydrated: true });
    } catch (error) {
      console.error('Unable to hydrate theme', error);
      set({ hydrated: true });
    }
  },
  setTheme: (themeId) => {
    set({ themeId });
    const snapshot = { themeId };
    void persistTheme(snapshot);
    void emitAppEvent(THEME_CHANGED_EVENT, snapshot);
  },
  syncFromExternal: (state) => {
    set({ ...state, hydrated: true });
  },
}));
