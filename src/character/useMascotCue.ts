import { useEffect, useState } from 'react';
import { useCompanionStore, type CompanionReaction } from './companion-store';
import { subscribeLumiClickPulses, type ClickPulse } from './lumi-click-reactions';
import type { Reaction } from './Mascot';

/** App events (announceLumi) → the face the mascot shows. */
const EVENT_FACE: Record<Exclude<CompanionReaction, 'idle'>, Reaction> = {
  smile: 'heart',
  notice: 'surprised',
  focus: 'sparkle',
  celebrate: 'delighted',
  comfort: 'bashful',
  sleep: 'sleepy',
};

/** Clicks anywhere in the app → a small acknowledgement. */
const CLICK_FACE: Record<ClickPulse, Reaction> = {
  submit: 'heart',
  delete: 'surprised',
  toggle: 'wink',
  open: 'sparkle',
  poke: 'blink',
};

/** A click right after a real event must not cut that event's reaction short. */
const EVENT_HOLD_MS = 1500;

let nextId = 0;

/** What the mascot should react to right now: app events first, then clicks. */
export function useMascotCue() {
  // Mounting mid-reaction (e.g. the companion reappearing as a composer closes
  // on "task created") still shows the event that is playing.
  const [cue, setCue] = useState<{ reaction: Reaction; id: number } | null>(() => {
    const { reaction } = useCompanionStore.getState();
    return reaction === 'idle' ? null : { reaction: EVENT_FACE[reaction], id: ++nextId };
  });

  useEffect(() => {
    let eventAt = useCompanionStore.getState().reaction === 'idle' ? 0 : Date.now();
    const offStore = useCompanionStore.subscribe((state, previous) => {
      if (state.reactionNonce === previous.reactionNonce || state.reaction === 'idle') return;
      eventAt = Date.now();
      setCue({ reaction: EVENT_FACE[state.reaction], id: ++nextId });
    });
    const offClicks = subscribeLumiClickPulses((pulse) => {
      if (Date.now() - eventAt < EVENT_HOLD_MS) return;
      setCue({ reaction: CLICK_FACE[pulse], id: ++nextId });
    });
    return () => {
      offStore();
      offClicks();
    };
  }, []);

  return cue;
}
