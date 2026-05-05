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
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-8"
      style={{
        background: 'linear-gradient(180deg, rgb(var(--bg-base)) 0%, rgb(var(--bg-soft)) 100%)',
      }}
    >
      {/* Main Content */}
      <div className="flex flex-col items-center gap-6 z-10">
        {/* DeepZ Title - Large & Prominent */}
        <div className="text-center">
          <h1
            className="text-7xl font-black tracking-tighter"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent)))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'fadeInDown 0.8s ease-out forwards',
              opacity: 0,
            }}
          >
            DeepZ
          </h1>
          {/* Tagline */}
          <p
            className="mt-3 text-lg font-medium tracking-widest"
            style={{
              color: 'rgb(var(--accent) / 0.8)',
              animation: 'fadeInUp 0.8s ease-out 0.2s forwards',
              opacity: 0,
            }}
          >
            Deep Focus, Zero Distractions
          </p>
        </div>

        {/* Animated Logo/Ring */}
        <div
          className="relative w-20 h-20"
          style={{
            animation: 'fadeInUp 0.8s ease-out 0.4s forwards',
            opacity: 0,
          }}
        >
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
            style={{
              borderColor: 'rgb(var(--accent) / 0.25)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          <div
            className="absolute inset-5 rounded-full flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle, rgb(var(--accent) / 0.3), rgb(var(--accent) / 0.1))',
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: 'rgb(var(--accent))',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* Loading Indicator */}
        <div
          className="flex gap-1.5"
          style={{
            animation: 'fadeIn 1s ease-out 0.6s forwards',
            opacity: 0,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full"
              style={{
                backgroundColor: 'rgb(var(--accent) / 0.7)',
                animation: 'bounce 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Status Text */}
      <div
        className="absolute bottom-10 text-center z-10"
        style={{
          animation: 'fadeIn 1s ease-out 0.8s forwards',
          opacity: 0,
        }}
      >
        <p
          className="text-sm uppercase tracking-widest"
          style={{
            color: 'rgb(var(--text-muted) / 0.7)',
          }}
        >
          Preparing your workspace
        </p>
      </div>

      {/* Floating background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgb(var(--accent) / 0.08), transparent)',
            filter: 'blur(120px)',
            bottom: '-100px',
            right: '-100px',
            animation: 'float 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgb(var(--accent) / 0.05), transparent)',
            filter: 'blur(120px)',
            top: '-100px',
            left: '-100px',
            animation: 'float 10s ease-in-out infinite',
            animationDelay: '-3s',
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
            opacity: 0.5;
            transform: scale(1.15);
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

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
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
            transform: translateY(30px);
          }
        }
      `}</style>
    </div>
  );
}
