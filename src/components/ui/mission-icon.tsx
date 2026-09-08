import {
  Target,
  Flag,
  Compass,
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
  HelpCircle,
  Activity,
  Dumbbell,
  Tag,
  Layers,
  Calendar,
  CheckSquare,
  Globe,
  Folder,
  FileText,
  Star,
  Smartphone,
  Zap,
  type LucideIcon
} from 'lucide-react';

export const MISSION_ICONS = {
  Target,
  Rocket: Flag,
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
  Activity,
  Dumbbell,
  Tag,
  Layers,
  Calendar,
  CheckSquare,
  Globe,
  Folder,
  FileText,
  Sparkles: Star,
  Smartphone,
  HelpCircle,
} as const;

export type MissionIconName = keyof typeof MISSION_ICONS;

export const ICON_PRESETS = Object.keys(MISSION_ICONS) as MissionIconName[];

const EMOJI_TO_ICON: Record<string, LucideIcon> = {
  '⚽': Activity,
  '🏋️': Dumbbell,
  '🏋': Dumbbell,
  '🏷️': Tag,
  '🏷': Tag,
  '🎪': Compass,
  '🎯': Target,
  '🚀': Flag,
  '⚡': Zap,
  '🔥': Flame,
  '💡': Lightbulb,
  '📱': Smartphone,
  '📋': CheckSquare,
  '🗺️': Compass,
  '🎨': Palette,
  '🔗': Globe,
  '🧠': Puzzle,
  '🏢': Building,
  '💬': FileText,
  '🛡️': Shield,
  '🛡': Shield,
};

export function MissionIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = MISSION_ICONS[icon as MissionIconName];
  
  if (IconComponent) {
    return <IconComponent className={className} />;
  }

  // If it's a legacy emoji, map it directly to a clean SVG icon
  const MappedIcon = EMOJI_TO_ICON[icon];
  if (MappedIcon) {
    return <MappedIcon className={className} />;
  }

  // Default clean fallback
  return <Target className={className} />;
}
