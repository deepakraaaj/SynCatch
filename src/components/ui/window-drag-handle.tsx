import type { HTMLAttributes, PointerEvent } from 'react';
import { isTauriApp } from '../../lib/tauri';
import { cn } from '../../lib/cn';

type WindowDragHandleProps = HTMLAttributes<HTMLDivElement>;

export function WindowDragHandle({ className, ...props }: WindowDragHandleProps) {
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (target?.closest('button, input, textarea, a, select')) {
      return;
    }

    if (!isTauriApp()) {
      return;
    }

    void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      void getCurrentWindow().startDragging();
    });
  };

  return (
    <div
      className={cn('cursor-move select-none', className)}
      onPointerDown={handlePointerDown}
      {...props}
    />
  );
}
