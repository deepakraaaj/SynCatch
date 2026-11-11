import lumiDirections from '../assets/lumi-mascot/directions.webp';
import lumiReactions from '../assets/lumi-mascot/reactions.webp';

/**
 * Every character the companion can be: Lumi (built from SynCatch's own art by
 * scripts/build-lumi-mascot.py) plus page-mascot's drawn cast and styles,
 * copied into public/mascots by scripts/import-page-mascots.py.
 */
export const MASCOT_GROUPS = [
  { label: 'Yours', names: ['lumi'] },
  {
    label: 'Animals',
    names: ['bear', 'bunny', 'cat', 'deer', 'dino', 'fox', 'frog', 'hamster', 'hedgehog', 'koala', 'mouse', 'otter', 'owl', 'panda', 'penguin', 'pug', 'raccoon', 'redpanda', 'sheep', 'sloth', 'tiger'],
  },
  {
    label: 'People',
    names: ['afro', 'astronaut', 'bald', 'ballerina', 'beard', 'builder', 'cap', 'chef', 'glasses', 'grandpa', 'granny', 'hijabi', 'kamran', 'nurse', 'pirate', 'scientist', 'sikh', 'skater', 'wizard'],
  },
  {
    label: 'Robots',
    names: ['clockwork', 'crt', 'cube', 'drone', 'gearbot', 'knight', 'lantern', 'postbot', 'radio', 'rocket', 'scout', 'toaster', 'tv'],
  },
  { label: 'Styles', names: ['fox-ink', 'fox-sketch', 'fox-riso', 'fox-paper', 'fox-pixel'] },
] as const;

export const DEFAULT_MASCOT = 'lumi';

const KNOWN = new Set<string>(MASCOT_GROUPS.flatMap((group) => group.names));

function served(path: string) {
  return `${import.meta.env.BASE_URL}mascots/${path}`;
}

/** The two sheets for a character; unknown names (e.g. a removed one still in synced prefs) fall back to Lumi. */
export function mascotSheets(name: string) {
  if (name === DEFAULT_MASCOT || !KNOWN.has(name)) return { directions: lumiDirections, reactions: lumiReactions };
  return { directions: served(`${name}-directions.webp`), reactions: served(`${name}-reactions.webp`) };
}

export function mascotThumb(name: string) {
  // Lumi has no thumbnail file; its directions sheet is small and already loaded.
  return name === DEFAULT_MASCOT ? null : served(`thumbs/${name}.webp`);
}

export function mascotLabel(name: string) {
  if (name === DEFAULT_MASCOT) return 'Lumi';
  if (name === 'redpanda') return 'Red panda';
  const [base, style] = name.split('-');
  const title = base.charAt(0).toUpperCase() + base.slice(1);
  return style ? `${title} (${style})` : title;
}
