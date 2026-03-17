import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-accent/95 to-accentSoft/90 text-[rgb(var(--accent-contrast))] shadow-glow hover:from-accent hover:to-accent active:translate-y-px',
  secondary:
    'border border-borderSoft/40 bg-panel/60 text-text-primary hover:border-borderStrong/40 hover:bg-panel/78',
  ghost:
    'bg-transparent text-text-secondary hover:bg-panel/48 hover:text-text-primary',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-2xl px-3 text-sm',
  md: 'h-11 rounded-[18px] px-4 text-sm',
  lg: 'h-12 rounded-[22px] px-5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[0.01em] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/35 disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
