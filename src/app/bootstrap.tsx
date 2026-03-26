import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import type { FocusSyncState } from '../features/focus/focus-store';
import { useFocusStore } from '../features/focus/focus-store';
import {
  DEFAULT_THEME_SNAPSHOT,
  type SettingsSnapshot,
  type ThemeSnapshot,
} from '../features/preferences/preferences-types';
import { useSessionStore } from '../features/sessions/session-store';
import { useSettingsStore } from '../features/settings/settings-store';
import { useTaskStore } from '../features/tasks/task-store';
import { applyThemeToDocument, useThemeStore } from '../features/themes/theme-store';
import {
  FOCUS_CHANGED_EVENT,
  SETTINGS_CHANGED_EVENT,
  subscribeAppEvent,
  TASKS_CHANGED_EVENT,
  THEME_CHANGED_EVENT,
  TOGGLE_HUD_TRANSPARENCY_EVENT,
} from '../lib/tauri';

export function AppBootstrap({ children }: PropsWithChildren) {
  const themeId = useThemeStore((state) => state.themeId);
  const themeHydrated = useThemeStore((state) => state.hydrated);
  const themeHydrating = useThemeStore((state) => state.hydrating);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const hydrateFocus = useFocusStore((state) => state.hydrate);
  const hydrateSessions = useSessionStore((state) => state.hydrate);
  const hydrateTasks = useTaskStore((state) => state.hydrate);

  useEffect(() => {
    if (
      !themeHydrated &&
      !themeHydrating &&
      themeId === DEFAULT_THEME_SNAPSHOT.themeId
    ) {
      return;
    }

    applyThemeToDocument(themeId);
  }, [themeHydrated, themeHydrating, themeId]);

  useEffect(() => {
    void Promise.all([hydrateTheme(), hydrateSettings(), hydrateFocus(), hydrateSessions(), hydrateTasks()]);

    const unsubscribe = subscribeAppEvent(TASKS_CHANGED_EVENT, () => {
      void useTaskStore.getState().refresh();
    });

    const unsubscribeFocus = subscribeAppEvent(FOCUS_CHANGED_EVENT, (state) => {
      useFocusStore.getState().syncFromExternal(state as FocusSyncState);
    });

    const unsubscribeTheme = subscribeAppEvent(THEME_CHANGED_EVENT, (state) => {
      useThemeStore.getState().syncFromExternal(state as ThemeSnapshot);
    });

    const unsubscribeSettings = subscribeAppEvent(SETTINGS_CHANGED_EVENT, (state) => {
      useSettingsStore.getState().syncFromExternal(state as SettingsSnapshot);
    });

    const unsubscribeHudTransparency = subscribeAppEvent(TOGGLE_HUD_TRANSPARENCY_EVENT, () => {
      useFocusStore.getState().toggleHudTransparency('hud');
    });

    return () => {
      unsubscribe();
      unsubscribeFocus();
      unsubscribeTheme();
      unsubscribeSettings();
      unsubscribeHudTransparency();
    };
  }, [hydrateFocus, hydrateSessions, hydrateSettings, hydrateTasks, hydrateTheme]);

  return <>{children}</>;
}
