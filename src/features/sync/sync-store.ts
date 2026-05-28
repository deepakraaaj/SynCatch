import { create } from 'zustand';
import { syncEngine, type SyncStatus } from '../../lib/sync-engine';

interface SyncStore {
  pendingCount: number;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  lastError: string | null;
  syncNow: () => Promise<void>;
  _update: (status: SyncStatus) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  pendingCount: 0,
  lastSyncedAt: null,
  isSyncing: false,
  lastError: null,

  syncNow: async () => {
    await syncEngine.flush();
  },

  _update: (status: SyncStatus) => {
    set({
      pendingCount: status.pendingCount,
      lastSyncedAt: status.lastSyncedAt,
      isSyncing: status.isSyncing,
      lastError: status.lastError,
    });
  },
}));
