import { useFocusStore } from '../features/focus/focus-store';
import { useCompanionStore } from './companion-store';
import { resolveLumiExpression } from './lumi-controller';
import type { LumiExpression } from './lumi-assets';

/** The expression every full-size Lumi should be showing right now. */
export function useLumiExpression(): LumiExpression {
  const reaction = useCompanionStore((state) => state.reaction);
  const focusRunning = useFocusStore((state) => Boolean(state.focusSessionStart) || state.status === 'locked-in');
  return resolveLumiExpression({ reaction, focusRunning });
}
