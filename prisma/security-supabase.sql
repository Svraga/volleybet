-- VolleyBet accesses these tables only through the Prisma backend, not Supabase Auth.
-- Enable RLS without client policies and remove browser/API grants.
-- The application database role must own each table or have BYPASSRLS.
-- auth/storage schemas and tables outside this explicit list are untouched.
DO $volleybet_security$
DECLARE
  table_name text;
  client_role text;
  table_id regclass;
  backend_bypass boolean;
BEGIN
  SELECT rolbypassrls OR rolsuper INTO backend_bypass
  FROM pg_roles WHERE rolname = current_user;

  FOREACH table_name IN ARRAY ARRAY[
    'Account', 'Session', 'VerificationToken', 'User', 'League',
    'LeagueMember', '_LeagueMembers', 'Team', 'MatchDay', 'Match',
    'Bet', 'Ledger', 'AuditLog', 'Notification', 'SecurityRateLimit'
  ] LOOP
    table_id := to_regclass(format('public.%I', table_name));
    IF table_id IS NULL THEN CONTINUE; END IF;

    IF NOT backend_bypass AND NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE oid = table_id AND pg_get_userbyid(relowner) = current_user
    ) THEN
      RAISE EXCEPTION 'Backend role must own table % or have BYPASSRLS', table_name;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, client_role);
      END IF;
    END LOOP;
  END LOOP;
END;
$volleybet_security$;
