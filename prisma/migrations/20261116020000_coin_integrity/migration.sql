-- Compatible with older app versions: classify their legacy ledger reasons too.
CREATE OR REPLACE FUNCTION volleybet_ledger_validate() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW."matchDayId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "MatchDay" WHERE id = NEW."matchDayId" AND "leagueId" = NEW."leagueId"
  ) THEN RAISE EXCEPTION 'Ledger and matchday leagues must match'; END IF;
  IF NEW.kind = 'LEGACY' THEN
    NEW.kind := CASE
      WHEN NEW.amount < 0 AND NEW.reason ~ '^MatchDay [0-9]+ Entry Fee' THEN 'ENTRY_FEE'
      WHEN NEW.amount > 0 AND NEW.reason ~ '^Payout MatchDay ' THEN 'PAYOUT'
      WHEN NEW.amount > 0 AND NEW.reason ~ '^Refund \(' THEN 'REFUND'
      ELSE NEW.kind END;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION volleybet_pool_validate() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  day_id text;
  day_status text;
  balance bigint;
BEGIN
  IF TG_TABLE_NAME = 'MatchDay' THEN
    day_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN day_id := OLD."matchDayId";
  ELSE day_id := NEW."matchDayId";
  END IF;
  IF day_id IS NULL THEN RETURN NULL; END IF;
  SELECT status INTO day_status FROM "MatchDay" WHERE id = day_id;
  IF day_status = 'SCORED' THEN
    SELECT coalesce(sum(amount), 0) INTO balance FROM "Ledger"
      WHERE "matchDayId" = day_id AND kind IN ('ENTRY_FEE', 'PAYOUT', 'REFUND');
    IF balance <> 0 THEN RAISE EXCEPTION 'Scored matchday pool must be conserved'; END IF;
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION volleybet_ledger_validate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION volleybet_pool_validate() FROM PUBLIC, anon, authenticated;
DO $triggers$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'volleybet_ledger_validate_trigger' AND tgrelid = '"Ledger"'::regclass) THEN
    CREATE TRIGGER volleybet_ledger_validate_trigger BEFORE INSERT OR UPDATE ON "Ledger"
      FOR EACH ROW EXECUTE FUNCTION volleybet_ledger_validate();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'volleybet_ledger_pool_trigger' AND tgrelid = '"Ledger"'::regclass) THEN
    CREATE CONSTRAINT TRIGGER volleybet_ledger_pool_trigger AFTER INSERT OR UPDATE OR DELETE ON "Ledger"
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION volleybet_pool_validate();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'volleybet_matchday_pool_trigger' AND tgrelid = '"MatchDay"'::regclass) THEN
    CREATE CONSTRAINT TRIGGER volleybet_matchday_pool_trigger AFTER INSERT OR UPDATE ON "MatchDay"
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION volleybet_pool_validate();
  END IF;
END;
$triggers$;
