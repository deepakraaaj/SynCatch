export type JournalEntryKind = 'regret' | 'manifestation' | 'best_moment' | 'lesson';

export interface JournalEntry {
  id: string;
  kind: JournalEntryKind;
  content: string;
  entry_date: string; // YYYY-MM-DD
  linked_entry_id: string | null; // lesson → regret
  mission_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface JournalDay {
  entry_date: string; // YYYY-MM-DD, also the key
  mood: number; // 0 = unset, 1..5
  gratitude: string;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryDraft {
  kind: JournalEntryKind;
  content: string;
  entry_date?: string;
  linked_entry_id?: string | null;
  mission_id?: string | null;
}

export interface JournalDayDraft {
  entry_date: string;
  mood?: number;
  gratitude?: string;
}
