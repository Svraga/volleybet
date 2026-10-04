// Read-only metadata checks and permission probes. Does not print database credentials.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const tables = ['Account', 'Session', 'VerificationToken', 'User', 'League', 'LeagueMember', '_LeagueMembers', 'Team', 'MatchDay', 'Match', 'Bet', 'Ledger', 'AuditLog', 'Notification', 'SecurityRateLimit'];

async function main() {
  const roles = await prisma.$queryRaw`SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname IN (current_user, 'anon', 'authenticated')`;
  const clients = roles.filter(r => ['anon', 'authenticated'].includes(r.rolname));
  const rows = await prisma.$queryRaw`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls,
      pg_get_userbyid(c.relowner) = current_user AS owned_by_app
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN (${Prisma.join(tables)})
    ORDER BY c.relname
  `;
  assert.equal(rows.length, tables.length, 'Missing application table');
  assert.ok(rows.every(r => r.rls), 'RLS must be enabled on every application table');
  let grantsChecked = 0;
  for (const role of clients) {
    const grants = await prisma.$queryRaw`
      SELECT c.relname,
        has_table_privilege(${role.rolname}, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS allowed
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN (${Prisma.join(tables)})
    `;
    assert.ok(grants.every(g => !g.allowed), 'Client role has table privileges');
    grantsChecked += grants.length;
  }
  let deniedProbes = 0;
  const probes = [
    'SELECT * FROM public."User" LIMIT 0',
    'SELECT * FROM public."Account" LIMIT 0',
    'EXPLAIN SELECT * FROM public."SecurityRateLimit"',
    'EXPLAIN INSERT INTO public."SecurityRateLimit" DEFAULT VALUES',
    'EXPLAIN UPDATE public."SecurityRateLimit" SET "attempts" = 0 WHERE false',
    'EXPLAIN DELETE FROM public."SecurityRateLimit" WHERE false',
  ];
  for (const role of clients) for (const sql of probes) {
    try {
      await prisma.$transaction(async tx => {
        // Role names come from this fixed allowlist, not request data.
        await tx.$executeRawUnsafe('SET LOCAL ROLE "' + role.rolname + '"');
        await tx.$queryRawUnsafe(sql);
      });
      throw new Error('Client access unexpectedly allowed');
    } catch (error) {
      assert.equal(error.code, 'P2010');
      assert.equal(error.meta?.code, '42501', 'Expected PostgreSQL insufficient_privilege');
      deniedProbes++;
    }
  }
  const [{ weak_invites }] = await prisma.$queryRaw`SELECT count(*)::int AS weak_invites FROM "League" WHERE "inviteCode" !~ '^VOLLEY-[0-9A-F]{32}$'`;
  assert.equal(weak_invites, 0);
  const [{ index_exists }] = await prisma.$queryRaw`SELECT to_regclass('public."SecurityRateLimit_expiresAt_idx"') IS NOT NULL AS index_exists`;
  assert.equal(index_exists, true);
  const rateLimitRows = await prisma.securityRateLimit.count();
  const result = { schemaApplied: true, weakInvites: weak_invites, rateLimitIndexExists: index_exists,
    rateLimitRows, tables: rows, grantsChecked, deniedProbes, backendReadSuccessful: true };
  fs.writeFileSync(path.join(__dirname, '../audit/database-security-verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('Verified:', rows.length, 'RLS tables,', grantsChecked, 'client grants,', deniedProbes, 'denied access probes, zero weak invitations.');
}
main().catch(e => { console.error('Security verification failed:', e.code || e.name); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
