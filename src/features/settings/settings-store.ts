import { create } from 'zustand';
import { getAutostartEnabled, setAutostartEnabled } from '../../lib/autostart';
import { emitAppEvent, SETTINGS_CHANGED_EVENT } from '../../lib/tauri';
import { getPreferencesRepository } from '../preferences/preferences-repository';
import {
  DEFAULT_SETTINGS_SNAPSHOT,
  type SidebarPinnedAppId,
  type SyncMode,
  type SettingsSnapshot,
} from '../preferences/preferences-types';
import { showErrorToast, showSuccessToast } from '../toasts/toast-store';

const CALENDAR_DEFAULT_PIN_MIGRATION_KEY = 'missioncontrol-calendar-default-pin-v1';
const LOVED_ONES_DEFAULT_PIN_MIGRATION_KEY = 'missioncontrol-loved-ones-default-pin-v1';
const AI_PROVIDER_STORAGE_KEY = 'missioncontrol-ai-provider';

interface SettingsState extends SettingsSnapshot {
  aiProvider: string;
  aiModel: string;
  hydrated: boolean;
  hydrationFailed: boolean;
  launchAtLoginPending: boolean;
  hydrate: () => Promise<void>;
  retryHydration: () => Promise<void>;
  setReduceMotion: (reduceMotion: boolean) => void;
  setFocusPromptStyle: (style: 'gentle' | 'direct') => void;
  setSyncMode: (mode: SyncMode) => void;
  setLaunchAtLogin: (launchAtLogin: boolean) => Promise<void>;
  toggleSidebarPinnedApp: (appId: SidebarPinnedAppId) => void;
  setAiProvider: (provider: string, model: string) => void;
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

function loadLocalAiPreference(): { aiProvider: string; aiModel: string } {
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_PROVIDER_STORAGE_KEY) ?? '{}') as {
      provider?: unknown;
      model?: unknown;
    };
    return {
      aiProvider: typeof parsed.provider === 'string' ? parsed.provider : '',
      aiModel: typeof parsed.model === 'string' ? parsed.model : '',
    };
  } catch {
    return { aiProvider: '', aiModel: '' };
  }
}

function persistLocalAiPreference(aiProvider: string, aiModel: string) {
  localStorage.setItem(AI_PROVIDER_STORAGE_KEY, JSON.stringify({ provider: aiProvider, model: aiModel }));
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  function getSettingsSnapshot(): SettingsSnapshot {
    return {
      reduceMotion: get().reduceMotion,
      quickAddShortcut: get().quickAddShortcut,
      focusPromptStyle: get().focusPromptStyle,
      syncMode: get().syncMode,
      launchAtLogin: get().launchAtLogin,
      sidebarPinnedApps: get().sidebarPinnedApps,
    };
  }

  function commitSettingsUpdate(snapshot = getSettingsSnapshot()) {
    set(snapshot);

    void persistSettings(snapshot);
    void emitAppEvent(SETTINGS_CHANGED_EVENT, snapshot);
  }

  async function runHydrate() {
    try {
      const repository = await getPreferencesRepository();
      const snapshot = await repository.loadSettings();
      const launchAtLogin = await getAutostartEnabled().catch((error) => {
        console.error('Unable to read launch at login state', error);
        return snapshot.launchAtLogin;
      });
      let nextSnapshot = {
        ...snapshot,
        launchAtLogin,
      };

      // Add Calendar once for existing users. The migration marker means they
      // can still unpin it normally afterward without it returning on reload.
      if (!localStorage.getItem(CALENDAR_DEFAULT_PIN_MIGRATION_KEY)) {
        nextSnapshot = {
          ...nextSnapshot,
          sidebarPinnedApps: nextSnapshot.sidebarPinnedApps.includes('calendar')
            ? nextSnapshot.sidebarPinnedApps
            : [...nextSnapshot.sidebarPinnedApps, 'calendar'],
        };
        localStorage.setItem(CALENDAR_DEFAULT_PIN_MIGRATION_KEY, '1');
        void persistSettings(nextSnapshot);
        void emitAppEvent(SETTINGS_CHANGED_EVENT, nextSnapshot);
      }

      if (!localStorage.getItem(LOVED_ONES_DEFAULT_PIN_MIGRATION_KEY)) {
        nextSnapshot = {
          ...nextSnapshot,
          sidebarPinnedApps: nextSnapshot.sidebarPinnedApps.includes('loved-ones')
            ? nextSnapshot.sidebarPinnedApps
            : [...nextSnapshot.sidebarPinnedApps, 'loved-ones'],
        };
        localStorage.setItem(LOVED_ONES_DEFAULT_PIN_MIGRATION_KEY, '1');
        void persistSettings(nextSnapshot);
        void emitAppEvent(SETTINGS_CHANGED_EVENT, nextSnapshot);
      }

      set({ ...nextSnapshot, ...loadLocalAiPreference(), hydrated: true, hydrationFailed: false });
      if (launchAtLogin !== snapshot.launchAtLogin) {
        void persistSettings(nextSnapshot);
        void emitAppEvent(SETTINGS_CHANGED_EVENT, nextSnapshot);
      }
    } catch (error) {
      console.error('Unable to hydrate settings', error);
      set({ hydrated: true, hydrationFailed: true });
    }
  }

  return {
    ...DEFAULT_SETTINGS_SNAPSHOT,
    ...loadLocalAiPreference(),
    hydrated: false,
    hydrationFailed: false,
    launchAtLoginPending: false,
    hydrate: async () => {
      if (get().hydrated) {
        return;
      }
      await runHydrate();
    },
    retryHydration: async () => {
      await runHydrate();
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
        showSuccessToast(
          launchAtLogin ? 'Launch at login enabled' : 'Launch at login disabled',
          launchAtLogin
            ? 'SynCatch will open automatically when your device starts.'
            : 'SynCatch will stay closed until you launch it yourself.',
        );
      } catch (error) {
        console.error('Unable to update launch at login', error);
        set({ launchAtLogin: previousLaunchAtLogin });
        commitSettingsUpdate();
        showErrorToast(
          'Launch at login update failed',
          error instanceof Error ? error.message : 'The autostart setting could not be changed.',
        );
      } finally {
        set({ launchAtLoginPending: false });
      }
    },
    toggleSidebarPinnedApp: (appId) => {
      const current = get().sidebarPinnedApps;
      const nextPinnedApps = current.includes(appId)
        ? current.filter((id) => id !== appId)
        : [...current, appId];

      set({ sidebarPinnedApps: nextPinnedApps });
      commitSettingsUpdate();
    },
    setAiProvider: (aiProvider, aiModel) => {
      set({ aiProvider, aiModel });
      persistLocalAiPreference(aiProvider, aiModel);
    },
    syncFromExternal: (state) => {
      set({ ...state, ...loadLocalAiPreference(), hydrated: true, hydrationFailed: false, launchAtLoginPending: false });
    },
  };
});
