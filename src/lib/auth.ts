import { createClient } from '@supabase/supabase-js';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const STORAGE_KEY = 'missioncontrol-auth-session';

let supabaseClient: SupabaseClient | null = null;

export async function initSupabaseAuth(): Promise<SupabaseClient> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Try to restore session from localStorage (works for both desktop and browser)
  const storedSession = localStorage.getItem(STORAGE_KEY);
  if (storedSession) {
    try {
      const session = JSON.parse(storedSession) as Session;
      await client.auth.setSession(session);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  supabaseClient = client;
  return client;
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized. Call initSupabaseAuth() first.');
  }
  return supabaseClient;
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
