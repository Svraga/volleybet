-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "hasOddTeams" BOOLEAN NOT NULL DEFAULT false,
    "coinName" TEXT NOT NULL DEFAULT 'Coin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorName" TEXT,
    "payload" JSONB,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchDay" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "opensAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "restingTeam" TEXT,
    "coinDrawSeed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "teamA" TEXT NOT NULL,
    "teamB" TEXT NOT NULL,
    "resultA" INTEGER,
    "resultB" INTEGER,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "predictedA" INTEGER NOT NULL,
    "predictedB" INTEGER NOT NULL,
    "pointsEarned" INTEGER,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LEGACY',
    "reason" TEXT NOT NULL,
    "matchDayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityRateLimit" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "_LeagueMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "League_inviteCode_key" ON "League"("inviteCode");

-- CreateIndex
CREATE INDEX "AuditLog_leagueId_createdAt_idx" ON "AuditLog"("leagueId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchDay_leagueId_status_deadline_idx" ON "MatchDay"("leagueId", "status", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "MatchDay_leagueId_number_key" ON "MatchDay"("leagueId", "number");

-- CreateIndex
CREATE INDEX "Match_matchDayId_idx" ON "Match"("matchDayId");

-- CreateIndex
CREATE INDEX "Bet_matchId_idx" ON "Bet"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "Bet_userId_matchId_key" ON "Bet"("userId", "matchId");

-- CreateIndex
CREATE INDEX "Ledger_leagueId_matchDayId_idx" ON "Ledger"("leagueId", "matchDayId");

-- CreateIndex
CREATE INDEX "Ledger_userId_leagueId_idx" ON "Ledger"("userId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_leagueId_name_key" ON "Team"("leagueId", "name");

-- CreateIndex
CREATE INDEX "Notification_userId_leagueId_isRead_idx" ON "Notification"("userId", "leagueId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_leagueId_createdAt_idx" ON "Notification"("userId", "leagueId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMember_userId_leagueId_key" ON "LeagueMember"("userId", "leagueId");

-- CreateIndex
CREATE INDEX "SecurityRateLimit_expiresAt_idx" ON "SecurityRateLimit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "_LeagueMembers_AB_unique" ON "_LeagueMembers"("A", "B");

-- CreateIndex
CREATE INDEX "_LeagueMembers_B_index" ON "_LeagueMembers"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDay" ADD CONSTRAINT "MatchDay_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LeagueMembers" ADD CONSTRAINT "_LeagueMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LeagueMembers" ADD CONSTRAINT "_LeagueMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


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
    table_id := to_regclass(format('%I.%I', current_schema(), table_name));
    IF table_id IS NULL THEN CONTINUE; END IF;

    IF NOT backend_bypass AND NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE oid = table_id AND pg_get_userbyid(relowner) = current_user
    ) THEN
      RAISE EXCEPTION 'Backend role must own table % or have BYPASSRLS', table_name;
    END IF;

    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', current_schema(), table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', current_schema(), table_name);
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', current_schema(), table_name, client_role);
      END IF;
    END LOOP;
  END LOOP;
END;
$volleybet_security$;
