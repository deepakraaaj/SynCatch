import { motion, AnimatePresence } from 'framer-motion';
import { Check, CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { AutoSaveStatus } from '../../hooks/use-autosave';
import { useSettingsStore } from '../../features/settings/settings-store';
import { SparkleBurst } from '../../character/effects-assets';

export function SaveStatus({
  status,
  className,
}: {
  status: AutoSaveStatus;
  className?: string;
}) {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  return (
    <div className={cn('relative inline-flex items-center min-h-[26px]', className)}>
      <AnimatePresence mode="wait">
        {status !== 'idle' && (
          <motion.div
            key={status}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 2 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -2 }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
            className={cn(
              'relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border backdrop-blur-md transition-colors',
              status === 'saving' &&
                'border-borderSoft/50 bg-panel2/70 text-text-secondary shadow-sm',
              status === 'saved' &&
                'border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
              status === 'dirty' &&
                'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
              status === 'error' &&
                'border-danger/35 bg-danger/10 text-danger shadow-[0_0_12px_rgba(239,68,68,0.15)]',
            )}
          >
            {status === 'saved' && (
              <SparkleBurst className="-right-1 -top-2" size={18} reduceMotion={reduceMotion} />
            )}

            {status === 'dirty' && (
              <motion.span
                animate={reduceMotion ? {} : { scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]"
              />
            )}

            {status === 'saving' && (
              <motion.span
                animate={reduceMotion ? {} : { rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="flex items-center justify-center text-text-secondary"
              >
                <RefreshCw className="h-3 w-3" />
              </motion.span>
            )}

            {status === 'saved' && (
              <motion.span
                initial={reduceMotion ? {} : { scale: 0.4, rotate: -20 }}
                animate={reduceMotion ? {} : { scale: [0.4, 1.3, 1], rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="flex items-center justify-center"
              >
                <Check className="h-3 w-3 stroke-[2.5]" />
              </motion.span>
            )}

            {status === 'error' && (
              <motion.span
                animate={reduceMotion ? {} : { x: [-2, 2, -2, 2, 0] }}
                transition={{ duration: 0.4 }}
                className="flex items-center justify-center"
              >
                <CloudOff className="h-3 w-3" />
              </motion.span>
            )}

            <span>
              {status === 'saving' && 'Saving changes…'}
              {status === 'saved' && 'Saved'}
              {status === 'dirty' && 'Unsaved edits'}
              {status === 'error' && "Couldn't save"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
