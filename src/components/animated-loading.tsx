import { useEffect, useState } from 'react';
import { SynCatchLogo } from './SynCatchLogo';

interface AnimatedLoadingProps {
  autoDismiss?: boolean;
  dismissAfter?: number;
}

export function AnimatedLoading({ autoDismiss = false, dismissAfter = 2000 }: AnimatedLoadingProps = {}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!autoDismiss) {
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, dismissAfter);

    return () => clearTimeout(timer);
  }, [autoDismiss, dismissAfter]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-8"
      style={{
        background: 'linear-gradient(180deg, rgb(var(--bg-base)) 0%, rgb(var(--bg-soft)) 100%)',
      }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Old DeepZ branding — replaced by SynCatch logo
        <div className="text-center">
          <h1
            className="text-7xl font-black tracking-tighter"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent)))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            DeepZ
          </h1>
          <p
            className="mt-3 text-lg font-medium tracking-widest"
            style={{ color: 'rgb(var(--accent) / 0.8)' }}
          >
            Deep Focus, Zero Distractions
          </p>
        </div>
        */}

        <div className="flex flex-col items-center gap-4 text-center">
          <SynCatchLogo className="h-20 w-20" />
          <div>
            <h1 className="text-5xl font-black tracking-tighter">
              <span className="text-text-primary">Syn</span>
              <span style={{ color: '#3E8BFF' }}>Catch</span>
            </h1>
            <p
              className="mt-3 text-base font-medium tracking-widest"
              style={{ color: 'rgb(var(--accent) / 0.8)' }}
            >
              Sync aachaa?
            </p>
          </div>
        </div>

        <div className="relative w-20 h-20">
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent"
            style={{
              borderTopColor: 'rgb(var(--accent))',
              borderRightColor: 'rgb(var(--accent) / 0.4)',
              animation: 'spin 2.5s linear infinite',
            }}
          />
          <div
            className="absolute inset-1.5 rounded-full border"
            style={{ borderColor: 'rgb(var(--accent) / 0.25)' }}
          />
          <div
            className="absolute inset-5 rounded-full flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle, rgb(var(--accent) / 0.3), rgb(var(--accent) / 0.1))',
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: 'rgb(var(--accent))' }}
            />
          </div>
        </div>

        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full animate-pulse"
              style={{
                backgroundColor: 'rgb(var(--accent) / 0.7)',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-10 text-center">
        <p
          className="text-sm uppercase tracking-widest"
          style={{ color: 'rgb(var(--text-muted) / 0.7)' }}
        >
          Aachu — caught &amp; synced ✓
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
