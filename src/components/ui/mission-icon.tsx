import {
  Target,
  Rocket,
  Zap,
  Flame,
  Leaf,
  Building,
  Puzzle,
  Lightbulb,
  Package,
  Shield,
  Users,
  Palette,
  Microscope,
  HelpCircle
} from 'lucide-react';

export const MISSION_ICONS = {
  Target,
  Rocket,
  Zap,
  Flame,
  Leaf,
  Building,
  Puzzle,
  Lightbulb,
  Package,
  Shield,
  Users,
  Palette,
  Microscope,
} as const;

export type MissionIconName = keyof typeof MISSION_ICONS;

export const ICON_PRESETS = Object.keys(MISSION_ICONS) as MissionIconName[];

export function MissionIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = MISSION_ICONS[icon as MissionIconName];
  
  if (IconComponent) {
    return <IconComponent className={className} />;
  }

  // Fallback for legacy emojis
  return <span className={className}>{icon}</span>;
}
