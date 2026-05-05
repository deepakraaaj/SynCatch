import { useEffect, useState } from 'react';

export function AnimatedLoading() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-gradient-to-br from-[#060A0C] via-[#0f1417] to-[#0a0d10]">
      <div className="flex flex-col items-center gap-6">
        {/* Animated Logo Circle */}
        <div className="relative w-24 h-24">
          {/* Outer rotating ring */}
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-accent/50"
            style={{
              animation: 'spin 2s linear infinite',
            }}
          />

          {/* Middle pulsing ring */}
          <div
            className="absolute inset-2 rounded-full border border-accent/30"
            style={{
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />

          {/* Inner dot */}
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-accent/40 to-accent/20 flex items-center justify-center">
            <div
              className="w-3 h-3 rounded-full bg-accent"
              style={{
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
                className="text-3xl font-bold text-accent"
                style={{
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
            className="text-xs uppercase tracking-widest text-text-muted/60"
            style={{
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
                className="w-1.5 h-1.5 rounded-full bg-accent/60"
                style={{
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
          className="absolute w-96 h-96 bg-accent/5 rounded-full blur-3xl"
          style={{
            bottom: '-100px',
            right: '-100px',
            animation: 'float 6s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-96 h-96 bg-accent/3 rounded-full blur-3xl"
          style={{
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
