import type { JournalEntry, JournalDay, JournalEntryKind, JournalEntryDraft, JournalDayDraft } from './journal-types';
import type { LucideIcon } from 'lucide-react';
import { BookHeart, AlertCircle, Sparkles, Heart } from 'lucide-react';

export function createJournalEntryId() {
  return `journal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeJournalEntryDraft(draft: JournalEntryDraft): JournalEntry {
  const today = toLocalDateString(new Date());
  const timestamp = new Date().toISOString();

  return {
    id: createJournalEntryId(),
    kind: draft.kind,
    content: draft.content.trim(),
    entry_date: draft.entry_date ?? today,
    linked_entry_id: draft.linked_entry_id ?? null,
    mission_id: draft.mission_id ?? null,
    sort_order: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

interface JournalEntryRecordInput {
  id: string;
  kind?: JournalEntryKind;
  content?: string | null;
  entry_date?: string | null;
  linked_entry_id?: string | null;
  mission_id?: string | null;
  sort_order?: number | null;
  created_at?: string;
  updated_at?: string;
}

export function hydrateJournalEntryRecord(record: JournalEntryRecordInput): JournalEntry {
  const timestamp = new Date().toISOString();

  return {
    id: record.id,
    kind: (record.kind ?? 'best_moment') as JournalEntryKind,
    content: record.content?.trim() ?? '',
    entry_date: record.entry_date ?? toLocalDateString(new Date()),
    linked_entry_id: record.linked_entry_id ?? null,
    mission_id: record.mission_id ?? null,
    sort_order: record.sort_order ?? 0,
    created_at: record.created_at ?? timestamp,
    updated_at: record.updated_at ?? timestamp,
  };
}

interface JournalDayRecordInput {
  entry_date: string;
  mood?: number | null;
  gratitude?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function hydrateJournalDayRecord(record: JournalDayRecordInput): JournalDay {
  const timestamp = new Date().toISOString();

  return {
    entry_date: record.entry_date,
    mood: record.mood ?? 0,
    gratitude: record.gratitude?.trim() ?? '',
    created_at: record.created_at ?? timestamp,
    updated_at: record.updated_at ?? timestamp,
  };
}

export function sortJournalEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => {
    const dateA = new Date(a.entry_date).getTime();
    const dateB = new Date(b.entry_date).getTime();

    if (dateA !== dateB) {
      return dateB - dateA;
    }

    const kindOrder: Record<JournalEntryKind, number> = {
      regret: 0,
      manifestation: 1,
      best_moment: 2,
      lesson: 3,
    };

    const kindDiff = kindOrder[a.kind] - kindOrder[b.kind];
    if (kindDiff !== 0) {
      return kindDiff;
    }

    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export interface JournalKindMeta {
  kind: JournalEntryKind;
  label: string;
  prompt: string;
  tone: 'success' | 'accent' | 'warning' | 'neutral';
  icon: LucideIcon;
}

export const JOURNAL_KIND_META: Record<JournalEntryKind, JournalKindMeta> = {
  best_moment: {
    kind: 'best_moment',
    label: 'Best moments',
    prompt: 'What went well today?',
    tone: 'success',
    icon: Heart,
  },
  manifestation: {
    kind: 'manifestation',
    label: 'Manifestations',
    prompt: 'What are you calling in?',
    tone: 'accent',
    icon: Sparkles,
  },
  regret: {
    kind: 'regret',
    label: 'Regrets',
    prompt: 'What would you do differently?',
    tone: 'warning',
    icon: AlertCircle,
  },
  lesson: {
    kind: 'lesson',
    label: 'Lessons',
    prompt: 'What did you learn?',
    tone: 'neutral',
    icon: BookHeart,
  },
};

export function getJournalKindMeta(kind: JournalEntryKind): JournalKindMeta {
  return JOURNAL_KIND_META[kind];
}
