export type ThemeId = 'dark-focus' | 'light-studio' | 'midnight-purple' | 'zen-mode';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  eyebrow: string;
  description: string;
  preview: [string, string, string];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'dark-focus',
    name: 'Dark Focus',
    eyebrow: 'Clarity under pressure',
    description: 'Deep navy surfaces with crisp cyan accents for high-attention work.',
    preview: ['#0b1020', '#182746', '#4adee6'],
  },
  {
    id: 'light-studio',
    name: 'Light Studio',
    eyebrow: 'Daylight planning',
    description: 'Warm paper tones and coral contrast for a calm, editorial desktop look.',
    preview: ['#f4efe7', '#ffffff', '#f97360'],
  },
  {
    id: 'midnight-purple',
    name: 'Midnight Purple',
    eyebrow: 'After-hours velocity',
    description: 'Velvet indigo glass and lavender highlights with softer night energy.',
    preview: ['#120f22', '#241c46', '#b7a6ff'],
  },
  {
    id: 'zen-mode',
    name: 'Zen Mode',
    eyebrow: 'Low-friction flow',
    description: 'Sage and sand tokens for a quieter workspace that still feels premium.',
    preview: ['#f0eee6', '#dfe6d7', '#3f7c5a'],
  },
];

