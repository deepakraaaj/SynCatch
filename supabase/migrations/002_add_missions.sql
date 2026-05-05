-- Create missions table
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core identity
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🎯',
  color TEXT NOT NULL DEFAULT 'blue'
    CHECK (color IN ('red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray')),

  -- Clarity fields
  objective TEXT NOT NULL DEFAULT '',
  why_it_matters TEXT NOT NULL DEFAULT '',
  definition_of_success TEXT NOT NULL DEFAULT '',

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  target_date DATE,

  -- Effort & planning
  estimated_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,

  -- Organisation
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Free-form context
  notes TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_missions_user_id ON missions(user_id);
CREATE INDEX idx_missions_status ON missions(user_id, status);
CREATE INDEX idx_missions_updated_at ON missions(updated_at DESC);

-- Add mission_id to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_mission_id ON tasks(mission_id);

-- ──────────────────────────────────────────
-- Row Level Security
-- ──────────────────────────────────────────
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missions_private" ON missions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- Auto-update updated_at on every write
-- ──────────────────────────────────────────
CREATE TRIGGER trg_missions_updated_at
  BEFORE UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
