import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { startTransition, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Textarea } from '../../components/ui/input';
import { useFocusStore } from '../../features/focus/focus-store';
import {
  buildDailySeries,
  buildTaskHistoryRows,
  formatDurationFromSeconds,
  formatTimeRange,
  getAverageFocusSessionSeconds,
  getDistractionPatterns,
  getHourlyFocusBuckets,
  getRemainingMinutes,
  getSessionMetrics,
  getTaskEstimationAccuracy,
  getTaskSwitchCount,
  isSameCalendarDay,
} from '../../features/sessions/session-helpers';
import { useSessionStore } from '../../features/sessions/session-store';
import {
  CUSTOM_SESSION_MINUTES,
  SESSION_PRESETS,
  type SessionCaptureKind,
  type SessionPresetId,
  type WorkSession,
} from '../../features/sessions/session-types';
import { TaskCreationComposer } from '../../features/tasks/TaskCreationComposer';
import { humanizePriority } from '../../features/tasks/task-helpers';
import { useTaskStore } from '../../features/tasks/task-store';
import type { Task } from '../../features/tasks/task-types';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../lib/date';
import { showHudWindow, showQuickAddWindow } from '../../lib/tauri';

type MainView = 'today' | 'tasks' | 'history' | 'insights' | 'review';

type CaptureState = {
  kind: SessionCaptureKind;
  value: string;
} | null;

const views: Array<{ id: MainView; label: string; caption?: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'history', label: 'History' },
  { id: 'insights', label: 'Insights' },
  { id: 'review', label: 'Review' },
];

const captureOptions: Array<{
  kind: SessionCaptureKind;
  icon: string;
  label: string;
  placeholder: string;
}> = [
  { kind: 'idea', icon: '💡', label: 'Idea', placeholder: 'What hit you?' },
  { kind: 'resource', icon: '🔗', label: 'Resource', placeholder: 'Paste a link' },
  {
    kind: 'distraction',
    icon: '📌',
    label: 'Distraction',
    placeholder: 'What pulled you away?',
  },
  { kind: 'note', icon: '📝', label: 'Note', placeholder: 'Tiny note' },
  { kind: 'blocker', icon: '⚠️', label: 'Blocker', placeholder: 'What is blocking you?' },
  {
    kind: 'follow-up',
    icon: '↗',
    label: 'Follow-up',
    placeholder: 'Create a follow-up task',
  },
];

const zeroMetrics = {
  focus_seconds: 0,
  pause_seconds: 0,
  break_seconds: 0,
  distraction_seconds: 0,
};

const wheelItemWidth = 108;
const wheelGap = 14;
const wheelStep = wheelItemWidth + wheelGap;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatClock(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function priorityValue(priority: Task['priority']) {
  if (priority === 'critical') {
    return 4;
  }

  if (priority === 'high') {
    return 3;
  }

  if (priority === 'normal') {
    return 2;
  }

  return 1;
}

function laneValue(lane: Task['lane']) {
  if (lane === 'now') {
    return 4;
  }

  if (lane === 'next') {
    return 3;
  }

  if (lane === 'inbox') {
    return 2;
  }

  if (lane === 'later') {
    return 1;
  }

  return 0;
}

function matchPreset(minutes: number): SessionPresetId {
  return SESSION_PRESETS.find((preset) => preset.minutes === minutes)?.id ?? 'custom';
}

function describeTask(task: Task) {
  const text = (task.next_action || task.description || task.raw_input || '').trim();

  if (text.length <= 72) {
    return text;
  }

  return `${text.slice(0, 72).trim()}…`;
}

function getTaskTone(task: Task) {
  if (task.priority === 'critical') {
    return 'warning' as const;
  }

  if (task.priority === 'high') {
    return 'accent' as const;
  }

  if (task.status === 'done' || task.lane === 'done') {
    return 'success' as const;
  }

  return 'neutral' as const;
}

function findActiveSession(sessions: WorkSession[], activeSessionId: string | null) {
  return sessions.find((session) => session.id === activeSessionId) ?? null;
}

function getLatestBlockedEntries(sessions: WorkSession[]) {
  const latestBlockerByTask = new Map<string, { content: string; createdAt: number }>();
  const latestFocusByTask = new Map<string, number>();

  sessions.forEach((session) => {
    session.captures
      .filter((capture) => capture.kind === 'blocker')
      .forEach((capture) => {
        const createdAt = new Date(capture.created_at).getTime();
        const previous = latestBlockerByTask.get(session.task_id);

        if (!previous || createdAt > previous.createdAt) {
          latestBlockerByTask.set(session.task_id, {
            content: capture.content,
            createdAt,
          });
        }
      });

    session.segments
      .filter((segment) => segment.type === 'focus')
      .forEach((segment) => {
        const endedAt = new Date(segment.ended_at ?? session.updated_at).getTime();
        latestFocusByTask.set(session.task_id, Math.max(latestFocusByTask.get(session.task_id) ?? 0, endedAt));
      });
  });

  return [...latestBlockerByTask.entries()]
    .filter((entry) => entry[1].createdAt >= (latestFocusByTask.get(entry[0]) ?? 0))
    .map(([taskId, blocker]) => ({
      taskId,
      blocker: blocker.content,
      createdAt: blocker.createdAt,
    }));
}

function getSuggestedTask(tasks: Task[], blockedTaskIds: Set<string>, currentTaskId: string | null) {
  return [...tasks]
    .filter(
      (task) =>
        task.lane !== 'done' &&
        task.status !== 'done' &&
        task.id !== currentTaskId &&
        !blockedTaskIds.has(task.id),
    )
    .sort((left, right) => {
      const score = priorityValue(right.priority) - priorityValue(left.priority);

      if (score !== 0) {
        return score;
      }

      const laneScore = laneValue(right.lane) - laneValue(left.lane);

      if (laneScore !== 0) {
        return laneScore;
      }

      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    })[0] ?? null;
}

function getViewCopy(view: MainView) {
  if (view === 'today') {
    return 'Today';
  }

  if (view === 'tasks') {
    return 'Tasks';
  }

  if (view === 'history') {
    return 'History';
  }

  if (view === 'insights') {
    return 'Insights';
  }

  return 'Review';
}

function NavButton({
  active,
  label,
  caption,
  onClick,
}: {
  active: boolean;
  label: string;
  caption?: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'w-full rounded-[24px] border px-4 py-3 text-left transition-all duration-200',
        active
          ? 'border-accent/30 bg-accent/12 shadow-glow'
          : 'border-transparent bg-panel/38 hover:border-borderSoft/40 hover:bg-panel/56',
      )}
      onClick={onClick}
      type="button"
    >
      <p className="text-xs font-medium text-text-primary">{label}</p>
      {caption ? <p className="mt-1 text-[11px] text-text-muted">{caption}</p> : null}
    </button>
  );
}

function MetricCard({
  label,
  value,
  caption,
  tone = 'accent',
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: 'accent' | 'warning' | 'neutral' | 'success';
}) {
  const toneClass =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'success'
        ? 'text-success'
        : tone === 'neutral'
          ? 'text-text-primary'
          : 'text-accent';

  return (
    <Card className="rounded-[28px] p-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">{label}</p>
      <p className={cn('mt-4 text-[2rem] font-semibold leading-none', toneClass)}>{value}</p>
      {caption ? <p className="mt-3 text-sm text-text-secondary">{caption}</p> : null}
    </Card>
  );
}

function SectionHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {detail ? <p className="mt-1 text-sm text-text-secondary">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

function ProgressBar({
  value,
  tone = 'accent',
}: {
  value: number;
  tone?: 'accent' | 'warning' | 'success';
}) {
  const barTone = tone === 'warning' ? 'bg-warning' : tone === 'success' ? 'bg-success' : 'bg-accent';

  return (
    <div className="h-3 overflow-hidden rounded-full bg-panel2/80">
      <motion.div
        animate={{ width: `${clamp(value, 0, 100)}%` }}
        className={cn('h-full rounded-full', barTone)}
        transition={{ type: 'spring', stiffness: 180, damping: 26 }}
      />
    </div>
  );
}

function TimeWheelSelector({
  value,
  presetId,
  disabled,
  onChange,
  onPresetChange,
}: {
  value: number;
  presetId: SessionPresetId;
  disabled?: boolean;
  onChange: (minutes: number) => void;
  onPresetChange: (presetId: SessionPresetId) => void;
}) {
  const selectedIndex = Math.max(CUSTOM_SESSION_MINUTES.indexOf(value), 0);

  function commitValue(minutes: number) {
    onChange(minutes);
    onPresetChange(matchPreset(minutes));
  }

  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (disabled) {
      return;
    }

    const rawIndex = selectedIndex - info.offset.x / wheelStep;
    const nextIndex = clamp(Math.round(rawIndex), 0, CUSTOM_SESSION_MINUTES.length - 1);
    commitValue(CUSTOM_SESSION_MINUTES[nextIndex]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SESSION_PRESETS.map((preset) => (
          <button
            className={cn(
              'rounded-full border px-4 py-2 text-xs font-medium transition-all',
              presetId === preset.id
                ? 'border-accent/35 bg-accent/14 text-accent'
                : 'border-borderSoft/40 bg-panel/38 text-text-secondary hover:bg-panel/56 hover:text-text-primary',
            )}
            disabled={disabled}
            key={preset.id}
            onClick={() => {
              commitValue(preset.minutes);
              onPresetChange(preset.id);
            }}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-[30px] border border-borderSoft/35 bg-panel/44 px-3 py-5">
        <div className="pointer-events-none absolute inset-y-3 left-1/2 z-10 w-[108px] -translate-x-1/2 rounded-[24px] border border-accent/28 bg-accent/10 shadow-glow" />

        <motion.div
          animate={{ x: -selectedIndex * wheelStep }}
          className="flex gap-[14px]"
          drag={disabled ? false : 'x'}
          dragConstraints={{
            left: -wheelStep * (CUSTOM_SESSION_MINUTES.length - 1),
            right: 0,
          }}
          onDragEnd={handleDragEnd}
          style={{
            paddingLeft: 'calc(50% - 54px)',
            paddingRight: 'calc(50% - 54px)',
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        >
          {CUSTOM_SESSION_MINUTES.map((minutes, index) => {
            const active = index === selectedIndex;
            const near = Math.abs(index - selectedIndex) <= 1;

            return (
              <button
                className={cn(
                  'flex h-20 w-[108px] shrink-0 flex-col items-center justify-center rounded-[22px] border text-center transition-all',
                  active
                    ? 'border-accent/30 bg-accent/12 text-text-primary'
                    : 'border-borderSoft/30 bg-panel2/56 text-text-secondary',
                  near ? 'opacity-100' : 'opacity-45',
                )}
                disabled={disabled}
                key={minutes}
                onClick={() => commitValue(minutes)}
                type="button"
              >
                <span className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Focus</span>
                <span className="mt-1 text-2xl font-semibold">{minutes}</span>
                <span className="text-xs text-text-muted">minutes</span>
              </button>
            );
          })}
        </motion.div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Custom drag selector</span>
          <span>{value} min</span>
        </div>
        <input
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel2 accent-[rgb(var(--accent))]"
          disabled={disabled}
          max={120}
          min={10}
          onChange={(event) => {
            commitValue(Number(event.target.value));
            onPresetChange('custom');
          }}
          step={5}
          type="range"
          value={value}
        />
      </div>
    </div>
  );
}

function TaskListItem({
  task,
  selected,
  blocked,
  active,
  footer,
  onSelect,
}: {
  task: Task;
  selected?: boolean;
  blocked?: boolean;
  active?: boolean;
  footer?: ReactNode;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-[24px] border p-4 transition-all',
        selected
          ? 'border-accent/30 bg-accent/10 shadow-glow'
          : 'border-borderSoft/35 bg-panel/42 hover:border-borderStrong/35 hover:bg-panel/56',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button className="min-w-0 flex-1 text-left" onClick={onSelect} type="button">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-text-primary">{task.title}</p>
            {active ? <Badge tone="accent">Current</Badge> : null}
            {blocked ? <Badge tone="warning">Blocked</Badge> : null}
          </div>
          {describeTask(task) ? <p className="mt-2 text-sm text-text-secondary">{describeTask(task)}</p> : null}
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={getTaskTone(task)}>{humanizePriority(task.priority)}</Badge>
          <Badge tone="neutral">{task.estimated_minutes}m</Badge>
        </div>
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}

function ActivityBars({
  points,
}: {
  points: Array<{ label: string; focusSeconds: number; distractionSeconds: number }>;
}) {
  const maxValue = Math.max(
    1,
    ...points.map((point) => Math.max(point.focusSeconds, point.distractionSeconds)),
  );

  return (
    <div className="grid h-40 grid-cols-7 items-end gap-3">
      {points.map((point) => (
        <div className="flex min-w-0 flex-col items-center gap-2" key={point.label}>
          <div className="flex h-28 items-end gap-1">
            <div
              className="w-3 rounded-full bg-accent/85"
              style={{ height: `${Math.max(10, (point.focusSeconds / maxValue) * 100)}%` }}
            />
            <div
              className="w-3 rounded-full bg-warning/80"
              style={{ height: `${Math.max(point.distractionSeconds ? 10 : 0, (point.distractionSeconds / maxValue) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] text-text-muted">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

function CapturePopup({
  state,
  loading,
  onChange,
  onClose,
  onSave,
}: {
  state: CaptureState;
  loading: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);

    return () => window.clearTimeout(timeout);
  }, [state]);

  if (!state) {
    return null;
  }

  const option = captureOptions.find((item) => item.kind === state.kind);

  if (!option) {
    return null;
  }

  const isLongForm = option.kind === 'note' || option.kind === 'blocker' || option.kind === 'idea';

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="absolute bottom-6 right-6 z-30 w-[360px]"
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
      >
        <Card className="rounded-[28px] border border-accent/20 bg-panel/94 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">{option.label}</p>
              <h3 className="mt-2 text-lg font-semibold text-text-primary">{option.icon} Quick capture</h3>
            </div>

            <Button onClick={onClose} size="sm" type="button" variant="ghost">
              Esc
            </Button>
          </div>

          <div className="mt-4">
            {isLongForm ? (
              <Textarea
                className="min-h-[104px]"
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    onClose();
                  }

                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    onSave();
                  }
                }}
                placeholder={option.placeholder}
                ref={inputRef as RefObject<HTMLTextAreaElement>}
                value={state.value}
              />
            ) : (
              <Input
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    onClose();
                  }

                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onSave();
                  }
                }}
                placeholder={option.placeholder}
                ref={inputRef as RefObject<HTMLInputElement>}
                value={state.value}
              />
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-text-muted">
              {option.kind === 'distraction' ? 'Save and pause.' : 'Enter to save.'}
            </p>

            <div className="flex gap-2">
              <Button onClick={onClose} size="sm" type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={loading || state.value.trim().length === 0} onClick={onSave} size="sm" type="button">
                Save
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

export function MainApp() {
  const tasks = useTaskStore((state) => state.tasks);
  const tasksHydrated = useTaskStore((state) => state.hydrated);
  const tasksLoading = useTaskStore((state) => state.loading);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const createTask = useTaskStore((state) => state.createTask);
  const moveTaskToLane = useTaskStore((state) => state.moveTaskToLane);
  const markDone = useTaskStore((state) => state.markDone);

  const currentMissionId = useFocusStore((state) => state.currentMissionId);
  const setCurrentMission = useFocusStore((state) => state.setCurrentMission);
  const startFocusSession = useFocusStore((state) => state.startSession);
  const pauseFocusSession = useFocusStore((state) => state.pauseSession);
  const resetFocusSession = useFocusStore((state) => state.resetSession);

  const sessions = useSessionStore((state) => state.sessions);
  const sessionsHydrated = useSessionStore((state) => state.hydrated);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const recovery = useSessionStore((state) => state.recovery);
  const startSession = useSessionStore((state) => state.startSession);
  const pauseActiveSession = useSessionStore((state) => state.pauseActiveSession);
  const resumeActiveSession = useSessionStore((state) => state.resumeActiveSession);
  const completeActiveSession = useSessionStore((state) => state.completeActiveSession);
  const addCapture = useSessionStore((state) => state.addCapture);
  const dismissRecovery = useSessionStore((state) => state.dismissRecovery);

  const [activeView, setActiveView] = useState<MainView>('today');
  const [minutes, setMinutes] = useState(25);
  const [presetId, setPresetId] = useState<SessionPresetId>('focus');
  const [captureState, setCaptureState] = useState<CaptureState>(null);
  const [captureSaving, setCaptureSaving] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const activeSession = findActiveSession(sessions, activeSessionId);
  const activeSessionMetrics = activeSession ? getSessionMetrics(activeSession, now) : zeroMetrics;
  const blockedEntries = getLatestBlockedEntries(sessions);
  const blockedTaskIds = new Set(blockedEntries.map((entry) => entry.taskId));

  const activeTasks = tasks.filter((task) => task.lane === 'now' && task.status !== 'done');
  const queueTasks = tasks.filter(
    (task) =>
      task.lane !== 'done' &&
      task.status !== 'done' &&
      task.lane !== 'now' &&
      !blockedTaskIds.has(task.id),
  );
  const blockedTasks = tasks.filter(
    (task) => task.lane !== 'done' && task.status !== 'done' && blockedTaskIds.has(task.id),
  );
  const completedTasks = tasks.filter((task) => task.lane === 'done' || task.status === 'done');

  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ??
    (activeSession ? tasks.find((task) => task.id === activeSession.task_id) : null) ??
    activeTasks[0] ??
    queueTasks[0] ??
    null;
  const currentTask =
    (activeSession ? tasks.find((task) => task.id === activeSession.task_id) : null) ?? selectedTask;
  const suggestedTask = getSuggestedTask(tasks, blockedTaskIds, activeSession?.task_id ?? null);

  const todaySessions = sessions.filter((session) => isSameCalendarDay(session.started_at, new Date(now)));
  const todayFocusSeconds = todaySessions.reduce(
    (sum, session) => sum + getSessionMetrics(session, now).focus_seconds,
    0,
  );
  const todayDistractionSeconds = todaySessions.reduce(
    (sum, session) => sum + getSessionMetrics(session, now).distraction_seconds,
    0,
  );
  const todayPauseSeconds = todaySessions.reduce(
    (sum, session) => sum + getSessionMetrics(session, now).pause_seconds,
    0,
  );
  const todayBreakSeconds = todaySessions.reduce(
    (sum, session) => sum + getSessionMetrics(session, now).break_seconds,
    0,
  );
  const todaySwitchCount = getTaskSwitchCount(todaySessions);

  const historyRows = buildTaskHistoryRows(sessions, tasks, now);
  const hourlyFocus = getHourlyFocusBuckets(sessions, now)
    .filter((bucket) => bucket.totalSeconds > 0)
    .sort((left, right) => right.totalSeconds - left.totalSeconds);
  const distractionPatterns = getDistractionPatterns(sessions);
  const averageSessionSeconds = getAverageFocusSessionSeconds(sessions, now);
  const dailySeries = buildDailySeries(sessions, 7, now);
  const lastFourteenDays = buildDailySeries(sessions, 14, now);
  const previousWeek = lastFourteenDays.slice(0, 7);
  const currentWeek = lastFourteenDays.slice(7);
  const estimationAccuracy = getTaskEstimationAccuracy(tasks, sessions, now);
  const currentWeekFocus = currentWeek.reduce((sum, point) => sum + point.focusSeconds, 0);
  const previousWeekFocus = previousWeek.reduce((sum, point) => sum + point.focusSeconds, 0);
  const currentWeekDistraction = currentWeek.reduce((sum, point) => sum + point.distractionSeconds, 0);
  const previousWeekDistraction = previousWeek.reduce((sum, point) => sum + point.distractionSeconds, 0);
  const focusConsistency = dailySeries.filter((point) => point.focusSeconds > 0).length;

  const doneToday = completedTasks.filter((task) => isSameCalendarDay(task.updated_at, new Date(now)));
  const blockersToday = todaySessions.flatMap((session) =>
    session.captures
      .filter((capture) => capture.kind === 'blocker')
      .map((capture) => ({
        taskId: session.task_id,
        taskTitle: tasks.find((task) => task.id === session.task_id)?.title ?? session.task_title,
        content: capture.content,
      })),
  );
  const nextReviewTasks = [...queueTasks]
    .sort((left, right) => priorityValue(right.priority) - priorityValue(left.priority))
    .slice(0, 3);

  const progressPercent = activeSession
    ? Math.round((activeSessionMetrics.focus_seconds / Math.max(1, activeSession.planned_minutes * 60)) * 100)
    : 0;
  const remainingMinutes = activeSession ? Math.max(5, getRemainingMinutes(activeSession, now)) : minutes;
  const recentCaptures = activeSession ? activeSession.captures.slice(-4).reverse() : [];

  useEffect(() => {
    if (!selectedTaskId && tasks[0]) {
      selectTask(tasks[0].id);
    }
  }, [selectTask, selectedTaskId, tasks]);

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    if (currentMissionId !== activeSession.task_id) {
      setCurrentMission(activeSession.task_id, 'system');
    }
  }, [activeSession, currentMissionId, setCurrentMission]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setCaptureState(null);
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const viewCopy = getViewCopy(activeView);

  function handleStartSession(task: Task, nextMinutes = minutes, nextPresetId = presetId) {
    selectTask(task.id);
    setCurrentMission(task.id, 'main');

    if (task.lane !== 'now' && task.lane !== 'done') {
      void moveTaskToLane(task.id, 'now', 'main');
    }

    startSession({
      taskId: task.id,
      taskTitle: task.title,
      minutes: nextMinutes,
      presetId: nextPresetId,
    });
    startFocusSession(nextMinutes, 'main');
  }

  function handlePause(kind: 'pause' | 'break' | 'distraction', detail = '') {
    pauseActiveSession(kind, detail);
    pauseFocusSession('main');
  }

  function handleResume(nextMinutes: number) {
    resumeActiveSession(nextMinutes);
    startFocusSession(nextMinutes, 'main');
  }

  function handleFinishSession() {
    completeActiveSession();
    resetFocusSession('main');
  }

  async function handleSaveCapture() {
    if (!captureState || !activeSession || captureState.value.trim().length === 0) {
      return;
    }

    setCaptureSaving(true);

    try {
      addCapture(captureState.kind, captureState.value);

      if (captureState.kind === 'follow-up') {
        await createTask(
          {
            rawInput: captureState.value,
            title: captureState.value,
            lane: 'inbox',
            estimatedMinutes: 15,
          },
          'main',
        );
      }

      if (captureState.kind === 'distraction' && activeSession.status === 'running') {
        handlePause('distraction', captureState.value);
      }

      setCaptureState(null);
    } finally {
      setCaptureSaving(false);
    }
  }

  function renderToday() {
    return (
      <div className="space-y-6">
        {recovery ? (
          <Card className="rounded-[30px] border border-warning/18 bg-warning/8 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-warning">Recovery</p>
                <h2 className="mt-2 text-xl font-semibold text-text-primary">
                  You were working on {recovery.task_title}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Paused {formatRelativeTime(recovery.paused_at)}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleResume(10)} size="sm" type="button">
                  Resume 10 min
                </Button>
                <Button
                  onClick={() => handleResume(recovery.remaining_minutes)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Resume remaining
                </Button>
                <Button
                  onClick={() => {
                    startTransition(() => setActiveView('tasks'));
                    dismissRecovery();
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Switch task
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.95fr)]">
          <Card className="relative overflow-hidden rounded-[34px] p-6">
            <div className="absolute inset-x-10 top-0 h-40 rounded-full bg-accent/12 blur-3xl" />
            <div className="relative">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">Current focus</p>
                  <h2 className="mt-2 text-3xl font-semibold leading-tight text-text-primary">
                    {currentTask?.title ?? 'Pick a task'}
                  </h2>
                </div>

                <div className="grid min-w-[220px] gap-3 rounded-[26px] border border-borderSoft/30 bg-panel/46 p-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Live timer</p>
                    <p className="mt-2 text-[2.6rem] font-semibold leading-none text-text-primary">
                      {formatClock(activeSessionMetrics.focus_seconds)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge tone={activeSession?.status === 'paused' ? 'warning' : 'accent'}>
                      {activeSession?.status === 'paused' ? 'Paused' : activeSession ? 'Running' : 'Ready'}
                    </Badge>
                    <Badge tone="neutral">{activeSession?.planned_minutes ?? minutes}m target</Badge>
                    {activeSession ? <Badge tone="neutral">{formatDurationFromSeconds(activeSessionMetrics.distraction_seconds)} distracted</Badge> : null}
                  </div>
                </div>
              </div>

              {activeSession ? (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>
                      Focused {formatDurationFromSeconds(activeSessionMetrics.focus_seconds)} of{' '}
                      {activeSession.planned_minutes}m
                    </span>
                    <span>{Math.max(0, 100 - progressPercent)}% left</span>
                  </div>
                  <ProgressBar tone={activeSession?.status === 'paused' ? 'warning' : 'accent'} value={progressPercent} />
                </div>
              ) : null}

              <div className="mt-8">
                <SectionHeading action={<Badge tone="neutral">Wheel</Badge>} title="Session" />

                <TimeWheelSelector
                  disabled={Boolean(activeSession && activeSession.status === 'running')}
                  onChange={setMinutes}
                  onPresetChange={setPresetId}
                  presetId={presetId}
                  value={minutes}
                />
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {!activeSession ? (
                  <Button
                    disabled={!currentTask}
                    onClick={() => currentTask && handleStartSession(currentTask, minutes, presetId)}
                    size="lg"
                    type="button"
                  >
                    Start {minutes} min
                  </Button>
                ) : activeSession.status === 'running' ? (
                  <>
                    <Button onClick={() => handlePause('pause')} size="md" type="button" variant="secondary">
                      Pause
                    </Button>
                    <Button onClick={() => handlePause('break')} size="md" type="button" variant="secondary">
                      Start break
                    </Button>
                    <Button onClick={() => handlePause('distraction', 'Quick distraction')} size="md" type="button" variant="secondary">
                      Distracted
                    </Button>
                    <Button onClick={handleFinishSession} size="md" type="button" variant="ghost">
                      Finish session
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => handleResume(remainingMinutes)} size="md" type="button">
                      Resume remaining
                    </Button>
                    <Button onClick={() => handleResume(10)} size="md" type="button" variant="secondary">
                      Resume 10 min
                    </Button>
                    <Button onClick={() => startTransition(() => setActiveView('tasks'))} size="md" type="button" variant="ghost">
                      Switch task
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[34px] p-6">
              <SectionHeading action={<Badge tone="accent">Live</Badge>} title="Capture" />

              <div className="grid gap-3 sm:grid-cols-2">
                {captureOptions.map((option) => (
                  <button
                    className={cn(
                      'rounded-[24px] border p-4 text-left transition-all',
                      activeSession
                        ? 'border-borderSoft/35 bg-panel/42 hover:border-accent/24 hover:bg-panel/62'
                        : 'cursor-not-allowed border-borderSoft/25 bg-panel/28 text-text-muted opacity-55',
                    )}
                    disabled={!activeSession}
                    key={option.kind}
                    onClick={() => setCaptureState({ kind: option.kind, value: '' })}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg">{option.icon}</span>
                      <span className="text-[11px] uppercase tracking-[0.24em] text-text-muted">{option.label}</span>
                    </div>
                  </button>
                ))}
              </div>

              {recentCaptures.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {recentCaptures.map((capture) => (
                    <Badge key={capture.id} tone={capture.kind === 'blocker' ? 'warning' : 'neutral'}>
                      {capture.kind}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>

            <Card className="rounded-[34px] p-6">
              <SectionHeading action={<Badge tone="neutral">{todaySessions.length}</Badge>} title="Tracked" />

              <div className="space-y-3 text-sm text-text-secondary">
                <div className="flex items-center justify-between">
                  <span>Focus time</span>
                  <span className="font-medium text-text-primary">{formatDurationFromSeconds(todayFocusSeconds)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pause time</span>
                  <span className="font-medium text-text-primary">{formatDurationFromSeconds(todayPauseSeconds)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Break time</span>
                  <span className="font-medium text-text-primary">{formatDurationFromSeconds(todayBreakSeconds)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Distraction time</span>
                  <span className="font-medium text-text-primary">{formatDurationFromSeconds(todayDistractionSeconds)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Task switching</span>
                  <span className="font-medium text-text-primary">{todaySwitchCount}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <MetricCard label="Focus" value={formatDurationFromSeconds(todayFocusSeconds)} />
          <MetricCard label="Sessions" tone="neutral" value={String(todaySessions.length).padStart(2, '0')} />
          <MetricCard label="Distraction" tone="warning" value={formatDurationFromSeconds(todayDistractionSeconds)} />
          <MetricCard label="Switches" tone="success" value={String(todaySwitchCount).padStart(2, '0')} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="neutral">Today</Badge>} title="Sessions" />

            <div className="space-y-3">
              {todaySessions.length ? (
                [...todaySessions]
                  .sort(
                    (left, right) => new Date(right.started_at).getTime() - new Date(left.started_at).getTime(),
                  )
                  .map((session) => {
                    const metrics = getSessionMetrics(session, now);

                    return (
                      <div
                        className="flex flex-col gap-3 rounded-[24px] border border-borderSoft/30 bg-panel/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                        key={session.id}
                      >
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {tasks.find((task) => task.id === session.task_id)?.title ?? session.task_title}
                          </p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {formatTimeRange(session.started_at, session.ended_at)} · {formatDurationFromSeconds(metrics.focus_seconds)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge tone="neutral">{session.captures.length} captures</Badge>
                          <Badge tone="warning">{formatDurationFromSeconds(metrics.distraction_seconds)} distracted</Badge>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="rounded-[24px] border border-dashed border-borderSoft/35 bg-panel/28 p-6 text-sm text-text-secondary">
                  No sessions yet.
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[34px] p-6">
              <SectionHeading action={suggestedTask ? <Badge tone="accent">Next</Badge> : null} title="Suggested" />

              {suggestedTask ? (
                <TaskListItem
                  footer={
                    <div className="flex gap-2">
                      <Button onClick={() => handleStartSession(suggestedTask)} size="sm" type="button">
                        Start focus
                      </Button>
                      <Button
                        onClick={() => {
                          selectTask(suggestedTask.id);
                          startTransition(() => setActiveView('tasks'));
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Open task
                      </Button>
                    </div>
                  }
                  onSelect={() => selectTask(suggestedTask.id)}
                  task={suggestedTask}
                />
              ) : (
                <div className="rounded-[24px] border border-dashed border-borderSoft/35 bg-panel/28 p-6 text-sm text-text-secondary">
                  No suggestion.
                </div>
              )}
            </Card>

            <Card className="rounded-[34px] p-6">
              <SectionHeading action={<Badge tone="warning">{blockedTasks.length}</Badge>} title="Blocked" />

              <div className="space-y-3">
                {blockedTasks.length ? (
                  blockedTasks.slice(0, 4).map((task) => {
                    const blocker = blockedEntries.find((entry) => entry.taskId === task.id);

                    return (
                      <div className="rounded-[22px] border border-warning/20 bg-warning/8 p-4" key={task.id}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-text-primary">{task.title}</p>
                          <Badge tone="warning">Blocked</Badge>
                        </div>
                        <p className="mt-2 text-sm text-text-secondary">{blocker?.blocker ?? 'Open blocker logged earlier.'}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[24px] border border-dashed border-borderSoft/35 bg-panel/28 p-6 text-sm text-text-secondary">
                    No blocked tasks.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  function renderTasks() {
    return (
      <div className="space-y-6">
        <Card className="rounded-[34px] p-6">
          <SectionHeading action={<Badge tone="accent">New</Badge>} title="Add task" />
          <TaskCreationComposer
            initialMode="interaction"
            onSubmitted={() => {
              startTransition(() => setActiveView('tasks'));
            }}
            source="main"
            submitLabel="Save task"
          />
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="accent">{activeTasks.length}</Badge>} title="Active" />

            <div className="space-y-3">
              {activeTasks.length ? (
                activeTasks.map((task) => (
                  <TaskListItem
                    active={activeSession?.task_id === task.id}
                    footer={
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => handleStartSession(task)} size="sm" type="button">
                          Focus
                        </Button>
                        <Button onClick={() => void markDone(task.id, 'main')} size="sm" type="button" variant="ghost">
                          Mark done
                        </Button>
                      </div>
                    }
                    key={task.id}
                    onSelect={() => selectTask(task.id)}
                    selected={selectedTaskId === task.id}
                    task={task}
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-borderSoft/35 bg-panel/28 p-6 text-sm text-text-secondary">
                  No active tasks.
                </div>
              )}
            </div>
          </Card>

          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="neutral">{queueTasks.length}</Badge>} title="Queue" />

            <div className="space-y-3">
              {queueTasks.length ? (
                queueTasks.map((task) => (
                  <TaskListItem
                    footer={
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => handleStartSession(task)} size="sm" type="button">
                          Start focus
                        </Button>
                        <Button
                          onClick={() => void moveTaskToLane(task.id, 'later', 'main')}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Move later
                        </Button>
                      </div>
                    }
                    key={task.id}
                    onSelect={() => selectTask(task.id)}
                    selected={selectedTaskId === task.id}
                    task={task}
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-borderSoft/35 bg-panel/28 p-6 text-sm text-text-secondary">
                  Queue is clear.
                </div>
              )}
            </div>
          </Card>

          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="warning">{blockedTasks.length}</Badge>} title="Blocked" />

            <div className="space-y-3">
              {blockedTasks.length ? (
                blockedTasks.map((task) => {
                  const blocker = blockedEntries.find((entry) => entry.taskId === task.id);

                  return (
                    <TaskListItem
                      blocked
                      footer={
                        <div className="space-y-3">
                          <p className="text-sm text-text-secondary">{blocker?.blocker ?? 'Blocker logged earlier.'}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => handleStartSession(task)} size="sm" type="button">
                              Try again
                            </Button>
                          </div>
                        </div>
                      }
                      key={task.id}
                      onSelect={() => selectTask(task.id)}
                      selected={selectedTaskId === task.id}
                      task={task}
                    />
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-borderSoft/35 bg-panel/28 p-6 text-sm text-text-secondary">
                  No blocked tasks.
                </div>
              )}
            </div>
          </Card>

          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="success">{completedTasks.length}</Badge>} title="Completed" />

            <div className="space-y-3">
              {completedTasks.length ? (
                completedTasks.slice(0, 8).map((task) => (
                  <TaskListItem
                    footer={<p className="text-xs text-text-muted">Completed {formatRelativeTime(task.updated_at)}</p>}
                    key={task.id}
                    onSelect={() => selectTask(task.id)}
                    task={task}
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-borderSoft/35 bg-panel/28 p-6 text-sm text-text-secondary">
                  No completed tasks.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  function renderHistory() {
    return (
      <Card className="rounded-[34px] p-6">
        <SectionHeading action={<Badge tone="neutral">{historyRows.length}</Badge>} title="History" />

        <div className="space-y-3">
          {historyRows.length ? (
            historyRows.map((row) => {
              const expanded = expandedHistoryId === row.taskId;

              return (
                <div
                  className="overflow-hidden rounded-[28px] border border-borderSoft/30 bg-panel/42 transition-all"
                  key={row.taskId}
                >
                  <button
                    className="grid w-full gap-4 px-5 py-4 text-left lg:grid-cols-[minmax(0,1.4fr)_0.8fr_0.8fr_0.9fr_1.3fr_0.6fr]"
                    onClick={() => setExpandedHistoryId(expanded ? null : row.taskId)}
                    type="button"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{row.taskTitle}</p>
                      <p className="mt-1 text-xs text-text-muted">{row.sessions.length} tracked blocks</p>
                    </div>
                    <p className="text-sm text-text-secondary">{formatDurationFromSeconds(row.totalFocusSeconds)}</p>
                    <p className="text-sm text-text-secondary">{row.sessionCount} sessions</p>
                    <p className="text-sm text-text-secondary">{formatDurationFromSeconds(row.totalDistractionSeconds)}</p>
                    <p className="text-sm text-text-secondary">{row.sessionRanges.slice(0, 3).join(', ')}</p>
                    <p className="text-sm text-warning">⚠ {row.blockerCount}</p>
                  </button>

                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <motion.div
                        animate={{ height: 'auto', opacity: 1 }}
                        className="border-t border-borderSoft/24"
                        exit={{ height: 0, opacity: 0 }}
                        initial={{ height: 0, opacity: 0 }}
                      >
                        <div className="grid gap-6 px-5 py-5 lg:grid-cols-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Sessions</p>
                            <div className="mt-3 space-y-2">
                              {row.sessions.map((session) => (
                                <div className="rounded-[20px] border border-borderSoft/24 bg-panel2/44 px-4 py-3" key={session.id}>
                                  <p className="text-sm text-text-primary">{formatTimeRange(session.started_at, session.ended_at)}</p>
                                  <p className="mt-1 text-xs text-text-muted">
                                    {formatDurationFromSeconds(getSessionMetrics(session, now).focus_seconds)} focused
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Distractions</p>
                            <div className="mt-3 space-y-2">
                              {row.distractions.length ? (
                                row.distractions.map((distraction, index) => (
                                  <div className="rounded-[20px] border border-borderSoft/24 bg-panel2/44 px-4 py-3 text-sm text-text-secondary" key={`${row.taskId}-distraction-${index}`}>
                                    {distraction}
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-[20px] border border-dashed border-borderSoft/24 bg-panel2/32 px-4 py-3 text-sm text-text-muted">
                                  No distractions.
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Resources and blockers</p>
                            <div className="mt-3 space-y-2">
                              {row.resources.map((resource, index) => (
                                <a
                                  className="block rounded-[20px] border border-borderSoft/24 bg-panel2/44 px-4 py-3 text-sm text-accent transition hover:bg-panel2/60"
                                  href={resource}
                                  key={`${row.taskId}-resource-${index}`}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {resource}
                                </a>
                              ))}
                              {row.blockers.map((blocker, index) => (
                                <div
                                  className="rounded-[20px] border border-warning/18 bg-warning/8 px-4 py-3 text-sm text-text-secondary"
                                  key={`${row.taskId}-blocker-${index}`}
                                >
                                  {blocker}
                                </div>
                              ))}
                              {!row.resources.length && !row.blockers.length ? (
                                <div className="rounded-[20px] border border-dashed border-borderSoft/24 bg-panel2/32 px-4 py-3 text-sm text-text-muted">
                                  Empty.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-dashed border-borderSoft/35 bg-panel/28 p-6 text-sm text-text-secondary">
              No history yet.
            </div>
          )}
        </div>
      </Card>
    );
  }

  function renderInsights() {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-4">
          <MetricCard
            label="Best focus hours"
            value={hourlyFocus[0]?.label ?? 'n/a'}
          />
          <MetricCard label="Average session" tone="neutral" value={formatDurationFromSeconds(averageSessionSeconds)} />
          <MetricCard label="Consistency" tone="success" value={`${focusConsistency}/7`} />
          <MetricCard
            label="Accuracy"
            tone="warning"
            value={estimationAccuracy.sampleSize ? `${estimationAccuracy.accuracy}%` : 'n/a'}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="accent">7d</Badge>} title="Focus vs distraction" />

            <ActivityBars points={dailySeries} />
          </Card>

          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="warning">Top</Badge>} title="Distraction patterns" />

            <div className="space-y-3">
              {distractionPatterns.length ? (
                distractionPatterns.slice(0, 6).map((pattern) => (
                  <div className="flex items-center justify-between rounded-[22px] border border-borderSoft/30 bg-panel/40 px-4 py-3" key={pattern.label}>
                    <span className="text-sm text-text-primary">{pattern.label}</span>
                    <Badge tone="warning">{pattern.count}</Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-borderSoft/35 bg-panel/28 p-6 text-sm text-text-secondary">
                  No data.
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-[34px] p-6">
            <SectionHeading title="Best hours" />

            <div className="space-y-3">
              {hourlyFocus.length ? (
                hourlyFocus.slice(0, 3).map((bucket) => (
                  <div className="rounded-[22px] border border-borderSoft/30 bg-panel/40 px-4 py-3" key={bucket.hour}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-text-primary">{bucket.label}</p>
                      <p className="text-sm text-text-secondary">{formatDurationFromSeconds(bucket.totalSeconds)}</p>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={(bucket.totalSeconds / Math.max(hourlyFocus[0]?.totalSeconds ?? 1, 1)) * 100} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-borderSoft/35 bg-panel/28 p-6 text-sm text-text-secondary">
                  No data.
                </div>
              )}
            </div>
          </Card>

          <Card className="rounded-[34px] p-6">
            <SectionHeading title="Task accuracy" />

            <div className="space-y-4 text-sm text-text-secondary">
              <div className="rounded-[24px] border border-borderSoft/30 bg-panel/40 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Accuracy</p>
                <p className="mt-2 text-3xl font-semibold text-text-primary">
                  {estimationAccuracy.sampleSize ? `${estimationAccuracy.accuracy}%` : 'n/a'}
                </p>
              </div>
              <div className="rounded-[24px] border border-borderSoft/30 bg-panel/40 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Average drift</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">
                  {estimationAccuracy.sampleSize ? `${estimationAccuracy.deltaMinutes > 0 ? '+' : ''}${estimationAccuracy.deltaMinutes}m` : 'n/a'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[34px] p-6">
            <SectionHeading title="Trends" />

            <div className="space-y-3 text-sm text-text-secondary">
              <div className="flex items-center justify-between rounded-[22px] border border-borderSoft/30 bg-panel/40 px-4 py-3">
                <span>Focus trend</span>
                <span className="font-medium text-text-primary">
                  {currentWeekFocus >= previousWeekFocus ? '+' : ''}
                  {formatDurationFromSeconds(Math.abs(currentWeekFocus - previousWeekFocus))}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-borderSoft/30 bg-panel/40 px-4 py-3">
                <span>Distraction trend</span>
                <span className="font-medium text-text-primary">
                  {currentWeekDistraction >= previousWeekDistraction ? '+' : ''}
                  {formatDurationFromSeconds(Math.abs(currentWeekDistraction - previousWeekDistraction))}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-borderSoft/30 bg-panel/40 px-4 py-3">
                <span>Average session</span>
                <span className="font-medium text-text-primary">{formatDurationFromSeconds(averageSessionSeconds)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  function renderReview() {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="accent">Today</Badge>} title="Daily review" />

            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">What done</p>
                <div className="mt-3 space-y-2">
                  {doneToday.length ? (
                    doneToday.map((task) => (
                      <div className="rounded-[20px] border border-success/18 bg-success/10 px-4 py-3 text-sm text-text-primary" key={task.id}>
                        {task.title}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-borderSoft/25 bg-panel/24 px-4 py-3 text-sm text-text-muted">
                      None.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">What stuck</p>
                <div className="mt-3 space-y-2">
                  {blockersToday.length ? (
                    blockersToday.map((blocker, index) => (
                      <div
                        className="rounded-[20px] border border-warning/18 bg-warning/8 px-4 py-3 text-sm text-text-secondary"
                        key={`${blocker.taskId}-${index}`}
                      >
                        <span className="font-medium text-text-primary">{blocker.taskTitle}</span>
                        <p className="mt-1">{blocker.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-borderSoft/25 bg-panel/24 px-4 py-3 text-sm text-text-muted">
                      None.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">What next</p>
                <div className="mt-3 space-y-2">
                  {nextReviewTasks.length ? (
                    nextReviewTasks.map((task) => (
                      <div className="rounded-[20px] border border-borderSoft/25 bg-panel/24 px-4 py-3 text-sm text-text-primary" key={task.id}>
                        {task.title}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-borderSoft/25 bg-panel/24 px-4 py-3 text-sm text-text-muted">
                      Queue is empty.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="warning">7d</Badge>} title="Weekly review" />

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-[22px] border border-borderSoft/30 bg-panel/40 px-4 py-3">
                <span className="text-sm text-text-secondary">Focus trend</span>
                <span className="text-sm font-medium text-text-primary">
                  {currentWeekFocus >= previousWeekFocus ? '+' : ''}
                  {formatDurationFromSeconds(Math.abs(currentWeekFocus - previousWeekFocus))}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-borderSoft/30 bg-panel/40 px-4 py-3">
                <span className="text-sm text-text-secondary">Distraction trend</span>
                <span className="text-sm font-medium text-text-primary">
                  {currentWeekDistraction >= previousWeekDistraction ? '+' : ''}
                  {formatDurationFromSeconds(Math.abs(currentWeekDistraction - previousWeekDistraction))}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-borderSoft/30 bg-panel/40 px-4 py-3">
                <span className="text-sm text-text-secondary">Progress</span>
                <span className="text-sm font-medium text-text-primary">
                  {completedTasks.filter((task) => new Date(task.updated_at).getTime() >= now - 7 * 24 * 60 * 60 * 1000).length}{' '}
                  completed
                </span>
              </div>
            </div>

            <div className="mt-6">
              <ActivityBars points={currentWeek} />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!tasksHydrated || !sessionsHydrated || tasksLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full max-w-xl rounded-[34px] p-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">MissionControl</p>
          <h1 className="mt-3 text-3xl font-semibold text-text-primary">Loading</h1>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full p-5">
      <div className="app-frame relative flex h-full overflow-hidden rounded-[42px] border border-borderSoft/20">
        <aside className="sidebar-shell relative z-10 flex w-[248px] flex-col border-r border-borderSoft/24 p-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-text-muted">MissionControl</p>
            <h1 className="mt-3 text-2xl font-semibold text-text-primary">Focus</h1>
          </div>

          <div className="mt-8 space-y-2">
            {views.map((view) => (
              <NavButton
                active={activeView === view.id}
                caption={view.caption}
                key={view.id}
                label={view.label}
                onClick={() => startTransition(() => setActiveView(view.id))}
              />
            ))}
          </div>

          <div className="mt-auto">
            <Card className="rounded-[28px] p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Live status</p>
              <p className="mt-3 text-xl font-semibold text-text-primary">
                {activeSession ? activeSession.task_title : 'Idle'}
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                {activeSession ? `${formatClock(activeSessionMetrics.focus_seconds)} · ${activeSession.status}` : 'No session'}
              </p>
            </Card>
          </div>
        </aside>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-borderSoft/24 px-6 py-5">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold text-text-primary">{viewCopy}</h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-borderSoft/28 bg-panel/36 px-4 py-2 text-sm text-text-secondary lg:block">
                {new Intl.DateTimeFormat(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(now))}
              </div>
              <Button onClick={() => void showQuickAddWindow()} size="sm" type="button" variant="secondary">
                Quick Add
              </Button>
              <Button onClick={() => void showHudWindow()} size="sm" type="button" variant="ghost">
                HUD
              </Button>
            </div>
          </header>

          <main className="relative flex-1 overflow-y-auto px-6 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                initial={{ opacity: 0, y: 10 }}
                key={activeView}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {activeView === 'today' ? renderToday() : null}
                {activeView === 'tasks' ? renderTasks() : null}
                {activeView === 'history' ? renderHistory() : null}
                {activeView === 'insights' ? renderInsights() : null}
                {activeView === 'review' ? renderReview() : null}
              </motion.div>
            </AnimatePresence>

            <CapturePopup
              loading={captureSaving}
              onChange={(value) =>
                setCaptureState((current) => (current ? { ...current, value } : current))
              }
              onClose={() => setCaptureState(null)}
              onSave={() => void handleSaveCapture()}
              state={captureState}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
