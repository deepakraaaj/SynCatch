BEGIN;

-- Team sync moved from Realtime postgres_changes to Realtime Broadcast: the
-- client announces which rows it changed and teammates refetch them. Nothing
-- subscribes to table changes any more, so stop publishing them. Decoding the
-- WAL for these tables was ~66% of all database time on the free instance.
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY[
      'team_projects','team_leads','team_workflows','team_work_links',
      'team_problems','team_diagrams','team_notes','team_tasks','team_chat_messages',
      'team_room_state','turf_slots','turf_bookings','turf_matches'
    ] LOOP
      IF EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
