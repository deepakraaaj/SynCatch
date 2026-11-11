/**
 * Lets the companion notice *any* click in the app, without per-feature
 * wiring: it plays a small reaction for what you clicked (see useMascotCue).
 * Real announcements (task done, focus started, ...) still outrank it.
 *
 * Classification is generic — a handful of buckets inferred from standard
 * DOM signals (role, aria-label/text keywords, element type) already present
 * on interactive elements throughout the app — so covering a new feature
 * needs no code change here.
 */

export type ClickPulse = 'poke' | 'delete' | 'open' | 'toggle' | 'submit';

const KEYWORD_BUCKETS: [ClickPulse, RegExp][] = [
  ['delete', /delete|remove|discard|trash|clear/i],
  ['submit', /create|add|save|send|start|launch|new /i],
  ['toggle', /pin|toggle|switch|enable|disable|show|hide/i],
  ['open', /open|view|expand|detail|edit/i],
];

function labelFor(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria;
  const text = el.textContent?.trim();
  return text && text.length <= 60 ? text : '';
}

function classify(el: Element): ClickPulse {
  const label = labelFor(el);
  for (const [pulse, pattern] of KEYWORD_BUCKETS) {
    if (pattern.test(label)) return pulse;
  }
  if (el.tagName === 'A' || el.getAttribute('role') === 'link') return 'open';
  if (el.getAttribute('role') === 'switch' || (el as HTMLInputElement).type === 'checkbox') return 'toggle';
  return 'poke';
}

const INTERACTIVE_SELECTOR = 'button, a, [role="button"], [role="link"], [role="switch"], input[type="checkbox"], input[type="radio"]';
/** Never react to clicks on the companion or a mascot — they already react to their own click. */
const IGNORE_SELECTOR = '[data-lumi-companion], [data-mascot]';

export type ClickPulseListener = (pulse: ClickPulse, event: MouseEvent) => void;

/**
 * Subscribes a listener to app-wide interactive clicks. Returns an
 * unsubscribe function. Each rendered mascot's cue hook subscribes once.
 */
export function subscribeLumiClickPulses(onPulse: ClickPulseListener): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(IGNORE_SELECTOR)) return;
    const el = target.closest(INTERACTIVE_SELECTOR);
    if (!el) return;
    onPulse(classify(el), event);
  };
  window.addEventListener('click', onClick, { capture: true, passive: true });
  return () => window.removeEventListener('click', onClick, { capture: true });
}
