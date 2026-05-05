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

    void Promise.all([
      import('@tauri-apps/api/webviewWindow'),
      import('@tauri-apps/api/dpi'),
    ]).then(([{ WebviewWindow }, { LogicalSize }]) => {
      const currentWindow = WebviewWindow.getCurrent();

      void currentWindow.setSize(new LogicalSize(QUICK_ADD_WIDTH, QUICK_ADD_HEIGHT));
      void currentWindow.center();
    });
  }, []);

  return (
    <div className="overlay-root items-center justify-center p-4">
      <div className="flex h-full max-h-[calc(100vh-1rem)] w-full max-w-[680px]">
        <div className="quick-add-shell flex h-full w-full flex-col overflow-hidden rounded-[32px] p-3">
          <WindowDragHandle className="surface-muted mb-3 flex items-center justify-between rounded-[20px] px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-accent/80">Quick Add</p>
              <p className="mt-1 text-sm font-medium text-text-primary">Task composer</p>
            </div>
            <Badge tone="neutral">Window</Badge>
          </WindowDragHandle>

          <div className="min-h-0 flex-1">
            <TaskCreationComposer
              autoFocus
              compact
              fillHeight
              onCancel={() => void hideCurrentWindow()}
              onSubmitted={() => hideCurrentWindow()}
              source="quick-add"
              submitLabel="Save task"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
