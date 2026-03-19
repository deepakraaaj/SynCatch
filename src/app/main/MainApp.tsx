import { AnimatePresence, motion } from 'framer-motion';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useReducer, useState } from 'react';
import {
  listRecentActivity,
  logActivity,
  type ActivityLogEntry,
} from '../../features/activity/activity-repository';
import { buildDistractionReport } from '../../features/activity/distraction-insights';
import { getTaskAiAssistant } from '../../features/ai/mock-ai-provider';
import {
  getFocusStatusLabel,
  getFocusStatusTone,
} from '../../features/focus/focus-presenter';
import { useFocusStore } from '../../features/focus/focus-store';
import type { SyncMode } from '../../features/preferences/preferences-types';
import { useSettingsStore } from '../../features/settings/settings-store';
import { generateTaskBrief } from '../../features/tasks/task-intelligence';
import {
  deriveStatusFromLane,
  getCompletedSubtasks,
  getOpenQuestionCount,
  humanizeLane,
  humanizePriority,
} from '../../features/tasks/task-helpers';
import type { Task, TaskLane, TaskPriority } from '../../features/tasks/task-types';
import { useTaskStore } from '../../features/tasks/task-store';
import { THEMES } from '../../features/themes/themes';
import { useThemeStore } from '../../features/themes/theme-store';
import { formatElapsedClock, formatMinutes, formatRelativeTime } from '../../lib/date';
import {
  ACTIVITY_CHANGED_EVENT,
  isTauriApp,
  OPEN_TASK_DETAIL_EVENT,
  type OpenTaskDetailPayload,
  showHudWindow,
  showQuickAddWindow,
  subscribeAppEvent,
} from '../../lib/tauri';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Textarea } from '../../components/ui/input';
import { cn } from '../../lib/cn';

type NavigationView = 'inbox' | 'today' | 'focus' | 'settings';
type MainView = NavigationView | 'task';

const navItems: Array<{ id: NavigationView; label: string; eyebrow: string }> = [
  { id: 'inbox', label: 'Overview', eyebrow: 'Home' },
  { id: 'today', label: 'Tasks', eyebrow: 'Board' },
  { id: 'focus', label: 'Workspace', eyebrow: 'Current task' },
  { id: 'settings', label: 'Settings', eyebrow: 'Preferences' },
];

const laneOrder: TaskLane[] = ['inbox', 'now', 'next', 'later', 'done'];
const syncModeContent: Record<SyncMode, { label: string; caption: string }> = {
  local: {
    label: 'Local only',
    caption: 'Everything stays on this device until you choose to connect cloud sync later.',
  },
  cloud: {
    label: 'Cloud option',
    caption: 'Prepares the workspace for account sync, mobile visibility, and multi-device access.',
  },
};

const laneLabel: Record<TaskLane, string> = {
  inbox: 'Inbox',
  now: 'Active',
  next: 'Next',
  later: 'Later',
  done: 'Complete',
};

const laneAccent: Record<TaskLane, string> = {
  inbox: 'bg-text-muted/80',
  now: 'bg-accent',
  next: 'bg-accentSoft/85',
  later: 'bg-warning/85',
  done: 'bg-success/85',
};

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function priorityTone(priority: TaskPriority) {
  if (priority === 'critical') {
    return 'warning' as const;
  }

  if (priority === 'high') {
    return 'accent' as const;
  }

  return 'neutral' as const;
}

function laneTasks(tasks: Task[], lane: TaskLane) {
  return tasks.filter((task) => task.lane === lane);
}

function uniqueTasks(tasks: Array<Task | null>) {
  const seen = new Set<string>();

  return tasks.filter((task): task is Task => {
    if (!task || seen.has(task.id)) {
      return false;
    }

    seen.add(task.id);
    return true;
  });
}

function pressable(onSelect: () => void) {
  return {
    onClick: onSelect,
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    },
    role: 'button' as const,
    tabIndex: 0,
  };
}

function getWeeklyActivity(tasks: Task[]) {
  const today = new Date();

  return dayLabels.map((label, index) => {
    const target = new Date(today);
    const diff = (today.getDay() + 6) % 7;
    target.setDate(today.getDate() - diff + index);

    const totalMinutes = tasks.reduce((sum, task) => {
      const updated = new Date(task.updated_at);
      const isSameDay =
        updated.getFullYear() === target.getFullYear() &&
        updated.getMonth() === target.getMonth() &&
        updated.getDate() === target.getDate();

      return isSameDay ? sum + task.estimated_minutes : sum;
    }, 0);

    return { label, minutes: totalMinutes };
  });
}

function getLocalTime() {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

function cloneTask(task: Task) {
  return {
    ...task,
    subtasks: task.subtasks.map((subtask) => ({ ...subtask })),
    clarifying_questions: task.clarifying_questions.map((question) => ({ ...question })),
  };
}

function sanitizeTask(task: Task): Task {
  const title =
    task.title.trim() ||
    task.raw_input
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 72) ||
    'Untitled task';

  return {
    ...task,
    title,
    raw_input: task.raw_input.trim(),
    description: task.description.trim(),
    goal: task.goal.trim(),
    definition_of_done: task.definition_of_done.trim(),
    next_action: task.next_action.trim(),
    why_it_matters: task.why_it_matters.trim(),
    workspace_notes: task.workspace_notes,
    estimated_minutes: Math.max(5, Number(task.estimated_minutes) || 25),
    subtasks: task.subtasks
      .map((subtask) => ({
        ...subtask,
        title: subtask.title.trim(),
      }))
      .filter((subtask) => subtask.title.length > 0),
    clarifying_questions: task.clarifying_questions
      .map((question) => ({
        ...question,
        question: question.question.trim(),
        answer: question.answer.trim(),
      }))
      .filter((question) => question.question.length > 0),
  };
}

function SidebarNavButton({
  active,
  eyebrow,
  label,
  onClick,
}: {
  active: boolean;
  eyebrow: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'w-full rounded-[20px] border px-4 py-3 text-left transition-all',
        active
          ? 'border-accent/40 bg-accent/12 shadow-glow'
          : 'border-transparent bg-panel/38 hover:border-borderSoft/40 hover:bg-panel/58',
      )}
      onClick={onClick}
      type="button"
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">{eyebrow}</p>
      <p className="mt-1 text-sm font-medium text-text-primary">{label}</p>
    </button>
  );
}

function StudioMetricCard({
  label,
  value,
  caption,
  tone = 'accent',
}: {
  label: string;
  value: string;
  caption: string;
  tone?: 'accent' | 'warning' | 'neutral';
}) {
  const toneClass =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'neutral'
        ? 'text-text-primary'
        : 'text-accent';

  return (
    <Card className="h-full rounded-[26px] p-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">{label}</p>
      <p className={cn('mt-5 text-[2.2rem] font-semibold leading-none', toneClass)}>{value}</p>
      <p className="mt-3 text-sm text-text-secondary">{caption}</p>
    </Card>
  );
}

function TaskQueueItem({
  task,
  active,
  onSelect,
  isFrog,
}: {
  task: Task;
  active: boolean;
  onSelect: () => void;
  isFrog?: boolean;
}) {
  const completedSubtasks = getCompletedSubtasks(task);
  const openQuestions = getOpenQuestionCount(task);

  return (
    <div
      {...pressable(onSelect)}
      className={cn(
        'rounded-[24px] border p-4 transition-all outline-none',
        active
          ? 'border-accent/45 bg-accent/10 shadow-glow'
          : 'border-borderSoft/35 bg-panel/54 hover:border-borderStrong/40 hover:bg-panel/68',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className={cn('h-2.5 w-2.5 rounded-full', laneAccent[task.lane])} />
            <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-text-muted">
            <span>{humanizeLane(task.lane)}</span>
            <span className="h-1 w-1 rounded-full bg-borderStrong/60" />
            <span>{formatMinutes(task.estimated_minutes)}</span>
            <span className="h-1 w-1 rounded-full bg-borderStrong/60" />
            <span>{formatRelativeTime(task.updated_at)}</span>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-text-secondary">
            {task.description || task.raw_input}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={priorityTone(task.priority)}>{humanizePriority(task.priority)}</Badge>
          {isFrog ? <Badge tone="accent">Top</Badge> : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-text-muted">
        <span>Drag to move lanes</span>
        <span>
          {completedSubtasks}/{task.subtasks.length || 0} steps
          {openQuestions > 0 ? ` · ${openQuestions} open` : ''}
        </span>
      </div>
    </div>
  );
}

function ThemeTile({
  name,
  preview,
  active,
  onClick,
}: {
  name: string;
  preview: [string, string, string];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'rounded-[24px] border p-4 text-left transition-all',
        active
          ? 'border-accent/45 bg-accent/10 shadow-glow'
          : 'border-borderSoft/35 bg-panel/54 hover:border-borderStrong/40 hover:bg-panel/68',
      )}
      onClick={onClick}
      type="button"
    >
      <div className="mb-4 flex gap-2">
        {preview.map((color) => (
          <span
            key={color}
            className="h-12 flex-1 rounded-[18px]"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">{name}</span>
        {active ? <Badge tone="accent">Live</Badge> : null}
      </div>
    </button>
  );
}

function SettingsChoiceCard({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'rounded-[24px] border p-5 text-left transition-all',
        active
          ? 'border-accent/45 bg-accent/10 shadow-glow'
          : 'border-borderSoft/35 bg-panel/54 hover:border-borderStrong/40 hover:bg-panel/68',
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{description}</p>
        </div>
        <Badge tone={active ? 'accent' : 'neutral'}>{active ? 'Active' : 'Available'}</Badge>
      </div>
    </button>
  );
}

function SectionHeading({
  label,
  title,
  action,
}: {
  label: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-text-muted">{label}</p>
        <h2 className="mt-2 text-2xl font-semibold text-text-primary">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function RightRail({
  currentMission,
  focusQueue,
  focusStatusLabel,
  focusStatusTone,
  sessionGoalHours,
  completedTasks,
  onOpenQuickAdd,
  onOpenTask,
  onStartFocus,
}: {
  currentMission: Task | null;
  focusQueue: Task[];
  focusStatusLabel: string;
  focusStatusTone: 'neutral' | 'success' | 'warning' | 'accent';
  sessionGoalHours: string;
  completedTasks: number;
  onOpenQuickAdd: () => void;
  onOpenTask: (task: Task) => void;
  onStartFocus: (task: Task) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Card className="rounded-[28px] p-5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">New objective</p>
        <h3 className="mt-3 text-lg font-semibold text-text-primary">
          Capture what needs to be tracked.
        </h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Keep capture fast. Clean it up only when needed.
        </p>
        <Button className="mt-5 w-full" onClick={onOpenQuickAdd}>
          Add Task
        </Button>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
        <Card className="rounded-[24px] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Time load</p>
          <p className="mt-4 text-3xl font-semibold text-text-primary">{sessionGoalHours}</p>
          <p className="mt-2 text-sm text-text-secondary">Estimated load across active and next tasks.</p>
        </Card>

        <Card className="rounded-[24px] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Completed today</p>
          <p className="mt-4 text-3xl font-semibold text-accent">{String(completedTasks).padStart(2, '0')}</p>
          <p className="mt-2 text-sm text-text-secondary">Completed work for today.</p>
        </Card>
      </div>

      <Card className="min-h-0 flex-1 rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Task manager</p>
            <h3 className="mt-2 text-lg font-semibold text-text-primary">Current tasks</h3>
          </div>
          <Badge tone={focusStatusTone}>{focusStatusLabel}</Badge>
        </div>

        <div className="scrollbar-hidden mt-5 min-h-0 space-y-3 overflow-y-auto pr-1">
          {focusQueue.map((task) => (
            <button
              key={task.id}
              className="w-full rounded-[22px] border border-borderSoft/35 bg-panel/58 px-4 py-4 text-left transition hover:border-borderStrong/40 hover:bg-panel/72"
              onClick={() => onOpenTask(task)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-text-muted">
                    {humanizeLane(task.lane)} / {formatMinutes(task.estimated_minutes)}
                  </p>
                </div>
                <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-text-secondary">{formatRelativeTime(task.updated_at)}</span>
                <span className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
                  Open brief
                </span>
              </div>
            </button>
          ))}
          {focusQueue.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-borderSoft/40 px-4 py-8 text-center text-sm text-text-muted">
              Queue clear
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="rounded-[24px] p-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Focusing on</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {currentMission?.title ?? 'No task selected'}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {currentMission ? formatMinutes(currentMission.estimated_minutes) : 'Pick a task to begin'}
            </p>
          </div>
          {currentMission ? (
            <Button onClick={() => onStartFocus(currentMission)} size="sm">
              Start
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export function MainApp() {
  const [activeView, setActiveView] = useState<MainView>('inbox');
  const [taskReturnView, setTaskReturnView] = useState<NavigationView>('today');
  const [clockTick, bumpClockTick] = useReducer((count: number) => count + 1, 0);
  const [captureDraft, setCaptureDraft] = useState('');
  const [workspaceNotesDraft, setWorkspaceNotesDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState<Task | null>(null);
  const [taskEditorMode, setTaskEditorMode] = useState<'simple' | 'advanced'>('simple');
  const [isRefreshingBrief, setIsRefreshingBrief] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isCompletingTask, setIsCompletingTask] = useState(false);
  const [isSavingWorkspaceNotes, setIsSavingWorkspaceNotes] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [completionReviewTaskId, setCompletionReviewTaskId] = useState<string | null>(null);
  const tasks = useTaskStore((state) => state.tasks);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const createTask = useTaskStore((state) => state.createTask);
  const selectTask = useTaskStore((state) => state.selectTask);
  const saveTask = useTaskStore((state) => state.saveTask);
  const moveTaskToLane = useTaskStore((state) => state.moveTaskToLane);
  const toggleSubtask = useTaskStore((state) => state.toggleSubtask);
  const answerQuestion = useTaskStore((state) => state.answerQuestion);
  const markDone = useTaskStore((state) => state.markDone);

  const currentMissionId = useFocusStore((state) => state.currentMissionId);
  const focusSessionStart = useFocusStore((state) => state.focusSessionStart);
  const focusElapsedSeconds = useFocusStore((state) => state.focusElapsedSeconds);
  const focusStatus = useFocusStore((state) => state.status);
  const setCurrentMission = useFocusStore((state) => state.setCurrentMission);
  const startSession = useFocusStore((state) => state.startSession);
  const resumeSession = useFocusStore((state) => state.resumeSession);
  const pauseSession = useFocusStore((state) => state.pauseSession);
  const resetSession = useFocusStore((state) => state.resetSession);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const themeId = useThemeStore((state) => state.themeId);
  const setTheme = useThemeStore((state) => state.setTheme);
  const activeTheme = THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion);
  const focusPromptStyle = useSettingsStore((state) => state.focusPromptStyle);
  const setFocusPromptStyle = useSettingsStore((state) => state.setFocusPromptStyle);
  const syncMode = useSettingsStore((state) => state.syncMode);
  const setSyncMode = useSettingsStore((state) => state.setSyncMode);
  const launchAtLogin = useSettingsStore((state) => state.launchAtLogin);
  const launchAtLoginPending = useSettingsStore((state) => state.launchAtLoginPending);
  const setLaunchAtLogin = useSettingsStore((state) => state.setLaunchAtLogin);
  const desktopStartupAvailable = isTauriApp();

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const currentMission =
    tasks.find((task) => task.id === currentMissionId) ??
    tasks.find((task) => task.lane === 'now') ??
    null;
  const focusMission = currentMission ?? selectedTask;
  const detailTask = taskDraft ?? selectedTask;
  const inboxTasks = laneTasks(tasks, 'inbox');
  const nowTasks = laneTasks(tasks, 'now');
  const nextTasks = laneTasks(tasks, 'next');
  const laterTasks = laneTasks(tasks, 'later');
  const doneTasks = laneTasks(tasks, 'done');
  const focusQueue = uniqueTasks([focusMission, ...nowTasks, ...nextTasks, ...inboxTasks]).slice(0, 6);
  const focusStatusTone = getFocusStatusTone(focusStatus);
  const focusStatusLabel = getFocusStatusLabel(focusStatus);
  const weeklyActivity = getWeeklyActivity(tasks);
  const distractionReport = buildDistractionReport(activityLog);

  const dailyFocusHours = ((doneTasks.length * 50 + nowTasks.length * 35 + nextTasks.length * 20) / 60).toFixed(1);
  const streakDays = Math.max(4, doneTasks.length * 4 + nowTasks.length * 2 + 6);
  const completionRate = Math.round((doneTasks.length / Math.max(1, tasks.length)) * 100);
  const sessionGoalHours = (focusQueue.reduce((sum, task) => sum + task.estimated_minutes, 0) / 60).toFixed(1);
  const localTime = clockTick >= 0 ? getLocalTime() : '00:00';
  const clock = clockTick >= 0 ? formatElapsedClock(focusSessionStart, focusElapsedSeconds) : '00:00';
  const hasPausedFocus = !focusSessionStart && focusElapsedSeconds > 0;
  const laneCards = [
    { lane: 'inbox' as TaskLane, label: 'Queue', tasks: inboxTasks, hint: 'Capture and clarify' },
    { lane: 'now' as TaskLane, label: 'Active', tasks: nowTasks, hint: 'One task at a time' },
    { lane: 'next' as TaskLane, label: 'Next', tasks: nextTasks, hint: 'Ready after current work' },
    { lane: 'later' as TaskLane, label: 'Backlog', tasks: laterTasks, hint: 'Keep but do not touch yet' },
  ];
  const distractionPeriods = [
    { label: 'Today', summary: distractionReport.today },
    { label: '7 days', summary: distractionReport.week },
    { label: '30 days', summary: distractionReport.month },
  ];
  const focusChecklistCompleted = focusMission ? getCompletedSubtasks(focusMission) : 0;
  const focusOpenQuestions = focusMission ? getOpenQuestionCount(focusMission) : 0;
  const detailChecklistCompleted = detailTask ? getCompletedSubtasks(detailTask) : 0;
  const isCompletionReview = detailTask?.id === completionReviewTaskId;
  const taskDraftChanged =
    Boolean(detailTask && selectedTask) &&
    JSON.stringify(detailTask) !== JSON.stringify(selectedTask);

  useEffect(() => {
    if (!selectedTaskId && tasks[0]) {
      selectTask(tasks[0].id);
    }
  }, [selectedTaskId, selectTask, tasks]);

  useEffect(() => {
    if (!selectedTask) {
      setTaskDraft(null);
      return;
    }

    setTaskDraft(cloneTask(selectedTask));
  }, [selectedTask]);

  useEffect(() => {
    if (activeView !== 'task' && completionReviewTaskId) {
      setCompletionReviewTaskId(null);
    }
  }, [activeView, completionReviewTaskId]);

  useEffect(() => {
    setWorkspaceNotesDraft(focusMission?.workspace_notes ?? '');
  }, [focusMission]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      bumpClockTick();
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadActivity = async () => {
      const nextActivity = await listRecentActivity(2000);

      if (!cancelled) {
        setActivityLog(nextActivity);
      }
    };

    void loadActivity();

    const unsubscribe = subscribeAppEvent(ACTIVITY_CHANGED_EVENT, () => {
      void loadActivity();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauriApp()) {
      return;
    }

    let cancelled = false;
    let unlisten: undefined | (() => void);

    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      if (cancelled) {
        return;
      }

      const currentWindow = getCurrentWindow();

      unlisten = await currentWindow.onCloseRequested(async (event) => {
        event.preventDefault();

        try {
          await currentWindow.hide();
        } catch (error) {
          console.error('Unable to hide MissionControl', error);
        }
      });
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const openHud = async (task: Task | null = focusMission, syncMission = true) => {
    if (task) {
      selectTask(task.id);
      if (syncMission) {
        setCurrentMission(task.id, 'main');
      }
    }

    await showHudWindow();
    await logActivity({
      action: 'hud_opened',
      source: 'main',
      taskId: task?.id ?? currentMissionId ?? null,
      details: {
        activeView,
      },
    });
  };

  const openTaskDetail = (task: Task, nextReturnView?: NavigationView) => {
    selectTask(task.id);
    setTaskEditorMode('simple');
    setCompletionReviewTaskId(null);
    setTaskReturnView(nextReturnView ?? (activeView === 'task' ? taskReturnView : (activeView as NavigationView)));
    setActiveView('task');
  };

  const openTaskCompletionReview = (task: Task, nextReturnView?: NavigationView) => {
    selectTask(task.id);
    setTaskEditorMode('advanced');
    setCompletionReviewTaskId(task.id);
    setTaskReturnView(nextReturnView ?? (activeView === 'task' ? taskReturnView : (activeView as NavigationView)));
    setActiveView('task');
  };

  const saveTaskDetail = async (task: Task) => {
    setIsSavingTask(true);

    try {
      const generated =
        taskEditorMode === 'simple'
          ? generateTaskBrief(task.raw_input, {
              subtasks: task.subtasks,
              clarifyingQuestions: task.clarifying_questions,
              priority: task.priority,
              estimatedMinutes: task.estimated_minutes,
            })
          : null;
      const sanitized = sanitizeTask(
        generated
          ? {
              ...task,
              title: generated.suggestedTitle,
              description: generated.description,
              goal: generated.goal,
              definition_of_done: generated.definitionOfDone,
              next_action: generated.nextAction,
              why_it_matters: generated.whyItMatters,
              subtasks: generated.subtasks,
            }
          : task,
      );
      await saveTask(sanitized, 'main');
    } finally {
      setIsSavingTask(false);
    }
  };

  const completeTaskAfterReview = async (task: Task) => {
    const nextTask = sanitizeTask(task);
    const nextMission =
      currentMissionId === nextTask.id
        ? tasks.find((candidate) => candidate.id !== nextTask.id && candidate.lane === 'now' && candidate.status !== 'done') ?? null
        : null;

    setIsCompletingTask(true);

    try {
      await saveTaskDetail(nextTask);
      await markDone(nextTask.id, 'main');

      if (currentMissionId === nextTask.id) {
        setCurrentMission(nextMission?.id ?? null, 'main');
        resetSession('main');
      }

      setCompletionReviewTaskId(null);
      setActiveView(taskReturnView);
    } finally {
      setIsCompletingTask(false);
    }
  };

  const refreshTaskBrief = async () => {
    if (!detailTask) {
      return;
    }

    setIsRefreshingBrief(true);

    try {
      const clarified = await getTaskAiAssistant().clarifyTask(detailTask.raw_input || detailTask.title);
      setTaskDraft((current) =>
        current
          ? {
              ...current,
              title: clarified.suggestedTitle,
              description: clarified.description,
              goal: clarified.goal,
              definition_of_done: clarified.definitionOfDone,
              next_action: clarified.nextAction,
              why_it_matters: clarified.whyItMatters,
              subtasks: clarified.subtasks,
              clarifying_questions: clarified.questions,
            }
          : current,
      );
    } finally {
      setIsRefreshingBrief(false);
    }
  };

  const activateFocusTask = async (task: Task) => {
    selectTask(task.id);
    setCurrentMission(task.id, 'main');
    setActiveView('focus');
    startSession(undefined, 'main');

    if (task.lane !== 'now') {
      await moveTaskToLane(task.id, 'now', 'main');
    }

    await openHud(task, false);
  };

  const saveWorkspaceNotes = async () => {
    if (!focusMission) {
      return;
    }

    setIsSavingWorkspaceNotes(true);

    try {
      await saveTask(
        {
          ...focusMission,
          workspace_notes: workspaceNotesDraft.trim(),
        },
        'main',
      );
    } finally {
      setIsSavingWorkspaceNotes(false);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeAppEvent<OpenTaskDetailPayload>(OPEN_TASK_DETAIL_EVENT, (payload) => {
      const requestedTask = tasks.find((task) => task.id === payload.taskId);

      if (!requestedTask) {
        return;
      }

      const nextReturnView = activeView === 'task' ? taskReturnView : (activeView as NavigationView);
      selectTask(requestedTask.id);
      setTaskEditorMode(payload.mode === 'completion-review' ? 'advanced' : 'simple');
      setCompletionReviewTaskId(payload.mode === 'completion-review' ? requestedTask.id : null);
      setTaskReturnView(nextReturnView);
      setActiveView('task');
    });

    return () => {
      unsubscribe();
    };
  }, [activeView, selectTask, taskReturnView, tasks]);

  const captureWorkspaceTask = async () => {
    if (!captureDraft.trim()) {
      return;
    }

    await createTask(
      {
        rawInput: captureDraft,
        lane: 'inbox',
        priority: 'normal',
        status: 'captured',
      },
      'main',
    );
    setCaptureDraft('');
  };

  const pageHeaderTitle =
    activeView === 'inbox'
      ? 'Overview'
      : activeView === 'today'
        ? 'Tasks'
        : activeView === 'focus'
          ? 'Task Workspace'
          : activeView === 'task'
            ? isCompletionReview
              ? 'Completion Review'
              : 'Task Detail'
            : 'Settings';

  const pageHeaderDescription =
    activeView === 'inbox'
      ? 'See what is active, what is next, and what can wait.'
      : activeView === 'today'
        ? 'Drag tasks between lanes and open any task to edit it.'
        : activeView === 'focus'
          ? 'Keep one task in front of you while the rest stays out of the way.'
          : activeView === 'task'
            ? isCompletionReview
              ? 'Capture final notes and update the task before you mark it complete.'
              : 'Use the simple view by default. Open advanced edit only when you actually need it.'
            : 'Adjust the app to match how you like to work.';

  const page = (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="min-h-full"
      initial={{ opacity: 0, y: 12 }}
      key={activeView}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {activeView === 'inbox' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
          <div className="flex min-h-0 flex-col gap-5">
            <Card className="hero-gradient relative overflow-hidden rounded-[34px] p-7 lg:p-8">
              <div className="absolute inset-x-6 top-5 h-px bg-gradient-to-r from-accent/0 via-accent/25 to-accent/0" />
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[10px] uppercase tracking-[0.34em] text-accent/80">Task overview</p>
                  <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-text-primary lg:text-[4.4rem]">
                    Overview
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-text-secondary lg:text-base">
                    Keep the active task obvious, keep new work easy to capture, and move the rest without adding unnecessary overhead.
                  </p>
                </div>

                <div className="surface-muted-strong w-full max-w-[260px] rounded-[28px] p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Local time</p>
                  <p className="mt-3 font-mono text-[2.25rem] leading-none text-text-primary">{localTime}</p>
                  <p className="mt-3 text-sm text-text-secondary">
                    {focusSessionStart
                      ? 'Session live.'
                      : hasPausedFocus
                        ? 'Session paused.'
                        : 'Standby until you choose a task.'}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
                <div className="surface-muted-strong rounded-[30px] p-5 lg:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Focus volume</p>
                      <p className="mt-4 text-5xl font-semibold tracking-[-0.05em] text-text-primary">
                        {dailyFocusHours}
                        <span className="ml-2 text-lg text-text-secondary">hours</span>
                      </p>
                    </div>
                    <Badge tone="accent">82% of goal</Badge>
                  </div>
                  <div className="mt-8">
                    <div className="h-1.5 rounded-full bg-borderSoft/40">
                      <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-accent/60 to-accent" />
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.24em] text-text-muted">
                      Daily rhythm looks stable.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <StudioMetricCard
                    caption="Recent activity"
                    label="Streak"
                    tone="warning"
                    value={`${streakDays} Days`}
                  />
                  <StudioMetricCard
                    caption={`${doneTasks.length} tasks completed`}
                    label="Efficiency"
                    tone="neutral"
                    value={`${String(doneTasks.length).padStart(2, '0')} / ${String(tasks.length).padStart(2, '0')}`}
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => {
                    if (focusMission) {
                      void activateFocusTask(focusMission);
                    }
                  }}
                >
                  Start Task
                </Button>
                <Button
                  onClick={() => {
                    void openHud();
                  }}
                  variant="secondary"
                >
                  Open HUD
                </Button>
                <Button onClick={() => void showQuickAddWindow()} variant="secondary">
                  New Task
                </Button>
                <span className="kbd-badge ml-1">
                  <span className="pulse-dot" />
                  Ctrl+Shift+Space for Quick Add
                </span>
              </div>
            </Card>

            <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
              <Card className="min-h-0 rounded-[32px] p-6">
                <SectionHeading
                  action={<Badge tone="neutral">Minutes</Badge>}
                  label="Weekly activity"
                  title="Distribution across the last 7 days"
                />
                <div className="mt-8 flex min-h-[260px] items-end justify-between gap-3">
                  {weeklyActivity.map((day) => {
                    const height = Math.max(14, Math.min(100, Math.round(day.minutes / 2.2)));

                    return (
                      <div key={day.label} className="flex flex-1 flex-col items-center gap-3">
                        <div className="flex h-52 w-full items-end rounded-[20px] border border-borderSoft/35 bg-panel2/60 px-2 py-3">
                          <div
                            className="accent-glow-soft w-full rounded-[16px] bg-gradient-to-t from-accent/35 via-accent/55 to-accent"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">{day.label}</p>
                          <p className="mt-1 text-xs text-text-secondary">{day.minutes}m</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="grid gap-5">
                <Card className="rounded-[28px] p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Current task</p>
                  <div className="surface-muted-strong mt-5 rounded-[24px] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="h-10 w-10 rounded-full border border-accent/35 bg-accent/10 text-center font-mono text-[11px] leading-[2.4rem] text-accent">
                        {clock}
                      </div>
                      <Badge tone={focusStatusTone}>{focusStatusLabel}</Badge>
                    </div>
                    <p className="mt-4 text-base font-medium text-text-primary">
                      {focusMission?.title ?? 'No active task'}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {focusMission ? focusMission.description || focusMission.raw_input : 'Pick a task to start.'}
                    </p>
                  </div>
                </Card>

                <Card className="rounded-[28px] p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Lane counts</p>
                  <div className="mt-5 space-y-3">
                    {laneOrder.map((lane) => (
                      <div key={lane} className="flex items-center justify-between gap-3 rounded-[18px] bg-panel/58 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={cn('h-2.5 w-2.5 rounded-full', laneAccent[lane])} />
                          <span className="text-sm text-text-primary">{laneLabel[lane]}</span>
                        </div>
                        <span className="text-sm text-text-secondary">{laneTasks(tasks, lane).length}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="rounded-[28px] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Distraction report</p>
                      <p className="mt-2 text-sm text-text-secondary">Daily, weekly, and monthly pull-away patterns.</p>
                    </div>
                    <Badge tone={distractionReport.month.total > 0 ? 'warning' : 'neutral'}>
                      {distractionReport.month.total} / 30d
                    </Badge>
                  </div>

                  <div className="mt-5 space-y-3">
                    {distractionPeriods.map((period) => (
                      <div
                        key={period.label}
                        className="flex items-center justify-between gap-3 rounded-[18px] bg-panel/58 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-text-primary">{period.label}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {period.summary.topCategory
                              ? `${period.summary.topCategory.label} leads`
                              : 'No distractions logged'}
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-text-primary">{period.summary.total}</p>
                      </div>
                    ))}
                  </div>

                  <div className="surface-muted-strong mt-5 rounded-[22px] p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Main pattern</p>
                    <p className="mt-3 text-sm font-medium text-text-primary">
                      {distractionReport.month.topTrigger?.label ?? 'Nothing recurring yet'}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-text-secondary">{distractionReport.avoidanceTip}</p>
                  </div>

                  <div className="mt-5 space-y-2">
                    {distractionReport.recent.slice(0, 3).map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-[18px] border border-borderSoft/35 bg-panel/54 px-4 py-3"
                      >
                        <p className="text-sm font-medium text-text-primary">{entry.trigger}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {entry.categoryLabel} · {entry.taskTitle || 'No active task'} · {formatRelativeTime(entry.createdAt)}
                        </p>
                      </div>
                    ))}
                    {distractionReport.recent.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-borderSoft/40 px-4 py-6 text-center text-sm text-text-muted">
                        Log distractions from the HUD to build these reports.
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>
            </div>
          </div>

          <RightRail
            completedTasks={doneTasks.length}
            currentMission={currentMission}
            focusQueue={focusQueue}
            focusStatusLabel={focusStatusLabel}
            focusStatusTone={focusStatusTone}
            onOpenQuickAdd={() => void showQuickAddWindow()}
            onOpenTask={(task) => {
              openTaskDetail(task, 'inbox');
            }}
            onStartFocus={(task) => void activateFocusTask(task)}
            sessionGoalHours={`${sessionGoalHours} hours`}
          />
        </div>
      ) : null}

      {activeView === 'today' ? (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
            <Card className="rounded-[32px] p-6">
              <SectionHeading
                action={<Badge tone="neutral">{tasks.length} total</Badge>}
                label="Task manager"
                title="Drag to change lanes. Click to edit the task."
              />
              <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary">
                The board should stay quiet. Drag to move work. Click a card only when the task needs more detail.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => void showQuickAddWindow()}>New Task</Button>
                <Button
                  onClick={() => {
                    if (focusMission) {
                      void activateFocusTask(focusMission);
                    }
                  }}
                  variant="secondary"
                >
                  Start Current Task
                </Button>
              </div>
            </Card>

            <Card className="rounded-[32px] p-6">
              <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">System status</p>
              <div className="mt-5 space-y-4">
                <div className="surface-muted-strong rounded-[22px] p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Active task</p>
                  <p className="mt-3 text-lg font-medium text-text-primary">
                    {currentMission?.title ?? 'No task selected'}
                  </p>
                </div>
                <div className="surface-muted-strong rounded-[22px] p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Completion rate</p>
                  <p className="mt-3 text-3xl font-semibold text-accent">{completionRate}%</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex min-h-0 gap-5 overflow-x-auto pb-4 snap-x scrollbar-hidden">
            {laneCards.map((lane) => (
              <Card key={lane.lane} className="flex min-h-0 w-[320px] shrink-0 flex-col rounded-[30px] p-5 snap-start xl:w-[350px]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">
                      {humanizeLane(lane.lane)}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-text-primary">{lane.label}</h3>
                    <p className="mt-2 text-xs text-text-secondary">{lane.hint}</p>
                  </div>
                  <Badge tone="neutral">{lane.tasks.length}</Badge>
                </div>

                <div
                  className={cn(
                    "scrollbar-hidden mt-5 min-h-0 space-y-3 overflow-y-auto pr-1 flex-1 transition-colors rounded-xl",
                    draggingTaskId ? "bg-panel/20 outline-dashed outline-2 outline-borderSoft/30 outline-offset-4" : ""
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggingTaskId(null);
                    const taskId = e.dataTransfer.getData('text/plain');
                    if (!taskId) return;
                    void moveTaskToLane(taskId, lane.lane, 'main');
                  }}
                >
                  {lane.tasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingTaskId(task.id);
                        e.dataTransfer.setData('text/plain', task.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDraggingTaskId(null)}
                      className={cn(
                        "cursor-grab active:cursor-grabbing transition-opacity",
                        draggingTaskId === task.id ? "opacity-50" : "opacity-100"
                      )}
                    >
                      <TaskQueueItem
                        active={task.id === selectedTask?.id}
                        onSelect={() => {
                          openTaskDetail(task, 'today');
                        }}
                        task={task}
                        isFrog={lane.lane === 'now' && lane.tasks.indexOf(task) === 0}
                      />
                    </div>
                  ))}
                  {lane.tasks.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-borderSoft/40 px-4 py-10 text-center text-sm text-text-muted">
                      No tasks here yet
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === 'task' ? (
        detailTask ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_360px]">
            <div className="space-y-5">
              <Card className="rounded-[34px] p-6 lg:p-7">
                <div className="flex flex-col gap-4 border-b border-borderSoft/35 pb-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <button
                      className="text-[11px] uppercase tracking-[0.28em] text-text-muted transition hover:text-text-primary"
                      onClick={() => {
                        setCompletionReviewTaskId(null);
                        setActiveView(taskReturnView);
                      }}
                      type="button"
                    >
                      Back to {taskReturnView === 'inbox' ? 'dashboard' : taskReturnView}
                    </button>
                    <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-accent/80">
                      {isCompletionReview ? 'Completion review' : 'Task detail'}
                    </p>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-text-secondary">
                      {isCompletionReview
                        ? 'Add final notes, update anything that changed, then finish with Save Notes & Complete.'
                        : 'Use this page only when the task needs more context than a quick capture.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => setTaskEditorMode(taskEditorMode === 'simple' ? 'advanced' : 'simple')}
                      variant="ghost"
                    >
                      {taskEditorMode === 'simple' ? 'Advanced Edit' : 'Simple Mode'}
                    </Button>
                    <Button
                      disabled={isRefreshingBrief}
                      onClick={() => void refreshTaskBrief()}
                      variant="secondary"
                    >
                      {isRefreshingBrief ? 'Clarifying' : 'Refresh Brief'}
                    </Button>
                    <Button
                      disabled={!taskDraftChanged || isSavingTask}
                      onClick={() => void saveTaskDetail(detailTask)}
                      variant={isCompletionReview ? 'secondary' : 'primary'}
                    >
                      {isSavingTask ? 'Saving' : 'Save Task'}
                    </Button>
                    {isCompletionReview ? (
                      <Button
                        disabled={isSavingTask || isCompletingTask}
                        onClick={() => void completeTaskAfterReview(detailTask)}
                      >
                        {isCompletingTask ? 'Completing' : 'Save Notes & Complete'}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {isCompletionReview ? (
                  <div className="mt-6 rounded-[24px] border border-success/30 bg-success/10 p-5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-success">Before you finish</p>
                    <p className="mt-3 text-sm leading-6 text-text-primary">
                      Capture the outcome, final notes, or follow-up context here so this completed task stays useful later.
                    </p>
                  </div>
                ) : null}

                <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_220px]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Title</p>
                    <Input
                      className="mt-3"
                      onChange={(event) =>
                        setTaskDraft((current) =>
                          current
                            ? {
                                ...current,
                                title: event.target.value,
                              }
                            : current,
                        )
                      }
                      value={detailTask.title}
                    />

                    <p className="mt-5 text-[10px] uppercase tracking-[0.28em] text-text-muted">Summary</p>
                    <Textarea
                      className="mt-3 min-h-[110px] resize-none"
                      onChange={(event) =>
                        setTaskDraft((current) =>
                          current
                            ? {
                                ...current,
                                description: event.target.value,
                              }
                            : current,
                        )
                      }
                      rows={4}
                      value={detailTask.description}
                    />
                  </div>

                  <div className="grid gap-4">
                    <Card className="rounded-[24px] p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Checklist progress</p>
                      <p className="mt-4 text-3xl font-semibold text-text-primary">
                        {detailChecklistCompleted}/{detailTask.subtasks.length || 0}
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">Subtasks with a visible done state.</p>
                    </Card>
                    <Card className="rounded-[24px] p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Open questions</p>
                      <p className="mt-4 text-3xl font-semibold text-warning">
                        {getOpenQuestionCount(detailTask)}
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">Questions still blocking clarity.</p>
                    </Card>
                  </div>
                </div>
              </Card>

              {taskEditorMode === 'simple' ? (
                <>
                  <Card className="rounded-[32px] p-6">
                    <SectionHeading label="Assistant summary" title="Read this first, edit only if needed" />
                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[24px] border border-borderSoft/35 bg-panel/56 p-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Goal</p>
                        <p className="mt-3 text-sm leading-6 text-text-primary">{detailTask.goal}</p>
                      </div>
                      <div className="rounded-[24px] border border-borderSoft/35 bg-panel/56 p-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Definition of done</p>
                        <p className="mt-3 text-sm leading-6 text-text-primary">{detailTask.definition_of_done}</p>
                      </div>
                      <div className="rounded-[24px] border border-borderSoft/35 bg-panel/56 p-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Next action</p>
                        <p className="mt-3 text-sm leading-6 text-text-primary">{detailTask.next_action}</p>
                      </div>
                      <div className="rounded-[24px] border border-borderSoft/35 bg-panel/56 p-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Why it matters</p>
                        <p className="mt-3 text-sm leading-6 text-text-primary">{detailTask.why_it_matters}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="rounded-[32px] p-6">
                    <SectionHeading label="Clarifications" title="Answer only the missing context" />
                    <div className="mt-6 space-y-4">
                      {detailTask.clarifying_questions.map((question) => (
                        <div key={question.id} className="rounded-[24px] border border-borderSoft/35 bg-panel/58 p-4">
                          <p className="text-sm font-medium text-text-primary">{question.question}</p>
                          <Textarea
                            className="mt-3 min-h-[96px] resize-none"
                            onChange={(event) =>
                              setTaskDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      clarifying_questions: current.clarifying_questions.map((item) =>
                                        item.id === question.id ? { ...item, answer: event.target.value } : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                            placeholder="If you know the answer, add it here and refresh the brief."
                            rows={4}
                            value={question.answer}
                          />
                        </div>
                      ))}
                      {!detailTask.clarifying_questions.length ? (
                        <div className="rounded-[24px] border border-dashed border-borderSoft/40 px-4 py-10 text-center text-sm text-text-muted">
                          No clarification prompts right now.
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  <Card className="rounded-[32px] p-6">
                    <SectionHeading label="Execution plan" title="Suggested steps" />
                    <div className="mt-6 space-y-3">
                      {detailTask.subtasks.map((subtask, index) => (
                        <button
                          key={subtask.id}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-[22px] border px-4 py-4 text-left transition',
                            subtask.completed
                              ? 'border-success/30 bg-success/10'
                              : 'border-borderSoft/35 bg-panel/56 hover:border-borderStrong/40 hover:bg-panel/72',
                          )}
                          onClick={() =>
                            setTaskDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    subtasks: current.subtasks.map((item) =>
                                      item.id === subtask.id ? { ...item, completed: !item.completed } : item,
                                    ),
                                  }
                                : current,
                            )
                          }
                          type="button"
                        >
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                              subtask.completed
                                ? 'border-success/40 bg-success/20 text-success'
                                : 'border-borderStrong/30 text-text-muted',
                            )}
                          >
                            {index + 1}
                          </span>
                          <span className={cn('text-sm', subtask.completed ? 'line-through text-text-secondary' : 'text-text-primary')}>
                            {subtask.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Card>
                </>
              ) : (
                <>
                  <Card className="rounded-[32px] p-6">
                    <SectionHeading label="Outcome" title="Make the goal and finish line unmissable" />
                    <div className="mt-6 grid gap-5">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Goal</p>
                        <Textarea
                          className="mt-3 min-h-[96px] resize-none"
                          onChange={(event) =>
                            setTaskDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    goal: event.target.value,
                                  }
                                : current,
                            )
                          }
                          rows={4}
                          value={detailTask.goal}
                        />
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Definition of done</p>
                        <Textarea
                          className="mt-3 min-h-[96px] resize-none"
                          onChange={(event) =>
                            setTaskDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    definition_of_done: event.target.value,
                                  }
                                : current,
                            )
                          }
                          rows={4}
                          value={detailTask.definition_of_done}
                        />
                      </div>

                      <div className="grid gap-5 lg:grid-cols-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Next action</p>
                          <Textarea
                            className="mt-3 min-h-[96px] resize-none"
                            onChange={(event) =>
                              setTaskDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      next_action: event.target.value,
                                    }
                                  : current,
                              )
                            }
                            rows={4}
                            value={detailTask.next_action}
                          />
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Why it matters</p>
                          <Textarea
                            className="mt-3 min-h-[96px] resize-none"
                            onChange={(event) =>
                              setTaskDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      why_it_matters: event.target.value,
                                    }
                                  : current,
                              )
                            }
                            rows={4}
                            value={detailTask.why_it_matters}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="rounded-[32px] p-6">
                    <SectionHeading
                      action={
                        <Button
                          onClick={() =>
                            setTaskDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    subtasks: [
                                      ...current.subtasks,
                                      {
                                        id: `subtask-${Date.now()}`,
                                        title: 'New subtask',
                                        completed: false,
                                      },
                                    ],
                                  }
                                : current,
                            )
                          }
                          size="sm"
                          variant="secondary"
                        >
                          Add Step
                        </Button>
                      }
                      label="Execution plan"
                      title="Subtasks that move the task forward"
                    />
                    <div className="mt-6 space-y-3">
                      {detailTask.subtasks.map((subtask, index) => (
                        <div
                          key={subtask.id}
                          className={cn(
                            'rounded-[22px] border p-4 transition-all',
                            subtask.completed
                              ? 'border-success/30 bg-success/10'
                              : 'border-borderSoft/35 bg-panel/56',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              className={cn(
                                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition',
                                subtask.completed
                                  ? 'border-success/40 bg-success/20 text-success'
                                  : 'border-borderStrong/30 text-text-muted hover:border-accent/40 hover:text-accent',
                              )}
                              onClick={() =>
                                setTaskDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        subtasks: current.subtasks.map((item) =>
                                          item.id === subtask.id ? { ...item, completed: !item.completed } : item,
                                        ),
                                      }
                                    : current,
                                )
                              }
                              type="button"
                            >
                              {index + 1}
                            </button>
                            <Input
                              className={cn(
                                'h-11',
                                subtask.completed ? 'border-success/25 bg-success/10 text-text-primary line-through' : '',
                              )}
                              onChange={(event) =>
                                setTaskDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        subtasks: current.subtasks.map((item) =>
                                          item.id === subtask.id ? { ...item, title: event.target.value } : item,
                                        ),
                                      }
                                    : current,
                                )
                              }
                              value={subtask.title}
                            />
                            <Button
                              onClick={() =>
                                setTaskDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        subtasks: current.subtasks.filter((item) => item.id !== subtask.id),
                                      }
                                    : current,
                                )
                              }
                              size="sm"
                              variant="ghost"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="rounded-[32px] p-6">
                    <SectionHeading
                      action={
                        <Button
                          onClick={() =>
                            setTaskDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    clarifying_questions: [
                                      ...current.clarifying_questions,
                                      {
                                        id: `question-${Date.now()}`,
                                        question: 'New clarification question',
                                        answer: '',
                                      },
                                    ],
                                  }
                                : current,
                            )
                          }
                          size="sm"
                          variant="secondary"
                        >
                          Add Question
                        </Button>
                      }
                      label="Clarifications"
                      title="Ask the questions a good task brief should answer"
                    />
                    <div className="mt-6 space-y-4">
                      {detailTask.clarifying_questions.map((question) => (
                        <div key={question.id} className="rounded-[24px] border border-borderSoft/35 bg-panel/58 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <Input
                              className="h-11"
                              onChange={(event) =>
                                setTaskDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        clarifying_questions: current.clarifying_questions.map((item) =>
                                          item.id === question.id ? { ...item, question: event.target.value } : item,
                                        ),
                                      }
                                    : current,
                                )
                              }
                              value={question.question}
                            />
                            <Button
                              onClick={() =>
                                setTaskDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        clarifying_questions: current.clarifying_questions.filter(
                                          (item) => item.id !== question.id,
                                        ),
                                      }
                                    : current,
                                )
                              }
                              size="sm"
                              variant="ghost"
                            >
                              Remove
                            </Button>
                          </div>
                          <Textarea
                            className="mt-3 min-h-[96px] resize-none"
                            onChange={(event) =>
                              setTaskDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      clarifying_questions: current.clarifying_questions.map((item) =>
                                        item.id === question.id ? { ...item, answer: event.target.value } : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                            placeholder="Answer this so the task becomes easier to execute."
                            rows={4}
                            value={question.answer}
                          />
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              )}
            </div>

            <div className="space-y-5">
              <Card className="rounded-[28px] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Task controls</p>
                <div className="mt-5">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Lane</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(['inbox', 'now', 'next', 'later', 'done'] as TaskLane[]).map((lane) => (
                      <button
                        key={lane}
                        className={cn(
                          'rounded-[18px] border px-3 py-3 text-left text-sm transition',
                          detailTask.lane === lane
                            ? 'border-accent/40 bg-accent/10 text-text-primary'
                            : 'border-borderSoft/35 bg-panel/56 text-text-secondary hover:border-borderStrong/40 hover:text-text-primary',
                        )}
                        onClick={() =>
                          setTaskDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  lane,
                                  status: deriveStatusFromLane(lane, current.status),
                                }
                              : current,
                          )
                        }
                        type="button"
                      >
                        {laneLabel[lane]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Priority</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(['critical', 'high', 'normal', 'low'] as TaskPriority[]).map((priority) => (
                      <button
                        key={priority}
                        className={cn(
                          'rounded-[18px] border px-3 py-3 text-left text-sm transition',
                          detailTask.priority === priority
                            ? 'border-accent/40 bg-accent/10 text-text-primary'
                            : 'border-borderSoft/35 bg-panel/56 text-text-secondary hover:border-borderStrong/40 hover:text-text-primary',
                        )}
                        onClick={() =>
                          setTaskDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  priority,
                                }
                              : current,
                          )
                        }
                        type="button"
                      >
                        {humanizePriority(priority)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Estimate (minutes)</p>
                  <Input
                    className="mt-3"
                    min={5}
                    onChange={(event) =>
                      setTaskDraft((current) =>
                        current
                          ? {
                              ...current,
                              estimated_minutes: Number(event.target.value) || 25,
                            }
                          : current,
                      )
                    }
                    type="number"
                    value={detailTask.estimated_minutes}
                  />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    onClick={async () => {
                      const nextTask = sanitizeTask(detailTask);
                      await saveTaskDetail(nextTask);
                      await activateFocusTask(nextTask);
                    }}
                  >
                    Start in Workspace
                  </Button>
                  <Button
                    onClick={async () => {
                      const nextTask = sanitizeTask(detailTask);
                      await saveTaskDetail(nextTask);
                      selectTask(nextTask.id);
                      setCurrentMission(nextTask.id, 'main');
                      setActiveView('focus');
                    }}
                    variant="secondary"
                  >
                    Open Workspace
                  </Button>
                  <Button
                    disabled={isSavingTask || isCompletingTask}
                    onClick={() => {
                      if (isCompletionReview) {
                        void completeTaskAfterReview(detailTask);
                        return;
                      }

                      openTaskCompletionReview(detailTask);
                    }}
                    variant={isCompletionReview ? 'primary' : 'ghost'}
                  >
                    {isCompletionReview ? (isCompletingTask ? 'Completing' : 'Save Notes & Complete') : 'Review Before Done'}
                  </Button>
                </div>
              </Card>

              {taskEditorMode === 'simple' ? (
                <>
                  <Card className="rounded-[28px] p-5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Captured request</p>
                    <p className="mt-4 text-sm leading-7 text-text-primary">{detailTask.raw_input}</p>
                    <p className="mt-3 text-sm leading-6 text-text-secondary">
                      Stay in simple mode unless the original wording itself needs to change.
                    </p>
                  </Card>

                  <Card className="rounded-[28px] p-5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Mission notes</p>
                    <Textarea
                      className="mt-4 min-h-[180px] resize-none"
                      onChange={(event) =>
                        setTaskDraft((current) =>
                          current
                            ? {
                                ...current,
                                workspace_notes: event.target.value,
                              }
                            : current,
                        )
                      }
                      placeholder="Useful context, decisions, or links for the person doing the work."
                      rows={8}
                      value={detailTask.workspace_notes}
                    />
                  </Card>
                </>
              ) : (
                <>
                  <Card className="rounded-[28px] p-5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Captured request</p>
                    <Textarea
                      className="mt-4 min-h-[160px] resize-none"
                      onChange={(event) =>
                        setTaskDraft((current) =>
                          current
                            ? {
                                ...current,
                                raw_input: event.target.value,
                              }
                            : current,
                        )
                      }
                      rows={7}
                      value={detailTask.raw_input}
                    />
                    <p className="mt-3 text-sm leading-6 text-text-secondary">
                      Keep the original request here. Use refresh if you want the assistant summary rebuilt from the latest wording.
                    </p>
                  </Card>

                  <Card className="rounded-[28px] p-5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Mission notes</p>
                    <Textarea
                      className="mt-4 min-h-[180px] resize-none"
                      onChange={(event) =>
                        setTaskDraft((current) =>
                          current
                            ? {
                                ...current,
                                workspace_notes: event.target.value,
                              }
                            : current,
                        )
                      }
                      placeholder="Useful context, decisions, or links for the person doing the work."
                      rows={8}
                      value={detailTask.workspace_notes}
                    />
                  </Card>
                </>
              )}
            </div>
          </div>
        ) : (
          <Card className="rounded-[32px] p-8 text-center">
            <h2 className="text-2xl font-semibold text-text-primary">No task selected</h2>
            <p className="mt-3 text-sm text-text-secondary">
              Open a task from the board to see its details.
            </p>
          </Card>
        )
      ) : null}

      {activeView === 'focus' ? (
        <div className="flex flex-col gap-5">
          <Card className="rounded-[34px] p-0">
            <div className="grid min-h-[620px] gap-0 xl:grid-cols-[minmax(0,1.28fr)_360px]">
              <div className="border-b border-borderSoft/35 p-6 xl:border-b-0 xl:border-r">
                <div className="flex items-center justify-between gap-4">
                  <button
                    className="text-[11px] uppercase tracking-[0.28em] text-text-muted transition hover:text-text-primary"
                    onClick={() => setActiveView('today')}
                    type="button"
                  >
                    Back to tasks
                  </button>
                  <Badge tone={focusStatusTone}>{focusStatusLabel}</Badge>
                </div>

                {focusMission ? (
                  <div className="mt-8 space-y-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_260px]">
                      <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-accent/80">Current task</p>
                        <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-text-primary lg:text-5xl">
                          {focusMission.title}
                        </h2>
                        <p className="mt-5 max-w-2xl text-base leading-8 text-text-secondary">
                          {focusMission.goal}
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                          <Badge tone="neutral">{humanizeLane(focusMission.lane)}</Badge>
                          <Badge tone={priorityTone(focusMission.priority)}>{humanizePriority(focusMission.priority)}</Badge>
                          <Badge tone="neutral">{formatMinutes(focusMission.estimated_minutes)}</Badge>
                        </div>

                        <div className="mt-10 flex flex-wrap gap-3">
                          <Button
                            onClick={async () => {
                              setCurrentMission(focusMission.id, 'main');
                              if (hasPausedFocus) {
                                resumeSession('main');
                              } else {
                                startSession(undefined, 'main');
                              }
                              await openHud(focusMission, false);
                            }}
                          >
                            {focusSessionStart ? 'Restart Session' : hasPausedFocus ? 'Resume Session' : 'Start Session'}
                          </Button>
                          <Button
                            onClick={() => {
                              void openHud(focusMission);
                            }}
                            variant="secondary"
                          >
                            Open HUD
                          </Button>
                          <Button onClick={() => pauseSession('main')} variant="secondary">
                            Pause Session
                          </Button>
                          <Button onClick={() => openTaskDetail(focusMission, 'focus')} variant="ghost">
                            View / Edit Brief
                          </Button>
                        </div>
                      </div>

                      <div className="surface-muted rounded-[28px] p-5">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Session clock</p>
                        <p className="mt-4 font-mono text-[4rem] leading-none tracking-[-0.06em] text-text-primary">
                          {clock}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-text-secondary">
                        Keep the next action visible and let the rest wait until this task is done or moved.
                        </p>
                        <div className="mt-6 grid gap-3">
                          <div className="rounded-[20px] border border-borderSoft/35 bg-panel/54 p-4">
                            <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Next action</p>
                            <p className="mt-3 text-sm leading-6 text-text-primary">{focusMission.next_action}</p>
                          </div>
                          <div className="rounded-[20px] border border-borderSoft/35 bg-panel/54 p-4">
                            <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Definition of done</p>
                            <p className="mt-3 text-sm leading-6 text-text-primary">{focusMission.definition_of_done}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <Card className="rounded-[30px] p-5">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Task summary</p>
                        <div className="mt-5 space-y-4">
                          <div className="rounded-[22px] border border-borderSoft/35 bg-panel/56 p-4">
                            <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Summary</p>
                            <p className="mt-3 text-sm leading-6 text-text-primary">{focusMission.description}</p>
                          </div>
                          <div className="rounded-[22px] border border-borderSoft/35 bg-panel/56 p-4">
                            <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Why it matters</p>
                            <p className="mt-3 text-sm leading-6 text-text-primary">{focusMission.why_it_matters}</p>
                          </div>
                        </div>
                      </Card>

                      <Card className="rounded-[30px] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Execution checklist</p>
                            <p className="mt-2 text-sm text-text-secondary">
                              Check off the work that actually moves the task.
                            </p>
                          </div>
                          <Badge tone="neutral">
                            {focusChecklistCompleted}/{focusMission.subtasks.length || 0}
                          </Badge>
                        </div>
                        <div className="mt-5 space-y-3">
                          {focusMission.subtasks.map((subtask, index) => (
                            <button
                              key={subtask.id}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition',
                                subtask.completed
                                  ? 'border-success/30 bg-success/10'
                                  : 'border-borderSoft/35 bg-panel/58 hover:border-borderStrong/40 hover:bg-panel/72',
                              )}
                              onClick={() => void toggleSubtask(focusMission.id, subtask.id, 'main')}
                              type="button"
                            >
                              <span
                                className={cn(
                                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                                  subtask.completed
                                    ? 'border-success/40 bg-success/20 text-success'
                                    : 'border-borderStrong/30 text-text-muted',
                                )}
                              >
                                {index + 1}
                              </span>
                              <span
                                className={cn(
                                  'text-sm',
                                  subtask.completed ? 'text-text-secondary line-through' : 'text-text-primary',
                                )}
                              >
                                {subtask.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      </Card>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <Card className="rounded-[30px] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Working notes</p>
                            <p className="mt-2 text-sm text-text-secondary">
                              Keep short notes so you do not have to reload context later.
                            </p>
                          </div>
                          <Button
                            disabled={isSavingWorkspaceNotes}
                            onClick={() => void saveWorkspaceNotes()}
                            size="sm"
                            variant="secondary"
                          >
                            {isSavingWorkspaceNotes ? 'Saving' : 'Save Notes'}
                          </Button>
                        </div>
                        <Textarea
                          className="mt-5 min-h-[190px] resize-none"
                          onChange={(event) => setWorkspaceNotesDraft(event.target.value)}
                          placeholder="Capture the useful thinking, not every thought."
                          rows={8}
                          value={workspaceNotesDraft}
                        />
                      </Card>

                      <Card className="rounded-[30px] p-5">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Instant inbox</p>
                        <Input
                          className="mt-4"
                          onChange={(event) => setCaptureDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void captureWorkspaceTask();
                            }
                          }}
                          placeholder="Capture a new task without leaving the session..."
                          value={captureDraft}
                        />
                        <p className="mt-3 text-sm leading-6 text-text-secondary">
                          Captured items go to Inbox so the current task stays protected.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <Button
                            disabled={!captureDraft.trim()}
                            onClick={() => void captureWorkspaceTask()}
                            size="sm"
                          >
                            Add to Inbox
                          </Button>
                          <Button onClick={() => void showQuickAddWindow()} size="sm" variant="ghost">
                            Open Quick Add
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[420px] items-center justify-center">
                    <div className="max-w-md text-center">
                      <h2 className="text-3xl font-semibold text-text-primary">Choose one task</h2>
                      <p className="mt-4 text-sm leading-7 text-text-secondary">
                        The workspace becomes useful only when one task owns the screen. Open a task and move it to Active when you are ready.
                      </p>
                      <Button className="mt-6" onClick={() => setActiveView('today')}>
                        Open Task Board
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6">
                <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Mission signal</p>
                <div className="mt-6 grid gap-4">
                  <StudioMetricCard
                    caption="Steps already completed for the current task."
                    label="Progress"
                    value={
                      focusMission
                        ? `${String(focusChecklistCompleted).padStart(2, '0')} / ${String(focusMission.subtasks.length || 0).padStart(2, '0')}`
                        : '00 / 00'
                    }
                  />
                  <StudioMetricCard
                    caption="Questions still open enough to slow the task down."
                    label="Open gaps"
                    tone="warning"
                    value={String(focusOpenQuestions).padStart(2, '0')}
                  />
                  <StudioMetricCard
                    caption="Current estimate for the selected task."
                    label="Time budget"
                    tone="neutral"
                    value={focusMission ? formatMinutes(focusMission.estimated_minutes) : 'No task'}
                  />
                </div>

                <Card className="mt-5 rounded-[26px] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Questions</p>
                      <p className="mt-2 text-sm text-text-secondary">
                        Answer only the gaps that still matter.
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        if (focusMission) {
                          openTaskDetail(focusMission, 'focus');
                        }
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Full Edit
                    </Button>
                  </div>
                  <div className="mt-5 space-y-3">
                    {focusMission?.clarifying_questions.length ? (
                      focusMission.clarifying_questions.map((question) => (
                        <div key={`${question.id}-${question.answer}`} className="rounded-[20px] border border-borderSoft/35 bg-panel/58 p-4">
                          <p className="text-sm font-medium text-text-primary">{question.question}</p>
                          <Textarea
                            className="mt-3 min-h-[88px] resize-none"
                            defaultValue={question.answer}
                            onBlur={(event) =>
                              void answerQuestion(focusMission.id, question.id, event.target.value, 'main')
                            }
                            placeholder="Answer here when you know it."
                            rows={3}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-borderSoft/40 px-4 py-8 text-center text-sm text-text-muted">
                        No extra questions for this task.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="mt-5 rounded-[26px] p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Queue in view</p>
                  <div className="mt-4 space-y-3">
                    {focusQueue.map((task) => (
                      <button
                        key={task.id}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition',
                          task.id === focusMission?.id
                            ? 'border-accent/40 bg-accent/10'
                            : 'border-borderSoft/35 bg-panel/58 hover:border-borderStrong/40 hover:bg-panel/72',
                        )}
                        onClick={() => {
                          openTaskDetail(task, 'focus');
                        }}
                        type="button"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {humanizeLane(task.lane)} / {formatMinutes(task.estimated_minutes)}
                          </p>
                        </div>
                        <span className={cn('h-2.5 w-2.5 rounded-full', laneAccent[task.lane])} />
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-full border border-accent/35 bg-accent/10 px-4 py-2 font-mono text-lg text-accent">
                  {clock}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Active task</p>
                  <p className="truncate text-sm font-medium text-text-primary">
                    {focusMission?.title ?? 'No task selected'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={focusStatusTone}>{focusStatusLabel}</Badge>
                <Badge tone="neutral">{focusMission ? formatMinutes(focusMission.estimated_minutes) : 'No estimate'}</Badge>
                <Button onClick={() => resetSession('main')} size="sm" variant="secondary">
                  Finish Session
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {activeView === 'settings' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div className="space-y-5">
            <Card className="rounded-[32px] p-6">
              <SectionHeading label="Visual system" title="Theme direction" />
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {THEMES.map((theme) => (
                  <ThemeTile
                    active={theme.id === themeId}
                    key={theme.id}
                    name={theme.name}
                    onClick={() => setTheme(theme.id)}
                    preview={theme.preview}
                  />
                ))}
              </div>
            </Card>

            <Card className="rounded-[32px] p-6">
              <SectionHeading
                label="Data mode"
                title="Choose how this workspace stores and shares data"
                action={
                  <Badge tone={syncMode === 'cloud' ? 'accent' : 'neutral'}>
                    {syncModeContent[syncMode].label}
                  </Badge>
                }
              />
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <SettingsChoiceCard
                  active={syncMode === 'local'}
                  description="Keep tasks, focus state, and preferences on this device only. Best for a private single-machine setup."
                  onClick={() => setSyncMode('local')}
                  title="Local only"
                />
                <SettingsChoiceCard
                  active={syncMode === 'cloud'}
                  description="Use this when you're ready for sign-in, mobile task access, and future sync across devices. Cloud wiring comes next."
                  onClick={() => setSyncMode('cloud')}
                  title="Cloud option"
                />
              </div>
            </Card>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="rounded-[28px] p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Startup</p>
                <button
                  className="mt-5 flex w-full items-start justify-between gap-4 rounded-[22px] border border-borderSoft/35 bg-panel/60 px-4 py-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!desktopStartupAvailable || launchAtLoginPending}
                  onClick={() => {
                    void setLaunchAtLogin(!launchAtLogin);
                  }}
                  type="button"
                >
                  <div>
                    <span className="text-sm font-medium text-text-primary">Launch at login</span>
                    <p className="mt-2 text-xs leading-6 text-text-secondary">
                      {desktopStartupAvailable
                        ? 'Clicking the app icon opens the compact HUD first. Login launches start quietly in the same HUD.'
                        : 'Available in the native desktop build.'}
                    </p>
                  </div>
                  <Badge tone={launchAtLogin ? 'success' : 'neutral'}>
                    {launchAtLoginPending ? 'Saving' : launchAtLogin ? 'On' : 'Off'}
                  </Badge>
                </button>
              </Card>

              <Card className="rounded-[28px] p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Motion</p>
                <button
                  className="mt-5 flex w-full items-center justify-between rounded-[22px] border border-borderSoft/35 bg-panel/60 px-4 py-4"
                  onClick={() => setReduceMotion(!reduceMotion)}
                  type="button"
                >
                  <span className="text-sm font-medium text-text-primary">Reduce motion</span>
                  <Badge tone={reduceMotion ? 'success' : 'neutral'}>
                    {reduceMotion ? 'On' : 'Off'}
                  </Badge>
                </button>
              </Card>

              <Card className="rounded-[28px] p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Prompt style</p>
                <button
                  className="mt-5 flex w-full items-center justify-between rounded-[22px] border border-borderSoft/35 bg-panel/60 px-4 py-4"
                  onClick={() => setFocusPromptStyle(focusPromptStyle === 'gentle' ? 'direct' : 'gentle')}
                  type="button"
                >
                  <span className="text-sm font-medium capitalize text-text-primary">{focusPromptStyle}</span>
                  <Badge tone="accent">Switch</Badge>
                </button>
              </Card>
            </div>
          </div>

          <div className="space-y-5">
            <StudioMetricCard
              caption={syncModeContent[syncMode].caption}
              label="Data mode"
              tone={syncMode === 'cloud' ? 'accent' : 'neutral'}
              value={syncModeContent[syncMode].label}
            />
            <StudioMetricCard
              caption={
                desktopStartupAvailable
                  ? launchAtLogin
                    ? 'MissionControl will open its HUD automatically when your desktop session starts.'
                    : 'Clicking the app icon opens the compact HUD first. Enable this when you also want it at sign-in.'
                  : 'Desktop-only control'
              }
              label="Launch at login"
              tone={launchAtLogin ? 'accent' : 'neutral'}
              value={desktopStartupAvailable ? (launchAtLogin ? 'Enabled' : 'Off') : 'Desktop'}
            />
            <StudioMetricCard
              caption={activeTheme.eyebrow}
              label="Theme"
              tone="neutral"
              value={activeTheme.name}
            />
            <Card className="rounded-[28px] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">What changes</p>
              <p className="mt-4 text-sm leading-7 text-text-secondary">
                {syncMode === 'local'
                  ? 'Local only keeps the app fast and private on this machine. Nothing new leaves the device unless you switch to cloud later.'
                  : 'Cloud option marks this workspace as ready for sign-in, mobile visibility, and central monitoring once the backend is connected.'}
              </p>
            </Card>
          </div>
        </div>
      ) : null}
    </motion.div>
  );

  return (
    <div className="h-full p-3 sm:p-4 lg:p-5">
      <div className="app-frame relative flex h-full w-full overflow-hidden rounded-[36px] border border-borderStrong/25">
        <aside className="sidebar-shell hidden w-[248px] shrink-0 border-r border-borderSoft/35 p-5 lg:flex lg:flex-col">
          <div className="surface-muted rounded-[24px] p-4">
            <p className="text-[10px] uppercase tracking-[0.34em] text-accent/80">Deep Focus</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-text-primary">Work</h1>
            <p className="mt-2 text-sm text-text-secondary">Level 4 flow</p>
          </div>

          <nav className="mt-6 space-y-2">
            {navItems.map((item) => (
              <SidebarNavButton
                active={item.id === activeView}
                eyebrow={item.eyebrow}
                key={item.id}
                label={item.label}
                onClick={() => setActiveView(item.id)}
              />
            ))}
          </nav>

          <div className="mt-auto space-y-4">
            <Card className="rounded-[24px] p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Operator</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="accent-avatar flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold">
                  AC
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Alex Chen</p>
                  <p className="text-xs text-text-secondary">Session active</p>
                </div>
              </div>
            </Card>
            <Button className="w-full" onClick={() => void showQuickAddWindow()}>
              Start Task
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col p-5 lg:p-7">
            <div className="mb-5 flex flex-col gap-3 border-b border-borderSoft/35 pb-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-text-muted">
                  {activeView === 'task'
                    ? 'Mission detail'
                    : navItems.find((item) => item.id === activeView)?.eyebrow}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text-primary lg:text-[3.4rem]">
                  {pageHeaderTitle}
                </h1>
              </div>

              <div className="max-w-xl">
                <p className="text-sm leading-7 text-text-secondary lg:text-right">
                  {pageHeaderDescription}
                </p>
              </div>
            </div>

            <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto pr-1">
              <AnimatePresence mode="wait">{page}</AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
