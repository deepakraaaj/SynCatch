import type { ThemeId } from '../themes/themes';

export interface ThemeSnapshot {
  themeId: ThemeId;
}

export type SyncMode = 'local' | 'cloud';
export type SidebarPinnedAppId =
  | 'focus'
  | 'missions'
  | 'roadmap'
  | 'today'
  | 'tasks'
  | 'history'
  | 'insights'
  | 'review'
  | 'journal'
  | 'notes'
  | 'assistant'
  | 'settings';

export interface SettingsSnapshot {
  reduceMotion: boolean;
  quickAddShortcut: string;
  focusPromptStyle: 'gentle' | 'direct';
  syncMode: SyncMode;
  launchAtLogin: boolean;
  sidebarPinnedApps: SidebarPinnedAppId[];
}

export const DEFAULT_THEME_SNAPSHOT: ThemeSnapshot = {
  themeId: 'dark-focus',
};

export const DEFAULT_SETTINGS_SNAPSHOT: SettingsSnapshot = {
  reduceMotion: false,
  quickAddShortcut: 'Ctrl+Shift+Space',
  focusPromptStyle: 'gentle',
  syncMode: 'local',
  launchAtLogin: false,
  sidebarPinnedApps: [],
};
