import { useEffect } from 'react';
import { useAuthStore } from '../../features/auth/auth-store';
import { SignInScreen } from '../../features/auth/SignInScreen';
import { AppBootstrap } from '../bootstrap';
import { MainApp } from './MainApp';

export function MainAppWithAuth() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const hydrate = useAuthStore((s) => s.hydrate);
  const localMode = useAuthStore((s) => s.localMode);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="text-4xl mb-4">🎯</div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session && !localMode) {
    return <SignInScreen />;
  }

  return (
    <AppBootstrap>
      <MainApp />
    </AppBootstrap>
  );
}
