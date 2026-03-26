export type SessionPresetId = 'quick-push' | 'focus' | 'deep-work' | 'flow' | 'custom';
export type SessionSegmentType = 'focus' | 'pause' | 'break' | 'distraction';
export type SessionCaptureKind =
  | 'idea'
  | 'resource'
  | 'distraction'
  | 'note'
  | 'blocker'
  | 'follow-up';

export interface SessionPreset {
  id: SessionPresetId;
  label: string;
  minutes: number;
}

export interface SessionSegment {
  id: string;
  type: SessionSegmentType;
  started_at: string;
  ended_at: string | null;
  detail: string;
}

export interface SessionCapture {
  id: string;
  kind: SessionCaptureKind;
  content: string;
  created_at: string;
}

export interface WorkSession {
  id: string;
  task_id: string;
  task_title: string;
  preset_id: SessionPresetId;
  planned_minutes: number;
  status: 'running' | 'paused' | 'completed';
  started_at: string;
  ended_at: string | null;
  updated_at: string;
  segments: SessionSegment[];
  captures: SessionCapture[];
}

export interface SessionRecoveryState {
  session_id: string;
  task_id: string;
  task_title: string;
  paused_at: string;
  remaining_minutes: number;
}

export interface SessionMetrics {
  focus_seconds: number;
  pause_seconds: number;
  break_seconds: number;
  distraction_seconds: number;
}

export const SESSION_PRESETS: SessionPreset[] = [
  { id: 'quick-push', label: 'Quick Push', minutes: 10 },
  { id: 'focus', label: 'Focus', minutes: 25 },
  { id: 'deep-work', label: 'Deep Work', minutes: 50 },
  { id: 'flow', label: 'Flow', minutes: 90 },
];

export const CUSTOM_SESSION_MINUTES = Array.from({ length: 23 }, (_, index) => (index + 2) * 5);
