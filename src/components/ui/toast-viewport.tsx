import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/cn';
import { useToastStore, type ToastTone, type ToastActionType } from '../../features/toasts/toast-store';
import { useSettingsStore } from '../../features/settings/settings-store';
import { Lumi } from '../../character/Lumi';
import type { LumiExpression } from '../../character/lumi-assets';
import { SparkleBurst } from '../../character/effects-assets';

function getToastExpression(action: ToastActionType, tone: ToastTone): LumiExpression {
  if (action === 'delete') return 'concerned';
  if (action === 'save') return 'happy';
  if (action === 'create') return 'celebrating';
  if (action === 'update') return 'neutral';
  if (tone === 'error') return 'concerned';
  if (tone === 'success') return 'happy';
  return 'calm';
}

function ToastItemCard({
  toast,
  onDismiss,
  reduceMotion,
}: {
  toast: import('../../features/toasts/toast-store').ToastItem;
  onDismiss: () => void;
  reduceMotion: boolean;
}) {
  const expression = getToastExpression(toast.action, toast.tone);
  const isDelete = toast.action === 'delete';
  const isSave = toast.action === 'save';
  const isCreate = toast.action === 'create';
  const isError = toast.tone === 'error';

  const toneBorder = isError
    ? 'border-warning/40 shadow-[0_16px_40px_rgba(239,68,68,0.12)]'
    : isDelete
      ? 'border-rose-500/35 shadow-[0_16px_40px_rgba(244,63,94,0.12)]'
      : isSave || isCreate
        ? 'border-emerald-500/35 shadow-[0_16px_40px_rgba(16,185,129,0.12)]'
        : 'border-borderSoft/40 shadow-[0_20px_48px_rgb(0_0_0/0.18)]';

  const progressBg = isError
    ? 'bg-warning'
    : isDelete
      ? 'bg-rose-500'
      : isSave || isCreate
        ? 'bg-emerald-500'
        : 'bg-accent';

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.94 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, x: 24, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={cn(
        'pointer-events-auto relative overflow-hidden rounded-[20px] border bg-panel2/95 backdrop-blur-xl transition-colors',
        toneBorder,
      )}
    >
      {(isSave || isCreate) && (
        <SparkleBurst className="-right-1 -top-1" size={24} reduceMotion={reduceMotion} />
      )}

      <div className="flex items-start gap-3.5 px-4 py-3.5">
        {/* Lumi mascot badge */}
        <div className="relative shrink-0 pt-0.5">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border shadow-sm transition-transform',
              isError
                ? 'border-warning/30 bg-warning/10'
                : isDelete
                  ? 'border-rose-500/25 bg-rose-500/10'
                  : isSave || isCreate
                    ? 'border-emerald-500/25 bg-emerald-500/10'
                    : 'border-borderSoft/40 bg-panel/60',
            )}
          >
            <Lumi
              expression={expression}
              size="sm"
              reduceMotion={reduceMotion}
              label=""
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[13px] font-semibold leading-snug text-text-primary tracking-[-0.1px]">
            {toast.title}
          </p>
          {toast.description ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary line-clamp-2">
              {toast.description}
            </p>
          ) : null}
        </div>

        <motion.button
          whileHover={reduceMotion ? {} : { scale: 1.15, rotate: 90 }}
          whileTap={reduceMotion ? {} : { scale: 0.85 }}
          aria-label="Dismiss notification"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-panel/60 hover:text-text-primary"
          onClick={onDismiss}
          type="button"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        </motion.button>
      </div>

      {/* Countdown progress bar */}
      {!reduceMotion && toast.durationMs > 0 && (
        <div className="h-0.5 w-full bg-borderSoft/20 overflow-hidden">
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: toast.durationMs / 1000, ease: 'linear' }}
            style={{ originX: 0 }}
            className={cn('h-full w-full', progressBg)}
          />
        </div>
      )}
    </motion.div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);

  return (
    <div className="pointer-events-none fixed bottom-20 left-3 right-3 z-[120] flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-2.5 lg:bottom-auto lg:top-5 lg:left-auto lg:right-5 lg:w-[min(360px,calc(100vw-2rem))]">
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => (
          <ToastItemCard
            key={toast.id}
            toast={toast}
            onDismiss={() => dismiss(toast.id)}
            reduceMotion={reduceMotion}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
