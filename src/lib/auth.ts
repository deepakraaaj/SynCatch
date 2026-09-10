import { createClient } from '@supabase/supabase-js';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const STORAGE_KEY = 'missioncontrol-auth-session';

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

export async function initSupabaseAuth(): Promise<SupabaseClient> {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase environment variables not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    // Let supabase-js own restoration and refresh under the same key the app
    // historically used. Manually calling setSession during client startup can
    // leave a stale cross-project JWT looking authenticated in the UI.
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storageKey: STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    supabaseClient = client;
    return client;
  })();

  return initPromise;
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized. Call initSupabaseAuth() first.');
  }
  return supabaseClient;
}

// Synchronous read of the locally cached session, used as a fallback when
// client.auth.getSession() can't resolve quickly (e.g. no network and a
// hung token-refresh request inside supabase-js's init lock).
export function getCachedSession(): Session | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as Session;
  } catch {
    return null;
  }
}

// Pure local sign-out: wipes the cached session without calling the
// network at all. Even `client.auth.signOut({ scope: 'local' })` still
// calls the remote /logout endpoint before clearing local state, so it can
// hang the same way a normal signOut() does when the server is unreachable.
// This is the guaranteed-safe fallback for that case.
export function clearLocalSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function getCurrentSupabaseSession(): Promise<Session | null> {
  const client = supabaseClient ?? await initSupabaseAuth();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function watchAuthChanges(
  callback?: (session: Session | null) => void,
): Promise<() => void> {
  const client = supabaseClient ?? await initSupabaseAuth();

  const { data } = client.auth.onAuthStateChange(async (event, session) => {
    // Use localStorage for both desktop and browser (works universally)
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else if (event === 'SIGNED_OUT') {
      localStorage.removeItem(STORAGE_KEY);
    }

    callback?.(session);
  });

  // Return unsubscribe function
  return () => data?.subscription?.unsubscribe();
}
