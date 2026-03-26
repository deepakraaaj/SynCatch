import { formatMinutes } from '../../lib/date';
import type { Task } from '../tasks/task-types';
import type {
  SessionCaptureKind,
  SessionMetrics,
  SessionPresetId,
  SessionRecoveryState,
  SessionSegment,
  SessionSegmentType,
  WorkSession,
} from './session-types';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

const hourFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
});

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createSessionId() {
  return createId('session');
}

export function createSessionCaptureId() {
  return createId('capture');
}

export function createSessionSegmentId() {
  return createId('segment');
}

export function createWorkSession({
  taskId,
  taskTitle,
  minutes,
  presetId,
  startedAt = new Date().toISOString(),
}: {
  taskId: string;
  taskTitle: string;
  minutes: number;
  presetId: SessionPresetId;
  startedAt?: string;
}): WorkSession {
  return {
    id: createSessionId(),
    task_id: taskId,
    task_title: taskTitle,
    preset_id: presetId,
    planned_minutes: Math.max(5, Math.round(minutes)),
    status: 'running',
    started_at: startedAt,
    ended_at: null,
    updated_at: startedAt,
    segments: [
      {
        id: createSessionSegmentId(),
        type: 'focus',
        started_at: startedAt,
        ended_at: null,
        detail: '',
      },
    ],
    captures: [],
  };
}

export function getOpenSegment(session: WorkSession) {
  return [...session.segments].reverse().find((segment) => segment.ended_at === null) ?? null;
}

function closeOpenSegment(session: WorkSession, endedAt: string) {
  let closed = false;

  return {
    ...session,
    segments: session.segments.map((segment) => {
      if (closed || segment.ended_at !== null) {
        return segment;
      }

      closed = true;
      return {
        ...segment,
        ended_at: endedAt,
      };
    }),
  };
}

function appendSegment(
  session: WorkSession,
  type: SessionSegmentType,
  startedAt: string,
  detail = '',
): WorkSession {
  return {
    ...session,
    segments: [
      ...session.segments,
      {
        id: createSessionSegmentId(),
        type,
        started_at: startedAt,
        ended_at: null,
        detail,
      },
    ],
    updated_at: startedAt,
  };
}

export function addCaptureToSession(
  session: WorkSession,
  kind: SessionCaptureKind,
  content: string,
  createdAt = new Date().toISOString(),
): WorkSession {
  const trimmed = content.trim();

  if (!trimmed) {
    return session;
  }

  return {
    ...session,
    captures: [
      ...session.captures,
      {
        id: createSessionCaptureId(),
        kind,
        content: trimmed,
        created_at: createdAt,
      },
    ],
    updated_at: createdAt,
  };
}

export function pauseWorkSession(
  session: WorkSession,
  type: Exclude<SessionSegmentType, 'focus'>,
  pausedAt = new Date().toISOString(),
  detail = '',
): WorkSession {
  if (session.status !== 'running') {
    return session;
  }

  const openSegment = getOpenSegment(session);

  if (!openSegment || openSegment.type !== 'focus') {
    return session;
  }

  return {
    ...appendSegment(closeOpenSegment(session, pausedAt), type, pausedAt, detail),
    status: 'paused',
    updated_at: pausedAt,
  };
}

export function resumeWorkSession(
  session: WorkSession,
  resumedAt = new Date().toISOString(),
  nextPlannedMinutes = session.planned_minutes,
): WorkSession {
  if (session.status !== 'paused') {
    return session;
  }

  const openSegment = getOpenSegment(session);

  if (!openSegment || openSegment.type === 'focus') {
    return session;
  }

  const reopened = appendSegment(closeOpenSegment(session, resumedAt), 'focus', resumedAt);

  return {
    ...reopened,
    planned_minutes: Math.max(5, Math.round(nextPlannedMinutes)),
    status: 'running',
    updated_at: resumedAt,
  };
}

export function completeWorkSession(
  session: WorkSession,
  completedAt = new Date().toISOString(),
): WorkSession {
  const completed = closeOpenSegment(session, completedAt);

  return {
    ...completed,
    status: 'completed',
    ended_at: completedAt,
    updated_at: completedAt,
  };
}

export function getSegmentDurationSeconds(segment: SessionSegment, now = Date.now()) {
  const startedAt = new Date(segment.started_at).getTime();
  const endedAt = segment.ended_at ? new Date(segment.ended_at).getTime() : now;

  return Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}

export function getSessionMetrics(session: WorkSession, now = Date.now()): SessionMetrics {
  return session.segments.reduce<SessionMetrics>(
    (metrics, segment) => {
      const duration = getSegmentDurationSeconds(segment, now);

      if (segment.type === 'focus') {
        metrics.focus_seconds += duration;
      } else if (segment.type === 'pause') {
        metrics.pause_seconds += duration;
      } else if (segment.type === 'break') {
        metrics.break_seconds += duration;
      } else if (segment.type === 'distraction') {
        metrics.distraction_seconds += duration;
      }

      return metrics;
    },
    {
      focus_seconds: 0,
      pause_seconds: 0,
      break_seconds: 0,
      distraction_seconds: 0,
    },
  );
}

export function getRemainingMinutes(session: WorkSession, now = Date.now()) {
  const focusMinutes = Math.floor(getSessionMetrics(session, now).focus_seconds / 60);
  return Math.max(session.planned_minutes - focusMinutes, 0);
}

export function createRecoveryState(
  session: WorkSession,
  pausedAt = new Date().toISOString(),
  now = Date.now(),
): SessionRecoveryState {
  return {
    session_id: session.id,
    task_id: session.task_id,
    task_title: session.task_title,
    paused_at: pausedAt,
    remaining_minutes: Math.max(5, getRemainingMinutes(session, now)),
  };
}

export function isSameCalendarDay(iso: string, target = new Date()) {
  const date = new Date(iso);

  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

export function isWithinLastDays(iso: string, days: number, now = Date.now()) {
  return now - new Date(iso).getTime() <= days * DAY_IN_MS;
}

export function formatTimeRange(startIso: string, endIso: string | null) {
  const fallbackEnd = endIso ?? startIso;
  return `${timeFormatter.format(new Date(startIso))}–${timeFormatter.format(new Date(fallbackEnd))}`;
}

export function formatDayLabel(iso: string) {
  return dayFormatter.format(new Date(iso));
}

export function formatHourLabel(hourIndex: number) {
  const base = new Date();
  base.setHours(hourIndex, 0, 0, 0);
  return hourFormatter.format(base);
}

export function formatDurationFromSeconds(seconds: number) {
  const roundedMinutes = seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0;
  return formatMinutes(roundedMinutes);
}

export interface TaskHistoryRow {
  taskId: string;
  taskTitle: string;
  totalFocusSeconds: number;
  totalDistractionSeconds: number;
  totalPauseSeconds: number;
  totalBreakSeconds: number;
  sessionCount: number;
  blockerCount: number;
  blockers: string[];
  resources: string[];
  distractions: string[];
  sessionRanges: string[];
  sessions: WorkSession[];
  updatedAt: string;
}

export function buildTaskHistoryRows(sessions: WorkSession[], tasks: Task[], now = Date.now()) {
  const taskTitleById = new Map(tasks.map((task) => [task.id, task.title]));
  const rows = new Map<string, TaskHistoryRow>();

  [...sessions]
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
    .forEach((session) => {
      const metrics = getSessionMetrics(session, now);
      const existing = rows.get(session.task_id);
      const blockers = session.captures
        .filter((capture) => capture.kind === 'blocker')
        .map((capture) => capture.content);
      const resources = session.captures
        .filter((capture) => capture.kind === 'resource')
        .map((capture) => capture.content);
      const distractionEntries = [
        ...session.captures
          .filter((capture) => capture.kind === 'distraction')
          .map((capture) => capture.content),
        ...session.segments
          .filter((segment) => segment.type === 'distraction' && segment.detail.trim().length > 0)
          .map((segment) => segment.detail),
      ];

      const nextRow: TaskHistoryRow = existing
        ? {
            ...existing,
            totalFocusSeconds: existing.totalFocusSeconds + metrics.focus_seconds,
            totalDistractionSeconds: existing.totalDistractionSeconds + metrics.distraction_seconds,
            totalPauseSeconds: existing.totalPauseSeconds + metrics.pause_seconds,
            totalBreakSeconds: existing.totalBreakSeconds + metrics.break_seconds,
            sessionCount: existing.sessionCount + 1,
            blockerCount: existing.blockerCount + blockers.length,
            blockers: [...existing.blockers, ...blockers],
            resources: [...existing.resources, ...resources],
            distractions: [...existing.distractions, ...distractionEntries],
            sessionRanges: [...existing.sessionRanges, formatTimeRange(session.started_at, session.ended_at)],
            sessions: [...existing.sessions, session],
            updatedAt:
              new Date(session.updated_at).getTime() > new Date(existing.updatedAt).getTime()
                ? session.updated_at
                : existing.updatedAt,
          }
        : {
            taskId: session.task_id,
            taskTitle: taskTitleById.get(session.task_id) ?? session.task_title,
            totalFocusSeconds: metrics.focus_seconds,
            totalDistractionSeconds: metrics.distraction_seconds,
            totalPauseSeconds: metrics.pause_seconds,
            totalBreakSeconds: metrics.break_seconds,
            sessionCount: 1,
            blockerCount: blockers.length,
            blockers,
            resources,
            distractions: distractionEntries,
            sessionRanges: [formatTimeRange(session.started_at, session.ended_at)],
            sessions: [session],
            updatedAt: session.updated_at,
          };

      rows.set(session.task_id, nextRow);
    });

  return [...rows.values()].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function getHourlyFocusBuckets(sessions: WorkSession[], now = Date.now()) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: formatHourLabel(hour),
    totalSeconds: 0,
  }));

  sessions.forEach((session) => {
    session.segments.forEach((segment) => {
      if (segment.type !== 'focus') {
        return;
      }

      const duration = getSegmentDurationSeconds(segment, now);
      const hour = new Date(segment.started_at).getHours();
      buckets[hour].totalSeconds += duration;
    });
  });

  return buckets;
}

export function getDistractionPatterns(sessions: WorkSession[]) {
  const counts = new Map<string, number>();

  sessions.forEach((session) => {
    session.captures
      .filter((capture) => capture.kind === 'distraction')
      .forEach((capture) => {
        const key = capture.content.trim();

        if (!key) {
          return;
        }

        counts.set(key, (counts.get(key) ?? 0) + 1);
      });

    session.segments
      .filter((segment) => segment.type === 'distraction')
      .forEach((segment) => {
        const key = segment.detail.trim();

        if (!key) {
          return;
        }

        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
  });

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
}

export function getAverageFocusSessionSeconds(sessions: WorkSession[], now = Date.now()) {
  const focusSessions = sessions
    .map((session) => getSessionMetrics(session, now).focus_seconds)
    .filter((seconds) => seconds > 0);

  if (!focusSessions.length) {
    return 0;
  }

  return Math.round(focusSessions.reduce((sum, seconds) => sum + seconds, 0) / focusSessions.length);
}

export function getTaskSwitchCount(sessions: WorkSession[]) {
  const sorted = [...sessions].sort(
    (left, right) => new Date(left.started_at).getTime() - new Date(right.started_at).getTime(),
  );

  let switches = 0;

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1].task_id !== sorted[index].task_id) {
      switches += 1;
    }
  }

  return switches;
}

export function buildDailySeries(sessions: WorkSession[], days = 7, now = Date.now()) {
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(now - (days - offset - 1) * DAY_IN_MS);
    const label = dayFormatter.format(date);
    const daySessions = sessions.filter((session) => isSameCalendarDay(session.started_at, date));
    const totals = daySessions.reduce(
      (summary, session) => {
        const metrics = getSessionMetrics(session, now);

        return {
          focusSeconds: summary.focusSeconds + metrics.focus_seconds,
          distractionSeconds: summary.distractionSeconds + metrics.distraction_seconds,
          sessions: summary.sessions + 1,
        };
      },
      { focusSeconds: 0, distractionSeconds: 0, sessions: 0 },
    );

    return {
      label,
      focusSeconds: totals.focusSeconds,
      distractionSeconds: totals.distractionSeconds,
      sessions: totals.sessions,
    };
  });
}

export function getTaskEstimationAccuracy(tasks: Task[], sessions: WorkSession[], now = Date.now()) {
  const actualMinutesByTask = new Map<string, number>();

  sessions.forEach((session) => {
    const focusMinutes = Math.round(getSessionMetrics(session, now).focus_seconds / 60);
    actualMinutesByTask.set(session.task_id, (actualMinutesByTask.get(session.task_id) ?? 0) + focusMinutes);
  });

  const comparisons = tasks
    .map((task) => {
      const actual = actualMinutesByTask.get(task.id);

      if (!actual) {
        return null;
      }

      const baseline = Math.max(task.estimated_minutes, actual);
      const accuracy = Math.max(
        0,
        100 - Math.round((Math.abs(actual - task.estimated_minutes) / baseline) * 100),
      );

      return {
        accuracy,
        deltaMinutes: actual - task.estimated_minutes,
      };
    })
    .filter((comparison): comparison is { accuracy: number; deltaMinutes: number } => comparison !== null);

  if (!comparisons.length) {
    return {
      accuracy: 0,
      deltaMinutes: 0,
      sampleSize: 0,
    };
  }

  return {
    accuracy: Math.round(
      comparisons.reduce((sum, comparison) => sum + comparison.accuracy, 0) / comparisons.length,
    ),
    deltaMinutes: Math.round(
      comparisons.reduce((sum, comparison) => sum + comparison.deltaMinutes, 0) / comparisons.length,
    ),
    sampleSize: comparisons.length,
  };
}
