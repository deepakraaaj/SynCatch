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
  status TEXT NOT NULL DEFAULT 'captured' CHECK (status IN ('captured', 'clarifying', 'ready', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  lane TEXT NOT NULL DEFAULT 'inbox' CHECK (lane IN ('inbox', 'now', 'next', 'later', 'done')),
  estimated_minutes INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_updated_at ON tasks(updated_at DESC);

-- Create focus_state table (singleton per user, not per database)
CREATE TABLE IF NOT EXISTS focus_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_active_mission TEXT,
  focus_session_start_time TIMESTAMP WITH TIME ZONE,
  focus_elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  focus_session_duration INTEGER NOT NULL DEFAULT 45,
  focus_confirmation_prompts INTEGER NOT NULL DEFAULT 2,
  manual_focus_reset INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'focused', 'paused')),
  hud_mode TEXT NOT NULL DEFAULT 'compact' CHECK (hud_mode IN ('compact', 'expanded')),
  hud_transparency TEXT NOT NULL DEFAULT 'standard' CHECK (hud_transparency IN ('standard', 'transparent')),
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

-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('main', 'hud', 'quick-add', 'system')),
  task_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "tasks_are_private" ON tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for focus_state
CREATE POLICY "focus_state_is_private" ON focus_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for app_preferences
CREATE POLICY "app_preferences_are_private" ON app_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for activity_log
CREATE POLICY "activity_log_is_private" ON activity_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_focus_state_updated_at BEFORE UPDATE ON focus_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_preferences_updated_at BEFORE UPDATE ON app_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
