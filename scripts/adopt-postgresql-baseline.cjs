// Adopt only after a zero-drift check. Never reset the DB or erase migration history.
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const { PrismaClient } = require('@prisma/client');
function secure(raw) {
  const u = new URL(raw); u.searchParams.set('sslmode', 'require'); u.searchParams.set('sslaccept', 'strict');
  u.searchParams.set('sslcert', path.resolve('prisma/certs/database-ca.pem')); return u.toString();
}
const env = { ...process.env, DATABASE_URL: secure(process.env.DATABASE_URL), DIRECT_URL: secure(process.env.DIRECT_URL) };
const db = new PrismaClient({ log: [], datasources: { db: { url: env.DATABASE_URL } } });
const cli = require.resolve('prisma/build/index.js');
function prisma(args) { return spawnSync(process.execPath, [cli, ...args], { env, encoding: 'utf8', windowsHide: true, timeout: 120000 }); }
(async () => {
  const diff = prisma(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code', '--script']);
  fs.mkdirSync('.local-backups', { recursive: true });
  fs.writeFileSync('.local-backups/postgresql-baseline-diff.sql', diff.stdout || '');
  assert.equal(diff.status, 0, 'Schema drift detected; refusing baseline adoption. Inspect private diff.');
  const [{ exists }] = await db.$queryRaw`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists`;
  const applied = exists ? await db.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL` : [];
  const migrations = fs.readdirSync('prisma/migrations').filter(name => fs.existsSync(path.join('prisma/migrations', name, 'migration.sql'))).sort();
  assert.ok(applied.every(row => migrations.includes(row.migration_name)), 'Legacy applied history detected; preserve and review it before adoption');
  if (!process.argv.includes('--apply')) { console.log('Zero drift; baseline adoption is ready. Use --apply.'); return; }
  for (const name of migrations) if (!applied.some(row => row.migration_name === name)) {
    const result = prisma(['migrate', 'resolve', '--applied', name, '--schema', 'prisma/schema.prisma']);
    if (result.status !== 0) {
      const output = (result.stderr || '') + (result.stdout || '');
      fs.writeFileSync('.local-backups/migration-adoption-error.txt', output);
      console.error('Migration CLI error:', /P\d{4}/.exec(output)?.[0] || 'UNKNOWN');
    }
    assert.equal(result.status, 0, 'Could not record migration baseline');
  }
  await db.$executeRawUnsafe('ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY');
  await db.$executeRawUnsafe('REVOKE ALL ON TABLE "_prisma_migrations" FROM PUBLIC, anon, authenticated');
  const status = prisma(['migrate', 'status', '--schema', 'prisma/schema.prisma']);
  assert.equal(status.status, 0, 'Migration history is not up to date');
  console.log('PostgreSQL baseline adopted with zero schema drift. Migration status: up to date. No application records changed.');
})().catch(e => { console.error(e instanceof assert.AssertionError ? e.message : e.code || e.name); process.exitCode = 1; }).finally(() => db.$disconnect());
