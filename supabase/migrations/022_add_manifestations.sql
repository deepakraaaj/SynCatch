BEGIN;

-- ============================================================
-- Manifestations
-- Something the user is calling in, plus two running logs:
-- actions they took toward it, and signs the universe sent back.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.manifestations (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  intention TEXT NOT NULL DEFAULT '',
  started_on DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'manifesting'
    CHECK (status IN ('manifesting', 'manifested', 'released')),
  manifested_on DATE,

  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  signs JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT manifestations_actions_array
    CHECK (jsonb_typeof(actions) = 'array'),

  CONSTRAINT manifestations_signs_array
    CHECK (jsonb_typeof(signs) = 'array')
);

CREATE INDEX IF NOT EXISTS manifestations_user_started_idx
  ON public.manifestations(user_id, started_on DESC);

DROP TRIGGER IF EXISTS manifestations_set_updated_at
  ON public.manifestations;

CREATE TRIGGER manifestations_set_updated_at
BEFORE UPDATE ON public.manifestations
FOR EACH ROW
EXECUTE FUNCTION public.syncatch_set_updated_at();

ALTER TABLE public.manifestations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own manifestations"
  ON public.manifestations;

CREATE POLICY "Users can view their own manifestations"
ON public.manifestations
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own manifestations"
  ON public.manifestations;

CREATE POLICY "Users can create their own manifestations"
ON public.manifestations
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own manifestations"
  ON public.manifestations;

CREATE POLICY "Users can update their own manifestations"
ON public.manifestations
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own manifestations"
  ON public.manifestations;

CREATE POLICY "Users can delete their own manifestations"
ON public.manifestations
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.manifestations FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.manifestations TO authenticated;

COMMIT;
