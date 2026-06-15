import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Quote, Rocket, Zap } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useAuthStore } from '../auth/auth-store';
import { useSettingsStore } from '../settings/settings-store';

type DashboardNavTarget = 'focus' | 'tasks' | 'missions' | 'insights' | 'today' | 'journal';

interface DashboardViewProps {
  onNavigate: (view: DashboardNavTarget) => void;
  onNewTask: () => void;
  onNewMission: () => void;
}

function greeting(hour: number) {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Winding down';
}

function getDisplayName(metadata: Record<string, unknown> | undefined, email: string | undefined) {
  if (typeof metadata?.display_name === 'string' && metadata.display_name.trim()) {
    return metadata.display_name.trim().split(/\s+/)[0];
  }
  if (typeof metadata?.full_name === 'string' && metadata.full_name.trim()) {
    return metadata.full_name.trim().split(/\s+/)[0];
  }
  if (email) return email.split('@')[0];
  return 'Operator';
}

export function DashboardView({ onNavigate, onNewTask, onNewMission }: DashboardViewProps) {
  const session = useAuthStore((state) => state.session);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const [nowMs] = useState(() => Date.now());

  const now = new Date(nowMs);
  const name = getDisplayName(session?.user?.user_metadata, session?.user?.email);
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const fade = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade}>
        <Card className="relative min-h-[calc(100vh-180px)] overflow-hidden rounded-[34px] border border-borderSoft/30 p-6 shadow-panel sm:p-8">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent/15 via-accent/70 to-accent/15"
          />

          <div
            aria-hidden
            className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full border border-accent/15 bg-accent/5"
          />

          <div className="relative flex min-h-[calc(100vh-240px)] flex-col justify-between gap-8">
            <div className="space-y-4">
              <div className="max-w-3xl space-y-4">
                <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-6xl">
                  {greeting(now.getHours())}, {name}
                </h1>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[30px] border border-borderSoft/30 bg-panel/18 p-6 sm:p-8">
              <div aria-hidden className="absolute inset-y-0 left-0 w-px bg-accent/65" />
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                  <Quote className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <blockquote className="mt-4">
                    <p className="max-w-3xl text-2xl leading-10 text-text-primary sm:text-[1.9rem] sm:leading-[3rem]">
                      “Well begun is half done.”
                    </p>
                    <footer className="mt-4 text-sm text-text-secondary">Aristotle</footer>
                  </blockquote>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => onNavigate('focus')} type="button">
                <Zap className="h-4 w-4" />
                Start focus
              </Button>
              <Button onClick={onNewTask} type="button" variant="secondary">
                <Plus className="h-4 w-4" />
                New task
              </Button>
              <Button onClick={onNewMission} type="button" variant="secondary">
                <Rocket className="h-4 w-4" />
                New mission
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
