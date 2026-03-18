import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { logActivity } from '../../features/activity/activity-repository';
import {
  distractionCategoryOptions,
  type DistractionCategory,
} from '../../features/activity/distraction-insights';
import { getFocusStatusLabel } from '../../features/focus/focus-presenter';
import { useFocusStore } from '../../features/focus/focus-store';
import { useTaskStore } from '../../features/tasks/task-store';
import type { Task, TaskLane } from '../../features/tasks/task-types';
import { formatMinutes, getElapsedSeconds } from '../../lib/date';
import { cn } from '../../lib/cn';
import { hideCurrentWindow, isTauriApp, showMainWindow, showQuickAddWindow } from '../../lib/tauri';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input, Textarea } from '../../components/ui/input';
import { WindowDragHandle } from '../../components/ui/window-drag-handle';

const HUD_COMPACT_SIZE = { width: 620, height: 104 };
const HUD_COMPACT_DRAWER_SIZE = { width: 620, height: 420 };
const HUD_EXPANDED_SIZE = { width: 1180, height: 720 };
const HUD_MARGIN_X = 26;
const HUD_MARGIN_Y = 26;
const HUD_POSITION_STORAGE_KEY = 'missioncontrol:hud-window-positions';
const hudCaptureOptions: Array<{
  lane: Exclude<TaskLane, 'done'>;
  label: string;
  hint: string;
}> = [
  { lane: 'inbox', label: 'Queue', hint: 'Capture it for the kanban queue' },
  { lane: 'now', label: 'Active', hint: 'Make it the live HUD task now' },
  { lane: 'next', label: 'Next', hint: 'Ready after the current task' },
  { lane: 'later', label: 'Backlog', hint: 'Keep it, but not right now' },
];

type HudWindowPosition = { x: number; y: number };
type HudStoredPosition = HudWindowPosition | null;
type HudCaptureLane = Exclude<TaskLane, 'done'>;

function isLinuxPlatform() {
  if (typeof window === 'undefined') {
    return false;
  }

  const platform = `${window.navigator.platform} ${window.navigator.userAgent}`;
  return /linux/i.test(platform);
}

function readStoredHudPosition(): HudStoredPosition {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(HUD_POSITION_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<HudWindowPosition>;
    if (typeof parsedValue.x !== 'number' || typeof parsedValue.y !== 'number') {
      return null;
    }

    return { x: parsedValue.x, y: parsedValue.y };
  } catch {
    return null;
  }
}

function writeStoredHudPosition(position: HudWindowPosition) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(HUD_POSITION_STORAGE_KEY, JSON.stringify(position));
}

function clampHudWindowPosition(
  position: HudWindowPosition,
  width: number,
  height: number,
  workX: number,
  workY: number,
  workWidth: number,
  workHeight: number,
) {
  const maxX = Math.max(workX, workX + workWidth - width);
  const maxY = Math.max(workY, workY + workHeight - height);

  return {
    x: Math.min(Math.max(position.x, workX), maxX),
    y: Math.min(Math.max(position.y, workY), maxY),
  };
}

function getHudWindowSize(
  mode: 'expanded' | 'compact',
  workWidth: number,
  workHeight: number,
  compactDrawerOpen: boolean,
) {
  const requestedSize =
    mode === 'expanded'
      ? HUD_EXPANDED_SIZE
      : compactDrawerOpen
        ? HUD_COMPACT_DRAWER_SIZE
        : HUD_COMPACT_SIZE;

  return {
    width: Math.min(requestedSize.width, Math.max(1, workWidth - HUD_MARGIN_X * 2)),
    height: Math.min(requestedSize.height, Math.max(1, workHeight - HUD_MARGIN_Y * 2)),
  };
}

function formatDigitalClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getProgressWidth(progressRatio: number) {
  if (progressRatio <= 0) {
    return '0%';
  }

  return `${Math.max(8, progressRatio * 100)}%`;
}

function getActiveQueue(tasks: Task[], currentMissionId: string | null) {
  return [...tasks]
    .filter((task) => task.id !== currentMissionId && task.lane === 'now' && task.status !== 'done')
    .slice(0, 5);
}

function Icon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={cn('h-3.5 w-3.5', className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

function AppIcon() {
  return (
    <Icon>
      <rect height="14" rx="2.5" width="18" x="3" y="5" />
      <path d="M3 9h18" />
    </Icon>
  );
}

function QuickAddIcon() {
  return (
    <Icon>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  );
}

function DistractionIcon() {
  return (
    <Icon>
      <path d="M12 3 21 19H3L12 3Z" />
      <path d="M12 9v4" />
      <path d="M12 16h.01" />
    </Icon>
  );
}

function PlayIcon() {
  return (
    <Icon>
      <path d="M9 7.5v9l7-4.5-7-4.5Z" fill="currentColor" stroke="none" />
    </Icon>
  );
}

function PauseIcon() {
  return (
    <Icon>
      <path d="M9 6v12" />
      <path d="M15 6v12" />
    </Icon>
  );
}

function CompleteIcon() {
  return (
    <Icon>
      <path d="M5 12.5 9.5 17 19 7.5" />
    </Icon>
  );
}

function ExpandIcon() {
  return (
    <Icon>
      <path d="M9 4H4v5" />
      <path d="m4 4 6 6" />
      <path d="M15 20h5v-5" />
      <path d="m20 20-6-6" />
      <path d="M20 9V4h-5" />
      <path d="m20 4-6 6" />
      <path d="M4 15v5h5" />
      <path d="m4 20 6-6" />
    </Icon>
  );
}

function MinimizeIcon() {
  return (
    <Icon>
      <path d="M10 10 4 4" />
      <path d="M4 8V4h4" />
      <path d="m14 14 6 6" />
      <path d="M16 20h4v-4" />
      <path d="m14 10 6-6" />
      <path d="M16 4h4v4" />
      <path d="m10 14-6 6" />
      <path d="M4 16v4h4" />
    </Icon>
  );
}

function GhostIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5a7 7 0 0 1 0 14" />
    </Icon>
  );
}

function CloseIcon() {
  return (
    <Icon>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </Icon>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <Icon className={cn('transition-transform duration-200', expanded && 'rotate-180')}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

function HudActionButton({
  icon,
  label,
  onClick,
  variant = 'secondary',
  disabled,
  className,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      aria-label={label}
      className={cn(
        'h-9 w-9 rounded-full px-0',
        variant === 'primary' && '!shadow-none focus:!shadow-none focus-visible:!shadow-none focus:!ring-0 focus-visible:!ring-0',
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      size="sm"
      title={label}
      variant={variant}
    >
      {icon}
    </Button>
  );
}

export function HudApp() {
  const currentMissionId = useFocusStore((state) => state.currentMissionId);
  const focusSessionStart = useFocusStore((state) => state.focusSessionStart);
  const focusElapsedSeconds = useFocusStore((state) => state.focusElapsedSeconds);
  const focusSessionDuration = useFocusStore((state) => state.focusSessionDuration);
  const focusStatus = useFocusStore((state) => state.status);
  const hudMode = useFocusStore((state) => state.hudMode);
  const hudTransparency = useFocusStore((state) => state.hudTransparency);
  const setCurrentMission = useFocusStore((state) => state.setCurrentMission);
  const startSession = useFocusStore((state) => state.startSession);
  const resumeSession = useFocusStore((state) => state.resumeSession);
  const pauseSession = useFocusStore((state) => state.pauseSession);
  const toggleHudMode = useFocusStore((state) => state.toggleHudMode);
  const toggleHudTransparency = useFocusStore((state) => state.toggleHudTransparency);
  const resetSession = useFocusStore((state) => state.resetSession);
  const tasks = useTaskStore((state) => state.tasks);
  const createTask = useTaskStore((state) => state.createTask);
  const markDone = useTaskStore((state) => state.markDone);
  const toggleSubtask = useTaskStore((state) => state.toggleSubtask);
  const [elapsedSeconds, setElapsedSeconds] = useState(
    getElapsedSeconds(focusSessionStart, focusElapsedSeconds),
  );
  const [sessionNotes, setSessionNotes] = useState('');
  const [hudTaskInput, setHudTaskInput] = useState('');
  const [hudTaskLane, setHudTaskLane] = useState<HudCaptureLane>('inbox');
  const [hudTaskTitle, setHudTaskTitle] = useState('');
  const [hudTaskNextAction, setHudTaskNextAction] = useState('');
  const [hudTaskNotes, setHudTaskNotes] = useState('');
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [showCompactTaskComposer, setShowCompactTaskComposer] = useState(false);
  const [isSavingHudTask, setIsSavingHudTask] = useState(false);
  const [distractionTrigger, setDistractionTrigger] = useState('');
  const [distractionCategory, setDistractionCategory] = useState<DistractionCategory>('context_switch');
  const [distractionNote, setDistractionNote] = useState('');
  const [showCompactDistractionComposer, setShowCompactDistractionComposer] = useState(false);
  const [isSavingDistraction, setIsSavingDistraction] = useState(false);
  const [customTime, setCustomTime] = useState('');

  const currentMission =
    tasks.find((task) => task.id === currentMissionId && task.lane === 'now') ?? tasks.find((task) => task.lane === 'now') ?? null;
  const totalSessionSeconds = Math.max(60, focusSessionDuration * 60);
  const remainingSeconds = Math.max(0, totalSessionSeconds - elapsedSeconds);
  const displayClock = formatDigitalClock(remainingSeconds);
  const progressRatio = Math.min(1, elapsedSeconds / Math.max(totalSessionSeconds, 1));
  const activeQueue = getActiveQueue(tasks, currentMission?.id ?? null);
  const checklist = currentMission?.subtasks ?? [];
  const focusStatusLabel = getFocusStatusLabel(focusStatus);
  const useStableHudRendering = isTauriApp() && isLinuxPlatform();
  const effectiveHudTransparency = hudMode === 'compact' ? 'standard' : hudTransparency;
  const hudShellToneClass = effectiveHudTransparency === 'ghost' ? 'hud-shell--ghost' : 'hud-shell--solid';
  const compactDrawerOpen =
    hudMode === 'compact' && (showCompactTaskComposer || showCompactDistractionComposer);
  const isSessionRunning = Boolean(focusSessionStart);
  const hasPausedProgress = !isSessionRunning && focusElapsedSeconds > 0;
  const sessionToggleLabel = isSessionRunning
    ? 'Pause session'
    : hasPausedProgress
      ? 'Resume session'
      : 'Start session';
  const sessionToggleIcon = isSessionRunning ? <PauseIcon /> : <PlayIcon />;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedSeconds(getElapsedSeconds(focusSessionStart, focusElapsedSeconds));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [focusElapsedSeconds, focusSessionStart]);

  useEffect(() => {
    if (!isTauriApp()) {
      return;
    }

    let cancelled = false;

    void Promise.all([
      import('@tauri-apps/api/window'),
      import('@tauri-apps/api/dpi'),
    ]).then(async ([{ currentMonitor, getCurrentWindow }, { LogicalPosition, LogicalSize }]) => {
      if (cancelled) {
        return;
      }

      const currentWindow = getCurrentWindow();
      const monitor = await currentMonitor();
      if (!monitor || cancelled) {
        return;
      }

      const scaleFactor = monitor.scaleFactor;
      const workArea = monitor.workArea;
      const workX = workArea.position.x / scaleFactor;
      const workY = workArea.position.y / scaleFactor;
      const workWidth = workArea.size.width / scaleFactor;
      const workHeight = workArea.size.height / scaleFactor;
      const targetSize = getHudWindowSize(hudMode, workWidth, workHeight, compactDrawerOpen);
      const storedPosition = readStoredHudPosition();
      const currentScaleFactor = await currentWindow.scaleFactor();
      const currentOuterPosition = await currentWindow.outerPosition();
      const basePosition = storedPosition ?? {
        x: currentOuterPosition.x / currentScaleFactor,
        y: currentOuterPosition.y / currentScaleFactor,
      };

      await currentWindow.setSize(
        new LogicalSize(Math.round(targetSize.width), Math.round(targetSize.height)),
      );

      const nextPosition = clampHudWindowPosition(
        basePosition,
        targetSize.width,
        targetSize.height,
        workX,
        workY,
        workWidth,
        workHeight,
      );

      await currentWindow.setPosition(
        new LogicalPosition(Math.round(nextPosition.x), Math.round(nextPosition.y)),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [compactDrawerOpen, hudMode]);

  useEffect(() => {
    if (hudMode === 'expanded' && (showCompactTaskComposer || showCompactDistractionComposer)) {
      setShowCompactTaskComposer(false);
      setShowCompactDistractionComposer(false);
    }
  }, [hudMode, showCompactDistractionComposer, showCompactTaskComposer]);

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
      unlisten = await currentWindow.onMoved(async ({ payload }) => {
        const scaleFactor = await currentWindow.scaleFactor();

        if (cancelled) {
          return;
        }

        writeStoredHudPosition({
          x: payload.x / scaleFactor,
          y: payload.y / scaleFactor,
        });
      });
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  function showTaskInHud(task: Task, expand = false) {
    setCurrentMission(task.id, 'hud');

    if (expand && hudMode === 'compact') {
      toggleHudMode('hud');
    }
  }

  function handleSessionToggle() {
    if (!currentMission) {
      return;
    }

    if (isSessionRunning) {
      pauseSession('hud');
      return;
    }

    if (hasPausedProgress) {
      resumeSession('hud');
      return;
    }

    startSession(undefined, 'hud');
  }

  async function finishMission() {
    const nextTask = activeQueue[0] ?? null;

    if (currentMission) {
      await markDone(currentMission.id, 'hud');
      setCurrentMission(nextTask?.id ?? null, 'hud');
    }

    resetSession('hud');
  }

  function resetHudTaskComposer() {
    setHudTaskInput('');
    setHudTaskLane('inbox');
    setHudTaskTitle('');
    setHudTaskNextAction('');
    setHudTaskNotes('');
    setShowTaskDetails(false);
    setShowCompactTaskComposer(false);
  }

  function resetDistractionComposer() {
    setDistractionTrigger('');
    setDistractionCategory('context_switch');
    setDistractionNote('');
    setShowCompactDistractionComposer(false);
  }

  function toggleCompactTaskComposer() {
    setShowCompactDistractionComposer(false);
    setShowCompactTaskComposer((current) => !current);
  }

  function toggleCompactDistractionComposer() {
    setShowCompactTaskComposer(false);
    setShowCompactDistractionComposer((current) => !current);
  }

  async function captureHudTask() {
    if (!hudTaskInput.trim()) {
      return;
    }

    setIsSavingHudTask(true);

    try {
      const task = await createTask(
        {
          rawInput: hudTaskInput,
          title: hudTaskTitle.trim() || undefined,
          nextAction: hudTaskNextAction.trim() || undefined,
          workspaceNotes: hudTaskNotes.trim() || undefined,
          lane: hudTaskLane,
          priority: hudTaskLane === 'now' ? 'high' : 'normal',
          status: 'captured',
        },
        'hud',
      );

      if (hudTaskLane === 'now') {
        setCurrentMission(task.id, 'hud');
      }

      resetHudTaskComposer();
    } finally {
      setIsSavingHudTask(false);
    }
  }

  async function logDistraction() {
    if (!distractionTrigger.trim()) {
      return;
    }

    setIsSavingDistraction(true);

    try {
      await logActivity({
        action: 'distraction_logged',
        source: 'hud',
        taskId: currentMission?.id ?? null,
        details: {
          category: distractionCategory,
          trigger: distractionTrigger.trim(),
          note: distractionNote.trim(),
          taskTitle: currentMission?.title ?? '',
          focusStatus,
        },
      });

      resetDistractionComposer();
    } finally {
      setIsSavingDistraction(false);
    }
  }

  return (
    <div
      className={cn(
        'overlay-root',
        hudMode === 'expanded' ? 'items-center justify-center' : 'items-start justify-end',
      )}
    >
      {hudMode === 'expanded' ? (
        <div
          className={cn(
            'hud-shell flex h-full w-full max-h-[720px] max-w-[1180px] overflow-hidden rounded-[34px] border',
            hudShellToneClass,
            useStableHudRendering && 'hud-shell--stable',
          )}
        >
          <aside className="flex w-[74px] flex-col items-center border-r border-borderSoft/35 bg-panel2/68 px-4 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-borderStrong/25 bg-panel/70 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-primary">
              MC
            </div>
            <div className="mt-8 space-y-3">
              <HudActionButton
                icon={<AppIcon />}
                label="Open app"
                onClick={() => {
                  void showMainWindow();
                }}
              />
              <HudActionButton
                icon={<QuickAddIcon />}
                label="Open quick add"
                onClick={() => {
                  void showQuickAddWindow();
                }}
              />
              <HudActionButton
                icon={<ExpandIcon />}
                label="Toggle compact mode"
                onClick={() => toggleHudMode('hud')}
              />
            </div>
            <div className="mt-auto">
              <HudActionButton
                icon={<CloseIcon />}
                label="Hide HUD"
                onClick={() => {
                  void hideCurrentWindow();
                }}
              />
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <WindowDragHandle className="flex items-center justify-between border-b border-borderSoft/35 px-6 py-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-text-primary">Focus</span>
              </div>
              <div className="flex items-center gap-2">
                <HudActionButton
                  icon={<GhostIcon />}
                  label={hudTransparency === 'ghost' ? 'Use solid HUD' : 'Use translucent HUD'}
                  onClick={() => toggleHudTransparency('hud')}
                />
                <HudActionButton
                  icon={<MinimizeIcon />}
                  label="Minimize HUD"
                  onClick={() => toggleHudMode('hud')}
                />
              </div>
            </WindowDragHandle>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              <div
                className={cn(
                  'hud-scroll-region scrollbar-hidden flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6',
                  useStableHudRendering && 'hud-scroll-region--stable',
                )}
              >
                <div className="hud-focus-panel shrink-0 rounded-[30px] p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-accent/80">Current task</p>
                  <button
                    className="mt-4 max-w-[540px] text-left text-[clamp(2.1rem,4vw,3rem)] font-semibold tracking-[-0.05em] text-text-primary transition hover:text-accent"
                    onClick={() => {
                      if (currentMission) {
                        showTaskInHud(currentMission);
                      }
                    }}
                    type="button"
                  >
                    {currentMission?.title ?? 'No task selected'}
                  </button>
                  <div className="mt-8">
                    <p className="font-mono text-[clamp(3.8rem,8vw,5rem)] leading-none tracking-[-0.08em] text-text-primary">
                      {displayClock}
                    </p>
                    <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-text-muted">
                      Remaining session time
                    </p>
                  </div>

                  <div className="mt-10">
                    <p className="text-sm font-medium text-text-primary">Steps</p>
                    <div className="mt-4 space-y-3">
                      {checklist.length ? (
                        checklist.map((subtask, index) => (
                          <button
                            key={subtask.id}
                            onClick={() => {
                              if (currentMission) {
                                void toggleSubtask(currentMission.id, subtask.id, 'hud');
                              }
                            }}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition',
                              subtask.completed
                                ? 'border-success/35 bg-success/10 text-success opacity-75'
                                : 'border-borderSoft/35 bg-panel/58 text-text-secondary hover:border-borderStrong/40',
                            )}
                            type="button"
                          >
                            <span
                              className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition',
                                subtask.completed
                                  ? 'border-success/45 bg-success/20 text-success'
                                  : 'border-borderStrong/30 text-text-muted',
                              )}
                            >
                              {subtask.completed ? '✓' : index + 1}
                            </span>
                            <span className={cn('text-sm', subtask.completed ? 'line-through' : '')}>{subtask.title}</span>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-borderSoft/40 px-4 py-8 text-sm text-text-muted">
                          No steps added.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="surface-muted flex min-h-[260px] flex-1 flex-col rounded-[28px] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Session thoughts</p>
                      <p className="mt-2 text-sm text-text-secondary">
                        Keep short notes while you work.
                      </p>
                    </div>
                    <Badge tone="neutral">{focusStatusLabel}</Badge>
                  </div>
                  <Textarea
                    className="mt-5 min-h-[220px] flex-1 resize-none"
                    onChange={(event) => setSessionNotes(event.target.value)}
                    placeholder="Capture transient thoughts, decisions, and anything you should not keep in your head..."
                    rows={8}
                    value={sessionNotes}
                  />
                </div>
              </div>

              <aside
                className={cn(
                  'hud-scroll-region scrollbar-hidden flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-t border-borderSoft/35 bg-panel2/56 p-5 lg:w-[340px] lg:border-l lg:border-t-0',
                  useStableHudRendering && 'hud-scroll-region--stable',
                )}
              >
                <div className="surface-muted rounded-[24px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.28em] text-accent/80">System active</span>
                    <span className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Live</span>
                  </div>
                  <p className="mt-4 text-base font-medium text-text-primary">
                    {currentMission?.title ?? 'No active task'}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {currentMission ? `${formatMinutes(currentMission.estimated_minutes)} planned` : 'Choose a task in the main app'}
                  </p>
                </div>

                <div className="surface-muted rounded-[24px] p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Frameworks</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="rounded-[16px] border border-borderSoft/35 bg-panel/54 px-3 py-3 text-left transition hover:border-accent/40 hover:bg-accent/10"
                      onClick={() => startSession(25, 'hud')}
                      type="button"
                    >
                      <p className="text-sm font-medium text-text-primary">Pomodoro</p>
                      <p className="mt-1 text-[10px] text-text-secondary">25m focus &middot; 5m break</p>
                    </button>
                    <button
                      className="rounded-[16px] border border-borderSoft/35 bg-panel/54 px-3 py-3 text-left transition hover:border-accent/40 hover:bg-accent/10"
                      onClick={() => startSession(180, 'hud')}
                      type="button"
                    >
                      <p className="text-sm font-medium text-text-primary">Long Block</p>
                      <p className="mt-1 text-[10px] text-text-secondary">180m focus</p>
                    </button>
                    <button
                      className="rounded-[16px] border border-borderSoft/35 bg-panel/54 px-3 py-3 text-left transition hover:border-accent/40 hover:bg-accent/10"
                      onClick={() => startSession(45, 'hud')}
                      type="button"
                    >
                      <p className="text-sm font-medium text-text-primary">Standard</p>
                      <p className="mt-1 text-[10px] text-text-secondary">45m block</p>
                    </button>
                    <button
                      className="rounded-[16px] border border-accent/35 bg-accent/10 px-3 py-3 text-left transition hover:border-accent/50 hover:bg-accent/20"
                      onClick={() => startSession(5, 'hud')}
                      type="button"
                    >
                      <p className="text-sm font-medium text-accent">Quick break</p>
                      <p className="mt-1 text-[10px] text-accent/80">5m recharge</p>
                    </button>
                    <div className="col-span-2 mt-1 flex items-center gap-2 rounded-[16px] border border-borderSoft/35 bg-panel/30 p-1 pl-3 transition-colors focus-within:border-accent/40 focus-within:bg-panel/50">
                      <Input
                        className="h-8 flex-1 border-none bg-transparent px-0 text-sm focus-visible:ring-0"
                        onChange={(event) => setCustomTime(event.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customTime) {
                            startSession(parseInt(customTime, 10), 'hud');
                            setCustomTime('');
                          }
                        }}
                        placeholder="Custom minutes..."
                        value={customTime}
                        type="text"
                        maxLength={3}
                      />
                      <HudActionButton
                        className="h-8 w-8 shrink-0"
                        disabled={!customTime}
                        icon={<PlayIcon />}
                        label="Start custom timer"
                        onClick={() => {
                          if (customTime) {
                            startSession(parseInt(customTime, 10), 'hud');
                            setCustomTime('');
                          }
                        }}
                        variant={customTime ? 'primary' : 'ghost'}
                      />
                    </div>
                  </div>
                </div>

                <div className="surface-muted rounded-[24px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Steps</p>
                    <span className="text-[10px] uppercase tracking-[0.28em] text-accent/80">
                      {checklist.filter((item) => item.completed).length}/{checklist.length} done
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {checklist.map((subtask) => {
                      return (
                        <button
                          key={subtask.id}
                          onClick={() => {
                            if (currentMission) {
                              void toggleSubtask(currentMission.id, subtask.id, 'hud');
                            }
                          }}
                          className={cn(
                            'w-full rounded-[16px] border px-3 py-3 text-left text-sm transition',
                            subtask.completed
                              ? 'border-success/35 bg-success/10 text-success line-through opacity-70'
                              : 'border-borderSoft/35 bg-panel/54 text-text-secondary hover:border-borderStrong/40 hover:bg-panel/68',
                          )}
                          type="button"
                        >
                          {subtask.title}
                        </button>
                      )
                    })}
                    {checklist.length === 0 ? (
                      <div className="rounded-[16px] border border-dashed border-borderSoft/40 px-3 py-6 text-center text-sm text-text-muted">
                        No steps added
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="surface-muted rounded-[24px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Add task</p>
                      <p className="mt-2 text-sm text-text-secondary">Choose where the task should land in the board.</p>
                    </div>
                    <Badge tone="neutral">HUD</Badge>
                  </div>

                  <Input
                    className="mt-4"
                    onChange={(event) => setHudTaskInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void captureHudTask();
                      }
                    }}
                    placeholder="What came up?"
                    value={hudTaskInput}
                  />

                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Status</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {hudCaptureOptions.map((option) => (
                        <button
                          key={option.lane}
                          className={cn(
                            'rounded-[16px] border px-3 py-3 text-left text-sm transition',
                            hudTaskLane === option.lane
                              ? 'border-accent/45 bg-accent/10 text-text-primary'
                              : 'border-borderSoft/35 bg-panel/54 text-text-secondary hover:border-borderStrong/40 hover:bg-panel/68',
                          )}
                          onClick={() => setHudTaskLane(option.lane)}
                          type="button"
                        >
                          <p className="font-medium">{option.label}</p>
                          <p className="mt-1 text-[10px] leading-4 text-current/80">{option.hint}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    aria-expanded={showTaskDetails}
                    className="mt-4 flex w-full items-center justify-between rounded-[16px] border border-borderSoft/35 bg-panel/40 px-3 py-3 text-left transition hover:border-borderStrong/40 hover:bg-panel/54"
                    onClick={() => setShowTaskDetails((current) => !current)}
                    type="button"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">Optional details</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-text-muted">
                        Title, first step, notes
                      </p>
                    </div>
                    <ChevronIcon expanded={showTaskDetails} />
                  </button>

                  {showTaskDetails ? (
                    <div className="mt-3 space-y-3">
                      <Input
                        onChange={(event) => setHudTaskTitle(event.target.value)}
                        placeholder="Title override"
                        value={hudTaskTitle}
                      />
                      <Input
                        onChange={(event) => setHudTaskNextAction(event.target.value)}
                        placeholder="First step"
                        value={hudTaskNextAction}
                      />
                      <Textarea
                        className="min-h-[88px] resize-none"
                        onChange={(event) => setHudTaskNotes(event.target.value)}
                        placeholder="Notes you want to keep with the task"
                        rows={3}
                        value={hudTaskNotes}
                      />
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs leading-5 text-text-muted">
                      {hudTaskLane === 'now'
                        ? 'This becomes the live HUD task immediately.'
                        : hudTaskLane === 'next'
                          ? 'This goes to Next in kanban and waits behind the active task.'
                          : hudTaskLane === 'later'
                            ? 'This goes to Backlog so you keep it without touching it now.'
                            : 'This goes to Queue so you can clarify or schedule it later.'}
                    </p>
                    <Button
                      disabled={isSavingHudTask || !hudTaskInput.trim()}
                      onClick={() => {
                        void captureHudTask();
                      }}
                    >
                      {isSavingHudTask ? 'Adding' : 'Add task'}
                    </Button>
                  </div>

                  {currentMission ? (
                    <div className="mt-5 rounded-[16px] border border-borderSoft/35 bg-panel/54 px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Current next action</p>
                      <p className="mt-2 text-sm leading-6 text-text-primary">{currentMission.next_action}</p>
                    </div>
                  ) : null}
                </div>

                <div className="surface-muted rounded-[24px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Distraction log</p>
                      <p className="mt-2 text-sm text-text-secondary">Capture what pulled you away so the reports can spot patterns.</p>
                    </div>
                    <Badge tone="warning">Focus</Badge>
                  </div>

                  <Input
                    className="mt-4"
                    onChange={(event) => setDistractionTrigger(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void logDistraction();
                      }
                    }}
                    placeholder="What pulled you away?"
                    value={distractionTrigger}
                  />

                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Type</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {distractionCategoryOptions.map((option) => (
                        <button
                          key={option.value}
                          className={cn(
                            'rounded-[14px] border px-2 py-2 text-center text-[11px] font-medium transition',
                            distractionCategory === option.value
                              ? 'border-warning/45 bg-warning/12 text-text-primary'
                              : 'border-borderSoft/35 bg-panel/54 text-text-secondary hover:border-borderStrong/40 hover:bg-panel/68',
                          )}
                          onClick={() => setDistractionCategory(option.value)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    className="mt-4 min-h-[88px] resize-none"
                    onChange={(event) => setDistractionNote(event.target.value)}
                    placeholder="Optional: what should change next time?"
                    rows={3}
                    value={distractionNote}
                  />

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs leading-5 text-text-muted">
                      {currentMission
                        ? `Linked to ${currentMission.title}.`
                        : 'Logs without an active task are still included in the reports.'}
                    </p>
                    <Button
                      disabled={isSavingDistraction || !distractionTrigger.trim()}
                      onClick={() => {
                        void logDistraction();
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      {isSavingDistraction ? 'Logging' : 'Log distraction'}
                    </Button>
                  </div>
                </div>



                <div className="surface-muted rounded-[24px] p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Active tasks</p>
                  <div className="mt-4 space-y-2">
                    {activeQueue.map((task) => (
                      <button
                        key={task.id}
                        className="w-full rounded-[16px] border border-borderSoft/35 bg-panel/54 px-3 py-3 text-left transition hover:border-borderStrong/40 hover:bg-panel/68"
                        onClick={() => showTaskInHud(task)}
                        type="button"
                      >
                        <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {task.lane} / {formatMinutes(task.estimated_minutes)}
                        </p>
                      </button>
                    ))}
                    {activeQueue.length === 0 ? (
                      <div className="rounded-[16px] border border-dashed border-borderSoft/40 px-3 py-6 text-center text-sm text-text-muted">
                        Nothing else active
                      </div>
                    ) : null}
                  </div>
                </div>
              </aside>
            </div>

            <div className="border-t border-borderSoft/35 bg-panel2/68 px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-full border border-accent/35 bg-accent/10 px-4 py-2 font-mono text-2xl text-accent">
                    {displayClock}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Active task</p>
                    <p className="truncate text-sm font-medium text-text-primary">
                      {currentMission?.title ?? 'No task selected'}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Progress</span>
                  <div className="h-1.5 flex-1 rounded-full bg-borderSoft/40">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent/50 to-accent"
                      style={{ width: getProgressWidth(progressRatio) }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <HudActionButton
                    icon={<AppIcon />}
                    label="Open app"
                    onClick={() => {
                      void showMainWindow();
                    }}
                  />
                  <HudActionButton
                    icon={<QuickAddIcon />}
                    label="Open quick add"
                    onClick={() => {
                      void showQuickAddWindow();
                    }}
                  />
                  <HudActionButton
                    disabled={!currentMission}
                    icon={sessionToggleIcon}
                    label={sessionToggleLabel}
                    onClick={handleSessionToggle}
                  />
                  <HudActionButton
                    disabled={!currentMission}
                    icon={<CompleteIcon />}
                    label="Complete task"
                    onClick={() => {
                      void finishMission();
                    }}
                    variant="primary"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full w-full max-w-[620px]">
          <div
            className={cn(
              'hud-shell relative flex h-full flex-col rounded-[28px] border px-3 py-3.5',
              hudShellToneClass,
              useStableHudRendering && 'hud-shell--stable',
            )}
          >
            <WindowDragHandle className="absolute inset-x-0 top-0 z-10 h-5 rounded-t-[28px]" />
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
              <div className="rounded-[22px] border border-accent/35 bg-accent/10 px-3 py-2 font-mono text-[1.55rem] leading-none text-accent">
                {displayClock}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.28em] text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>{focusStatusLabel}</span>
                </div>
                <button
                  className="mt-1.5 block max-w-full truncate pr-1 text-left text-[15px] font-semibold leading-5 text-text-primary transition hover:text-accent"
                  onClick={() => {
                    if (currentMission) {
                      showTaskInHud(currentMission, true);
                      return;
                    }

                    toggleHudMode('hud');
                  }}
                  type="button"
                >
                  {currentMission?.title ?? 'No task selected'}
                </button>
                <div className="mt-2 h-[3px] rounded-full bg-borderSoft/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent/50 to-accent"
                    style={{ width: getProgressWidth(progressRatio) }}
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 rounded-full border border-borderStrong/25 bg-panel2/74 p-1">
                <HudActionButton
                  className="h-8 w-8"
                  icon={<AppIcon />}
                  label="Open app"
                  onClick={() => {
                    void showMainWindow();
                  }}
                />
                <Button
                  className={cn(
                    'h-8 shrink-0 rounded-full px-3 text-xs font-semibold',
                    showCompactTaskComposer && 'shadow-none',
                  )}
                  onClick={toggleCompactTaskComposer}
                  size="sm"
                  variant={showCompactTaskComposer ? 'primary' : 'secondary'}
                >
                  <QuickAddIcon />
                  <span>{showCompactTaskComposer ? 'Close add' : 'Add task'}</span>
                </Button>
                <Button
                  className={cn(
                    'h-8 shrink-0 rounded-full px-3 text-xs font-semibold',
                    showCompactDistractionComposer && 'shadow-none',
                  )}
                  onClick={toggleCompactDistractionComposer}
                  size="sm"
                  variant={showCompactDistractionComposer ? 'primary' : 'secondary'}
                >
                  <DistractionIcon />
                  <span>{showCompactDistractionComposer ? 'Close log' : 'Distracted'}</span>
                </Button>
                <HudActionButton
                  className="h-8 w-8"
                  icon={<ExpandIcon />}
                  label="Expand HUD"
                  onClick={() => toggleHudMode('hud')}
                />
                <HudActionButton
                  className="h-8 w-8"
                  disabled={!currentMission}
                  icon={sessionToggleIcon}
                  label={sessionToggleLabel}
                  onClick={handleSessionToggle}
                />
                <HudActionButton
                  className="h-8 w-8"
                  disabled={!currentMission}
                  icon={<CompleteIcon />}
                  label="Complete task"
                  onClick={() => {
                    void finishMission();
                  }}
                  variant="primary"
                />
              </div>
            </div>

            {showCompactTaskComposer ? (
              <div className="mt-3 min-h-0 flex-1 border-t border-borderSoft/28 pt-3">
                <div className="surface-muted flex h-full min-h-0 flex-col rounded-[22px] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Add task</p>
                      <p className="mt-1 text-xs text-text-secondary">Create it here, keep focus intact.</p>
                    </div>
                    <Badge tone="neutral">Compact</Badge>
                  </div>

                  <div className="scrollbar-hidden mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="space-y-3">
                      <Input
                        onChange={(event) => setHudTaskInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void captureHudTask();
                          }
                        }}
                        placeholder="What came up?"
                        value={hudTaskInput}
                      />

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Status</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {hudCaptureOptions.map((option) => (
                            <button
                              key={option.lane}
                              className={cn(
                                'rounded-[14px] border px-3 py-2.5 text-left text-sm transition',
                                hudTaskLane === option.lane
                                  ? 'border-accent/45 bg-accent/10 text-text-primary'
                                  : 'border-borderSoft/35 bg-panel/54 text-text-secondary hover:border-borderStrong/40 hover:bg-panel/68',
                              )}
                              onClick={() => setHudTaskLane(option.lane)}
                              type="button"
                            >
                              <p className="font-medium">{option.label}</p>
                              <p className="mt-1 text-[10px] leading-4 text-current/80">{option.hint}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        aria-expanded={showTaskDetails}
                        className="flex w-full items-center justify-between rounded-[14px] border border-borderSoft/35 bg-panel/40 px-3 py-3 text-left transition hover:border-borderStrong/40 hover:bg-panel/54"
                        onClick={() => setShowTaskDetails((current) => !current)}
                        type="button"
                      >
                        <div>
                          <p className="text-sm font-medium text-text-primary">Optional details</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-text-muted">
                            Title, first step, notes
                          </p>
                        </div>
                        <ChevronIcon expanded={showTaskDetails} />
                      </button>

                      {showTaskDetails ? (
                        <div className="space-y-3">
                          <Input
                            onChange={(event) => setHudTaskTitle(event.target.value)}
                            placeholder="Title override"
                            value={hudTaskTitle}
                          />
                          <Input
                            onChange={(event) => setHudTaskNextAction(event.target.value)}
                            placeholder="First step"
                            value={hudTaskNextAction}
                          />
                          <Textarea
                            className="min-h-[80px] resize-none"
                            onChange={(event) => setHudTaskNotes(event.target.value)}
                            placeholder="Notes you want to keep with the task"
                            rows={3}
                            value={hudTaskNotes}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex shrink-0 flex-col gap-3 border-t border-borderSoft/24 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-text-muted">
                      {hudTaskLane === 'now'
                        ? 'Active starts in HUD immediately.'
                        : hudTaskLane === 'next'
                          ? 'Next waits behind the live task.'
                          : hudTaskLane === 'later'
                            ? 'Backlog keeps it out of the way.'
                            : 'Queue keeps it ready for kanban review.'}
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        onClick={() => setShowCompactTaskComposer(false)}
                        size="sm"
                        variant="ghost"
                      >
                        Close
                      </Button>
                      <Button
                        disabled={isSavingHudTask || !hudTaskInput.trim()}
                        onClick={() => {
                          void captureHudTask();
                        }}
                        size="sm"
                      >
                        {isSavingHudTask ? 'Adding' : 'Add task'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {showCompactDistractionComposer ? (
              <div className="mt-3 min-h-0 flex-1 border-t border-borderSoft/28 pt-3">
                <div className="surface-muted flex h-full min-h-0 flex-col rounded-[22px] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Distraction log</p>
                      <p className="mt-1 text-xs text-text-secondary">Log the interruption while it is fresh.</p>
                    </div>
                    <Badge tone="warning">Compact</Badge>
                  </div>

                  <div className="scrollbar-hidden mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="space-y-3">
                      <Input
                        onChange={(event) => setDistractionTrigger(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void logDistraction();
                          }
                        }}
                        placeholder="What pulled you away?"
                        value={distractionTrigger}
                      />

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Type</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {distractionCategoryOptions.map((option) => (
                            <button
                              key={option.value}
                              className={cn(
                                'rounded-[14px] border px-2 py-2 text-center text-[11px] font-medium transition',
                                distractionCategory === option.value
                                  ? 'border-warning/45 bg-warning/12 text-text-primary'
                                  : 'border-borderSoft/35 bg-panel/54 text-text-secondary hover:border-borderStrong/40 hover:bg-panel/68',
                              )}
                              onClick={() => setDistractionCategory(option.value)}
                              type="button"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Textarea
                        className="min-h-[88px] resize-none"
                        onChange={(event) => setDistractionNote(event.target.value)}
                        placeholder="Optional: what should change next time?"
                        rows={3}
                        value={distractionNote}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex shrink-0 flex-col gap-3 border-t border-borderSoft/24 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-text-muted">
                      {currentMission
                        ? `Logged against ${currentMission.title}.`
                        : 'This still counts toward your distraction reports.'}
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        onClick={() => setShowCompactDistractionComposer(false)}
                        size="sm"
                        variant="ghost"
                      >
                        Close
                      </Button>
                      <Button
                        disabled={isSavingDistraction || !distractionTrigger.trim()}
                        onClick={() => {
                          void logDistraction();
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        {isSavingDistraction ? 'Logging' : 'Log distraction'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
