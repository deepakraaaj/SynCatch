export type ThemeId =
  | 'dark-focus'
  | 'light-studio'
  | 'midnight-purple'
  | 'zen-mode'
  | 'solar-flare'
  | 'rose-quartz';

export interface ThemeTokens {
  /** App background */
  bg: string;
  /** Card / panel surface */
  panel: string;
  /** Accent color */
  accent: string;
  /** Primary text */
  text: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  eyebrow: string;
  description: string;
  mode: 'dark' | 'light';
  /** Real token hexes — kept in sync with the [data-theme] blocks in globals.css.
   *  Used to render accurate live mini-previews in the theme picker. */
  tokens: ThemeTokens;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'dark-focus',
    name: 'Dark Focus',
    eyebrow: 'Clarity under pressure',
    description: 'Deep navy surfaces with crisp cyan accents for high-attention work.',
    mode: 'dark',
    tokens: { bg: '#060a0c', panel: '#11161a', accent: '#82e7dc', text: '#f1f6f7' },
  },
  {
    id: 'light-studio',
    name: 'Light Studio',
    eyebrow: 'Daylight planning',
    description: 'Warm paper tones with coral contrast for a calm, editorial desktop look.',
    mode: 'light',
    tokens: { bg: '#f0ede5', panel: '#fffffc', accent: '#ef6450', text: '#2c2722' },
  },
  {
    id: 'midnight-purple',
    name: 'Midnight Purple',
    eyebrow: 'After-hours velocity',
    description: 'Velvet indigo glass and lavender highlights with softer night energy.',
    mode: 'dark',
    tokens: { bg: '#0d0a17', panel: '#1c162d', accent: '#a1bdff', text: '#f4f0ff' },
  },
  {
    id: 'zen-mode',
    name: 'Zen Mode',
    eyebrow: 'Low-friction flow',
    description: 'Sage and sand tokens for a quieter workspace that still feels premium.',
    mode: 'light',
    tokens: { bg: '#ebeee6', panel: '#fbfcf8', accent: '#3f7a5a', text: '#232b24' },
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    eyebrow: 'Warm deep work',
    description: 'Espresso surfaces lit by molten amber — cozy, high-energy night focus.',
    mode: 'dark',
    tokens: { bg: '#120c08', panel: '#221710', accent: '#ff9a3d', text: '#fbf2e8' },
  },
  {
    id: 'rose-quartz',
    name: 'Rose Quartz',
    eyebrow: 'Soft & bright',
    description: 'Blush paper and rose accents for a light, friendly, expressive desk.',
    mode: 'light',
    tokens: { bg: '#f6eef0', panel: '#fffafc', accent: '#e0517a', text: '#2e2329' },
  },
];
