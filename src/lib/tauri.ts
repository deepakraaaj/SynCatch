import { invoke, isTauri } from '@tauri-apps/api/core';

export const TASKS_CHANGED_EVENT = 'missioncontrol://tasks-changed';
export const FOCUS_CHANGED_EVENT = 'missioncontrol://focus-changed';
export const ACTIVITY_CHANGED_EVENT = 'missioncontrol://activity-changed';
export const THEME_CHANGED_EVENT = 'missioncontrol://theme-changed';
export const SETTINGS_CHANGED_EVENT = 'missioncontrol://settings-changed';
export const TOGGLE_HUD_TRANSPARENCY_EVENT = 'missioncontrol://toggle-hud-transparency';
export const SHOW_COMPACT_HUD_EVENT = 'missioncontrol://show-compact-hud';
export const SHOW_HUD_TASK_COMPOSER_EVENT = 'missioncontrol://show-hud-task-composer';
export const OPEN_TASK_DETAIL_EVENT = 'missioncontrol://open-task-detail';

export interface OpenTaskDetailPayload {
  taskId: string;
  mode?: 'default' | 'completion-review';
}

const HUD_WIDTH = 360;
const HUD_HEIGHT = 78;
export const QUICK_ADD_WIDTH = 640;
export const QUICK_ADD_HEIGHT = 720;
const MAIN_WINDOW_WIDTH = 1480;
const MAIN_WINDOW_HEIGHT = 940;
const MAIN_WINDOW_MIN_WIDTH = 1180;
const MAIN_WINDOW_MIN_HEIGHT = 760;

function getEventStorageKey(eventName: string) {
  return `missioncontrol:event:${eventName}`;
}

export function isTauriApp() {
  return isTauri();
}

/**
 * Detect if we're running on a mobile platform (Android/iOS).
 * On mobile Tauri, multi-window APIs are not available.
 */
export function isMobilePlatform() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

export async function emitAppEvent<T>(eventName: string, payload: T) {
  if (isTauriApp()) {
    const { emit } = await import('@tauri-apps/api/event');
    await emit(eventName, payload);
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  localStorage.setItem(
    getEventStorageKey(eventName),
    JSON.stringify({ payload, at: Date.now() }),
  );
}

export function subscribeAppEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
) {
  let disposed = false;
  let unlistenTauri: null | (() => void) = null;

  if (isTauriApp()) {
    void import('@tauri-apps/api/event').then(({ listen }) => {
      if (disposed) {
        return;
      }

      void listen<T>(eventName, (event) => {
        handler(event.payload);
      }).then((unlisten) => {
        if (disposed) {
          void unlisten();
          return;
        }

        unlistenTauri = () => {
          void unlisten();
        };
      });
    });

    return () => {
      disposed = true;
      unlistenTauri?.();
    };
  }

  const eventListener = (event: Event) => {
    handler((event as CustomEvent<T>).detail);
  };

  const storageListener = (event: StorageEvent) => {
    if (event.key !== getEventStorageKey(eventName) || !event.newValue) {
      return;
    }

    try {
      const parsed = JSON.parse(event.newValue) as { payload: T };
      handler(parsed.payload);
    } catch {
      // Ignore malformed values from older local state.
    }
  };

  window.addEventListener(eventName, eventListener as EventListener);
  window.addEventListener('storage', storageListener);

  return () => {
    window.removeEventListener(eventName, eventListener as EventListener);
    window.removeEventListener('storage', storageListener);
  };
}

export async function showQuickAddWindow() {
  if (isTauriApp()) {
    // On mobile (Android/iOS), multi-window is not supported.
    // Go straight to the in-app overlay.
    if (isMobilePlatform()) {
      await emitAppEvent('missioncontrol://show-mobile-quick-add', true);
      return;
    }

    const { LogicalSize } = await import('@tauri-apps/api/dpi');
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const quickAddWindow = await WebviewWindow.getByLabel('quick-add');

    if (quickAddWindow) {
      await quickAddWindow.setSize(new LogicalSize(QUICK_ADD_WIDTH, QUICK_ADD_HEIGHT));
      await quickAddWindow.center();
      await quickAddWindow.show();
      await quickAddWindow.setFocus();
      return;
    }

    // Fallback: emit an event to show the Quick Add overlay in the main window
    await emitAppEvent('missioncontrol://show-mobile-quick-add', true);
    return;
  }

  window.open(
    '/quick-add.html',
    'missioncontrol-quick-add',
    `width=${QUICK_ADD_WIDTH},height=${QUICK_ADD_HEIGHT}`,
  );
}

export async function showHudWindow() {
  try {
    const { getCurrentSupabaseSession } = await import('./auth');
    const session = await getCurrentSupabaseSession();

    if (!session) {
      await showMainWindow();
      return;
    }
  } catch (error) {
    console.error('Unable to verify auth session before opening HUD', error);
    await showMainWindow();
    return;
  }

  if (isTauriApp()) {
    // On mobile (Android/iOS), multi-window is not supported.
    // Navigate to the Focus tab instead.
    if (isMobilePlatform()) {
      await emitAppEvent('missioncontrol://show-mobile-focus', true);
      return;
    }

    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const hudWindow = await WebviewWindow.getByLabel('hud');

    if (hudWindow) {
      await hudWindow.show();
      await hudWindow.unminimize();
      await hudWindow.setFocus();
      return;
    }

    // Fallback: the "Focus" tab in the main window is the HUD equivalent
    await emitAppEvent('missioncontrol://show-mobile-focus', true);
    return;
  }

  window.open(
    '/hud.html',
    'missioncontrol-hud',
    `width=${HUD_WIDTH},height=${HUD_HEIGHT}`,
  );
}

export async function hideCurrentWindow() {
  if (isTauriApp()) {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    await WebviewWindow.getCurrent().hide();
    return;
  }

  window.close();
}

export async function quitMissionControl() {
  if (isTauriApp()) {
    await invoke('quit_app');
    return;
  }

  window.close();
}

export async function showMainWindow() {
  if (isTauriApp()) {
    // On mobile, we're already on the main window — no-op.
    if (isMobilePlatform()) {
      return;
    }

    const { WebviewWindow, getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow');
    let mainWindow = (await getAllWebviewWindows()).find((window) => window.label === 'main');

    if (!mainWindow) {
      const createdWindow = new WebviewWindow('main', {
        url: 'index.html',
        title: 'SynCatch',
        width: MAIN_WINDOW_WIDTH,
        height: MAIN_WINDOW_HEIGHT,
        minWidth: MAIN_WINDOW_MIN_WIDTH,
        minHeight: MAIN_WINDOW_MIN_HEIGHT,
        center: true,
        resizable: true,
      });

      await new Promise<void>((resolve, reject) => {
        let settled = false;

        void createdWindow.once('tauri://created', () => {
          if (settled) {
            return;
          }

          settled = true;
          resolve();
        });

        void createdWindow.once('tauri://error', (event) => {
          if (settled) {
            return;
          }

          settled = true;
          reject(event.payload);
        });
      });

      mainWindow = createdWindow;
    }

    if (mainWindow) {
      await mainWindow.show();
      await mainWindow.unminimize();
      await mainWindow.setFocus();
    }

    return;
  }

  window.open('/', 'missioncontrol-main');
}
