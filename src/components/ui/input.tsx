import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={cn(
          'h-12 w-full rounded-[18px] border border-white/8 bg-black/20 px-4 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent/35 focus:bg-black/28',
          props.className,
        )}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea(props, ref) {
    return (
      <textarea
        ref={ref}
        {...props}
        className={cn(
          'w-full rounded-[22px] border border-white/8 bg-black/20 px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent/35 focus:bg-black/28',
          props.className,
        )}
      />
    );
  },
);
