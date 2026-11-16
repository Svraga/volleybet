-- All data conversions are guarded; never round or delete historical records.
DO $checks$
BEGIN
  IF EXISTS (SELECT 1 FROM "Ledger" WHERE amount <> trunc(amount) OR amount > 2147483647 OR amount < -2147483648) THEN
    RAISE EXCEPTION 'Ledger contains non-integer or out-of-range coins; conversion refused';
  END IF;
END;
$checks$;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "payload" JSONB;
ALTER TABLE "MatchDay" ADD COLUMN IF NOT EXISTS "coinDrawSeed" TEXT;
ALTER TABLE "Ledger" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "Ledger" ALTER COLUMN "amount" TYPE INTEGER USING "amount"::INTEGER;
UPDATE "Ledger" SET kind = CASE
  WHEN amount < 0 AND reason ~ '^MatchDay [0-9]+ Entry Fee' THEN 'ENTRY_FEE'
  WHEN amount > 0 AND reason ~ '^Payout MatchDay ' THEN 'PAYOUT'
  WHEN amount > 0 AND reason ~ '^Refund \(' THEN 'REFUND'
  ELSE kind END WHERE kind = 'LEGACY';
CREATE UNIQUE INDEX IF NOT EXISTS "MatchDay_leagueId_number_key" ON "MatchDay" ("leagueId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "Team_leagueId_name_key" ON "Team" ("leagueId", "name");
CREATE INDEX IF NOT EXISTS "MatchDay_leagueId_status_deadline_idx" ON "MatchDay" ("leagueId", "status", "deadline");
CREATE INDEX IF NOT EXISTS "Match_matchDayId_idx" ON "Match" ("matchDayId");
CREATE INDEX IF NOT EXISTS "Bet_matchId_idx" ON "Bet" ("matchId");
CREATE INDEX IF NOT EXISTS "Ledger_leagueId_matchDayId_idx" ON "Ledger" ("leagueId", "matchDayId");
CREATE INDEX IF NOT EXISTS "Ledger_userId_leagueId_idx" ON "Ledger" ("userId", "leagueId");
CREATE INDEX IF NOT EXISTS "AuditLog_leagueId_createdAt_idx" ON "AuditLog" ("leagueId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_leagueId_isRead_idx" ON "Notification" ("userId", "leagueId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_userId_leagueId_createdAt_idx" ON "Notification" ("userId", "leagueId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Ledger_one_entry_fee_per_day" ON "Ledger" ("userId", "matchDayId") WHERE kind = 'ENTRY_FEE';
CREATE UNIQUE INDEX IF NOT EXISTS "Ledger_one_settlement_per_kind" ON "Ledger" ("userId", "matchDayId", kind) WHERE kind IN ('PAYOUT', 'REFUND');
DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Ledger_whole_coin_kind_check' AND conrelid = '"Ledger"'::regclass) THEN
    ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_whole_coin_kind_check" CHECK
      ((kind IN ('ENTRY_FEE') AND amount < 0) OR (kind IN ('PAYOUT', 'REFUND') AND amount > 0) OR kind IN ('LEGACY', 'ADJUSTMENT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MatchDay_status_check' AND conrelid = '"MatchDay"'::regclass) THEN
    ALTER TABLE "MatchDay" ADD CONSTRAINT "MatchDay_status_check" CHECK (status IN ('OPEN', 'CLOSED', 'SCORED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bet_score_check' AND conrelid = '"Bet"'::regclass) THEN
    ALTER TABLE "Bet" ADD CONSTRAINT "Bet_score_check" CHECK
      ((("predictedA" = 3 AND "predictedB" BETWEEN 0 AND 2) OR ("predictedB" = 3 AND "predictedA" BETWEEN 0 AND 2)) AND ("pointsEarned" IS NULL OR "pointsEarned" IN (0, 1, 3)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Match_result_check' AND conrelid = '"Match"'::regclass) THEN
    ALTER TABLE "Match" ADD CONSTRAINT "Match_result_check" CHECK
      (("resultA" IS NULL AND "resultB" IS NULL) OR ("resultA" IS NOT NULL AND "resultB" IS NOT NULL AND
      (("resultA" = 3 AND "resultB" BETWEEN 0 AND 2) OR ("resultB" = 3 AND "resultA" BETWEEN 0 AND 2))));
  END IF;
END;
$constraints$;
