-- Additive PostgreSQL upgrade. Safe to apply before deploying the new app.
-- Historical days keep NULL, meaning immediately open as before.
ALTER TABLE "MatchDay" ADD COLUMN IF NOT EXISTS "opensAt" TIMESTAMP(3);
