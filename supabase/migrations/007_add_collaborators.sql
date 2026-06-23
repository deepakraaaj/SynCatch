-- Collaborators roster + first-class task assignees
-- Replaces the old localStorage roster and the assignee_user_id:<id> tag hack.

-- ──────────────────────────────────────────
-- Task assignees (array of collaborator user IDs)
-- ──────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ──────────────────────────────────────────
-- Collaborators roster (people the owner has added by User ID)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collaborators (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The collaborator being referenced (their auth user id), plus cached display info
  collaborator_user_id UUID NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collaborators_user_id ON collaborators(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collaborators_unique
  ON collaborators(user_id, collaborator_user_id);

-- ──────────────────────────────────────────
-- Row Level Security: a roster row is private to its owner
-- ──────────────────────────────────────────
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collaborators_private" ON collaborators;
CREATE POLICY "collaborators_private" ON collaborators
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- Auto-update updated_at on every write
-- ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_collaborators_updated_at ON collaborators;
CREATE TRIGGER trg_collaborators_updated_at
  BEFORE UPDATE ON collaborators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
