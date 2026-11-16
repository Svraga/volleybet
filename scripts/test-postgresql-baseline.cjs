// All test schema creation, constraints and permission changes are rolled back.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const splitSql = require('./sql-statements.cjs');
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const { PrismaClient } = require('@prisma/client');
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('sslmode', 'require'); url.searchParams.set('sslaccept', 'strict');
url.searchParams.set('sslcert', path.resolve('prisma/certs/database-ca.pem'));
const db = new PrismaClient({ log: [], datasources: { db: { url: url.toString() } } });
const marker = new Error('ROLLBACK_BASELINE_TEST');
const schema = 'volleybet_baseline_test_' + randomBytes(6).toString('hex');
(async () => {
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      const migrations = fs.readdirSync('prisma/migrations').filter(name => fs.existsSync(path.join('prisma/migrations', name, 'migration.sql'))).sort();
      for (const name of migrations) {
        const sql = fs.readFileSync(path.join('prisma/migrations', name, 'migration.sql'), 'utf8');
        for (const statement of splitSql(sql)) await tx.$executeRawUnsafe(statement);
      }
      const [{ count }] = await tx.$queryRaw`SELECT count(*)::int FROM pg_tables WHERE schemaname = ${schema}`;
      assert.equal(count, 15);
      await tx.$executeRawUnsafe(`INSERT INTO "User" (id, "updatedAt") VALUES ('audit-user', now())`);
      await tx.$executeRawUnsafe(`INSERT INTO "League" (id, name, "inviteCode", "adminId", "homeTeam", "updatedAt") VALUES ('audit-league', 'Test', 'test-invite', 'audit-user', 'A', now())`);
      await tx.$executeRawUnsafe(`INSERT INTO "MatchDay" (id, "leagueId", number, deadline, "updatedAt") VALUES ('audit-day', 'audit-league', 1, now(), now())`);
      await tx.$executeRawUnsafe(`INSERT INTO "Ledger" (id, "userId", "leagueId", "matchDayId", amount, reason) VALUES ('audit-fee', 'audit-user', 'audit-league', 'audit-day', -1, 'MatchDay 1 Entry Fee')`);
      await tx.$executeRawUnsafe(`INSERT INTO "Ledger" (id, "userId", "leagueId", "matchDayId", amount, reason) VALUES ('audit-payout', 'audit-user', 'audit-league', 'audit-day', 1, 'Payout MatchDay 1')`);
      await tx.$executeRawUnsafe(`UPDATE "MatchDay" SET status = 'SCORED' WHERE id = 'audit-day'`);
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      const [{ kind }] = await tx.$queryRawUnsafe(`SELECT kind FROM "Ledger" WHERE id = 'audit-fee'`);
      assert.equal(kind, 'ENTRY_FEE');
      async function rejectsSql(sql, code) {
        await tx.$executeRawUnsafe('SAVEPOINT invalid_change'); let rejected = false;
        try { await tx.$executeRawUnsafe(sql); }
        catch (error) { assert.equal(error.meta?.code, code); rejected = true; }
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_change');
        assert.ok(rejected, 'Database accepted an invalid change');
      }
      await rejectsSql(`UPDATE "Ledger" SET amount = 2 WHERE id = 'audit-payout'`, 'P0001');
      await rejectsSql(`INSERT INTO "Ledger" (id, "userId", "leagueId", "matchDayId", amount, reason) VALUES ('duplicate-fee', 'audit-user', 'audit-league', 'audit-day', -1, 'MatchDay 1 Entry Fee')`, '23505');
      await rejectsSql(`INSERT INTO "Match" (id, "matchDayId", "teamA", "teamB", "resultA", "resultB") VALUES ('bad-match', 'audit-day', 'A', 'B', 1, 1)`, '23514');
      await rejectsSql(`UPDATE "Ledger" SET "leagueId" = 'other-league' WHERE id = 'audit-fee'`, 'P0001');
      throw marker;
    }, { timeout: 120000 });
  } catch (error) { if (error !== marker) throw error; }
  const [{ exists }] = await db.$queryRaw`SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = ${schema})`;
  assert.equal(exists, false);
  console.log('PostgreSQL baseline validated: 15 tables; pool, unique fee, score and league guards verified; all temporary changes rolled back.');
})().catch(e => { console.error(JSON.stringify({ error: e.code || e.name, databaseCode: e.meta?.code })); process.exitCode = 1; }).finally(() => db.$disconnect());
