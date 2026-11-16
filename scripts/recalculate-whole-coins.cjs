// Explicit maintenance command. Dry run by default; --apply converts only
// completed days with fractional credits, using the production settlement code.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ log: [] });
const root = path.resolve(__dirname, '..');
const modules = new Map();
function loadTs(file) {
  const absolute = path.join(root, file);
  if (modules.has(absolute)) return modules.get(absolute).exports;
  const mod = new Module(absolute, module);
  modules.set(absolute, mod);
  mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  const originalRequire = mod.require.bind(mod);
  mod.require = name => {
    if (name === 'server-only') return {}; // CLI runs on the trusted server only.
    if (name === '@/lib/prisma') return { prisma: db };
    if (name.startsWith('@/')) return loadTs(`src/${name.slice(2)}.ts`);
    return originalRequire(name);
  };
  const compiled = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  mod._compile(compiled, absolute);
  return mod.exports;
}
const { settleMatchDay } = loadTs('src/lib/settlement.ts');
const { predictionPoints } = loadTs('src/lib/scoring.ts');
const { isValidVolleyScore } = loadTs('src/lib/volleyball.ts');
const fractional = l => !Number.isSafeInteger(l.amount);
const total = rows => rows.reduce((sum, row) => sum + row.amount, 0);
const daySelect = {
  id: true, leagueId: true, number: true, status: true, deadline: true,
  league: { select: { id: true, name: true, adminId: true } },
  matches: { orderBy: { id: 'asc' }, select: {
    id: true, resultA: true, resultB: true,
    bets: { orderBy: { id: 'asc' }, select: { id: true, userId: true, predictedA: true, predictedB: true, pointsEarned: true } },
  } },
  ledgers: { orderBy: { id: 'asc' }, select: { id: true, userId: true, leagueId: true, matchDayId: true, amount: true, reason: true, createdAt: true } },
};
function validate(day) {
  assert.equal(day.status, 'SCORED', 'A day with fractional credits is not completed');
  assert.ok(day.deadline.getTime() <= Date.now(), 'Completed day has a future deadline');
  assert.ok(day.matches.length > 0, 'Missing matches');
  for (const match of day.matches) {
    assert.ok(isValidVolleyScore(`${match.resultA}-${match.resultB}`), 'Incomplete or invalid saved results');
    for (const bet of match.bets) assert.equal(bet.pointsEarned,
      predictionPoints(bet.predictedA, bet.predictedB, match.resultA, match.resultB), 'Stored prediction points differ from saved results');
  }
  assert.ok(day.ledgers.filter(l => l.amount < 0).every(l => Number.isSafeInteger(l.amount)), 'Fractional entry fee');
  assert.ok(Math.abs(total(day.ledgers)) < 0.000001, 'Existing payouts do not conserve the pool');
}
const invariant = day => ({ matches: day.matches, fees: day.ledgers.filter(l => l.amount < 0), status: day.status, deadline: day.deadline });
async function main() {
  const apply = process.argv.includes('--apply');
  assert.ok(process.argv.slice(2).every(arg => arg === '--apply'), 'Unknown argument');
  const all = await db.ledger.findMany({ select: { id: true, amount: true, matchDayId: true } });
  const fractions = all.filter(fractional);
  assert.ok(fractions.every(l => l.amount > 0 && l.matchDayId), 'Fractional fees or unlinked movements require manual review');
  const ids = [...new Set(fractions.map(l => l.matchDayId))].sort();
  const days = await db.matchDay.findMany({ where: { id: { in: ids } }, orderBy: [{ leagueId: 'asc' }, { number: 'asc' }], select: daySelect });
  assert.equal(days.length, ids.length);
  for (const day of days) validate(day);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', days: days.map(d => ({ league: d.league.name, day: d.number, fractionalCredits: d.ledgers.filter(fractional).length, pool: -total(d.ledgers.filter(l => l.amount < 0)) })) }, null, 2));
  if (!apply || !days.length) return;
  const backupDirectory = path.join(root, '.local-backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `whole-coins-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const summary = await db.$transaction(async tx => {
    // Identical lock to every interactive league mutation; fixed order for batch locks.
    for (const leagueId of [...new Set(days.map(d => d.leagueId))].sort()) {
      const lock = await tx.league.updateMany({ where: { id: leagueId }, data: { updatedAt: new Date() } });
      assert.equal(lock.count, 1);
    }
    const snapshots = await tx.matchDay.findMany({ where: { id: { in: ids } }, orderBy: [{ leagueId: 'asc' }, { number: 'asc' }], select: daySelect });
    assert.equal(snapshots.length, days.length);
    for (const day of snapshots) validate(day);
    // Additive DDL and all settlements commit or roll back together.
    await tx.$executeRawUnsafe('ALTER TABLE "MatchDay" ADD COLUMN IF NOT EXISTS "coinDrawSeed" TEXT');
    const seeds = await tx.matchDay.findMany({ where: { id: { in: ids } }, select: { id: true, coinDrawSeed: true } });
    fs.writeFileSync(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), before: snapshots, seeds }, null, 2) + '\n', { flag: 'wx' });
    const result = [];
    for (const before of snapshots) {
      if (!before.ledgers.some(fractional)) continue;
      const form = new FormData();
      for (const m of before.matches) form.set(`result_${m.id}`, `${m.resultA}-${m.resultB}`);
      await settleMatchDay(tx, before.leagueId, before.id, before.league.adminId, form, { notify: false });
      const after = await tx.matchDay.findUnique({ where: { id: before.id }, select: daySelect });
      assert.deepEqual(invariant(after), invariant(before), 'Results, points or fees unexpectedly changed');
      assert.ok(after.ledgers.every(l => Number.isSafeInteger(l.amount)), 'Fractional credits remain');
      assert.equal(total(after.ledgers), 0, 'Pool was not conserved');
      await tx.auditLog.create({ data: {
        leagueId: before.leagueId, userId: before.league.adminId, action: 'Conversione Premi Interi',
        details: `Giornata ${before.number}: ricalcolo tecnico richiesto dal gestore per convertire i premi frazionari. Risultati, punti e quote invariati.`,
      } });
      result.push({ league: before.league.name, day: before.number, pool: -total(after.ledgers.filter(l => l.amount < 0)), prizes: after.ledgers.filter(l => l.amount > 0).map(l => l.amount).sort((a, b) => b - a) });
    }
    return result;
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 120000 });
  const remaining = (await db.ledger.findMany({ select: { amount: true } })).filter(fractional).length;
  assert.equal(remaining, 0, 'Some fractional ledger entries still exist');
  const report = { completedAt: new Date().toISOString(), days: summary, remainingFractionalMovements: remaining, backupPath: path.relative(root, backupPath) };
  fs.writeFileSync(backupPath.replace(/\.json$/, '-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => {
  // Do not print connection URLs, credentials or raw Prisma diagnostics.
  console.error(JSON.stringify({ error: error.code || error.name, reason: error instanceof assert.AssertionError ? error.message : 'Database operation failed; no credentials logged' }));
  process.exitCode = 1;
}).finally(() => db.$disconnect());
