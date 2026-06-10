export type NoteColor =
  | 'slate'
  | 'blue'
  | 'teal'
  | 'green'
  | 'amber'
  | 'orange'
  | 'red'
  | 'pink'
  | 'purple'
  | 'indigo';

export interface Note {
  id: string;
  title: string;
  content: string;
  category_id: string;
  mission_id: string | null;
  pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NoteDraft {
  title?: string;
  content: string;
  category_id?: string;
  mission_id?: string | null;
  pinned?: boolean;
}

export interface NoteCategory {
  id: string;
  label: string;
  color: NoteColor;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NoteCategoryDraft {
  label: string;
  color: NoteColor;
  icon?: string;
}
