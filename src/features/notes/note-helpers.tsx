import {
  Lightbulb,
  BookOpen,
  Code2,
  Users,
  ListChecks,
  GraduationCap,
  Heart,
  FileText,
  Tag,
  Star,
  Folder,
  Briefcase,
  Globe,
  Music,
  Camera,
  Coffee,
  Zap,
  Bookmark,
  Flag,
  Hash,
  Layers,
  Package,
  Sparkles,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { Note, NoteDraft, NoteCategory, NoteCategoryDraft, NoteColor } from './note-types';

export const NOTE_COLORS: NoteColor[] = [
  'slate', 'blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'purple', 'indigo',
];

export interface NoteColorStyle {
  text: string;
  bg: string;
  border: string;
  solid: string;
}

export const NOTE_COLOR_STYLES: Record<NoteColor, NoteColorStyle> = {
  slate: { text: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-500/25', solid: 'bg-slate-500' },
  blue: { text: 'text-blue-600 dark:text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/25', solid: 'bg-blue-500' },
  teal: { text: 'text-teal-600 dark:text-teal-300', bg: 'bg-teal-500/10', border: 'border-teal-500/25', solid: 'bg-teal-500' },
  green: { text: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', solid: 'bg-emerald-500' },
  amber: { text: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/25', solid: 'bg-amber-500' },
  orange: { text: 'text-orange-600 dark:text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/25', solid: 'bg-orange-500' },
  red: { text: 'text-red-600 dark:text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/25', solid: 'bg-red-500' },
  pink: { text: 'text-pink-600 dark:text-pink-300', bg: 'bg-pink-500/10', border: 'border-pink-500/25', solid: 'bg-pink-500' },
  purple: { text: 'text-purple-600 dark:text-purple-300', bg: 'bg-purple-500/10', border: 'border-purple-500/25', solid: 'bg-purple-500' },
  indigo: { text: 'text-indigo-600 dark:text-indigo-300', bg: 'bg-indigo-500/10', border: 'border-indigo-500/25', solid: 'bg-indigo-500' },
};

export function getNoteColorStyle(color: NoteColor): NoteColorStyle {
  return NOTE_COLOR_STYLES[color] ?? NOTE_COLOR_STYLES.slate;
}

export const NOTE_CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  Lightbulb,
  BookOpen,
  Code2,
  Users,
  ListChecks,
  GraduationCap,
  Heart,
  FileText,
  Tag,
  Star,
  Folder,
  Briefcase,
  Globe,
  Music,
  Camera,
  Coffee,
  Zap,
  Bookmark,
  Flag,
  Hash,
  Layers,
  Package,
  Sparkles,
  MapPin,
};

export const NOTE_CATEGORY_ICON_OPTIONS = Object.keys(NOTE_CATEGORY_ICON_MAP);

export function NoteCategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = NOTE_CATEGORY_ICON_MAP[icon] ?? Tag;
  return <IconComponent className={className} />;
}

const PRESET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export const PRESET_NOTE_CATEGORIES: NoteCategory[] = [
  { id: 'idea', label: 'Ideas', icon: 'Lightbulb', color: 'amber', sort_order: 0, created_at: PRESET_TIMESTAMP, updated_at: PRESET_TIMESTAMP },
  { id: 'reference', label: 'Reference', icon: 'BookOpen', color: 'blue', sort_order: 1, created_at: PRESET_TIMESTAMP, updated_at: PRESET_TIMESTAMP },
  { id: 'snippet', label: 'Snippets', icon: 'Code2', color: 'teal', sort_order: 2, created_at: PRESET_TIMESTAMP, updated_at: PRESET_TIMESTAMP },
  { id: 'meeting', label: 'Meetings', icon: 'Users', color: 'purple', sort_order: 3, created_at: PRESET_TIMESTAMP, updated_at: PRESET_TIMESTAMP },
  { id: 'reminder', label: 'Reminders', icon: 'ListChecks', color: 'orange', sort_order: 4, created_at: PRESET_TIMESTAMP, updated_at: PRESET_TIMESTAMP },
  { id: 'learning', label: 'Learning', icon: 'GraduationCap', color: 'green', sort_order: 5, created_at: PRESET_TIMESTAMP, updated_at: PRESET_TIMESTAMP },
  { id: 'personal', label: 'Personal', icon: 'Heart', color: 'pink', sort_order: 6, created_at: PRESET_TIMESTAMP, updated_at: PRESET_TIMESTAMP },
  { id: 'general', label: 'General', icon: 'FileText', color: 'slate', sort_order: 7, created_at: PRESET_TIMESTAMP, updated_at: PRESET_TIMESTAMP },
];

export const PRESET_NOTE_CATEGORY_IDS = new Set(PRESET_NOTE_CATEGORIES.map((category) => category.id));

export const GENERAL_CATEGORY_ID = 'general';

export function getAllCategories(customCategories: NoteCategory[]): NoteCategory[] {
  return [...PRESET_NOTE_CATEGORIES, ...[...customCategories].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))];
}

export function getCategoryById(categoryId: string, customCategories: NoteCategory[]): NoteCategory {
  const all = getAllCategories(customCategories);
  return all.find((category) => category.id === categoryId) ?? PRESET_NOTE_CATEGORIES.find((category) => category.id === GENERAL_CATEGORY_ID)!;
}

export function createNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createNoteCategoryId(): string {
  return `note-category-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getNoteDisplayTitle(note: Note): string {
  const trimmedTitle = note.title.trim();
  if (trimmedTitle) return trimmedTitle;

  const firstLine = note.content.trim().split('\n')[0]?.trim() ?? '';
  if (!firstLine) return 'Untitled note';

  return firstLine.length > 80 ? `${firstLine.slice(0, 80).trim()}…` : firstLine;
}

export function normalizeNoteDraft(draft: NoteDraft): Note {
  const timestamp = new Date().toISOString();

  return {
    id: createNoteId(),
    title: (draft.title ?? '').trim(),
    content: draft.content.trim(),
    category_id: draft.category_id ?? GENERAL_CATEGORY_ID,
    mission_id: draft.mission_id ?? null,
    pinned: draft.pinned ?? false,
    sort_order: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

interface NoteRecordInput {
  id: string;
  title?: string | null;
  content?: string | null;
  category_id?: string | null;
  mission_id?: string | null;
  pinned?: number | boolean | null;
  sort_order?: number | null;
  created_at?: string;
  updated_at?: string;
}

export function hydrateNoteRecord(record: NoteRecordInput): Note {
  const timestamp = new Date().toISOString();

  return {
    id: record.id,
    title: record.title?.trim() ?? '',
    content: record.content ?? '',
    category_id: record.category_id ?? GENERAL_CATEGORY_ID,
    mission_id: record.mission_id ?? null,
    pinned: Boolean(record.pinned),
    sort_order: record.sort_order ?? 0,
    created_at: record.created_at ?? timestamp,
    updated_at: record.updated_at ?? timestamp,
  };
}

export function normalizeNoteCategoryDraft(draft: NoteCategoryDraft): NoteCategory {
  const timestamp = new Date().toISOString();

  return {
    id: createNoteCategoryId(),
    label: draft.label.trim(),
    color: draft.color,
    icon: draft.icon ?? 'Tag',
    sort_order: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

interface NoteCategoryRecordInput {
  id: string;
  label?: string | null;
  color?: string | null;
  icon?: string | null;
  sort_order?: number | null;
  created_at?: string;
  updated_at?: string;
}

export function hydrateNoteCategoryRecord(record: NoteCategoryRecordInput): NoteCategory {
  const timestamp = new Date().toISOString();
  const color = (record.color ?? 'slate') as NoteColor;

  return {
    id: record.id,
    label: record.label?.trim() ?? 'Untitled',
    color: NOTE_COLORS.includes(color) ? color : 'slate',
    icon: record.icon ?? 'Tag',
    sort_order: record.sort_order ?? 0,
    created_at: record.created_at ?? timestamp,
    updated_at: record.updated_at ?? timestamp,
  };
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export type NoteCategoryFilter = 'all' | 'pinned' | string;

export interface FilterNotesOptions {
  query?: string;
  categoryId?: NoteCategoryFilter;
  customCategories: NoteCategory[];
  missionTitles?: Record<string, string>;
}

export function filterNotes(notes: Note[], options: FilterNotesOptions): Note[] {
  const { query, categoryId, customCategories, missionTitles = {} } = options;
  const trimmedQuery = query?.trim().toLowerCase() ?? '';

  return notes.filter((note) => {
    if (categoryId === 'pinned' && !note.pinned) return false;
    if (categoryId && categoryId !== 'all' && categoryId !== 'pinned' && note.category_id !== categoryId) return false;

    if (!trimmedQuery) return true;

    const category = getCategoryById(note.category_id, customCategories);
    const missionTitle = note.mission_id ? missionTitles[note.mission_id] ?? '' : '';

    const haystack = [note.title, note.content, category.label, missionTitle]
      .join('\n')
      .toLowerCase();

    return haystack.includes(trimmedQuery);
  });
}
