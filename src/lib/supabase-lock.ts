export function isSupabaseLockInterruption(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && (
    message.includes("Lock broken by another request with the 'steal' option") ||
    message.includes('was released because another request stole it')
  );
}

// Only retry reads: an interrupted lock's callback can still finish, so
// retrying a write could apply the same mutation twice.
export async function retrySupabaseRead<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (!isSupabaseLockInterruption(error) || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}

function isNetworkFailure(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('network')
  );
}

// Retries both lock interruptions and transient network failures (e.g. a
// QUIC idle timeout dropping the request). A bare fetch failure isn't a lock
// interruption, so retrySupabaseRead alone won't retry it — this is the
// general-purpose version every hydration path should use for reads.
export async function retryTransient<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if ((!isSupabaseLockInterruption(error) && !isNetworkFailure(error)) || attempt >= 2) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
}
