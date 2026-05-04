import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input, Textarea } from '../../components/ui/input';
import { cn } from '../../lib/cn';
import type { ActivitySource } from '../activity/activity-repository';
import type { TaskClarification } from '../ai/ai-types';
import { getTaskAiAssistant } from '../ai/mock-ai-provider';
import { useTaskStore } from './task-store';
import type { Task, TaskClarifyingQuestion, TaskDraft, TaskLane, TaskPriority } from './task-types';

interface TaskCreationComposerProps {
  source: ActivitySource;
  submitLabel: string;
  onCancel?: () => void;
  onSubmitted?: () => void | Promise<void>;
  onCreated?: (task: Task) => void | Promise<void>;
  autoFocus?: boolean;
  initialMode?: 'interaction' | 'one-shot';
  compact?: boolean;
  fillHeight?: boolean;
  lane?: TaskDraft['lane'];
  priority?: TaskDraft['priority'];
  status?: TaskDraft['status'];
}

interface ComposerDraft {
  title: string;
  doneLooksLike: string;
  firstStep: string;
  notes: string;
  lane: TaskLane;
  priority: TaskPriority;
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

const ESTIMATE_OPTIONS = [15, 25, 50, 90];

const VAGUE_ANSWERS = new Set([
  'done',
  'finished',
  'complete',
  'completed',
  'ready',
  'shipped',
  'fixed',
  'good',
  'ok',
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
  const trimmed = value.trim().toLowerCase().replace(/[.!?]+$/, '');
  return VAGUE_ANSWERS.has(trimmed);
}

const INITIAL_DRAFT: ComposerDraft = {
  title: '',
  doneLooksLike: '',
  firstStep: '',
  notes: '',
  lane: 'inbox',
  priority: 'normal',
  estimatedMinutes: 25,
  estimateAuto: false,
};

function buildClarifyingQuestions(draft: ComposerDraft): TaskClarifyingQuestion[] {
  const entries = [
    { id: 'done', question: 'What does done look like?', answer: draft.doneLooksLike.trim() },
    { id: 'first-step', question: 'What is the first step?', answer: draft.firstStep.trim() },
    { id: 'notes', question: 'Any extra notes?', answer: draft.notes.trim() },
  ];
  return entries
    .filter((entry) => entry.answer.length > 0)
    .map((entry, index) => ({
      id: `q-${entry.id}-${index + 1}`,
      question: entry.question,
      answer: entry.answer,
    }));
}

function normalizeTaskDraft(
  draft: ComposerDraft,
  clarification: TaskClarification | null,
  defaults: Pick<TaskDraft, 'status'>,
): TaskDraft {
  const title = draft.title.trim() || clarification?.suggestedTitle || '';

  return {
    rawInput: title,
    title,
    description: draft.notes.trim(),
    goal: draft.doneLooksLike.trim() || clarification?.goal,
    definitionOfDone: draft.doneLooksLike.trim() || clarification?.definitionOfDone,
    nextAction: draft.firstStep.trim() || clarification?.nextAction,
    whyItMatters: '',
    workspaceNotes: '',
    estimatedMinutes: draft.estimatedMinutes,
    clarifyingQuestions: buildClarifyingQuestions(draft),
    lane: draft.lane,
    priority: draft.priority,
    status: defaults.status,
  };
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
}: TaskCreationComposerProps) {
  const createTask = useTaskStore((state) => state.createTask);
  const titleRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ComposerDraft>({
    ...INITIAL_DRAFT,
    lane,
    priority,
  });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [clarification, setClarification] = useState<TaskClarification | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const deferredTitle = useDeferredValue(draft.title);

  useEffect(() => {
    if (autoFocus) {
      titleRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!draft.estimateAuto && draft.estimatedMinutes !== INITIAL_DRAFT.estimatedMinutes) {
      return;
    }

    const detected = detectEstimate(deferredTitle);
    if (detected !== null) {
      setDraft((current) =>
        current.estimatedMinutes === detected
          ? current
          : { ...current, estimatedMinutes: detected, estimateAuto: true },
      );
    }
  }, [deferredTitle, draft.estimateAuto, draft.estimatedMinutes]);

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
  const doneIsVague = draft.doneLooksLike.length > 0 && isVague(draft.doneLooksLike);

  function update<K extends keyof ComposerDraft>(field: K, value: ComposerDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function applyClarification() {
    if (!clarification) return;
    setDraft((current) => ({
      ...current,
      doneLooksLike:
        current.doneLooksLike ||
        clarification.definitionOfDone ||
        clarification.goal ||
        '',
      firstStep: current.firstStep || clarification.nextAction || '',
      notes: current.notes || clarification.description || '',
    }));
    setDetailsOpen(true);
  }

  function reset() {
    setDraft({ ...INITIAL_DRAFT, lane, priority });
    setClarification(null);
    setDetailsOpen(false);
  }

  async function handleSubmit() {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      const task = await createTask(normalizeTaskDraft(draft, clarification, { status }), source);
      await onCreated?.(task);
      reset();
      await onSubmitted?.();
    } finally {
      setIsSaving(false);
    }
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleSubmit();
    }
  }

  function handleEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      onCancel();
    }
  }

  const previewTitle = useMemo(
    () => draft.title.trim() || clarification?.suggestedTitle || 'New task',
    [draft.title, clarification],
  );

  const showClarificationCta = Boolean(
    clarification &&
      (clarification.definitionOfDone || clarification.nextAction || clarification.description) &&
      !draft.doneLooksLike &&
      !draft.firstStep &&
      !draft.notes,
  );

  return (
    <div className={cn(fillHeight ? 'flex h-full min-h-0 flex-col' : '')} onKeyDown={handleEscape}>
      <div
        className={cn(
          fillHeight ? 'min-h-0 flex-1 overflow-y-auto pr-1' : '',
          compact ? 'space-y-4' : 'space-y-5',
        )}
      >
        {/* Title — the only required field */}
        <div className="space-y-2">
          <label className="block text-[11px] uppercase tracking-[0.28em] text-text-muted">
            What are you working on?
          </label>
          <Input
            ref={titleRef}
            value={draft.title}
            onChange={(event) => update('title', event.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder='e.g. "Fix kanban drag handle on touch devices"'
            className="h-14 text-base"
          />
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
        <div className="space-y-3">
          <ChipRow label="Lane">
            {LANE_OPTIONS.map((option) => (
              <Chip
                key={option.id}
                active={draft.lane === option.id}
                onClick={() => update('lane', option.id)}
              >
                {option.label}
              </Chip>
            ))}
          </ChipRow>

          <ChipRow
            label="Estimate"
            trailing={
              draft.estimateAuto ? (
                <Badge tone="accent" className="text-[10px]">
                  auto
                </Badge>
              ) : null
            }
          >
            {ESTIMATE_OPTIONS.map((minutes) => (
              <Chip
                key={minutes}
                active={draft.estimatedMinutes === minutes}
                onClick={() => setDraft((c) => ({ ...c, estimatedMinutes: minutes, estimateAuto: false }))}
              >
                {minutes}m
              </Chip>
            ))}
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

        {/* Add details — collapsible */}
        <div className="rounded-[24px] border border-borderSoft/30 bg-panel/24">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 rounded-[24px] px-4 py-3 text-left transition-colors hover:bg-panel/36"
          >
            <span className="text-sm font-medium text-text-primary">
              {detailsOpen ? '▾ Details' : '▸ Add details (optional)'}
            </span>
            <span className="text-xs text-text-muted">
              {[draft.doneLooksLike, draft.firstStep, draft.notes].filter((s) => s.trim().length > 0).length} filled
            </span>
          </button>

          {detailsOpen ? (
            <div className="space-y-4 border-t border-borderSoft/24 px-4 py-4">
              <div className="space-y-2">
                <label className="block text-[11px] uppercase tracking-[0.28em] text-text-muted">
                  Done looks like
                </label>
                <Textarea
                  value={draft.doneLooksLike}
                  onChange={(event) => update('doneLooksLike', event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="A concrete signal you can point to. Not just 'done'."
                  rows={2}
                  className="resize-none"
                />
                {doneIsVague ? (
                  <p className="text-xs text-warning">
                    Try something more concrete — what would prove it&rsquo;s actually done?
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] uppercase tracking-[0.28em] text-text-muted">
                  First step
                </label>
                <Input
                  value={draft.firstStep}
                  onChange={(event) => update('firstStep', event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="The smallest action that breaks inertia."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] uppercase tracking-[0.28em] text-text-muted">
                  Notes
                </label>
                <Textarea
                  value={draft.notes}
                  onChange={(event) => update('notes', event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Links, context, anything else."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer — Save sits LEFT to eliminate cursor travel */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-t border-borderSoft/24',
          fillHeight ? 'mt-4 pt-4' : 'mt-5 pt-4',
        )}
      >
        <div className="flex items-center gap-2">
          <Button disabled={!canSave || isSaving} onClick={() => void handleSubmit()} size="md">
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
    </div>
  );
}

// ──────────────────────────────────────────
// Internal UI helpers
// ──────────────────────────────────────────

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
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-[68px] shrink-0 text-[10px] uppercase tracking-[0.28em] text-text-muted">
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
