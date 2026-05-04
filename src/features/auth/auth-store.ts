import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../lib/auth';

interface AuthStore {
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  loading: true,
  error: null,

  hydrate: async () => {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.getSession();

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({ session: data.session, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to hydrate auth';
      set({ error: message, loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({ session: data.session, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      set({ error: message, loading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signUp({ email, password });

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({ session: data.session, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      set({ error: message, loading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.signOut();

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({ session: null, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      set({ error: message, loading: false });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
