import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { clearLocalSession, getCachedSession, getSupabaseClient } from '../../lib/auth';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../toasts/toast-store';
import { syncEngine } from '../../lib/sync-engine';

interface AuthStore {
  session: Session | null;
  loading: boolean;
  error: string | null;
  profileSaving: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
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

      // client.auth.getSession() can hang indefinitely if supabase-js's init
      // lock never resolves (e.g. a stuck token-refresh fetch with no
      // network). Fall back to the locally cached session so the UI never
      // gets stuck on "Checking session...".
      const timeout = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 4000),
      );
      const result = await Promise.race([client.auth.getSession(), timeout]);

      if (result === 'timeout') {
        set({ session: getCachedSession(), loading: false, error: null });
        return;
      }

      const { data, error } = result;

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
      void syncEngine.downloadAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      set({ error: message, loading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string, displayName?: string) => {
    set({ loading: true, error: null });
    try {
      const client = getSupabaseClient();
      const trimmedName = displayName?.trim();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        // Persist the name into user_metadata so it's available everywhere
        // (profile card, collaborator lookup) right from signup.
        options: {
          ...(trimmedName ? { data: { display_name: trimmedName, full_name: trimmedName } } : {}),
          emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
        },
      });

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({ session: data.session, loading: false, error: null });
      if (data.session) {
        showSuccessToast('Account created', data.user?.email ?? email);
        void syncEngine.downloadAll();
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

      // client.auth.signOut() calls the remote endpoint first; if the network
      // or Supabase's edge is down that call can hang well past any sane
      // wait, leaving `loading` stuck true with no way out of the app. Race
      // it against a timeout and fall back to a pure local clear — even
      // `signOut({ scope: 'local' })` still calls the remote endpoint before
      // clearing local state, so it isn't a safe fallback here. Sign-out
      // should always be able to get the user back to the sign-in screen,
      // online or not.
      const timeout = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 4000),
      );
      const result = await Promise.race([client.auth.signOut(), timeout]);

      if (result === 'timeout' || result.error) {
        clearLocalSession();
      }

      set({ session: null, loading: false, error: null });
      const [{ useTeamRoomStore }, { disconnectTeamRoomSync }, { useTeamStore }] = await Promise.all([
        import('../team/team-room-store'), import('../team/team-room-sync'), import('../team/team-store'),
      ]);
      disconnectTeamRoomSync();
      useTeamRoomStore.getState().reset();
      useTeamStore.getState().lockTeam();
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

  requestPasswordReset: async (email: string) => {
    set({ loading: true, error: null });
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}?type=recovery`,
      });

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({ loading: false, error: null });
      showSuccessToast('Reset link sent', `Check ${email} for a link to reset your password.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reset link';
      set({ error: message, loading: false });
      throw error;
    }
  },

  updatePassword: async (newPassword: string) => {
    set({ loading: true, error: null });
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.updateUser({ password: newPassword });

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      const currentSession = get().session;
      set({
        session: currentSession ? { ...currentSession, user: data.user } : currentSession,
        loading: false,
        error: null,
      });
      showSuccessToast('Password updated', 'Sign in with your new password.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      set({ error: message, loading: false });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
