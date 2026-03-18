import { create } from 'zustand';
import { emitAppEvent, SETTINGS_CHANGED_EVENT } from '../../lib/tauri';
import { getPreferencesRepository } from '../preferences/preferences-repository';
import {
  DEFAULT_SETTINGS_SNAPSHOT,
  type SyncMode,
  type SettingsSnapshot,
} from '../preferences/preferences-types';

interface SettingsState extends SettingsSnapshot {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setReduceMotion: (reduceMotion: boolean) => void;
  setFocusPromptStyle: (style: 'gentle' | 'direct') => void;
  setSyncMode: (mode: SyncMode) => void;
  syncFromExternal: (state: SettingsSnapshot) => void;
}

async function persistSettings(snapshot: SettingsSnapshot) {
  try {
    const repository = await getPreferencesRepository();
    await repository.saveSettings(snapshot);
  } catch (error) {
    console.error('Unable to persist settings', error);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  function commitSettingsUpdate() {
    const snapshot: SettingsSnapshot = {
      reduceMotion: get().reduceMotion,
      quickAddShortcut: get().quickAddShortcut,
      focusPromptStyle: get().focusPromptStyle,
      syncMode: get().syncMode,
    };

    void persistSettings(snapshot);
    void emitAppEvent(SETTINGS_CHANGED_EVENT, snapshot);
  }

  return {
    ...DEFAULT_SETTINGS_SNAPSHOT,
    hydrated: false,
    hydrate: async () => {
      if (get().hydrated) {
        return;
      }

      try {
        const repository = await getPreferencesRepository();
        const snapshot = await repository.loadSettings();
        set({ ...snapshot, hydrated: true });
      } catch (error) {
        console.error('Unable to hydrate settings', error);
        set({ hydrated: true });
      }
    },
    setReduceMotion: (reduceMotion) => {
      set({ reduceMotion });
      commitSettingsUpdate();
    },
    setFocusPromptStyle: (focusPromptStyle) => {
      set({ focusPromptStyle });
      commitSettingsUpdate();
    },
    setSyncMode: (syncMode) => {
      set({ syncMode });
      commitSettingsUpdate();
    },
    syncFromExternal: (state) => {
      set({ ...state, hydrated: true });
    },
  };
});
