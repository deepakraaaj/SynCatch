import type { ThemeId } from '../themes/themes';

export interface ThemeSnapshot {
  themeId: ThemeId;
}

export type SyncMode = 'local' | 'cloud';
export type SidebarPinnedAppId =
  | 'dashboard'
  | 'focus'
  | 'missions'
  | 'roadmap'
  | 'today'
  | 'calendar'
  | 'challenges'
  | 'tasks'
  | 'history'
  | 'insights'
  | 'review'
  | 'journal'
  | 'notes'
  | 'loved-ones'
  | 'assistant'
  | 'settings'
  | 'projects'
  | 'crm'
  | 'problems'
  | 'products'
  | 'manifest';

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
  sidebarPinnedApps: ['dashboard', 'tasks', 'missions', 'projects', 'calendar', 'journal', 'notes', 'loved-ones', 'products'],
};
