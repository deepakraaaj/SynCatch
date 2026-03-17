import type { PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';

interface BadgeProps {
  tone?: 'neutral' | 'accent' | 'success' | 'warning';
  className?: string;
}

const toneClasses = {
  neutral: 'border border-white/8 bg-white/[0.04] text-text-secondary',
  accent: 'border border-accent/20 bg-accent/12 text-accent',
  success: 'border border-success/20 bg-success/12 text-success',
  warning: 'border border-warning/20 bg-warning/12 text-warning',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: PropsWithChildren<BadgeProps>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em]',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
