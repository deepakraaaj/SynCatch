import { create } from 'zustand';
import { sortCollaborators } from './collaborator-helpers';
import { getCollaboratorRepository } from './collaborator-repository';
import type { Collaborator, CollaboratorDraft } from './collaborator-types';

// Legacy roster key from the old CollaborationView (localStorage list of user IDs).
const LEGACY_ROSTER_KEY = 'missioncontrol-team-collaborator-ids';
const LEGACY_MIGRATED_KEY = 'missioncontrol-collaborators-migrated';

interface CollaboratorStore {
  collaborators: Collaborator[];
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  addCollaborator: (draft: CollaboratorDraft) => Promise<Collaborator | null>;
  removeCollaborator: (collaboratorId: string) => Promise<void>;
}

async function migrateLegacyRoster(
  existing: Collaborator[],
  add: (draft: CollaboratorDraft) => Promise<Collaborator | null>,
) {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(LEGACY_MIGRATED_KEY)) return;

  try {
    const raw = window.localStorage.getItem(LEGACY_ROSTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const ids = Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
        : [];
      const known = new Set(existing.map((c) => c.user_id));
      for (const userId of ids) {
        if (!known.has(userId)) {
          await add({ user_id: userId });
          known.add(userId);
        }
      }
    }
  } catch {
    // best-effort; never block hydration on a bad legacy blob
  } finally {
    window.localStorage.setItem(LEGACY_MIGRATED_KEY, '1');
  }
}

export const useCollaboratorStore = create<CollaboratorStore>((set, get) => ({
  collaborators: [],
  hydrated: false,
  loading: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated || get().loading) return;
    set({ loading: true, error: null });
    try {
      const repository = await getCollaboratorRepository();
      let collaborators = sortCollaborators(await repository.listCollaborators());

      await migrateLegacyRoster(collaborators, async (draft) => {
        const created = await repository.createCollaborator(draft);
        return created;
      });

      collaborators = sortCollaborators(await repository.listCollaborators());
      set({ collaborators, hydrated: true, loading: false });
    } catch (error) {
      set({
        hydrated: true,
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load collaborators',
      });
    }
  },

  refresh: async () => {
    try {
      const repository = await getCollaboratorRepository();
      const collaborators = sortCollaborators(await repository.listCollaborators());
      set({ collaborators, hydrated: true });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to refresh collaborators' });
    }
  },

  addCollaborator: async (draft) => {
    const userId = draft.user_id.trim();
    if (!userId) return null;
    const repository = await getCollaboratorRepository();
    const collaborator = await repository.createCollaborator({ ...draft, user_id: userId });
    set((state) => {
      const without = state.collaborators.filter((c) => c.user_id !== collaborator.user_id);
      return { collaborators: sortCollaborators([collaborator, ...without]) };
    });
    return collaborator;
  },

  removeCollaborator: async (collaboratorId) => {
    const repository = await getCollaboratorRepository();
    await repository.deleteCollaborator(collaboratorId);
    set((state) => ({
      collaborators: state.collaborators.filter((c) => c.id !== collaboratorId),
    }));
  },
}));
