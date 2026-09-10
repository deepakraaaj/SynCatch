import { useEffect, useRef } from 'react';

const DEFAULT_MIN_INTERVAL_MS = 30_000;

/**
 * Runs `refresh` once on mount, then again whenever the tab/window regains
 * focus or becomes visible — but never more often than `minIntervalMs`.
 * Without the throttle, quick app/tab switching (alt-tab, a notification
 * stealing focus) refires the query every time, which is what was driving
 * the repeated `notes`/`journal` fetches showing up as slow-query outliers.
 */
export function useRefreshOnFocus(refresh: (silent?: boolean) => void, minIntervalMs = DEFAULT_MIN_INTERVAL_MS) {
  const lastRunRef = useRef(0);

  useEffect(() => {
    const run = () => {
      const now = Date.now();
      if (now - lastRunRef.current < minIntervalMs) return;
      lastRunRef.current = now;
      refresh(true);
    };

    run();

    const handleVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleVisible);

    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
    };
  }, [refresh, minIntervalMs]);
}
