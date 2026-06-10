import { isTauriApp } from '../../lib/tauri';
import { getSqlDatabase } from '../../lib/database';
import {
  hydrateNoteRecord,
  hydrateNoteCategoryRecord,
  normalizeNoteDraft,
  normalizeNoteCategoryDraft,
  sortNotes,
  GENERAL_CATEGORY_ID,
} from './note-helpers';
import type { Note, NoteDraft, NoteCategory, NoteCategoryDraft } from './note-types';
import { useAuthStore } from '../auth/auth-store';
import { enqueueSync } from '../../lib/sync-outbox';

const NOTES_STORAGE_KEY = 'missioncontrol-notes-v1';
const CATEGORIES_STORAGE_KEY = 'missioncontrol-note-categories-v1';

interface NotesRepository {
  listNotes(): Promise<Note[]>;
  createNote(draft: NoteDraft): Promise<Note>;
  updateNote(note: Note): Promise<void>;
  deleteNote(noteId: string): Promise<void>;
  listCategories(): Promise<NoteCategory[]>;
  createCategory(draft: NoteCategoryDraft): Promise<NoteCategory>;
  updateCategory(category: NoteCategory): Promise<void>;
  deleteCategory(categoryId: string): Promise<void>;
}

class BrowserNotesRepository implements NotesRepository {
  private loadNotes(): Note[] {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Note[];
    return sortNotes(parsed.map(hydrateNoteRecord));
  }

  private saveNotes(notes: Note[]) {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(sortNotes(notes)));
  }

  private loadCategories(): NoteCategory[] {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NoteCategory[];
    return parsed.map(hydrateNoteCategoryRecord);
  }

  private saveCategories(categories: NoteCategory[]) {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  }

  async listNotes() {
    return this.loadNotes();
  }

  async createNote(draft: NoteDraft) {
    const note = normalizeNoteDraft(draft);
    this.saveNotes([note, ...this.loadNotes()]);
    return note;
  }

  async updateNote(note: Note) {
    const notes = this.loadNotes();
    this.saveNotes(notes.map((n) => (n.id === note.id ? note : n)));
  }

  async deleteNote(noteId: string) {
    this.saveNotes(this.loadNotes().filter((n) => n.id !== noteId));
  }

  async listCategories() {
    return this.loadCategories();
  }

  async createCategory(draft: NoteCategoryDraft) {
    const category = normalizeNoteCategoryDraft(draft);
    this.saveCategories([...this.loadCategories(), category]);
    return category;
  }

  async updateCategory(category: NoteCategory) {
    const categories = this.loadCategories();
    this.saveCategories(categories.map((c) => (c.id === category.id ? category : c)));
  }

  async deleteCategory(categoryId: string) {
    this.saveCategories(this.loadCategories().filter((c) => c.id !== categoryId));
  }
}

class SqlNotesRepository implements NotesRepository {
  private async db() {
    return getSqlDatabase();
  }

  async listNotes() {
    const db = await this.db();
    const rows = await db.select<any>('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC');
    return rows.map(hydrateNoteRecord);
  }

  async createNote(draft: NoteDraft) {
    const note = normalizeNoteDraft(draft);
    const db = await this.db();
    await db.execute(
      `INSERT INTO notes (id, title, content, category_id, mission_id, pinned, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [note.id, note.title, note.content, note.category_id, note.mission_id, note.pinned ? 1 : 0, note.sort_order, note.created_at, note.updated_at],
    );
    void enqueueSync('notes', note.id, 'upsert', { ...note, pinned: note.pinned ? 1 : 0 });
    return note;
  }

  async updateNote(note: Note) {
    const db = await this.db();
    await db.execute(
      `UPDATE notes SET title = ?, content = ?, category_id = ?, mission_id = ?, pinned = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [note.title, note.content, note.category_id, note.mission_id, note.pinned ? 1 : 0, note.sort_order, note.updated_at, note.id],
    );
    void enqueueSync('notes', note.id, 'upsert', { ...note, pinned: note.pinned ? 1 : 0 });
  }

  async deleteNote(noteId: string) {
    const db = await this.db();
    await db.execute('DELETE FROM notes WHERE id = ?', [noteId]);
    void enqueueSync('notes', noteId, 'delete', { id: noteId });
  }

  async listCategories() {
    const db = await this.db();
    const rows = await db.select<any>('SELECT * FROM note_categories ORDER BY sort_order ASC, label ASC');
    return rows.map(hydrateNoteCategoryRecord);
  }

  async createCategory(draft: NoteCategoryDraft) {
    const category = normalizeNoteCategoryDraft(draft);
    const db = await this.db();
    await db.execute(
      `INSERT INTO note_categories (id, label, color, icon, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [category.id, category.label, category.color, category.icon, category.sort_order, category.created_at, category.updated_at],
    );
    void enqueueSync('note_categories', category.id, 'upsert', category as unknown as Record<string, unknown>);
    return category;
  }

  async updateCategory(category: NoteCategory) {
    const db = await this.db();
    await db.execute(
      `UPDATE note_categories SET label = ?, color = ?, icon = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [category.label, category.color, category.icon, category.sort_order, category.updated_at, category.id],
    );
    void enqueueSync('note_categories', category.id, 'upsert', category as unknown as Record<string, unknown>);
  }

  async deleteCategory(categoryId: string) {
    const db = await this.db();
    await db.execute('UPDATE notes SET category_id = ? WHERE category_id = ?', [GENERAL_CATEGORY_ID, categoryId]);
    await db.execute('DELETE FROM note_categories WHERE id = ?', [categoryId]);
    void enqueueSync('note_categories', categoryId, 'delete', { id: categoryId });
  }
}

class SupabaseNotesRepository implements NotesRepository {
  async listNotes() {
    const { selectNotesByUser } = await import('../../lib/supabase');
    try {
      return await selectNotesByUser();
    } catch (error) {
      console.error('Supabase notes query failed:', error);
      throw new Error('Notes tables not found in Supabase. Please run migrations.');
    }
  }

  async createNote(draft: NoteDraft) {
    const { insertNote } = await import('../../lib/supabase');
    const note = normalizeNoteDraft(draft);
    try {
      await insertNote(note);
    } catch (error) {
      console.error('Supabase notes insert failed:', error);
      throw new Error('Failed to save note. Notes tables may not exist in Supabase.');
    }
    return note;
  }

  async updateNote(note: Note) {
    const { updateNoteRow } = await import('../../lib/supabase');
    try {
      await updateNoteRow(note);
    } catch (error) {
      console.error('Supabase notes update failed:', error);
      throw new Error('Failed to update note.');
    }
  }

  async deleteNote(noteId: string) {
    const { deleteNoteRow } = await import('../../lib/supabase');
    try {
      await deleteNoteRow(noteId);
    } catch (error) {
      console.error('Supabase notes delete failed:', error);
      throw new Error('Failed to delete note.');
    }
  }

  async listCategories() {
    const { selectNoteCategoriesByUser } = await import('../../lib/supabase');
    try {
      return await selectNoteCategoriesByUser();
    } catch (error) {
      console.error('Supabase note_categories query failed:', error);
      throw new Error('Note category tables not found in Supabase. Please run migrations.');
    }
  }

  async createCategory(draft: NoteCategoryDraft) {
    const { insertNoteCategory } = await import('../../lib/supabase');
    const category = normalizeNoteCategoryDraft(draft);
    try {
      await insertNoteCategory(category);
    } catch (error) {
      console.error('Supabase note_categories insert failed:', error);
      throw new Error('Failed to save category.');
    }
    return category;
  }

  async updateCategory(category: NoteCategory) {
    const { updateNoteCategory } = await import('../../lib/supabase');
    try {
      await updateNoteCategory(category);
    } catch (error) {
      console.error('Supabase note_categories update failed:', error);
      throw new Error('Failed to update category.');
    }
  }

  async deleteCategory(categoryId: string) {
    const { deleteNoteCategory } = await import('../../lib/supabase');
    try {
      await deleteNoteCategory(categoryId);
    } catch (error) {
      console.error('Supabase note_categories delete failed:', error);
      throw new Error('Failed to delete category.');
    }
  }
}

let repositoryPromise: Promise<NotesRepository> | null = null;

const SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL);

export function getNotesRepository(): Promise<NotesRepository> {
  repositoryPromise ??= Promise.resolve(
    SUPABASE_CONFIGURED && !useAuthStore.getState().localMode
      ? new SupabaseNotesRepository()
      : isTauriApp()
        ? new SqlNotesRepository()
        : new BrowserNotesRepository(),
  );
  return repositoryPromise;
}
