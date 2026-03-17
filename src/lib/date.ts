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
