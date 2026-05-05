export type MissionStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export type MissionColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'gray';

export const MISSION_COLORS: MissionColor[] = [
  'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray',
];

export interface Mission {
  id: string;

  // Core identity
  title: string;
  description: string;
  emoji: string;
  color: MissionColor;

  // Clarity fields — what, why, and when you know it's done
  objective: string;
  why_it_matters: string;
  definition_of_success: string;

  // Lifecycle
  status: MissionStatus;
  started_at: string | null;
  completed_at: string | null;
  target_date: string | null;

  // Effort & planning
  estimated_hours: number;

  // Organisation
  is_pinned: boolean;
  sort_order: number;
  tags: string[];

  // Free-form context
  notes: string;

  created_at: string;
  updated_at: string;
}

export interface MissionDraft {
  title: string;
  description?: string;
  emoji?: string;
  color?: MissionColor;
  objective?: string;
  whyItMatters?: string;
  definitionOfSuccess?: string;
  status?: MissionStatus;
  targetDate?: string | null;
  estimatedHours?: number;
  isPinned?: boolean;
  sortOrder?: number;
  tags?: string[];
  notes?: string;
}
