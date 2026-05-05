import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../lib/auth';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../toasts/toast-store';

interface AuthStore {
  session: Session | null;
  loading: boolean;
  error: string | null;
  profileSaving: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
  localMode: boolean;
  setLocalMode: (enabled: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  loading: true,
  error: null,
  profileSaving: false,
  localMode: localStorage.getItem('mission-control-local-mode') === 'true',

  setLocalMode: (enabled: boolean) => {
    if (enabled) {
      localStorage.setItem('mission-control-local-mode', 'true');
    } else {
      localStorage.removeItem('mission-control-local-mode');
    }
    set({ localMode: enabled });
  },

  hydrate: async () => {
    const isLocalMode = localStorage.getItem('mission-control-local-mode') === 'true';

    // In local mode, skip Supabase initialization
    if (isLocalMode) {
      set({ session: null, loading: false, error: null, localMode: true });
      return;
    }

    try {
      const client = getSupabaseClient();
      if (!client) {
        set({ error: 'Supabase client unavailable', loading: false });
        return;
      }

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
      showSuccessToast('Signed in', data.user?.email ?? email);
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
      if (data.session) {
        showSuccessToast('Account created', data.user?.email ?? email);
      } else {
        showInfoToast('Account created', 'Check your inbox to confirm your email before signing in.');
      }
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
      showInfoToast('Signed out', 'Your workspace is locked until you sign back in.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      set({ error: message, loading: false });
      throw error;
    }
  },

  updateProfile: async (displayName) => {
    const currentSession = get().session;
    if (!currentSession) {
      showErrorToast('Profile unavailable', 'Sign in again to update your account details.');
      return;
    }

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      showInfoToast('Name required', 'Add a display name before saving your profile.');
      return;
    }

    set({ profileSaving: true });

    try {
      const client = getSupabaseClient();
      const existingMetadata = currentSession.user.user_metadata ?? {};
      const { data, error } = await client.auth.updateUser({
        data: {
          ...existingMetadata,
          display_name: trimmedName,
          full_name: trimmedName,
        },
      });

      if (error) {
        showErrorToast('Profile update failed', error.message);
        return;
      }

      if (data.user) {
        set((state) => ({
          session: state.session
            ? {
                ...state.session,
                user: data.user,
              }
            : state.session,
        }));
      }

      showSuccessToast('Profile updated', 'Your display name was saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update profile';
      showErrorToast('Profile update failed', message);
      throw error;
    } finally {
      set({ profileSaving: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
