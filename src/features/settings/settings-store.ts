import { create } from 'zustand';
import { getAutostartEnabled, setAutostartEnabled } from '../../lib/autostart';
import { emitAppEvent, SETTINGS_CHANGED_EVENT } from '../../lib/tauri';
import { getPreferencesRepository } from '../preferences/preferences-repository';
import {
  DEFAULT_SETTINGS_SNAPSHOT,
  type SyncMode,
  type SettingsSnapshot,
} from '../preferences/preferences-types';

interface SettingsState extends SettingsSnapshot {
  hydrated: boolean;
  launchAtLoginPending: boolean;
  hydrate: () => Promise<void>;
  setReduceMotion: (reduceMotion: boolean) => void;
  setFocusPromptStyle: (style: 'gentle' | 'direct') => void;
  setSyncMode: (mode: SyncMode) => void;
  setLaunchAtLogin: (launchAtLogin: boolean) => Promise<void>;
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
  function getSettingsSnapshot(): SettingsSnapshot {
    return {
      reduceMotion: get().reduceMotion,
      quickAddShortcut: get().quickAddShortcut,
      focusPromptStyle: get().focusPromptStyle,
      syncMode: get().syncMode,
      launchAtLogin: get().launchAtLogin,
    };
  }

  function commitSettingsUpdate(snapshot = getSettingsSnapshot()) {
    set(snapshot);

    void persistSettings(snapshot);
    void emitAppEvent(SETTINGS_CHANGED_EVENT, snapshot);
  }

  return {
    ...DEFAULT_SETTINGS_SNAPSHOT,
    hydrated: false,
    launchAtLoginPending: false,
    hydrate: async () => {
      if (get().hydrated) {
        return;
      }

      try {
        const repository = await getPreferencesRepository();
        const snapshot = await repository.loadSettings();
        const launchAtLogin = await getAutostartEnabled().catch((error) => {
          console.error('Unable to read launch at login state', error);
          return snapshot.launchAtLogin;
        });
        const nextSnapshot = {
          ...snapshot,
          launchAtLogin,
        };

        set({ ...nextSnapshot, hydrated: true });
        if (launchAtLogin !== snapshot.launchAtLogin) {
          void persistSettings(nextSnapshot);
          void emitAppEvent(SETTINGS_CHANGED_EVENT, nextSnapshot);
        }
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
    setLaunchAtLogin: async (launchAtLogin) => {
      const previousLaunchAtLogin = get().launchAtLogin;

      if (previousLaunchAtLogin === launchAtLogin && !get().launchAtLoginPending) {
        return;
      }

      set({ launchAtLogin, launchAtLoginPending: true });
      commitSettingsUpdate();

      try {
        await setAutostartEnabled(launchAtLogin);
      } catch (error) {
        console.error('Unable to update launch at login', error);
        set({ launchAtLogin: previousLaunchAtLogin });
        commitSettingsUpdate();
      } finally {
        set({ launchAtLoginPending: false });
      }
    },
    syncFromExternal: (state) => {
      set({ ...state, hydrated: true, launchAtLoginPending: false });
    },
  };
});
