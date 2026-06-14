-- Adds a completion note captured when a task is marked done.
-- Mirrors the local SQLite migration (version 13) in src-tauri/src/lib.rs.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completion_note TEXT NOT NULL DEFAULT '';
