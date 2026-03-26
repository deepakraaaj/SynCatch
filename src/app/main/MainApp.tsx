import {
  type DragEvent as ReactDragEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import type { Task, TaskLane } from '../../features/tasks/task-types';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../lib/date';
import { showHudWindow, showQuickAddWindow } from '../../lib/tauri';

type MainView = 'today' | 'tasks' | 'history' | 'insights' | 'review';

type CaptureState = {
  kind: SessionCaptureKind;
  value: string;
} | null;

type TaskBoardColumn = {
  lane: TaskLane;
  title: string;
  tone: 'neutral' | 'accent' | 'success' | 'warning';
  empty: string;
};

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

const taskBoardColumns: TaskBoardColumn[] = [
  { lane: 'now', title: 'Active', tone: 'accent', empty: 'Drop here' },
  { lane: 'inbox', title: 'Queue', tone: 'neutral', empty: 'Drop here' },
  { lane: 'next', title: 'Next', tone: 'warning', empty: 'Drop here' },
  { lane: 'later', title: 'Backlog', tone: 'neutral', empty: 'Drop here' },
  { lane: 'done', title: 'Completed', tone: 'success', empty: 'Drop here' },
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
const headerTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function useTickingNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
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

function getClosestMinuteIndex(value: number) {
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  CUSTOM_SESSION_MINUTES.forEach((minutes, index) => {
    const distance = Math.abs(minutes - value);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
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
        'w-full rounded-[24px] border px-4 py-3 text-left transition-colors duration-150',
        active
          ? 'border-accent/30 bg-accent/12'
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
      <div
        className={cn('h-full rounded-full', barTone)}
        style={{
          transition: 'width 180ms ease-out',
          width: `${clamp(value, 0, 100)}%`,
        }}
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
  const selectedIndex = getClosestMinuteIndex(value);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  function commitValue(minutes: number) {
    onChange(minutes);
    onPresetChange(matchPreset(minutes));
  }

  function commitIndex(index: number) {
    const nextIndex = clamp(index, 0, CUSTOM_SESSION_MINUTES.length - 1);
    commitValue(CUSTOM_SESSION_MINUTES[nextIndex]);
  }

  function syncFromScroll() {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    commitIndex(Math.round(viewport.scrollLeft / wheelStep));
  }

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const targetLeft = selectedIndex * wheelStep;

    if (Math.abs(viewport.scrollLeft - targetLeft) < 2) {
      return;
    }

    viewport.scrollTo({
      left: targetLeft,
      behavior: 'smooth',
    });
  }, [selectedIndex]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

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
        <div className="pointer-events-none absolute inset-y-3 left-1/2 z-10 w-[108px] -translate-x-1/2 rounded-[24px] border border-accent/28 bg-accent/10" />

        <div
          className={cn(
            'scrollbar-hidden overflow-x-auto',
            disabled ? '' : 'cursor-grab active:cursor-grabbing',
          )}
          onPointerCancel={() => {
            dragStateRef.current = null;
          }}
          onPointerDown={(event) => {
            if (disabled) {
              return;
            }

            const viewport = viewportRef.current;

            if (!viewport) {
              return;
            }

            dragStateRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startScrollLeft: viewport.scrollLeft,
            };

            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (disabled || !dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
              return;
            }

            const viewport = viewportRef.current;

            if (!viewport) {
              return;
            }

            viewport.scrollLeft =
              dragStateRef.current.startScrollLeft - (event.clientX - dragStateRef.current.startX);
          }}
          onPointerUp={(event) => {
            if (dragStateRef.current?.pointerId === event.pointerId) {
              dragStateRef.current = null;
              syncFromScroll();
            }
          }}
          onScroll={() => {
            if (scrollTimeoutRef.current !== null) {
              window.clearTimeout(scrollTimeoutRef.current);
            }

            scrollTimeoutRef.current = window.setTimeout(() => {
              syncFromScroll();
            }, 60);
          }}
          ref={viewportRef}
          style={{
            scrollBehavior: 'smooth',
            touchAction: 'pan-y',
          }}
        >
          <div
            className="flex gap-[14px]"
            style={{
              paddingLeft: 'calc(50% - 54px)',
              paddingRight: 'calc(50% - 54px)',
              width: 'max-content',
            }}
          >
            {CUSTOM_SESSION_MINUTES.map((minutes, index) => {
              const active = index === selectedIndex;
              const near = Math.abs(index - selectedIndex) <= 1;

              return (
                <button
                  className={cn(
                    'flex h-20 w-[108px] shrink-0 flex-col items-center justify-center rounded-[22px] border text-center transition-colors duration-150',
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
          </div>
        </div>
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
  className,
  dragging,
  draggable,
  onDragEnd,
  onDragStart,
  onSelect,
}: {
  task: Task;
  selected?: boolean;
  blocked?: boolean;
  active?: boolean;
  footer?: ReactNode;
  className?: string;
  dragging?: boolean;
  draggable?: boolean;
  onDragEnd?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'main-list-item rounded-[24px] border p-4 transition-[transform,opacity,border-color,background-color,box-shadow] duration-150 ease-out',
        selected
          ? 'border-accent/30 bg-accent/10'
          : 'border-borderSoft/35 bg-panel/42 hover:border-borderStrong/35 hover:bg-panel/56',
        draggable ? 'cursor-grab active:cursor-grabbing' : null,
        dragging ? 'scale-[0.985] border-accent/26 bg-accent/8 opacity-45 shadow-none' : null,
        className,
      )}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
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
    <div className="absolute bottom-6 right-6 z-30 w-[360px]">
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
    </div>
  );
}

function HeaderClock() {
  const now = useTickingNow(30000);

  return (
    <div className="hidden rounded-full border border-borderSoft/28 bg-panel/36 px-4 py-2 text-sm text-text-secondary lg:block">
      {headerTimeFormatter.format(new Date(now))}
    </div>
  );
}

function SidebarLiveStatus({ activeSession }: { activeSession: WorkSession | null }) {
  const now = useTickingNow(activeSession?.status === 'running' ? 1000 : 30000);
  const metrics = useMemo(
    () => (activeSession ? getSessionMetrics(activeSession, now) : zeroMetrics),
    [activeSession, now],
  );

  return (
    <Card className="rounded-[28px] p-5">
      <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Live status</p>
      <p className="mt-3 text-xl font-semibold text-text-primary">
        {activeSession ? activeSession.task_title : 'Idle'}
      </p>
      <p className="mt-2 text-sm text-text-secondary">
        {activeSession ? `${formatClock(metrics.focus_seconds)} · ${activeSession.status}` : 'No session'}
      </p>
    </Card>
  );
}

function TodayFocusCard({
  activeSession,
  currentTask,
  minutes,
  presetId,
  onMinutesChange,
  onPresetChange,
  onStartSession,
  onPause,
  onResume,
  onFinish,
  onSwitchTask,
}: {
  activeSession: WorkSession | null;
  currentTask: Task | null;
  minutes: number;
  presetId: SessionPresetId;
  onMinutesChange: (minutes: number) => void;
  onPresetChange: (presetId: SessionPresetId) => void;
  onStartSession: (task: Task, nextMinutes?: number, nextPresetId?: SessionPresetId) => void;
  onPause: (kind: 'pause' | 'break' | 'distraction', detail?: string) => void;
  onResume: (nextMinutes: number) => void;
  onFinish: () => void;
  onSwitchTask: () => void;
}) {
  const now = useTickingNow(activeSession?.status === 'running' ? 1000 : 30000);
  const activeSessionMetrics = useMemo(
    () => (activeSession ? getSessionMetrics(activeSession, now) : zeroMetrics),
    [activeSession, now],
  );
  const progressPercent = activeSession
    ? Math.round(
        (activeSessionMetrics.focus_seconds / Math.max(1, activeSession.planned_minutes * 60)) * 100,
      )
    : 0;
  const remainingMinutes = activeSession
    ? Math.max(5, getRemainingMinutes(activeSession, now))
    : minutes;

  return (
    <Card className="rounded-[34px] p-6">
      <div>
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
              {activeSession ? (
                <Badge tone="neutral">
                  {formatDurationFromSeconds(activeSessionMetrics.distraction_seconds)} distracted
                </Badge>
              ) : null}
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
            onChange={onMinutesChange}
            onPresetChange={onPresetChange}
            presetId={presetId}
            value={minutes}
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {!activeSession ? (
            <Button
              disabled={!currentTask}
              onClick={() => currentTask && onStartSession(currentTask, minutes, presetId)}
              size="lg"
              type="button"
            >
              Start {minutes} min
            </Button>
          ) : activeSession.status === 'running' ? (
            <>
              <Button onClick={() => onPause('pause')} size="md" type="button" variant="secondary">
                Pause
              </Button>
              <Button onClick={() => onPause('break')} size="md" type="button" variant="secondary">
                Start break
              </Button>
              <Button
                onClick={() => onPause('distraction', 'Quick distraction')}
                size="md"
                type="button"
                variant="secondary"
              >
                Distracted
              </Button>
              <Button onClick={onFinish} size="md" type="button" variant="ghost">
                Finish session
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => onResume(remainingMinutes)} size="md" type="button">
                Resume remaining
              </Button>
              <Button onClick={() => onResume(10)} size="md" type="button" variant="secondary">
                Resume 10 min
              </Button>
              <Button onClick={onSwitchTask} size="md" type="button" variant="ghost">
                Switch task
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
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
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropLane, setDropLane] = useState<TaskLane | null>(null);
  const dragImageRef = useRef<HTMLImageElement | null>(null);
  const dropHandledRef = useRef(false);
  const activeSession = useMemo(
    () => findActiveSession(sessions, activeSessionId),
    [activeSessionId, sessions],
  );
  const analyticsNow = Date.now();
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const recentCaptures = activeSession ? activeSession.captures.slice(-4).reverse() : [];
  const {
    blockedEntries,
    activeTasks,
    queueTasks,
    nextTasks,
    backlogTasks,
    blockedTasks,
    completedTasks,
    currentTask,
    suggestedTask,
    todaySessions,
    todaySessionCards,
    todayFocusSeconds,
    todayDistractionSeconds,
    todayPauseSeconds,
    todayBreakSeconds,
    todaySwitchCount,
    historyRows,
    hourlyFocus,
    distractionPatterns,
    averageSessionSeconds,
    dailySeries,
    currentWeek,
    estimationAccuracy,
    currentWeekFocus,
    previousWeekFocus,
    currentWeekDistraction,
    previousWeekDistraction,
    focusConsistency,
    doneToday,
    blockersToday,
    nextReviewTasks,
    weeklyCompletedCount,
  } = useMemo(() => {
    const todayDate = new Date(analyticsNow);
    const blocked = getLatestBlockedEntries(sessions);
    const blockedTaskIds = new Set(blocked.map((entry) => entry.taskId));
    const activeSessionTask = activeSession ? tasksById.get(activeSession.task_id) ?? null : null;
    const active = tasks.filter((task) => task.lane === 'now' && task.status !== 'done');
    const queue = tasks.filter((task) => task.lane === 'inbox' && task.status !== 'done');
    const next = tasks.filter((task) => task.lane === 'next' && task.status !== 'done');
    const backlog = tasks.filter((task) => task.lane === 'later' && task.status !== 'done');
    const blockedTaskList = tasks.filter(
      (task) => task.lane !== 'done' && task.status !== 'done' && blockedTaskIds.has(task.id),
    );
    const completed = tasks.filter((task) => task.lane === 'done' || task.status === 'done');
    const selected =
      (selectedTaskId ? tasksById.get(selectedTaskId) ?? null : null) ??
      activeSessionTask ??
      active[0] ??
      queue[0] ??
      next[0] ??
      backlog[0] ??
      null;
    const current = activeSessionTask ?? selected;
    const suggested = getSuggestedTask(tasks, blockedTaskIds, activeSession?.task_id ?? null);
    const today = sessions.filter((session) => isSameCalendarDay(session.started_at, todayDate));
    const todayCards = [...today]
      .sort(
        (left, right) => new Date(right.started_at).getTime() - new Date(left.started_at).getTime(),
      )
      .map((session) => {
        const metrics = getSessionMetrics(session, analyticsNow);

        return {
          id: session.id,
          taskTitle: tasksById.get(session.task_id)?.title ?? session.task_title,
          timeRange: formatTimeRange(session.started_at, session.ended_at),
          focusLabel: formatDurationFromSeconds(metrics.focus_seconds),
          distractionLabel: formatDurationFromSeconds(metrics.distraction_seconds),
          captureCount: session.captures.length,
        };
      });
    const todayTotals = today.reduce(
      (summary, session) => {
        const metrics = getSessionMetrics(session, analyticsNow);

        return {
          focusSeconds: summary.focusSeconds + metrics.focus_seconds,
          pauseSeconds: summary.pauseSeconds + metrics.pause_seconds,
          breakSeconds: summary.breakSeconds + metrics.break_seconds,
          distractionSeconds: summary.distractionSeconds + metrics.distraction_seconds,
        };
      },
      {
        focusSeconds: 0,
        pauseSeconds: 0,
        breakSeconds: 0,
        distractionSeconds: 0,
      },
    );
    const history = buildTaskHistoryRows(sessions, tasks, analyticsNow);
    const hourly = getHourlyFocusBuckets(sessions, analyticsNow)
      .filter((bucket) => bucket.totalSeconds > 0)
      .sort((left, right) => right.totalSeconds - left.totalSeconds);
    const daily = buildDailySeries(sessions, 7, analyticsNow);
    const lastFourteenDays = buildDailySeries(sessions, 14, analyticsNow);
    const previous = lastFourteenDays.slice(0, 7);
    const currentWeekSeries = lastFourteenDays.slice(7);
    const currentFocus = currentWeekSeries.reduce((sum, point) => sum + point.focusSeconds, 0);
    const previousFocus = previous.reduce((sum, point) => sum + point.focusSeconds, 0);
    const currentDistraction = currentWeekSeries.reduce(
      (sum, point) => sum + point.distractionSeconds,
      0,
    );
    const previousDistraction = previous.reduce(
      (sum, point) => sum + point.distractionSeconds,
      0,
    );

    return {
      blockedEntries: blocked,
      activeTasks: active,
      queueTasks: queue,
      nextTasks: next,
      backlogTasks: backlog,
      blockedTasks: blockedTaskList,
      completedTasks: completed,
      currentTask: current,
      suggestedTask: suggested,
      todaySessions: today,
      todaySessionCards: todayCards,
      todayFocusSeconds: todayTotals.focusSeconds,
      todayDistractionSeconds: todayTotals.distractionSeconds,
      todayPauseSeconds: todayTotals.pauseSeconds,
      todayBreakSeconds: todayTotals.breakSeconds,
      todaySwitchCount: getTaskSwitchCount(today),
      historyRows: history,
      hourlyFocus: hourly,
      distractionPatterns: getDistractionPatterns(sessions),
      averageSessionSeconds: getAverageFocusSessionSeconds(sessions, analyticsNow),
      dailySeries: daily,
      currentWeek: currentWeekSeries,
      estimationAccuracy: getTaskEstimationAccuracy(tasks, sessions, analyticsNow),
      currentWeekFocus: currentFocus,
      previousWeekFocus: previousFocus,
      currentWeekDistraction: currentDistraction,
      previousWeekDistraction: previousDistraction,
      focusConsistency: daily.filter((point) => point.focusSeconds > 0).length,
      doneToday: completed.filter((task) => isSameCalendarDay(task.updated_at, todayDate)),
      blockersToday: today.flatMap((session) =>
        session.captures
          .filter((capture) => capture.kind === 'blocker')
          .map((capture) => ({
            taskId: session.task_id,
            taskTitle: tasksById.get(session.task_id)?.title ?? session.task_title,
            content: capture.content,
          })),
      ),
      nextReviewTasks: [...queue, ...next, ...backlog]
        .sort((left, right) => priorityValue(right.priority) - priorityValue(left.priority))
        .slice(0, 3),
      weeklyCompletedCount: completed.filter(
        (task) =>
          new Date(task.updated_at).getTime() >= analyticsNow - 7 * 24 * 60 * 60 * 1000,
      ).length,
    };
  }, [
    activeSession,
    analyticsNow,
    selectedTaskId,
    sessions,
    tasks,
    tasksById,
  ]);
  const blockedEntryByTaskId = useMemo(
    () => new Map(blockedEntries.map((entry) => [entry.taskId, entry])),
    [blockedEntries],
  );
  const taskBoard = useMemo(
    () => [
      { ...taskBoardColumns[0], tasks: activeTasks },
      { ...taskBoardColumns[1], tasks: queueTasks },
      { ...taskBoardColumns[2], tasks: nextTasks },
      { ...taskBoardColumns[3], tasks: backlogTasks },
      { ...taskBoardColumns[4], tasks: completedTasks },
    ],
    [activeTasks, backlogTasks, completedTasks, nextTasks, queueTasks],
  );

  useEffect(() => {
    const image = new Image();
    image.src =
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjwvc3ZnPg==';
    dragImageRef.current = image;
  }, []);

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

  function clearBoardDragState() {
    dropHandledRef.current = false;
    setDraggedTaskId(null);
    setDropLane(null);
  }

  function handleTaskDragStart(event: ReactDragEvent<HTMLDivElement>, taskId: string) {
    dropHandledRef.current = false;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);

    if (dragImageRef.current) {
      event.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
    }

    setDraggedTaskId(taskId);
  }

  function handleTaskDragEnd() {
    if (dropHandledRef.current) {
      return;
    }

    clearBoardDragState();
  }

  function handleTaskLaneDrop(event: ReactDragEvent<HTMLDivElement>, lane: TaskLane) {
    event.preventDefault();

    const taskId = draggedTaskId ?? event.dataTransfer.getData('text/plain');

    if (!taskId) {
      clearBoardDragState();
      return;
    }

    const task = tasksById.get(taskId);

    if (!task || task.lane === lane) {
      clearBoardDragState();
      return;
    }

    dropHandledRef.current = true;
    void moveTaskToLane(task.id, lane, 'main');

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        clearBoardDragState();
      });
    });
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
                    setActiveView('tasks');
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
          <TodayFocusCard
            activeSession={activeSession}
            currentTask={currentTask}
            minutes={minutes}
            onFinish={handleFinishSession}
            onMinutesChange={setMinutes}
            onPause={handlePause}
            onPresetChange={setPresetId}
            onResume={handleResume}
            onStartSession={handleStartSession}
            onSwitchTask={() => setActiveView('tasks')}
            presetId={presetId}
          />

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
              {todaySessionCards.length ? (
                todaySessionCards.map((session) => (
                  <div
                    className="flex flex-col gap-3 rounded-[24px] border border-borderSoft/30 bg-panel/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={session.id}
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{session.taskTitle}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {session.timeRange} · {session.focusLabel}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge tone="neutral">{session.captureCount} captures</Badge>
                      <Badge tone="warning">{session.distractionLabel} distracted</Badge>
                    </div>
                  </div>
                ))
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
                          setActiveView('tasks');
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
        {taskComposerOpen ? (
          <Card className="rounded-[34px] p-6">
            <SectionHeading title="Add task" />
            <TaskCreationComposer
              autoFocus
              fillHeight={false}
              initialMode="interaction"
              onCancel={() => setTaskComposerOpen(false)}
              onSubmitted={() => {
                setTaskComposerOpen(false);
                setActiveView('tasks');
              }}
              source="main"
              submitLabel="Save task"
            />
          </Card>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {taskBoard.map((column) => (
            <Card
              className={cn(
                'kanban-column flex min-h-[320px] flex-col rounded-[34px] p-5',
                dropLane === column.lane ? 'border-accent/30 bg-accent/8 shadow-[0_18px_44px_rgb(var(--accent)/0.12)]' : null,
              )}
              key={column.lane}
              onDragOver={(event) => {
                if (!draggedTaskId) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';

                if (dropLane !== column.lane) {
                  setDropLane(column.lane);
                }
              }}
              onDrop={(event) => void handleTaskLaneDrop(event, column.lane)}
            >
              <SectionHeading
                action={<Badge tone={column.tone}>{column.tasks.length}</Badge>}
                title={column.title}
              />

              <div className="flex-1 space-y-3">
                {column.tasks.length ? (
                  column.tasks.map((task) => {
                    const blocker = blockedEntryByTaskId.get(task.id);
                    const isComplete = column.lane === 'done';

                    return (
                      <TaskListItem
                        active={activeSession?.task_id === task.id}
                        blocked={Boolean(blocker)}
                        className="kanban-card"
                        draggable
                        dragging={draggedTaskId === task.id}
                        footer={
                          isComplete ? (
                            <p className="text-xs text-text-muted">Completed {formatRelativeTime(task.updated_at)}</p>
                          ) : (
                            <div className="space-y-3">
                              {blocker ? (
                                <p className="text-sm text-warning">{blocker.blocker}</p>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                <Button onClick={() => handleStartSession(task)} size="sm" type="button">
                                  Focus
                                </Button>
                                <Button
                                  onClick={() => void markDone(task.id, 'main')}
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  Done
                                </Button>
                              </div>
                            </div>
                          )
                        }
                        key={task.id}
                        onDragEnd={handleTaskDragEnd}
                        onDragStart={(event) => handleTaskDragStart(event, task.id)}
                        onSelect={() => selectTask(task.id)}
                        task={task}
                      />
                    );
                  })
                ) : (
                  <div
                    className={cn(
                      'flex min-h-[140px] items-center justify-center rounded-[24px] border border-dashed p-5 text-sm text-text-secondary transition-[border-color,background-color,color] duration-150',
                      dropLane === column.lane
                        ? 'border-accent/30 bg-accent/8 text-text-primary'
                        : 'border-borderSoft/35 bg-panel/18',
                    )}
                  >
                    {column.empty}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {blockedTasks.length ? (
          <Card className="rounded-[34px] p-5">
            <SectionHeading action={<Badge tone="warning">{blockedTasks.length}</Badge>} title="Blocked" />

            <div className="grid gap-3 lg:grid-cols-2">
              {blockedTasks.map((task) => {
                const blocker = blockedEntryByTaskId.get(task.id);

                return (
                  <div className="rounded-[24px] border border-warning/18 bg-warning/7 p-4" key={task.id}>
                    <div className="flex items-center justify-between gap-3">
                      <button
                        className="min-w-0 text-left"
                        onClick={() => selectTask(task.id)}
                        type="button"
                      >
                        <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                      </button>
                      <Badge tone="warning">Blocked</Badge>
                    </div>

                    {blocker ? <p className="mt-3 text-sm text-text-secondary">{blocker.blocker}</p> : null}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}
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
                  <div className="history-row-lite overflow-hidden rounded-[28px] border border-borderSoft/30 bg-panel/42" key={row.taskId}>
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

                    {expanded ? (
                      <div className="border-t border-borderSoft/24">
                        <div className="grid gap-6 px-5 py-5 lg:grid-cols-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Sessions</p>
                            <div className="mt-3 space-y-2">
                              {row.sessions.map((session) => (
                                <div className="rounded-[20px] border border-borderSoft/24 bg-panel2/44 px-4 py-3" key={session.id}>
                                  <p className="text-sm text-text-primary">{formatTimeRange(session.started_at, session.ended_at)}</p>
                                  <p className="mt-1 text-xs text-text-muted">
                                    {formatDurationFromSeconds(getSessionMetrics(session, analyticsNow).focus_seconds)} focused
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
                      </div>
                    ) : null}
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
                <span className="text-sm font-medium text-text-primary">{weeklyCompletedCount} completed</span>
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
                onClick={() => setActiveView(view.id)}
                />
              ))}
          </div>

          <div className="mt-auto">
            <SidebarLiveStatus activeSession={activeSession} />
          </div>
        </aside>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-borderSoft/24 px-6 py-5">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold text-text-primary">{viewCopy}</h2>
            </div>

            <div className="flex items-center gap-3">
              {activeView === 'tasks' ? (
                taskComposerOpen ? (
                  <Button onClick={() => setTaskComposerOpen(false)} size="sm" type="button" variant="ghost">
                    Close
                  </Button>
                ) : (
                  <Button onClick={() => setTaskComposerOpen(true)} size="sm" type="button">
                    Create task
                  </Button>
                )
              ) : null}
              <HeaderClock />
              <Button onClick={() => void showQuickAddWindow()} size="sm" type="button" variant="secondary">
                Quick Add
              </Button>
              <Button onClick={() => void showHudWindow()} size="sm" type="button" variant="ghost">
                HUD
              </Button>
            </div>
          </header>

          <main className="main-scroll-region relative flex-1 overflow-x-hidden overflow-y-auto px-6 py-6">
            {activeView === 'today' ? renderToday() : null}
            {activeView === 'tasks' ? renderTasks() : null}
            {activeView === 'history' ? renderHistory() : null}
            {activeView === 'insights' ? renderInsights() : null}
            {activeView === 'review' ? renderReview() : null}

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
