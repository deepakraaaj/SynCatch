import { isTauriApp } from './tauri';

export async function getAutostartEnabled() {
  if (!isTauriApp()) {
    return false;
  }

  const { isEnabled } = await import('@tauri-apps/plugin-autostart');
  return isEnabled();
}

export async function setAutostartEnabled(enabled: boolean) {
  if (!isTauriApp()) {
    return;
  }

  const { disable, enable } = await import('@tauri-apps/plugin-autostart');

  if (enabled) {
    await enable();
    return;
  }

  await disable();
}
