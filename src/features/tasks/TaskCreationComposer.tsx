import {
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Button } from '../../components/ui/button';
import { Input, Textarea } from '../../components/ui/input';
import { cn } from '../../lib/cn';
import type { ActivitySource } from '../activity/activity-repository';
import type { TaskClarification } from '../ai/ai-types';
import { getTaskAiAssistant } from '../ai/mock-ai-provider';
import { MissionComposer } from '../missions/MissionComposer';
import type { MissionDraft } from '../missions/mission-types';
import { useMissionStore } from '../missions/mission-store';
import { useTaskStore } from './task-store';
import type { Task, TaskDraft, TaskEnergy, TaskLane, TaskPriority } from './task-types';

interface TaskCreationComposerProps {
  source: ActivitySource;
  submitLabel: string;
  onCancel?: () => void;
  onSubmitted?: () => void | Promise<void>;
  onCreated?: (task: Task) => void | Promise<void>;
  autoFocus?: boolean;
  compact?: boolean;
  fillHeight?: boolean;
  lane?: TaskDraft['lane'];
  priority?: TaskDraft['priority'];
  status?: TaskDraft['status'];
  parentTaskId?: string | null;
}

interface ComposerDraft {
  title: string;
  outcome: string;
  firstStep: string;
  notes: string;
  checklist: string;
  missionId: string | null;
  lane: TaskLane;
  priority: TaskPriority;
  energy: TaskEnergy;
  estimatedMinutes: number;
  estimateAuto: boolean;
}

const LANE_OPTIONS: Array<{ id: TaskLane; label: string }> = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'now', label: 'Now' },
  { id: 'next', label: 'Next' },
  { id: 'later', label: 'Later' },
];

const PRIORITY_OPTIONS: Array<{ id: TaskPriority; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
  { id: 'critical', label: 'Critical' },
];

const ENERGY_OPTIONS: Array<{ id: TaskEnergy; label: string }> = [
  { id: 'admin', label: 'Admin' },
  { id: 'shallow', label: 'Shallow' },
  { id: 'deep', label: 'Deep' },
];

const ESTIMATE_OPTIONS = [5, 15, 25, 50, 90];

const VAGUE_ANSWERS = new Set([
  'done', 'finished', 'complete', 'completed', 'ready', 'shipped', 'fixed', 'good', 'ok',
]);

const ESTIMATE_KEYWORDS: Array<{ minutes: number; words: RegExp }> = [
  { minutes: 15, words: /\b(quick|fix|tweak|patch|nudge|bump|small|tiny)\b/i },
  { minutes: 25, words: /\b(review|respond|reply|check|skim|read|update)\b/i },
  { minutes: 50, words: /\b(build|implement|create|draft|write|wire|setup|set up)\b/i },
  { minutes: 90, words: /\b(redesign|research|investigate|rewrite|migrate|refactor|design)\b/i },
];

function detectEstimate(title: string): number | null {
  const trimmed = title.trim();
  if (trimmed.length < 4) return null;
  for (const { minutes, words } of ESTIMATE_KEYWORDS) {
    if (words.test(trimmed)) return minutes;
  }
  return null;
}

function isVague(value: string) {
  return VAGUE_ANSWERS.has(value.trim().toLowerCase().replace(/[.!?]+$/, ''));
}

const INITIAL_DRAFT: ComposerDraft = {
  title: '',
  outcome: '',
  firstStep: '',
  notes: '',
  checklist: '',
  missionId: null,
  lane: 'inbox',
  priority: 'normal',
  energy: 'shallow',
  estimatedMinutes: 25,
  estimateAuto: false,
};

function buildTaskDraft(
  draft: ComposerDraft,
  clarification: TaskClarification | null,
  defaults: Pick<TaskDraft, 'status'>,
  parentTaskId?: string | null,
): TaskDraft {
  return {
    title: draft.title.trim() || clarification?.suggestedTitle || '',
    mission_id: draft.missionId,
    parent_task_id: parentTaskId ?? null,
    outcome: draft.outcome.trim() || clarification?.outcome || '',
    next_action: draft.firstStep.trim() || clarification?.nextAction || '',
    notes: draft.notes.trim(),
    lane: draft.lane,
    priority: draft.priority,
    energy: draft.energy,
    estimated_minutes: draft.estimatedMinutes,
    status: defaults.status,
  };
}

function parseChecklistItems(value: string) {
  return value
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^[-*]\s+/, '')
        .replace(/^\[\s?\]\s+/, '')
        .replace(/^\d+[.)]\s+/, ''),
    )
    .filter(Boolean);
}

export function TaskCreationComposer({
  source,
  submitLabel,
  onCancel,
  onSubmitted,
  onCreated,
  autoFocus = false,
  compact = false,
  fillHeight = false,
  lane = 'inbox',
  priority = 'normal',
  status = 'captured',
  parentTaskId = null,
}: TaskCreationComposerProps) {
  const createTask = useTaskStore((state) => state.createTask);
  const createSubtask = useTaskStore((state) => state.createSubtask);
  const missions = useMissionStore((state) => state.missions);
  const createMission = useMissionStore((state) => state.createMission);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const composerId = useId();
  const titleInputId = `${composerId}-title`;
  const titleHelpId = `${composerId}-title-help`;
  const outcomeId = `${composerId}-outcome`;
  const firstStepId = `${composerId}-first-step`;
  const notesId = `${composerId}-notes`;
  const detailsId = `${composerId}-details`;

  const [draft, setDraft] = useState<ComposerDraft>({ ...INITIAL_DRAFT, lane, priority });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [clarification, setClarification] = useState<TaskClarification | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMissionComposer, setShowMissionComposer] = useState(false);
  const [isSavingMission, setIsSavingMission] = useState(false);
  const deferredTitle = useDeferredValue(draft.title);

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  // Auto-detect estimate from title keywords
  useEffect(() => {
    if (!draft.estimateAuto && draft.estimatedMinutes !== INITIAL_DRAFT.estimatedMinutes) return;
    const detected = detectEstimate(deferredTitle);
    if (detected !== null) {
      setDraft((current) =>
        current.estimatedMinutes === detected
          ? current
          : { ...current, estimatedMinutes: detected, estimateAuto: true },
      );
    }
  }, [deferredTitle, draft.estimateAuto, draft.estimatedMinutes]);

  // AI clarification on debounce
  useEffect(() => {
    const trimmed = deferredTitle.trim();
    if (trimmed.length < 6) {
      setClarification(null);
      setIsThinking(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      startTransition(() => setIsThinking(true));
      void getTaskAiAssistant()
        .clarifyTask(trimmed)
        .then((next) => {
          if (cancelled) return;
          setClarification(next);
          setIsThinking(false);
        })
        .catch(() => {
          if (!cancelled) setIsThinking(false);
        });
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [deferredTitle]);

  const canSave = draft.title.trim().length > 0;
  const outcomeIsVague = draft.outcome.length > 0 && isVague(draft.outcome);
  const checklistItems = useMemo(() => parseChecklistItems(draft.checklist), [draft.checklist]);

  function update<K extends keyof ComposerDraft>(field: K, value: ComposerDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function applyClarification() {
    if (!clarification) return;
    setDraft((current) => ({
      ...current,
      outcome: current.outcome || clarification.outcome || '',
      firstStep: current.firstStep || clarification.nextAction || '',
    }));
    setDetailsOpen(true);
  }

  function reset() {
    setDraft({ ...INITIAL_DRAFT, lane, priority });
    setClarification(null);
    setDetailsOpen(false);
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      const task = await createTask(buildTaskDraft(draft, clarification, { status }, parentTaskId), source);
      if (checklistItems.length > 0) {
        await Promise.all(
          checklistItems.map((title) =>
            createSubtask(
              task.id,
              {
                title,
                mission_id: task.mission_id,
                lane: 'inbox',
                energy: 'shallow',
                priority: 'normal',
              },
              source,
            ),
          ),
        );
      }
      await onCreated?.(task);
      reset();
      await onSubmitted?.();
    } finally {
      setIsSaving(false);
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      onCancel();
    }
  }

  async function handleCreateMission(missionDraft: MissionDraft) {
    setIsSavingMission(true);
    try {
      const mission = await createMission(missionDraft);
      update('missionId', mission.id);
      setShowMissionComposer(false);
    } finally {
      setIsSavingMission(false);
    }
  }

  const previewTitle = useMemo(
    () => draft.title.trim() || clarification?.suggestedTitle || 'New task',
    [draft.title, clarification],
  );

  const showClarificationCta = Boolean(
    clarification &&
      (clarification.outcome || clarification.nextAction) &&
      !draft.outcome &&
      !draft.firstStep,
  );

  const activeMissions = missions.filter((m) => m.status === 'active');

  const filledDetailCount = [draft.outcome, draft.firstStep, draft.notes, draft.checklist].filter(
    (s) => s.trim().length > 0,
  ).length;

  return (
    <>
      <form
        ref={formRef}
        className={cn(fillHeight ? 'flex h-full min-h-0 flex-col' : '')}
        onKeyDown={handleEscape}
        onSubmit={(event) => void handleSubmit(event)}
      >
      <div
        className={cn(
          fillHeight ? 'min-h-0 flex-1 overflow-y-auto pr-1' : '',
          compact ? 'space-y-4' : 'space-y-5',
        )}
      >
        {/* Title — the only required field */}
        <div className="space-y-2">
          <label
            className="block text-[11px] uppercase tracking-[0.28em] text-text-muted"
            htmlFor={titleInputId}
          >
            What are you working on?
          </label>
          <Input
            ref={titleRef}
            aria-describedby={titleHelpId}
            id={titleInputId}
            value={draft.title}
            onChange={(event) => update('title', event.target.value)}
            placeholder='e.g. "Fix kanban drag handle on touch devices"'
            className="h-14 text-base"
          />
          <p id={titleHelpId} className="text-xs text-text-muted">
            Press Enter to save. Use Ctrl/Cmd+Enter from the optional fields below.
          </p>
          {isThinking ? (
            <p className="text-xs text-text-muted">Thinking…</p>
          ) : showClarificationCta ? (
            <button
              type="button"
              onClick={applyClarification}
              className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/8 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/15"
            >
              ✨ Use AI suggestions
            </button>
          ) : null}
        </div>

        {/* Inline metadata chips */}
        <div className="rounded-[24px] border border-borderSoft/24 bg-panel/16 p-3 sm:p-4">
          <div className="space-y-3">
            {/* Mission selector — dropdown + create button */}
            {!parentTaskId ? (
              <MissionSelector
                missions={activeMissions}
                selectedMissionId={draft.missionId}
                onSelectMission={(id) => update('missionId', id)}
                onAddMission={() => setShowMissionComposer(true)}
              />
            ) : null}

            <ChipRow label="Lane">
              {LANE_OPTIONS.map((option) => (
                <Chip key={option.id} active={draft.lane === option.id} onClick={() => update('lane', option.id)}>
                  {option.label}
                </Chip>
              ))}
            </ChipRow>

            <ChipRow label="Energy">
              {ENERGY_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  active={draft.energy === option.id}
                  tone={option.id === 'deep' ? 'attention' : 'default'}
                  onClick={() => update('energy', option.id)}
                >
                  {option.label}
                </Chip>
              ))}
            </ChipRow>

            <ChipRow label="Estimate">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={draft.estimatedMinutes}
                  onChange={(e) => setDraft((c) => ({ ...c, estimatedMinutes: Number(e.target.value) || 25, estimateAuto: false }))}
                  className="w-20 rounded-full border border-borderSoft/40 bg-panel/40 px-3 py-2 text-xs font-medium text-text-primary outline-none transition-colors focus:border-accent/40"
                />
                <span className="text-xs text-text-muted">min</span>
              </div>
              <div className="flex gap-1">
                {ESTIMATE_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDraft((c) => ({ ...c, estimatedMinutes: minutes, estimateAuto: false }))}
                    className={cn(
                      'h-7 rounded-full border text-[10px] font-medium transition-colors px-2',
                      draft.estimatedMinutes === minutes
                        ? 'border-accent/35 bg-accent/12 text-accent'
                        : 'border-borderSoft/40 text-text-secondary hover:border-borderStrong/40 hover:text-text-primary',
                    )}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>
            </ChipRow>

            <ChipRow label="Priority">
              {PRIORITY_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  active={draft.priority === option.id}
                  tone={option.id === 'critical' ? 'warning' : option.id === 'high' ? 'attention' : 'default'}
                  onClick={() => update('priority', option.id)}
                >
                  {option.label}
                </Chip>
              ))}
            </ChipRow>
          </div>
        </div>

        {/* Add details — collapsible */}
        <div className="rounded-[24px] border border-borderSoft/30 bg-panel/24">
          <button
            type="button"
            aria-controls={detailsId}
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 rounded-[24px] px-4 py-3 text-left transition-colors hover:bg-panel/36"
          >
            <span className="text-sm font-medium text-text-primary">
              {detailsOpen ? '▾ Details' : '▸ Add details (optional)'}
            </span>
            <span className="text-xs text-text-muted">{filledDetailCount} filled</span>
          </button>

          {detailsOpen ? (
            <div className="space-y-4 border-t border-borderSoft/24 px-4 py-4" id={detailsId}>
              <div className="space-y-2">
                <label
                  className="block text-[11px] uppercase tracking-[0.28em] text-text-muted"
                  htmlFor={outcomeId}
                >
                  Outcome
                </label>
                <Textarea
                  id={outcomeId}
                  value={draft.outcome}
                  onChange={(event) => update('outcome', event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="What concretely exists when this is done?"
                  rows={2}
                  className="resize-none"
                />
                {outcomeIsVague ? (
                  <p className="text-xs text-warning">
                    Try something more concrete — what would prove it&rsquo;s actually done?
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label
                  className="block text-[11px] uppercase tracking-[0.28em] text-text-muted"
                  htmlFor={firstStepId}
                >
                  First step
                </label>
                <Input
                  id={firstStepId}
                  value={draft.firstStep}
                  onChange={(event) => update('firstStep', event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault();
                      formRef.current?.requestSubmit();
                    }
                  }}
                  placeholder="The smallest action that breaks inertia."
                />
              </div>

              <div className="space-y-2">
                <label
                  className="block text-[11px] uppercase tracking-[0.28em] text-text-muted"
                  htmlFor={notesId}
                >
                  Notes
                </label>
                <Textarea
                  id={notesId}
                  value={draft.notes}
                  onChange={(event) => update('notes', event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Links, context, anything else."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {!parentTaskId ? (
                <div className="space-y-2">
                  <label
                    className="block text-[11px] uppercase tracking-[0.28em] text-text-muted"
                    htmlFor={`${composerId}-checklist`}
                  >
                    Checklist
                  </label>
                  <Textarea
                    id={`${composerId}-checklist`}
                    value={draft.checklist}
                    onChange={(event) => update('checklist', event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder={'One subtask per line\n- Confirm API response\n- Update HUD state\n- Test login redirect'}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
                    <span>Each line becomes a real subtask on save.</span>
                    <span>{checklistItems.length} item{checklistItems.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-t border-borderSoft/24',
          fillHeight
            ? 'shrink-0 mt-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]'
            : 'mt-5 pt-4',
        )}
      >
        <div className="flex items-center gap-2">
          <Button disabled={!canSave || isSaving} size="md" type="submit">
            {isSaving ? 'Saving…' : submitLabel}
          </Button>
          <span className="hidden text-[11px] text-text-muted sm:inline">
            <kbd className="rounded border border-borderSoft/40 bg-panel/50 px-1.5 py-0.5 font-mono text-[10px]">
              ↵
            </kbd>{' '}
            to save
          </span>
        </div>

        <div className="flex items-center gap-3">
          <p className="hidden max-w-[240px] truncate text-xs text-text-muted sm:block">{previewTitle}</p>
          {onCancel ? (
            <Button onClick={onCancel} size="md" type="button" variant="ghost">
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
      </form>

      {/* Mission creation modal */}
      {showMissionComposer ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-[500px] overflow-y-auto rounded-t-[24px] border border-borderSoft/30 bg-panel p-6 pb-[calc(var(--mobile-nav-height)+1rem)] shadow-2xl sm:rounded-[24px] sm:pb-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Create mission</h2>
              <button
                type="button"
                onClick={() => setShowMissionComposer(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            <MissionComposer
              submitLabel={isSavingMission ? 'Saving…' : 'Create'}
              onSubmit={handleCreateMission}
              onCancel={() => setShowMissionComposer(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

// ──────────────────────────────────────────
// Internal UI helpers
// ──────────────────────────────────────────

interface Mission {
  id: string;
  emoji: string;
  title: string;
}

function MissionSelector({
  missions,
  selectedMissionId,
  onSelectMission,
  onAddMission,
}: {
  missions: Mission[];
  selectedMissionId: string | null;
  onSelectMission: (id: string | null) => void;
  onAddMission: () => void;
}) {
  return (
    <ChipRow label="Mission">
      <select
        value={selectedMissionId ?? 'none'}
        onChange={(e) => onSelectMission(e.target.value === 'none' ? null : e.target.value)}
        className={cn(
          'h-8 rounded-full border bg-panel/40 px-3 text-xs font-medium transition-colors',
          selectedMissionId
            ? 'border-accent/35 bg-accent/12 text-accent'
            : 'border-borderSoft/40 text-text-secondary hover:border-borderStrong/40 hover:text-text-primary',
        )}
      >
        <option value="none">None</option>
        {missions.map((mission) => (
          <option key={mission.id} value={mission.id}>
            {mission.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onAddMission}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-borderSoft/40 bg-transparent px-3 text-xs font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-accent"
      >
        <span>+</span> Add
      </button>
    </ChipRow>
  );
}

function ChipRow({
  label,
  children,
  trailing,
}: {
  label: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <span className="text-[10px] uppercase tracking-[0.28em] text-text-muted sm:w-[72px] sm:shrink-0 sm:pt-1">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {trailing}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  tone = 'default',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'attention' | 'warning';
}) {
  const inactiveTone =
    tone === 'warning'
      ? 'border-warning/30 text-warning hover:border-warning/50'
      : tone === 'attention'
        ? 'border-borderSoft/40 text-text-secondary hover:border-accent/35 hover:text-text-primary'
        : 'border-borderSoft/40 text-text-secondary hover:border-borderStrong/40 hover:text-text-primary';

  const activeTone =
    tone === 'warning'
      ? 'border-warning/40 bg-warning/12 text-warning'
      : 'border-accent/35 bg-accent/12 text-accent';

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center rounded-full border bg-panel/40 px-3 text-xs font-medium transition-colors',
        active ? activeTone : inactiveTone,
      )}
    >
      {children}
    </button>
  );
}
