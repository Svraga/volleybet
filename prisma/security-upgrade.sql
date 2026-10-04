-- Additive PostgreSQL upgrade; historical migrations here target SQLite.
CREATE TABLE IF NOT EXISTS "SecurityRateLimit" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "attempts" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "SecurityRateLimit_expiresAt_idx" ON "SecurityRateLimit" ("expiresAt");
