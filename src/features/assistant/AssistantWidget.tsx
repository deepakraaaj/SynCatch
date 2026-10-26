import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';
import { useAssistantStore } from './assistant-store';
import { ChatPanel } from './ChatPanel';

// Floating assistant button + popover chat, available on every screen.
export function AssistantWidget({
  /** Overrides the default corner placement so a dock can stack the launcher. */
  launcherPositionClassName = 'bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 lg:bottom-6',
}: { launcherPositionClassName?: string } = {}) {
  const open = useAssistantStore((s) => s.open);
  const toggle = useAssistantStore((s) => s.toggle);
  const setOpen = useAssistantStore((s) => s.setOpen);

  return createPortal(
    <>
      {/* Launcher button — hidden whenever the panel is open. The panel's own
          header ✕ handles closing; leaving this floating on top of the panel
          would overlap its bottom-right corner and act as a redundant,
          badly-placed second close button. */}
      {!open && (
        <button
          type="button"
          onClick={toggle}
          className={`fixed z-[70] ${launcherPositionClassName} flex h-11 w-11 items-center justify-center rounded-full border border-borderSoft bg-panel text-text-secondary shadow-[0_8px_24px_rgb(var(--shadow-color)/0.28)] transition-all hover:text-text-primary active:scale-95`}
          aria-label="Open assistant"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}

      {/* Popover panel */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[68] bg-black/20 sm:bg-black/10"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-0 right-0 left-0 z-[69] flex h-[80vh] flex-col overflow-hidden rounded-t-[28px] border border-borderStrong/70 bg-panel shadow-[0_24px_64px_rgba(0,0,0,0.28)] sm:bottom-24 sm:left-auto sm:right-5 sm:h-[560px] sm:w-[400px] sm:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-borderSoft px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-text-primary">Assistant</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted/70 transition-colors hover:bg-text-primary/8 hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel compact />
            </div>
          </div>
        </>
      )}
    </>,
    document.body,
  );
}
