import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FileText,
  Pin,
  Plus,
  Quote,
  Flag,
  Timer,
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { MissionIcon } from '../../components/ui/mission-icon';
import { cn } from '../../lib/cn';
import { formatMinutes, formatRelativeTime, getLocalDateKey } from '../../lib/date';
import { stagger as sharedStagger } from '../../lib/motion';
import { LumiHeroCard } from './LumiHeroCard';
import { useAuthStore } from '../auth/auth-store';
import { useSettingsStore } from '../settings/settings-store';
import { useTaskStore } from '../tasks/task-store';
import { useMissionStore } from '../missions/mission-store';
import { useSessionStore } from '../sessions/session-store';
import { useNoteStore } from '../notes/note-store';
import { getSessionMetrics } from '../sessions/session-helpers';
import { getMissionProgress } from '../missions/mission-helpers';
import { getNoteDisplayTitle } from '../notes/note-helpers';
import type { Task, TaskPriority } from '../tasks/task-types';
import type { MissionColor } from '../missions/mission-types';

type DashboardNavTarget = 'focus' | 'tasks' | 'missions' | 'insights' | 'today' | 'calendar' | 'journal' | 'notes';

interface DashboardViewProps {
  onNavigate: (view: DashboardNavTarget) => void;
  onOpenTask: (taskId: string) => void;
  onOpenMission: (missionId: string) => void;
  onNewTask: () => void;
  onNewMission: () => void;
}

const DAILY_QUOTES: { text: string; author: string }[] = [
  { text: 'Well begun is half done.', author: 'Aristotle' },
  { text: 'What gets measured gets managed.', author: 'Peter Drucker' },
  { text: 'Focus is saying no to a hundred good ideas.', author: 'Steve Jobs' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Amateurs sit and wait for inspiration; the rest of us just get up and go to work.', author: 'Stephen King' },
  { text: 'It is not enough to be busy. The question is: what are we busy about?', author: 'Henry David Thoreau' },
];

const PRIORITY_DOT: Record<TaskPriority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-accent',
  low: 'bg-slate-400',
};

const MISSION_FILL: Record<MissionColor, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-emerald-500',
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  gray: 'bg-slate-500',
};

function greeting(hour: number) {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Winding down';
}

function getDisplayName(metadata: Record<string, unknown> | undefined, email: string | undefined) {
  if (typeof metadata?.display_name === 'string' && metadata.display_name.trim()) {
    return metadata.display_name.trim().split(/\s+/)[0];
  }
  if (typeof metadata?.full_name === 'string' && metadata.full_name.trim()) {
    return metadata.full_name.trim().split(/\s+/)[0];
  }
  if (email) return email.split('@')[0];
  return 'Operator';
}

const localDateKey = getLocalDateKey;

function dayOfYear(date: Date) {
  return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
}

const PRIORITY_RANK: Record<TaskPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
const LANE_RANK: Record<string, number> = { now: 0, next: 1, inbox: 2, later: 3 };

function upNextRank(task: Task, todayKey: string) {
  const dueRank = task.due_date ? (task.due_date < todayKey ? 0 : task.due_date === todayKey ? 1 : 2) : 3;
  return dueRank * 100 + (LANE_RANK[task.lane] ?? 4) * 10 + PRIORITY_RANK[task.priority];
}

function StatTile({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-[22px] border border-borderSoft/30 bg-panel/25 p-4 text-left transition-all hover:border-accent/30 hover:bg-panel/45 sm:p-5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-2xl font-bold tabular-nums tracking-tight text-text-primary">{value}</span>
        <span className="block truncate text-[12px] font-medium text-text-muted">
          {label}
          {hint ? <span className="text-text-muted/60"> · {hint}</span> : null}
        </span>
      </span>
    </button>
  );
}

function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.28em] text-text-muted">{title}</h2>
      <button
        type="button"
        onClick={onAction}
        className="flex items-center gap-1 text-[12px] font-medium text-text-secondary/70 transition-colors hover:text-accent"
      >
        {actionLabel}
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

export function DashboardView({ onNavigate, onOpenTask, onOpenMission, onNewTask, onNewMission }: DashboardViewProps) {
  const session = useAuthStore((state) => state.session);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const tasks = useTaskStore((state) => state.tasks);
  const missions = useMissionStore((state) => state.missions);
  const sessions = useSessionStore((state) => state.sessions);
  const notes = useNoteStore((state) => state.notes);
  const refreshNotes = useNoteStore((state) => state.refresh);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    void refreshNotes(true);
  }, [refreshNotes]);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const todayKey = localDateKey(now);
  const name = getDisplayName(session?.user?.user_metadata, session?.user?.email);
  const quote = DAILY_QUOTES[dayOfYear(now) % DAILY_QUOTES.length];

  const missionTitles = useMemo(() => {
    const map: Record<string, { title: string; emoji: string }> = {};
    missions.forEach((mission) => {
      map[mission.id] = { title: mission.title, emoji: mission.emoji };
    });
    return map;
  }, [missions]);

  const focusSecondsToday = useMemo(
    () =>
      sessions
        .filter((s) => localDateKey(new Date(s.started_at)) === todayKey)
        .reduce((sum, s) => sum + getSessionMetrics(s, nowMs).focus_seconds, 0),
    [sessions, todayKey, nowMs],
  );

  const doneToday = useMemo(
    () => tasks.filter((t) => t.completed_at && localDateKey(new Date(t.completed_at)) === todayKey).length,
    [tasks, todayKey],
  );

  const openTasks = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);
  const overdueCount = useMemo(
    () => openTasks.filter((t) => t.due_date && t.due_date < todayKey).length,
    [openTasks, todayKey],
  );
  const dueTodayCount = useMemo(
    () => openTasks.filter((t) => t.due_date === todayKey).length,
    [openTasks, todayKey],
  );

  const activeMissions = useMemo(() => missions.filter((m) => m.status === 'active'), [missions]);

  const upNext = useMemo(
    () =>
      [...openTasks]
        .sort((a, b) => upNextRank(a, todayKey) - upNextRank(b, todayKey))
        .slice(0, 5),
    [openTasks, todayKey],
  );

  const topMissions = useMemo(
    () =>
      [...activeMissions]
        .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || a.sort_order - b.sort_order)
        .slice(0, 3)
        .map((mission) => {
          const missionTasks = tasks.filter((t) => t.mission_id === mission.id);
          const completed = missionTasks.filter((t) => t.status === 'done').length;
          return { mission, completed, total: missionTasks.length, progress: getMissionProgress(completed, missionTasks.length) };
        }),
    [activeMissions, tasks],
  );

  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        .slice(0, 3),
    [notes],
  );

  const monthActivity = useMemo(() => {
    const month = now.getMonth();
    const year = now.getFullYear();
    const inMonth = (value: string | null) => {
      if (!value) return false;
      const date = new Date(value);
      return date.getMonth() === month && date.getFullYear() === year;
    };
    const taskCount = tasks.filter((task) => inMonth(task.completed_at)).length;
    const focusCount = sessions.filter((workSession) => inMonth(workSession.started_at)).length;
    const noteCount = notes.filter((note) => inMonth(note.created_at)).length;
    return { total: taskCount + focusCount + noteCount, taskCount, focusCount, noteCount };
  }, [notes, now, sessions, tasks]);

  const recentCalendarDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = localDateKey(date);
    const count = tasks.filter((task) => task.completed_at && localDateKey(new Date(task.completed_at)) === key).length
      + sessions.filter((workSession) => localDateKey(new Date(workSession.started_at)) === key).length
      + notes.filter((note) => localDateKey(new Date(note.created_at)) === key).length;
    return { key, count, label: date.toLocaleDateString(undefined, { weekday: 'narrow' }), day: date.getDate() };
  }), [notes, now, sessions, tasks]);

  const dateLine = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const stagger = (index: number) => sharedStagger(index, reduceMotion);

  return (
    <div className="w-full min-w-0 space-y-4 overflow-hidden pb-4 sm:space-y-5 sm:pb-0">
      {/* Header: greeting + date + quick actions */}
      <motion.div {...stagger(0)}>
        <Card className="relative overflow-hidden rounded-[28px] border border-borderSoft/30 p-5 shadow-panel sm:p-6">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent/10 via-accent/75 to-accent/10" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-medium uppercase tracking-[0.28em] text-text-muted">{dateLine}</p>
              <h1 className="mt-1.5 truncate text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                {greeting(now.getHours())}, {name}
              </h1>
              <p className="mt-2 text-sm text-text-secondary/80">
                {focusSecondsToday > 0
                  ? `${formatMinutes(Math.round(focusSecondsToday / 60))} of focus so far today`
                  : 'No focus sessions yet today'}
                {overdueCount + dueTodayCount > 0
                  ? ` · ${overdueCount + dueTodayCount} task${overdueCount + dueTodayCount === 1 ? '' : 's'} need${overdueCount + dueTodayCount === 1 ? 's' : ''} attention`
                  : doneToday > 0
                    ? ` · ${doneToday} done — keep it going`
                    : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button onClick={() => onNavigate('focus')} type="button" size="md" className="font-medium">
                <Timer className="h-4 w-4" />
                Start focus
              </Button>
              <Button onClick={onNewTask} type="button" size="md" variant="secondary" className="font-medium">
                <Plus className="h-4 w-4" />
                Task
              </Button>
              <Button onClick={onNewMission} type="button" size="md" variant="secondary" className="font-medium">
                <Flag className="h-4 w-4" />
                Mission
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Lumi — the Intent Sprite. Where momentum stands right now, and what small action keeps it alive. */}
      <LumiHeroCard index={1} />

      {/* Stat tiles */}
      <motion.div {...stagger(2)} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<Timer className="h-5 w-5" />}
          label="Focus today"
          value={focusSecondsToday > 0 ? formatMinutes(Math.round(focusSecondsToday / 60)) : '0m'}
          onClick={() => onNavigate('insights')}
        />
        <StatTile
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Done today"
          value={String(doneToday)}
          onClick={() => onNavigate('tasks')}
        />
        <StatTile
          icon={<CalendarClock className="h-5 w-5" />}
          label="Due today"
          value={String(dueTodayCount)}
          hint={overdueCount > 0 ? `${overdueCount} overdue` : undefined}
          onClick={() => onNavigate('today')}
        />
        <StatTile
          icon={<Flag className="h-5 w-5" />}
          label="Active missions"
          value={String(activeMissions.length)}
          onClick={() => onNavigate('missions')}
        />
      </motion.div>

      {/* Calendar discovery */}
      <motion.button
        {...stagger(3)}
        type="button"
        onClick={() => onNavigate('calendar')}
        className="group relative w-full overflow-hidden rounded-[24px] border border-accent/20 bg-gradient-to-r from-accent/10 via-panel/45 to-panel/25 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[0_14px_36px_rgba(var(--accent),0.10)] sm:p-5"
      >
        <div aria-hidden className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-accent/12 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-accent/25 bg-accent/12 text-accent">
              <CalendarDays className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/80">New · Your month in context</span>
              <span className="mt-1 block text-[16px] font-semibold tracking-tight text-text-primary">
                {monthActivity.total > 0 ? `${monthActivity.total} moments are already shaping your story` : 'What will this month remember?'}
              </span>
              <span className="mt-0.5 block text-[11px] text-text-muted">Open any day to revisit the exact tasks, focus, notes, and reflections.</span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <span className="flex items-end gap-1.5 rounded-[14px] border border-borderSoft/20 bg-panel/35 px-3 py-2">
              {recentCalendarDays.map((day) => (
                <span key={day.key} className="flex flex-col items-center gap-1">
                  <span className="flex h-5 items-end"><i className={cn('w-1.5 rounded-full transition-all', day.count > 0 ? 'bg-accent' : 'bg-borderSoft/35')} style={{ height: `${Math.max(3, Math.min(20, day.count * 5))}px` }} /></span>
                  <span className="text-[8px] text-text-muted/65">{day.label}</span>
                </span>
              ))}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-accent">
              See your month
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </motion.button>

      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* Up next */}
        <motion.div className="min-w-0" {...stagger(4)}>
          <Card className="h-full min-w-0 overflow-hidden rounded-[22px] border border-borderSoft/30 p-4 shadow-panel sm:rounded-[26px] sm:p-6">
            <SectionHeader title="Up next" actionLabel="All tasks" onAction={() => onNavigate('tasks')} />
            {upNext.length > 0 ? (
              <div className="space-y-1.5">
                {upNext.map((task) => {
                  const mission = task.mission_id ? missionTitles[task.mission_id] : null;
                  const isOverdue = Boolean(task.due_date && task.due_date < todayKey);
                  const isDueToday = task.due_date === todayKey;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onOpenTask(task.id)}
                      className="group flex w-full min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-[16px] border border-transparent px-2 py-2.5 text-left transition-colors hover:border-borderSoft/30 hover:bg-panel/40 sm:px-3"
                    >
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[task.priority])} />
                      <span className="min-w-0 flex-1">
                        <span className="block max-w-full truncate text-[14px] font-medium text-text-primary" title={task.title}>{task.title}</span>
                        {(mission || task.next_action.trim()) && (
                          <span className="block truncate text-[12px] text-text-muted/70">
                            {mission ? `${mission.emoji} ${mission.title}` : task.next_action}
                          </span>
                        )}
                      </span>
                      {(isOverdue || isDueToday) && (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            isOverdue ? 'bg-red-500/12 text-red-500 dark:text-red-300' : 'bg-accent/12 text-accent',
                          )}
                        >
                          {isOverdue ? 'Overdue' : 'Today'}
                        </span>
                      )}
                      {task.estimated_minutes > 0 && (
                        <span className="shrink-0 text-[11px] tabular-nums text-text-muted/60">
                          {formatMinutes(task.estimated_minutes)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-[18px] border border-dashed border-borderSoft/30 bg-panel/15 px-4 py-6">
                <p className="text-sm text-text-secondary/70">Nothing queued. Capture what's on your mind.</p>
                <Button onClick={onNewTask} size="sm" type="button" variant="secondary" className="text-[13px] font-medium">
                  <Plus className="h-4 w-4" />
                  New task
                </Button>
              </div>
            )}
          </Card>
        </motion.div>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Missions */}
          <motion.div className="min-w-0" {...stagger(5)}>
            <Card className="min-w-0 overflow-hidden rounded-[22px] border border-borderSoft/30 p-4 shadow-panel sm:rounded-[26px] sm:p-6">
              <SectionHeader title="Missions" actionLabel="All missions" onAction={() => onNavigate('missions')} />
              {topMissions.length > 0 ? (
                <div className="space-y-4">
                  {topMissions.map(({ mission, completed, total, progress }) => (
                    <button
                      key={mission.id}
                      type="button"
                      onClick={() => onOpenMission(mission.id)}
                      className="block w-full min-w-0 overflow-hidden text-left"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-borderSoft/25 bg-panel2/45 text-text-secondary">
                            <MissionIcon icon={mission.emoji} className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate text-[13px] font-medium text-text-primary">{mission.title}</span>
                          {mission.is_pinned && <Pin className="h-3 w-3 shrink-0 fill-current text-accent" />}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-text-muted/70">
                          {total > 0 ? `${completed}/${total}` : 'No tasks'}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full border border-borderSoft/15 bg-text-primary/8">
                        <div
                          className={cn('h-full rounded-full transition-all', MISSION_FILL[mission.color] ?? 'bg-accent')}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3 rounded-[18px] border border-dashed border-borderSoft/30 bg-panel/15 px-4 py-5">
                  <p className="text-sm text-text-secondary/70">No active missions. Set a larger goal to aim at.</p>
                  <Button onClick={onNewMission} size="sm" type="button" variant="secondary" className="text-[13px] font-medium">
                    <Flag className="h-4 w-4" />
                    New mission
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Recent notes */}
          <motion.div {...stagger(6)}>
            <Card className="rounded-[26px] border border-borderSoft/30 p-5 shadow-panel sm:p-6">
              <SectionHeader title="Recent notes" actionLabel="All notes" onAction={() => onNavigate('notes')} />
              {recentNotes.length > 0 ? (
                <div className="space-y-1.5">
                  {recentNotes.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => onNavigate('notes')}
                      className="flex w-full items-center gap-3 rounded-[14px] border border-transparent px-3 py-2 text-left transition-colors hover:border-borderSoft/30 hover:bg-panel/40"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-text-muted/50" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-primary">
                        {getNoteDisplayTitle(note)}
                      </span>
                      {note.pinned && <Pin className="h-3 w-3 shrink-0 fill-current text-accent" />}
                      <span className="shrink-0 text-[11px] text-text-muted/60">{formatRelativeTime(note.updated_at)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-[18px] border border-dashed border-borderSoft/30 bg-panel/15 px-4 py-5 text-sm text-text-secondary/70">
                  No notes yet. Ideas, snippets, and references will show up here.
                </p>
              )}
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Daily quote */}
      <motion.div {...stagger(7)}>
        <div className="flex items-center gap-3 px-2 py-1">
          <Quote className="h-3.5 w-3.5 shrink-0 text-accent/60" />
          <p className="text-[13px] text-text-secondary/70">
            “{quote.text}” <span className="text-text-muted/60">— {quote.author}</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
