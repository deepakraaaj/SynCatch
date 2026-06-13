import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Trash2, X, Plus, Edit2, Eye } from 'lucide-react';
import { DatePicker } from '../../components/ui/date-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Textarea } from '../../components/ui/input';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../lib/date';
import { useJournalStore } from './journal-store';
import { useMissionStore } from '../missions/mission-store';
import { JOURNAL_KIND_META, toLocalDateString, getJournalKindMeta } from './journal-helpers';
import type { JournalEntry, JournalDay, JournalEntryKind } from './journal-types';

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

function getMoodGradient(mood: number | null | undefined): string {
  const gradients: Record<number, string> = {
    1: 'from-red-500/30 to-red-400/20',
    2: 'from-amber-500/30 to-amber-400/20',
    3: 'from-slate-500/25 to-slate-400/15',
    4: 'from-emerald-500/30 to-emerald-400/20',
    5: 'from-rose-500/30 to-rose-400/20',
  };
  return (mood && gradients[mood]) || 'from-slate-500/15 to-slate-400/10';
}

function getMoodLabel(mood: number): string {
  const labels: Record<number, string> = { 1: 'Struggling', 2: 'Challenging', 3: 'Neutral', 4: 'Good', 5: 'Thriving' };
  return labels[mood] || 'Unset';
}

function JournalEntryItem({
  entry,
  linkedRegretContent,
  missionTitle,
  onDelete,
  onTurnIntoLesson,
  onEdit,
}: {
  entry: JournalEntry;
  linkedRegretContent: string | null;
  missionTitle: string | null;
  onDelete: (id: string) => void;
  onTurnIntoLesson: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const meta = getJournalKindMeta(entry.kind);
  const Icon = meta.icon;
  const toneBorder = meta.tone === 'warning' ? 'border-amber-500/20' : meta.tone === 'success' ? 'border-emerald-500/20' : meta.tone === 'accent' ? 'border-sky-500/20' : 'border-slate-500/15';
  const toneBg = meta.tone === 'warning' ? 'bg-amber-500/8' : meta.tone === 'success' ? 'bg-emerald-500/8' : meta.tone === 'accent' ? 'bg-sky-500/8' : 'bg-slate-500/5';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn('rounded-[20px] border p-4 sm:p-5 group backdrop-blur-sm transition-all hover:border-opacity-100', toneBorder, toneBg)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <Icon className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={cn("text-[15px] leading-relaxed text-text-primary font-[450]", isExpanded ? "" : "line-clamp-3")}>{entry.content}</p>
              {entry.content.length > 150 && !isExpanded && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setIsExpanded(true)}
                  className="text-[12px] text-text-secondary/70 hover:text-text-secondary mt-1 font-medium transition-colors"
                  type="button"
                >
                  Read more
                </motion.button>
              )}
              {isExpanded && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setIsExpanded(false)}
                  className="text-[12px] text-text-secondary/70 hover:text-text-secondary mt-1 font-medium transition-colors"
                  type="button"
                >
                  Show less
                </motion.button>
              )}
            </div>
          </div>

          {linkedRegretContent && (
            <div className="mt-3 rounded-[14px] border border-amber-500/15 bg-amber-500/6 px-3 py-2">
              <p className="text-[12px] text-amber-900/60 dark:text-amber-200/50 font-medium uppercase tracking-[0.3px] mb-1">Lesson from</p>
              <p className="text-[13px] text-amber-950/70 dark:text-amber-100/70 italic">{linkedRegretContent}</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2 items-center">
            {missionTitle && (
              <Badge tone="neutral" className="text-[10px] font-medium bg-slate-500/12 border-slate-500/20">
                {missionTitle}
              </Badge>
            )}
            <span className="text-[11px] text-text-muted/70 font-medium">{formatRelativeTime(entry.created_at)}</span>
          </div>
        </div>

        <div className="flex shrink-0 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity delay-100">
          <motion.button
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-sky-500/12 text-text-muted/60 hover:text-sky-600/70 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
            title="View full entry"
            type="button"
          >
            <Eye className="h-3.5 w-3.5" />
          </motion.button>
          <motion.button
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-emerald-500/12 text-text-muted/60 hover:text-emerald-600/70 transition-colors"
            onClick={() => onEdit(entry)}
            title="Edit entry"
            type="button"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </motion.button>
          {entry.kind === 'regret' && (
            <motion.button
              className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/12 hover:bg-amber-500/20 text-amber-700/70 dark:text-amber-300/70 transition-colors"
              onClick={() => onTurnIntoLesson(entry)}
              title="Turn this into a lesson"
              type="button"
            >
              ✨
            </motion.button>
          )}
          <motion.button
            disabled={isDeleting}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-500/12 text-text-muted/60 hover:text-red-600/70 transition-colors disabled:opacity-50"
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
            {isDeleting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="h-3.5 w-3.5 rounded-full border border-text-muted/40 border-t-text-muted/70" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </motion.button>
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
  const meta = getJournalKindMeta(kind);
  const Icon = meta.icon;
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  const trimmed = content.trim();
  const isUnchanged = trimmed === initialContent.trim();
  const canSubmit = trimmed.length > 0 && (mode === 'create' || !isUnchanged) && !saving;

  const handleSubmit = useCallback(async () => {
    if (trimmed.length === 0 || (mode === 'edit' && isUnchanged) || saving) return;
    setSaving(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [trimmed, mode, isUnchanged, saving, onSubmit, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSubmit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, handleSubmit]);

  const toneAccent =
    meta.tone === 'warning' ? 'text-amber-500' :
    meta.tone === 'success' ? 'text-emerald-500' :
    meta.tone === 'accent' ? 'text-sky-500' : 'text-text-secondary';

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-borderSoft/40 bg-panel shadow-panel sm:rounded-[28px] pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-borderSoft/25 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl bg-text-primary/5', toneAccent)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.4px] text-text-muted/60">{mode === 'create' ? 'New entry' : 'Editing'}</p>
              <h2 className="truncate text-base font-semibold text-text-primary">{meta.label}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted/70 transition-colors hover:bg-text-primary/8 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto px-6 py-5">
          <Textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={meta.prompt}
            className="min-h-[160px] resize-none rounded-[18px] border-borderSoft/30 bg-panel2/40 text-[15px] leading-relaxed placeholder:text-text-muted/50"
          />
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] text-text-muted/50">⌘/Ctrl + Enter to save</p>
            <p className={cn('text-[11px] tabular-nums', trimmed.length === 0 ? 'text-danger/70' : 'text-text-muted/50')}>
              {content.length} characters
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-borderSoft/25 px-6 py-4">
          <Button onClick={onClose} size="sm" type="button" variant="secondary" className="text-[13px] font-medium">
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit} size="sm" type="button" className="min-w-[120px] text-[13px] font-medium">
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="h-3.5 w-3.5 rounded-full border-2 border-current/40 border-t-current"
                />
                {mode === 'create' ? 'Adding' : 'Saving'}
              </span>
            ) : (
              mode === 'create' ? 'Add entry' : 'Save changes'
            )}
          </Button>
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
}: {
  kind: JournalEntryKind;
  entries: JournalEntry[];
  selectedDate: string;
  onAddEntry: (kind: JournalEntryKind, content: string) => void;
  onDeleteEntry: (id: string) => void;
  onTurnIntoLesson: (entry: JournalEntry) => void;
  missions: Record<string, string>;
  entriesById: Map<string, JournalEntry>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const updateEntry = useJournalStore((state) => state.updateEntry);

  const meta = JOURNAL_KIND_META[kind];
  const Icon = meta.icon;
  const sectionEntries = entries.filter((e) => e.kind === kind && e.entry_date === selectedDate);

  return (
    <div>
      <Card className="rounded-[28px] border-borderSoft/15 bg-gradient-to-br from-panel/60 via-panel/50 to-panel/60 p-5 sm:p-6 backdrop-blur-sm overflow-hidden">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-gradient-to-br from-text-secondary/20 to-text-secondary/10">
              <Icon className="h-4.5 w-4.5 text-text-secondary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary tracking-[-0.3px]">{meta.label}</h3>
              <p className="text-[11px] text-text-muted/60 mt-0.5">{meta.prompt}</p>
            </div>
          </div>
          {sectionEntries.length > 0 && (
            <Badge tone="neutral" className="text-[10px] font-bold bg-text-primary/8 border-text-primary/10">
              {sectionEntries.length}
            </Badge>
          )}
        </div>

        <div className="space-y-3">
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
                />
              );
            })}
          </AnimatePresence>

          <motion.button
            className="w-full rounded-[18px] border border-dashed border-borderSoft/30 bg-panel/20 py-4 text-[13px] font-medium text-text-secondary/70 hover:border-text-secondary/40 hover:bg-panel/35 hover:text-text-secondary transition-all duration-200"
            onClick={() => setIsAdding(true)}
            type="button"
          >
            <Plus className="mr-2 inline h-4 w-4" />
            Add entry
          </motion.button>

          {sectionEntries.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[18px] border border-borderSoft/20 bg-panel/10 py-6 px-4 text-center">
              <p className="text-[12px] uppercase tracking-[0.4px] text-text-muted/50 font-medium mb-1">Nothing yet</p>
              <p className="text-[13px] text-text-secondary/60">{meta.prompt}</p>
            </motion.div>
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((m) => (
          <motion.button
            key={m}
            className={cn('h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200 border-2', mood === m ? `border-text-primary/40 bg-gradient-to-br ${getMoodGradient(m)} ring-2 ring-text-primary/20` : 'border-borderSoft/30 bg-panel/30 hover:border-borderSoft/50 hover:bg-panel/50')}
            onClick={() => onChange(m)}
            type="button"
            title={getMoodLabel(m)}
          >
            <span className="text-[10px] font-bold text-text-muted/70 uppercase tracking-wide">{m}</span>
          </motion.button>
        ))}
        {mood > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ml-auto h-10 w-10 rounded-full flex items-center justify-center border border-borderSoft/40 hover:border-red-500/40 hover:bg-red-500/10 transition-colors"
            onClick={() => onChange(0)}
            type="button"
            title="Clear mood"
          >
            <X className="h-4 w-4 text-text-muted/70" />
          </motion.button>
        )}
      </div>
      {mood > 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] font-medium text-text-secondary/70 tracking-wide uppercase">
          {getMoodLabel(mood)}
        </motion.p>
      )}
    </div>
  );
}

function DateStepper({ selectedDate, onDateChange }: { selectedDate: string; onDateChange: (d: string) => void }) {
  const today = toLocalDateString(new Date());
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

  const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dateLabel = formatter.format(new Date(`${selectedDate}T00:00:00`));

  return (
    <div className="flex items-center justify-between gap-4">
      <Button onClick={goToPreviousDay} size="sm" type="button" variant="ghost" className="h-10 w-10 p-0 rounded-full hover:bg-text-primary/8">
        <ChevronLeft className="h-5 w-5 text-text-secondary" />
      </Button>

      <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
        <div>
          <p className="text-[12px] uppercase tracking-[0.5px] text-text-muted/60 font-bold mb-1">Your day</p>
          <p className="text-[15px] font-semibold text-text-primary tracking-[-0.3px]">{dateLabel}</p>
        </div>
        <DatePicker onChange={(value) => value && onDateChange(value)} placeholder="Pick a date" value={selectedDate} />
        {selectedDate !== today && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => onDateChange(today)} className="text-[11px] font-medium text-text-secondary/70 hover:text-text-secondary transition-colors" type="button">
            Back to today
          </motion.button>
        )}
      </div>

      <Button onClick={goToNextDay} size="sm" type="button" variant="ghost" className="h-10 w-10 p-0 rounded-full hover:bg-text-primary/8">
        <ChevronRight className="h-5 w-5 text-text-secondary" />
      </Button>
    </div>
  );
}

export function JournalView() {
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

  // Re-fetch from the cloud whenever the journal is opened or the app regains
  // focus, so entries created on another device (web <-> mobile) show up without
  // needing an app restart. Silent refresh avoids flashing the loading overlay.
  useEffect(() => {
    void refresh(true);

    const handleVisible = () => {
      if (document.visibilityState === 'visible') void refresh(true);
    };
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleVisible);

    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
    };
  }, [refresh]);

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
      if (window.confirm('Remove this entry?')) {
        await deleteEntry(entryId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete entry';
      setOperationError(message);
    }
  };

  const handleSaveDay = useCallback(async (mood: number, gratitude: string) => {
    await saveDay({
      entry_date: selectedDate,
      mood,
      gratitude,
      created_at: todayDay?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }, [selectedDate, todayDay?.created_at, saveDay]);

  const debouncedSaveGratitude = useDebouncedCallback(
    (gratitude: string) => {
      handleSaveDay(todayDay?.mood ?? 0, gratitude);
    },
    500,
  );

  return (
    <div className="space-y-8">
      {(error || operationError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-[20px] border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3"
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700 dark:text-red-200">{error || operationError}</p>
            {error?.includes('journal_entries') && (
              <p className="text-xs text-red-600 dark:text-red-300 mt-2">
                💡 Tip: Make sure your Supabase migrations are applied. Run <code className="bg-red-500/20 px-2 py-1 rounded text-xs">supabase migration up --remote</code>
              </p>
            )}
          </div>
          <motion.button
            onClick={() => setOperationError(null)}
            className="flex-shrink-0 text-red-600 hover:text-red-700 transition-colors"
            type="button"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </motion.div>
      )}

      <Card className="rounded-3xl border-borderSoft/20 bg-gradient-to-br from-panel/50 via-panel/40 to-panel/50 p-6 sm:p-8 backdrop-blur-sm shadow-sm">
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-panel/50 backdrop-blur-sm rounded-[32px] flex items-center justify-center z-10"
          >
            <div className="flex flex-col items-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }} className="h-8 w-8 rounded-full border-2 border-text-secondary/30 border-t-text-secondary" />
              <p className="text-sm text-text-muted/70">Loading journal...</p>
            </div>
          </motion.div>
        )}
        <div className="space-y-6">
          <DateStepper onDateChange={selectDate} selectedDate={selectedDate} />

          <div className="pt-6 border-t border-borderSoft/20">
            <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted/60 font-bold mb-4">Mood</p>
            <MoodSelector mood={todayDay?.mood ?? 0} onChange={(m) => handleSaveDay(m, gratitudeInput)} />
          </div>

          <div className="pt-6 border-t border-borderSoft/20">
            <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted/60 font-bold mb-3">Gratitude</p>
            <Input
              className="h-11 rounded-[16px] text-[14px] border-borderSoft/30 bg-panel/30 placeholder:text-text-muted/50 font-[450]"
              onChange={(e) => {
                setGratitudeInput(e.target.value);
                debouncedSaveGratitude(e.target.value);
              }}
              placeholder="One moment you're grateful for…"
              value={gratitudeInput}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 sm:gap-7 grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
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
          />
        ))}
      </div>
    </div>
  );
}
