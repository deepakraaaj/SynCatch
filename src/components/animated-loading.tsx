import { useEffect, useState } from 'react';

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
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, rgb(var(--bg-base)) 0%, rgb(var(--bg-soft)) 100%)',
      }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Animated Logo Circle */}
        <div className="relative w-24 h-24">
          {/* Outer rotating ring */}
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent"
            style={{
              borderTopColor: 'rgb(var(--accent))',
              borderRightColor: 'rgb(var(--accent) / 0.5)',
              animation: 'spin 2s linear infinite',
            }}
          />

          {/* Middle pulsing ring */}
          <div
            className="absolute inset-2 rounded-full border"
            style={{
              borderColor: 'rgb(var(--accent) / 0.3)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />

          {/* Inner dot */}
          <div
            className="absolute inset-6 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(to bottom right, rgb(var(--accent) / 0.4), rgb(var(--accent) / 0.2))`,
            }}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: 'rgb(var(--accent))',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* DeepZ Text Animation */}
        <div className="text-center">
          <div className="flex gap-1 justify-center mb-2">
            {'DeepZ'.split('').map((letter, index) => (
              <span
                key={index}
                className="text-3xl font-bold"
                style={{
                  color: 'rgb(var(--accent))',
                  animation: `fadeInUp 0.6s ease-out forwards`,
                  animationDelay: `${index * 0.1}s`,
                  opacity: 0,
                }}
              >
                {letter}
              </span>
            ))}
          </div>

          {/* Animated subtitle */}
          <p
            className="text-xs uppercase tracking-widest"
            style={{
              color: 'rgb(var(--text-muted) / 0.6)',
              animation: 'fadeIn 1s ease-out 0.6s forwards',
              opacity: 0,
            }}
          >
            Loading your workspace
          </p>

          {/* Animated dots */}
          <div
            className="flex gap-1 justify-center mt-3"
            style={{
              animation: 'fadeIn 1s ease-out 0.8s forwards',
              opacity: 0,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: 'rgb(var(--accent) / 0.6)',
                  animation: 'bounce 1.4s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl"
          style={{
            backgroundColor: 'rgb(var(--accent) / 0.05)',
            bottom: '-100px',
            right: '-100px',
            animation: 'float 6s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl"
          style={{
            backgroundColor: 'rgb(var(--accent) / 0.03)',
            top: '-100px',
            left: '-100px',
            animation: 'float 8s ease-in-out infinite',
            animationDelay: '-2s',
          }}
        />
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

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
            opacity: 1;
          }
          50% {
            transform: translateY(-8px);
            opacity: 0.6;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(20px);
          }
        }
      `}</style>
    </div>
  );
}
