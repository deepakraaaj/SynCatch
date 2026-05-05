import { create } from 'zustand';
import { sortMissions, deriveCompletedAt, deriveStartedAt } from './mission-helpers';
import { getMissionRepository } from './mission-repository';
import type { Mission, MissionDraft, MissionStatus } from './mission-types';

interface MissionStore {
  missions: Mission[];
  selectedMissionId: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  createMission: (draft: MissionDraft) => Promise<Mission>;
  selectMission: (missionId: string | null) => void;
  saveMission: (mission: Mission) => Promise<void>;
  setMissionStatus: (missionId: string, status: MissionStatus) => Promise<void>;
  pinMission: (missionId: string, pinned: boolean) => Promise<void>;
  deleteMission: (missionId: string) => Promise<void>;
}

export const useMissionStore = create<MissionStore>((set, get) => ({
  missions: [],
  selectedMissionId: null,
  hydrated: false,
  loading: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated || get().loading) return;
    set({ loading: true, error: null });
    try {
      const repo = await getMissionRepository();
      const missions = sortMissions(await repo.listMissions());
      set({
        missions,
        hydrated: true,
        loading: false,
        selectedMissionId: get().selectedMissionId ?? missions[0]?.id ?? null,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load missions',
      });
    }
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const repo = await getMissionRepository();
      const missions = sortMissions(await repo.listMissions());
      const currentId = get().selectedMissionId;
      set({
        missions,
        loading: false,
        hydrated: true,
        selectedMissionId: missions.some((m) => m.id === currentId)
          ? currentId
          : missions[0]?.id ?? null,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to refresh missions',
      });
    }
  },

  createMission: async (draft) => {
    const repo = await getMissionRepository();
    const mission = await repo.createMission(draft);
    set((state) => ({
      missions: sortMissions([mission, ...state.missions]),
      selectedMissionId: mission.id,
    }));
    return mission;
  },

  selectMission: (selectedMissionId) => set({ selectedMissionId }),

  saveMission: async (mission) => {
    const repo = await getMissionRepository();
    const updated: Mission = { ...mission, updated_at: new Date().toISOString() };
    await repo.updateMission(updated);
    set((state) => ({
      missions: sortMissions(state.missions.map((m) => (m.id === updated.id ? updated : m))),
    }));
  },

  setMissionStatus: async (missionId, status) => {
    const mission = get().missions.find((m) => m.id === missionId);
    if (!mission || mission.status === status) return;

    const timestamp = new Date().toISOString();
    const updated: Mission = {
      ...mission,
      status,
      started_at: deriveStartedAt(mission.status, status, mission.started_at),
      completed_at: deriveCompletedAt(mission.status, status, mission.completed_at),
      updated_at: timestamp,
    };

    const repo = await getMissionRepository();
    await repo.updateMission(updated);
    set((state) => ({
      missions: sortMissions(state.missions.map((m) => (m.id === missionId ? updated : m))),
    }));
  },

  pinMission: async (missionId, pinned) => {
    const mission = get().missions.find((m) => m.id === missionId);
    if (!mission) return;

    const updated: Mission = {
      ...mission,
      is_pinned: pinned,
      updated_at: new Date().toISOString(),
    };

    const repo = await getMissionRepository();
    await repo.updateMission(updated);
    set((state) => ({
      missions: sortMissions(state.missions.map((m) => (m.id === missionId ? updated : m))),
    }));
  },

  deleteMission: async (missionId) => {
    const repo = await getMissionRepository();
    await repo.deleteMission(missionId);
    set((state) => {
      const missions = state.missions.filter((m) => m.id !== missionId);
      const selectedMissionId =
        state.selectedMissionId === missionId
          ? (missions[0]?.id ?? null)
          : state.selectedMissionId;
      return { missions, selectedMissionId };
    });
  },
}));
