import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Plus,
  Edit2,
  Eye,
  Frown,
  Meh,
  Smile,
  Laugh,
  BookOpenCheck,
  Sun,
  Telescope,
  AlertCircle,
  Lightbulb,
  Heart,
  Calendar,
  Zap,
} from 'lucide-react';
import { DatePicker } from '../../components/ui/date-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Textarea } from '../../components/ui/input';
import { SaveStatus } from '../../components/ui/save-status';
import { useAutoSave, type AutoSaveStatus } from '../../hooks/use-autosave';
import { useRefreshOnFocus } from '../../hooks/use-refresh-on-focus';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../lib/date';
import { useJournalStore } from './journal-store';
import { useMissionStore } from '../missions/mission-store';
import { toLocalDateString } from './journal-helpers';
import type { JournalEntry, JournalEntryKind } from './journal-types';
import { confirmDialog } from '../../components/ui/native-dialog';

function useDebouncedCallback<T extends (...args: any[]) => any>(callback: T, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );
}

const KIND_CONFIG: Record<
  JournalEntryKind,
  {
    label: string;
    prompt: string;
    subtext: string;
    icon: typeof Sun;
    tone: 'success' | 'accent' | 'warning' | 'purple';
    gradient: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    accentColor: string;
  }
> = {
  best_moment: {
    label: 'Best Moments',
    prompt: 'What went well today?',
    subtext: 'Wins, breakthroughs, or things that brought energy',
    icon: Sun,
    tone: 'success',
    gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    border: 'border-emerald-500/25 hover:border-emerald-500/45',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    accentColor: 'text-emerald-500',
  },
  manifestation: {
    label: 'Manifestations',
    prompt: 'What are you calling in?',
    subtext: 'Intended outcomes, future milestones, or visions',
    icon: Telescope,
    tone: 'accent',
    gradient: 'from-sky-500/10 via-blue-500/5 to-transparent',
    border: 'border-sky-500/25 hover:border-sky-500/45',
    badgeBg: 'bg-sky-500/15 border-sky-500/30',
    badgeText: 'text-sky-600 dark:text-sky-400',
    accentColor: 'text-sky-500',
  },
  regret: {
    label: 'Regrets & Friction',
    prompt: 'What would you do differently?',
    subtext: 'Missed opportunities, friction points, or hesitations',
    icon: AlertCircle,
    tone: 'warning',
    gradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
    border: 'border-amber-500/25 hover:border-amber-500/45',
    badgeBg: 'bg-amber-500/15 border-amber-500/30',
    badgeText: 'text-amber-600 dark:text-amber-400',
    accentColor: 'text-amber-500',
  },
  lesson: {
    label: 'Lessons & Insights',
    prompt: 'What did you learn?',
    subtext: 'Principles, mental models, and personal wisdom',
    icon: Lightbulb,
    tone: 'purple',
    gradient: 'from-purple-500/10 via-indigo-500/5 to-transparent',
    border: 'border-purple-500/25 hover:border-purple-500/45',
    badgeBg: 'bg-purple-500/15 border-purple-500/30',
    badgeText: 'text-purple-600 dark:text-purple-400',
    accentColor: 'text-purple-500',
  },
};

const MOODS = [
  {
    value: 1,
    label: 'Struggling',
    emoji: '😫',
    icon: Frown,
    activeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-rose-500/30',
    hoverClass: 'hover:border-rose-500/30 hover:bg-rose-500/10',
  },
  {
    value: 2,
    label: 'Low',
    emoji: '😕',
    icon: Meh,
    activeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-amber-500/30',
    hoverClass: 'hover:border-amber-500/30 hover:bg-amber-500/10',
  },
  {
    value: 3,
    label: 'Okay',
    emoji: '😐',
    icon: Meh,
    activeClass: 'border-slate-500/40 bg-slate-500/15 text-text-primary shadow-sm ring-1 ring-slate-500/30',
    hoverClass: 'hover:border-slate-500/30 hover:bg-slate-500/10',
  },
  {
    value: 4,
    label: 'Good',
    emoji: '🙂',
    icon: Smile,
    activeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/30',
    hoverClass: 'hover:border-emerald-500/30 hover:bg-emerald-500/10',
  },
  {
    value: 5,
    label: 'Great',
    emoji: '😄',
    icon: Laugh,
    activeClass: 'border-sky-500/40 bg-sky-500/15 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-sky-500/30',
    hoverClass: 'hover:border-sky-500/30 hover:bg-sky-500/10',
  },
];

function getMoodLabel(mood: number): string {
  const item = MOODS.find((m) => m.value === mood);
  return item ? `${item.emoji} ${item.label}` : 'Unset';
}

function JournalEntryItem({
  entry,
  linkedRegretContent,
  missionTitle,
  onDelete,
  onTurnIntoLesson,
  onEdit,
  focused = false,
}: {
  entry: JournalEntry;
  linkedRegretContent: string | null;
  missionTitle: string | null;
  onDelete: (id: string) => void;
  onTurnIntoLesson: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry) => void;
  focused?: boolean;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) return;
    setIsExpanded(true);
    itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focused]);

  const meta = KIND_CONFIG[entry.kind];
  const Icon = meta.icon;

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-borderSoft/40 bg-panel/75 p-4 sm:p-5 transition-all hover:border-borderSoft/70 hover:shadow-md',
        focused && 'ring-2 ring-accent/40 shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2.5">
            <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border', meta.badgeBg, meta.badgeText)}>
              <Icon className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm sm:text-[15px] font-medium leading-relaxed text-text-primary', !isExpanded && 'line-clamp-3')}>
                {entry.content}
              </p>
              {entry.content.length > 150 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1.5 text-xs font-semibold text-accent hover:underline"
                  type="button"
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          </div>

          {linkedRegretContent && (
            <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Lesson learned from:</p>
              <p className="mt-0.5 text-xs italic text-text-secondary">{linkedRegretContent}</p>
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {missionTitle && (
              <Badge tone="neutral" className="border-borderSoft/40 bg-panel2/60 text-[10px] font-semibold">
                {missionTitle}
              </Badge>
            )}
            <span className="text-[11px] font-medium text-text-muted">{formatRelativeTime(entry.created_at)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-panel2 hover:text-text-primary transition-colors"
            onClick={() => onEdit(entry)}
            title="Edit entry"
            type="button"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {entry.kind === 'regret' && (
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-500/15 transition-colors"
              onClick={() => onTurnIntoLesson(entry)}
              title="Turn into a lesson"
              type="button"
            >
              <BookOpenCheck className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            disabled={isDeleting}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger transition-colors disabled:opacity-50"
            onClick={async () => {
              setIsDeleting(true);
              try {
                await onDelete(entry.id);
              } finally {
                setIsDeleting(false);
              }
            }}
            title="Delete entry"
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function JournalEntryModal({
  mode,
  kind,
  initialContent = '',
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  kind: JournalEntryKind;
  initialContent?: string;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
}) {
  const meta = KIND_CONFIG[kind];
  const Icon = meta.icon;
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && !saving;

  const { status: autoSaveStatus, flush } = useAutoSave({
    data: trimmed,
    enabled: mode === 'edit' && trimmed.length > 0,
    onSave: onSubmit,
  });

  const handleSubmit = useCallback(async () => {
    if (trimmed.length === 0 || saving) return;
    setSaving(true);
    try {
      if (mode === 'edit') {
        await flush();
      } else {
        await onSubmit(trimmed);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }, [trimmed, mode, flush, saving, onSubmit, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSubmit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, handleSubmit]);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-borderSoft/40 bg-panel shadow-2xl sm:rounded-[28px]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-borderSoft/30 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', meta.badgeBg, meta.badgeText)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{mode === 'create' ? 'New reflection' : 'Editing entry'}</p>
              <h2 className="truncate text-base font-bold text-text-primary">{meta.label}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-panel2 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-6 py-5">
          <Textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={meta.prompt}
            rows={5}
            className="min-h-[140px] resize-none rounded-xl border-borderSoft/40 bg-panel2/40 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:bg-panel2/70"
          />
          <div className="flex items-center justify-between px-1 text-xs text-text-muted">
            <p>{mode === 'edit' ? 'Autosaves automatically' : '⌘ + Enter to save'}</p>
            <p className={cn('tabular-nums', trimmed.length === 0 ? 'text-text-muted' : 'text-text-secondary')}>
              {content.length} characters
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-borderSoft/30 bg-panel2/30 px-6 py-4">
          <SaveStatus status={autoSaveStatus} />
          <div className="flex items-center gap-2">
            <Button onClick={onClose} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={!canSubmit} onClick={handleSubmit} size="sm" type="button" className="min-w-[100px] font-semibold">
              {saving ? 'Saving…' : mode === 'create' ? 'Add entry' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function JournalEntrySection({
  kind,
  entries,
  selectedDate,
  onAddEntry,
  onDeleteEntry,
  onTurnIntoLesson,
  missions,
  entriesById,
  focusedEntryId,
}: {
  kind: JournalEntryKind;
  entries: JournalEntry[];
  selectedDate: string;
  onAddEntry: (kind: JournalEntryKind, content: string) => void;
  onDeleteEntry: (id: string) => void;
  onTurnIntoLesson: (entry: JournalEntry) => void;
  missions: Record<string, string>;
  entriesById: Map<string, JournalEntry>;
  focusedEntryId?: string | null;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const updateEntry = useJournalStore((state) => state.updateEntry);

  const meta = KIND_CONFIG[kind];
  const Icon = meta.icon;
  const sectionEntries = entries.filter((e) => e.kind === kind && e.entry_date === selectedDate);

  return (
    <div>
      <Card className={cn('relative overflow-hidden rounded-[24px] border bg-panel/60 p-5 sm:p-6 transition-all shadow-sm', meta.border)}>
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60', meta.gradient)} />

        <div className="relative mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border shadow-xs', meta.badgeBg, meta.badgeText)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-text-primary">{meta.label}</h3>
                {sectionEntries.length > 0 && (
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold border', meta.badgeBg, meta.badgeText)}>
                    {sectionEntries.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">{meta.subtext}</p>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsAdding(true)}
            className="h-8 rounded-full border border-borderSoft/40 bg-panel px-3 text-xs font-semibold text-text-secondary hover:border-accent/40 hover:bg-accent/10 hover:text-accent transition-all"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>

        <div className="relative space-y-3">
          <AnimatePresence>
            {sectionEntries.map((entry) => {
              const linkedRegret = entry.linked_entry_id ? entriesById.get(entry.linked_entry_id) : null;
              const missionTitle = entry.mission_id ? missions[entry.mission_id] : null;
              return (
                <JournalEntryItem
                  key={entry.id}
                  entry={entry}
                  linkedRegretContent={linkedRegret?.content ?? null}
                  missionTitle={missionTitle}
                  onDelete={onDeleteEntry}
                  onTurnIntoLesson={onTurnIntoLesson}
                  onEdit={(e) => setEditingEntry(e)}
                  focused={entry.id === focusedEntryId}
                />
              );
            })}
          </AnimatePresence>

          {sectionEntries.length === 0 && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="group flex w-full items-center justify-between rounded-2xl border border-dashed border-borderSoft/50 bg-panel2/25 px-4 py-4 text-left transition-all hover:border-accent/40 hover:bg-accent/5"
            >
              <span className="text-xs font-medium text-text-muted group-hover:text-text-secondary transition-colors">
                {meta.prompt}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-borderSoft/40 bg-panel text-text-muted shadow-xs transition-colors group-hover:border-accent/40 group-hover:bg-accent group-hover:text-[rgb(var(--accent-contrast))]">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </button>
          )}
        </div>

        <AnimatePresence>
          {isAdding && (
            <JournalEntryModal
              mode="create"
              kind={kind}
              onClose={() => setIsAdding(false)}
              onSubmit={async (content) => {
                await onAddEntry(kind, content);
              }}
            />
          )}
          {editingEntry && (
            <JournalEntryModal
              mode="edit"
              kind={editingEntry.kind}
              initialContent={editingEntry.content}
              onClose={() => setEditingEntry(null)}
              onSubmit={async (content) => {
                await updateEntry({ ...editingEntry, content, updated_at: new Date().toISOString() });
              }}
            />
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

function MoodSelector({ mood, onChange }: { mood: number; onChange: (m: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="grid min-w-0 flex-1 grid-cols-5 gap-1.5 sm:gap-2">
        {MOODS.map(({ value, label, emoji, activeClass, hoverClass }) => {
          const isSelected = mood === value;
          return (
            <button
              key={value}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-xl border py-2 px-1 text-center transition-all duration-150',
                isSelected
                  ? activeClass
                  : cn('border-borderSoft/35 bg-panel text-text-muted hover:text-text-primary', hoverClass),
              )}
              onClick={() => onChange(value)}
              type="button"
              title={label}
            >
              <span className="text-lg sm:text-xl leading-none">{emoji}</span>
              <span className="text-[10px] sm:text-[11px] font-semibold truncate w-full px-0.5">{label}</span>
            </button>
          );
        })}
      </div>
      {mood > 0 && (
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-borderSoft/35 bg-panel text-text-muted hover:border-danger/40 hover:bg-danger/10 hover:text-danger transition-colors"
          onClick={() => onChange(0)}
          type="button"
          title="Clear mood"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function DateStepper({ selectedDate, onDateChange }: { selectedDate: string; onDateChange: (d: string) => void }) {
  const today = toLocalDateString(new Date());
  const isToday = selectedDate === today;

  const goToPreviousDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    onDateChange(toLocalDateString(d));
  };
  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    onDateChange(toLocalDateString(d));
  };

  const formattedDate = useMemo(() => {
    const d = new Date(selectedDate);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }, [selectedDate]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-accent" />
          Daily Reflection
        </span>
        {!isToday && (
          <button
            onClick={() => onDateChange(today)}
            className="rounded-full bg-accent/15 border border-accent/30 px-2.5 py-0.5 text-[10px] font-bold text-accent hover:bg-accent/25 transition-colors"
            type="button"
          >
            Go to today
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          aria-label="Previous day"
          onClick={goToPreviousDay}
          size="sm"
          type="button"
          variant="ghost"
          className="h-9 w-9 shrink-0 rounded-xl border border-borderSoft/35 bg-panel p-0 hover:bg-panel2"
        >
          <ChevronLeft className="h-4 w-4 text-text-secondary" />
        </Button>

        <div className="min-w-0 flex-1">
          <DatePicker onChange={(value) => value && onDateChange(value)} placeholder="Pick date" value={selectedDate} />
        </div>

        <Button
          aria-label="Next day"
          onClick={goToNextDay}
          size="sm"
          type="button"
          variant="ghost"
          className="h-9 w-9 shrink-0 rounded-xl border border-borderSoft/35 bg-panel p-0 hover:bg-panel2"
        >
          <ChevronRight className="h-4 w-4 text-text-secondary" />
        </Button>
      </div>

      <p className="text-xs font-semibold text-text-secondary px-1">
        {formattedDate} {isToday ? <span className="text-accent font-bold">(Today)</span> : null}
      </p>
    </div>
  );
}

export function JournalView({ focusedEntryId = null }: { focusedEntryId?: string | null }) {
  const entries = useJournalStore((state) => state.entries);
  const days = useJournalStore((state) => state.days);
  const selectedDate = useJournalStore((state) => state.selectedDate);
  const selectDate = useJournalStore((state) => state.selectDate);
  const createEntry = useJournalStore((state) => state.createEntry);
  const deleteEntry = useJournalStore((state) => state.deleteEntry);
  const saveDay = useJournalStore((state) => state.saveDay);
  const loading = useJournalStore((state) => state.loading);
  const error = useJournalStore((state) => state.error);
  const refresh = useJournalStore((state) => state.refresh);

  const [gratitudeInput, setGratitudeInput] = useState('');
  const [operationError, setOperationError] = useState<string | null>(null);
  const [dayStatus, setDayStatus] = useState<AutoSaveStatus>('idle');
  const dayStatusResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDayDirty = useCallback(() => {
    if (dayStatusResetRef.current) clearTimeout(dayStatusResetRef.current);
    setDayStatus('dirty');
  }, []);

  useEffect(() => () => {
    if (dayStatusResetRef.current) clearTimeout(dayStatusResetRef.current);
  }, []);

  const missions = useMemo(() => {
    const map: Record<string, string> = {};
    useMissionStore.getState().missions.forEach((m) => {
      map[m.id] = m.title;
    });
    return map;
  }, []);

  const entriesById = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    entries.forEach((e) => map.set(e.id, e));
    return map;
  }, [entries]);

  const todayDay = days.find((d) => d.entry_date === selectedDate);

  useEffect(() => {
    setGratitudeInput(todayDay?.gratitude ?? '');
  }, [todayDay?.entry_date]);

  useRefreshOnFocus(refresh);

  const handleAddEntry = async (kind: JournalEntryKind, content: string) => {
    try {
      setOperationError(null);
      await createEntry({ kind, content, entry_date: selectedDate });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create entry';
      setOperationError(message);
    }
  };

  const handleTurnIntoLesson = async (regretEntry: JournalEntry) => {
    try {
      setOperationError(null);
      await createEntry({
        kind: 'lesson',
        content: `Growth from: ${regretEntry.content}`,
        entry_date: selectedDate,
        linked_entry_id: regretEntry.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create lesson';
      setOperationError(message);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      setOperationError(null);
      if (await confirmDialog('Remove this journal entry?', { title: 'Remove entry', confirmLabel: 'Remove', danger: true })) {
        await deleteEntry(entryId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete entry';
      setOperationError(message);
    }
  };

  const handleSaveDay = useCallback(async (mood: number, gratitude: string) => {
    if (dayStatusResetRef.current) clearTimeout(dayStatusResetRef.current);
    setDayStatus('saving');
    try {
      await saveDay({
        entry_date: selectedDate,
        mood,
        gratitude,
        created_at: todayDay?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setDayStatus('saved');
      dayStatusResetRef.current = setTimeout(() => setDayStatus('idle'), 2500);
    } catch (error) {
      setDayStatus('error');
      setOperationError(error instanceof Error ? error.message : 'Failed to save reflection');
    }
  }, [selectedDate, todayDay?.created_at, saveDay]);

  const debouncedSaveGratitude = useDebouncedCallback(
    (gratitude: string) => {
      handleSaveDay(todayDay?.mood ?? 0, gratitude);
    },
    500,
  );

  const totalEntriesToday = entries.filter((e) => e.entry_date === selectedDate).length;

  return (
    <div className="space-y-6">
      {(error || operationError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-2xl border border-danger/30 bg-danger/10 p-4 flex items-start gap-3 text-danger"
        >
          <div className="flex-1 text-sm font-medium">{error || operationError}</div>
          <button onClick={() => setOperationError(null)} className="text-danger hover:opacity-80" type="button">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Top Banner Card: Date + Mood + Gratitude */}
      <Card className="relative overflow-hidden rounded-[26px] border border-borderSoft/40 bg-panel p-5 sm:p-6 shadow-sm bg-dots-glow">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        
        <div className="relative grid gap-5 lg:grid-cols-[minmax(260px,0.75fr)_minmax(420px,1.25fr)] lg:items-stretch">
          {/* Left: Date Stepper */}
          <div className="rounded-2xl border border-borderSoft/35 bg-panel2/35 p-4 sm:p-5 flex flex-col justify-between">
            <DateStepper onDateChange={selectDate} selectedDate={selectedDate} />
            <div className="mt-4 pt-3 border-t border-borderSoft/25 flex items-center justify-between text-xs text-text-muted">
              <span>Reflections today</span>
              <span className="font-bold text-text-primary rounded-full bg-panel px-2.5 py-0.5 border border-borderSoft/30">
                {totalEntriesToday} entries
              </span>
            </div>
          </div>

          {/* Right: Mood & Gratitude */}
          <div className="space-y-4 rounded-2xl border border-borderSoft/35 bg-panel2/35 p-4 sm:p-5">
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-accent" />
                  How are you feeling?
                </span>
                <div className="flex items-center gap-2">
                  <SaveStatus status={dayStatus} />
                  {todayDay?.mood ? (
                    <span className="text-xs font-semibold text-text-secondary">{getMoodLabel(todayDay.mood)}</span>
                  ) : null}
                </div>
              </div>
              <MoodSelector mood={todayDay?.mood ?? 0} onChange={(m) => handleSaveDay(m, gratitudeInput)} />
            </div>

            <div className="border-t border-borderSoft/25 pt-3.5">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-rose-500" />
                One thing I’m grateful for
              </span>
              <Input
                className="h-10.5 rounded-xl border-borderSoft/40 bg-panel text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50"
                onChange={(e) => {
                  setGratitudeInput(e.target.value);
                  markDayDirty();
                  debouncedSaveGratitude(e.target.value);
                }}
                placeholder="A person, moment, or small win…"
                value={gratitudeInput}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 4 Quadrants Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {(['best_moment', 'manifestation', 'regret', 'lesson'] as const).map((kind) => (
          <JournalEntrySection
            key={kind}
            entries={entries}
            entriesById={entriesById}
            kind={kind}
            missions={missions}
            onAddEntry={handleAddEntry}
            onDeleteEntry={handleDeleteEntry}
            onTurnIntoLesson={handleTurnIntoLesson}
            selectedDate={selectedDate}
            focusedEntryId={focusedEntryId}
          />
        ))}
      </div>
    </div>
  );
}
