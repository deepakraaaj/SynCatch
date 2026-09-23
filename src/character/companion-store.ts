import { create } from 'zustand';
import {
  DEFAULT_COMPANION_SNAPSHOT,
  type CompanionMode,
  type CompanionSnapshot,
} from '../features/preferences/preferences-types';
import { REACTION_PRIORITY, reactionDurationMs, type CompanionReaction } from './lumi-controller';

export type { CompanionMode } from '../features/preferences/preferences-types';
export type { CompanionReaction } from './lumi-controller';

export interface LumiLine {
  text: string;
  /** Secondary line, e.g. the task title a reaction refers to. */
  detail?: string;
}

interface CompanionState extends CompanionSnapshot {
  hydrated: boolean;
  /** True only while the floating companion is actually rendered and unobstructed. */
  onStage: boolean;
  reaction: CompanionReaction;
  line: LumiLine | null;
  priority: number;
  reactionNonce: number;
  hydrate: () => Promise<void>;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  setMode: (mode: CompanionMode) => void;
  setDialogue: (dialogue: boolean) => void;
  setPosition: (position: CompanionSnapshot['position']) => void;
  setOnStage: (onStage: boolean) => void;
  react: (reaction: CompanionReaction, line?: LumiLine | null, priority?: number) => void;
  clearReaction: () => void;
}

// First-paint cache only; the preferences repository (Supabase when signed in)
// is the source of truth and overwrites this on hydrate.
const CACHE_KEY = 'missioncontrol-lumi-companion-cache';

function readCache(): CompanionSnapshot {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Partial<CompanionSnapshot> | null;
    return { ...DEFAULT_COMPANION_SNAPSHOT, ...(parsed ?? {}) };
  } catch {
    return DEFAULT_COMPANION_SNAPSHOT;
  }
}

let clearTimer: number | undefined;
let saveTimer: number | undefined;
let editedBeforeHydrate = false;

export const useCompanionStore = create<CompanionState>((set, get) => {
  function snapshot(): CompanionSnapshot {
    const { visible, mode, dialogue, position } = get();
    return { visible, mode, dialogue, position };
  }

  function commit(patch: Partial<CompanionSnapshot>) {
    set(patch);
    if (!get().hydrated) editedBeforeHydrate = true;
    const next = snapshot();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* cache is optional */ }
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void import('../features/preferences/preferences-repository')
        .then(({ getPreferencesRepository }) => getPreferencesRepository())
        .then((repository) => repository.saveCompanion(next))
        .catch((error) => console.error('Unable to persist Lumi companion', error));
    }, 400);
  }

  return {
    ...readCache(),
    hydrated: false,
    onStage: false,
    reaction: 'idle',
    line: null,
    priority: 0,
    reactionNonce: 0,
    hydrate: async () => {
      if (get().hydrated) return;
      try {
        const { getPreferencesRepository } = await import('../features/preferences/preferences-repository');
        const stored = await (await getPreferencesRepository()).loadCompanion();
        if (stored && !editedBeforeHydrate) {
          set(stored);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(stored)); } catch { /* cache is optional */ }
        }
      } catch (error) {
        console.error('Unable to load Lumi companion preferences', error);
      }
      set({ hydrated: true });
    },
    setVisible: (visible) => commit({ visible }),
    toggleVisible: () => commit({ visible: !get().visible }),
    setMode: (mode) => commit({ mode }),
    setDialogue: (dialogue) => commit({ dialogue }),
    setPosition: (position) => commit({ position }),
    setOnStage: (onStage) => set({ onStage }),
    react: (reaction, line = null, priority = REACTION_PRIORITY[reaction]) => {
      const current = get();
      const playing = current.reaction !== 'idle' || current.line !== null;
      if (playing && current.priority > priority) return;
      set({ reaction, line, priority, reactionNonce: current.reactionNonce + 1 });
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(get().clearReaction, reactionDurationMs(reaction, line?.text));
    },
    clearReaction: () => {
      window.clearTimeout(clearTimer);
      set({ reaction: 'idle', line: null, priority: 0 });
    },
  };
});

/**
 * The one way the app gives Lumi something to say. The expression change always
 * happens (every Lumi on screen reacts); the line is spoken by the floating
 * companion when it is on stage with messages on, otherwise `fallback` runs —
 * typically a toast — so exactly one voice delivers each moment.
 */
export function announceLumi(reaction: CompanionReaction, line: LumiLine | null, fallback?: () => void, priority?: number) {
  const store = useCompanionStore.getState();
  const spoken = Boolean(line) && store.onStage && store.dialogue;
  // An idle reaction with nothing to say would only replay the pop animation.
  if (spoken || reaction !== 'idle') store.react(reaction, spoken ? line : null, priority);
  if (!spoken) fallback?.();
}
