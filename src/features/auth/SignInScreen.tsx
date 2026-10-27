import { useState } from 'react';
import { useAuthStore } from './auth-store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ToastViewport } from '../../components/ui/toast-viewport';
import { SynCatchEmblem } from '../../components/SynCatchLogo';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const { loading, error, signIn, signUp, requestPasswordReset, clearError, setLocalMode } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (isForgotPassword) {
      if (!email) return;
      try {
        await requestPasswordReset(email);
        setIsForgotPassword(false);
      } catch {
        // Error is already in store
      }
      return;
    }

    if (!email || !password) return;

    try {
      if (isSignUp) {
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
    } catch {
      // Error is already in store
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text-primary">
      {/* Line-grid field across the whole page, matching the module-icon grid language used elsewhere in the app. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgb(var(--border-strong) / 0.55) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--border-strong) / 0.55) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse 85% 70% at 50% 38%, black 0%, transparent 82%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 70% at 50% 38%, black 0%, transparent 82%)',
        }}
      />
      {/* Glow blooms — one broad wash behind the card, two tighter accents at opposite corners. */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-50 blur-[120px]"
        style={{ background: 'radial-gradient(closest-side, rgb(var(--accent) / 0.32), transparent)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full opacity-40 blur-[100px]"
        style={{ background: 'radial-gradient(closest-side, rgb(var(--accent) / 0.3), transparent)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full opacity-30 blur-[90px]"
        style={{ background: 'radial-gradient(closest-side, rgb(var(--accent-soft) / 0.35), transparent)' }}
      />

      <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[920px]">
          <div className="grid overflow-hidden rounded-[28px] border border-borderSoft/35 bg-panel/70 shadow-panel backdrop-blur-xl lg:grid-cols-2">
            {/* Brand panel */}
            <div className="relative hidden flex-col justify-between overflow-hidden border-borderSoft/35 bg-panel2/60 p-10 lg:flex lg:border-r">
              <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    'linear-gradient(rgb(var(--border-strong) / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--border-strong) / 0.6) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                  maskImage: 'linear-gradient(to bottom, black, transparent)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
                }}
              />
              <div
                className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-[90px]"
                style={{ background: 'radial-gradient(closest-side, rgb(var(--accent) / 0.4), transparent)' }}
              />

              <SynCatchEmblem className="relative h-24 w-auto self-start" />

              <div className="relative space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Sync aachaa?</p>
                <h2 className="max-w-xs text-2xl font-bold leading-snug text-text-primary">
                  Every mission, every task, always caught &amp; synced.
                </h2>
                <p className="max-w-xs text-sm leading-relaxed text-text-secondary">
                  <span className="font-semibold text-accent">Aachu.</span> Solo focus, team execution, one loop that never drops a beat.
                </p>
              </div>

              <div className="relative grid grid-cols-3 gap-3 text-xs text-text-muted">
                <div className="rounded-2xl border border-borderSoft/30 bg-panel/50 p-3">
                  <div className="text-sm font-bold text-text-primary">Missions</div>
                  <div className="mt-0.5">Projects &amp; goals</div>
                </div>
                <div className="rounded-2xl border border-borderSoft/30 bg-panel/50 p-3">
                  <div className="text-sm font-bold text-text-primary">Focus</div>
                  <div className="mt-0.5">Timers &amp; tasks</div>
                </div>
                <div className="rounded-2xl border border-borderSoft/30 bg-panel/50 p-3">
                  <div className="text-sm font-bold text-text-primary">Team Hub</div>
                  <div className="mt-0.5">Shared rooms</div>
                </div>
              </div>
            </div>

            {/* Form panel */}
            <div className="p-6 sm:p-10">
              <div className="mb-8 lg:hidden">
                <SynCatchEmblem className="h-20 w-auto" />
                <p className="mt-2 text-xs text-text-muted">Focus Operating System &amp; Venture Command Center</p>
              </div>

              <div className="mb-6">
                <h1 className="text-xl font-bold text-text-primary">
                  {isForgotPassword ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  {isForgotPassword
                    ? "We'll email you a link to get back in."
                    : isSignUp
                      ? 'Set up your account to start syncing.'
                      : 'Sign in to continue to your workspace.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && !isForgotPassword && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-text-secondary">Name</label>
                    <Input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      disabled={loading}
                      className="w-full"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    disabled={loading}
                    className="w-full"
                  />
                </div>

                {!isForgotPassword && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-xs font-semibold text-text-secondary">Password</label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            clearError();
                          }}
                          disabled={loading}
                          className="text-[11px] font-medium text-accent hover:text-accentSoft transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading}
                      className="w-full"
                    />
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !email || (!isForgotPassword && !password)}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  {loading
                    ? 'Loading…'
                    : isForgotPassword
                      ? 'Send reset link'
                      : isSignUp
                        ? 'Create account'
                        : 'Sign in'}
                </Button>
              </form>

              <div className="mt-4 text-center">
                {isForgotPassword ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      clearError();
                    }}
                    disabled={loading}
                    className="text-xs text-text-muted transition-colors hover:text-text-secondary"
                  >
                    Back to sign in
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      clearError();
                    }}
                    disabled={loading}
                    className="text-xs text-text-muted transition-colors hover:text-text-secondary"
                  >
                    {isSignUp
                      ? 'Already have an account? Sign in'
                      : "Don't have an account? Create one"}
                  </button>
                )}
              </div>

              <p className="mt-5 rounded-2xl border border-borderSoft/30 bg-panel2/40 px-3 py-2.5 text-center text-[11px] leading-relaxed text-text-muted">
                Team workspaces are joined after sign-in — create a room or request approval with an invite code.
              </p>

              <div className="mt-4 border-t border-borderSoft/25 pt-4">
                <Button type="button" onClick={() => setLocalMode(true)} variant="secondary" size="sm" className="w-full">
                  Instant Local Mode (No Account Required)
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ToastViewport />
    </div>
  );
}
