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
