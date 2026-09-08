import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { DatePicker } from '../../components/ui/date-picker';
import { Input, Textarea } from '../../components/ui/input';
import { MissionIcon } from '../../components/ui/mission-icon';
import { confirmDialog } from '../../components/ui/native-dialog';
import { cn } from '../../lib/cn';
import { useMissionStore } from '../missions/mission-store';
import { useSettingsStore } from '../settings/settings-store';
import { SparkleBurst } from '../../character/effects-assets';
import { getSubtasks, humanizeEnergy, humanizeLane, humanizePriority } from './task-helpers';
import { useTaskStore } from './task-store';
import type { Task, TaskEnergy, TaskLane, TaskPriority } from './task-types';
import { AssigneeSelect } from '../collaborators/AssigneeSelect';
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleGauge,
  Flag,
  ListChecks,
  Tag,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';

interface TaskDetailPanelProps {
  task: Task;
  allTasks: Task[];
  onClose?: () => void;
  onOpenTask?: (taskId: string) => void;
}

const LANE_OPTIONS: TaskLane[] = ['inbox', 'now', 'next', 'later', 'done'];
const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'normal', 'high', 'critical'];
const ENERGY_OPTIONS: TaskEnergy[] = ['admin', 'shallow', 'deep'];
const ESTIMATE_PRESETS = [15, 30, 45, 60, 90, 120, 240];

/** "45m", "1h", "1h 30m" — minutes stay the stored unit; this is display-only. */
function humanizeMinutes(total: number) {
  if (!total || total < 60) {
    return `${total || 0}m`;
  }
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  label,
  toneMap,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
  toneMap?: (v: T) => 'default' | 'accent' | 'warning' | 'success' | 'attention';
}) {
  return (
    <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-borderSoft/35 bg-panel2/50 p-1">
      {options.map((opt) => {
        const active = opt === value;
        const tone = toneMap?.(opt) ?? 'default';
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium transition-all duration-150',
              active
                ? tone === 'warning'
                  ? 'border border-warning/25 bg-warning/15 text-warning font-semibold shadow-xs'
                  : tone === 'success'
                    ? 'border border-success/25 bg-success/15 text-success font-semibold shadow-xs'
                    : tone === 'accent' || tone === 'attention'
                      ? 'border border-accent/30 bg-accent/15 text-accent font-semibold shadow-xs'
                      : 'border border-borderSoft/60 bg-panel text-text-primary font-semibold shadow-xs'
                : 'border border-transparent text-text-muted hover:bg-panel/50 hover:text-text-primary',
            )}
          >
            {label(opt)}
          </button>
        );
      })}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">{children}</p>
  );
}

function SectionLabel({
  icon: Icon,
  children,
  aside,
}: {
  icon: typeof Flag;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        <Icon size={14} className="text-text-muted" />
        <span>{children}</span>
      </div>
      {aside}
    </div>
  );
}

function SubtaskRow({
  subtask,
  onMarkDone,
  onDelete,
}: {
  subtask: Task;
  onMarkDone: () => void;
  onDelete: () => void;
}) {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -6, transition: { duration: 0.18 } }}
      className="group flex items-center gap-3 rounded-xl border border-borderSoft/35 bg-panel2/40 px-3.5 py-2.5 transition-colors hover:border-borderSoft/60 hover:bg-panel2/60"
    >
      <motion.button
        type="button"
        whileHover={reduceMotion ? {} : { scale: 1.15 }}
        whileTap={reduceMotion ? {} : { scale: 0.8 }}
        onClick={onMarkDone}
        disabled={subtask.lane === 'done'}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors',
          subtask.lane === 'done'
            ? 'border-success/40 bg-success/20 text-success'
            : 'border-borderStrong/35 text-text-muted hover:border-accent/40 hover:text-accent',
        )}
      >
        {subtask.lane === 'done' ? '✓' : ''}
      </motion.button>
      <span className={cn('flex-1 text-sm leading-snug transition-all', subtask.lane === 'done' ? 'text-text-muted line-through opacity-70' : 'text-text-primary font-medium')}>
        {subtask.title}
      </span>
      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        {subtask.energy !== 'shallow' ? (
          <span className="rounded-md bg-panel px-1.5 py-0.5 text-[10px] text-text-muted border border-borderSoft/30">{humanizeEnergy(subtask.energy)}</span>
        ) : null}
        <span className="rounded-md bg-panel px-1.5 py-0.5 text-[10px] text-text-muted border border-borderSoft/30">{subtask.estimated_minutes}m</span>
        <motion.button
          type="button"
          whileHover={reduceMotion ? {} : { scale: 1.15 }}
          whileTap={reduceMotion ? {} : { scale: 0.85 }}
          onClick={onDelete}
          className="ml-1 rounded-md p-1 text-text-muted hover:bg-warning/10 hover:text-warning transition-colors"
          title="Delete subtask"
        >
          <Trash2 size={13} />
        </motion.button>
      </div>
    </motion.div>
  );
}

function AddSubtaskRow({
  onAdd,
}: {
  onAdd: (title: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onAdd(trimmed);
      setTitle('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-borderSoft/45 bg-panel2/20 px-3.5 py-2.5 text-xs font-medium text-text-muted transition-colors hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
      >
        <span className="text-base leading-none font-bold">+</span>
        Add subtask
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSave();
          if (e.key === 'Escape') { setOpen(false); setTitle(''); }
        }}
        placeholder="Subtask title…"
        className="h-9 flex-1 text-sm bg-panel border-borderSoft/45"
      />
      <Button size="sm" type="button" onClick={() => void handleSave()} disabled={!title.trim() || saving}>
        {saving ? '…' : 'Add'}
      </Button>
      <Button size="sm" type="button" variant="ghost" onClick={() => { setOpen(false); setTitle(''); }}>
        ✕
      </Button>
    </div>
  );
}

export function TaskDetailPanel({ task, allTasks, onClose, onOpenTask }: TaskDetailPanelProps) {
  const saveTask = useTaskStore((s) => s.saveTask);
  const createSubtask = useTaskStore((s) => s.createSubtask);
  const markDone = useTaskStore((s) => s.markDone);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const missions = useMissionStore((s) => s.missions);

  const [draft, setDraft] = useState<Task>(task);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync when selected task changes
  useEffect(() => {
    setDraft(task);
    setDirty(false);
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const subtasks = getSubtasks(allTasks, task.id);
  const doneSubtasks = subtasks.filter((s) => s.lane === 'done').length;
  const mission = missions.find((m) => m.id === draft.mission_id);
  const parentTask = task.parent_task_id ? allTasks.find((t) => t.id === task.parent_task_id) : null;

  function update<K extends keyof Task>(field: K, value: Task[K]) {
    setDraft((d) => ({ ...d, [field]: value }));
    setDirty(true);
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await saveTask({ ...draft, updated_at: new Date().toISOString() });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSubtask(title: string) {
    await createSubtask(task.id, {
      title,
      mission_id: task.mission_id,
      lane: 'inbox',
      energy: 'shallow',
      priority: 'normal',
    });
  }

  async function handleDelete() {
    if (confirmDelete) {
      await deleteTask(task.id);
      onClose?.();
    } else {
      setConfirmDelete(true);
    }
  }

  const progress = subtasks.length ? Math.round((doneSubtasks / subtasks.length) * 100) : 0;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      {/* Header */}
      <div className="border-b border-borderSoft/30 px-6 sm:px-7 pb-5 pt-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {mission ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/12 px-2.5 py-0.5 text-xs font-semibold text-accent">
                <MissionIcon icon={mission.emoji} className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{mission.title}</span>
              </span>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-text-muted">Task details</span>
            )}
            {parentTask ? (
              <button
                type="button"
                onClick={() => onOpenTask?.(parentTask.id)}
                className="mt-2 flex max-w-full items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                <span className="truncate font-medium">{parentTask.title}</span>
                <ChevronRight size={12} />
              </button>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close task details"
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-panel2 hover:text-text-primary"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            value={draft.title}
            onChange={(e) => update('title', e.target.value)}
            onBlur={() => void handleSave()}
            rows={2}
            className="w-full resize-none bg-transparent text-xl sm:text-2xl font-bold leading-snug tracking-tight text-text-primary outline-none placeholder:text-text-muted"
            placeholder="Task title"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-borderSoft/35 bg-panel2/60 px-2.5 py-0.5 text-xs font-medium text-text-secondary">
            {humanizeLane(draft.lane)}
          </span>
          <span className="rounded-md border border-borderSoft/35 bg-panel2/60 px-2.5 py-0.5 text-xs font-medium text-text-secondary capitalize">
            {humanizePriority(draft.priority)} priority
          </span>
          <span className="text-text-muted">•</span>
          <span className="text-xs font-medium text-text-muted">
            {humanizeMinutes(draft.estimated_minutes)}
          </span>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 sm:px-7 py-6">
        {/* Description */}
        <div className="space-y-2">
          <SectionLabel icon={ListChecks}>Description</SectionLabel>
          <Textarea
            value={draft.notes}
            onChange={(e) => update('notes', e.target.value)}
            onBlur={() => void handleSave()}
            placeholder="Add context, links, or anything you need to remember…"
            rows={4}
            className="min-h-[110px] resize-y rounded-xl border border-borderSoft/40 bg-panel2/40 px-4 py-3 text-sm leading-relaxed text-text-primary placeholder:text-text-muted outline-none transition focus:border-accent/40 focus:bg-panel2/70"
          />
        </div>

        {/* Properties Container */}
        <div className="space-y-3">
          <SectionLabel icon={CircleGauge}>Properties</SectionLabel>
          <div className="space-y-4 rounded-2xl border border-borderSoft/35 bg-panel2/25 p-4 sm:p-5">
            {/* Status */}
            <div className="space-y-2">
              <FieldLabel>Status</FieldLabel>
              <ChipSelect
                options={LANE_OPTIONS}
                value={draft.lane}
                onChange={(v) => update('lane', v)}
                label={humanizeLane}
                toneMap={(v) => v === 'now' ? 'accent' : v === 'done' ? 'success' : 'default'}
              />
            </div>

            {/* Priority & Energy */}
            <div className="grid grid-cols-1 gap-4 border-t border-borderSoft/25 pt-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Flag size={12} className="text-text-muted" />
                  <FieldLabel>Priority</FieldLabel>
                </div>
                <ChipSelect
                  options={PRIORITY_OPTIONS}
                  value={draft.priority}
                  onChange={(v) => update('priority', v)}
                  label={humanizePriority}
                  toneMap={(v) => v === 'critical' ? 'warning' : v === 'high' ? 'attention' : 'default'}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Zap size={12} className="text-text-muted" />
                  <FieldLabel>Energy</FieldLabel>
                </div>
                <ChipSelect
                  options={ENERGY_OPTIONS}
                  value={draft.energy}
                  onChange={(v) => update('energy', v)}
                  label={humanizeEnergy}
                  toneMap={(v) => v === 'deep' ? 'attention' : 'default'}
                />
              </div>
            </div>

            {/* Estimate */}
            <div className="space-y-2 border-t border-borderSoft/25 pt-4">
              <FieldLabel>Estimate</FieldLabel>
              <div className="flex flex-wrap gap-1 rounded-xl border border-borderSoft/35 bg-panel2/50 p-1">
                {ESTIMATE_PRESETS.map((preset) => {
                  const active = draft.estimated_minutes === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        update('estimated_minutes', preset);
                        void handleSave();
                      }}
                      className={cn(
                        'inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium transition-all',
                        active
                          ? 'border border-borderSoft/60 bg-panel text-text-primary font-semibold shadow-xs'
                          : 'border border-transparent text-text-muted hover:bg-panel/50 hover:text-text-primary',
                      )}
                    >
                      {humanizeMinutes(preset)}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    value={draft.estimated_minutes}
                    onChange={(e) => update('estimated_minutes', Number(e.target.value))}
                    onBlur={() => void handleSave()}
                    className="h-8 w-18 rounded-lg border border-borderSoft/40 bg-panel px-2.5 text-xs font-medium text-text-primary outline-none focus:border-accent"
                  />
                  <span className="text-xs text-text-muted">min</span>
                </div>
                {draft.estimated_minutes >= 60 ? (
                  <span className="text-xs text-text-muted font-medium">(= {humanizeMinutes(draft.estimated_minutes)})</span>
                ) : null}
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2 border-t border-borderSoft/25 pt-4">
              <div className="flex items-center gap-1.5">
                <CalendarDays size={12} className="text-text-muted" />
                <FieldLabel>Due date</FieldLabel>
              </div>
              <DatePicker
                value={draft.due_date}
                onChange={(date) => {
                  update('due_date', date);
                  void handleSave();
                }}
              />
            </div>
          </div>
        </div>

        {/* Assignees */}
        <div className="space-y-2">
          <SectionLabel icon={Users}>Assignees</SectionLabel>
          <AssigneeSelect
            value={draft.assignee_ids}
            onChange={(ids) => {
              const next = { ...draft, assignee_ids: ids, updated_at: new Date().toISOString() };
              setDraft(next);
              setDirty(false);
              void saveTask(next);
            }}
          />
        </div>

        {/* Completion note */}
        {draft.lane === 'done' ? (
          <div className="space-y-1.5 rounded-xl border border-success/30 bg-success/8 p-3.5">
            <FieldLabel>
              <span className="text-success">Completion note</span>
            </FieldLabel>
            <Textarea
              value={draft.completion_note}
              onChange={(e) => update('completion_note', e.target.value)}
              onBlur={() => void handleSave()}
              placeholder="What actually got done? Outcome, blockers, follow-ups…"
              rows={3}
              className="resize-none text-sm bg-panel/70 border-success/20"
            />
          </div>
        ) : null}

        {/* Tags */}
        <div className="space-y-2">
          <SectionLabel icon={Tag}>Tags</SectionLabel>
          <Input
            value={draft.tags.join(', ')}
            onChange={(e) =>
              update(
                'tags',
                e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              )
            }
            onBlur={() => void handleSave()}
            placeholder="Add tags, separated by commas"
            className="h-10 rounded-xl border-borderSoft/40 bg-panel2/40 text-sm placeholder:text-text-muted focus:border-accent/40 focus:bg-panel2/70"
          />
          {draft.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {draft.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {/* Subtasks */}
        <div className="space-y-3">
          <SectionLabel
            icon={ListChecks}
            aside={subtasks.length > 0 ? <span className="text-xs font-semibold text-text-muted">{doneSubtasks}/{subtasks.length} done</span> : null}
          >Subtasks</SectionLabel>
          {subtasks.length > 0 ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-panel2/70 border border-borderSoft/20">
              <div className="h-full rounded-full bg-success transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          ) : null}
          <div className="space-y-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {subtasks.map((sub) => (
                <SubtaskRow
                  key={sub.id}
                  subtask={sub}
                  onMarkDone={() => void markDone(sub.id)}
                  onDelete={() => { void confirmDialog(`Delete subtask “${sub.title}”?`, { title: 'Delete subtask', confirmLabel: 'Delete', danger: true }).then((ok) => { if (ok) void deleteTask(sub.id); }); }}
                />
              ))}
            </AnimatePresence>
            <AddSubtaskRow onAdd={handleAddSubtask} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-borderSoft/30 bg-panel/95 px-6 sm:px-7 py-3.5 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            size="sm"
            onClick={async () => {
              if (dirty) await handleSave();
              await markDone(task.id);
              setDraft((d) => ({
                ...d,
                lane: 'done',
                status: 'done',
                completed_at: d.completed_at ?? new Date().toISOString(),
              }));
            }}
            disabled={task.lane === 'done'}
            variant={task.lane === 'done' ? 'secondary' : 'primary'}
            className="relative min-w-[116px] rounded-xl font-semibold overflow-hidden"
          >
            {task.lane === 'done' && <SparkleBurst className="-top-2 -right-2" />}
            <Check size={16} />
            {task.lane === 'done' ? 'Completed' : 'Mark done'}
          </Button>
          {dirty ? <span className="truncate text-xs font-medium text-text-muted">{saving ? 'Saving…' : 'Unsaved changes'}</span> : null}
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button className="px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary transition-colors" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="rounded-xl bg-danger/15 border border-danger/25 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/25 transition-colors" onClick={() => void handleDelete()}>Delete task</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleDelete()}
            aria-label="Delete task"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
