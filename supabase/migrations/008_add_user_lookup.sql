-- Privacy-preserving collaborator discovery.
--
-- There is intentionally NO public directory table and NO broad SELECT policy on
-- auth.users — that would let any signed-in user browse everyone's name/email.
--
-- Instead, you can only resolve a person you already know by their EXACT email.
-- A SECURITY DEFINER function does the lookup with `=` (not `ilike`), returning at
-- most one row. Partial/prefix scanning and enumeration are impossible.

-- ──────────────────────────────────────────
-- Clean up the abandoned public "profiles" directory approach, if it was ever
-- applied. These are all no-ops on a fresh database.
-- ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_profile_on_auth_insert ON auth.users;
DROP TRIGGER IF EXISTS trg_sync_profile_on_auth_update ON auth.users;
DROP FUNCTION IF EXISTS public.sync_profile_from_auth();
DROP TABLE IF EXISTS public.profiles;

CREATE OR REPLACE FUNCTION public.find_user_by_email(lookup_email text)
RETURNS TABLE (id uuid, display_name text, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', '') AS display_name,
    u.email
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(lookup_email))
  LIMIT 1;
$$;

-- Only signed-in users may call it (and only with an exact email they already have).
REVOKE ALL ON FUNCTION public.find_user_by_email(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;
