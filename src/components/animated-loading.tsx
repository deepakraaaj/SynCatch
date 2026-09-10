import { useEffect, useState } from 'react';
import { SynCatchLogoAnimated } from './SynCatchLogoAnimated';

interface AnimatedLoadingProps {
  autoDismiss?: boolean;
  dismissAfter?: number;
  /**
   * Escape hatch: when set, shows Retry / Sign out actions if the loader is
   * still on screen after this many ms. Use for gates that can otherwise
   * spin forever with no way out (e.g. an auth session stuck on a hung
   * token refresh during an outage) — omit for short, self-dismissing
   * splash usage.
   */
  showEscapeAfter?: number;
  onRetry?: () => void;
  onSignOut?: () => void;
}

/**
 * Full-screen boot loader. Mirrors the pre-React splash in index.html
 * (same mark, same layout) so the handoff between the two is seamless.
 */
export function AnimatedLoading({
  autoDismiss = false,
  dismissAfter = 2000,
  showEscapeAfter,
  onRetry,
  onSignOut,
}: AnimatedLoadingProps = {}) {
  const [isVisible, setIsVisible] = useState(true);
  const [showEscape, setShowEscape] = useState(false);

  useEffect(() => {
    if (!autoDismiss) {
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, dismissAfter);

    return () => clearTimeout(timer);
  }, [autoDismiss, dismissAfter]);

  useEffect(() => {
    if (!showEscapeAfter) {
      return;
    }

    const timer = setTimeout(() => setShowEscape(true), showEscapeAfter);
    return () => clearTimeout(timer);
  }, [showEscapeAfter]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-8"
      style={{
        background: 'linear-gradient(180deg, rgb(var(--bg-base)) 0%, rgb(var(--bg-soft)) 100%)',
      }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <SynCatchLogoAnimated className="h-20 w-20" loop themed />
        <div>
          <h1 className="text-5xl font-black tracking-tighter">
            <span className="text-text-primary">Syn</span>
            <span className="text-accent">Catch</span>
          </h1>
          <p
            className="mt-3 text-base font-medium tracking-widest"
            style={{ color: 'rgb(var(--accent) / 0.8)' }}
          >
            Sync aachaa?
          </p>
        </div>

        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="loader-dot h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: 'rgb(var(--accent))',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      {showEscape ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-text-muted">
            This is taking longer than expected — the connection may be down.
          </p>
          <div className="flex gap-2">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-borderSoft/50 px-4 py-1.5 text-sm font-medium text-text-primary transition hover:bg-text-primary/8"
              >
                Retry
              </button>
            ) : null}
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-full border border-borderSoft/50 px-4 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-text-primary/8"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="absolute bottom-10 text-center">
          <p
            className="text-sm uppercase tracking-widest"
            style={{ color: 'rgb(var(--text-muted) / 0.7)' }}
          >
            Aachu — caught &amp; synced ✓
          </p>
        </div>
      )}
    </div>
  );
}
