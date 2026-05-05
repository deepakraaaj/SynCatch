import { useEffect } from 'react';
import { Target } from 'lucide-react';
import { useAuthStore } from '../../features/auth/auth-store';
import { SignInScreen } from '../../features/auth/SignInScreen';
import { AppBootstrap } from '../bootstrap';
import { MainApp } from './MainApp';
import { AnimatedLoading } from '../../components/animated-loading';

export function MainAppWithAuth() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const localMode = useAuthStore((s) => s.localMode);

  useEffect(() => {
    void useAuthStore.getState().hydrate();
  }, []);

  if (loading) {
    return <AnimatedLoading />;
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
