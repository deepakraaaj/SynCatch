import { motion } from 'framer-motion';
import {
  startTransition,
  useDeferredValue,
  useEffect,
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
import type { Task, TaskClarifyingQuestion, TaskDraft } from './task-types';

type ComposerMode = 'interaction' | 'one-shot';
type DraftField =
  | 'title'
  | 'description'
  | 'goal'
  | 'definitionOfDone'
  | 'nextAction'
  | 'whyItMatters'
  | 'estimatedMinutes';

interface ComposerDraft {
  rawInput: string;
  title: string;
  description: string;
  goal: string;
  definitionOfDone: string;
  nextAction: string;
  whyItMatters: string;
  estimatedMinutes: number;
}

interface TaskCreationComposerProps {
  source: ActivitySource;
  submitLabel: string;
  onCancel?: () => void;
  onSubmitted?: () => void | Promise<void>;
  onCreated?: (task: Task) => void | Promise<void>;
  autoFocus?: boolean;
  initialMode?: ComposerMode;
  compact?: boolean;
  fillHeight?: boolean;
  lane?: TaskDraft['lane'];
  priority?: TaskDraft['priority'];
  status?: TaskDraft['status'];
}

interface InteractionStep {
  id: string;
  label: string;
  question: string;
  placeholder: string;
  field: Exclude<DraftField, 'estimatedMinutes'>;
  multiline?: boolean;
}

const INTERACTION_STEPS: InteractionStep[] = [
  {
    id: 'title',
    label: 'Title',
    question: 'What is the task?',
    placeholder: 'Short title',
    field: 'title',
  },
  {
    id: 'goal',
    label: 'Outcome',
    question: 'What should exist when this is done?',
    placeholder: 'Outcome',
    field: 'goal',
    multiline: true,
  },
  {
    id: 'next',
    label: 'Next',
    question: 'What is the next action?',
    placeholder: 'Next step',
    field: 'nextAction',
    multiline: true,
  },
  {
    id: 'done',
    label: 'Done',
    question: 'What counts as done?',
    placeholder: 'Definition of done',
    field: 'definitionOfDone',
    multiline: true,
  },
  {
    id: 'why',
    label: 'Why',
    question: 'Why does it matter?',
    placeholder: 'Why',
    field: 'whyItMatters',
    multiline: true,
  },
  {
    id: 'context',
    label: 'Context',
    question: 'Any extra context?',
    placeholder: 'Context',
    field: 'description',
    multiline: true,
  },
];

const MINUTE_OPTIONS = [10, 15, 25, 40, 50, 90];

const INITIAL_DRAFT: ComposerDraft = {
  rawInput: '',
  title: '',
  description: '',
  goal: '',
  definitionOfDone: '',
  nextAction: '',
  whyItMatters: '',
  estimatedMinutes: 25,
};

function mergeClarification(
  clarification: TaskClarification,
  current: ComposerDraft,
  touched: Partial<Record<DraftField, boolean>>,
): ComposerDraft {
  return {
    ...current,
    title: touched.title ? current.title : clarification.suggestedTitle,
    description: touched.description ? current.description : clarification.description,
    goal: touched.goal ? current.goal : clarification.goal,
    definitionOfDone: touched.definitionOfDone
      ? current.definitionOfDone
      : clarification.definitionOfDone,
    nextAction: touched.nextAction ? current.nextAction : clarification.nextAction,
    whyItMatters: touched.whyItMatters ? current.whyItMatters : clarification.whyItMatters,
    estimatedMinutes: touched.estimatedMinutes
      ? current.estimatedMinutes
      : clarification.questions.length > 1
        ? Math.max(current.estimatedMinutes, 25)
        : current.estimatedMinutes,
  };
}

function buildClarifyingQuestions(draft: ComposerDraft): TaskClarifyingQuestion[] {
  return INTERACTION_STEPS.map((step, index) => ({
    id: `question-${step.id}-${index + 1}`,
    question: step.question,
    answer: draft[step.field].trim(),
  })).filter((question) => question.answer.length > 0);
}

function normalizeTaskDraft(
  draft: ComposerDraft,
  clarification: TaskClarification | null,
  defaults: Pick<TaskDraft, 'lane' | 'priority' | 'status'>,
): TaskDraft {
  const rawInput = draft.rawInput.trim() || draft.title.trim();
  const title = draft.title.trim() || clarification?.suggestedTitle || rawInput;

  return {
    rawInput,
    title,
    description: draft.description.trim() || clarification?.description,
    goal: draft.goal.trim() || clarification?.goal,
    definitionOfDone: draft.definitionOfDone.trim() || clarification?.definitionOfDone,
    nextAction: draft.nextAction.trim() || clarification?.nextAction,
    whyItMatters: draft.whyItMatters.trim() || clarification?.whyItMatters,
    estimatedMinutes: draft.estimatedMinutes,
    clarifyingQuestions: buildClarifyingQuestions(draft),
    lane: defaults.lane,
    priority: defaults.priority,
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
  initialMode = 'interaction',
  compact = false,
  fillHeight = false,
  lane = 'inbox',
  priority = 'normal',
  status = 'captured',
}: TaskCreationComposerProps) {
  const createTask = useTaskStore((state) => state.createTask);
  const rawInputRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [draft, setDraft] = useState<ComposerDraft>(INITIAL_DRAFT);
  const [touched, setTouched] = useState<Partial<Record<DraftField, boolean>>>({});
  const [clarification, setClarification] = useState<TaskClarification | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const deferredRawInput = useDeferredValue(draft.rawInput);

  useEffect(() => {
    if (autoFocus) {
      rawInputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!deferredRawInput.trim()) {
      setClarification(null);
      setIsThinking(false);
      return;
    }

    let cancelled = false;

    startTransition(() => {
      setIsThinking(true);
    });

    void getTaskAiAssistant()
      .clarifyTask(deferredRawInput)
      .then((nextClarification) => {
        if (cancelled) {
          return;
        }

        setClarification(nextClarification);
        setDraft((current) => mergeClarification(nextClarification, current, touched));
        setIsThinking(false);
      })
      .catch(() => {
        if (!cancelled) {
          setIsThinking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredRawInput, touched]);

  const currentStep = INTERACTION_STEPS[stepIndex];
  const canSave = Boolean(draft.rawInput.trim() || draft.title.trim());

  function updateField(field: keyof ComposerDraft, value: string | number) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));

    if (field !== 'rawInput') {
      setTouched((current) => ({
        ...current,
        [field]: true,
      }));
    }
  }

  function resetComposer() {
    setDraft(INITIAL_DRAFT);
    setTouched({});
    setClarification(null);
    setStepIndex(0);
    setMode(initialMode);
  }

  async function handleSubmit() {
    if (!canSave) {
      return;
    }

    setIsSaving(true);

    try {
      const task = await createTask(
        normalizeTaskDraft(draft, clarification, {
          lane,
          priority,
          status,
        }),
        source,
      );
      await onCreated?.(task);
      resetComposer();
      await onSubmitted?.();
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className={cn(fillHeight ? 'flex h-full min-h-0 flex-col' : 'space-y-4')}>
      <div
        className={cn(
          fillHeight ? 'min-h-0 flex-1 overflow-y-auto pr-1' : '',
          compact ? 'space-y-3' : 'space-y-4',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(['interaction', 'one-shot'] as ComposerMode[]).map((option) => (
              <button
                className={
                  option === mode
                    ? 'rounded-full border border-accent/30 bg-accent/12 px-4 py-2 text-xs font-medium text-accent'
                    : 'rounded-full border border-borderSoft/35 bg-panel/36 px-4 py-2 text-xs font-medium text-text-secondary'
                }
                key={option}
                onClick={() => setMode(option)}
                type="button"
              >
                {option === 'interaction' ? 'Interaction' : 'One shot'}
              </button>
            ))}
          </div>

          <Badge tone="neutral">{isThinking ? 'Thinking' : 'Ready'}</Badge>
        </div>

        <Textarea
          ref={rawInputRef}
          className={cn('resize-none', compact ? 'min-h-[84px]' : 'min-h-[110px]')}
          onChange={(event) => updateField('rawInput', event.target.value)}
          onKeyDown={handleEditorKeyDown}
          placeholder="Messy input"
          rows={compact ? 3 : 4}
          value={draft.rawInput}
        />

        {mode === 'one-shot' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Input
                onChange={(event) => updateField('title', event.target.value)}
                onKeyDown={handleEditorKeyDown}
                placeholder="Title"
                value={draft.title}
              />
            </div>
            <Textarea
              className={cn('resize-none', compact ? 'min-h-[74px]' : 'min-h-[92px]')}
              onChange={(event) => updateField('goal', event.target.value)}
              onKeyDown={handleEditorKeyDown}
              placeholder="Outcome"
              rows={compact ? 2 : 3}
              value={draft.goal}
            />
            <Textarea
              className={cn('resize-none', compact ? 'min-h-[74px]' : 'min-h-[92px]')}
              onChange={(event) => updateField('nextAction', event.target.value)}
              onKeyDown={handleEditorKeyDown}
              placeholder="Next action"
              rows={compact ? 2 : 3}
              value={draft.nextAction}
            />
            <Textarea
              className={cn('resize-none', compact ? 'min-h-[74px]' : 'min-h-[92px]')}
              onChange={(event) => updateField('definitionOfDone', event.target.value)}
              onKeyDown={handleEditorKeyDown}
              placeholder="Done means"
              rows={compact ? 2 : 3}
              value={draft.definitionOfDone}
            />
            <Textarea
              className={cn('resize-none', compact ? 'min-h-[74px]' : 'min-h-[92px]')}
              onChange={(event) => updateField('whyItMatters', event.target.value)}
              onKeyDown={handleEditorKeyDown}
              placeholder="Why"
              rows={compact ? 2 : 3}
              value={draft.whyItMatters}
            />
            <div className="md:col-span-2">
              <Textarea
                className={cn('resize-none', compact ? 'min-h-[74px]' : 'min-h-[92px]')}
                onChange={(event) => updateField('description', event.target.value)}
                onKeyDown={handleEditorKeyDown}
                placeholder="Context"
                rows={compact ? 2 : 3}
                value={draft.description}
              />
            </div>
          </div>
        ) : (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={cn('surface-muted rounded-[26px]', compact ? 'p-3' : 'p-4')}
            key={currentStep.id}
            initial={{ opacity: 0, y: 8 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge tone="accent">{currentStep.label}</Badge>
                <span className="text-xs text-text-muted">
                  {stepIndex + 1}/{INTERACTION_STEPS.length}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={stepIndex === 0}
                  onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Back
                </Button>
                <Button
                  onClick={() =>
                    setStepIndex((current) => Math.min(INTERACTION_STEPS.length - 1, current + 1))
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {stepIndex === INTERACTION_STEPS.length - 1 ? 'Done' : 'Next'}
                </Button>
              </div>
            </div>

            <p className={cn(compact ? 'mt-3' : 'mt-4', 'text-sm font-medium text-text-primary')}>
              {currentStep.question}
            </p>

            {currentStep.multiline ? (
              <Textarea
                className={cn('mt-3 resize-none', compact ? 'min-h-[88px]' : 'min-h-[110px]')}
                onChange={(event) => updateField(currentStep.field, event.target.value)}
                onKeyDown={handleEditorKeyDown}
                placeholder={currentStep.placeholder}
                rows={compact ? 3 : 4}
                value={draft[currentStep.field]}
              />
            ) : (
              <Input
                className="mt-3"
                onChange={(event) => updateField(currentStep.field, event.target.value)}
                onKeyDown={handleEditorKeyDown}
                placeholder={currentStep.placeholder}
                value={draft[currentStep.field]}
              />
            )}
          </motion.div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Estimate</p>
            <p className="text-sm text-text-primary">{draft.estimatedMinutes}m</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {MINUTE_OPTIONS.map((minutes) => (
              <button
                className={
                  draft.estimatedMinutes === minutes
                    ? 'rounded-full border border-accent/30 bg-accent/12 px-3 py-2 text-xs font-medium text-accent'
                    : 'rounded-full border border-borderSoft/35 bg-panel/36 px-3 py-2 text-xs font-medium text-text-secondary'
                }
                key={minutes}
                onClick={() => updateField('estimatedMinutes', minutes)}
                type="button"
              >
                {minutes}m
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn('flex items-center justify-between gap-3 border-t border-borderSoft/24', fillHeight ? 'mt-3 pt-3' : 'pt-4')}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">
            {draft.title.trim() || clarification?.suggestedTitle || 'New task'}
          </p>
        </div>

        <div className="flex gap-3">
          {onCancel ? (
            <Button onClick={onCancel} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
          ) : null}
          <Button disabled={!canSave || isSaving} onClick={() => void handleSubmit()} size="sm" type="button">
            {isSaving ? 'Saving' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
