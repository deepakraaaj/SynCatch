import { motion } from 'framer-motion';
import { Flame, Trophy } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { IntentSprite } from '../../character/IntentSprite';
import { ButterflyEffect } from '../../character/ButterflyEffect';
import { useCharacterState } from '../../character/useCharacterState';
import { MOOD_HEADLINES, MOOD_SUPPORTING_LINE } from '../../character/characterMessages';
import { useSettingsStore } from '../settings/settings-store';
import { stagger } from '../../lib/motion';

interface LumiHeroCardProps {
  /** Stagger index within the dashboard's entrance sequence. */
  index: number;
}

/**
 * "A tiny world where Lumi lives" — the dashboard's character-driven hero
 * section. Answers the two questions every screen should: where the user's
 * momentum stands right now, and what one small next action keeps it alive.
 */
export function LumiHeroCard({ index }: LumiHeroCardProps) {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const { state, shouldShowMilestone, acknowledgeMilestone } = useCharacterState();

  const headline = MOOD_HEADLINES[state.mood];
  const supportingLine = MOOD_SUPPORTING_LINE[state.mood];

  return (
    <motion.div {...stagger(index, reduceMotion)}>
      <Card className="relative overflow-hidden rounded-[26px] border border-borderSoft/30 p-5 shadow-panel sm:p-6">
        {shouldShowMilestone && state.milestoneReached && (
          <ButterflyEffect level={state.milestoneReached} reduceMotion={reduceMotion} onComplete={acknowledgeMilestone} />
        )}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <IntentSprite mood={state.mood} size="hero" reduceMotion={reduceMotion} />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold tracking-tight text-text-primary">{headline}</p>
            <p className="mt-1 text-[13px] text-text-secondary/80">{supportingLine}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[12px] font-semibold text-accent">
                <Flame className="h-3.5 w-3.5" />
                {state.streak} day{state.streak === 1 ? '' : 's'}
              </span>
              {state.bestStreak > state.streak && (
                <span className="flex items-center gap-1.5 rounded-full border border-borderSoft/30 bg-panel/40 px-3 py-1 text-[12px] font-medium text-text-muted">
                  <Trophy className="h-3.5 w-3.5" />
                  Best {state.bestStreak}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
