import { cn } from '../../lib/cn';
import { useToastStore, type ToastTone } from '../../features/toasts/toast-store';

function ToastIcon({ tone }: { tone: ToastTone }) {
  const toneClasses =
    tone === 'success'
      ? 'border-success/30 bg-success/14 text-success'
      : tone === 'error'
        ? 'border-warning/30 bg-warning/14 text-warning'
        : 'border-accent/20 bg-accent/10 text-accent';

  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
        toneClasses,
      )}
    >
      {tone === 'success' ? (
        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
          <path
            d="M6 12.75 10 16l8-9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      ) : tone === 'error' ? (
        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
          <path
            d="M12 8v5m0 3h.01M10.29 3.86l-8 14A1 1 0 0 0 3.16 19h17.68a1 1 0 0 0 .87-1.49l-8-14a1 1 0 0 0-1.74 0Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </svg>
      ) : (
        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
          <path
            d="M12 16v-4m0-4h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </svg>
      )}
    </span>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[120] flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-3 sm:right-5 sm:top-5 sm:w-[min(360px,calc(100vw-2rem))]">
      {toasts.map((toast) => (
        <div
          className="pointer-events-auto rounded-[18px] border border-borderSoft/40 bg-surface-2 shadow-[0_20px_48px_rgb(0_0_0/0.18)] backdrop-blur-xl"
          key={toast.id}
        >
          <div className="flex items-start gap-3 px-4 py-3.5">
            <ToastIcon tone={toast.tone} />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-5 text-text-primary">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-[13px] leading-5 text-text-secondary">{toast.description}</p>
              ) : null}
            </div>

            <button
              aria-label="Dismiss notification"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-panel/40 hover:text-text-primary"
              onClick={() => dismiss(toast.id)}
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
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
