import { create } from 'zustand';
import { isTauriApp } from '../../lib/tauri';
import { emitAppEvent, THEME_CHANGED_EVENT } from '../../lib/tauri';
import { getPreferencesRepository } from '../preferences/preferences-repository';
import { DEFAULT_THEME_SNAPSHOT, type ThemeSnapshot } from '../preferences/preferences-types';
import type { ThemeId } from './themes';

const THEME_CACHE_KEY = 'missioncontrol-theme';

interface ThemeState extends ThemeSnapshot {
  hydrated: boolean;
  hydrating: boolean;
  hydrate: () => Promise<void>;
  setTheme: (themeId: ThemeId) => void;
  syncFromExternal: (state: ThemeSnapshot) => void;
}

function parseThemeSnapshot(raw: string | null): ThemeSnapshot | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const candidate =
      parsed && typeof parsed === 'object' && 'state' in parsed
        ? (parsed as { state?: unknown }).state
        : parsed;

    if (!candidate || typeof candidate !== 'object' || !('themeId' in candidate)) {
      return null;
    }

    const themeId = (candidate as { themeId?: ThemeId }).themeId;
    return themeId ? { themeId } : null;
  } catch {
    return null;
  }
}

function cacheThemeSnapshot(snapshot: ThemeSnapshot) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore local cache write failures.
  }
}

export function readCachedThemeSnapshot() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return parseThemeSnapshot(localStorage.getItem(THEME_CACHE_KEY));
  } catch {
    return null;
  }
}

export function applyThemeToDocument(themeId: ThemeId) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = themeId;
}

export function applyCachedThemeToDocument() {
  const cached = readCachedThemeSnapshot();

  if (cached) {
    applyThemeToDocument(cached.themeId);
  }
}

async function persistTheme(snapshot: ThemeSnapshot) {
  try {
    const repository = await getPreferencesRepository();
    await repository.saveTheme(snapshot);
  } catch (error) {
    console.error('Unable to persist theme', error);
  }
}

const INITIAL_THEME_SNAPSHOT = readCachedThemeSnapshot() ?? DEFAULT_THEME_SNAPSHOT;

export const useThemeStore = create<ThemeState>((set, get) => ({
  ...INITIAL_THEME_SNAPSHOT,
  hydrated: false,
  hydrating: false,
  hydrate: async () => {
    if (get().hydrated || get().hydrating) {
      return;
    }

    const cached = readCachedThemeSnapshot();

    if (cached) {
      set(cached);
      applyThemeToDocument(cached.themeId);
    }

    set({ hydrating: true });

    try {
      let snapshot: ThemeSnapshot | null = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const repository = await getPreferencesRepository();
          snapshot = await repository.loadTheme();
          break;
        } catch (error) {
          if (attempt === 2) {
            throw error;
          }

          await new Promise((resolve) => {
            window.setTimeout(resolve, isTauriApp() ? 160 * (attempt + 1) : 80);
          });
        }
      }

      const nextSnapshot = snapshot ?? cached ?? DEFAULT_THEME_SNAPSHOT;
      const shouldBroadcastSnapshot = !snapshot || snapshot.themeId !== nextSnapshot.themeId;

      if (shouldBroadcastSnapshot) {
        void persistTheme(nextSnapshot);
      }

      cacheThemeSnapshot(nextSnapshot);
      applyThemeToDocument(nextSnapshot.themeId);
      set({ ...nextSnapshot, hydrated: true, hydrating: false });

      if (shouldBroadcastSnapshot) {
        void emitAppEvent(THEME_CHANGED_EVENT, nextSnapshot);
      }
    } catch (error) {
      console.error('Unable to hydrate theme', error);
      const fallbackSnapshot = cached ?? DEFAULT_THEME_SNAPSHOT;
      cacheThemeSnapshot(fallbackSnapshot);
      applyThemeToDocument(fallbackSnapshot.themeId);
      set({ ...fallbackSnapshot, hydrated: true, hydrating: false });
    }
  },
  setTheme: (themeId) => {
    set({ themeId, hydrated: true, hydrating: false });
    const snapshot = { themeId };
    cacheThemeSnapshot(snapshot);
    applyThemeToDocument(themeId);
    void persistTheme(snapshot);
    void emitAppEvent(THEME_CHANGED_EVENT, snapshot);
  },
  syncFromExternal: (state) => {
    cacheThemeSnapshot(state);
    applyThemeToDocument(state.themeId);
    set({ ...state, hydrated: true, hydrating: false });
  },
}));
