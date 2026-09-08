import { TeamHeaderSwitcher } from "../../features/team/TeamHeaderSwitcher";
import { PocketDropFAB } from "../../features/team/PocketDropModal";
import { MissionHubNavSlotContext } from "../../features/team/mission-hub-nav-slot";
import { useTeamStore } from "../../features/team/team-store";
import { confirmDialog } from "../../components/ui/native-dialog";
import {
  type DragEvent as ReactDragEvent,
  type ReactNode,
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Sun, CheckSquare, Target, MoreHorizontal, CheckCircle2, Timer, Flag, Clock, BarChart3, ClipboardList, Settings, Lightbulb, Link2, AlertCircle, Pin, FileText, ArrowLeft, ArrowUpRight, RotateCcw, Cloud, Pencil, Trash2, Play, Pause, CheckCircle, Check, CircleDashed, Menu, X, Plus, CalendarDays, ChevronDown, CornerDownRight, BookHeart, Heart, StickyNote, Wifi, WifiOff, MessageCircle, MessageSquare, Trophy, Users, UserRound, Bot, Palette, SlidersHorizontal, Download, Eye, Keyboard, AlertOctagon, PanelLeftClose, PanelLeftOpen, FolderKanban, type LucideIcon } from 'lucide-react';
import { MissionIcon } from '../../components/ui/mission-icon';
import { DatePicker } from '../../components/ui/date-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Textarea } from '../../components/ui/input';
import { AnimatedLoading } from '../../components/animated-loading';
import { ProfileSettingsCard, getInitials, getUserDisplayName } from '../../features/auth/ProfileSettingsCard';
import { AiProviderCard } from '../../features/settings/AiProviderCard';
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
import { DownloadsCard } from '../../features/settings/DownloadsCard';
import type { SidebarPinnedAppId } from '../../features/preferences/preferences-types';
import { MissionComposer } from '../../features/missions/MissionComposer';
import { useMissionStore } from '../../features/missions/mission-store';
import { useJournalStore } from '../../features/journal/journal-store';
import { DashboardView } from '../../features/dashboard/DashboardView';
import type { CalendarOpenTarget } from '../../features/calendar/CalendarView';
import { AssistantWidget } from '../../features/assistant/AssistantWidget';
import { SynCatchWordmark } from '../../components/SynCatchLogo';
import { TaskCreationComposer } from '../../features/tasks/TaskCreationComposer';
import { TaskDetailPanel } from '../../features/tasks/TaskDetailPanel';
import { MissionDetailPanel } from '../../features/missions/MissionDetailPanel';
import { getRootTasks, humanizePriority } from '../../features/tasks/task-helpers';
import { useTaskStore } from '../../features/tasks/task-store';
import { useThemeStore } from '../../features/themes/theme-store';
import { THEMES } from '../../features/themes/themes';
import type { Mission } from '../../features/missions/mission-types';
import type { Task, TaskEnergy, TaskLane } from '../../features/tasks/task-types';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../lib/date';
import { isTauriApp, showHudWindow, showQuickAddWindow, subscribeAppEvent } from '../../lib/tauri';
import { useIsMobile } from '../../hooks/use-mobile';
import { lazyWithReload } from '../../lib/lazy-with-reload';

// Route-level code splitting: each view loads on demand behind <Suspense>.
const TeamCalendarView = lazyWithReload('team-calendar', () => import('../../features/team/TeamCalendarView').then((m) => ({ default: m.TeamCalendarView })));
const TeamHubView = lazyWithReload('team-hub', () => import('../../features/team/TeamHubView').then((m) => ({ default: m.TeamHubView })));
const TeamTasksView = lazyWithReload('team-tasks', () => import('../../features/team/TeamTasksView').then((m) => ({ default: m.TeamTasksView })));
const UnifiedMissionHub = lazyWithReload('mission-hub', () => import('../../features/team/UnifiedMissionHub').then((m) => ({ default: m.UnifiedMissionHub })));
const LeadsCRMView = lazyWithReload('leads-crm', () => import('../../features/team/LeadsCRMView').then((m) => ({ default: m.LeadsCRMView })));
const ProblemBankView = lazyWithReload('problem-bank', () => import('../../features/team/ProblemBankView').then((m) => ({ default: m.ProblemBankView })));
const TeamNotesView = lazyWithReload('team-notes', () => import('../../features/team/TeamNotesView').then((m) => ({ default: m.TeamNotesView })));
const RoadmapView = lazyWithReload('roadmap', () => import('../../features/roadmap/RoadmapView').then((m) => ({ default: m.RoadmapView })));
const JournalView = lazyWithReload('journal', () => import('../../features/journal/JournalView').then((m) => ({ default: m.JournalView })));
const NotesView = lazyWithReload('notes', () => import('../../features/notes/NotesView').then((m) => ({ default: m.NotesView })));
const LovedOnesView = lazyWithReload('loved-ones', () => import('../../features/loved-ones/LovedOnesView').then((m) => ({ default: m.LovedOnesView })));
const AssistantView = lazyWithReload('assistant', () => import('../../features/assistant/AssistantView').then((m) => ({ default: m.AssistantView })));
const CalendarView = lazyWithReload('calendar', () => import('../../features/calendar/CalendarView').then((m) => ({ default: m.CalendarView })));
const ChallengesView = lazyWithReload('challenges', () => import('../../features/challenges/ChallengesView').then((m) => ({ default: m.ChallengesView })));
const ProjectsView = lazyWithReload('projects', () => import('../../features/projects/ProjectsView').then((m) => ({ default: m.ProjectsView })));

function ViewLoading() {
  return (
    <div className="flex min-h-[280px] items-center justify-center" role="status" aria-label="Loading view">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-borderSoft border-t-accent" />
    </div>
  );
}

type MainView = 'dashboard' | 'focus' | 'missions' | 'projects' | 'roadmap' | 'today' | 'calendar' | 'challenges' | 'tasks' | 'history' | 'insights' | 'review' | 'journal' | 'notes' | 'loved-ones' | 'assistant' | 'settings' | 'apps' | 'crm' | 'problems';

const MAIN_VIEW_PATHS: Record<MainView, string> = {
  dashboard: '/dashboard', focus: '/focus', missions: '/missions', projects: '/projects', roadmap: '/roadmap',
  today: '/today', calendar: '/calendar', challenges: '/challenges', tasks: '/tasks', history: '/history',
  insights: '/insights', review: '/review', journal: '/journal', notes: '/notes', 'loved-ones': '/loved-ones', assistant: '/assistant',
  settings: '/settings', apps: '/apps', crm: '/crm', problems: '/problems',
};

function viewFromPath(pathname: string): MainView {
  const normalized = pathname.replace(/^\/team/, '').replace(/\/$/, '') || '/dashboard';
  return (Object.entries(MAIN_VIEW_PATHS).find(([, path]) => path === normalized)?.[0] as MainView | undefined) ?? 'dashboard';
}

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
type TaskScopeMode = 'pending' | 'today' | 'all';
type SettingsCategory = 'account' | 'ai' | 'appearance' | 'workspace' | 'downloads';

const launcherViews: Array<{
  id: SidebarPinnedAppId;
  label: string;
  icon: LucideIcon;
  caption?: string;
  description: string;
  gradient: string;
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    description: 'See the control surface',
    gradient: 'from-cyan-500 via-sky-500 to-indigo-600',
  },
  {
    id: 'focus',
    label: 'What Now',
    icon: Timer,
    description: 'Get back into motion',
    gradient: 'from-cyan-500 via-sky-500 to-blue-600',
  },
  {
    id: 'missions',
    label: 'Missions',
    icon: Flag,
    description: 'Track larger goals',
    gradient: 'from-fuchsia-500 via-pink-500 to-rose-500',
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderKanban,
    description: 'View Vellarc project context',
    gradient: 'from-violet-500 via-indigo-500 to-blue-600',
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
    id: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    description: 'Remember what happened each day',
    gradient: 'from-blue-500 via-sky-500 to-cyan-500',
  },
  {
    id: 'challenges',
    label: 'Challenges',
    icon: Trophy,
    description: 'Build daily streaks',
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
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
    id: 'loved-ones',
    label: 'Loved Ones',
    icon: Heart,
    description: 'Remember what matters to them',
    gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
  },
  {
    id: 'assistant',
    label: 'Assistant',
    icon: MessageCircle,
    description: 'Ask, plan, or draft',
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    description: 'Track venue leads & pilots',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
  },
  {
    id: 'problems',
    label: 'Problems HUB',
    icon: AlertOctagon,
    description: 'MDM objections & friction bank',
    gradient: 'from-rose-500 via-pink-500 to-amber-500',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    description: 'Tune the workspace',
    gradient: 'from-slate-500 via-zinc-500 to-stone-600',
  },
];

const teamLauncherViews: Array<{
  id: MainView;
  label: string;
  icon: LucideIcon;
  description: string;
  gradient: string;
}> = [
  {
    id: 'missions',
    label: 'Projects',
    icon: Target,
    description: 'Shared client projects',
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    description: 'Deadlines & CRM follow-ups',
    gradient: 'from-blue-500 via-sky-500 to-cyan-500',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    description: 'Assign and track work',
    gradient: 'from-violet-500 via-purple-500 to-indigo-500',
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    description: 'Clients and sales leads',
    gradient: 'from-emerald-500 via-teal-500 to-green-600',
  },
  {
    id: 'problems',
    label: 'Issues',
    icon: AlertOctagon,
    description: 'Issues, feedback, and ideas',
    gradient: 'from-rose-500 via-pink-500 to-amber-500',
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: StickyNote,
    description: 'Shared team notes',
    gradient: 'from-teal-500 via-cyan-500 to-blue-500',
  },
];

// Core apps that are always available in the mobile slide-out drawer, even when
// the user hasn't pinned them. Keeps Notes (and Focus, which has no bottom-bar
// tab) reachable on mobile regardless of pinned state.
const mobileDrawerCoreApps: SidebarPinnedAppId[] = [
  'focus',
  'today',
  'tasks',
  'missions',
  'projects',
  'roadmap',
  'challenges',
  'journal',
  'notes',
  'assistant',
  'settings',
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

const completedDigestLimit = 8;
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
    dashboard: 'Dashboard',
    focus: 'What Now',
    missions: 'Missions',
    projects: 'Projects',
    roadmap: 'Roadmap',
    today: 'Today',
    calendar: 'Calendar',
    challenges: 'Challenges',
    tasks: 'Tasks',
    history: 'History',
    insights: 'Insights',
    review: 'Review',
    journal: 'Journal',
    notes: 'Notes',
    'loved-ones': 'Loved Ones',
    assistant: 'Assistant',
    settings: 'Settings',
    apps: 'Apps',
    crm: 'CRM',
    problems: 'Problems HUB',
  };
  return labels[view] ?? 'Today';
}

function NavButton({
  active,
  label,
  icon: Icon,
  gradient,
  caption,
  onClick,
  compact = false,
  collapsed = false,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  gradient?: string;
  caption?: string;
  onClick: () => void;
  compact?: boolean;
  collapsed?: boolean;
}) {
  return (
    <button
      className={cn(
        'group relative flex w-full items-center gap-3 overflow-hidden rounded-[14px] border text-left transition-all duration-200',
        collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
        active
          ? 'border-accent/25 bg-accent/10 shadow-[0_8px_22px_rgba(var(--accent),0.08)]'
          : 'border-transparent bg-transparent hover:border-borderSoft/30 hover:bg-panel/55',
      )}
      onClick={onClick}
      title={collapsed ? label : undefined}
      type="button"
    >
      {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-accent" /> : null}
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border transition-all',
          compact && gradient
            ? `border-white/10 bg-gradient-to-br ${gradient} text-white shadow-[0_6px_16px_rgba(0,0,0,0.2)]`
            : active
            ? 'border-accent/20 bg-accent/12 text-accent'
            : 'border-borderSoft/25 bg-panel/45 text-text-muted group-hover:border-borderSoft/40 group-hover:text-text-secondary',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      {!collapsed && <div className="min-w-0">
        <p
          className={cn(
            'text-[14px] font-semibold tracking-tight',
            active ? 'text-text-primary' : compact ? 'text-text-primary/85' : 'text-text-secondary',
          )}
        >
          {label}
        </p>
        {caption ? <p className="mt-0.5 hidden truncate text-[11px] leading-4 text-text-muted/85 sm:block">{caption}</p> : null}
      </div>}
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
        'group relative flex min-h-[148px] w-full flex-col overflow-hidden rounded-[22px] border p-5 text-left transition-all duration-200',
        active
          ? 'border-accent/35 bg-accent/10 shadow-[0_14px_34px_rgba(var(--accent),0.12)]'
          : 'border-borderSoft/28 bg-panel/45 hover:-translate-y-1 hover:border-borderSoft/50 hover:bg-panel/70 hover:shadow-[0_16px_34px_rgba(var(--shadow-color),0.12)]',
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-80', gradient)} />
      <div className={cn('pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.08] blur-2xl transition-opacity group-hover:opacity-[0.16]', gradient)} />

      <button
        type="button"
        className="absolute inset-0 rounded-[22px] text-left"
        onClick={onClick}
      >
        <span className="sr-only">Open {label}</span>
      </button>

      <div className="pointer-events-none relative z-[1] flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br shadow-[0_10px_22px_rgba(0,0,0,0.16)] ring-1 ring-white/20',
            gradient,
          )}
        >
          <Icon className="h-5 w-5 text-white drop-shadow-sm" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-text-muted/45 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text-secondary" />
      </div>

      <div className="pointer-events-none relative z-[1] mt-4 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-[15px] font-semibold tracking-tight', active ? 'text-text-primary' : 'text-text-secondary')}>
            {label}
          </p>
          {active ? <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">Current</span> : null}
        </div>
        <p className="mt-1 text-[12px] leading-5 text-text-muted">{description}</p>
      </div>

      <div className="pointer-events-none relative z-[2] mt-auto flex items-end justify-end pt-3">
        <button
          type="button"
          title={pinned ? `Remove ${label} from sidebar` : `Pin ${label} to sidebar`}
          aria-label={pinned ? `Remove ${label} from sidebar` : `Pin ${label} to sidebar`}
          className={cn(
            'pointer-events-auto',
            'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] transition-colors',
            pinned
              ? 'border-accent/25 bg-accent/12 text-accent hover:bg-accent/18'
              : 'border-borderSoft/30 bg-panel/60 text-text-muted hover:border-borderSoft/50 hover:text-text-primary',
          )}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePinned();
          }}
        >
          {pinned ? <CheckCircle2 className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          {pinned ? 'Pinned' : 'Pin'}
        </button>
      </div>
    </div>
  );
}

function SidebarContent({
  pinnedAppIds,
  onOpenApps,
  onOpenChat,
  onViewSelect,
  activeView,
  ensureIds,
  compact = false,
  collapsed = false,
}: {
  pinnedAppIds: SidebarPinnedAppId[];
  onOpenApps: () => void;
  onOpenChat?: () => void;
  onViewSelect: (view: MainView) => void;
  activeView: MainView;
  ensureIds?: SidebarPinnedAppId[];
  compact?: boolean;
  collapsed?: boolean;
}) {
  const visibleIds = ensureIds
    ? Array.from(new Set([...pinnedAppIds, ...ensureIds]))
    : pinnedAppIds;

  const appsButton = (
    <button
      type="button"
      className="group flex w-full items-center gap-3 rounded-[14px] border border-borderSoft/30 bg-panel/35 px-3 py-2.5 text-left transition-all duration-200 hover:border-accent/25 hover:bg-accent/8"
      onClick={onOpenApps}
    >
      <div className="grid h-8 w-8 shrink-0 grid-cols-2 gap-[3px] rounded-[10px] border border-borderSoft/25 bg-panel/55 p-[7px] transition-colors group-hover:border-accent/25">
        <span className="rounded-[2px] bg-cyan-400/90" />
        <span className="rounded-[2px] bg-fuchsia-400/90" />
        <span className="rounded-[2px] bg-amber-400/90" />
        <span className="rounded-[2px] bg-emerald-400/90" />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold tracking-tight text-text-primary/90">All apps</p>
        <p className="mt-0.5 text-[11px] text-text-muted/80">Customize your sidebar</p>
      </div>
    </button>
  );

  const workspaceMode = useTeamStore((s) => s.workspaceMode);
  const teamUnlocked = useTeamStore((s) => s.teamUnlocked);
  const isTeam = workspaceMode === 'team' && teamUnlocked;

  return (
    // min-h-0 + flex-1 rather than h-full: the profile card sits below this in
    // both shells, and h-full would push it past the bottom edge.
    <div className="flex min-h-0 flex-1 flex-col">
      {!compact ? (
        <button
          type="button"
          onClick={() => onViewSelect(isTeam ? 'missions' : 'dashboard')}
          aria-label="Go to dashboard"
          className={cn('-mx-1 flex items-center rounded-2xl px-1 py-1 transition-opacity hover:opacity-80 cursor-pointer', collapsed && 'justify-center')}
        >
          <SynCatchWordmark themed animated logoClassName="h-12 w-12" textClassName={cn('text-2xl font-bold tracking-tight', collapsed && 'hidden')} />
        </button>
      ) : null}

      <div className={cn(compact ? 'space-y-2' : 'mt-7')}>
        {isTeam ? (
          <div className={cn('pt-1', compact ? 'space-y-1' : 'space-y-1.5')}>
            {compact && onOpenChat ? (
              <NavButton
                active={false}
                compact
                collapsed={collapsed}
                gradient="from-rose-500 via-orange-500 to-amber-500"
                icon={MessageSquare}
                label="Chat"
                onClick={onOpenChat}
              />
            ) : null}
            {teamLauncherViews.map((view) => (
              <NavButton
                active={activeView === view.id}
                caption={view.description}
                compact={compact}
                collapsed={collapsed}
                gradient={view.gradient}
                icon={view.icon}
                key={view.id}
                label={view.label}
                onClick={() => onViewSelect(view.id)}
              />
            ))}
          </div>
        ) : visibleIds.length > 0 ? (
          <div className={cn('pt-1', compact ? 'space-y-1' : 'space-y-1.5')}>
            {launcherViews
              .filter((view) => view.id !== 'settings' && visibleIds.includes(view.id))
              .map((view) => (
                <NavButton
                  active={activeView === view.id}
                  caption={view.description}
                  compact={compact}
                  collapsed={collapsed}
                  gradient={view.gradient}
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

      {!compact && !isTeam && !collapsed ? (
        /* Start-button style: Apps anchored to the bottom-left corner of the sidebar. */
        <div className="mt-auto border-t border-borderSoft/20 pt-4">{appsButton}</div>
      ) : null}
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
  const pinnedViews = launcherViews.filter((view) => pinnedAppIds.includes(view.id));
  const otherViews = launcherViews.filter((view) => !pinnedAppIds.includes(view.id));

  const renderAppGrid = (views: typeof launcherViews) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {views.map((view) => (
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
  );

  return (
    <div className="min-h-full pb-8">
      <Card className="relative overflow-hidden rounded-[30px] border-borderSoft/25 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 grid-cols-2 gap-1 rounded-[16px] border border-borderSoft/25 bg-panel2/55 p-3 sm:grid">
              <span className="rounded-[3px] bg-cyan-400" />
              <span className="rounded-[3px] bg-fuchsia-400" />
              <span className="rounded-[3px] bg-amber-400" />
              <span className="rounded-[3px] bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted/75">App launcher</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Your workspace</h2>
              <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-text-secondary">
                Open a tool or pin the ones you use most for faster access from the sidebar.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-borderSoft/25 bg-panel2/45 px-3 py-1 text-[10px] font-medium text-text-muted">
                  {launcherViews.length} apps
                </span>
                <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-[10px] font-medium text-accent">
                  {pinnedViews.length} pinned
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button aria-label="Close app launcher" onClick={onClose} size="sm" type="button" variant="ghost" className="h-9 w-9 rounded-full p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {pinnedViews.length > 0 ? (
        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h3 className="text-[15px] font-semibold text-text-primary">Pinned</h3>
              <p className="mt-0.5 text-[11px] text-text-muted">Shown in your sidebar</p>
            </div>
            <span className="text-[11px] tabular-nums text-text-muted/70">{pinnedViews.length}</span>
          </div>
          {renderAppGrid(pinnedViews)}
        </section>
      ) : null}

      {otherViews.length > 0 ? (
        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h3 className="text-[15px] font-semibold text-text-primary">All apps</h3>
              <p className="mt-0.5 text-[11px] text-text-muted">More tools for your workflow</p>
            </div>
            <span className="text-[11px] tabular-nums text-text-muted/70">{otherViews.length}</span>
          </div>
          {renderAppGrid(otherViews)}
        </section>
      ) : null}
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
        'rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.01em] transition-colors duration-150',
        active
          ? 'border-accent/45 bg-accent/90 text-[rgb(var(--accent-contrast))] shadow-sm'
          : 'border-transparent bg-transparent text-text-secondary hover:bg-panel/60 hover:text-text-primary',
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SettingSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-wait disabled:opacity-50',
        checked
          ? 'border-accent/55 bg-accent shadow-[0_0_18px_rgb(var(--accent)/0.18)]'
          : 'border-borderSoft/40 bg-panel2/75',
      )}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full shadow-sm transition-all duration-200',
          checked
            ? 'left-[1.55rem] bg-[rgb(var(--accent-contrast))]'
            : 'left-1 bg-text-muted',
        )}
      />
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
  mission,
  selected,
  blocked,
  active,
  footer,
  showDescription = true,
  className,
  dragging,
  draggable,
  onDragEnd,
  onDragStart,
  onSelect,
}: {
  task: Task;
  mission?: Mission;
  selected?: boolean;
  blocked?: boolean;
  active?: boolean;
  footer?: ReactNode;
  showDescription?: boolean;
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
        'group main-list-item rounded-[16px] border p-4 transition-[transform,opacity,border-color,background-color,box-shadow] duration-150 ease-out',
        selected
          ? 'is-selected border-accent/55 bg-accent/14 shadow-[inset_0_0_0_1px_rgb(var(--accent)/0.10),0_7px_18px_rgb(var(--accent)/0.10)]'
          : 'border-borderSoft/40 bg-panel2/55 shadow-[inset_0_1px_0_rgb(var(--text-primary)/0.02)] hover:-translate-y-0.5 hover:border-borderStrong/45 hover:bg-panel2/75 hover:shadow-[0_10px_24px_rgb(var(--shadow-color)/0.10)]',
        draggable ? 'cursor-grab active:cursor-grabbing' : null,
        dragging ? 'scale-[0.985] border-accent/26 bg-accent/8 opacity-45 shadow-none' : null,
        className,
      )}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
    >
      <button className="w-full text-left" onClick={onSelect} type="button">
        <p className="break-words text-[15px] font-semibold leading-[1.4] tracking-[-0.01em] text-text-primary sm:text-base">{task.title}</p>
        {mission ? (
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-text-secondary">
            <MissionIcon icon={mission.emoji} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{mission.title}</span>
          </div>
        ) : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {active ? <Badge tone="accent" className="shrink-0 text-[9px] px-1.5">Live</Badge> : null}
          {blocked ? <Badge tone="warning" className="shrink-0 text-[9px] px-1.5">Blocked</Badge> : null}
          <Badge className="shrink-0 px-1.5 py-0.5 text-[10px]" tone={getTaskTone(task)}>{humanizePriority(task.priority)}</Badge>
          <Badge className="shrink-0 px-1.5 py-0.5 text-[10px]" tone="neutral">{task.estimated_minutes}m</Badge>
        </div>
        {showDescription && describeTask(task) ? (
          <p className="mt-2.5 line-clamp-2 text-[13px] leading-[1.5] text-text-secondary/90">
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
  mission,
  active,
  dragging,
  draggable,
  onDragEnd,
  onDragStart,
  onSelect,
}: {
  task: Task;
  mission?: Mission;
  active?: boolean;
  dragging?: boolean;
  draggable?: boolean;
  onDragEnd?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'group main-list-item rounded-[14px] border border-borderSoft/40 bg-panel2/55 p-3 shadow-[inset_0_1px_0_rgb(var(--text-primary)/0.02)] transition-[transform,opacity,border-color,background-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:border-borderStrong/45 hover:bg-panel2/75 hover:shadow-[0_8px_20px_rgb(var(--shadow-color)/0.09)]',
        draggable ? 'cursor-grab active:cursor-grabbing' : null,
        dragging ? 'scale-[0.985] border-accent/26 bg-accent/8 opacity-45 shadow-none' : null,
      )}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
    >
      <button className="w-full text-left" onClick={onSelect} type="button">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-[1.4] tracking-tight text-text-primary">{task.title}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {active ? <Badge tone="accent" className="shrink-0 text-[8px] px-1.5 py-0">Live</Badge> : null}
            <Badge className="px-1.5 py-0.5 text-[9px]" tone={getTaskTone(task)}>{humanizePriority(task.priority)}</Badge>
          </div>
        </div>
        {mission ? (
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-text-secondary">
            <MissionIcon icon={mission.emoji} className="h-3 w-3 shrink-0" />
            <span className="truncate">{mission.title}</span>
          </div>
        ) : null}
      </button>

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
        'group flex items-center gap-2 rounded-[14px] border p-3 shadow-[inset_0_1px_0_rgb(var(--text-primary)/0.02)] transition-[transform,opacity,border-color,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgb(var(--shadow-color)/0.09)]',
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

/**
 * Profile + settings entry point, shared by the mobile drawer and the desktop
 * sidebar. Identity comes from the signed-in Supabase user rather than a team
 * persona, so it reads the same in personal and team mode.
 */
function SidebarProfile({ onOpen, collapsed = false }: { onOpen: () => void; collapsed?: boolean }) {
  const session = useAuthStore((state) => state.session);
  const user = session?.user ?? null;
  const name = getUserDisplayName(user?.user_metadata, user?.email);
  const initials = getInitials(name, user?.email);

  const avatar = (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/12 text-xs font-bold text-accent">
      {initials}
    </span>
  );

  if (collapsed) {
    return (
      <div className="mt-auto border-t border-borderSoft/20 pt-4">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full justify-center rounded-2xl p-1 transition-opacity hover:opacity-80"
          aria-label="Open profile settings"
          title={`${name} · Settings`}
        >
          {avatar}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative mt-5 flex w-full items-center gap-3 rounded-2xl border border-borderSoft/25 bg-panel/55 p-3 text-left transition-colors hover:border-accent/30 hover:bg-panel"
      aria-label="Open profile settings"
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text-primary">{name}</span>
        <span className="mt-0.5 block truncate text-[11px] text-text-muted">{user?.email ?? 'Signed out'}</span>
      </span>
      <Settings className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
    </button>
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
  const hudTransparency = useFocusStore((state) => state.hudTransparency);
  const toggleHudTransparency = useFocusStore((state) => state.toggleHudTransparency);

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

  const [activeView, setActiveViewState] = useState<MainView>(() => viewFromPath(window.location.pathname));
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('account');
  const [minutes, setMinutes] = useState(25);
  const [presetId, setPresetId] = useState<SessionPresetId>('focus');
  const [captureState, setCaptureState] = useState<CaptureState>(null);
  const [captureSaving, setCaptureSaving] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const [completedArchiveOpen, setCompletedArchiveOpen] = useState(false);
  const [taskScopeMode, setTaskScopeMode] = useState<TaskScopeMode>('pending');
  const [taskMissionFilter, setTaskMissionFilter] = useState<string>('all');
  const [taskMissionMenuOpen, setTaskMissionMenuOpen] = useState(false);
  const [completedFilterMode, setCompletedFilterMode] = useState<CompletedFilterMode>('all');
  const [completedFilterFromDate, setCompletedFilterFromDate] = useState('');
  const [completedFilterFromTime, setCompletedFilterFromTime] = useState('00:00');
  const [completedFilterToDate, setCompletedFilterToDate] = useState('');
  const [completedFilterToTime, setCompletedFilterToTime] = useState('23:59');
  const [pageDateMenuOpen, setPageDateMenuOpen] = useState(false);
  const [previousViewBeforeApps, setPreviousViewBeforeApps] = useState<MainView>('today');
  const [calendarNoteTargetId, setCalendarNoteTargetId] = useState<string | null>(null);
  const [calendarJournalTargetId, setCalendarJournalTargetId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropLane, setDropLane] = useState<TaskLane | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailMissionId, setDetailMissionId] = useState<string | null>(null);
  const [missionComposerOpen, setMissionComposerOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('syncatch-sidebar-collapsed') === '1');
  const [mobileChatPickerOpen, setMobileChatPickerOpen] = useState(false);
  const [missionHubNavSlot, setMissionHubNavSlot] = useState<HTMLElement | null>(null);
  const [fabDockOpen, setFabDockOpen] = useState(false);
  const dragImageRef = useRef<HTMLImageElement | null>(null);
  const dropHandledRef = useRef(false);

  useEffect(() => {
    if (window.location.pathname.startsWith('/team/')) {
      useTeamStore.getState().setWorkspaceMode('team');
    }
    const handlePopState = () => {
      setSettingsModalOpen(false);
      useTeamStore.getState().setWorkspaceMode(window.location.pathname.startsWith('/team/') ? 'team' : 'personal');
      setActiveViewState(viewFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!settingsModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsModalOpen]);

  function setActiveView(view: MainView) {
    setActiveViewState(view);
    const teamPrefix = useTeamStore.getState().workspaceMode === 'team' ? '/team' : '';
    const nextPath = `${teamPrefix}${MAIN_VIEW_PATHS[view]}`;
    if (window.location.pathname !== nextPath) window.history.pushState(null, '', nextPath);
  }

  function openSettingsModal() {
    setSettingsCategory('account');
    setSettingsModalOpen(true);
  }

  function openFullSettings() {
    setSettingsModalOpen(false);
    setActiveView('settings');
  }

  function navigateToView(view: MainView) {
    if (view !== 'tasks') {
      setTaskComposerOpen(false);
    }
    if (view === 'settings') {
      openSettingsModal();
      return;
    }
    setActiveView(view);
  }
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
  const missionTaskCounts = useMemo(() => {
    const counts: Record<string, { total: number; pending: number }> = {};
    let unassignedTotal = 0;
    let unassignedPending = 0;

    for (const task of tasks) {
      const effMissionId = task.mission_id || (task.parent_task_id ? tasksById.get(task.parent_task_id)?.mission_id : null);
      const isPending = task.status !== 'done' && task.lane !== 'done';

      if (!effMissionId) {
        unassignedTotal++;
        if (isPending) unassignedPending++;
      } else {
        if (!counts[effMissionId]) {
          counts[effMissionId] = { total: 0, pending: 0 };
        }
        counts[effMissionId].total++;
        if (isPending) counts[effMissionId].pending++;
      }
    }
    return { counts, unassignedTotal, unassignedPending, totalTasks: tasks.length };
  }, [tasks, tasksById]);

  const matchesTaskMission = useCallback(
    (task: Task) => {
      if (taskMissionFilter === 'all') return true;
      const taskMissionId = task.mission_id || (task.parent_task_id ? tasksById.get(task.parent_task_id)?.mission_id : null);
      if (taskMissionFilter === 'none') return !taskMissionId;
      return taskMissionId === taskMissionFilter;
    },
    [taskMissionFilter, tasksById],
  );

  const rootTasksForSettings = useMemo(() => {
    const roots = getRootTasks(tasks);
    if (taskMissionFilter === 'all') return roots;
    if (taskMissionFilter === 'none') return roots.filter((t) => !t.mission_id);
    return roots.filter((t) => t.mission_id === taskMissionFilter);
  }, [tasks, taskMissionFilter]);

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

    setCompletedFilterMode('all');
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
    () => getCompletedDigestItems(completedTasks, subtaskBoard.done).filter(matchesTaskMission),
    [completedTasks, matchesTaskMission, subtaskBoard.done],
  );
  const visibleTaskBoard = useMemo(() => {
    const today = formatDateInputValue(new Date());
    const matchesScope = (task: Task) => {
      if (taskScopeMode === 'all') return true;
      if (taskScopeMode === 'pending') return task.status !== 'done' && task.lane !== 'done';
      return task.scheduled_for === today || task.due_date === today || Boolean(task.completed_at?.startsWith(today));
    };
    return taskBoard.map((column) => {
      const isCompletedColumn = column.lane === 'done';
      return {
        ...column,
        tasks: column.tasks.filter((task) =>
          (isCompletedColumn ? (taskScopeMode === 'today' ? matchesScope(task) : true) : matchesScope(task)) &&
          matchesTaskMission(task) &&
          taskMatchesBoardRange(task, completedFilterRange.from, completedFilterRange.to),
        ),
        subtasks: column.subtasks.filter((task) =>
          (isCompletedColumn ? (taskScopeMode === 'today' ? matchesScope(task) : true) : matchesScope(task)) &&
          matchesTaskMission(task) &&
          taskMatchesBoardRange(task, completedFilterRange.from, completedFilterRange.to),
        ),
      };
    });
  }, [completedFilterRange.from, completedFilterRange.to, matchesTaskMission, taskBoard, taskScopeMode]);
  const visibleBlockedTasks = useMemo(
    () =>
      blockedTasks.filter((task) =>
        matchesTaskMission(task) && taskMatchesBoardRange(task, completedFilterRange.from, completedFilterRange.to),
      ),
    [blockedTasks, completedFilterRange.from, completedFilterRange.to, matchesTaskMission],
  );

  useEffect(() => {
    if (activeView !== 'tasks') {
      setPageDateMenuOpen(false);
      setTaskMissionMenuOpen(false);
    }
  }, [activeView]);

  useEffect(() => {
    if (taskComposerOpen) {
      setPageDateMenuOpen(false);
      setTaskMissionMenuOpen(false);
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
    if (!taskMissionMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTaskMissionMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [taskMissionMenuOpen]);

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
      setCurrentMission(activeSession.task_id);
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
  const workspaceMode = useTeamStore((s) => s.workspaceMode);
  const teamUnlocked = useTeamStore((s) => s.teamUnlocked);
  const teamMissions = useTeamStore((s) => s.teamMissions);


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
    detailTask !== null && (activeView === 'focus' || activeView === 'tasks' || activeView === 'missions' || activeView === 'roadmap' || activeView === 'dashboard');

  const detailMission = detailMissionId ? missions.find((m) => m.id === detailMissionId) ?? null : null;
  const showMissionDetailPanel =
    detailMission !== null && (activeView === 'missions' || activeView === 'roadmap' || activeView === 'dashboard');

  function openAppsView() {
    if (activeView !== 'apps') {
      setPreviousViewBeforeApps(activeView);
    }

    setActiveView('apps');
  }

  function closeAppsView() {
    setActiveView(previousViewBeforeApps);
  }

  function openCalendarTarget(target: CalendarOpenTarget) {
    if (target.destination === 'tasks' && target.entityId) {
      selectTask(target.entityId);
      setDetailTaskId(target.entityId);
    } else if (target.destination === 'missions' && target.entityId) {
      useMissionStore.getState().selectMission(target.entityId);
      setDetailMissionId(target.entityId);
    } else if (target.destination === 'notes' && target.entityId) {
      setCalendarNoteTargetId(target.entityId);
    } else if (target.destination === 'journal') {
      useJournalStore.getState().selectDate(target.date);
      setCalendarJournalTargetId(target.entityId ?? null);
    }
    setActiveView(target.destination);
  }

  function handleStartSession(task: Task, nextMinutes = minutes, nextPresetId = presetId) {
    selectTask(task.id);
    setCurrentMission(task.id);

    if (task.lane !== 'now' && task.lane !== 'done') {
      void moveTaskToLane(task.id, 'now');
    }

    startSession({
      taskId: task.id,
      taskTitle: task.title,
      minutes: nextMinutes,
      presetId: nextPresetId,
    });
    startFocusSession(nextMinutes);
  }

  function handlePause(kind: 'pause' | 'break' | 'distraction', detail = '') {
    pauseActiveSession(kind, detail);
    pauseFocusSession();
  }

  function handleResume(nextMinutes: number) {
    resumeActiveSession(nextMinutes);
    startFocusSession(nextMinutes);
  }

  function handleFinishSession() {
    completeActiveSession();
    resetFocusSession();
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
    void moveTaskToLane(task.id, lane);

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
        await createTask({
          title: captureState.value,
          lane: 'inbox',
          estimated_minutes: 15,
        });
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
        <Card 
          className="mission-card group relative cursor-pointer rounded-[24px] border-borderSoft/45 bg-panel/80 p-4 shadow-[inset_0_1px_0_rgb(var(--text-primary)/0.025)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel sm:p-5"
          onClick={() => setDetailMissionId(mission.id)}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-accent/20 bg-accent/10 text-accent"
              style={{ backgroundColor: `color-mix(in srgb, var(--accent) 10%, transparent)` }}
            >
              <MissionIcon icon={mission.emoji} className="h-5 w-5" />
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
          <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-borderSoft/20 pt-3" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingMission(mission); setMissionComposerOpen(true); }} className="h-8 gap-1.5 px-2 text-xs sm:text-sm">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            {mission.status === 'active' ? (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void setMissionStatus(mission.id, 'on_hold'); }} className="h-8 gap-1.5 px-2 text-xs text-warning sm:text-sm">
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
            ) : mission.status === 'on_hold' ? (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void setMissionStatus(mission.id, 'active'); }} className="h-8 gap-1.5 px-2 text-xs text-accent sm:text-sm">
                <Play className="h-3.5 w-3.5" /> Resume
              </Button>
            ) : null}
            {mission.status === 'active' ? (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void setMissionStatus(mission.id, 'completed'); }} className="h-8 gap-1.5 px-2 text-xs text-success sm:text-sm">
                <CheckCircle className="h-3.5 w-3.5" /> Done
              </Button>
            ) : mission.status === 'completed' ? (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void setMissionStatus(mission.id, 'active'); }} className="h-8 gap-1.5 px-2 text-xs text-accent sm:text-sm">
                <RotateCcw className="h-3.5 w-3.5" /> Undo
              </Button>
            ) : null}
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={(e) => {
                e.stopPropagation();
                void confirmDialog('This mission and all its associations will be permanently removed.', { title: 'Delete mission?', confirmLabel: 'Delete mission', danger: true }).then((ok) => { if (ok) void deleteMission(mission.id); });
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
            <div className="flex min-h-[64px] items-center justify-between border-b border-borderSoft/20 px-3 py-2.5 lg:hidden">
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
            <div className="mission-card-grid grid gap-4 rounded-[26px] border border-borderSoft/35 bg-panel2/30 p-3 sm:p-4 lg:grid-cols-2">
              {activeMissions.map((m) => <MissionCard key={m.id} mission={m} />)}
            </div>
          </div>
        ) : null}

        {otherMissions.length > 0 ? (
          <div className="space-y-3">
            <SectionHeading action={<Badge tone="neutral">{otherMissions.length}</Badge>} title="Other" />
            <div className="mission-card-grid grid gap-4 rounded-[26px] border border-borderSoft/35 bg-panel2/30 p-3 sm:p-4 lg:grid-cols-2">
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
          aria-label={`Open task activity date filter. Current range: ${completedFilterSummary}`}
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
            <div className="fixed inset-x-3 top-[72px] z-40 w-auto sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[min(420px,calc(100vw-1.5rem))]">
              <Card
                id="task-date-filter-popover"
                className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[24px] border border-borderSoft/28 bg-panel/96 p-3 shadow-[0_18px_50px_rgb(var(--shadow-color)/0.22)] backdrop-blur-md sm:max-h-none sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-text-muted">Activity filter</p>
                    <h3 className="mt-1 text-base font-bold text-text-primary">Task date & time</h3>
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

  function renderTaskScopeControl() {
    return (
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-borderSoft/20 bg-panel2/35 p-1">
        {([
          { id: 'pending' as const, label: 'Pending', count: rootTasksForSettings.filter((task) => task.status !== 'done' && task.lane !== 'done').length, icon: ClipboardList },
          { id: 'today' as const, label: "Today's tasks", count: rootTasksForSettings.filter((task) => { const today = formatDateInputValue(new Date()); return task.scheduled_for === today || task.due_date === today || Boolean(task.completed_at?.startsWith(today)); }).length, icon: CalendarDays },
          { id: 'all' as const, label: 'All tasks', count: rootTasksForSettings.length, icon: CheckSquare },
        ]).map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTaskScopeMode(id)}
            title={label}
            className={cn(
              'flex min-w-0 items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all xl:px-3',
              taskScopeMode === id ? 'bg-white/[0.1] text-text-primary shadow-sm' : 'text-text-secondary hover:bg-panel/50 hover:text-text-primary',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden whitespace-nowrap xl:inline">{label}</span>
            <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] tabular-nums', taskScopeMode === id ? 'bg-accent/12' : 'bg-text-primary/5')}>{count}</span>
          </button>
        ))}
      </div>
    );
  }

  function renderTaskMissionFilterControl() {
    const selectedMission = missions.find((m) => m.id === taskMissionFilter);
    const activeLabel =
      taskMissionFilter === 'all'
        ? 'All missions'
        : taskMissionFilter === 'none'
          ? 'No mission'
          : selectedMission?.title ?? 'Mission';

    const activeCount =
      taskMissionFilter === 'all'
        ? tasks.length
        : taskMissionFilter === 'none'
          ? missionTaskCounts.unassignedTotal
          : (missionTaskCounts.counts[taskMissionFilter]?.total ?? 0);

    const isFiltered = taskMissionFilter !== 'all';

    return (
      <div className="relative shrink-0">
        <Button
          aria-controls="task-mission-filter-popover"
          aria-expanded={taskMissionMenuOpen}
          aria-label={`Filter tasks by mission. Currently selected: ${activeLabel}`}
          className={cn(
            'h-9 shrink-0 rounded-full px-3 sm:px-4 max-[380px]:w-9 max-[380px]:justify-center max-[380px]:gap-0 max-[380px]:px-0 transition-all',
            isFiltered
              ? 'border-accent/40 bg-accent/12 text-accent hover:bg-accent/20 hover:border-accent/60'
              : '',
          )}
          onClick={() => setTaskMissionMenuOpen((open) => !open)}
          size="sm"
          type="button"
          title={`Filter by mission: ${activeLabel}`}
          variant="secondary"
        >
          {taskMissionFilter === 'all' ? (
            <Target className="h-4 w-4 shrink-0 text-text-secondary" />
          ) : taskMissionFilter === 'none' ? (
            <CircleDashed className="h-4 w-4 shrink-0 text-text-muted" />
          ) : selectedMission ? (
            <MissionIcon icon={selectedMission.emoji} className="h-4 w-4 shrink-0" />
          ) : (
            <Target className="h-4 w-4 shrink-0" />
          )}
          <span className="hidden max-w-[130px] truncate sm:inline max-[380px]:hidden">{activeLabel}</span>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tabular-nums leading-none max-[380px]:hidden',
              isFiltered
                ? 'border-accent/30 bg-accent/20 text-accent'
                : 'border-borderSoft/40 bg-panel/60 text-text-secondary',
            )}
          >
            {activeCount}
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform duration-150 max-[380px]:hidden', taskMissionMenuOpen ? 'rotate-180' : null)}
          />
        </Button>

        {taskMissionMenuOpen ? (
          <>
            <div
              aria-hidden="true"
              className="fixed inset-0 z-30 bg-transparent"
              onClick={() => setTaskMissionMenuOpen(false)}
            />
            <div className="fixed inset-x-3 top-[72px] z-40 w-auto sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72">
              <Card
                id="task-mission-filter-popover"
                className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[22px] border border-borderSoft/28 bg-panel/96 p-2 shadow-[0_18px_50px_rgb(var(--shadow-color)/0.22)] backdrop-blur-md sm:max-h-[460px] scrollbar-thin"
              >
                <div className="px-2.5 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">Filter by Mission</p>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTaskMissionFilter('all');
                      setTaskMissionMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors',
                      taskMissionFilter === 'all'
                        ? 'bg-accent/12 text-accent font-semibold'
                        : 'text-text-secondary hover:bg-panel2/60 hover:text-text-primary',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Target className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">All missions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-panel px-1.5 py-0.5 text-[9px] tabular-nums text-text-muted">
                        {tasks.length}
                      </span>
                      {taskMissionFilter === 'all' ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTaskMissionFilter('none');
                      setTaskMissionMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors',
                      taskMissionFilter === 'none'
                        ? 'bg-accent/12 text-accent font-semibold'
                        : 'text-text-secondary hover:bg-panel2/60 hover:text-text-primary',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CircleDashed className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <span className="truncate">No mission (Unassigned)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-panel px-1.5 py-0.5 text-[9px] tabular-nums text-text-muted">
                        {missionTaskCounts.unassignedTotal}
                      </span>
                      {taskMissionFilter === 'none' ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
                    </div>
                  </button>

                  {missions.length > 0 ? (
                    <>
                      <div className="my-1.5 border-t border-borderSoft/30" />
                      <p className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted/70">
                        Active Missions ({missions.length})
                      </p>
                      {missions.map((mission) => {
                        const count = missionTaskCounts.counts[mission.id]?.total ?? 0;
                        const isSelected = taskMissionFilter === mission.id;
                        return (
                          <button
                            key={mission.id}
                            type="button"
                            onClick={() => {
                              setTaskMissionFilter(mission.id);
                              setTaskMissionMenuOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors',
                              isSelected
                                ? 'bg-accent/12 text-accent font-semibold'
                                : 'text-text-secondary hover:bg-panel2/60 hover:text-text-primary',
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <MissionIcon icon={mission.emoji} className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{mission.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-panel px-1.5 py-0.5 text-[9px] tabular-nums text-text-muted">
                                {count}
                              </span>
                              {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
                            </div>
                          </button>
                        );
                      })}
                    </>
                  ) : null}
                </div>

                {isFiltered ? (
                  <div className="mt-2 border-t border-borderSoft/30 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTaskMissionFilter('all');
                        setTaskMissionMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-center text-[11px] font-medium text-text-muted hover:bg-panel2/50 hover:text-text-primary transition-colors"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset mission filter</span>
                    </button>
                  </div>
                ) : null}
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
              <div className="flex min-w-0 items-center gap-2.5">
                <Button
                  aria-label="Open sidebar"
                  className="h-12 w-12 shrink-0 rounded-[16px] p-0"
                  onClick={() => setMobileNavOpen(true)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <h2 className="truncate text-lg font-bold text-text-primary">Add Task</h2>
              </div>
              <Button onClick={() => setTaskComposerOpen(false)} size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-0">
              {isMobile ? (
                <div className="flex h-full min-h-0 flex-col">
                  <TaskCreationComposer
                    autoFocus
                    defaultMissionId={taskMissionFilter !== 'all' && taskMissionFilter !== 'none' ? taskMissionFilter : null}
                    fillHeight
                    onCancel={() => setTaskComposerOpen(false)}
                    onSubmitted={() => {
                      setTaskComposerOpen(false);
                      setActiveView('tasks');
                    }}
                    submitLabel="Save task"
                  />
                </div>
              ) : (
                <Card className="rounded-[24px] p-5 sm:rounded-[34px] sm:p-6 lg:border-none lg:bg-transparent lg:p-0">
                  <SectionHeading title="Add task" />
                  <TaskCreationComposer
                    autoFocus
                    defaultMissionId={taskMissionFilter !== 'all' && taskMissionFilter !== 'none' ? taskMissionFilter : null}
                    onCancel={() => setTaskComposerOpen(false)}
                    onSubmitted={() => {
                      setTaskComposerOpen(false);
                      setActiveView('tasks');
                    }}
                    submitLabel="Save task"
                  />
                </Card>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none sm:hidden">
          {renderTaskMissionFilterControl()}
          <Button className="h-9 shrink-0 rounded-full px-4" onClick={() => setTaskComposerOpen(true)} size="sm" type="button">
            <Plus className="h-4 w-4" /> Add
          </Button>
          {renderTaskDateFilterControl()}
        </div>

        <div className="md:hidden">
          {renderTaskScopeControl()}
        </div>

        <div className="task-board-shell scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain rounded-[22px] border border-borderSoft/35 bg-panel2/30 p-2.5 pb-3 sm:gap-4 sm:rounded-[26px] sm:p-4 2xl:grid 2xl:grid-cols-[repeat(4,minmax(240px,1fr))_minmax(280px,340px)] 2xl:overflow-visible">
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
                  'task-board-panel kanban-column flex min-h-[420px] w-[calc(100vw-3.25rem)] max-w-[340px] shrink-0 snap-start flex-col rounded-[20px] border-borderSoft/45 bg-panel/80 p-4 shadow-[inset_0_1px_0_rgb(var(--text-primary)/0.025)] sm:w-[340px] sm:rounded-[24px] sm:p-5 2xl:w-auto 2xl:max-w-none',
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
                      <div className="flex flex-1 flex-col justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 px-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">
                              {completedArchiveOpen ? 'All completed' : 'Completed tasks'}
                            </p>
                            {completedItems.length > completedDigestLimit ? (
                              <Badge tone="success" className="px-2 py-0.5 text-[9px]">
                                {visibleCompletedItems.length} of {completedItems.length}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            {visibleCompletedItems.map((task) => (
                              <CompletedDigestItem
                                draggable
                                dragging={draggedTaskId === task.id}
                                key={task.id}
                                onDragEnd={handleTaskDragEnd}
                                onDragStart={(event) => handleTaskDragStart(event, task.id)}
                                onRestore={() => void moveTaskToLane(task.id, 'inbox')}
                                onSelect={() => {
                                  selectTask(task.id);
                                  setDetailTaskId(task.id);
                                }}
                                parentTask={task.parent_task_id ? tasksById.get(task.parent_task_id) ?? null : null}
                                task={task}
                              />
                            ))}
                          </div>
                        </div>

                        {completedItems.length > completedDigestLimit ? (
                          <Button
                            className="mt-2 w-full justify-between rounded-xl border border-borderSoft/30 bg-panel/30 px-3 py-2 text-xs text-text-secondary hover:bg-panel hover:text-text-primary transition-all"
                            onClick={() => setCompletedArchiveOpen((open) => !open)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <span>{completedArchiveOpen ? 'Show less' : `Show all (${completedItems.length})`}</span>
                            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', completedArchiveOpen ? 'rotate-180' : null)} />
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
                          key={task.id}
                          mission={missions.find((mission) => mission.id === task.mission_id)}
                          onDragEnd={handleTaskDragEnd}
                          onDragStart={(event) => handleTaskDragStart(event, task.id)}
                          onSelect={() => {
                            selectTask(task.id);
                            setDetailTaskId(task.id);
                          }}
                          showDescription={false}
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
                                  mission={missions.find((mission) => mission.id === task.mission_id)}
                                  onDragEnd={handleTaskDragEnd}
                                  onDragStart={(event) => handleTaskDragStart(event, task.id)}
                                  onSelect={() => {
                                    selectTask(task.id);
                                    setDetailTaskId(task.id);
                                  }}
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

  function renderSettings(section: SettingsCategory | 'all' = 'all') {
    return (
      <div className="space-y-6">
        {section === 'all' || section === 'account' ? <ProfileSettingsCard
          completedMissionCount={completedMissionCount}
          completedTaskCount={completedRootTaskCount}
          missionCount={missions.length}
          rootTaskCount={rootTasksForSettings.length}
          sessionCount={sessions.length}
          syncModeLabel={syncMode === 'cloud' ? 'Cloud sync' : 'Local only'}
        /> : null}

        {section === 'all' || section === 'ai' ? <AiProviderCard /> : null}

        {section === 'all' || section === 'downloads' ? <DownloadsCard /> : null}

        {section === 'all' || section === 'appearance' ? <Card className="rounded-[22px] p-3.5 sm:rounded-[24px] sm:p-5">
          <SectionHeading action={<Badge tone="accent">Theme</Badge>} title="Appearance" />

          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
            {THEMES.map((theme) => {
              const active = theme.id === themeId;

              return (
                <button
                  className={cn(
                    'group min-w-0 rounded-[18px] border p-2 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 sm:rounded-[20px] sm:p-3',
                    active
                      ? 'border-accent/45 bg-accent/8 shadow-[0_16px_38px_rgb(var(--accent)/0.16)]'
                      : 'border-borderSoft/30 bg-panel/30 hover:-translate-y-0.5 hover:border-borderStrong/40 hover:bg-panel/50 hover:shadow-[0_14px_32px_rgb(var(--shadow-color)/0.18)]',
                  )}
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  type="button"
                >
                  {/* Live mini-mockup rendered from the theme's real tokens — framed like
                      a window thumbnail so light-theme previews read as intentional, not stray boxes. */}
                  <div
                    className="relative flex h-[68px] gap-1.5 overflow-hidden rounded-[13px] p-1.5 sm:h-[84px] sm:gap-2 sm:rounded-[16px] sm:p-2"
                    style={{
                      backgroundColor: theme.tokens.bg,
                      border: `1px solid ${theme.tokens.text}22`,
                      boxShadow: `0 8px 20px rgb(0 0 0 / 0.22), inset 0 0 0 1px ${theme.tokens.text}10`,
                    }}
                  >
                    <div
                      className="flex w-1/3 flex-col gap-2 rounded-[14px] p-2"
                      style={{ backgroundColor: theme.tokens.panel }}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.tokens.accent }} />
                      <span className="mt-auto h-4 w-full rounded-lg" style={{ backgroundColor: theme.tokens.accent }} />
                      <span className="h-3 w-3/4 rounded-md" style={{ backgroundColor: theme.tokens.bg }} />
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="h-3 w-10 rounded-md" style={{ backgroundColor: theme.tokens.panel }} />
                        <span className="h-5 w-10 rounded-lg" style={{ backgroundColor: theme.tokens.accent }} />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 rounded-[12px] p-2" style={{ backgroundColor: theme.tokens.panel }}>
                        <span className="h-3 w-full rounded-md" style={{ backgroundColor: theme.tokens.bg }} />
                        <span className="h-3 w-2/3 rounded-md" style={{ backgroundColor: theme.tokens.bg }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-1.5 px-0.5 sm:mt-3 sm:gap-2 sm:px-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold text-text-primary sm:text-sm">{theme.name}</p>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: theme.mode === 'dark' ? 'rgb(0 0 0 / 0.25)' : 'rgb(0 0 0 / 0.06)',
                            color: 'rgb(var(--text-muted))',
                          }}
                        >
                          {theme.mode}
                        </span>
                      </div>
                      <p className="mt-0.5 hidden truncate text-[10px] uppercase tracking-[0.2em] text-text-muted sm:block">
                        {theme.eyebrow}
                      </p>
                    </div>
                    {active ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent)/0.65)]" title="Active theme" /> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </Card> : null}

        {section === 'all' || section === 'workspace' ? <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <Card className="overflow-hidden rounded-[22px] p-0 sm:rounded-[24px]">
            <div className="flex items-center justify-between border-b border-borderSoft/20 px-4 py-4 sm:px-5">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent">Preferences</p><h3 className="mt-1 text-base font-semibold text-text-primary">Behavior</h3></div>
              <SlidersHorizontal className="h-4 w-4 text-text-muted" />
            </div>

            <div className="divide-y divide-borderSoft/20 px-4 sm:px-5">
              <div className="py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><Pause className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">Reduce motion</p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">Use calmer transitions and effects.</p>
                  </div>
                  <SettingSwitch checked={reduceMotion} label="Reduce motion" onChange={setReduceMotion} />
                </div>
              </div>

              <div className="py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400"><Eye className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">Transparent HUD</p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">Float only the timer and current task.</p>
                  </div>
                  <SettingSwitch checked={hudTransparency === 'ghost'} label="Transparent HUD" onChange={() => toggleHudTransparency()} />
                </div>
              </div>

              <div className="py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"><MessageCircle className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">Focus prompts</p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">Choose how reminders speak to you.</p>
                  </div>
                  <div className="flex shrink-0 rounded-full border border-borderSoft/30 bg-panel2/55 p-1">
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

              <div className="py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><Play className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">Launch at login</p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">Open SynCatch when your computer starts.</p>
                  </div>
                  <SettingSwitch
                    checked={launchAtLogin}
                    disabled={launchAtLoginPending}
                    label="Launch at login"
                    onChange={(checked) => void setLaunchAtLogin(checked)}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[24px] p-4 sm:p-5">
            <SectionHeading action={<Badge tone="neutral">System</Badge>} title="Workspace" />

            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-[15px] border border-borderSoft/30 bg-panel/32 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-accent/10 text-accent"><Keyboard className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-text-primary">Quick Add shortcut</p><p className="mt-0.5 text-xs text-text-secondary">Capture without leaving your work.</p></div>
                <div className="shrink-0">
                  <Badge className="text-xs" tone="accent">
                    {quickAddShortcut}
                  </Badge>
                </div>
              </div>

              <div className="rounded-[15px] border border-borderSoft/30 bg-panel/32 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-cyan-500/10 text-cyan-500"><Cloud className="h-4 w-4" /></span>
                  <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Sync mode</p>
                    <p className="mt-0.5 text-xs text-text-secondary">Choose where your data lives.</p>
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
            </div>
          </Card>

          <Card className="rounded-[24px] p-4 sm:p-5">
            <SectionHeading action={<Badge tone="accent">Identity</Badge>} title="Connection" />

            <div className="space-y-2">
              <div className="rounded-[15px] border border-borderSoft/30 bg-panel/32 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-emerald-500/10 text-emerald-500"><Wifi className="h-4 w-4" /></span>
                  <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {useAuthStore.getState().localMode ? 'Local Mode' : 'Cloud Sync'}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {useAuthStore.getState().localMode
                        ? 'Your data is only on this PC. Sign in to sync across devices.'
                        : 'Your data is safely synced to the cloud.'}
                    </p>
                  </div>

                  {useAuthStore.getState().localMode ? (
                    <Button
                      onClick={() => {
                        void confirmDialog('You will be taken to the login screen.', { title: 'Switch to Cloud mode?', confirmLabel: 'Continue' }).then((ok) => { if (ok) {
                          useAuthStore.getState().setLocalMode(false);
                          window.location.reload();
                        }});
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
            </div>
          </Card>

          <SyncStatusCard />
        </div> : null}
      </div>
    );
  }

  function renderSettingsModal() {
    const categories: Array<{ id: SettingsCategory; label: string; detail: string; icon: LucideIcon }> = [
      { id: 'account', label: 'Account', detail: 'Profile and activity', icon: UserRound },
      { id: 'ai', label: 'AI assistant', detail: 'Provider and model', icon: Bot },
      { id: 'appearance', label: 'Appearance', detail: 'Theme and visual style', icon: Palette },
      { id: 'workspace', label: 'Workspace', detail: 'Behavior, sync and system', icon: SlidersHorizontal },
      { id: 'downloads', label: 'Downloads', detail: 'Desktop applications', icon: Download },
    ];

    return (
      <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/60 p-2 backdrop-blur-[5px] sm:items-center sm:p-5" onClick={() => setSettingsModalOpen(false)}>
        <div aria-label="Settings" aria-modal="true" role="dialog" className="flex h-[calc(100dvh-0.5rem)] max-h-[780px] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-borderSoft/45 bg-panel shadow-[0_28px_90px_rgb(var(--shadow-color)/0.42)] sm:h-[92vh] sm:rounded-[28px]" onClick={(event) => event.stopPropagation()}>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-borderSoft/20 px-4 py-3.5 sm:px-6 sm:py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Settings center</p>
              <h2 className="mt-0.5 text-lg font-semibold text-text-primary">Settings</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button className="px-3" onClick={openFullSettings} size="sm" type="button" variant="secondary">
                <span className="hidden sm:inline">Full settings</span><span className="sm:hidden">Full view</span> <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
              <Button aria-label="Close settings" className="h-9 w-9 rounded-full p-0" onClick={() => setSettingsModalOpen(false)} size="sm" type="button" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 sm:grid-cols-[220px_minmax(0,1fr)]">
            <nav className="scrollbar-none flex shrink-0 snap-x gap-1.5 overflow-x-auto border-b border-borderSoft/20 bg-panel2/30 px-3 py-2.5 sm:flex-col sm:gap-2 sm:overflow-visible sm:border-b-0 sm:border-r sm:p-4">
              {categories.map((category) => {
                const Icon = category.icon;
                const active = settingsCategory === category.id;
                return (
                <button
                  className={cn(
                    'flex min-w-max snap-start items-center gap-2 rounded-full border px-3 py-2 text-left transition-colors duration-100 sm:min-w-0 sm:gap-3 sm:rounded-[14px] sm:px-3 sm:py-2.5',
                    active ? 'border-accent/25 bg-accent/12 text-accent shadow-sm' : 'border-transparent text-text-secondary hover:border-borderSoft/30 hover:bg-panel/65 hover:text-text-primary',
                  )}
                  key={category.id}
                  onClick={() => setSettingsCategory(category.id)}
                  type="button"
                >
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 sm:rounded-[11px]', active ? 'bg-accent/14' : 'bg-panel/70')}><Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span>
                  <span className="min-w-0"><span className="block text-xs font-semibold sm:text-sm">{category.label}</span><span className="mt-0.5 hidden truncate text-[10px] text-current opacity-65 sm:block">{category.detail}</span></span>
                </button>
                );
              })}
            </nav>

            <div className="min-h-0 overflow-y-auto overscroll-contain bg-panel2/10 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
              {categories.map((category) => (
                <div
                  aria-hidden={settingsCategory !== category.id}
                  className={settingsCategory === category.id ? 'block' : 'hidden'}
                  key={category.id}
                >
                  {renderSettings(category.id)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tasksHydrated || !sessionsHydrated || tasksLoading) {
    // Must NOT auto-dismiss: this gate depends on async hydration (slow over Supabase
    // after login). A self-dismissing loader would render null → blank screen.
    return <AnimatedLoading />;
  }

  return (
    <div className="h-full">
      {settingsModalOpen ? renderSettingsModal() : null}
      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-[70] flex justify-start p-2 lg:hidden"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-[3px] transition-opacity"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
            className="relative z-10 flex h-full min-h-0 w-[min(300px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-panel2/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-2xl animate-in slide-in-from-left-4 duration-200"
          >
            <div aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-accent/10 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-cyan-500/5 blur-3xl" />
            <div className="relative mb-6 flex items-center justify-between gap-3 border-b border-borderSoft/15 pb-5">
              {mobileChatPickerOpen ? (
                <button type="button" onClick={() => setMobileChatPickerOpen(false)} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-text-primary hover:bg-panel" aria-label="Back to navigation">
                  <ArrowLeft className="h-4 w-4" /> Project chats
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setActiveView('dashboard'); setMobileNavOpen(false); }}
                  aria-label="Go to dashboard"
                  className="flex items-center rounded-xl transition-opacity hover:opacity-80"
                >
                  <SynCatchWordmark themed animated logoClassName="h-11 w-11" textClassName="text-base font-bold tracking-tight" />
                </button>
              )}
              <Button onClick={() => setMobileNavOpen(false)} size="sm" type="button" variant="ghost" className="h-8 w-8 p-0 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!mobileChatPickerOpen ? (
              <div className="relative mb-4 flex items-center justify-between rounded-2xl border border-borderSoft/20 bg-panel/35 p-2">
                <span className="pl-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Workspace</span>
                <TeamHeaderSwitcher onSwitchMode={(mode) => {
                  setActiveView(mode === 'team' ? 'missions' : 'dashboard');
                  setMobileNavOpen(false);
                }} />
              </div>
            ) : null}
            
            <div className="relative flex-1 overflow-y-auto">
              {mobileChatPickerOpen ? (
                <div className="space-y-2">
                  <p className="px-2 pb-2 text-xs leading-5 text-text-muted">Choose the project channel you want to open.</p>
                  {teamMissions.length > 0 ? teamMissions.map((mission) => (
                    <button
                      key={mission.id}
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem('missioncontrol:open-chat-mission', mission.id);
                        setActiveView('missions');
                        setMobileChatPickerOpen(false);
                        setMobileNavOpen(false);
                        window.dispatchEvent(new CustomEvent('missioncontrol:open-project-chat', { detail: mission.id }));
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-borderSoft/20 bg-panel/35 p-3 text-left transition-colors hover:border-accent/30 hover:bg-panel"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-white shadow-sm"><MessageSquare className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text-primary">{mission.title}</span><span className="mt-0.5 block truncate text-[11px] text-text-muted">Project chat</span></span>
                      <ChevronDown className="h-4 w-4 -rotate-90 text-text-muted" />
                    </button>
                  )) : <p className="rounded-2xl border border-dashed border-borderSoft/30 p-4 text-center text-xs text-text-muted">Create a project before starting a chat.</p>}
                </div>
              ) : <SidebarContent
                compact
                ensureIds={mobileDrawerCoreApps}
                activeView={activeView}
                onOpenApps={() => {
                  openAppsView();
                  setMobileNavOpen(false);
                }}
                onOpenChat={() => {
                  setMobileChatPickerOpen(true);
                }}
                onViewSelect={(view) => {
                  navigateToView(view);
                  setMobileNavOpen(false);
                }}
                pinnedAppIds={sidebarPinnedApps}
              />}
            </div>

            {!mobileChatPickerOpen ? <SidebarProfile onOpen={() => { setMobileNavOpen(false); openSettingsModal(); }} /> : null}
          </aside>
        </div>
      ) : null}

      <div className="app-frame relative flex h-full flex-col overflow-visible lg:overflow-hidden lg:flex-row">
        <aside className={cn('sidebar-shell relative z-10 hidden w-full flex-col border-r border-borderSoft/24 transition-[width,padding] duration-200 lg:flex', sidebarCollapsed ? 'lg:w-[84px] lg:p-3' : 'lg:w-[248px] lg:p-6')}>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => {
              const next = !current;
              localStorage.setItem('syncatch-sidebar-collapsed', next ? '1' : '0');
              return next;
            })}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="absolute -right-3 top-5 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-borderSoft/50 bg-panel text-text-muted shadow-sm transition-colors hover:text-text-primary"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>
          <SidebarContent
            activeView={activeView}
            collapsed={sidebarCollapsed}
            onOpenApps={openAppsView}
            onViewSelect={navigateToView}
            pinnedAppIds={sidebarPinnedApps}
          />
          <SidebarProfile collapsed={sidebarCollapsed} onOpen={openSettingsModal} />
        </aside>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-[64px] items-center justify-between gap-2 border-b border-borderSoft/24 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
              <Button
                onClick={() => setMobileNavOpen(true)}
                size="sm"
                type="button"
                variant="secondary"
                aria-label="Open menu"
                className={cn(
                  "h-12 w-12 shrink-0 rounded-[16px] p-0 sm:h-9 sm:w-9 sm:rounded-2xl lg:hidden",
                  workspaceMode === 'team' && "hidden sm:flex"
                )}
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <h2 className={cn('truncate text-lg font-bold text-text-primary sm:text-2xl sm:font-semibold', workspaceMode === 'team' && 'sm:hidden')}>{viewCopy}</h2>
              {/* Mission hub back button + tab strip portal in here (see MissionHubNavSlotContext) */}
              <div ref={setMissionHubNavSlot} className="-mt-3 -mb-[calc(0.75rem+1px)] flex min-w-0 flex-1 items-stretch self-stretch empty:hidden" />
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {activeView === 'tasks' ? <div className="hidden md:block">{renderTaskScopeControl()}</div> : null}
              {activeView === 'tasks' ? <div className="hidden sm:block">{renderTaskMissionFilterControl()}</div> : null}

              {activeView === 'tasks' ? (
                <Button
                  aria-label="Create task"
                  onClick={() => setTaskComposerOpen(true)}
                  size="sm"
                  type="button"
                  className="hidden px-3 sm:inline-flex sm:px-4"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline max-[380px]:hidden">Create task</span>
                  <span className="sm:hidden max-[380px]:hidden">Add</span>
                </Button>
              ) : activeView === 'missions' && workspaceMode !== 'team' ? (
                <Button onClick={() => setMissionComposerOpen(true)} size="sm" type="button" className="px-3 sm:px-4">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">New mission</span>
                  <span className="sm:hidden">New</span>
                </Button>
              ) : null}

              {activeView === 'tasks' ? <div className="hidden sm:block">{renderTaskDateFilterControl()}</div> : null}

              <div className="hidden items-center gap-2 sm:flex md:gap-3">
                {activeView === 'tasks' ? null : <HeaderClock />}
                {/* Quick Add and HUD open native windows — desktop (Tauri) only, not the web app. */}
                {isTauriApp() ? (
                  <>
                    <Button onClick={() => void showQuickAddWindow()} size="sm" type="button" variant="secondary" className="hidden md:flex">
                      Quick Add
                    </Button>
                    <Button onClick={() => void showHudWindow()} size="sm" type="button" variant="ghost" className="hidden lg:flex">
                      HUD
                    </Button>
                  </>
                ) : null}
              </div>

              <div className="hidden sm:block"><TeamHeaderSwitcher onSwitchMode={(mode) => setActiveView(mode === 'team' ? 'missions' : 'dashboard')} /></div>
            </div>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden lg:flex">
            <main
              className={cn(
                'main-scroll-region absolute inset-0 overflow-x-hidden overflow-y-scroll px-3 py-4 pb-32 sm:px-6 sm:py-6 lg:relative lg:inset-auto lg:h-full lg:min-w-0 lg:flex-1 lg:pb-6',
                workspaceMode === 'team' && 'py-0 pb-[var(--mobile-nav-height)] sm:py-0 lg:pb-6',
                workspaceMode === 'team' && teamUnlocked ? 'team-workspace' : null,
              )}
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <Suspense fallback={<ViewLoading />}>
              {workspaceMode === 'team' && teamUnlocked ? (
                <>
                  {activeView === 'calendar' ? (
                    <TeamCalendarView />
                  ) : activeView === 'tasks' ? (
                    <TeamTasksView />
                  ) : activeView === 'crm' ? (
                    <LeadsCRMView />
                  ) : activeView === 'problems' ? (
                    <ProblemBankView />
                  ) : activeView === 'notes' ? (
                    <TeamNotesView />
                  ) : activeView === 'settings' ? (
                    renderSettings()
                  ) : (
                    <MissionHubNavSlotContext.Provider value={missionHubNavSlot}>
                      <TeamHubView />
                    </MissionHubNavSlotContext.Provider>
                  )}
                </>
              ) : (
                <>
                  {activeView === 'apps' ? (
                    <AppsWorkspacePage
                      activeView={previousViewBeforeApps}
                      onClose={closeAppsView}
                      onTogglePinnedApp={toggleSidebarPinnedApp}
                      onViewSelect={(view) => setActiveView(view)}
                      pinnedAppIds={sidebarPinnedApps}
                    />
                  ) : null}
                  {activeView === 'dashboard' ? (
                    <DashboardView
                      onNavigate={(view) => setActiveView(view)}
                      onOpenTask={(taskId) => {
                        selectTask(taskId);
                        setDetailTaskId(taskId);
                        setActiveView('tasks');
                      }}
                      onOpenMission={(missionId) => {
                        useMissionStore.getState().selectMission(missionId);
                        setDetailMissionId(missionId);
                        setActiveView('missions');
                      }}
                      onNewTask={() => { setActiveView('tasks'); setTaskComposerOpen(true); }}
                      onNewMission={() => { setActiveView('missions'); setMissionComposerOpen(true); }}
                    />
                  ) : null}
                  {activeView === 'focus' ? renderFocus() : null}
                  {activeView === 'missions' ? renderMissions() : null}
                  {activeView === 'projects' ? <ProjectsView /> : null}
                  {activeView === 'roadmap' ? <RoadmapView missions={missions} allTasks={tasks} onOpenMission={setDetailMissionId} /> : null}
                  {activeView === 'today' ? renderToday() : null}
                  {activeView === 'calendar' ? <CalendarView onOpenTarget={openCalendarTarget} /> : null}
                  {activeView === 'challenges' ? <ChallengesView /> : null}
                  {activeView === 'tasks' ? renderTasks() : null}
                  {activeView === 'history' ? renderHistory() : null}
                  {activeView === 'insights' ? renderInsights() : null}
                  {activeView === 'review' ? renderReview() : null}
                  {activeView === 'journal' ? <JournalView focusedEntryId={calendarJournalTargetId} /> : null}
                  {activeView === 'notes' ? <NotesView openNoteId={calendarNoteTargetId} /> : null}
                  {activeView === 'loved-ones' ? <LovedOnesView /> : null}
                  {activeView === 'assistant' ? <AssistantView /> : null}
                  {activeView === 'settings' ? renderSettings() : null}
                </>
              )}
              </Suspense>

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
                  className="absolute inset-0 z-30 bg-black/24 lg:hidden"
                  onClick={() => setDetailTaskId(null)}
                  type="button"
                />

                <aside className="absolute inset-y-0 right-0 z-40 w-full max-w-[480px] overflow-hidden border-l border-borderSoft/35 bg-panel shadow-2xl lg:relative lg:inset-auto lg:z-auto lg:my-3 lg:mr-3 lg:h-[calc(100%-1.5rem)] lg:min-h-0 lg:w-[420px] lg:max-w-none lg:shrink-0 lg:rounded-[24px] lg:border lg:border-borderSoft/35 lg:shadow-[0_24px_80px_rgb(var(--shadow-color)/0.18)] xl:w-[480px]">
                  <TaskDetailPanel
                    allTasks={tasks}
                    onClose={() => setDetailTaskId(null)}
                    onOpenTask={setDetailTaskId}
                    task={detailTask}
                  />
                </aside>
              </>
            ) : showMissionDetailPanel && detailMission ? (
              workspaceMode === "team" ? (
                <div className="fixed inset-0 z-30 flex min-w-0 flex-col overflow-hidden bg-slate-950/95 backdrop-blur-md animate-in fade-in lg:z-50">
                  <Suspense fallback={<ViewLoading />}>
                    <UnifiedMissionHub
                      mission={detailMission}
                      onBack={() => setDetailMissionId(null)}
                    />
                  </Suspense>
                </div>
              ) : (
                <>
                  <button
                    aria-label="Close mission details"
                    className="absolute inset-0 z-30 bg-black/24 lg:hidden"
                    onClick={() => setDetailMissionId(null)}
                    type="button"
                  />

                  <aside className="absolute inset-y-0 right-0 z-40 w-full max-w-[520px] overflow-hidden border-l border-borderSoft/30 bg-panel shadow-2xl lg:relative lg:inset-auto lg:z-auto lg:h-full lg:min-h-0 lg:w-[440px] lg:max-w-none lg:shrink-0 lg:shadow-none xl:w-[500px]">
                    <MissionDetailPanel
                      mission={detailMission}
                      allTasks={tasks}
                      onClose={() => setDetailMissionId(null)}
                      onOpenTask={setDetailTaskId}
                      onEditMission={(m) => {
                        setEditingMission(m);
                        setMissionComposerOpen(true);
                      }}
                    />
                  </aside>
                </>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* Floating actions live behind one toggle so they stop covering whatever
          sits in the bottom-right corner — a chat composer's send button, a
          table's last row. Collapsed by default; the toggle stays put and the
          buttons stack above it. */}
      {!mobileNavOpen && !showTaskDetailPanel && !showMissionDetailPanel && workspaceMode !== 'team' ? (
        <>
          <button
            type="button"
            onClick={() => setFabDockOpen((open) => !open)}
            aria-expanded={fabDockOpen}
            aria-label={fabDockOpen ? 'Hide quick actions' : 'Show quick actions'}
            className="fixed bottom-[calc(var(--mobile-nav-height)+0.75rem)] right-5 z-[67] flex h-11 w-11 items-center justify-center rounded-full border border-borderSoft bg-panel text-text-secondary shadow-[0_8px_24px_rgb(var(--shadow-color)/0.28)] transition-all hover:text-text-primary active:scale-95 lg:bottom-6"
          >
            <Plus className={`h-5 w-5 transition-transform duration-200 ${fabDockOpen ? 'rotate-45' : ''}`} />
          </button>

          {fabDockOpen ? (
            <>
              <AssistantWidget launcherPositionClassName="bottom-[calc(var(--mobile-nav-height)+4.5rem)] right-[0.875rem] lg:bottom-[5.25rem]" />
              <PocketDropFAB positionClassName="bottom-[calc(var(--mobile-nav-height)+8.75rem)] right-5 lg:bottom-[9.5rem]" />
            </>
          ) : null}
        </>
      ) : null}

      {/* Mobile bottom navigation */}
      <nav id="mobile-primary-navigation" aria-label="Primary navigation" className="mobile-bottom-nav lg:hidden">
        {(workspaceMode === 'team' && teamUnlocked
          ? [
              { id: 'missions' as MainView, label: 'Projects', Icon: Target },
              { id: 'calendar' as MainView, label: 'Calendar', Icon: CalendarDays },
              { id: 'tasks' as MainView, label: 'Tasks', Icon: CheckSquare },
              { id: 'crm' as MainView, label: 'CRM', Icon: Users },
              { id: 'roadmap' as MainView, label: 'More', Icon: MoreHorizontal },
            ]
          : [
              { id: 'today' as MainView, label: 'Today', Icon: Sun },
              { id: 'tasks' as MainView, label: 'Tasks', Icon: CheckSquare },
              { id: 'notes' as MainView, label: 'Notes', Icon: StickyNote },
              { id: 'missions' as MainView, label: 'Missions', Icon: Target },
              { id: 'roadmap' as MainView, label: 'More', Icon: MoreHorizontal },
            ]
        ).map((tab) => {
          const isMore = tab.label === 'More';
          const isTeam = workspaceMode === 'team' && teamUnlocked;
          const isActive = isMore
            ? isTeam
              ? !['missions', 'calendar', 'tasks', 'crm'].includes(activeView)
              : !['dashboard', 'today', 'tasks', 'notes', 'missions'].includes(activeView)
            : tab.id === 'today'
              ? activeView === 'today' || activeView === 'dashboard'
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
