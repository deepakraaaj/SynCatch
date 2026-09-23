import { motion } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, Flame } from 'lucide-react';
import { ButterflyEffect } from '../../character/ButterflyEffect';
import { Lumi } from '../../character/Lumi';
import { useCharacterState } from '../../character/useCharacterState';
import { useLumiExpression } from '../../character/useLumiExpression';
import { useLumiGaze } from '../../character/useLumiGaze';
import { MOOD_HEADLINES, MOOD_SUPPORTING_LINE } from '../../character/characterMessages';
import { stagger } from '../../lib/motion';
import { useSettingsStore } from '../settings/settings-store';

interface LumiHeroCardProps { index: number; doneToday: number; nextTask?: string; onStartSprint: () => void; }

export function LumiHeroCard({ index, doneToday, nextTask, onStartSprint }: LumiHeroCardProps) {
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const { state, shouldShowMilestone, acknowledgeMilestone } = useCharacterState();
  // Same face as every other Lumi: reacts to task/focus events, rests on the mood.
  const expression = useLumiExpression(state.mood);
  const lumiRef = useRef<HTMLDivElement>(null);
  const gaze = useLumiGaze(lumiRef, !reduceMotion);

  return (
    <motion.section {...stagger(index, reduceMotion)} className="relative isolate min-h-[330px] overflow-hidden rounded-[30px] bg-gradient-to-r from-accent/10 via-panel/35 to-transparent px-6 py-8 sm:px-10 lg:min-h-[360px] lg:px-14">
      <div aria-hidden className="absolute inset-y-8 left-0 w-1 rounded-full bg-accent/70" />
      <div aria-hidden className="absolute -left-16 top-1/2 -z-10 h-72 w-72 -translate-y-1/2 rounded-full bg-accent/12 blur-3xl" />
      {shouldShowMilestone && state.milestoneReached ? <ButterflyEffect level={state.milestoneReached} reduceMotion={reduceMotion} onComplete={acknowledgeMilestone} /> : null}

      <div className="grid min-h-[270px] items-center gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="relative z-10 max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-accent">Your intention, made visible</p>
          <h2 className="mt-4 text-3xl font-bold leading-[1.05] tracking-[-0.045em] text-text-primary sm:text-5xl">{MOOD_HEADLINES[state.mood]}</h2>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-text-secondary/80">{MOOD_SUPPORTING_LINE[state.mood]}</p>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <span><strong className="text-xl text-text-primary">{state.streak}</strong><small className="ml-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">day rhythm</small></span>
            <span><strong className="text-xl text-text-primary">{doneToday}</strong><small className="ml-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">wins today</small></span>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onStartSprint} className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-[18px] bg-accent px-5 text-sm font-bold text-[rgb(var(--accent-contrast))] shadow-[0_5px_0_rgb(var(--accent)/0.32)] transition-transform active:translate-y-1"><Flame className="h-4 w-4" /><span className="max-w-[260px] truncate">{nextTask ?? 'Start one focused sprint'}</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></button>
          </div>
        </div>

        <div aria-hidden className="pointer-events-none absolute -bottom-9 -right-10 opacity-95 lg:bottom-[-38px] lg:right-5">
          <div className="absolute inset-[25%] rounded-full bg-accent/25 blur-3xl" />
          <div ref={lumiRef} className="relative h-[230px] w-[230px] drop-shadow-[0_24px_24px_rgb(var(--shadow-color)/0.25)] sm:h-[270px] sm:w-[270px]">
            <Lumi expression={expression} size="fill" reduceMotion={reduceMotion} gaze={gaze} headGaze={gaze.head} label="" />
          </div>
        </div>
      </div>
    </motion.section>
  );
}
