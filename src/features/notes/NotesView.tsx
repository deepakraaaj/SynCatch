import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Pin, Edit2, Trash2, X, Settings, ChevronDown, Check } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Textarea } from '../../components/ui/input';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../lib/date';
import { useNoteStore } from './note-store';
import { useMissionStore } from '../missions/mission-store';
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

function CategoryChip({
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

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
        active
          ? style
            ? cn(style.bg, style.border, style.text)
            : 'border-accent/40 bg-accent/12 text-accent'
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

function NoteCard({
  note,
  category,
  missionTitle,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  note: Note;
  category: NoteCategory;
  missionTitle: string | null;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const style = getNoteColorStyle(category.color);
  const title = getNoteDisplayTitle(note);
  const showTitleSeparately = note.title.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="mb-4 break-inside-avoid"
    >
      <Card className={cn('group relative overflow-hidden rounded-[20px] border bg-panel/40 p-4 backdrop-blur-sm transition-all hover:border-opacity-100 sm:p-5', style.border)}>
        <div className={cn('absolute inset-x-0 top-0 h-1', style.solid)} />

        <div className="mb-3 flex items-start justify-between gap-2">
          <Badge tone="neutral" className={cn('gap-1.5 border text-[10px] font-medium normal-case tracking-normal', style.bg, style.border, style.text)}>
            <NoteCategoryIcon icon={category.icon} className="h-3 w-3" />
            {category.label}
          </Badge>
          <div className="flex shrink-0 items-center gap-1">
            <motion.button
              type="button"
              onClick={() => onTogglePin(note.id)}
              title={note.pinned ? 'Unpin note' : 'Pin note'}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                note.pinned
                  ? 'text-accent'
                  : 'text-text-muted/50 opacity-0 hover:text-text-secondary group-hover:opacity-100',
              )}
            >
              <Pin className={cn('h-3.5 w-3.5', note.pinned && 'fill-current')} />
            </motion.button>
            <motion.button
              type="button"
              onClick={() => onEdit(note)}
              title="Edit note"
              className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted/50 opacity-0 transition-colors hover:bg-emerald-500/12 hover:text-emerald-600/70 group-hover:opacity-100"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </motion.button>
            <motion.button
              type="button"
              disabled={isDeleting}
              onClick={async () => {
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
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="h-3.5 w-3.5 rounded-full border border-text-muted/40 border-t-text-muted/70" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </motion.button>
          </div>
        </div>

        {showTitleSeparately && (
          <h3 className="mb-1.5 text-[15px] font-semibold tracking-[-0.2px] text-text-primary">{title}</h3>
        )}

        {note.content.trim() && (
          <div>
            <p className={cn('whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary', isExpanded ? '' : 'line-clamp-5')}>
              {note.content}
            </p>
            {note.content.length > 240 && (
              <button
                type="button"
                onClick={() => setIsExpanded((value) => !value)}
                className="mt-1 text-[12px] font-medium text-text-secondary/70 transition-colors hover:text-text-secondary"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {missionTitle && (
            <Badge tone="neutral" className="border-slate-500/20 bg-slate-500/12 text-[10px] font-medium normal-case tracking-normal">
              {missionTitle}
            </Badge>
          )}
          <span className="ml-auto text-[11px] font-medium text-text-muted/60">{formatRelativeTime(note.updated_at)}</span>
        </div>
      </Card>
    </motion.div>
  );
}

function MissionPicker({
  missions,
  value,
  onChange,
}: {
  missions: { id: string; title: string }[];
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
        <span className="truncate">{selected ? selected.title : 'No mission'}</span>
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
              No mission
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
                <span className="truncate">{mission.title}</span>
                {value === mission.id && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface NoteEditorSubmit {
  title: string;
  content: string;
  category_id: string;
  mission_id: string | null;
  pinned: boolean;
}

function NoteEditorModal({
  mode,
  note,
  categories,
  missions,
  defaultCategoryId,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  note?: Note;
  categories: NoteCategory[];
  missions: { id: string; title: string }[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSubmit: (draft: NoteEditorSubmit) => Promise<void>;
}) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [categoryId, setCategoryId] = useState(note?.category_id ?? defaultCategoryId ?? GENERAL_CATEGORY_ID);
  const [missionId, setMissionId] = useState<string | null>(note?.mission_id ?? null);
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [saving, setSaving] = useState(false);

  const trimmedContent = content.trim();
  const canSubmit = trimmedContent.length > 0 && !saving;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), content: trimmedContent, category_id: categoryId, mission_id: missionId, pinned });
      onClose();
    } finally {
      setSaving(false);
    }
  }, [canSubmit, title, trimmedContent, categoryId, missionId, pinned, onSubmit, onClose]);

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
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-borderSoft/40 bg-panel pb-[env(safe-area-inset-bottom)] shadow-panel sm:rounded-[28px] sm:pb-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-borderSoft/25 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.4px] text-text-muted/60">{mode === 'create' ? 'New note' : 'Editing'}</p>
            <h2 className="truncate text-base font-semibold text-text-primary">{mode === 'create' ? 'Capture something' : 'Edit note'}</h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted/70 transition-colors hover:bg-text-primary/8 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
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
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
                      active ? cn(style.bg, style.border, style.text) : 'border-borderSoft/30 bg-panel/30 text-text-secondary hover:border-borderSoft/50',
                    )}
                  >
                    <NoteCategoryIcon icon={category.icon} className="h-3 w-3" />
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.4px] text-text-muted/60">Linked mission</p>
            <MissionPicker missions={missions} value={missionId} onChange={setMissionId} />
          </div>

          <div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write it down..."
              className="min-h-[200px] resize-none rounded-[18px] border-borderSoft/30 bg-panel2/40 text-[14px] leading-relaxed placeholder:text-text-muted/50"
            />
            <div className="mt-1.5 flex items-center justify-between px-1">
              <p className="text-[11px] text-text-muted/50">⌘/Ctrl + Enter to save</p>
              <p className={cn('text-[11px] tabular-nums', trimmedContent.length === 0 ? 'text-danger/70' : 'text-text-muted/50')}>{content.length} characters</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPinned((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-[14px] border px-3 py-2 text-[13px] font-medium transition-colors',
              pinned ? 'border-accent/40 bg-accent/12 text-accent' : 'border-borderSoft/30 bg-panel/30 text-text-secondary hover:border-borderSoft/50',
            )}
          >
            <Pin className={cn('h-3.5 w-3.5', pinned && 'fill-current')} />
            {pinned ? 'Pinned' : 'Pin this note'}
          </button>
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
            ) : mode === 'create' ? (
              'Add note'
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>
    </div>,
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

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-borderSoft/40 bg-panel pb-[env(safe-area-inset-bottom)] shadow-panel sm:rounded-[28px] sm:pb-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-borderSoft/25 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.4px] text-text-muted/60">Notes</p>
            <h2 className="truncate text-base font-semibold text-text-primary">Manage categories</h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted/70 transition-colors hover:bg-text-primary/8 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {categories.length > 0 ? (
            <div className="space-y-2">
              {categories.map((category) => {
                const style = getNoteColorStyle(category.color);
                return (
                  <div key={category.id} className="flex items-center gap-3 rounded-[14px] border border-borderSoft/25 bg-panel/30 px-3 py-2.5">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', style.bg, style.text)}>
                      <NoteCategoryIcon icon={category.icon} className="h-4 w-4" />
                    </div>
                    <span className="flex-1 truncate text-sm font-medium text-text-primary">{category.label}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      title="Edit category"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted/60 transition-colors hover:bg-emerald-500/12 hover:text-emerald-600/70"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Delete "${category.label}"? Notes in this category move to General.`)) {
                          await onDelete(category.id);
                          if (editingId === category.id) resetForm();
                        }
                      }}
                      title="Delete category"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted/60 transition-colors hover:bg-red-500/12 hover:text-red-600/70"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
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
      </div>
    </div>,
    document.body,
  );
}

export function NotesView() {
  const notes = useNoteStore((state) => state.notes);
  const categories = useNoteStore((state) => state.categories);
  const searchQuery = useNoteStore((state) => state.searchQuery);
  const activeCategoryId = useNoteStore((state) => state.activeCategoryId);
  const loading = useNoteStore((state) => state.loading);
  const error = useNoteStore((state) => state.error);
  const setSearchQuery = useNoteStore((state) => state.setSearchQuery);
  const setActiveCategoryId = useNoteStore((state) => state.setActiveCategoryId);
  const createNote = useNoteStore((state) => state.createNote);
  const updateNote = useNoteStore((state) => state.updateNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const togglePin = useNoteStore((state) => state.togglePin);
  const createCategory = useNoteStore((state) => state.createCategory);
  const updateCategory = useNoteStore((state) => state.updateCategory);
  const deleteCategory = useNoteStore((state) => state.deleteCategory);
  const refresh = useNoteStore((state) => state.refresh);

  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const missions = useMissionStore((state) => state.missions);

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

  const missionTitles = useMemo(() => {
    const map: Record<string, string> = {};
    missions.forEach((mission) => {
      map[mission.id] = mission.title;
    });
    return map;
  }, [missions]);

  const allCategories = useMemo(() => getAllCategories(categories), [categories]);

  const filteredNotes = useMemo(
    () =>
      filterNotes(notes, {
        query: searchQuery,
        categoryId: activeCategoryId,
        customCategories: categories,
        missionTitles,
      }),
    [notes, searchQuery, activeCategoryId, categories, missionTitles],
  );

  const pinnedCount = useMemo(() => notes.filter((note) => note.pinned).length, [notes]);

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
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      setOperationError(null);
      if (window.confirm('Delete this note?')) {
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

  return (
    <div className="space-y-6">
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
                💡 Tip: Make sure your Supabase migrations are applied. Run <code className="rounded bg-red-500/20 px-2 py-1 text-xs">supabase migration up --remote</code>
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.3px] text-text-primary">Notes</h1>
          <p className="mt-0.5 text-[13px] text-text-muted/60">
            {notes.length} note{notes.length === 1 ? '' : 's'} captured
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="h-10 rounded-full pl-10 text-[13px]"
            />
          </div>
          <Button onClick={() => setIsCreating(true)} size="md" type="button" className="shrink-0 text-[13px] font-medium">
            <Plus className="h-4 w-4" />
            New note
          </Button>
        </div>
      </div>

      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
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
              {notes.length === 0 ? 'Capture ideas, references, snippets, and more — all in one searchable place.' : 'Try a different search or category.'}
            </p>
            {notes.length === 0 && (
              <Button onClick={() => setIsCreating(true)} size="sm" type="button" className="mt-4 text-[13px] font-medium">
                <Plus className="h-4 w-4" />
                New note
              </Button>
            )}
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4">
            <AnimatePresence>
              {filteredNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  category={getCategoryById(note.category_id, categories)}
                  missionTitle={note.mission_id ? missionTitles[note.mission_id] ?? null : null}
                  onEdit={setEditingNote}
                  onDelete={handleDelete}
                  onTogglePin={handleTogglePin}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isCreating && (
          <NoteEditorModal
            mode="create"
            categories={allCategories}
            missions={missions}
            defaultCategoryId={activeCategoryId !== 'all' && activeCategoryId !== 'pinned' ? activeCategoryId : undefined}
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
