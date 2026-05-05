-- Task model redesign: first-class subtasks, consolidated fields, new productivity columns

-- Self-referential FK: a "subtask" is just a Task with parent_task_id set
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE;

-- outcome replaces goal + definition_of_done (single "what does done look like" field)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT '';

-- notes replaces description + workspace_notes
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

-- energy for scheduling (deep work vs quick admin)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS energy TEXT NOT NULL DEFAULT 'shallow'
  CHECK (energy IN ('deep', 'shallow', 'admin'));

-- scheduling columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_for DATE;

-- free-form tags
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- completion timestamp (drives velocity and streak stats)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Migrate existing data into new consolidated columns
UPDATE tasks SET
  outcome = CASE
    WHEN definition_of_done IS NOT NULL AND definition_of_done != '' THEN definition_of_done
    WHEN goal IS NOT NULL AND goal != '' THEN goal
    ELSE ''
  END,
  notes = CASE
    WHEN (description IS NOT NULL AND description != '') AND (workspace_notes IS NOT NULL AND workspace_notes != '')
      THEN description || E'\n\n' || workspace_notes
    WHEN description IS NOT NULL AND description != '' THEN description
    WHEN workspace_notes IS NOT NULL AND workspace_notes != '' THEN workspace_notes
    ELSE ''
  END,
  completed_at = CASE WHEN status = 'done' THEN updated_at ELSE NULL END;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
