-- team_room_state was removed in migration 017 after its JSON blob was
-- migrated to the relational team_* tables. create_team_room still attempted
-- to seed that removed table, leaving the RPC invalid with SQLSTATE 42P01.
CREATE OR REPLACE FUNCTION public.create_team_room(room_name text)
RETURNS TABLE (room_id uuid, name text, invite_code text, membership_id uuid, role text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  new_room public.team_rooms;
  new_membership public.team_room_memberships;
  generated_code text;
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF char_length(trim(room_name)) < 2 THEN
    RAISE EXCEPTION 'Room name is too short';
  END IF;

  LOOP
    generated_code := upper(
      substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4)
      || '-'
      || substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4)
    );
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.team_rooms r WHERE r.invite_code = generated_code
    );
  END LOOP;

  INSERT INTO public.team_rooms (name, invite_code, created_by)
  VALUES (trim(room_name), generated_code, caller_id)
  RETURNING * INTO new_room;

  INSERT INTO public.team_room_memberships (
    room_id, user_id, role, status, reviewed_at, reviewed_by
  )
  VALUES (
    new_room.id, caller_id, 'owner', 'approved', now(), caller_id
  )
  RETURNING * INTO new_membership;

  RETURN QUERY
  SELECT
    new_room.id,
    new_room.name,
    new_room.invite_code,
    new_membership.id,
    new_membership.role,
    new_membership.status;
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_room(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_team_room(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
