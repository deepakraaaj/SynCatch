import { AnimatePresence, motion } from 'framer-motion';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useReducer, useState } from 'react';
import { logActivity } from '../../features/activity/activity-repository';
import {
  getFocusStatusLabel,
  getFocusStatusTone,
  getFocusToggleLabel,
} from '../../features/focus/focus-presenter';
import { useFocusStore } from '../../features/focus/focus-store';
import { useSettingsStore } from '../../features/settings/settings-store';
import { humanizeLane, humanizePriority } from '../../features/tasks/task-helpers';
import type { Task, TaskLane, TaskPriority } from '../../features/tasks/task-types';
import { useTaskStore } from '../../features/tasks/task-store';
import { THEMES } from '../../features/themes/themes';
import { useThemeStore } from '../../features/themes/theme-store';
import { formatElapsedClock, formatMinutes, formatRelativeTime } from '../../lib/date';
import { showHudWindow, showQuickAddWindow } from '../../lib/tauri';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Textarea } from '../../components/ui/input';
import { cn } from '../../lib/cn';

type MainView = 'inbox' | 'today' | 'focus' | 'settings';

const navItems: Array<{ id: MainView; label: string; eyebrow: string }> = [
  { id: 'inbox', label: 'Dashboard', eyebrow: 'Deep focus' },
  { id: 'today', label: 'Tasks', eyebrow: 'Today queue' },
  { id: 'focus', label: 'Workspace', eyebrow: 'Flow state' },
  { id: 'settings', label: 'Settings', eyebrow: 'System tune' },
];

const laneOrder: TaskLane[] = ['inbox', 'now', 'next', 'later', 'done'];

const laneLabel: Record<TaskLane, string> = {
  inbox: 'Inbox',
  now: 'Do First (Frog)',
  next: 'Schedule (Next)',
  later: 'Delegate / Defer',
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

function buildWorkspaceChecklist(task: Task | null) {
  if (!task) {
    return [
      'Choose one mission to turn the workspace live',
      'Capture the one proof point that matters',
      'Decide what finished looks like before starting',
    ];
  }

  const firstWord = task.title.split(' ')[0] ?? 'mission';

  return [
    `Lock the concrete deliverable for ${firstWord.toLowerCase()}`,
    'Clear one blocker before opening a second thread',
    'Leave a handoff note before closing the session',
  ];
}

function buildResourceLinks(task: Task | null) {
  if (!task) {
    return ['Design notes', 'Brief', 'Review checklist'];
  }

  if (task.title.toLowerCase().includes('deck')) {
    return ['Narrative outline', 'Metrics appendix', 'Review comments'];
  }

  if (task.title.toLowerCase().includes('customer')) {
    return ['Account notes', 'Renewal metrics', 'Call agenda'];
  }

  return ['Working doc', 'Reference context', 'Handoff draft'];
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
  onPrimary,
  onSecondary,
  secondaryLabel,
  primaryLabel,
  isFrog,
}: {
  task: Task;
  active: boolean;
  onSelect: () => void;
  onPrimary: () => void;
  onSecondary: () => void;
  secondaryLabel: string;
  primaryLabel: string;
  isFrog?: boolean;
}) {
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
          {isFrog ? <Badge tone="accent">Eat the frog 🐸</Badge> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={(event) => {
            event.stopPropagation();
            onPrimary();
          }}
          size="sm"
        >
          {primaryLabel}
        </Button>
        <Button
          onClick={(event) => {
            event.stopPropagation();
            onSecondary();
          }}
          size="sm"
          variant="secondary"
        >
          {secondaryLabel}
        </Button>
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
          Capture what should move next.
        </h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Keep the queue tight. One clear objective beats five vague intentions.
        </p>
        <Button className="mt-5 w-full" onClick={onOpenQuickAdd}>
          Add to Queue
        </Button>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
        <Card className="rounded-[24px] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Session goal</p>
          <p className="mt-4 text-3xl font-semibold text-text-primary">{sessionGoalHours}</p>
          <p className="mt-2 text-sm text-text-secondary">Estimated load across active and next missions.</p>
        </Card>

        <Card className="rounded-[24px] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Completed today</p>
          <p className="mt-4 text-3xl font-semibold text-accent">{String(completedTasks).padStart(2, '0')}</p>
          <p className="mt-2 text-sm text-text-secondary">Closed loops create the momentum.</p>
        </Card>
      </div>

      <Card className="min-h-0 flex-1 rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Task manager</p>
            <h3 className="mt-2 text-lg font-semibold text-text-primary">Today&apos;s missions</h3>
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
                  Focus
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
              {currentMission?.title ?? 'No mission selected'}
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
  const [clockTick, bumpClockTick] = useReducer((count: number) => count + 1, 0);
  const [workspaceNotes, setWorkspaceNotes] = useState('');
  const [captureDraft, setCaptureDraft] = useState('');

  const tasks = useTaskStore((state) => state.tasks);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const moveTaskToLane = useTaskStore((state) => state.moveTaskToLane);
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
  const setFocusStatus = useFocusStore((state) => state.setStatus);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const themeId = useThemeStore((state) => state.themeId);
  const setTheme = useThemeStore((state) => state.setTheme);
  const activeTheme = THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion);
  const focusPromptStyle = useSettingsStore((state) => state.focusPromptStyle);
  const setFocusPromptStyle = useSettingsStore((state) => state.setFocusPromptStyle);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const currentMission =
    tasks.find((task) => task.id === currentMissionId) ??
    tasks.find((task) => task.lane === 'now') ??
    null;
  const focusMission = currentMission ?? selectedTask;
  const inboxTasks = laneTasks(tasks, 'inbox');
  const nowTasks = laneTasks(tasks, 'now');
  const nextTasks = laneTasks(tasks, 'next');
  const laterTasks = laneTasks(tasks, 'later');
  const doneTasks = laneTasks(tasks, 'done');
  const focusQueue = uniqueTasks([focusMission, ...nowTasks, ...nextTasks, ...inboxTasks]).slice(0, 6);
  const focusStatusTone = getFocusStatusTone(focusStatus);
  const focusStatusLabel = getFocusStatusLabel(focusStatus);
  const weeklyActivity = getWeeklyActivity(tasks);

  const dailyFocusHours = ((doneTasks.length * 50 + nowTasks.length * 35 + nextTasks.length * 20) / 60).toFixed(1);
  const streakDays = Math.max(4, doneTasks.length * 4 + nowTasks.length * 2 + 6);
  const completionRate = Math.round((doneTasks.length / Math.max(1, tasks.length)) * 100);
  const sessionGoalHours = (focusQueue.reduce((sum, task) => sum + task.estimated_minutes, 0) / 60).toFixed(1);
  const localTime = clockTick >= 0 ? getLocalTime() : '00:00';
  const clock = clockTick >= 0 ? formatElapsedClock(focusSessionStart, focusElapsedSeconds) : '00:00';
  const hasPausedFocus = !focusSessionStart && focusElapsedSeconds > 0;
  const laneCards = [
    { lane: 'inbox' as TaskLane, label: 'Queue', tasks: inboxTasks, moveTo: 'next' as TaskLane, moveLabel: 'Next' },
    { lane: 'now' as TaskLane, label: 'Active', tasks: nowTasks, moveTo: 'done' as TaskLane, moveLabel: 'Complete' },
    { lane: 'next' as TaskLane, label: 'Next', tasks: nextTasks, moveTo: 'now' as TaskLane, moveLabel: 'Activate' },
    { lane: 'later' as TaskLane, label: 'Backlog', tasks: laterTasks, moveTo: 'inbox' as TaskLane, moveLabel: 'Queue' },
  ];
  const checklistItems = buildWorkspaceChecklist(focusMission);
  const resourceLinks = buildResourceLinks(focusMission);

  useEffect(() => {
    if (!selectedTaskId && tasks[0]) {
      selectTask(tasks[0].id);
    }
  }, [selectedTaskId, selectTask, tasks]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      bumpClockTick();
    }, 1000);

    return () => {
      window.clearInterval(interval);
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

  const pageHeaderTitle =
    activeView === 'inbox'
      ? 'Focus Flow.'
      : activeView === 'today'
        ? "Today's Missions"
        : activeView === 'focus'
          ? 'Task Workspace'
          : 'Studio Settings';

  const pageHeaderDescription =
    activeView === 'inbox'
      ? 'Keep the surface calm, the queue sharp, and your active mission obvious.'
      : activeView === 'today'
        ? 'Prioritize clarity over completion. Move tasks deliberately.'
        : activeView === 'focus'
          ? 'A dedicated workspace for one mission, one clock, and one next move.'
          : 'Tune the visual system and interaction pace for your working style.';

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
                  <p className="text-[10px] uppercase tracking-[0.34em] text-accent/80">Productivity dashboard</p>
                  <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-text-primary lg:text-[4.4rem]">
                    Focus Flow.
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-text-secondary lg:text-base">
                    You&apos;ve maintained your streak by staying specific. Keep one mission active,
                    let the rest wait in order, and use the HUD when you want the interface to fade away.
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
                        : 'Standby until you choose a mission.'}
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
                    caption="Personal best: 18 days"
                    label="Consistency"
                    tone="warning"
                    value={`${streakDays} Days`}
                  />
                  <StudioMetricCard
                    caption={`${doneTasks.length} missions landed cleanly`}
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
                  Start Deep Work
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
                  Capture Objective
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
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Current session</p>
                  <div className="surface-muted-strong mt-5 rounded-[24px] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="h-10 w-10 rounded-full border border-accent/35 bg-accent/10 text-center font-mono text-[11px] leading-[2.4rem] text-accent">
                        {clock}
                      </div>
                      <Badge tone={focusStatusTone}>{focusStatusLabel}</Badge>
                    </div>
                    <p className="mt-4 text-base font-medium text-text-primary">
                      {focusMission?.title ?? 'No mission live'}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {focusMission ? focusMission.description || focusMission.raw_input : 'Pick a mission to start.'}
                    </p>
                  </div>
                </Card>

                <Card className="rounded-[28px] p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Lane signal</p>
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
              void openHud(task);
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
                title="Choose what matters, then move it cleanly"
              />
              <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary">
                The task layer stays simple on purpose: promote, complete, or push back. The lane is the decision.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => void showQuickAddWindow()}>New Objective</Button>
                <Button
                  onClick={() => {
                    if (focusMission) {
                      void activateFocusTask(focusMission);
                    }
                  }}
                  variant="secondary"
                >
                  Start Current Mission
                </Button>
              </div>
            </Card>

            <Card className="rounded-[32px] p-6">
              <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">System status</p>
              <div className="mt-5 space-y-4">
                <div className="surface-muted-strong rounded-[22px] p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Active task</p>
                  <p className="mt-3 text-lg font-medium text-text-primary">
                    {currentMission?.title ?? 'No mission selected'}
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
                        onPrimary={() => {
                          if (lane.moveTo === 'done') {
                            void markDone(task.id, 'main');
                            return;
                          }

                          void moveTaskToLane(task.id, lane.moveTo, 'main');
                        }}
                        onSecondary={() => void activateFocusTask(task)}
                        onSelect={() => {
                          void openHud(task);
                        }}
                        primaryLabel={lane.moveLabel}
                        secondaryLabel="Focus"
                        task={task}
                        isFrog={lane.lane === 'now' && lane.tasks.indexOf(task) === 0}
                      />
                    </div>
                  ))}
                  {lane.tasks.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-borderSoft/40 px-4 py-10 text-center text-sm text-text-muted">
                      No missions here yet
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === 'focus' ? (
        <div className="flex flex-col gap-5">
          <Card className="rounded-[34px] p-0">
            <div className="grid min-h-[620px] gap-0 xl:grid-cols-[minmax(0,1.28fr)_360px]">
              <div className="border-b border-borderSoft/35 p-6 xl:border-b-0 xl:border-r">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      className="text-[11px] uppercase tracking-[0.28em] text-text-muted transition hover:text-text-primary"
                      onClick={() => setActiveView('inbox')}
                      type="button"
                    >
                      Back to studio
                    </button>
                  </div>
                  <Badge tone={focusStatusTone}>{focusStatusLabel}</Badge>
                </div>

                <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_260px]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-accent/80">Focusing now</p>
                    <h2 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-0.04em] text-text-primary lg:text-5xl">
                      {focusMission?.title ?? 'Implement your next move'}
                    </h2>

                    <div className="mt-8">
                      <p className="font-mono text-[4rem] leading-none tracking-[-0.06em] text-text-primary lg:text-[5rem]">
                        {clock}
                      </p>
                      <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-text-muted">
                        Elapsed session time
                      </p>
                    </div>

                    <div className="mt-10">
                      <p className="text-sm font-medium text-text-primary">Sub-tasks</p>
                      <div className="mt-4 space-y-3">
                        {checklistItems.map((item, index) => (
                          <div
                            key={item}
                            className={cn(
                              'flex items-center gap-3 rounded-[18px] border px-4 py-3',
                              index === 0
                                ? 'border-accent/35 bg-accent/10 text-text-primary'
                                : 'border-borderSoft/35 bg-panel/58 text-text-secondary',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold',
                                index === 0
                                  ? 'border-accent/45 bg-accent/20 text-accent'
                                  : 'border-borderStrong/30 text-text-muted',
                              )}
                            >
                              {index + 1}
                            </span>
                            <span className="text-sm">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-10 flex flex-wrap gap-3">
                      <Button
                        onClick={async () => {
                          if (focusMission) {
                            setCurrentMission(focusMission.id, 'main');
                          }
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
                      {focusMission ? (
                        <Button onClick={() => void markDone(focusMission.id, 'main')} variant="ghost">
                          Finish Mission
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="surface-muted rounded-[28px] p-5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Session thoughts</p>
                    <Textarea
                      className="mt-4 min-h-[128px] resize-none"
                      onChange={(event) => setWorkspaceNotes(event.target.value)}
                      placeholder="Capture a decision, blocker, or reminder for your future self..."
                      rows={6}
                      value={workspaceNotes}
                    />

                    <p className="mt-6 text-[10px] uppercase tracking-[0.28em] text-text-muted">Instant inbox</p>
                    <Input
                      className="mt-4"
                      onChange={(event) => setCaptureDraft(event.target.value)}
                      placeholder="Capture idea or task..."
                      value={captureDraft}
                    />
                    <p className="mt-2 text-xs text-text-muted">
                      Items added here can be cleaned up after the session.
                    </p>

                    <p className="mt-6 text-[10px] uppercase tracking-[0.28em] text-text-muted">Resources</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {resourceLinks.map((resource) => (
                        <span
                          key={resource}
                          className="rounded-full border border-borderSoft/40 bg-panel/62 px-3 py-2 text-xs text-text-secondary"
                        >
                          {resource}
                        </span>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button onClick={() => void showQuickAddWindow()} size="sm" variant="secondary">
                        Open Quick Add
                      </Button>
                      <Button
                        onClick={() =>
                          setFocusStatus(
                            focusStatus === 'drifting' ? 'locked-in' : 'drifting',
                            'main',
                          )
                        }
                        size="sm"
                        variant="ghost"
                      >
                        {getFocusToggleLabel(focusStatus)}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Session summary</p>
                <div className="mt-6 grid gap-4">
                  <StudioMetricCard
                    caption="How aligned the session feels with the chosen mission."
                    label="Deep work score"
                    value={`${Math.max(76, completionRate)}%`}
                  />
                  <StudioMetricCard
                    caption="Tasks actively pulled into this workspace."
                    label="Tasks progressed"
                    tone="neutral"
                    value={String(focusQueue.length).padStart(2, '0')}
                  />
                  <StudioMetricCard
                    caption="Use this as a proxy for how often context tried to interrupt you."
                    label="Distractions blocked"
                    tone="warning"
                    value={String(Math.max(8, focusQueue.length * 4)).padStart(2, '0')}
                  />
                </div>

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
                          void openHud(task);
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
                    {focusMission?.title ?? 'No mission selected'}
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

            <div className="grid gap-5 xl:grid-cols-2">
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
              caption={activeTheme.eyebrow}
              label="Primary mode"
              tone="neutral"
              value={activeTheme.name}
            />
            <Card className="rounded-[28px] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Notes</p>
              <p className="mt-4 text-sm leading-7 text-text-secondary">
                {activeTheme.description} This palette now flows through the main workspace, HUD, and quick add surfaces.
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
              Start Deep Work
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col p-5 lg:p-7">
            <div className="mb-5 flex flex-col gap-3 border-b border-borderSoft/35 pb-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-text-muted">
                  {navItems.find((item) => item.id === activeView)?.eyebrow}
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
