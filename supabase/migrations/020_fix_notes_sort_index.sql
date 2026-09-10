-- notes are fetched sorted by (pinned desc, updated_at desc) — see
-- selectNotesByUser() in src/lib/supabase.ts — but the only sort-relevant
-- index we had (idx_notes_updated_at) covers updated_at_timestamp, a
-- separate trigger-maintained column, not the `updated_at` text column the
-- query actually orders by. Postgres was falling back to a full sort on
-- every call. Add an index matching the real query shape.
CREATE INDEX IF NOT EXISTS idx_notes_pinned_updated_at
  ON public.notes (user_id, pinned DESC, updated_at DESC);
