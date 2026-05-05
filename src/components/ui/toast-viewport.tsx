import { cn } from '../../lib/cn';
import { useToastStore, type ToastTone } from '../../features/toasts/toast-store';

function ToastIcon({ tone }: { tone: ToastTone }) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-400/30 bg-emerald-400/14 text-emerald-200'
      : tone === 'error'
        ? 'border-rose-400/30 bg-rose-400/14 text-rose-200'
        : 'border-white/14 bg-white/8 text-white/90';

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
    <div className="pointer-events-none fixed right-5 top-5 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          className="pointer-events-auto rounded-[18px] border border-white/12 bg-[#1f1d1b]/96 text-white shadow-[0_20px_48px_rgb(0_0_0/0.34)] backdrop-blur-xl"
          key={toast.id}
        >
          <div className="flex items-start gap-3 px-4 py-3.5">
            <ToastIcon tone={toast.tone} />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-5 text-white">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-[13px] leading-5 text-white/72">{toast.description}</p>
              ) : null}
            </div>

            <button
              aria-label="Dismiss notification"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/8 hover:text-white"
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
