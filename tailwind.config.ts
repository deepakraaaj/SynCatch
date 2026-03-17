import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './hud.html', './quick-add.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg-base) / <alpha-value>)',
        soft: 'rgb(var(--bg-soft) / <alpha-value>)',
        panel: 'rgb(var(--surface-1) / <alpha-value>)',
        panel2: 'rgb(var(--surface-2) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        accentSoft: 'rgb(var(--accent-soft) / <alpha-value>)',
        borderStrong: 'rgb(var(--border-strong) / <alpha-value>)',
        borderSoft: 'rgb(var(--border-subtle) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
        },
      },
      boxShadow: {
        panel: '0 24px 80px rgb(var(--shadow-color) / 0.35)',
        glow: '0 0 0 1px rgb(var(--accent) / 0.18), 0 18px 60px rgb(var(--accent) / 0.18)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', '"Segoe UI Variable"', '"Aptos"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseLine: {
          '0%, 100%': { opacity: '0.45', transform: 'scaleX(0.98)' },
          '50%': { opacity: '1', transform: 'scaleX(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.55s ease-out',
        float: 'float 4.8s ease-in-out infinite',
        pulseLine: 'pulseLine 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;

