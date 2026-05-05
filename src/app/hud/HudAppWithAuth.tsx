import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../features/auth/auth-store';
import { AppBootstrap } from '../bootstrap';
import { hideCurrentWindow, showMainWindow } from '../../lib/tauri';
import { HudApp } from './HudApp';

export function HudAppWithAuth() {
  const session = useAuthStore((state) => state.session);
  const loading = useAuthStore((state) => state.loading);
  const hydrate = useAuthStore((state) => state.hydrate);
  const redirectedRef = useRef(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (loading || session || redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;

    void (async () => {
      await showMainWindow();
      await hideCurrentWindow();
    })();
  }, [loading, session]);

  if (loading || !session) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-text-secondary">
        Checking session…
      </div>
    );
  }

  return (
    <AppBootstrap>
      <HudApp />
    </AppBootstrap>
  );
}
