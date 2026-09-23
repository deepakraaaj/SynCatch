import { create } from 'zustand';
import { emitAppEvent, FOCUS_CHANGED_EVENT } from '../../lib/tauri';
import { getElapsedSeconds } from '../../lib/date';
import { getFocusRepository } from './focus-repository';
import { announceLumi } from '../../character/companion-store';
import { COMPANION_LINES } from '../../character/characterMessages';

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
  hudTransparency: 'standard',
};

interface FocusState extends FocusSyncState {
  hydrated: boolean;
  // True when hydration fell back to defaults because loading focus state
  // failed (e.g. a transient network error). Lets callers retry instead of
  // trusting the fallback as a permanent source of truth.
  hydrationFailed: boolean;
  hydrate: () => Promise<void>;
  retryHydration: () => Promise<void>;
  setCurrentMission: (taskId: string | null) => void;
  startSession: (minutes?: number) => void;
  resumeSession: () => void;
  pauseSession: () => void;
  setStatus: (status: FocusStatus) => void;
  resetSession: () => void;
  setHudMode: (mode: HudMode) => void;
  toggleHudMode: () => void;
  toggleHudTransparency: () => void;
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

  async function runHydrate() {
    try {
      const repository = await getFocusRepository();
      const persistedState = await repository.loadState();
      set({ ...persistedState, hydrated: true, hydrationFailed: false });
    } catch (error) {
      console.error('Unable to hydrate focus state', error);
      set({ hydrated: true, hydrationFailed: true });
    }
  }

  return {
    ...DEFAULT_FOCUS_STATE,
    hydrated: false,
    hydrationFailed: false,
    hydrate: async () => {
      if (get().hydrated) {
        return;
      }
      await runHydrate();
    },
    retryHydration: async () => {
      await runHydrate();
    },
    setCurrentMission: (currentMissionId) => {
      const previousMissionId = get().currentMissionId;
      const shouldResetProgress = previousMissionId !== currentMissionId;

      set((state) => ({
        currentMissionId,
        focusSessionStart: shouldResetProgress ? null : state.focusSessionStart,
        focusElapsedSeconds: shouldResetProgress ? 0 : state.focusElapsedSeconds,
        status: shouldResetProgress ? 'idle' : state.status,
      }));
      commitFocusUpdate();
    },
    startSession: (minutes) => {
      const duration = minutes ?? get().focusSessionDuration;

      set({
        focusSessionStart: new Date().toISOString(),
        focusElapsedSeconds: 0,
        focusSessionDuration: duration,
        status: 'locked-in',
      });
      commitFocusUpdate();
      announceLumi('focus', { text: COMPANION_LINES.focusStart });
    },
    resumeSession: () => {
      const currentMissionId = get().currentMissionId;

      if (!currentMissionId || get().focusSessionStart) {
        return;
      }

      set({
        focusSessionStart: new Date().toISOString(),
        status: 'locked-in',
      });
      commitFocusUpdate();
      announceLumi('focus', { text: COMPANION_LINES.focusResume });
    },
    pauseSession: () => {
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
      announceLumi('comfort', { text: COMPANION_LINES.focusPause });
    },
    setStatus: (status) => {
      set({ status });
      commitFocusUpdate();
      if (status === 'drifting') announceLumi('notice', { text: COMPANION_LINES.focusDrift });
    },
    resetSession: () => {
      set((state) => ({
        focusSessionStart: null,
        focusElapsedSeconds: 0,
        status: 'idle',
        manualFocusReset: state.manualFocusReset + 1,
      }));
      commitFocusUpdate();
      announceLumi('idle', { text: COMPANION_LINES.focusReset });
    },
    setHudMode: (hudMode) => {
      if (get().hudMode === hudMode) {
        return;
      }

      set(() => ({
        hudMode,
      }));
      commitFocusUpdate();
    },
    toggleHudMode: () => {
      const nextMode = get().hudMode === 'expanded' ? 'compact' : 'expanded';

      set(() => ({
        hudMode: nextMode,
      }));
      commitFocusUpdate();
    },
    toggleHudTransparency: () => {
      const nextTransparency = get().hudTransparency === 'ghost' ? 'standard' : 'ghost';

      set(() => ({
        hudTransparency: nextTransparency,
      }));
      commitFocusUpdate();
    },
    syncFromExternal: (state) => {
      set({ ...state, hydrated: true, hydrationFailed: false });
    },
  };
});
