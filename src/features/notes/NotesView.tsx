import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Pin, Edit2, Trash2, X, Settings, ChevronDown, Check, Target, CircleDashed } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { MissionIcon } from '../../components/ui/mission-icon';
import { RichTextEditor } from '../../components/ui/rich-text-editor';
import { RichTextContent, isHtmlContent } from '../../components/ui/rich-text-content';
import { SaveStatus } from '../../components/ui/save-status';
import { confirmDialog } from '../../components/ui/native-dialog';
import { useAutoSave } from '../../hooks/use-autosave';
import { useRefreshOnFocus } from '../../hooks/use-refresh-on-focus';
import { cn } from '../../lib/cn';
import { formatDayDateWithRelative } from '../../lib/date';
import { useNoteStore } from './note-store';
import { useMissionStore } from '../missions/mission-store';
import { useSettingsStore } from '../settings/settings-store';
import { SparkleBurst } from '../../character/effects-assets';
import {
  NOTE_COLORS,
  NOTE_CATEGORY_ICON_OPTIONS,
  NoteCategoryIcon,
  GENERAL_CATEGORY_ID,
  getAllCategories,
  getCategoryById,
  getNoteDisplayTitle,
  getNoteColorStyle,
  filterNotes,
} from './note-helpers';
import type { Note, NoteCategory, NoteColor } from './note-types';

export function CategoryChip({
  active,
  label,
  icon,
  color,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  color?: NoteColor;
  count?: number;
  onClick: () => void;
}) {
  const style = color ? getNoteColorStyle(color) : null;
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  return (
    <motion.button
      type="button"
      whileHover={reduceMotion ? {} : { y: -1, scale: 1.02 }}
      whileTap={reduceMotion ? {} : { scale: 0.96 }}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
        active
          ? style
            ? cn(style.bg, style.border, style.text, 'shadow-sm')
            : 'border-accent/40 bg-accent/12 text-accent shadow-sm'
          : 'border-borderSoft/30 bg-panel/30 text-text-secondary hover:border-borderSoft/50 hover:bg-panel/50',
      )}
    >
      {icon}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span className={cn('text-[10px] tabular-nums', active ? 'opacity-70' : 'text-text-muted/50')}>{count}</span>
      )}
    </motion.button>
  );
}

export function NoteCard({
  note,
  category,
  missionTitle,
  onView,
  onEdit,
  onDelete,
  onTogglePin,
  onFilterMission,
}: {
  note: Note;
  category: NoteCategory;
  missionTitle: string | null;
  onView: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onFilterMission?: (missionId: string) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const style = getNoteColorStyle(category.color);
  const title = getNoteDisplayTitle(note);
  const showTitleSeparately = note.title.trim().length > 0;

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: -12, transition: { duration: 0.22 } }}
      transition={{ duration: 0.2 }}
      className="min-w-0"
    >
      <Card
        onClick={() => onView(note)}
        className={cn(
          'group relative flex h-[292px] cursor-pointer flex-col overflow-hidden rounded-[22px] border bg-panel/90 p-4 shadow-[inset_0_1px_0_rgb(var(--text-primary)/0.025)] transition-[transform,border-color,box-shadow,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgb(var(--shadow-color)/0.11)] sm:p-5',
          style.border,
          isDeleting && 'pointer-events-none opacity-50 scale-[0.98]',
        )}
      >
        <div className={cn('absolute inset-x-0 top-0 h-1', style.solid)} />

        <div className="mb-3 flex items-start justify-between gap-2">
          <Badge tone="neutral" className={cn('gap-1.5 border px-2.5 py-1 text-[11px] font-semibold normal-case tracking-normal', style.bg, style.border, style.text)}>
            <NoteCategoryIcon icon={category.icon} className="h-3 w-3" />
            {category.label}
          </Badge>
          <div className="flex shrink-0 items-center gap-1">
            <motion.button
              type="button"
              whileHover={reduceMotion ? {} : { scale: 1.15 }}
              whileTap={reduceMotion ? {} : { scale: 0.75, rotate: -25 }}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(note.id);
              }}
              title={note.pinned ? 'Unpin note' : 'Pin note'}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                note.pinned
                  ? 'text-accent'
                  : 'text-text-muted/50 opacity-0 hover:text-text-secondary group-hover:opacity-100',
              )}
            >
              <Pin className={cn('h-3.5 w-3.5 transition-transform', note.pinned && 'fill-current scale-110')} />
            </motion.button>
            <motion.button
              type="button"
              whileHover={reduceMotion ? {} : { scale: 1.15 }}
              whileTap={reduceMotion ? {} : { scale: 0.85 }}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(note);
              }}
              title="Edit note"
              className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted/50 opacity-0 transition-colors hover:bg-emerald-500/12 hover:text-emerald-600/70 group-hover:opacity-100"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </motion.button>
            <motion.button
              type="button"
              whileHover={reduceMotion ? {} : { scale: 1.15 }}
              whileTap={reduceMotion ? {} : { scale: 0.85 }}
              disabled={isDeleting}
              onClick={async (e) => {
                e.stopPropagation();
                setIsDeleting(true);
                try {
                  await onDelete(note.id);
                } finally {
                  setIsDeleting(false);
                }
              }}
              title="Delete note"
              className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted/50 opacity-0 transition-colors hover:bg-red-500/12 hover:text-red-600/70 group-hover:opacity-100 disabled:opacity-50"
            >
              {isDeleting ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="h-3.5 w-3.5 rounded-full border-2 border-red-500/40 border-t-red-500" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </motion.button>
          </div>
        </div>

        {showTitleSeparately && (
          <h3 className="mb-1.5 line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold tracking-[-0.2px] text-text-primary">{title}</h3>
        )}

        {note.content.trim() && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <RichTextContent
              content={note.content}
              className="note-card-preview text-[13px] leading-relaxed text-text-secondary"
            />
            {note.content.length > 240 && (
              <span className="mt-1 block text-[11px] font-medium text-text-muted">Open to read more</span>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-nowrap items-center gap-2 border-t border-borderSoft/20 pt-3">
          {missionTitle && (
            <button
              type="button"
              onClick={(e) => {
                if (note.mission_id && onFilterMission) {
                  e.stopPropagation();
                  onFilterMission(note.mission_id);
                }
              }}
              className={cn(
                'inline-flex min-w-0 items-center rounded-full border border-slate-500/20 bg-slate-500/12 px-2.5 py-0.5 text-[10px] font-medium tracking-normal text-text-secondary transition-colors',
                onFilterMission ? 'hover:border-accent/40 hover:bg-accent/15 hover:text-accent cursor-pointer' : '',
              )}
              title={onFilterMission ? 'Filter by this mission' : undefined}
            >
              <span className="truncate">{missionTitle}</span>
            </button>
          )}
          <span
            title={new Date(note.updated_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
            className="ml-auto text-[11px] font-medium text-text-muted"
          >
            {formatDayDateWithRelative(note.updated_at)}
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

export function NoteMissionFilterControl({
  missions,
  activeMissionId,
  onChange,
  missionNoteCounts,
  totalNotes,
}: {
  missions: { id: string; title: string; emoji?: string }[];
  activeMissionId: string;
  onChange: (id: string) => void;
  missionNoteCounts: Record<string, number>;
  totalNotes: number;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const selectedMission = missions.find((m) => m.id === activeMissionId);
  const activeLabel =
    activeMissionId === 'all'
      ? 'All missions'
      : activeMissionId === 'none'
        ? 'No mission'
        : selectedMission?.title ?? 'Mission';

  const activeCount =
    activeMissionId === 'all'
      ? totalNotes
      : activeMissionId === 'none'
        ? (missionNoteCounts['none'] ?? 0)
        : (missionNoteCounts[activeMissionId] ?? 0);

  const isFiltered = activeMissionId !== 'all';

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        size="md"
        variant="secondary"
        className={cn(
          'h-10 rounded-full px-3.5 text-[13px] font-medium transition-all gap-2',
          isFiltered
            ? 'border-accent/40 bg-accent/12 text-accent hover:bg-accent/20 hover:border-accent/60'
            : 'border-borderSoft/40 hover:bg-panel2/60',
        )}
        title={`Filter by mission: ${activeLabel}`}
      >
        {activeMissionId === 'all' ? (
          <Target className="h-4 w-4 shrink-0 text-text-secondary" />
        ) : activeMissionId === 'none' ? (
          <CircleDashed className="h-4 w-4 shrink-0 text-text-muted" />
        ) : selectedMission ? (
          <MissionIcon icon={selectedMission.emoji ?? 'Target'} className="h-4 w-4 shrink-0" />
        ) : (
          <Target className="h-4 w-4 shrink-0" />
        )}
        <span className="hidden max-w-[130px] truncate sm:inline">{activeLabel}</span>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none',
            isFiltered
              ? 'border-accent/30 bg-accent/20 text-accent'
              : 'border-borderSoft/40 bg-panel/60 text-text-secondary',
          )}
        >
          {activeCount}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-150', open ? 'rotate-180' : null)}
        />
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-40 mt-2 w-72 max-h-[460px] overflow-y-auto rounded-[22px] border border-borderSoft/35 bg-panel/96 p-2 shadow-[0_18px_50px_rgb(var(--shadow-color)/0.25)] backdrop-blur-md scrollbar-thin"
          >
            <div className="px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">Filter by Mission</p>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onChange('all');
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors',
                  activeMissionId === 'all'
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
                    {totalNotes}
                  </span>
                  {activeMissionId === 'all' && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChange('none');
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors',
                  activeMissionId === 'none'
                    ? 'bg-accent/12 text-accent font-semibold'
                    : 'text-text-secondary hover:bg-panel2/60 hover:text-text-primary',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <CircleDashed className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">No mission</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-panel px-1.5 py-0.5 text-[9px] tabular-nums text-text-muted">
                    {missionNoteCounts['none'] ?? 0}
                  </span>
                  {activeMissionId === 'none' && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                </div>
              </button>

              {missions.length > 0 && <div className="my-1.5 h-px bg-borderSoft/20" />}

              {missions.map((mission) => {
                const count = missionNoteCounts[mission.id] ?? 0;
                const isSelected = activeMissionId === mission.id;
                return (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() => {
                      onChange(mission.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors',
                      isSelected
                        ? 'bg-accent/12 text-accent font-semibold'
                        : 'text-text-secondary hover:bg-panel2/60 hover:text-text-primary',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <MissionIcon icon={mission.emoji ?? 'Target'} className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{mission.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-panel px-1.5 py-0.5 text-[9px] tabular-nums text-text-muted">
                        {count}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MissionPicker({
  missions,
  value,
  onChange,
}: {
  missions: { id: string; title: string; emoji?: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const selected = missions.find((mission) => mission.id === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-[14px] border border-borderSoft/40 bg-panel2/78 px-4 py-2.5 text-left text-sm outline-none transition focus:border-accent/35',
          selected ? 'text-text-primary' : 'text-text-muted',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {selected?.emoji ? (
            <MissionIcon icon={selected.emoji} className="h-4 w-4 shrink-0" />
          ) : selected ? (
            <Target className="h-4 w-4 shrink-0" />
          ) : (
            <CircleDashed className="h-4 w-4 shrink-0 text-text-muted/60" />
          )}
          <span className="truncate">{selected ? selected.title : 'No mission'}</span>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-text-muted/60 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-10 mt-1.5 max-h-48 overflow-y-auto rounded-[14px] border border-borderSoft/40 bg-panel p-1.5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left text-sm transition-colors hover:bg-panel2/60',
                !value ? 'text-accent' : 'text-text-secondary',
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <CircleDashed className="h-3.5 w-3.5 shrink-0" />
                <span>No mission</span>
              </div>
              {!value && <Check className="h-3.5 w-3.5" />}
            </button>
            {missions.map((mission) => (
              <button
                key={mission.id}
                type="button"
                onClick={() => {
                  onChange(mission.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left text-sm transition-colors hover:bg-panel2/60',
                  value === mission.id ? 'text-accent' : 'text-text-secondary',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {mission.emoji ? (
                    <MissionIcon icon={mission.emoji} className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Target className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{mission.title}</span>
                </div>
                {value === mission.id && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NoteViewerModal({
  note,
  category,
  missionTitle,
  onClose,
  onEdit,
  onTogglePin,
  onFilterMission,
}: {
  note: Note;
  category: NoteCategory;
  missionTitle: string | null;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onTogglePin: (id: string) => void;
  onFilterMission?: (missionId: string) => void;
}) {
  const style = getNoteColorStyle(category.color);
  const title = getNoteDisplayTitle(note);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[3px]" />
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-borderStrong/25 bg-panel2 pb-[env(safe-area-inset-bottom)] shadow-[0_28px_80px_rgba(3,5,7,0.28)] sm:rounded-[28px] sm:pb-0"
      >
        <div className={cn('h-1 shrink-0', style.solid)} />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-borderSoft/25 px-6 py-5">
          <div className="min-w-0">
            <Badge tone="neutral" className={cn('mb-2 gap-1.5 border text-[10px] font-medium normal-case tracking-normal', style.bg, style.border, style.text)}>
              <NoteCategoryIcon icon={category.icon} className="h-3 w-3" />
              {category.label}
            </Badge>
            <h2 className="text-lg font-semibold leading-snug tracking-[-0.2px] text-text-primary">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <motion.button
              type="button"
              whileHover={reduceMotion ? {} : { scale: 1.15 }}
              whileTap={reduceMotion ? {} : { scale: 0.75, rotate: -25 }}
              onClick={() => onTogglePin(note.id)}
              title={note.pinned ? 'Unpin note' : 'Pin note'}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                note.pinned ? 'text-accent' : 'text-text-muted/70 hover:bg-text-primary/8 hover:text-text-primary',
              )}
            >
              <Pin className={cn('h-4 w-4 transition-transform', note.pinned && 'fill-current scale-110')} />
            </motion.button>
            <motion.button
              type="button"
              whileHover={reduceMotion ? {} : { scale: 1.15 }}
              whileTap={reduceMotion ? {} : { scale: 0.85 }}
              onClick={() => {
                onClose();
                onEdit(note);
              }}
              title="Edit note"
              className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted/70 transition-colors hover:bg-text-primary/8 hover:text-text-primary"
            >
              <Edit2 className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={reduceMotion ? {} : { scale: 1.15 }}
              whileTap={reduceMotion ? {} : { scale: 0.85 }}
              onClick={onClose}
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted/70 transition-colors hover:bg-text-primary/8 hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        <div className="overflow-y-auto bg-panel/35 px-6 py-5">
          {note.content.trim() ? (
            <RichTextContent content={note.content} className="text-[14px] leading-relaxed text-text-secondary" />
          ) : (
            <p className="text-sm text-text-muted/60">This note has no content.</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-borderSoft/25 px-6 py-4">
          {missionTitle && (
            <button
              type="button"
              onClick={() => {
                if (note.mission_id && onFilterMission) {
                  onFilterMission(note.mission_id);
                  onClose();
                }
              }}
              className={cn(
                'inline-flex items-center rounded-full border border-slate-500/20 bg-slate-500/12 px-3 py-1 text-[10px] font-medium tracking-normal text-text-secondary transition-colors',
                onFilterMission ? 'cursor-pointer hover:border-accent/40 hover:bg-accent/15 hover:text-accent' : '',
              )}
              title={onFilterMission ? 'Filter by this mission' : undefined}
            >
              {missionTitle}
            </button>
          )}
          <span
            title={new Date(note.updated_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
            className="ml-auto text-[12px] font-medium text-text-muted/60"
          >
            {formatDayDateWithRelative(note.updated_at)}
          </span>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export interface NoteEditorSubmit {
  title: string;
  content: string;
  category_id: string;
  mission_id: string | null;
  pinned: boolean;
}

export function NoteEditorModal({
  mode,
  note,
  categories,
  missions,
  defaultCategoryId,
  defaultMissionId,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  note?: Note;
  categories: NoteCategory[];
  missions: { id: string; title: string; emoji?: string }[];
  defaultCategoryId?: string;
  defaultMissionId?: string | null;
  onClose: () => void;
  onSubmit: (draft: NoteEditorSubmit) => Promise<void>;
}) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [categoryId, setCategoryId] = useState(note?.category_id ?? defaultCategoryId ?? GENERAL_CATEGORY_ID);
  const [missionId, setMissionId] = useState<string | null>(note?.mission_id ?? defaultMissionId ?? null);
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [saving, setSaving] = useState(false);

  const [savedFlash, setSavedFlash] = useState(false);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  const trimmedContent = content.trim();
  // For HTML content, strip tags to know whether there's real text/media to save.
  const plainText = isHtmlContent(content)
    ? content.replace(/<(?:hr|img)[^>]*>/gi, ' x ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    : trimmedContent;
  const canSubmit = plainText.length > 0 && !saving;

  const draft = useMemo<NoteEditorSubmit>(
    () => ({ title: title.trim(), content: trimmedContent, category_id: categoryId, mission_id: missionId, pinned }),
    [title, trimmedContent, categoryId, missionId, pinned],
  );

  const { status: autoSaveStatus, flush } = useAutoSave({
    data: draft,
    enabled: mode === 'edit' && plainText.length > 0,
    onSave: onSubmit,
  });

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || savedFlash) return;
    setSaving(true);
    try {
      if (mode === 'edit') {
        await flush();
      } else {
        await onSubmit(draft);
      }
      setSavedFlash(true);
      setTimeout(() => {
        onClose();
      }, 450);
    } catch (err) {
      setSaving(false);
      throw err;
    }
  }, [canSubmit, savedFlash, mode, flush, draft, onSubmit, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSubmit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, handleSubmit]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-borderSoft/40 bg-panel pb-[env(safe-area-inset-bottom)] shadow-panel sm:rounded-[28px] sm:pb-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-borderSoft/25 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.4px] text-text-muted/60">{mode === 'create' ? 'New note' : 'Editing'}</p>
            <h2 className="truncate text-base font-semibold text-text-primary">{mode === 'create' ? 'Capture something' : 'Edit note'}</h2>
          </div>
          <motion.button
            whileHover={reduceMotion ? {} : { scale: 1.1 }}
            whileTap={reduceMotion ? {} : { scale: 0.9 }}
            onClick={onClose}
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted/70 transition-colors hover:bg-text-primary/8 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="h-11 rounded-[14px] text-[15px] font-medium"
          />

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.4px] text-text-muted/60">Category</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const style = getNoteColorStyle(category.color);
                const active = category.id === categoryId;
                return (
                  <motion.button
                    key={category.id}
                    type="button"
                    whileHover={reduceMotion ? {} : { scale: 1.04 }}
                    whileTap={reduceMotion ? {} : { scale: 0.96 }}
                    onClick={() => setCategoryId(category.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
                      active ? cn(style.bg, style.border, style.text, 'shadow-sm') : 'border-borderSoft/30 bg-panel/30 text-text-secondary hover:border-borderSoft/50',
                    )}
                  >
                    <NoteCategoryIcon icon={category.icon} className="h-3 w-3" />
                    {category.label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.4px] text-text-muted/60">Linked mission</p>
            <MissionPicker missions={missions} value={missionId} onChange={setMissionId} />
          </div>

          <div>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Write it down..."
            />
            <div className="mt-1.5 flex items-center justify-between px-1">
              <p className="text-[11px] text-text-muted/50">{mode === 'edit' ? 'Autosaves as you type' : '⌘/Ctrl + Enter to save'}</p>
              <p className={cn('text-[11px] tabular-nums', plainText.length === 0 ? 'text-danger/70' : 'text-text-muted/50')}>{plainText.length} characters</p>
            </div>
          </div>

          <motion.button
            type="button"
            whileHover={reduceMotion ? {} : { scale: 1.02 }}
            whileTap={reduceMotion ? {} : { scale: 0.97 }}
            onClick={() => setPinned((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-[14px] border px-3 py-2 text-[13px] font-medium transition-colors',
              pinned ? 'border-accent/40 bg-accent/12 text-accent shadow-sm' : 'border-borderSoft/30 bg-panel/30 text-text-secondary hover:border-borderSoft/50',
            )}
          >
            <Pin className={cn('h-3.5 w-3.5 transition-transform', pinned && 'fill-current scale-110')} />
            {pinned ? 'Pinned' : 'Pin this note'}
          </motion.button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-borderSoft/25 px-6 py-4">
          <SaveStatus status={autoSaveStatus} />
          <div className="flex items-center gap-2">
            <Button onClick={onClose} size="sm" type="button" variant="secondary" className="text-[13px] font-medium">
              Cancel
            </Button>
            <Button
              disabled={!canSubmit || savedFlash}
              onClick={handleSubmit}
              size="sm"
              type="button"
              className={cn(
                'relative min-w-[124px] text-[13px] font-semibold transition-all overflow-hidden',
                savedFlash && 'bg-emerald-600 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)]',
              )}
            >
              {savedFlash && <SparkleBurst className="-top-1 -right-1" size={22} reduceMotion={reduceMotion} />}
              {savedFlash ? (
                <span className="flex items-center justify-center gap-1.5 font-bold">
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  Saved!
                </span>
              ) : saving ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="h-3.5 w-3.5 rounded-full border-2 border-current/40 border-t-current"
                  />
                  {mode === 'create' ? 'Adding…' : 'Saving…'}
                </span>
              ) : mode === 'create' ? (
                'Add note'
              ) : (
                'Done'
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function CategoryManagerModal({
  categories,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  categories: NoteCategory[];
  onClose: () => void;
  onCreate: (draft: { label: string; color: NoteColor; icon: string }) => Promise<void>;
  onUpdate: (category: NoteCategory) => Promise<void>;
  onDelete: (categoryId: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<NoteColor>('slate');
  const [icon, setIcon] = useState('Tag');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setLabel('');
    setColor('slate');
    setIcon('Tag');
  };

  const startEdit = (category: NoteCategory) => {
    setEditingId(category.id);
    setLabel(category.label);
    setColor(category.color);
    setIcon(category.icon);
  };

  const handleSave = async () => {
    const trimmed = label.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      if (editingId) {
        const existing = categories.find((c) => c.id === editingId);
        if (existing) await onUpdate({ ...existing, label: trimmed, color, icon });
      } else {
        await onCreate({ label: trimmed, color, icon });
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-borderSoft/40 bg-panel pb-[env(safe-area-inset-bottom)] shadow-panel sm:rounded-[28px] sm:pb-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-borderSoft/25 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.4px] text-text-muted/60">Notes</p>
            <h2 className="truncate text-base font-semibold text-text-primary">Manage categories</h2>
          </div>
          <motion.button
            whileHover={reduceMotion ? {} : { scale: 1.1 }}
            whileTap={reduceMotion ? {} : { scale: 0.9 }}
            onClick={onClose}
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted/70 transition-colors hover:bg-text-primary/8 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {categories.length > 0 ? (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {categories.map((category) => {
                  const style = getNoteColorStyle(category.color);
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -6, transition: { duration: 0.18 } }}
                      key={category.id}
                      className="flex items-center gap-3 rounded-[14px] border border-borderSoft/25 bg-panel/30 px-3 py-2.5"
                    >
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', style.bg, style.text)}>
                        <NoteCategoryIcon icon={category.icon} className="h-4 w-4" />
                      </div>
                      <span className="flex-1 truncate text-sm font-medium text-text-primary">{category.label}</span>
                      <motion.button
                        type="button"
                        whileHover={reduceMotion ? {} : { scale: 1.15 }}
                        whileTap={reduceMotion ? {} : { scale: 0.85 }}
                        onClick={() => startEdit(category)}
                        title="Edit category"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted/60 transition-colors hover:bg-emerald-500/12 hover:text-emerald-600/70"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={reduceMotion ? {} : { scale: 1.15 }}
                        whileTap={reduceMotion ? {} : { scale: 0.85 }}
                        onClick={async () => {
                          if (await confirmDialog(`Notes in “${category.label}” will move to General.`, { title: `Delete ${category.label}?`, confirmLabel: 'Delete', danger: true })) {
                            await onDelete(category.id);
                            if (editingId === category.id) resetForm();
                          }
                        }}
                        title="Delete category"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted/60 transition-colors hover:bg-red-500/12 hover:text-red-600/70"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <p className="text-[13px] text-text-muted/60">No custom categories yet. Create one below.</p>
          )}

          <div className="space-y-3 rounded-[18px] border border-borderSoft/25 bg-panel/20 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.4px] text-text-muted/60">{editingId ? 'Edit category' : 'New category'}</p>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Category name" className="h-10 rounded-[12px] text-sm" />

            <div>
              <p className="mb-1.5 text-[11px] text-text-muted/50">Color</p>
              <div className="flex flex-wrap gap-2">
                {NOTE_COLORS.map((c) => {
                  const colorStyle = getNoteColorStyle(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      title={c}
                      className={cn(
                        'h-7 w-7 rounded-full transition-transform',
                        colorStyle.solid,
                        color === c ? 'scale-110 ring-2 ring-text-primary/40 ring-offset-2 ring-offset-panel' : 'hover:scale-105',
                      )}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] text-text-muted/50">Icon</p>
              <div className="grid grid-cols-8 gap-2">
                {NOTE_CATEGORY_ICON_OPTIONS.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    title={iconName}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors',
                      icon === iconName ? 'border-accent/40 bg-accent/12 text-accent' : 'border-borderSoft/30 bg-panel/30 text-text-secondary hover:border-borderSoft/50',
                    )}
                  >
                    <NoteCategoryIcon icon={iconName} className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {editingId && (
                <Button onClick={resetForm} size="sm" type="button" variant="secondary" className="text-[13px] font-medium">
                  Cancel edit
                </Button>
              )}
              <Button disabled={!label.trim() || saving} onClick={handleSave} size="sm" type="button" className="min-w-[110px] text-[13px] font-medium">
                {saving ? 'Saving…' : editingId ? 'Save' : 'Add category'}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function NotesView({ openNoteId = null }: { openNoteId?: string | null }) {
  const notes = useNoteStore((state) => state.notes);
  const categories = useNoteStore((state) => state.categories);
  const searchQuery = useNoteStore((state) => state.searchQuery);
  const activeCategoryId = useNoteStore((state) => state.activeCategoryId);
  const activeMissionId = useNoteStore((state) => state.activeMissionId);
  const loading = useNoteStore((state) => state.loading);
  const error = useNoteStore((state) => state.error);
  const setSearchQuery = useNoteStore((state) => state.setSearchQuery);
  const setActiveCategoryId = useNoteStore((state) => state.setActiveCategoryId);
  const setActiveMissionId = useNoteStore((state) => state.setActiveMissionId);
  const createNote = useNoteStore((state) => state.createNote);
  const updateNote = useNoteStore((state) => state.updateNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const togglePin = useNoteStore((state) => state.togglePin);
  const createCategory = useNoteStore((state) => state.createCategory);
  const updateCategory = useNoteStore((state) => state.updateCategory);
  const deleteCategory = useNoteStore((state) => state.deleteCategory);
  const refresh = useNoteStore((state) => state.refresh);

  const [isCreating, setIsCreating] = useState(false);
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  useEffect(() => {
    if (openNoteId && notes.some((note) => note.id === openNoteId)) setViewingNoteId(openNoteId);
  }, [openNoteId, notes]);

  const missions = useMissionStore((state) => state.missions);

  useRefreshOnFocus(refresh);

  const missionTitles = useMemo(() => {
    const map: Record<string, string> = {};
    missions.forEach((mission) => {
      map[mission.id] = mission.title;
    });
    return map;
  }, [missions]);

  const allCategories = useMemo(() => getAllCategories(categories), [categories]);

  const missionNoteCounts = useMemo(() => {
    const counts: Record<string, number> = { none: 0 };
    notes.forEach((note) => {
      if (note.mission_id) {
        counts[note.mission_id] = (counts[note.mission_id] ?? 0) + 1;
      } else {
        counts['none'] = (counts['none'] ?? 0) + 1;
      }
    });
    return counts;
  }, [notes]);

  const filteredNotes = useMemo(
    () =>
      filterNotes(notes, {
        query: searchQuery,
        categoryId: activeCategoryId,
        missionId: activeMissionId,
        customCategories: categories,
        missionTitles,
      }),
    [notes, searchQuery, activeCategoryId, activeMissionId, categories, missionTitles],
  );

  const pinnedCount = useMemo(() => notes.filter((note) => note.pinned).length, [notes]);

  const viewingNote = viewingNoteId ? notes.find((note) => note.id === viewingNoteId) ?? null : null;

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach((note) => {
      counts[note.category_id] = (counts[note.category_id] ?? 0) + 1;
    });
    return counts;
  }, [notes]);

  const handleCreate = async (draft: NoteEditorSubmit) => {
    try {
      setOperationError(null);
      await createNote(draft);
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to create note');
    }
  };

  const handleUpdate = async (note: Note, draft: NoteEditorSubmit) => {
    try {
      setOperationError(null);
      await updateNote({ ...note, ...draft });
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to update note');
      throw err;
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      setOperationError(null);
      if (await confirmDialog('Delete this note?', { title: 'Delete note', confirmLabel: 'Delete', danger: true })) {
        await deleteNote(noteId);
      }
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  const handleTogglePin = async (noteId: string) => {
    try {
      setOperationError(null);
      await togglePin(noteId);
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to update note');
    }
  };

  const handleCreateCategory = async (draft: { label: string; color: NoteColor; icon: string }) => {
    try {
      setOperationError(null);
      await createCategory(draft);
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (category: NoteCategory) => {
    try {
      setOperationError(null);
      await updateCategory(category);
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      setOperationError(null);
      await deleteCategory(categoryId);
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const isFiltered = searchQuery.trim().length > 0 || activeCategoryId !== 'all' || activeMissionId !== 'all';

  return (
    <div className="mx-auto max-w-[1480px] space-y-5">
      {(error || operationError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-start gap-3 rounded-[20px] border border-red-500/30 bg-red-500/10 p-4"
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700 dark:text-red-200">{error || operationError}</p>
            {error?.includes('notes') && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-300">
                Tip: Make sure your Supabase migrations are applied. Run <code className="rounded bg-red-500/20 px-2 py-1 text-xs">supabase migration up --remote</code>
              </p>
            )}
          </div>
          <motion.button
            onClick={() => setOperationError(null)}
            className="flex-shrink-0 text-red-600 transition-colors hover:text-red-700"
            type="button"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </motion.div>
      )}

      <div className="flex flex-col gap-4 rounded-[22px] border border-borderSoft/35 bg-panel/72 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Library</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-text-primary">{filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}</p>
            {activeMissionId !== 'all' && (
              <Badge tone="neutral" className="border-accent/30 bg-accent/10 text-accent text-[11px] gap-1 py-0.5">
                <span className="truncate max-w-[140px]">
                  {activeMissionId === 'none' ? 'No mission' : missionTitles[activeMissionId] ?? 'Mission'}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveMissionId('all')}
                  className="hover:opacity-100 opacity-60 ml-0.5"
                  title="Clear mission filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="h-10 rounded-full pl-10 text-[13px]"
            />
          </div>
          <NoteMissionFilterControl
            missions={missions}
            activeMissionId={activeMissionId}
            onChange={setActiveMissionId}
            missionNoteCounts={missionNoteCounts}
            totalNotes={notes.length}
          />
          <Button onClick={() => setIsCreating(true)} size="md" type="button" className="shrink-0 text-[13px] font-medium">
            <Plus className="h-4 w-4" />
            New note
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto rounded-[18px] border border-borderSoft/25 bg-panel2/35 p-2 scrollbar-none">
        <CategoryChip active={activeCategoryId === 'all'} label="All" count={notes.length} onClick={() => setActiveCategoryId('all')} />
        <CategoryChip
          active={activeCategoryId === 'pinned'}
          label="Pinned"
          icon={<Pin className="h-3 w-3" />}
          count={pinnedCount}
          onClick={() => setActiveCategoryId('pinned')}
        />
        {allCategories.map((category) => (
          <CategoryChip
            key={category.id}
            active={activeCategoryId === category.id}
            label={category.label}
            icon={<NoteCategoryIcon icon={category.icon} className="h-3 w-3" />}
            color={category.color}
            count={categoryCounts[category.id] ?? 0}
            onClick={() => setActiveCategoryId(category.id)}
          />
        ))}
        <motion.button
          type="button"
          onClick={() => setManagingCategories(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-borderSoft/40 px-3 py-1.5 text-[12px] font-medium text-text-muted/60 transition-colors hover:border-text-secondary/40 hover:text-text-secondary"
        >
          <Settings className="h-3 w-3" />
          Categories
        </motion.button>
      </div>

      <div className="relative">
        {loading && notes.length === 0 ? (
          <div className="flex items-center justify-center rounded-[24px] border border-borderSoft/20 bg-panel/15 py-16">
            <div className="flex flex-col items-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }} className="h-8 w-8 rounded-full border-2 border-text-secondary/30 border-t-text-secondary" />
              <p className="text-sm text-text-muted/70">Loading notes...</p>
            </div>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-borderSoft/30 bg-panel/15 px-6 py-16 text-center">
            <p className="mb-1.5 text-[13px] font-medium uppercase tracking-[0.4px] text-text-muted/50">{notes.length === 0 ? 'No notes yet' : 'No matches'}</p>
            <p className="mx-auto max-w-sm text-sm text-text-secondary/60">
              {notes.length === 0
                ? 'Capture ideas, references, snippets, and more — all in one searchable place.'
                : 'Try a different search, category, or mission filter.'}
            </p>
            {notes.length === 0 ? (
              <Button onClick={() => setIsCreating(true)} size="sm" type="button" className="mt-4 text-[13px] font-medium">
                <Plus className="h-4 w-4" />
                New note
              </Button>
            ) : isFiltered ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategoryId('all');
                    setActiveMissionId('all');
                  }}
                  size="sm"
                  variant="secondary"
                  type="button"
                  className="text-[13px] font-medium"
                >
                  Reset filters
                </Button>
                <Button onClick={() => setIsCreating(true)} size="sm" type="button" className="text-[13px] font-medium">
                  <Plus className="h-4 w-4" />
                  New note
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div key={`${activeCategoryId}-${activeMissionId}`} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[1500px]:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  category={getCategoryById(note.category_id, categories)}
                  missionTitle={note.mission_id ? missionTitles[note.mission_id] ?? null : null}
                  onView={(n) => setViewingNoteId(n.id)}
                  onEdit={setEditingNote}
                  onDelete={handleDelete}
                  onTogglePin={handleTogglePin}
                  onFilterMission={setActiveMissionId}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewingNote && (
          <NoteViewerModal
            note={viewingNote}
            category={getCategoryById(viewingNote.category_id, categories)}
            missionTitle={viewingNote.mission_id ? missionTitles[viewingNote.mission_id] ?? null : null}
            onClose={() => setViewingNoteId(null)}
            onEdit={setEditingNote}
            onTogglePin={handleTogglePin}
            onFilterMission={setActiveMissionId}
          />
        )}
        {isCreating && (
          <NoteEditorModal
            mode="create"
            categories={allCategories}
            missions={missions}
            defaultCategoryId={activeCategoryId !== 'all' && activeCategoryId !== 'pinned' ? activeCategoryId : undefined}
            defaultMissionId={activeMissionId !== 'all' && activeMissionId !== 'none' ? activeMissionId : undefined}
            onClose={() => setIsCreating(false)}
            onSubmit={handleCreate}
          />
        )}
        {editingNote && (
          <NoteEditorModal
            mode="edit"
            note={editingNote}
            categories={allCategories}
            missions={missions}
            onClose={() => setEditingNote(null)}
            onSubmit={(draft) => handleUpdate(editingNote, draft)}
          />
        )}
        {managingCategories && (
          <CategoryManagerModal
            categories={categories}
            onClose={() => setManagingCategories(false)}
            onCreate={handleCreateCategory}
            onUpdate={handleUpdateCategory}
            onDelete={handleDeleteCategory}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
