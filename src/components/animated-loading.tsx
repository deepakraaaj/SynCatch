import { useEffect, useState } from 'react';
import { SynCatchEmblem } from './SynCatchLogo';

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
 * Full-screen boot loader. Mirrors the pre-React splash in index.html (same
 * emblem, same classes, styled there) so the handoff between the two is seamless.
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
    <div className="sc-splash" style={{ zIndex: 999 }}>
      <div className="sc-center">
        <SynCatchEmblem className="sc-lockup" animated />
        <p className="sc-about">Every thought, caught and in sync.</p>
      </div>

      {showEscape ? (
        <div className="mt-8 flex flex-col items-center gap-3 px-6 text-center">
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
        <p className="sc-status"><span className="sc-q">Sync aachaa?</span><span className="sc-a">Aachu ✓</span></p>
      )}
    </div>
  );
}
