/** Local calendar-day key (YYYY-MM-DD), used everywhere streaks/consistency are computed by day. */
export function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getElapsedSeconds(sessionStart: string | null, baseElapsedSeconds = 0) {
  if (!sessionStart) {
    return baseElapsedSeconds;
  }

  return Math.max(
    baseElapsedSeconds,
    baseElapsedSeconds + Math.floor((Date.now() - new Date(sessionStart).getTime()) / 1000),
  );
}

export function formatRelativeTime(iso: string) {
  const timestamp = new Date(iso).getTime();
  const diffMinutes = Math.round((Date.now() - timestamp) / 60000);

  if (diffMinutes < 1) {
    return 'just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatDayDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

export function formatDayDateWithRelative(iso: string) {
  const dayDate = formatDayDate(iso);

  if (dayDate === 'Today') {
    return `Today · ${formatRelativeTime(iso)}`;
  }
  if (dayDate === 'Yesterday') {
    return 'Yesterday';
  }

  const diffDays = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return diffDays <= 30 ? `${dayDate} · ${diffDays}d ago` : dayDate;
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function formatElapsedClock(sessionStart: string | null, baseElapsedSeconds = 0) {
  const elapsedSeconds = getElapsedSeconds(sessionStart, baseElapsedSeconds);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
