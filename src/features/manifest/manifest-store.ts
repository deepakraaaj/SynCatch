import { create } from 'zustand';
import { useAuthStore } from '../auth/auth-store';

export type ManifestStatus = 'manifesting' | 'manifested' | 'released';

/** One line in the action log or the signs log. `date` is a local YYYY-MM-DD. */
export interface ManifestLogEntry {
  id: string;
  date: string;
  text: string;
  /** How a sign felt when it arrived. Signs only, optional. */
  feeling?: string;
}

export interface Manifestation {
  id: string;
  title: string;
  intention: string;
  startedOn: string;
  targetDate: string | null;
  status: ManifestStatus;
  manifestedOn: string | null;
  /** Vision image as a downscaled JPEG data URL, or null. */
  image: string | null;
  actions: ManifestLogEntry[];
  signs: ManifestLogEntry[];
}

const STORAGE_KEY = 'syncatch-manifestations-v1';
const SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL);

function usesSupabase() {
  return SUPABASE_CONFIGURED && !useAuthStore.getState().localMode;
}

function loadLocalManifestations(): Manifestation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Manifestation[];
  } catch {
    return [];
  }
}

function persistLocal(manifestations: Manifestation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(manifestations));
}

type ManifestStore = {
  manifestations: Manifestation[];
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  saveManifestation: (manifestation: Manifestation) => Promise<void>;
  deleteManifestation: (id: string) => Promise<void>;
};

export const useManifestStore = create<ManifestStore>((set, get) => ({
  manifestations: [],
  hydrated: false,
  loading: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated || get().loading) return;
    set({ loading: true, error: null });
    try {
      if (usesSupabase()) {
        const { selectManifestationsByUser } = await import('../../lib/supabase');
        const manifestations = await selectManifestationsByUser();
        set({ manifestations, hydrated: true, loading: false });
      } else {
        set({ manifestations: loadLocalManifestations(), hydrated: true, loading: false });
      }
    } catch (error) {
      console.error('hydrate manifestations error:', error);
      set({
        loading: false,
        hydrated: true,
        error: error instanceof Error ? error.message : 'Unable to load manifestations',
      });
    }
  },

  saveManifestation: async (manifestation) => {
    const manifestations = get().manifestations.some((item) => item.id === manifestation.id)
      ? get().manifestations.map((item) => (item.id === manifestation.id ? manifestation : item))
      : [manifestation, ...get().manifestations];
    set({ manifestations });
    try {
      if (usesSupabase()) {
        const { upsertManifestation } = await import('../../lib/supabase');
        await upsertManifestation(manifestation);
      } else {
        persistLocal(manifestations);
      }
    } catch (error) {
      console.error('saveManifestation error:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to save manifestation' });
    }
  },

  deleteManifestation: async (id) => {
    const manifestations = get().manifestations.filter((item) => item.id !== id);
    set({ manifestations });
    try {
      if (usesSupabase()) {
        const { deleteManifestationRow } = await import('../../lib/supabase');
        await deleteManifestationRow(id);
      } else {
        persistLocal(manifestations);
      }
    } catch (error) {
      console.error('deleteManifestation error:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete manifestation' });
    }
  },
}));
