import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookHeart,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  FileText,
  Flag,
  ArrowUpRight,
  Plus,
  PenLine,
  Timer,
  Target,
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { useTaskStore } from '../tasks/task-store';
import { useSessionStore } from '../sessions/session-store';
import { useJournalStore } from '../journal/journal-store';
import { useNoteStore } from '../notes/note-store';
import { useMissionStore } from '../missions/mission-store';
import { getSessionMetrics } from '../sessions/session-helpers';

type CalendarEvent = {
  id: string;
  type: 'task' | 'focus' | 'journal' | 'note' | 'mission';
  title: string;
  detail: string;
  date: string;
  time?: string;
  entityId?: string;
};

export type CalendarDestination = 'today' | 'tasks' | 'history' | 'journal' | 'notes' | 'missions';
export type CalendarOpenTarget = { destination: CalendarDestination; entityId?: string; date: string };

const typeMeta = {
  task: { label: 'Completed', icon: CheckCircle2, style: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500', color: 'text-emerald-500' },
  focus: { label: 'Focus', icon: Clock3, style: 'border-sky-500/20 bg-sky-500/10 text-sky-500', color: 'text-sky-500' },
  journal: { label: 'Journal', icon: BookHeart, style: 'border-rose-500/20 bg-rose-500/10 text-rose-500', color: 'text-rose-500' },
  note: { label: 'Note', icon: FileText, style: 'border-amber-500/20 bg-amber-500/10 text-amber-500', color: 'text-amber-500' },
  mission: { label: 'Mission', icon: Target, style: 'border-violet-500/20 bg-violet-500/10 text-violet-500', color: 'text-violet-500' },
} as const;

const calendarTypes = ['task', 'focus', 'note', 'journal', 'mission'] as const;
const legendLabels = { task: 'Tasks', focus: 'Focus', note: 'Notes', journal: 'Reflections', mission: 'Milestones' } as const;

function localDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function cleanText(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

const priorityDot = { critical: 'bg-rose-500', high: 'bg-orange-500', normal: 'bg-sky-500', low: 'bg-text-muted' } as const;
const priorityRank = { critical: 0, high: 1, normal: 2, low: 3 } as const;

export function CalendarView({ onOpenTarget }: { onOpenTarget: (target: CalendarOpenTarget) => void }) {
  const tasks = useTaskStore((state) => state.tasks);
  const sessions = useSessionStore((state) => state.sessions);
  const journalEntries = useJournalStore((state) => state.entries);
  const journalDays = useJournalStore((state) => state.days);
  const notes = useNoteStore((state) => state.notes);
  const missions = useMissionStore((state) => state.missions);
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(today));
  const [openEventGroup, setOpenEventGroup] = useState<CalendarEvent['type'] | null>(null);

  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];
    tasks.forEach((task) => {
      if (!task.completed_at) return;
      result.push({ id: `task-${task.id}`, entityId: task.id, type: 'task', title: task.title, detail: task.completion_note || task.outcome || 'Task completed', date: localDate(task.completed_at), time: timeLabel(task.completed_at) });
    });
    sessions.forEach((session) => {
      const minutes = Math.round(getSessionMetrics(session).focus_seconds / 60);
      result.push({ id: `session-${session.id}`, entityId: session.task_id, type: 'focus', title: session.task_title || 'Focus session', detail: `${minutes || session.planned_minutes} minutes focused`, date: localDate(session.started_at), time: timeLabel(session.started_at) });
    });
    journalEntries.forEach((entry) => result.push({ id: `journal-${entry.id}`, entityId: entry.id, type: 'journal', title: entry.kind.replace('_', ' '), detail: entry.content, date: entry.entry_date }));
    notes.forEach((note) => result.push({ id: `note-${note.id}`, entityId: note.id, type: 'note', title: note.title || 'Quick note', detail: cleanText(note.content), date: localDate(note.created_at), time: timeLabel(note.created_at) }));
    missions.forEach((mission) => {
      result.push({ id: `mission-start-${mission.id}`, entityId: mission.id, type: 'mission', title: mission.title, detail: 'Mission created', date: localDate(mission.created_at), time: timeLabel(mission.created_at) });
      if (mission.completed_at) result.push({ id: `mission-done-${mission.id}`, entityId: mission.id, type: 'mission', title: mission.title, detail: 'Mission completed', date: localDate(mission.completed_at), time: timeLabel(mission.completed_at) });
    });
    return result.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
  }, [journalEntries, missions, notes, sessions, tasks]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => map.set(event.date, [...(map.get(event.date) ?? []), event]));
    return map;
  }, [events]);

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const eventGroups = (['journal', 'task', 'focus', 'note', 'mission'] as const)
    .map((type) => ({ type, events: selectedEvents.filter((event) => event.type === type) }))
    .filter((group) => group.events.length > 0);

  useEffect(() => {
    setOpenEventGroup(eventGroups[0]?.type ?? null);
  }, [selectedDate]);
  const selectedDay = journalDays.find((day) => day.entry_date === selectedDate);
  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const focusMinutes = selectedEvents.filter((event) => event.type === 'focus').reduce((sum, event) => sum + Number.parseInt(event.detail, 10) || sum, 0);
  const completedCount = selectedEvents.filter((event) => event.type === 'task').length;
  const todayKey = dateKey(today);
  const dayOffset = Math.round((new Date(`${selectedDate}T00:00:00`).getTime() - new Date(`${todayKey}T00:00:00`).getTime()) / 86400000);
  const relativeLabel = dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : dayOffset === -1 ? 'Yesterday' : dayOffset > 0 ? `In ${dayOffset} days` : `${-dayOffset} days ago`;
  // Open work that lands on this day; today also carries anything already overdue.
  const plannedTasks = tasks
    .filter((task) => !task.completed_at && task.status !== 'done')
    .map((task) => ({ task, day: task.scheduled_for || task.due_date }))
    .filter(({ task, day }) => day === selectedDate || (dayOffset === 0 && !!task.due_date && task.due_date < todayKey))
    .map(({ task }) => ({ task, overdue: !!task.due_date && task.due_date < todayKey }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || priorityRank[a.task.priority] - priorityRank[b.task.priority]);
  const plannedMinutes = plannedTasks.reduce((sum, { task }) => sum + (task.estimated_minutes || 0), 0);
  const doneParts = [
    completedCount ? `closed ${plural(completedCount, 'task')}` : '',
    focusMinutes ? `focused for ${durationLabel(focusMinutes)}` : '',
    selectedEvents.some((event) => event.type === 'note') ? `wrote ${plural(selectedEvents.filter((event) => event.type === 'note').length, 'note')}` : '',
    selectedEvents.some((event) => event.type === 'journal') ? 'reflected' : '',
  ].filter(Boolean);
  const storyLine = doneParts.length
    ? `You ${doneParts.length > 1 ? `${doneParts.slice(0, -1).join(', ')} and ${doneParts[doneParts.length - 1]}` : doneParts[0]}.`
    : dayOffset > 0 ? (plannedTasks.length ? 'Here is what is lined up.' : 'Nothing planned yet — a free day.')
    : dayOffset === 0 ? (plannedTasks.length ? 'A fresh page. Here is what is waiting on you.' : 'A fresh page, and nothing is waiting on you.')
    : 'A quiet day — nothing was logged.';
  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const monthEvents = events.filter((event) => event.date.startsWith(monthPrefix));
  const activeDays = new Set(monthEvents.map((event) => event.date)).size;
  const monthCounts = {
    tasks: monthEvents.filter((event) => event.type === 'task').length,
    focus: monthEvents.filter((event) => event.type === 'focus').length,
    journal: monthEvents.filter((event) => event.type === 'journal').length,
    notes: monthEvents.filter((event) => event.type === 'note').length,
    missions: monthEvents.filter((event) => event.type === 'mission').length,
  };
  const monthTotal = monthEvents.length;
  const nearbyActiveDates = [...new Set(monthEvents.map((event) => event.date))]
    .filter((date) => date !== selectedDate)
    .sort((a, b) => Math.abs(new Date(`${a}T00:00:00`).getTime() - new Date(`${selectedDate}T00:00:00`).getTime()) - Math.abs(new Date(`${b}T00:00:00`).getTime() - new Date(`${selectedDate}T00:00:00`).getTime()))
    .slice(0, 3);

  const changeMonth = (offset: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const openEvent = (event: CalendarEvent) => {
    if (event.type === 'journal') useJournalStore.getState().selectDate(event.date);
    const destinations: Record<CalendarEvent['type'], CalendarDestination> = {
      task: 'tasks', focus: 'history', journal: 'journal', note: 'notes', mission: 'missions',
    };
    onOpenTarget({ destination: destinations[event.type], entityId: event.entityId, date: event.date });
  };

  return (
    <div className="calendar-shell grid min-h-full content-start items-start gap-4 rounded-[26px] border border-borderSoft/35 bg-panel2/30 p-3 min-[850px]:grid-cols-[minmax(430px,1.08fr)_minmax(340px,0.92fr)] sm:p-4">
      <Card className="calendar-panel h-fit rounded-[24px] border-borderSoft/45 bg-panel/80 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-semibold tracking-[-.04em] text-text-primary">{month.toLocaleDateString(undefined, { month: 'long' })} <span className="font-normal text-accent">{month.getFullYear()}</span></h2>
            <p className="mt-1.5 text-base text-text-secondary">{activeDays} active {activeDays === 1 ? 'day' : 'days'} · {monthEvents.length} moments</p>
          </div>
          <div className="flex items-center gap-2">
            <Button aria-label="Previous month" onClick={() => changeMonth(-1)} size="sm" type="button" variant="ghost" className="h-9 w-9 rounded-[10px] p-0"><ChevronLeft className="h-4 w-4" /></Button>
            <Button onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(dateKey(today)); }} size="sm" type="button" variant="secondary" className="h-9 rounded-[10px] px-3.5 text-xs">Today</Button>
            <Button aria-label="Next month" onClick={() => changeMonth(1)} size="sm" type="button" variant="ghost" className="h-9 w-9 rounded-[10px] p-0"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1.5 text-center">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => <div key={day} className={cn('pb-2 text-sm font-semibold uppercase tracking-[0.12em]', index >= 5 ? 'text-rose-500' : 'text-text-secondary')}>{day}</div>)}
          {calendarDays.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} />;
            const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
            const dayEvents = eventsByDate.get(key) ?? [];
            const selected = key === selectedDate;
            const isToday = key === dateKey(today);
            const isWeekend = index % 7 >= 5;
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedDate(key)}
                type="button"
                className={cn(
                  'relative flex min-h-[64px] flex-col items-start justify-between rounded-[12px] border p-2 transition-all sm:min-h-[78px]',
                  selected
                    ? 'border-accent/55 bg-accent/14 shadow-[inset_0_0_0_1px_rgba(var(--accent),0.10),0_7px_18px_rgba(var(--accent),0.10)]'
                    : isWeekend
                      ? 'border-rose-500/20 bg-rose-500/[.06] hover:border-rose-500/35 hover:bg-rose-500/10'
                    : dayEvents.length > 0
                      ? 'border-borderSoft/55 bg-panel2/70 hover:border-borderStrong/50 hover:bg-panel2/90'
                      : 'border-borderSoft/40 bg-panel2/55 hover:border-borderStrong/45 hover:bg-panel2/75',
                )}
              >
                <span className={cn('flex h-9 min-w-9 items-center justify-center rounded-[9px] px-1.5 text-xl font-semibold tracking-tight', isToday ? 'bg-accent text-[rgb(var(--accent-contrast))] shadow-sm' : selected ? 'bg-accent/14 text-accent' : isWeekend ? 'text-rose-500' : 'text-text-primary')}>{day}</span>
                <div className="flex min-h-4 w-full flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {calendarTypes.map((type) => {
                    const count = dayEvents.filter((event) => event.type === type).length;
                    if (!count) return null;
                    const Icon = typeMeta[type].icon;
                    return <span key={type} title={`${count} ${legendLabels[type].toLowerCase()}`} className={cn('flex items-center gap-0.5 text-[10px] font-semibold leading-none tabular-nums', typeMeta[type].color)}><Icon className="h-3.5 w-3.5" />{count > 1 ? <span className="hidden sm:inline">{count}</span> : null}</span>;
                  })}
                </div>
              </motion.button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-borderSoft/30 pt-3 text-sm text-text-secondary">
          {calendarTypes.map((type) => {
            const Icon = typeMeta[type].icon;
            return <span key={type} className="flex items-center gap-1.5"><Icon className={cn('h-4 w-4', typeMeta[type].color)} />{legendLabels[type]}</span>;
          })}
        </div>
      </Card>

      <div className="min-w-0 space-y-4">
        <Card className="calendar-panel rounded-[24px] border-borderSoft/45 bg-panel/80 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">{relativeLabel}</p><h3 className="mt-1 text-lg font-semibold tracking-tight text-text-primary">{selectedLabel}</h3></div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-accent/20 bg-accent/10 text-accent"><CalendarDays className="h-4 w-4" /></div>
          </div>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{storyLine}{selectedDay?.mood ? <span className="ml-2 inline-flex rounded-full border border-rose-500/20 bg-rose-500/8 px-2 py-0.5 text-[11px] font-medium text-rose-500">Mood {selectedDay.mood}/5</span> : null}</p>

          {plannedTasks.length > 0 ? (
            <div className="mt-4 rounded-[16px] border border-borderSoft/30 bg-panel2/45 p-2">
              <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">{dayOffset < 0 ? 'Still open' : 'On the plate'} · {plannedTasks.length}</p>
                {plannedMinutes ? <p className="text-xs text-text-muted">~{durationLabel(plannedMinutes)} of work</p> : null}
              </div>
              {plannedTasks.slice(0, 4).map(({ task, overdue }) => (
                <button key={task.id} type="button" onClick={() => onOpenTarget({ destination: 'tasks', entityId: task.id, date: selectedDate })} className="group flex w-full items-center gap-3 rounded-[11px] px-2 py-2 text-left transition-colors hover:bg-white/[0.035]">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', priorityDot[task.priority])} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{task.title}</span>
                  {overdue ? <span className="shrink-0 rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] font-semibold text-rose-500">Overdue</span> : task.due_date === selectedDate ? <span className="shrink-0 rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-500">Due</span> : null}
                  {task.estimated_minutes ? <span className="shrink-0 text-xs tabular-nums text-text-muted">{durationLabel(task.estimated_minutes)}</span> : null}
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
              {plannedTasks.length > 4 ? <button type="button" onClick={() => onOpenTarget({ destination: 'tasks', date: selectedDate })} className="w-full px-2 pb-1 pt-1.5 text-left text-xs font-medium text-accent">+{plannedTasks.length - 4} more in Tasks</button> : null}
            </div>
          ) : null}
          {selectedDay?.gratitude ? <div className="mt-3 rounded-[14px] border border-rose-500/15 bg-rose-500/6 px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-wider text-rose-500/80">Grateful for</p><p className="mt-1 text-[12px] leading-5 text-text-secondary">{selectedDay.gratitude}</p></div> : null}
        </Card>

        <Card className="calendar-panel relative overflow-hidden rounded-[24px] border-borderSoft/45 bg-panel/80 p-3 sm:p-4">
          {selectedEvents.length > 0 ? (
            <div className="space-y-2">
              {eventGroups.map((group) => {
                const meta = typeMeta[group.type];
                const Icon = meta.icon;
                const isOpen = openEventGroup === group.type;
                const groupLabel = group.type === 'focus' ? 'Focus sessions' : group.type === 'task' ? 'Completed tasks' : group.type === 'mission' ? 'Mission milestones' : group.type === 'journal' ? 'Journal reflections' : 'Notes';
                return (
                  <div key={group.type} className={cn('overflow-hidden rounded-[16px] border transition-colors', isOpen ? 'border-borderSoft/35 bg-panel2/28' : 'border-borderSoft/20 bg-panel2/12 hover:border-borderSoft/35')}>
                    <button type="button" onClick={() => setOpenEventGroup(isOpen ? null : group.type)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border', meta.style)}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-text-primary">{groupLabel}</span><span className="mt-0.5 block text-[10px] text-text-muted">{group.events.length} {group.events.length === 1 ? 'entry' : 'entries'}</span></span>
                      <ChevronDown className={cn('h-4 w-4 text-text-muted transition-transform duration-200', isOpen && 'rotate-180 text-accent')} />
                    </button>

                    {isOpen ? (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border-t border-borderSoft/18 px-3 py-3">
                        {group.events.map((event) => {
                          const destination = event.type === 'focus' ? 'History' : event.type === 'task' ? 'Tasks' : event.type === 'mission' ? 'Missions' : event.type === 'journal' ? 'Journal' : 'Notes';
                          return (
                            <button type="button" onClick={() => openEvent(event)} key={event.id} className="group flex w-full items-start gap-3 rounded-[14px] px-3 py-3 text-left transition-colors hover:bg-white/[0.035]">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-start gap-3"><span className="min-w-0 flex-1 break-words text-sm font-semibold capitalize leading-5 text-text-primary">{event.title}</span>{event.time ? <span className="ml-auto shrink-0 pt-0.5 text-[10px] text-text-secondary">{event.time}</span> : null}</span>
                                <span className="mt-1.5 block max-h-[60px] overflow-hidden text-[13px] leading-5 text-text-secondary">{event.detail}</span>
                                <span className="mt-2 flex items-center justify-end gap-1 text-[11px] font-medium text-accent/85 transition-colors group-hover:text-accent">Open in {destination}<ArrowUpRight className="h-3.5 w-3.5" /></span>
                              </span>
                            </button>
                          );
                        })}
                      </motion.div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-2 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-borderSoft/25 bg-panel2/30 text-text-muted"><Flag className="h-4 w-4" /></div>
                <div><p className="text-sm font-semibold text-text-primary">Nothing recorded yet</p><p className="mt-1 text-xs leading-5 text-text-secondary">Make this day memorable, or jump to a day that already has a story.</p></div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => onOpenTarget({ destination: 'tasks', date: selectedDate })} className="flex flex-col items-center gap-1.5 rounded-[13px] border border-borderSoft/40 bg-panel2/55 px-2 py-3 text-xs font-medium text-text-secondary transition-colors hover:border-accent/35 hover:bg-accent/8 hover:text-accent"><Plus className="h-4 w-4" />Add task</button>
                <button type="button" onClick={() => onOpenTarget({ destination: 'journal', date: selectedDate })} className="flex flex-col items-center gap-1.5 rounded-[13px] border border-borderSoft/40 bg-panel2/55 px-2 py-3 text-xs font-medium text-text-secondary transition-colors hover:border-accent/35 hover:bg-accent/8 hover:text-accent"><PenLine className="h-4 w-4" />Reflect</button>
                <button type="button" onClick={() => onOpenTarget({ destination: 'notes', date: selectedDate })} className="flex flex-col items-center gap-1.5 rounded-[13px] border border-borderSoft/40 bg-panel2/55 px-2 py-3 text-xs font-medium text-text-secondary transition-colors hover:border-accent/35 hover:bg-accent/8 hover:text-accent"><FileText className="h-4 w-4" />Add note</button>
              </div>

              {nearbyActiveDates.length > 0 ? (
                <div className="mt-4 border-t border-borderSoft/18 pt-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-text-muted/60">Days with a story</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nearbyActiveDates.map((date) => (
                      <button key={date} type="button" onClick={() => setSelectedDate(date)} className="rounded-full border border-borderSoft/25 bg-panel2/25 px-3 py-1.5 text-[10px] font-medium text-text-secondary transition-colors hover:border-accent/30 hover:text-accent">
                        {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {eventsByDate.get(date)?.length ?? 0}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      <Card className="calendar-panel rounded-[24px] border-borderSoft/45 bg-panel/75 p-4 min-[850px]:col-span-2 sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary">Month at a glance</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-[-.03em] text-text-primary">Your {month.toLocaleDateString(undefined, { month: 'long' })} <span className="font-normal text-accent">footprint</span></p>
            <p className="mt-1 text-sm text-text-secondary">{monthTotal} {monthTotal === 1 ? 'moment' : 'moments'} across {activeDays} active {activeDays === 1 ? 'day' : 'days'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:min-w-[640px]">
            {[
              { label: 'Done', value: monthCounts.tasks, color: 'text-emerald-500', tint: 'border-emerald-500/25 bg-emerald-500/[.07]', bar: 'bg-emerald-500', icon: CheckCircle2 },
              { label: 'Focus', value: monthCounts.focus, color: 'text-sky-500', tint: 'border-sky-500/25 bg-sky-500/[.07]', bar: 'bg-sky-500', icon: Timer },
              { label: 'Reflections', value: monthCounts.journal, color: 'text-rose-500', tint: 'border-rose-500/25 bg-rose-500/[.07]', bar: 'bg-rose-500', icon: BookHeart },
              { label: 'Notes', value: monthCounts.notes, color: 'text-amber-500', tint: 'border-amber-500/25 bg-amber-500/[.07]', bar: 'bg-amber-500', icon: FileText },
              { label: 'Milestones', value: monthCounts.missions, color: 'text-violet-500', tint: 'border-violet-500/25 bg-violet-500/[.07]', bar: 'bg-violet-500', icon: Target },
            ].map(({ label, value, color, tint, bar, icon: Icon }) => (
              <div key={label} className={cn('rounded-[16px] border p-3.5 transition-opacity', value > 0 ? tint : 'border-borderSoft/30 bg-panel2/40 opacity-60')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-text-secondary">{label}</p>
                  <Icon className={cn('h-4 w-4 shrink-0', color)} />
                </div>
                <p className={cn('mt-2 text-3xl font-semibold tabular-nums tracking-tight', value > 0 ? color : 'text-text-muted')}>{value}</p>
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-text-primary/[.06]"><div className={cn('h-full rounded-full', bar)} style={{ width: `${monthTotal ? (value / monthTotal) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
