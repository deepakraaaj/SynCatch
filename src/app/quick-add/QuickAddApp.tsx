import { motion } from 'framer-motion';
import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { getTaskAiAssistant } from '../../features/ai/mock-ai-provider';
import { useTaskStore } from '../../features/tasks/task-store';
import { hideCurrentWindow, isTauriApp } from '../../lib/tauri';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Textarea } from '../../components/ui/input';
import { WindowDragHandle } from '../../components/ui/window-drag-handle';

const QUICK_ADD_WIDTH = 520;
const QUICK_ADD_HEIGHT = 560;

export function QuickAddApp() {
  const createTask = useTaskStore((state) => state.createTask);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [rawInput, setRawInput] = useState('');
  const [suggestedTitle, setSuggestedTitle] = useState('New mission');
  const [isSaving, setIsSaving] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const deferredInput = useDeferredValue(rawInput);

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
      setSuggestedTitle('New mission');
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
          setSuggestedTitle(clarified.suggestedTitle);
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
          title: suggestedTitle,
          lane: 'inbox',
          priority: 'normal',
          status: 'captured',
        },
        'quick-add',
      );

      setRawInput('');
      await hideCurrentWindow();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="overlay-root items-center justify-center p-4">
      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-[520px]"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <Card className="quick-add-shell rounded-[32px] p-4">
          <WindowDragHandle className="mb-4 flex items-center justify-between rounded-[20px] border border-white/6 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-accent/80">Quick Add</p>
              <p className="mt-1 text-sm font-medium text-text-primary">Capture without breaking flow</p>
            </div>
            <Badge tone="accent">Ctrl+Shift+Space</Badge>
          </WindowDragHandle>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-text-primary">New objective</h1>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Drop the raw thought. We&apos;ll clean the title and keep the queue moving.
                </p>
              </div>
              <Badge tone="neutral">{isThinking ? 'Refining' : 'Ready'}</Badge>
            </div>

            <Textarea
              ref={inputRef}
              autoFocus
              className="min-h-[120px] resize-none"
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

            <div className="grid gap-4 grid-cols-[minmax(0,1fr)_180px]">
              <div className="rounded-[24px] border border-white/6 bg-black/18 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Suggested title</p>
                <p className="mt-3 text-lg font-medium text-text-primary">{suggestedTitle}</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Short enough to scan. Specific enough to act on.
                </p>
              </div>

              <div className="rounded-[24px] border border-white/6 bg-black/18 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Default lane</p>
                <p className="mt-3 text-lg font-medium text-text-primary">Inbox</p>
                <p className="mt-2 text-sm text-text-secondary">Keep capture frictionless.</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
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
