import { useState } from 'react';
import { useAuthStore } from './auth-store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ToastViewport } from '../../components/ui/toast-viewport';
import { SynCatchEmblem } from '../../components/SynCatchLogo';

interface ResetPasswordScreenProps {
  onDone: () => void;
}

export function ResetPasswordScreen({ onDone }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);
  const { loading, error, updatePassword, clearError } = useAuthStore();

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!password || password.length < 6 || mismatch) {
      return;
    }

    try {
      await updatePassword(password);
      setDone(true);
    } catch {
      // Error is already in store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3 flex items-center justify-center gap-3">
            <SynCatchEmblem className="h-24 w-auto" />
          </h1>
          <p className="text-slate-400 text-lg">
            {done ? 'Password updated' : 'Choose a new password'}
          </p>
        </div>

        {done ? (
          <div className="space-y-6">
            <p className="text-center text-sm text-slate-400">
              Your password has been updated. Continue to sign in with it.
            </p>
            <Button type="button" onClick={onDone} variant="primary" className="w-full">
              Continue
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">New password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Confirm password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full"
              />
              {mismatch && (
                <p className="mt-2 text-xs text-red-400">Passwords don't match.</p>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !password || password.length < 6 || mismatch}
              variant="primary"
              className="w-full"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        )}
      </div>

      <ToastViewport />
    </div>
  );
}
