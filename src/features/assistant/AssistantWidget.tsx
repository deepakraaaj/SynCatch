import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
      {/* Launcher button */}
      <motion.button
        type="button"
        onClick={toggle}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-glow lg:bottom-6"
        aria-label="Open assistant"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="s" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Popover panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[68] bg-black/20 sm:bg-transparent"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="fixed bottom-0 right-0 left-0 z-[69] flex h-[80vh] flex-col overflow-hidden rounded-t-[28px] border border-borderSoft/30 bg-panel shadow-panel sm:bottom-24 sm:left-auto sm:right-5 sm:h-[560px] sm:w-[400px] sm:rounded-[28px]"
            >
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
