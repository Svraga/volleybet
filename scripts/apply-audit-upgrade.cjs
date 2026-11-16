// Guarded upgrade: no resets, no session-secret changes, no record deletion.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const { PrismaClient } = require('@prisma/client');
const splitSql = require('./sql-statements.cjs');
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('sslmode', 'require'); url.searchParams.set('sslaccept', 'strict');
url.searchParams.set('sslcert', path.resolve('prisma/certs/database-ca.pem'));
const db = new PrismaClient({ log: [], datasources: { db: { url: url.toString() } } });
const changedTables = ['User', 'AuditLog', 'Ledger', 'MatchDay'];
let stage = 'connect';
async function snapshot(tx, label) {
  const result = {};
  for (const table of changedTables) result[table] = await tx.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id /* ${label} */`);
  return result;
}
async function main() {
  assert.ok(process.argv.slice(2).every(a => a === '--apply'), 'Unknown argument');
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/audit-upgrade.sql'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '../prisma/coin-integrity.sql'), 'utf8');
  if (!process.argv.includes('--apply')) {
    await db.$queryRaw`SELECT 1`;
    console.log('Verified TLS; dry run. Use --apply for the guarded schema upgrade.'); return;
  }
  const backupDirectory = path.resolve('.local-backups'); fs.mkdirSync(backupDirectory, { recursive: true });
  const backup = path.join(backupDirectory, `audit-upgrade-${Date.now()}.json`);
  const counts = await db.$transaction(async tx => {
    // Share the same lock order as normal mutations and avoid concurrent fee/scoring writes.
    const leagues = await tx.league.findMany({ orderBy: { id: 'asc' }, select: { id: true } });
    for (const league of leagues) await tx.league.updateMany({ where: { id: league.id }, data: { updatedAt: new Date() } });
    await tx.$executeRawUnsafe('LOCK TABLE "User", "AuditLog", "Ledger", "MatchDay" IN SHARE ROW EXCLUSIVE MODE');
    const before = await snapshot(tx, 'before');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n', { flag: 'wx' });
    for (const [index, statement] of splitSql(sql).entries()) { stage = `statement-${index + 1}`; await tx.$executeRawUnsafe(statement); }
    stage = 'verify-preserved-data';
    const after = await snapshot(tx, 'after');
    for (const table of changedTables) {
      assert.equal(after[table].length, before[table].length, `${table} record count changed`);
      for (let i = 0; i < before[table].length; i++) for (const [key, value] of Object.entries(before[table][i])) {
        if (table === 'Ledger' && key === 'kind' && value === 'LEGACY') {
          assert.ok(['LEGACY', 'ENTRY_FEE', 'PAYOUT', 'REFUND'].includes(after[table][i][key]));
          continue; // Classification adds metadata; amount, owner, day and reason are checked below.
        }
        assert.deepEqual(after[table][i][key], value, `${table}.${key} historical data changed`);
      }
    }
    return Object.fromEntries(changedTables.map(t => [t, after[t].length]));
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 120000 });
  console.log(JSON.stringify({ applied: true, preservedRecords: counts, backup: path.relative(process.cwd(), backup), sessionSecretChanged: false, sessionsRevoked: false }, null, 2));
}
main().catch(e => { console.error(JSON.stringify({ error: e.code || e.name, databaseCode: e.meta?.code, stage, message: e instanceof assert.AssertionError ? e.message : 'Upgrade failed; credentials omitted' })); process.exitCode = 1; }).finally(() => db.$disconnect());
