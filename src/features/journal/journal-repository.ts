import { isTauriApp } from '../../lib/tauri';
import { getSqlDatabase } from '../../lib/database';
import { hydrateJournalEntryRecord, hydrateJournalDayRecord, normalizeJournalEntryDraft, sortJournalEntries } from './journal-helpers';
import type { JournalEntry, JournalDay, JournalEntryDraft } from './journal-types';
import { useAuthStore } from '../auth/auth-store';
import { enqueueSync } from '../../lib/sync-outbox';

const ENTRIES_STORAGE_KEY = 'missioncontrol-journal-entries-v1';
const DAYS_STORAGE_KEY = 'missioncontrol-journal-days-v1';

interface JournalRepository {
  listEntries(entryDate?: string): Promise<JournalEntry[]>;
  createEntry(draft: JournalEntryDraft): Promise<JournalEntry>;
  updateEntry(entry: JournalEntry): Promise<void>;
  deleteEntry(entryId: string): Promise<void>;
  listDays(): Promise<JournalDay[]>;
  saveDay(day: JournalDay): Promise<void>;
}

class BrowserJournalRepository implements JournalRepository {
  private loadEntries(): JournalEntry[] {
    const raw = localStorage.getItem(ENTRIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as JournalEntry[];
    return sortJournalEntries(parsed.map(hydrateJournalEntryRecord));
  }

  private saveEntries(entries: JournalEntry[]) {
    localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(sortJournalEntries(entries)));
  }

  private loadDays(): JournalDay[] {
    const raw = localStorage.getItem(DAYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as JournalDay[];
    return parsed.map(hydrateJournalDayRecord);
  }

  private saveDays(days: JournalDay[]) {
    localStorage.setItem(DAYS_STORAGE_KEY, JSON.stringify(days));
  }

  async listEntries(entryDate?: string) {
    const entries = this.loadEntries();
    if (entryDate) return entries.filter((e) => e.entry_date === entryDate);
    return entries;
  }

  async createEntry(draft: JournalEntryDraft) {
    const entry = normalizeJournalEntryDraft(draft);
    this.saveEntries([entry, ...this.loadEntries()]);
    return entry;
  }

  async updateEntry(entry: JournalEntry) {
    const entries = this.loadEntries();
    this.saveEntries(entries.map((e) => (e.id === entry.id ? entry : e)));
  }

  async deleteEntry(entryId: string) {
    this.saveEntries(this.loadEntries().filter((e) => e.id !== entryId));
  }

  async listDays() {
    return this.loadDays();
  }

  async saveDay(day: JournalDay) {
    const days = this.loadDays();
    const existing = days.findIndex((d) => d.entry_date === day.entry_date);
    if (existing >= 0) days[existing] = day;
    else days.push(day);
    this.saveDays(days);
  }
}

class SqlJournalRepository implements JournalRepository {
  private async db() {
    return getSqlDatabase();
  }

  async listEntries(entryDate?: string) {
    const db = await this.db();
    const query = entryDate
      ? 'SELECT * FROM journal_entries WHERE entry_date = ? ORDER BY sort_order ASC, created_at DESC'
      : 'SELECT * FROM journal_entries ORDER BY entry_date DESC, sort_order ASC, created_at DESC';
    const rows = await db.select<any>(query, entryDate ? [entryDate] : []);
    return rows.map(hydrateJournalEntryRecord);
  }

  async createEntry(draft: JournalEntryDraft) {
    const entry = normalizeJournalEntryDraft(draft);
    const db = await this.db();
    await db.execute(
      `INSERT INTO journal_entries (id, kind, content, entry_date, linked_entry_id, mission_id, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.kind, entry.content, entry.entry_date, entry.linked_entry_id, entry.mission_id, entry.sort_order, entry.created_at, entry.updated_at],
    );
    void enqueueSync('journal_entries', entry.id, 'upsert', entry as unknown as Record<string, unknown>);
    return entry;
  }

  async updateEntry(entry: JournalEntry) {
    const db = await this.db();
    await db.execute(
      `UPDATE journal_entries SET kind = ?, content = ?, entry_date = ?, linked_entry_id = ?, mission_id = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [entry.kind, entry.content, entry.entry_date, entry.linked_entry_id, entry.mission_id, entry.sort_order, entry.updated_at, entry.id],
    );
    void enqueueSync('journal_entries', entry.id, 'upsert', entry as unknown as Record<string, unknown>);
  }

  async deleteEntry(entryId: string) {
    const db = await this.db();
    await db.execute('DELETE FROM journal_entries WHERE id = ?', [entryId]);
    void enqueueSync('journal_entries', entryId, 'delete', { id: entryId });
  }

  async listDays() {
    const db = await this.db();
    const rows = await db.select<any>('SELECT * FROM journal_days ORDER BY entry_date DESC');
    return rows.map(hydrateJournalDayRecord);
  }

  async saveDay(day: JournalDay) {
    const db = await this.db();
    const now = new Date().toISOString();
    const existing = await db.select<any>('SELECT COUNT(*) as count FROM journal_days WHERE entry_date = ?', [day.entry_date]);
    if (existing[0]?.count > 0) {
      await db.execute('UPDATE journal_days SET mood = ?, gratitude = ?, updated_at = ? WHERE entry_date = ?', [day.mood, day.gratitude, now, day.entry_date]);
    } else {
      await db.execute('INSERT INTO journal_days (entry_date, mood, gratitude, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [day.entry_date, day.mood, day.gratitude, now, now]);
    }
    void enqueueSync('journal_days', day.entry_date, 'upsert', { ...day, created_at: day.created_at, updated_at: now });
  }
}

class SupabaseJournalRepository implements JournalRepository {
  async listEntries(entryDate?: string) {
    const { selectJournalEntries } = await import('../../lib/supabase');
    try {
      return await selectJournalEntries(entryDate);
    } catch (error) {
      console.error('Supabase journal_entries query failed:', error);
      throw new Error('Journal tables not found in Supabase. Please run migrations.');
    }
  }

  async createEntry(draft: JournalEntryDraft) {
    const { insertJournalEntry } = await import('../../lib/supabase');
    const entry = normalizeJournalEntryDraft(draft);
    try {
      await insertJournalEntry(entry);
    } catch (error) {
      console.error('Supabase journal_entries insert failed:', error);
      throw new Error('Failed to save journal entry. Journal tables may not exist in Supabase.');
    }
    return entry;
  }

  async updateEntry(entry: JournalEntry) {
    const { updateJournalEntry } = await import('../../lib/supabase');
    try {
      await updateJournalEntry(entry);
    } catch (error) {
      console.error('Supabase journal_entries update failed:', error);
      throw new Error('Failed to update journal entry.');
    }
  }

  async deleteEntry(entryId: string) {
    const { deleteJournalEntry } = await import('../../lib/supabase');
    try {
      await deleteJournalEntry(entryId);
    } catch (error) {
      console.error('Supabase journal_entries delete failed:', error);
      throw new Error('Failed to delete journal entry.');
    }
  }

  async listDays() {
    const { selectJournalDays } = await import('../../lib/supabase');
    try {
      return await selectJournalDays();
    } catch (error) {
      console.error('Supabase journal_days query failed:', error);
      throw new Error('Journal tables not found in Supabase.');
    }
  }

  async saveDay(day: JournalDay) {
    const { upsertJournalDay } = await import('../../lib/supabase');
    try {
      await upsertJournalDay(day);
    } catch (error) {
      console.error('Supabase journal_days upsert failed:', error);
      throw new Error('Failed to save journal day.');
    }
  }
}

let repositoryPromise: Promise<JournalRepository> | null = null;

const SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL);

export function getJournalRepository(): Promise<JournalRepository> {
  repositoryPromise ??= Promise.resolve(
    SUPABASE_CONFIGURED && !useAuthStore.getState().localMode
      ? new SupabaseJournalRepository()
      : isTauriApp()
        ? new SqlJournalRepository()
        : new BrowserJournalRepository(),
  );
  return repositoryPromise;
}
