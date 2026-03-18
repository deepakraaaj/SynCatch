import { motion } from 'framer-motion';
import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import type { TaskClarification } from '../../features/ai/ai-types';
import { getTaskAiAssistant } from '../../features/ai/mock-ai-provider';
import { useTaskStore } from '../../features/tasks/task-store';
import { QUICK_ADD_HEIGHT, QUICK_ADD_WIDTH, hideCurrentWindow, isTauriApp } from '../../lib/tauri';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Textarea } from '../../components/ui/input';
import { WindowDragHandle } from '../../components/ui/window-drag-handle';

function mergeClarificationAnswers(next: TaskClarification, previous: TaskClarification | null) {
  if (!previous) {
    return next;
  }

  return {
    ...next,
    questions: next.questions.map((question) => {
      const existing = previous.questions.find(
        (item) => item.question.toLowerCase() === question.question.toLowerCase(),
      );

      return existing ? { ...question, answer: existing.answer } : question;
    }),
  };
}

export function QuickAddApp() {
  const createTask = useTaskStore((state) => state.createTask);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [rawInput, setRawInput] = useState('');
  const [clarification, setClarification] = useState<TaskClarification | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const deferredInput = useDeferredValue(rawInput);
  const hasInput = rawInput.trim().length > 0;
  const primaryQuestion = clarification?.questions[0] ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isTauriApp()) {
      return;
    }

    let cleanup = () => {};

    void Promise.all([
      import('@tauri-apps/api/webviewWindow'),
      import('@tauri-apps/api/dpi'),
    ]).then(([{ WebviewWindow }, { LogicalSize }]) => {
      const currentWindow = WebviewWindow.getCurrent();

      void currentWindow.setSize(new LogicalSize(QUICK_ADD_WIDTH, QUICK_ADD_HEIGHT));
      void currentWindow.center();

      void currentWindow
        .listen('quick-add:focus', () => {
          void currentWindow.setSize(new LogicalSize(QUICK_ADD_WIDTH, QUICK_ADD_HEIGHT));
          void currentWindow.center();
          inputRef.current?.focus();
          inputRef.current?.select();
        })
        .then((unlisten) => {
          cleanup = () => {
            void unlisten();
          };
        });
    });

    return () => cleanup();
  }, []);

  useEffect(() => {
    if (!deferredInput.trim()) {
      setClarification(null);
      setIsThinking(false);
      return;
    }

    let cancelled = false;

    startTransition(() => {
      setIsThinking(true);
    });

    void getTaskAiAssistant()
      .clarifyTask(deferredInput)
      .then((clarified) => {
        if (!cancelled) {
          setClarification((current) => mergeClarificationAnswers(clarified, current));
          setIsThinking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredInput]);

  async function handleSave() {
    if (!rawInput.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      await createTask(
        {
          rawInput,
          title: clarification?.suggestedTitle,
          description: clarification?.description,
          goal: clarification?.goal,
          definitionOfDone: clarification?.definitionOfDone,
          nextAction: clarification?.nextAction,
          whyItMatters: clarification?.whyItMatters,
          subtasks: clarification?.subtasks,
          clarifyingQuestions: clarification?.questions,
          lane: 'inbox',
          priority: 'normal',
          status: 'captured',
        },
        'quick-add',
      );

      setRawInput('');
      setClarification(null);
      await hideCurrentWindow();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="overlay-root items-center justify-center p-4">
      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex h-full max-h-[calc(100vh-2rem)] w-full max-w-[540px]"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <Card className="quick-add-shell flex h-full w-full flex-col overflow-hidden rounded-[32px] p-4">
          <WindowDragHandle className="surface-muted mb-4 flex items-center justify-between rounded-[20px] px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-accent/80">Quick Add</p>
              <p className="mt-1 text-sm font-medium text-text-primary">Capture without breaking flow</p>
            </div>
            <Badge tone="accent">Ctrl+Shift+Space</Badge>
          </WindowDragHandle>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[1.75rem] font-semibold tracking-[-0.04em] text-text-primary">Capture task</h1>
                <p className="mt-1 text-sm leading-6 text-text-secondary">Type the messy version. Save fast.</p>
              </div>
              <Badge tone="neutral">{isThinking ? 'Thinking' : 'Ready'}</Badge>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-4">
                <Textarea
                  ref={inputRef}
                  autoFocus
                  className="min-h-[128px] resize-none"
                  onChange={(event) => setRawInput(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault();
                      void handleSave();
                    }

                    if (event.key === 'Escape') {
                      event.preventDefault();
                      void hideCurrentWindow();
                    }
                  }}
                  placeholder="What needs to happen next?"
                  rows={5}
                  value={rawInput}
                />

                {hasInput ? (
                  <div className="surface-muted rounded-[24px] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Auto-fill</p>
                      <Badge tone="neutral">Inbox</Badge>
                    </div>
                    <p className="mt-3 text-base font-medium text-text-primary">
                      {clarification?.suggestedTitle ?? 'New task'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      {clarification?.nextAction ?? 'First step will be suggested after save.'}
                    </p>
                  </div>
                ) : null}

                {primaryQuestion ? (
                  <div className="surface-muted rounded-[24px] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Only if useful</p>
                      <Badge tone="neutral">Optional</Badge>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-text-primary">{primaryQuestion.question}</p>
                    <Textarea
                      className="mt-3 min-h-[76px] resize-none"
                      onChange={(event) =>
                        setClarification((current) =>
                          current
                            ? {
                                ...current,
                                questions: current.questions.map((item) =>
                                  item.id === primaryQuestion.id ? { ...item, answer: event.target.value } : item,
                                ),
                              }
                            : current,
                        )
                      }
                      placeholder="Skip this and save if it does not matter."
                      rows={2}
                      value={primaryQuestion.answer}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-borderSoft/30 pt-4">
              <div className="flex gap-2">
                <Badge tone="neutral">Esc</Badge>
                <Badge tone="neutral">Ctrl+Enter</Badge>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => void hideCurrentWindow()} variant="ghost">
                  Close
                </Button>
                <Button onClick={() => void handleSave()} disabled={isSaving || !rawInput.trim()}>
                  {isSaving ? 'Saving' : 'Save to Queue'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
