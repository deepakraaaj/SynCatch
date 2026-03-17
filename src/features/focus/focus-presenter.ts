import type { FocusStatus } from './focus-store';

export function getFocusStatusLabel(status: FocusStatus) {
  if (status === 'locked-in') {
    return 'Focused';
  }

  if (status === 'warming-up') {
    return 'Starting';
  }

  if (status === 'drifting') {
    return 'Off track';
  }

  return 'Idle';
}

export function getFocusStatusTone(status: FocusStatus) {
  if (status === 'drifting') {
    return 'warning' as const;
  }

  if (status === 'idle') {
    return 'neutral' as const;
  }

  return 'success' as const;
}

export function getFocusToggleLabel(status: FocusStatus) {
  return status === 'drifting' ? 'Refocus' : 'Mark Off Track';
}
