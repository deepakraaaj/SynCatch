import { isTauriApp } from './tauri';
import { useAuthStore } from '../features/auth/auth-store';

export async function enqueueSync(
  tableName: string,
  rowId: string,
  operation: 'upsert' | 'delete',
  payload: Record<string, unknown>,
): Promise<void> {
  // Only queue syncs in Tauri apps when not in local-only mode
  if (!isTauriApp()) return;

  const { localMode } = useAuthStore.getState();
  if (localMode) return;

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    const outboxId = `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();

    await invoke('plugin:sql|execute', {
      database: 'sqlite:mission-control.db',
      query: `
        INSERT INTO sync_outbox (id, table_name, row_id, operation, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      values: [
        outboxId,
        tableName,
        rowId,
        operation,
        JSON.stringify(payload),
        now,
      ],
    });
  } catch (error) {
    console.error('Failed to enqueue sync:', error);
    // Silently swallow errors so sync failures don't corrupt the main write path
  }
}
