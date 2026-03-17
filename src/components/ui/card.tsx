import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...props }: PropsWithChildren<CardProps>) {
  return (
    <div className={cn('surface-panel rounded-[30px] p-5', className)} {...props}>
      {children}
    </div>
  );
}
