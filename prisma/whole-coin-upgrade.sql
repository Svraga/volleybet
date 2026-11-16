-- Non-destructive: historical payouts are changed only when the admin rescores.
ALTER TABLE "MatchDay" ADD COLUMN IF NOT EXISTS "coinDrawSeed" TEXT;
