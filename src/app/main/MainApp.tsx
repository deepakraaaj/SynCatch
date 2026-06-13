import {
  type DragEvent as ReactDragEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Crosshair, Sun, CheckSquare, Target, MoreHorizontal, CheckCircle2, Zap, Rocket, Clock, BarChart3, ClipboardList, Settings, Lightbulb, Link2, AlertCircle, Pin, FileText, ArrowUpRight, RotateCcw, Cloud, Pencil, Trash2, Play, Pause, CheckCircle, Menu, X, Plus, CalendarDays, ChevronDown, CornerDownRight, BookHeart, StickyNote, Wifi, WifiOff, MessageCircle, type LucideIcon } from 'lucide-react';
import { MissionIcon } from '../../components/ui/mission-icon';
import { DatePicker } from '../../components/ui/date-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Textarea } from '../../components/ui/input';
import { AnimatedLoading } from '../../components/animated-loading';
import { ProfileSettingsCard } from '../../features/auth/ProfileSettingsCard';
import { useAuthStore } from '../../features/auth/auth-store';
import { useSyncStore } from '../../features/sync/sync-store';
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
import { useSettingsStore } from '../../features/settings/settings-store';
import type { SidebarPinnedAppId } from '../../features/preferences/preferences-types';
import { MissionComposer } from '../../features/missions/MissionComposer';
import { useMissionStore } from '../../features/missions/mission-store';
import { RoadmapView } from '../../features/roadmap/RoadmapView';
import { JournalView } from '../../features/journal/JournalView';
import { NotesView } from '../../features/notes/NotesView';
import { AssistantView } from '../../features/assistant/AssistantView';
import { AssistantWidget } from '../../features/assistant/AssistantWidget';
import { TaskCreationComposer } from '../../features/tasks/TaskCreationComposer';
import { TaskDetailPanel } from '../../features/tasks/TaskDetailPanel';
import { getRootTasks, humanizePriority } from '../../features/tasks/task-helpers';
import { useTaskStore } from '../../features/tasks/task-store';
import { useThemeStore } from '../../features/themes/theme-store';
import { THEMES } from '../../features/themes/themes';
import type { Mission } from '../../features/missions/mission-types';
import type { Task, TaskEnergy, TaskLane } from '../../features/tasks/task-types';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../lib/date';
import { showHudWindow, showQuickAddWindow, subscribeAppEvent } from '../../lib/tauri';
import { useIsMobile } from '../../hooks/use-mobile';

type MainView = 'focus' | 'missions' | 'roadmap' | 'today' | 'tasks' | 'history' | 'insights' | 'review' | 'journal' | 'notes' | 'assistant' | 'settings' | 'apps';

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

type CompletedFilterMode = 'all' | 'today' | '7d' | 'custom';

const launcherViews: Array<{
  id: SidebarPinnedAppId;
  label: string;
  icon: LucideIcon;
  caption?: string;
  description: string;
  gradient: string;
}> = [
  {
    id: 'focus',
    label: 'What Now',
    icon: Zap,
    description: 'Get back into motion',
    gradient: 'from-cyan-500 via-sky-500 to-blue-600',
  },
  {
    id: 'missions',
    label: 'Missions',
    icon: Rocket,
    description: 'Track larger goals',
    gradient: 'from-fuchsia-500 via-pink-500 to-rose-500',
  },
  {
    id: 'roadmap',
    label: 'Roadmap',
    icon: Target,
    description: 'Plan the next moves',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
  },
  {
    id: 'today',
    label: 'Today',
    icon: Sun,
    description: 'See what matters now',
    gradient: 'from-amber-400 via-orange-500 to-rose-500',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    description: 'Manage task flow',
    gradient: 'from-violet-500 via-purple-500 to-indigo-500',
  },
  {
    id: 'history',
    label: 'History',
    icon: Clock,
    description: 'Review recent work',
    gradient: 'from-stone-500 via-zinc-500 to-slate-600',
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: BarChart3,
    description: 'Spot patterns quickly',
    gradient: 'from-lime-500 via-green-500 to-emerald-500',
  },
  {
    id: 'review',
    label: 'Review',
    icon: ClipboardList,
    description: 'Close the loop',
    gradient: 'from-sky-500 via-cyan-500 to-teal-500',
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: BookHeart,
    description: 'Capture reflections',
    gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: StickyNote,
    description: 'Store quick snippets',
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
  },
  {
    id: 'assistant',
    label: 'Assistant',
    icon: MessageCircle,
    description: 'Ask, plan, or draft',
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    description: 'Tune the workspace',
    gradient: 'from-slate-500 via-zinc-500 to-stone-600',
  },
];

const captureOptions: Array<{
  kind: SessionCaptureKind;
  icon: LucideIcon;
  label: string;
  placeholder: string;
}> = [
  { kind: 'idea', icon: Lightbulb, label: 'Idea', placeholder: 'What hit you?' },
  { kind: 'resource', icon: Link2, label: 'Resource', placeholder: 'Paste a link' },
  {
    kind: 'distraction',
    icon: Pin,
    label: 'Distraction',
    placeholder: 'What pulled you away?',
  },
  { kind: 'note', icon: FileText, label: 'Note', placeholder: 'Tiny note' },
  { kind: 'blocker', icon: AlertCircle, label: 'Blocker', placeholder: 'What is blocking you?' },
  {
    kind: 'follow-up',
    icon: ArrowUpRight,
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

const completedDigestLimit = 3;
const completedFilterSummaryFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function getCompletedFilterModeLabel(mode: CompletedFilterMode) {
  if (mode === 'today') {
    return 'Today';
  }

  if (mode === '7d') {
    return '7d';
  }

  if (mode === 'custom') {
    return 'Custom';
  }

  return 'All';
}

function getCompletedFilterTone(mode: CompletedFilterMode): 'neutral' | 'accent' | 'success' | 'warning' {
  if (mode === 'today') {
    return 'accent';
  }

  if (mode === '7d') {
    return 'warning';
  }

  if (mode === 'custom') {
    return 'success';
  }

  return 'neutral';
}

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
  const text = (task.next_action || task.notes || '').trim();

  if (text.length <= 72) {
    return text;
  }

  return `${text.slice(0, 72).trim()}…`;
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getTaskCompletionTimestamp(task: Task) {
  const timestamp = new Date(task.completed_at ?? task.updated_at).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getCompletedDigestItems(tasks: Task[], subtasks: Task[]) {
  return [...tasks, ...subtasks].sort(
    (left, right) => getTaskCompletionTimestamp(right) - getTaskCompletionTimestamp(left),
  );
}

function getLocalDateTimeTimestamp(dateValue: string | null, timeValue: string, endOfDay = false) {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] = dateValue.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const [hoursRaw, minutesRaw] = timeValue.split(':').map(Number);
  const hours = Number.isFinite(hoursRaw) ? hoursRaw : endOfDay ? 23 : 0;
  const minutes = Number.isFinite(minutesRaw) ? minutesRaw : endOfDay ? 59 : 0;

  return new Date(year, month - 1, day, hours, minutes, endOfDay ? 59 : 0, endOfDay ? 999 : 0).getTime();
}

function getTaskBoardTimestamp(task: Task) {
  return new Date(task.completed_at ?? task.updated_at ?? task.created_at).getTime();
}

function taskMatchesBoardRange(task: Task, fromTimestamp: number | null, toTimestamp: number | null) {
  const timestamp = getTaskBoardTimestamp(task);

  if (fromTimestamp !== null && timestamp < fromTimestamp) {
    return false;
  }

  if (toTimestamp !== null && timestamp > toTimestamp) {
    return false;
  }

  return true;
}

function getCompletedFilterSummary(mode: CompletedFilterMode, fromTimestamp: number | null, toTimestamp: number | null) {
  if (mode === 'all') {
    return 'Showing the full task board';
  }

  if (mode === 'today') {
    return 'Showing items from today';
  }

  if (mode === '7d') {
    return 'Showing items from the last 7 days';
  }

  if (fromTimestamp && toTimestamp) {
    return `Showing ${completedFilterSummaryFormatter.format(fromTimestamp)} to ${completedFilterSummaryFormatter.format(toTimestamp)}`;
  }

  if (fromTimestamp) {
    return `Showing from ${completedFilterSummaryFormatter.format(fromTimestamp)}`;
  }

  if (toTimestamp) {
    return `Showing up to ${completedFilterSummaryFormatter.format(toTimestamp)}`;
  }

  return 'Pick a date and time range';
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
  const labels: Record<MainView, string> = {
    focus: 'What Now',
    missions: 'Missions',
    roadmap: 'Roadmap',
    today: 'Today',
    tasks: 'Tasks',
    history: 'History',
    insights: 'Insights',
    review: 'Review',
    journal: 'Journal',
    notes: 'Notes',
    assistant: 'Assistant',
    settings: 'Settings',
    apps: 'Apps',
  };
  return labels[view] ?? 'Today';
}

function NavButton({
  active,
  label,
  icon: Icon,
  caption,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  caption?: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-3 rounded-[20px] border px-4 py-2.5 text-left transition-all duration-150',
        active
          ? 'border-accent/35 bg-accent/12 shadow-[0_4px_16px_rgba(var(--accent),0.08)]'
          : 'border-transparent bg-panel/38 hover:border-borderSoft/40 hover:bg-panel/56',
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-text-muted')} />
      <div className="min-w-0">
        <p className={cn('text-[15px] font-semibold tracking-tight', active ? 'text-text-primary' : 'text-text-secondary')}>{label}</p>
        {caption ? <p className="mt-0.5 hidden text-[11px] text-text-muted sm:block">{caption}</p> : null}
      </div>
    </button>
  );
}

function AppLauncherTile({
  active,
  pinned,
  label,
  description,
  icon: Icon,
  gradient,
  onClick,
  onTogglePinned,
}: {
  active: boolean;
  pinned: boolean;
  label: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  onClick: () => void;
  onTogglePinned: () => void;
}) {
  return (
    <div
      className={cn(
        'group relative flex min-h-[112px] w-full flex-col justify-between rounded-[24px] border p-4 text-left transition-all duration-150',
        active
          ? 'border-accent/35 bg-accent/12 shadow-[0_10px_28px_rgba(var(--accent),0.10)]'
          : 'border-borderSoft/30 bg-panel/42 hover:-translate-y-0.5 hover:border-borderSoft/45 hover:bg-panel/60',
      )}
    >
      <button
        type="button"
        className="absolute inset-0 rounded-[24px] text-left"
        onClick={onClick}
      >
        <span className="sr-only">Open {label}</span>
      </button>

      <button
        type="button"
        className={cn(
          'absolute right-3 top-3 z-10 inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors',
          pinned
            ? 'border-accent/25 bg-accent/15 text-accent'
            : 'border-borderSoft/35 bg-panel/70 text-text-muted hover:text-text-primary',
        )}
        onClick={(event) => {
          event.stopPropagation();
          onTogglePinned();
        }}
      >
        {pinned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        {pinned ? 'Pinned' : 'Pin'}
      </button>

      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br shadow-[0_14px_24px_rgba(0,0,0,0.18)] ring-1 ring-white/15',
            gradient,
          )}
        >
          <Icon className="h-5 w-5 text-white drop-shadow-sm" />
        </div>

        {active ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" /> : null}
      </div>

      <div className="relative z-[1] min-w-0">
        <p className={cn('text-sm font-semibold tracking-tight', active ? 'text-text-primary' : 'text-text-secondary')}>
          {label}
        </p>
        <p className="mt-1 text-[11px] text-text-muted">{description}</p>
      </div>
    </div>
  );
}

function SidebarContent({
  activeSession,
  pinnedAppIds,
  onOpenApps,
  onViewSelect,
  activeView,
}: {
  activeSession: WorkSession | null;
  pinnedAppIds: SidebarPinnedAppId[];
  onOpenApps: () => void;
  onViewSelect: (view: MainView) => void;
  activeView: MainView;
}) {
  return (
    <div className="flex h-full flex-col">
      <div>
        <p className="text-[11px] uppercase tracking-[0.32em] text-text-muted">MissionControl</p>
        <h1 className="mt-3 text-2xl font-semibold text-text-primary">Focus</h1>
      </div>

      <div className="mt-8 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] border border-borderSoft/25 bg-panel/20 px-4 py-3 text-left transition-all duration-150 hover:border-borderSoft/35 hover:bg-panel/30"
            onClick={onOpenApps}
          >
            <div className="grid h-11 w-11 shrink-0 grid-cols-2 gap-1 rounded-[16px] bg-panel/70 p-1 ring-1 ring-borderSoft/30">
              <span className="rounded-[4px] bg-cyan-400" />
              <span className="rounded-[4px] bg-fuchsia-400" />
              <span className="rounded-[4px] bg-amber-400" />
              <span className="rounded-[4px] bg-emerald-400" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-text-muted">Apps</p>
              <p className="mt-1 text-xs text-text-secondary">Open the launcher in workspace</p>
            </div>
          </button>
        </div>

        {pinnedAppIds.length > 0 ? (
          <div className="space-y-2 pt-1">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-text-muted">
              Pinned apps
            </p>
            {launcherViews
              .filter((view) => pinnedAppIds.includes(view.id))
              .map((view) => (
                <NavButton
                  active={activeView === view.id}
                  caption={view.description}
                  icon={view.icon}
                  key={view.id}
                  label={view.label}
                  onClick={() => onViewSelect(view.id)}
                />
              ))}
          </div>
        ) : (
          <p className="px-2 text-[11px] text-text-muted">Pin apps from the workspace to show them here.</p>
        )}
      </div>

      <div className="mt-auto">
        <SidebarLiveStatus activeSession={activeSession} />
      </div>
    </div>
  );
}

function AppsWorkspacePage({
  activeView,
  onViewSelect,
  onClose,
  pinnedAppIds,
  onTogglePinnedApp,
}: {
  activeView: MainView;
  onViewSelect: (view: MainView) => void;
  onClose: () => void;
  pinnedAppIds: SidebarPinnedAppId[];
  onTogglePinnedApp: (appId: SidebarPinnedAppId) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Card className="rounded-[34px] p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Workspace</p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">Apps</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              Open any area as a full page from here. This lives in the workspace, not the sidebar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={onClose} size="sm" type="button" variant="ghost" className="h-9 w-9 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {launcherViews.map((view) => (
          <AppLauncherTile
            active={activeView === view.id}
            description={view.description}
            gradient={view.gradient}
            icon={view.icon}
            key={view.id}
            label={view.label}
            pinned={pinnedAppIds.includes(view.id)}
            onClick={() => onViewSelect(view.id)}
            onTogglePinned={() => onTogglePinnedApp(view.id)}
          />
        ))}
      </div>
    </div>
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
    <Card className="rounded-[20px] p-3 sm:rounded-[28px] sm:p-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted truncate">{label}</p>
      <p className={cn('mt-1 text-lg font-bold leading-none sm:mt-4 sm:text-[2rem]', toneClass)}>{value}</p>
      {caption ? <p className="mt-1.5 text-[10px] text-text-secondary sm:mt-3 sm:text-sm line-clamp-1">{caption}</p> : null}
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
    <div className="mb-4 flex items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-text-primary sm:text-lg truncate">{title}</h2>
        {detail ? <p className="mt-0.5 text-xs text-text-secondary sm:text-sm line-clamp-1">{detail}</p> : null}
      </div>
      <div className="shrink-0">
        {action}
      </div>
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

function SyncStatusCard() {
  const { pendingCount, lastSyncedAt, isSyncing, syncNow } = useSyncStore();
  const isOnline = navigator.onLine;

  const statusDot = isSyncing ? 'bg-accent' : pendingCount > 0 ? 'bg-warning' : 'bg-success';
  const statusLabel = isSyncing ? 'Syncing' : pendingCount > 0 ? `${pendingCount} pending` : 'All synced';

  return (
    <Card className="rounded-[34px] p-6">
      <SectionHeading action={<Badge tone={pendingCount > 0 ? 'warning' : 'success'}>Live</Badge>} title="Sync" />

      <div className="space-y-4">
        <div className="rounded-[24px] border border-borderSoft/30 bg-panel/32 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('h-3 w-3 rounded-full', statusDot, isSyncing && 'animate-pulse')} />
              <div>
                <p className="text-sm font-medium text-text-primary">{statusLabel}</p>
                {lastSyncedAt ? (
                  <p className="mt-1 text-sm text-text-secondary">
                    Last synced {formatRelativeTime(lastSyncedAt)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-text-secondary">Never synced</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isOnline ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-text-muted" />}
              <Button
                disabled={!isOnline || isSyncing || pendingCount === 0}
                onClick={() => void syncNow()}
                size="sm"
                type="button"
                variant={pendingCount > 0 ? 'primary' : 'secondary'}
              >
                {isSyncing ? 'Syncing' : 'Sync now'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SettingChoice({
  active,
  children,
  disabled,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.02em] transition-colors duration-150',
        active
          ? 'border-accent bg-accent text-[rgb(var(--accent-contrast))] shadow-glow'
          : 'border-borderSoft/35 bg-panel/30 text-text-secondary hover:border-borderStrong/35 hover:bg-panel/50',
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
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
        'group main-list-item rounded-[20px] border p-3 transition-[transform,opacity,border-color,background-color,box-shadow] duration-150 ease-out',
        selected
          ? 'is-selected border-accent/40 bg-accent/10 shadow-[0_4px_20px_rgba(var(--accent),0.08)]'
          : 'border-borderSoft/50 bg-panel/42 hover:border-accent/30 hover:bg-panel/56',
        draggable ? 'cursor-grab active:cursor-grabbing' : null,
        dragging ? 'scale-[0.985] border-accent/26 bg-accent/8 opacity-45 shadow-none' : null,
        className,
      )}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
    >
      <button className="w-full text-left" onClick={onSelect} type="button">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-[14px] font-bold tracking-tight text-text-primary sm:text-[15px]">{task.title}</p>
            <div className="flex shrink-0 gap-1">
              {active ? <Badge tone="accent" className="shrink-0 text-[9px] px-1.5">Live</Badge> : null}
              {blocked ? <Badge tone="warning" className="shrink-0 text-[9px] px-1.5">Blocked</Badge> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge className="shrink-0 px-1.5 py-0.5 text-[10px]" tone={getTaskTone(task)}>{humanizePriority(task.priority)}</Badge>
            <Badge className="shrink-0 px-1.5 py-0.5 text-[10px]" tone="neutral">{task.estimated_minutes}m</Badge>
          </div>
        </div>
        {describeTask(task) ? (
          <p className="mt-1.5 text-[14px] leading-snug text-text-secondary">
            {describeTask(task)}
          </p>
        ) : null}
      </button>

      {footer ? (
        <div className="mt-0 h-0 opacity-0 group-hover:mt-3 group-hover:h-auto group-hover:opacity-100 group-[.is-selected]:mt-3 group-[.is-selected]:h-auto group-[.is-selected]:opacity-100 transition-all duration-200 overflow-hidden">
          <div className="border-t border-borderSoft/20 pt-3">
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SubtaskBoardItem({
  task,
  active,
  dragging,
  draggable,
  onDragEnd,
  onDragStart,
  onFocus,
  onDone,
  onDetail,
  onSelect,
}: {
  task: Task;
  active?: boolean;
  dragging?: boolean;
  draggable?: boolean;
  onDragEnd?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  onDone: () => void;
  onDetail: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'group main-list-item rounded-[16px] border border-borderSoft/40 bg-panel2/34 p-2.5 transition-[transform,opacity,border-color,background-color,box-shadow] duration-150 ease-out',
        draggable ? 'cursor-grab active:cursor-grabbing' : null,
        dragging ? 'scale-[0.985] border-accent/26 bg-accent/8 opacity-45 shadow-none' : null,
      )}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
    >
      <button className="w-full text-left" onClick={onSelect} type="button">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-[13px] font-bold tracking-tight text-text-primary">{task.title}</p>
            {active ? <Badge tone="accent" className="shrink-0 text-[8px] px-1.2 py-0">Live</Badge> : null}
          </div>
          <div className="flex items-center gap-1.5">
            <Badge className="px-1.5 py-0.5 text-[9px]" tone={getTaskTone(task)}>{humanizePriority(task.priority)}</Badge>
          </div>
        </div>
      </button>

      <div className="h-0 opacity-0 group-hover:h-auto group-hover:opacity-100 group-hover:mt-2.5 transition-all duration-200 overflow-hidden">
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          <button 
            onClick={onFocus} 
            className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors"
          >
            Focus
          </button>
          <button 
            onClick={onDone} 
            className="rounded-full bg-borderSoft/20 px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-borderSoft/30 transition-colors"
          >
            Done
          </button>
          <button 
            onClick={onDetail} 
            className="rounded-full bg-borderSoft/20 px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-borderSoft/30 transition-colors"
          >
            Detail
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletedDigestItem({
  task,
  parentTask,
  dragging,
  draggable,
  onDragEnd,
  onDragStart,
  onRestore,
  onSelect,
}: {
  task: Task;
  parentTask: Task | null;
  dragging?: boolean;
  draggable?: boolean;
  onDragEnd?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onRestore: () => void;
  onSelect: () => void;
}) {
  const isSubtask = Boolean(parentTask);

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-[16px] border p-2.5 transition-[transform,opacity,border-color,background-color] duration-150',
        draggable ? 'cursor-grab active:cursor-grabbing' : null,
        isSubtask
          ? 'border-accent/18 bg-accent/7 hover:border-accent/28 hover:bg-accent/10'
          : 'border-success/18 bg-success/7 hover:border-success/28 hover:bg-success/10',
        dragging ? 'scale-[0.985] opacity-45' : null,
      )}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
    >
      <button className="min-w-0 flex-1 text-left" onClick={onSelect} type="button">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
              isSubtask ? 'border-accent/28 bg-accent/12 text-accent' : 'border-success/28 bg-success/12 text-success',
            )}
          >
            {isSubtask ? <CornerDownRight className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-text-primary">{task.title}</p>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.22em]',
                  isSubtask
                    ? 'border-accent/24 bg-accent/12 text-accent'
                    : 'border-success/24 bg-success/12 text-success',
                )}
              >
                {isSubtask ? 'Subtask' : 'Task'}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] text-text-muted">
              {isSubtask ? `Parent: ${parentTask?.title ?? 'Unknown task'}` : `Completed ${formatRelativeTime(task.updated_at)}`}
            </p>
          </div>
        </div>
      </button>

      <button
        aria-label={`Restore ${task.title} to queue`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted opacity-80 transition-colors hover:bg-panel/70 hover:text-text-primary group-hover:opacity-100"
        onClick={onRestore}
        title="Restore to queue"
        type="button"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CompletedFilterPanel({
  mode,
  fromDate,
  fromTime,
  toDate,
  toTime,
  onModeChange,
  onFromDateChange,
  onFromTimeChange,
  onToDateChange,
  onToTimeChange,
  onClear,
}: {
  mode: CompletedFilterMode;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  onModeChange: (mode: CompletedFilterMode) => void;
  onFromDateChange: (value: string) => void;
  onFromTimeChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onToTimeChange: (value: string) => void;
  onClear: () => void;
}) {
  const modes: Array<{ id: CompletedFilterMode; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7d' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-4 rounded-full border border-borderSoft/30 bg-panel/24 p-1">
          {modes.map((item) => {
            const active = mode === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onModeChange(item.id)}
                className={cn(
                  'rounded-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors',
                  active
                    ? 'bg-accent/14 text-accent shadow-[0_0_0_1px_rgb(var(--accent)/0.12)]'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <Button
          aria-label="Clear completed filter"
          className="h-9 w-9 shrink-0 rounded-full p-0"
          onClick={onClear}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {mode === 'custom' ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <CalendarDays className="h-3.5 w-3.5 text-accent" />
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">Custom range</p>
          </div>

          <div className="space-y-2">
            <div className="rounded-[18px] border border-borderSoft/30 bg-panel/30 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">From</span>
                <Clock className="h-3.5 w-3.5 text-text-muted" />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    onChange={(value) => onFromDateChange(value ?? '')}
                    placeholder="Start date"
                    value={fromDate || null}
                  />
                </div>
                <Input
                  className="h-9 w-full rounded-[14px] px-3 text-sm sm:w-[104px]"
                  onChange={(event) => onFromTimeChange(event.target.value)}
                  type="time"
                  value={fromTime}
                />
              </div>
            </div>

            <div className="rounded-[18px] border border-borderSoft/30 bg-panel/30 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">To</span>
                <Clock className="h-3.5 w-3.5 text-text-muted" />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    onChange={(value) => onToDateChange(value ?? '')}
                    placeholder="End date"
                    value={toDate || null}
                  />
                </div>
                <Input
                  className="h-9 w-full rounded-[14px] px-3 text-sm sm:w-[104px]"
                  onChange={(event) => onToTimeChange(event.target.value)}
                  type="time"
                  value={toTime}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function groupSubtasksByParent(
  subtasks: Task[],
  tasksById: Map<string, Task>,
) {
  const groups = new Map<string, { parentTask: Task | null; tasks: Task[] }>();

  subtasks.forEach((task) => {
    const parentId = task.parent_task_id ?? `orphan-${task.id}`;
    const existing = groups.get(parentId);

    if (existing) {
      existing.tasks.push(task);
      return;
    }

    groups.set(parentId, {
      parentTask: task.parent_task_id ? tasksById.get(task.parent_task_id) ?? null : null,
      tasks: [task],
    });
  });

  return [...groups.values()];
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
  const OptionIcon = option.icon;

  return (
    <div className="capture-popup-shell absolute bottom-6 right-6 z-30 w-full max-w-[360px] sm:w-[360px]">
      <Card className="rounded-[28px] border border-accent/20 bg-panel/94 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">{option.label}</p>
            <h3 className="mt-2 flex items-center gap-2 text-lg font-semibold text-text-primary">
              <OptionIcon className="h-4 w-4 text-accent" />
              Quick capture
            </h3>
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
    <div className="hidden h-9 items-center rounded-full border border-borderSoft/32 bg-panel/40 px-4 text-sm font-medium text-text-secondary lg:flex">
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
    <Card className="rounded-[22px] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">
            {activeSession ? activeSession.task_title : 'Idle'}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-secondary">
            <span className="font-mono">
              {activeSession ? formatClock(metrics.focus_seconds) : '00:00:00'}
            </span>
            {activeSession && (
              <>
                <span className="h-0.5 w-0.5 rounded-full bg-text-muted" />
                <span className="capitalize">{activeSession.status}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className={cn('h-1.5 w-1.5 rounded-full', activeSession ? 'animate-pulse bg-accent' : 'bg-text-muted/30')} />
          <span className={cn('text-[10px] font-bold uppercase tracking-wider', activeSession ? 'text-accent' : 'text-text-muted')}>
            {activeSession ? 'Live' : 'Off'}
          </span>
        </div>
      </div>
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
    <Card className="rounded-[22px] p-3.5 sm:rounded-[34px] sm:p-6">
      <div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-text-muted">Current focus</p>
            <h2 className="mt-1 text-lg font-bold leading-tight text-text-primary sm:mt-2 sm:text-3xl">
              {currentTask?.title ?? 'Pick a task'}
            </h2>
          </div>

          <div className="grid w-full gap-3 rounded-[20px] border border-borderSoft/30 bg-panel/46 p-3 sm:min-w-[220px] sm:w-auto sm:rounded-[26px] sm:p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-text-muted">Live timer</p>
              <p className="mt-1 text-[1.8rem] font-bold leading-none text-text-primary sm:mt-2 sm:text-[2.6rem]">
                {formatClock(activeSessionMetrics.focus_seconds)}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge tone={activeSession?.status === 'paused' ? 'warning' : 'accent'} className="text-[9px] px-1.5">
                {activeSession?.status === 'paused' ? 'Paused' : activeSession ? 'Running' : 'Ready'}
              </Badge>
              <Badge tone="neutral" className="text-[9px] px-1.5">{activeSession?.planned_minutes ?? minutes}m target</Badge>
              {activeSession ? (
                <Badge tone="neutral" className="text-[9px] px-1.5">
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
  const themeId = useThemeStore((state) => state.themeId);
  const setTheme = useThemeStore((state) => state.setTheme);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const quickAddShortcut = useSettingsStore((state) => state.quickAddShortcut);
  const focusPromptStyle = useSettingsStore((state) => state.focusPromptStyle);
  const syncMode = useSettingsStore((state) => state.syncMode);
  const sidebarPinnedApps = useSettingsStore((state) => state.sidebarPinnedApps);
  const deleteMission = useMissionStore((state) => state.deleteMission);
  const launchAtLogin = useSettingsStore((state) => state.launchAtLogin);
  const launchAtLoginPending = useSettingsStore((state) => state.launchAtLoginPending);
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion);
  const setFocusPromptStyle = useSettingsStore((state) => state.setFocusPromptStyle);
  const setSyncMode = useSettingsStore((state) => state.setSyncMode);
  const setLaunchAtLogin = useSettingsStore((state) => state.setLaunchAtLogin);
  const toggleSidebarPinnedApp = useSettingsStore((state) => state.toggleSidebarPinnedApp);
  const tasks = useTaskStore((state) => state.tasks);
  const tasksHydrated = useTaskStore((state) => state.hydrated);
  const tasksLoading = useTaskStore((state) => state.loading);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const createTask = useTaskStore((state) => state.createTask);
  const moveTaskToLane = useTaskStore((state) => state.moveTaskToLane);
  const markDone = useTaskStore((state) => state.markDone);

  const missions = useMissionStore((state) => state.missions);
  const createMission = useMissionStore((state) => state.createMission);
  const saveMission = useMissionStore((state) => state.saveMission);
  const setMissionStatus = useMissionStore((state) => state.setMissionStatus);
  const hydrateMissions = useMissionStore((state) => state.hydrate);

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
  const [completedArchiveOpen, setCompletedArchiveOpen] = useState(false);
  const [completedFilterMode, setCompletedFilterMode] = useState<CompletedFilterMode>('today');
  const [completedFilterFromDate, setCompletedFilterFromDate] = useState('');
  const [completedFilterFromTime, setCompletedFilterFromTime] = useState('00:00');
  const [completedFilterToDate, setCompletedFilterToDate] = useState('');
  const [completedFilterToTime, setCompletedFilterToTime] = useState('23:59');
  const [pageDateMenuOpen, setPageDateMenuOpen] = useState(false);
  const [previousViewBeforeApps, setPreviousViewBeforeApps] = useState<MainView>('today');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropLane, setDropLane] = useState<TaskLane | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [missionComposerOpen, setMissionComposerOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const dragImageRef = useRef<HTMLImageElement | null>(null);
  const dropHandledRef = useRef(false);
  const activeSession = useMemo(
    () => findActiveSession(sessions, activeSessionId),
    [activeSessionId, sessions],
  );
  const analyticsNow = useTickingNow(60000);
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
    const rootTasks = getRootTasks(tasks);
    const activeSessionTask = activeSession ? tasksById.get(activeSession.task_id) ?? null : null;
    const active = rootTasks.filter((task) => task.lane === 'now' && task.status !== 'done');
    const queue = rootTasks.filter((task) => task.lane === 'inbox' && task.status !== 'done');
    const next = rootTasks.filter((task) => task.lane === 'next' && task.status !== 'done');
    const backlog = rootTasks.filter((task) => task.lane === 'later' && task.status !== 'done');
    const blockedTaskList = rootTasks.filter(
      (task) => task.lane !== 'done' && task.status !== 'done' && blockedTaskIds.has(task.id),
    );
    const completed = rootTasks.filter((task) => task.lane === 'done' || task.status === 'done');
    const selected =
      (selectedTaskId ? tasksById.get(selectedTaskId) ?? null : null) ??
      activeSessionTask ??
      active[0] ??
      queue[0] ??
      next[0] ??
      backlog[0] ??
      null;
    const current = activeSessionTask ?? selected;
    const suggested = getSuggestedTask(rootTasks, blockedTaskIds, activeSession?.task_id ?? null);
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
  const subtaskBoard = useMemo(
    () => ({
      now: tasks.filter((task) => task.parent_task_id !== null && task.lane === 'now' && task.status !== 'done'),
      inbox: tasks.filter((task) => task.parent_task_id !== null && task.lane === 'inbox' && task.status !== 'done'),
      next: tasks.filter((task) => task.parent_task_id !== null && task.lane === 'next' && task.status !== 'done'),
      later: tasks.filter((task) => task.parent_task_id !== null && task.lane === 'later' && task.status !== 'done'),
      done: tasks.filter((task) => task.parent_task_id !== null && (task.lane === 'done' || task.status === 'done')),
    }),
    [tasks],
  );
  const taskBoard = useMemo(
    () => [
      { ...taskBoardColumns[0], tasks: activeTasks, subtasks: subtaskBoard.now },
      { ...taskBoardColumns[1], tasks: queueTasks, subtasks: subtaskBoard.inbox },
      { ...taskBoardColumns[2], tasks: nextTasks, subtasks: subtaskBoard.next },
      { ...taskBoardColumns[3], tasks: backlogTasks, subtasks: subtaskBoard.later },
      { ...taskBoardColumns[4], tasks: completedTasks, subtasks: subtaskBoard.done },
    ],
    [activeTasks, backlogTasks, completedTasks, nextTasks, queueTasks, subtaskBoard],
  );
  const rootTasksForSettings = useMemo(() => getRootTasks(tasks), [tasks]);
  const completedRootTaskCount = useMemo(
    () => rootTasksForSettings.filter((task) => task.lane === 'done' || task.status === 'done').length,
    [rootTasksForSettings],
  );
  const completedMissionCount = useMemo(
    () => missions.filter((mission) => mission.status === 'completed').length,
    [missions],
  );

  const completedFilterRange = useMemo(() => {
    if (completedFilterMode === 'all') {
      return { from: null, to: null };
    }

    if (completedFilterMode === 'today') {
      const from = new Date(analyticsNow);
      from.setHours(0, 0, 0, 0);
      const to = new Date(analyticsNow);
      to.setHours(23, 59, 59, 999);

      return { from: from.getTime(), to: to.getTime() };
    }

    if (completedFilterMode === '7d') {
      const from = new Date(analyticsNow);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      const to = new Date(analyticsNow);
      to.setHours(23, 59, 59, 999);

      return { from: from.getTime(), to: to.getTime() };
    }

    return {
      from: getLocalDateTimeTimestamp(completedFilterFromDate, completedFilterFromTime),
      to: getLocalDateTimeTimestamp(completedFilterToDate, completedFilterToTime, true),
    };
  }, [
    analyticsNow,
    completedFilterFromDate,
    completedFilterFromTime,
    completedFilterMode,
    completedFilterToDate,
    completedFilterToTime,
  ]);

  function initializeCustomCompletedFilter() {
    const now = new Date(analyticsNow);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    setCompletedFilterFromDate(formatDateInputValue(start));
    setCompletedFilterFromTime('00:00');
    setCompletedFilterToDate(formatDateInputValue(now));
    setCompletedFilterToTime('23:59');
  }

  function handleCompletedFilterModeChange(mode: CompletedFilterMode) {
    setCompletedFilterMode(mode);
    setCompletedArchiveOpen(false);

    if (mode === 'custom' && completedFilterMode !== 'custom') {
      initializeCustomCompletedFilter();
    }
  }

  function handleClearCompletedFilter() {
    const now = new Date(analyticsNow);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    setCompletedFilterMode('today');
    setCompletedFilterFromDate(formatDateInputValue(start));
    setCompletedFilterFromTime('00:00');
    setCompletedFilterToDate(formatDateInputValue(now));
    setCompletedFilterToTime('23:59');
    setCompletedArchiveOpen(false);
  }

  const completedFilterSummary = useMemo(
    () =>
      getCompletedFilterSummary(
        completedFilterMode,
        completedFilterRange.from,
        completedFilterRange.to,
      ),
    [completedFilterMode, completedFilterRange.from, completedFilterRange.to],
  );

  const completedFilterDateLabel = useMemo(() => {
    if (completedFilterMode === 'all') return 'All time';

    const { from, to } = completedFilterRange;
    if (!from && !to) return 'Page date';

    const formatDate = (ts: number) => {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    if (from && to) {
      const f = formatDate(from);
      const t = formatDate(to);
      if (f === t) return f;
      return `${f} – ${t}`;
    }

    if (from) return `From ${formatDate(from)}`;
    if (to) return `Up to ${formatDate(to)}`;

    return 'Page date';
  }, [completedFilterMode, completedFilterRange]);
  const completedFilterModeLabel = getCompletedFilterModeLabel(completedFilterMode);
  const completedFilterTone = getCompletedFilterTone(completedFilterMode);

  const allCompletedItems = useMemo(
    () => getCompletedDigestItems(completedTasks, subtaskBoard.done),
    [completedTasks, subtaskBoard.done],
  );
  const visibleTaskBoard = useMemo(
    () =>
      taskBoard.map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) =>
          taskMatchesBoardRange(task, completedFilterRange.from, completedFilterRange.to),
        ),
        subtasks: column.subtasks.filter((task) =>
          taskMatchesBoardRange(task, completedFilterRange.from, completedFilterRange.to),
        ),
      })),
    [completedFilterRange.from, completedFilterRange.to, taskBoard],
  );
  const visibleBlockedTasks = useMemo(
    () =>
      blockedTasks.filter((task) =>
        taskMatchesBoardRange(task, completedFilterRange.from, completedFilterRange.to),
      ),
    [blockedTasks, completedFilterRange.from, completedFilterRange.to],
  );

  useEffect(() => {
    if (activeView !== 'tasks') {
      setPageDateMenuOpen(false);
    }
  }, [activeView]);

  useEffect(() => {
    if (taskComposerOpen) {
      setPageDateMenuOpen(false);
    }
  }, [taskComposerOpen]);

  useEffect(() => {
    if (!pageDateMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPageDateMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pageDateMenuOpen]);

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
    const unsubQuickAdd = subscribeAppEvent<boolean>('missioncontrol://show-mobile-quick-add', () => {
      setTaskComposerOpen(true);
      setActiveView('tasks');
    });

    const unsubFocus = subscribeAppEvent<boolean>('missioncontrol://show-mobile-focus', () => {
      setActiveView('focus');
    });

    return () => {
      unsubQuickAdd();
      unsubFocus();
    };
  }, []);

  const isMobile = useIsMobile();

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setCaptureState(null);
        if (activeView === 'apps') {
          setActiveView(previousViewBeforeApps);
        }
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [activeView, previousViewBeforeApps]);

  useEffect(() => {
    void hydrateMissions();
  }, [hydrateMissions]);

  const viewCopy = getViewCopy(activeView);
  const detailTask = detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null;
  const showTaskDetailPanel =
    detailTask !== null && (activeView === 'focus' || activeView === 'tasks');

  function openAppsView() {
    if (activeView !== 'apps') {
      setPreviousViewBeforeApps(activeView);
    }

    setActiveView('apps');
  }

  function closeAppsView() {
    setActiveView(previousViewBeforeApps);
  }

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
            title: captureState.value,
            lane: 'inbox',
            estimated_minutes: 15,
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

        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.95fr)]">
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

          <div className="space-y-3 sm:space-y-6">
            <Card className="rounded-[34px] p-4 sm:p-6">
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
                      <option.icon className={cn('h-5 w-5', activeSession ? 'text-accent' : 'text-text-muted')} />
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

            <Card className="rounded-[34px] p-4 sm:p-6">
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

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <MetricCard label="Focus" value={formatDurationFromSeconds(todayFocusSeconds)} />
          <MetricCard label="Sessions" tone="neutral" value={String(todaySessions.length).padStart(2, '0')} />
          <MetricCard label="Distraction" tone="warning" value={formatDurationFromSeconds(todayDistractionSeconds)} />
          <MetricCard label="Switches" tone="success" value={String(todaySwitchCount).padStart(2, '0')} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <Card className="rounded-[34px] p-4 sm:p-6">
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

          <div className="space-y-3 sm:space-y-6">
            <Card className="rounded-[34px] p-4 sm:p-6">
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

            <Card className="rounded-[34px] p-4 sm:p-6">
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

  function renderFocus() {
    const today = new Date().toISOString().slice(0, 10);
    const rootTasks = tasks.filter((t) => t.parent_task_id === null && t.lane !== 'done' && t.status !== 'done');
    const groups: Array<{ energy: TaskEnergy; label: string; tasks: Task[] }> = [
      { energy: 'deep', label: 'Deep work', tasks: [] },
      { energy: 'shallow', label: 'Shallow', tasks: [] },
      { energy: 'admin', label: 'Admin', tasks: [] },
    ];

    for (const task of rootTasks) {
      const group = groups.find((g) => g.energy === task.energy);
      group?.tasks.push(task);
    }

    for (const group of groups) {
      group.tasks.sort((a, b) => {
        const laneScore = (t: Task) => (t.lane === 'now' ? 3 : t.scheduled_for && t.scheduled_for <= today ? 2 : t.lane === 'next' ? 1 : 0);
        const ls = laneScore(b) - laneScore(a);
        if (ls !== 0) return ls;
        const pv = (p: Task['priority']) => ({ critical: 4, high: 3, normal: 2, low: 1 }[p] ?? 0);
        return pv(b.priority) - pv(a.priority);
      });
    }

    const activeMission = missions.find((m) => m.id === currentMissionId);

    return (
      <div className="space-y-8">
        {activeMission ? (
          <Card className="rounded-[28px] border-accent/20 bg-accent/6 p-5">
            <div className="flex items-center gap-3">
              <MissionIcon icon={activeMission.emoji} className="h-8 w-8 text-accent" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-accent/70">Active mission</p>
                <p className="font-semibold text-text-primary">{activeMission.title}</p>
              </div>
            </div>
          </Card>
        ) : null}

        {groups.map((group) => {
          if (group.tasks.length === 0) return null;
          const totalMin = group.tasks.reduce((s, t) => s + t.estimated_minutes, 0);
          return (
            <div key={group.energy} className="space-y-3">
              <div className="flex items-baseline gap-3">
                <h3 className="text-sm font-semibold text-text-primary">{group.label}</h3>
                <span className="text-xs text-text-muted">{group.tasks.length} tasks · {totalMin}m total</span>
              </div>
              <div className="space-y-2">
                {group.tasks.map((task) => {
                  const missionName = missions.find((m) => m.id === task.mission_id);
                  const isScheduledToday = task.scheduled_for && task.scheduled_for <= today;
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        'flex flex-col gap-3 rounded-[20px] border px-3 py-3 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-4',
                        task.lane === 'now'
                          ? 'border-accent/25 bg-accent/7'
                          : isScheduledToday
                            ? 'border-warning/20 bg-warning/5'
                            : 'border-borderSoft/30 bg-panel/20',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                        {task.next_action ? (
                          <p className="mt-0.5 truncate text-xs text-text-muted">{task.next_action}</p>
                        ) : null}
                        {missionName ? (
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-text-muted/70">
                            <MissionIcon icon={missionName.emoji} className="h-3 w-3" /> {missionName.title}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {task.lane === 'now' ? <Badge tone="accent">Active</Badge> : null}
                        {isScheduledToday && task.lane !== 'now' ? <Badge tone="warning">Today</Badge> : null}
                        <span className="text-xs text-text-muted">{task.estimated_minutes}m</span>
                        <Button size="sm" onClick={() => handleStartSession(task)}>Focus</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDetailTaskId(task.id)}>Detail</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {rootTasks.length === 0 ? (
          <Card className="rounded-[34px] p-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success/60" />
            <p className="mt-3 text-lg font-semibold text-text-primary">All clear</p>
            <p className="mt-1 text-sm text-text-muted">No active tasks. Add one to get started.</p>
          </Card>
        ) : null}

      </div>
    );
  }

  function renderMissions() {
    const activeMissions = missions.filter((m) => m.status === 'active');
    const otherMissions = missions.filter((m) => m.status !== 'active');

    function missionTaskStats(missionId: string) {
      const mt = tasks.filter((t) => t.mission_id === missionId && t.parent_task_id === null);
      const done = mt.filter((t) => t.lane === 'done').length;
      return { total: mt.length, done };
    }

    function MissionCard({ mission }: { mission: Mission }) {
      const stats = missionTaskStats(mission.id);
      const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

      return (
        <Card className="group relative rounded-[28px] p-5">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-2xl"
              style={{ backgroundColor: `color-mix(in srgb, var(--accent) 10%, transparent)` }}
            >
              <MissionIcon icon={mission.emoji} className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate font-semibold text-text-primary">{mission.title}</p>
                <Badge tone={mission.status === 'active' ? 'accent' : mission.status === 'completed' ? 'success' : 'neutral'} className="shrink-0">
                  {mission.status === 'on_hold' ? 'On hold' : mission.status.charAt(0).toUpperCase() + mission.status.slice(1)}
                </Badge>
              </div>
              {mission.objective ? (
                <p className="mt-1 text-sm text-text-secondary line-clamp-2">{mission.objective}</p>
              ) : null}
              {stats.total > 0 ? (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span>{stats.done}/{stats.total} tasks done</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel/50">
                    <div
                      className="h-full rounded-full bg-accent/60 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-text-muted">No tasks yet</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditingMission(mission); setMissionComposerOpen(true); }} className="h-8 gap-1.5 px-2 text-xs sm:text-sm">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            {mission.status === 'active' ? (
              <Button size="sm" variant="ghost" onClick={() => void setMissionStatus(mission.id, 'on_hold')} className="h-8 gap-1.5 px-2 text-xs text-warning sm:text-sm">
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
            ) : mission.status === 'on_hold' ? (
              <Button size="sm" variant="ghost" onClick={() => void setMissionStatus(mission.id, 'active')} className="h-8 gap-1.5 px-2 text-xs text-accent sm:text-sm">
                <Play className="h-3.5 w-3.5" /> Resume
              </Button>
            ) : null}
            {mission.status === 'active' ? (
              <Button size="sm" variant="ghost" onClick={() => void setMissionStatus(mission.id, 'completed')} className="h-8 gap-1.5 px-2 text-xs text-success sm:text-sm">
                <CheckCircle className="h-3.5 w-3.5" /> Done
              </Button>
            ) : mission.status === 'completed' ? (
              <Button size="sm" variant="ghost" onClick={() => void setMissionStatus(mission.id, 'active')} className="h-8 gap-1.5 px-2 text-xs text-accent sm:text-sm">
                <RotateCcw className="h-3.5 w-3.5" /> Undo
              </Button>
            ) : null}
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => {
                if (confirm('Delete this mission and all its associations?')) {
                  void deleteMission(mission.id);
                }
              }} 
              className="h-8 gap-1.5 px-2 text-xs text-danger opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity sm:text-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {missionComposerOpen ? (
          <div className="fixed inset-x-0 top-0 bottom-[var(--mobile-nav-height)] z-[60] flex flex-col bg-panel lg:relative lg:inset-auto lg:bottom-auto lg:z-0 lg:bg-transparent">
            <div className="flex items-center justify-between border-b border-borderSoft/20 p-4 lg:hidden">
              <h2 className="text-lg font-bold text-text-primary">{editingMission ? 'Edit Mission' : 'New Mission'}</h2>
              <Button onClick={() => { setMissionComposerOpen(false); setEditingMission(null); }} size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 lg:p-0">
              <Card className="rounded-[24px] p-5 sm:rounded-[34px] sm:p-6 lg:border-none lg:bg-transparent lg:p-0">
                {!isMobile && <SectionHeading title={editingMission ? 'Edit mission' : 'New mission'} />}
                <MissionComposer
                  initial={editingMission ?? undefined}
                  submitLabel={editingMission ? 'Save changes' : 'Create mission'}
                  onCancel={() => { setMissionComposerOpen(false); setEditingMission(null); }}
                  onSubmit={async (draft) => {
                    if (editingMission) {
                      await saveMission({ ...editingMission, ...draft, updated_at: new Date().toISOString() });
                    } else {
                      await createMission(draft);
                    }
                    setMissionComposerOpen(false);
                    setEditingMission(null);
                  }}
                />
              </Card>
            </div>
          </div>
        ) : null}

        {activeMissions.length > 0 ? (
          <div className="space-y-3">
            <SectionHeading action={<Badge tone="accent">{activeMissions.length}</Badge>} title="Active" />
            <div className="grid gap-4 lg:grid-cols-2">
              {activeMissions.map((m) => <MissionCard key={m.id} mission={m} />)}
            </div>
          </div>
        ) : null}

        {otherMissions.length > 0 ? (
          <div className="space-y-3">
            <SectionHeading action={<Badge tone="neutral">{otherMissions.length}</Badge>} title="Other" />
            <div className="grid gap-4 lg:grid-cols-2">
              {otherMissions.map((m) => <MissionCard key={m.id} mission={m} />)}
            </div>
          </div>
        ) : null}

        {missions.length === 0 && !missionComposerOpen ? (
          <Card className="rounded-[34px] p-10 text-center">
            <Target className="mx-auto h-10 w-10 text-accent" />
            <p className="mt-3 text-lg font-semibold text-text-primary">No missions yet</p>
            <p className="mt-1 text-sm text-text-muted">A Mission is the project every task belongs to.</p>
            <div className="mt-5">
              <Button onClick={() => setMissionComposerOpen(true)}>Create first mission</Button>
            </div>
          </Card>
        ) : null}
      </div>
    );
  }

  function renderTaskDateFilterControl() {
    return (
      <div className="relative shrink-0">
        <Button
          aria-controls="task-date-filter-popover"
          aria-expanded={pageDateMenuOpen}
          aria-label={`Open page date filter. Current range: ${completedFilterSummary}`}
          className="h-9 shrink-0 rounded-full px-3 sm:px-4 max-[380px]:w-9 max-[380px]:justify-center max-[380px]:gap-0 max-[380px]:px-0"
          onClick={() => setPageDateMenuOpen((open) => !open)}
          size="sm"
          type="button"
          title={completedFilterSummary}
          variant="secondary"
        >
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline max-[380px]:hidden">{completedFilterDateLabel}</span>
          <span className="sm:hidden max-[380px]:hidden">{completedFilterDateLabel}</span>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] leading-none max-[380px]:hidden',
              completedFilterTone === 'accent'
                ? 'border-accent/20 bg-accent/12 text-accent'
                : completedFilterTone === 'warning'
                  ? 'border-warning/20 bg-warning/12 text-warning'
                  : completedFilterTone === 'success'
                    ? 'border-success/20 bg-success/12 text-success'
                    : 'border-borderSoft/40 bg-panel/60 text-text-secondary',
            )}
          >
            {completedFilterModeLabel}
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform duration-150 max-[380px]:hidden', pageDateMenuOpen ? 'rotate-180' : null)}
          />
        </Button>

        {pageDateMenuOpen ? (
          <>
            <div
              aria-hidden="true"
              className="fixed inset-0 z-30 bg-transparent"
              onClick={() => setPageDateMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-40 mt-3 w-[min(420px,calc(100vw-1.5rem))]">
              <Card
                id="task-date-filter-popover"
                className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[24px] border border-borderSoft/28 bg-panel/96 p-3 shadow-[0_18px_50px_rgb(var(--shadow-color)/0.22)] backdrop-blur-md sm:max-h-none sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-text-muted">Page date</p>
                    <h3 className="mt-1 text-base font-bold text-text-primary">Date & time</h3>
                    <p className="mt-1 text-sm text-text-secondary">{completedFilterSummary}</p>
                  </div>

                  <Badge tone={completedFilterTone} className="shrink-0">
                    {completedFilterModeLabel}
                  </Badge>
                </div>

                <div className="mt-3">
                  <CompletedFilterPanel
                    fromDate={completedFilterFromDate}
                    fromTime={completedFilterFromTime}
                    mode={completedFilterMode}
                    onClear={handleClearCompletedFilter}
                    onFromDateChange={(value) => {
                      setCompletedFilterMode('custom');
                      setCompletedFilterFromDate(value);
                      setCompletedArchiveOpen(false);
                    }}
                    onFromTimeChange={(value) => {
                      setCompletedFilterMode('custom');
                      setCompletedFilterFromTime(value);
                      setCompletedArchiveOpen(false);
                    }}
                    onModeChange={handleCompletedFilterModeChange}
                    onToDateChange={(value) => {
                      setCompletedFilterMode('custom');
                      setCompletedFilterToDate(value);
                      setCompletedArchiveOpen(false);
                    }}
                    onToTimeChange={(value) => {
                      setCompletedFilterMode('custom');
                      setCompletedFilterToTime(value);
                      setCompletedArchiveOpen(false);
                    }}
                    toDate={completedFilterToDate}
                    toTime={completedFilterToTime}
                  />
                </div>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  function renderTasks() {
    return (
      <div className="space-y-6">
        {taskComposerOpen ? (
          <div className="fixed inset-x-0 top-0 bottom-[var(--mobile-nav-height)] z-[60] flex flex-col bg-panel lg:relative lg:inset-auto lg:bottom-auto lg:z-0 lg:bg-transparent">
            <div className="flex items-center justify-between border-b border-borderSoft/20 p-4 lg:hidden">
              <h2 className="text-lg font-bold text-text-primary">Add Task</h2>
              <Button onClick={() => setTaskComposerOpen(false)} size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-0">
              {isMobile ? (
                <div className="flex h-full min-h-0 flex-col">
                  <TaskCreationComposer
                    autoFocus
                    fillHeight
                    onCancel={() => setTaskComposerOpen(false)}
                    onSubmitted={() => {
                      setTaskComposerOpen(false);
                      setActiveView('tasks');
                    }}
                    source="main"
                    submitLabel="Save task"
                  />
                </div>
              ) : (
                <Card className="rounded-[24px] p-5 sm:rounded-[34px] sm:p-6 lg:border-none lg:bg-transparent lg:p-0">
                  <SectionHeading title="Add task" />
                  <TaskCreationComposer
                    autoFocus
                    onCancel={() => setTaskComposerOpen(false)}
                    onSubmitted={() => {
                      setTaskComposerOpen(false);
                      setActiveView('tasks');
                    }}
                    source="main"
                    submitLabel="Save task"
                  />
                </Card>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex gap-4 overflow-x-auto pb-4 2xl:grid 2xl:grid-cols-[repeat(4,minmax(220px,1fr))_minmax(260px,320px)] 2xl:overflow-visible">
          {visibleTaskBoard.map((column) => {
            const groupedSubtasks = groupSubtasksByParent(column.subtasks, tasksById);
            const isCompletedColumn = column.lane === 'done';
            const completedItems = isCompletedColumn ? getCompletedDigestItems(column.tasks, column.subtasks) : [];
            const visibleCompletedItems = completedArchiveOpen
              ? completedItems
              : completedItems.slice(0, completedDigestLimit);
            const hiddenCompletedCount = Math.max(0, completedItems.length - completedDigestLimit);
            const completedTotalCount = allCompletedItems.length;

            return (
              <Card
                className={cn(
                  'kanban-column flex min-h-[420px] w-[280px] shrink-0 flex-col rounded-[34px] p-5 2xl:w-auto',
                  'sm:w-[320px]',
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
                  action={<Badge tone={column.tone}>{isCompletedColumn ? completedItems.length : column.tasks.length + column.subtasks.length}</Badge>}
                  title={column.title}
                />

                {isCompletedColumn ? (
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-[18px] border border-borderSoft/30 bg-panel/38 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Shown</p>
                        <p className="mt-1 text-xl font-bold leading-none text-success">{completedItems.length}</p>
                      </div>
                      <div className="rounded-[18px] border border-borderSoft/30 bg-panel/38 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">All</p>
                        <p className="mt-1 text-xl font-bold leading-none text-text-primary">{completedTotalCount}</p>
                      </div>
                    </div>

                    {completedItems.length ? (
                      <div className="min-h-0 space-y-2">
                        <div className="flex items-center justify-between gap-2 px-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">
                            {completedArchiveOpen ? 'Archive' : 'Recent'}
                          </p>
                          {hiddenCompletedCount ? (
                            <Badge tone="success" className="px-2 py-0.5 text-[9px]">
                              +{hiddenCompletedCount}
                            </Badge>
                          ) : null}
                        </div>

                        <div
                          className={cn(
                            'space-y-2',
                            completedArchiveOpen ? 'max-h-[420px] overflow-y-auto pr-1 scrollbar-thin' : null,
                          )}
                        >
                          {visibleCompletedItems.map((task) => (
                            <CompletedDigestItem
                              draggable
                              dragging={draggedTaskId === task.id}
                              key={task.id}
                              onDragEnd={handleTaskDragEnd}
                              onDragStart={(event) => handleTaskDragStart(event, task.id)}
                              onRestore={() => void moveTaskToLane(task.id, 'inbox', 'main')}
                              onSelect={() => {
                                selectTask(task.id);
                                setDetailTaskId(task.id);
                              }}
                              parentTask={task.parent_task_id ? tasksById.get(task.parent_task_id) ?? null : null}
                              task={task}
                            />
                          ))}
                        </div>

                        {hiddenCompletedCount ? (
                          <Button
                            className="mt-1 w-full justify-between px-3"
                            onClick={() => setCompletedArchiveOpen((open) => !open)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <span>{completedArchiveOpen ? 'Show recent' : `Show ${hiddenCompletedCount} more`}</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-success/20 bg-success/7 p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-success/18 bg-success/10 text-success">
                            <CheckCircle2 className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-text-primary">No completed items in this range</p>
                            <p className="mt-1 text-xs text-text-muted">
                              {completedFilterMode === 'all'
                                ? 'Finished tasks will collect here.'
                                : 'Widen the date or time range, or clear the filter.'}
                            </p>
                          </div>
                        </div>

                        {completedFilterMode !== 'today' ? (
                          <Button
                            className="mt-3 w-full justify-between px-3"
                            onClick={handleClearCompletedFilter}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <span>Clear filter</span>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : (
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
                                <div className="flex flex-nowrap gap-2">
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
                                  <Button
                                    onClick={() => setDetailTaskId(task.id)}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    Detail
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
                  ) : null}

                  {column.subtasks.length ? (
                    <div className="mt-2 space-y-4">
                      <div className="flex items-center gap-2 px-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">Linked steps</p>
                        <Badge tone="neutral">{column.subtasks.length}</Badge>
                      </div>
                      <div className="space-y-4">
                        {groupedSubtasks.map((group) => (
                          <div key={group.parentTask?.id ?? group.tasks[0]?.id} className="space-y-2">
                            <div className="flex items-center gap-2 px-2">
                              <p className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] text-text-muted/60">Parent:</p>
                              {group.parentTask ? (
                                <button
                                  className="truncate text-[11px] font-medium text-text-secondary transition-colors hover:text-accent"
                                  onClick={() => {
                                    selectTask(group.parentTask!.id);
                                    setDetailTaskId(group.parentTask!.id);
                                  }}
                                  type="button"
                                >
                                  {group.parentTask.title}
                                </button>
                              ) : (
                                <p className="truncate text-[11px] font-medium text-text-secondary">Detached</p>
                              )}
                            </div>
                            <div className="relative space-y-2.5 ml-2.5 pl-5">
                              <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-accent/40 via-accent/20 to-transparent transition-all group-hover:from-accent group-hover:via-accent/50" />
                              {group.tasks.map((task) => (
                                <SubtaskBoardItem
                                  active={activeSession?.task_id === task.id}
                                  draggable
                                  dragging={draggedTaskId === task.id}
                                  key={task.id}
                                  onDetail={() => setDetailTaskId(task.id)}
                                  onDone={() => void markDone(task.id, 'main')}
                                  onDragEnd={handleTaskDragEnd}
                                  onDragStart={(event) => handleTaskDragStart(event, task.id)}
                                  onFocus={() => handleStartSession(task)}
                                  onSelect={() => selectTask(task.id)}
                                  task={task}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {column.tasks.length === 0 && column.subtasks.length === 0 ? (
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
                  ) : null}
                </div>
                )}
              </Card>
            );
          })}
        </div>

        {visibleBlockedTasks.length ? (
          <Card className="rounded-[34px] p-5">
            <SectionHeading action={<Badge tone="warning">{visibleBlockedTasks.length}</Badge>} title="Blocked" />

            <div className="grid gap-3 lg:grid-cols-2">
              {visibleBlockedTasks.map((task) => {
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
                      className="grid w-full gap-2 px-3 py-3 text-left sm:gap-4 sm:px-5 sm:py-4 lg:grid-cols-[minmax(0,1.4fr)_0.8fr_0.8fr_0.9fr_1.3fr_0.6fr]"
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
                        <div className="grid gap-4 px-3 py-4 sm:gap-6 sm:px-5 sm:py-5 lg:grid-cols-3">
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
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
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

        <div className="grid gap-4 lg:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="accent">Today</Badge>} title="Daily review" />

            <div className="grid gap-4 md:grid-cols-3">
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

  function renderSettings() {
    return (
      <div className="space-y-6">
        <ProfileSettingsCard
          completedMissionCount={completedMissionCount}
          completedTaskCount={completedRootTaskCount}
          missionCount={missions.length}
          rootTaskCount={rootTasksForSettings.length}
          sessionCount={sessions.length}
          syncModeLabel={syncMode === 'cloud' ? 'Cloud sync' : 'Local only'}
        />

        <Card className="rounded-[34px] p-6">
          <SectionHeading action={<Badge tone="accent">Theme</Badge>} title="Appearance" />

          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            {THEMES.map((theme) => {
              const active = theme.id === themeId;

              return (
                <button
                  className={cn(
                    'rounded-[28px] border p-4 text-left transition-[transform,border-color,background-color,box-shadow] duration-150',
                    active
                      ? 'border-accent/30 bg-accent/10 shadow-[0_12px_30px_rgb(var(--accent)/0.10)]'
                      : 'border-borderSoft/30 bg-panel/34 hover:border-borderStrong/34 hover:bg-panel/50',
                  )}
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">{theme.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-text-muted">
                        {theme.eyebrow}
                      </p>
                    </div>
                    {active ? <Badge tone="accent">Live</Badge> : null}
                  </div>

                  <div className="mt-4 flex gap-2">
                    {theme.preview.map((color) => (
                      <span
                        className="h-10 flex-1 rounded-2xl border border-white/10"
                        key={color}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="neutral">Live</Badge>} title="Behavior" />

            <div className="space-y-4">
              <div className="rounded-[24px] border border-borderSoft/30 bg-panel/32 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Reduce motion</p>
                    <p className="mt-1 text-sm text-text-secondary">Trim extra movement across the app.</p>
                  </div>

                  <div className="flex gap-2">
                    <SettingChoice active={!reduceMotion} onClick={() => setReduceMotion(false)}>
                      Off
                    </SettingChoice>
                    <SettingChoice active={reduceMotion} onClick={() => setReduceMotion(true)}>
                      On
                    </SettingChoice>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-borderSoft/30 bg-panel/32 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Focus prompts</p>
                    <p className="mt-1 text-sm text-text-secondary">Choose how direct recovery prompts should feel.</p>
                  </div>

                  <div className="flex gap-2">
                    <SettingChoice
                      active={focusPromptStyle === 'gentle'}
                      onClick={() => setFocusPromptStyle('gentle')}
                    >
                      Gentle
                    </SettingChoice>
                    <SettingChoice
                      active={focusPromptStyle === 'direct'}
                      onClick={() => setFocusPromptStyle('direct')}
                    >
                      Direct
                    </SettingChoice>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-borderSoft/30 bg-panel/32 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Launch at login</p>
                    <p className="mt-1 text-sm text-text-secondary">Open MissionControl when your desktop starts.</p>
                  </div>

                  <Button
                    disabled={launchAtLoginPending}
                    onClick={() => void setLaunchAtLogin(!launchAtLogin)}
                    size="sm"
                    type="button"
                    variant={launchAtLogin ? 'primary' : 'secondary'}
                  >
                    {launchAtLoginPending ? 'Saving' : launchAtLogin ? 'On' : 'Off'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="neutral">System</Badge>} title="Workspace" />

            <div className="space-y-4">
              <div className="rounded-[24px] border border-borderSoft/30 bg-panel/32 p-4">
                <p className="text-sm font-medium text-text-primary">Quick Add shortcut</p>
                <div className="mt-3">
                  <Badge className="text-xs" tone="accent">
                    {quickAddShortcut}
                  </Badge>
                </div>
              </div>

              <div className="rounded-[24px] border border-borderSoft/30 bg-panel/32 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Sync mode</p>
                    <p className="mt-1 text-sm text-text-secondary">Keep this device local or prep for cloud sync.</p>
                  </div>

                  <div className="flex gap-2">
                    <SettingChoice active={syncMode === 'local'} onClick={() => setSyncMode('local')}>
                      Local
                    </SettingChoice>
                    <SettingChoice active={syncMode === 'cloud'} onClick={() => setSyncMode('cloud')}>
                      Cloud
                    </SettingChoice>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[34px] p-6">
            <SectionHeading action={<Badge tone="accent">Identity</Badge>} title="Connection" />

            <div className="space-y-4">
              <div className="rounded-[24px] border border-borderSoft/30 bg-panel/32 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {useAuthStore.getState().localMode ? 'Local Mode' : 'Cloud Sync'}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {useAuthStore.getState().localMode
                        ? 'Your data is only on this PC. Sign in to sync across devices.'
                        : 'Your data is safely synced to the cloud.'}
                    </p>
                  </div>

                  {useAuthStore.getState().localMode ? (
                    <Button
                      onClick={() => {
                        if (confirm('Switch to Cloud mode? You will be taken to the login screen.')) {
                          useAuthStore.getState().setLocalMode(false);
                          window.location.reload();
                        }
                      }}
                      size="sm"
                      type="button"
                    >
                      <Cloud className="mr-2 h-4 w-4" /> Switch to Cloud
                    </Button>
                  ) : (
                    <Button
                      onClick={() => void useAuthStore.getState().signOut()}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Sign out
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <SyncStatusCard />
        </div>
      </div>
    );
  }

  if (!tasksHydrated || !sessionsHydrated || tasksLoading) {
    return <AnimatedLoading autoDismiss={true} dismissAfter={1500} />;
  }

  return (
    <div className="h-full">
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 backdrop-blur-md transition-opacity"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="relative z-10 flex h-full min-h-0 w-[280px] flex-col overflow-hidden border-r border-borderSoft/24 bg-surface-2 p-6 shadow-2xl transition-transform duration-300">
            <div className="mb-8 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-accent/20 flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-accent animate-pulse" />
                </div>
                <p className="text-sm font-bold tracking-tight text-text-primary uppercase">MissionControl</p>
              </div>
              <Button onClick={() => setMobileNavOpen(false)} size="sm" type="button" variant="ghost" className="h-8 w-8 p-0 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <SidebarContent
                activeSession={activeSession}
                activeView={activeView}
                onOpenApps={() => {
                  openAppsView();
                  setMobileNavOpen(false);
                }}
                onViewSelect={(view) => {
                  setActiveView(view);
                  setMobileNavOpen(false);
                }}
                pinnedAppIds={sidebarPinnedApps}
              />
            </div>

            <div className="mt-6 space-y-2 pt-6 border-t border-borderSoft/20">
              <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Quick Actions</p>
              <Button 
                onClick={() => { setMobileNavOpen(false); setActiveView('tasks'); setTaskComposerOpen(true); }} 
                className="w-full justify-start gap-3 rounded-2xl" 
                variant="secondary"
              >
                <Plus className="h-4 w-4" /> New Task
              </Button>
              <Button 
                onClick={() => { setMobileNavOpen(false); setActiveView('focus'); }} 
                className="w-full justify-start gap-3 rounded-2xl" 
                variant="ghost"
              >
                <Crosshair className="h-4 w-4" /> Focus Mode
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="app-frame relative flex h-full flex-col overflow-visible lg:overflow-hidden lg:flex-row">
        <aside className="sidebar-shell relative z-10 hidden w-full flex-col border-r border-borderSoft/24 p-6 lg:flex lg:w-[248px]">
          <SidebarContent
            activeSession={activeSession}
            activeView={activeView}
            onOpenApps={openAppsView}
            onViewSelect={(view) => setActiveView(view)}
            pinnedAppIds={sidebarPinnedApps}
          />
        </aside>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-borderSoft/24 px-3 py-3 sm:gap-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-text-primary sm:text-2xl">{viewCopy}</h2>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                onClick={() => setMobileNavOpen(true)}
                size="sm"
                type="button"
                variant="ghost"
                className="lg:hidden h-9 w-9 p-0 sm:h-auto sm:w-auto sm:px-3"
              >
                <Menu className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Menu</span>
              </Button>
              
              {activeView === 'tasks' ? (
                <Button
                  aria-label="Create task"
                  onClick={() => setTaskComposerOpen(true)}
                  size="sm"
                  type="button"
                  className="px-3 sm:px-4 max-[380px]:h-9 max-[380px]:w-9 max-[380px]:justify-center max-[380px]:gap-0 max-[380px]:px-0"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline max-[380px]:hidden">Create task</span>
                  <span className="sm:hidden max-[380px]:hidden">Add</span>
                </Button>
              ) : activeView === 'missions' ? (
                <Button onClick={() => setMissionComposerOpen(true)} size="sm" type="button" className="px-3 sm:px-4">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">New mission</span>
                  <span className="sm:hidden">New</span>
                </Button>
              ) : null}

              {activeView === 'tasks' ? renderTaskDateFilterControl() : null}

              <div className="hidden items-center gap-2 sm:flex md:gap-3">
                {activeView === 'tasks' ? null : <HeaderClock />}
                <Button onClick={() => void showQuickAddWindow()} size="sm" type="button" variant="secondary" className="hidden md:flex">
                  Quick Add
                </Button>
                <Button onClick={() => void showHudWindow()} size="sm" type="button" variant="ghost" className="hidden lg:flex">
                  HUD
                </Button>
              </div>
            </div>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <main className="main-scroll-region absolute inset-0 overflow-y-scroll px-3 py-4 pb-32 sm:px-6 sm:py-6 lg:pb-6" style={{ WebkitOverflowScrolling: 'touch' }}>
              {activeView === 'apps' ? (
                <AppsWorkspacePage
                  activeView={previousViewBeforeApps}
                  onClose={closeAppsView}
                  onTogglePinnedApp={toggleSidebarPinnedApp}
                  onViewSelect={(view) => setActiveView(view)}
                  pinnedAppIds={sidebarPinnedApps}
                />
              ) : null}
              {activeView === 'focus' ? renderFocus() : null}
              {activeView === 'missions' ? renderMissions() : null}
              {activeView === 'roadmap' ? <RoadmapView missions={missions} allTasks={tasks} /> : null}
              {activeView === 'today' ? renderToday() : null}
              {activeView === 'tasks' ? renderTasks() : null}
              {activeView === 'history' ? renderHistory() : null}
              {activeView === 'insights' ? renderInsights() : null}
              {activeView === 'review' ? renderReview() : null}
              {activeView === 'journal' ? <JournalView /> : null}
              {activeView === 'notes' ? <NotesView /> : null}
              {activeView === 'assistant' ? <AssistantView /> : null}
              {activeView === 'settings' ? renderSettings() : null}

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

            {showTaskDetailPanel ? (
              <>
                <button
                  aria-label="Close task details"
                  className="absolute inset-0 z-30 bg-black/24 min-[1400px]:hidden"
                  onClick={() => setDetailTaskId(null)}
                  type="button"
                />

                <aside className="absolute inset-y-0 right-0 z-40 w-full max-w-[420px] overflow-hidden border-l border-borderSoft/30 bg-panel shadow-2xl min-[1400px]:relative min-[1400px]:inset-auto min-[1400px]:h-full min-[1400px]:min-h-0 min-[1400px]:w-[420px] min-[1400px]:max-w-none min-[1400px]:shrink-0 min-[1400px]:overflow-hidden min-[1400px]:shadow-none">
                  <TaskDetailPanel
                    allTasks={tasks}
                    onClose={() => setDetailTaskId(null)}
                    onOpenTask={setDetailTaskId}
                    task={detailTask}
                  />
                </aside>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Floating AI assistant — available on every screen */}
      <AssistantWidget />

      {/* Mobile bottom navigation */}
      <nav className="mobile-bottom-nav lg:hidden">
        {([
          { id: 'focus' as MainView, label: 'Focus', Icon: Crosshair },
          { id: 'today' as MainView, label: 'Today', Icon: Sun },
          { id: 'tasks' as MainView, label: 'Tasks', Icon: CheckSquare },
          { id: 'missions' as MainView, label: 'Missions', Icon: Target },
          { id: 'roadmap' as MainView, label: 'More', Icon: MoreHorizontal },
        ] as const).map((tab) => {
          const isMore = tab.label === 'More';
          const isActive = isMore
            ? !['focus', 'today', 'tasks', 'missions'].includes(activeView)
            : activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'mobile-bottom-nav-item',
                isActive ? 'mobile-bottom-nav-item--active' : null,
              )}
              onClick={() => {
                if (isMore) {
                  setMobileNavOpen(true);
                } else {
                  setActiveView(tab.id);
                }
              }}
            >
              <tab.Icon size={20} strokeWidth={1.5} />
              <span>{tab.label}</span>
              {isActive ? <span className="mobile-bottom-nav-dot" /> : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
