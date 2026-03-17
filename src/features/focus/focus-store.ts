import { create } from 'zustand';
import { logActivity } from '../activity/activity-repository';
import type { ActivitySource } from '../activity/activity-repository';
import { emitAppEvent, FOCUS_CHANGED_EVENT } from '../../lib/tauri';
import { getElapsedSeconds } from '../../lib/date';
import { getFocusRepository } from './focus-repository';

export type FocusStatus = 'idle' | 'locked-in' | 'warming-up' | 'drifting';
export type HudMode = 'compact' | 'expanded';
export type HudTransparency = 'standard' | 'ghost';

export interface FocusSyncState {
  currentMissionId: string | null;
  focusSessionStart: string | null;
  focusElapsedSeconds: number;
  focusSessionDuration: number;
  focusConfirmationPrompts: number;
  manualFocusReset: number;
  status: FocusStatus;
  hudMode: HudMode;
  hudTransparency: HudTransparency;
}

const DEFAULT_FOCUS_STATE: FocusSyncState = {
  currentMissionId: null,
  focusSessionStart: null,
  focusElapsedSeconds: 0,
  focusSessionDuration: 45,
  focusConfirmationPrompts: 2,
  manualFocusReset: 0,
  status: 'idle',
  hudMode: 'compact',
  hudTransparency: 'ghost',
};

interface FocusState extends FocusSyncState {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setCurrentMission: (taskId: string | null, source?: ActivitySource) => void;
  startSession: (minutes?: number, source?: ActivitySource) => void;
  resumeSession: (source?: ActivitySource) => void;
  pauseSession: (source?: ActivitySource) => void;
  setStatus: (status: FocusStatus, source?: ActivitySource) => void;
  resetSession: (source?: ActivitySource) => void;
  toggleHudMode: (source?: ActivitySource) => void;
  toggleHudTransparency: (source?: ActivitySource) => void;
  syncFromExternal: (state: FocusSyncState) => void;
}

function toSyncState(
  state: Pick<
    FocusState,
    | 'currentMissionId'
    | 'focusSessionStart'
    | 'focusElapsedSeconds'
    | 'focusSessionDuration'
    | 'focusConfirmationPrompts'
    | 'manualFocusReset'
    | 'status'
    | 'hudMode'
    | 'hudTransparency'
  >,
): FocusSyncState {
  return {
    currentMissionId: state.currentMissionId,
    focusSessionStart: state.focusSessionStart,
    focusElapsedSeconds: state.focusElapsedSeconds,
    focusSessionDuration: state.focusSessionDuration,
    focusConfirmationPrompts: state.focusConfirmationPrompts,
    manualFocusReset: state.manualFocusReset,
    status: state.status,
    hudMode: state.hudMode,
    hudTransparency: state.hudTransparency,
  };
}

async function persistFocusState(state: FocusSyncState) {
  try {
    const repository = await getFocusRepository();
    await repository.saveState(state);
  } catch (error) {
    console.error('Unable to persist focus state', error);
  }
}

export const useFocusStore = create<FocusState>((set, get) => {
  function commitFocusUpdate() {
    const nextState = toSyncState(get());
    void persistFocusState(nextState);
    void emitAppEvent(FOCUS_CHANGED_EVENT, nextState);
  }

  return {
    ...DEFAULT_FOCUS_STATE,
    hydrated: false,
    hydrate: async () => {
      if (get().hydrated) {
        return;
      }

      try {
        const repository = await getFocusRepository();
        const persistedState = await repository.loadState();
        set({ ...persistedState, hydrated: true });
      } catch (error) {
        console.error('Unable to hydrate focus state', error);
        set({ hydrated: true });
      }
    },
    setCurrentMission: (currentMissionId, source = 'system') => {
      const previousMissionId = get().currentMissionId;
      const shouldResetProgress = previousMissionId !== currentMissionId;

      set((state) => ({
        currentMissionId,
        focusSessionStart: shouldResetProgress ? null : state.focusSessionStart,
        focusElapsedSeconds: shouldResetProgress ? 0 : state.focusElapsedSeconds,
        status: shouldResetProgress ? 'idle' : state.status,
      }));
      commitFocusUpdate();

      if (currentMissionId) {
        void logActivity({
          action: 'task_selected',
          source,
          taskId: currentMissionId,
        });
      }
    },
    startSession: (minutes, source = 'system') => {
      const duration = minutes ?? get().focusSessionDuration;
      const currentMissionId = get().currentMissionId;

      set({
        focusSessionStart: new Date().toISOString(),
        focusElapsedSeconds: 0,
        focusSessionDuration: duration,
        status: 'locked-in',
      });
      commitFocusUpdate();

      void logActivity({
        action: 'focus_started',
        source,
        taskId: currentMissionId,
        details: {
          durationMinutes: duration,
        },
      });
    },
    resumeSession: (source = 'system') => {
      const currentMissionId = get().currentMissionId;
      const focusElapsedSeconds = get().focusElapsedSeconds;

      if (!currentMissionId || get().focusSessionStart) {
        return;
      }

      set({
        focusSessionStart: new Date().toISOString(),
        status: 'locked-in',
      });
      commitFocusUpdate();

      void logActivity({
        action: 'focus_resumed',
        source,
        taskId: currentMissionId,
        details: {
          elapsedSeconds: focusElapsedSeconds,
        },
      });
    },
    pauseSession: (source = 'system') => {
      const currentMissionId = get().currentMissionId;
      const focusSessionStart = get().focusSessionStart;

      if (!focusSessionStart) {
        return;
      }

      const elapsedSeconds = getElapsedSeconds(focusSessionStart, get().focusElapsedSeconds);

      set({
        focusSessionStart: null,
        focusElapsedSeconds: elapsedSeconds,
        status: 'idle',
      });
      commitFocusUpdate();

      void logActivity({
        action: 'focus_paused',
        source,
        taskId: currentMissionId,
        details: {
          elapsedSeconds,
        },
      });
    },
    setStatus: (status, source = 'system') => {
      const previousStatus = get().status;
      const currentMissionId = get().currentMissionId;
      set({ status });
      commitFocusUpdate();

      if (previousStatus !== status) {
        void logActivity({
          action: 'focus_status_changed',
          source,
          taskId: currentMissionId,
          details: {
            previousStatus,
            status,
          },
        });
      }
    },
    resetSession: (source = 'system') => {
      const currentMissionId = get().currentMissionId;
      const focusSessionStart = get().focusSessionStart;
      const elapsedSeconds = getElapsedSeconds(focusSessionStart, get().focusElapsedSeconds);
      const hadProgress = elapsedSeconds > 0;

      set((state) => ({
        focusSessionStart: null,
        focusElapsedSeconds: 0,
        status: 'idle',
        manualFocusReset: state.manualFocusReset + 1,
      }));
      commitFocusUpdate();

      if (hadProgress) {
        void logActivity({
          action: 'focus_paused',
          source,
          taskId: currentMissionId,
          details: {
            elapsedSeconds,
            reset: true,
          },
        });
      }
    },
    toggleHudMode: (source = 'system') => {
      const nextMode = get().hudMode === 'expanded' ? 'compact' : 'expanded';

      set(() => ({
        hudMode: nextMode,
      }));
      commitFocusUpdate();

      void logActivity({
        action: 'hud_mode_toggled',
        source,
        taskId: get().currentMissionId,
        details: {
          hudMode: nextMode,
        },
      });
    },
    toggleHudTransparency: (source = 'system') => {
      const nextTransparency = get().hudTransparency === 'ghost' ? 'standard' : 'ghost';

      set(() => ({
        hudTransparency: nextTransparency,
      }));
      commitFocusUpdate();

      void logActivity({
        action: 'hud_transparency_toggled',
        source,
        taskId: get().currentMissionId,
        details: {
          hudTransparency: nextTransparency,
        },
      });
    },
    syncFromExternal: (state) => {
      set({ ...state, hydrated: true });
    },
  };
});
