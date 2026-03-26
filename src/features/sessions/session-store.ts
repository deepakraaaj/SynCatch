import { create } from 'zustand';
import {
  addCaptureToSession,
  completeWorkSession,
  createRecoveryState,
  createWorkSession,
  getSessionMetrics,
  pauseWorkSession,
  resumeWorkSession,
} from './session-helpers';
import type { SessionCaptureKind, SessionRecoveryState, SessionSegmentType, WorkSession } from './session-types';

const STORAGE_KEY = 'missioncontrol-smart-sessions-v1';

interface SessionStoreSnapshot {
  sessions: WorkSession[];
  activeSessionId: string | null;
  recovery: SessionRecoveryState | null;
}

interface SessionStore extends SessionStoreSnapshot {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  startSession: (input: {
    taskId: string;
    taskTitle: string;
    minutes: number;
    presetId: WorkSession['preset_id'];
  }) => void;
  pauseActiveSession: (
    type: Exclude<SessionSegmentType, 'focus'>,
    detail?: string,
  ) => void;
  resumeActiveSession: (plannedMinutes?: number) => void;
  completeActiveSession: () => void;
  addCapture: (kind: SessionCaptureKind, content: string) => void;
  dismissRecovery: () => void;
}

const DEFAULT_SNAPSHOT: SessionStoreSnapshot = {
  sessions: [],
  activeSessionId: null,
  recovery: null,
};

function parseSnapshot() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return DEFAULT_SNAPSHOT;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionStoreSnapshot>;
    const sessions = Array.isArray(parsed.sessions) ? (parsed.sessions as WorkSession[]) : [];
    const activeSessionId =
      typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : null;
    const recovery =
      parsed.recovery && typeof parsed.recovery === 'object'
        ? (parsed.recovery as SessionRecoveryState)
        : null;

    return {
      sessions,
      activeSessionId: sessions.some((session) => session.id === activeSessionId)
        ? activeSessionId
        : null,
      recovery,
    };
  } catch {
    return DEFAULT_SNAPSHOT;
  }
}

function persistSnapshot(snapshot: SessionStoreSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function replaceSession(sessions: WorkSession[], nextSession: WorkSession) {
  return sessions.map((session) => (session.id === nextSession.id ? nextSession : session));
}

export const useSessionStore = create<SessionStore>((set, get) => {
  function commit(snapshot?: Partial<SessionStoreSnapshot>) {
    const nextSnapshot: SessionStoreSnapshot = {
      sessions: snapshot?.sessions ?? get().sessions,
      activeSessionId:
        snapshot && 'activeSessionId' in snapshot ? snapshot.activeSessionId ?? null : get().activeSessionId,
      recovery: snapshot && 'recovery' in snapshot ? snapshot.recovery ?? null : get().recovery,
    };

    set(nextSnapshot);
    persistSnapshot(nextSnapshot);
  }

  return {
    ...DEFAULT_SNAPSHOT,
    hydrated: false,
    hydrate: async () => {
      if (get().hydrated) {
        return;
      }

      set({
        ...parseSnapshot(),
        hydrated: true,
      });
    },
    startSession: ({ taskId, taskTitle, minutes, presetId }) => {
      const timestamp = new Date().toISOString();
      const activeSession =
        get().sessions.find((session) => session.id === get().activeSessionId) ?? null;
      const completedActiveSession = activeSession ? completeWorkSession(activeSession, timestamp) : null;
      const baseSessions = completedActiveSession
        ? replaceSession(get().sessions, completedActiveSession)
        : get().sessions;
      const nextSession = createWorkSession({
        taskId,
        taskTitle,
        minutes,
        presetId,
        startedAt: timestamp,
      });

      commit({
        sessions: [...baseSessions, nextSession],
        activeSessionId: nextSession.id,
        recovery: null,
      });
    },
    pauseActiveSession: (type, detail = '') => {
      const activeSession =
        get().sessions.find((session) => session.id === get().activeSessionId) ?? null;

      if (!activeSession) {
        return;
      }

      const timestamp = new Date().toISOString();
      const nextSession = pauseWorkSession(activeSession, type, timestamp, detail);

      commit({
        sessions: replaceSession(get().sessions, nextSession),
        recovery: createRecoveryState(nextSession, timestamp),
      });
    },
    resumeActiveSession: (plannedMinutes) => {
      const activeSession =
        get().sessions.find((session) => session.id === get().activeSessionId) ?? null;

      if (!activeSession) {
        return;
      }

      const focusMinutes = Math.floor(getSessionMetrics(activeSession).focus_seconds / 60);
      const totalPlannedMinutes =
        plannedMinutes === undefined ? activeSession.planned_minutes : Math.max(5, focusMinutes + plannedMinutes);
      const nextSession = resumeWorkSession(activeSession, new Date().toISOString(), totalPlannedMinutes);

      commit({
        sessions: replaceSession(get().sessions, nextSession),
        recovery: null,
      });
    },
    completeActiveSession: () => {
      const activeSession =
        get().sessions.find((session) => session.id === get().activeSessionId) ?? null;

      if (!activeSession) {
        return;
      }

      const nextSession = completeWorkSession(activeSession, new Date().toISOString());

      commit({
        sessions: replaceSession(get().sessions, nextSession),
        activeSessionId: null,
        recovery: null,
      });
    },
    addCapture: (kind, content) => {
      const activeSession =
        get().sessions.find((session) => session.id === get().activeSessionId) ?? null;

      if (!activeSession) {
        return;
      }

      const nextSession = addCaptureToSession(activeSession, kind, content);

      commit({
        sessions: replaceSession(get().sessions, nextSession),
      });
    },
    dismissRecovery: () => {
      commit({
        recovery: null,
      });
    },
  };
});
