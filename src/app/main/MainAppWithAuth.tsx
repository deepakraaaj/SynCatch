import { useEffect } from 'react';
import { Target } from 'lucide-react';
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
      <div className="flex min-h-screen items-center justify-center bg-panel">
        <div className="flex flex-col items-center">
          <Target className="mb-4 h-10 w-10 animate-pulse text-accent" />
          <p className="text-sm text-text-muted">Loading MissionControl...</p>
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
