import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { getFocusStatusLabel } from '../../features/focus/focus-presenter';
import { useFocusStore } from '../../features/focus/focus-store';
import { useTaskStore } from '../../features/tasks/task-store';
import type { Task } from '../../features/tasks/task-types';
import { formatMinutes, getElapsedSeconds } from '../../lib/date';
import { cn } from '../../lib/cn';
import { hideCurrentWindow, isTauriApp, showMainWindow, showQuickAddWindow } from '../../lib/tauri';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input, Textarea } from '../../components/ui/input';
import { WindowDragHandle } from '../../components/ui/window-drag-handle';

const HUD_COMPACT_SIZE = { width: 620, height: 104 };
const HUD_EXPANDED_SIZE = { width: 1180, height: 720 };
const HUD_MARGIN_X = 26;
const HUD_MARGIN_Y = 26;
const HUD_POSITION_STORAGE_KEY = 'missioncontrol:hud-window-positions';

type HudWindowPosition = { x: number; y: number };
type HudStoredPosition = HudWindowPosition | null;

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

function getHudWindowSize(mode: 'expanded' | 'compact', workWidth: number, workHeight: number) {
  const requestedSize = mode === 'expanded' ? HUD_EXPANDED_SIZE : HUD_COMPACT_SIZE;

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

function getQueue(tasks: Task[], currentMissionId: string | null) {
  const laneRank: Record<Task['lane'], number> = {
    now: 0,
    next: 1,
    inbox: 2,
    later: 3,
    done: 4,
  };

  return [...tasks]
    .filter((task) => task.id !== currentMissionId && task.lane !== 'done')
    .sort((left, right) => laneRank[left.lane] - laneRank[right.lane])
    .slice(0, 5);
}

function buildChecklist(task: Task | null) {
  if (!task) {
    return [
      'Choose a single task to activate the workspace',
      'Capture one success condition before starting',
      'Use the instant inbox for anything unrelated',
    ];
  }

  const subject = (task.title.split(' ')[0] ?? 'mission').toLowerCase();

  return [
    `Define the concrete deliverable for ${subject}`,
    'Clear the first blocker before branching',
    'Leave a review note before closing the session',
  ];
}

function buildResources(task: Task | null) {
  if (!task) {
    return ['Brief', 'Checklist', 'Notes'];
  }

  if (task.title.toLowerCase().includes('deck')) {
    return ['Slides', 'Metrics', 'Feedback'];
  }

  if (task.title.toLowerCase().includes('customer')) {
    return ['Account', 'Agenda', 'Renewal'];
  }

  return ['Working doc', 'Reference', 'Handoff'];
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
      className={cn('h-9 w-9 rounded-full px-0', className)}
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
  const markDone = useTaskStore((state) => state.markDone);
  const [elapsedSeconds, setElapsedSeconds] = useState(
    getElapsedSeconds(focusSessionStart, focusElapsedSeconds),
  );
  const [sessionNotes, setSessionNotes] = useState('');
  const [instantInbox, setInstantInbox] = useState('');

  const currentMission =
    tasks.find((task) => task.id === currentMissionId) ?? tasks.find((task) => task.lane === 'now') ?? null;
  const totalSessionSeconds = Math.max(60, focusSessionDuration * 60);
  const remainingSeconds = Math.max(0, totalSessionSeconds - elapsedSeconds);
  const displayClock = formatDigitalClock(remainingSeconds);
  const progressRatio = Math.min(1, elapsedSeconds / Math.max(totalSessionSeconds, 1));
  const queue = getQueue(tasks, currentMission?.id ?? null);
  const checklist = buildChecklist(currentMission);
  const resources = buildResources(currentMission);
  const focusStatusLabel = getFocusStatusLabel(focusStatus);
  const useStableHudRendering = isTauriApp() && isLinuxPlatform();
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
      const targetSize = getHudWindowSize(hudMode, workWidth, workHeight);
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
  }, [hudMode]);

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
    const nextTask = queue[0] ?? null;

    if (currentMission) {
      await markDone(currentMission.id, 'hud');
      setCurrentMission(nextTask?.id ?? null, 'hud');
    }

    resetSession('hud');
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
            useStableHudRendering && 'hud-shell--stable',
            useStableHudRendering
              ? hudTransparency === 'ghost'
                ? 'border-white/12 bg-[linear-gradient(180deg,rgba(11,16,19,0.94),rgba(8,12,15,0.9))]'
                : 'border-white/12 bg-[linear-gradient(180deg,rgba(11,16,19,0.98),rgba(8,12,15,0.95))]'
              : hudTransparency === 'ghost'
                ? 'border-white/12 bg-[linear-gradient(180deg,rgba(8,12,15,0.46),rgba(8,12,15,0.3))]'
                : 'border-white/12 bg-[linear-gradient(180deg,rgba(8,12,15,0.78),rgba(8,12,15,0.6))]',
          )}
        >
          <aside className="flex w-[74px] flex-col items-center border-r border-white/6 bg-black/18 px-4 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-[11px] font-semibold uppercase tracking-[0.22em] text-text-primary">
              DW
            </div>
            <div className="mt-8 space-y-3">
              {['Flow', 'Tasks', 'Notes', 'Archive'].map((item, index) => (
                <div
                  key={item}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl border text-[10px] uppercase tracking-[0.2em]',
                    index === 0
                      ? 'border-accent/35 bg-accent/12 text-accent'
                      : 'border-white/6 bg-white/[0.03] text-text-muted',
                  )}
                >
                  {item.slice(0, 1)}
                </div>
              ))}
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
            <WindowDragHandle className="flex items-center justify-between border-b border-white/6 px-6 py-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-text-primary">Work</span>
                <div className="hidden items-center gap-5 text-[10px] uppercase tracking-[0.28em] text-text-muted md:flex">
                  <span className="text-accent">Flow</span>
                  <span>Library</span>
                  <span>Archive</span>
                </div>
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
                <div className="shrink-0 rounded-[30px] border border-white/6 bg-[radial-gradient(circle_at_20%_18%,rgba(123,232,220,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-accent/80">Focusing now</p>
                  <button
                    className="mt-4 max-w-[540px] text-left text-[clamp(2.1rem,4vw,3rem)] font-semibold tracking-[-0.05em] text-text-primary transition hover:text-accent"
                    onClick={() => {
                      if (currentMission) {
                        showTaskInHud(currentMission);
                      }
                    }}
                    type="button"
                  >
                    {currentMission?.title ?? 'No mission selected'}
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
                    <p className="text-sm font-medium text-text-primary">Sub-tasks</p>
                    <div className="mt-4 space-y-3">
                      {checklist.map((item, index) => (
                        <div
                          key={item}
                          className={cn(
                            'flex items-center gap-3 rounded-[18px] border px-4 py-3',
                            index === 0
                              ? 'border-accent/35 bg-accent/10 text-text-primary'
                              : 'border-white/6 bg-white/[0.03] text-text-secondary',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold',
                              index === 0
                                ? 'border-accent/45 bg-accent/20 text-accent'
                                : 'border-white/10 text-text-muted',
                            )}
                          >
                            {index + 1}
                          </span>
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-[260px] flex-1 flex-col rounded-[28px] border border-white/6 bg-black/15 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Session thoughts</p>
                      <p className="mt-2 text-sm text-text-secondary">
                        Leave a clean trail for the next pass through this mission.
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
                  'hud-scroll-region scrollbar-hidden flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-t border-white/6 bg-black/12 p-5 lg:w-[340px] lg:border-l lg:border-t-0',
                  useStableHudRendering && 'hud-scroll-region--stable',
                )}
              >
                <div className="rounded-[24px] border border-white/6 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.28em] text-accent/80">System active</span>
                    <span className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Core 12.4</span>
                  </div>
                  <p className="mt-4 text-base font-medium text-text-primary">
                    {currentMission?.title ?? 'No active task'}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {currentMission ? `${formatMinutes(currentMission.estimated_minutes)} planned` : 'Choose a task in the main app'}
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/6 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Sub-tasks</p>
                    <span className="text-[10px] uppercase tracking-[0.28em] text-accent/80">
                      {checklist.length} items
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {checklist.map((item, index) => (
                      <button
                        key={item}
                        className={cn(
                          'w-full rounded-[16px] border px-3 py-3 text-left text-sm transition',
                          index === 0
                            ? 'border-accent/35 bg-accent/10 text-text-primary'
                            : 'border-white/6 bg-white/[0.025] text-text-secondary hover:border-white/10 hover:bg-white/[0.04]',
                        )}
                        type="button"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/6 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Inbox / idea drop</p>
                  <Input
                    className="mt-4"
                    onChange={(event) => setInstantInbox(event.target.value)}
                    placeholder="Type and press enter..."
                    value={instantInbox}
                  />
                  <p className="mt-2 text-xs text-text-muted">Anything here can be triaged later.</p>

                  <p className="mt-5 text-[10px] uppercase tracking-[0.28em] text-text-muted">Resources</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {resources.map((resource) => (
                      <span
                        key={resource}
                        className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-xs text-text-secondary"
                      >
                        {resource}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/6 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Queue</p>
                  <div className="mt-4 space-y-2">
                    {queue.map((task) => (
                      <button
                        key={task.id}
                        className="w-full rounded-[16px] border border-white/6 bg-white/[0.025] px-3 py-3 text-left transition hover:border-white/10 hover:bg-white/[0.04]"
                        onClick={() => showTaskInHud(task)}
                        type="button"
                      >
                        <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {task.lane} / {formatMinutes(task.estimated_minutes)}
                        </p>
                      </button>
                    ))}
                    {queue.length === 0 ? (
                      <div className="rounded-[16px] border border-dashed border-white/10 px-3 py-6 text-center text-sm text-text-muted">
                        Queue clear
                      </div>
                    ) : null}
                  </div>
                </div>
              </aside>
            </div>

            <div className="border-t border-white/6 bg-black/18 px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-full border border-accent/35 bg-accent/10 px-4 py-2 font-mono text-2xl text-accent">
                    {displayClock}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Active task</p>
                    <p className="truncate text-sm font-medium text-text-primary">
                      {currentMission?.title ?? 'No mission selected'}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Progress</span>
                  <div className="h-1.5 flex-1 rounded-full bg-white/6">
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
                    label="Complete mission"
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
        <div className="w-full max-w-[620px]">
          <div
            className={cn(
              'hud-shell relative rounded-[28px] border px-3 py-3.5',
              useStableHudRendering && 'hud-shell--stable',
              useStableHudRendering
                ? hudTransparency === 'ghost'
                  ? 'border-white/12 bg-[linear-gradient(180deg,rgba(11,16,19,0.94),rgba(8,12,15,0.9))]'
                  : 'border-white/12 bg-[linear-gradient(180deg,rgba(11,16,19,0.98),rgba(8,12,15,0.95))]'
                : hudTransparency === 'ghost'
                  ? 'border-white/12 bg-[linear-gradient(180deg,rgba(8,12,15,0.38),rgba(8,12,15,0.22))]'
                  : 'border-white/12 bg-[linear-gradient(180deg,rgba(8,12,15,0.68),rgba(8,12,15,0.52))]',
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
                  {currentMission?.title ?? 'No mission selected'}
                </button>
                <div className="mt-2 h-[3px] rounded-full bg-white/6">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent/50 to-accent"
                    style={{ width: getProgressWidth(progressRatio) }}
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/8 bg-black/20 p-1">
                <HudActionButton
                  className="h-8 w-8"
                  icon={<AppIcon />}
                  label="Open app"
                  onClick={() => {
                    void showMainWindow();
                  }}
                />
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
                  label="Complete mission"
                  onClick={() => {
                    void finishMission();
                  }}
                  variant="primary"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
