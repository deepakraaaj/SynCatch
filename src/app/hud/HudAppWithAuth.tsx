import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../features/auth/auth-store';
import { AppBootstrap } from '../bootstrap';
import { hideCurrentWindow, showMainWindow } from '../../lib/tauri';
import { HudApp } from './HudApp';
import { SynCatchLogo } from '../../components/SynCatchLogo';

export function HudAppWithAuth() {
  const session = useAuthStore((state) => state.session);
  const loading = useAuthStore((state) => state.loading);
  const localMode = useAuthStore((state) => state.localMode);
  const hydrate = useAuthStore((state) => state.hydrate);
  const redirectedRef = useRef(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (loading || session || localMode || redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;

    void (async () => {
      await showMainWindow();
      await hideCurrentWindow();
    })();
  }, [loading, localMode, session]);

  if (loading || (!session && !localMode)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-text-secondary">
        <SynCatchLogo className="h-8 w-8 animate-pulse" />
        <span>Sync aachaa?</span>
      </div>
    );
  }

  return (
    <AppBootstrap>
      <HudApp />
    </AppBootstrap>
  );
}
