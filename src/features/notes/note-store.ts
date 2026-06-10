import { create } from 'zustand';
import { sortNotes } from './note-helpers';
import { getNotesRepository } from './note-repository';
import type { Note, NoteDraft, NoteCategory, NoteCategoryDraft } from './note-types';
import { showSuccessToast } from '../toasts/toast-store';

interface NoteStore {
  notes: Note[];
  categories: NoteCategory[];
  searchQuery: string;
  activeCategoryId: string;
  hydrated: boolean;
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  createNote: (draft: NoteDraft) => Promise<Note>;
  updateNote: (note: Note) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  togglePin: (noteId: string) => Promise<void>;
  createCategory: (draft: NoteCategoryDraft) => Promise<NoteCategory>;
  updateCategory: (category: NoteCategory) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setActiveCategoryId: (categoryId: string) => void;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  categories: [],
  searchQuery: '',
  activeCategoryId: 'all',
  hydrated: false,
  loading: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated || get().loading) return;
    set({ loading: true, error: null });
    try {
      const repo = await getNotesRepository();
      const [notes, categories] = await Promise.all([repo.listNotes(), repo.listCategories()]);
      set({
        notes: sortNotes(notes),
        categories,
        hydrated: true,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load notes',
      });
    }
  },

  refresh: async (silent = false) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const repo = await getNotesRepository();
      const [notes, categories] = await Promise.all([repo.listNotes(), repo.listCategories()]);
      set({
        notes: sortNotes(notes),
        categories,
        loading: false,
        hydrated: true,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to refresh notes',
      });
    }
  },

  createNote: async (draft) => {
    try {
      const repo = await getNotesRepository();
      const note = await repo.createNote(draft);
      set((state) => ({
        notes: sortNotes([note, ...state.notes]),
      }));
      showSuccessToast('Note added');
      return note;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create note';
      console.error('createNote error:', error);
      set({ error: message });
      throw error;
    }
  },

  updateNote: async (note) => {
    const repo = await getNotesRepository();
    const updated: Note = { ...note, updated_at: new Date().toISOString() };
    await repo.updateNote(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((n) => (n.id === updated.id ? updated : n))),
    }));
  },

  deleteNote: async (noteId) => {
    const repo = await getNotesRepository();
    await repo.deleteNote(noteId);
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== noteId),
    }));
    showSuccessToast('Note deleted');
  },

  togglePin: async (noteId) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) return;
    await get().updateNote({ ...note, pinned: !note.pinned });
  },

  createCategory: async (draft) => {
    try {
      const repo = await getNotesRepository();
      const category = await repo.createCategory(draft);
      set((state) => ({
        categories: [...state.categories, category],
      }));
      showSuccessToast('Category added', category.label);
      return category;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create category';
      console.error('createCategory error:', error);
      set({ error: message });
      throw error;
    }
  },

  updateCategory: async (category) => {
    const repo = await getNotesRepository();
    const updated: NoteCategory = { ...category, updated_at: new Date().toISOString() };
    await repo.updateCategory(updated);
    set((state) => ({
      categories: state.categories.map((c) => (c.id === updated.id ? updated : c)),
    }));
  },

  deleteCategory: async (categoryId) => {
    const repo = await getNotesRepository();
    await repo.deleteCategory(categoryId);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== categoryId),
      notes: state.notes.map((n) => (n.category_id === categoryId ? { ...n, category_id: 'general' } : n)),
      activeCategoryId: state.activeCategoryId === categoryId ? 'all' : state.activeCategoryId,
    }));
    showSuccessToast('Category deleted');
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveCategoryId: (categoryId) => set({ activeCategoryId: categoryId }),
}));
