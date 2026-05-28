import { useEffect, useRef, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { DatePicker } from '../../components/ui/date-picker';
import { Input, Textarea } from '../../components/ui/input';
import { MissionIcon } from '../../components/ui/mission-icon';
import { cn } from '../../lib/cn';
import { useMissionStore } from '../missions/mission-store';
import { getSubtasks, humanizeEnergy, humanizeLane, humanizePriority } from './task-helpers';
import { useTaskStore } from './task-store';
import type { Task, TaskEnergy, TaskLane, TaskPriority } from './task-types';
import { Trash2 } from 'lucide-react';

interface TaskDetailPanelProps {
  task: Task;
  allTasks: Task[];
  onClose?: () => void;
  onOpenTask?: (taskId: string) => void;
}

const LANE_OPTIONS: TaskLane[] = ['inbox', 'now', 'next', 'later', 'done'];
const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'normal', 'high', 'critical'];
const ENERGY_OPTIONS: TaskEnergy[] = ['admin', 'shallow', 'deep'];

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
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt === value;
        const tone = toneMap?.(opt) ?? 'default';
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors',
              active
                ? tone === 'warning'
                  ? 'border-warning/40 bg-warning/12 text-warning'
                  : tone === 'success'
                    ? 'border-success/40 bg-success/12 text-success'
                    : 'border-accent/35 bg-accent/12 text-accent'
                : 'border-borderSoft/40 text-text-secondary hover:border-borderStrong/40 hover:text-text-primary',
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
    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">{children}</p>
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
  return (
    <div className="group flex items-center gap-3 rounded-[14px] border border-borderSoft/30 bg-panel/30 px-3 py-2.5">
      <button
        type="button"
        onClick={onMarkDone}
        disabled={subtask.lane === 'done'}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors',
          subtask.lane === 'done'
            ? 'border-success/40 bg-success/20 text-success'
            : 'border-borderStrong/30 text-text-muted hover:border-accent/40 hover:text-accent',
        )}
      >
        {subtask.lane === 'done' ? '✓' : ''}
      </button>
      <span className={cn('flex-1 text-sm', subtask.lane === 'done' ? 'text-text-muted line-through' : 'text-text-primary')}>
        {subtask.title}
      </span>
      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        {subtask.energy !== 'shallow' ? (
          <span className="text-[10px] text-text-muted">{humanizeEnergy(subtask.energy)}</span>
        ) : null}
        <span className="text-[10px] text-text-muted">{subtask.estimated_minutes}m</span>
        <button
          type="button"
          onClick={onDelete}
          className="ml-1 rounded p-1 text-text-muted hover:bg-warning/10 hover:text-warning"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
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
        className="flex w-full items-center gap-2 rounded-[14px] border border-dashed border-borderSoft/40 px-3 py-2 text-sm text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
      >
        <span className="text-base leading-none">+</span>
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
        className="h-9 flex-1 text-sm"
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-borderSoft/24 px-5 py-4">
        <div className="min-w-0 flex-1">
          {mission ? (
            <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-text-muted">
              <MissionIcon icon={mission.emoji} className="h-3 w-3" /> {mission.title}
            </p>
          ) : null}
          {parentTask ? (
            <button
              type="button"
              onClick={() => onOpenTask?.(parentTask.id)}
              className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-accent transition-colors hover:text-accent/80"
            >
              ← Parent: {parentTask.title}
            </button>
          ) : null}
          <input
            value={draft.title}
            onChange={(e) => update('title', e.target.value)}
            onBlur={() => void handleSave()}
            className="w-full bg-transparent text-lg font-semibold text-text-primary outline-none placeholder:text-text-muted"
            placeholder="Task title"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dirty ? (
            <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-borderSoft/40 text-sm text-text-muted transition-colors hover:text-text-primary"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 min-h-0 space-y-5 overflow-y-auto px-5 py-4">
        {/* Status chips */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <FieldLabel>Lane</FieldLabel>
            <ChipSelect
              options={LANE_OPTIONS}
              value={draft.lane}
              onChange={(v) => update('lane', v)}
              label={humanizeLane}
              toneMap={(v) => v === 'now' ? 'accent' : v === 'done' ? 'success' : 'default'}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Priority</FieldLabel>
            <ChipSelect
              options={PRIORITY_OPTIONS}
              value={draft.priority}
              onChange={(v) => update('priority', v)}
              label={humanizePriority}
              toneMap={(v) => v === 'critical' ? 'warning' : v === 'high' ? 'attention' : 'default'}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Energy</FieldLabel>
            <ChipSelect
              options={ENERGY_OPTIONS}
              value={draft.energy}
              onChange={(v) => update('energy', v)}
              label={humanizeEnergy}
              toneMap={(v) => v === 'deep' ? 'attention' : 'default'}
            />
          </div>
          <div className="flex gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Estimate</FieldLabel>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={draft.estimated_minutes}
                  onChange={(e) => update('estimated_minutes', Number(e.target.value))}
                  onBlur={() => void handleSave()}
                  className="w-16 rounded-[10px] border border-borderSoft/40 bg-panel/40 px-2 py-1 text-sm text-text-primary outline-none focus:border-accent/40"
                />
                <span className="text-xs text-text-muted">min</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Due date</FieldLabel>
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

        {/* Outcome */}
        <div className="space-y-1.5">
          <FieldLabel>Outcome</FieldLabel>
          <Textarea
            value={draft.outcome}
            onChange={(e) => update('outcome', e.target.value)}
            onBlur={() => void handleSave()}
            placeholder="What concretely exists when this is done?"
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        {/* Next action */}
        <div className="space-y-1.5">
          <FieldLabel>Next action</FieldLabel>
          <Input
            value={draft.next_action}
            onChange={(e) => update('next_action', e.target.value)}
            onBlur={() => void handleSave()}
            placeholder="The smallest step right now"
            className="text-sm"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <FieldLabel>Notes</FieldLabel>
          <Textarea
            value={draft.notes}
            onChange={(e) => update('notes', e.target.value)}
            onBlur={() => void handleSave()}
            placeholder="Links, context, anything else."
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <FieldLabel>Tags <span className="normal-case tracking-normal text-text-muted/60">(comma separated)</span></FieldLabel>
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
            placeholder="e.g. backend, auth, bug"
            className="text-sm"
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FieldLabel>Subtasks</FieldLabel>
            {subtasks.length > 0 ? (
              <span className="text-[10px] text-text-muted">
                {doneSubtasks}/{subtasks.length} done
              </span>
            ) : null}
          </div>
          <div className="space-y-2">
            {subtasks.map((sub) => (
              <SubtaskRow
                key={sub.id}
                subtask={sub}
                onMarkDone={() => void markDone(sub.id)}
                onDelete={() => void deleteTask(sub.id)}
              />
            ))}
            <AddSubtaskRow onAdd={handleAddSubtask} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-borderSoft/24 px-5 py-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => void markDone(task.id)}
            disabled={task.lane === 'done'}
            variant={task.lane === 'done' ? 'ghost' : 'primary'}
          >
            {task.lane === 'done' ? 'Completed ✓' : 'Mark done'}
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleDelete()}
            className={cn(
              'text-text-muted hover:text-warning',
              confirmDelete ? 'bg-warning/10 text-warning' : ''
            )}
          >
            <Trash2 size={16} className="mr-2" />
            {confirmDelete ? 'Confirm delete?' : 'Delete'}
          </Button>
          
          {confirmDelete && (
            <button 
              className="text-xs text-text-muted hover:text-text-primary"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {draft.completed_at ? (
            <p className="text-xs text-text-muted">
              Done {new Date(draft.completed_at).toLocaleDateString()}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
