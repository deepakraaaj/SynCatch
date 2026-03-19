import { invoke, isTauri } from '@tauri-apps/api/core';

export const TASKS_CHANGED_EVENT = 'missioncontrol://tasks-changed';
export const FOCUS_CHANGED_EVENT = 'missioncontrol://focus-changed';
export const ACTIVITY_CHANGED_EVENT = 'missioncontrol://activity-changed';
export const THEME_CHANGED_EVENT = 'missioncontrol://theme-changed';
export const SETTINGS_CHANGED_EVENT = 'missioncontrol://settings-changed';
export const TOGGLE_HUD_TRANSPARENCY_EVENT = 'missioncontrol://toggle-hud-transparency';
export const SHOW_COMPACT_HUD_EVENT = 'missioncontrol://show-compact-hud';
const HUD_WIDTH = 360;
const HUD_HEIGHT = 78;
export const QUICK_ADD_WIDTH = 540;
export const QUICK_ADD_HEIGHT = 560;
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
    const { LogicalSize } = await import('@tauri-apps/api/dpi');
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const quickAddWindow = await WebviewWindow.getByLabel('quick-add');

    if (quickAddWindow) {
      await quickAddWindow.setSize(new LogicalSize(QUICK_ADD_WIDTH, QUICK_ADD_HEIGHT));
      await quickAddWindow.center();
      await quickAddWindow.show();
      await quickAddWindow.setFocus();
    }

    return;
  }

  window.open(
    '/quick-add.html',
    'missioncontrol-quick-add',
    `width=${QUICK_ADD_WIDTH},height=${QUICK_ADD_HEIGHT}`,
  );
}

export async function showHudWindow() {
  if (isTauriApp()) {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const hudWindow = await WebviewWindow.getByLabel('hud');

    if (hudWindow) {
      await hudWindow.show();
      await hudWindow.unminimize();
      await hudWindow.setFocus();
    }

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
    const { WebviewWindow, getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow');
    let mainWindow = (await getAllWebviewWindows()).find((window) => window.label === 'main');

    if (!mainWindow) {
      const createdWindow = new WebviewWindow('main', {
        url: 'index.html',
        title: 'MissionControl',
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
