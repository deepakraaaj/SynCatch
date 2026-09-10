import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { useAuthStore } from '../../features/auth/auth-store';
import { SignInScreen } from '../../features/auth/SignInScreen';
import { ResetPasswordScreen } from '../../features/auth/ResetPasswordScreen';
import { AppBootstrap } from '../bootstrap';
import { MainApp } from './MainApp';
import { AnimatedLoading } from '../../components/animated-loading';

function isPasswordRecoveryLink(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    new URLSearchParams(window.location.search).get('type') === 'recovery' ||
    window.location.hash.includes('type=recovery')
  );
}

export function MainAppWithAuth() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const localMode = useAuthStore((s) => s.localMode);
  const [showReset, setShowReset] = useState(isPasswordRecoveryLink);

  useEffect(() => {
    void useAuthStore.getState().hydrate();
    // Remove the initial HTML loading screen now that React has mounted
    if (typeof window !== 'undefined' && (window as any).removeInitialLoading) {
      (window as any).removeInitialLoading();
    }
  }, []);

  if (loading) {
    return (
      <AnimatedLoading
        showEscapeAfter={8000}
        onRetry={() => void useAuthStore.getState().hydrate()}
        onSignOut={() => void useAuthStore.getState().signOut()}
      />
    );
  }

  if (showReset) {
    return (
      <ResetPasswordScreen
        onDone={() => {
          window.history.replaceState(null, '', window.location.pathname);
          setShowReset(false);
        }}
      />
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
