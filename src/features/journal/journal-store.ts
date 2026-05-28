import { create } from 'zustand';
import { sortJournalEntries, toLocalDateString } from './journal-helpers';
import { getJournalRepository } from './journal-repository';
import type { JournalEntry, JournalDay, JournalEntryDraft } from './journal-types';
import { showSuccessToast } from '../toasts/toast-store';

interface JournalStore {
  entries: JournalEntry[];
  days: JournalDay[];
  selectedDate: string;
  hydrated: boolean;
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  createEntry: (draft: JournalEntryDraft) => Promise<JournalEntry>;
  updateEntry: (entry: JournalEntry) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  saveDay: (day: JournalDay) => Promise<void>;
  selectDate: (date: string) => void;
}

export const useJournalStore = create<JournalStore>((set, get) => ({
  entries: [],
  days: [],
  selectedDate: toLocalDateString(new Date()),
  hydrated: false,
  loading: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated || get().loading) return;
    set({ loading: true, error: null });
    try {
      const repo = await getJournalRepository();
      const entries = sortJournalEntries(await repo.listEntries());
      const days = await repo.listDays();
      set({
        entries,
        days,
        hydrated: true,
        loading: false,
        selectedDate: toLocalDateString(new Date()),
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load journal',
      });
    }
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const repo = await getJournalRepository();
      const entries = sortJournalEntries(await repo.listEntries());
      const days = await repo.listDays();
      set({
        entries,
        days,
        loading: false,
        hydrated: true,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to refresh journal',
      });
    }
  },

  createEntry: async (draft) => {
    const repo = await getJournalRepository();
    const entry = await repo.createEntry(draft);
    set((state) => ({
      entries: sortJournalEntries([entry, ...state.entries]),
    }));
    showSuccessToast('Entry added', entry.kind);
    return entry;
  },

  updateEntry: async (entry) => {
    const repo = await getJournalRepository();
    const updated: JournalEntry = { ...entry, updated_at: new Date().toISOString() };
    await repo.updateEntry(updated);
    set((state) => ({
      entries: sortJournalEntries(state.entries.map((e) => (e.id === updated.id ? updated : e))),
    }));
  },

  deleteEntry: async (entryId) => {
    const entry = get().entries.find((e) => e.id === entryId);
    const repo = await getJournalRepository();
    await repo.deleteEntry(entryId);
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== entryId),
    }));
    if (entry) {
      showSuccessToast('Entry deleted', entry.kind);
    }
  },

  saveDay: async (day) => {
    const repo = await getJournalRepository();
    const updated: JournalDay = { ...day, updated_at: new Date().toISOString() };
    await repo.saveDay(updated);
    set((state) => {
      const existing = state.days.findIndex((d) => d.entry_date === updated.entry_date);
      if (existing >= 0) {
        const newDays = [...state.days];
        newDays[existing] = updated;
        return { days: newDays };
      }
      return { days: [...state.days, updated] };
    });
  },

  selectDate: (date) => set({ selectedDate: date }),
}));
