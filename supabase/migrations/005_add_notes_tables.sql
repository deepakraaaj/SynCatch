-- Create note_categories table
CREATE TABLE note_categories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'slate',
  icon TEXT NOT NULL DEFAULT 'Tag',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_at_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for note_categories
CREATE INDEX idx_note_categories_user_id ON note_categories(user_id);
CREATE INDEX idx_note_categories_updated_at ON note_categories(updated_at_timestamp DESC);

-- Create notes table
CREATE TABLE notes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL DEFAULT 'general',
  mission_id TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_at_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for notes
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_category_id ON notes(category_id);
CREATE INDEX idx_notes_updated_at ON notes(updated_at_timestamp DESC);

-- Enable RLS on note_categories
ALTER TABLE note_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for note_categories
CREATE POLICY "Users can view their own note categories"
  ON note_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own note categories"
  ON note_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own note categories"
  ON note_categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own note categories"
  ON note_categories FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for notes
CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);
