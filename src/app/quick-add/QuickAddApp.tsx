import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { Badge } from '../../components/ui/badge';
import { WindowDragHandle } from '../../components/ui/window-drag-handle';
import { TaskCreationComposer } from '../../features/tasks/TaskCreationComposer';
import {
  QUICK_ADD_HEIGHT,
  QUICK_ADD_WIDTH,
  hideCurrentWindow,
  isTauriApp,
} from '../../lib/tauri';

export function QuickAddApp() {
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
        })
        .then((unlisten) => {
          cleanup = () => {
            void unlisten();
          };
        });
    });

    return () => cleanup();
  }, []);

  return (
    <div className="overlay-root items-center justify-center p-4">
      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex h-full max-h-[calc(100vh-1rem)] w-full max-w-[680px]"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <div className="quick-add-shell flex h-full w-full flex-col overflow-hidden rounded-[32px] p-3">
          <WindowDragHandle className="surface-muted mb-3 flex items-center justify-between rounded-[20px] px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-accent/80">Quick Add</p>
              <p className="mt-1 text-sm font-medium text-text-primary">Task composer</p>
            </div>
            <Badge tone="accent">Ctrl+Shift+Space</Badge>
          </WindowDragHandle>

          <div className="min-h-0 flex-1">
            <TaskCreationComposer
              autoFocus
              compact
              fillHeight
              initialMode="interaction"
              onCancel={() => void hideCurrentWindow()}
              onSubmitted={() => hideCurrentWindow()}
              source="quick-add"
              submitLabel="Save task"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
