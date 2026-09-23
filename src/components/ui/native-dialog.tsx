import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Lumi } from '../../character/Lumi';
import { useSettingsStore } from '../../features/settings/settings-store';

type DialogRequest = {
  kind: 'confirm' | 'prompt';
  title: string;
  message: string;
  initialValue?: string;
  confirmLabel: string;
  danger?: boolean;
  resolve: (value: boolean | string | null) => void;
};

let activeRequest: DialogRequest | null = null;
const listeners = new Set<(request: DialogRequest | null) => void>();
const publish = () => listeners.forEach((listener) => listener(activeRequest));

const openDialog = (request: DialogRequest) => {
  if (activeRequest) activeRequest.resolve(activeRequest.kind === 'confirm' ? false : null);
  activeRequest = request;
  publish();
};

export const confirmDialog = (
  message: string,
  options?: { title?: string; confirmLabel?: string; danger?: boolean },
) =>
  new Promise<boolean>((resolve) =>
    openDialog({
      kind: 'confirm',
      title: options?.title ?? 'Confirm action',
      message,
      confirmLabel: options?.confirmLabel ?? 'Confirm',
      danger: options?.danger,
      resolve: (value) => resolve(value === true),
    }),
  );

export const promptDialog = (
  message: string,
  initialValue = '',
  options?: { title?: string; confirmLabel?: string },
) =>
  new Promise<string | null>((resolve) =>
    openDialog({
      kind: 'prompt',
      title: options?.title ?? 'Add details',
      message,
      initialValue,
      confirmLabel: options?.confirmLabel ?? 'Save',
      resolve: (value) => resolve(typeof value === 'string' ? value : null),
    }),
  );

export function NativeDialogHost() {
  const [request, setRequest] = useState<DialogRequest | null>(activeRequest);
  const [value, setValue] = useState('');
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);

  const close = (result: boolean | string | null) => {
    const current = activeRequest;
    activeRequest = null;
    publish();
    current?.resolve(result);
  };

  useEffect(() => {
    const listener = (next: DialogRequest | null) => {
      setRequest(next);
      setValue(next?.initialValue ?? '');
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(request.kind === 'confirm' ? false : null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request]);

  return createPortal(
    <AnimatePresence>
      {request && (
        <motion.div
          key="native-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[200] flex items-end justify-center p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="native-dialog-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[4px]"
            onClick={() => close(request.kind === 'confirm' ? false : null)}
            aria-label="Close dialog"
          />

          {/* Modal Card */}
          <motion.form
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.93, y: 16 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            onSubmit={(event) => {
              event.preventDefault();
              close(request.kind === 'prompt' ? value : true);
            }}
            className="relative w-full max-w-md rounded-[26px] border border-borderSoft/60 bg-panel/98 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6"
          >
            <div className="flex items-start gap-3.5">
              {/* Animated Mascot / Icon Badge */}
              <div className="relative shrink-0">
                <div
                  className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border shadow-inner ${
                    request.danger
                      ? 'border-rose-500/30 bg-rose-500/12'
                      : 'border-accent/30 bg-accent/12'
                  }`}
                >
                  <Lumi
                    expression={request.danger ? 'concerned' : 'thinking'}
                    size={40}
                    reduceMotion={reduceMotion}
                    label=""
                  />
                </div>
                {request.danger && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow">
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <h2
                  id="native-dialog-title"
                  className="text-[16px] font-bold tracking-[-0.2px] text-text-primary"
                >
                  {request.title}
                </h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-text-secondary">
                  {request.message}
                </p>
              </div>

              <motion.button
                whileHover={reduceMotion ? {} : { scale: 1.1 }}
                whileTap={reduceMotion ? {} : { scale: 0.9 }}
                type="button"
                onClick={() => close(request.kind === 'confirm' ? false : null)}
                className="rounded-full p-1.5 text-text-muted hover:bg-panel2 hover:text-text-primary transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            {request.kind === 'prompt' ? (
              <textarea
                autoFocus
                rows={3}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="mt-4 w-full resize-y rounded-2xl border border-borderSoft bg-panel2/70 px-3.5 py-2.5 text-sm leading-5 text-text-primary outline-none transition-colors focus:border-accent"
              />
            ) : null}

            <div className="mt-6 flex justify-end items-center gap-2.5">
              <motion.button
                whileHover={reduceMotion ? {} : { scale: 1.02 }}
                whileTap={reduceMotion ? {} : { scale: 0.97 }}
                type="button"
                onClick={() => close(request.kind === 'confirm' ? false : null)}
                className="h-10 rounded-xl px-4 text-sm font-semibold text-text-secondary hover:bg-panel2 transition-colors"
              >
                Cancel
              </motion.button>

              <motion.button
                whileHover={reduceMotion ? {} : { scale: 1.03 }}
                whileTap={reduceMotion ? {} : { scale: 0.96 }}
                type="submit"
                className={`relative h-10 overflow-hidden rounded-xl px-5 text-sm font-bold shadow-md transition-all ${
                  request.danger
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25 hover:shadow-rose-600/40'
                    : 'bg-accent hover:bg-accent/90 text-[rgb(var(--accent-contrast))]'
                }`}
              >
                {request.confirmLabel}
              </motion.button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
