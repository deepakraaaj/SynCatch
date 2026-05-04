-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  raw_input TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  definition_of_done TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  why_it_matters TEXT NOT NULL DEFAULT '',
  workspace_notes TEXT NOT NULL DEFAULT '',
  subtasks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  clarifying_questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'captured'
    CHECK (status IN ('captured', 'clarifying', 'ready', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  lane TEXT NOT NULL DEFAULT 'inbox'
    CHECK (lane IN ('inbox', 'now', 'next', 'later', 'done')),
  estimated_minutes INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_updated_at ON tasks(updated_at DESC);

-- Create focus_state table (one row per user)
CREATE TABLE IF NOT EXISTS focus_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_active_mission TEXT,
  focus_session_start_time TIMESTAMP WITH TIME ZONE,
  focus_elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  focus_session_duration INTEGER NOT NULL DEFAULT 45,
  focus_confirmation_prompts INTEGER NOT NULL DEFAULT 2,
  manual_focus_reset INTEGER NOT NULL DEFAULT 0,
  -- Matches FocusStatus type: 'idle' | 'locked-in' | 'warming-up' | 'drifting'
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'locked-in', 'warming-up', 'drifting')),
  -- Matches HudMode type: 'compact' | 'expanded'
  hud_mode TEXT NOT NULL DEFAULT 'compact'
    CHECK (hud_mode IN ('compact', 'expanded')),
  -- Matches HudTransparency type: 'standard' | 'ghost'
  hud_transparency TEXT NOT NULL DEFAULT 'standard'
    CHECK (hud_transparency IN ('standard', 'ghost')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create app_preferences table (key-value per user)
CREATE TABLE IF NOT EXISTS app_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE INDEX idx_app_preferences_user_id ON app_preferences(user_id);

-- Create work_sessions table
-- Mirrors WorkSession type from session-types.ts
CREATE TABLE IF NOT EXISTS work_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  task_title TEXT NOT NULL,
  preset_id TEXT NOT NULL
    CHECK (preset_id IN ('quick-push', 'focus', 'deep-work', 'flow', 'custom')),
  planned_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'paused', 'completed')),
  -- segments and captures stored as JSONB arrays (complex nested structure)
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  captures JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_sessions_user_id ON work_sessions(user_id);
CREATE INDEX idx_work_sessions_task_id ON work_sessions(task_id);
CREATE INDEX idx_work_sessions_started_at ON work_sessions(started_at DESC);

-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Matches ActivityAction type
  action TEXT NOT NULL
    CHECK (action IN (
      'hud_opened', 'task_selected', 'task_created', 'task_updated',
      'task_lane_changed', 'task_completed', 'focus_started', 'focus_resumed',
      'focus_paused', 'focus_status_changed', 'hud_mode_toggled',
      'hud_transparency_toggled', 'distraction_logged'
    )),
  -- Matches ActivitySource type
  source TEXT NOT NULL DEFAULT 'system'
    CHECK (source IN ('main', 'hud', 'quick-add', 'system')),
  task_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- ──────────────────────────────────────────
-- Row Level Security
-- ──────────────────────────────────────────
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_private" ON tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "focus_state_private" ON focus_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "app_preferences_private" ON app_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "work_sessions_private" ON work_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activity_log_private" ON activity_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- Auto-update updated_at on every write
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_focus_state_updated_at
  BEFORE UPDATE ON focus_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_app_preferences_updated_at
  BEFORE UPDATE ON app_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_work_sessions_updated_at
  BEFORE UPDATE ON work_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
