import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';
import { useAssistantStore } from './assistant-store';
import { ChatPanel } from './ChatPanel';

// Floating assistant button + popover chat, available on every screen.
export function AssistantWidget() {
  const open = useAssistantStore((s) => s.open);
  const toggle = useAssistantStore((s) => s.toggle);
  const setOpen = useAssistantStore((s) => s.setOpen);

  return createPortal(
    <>
      {/* Launcher button — hidden on mobile while open, where the full-width sheet's
          own header ✕ handles closing and the launcher would overlap the composer. */}
      <button
        type="button"
        onClick={toggle}
        className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-[70] h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-glow lg:bottom-6 ${open ? 'hidden sm:flex' : 'flex'}`}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Popover panel */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[68] bg-black/20 sm:bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-0 right-0 left-0 z-[69] flex h-[80vh] flex-col overflow-hidden rounded-t-[28px] border border-borderSoft/30 bg-panel shadow-panel sm:bottom-24 sm:left-auto sm:right-5 sm:h-[560px] sm:w-[400px] sm:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-borderSoft/25 px-4 py-3">
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
