import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import type { FocusSyncState } from '../features/focus/focus-store';
import { useFocusStore } from '../features/focus/focus-store';
import type { SettingsSnapshot, ThemeSnapshot } from '../features/preferences/preferences-types';
import { useSettingsStore } from '../features/settings/settings-store';
import { useTaskStore } from '../features/tasks/task-store';
import { useThemeStore } from '../features/themes/theme-store';
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
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const hydrateFocus = useFocusStore((state) => state.hydrate);
  const hydrateTasks = useTaskStore((state) => state.hydrate);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
  }, [themeId]);

  useEffect(() => {
    void Promise.all([hydrateTheme(), hydrateSettings(), hydrateFocus(), hydrateTasks()]);

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
  }, [hydrateFocus, hydrateSettings, hydrateTasks, hydrateTheme]);

  return <>{children}</>;
}
