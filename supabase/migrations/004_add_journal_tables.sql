-- Create journal_entries table
CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('regret', 'manifestation', 'best_moment', 'lesson')),
  content TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  linked_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
  mission_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_at_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for journal_entries
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_entry_date ON journal_entries(entry_date DESC);
CREATE INDEX idx_journal_entries_updated_at ON journal_entries(updated_at_timestamp DESC);

-- Create journal_days table
CREATE TABLE journal_days (
  entry_date TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood INTEGER NOT NULL DEFAULT 0 CHECK (mood >= 0 AND mood <= 5),
  gratitude TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_at_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, entry_date)
);

-- Create indexes for journal_days
CREATE INDEX idx_journal_days_user_id ON journal_days(user_id);
CREATE INDEX idx_journal_days_updated_at ON journal_days(updated_at_timestamp DESC);

-- Enable RLS on journal_entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for journal_entries
CREATE POLICY "Users can view their own journal entries"
  ON journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own journal entries"
  ON journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journal entries"
  ON journal_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own journal entries"
  ON journal_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on journal_days
ALTER TABLE journal_days ENABLE ROW LEVEL SECURITY;

-- RLS policies for journal_days
CREATE POLICY "Users can view their own journal days"
  ON journal_days FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own journal days"
  ON journal_days FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journal days"
  ON journal_days FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own journal days"
  ON journal_days FOR DELETE
  USING (auth.uid() = user_id);
