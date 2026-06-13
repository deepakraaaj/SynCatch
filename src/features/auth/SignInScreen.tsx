import { useState } from 'react';
import { isTauriApp } from '../../lib/tauri';
import { useAuthStore } from './auth-store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ToastViewport } from '../../components/ui/toast-viewport';
import { SynCatchLogo } from '../../components/SynCatchLogo';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const isDesktop = isTauriApp();

  const { loading, error, signIn, signUp, clearError, setLocalMode } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email || !password) {
      return;
    }

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch {
      // Error is already in store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3 flex items-center justify-center gap-3">
            <SynCatchLogo className="h-11 w-11" />
            <span>
              Syn<span style={{ color: '#3E8BFF' }}>Catch</span>
            </span>
          </h1>
          <p className="text-slate-400 text-lg">Capture ideas. Keep them in sync.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={loading}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !email || !password}
            variant="primary"
            className="w-full"
          >
            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              clearError();
            }}
            disabled={loading}
            className="text-slate-400 hover:text-slate-300 transition-colors text-sm"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Create one"}
          </button>
        </div>

        {isDesktop ? (
          <div className="mt-6 border-t border-slate-700 pt-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3 text-center">Or stay offline</h3>
            <Button
              type="button"
              onClick={() => setLocalMode(true)}
              variant="secondary"
              className="w-full border-slate-700 hover:bg-slate-800 text-slate-300"
            >
              Use Local Mode (No Sync)
            </Button>
            <p className="mt-3 text-xs text-slate-500 text-center">
              Your data will be saved locally on this computer only.
            </p>
          </div>
        ) : (
          <div className="mt-6 border-t border-slate-700 pt-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3 text-center">Looking for an offline experience?</h3>
            <a 
               href="https://github.com/deepakraaaj/MissionControl/releases" 
               target="_blank" 
               rel="noreferrer"
               className="flex items-center justify-center w-full px-4 py-2 border border-accent/30 text-accent hover:bg-accent/10 rounded-lg text-sm font-medium transition-colors"
            >
              Download the Desktop App
            </a>
            <p className="mt-3 text-xs text-slate-500 text-center">
              The desktop app features a built-in Local Mode that works entirely offline without an account.
            </p>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-slate-700">
          <p className="text-xs text-slate-500 text-center">
            Your data is securely stored and synced across all your devices in Cloud Mode.
          </p>
        </div>
      </div>

      <ToastViewport />
    </div>
  );
}
