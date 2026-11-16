// Read-only metadata and aggregate checks. No credentials or user records emitted.
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const { PrismaClient, Prisma } = require('@prisma/client');
const db = new PrismaClient({ log: [] });
const tables = ['Account', 'Session', 'VerificationToken', 'User', 'League', 'LeagueMember', '_LeagueMembers', 'Team', 'MatchDay', 'Match', 'Bet', 'Ledger', 'AuditLog', 'Notification', 'SecurityRateLimit'];
async function main() {
  const roles = await db.$queryRaw`SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname IN (current_user, 'anon', 'authenticated')`;
  const tableSecurity = await db.$queryRaw`SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced_rls,
    pg_get_userbyid(c.relowner) = current_user AS app_owns_table
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN (${Prisma.join(tables)}) ORDER BY c.relname`;
  const grants = [];
  for (const role of roles.filter(r => ['anon', 'authenticated'].includes(r.rolname))) {
    const rows = await db.$queryRaw`SELECT c.relname,
      has_table_privilege(${role.rolname}, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS any_table_privilege
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN (${Prisma.join(tables)}) ORDER BY c.relname`;
    grants.push({ role: role.rolname, tables: rows });
  }
  const constraints = await db.$queryRaw`SELECT c.relname AS table_name, con.conname, con.contype, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con JOIN pg_class c ON con.conrelid = c.oid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN (${Prisma.join(tables)}) ORDER BY c.relname, con.conname`;
  const indexes = await db.$queryRaw`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN (${Prisma.join(tables)}) ORDER BY tablename, indexname`;
  const tls = await db.$queryRaw`SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()`;
  const checks = await db.$queryRaw`SELECT
    (SELECT count(*)::int FROM "Ledger" WHERE amount <> trunc(amount)) AS fractional_movements,
    (SELECT count(*)::int FROM "Ledger" l JOIN "MatchDay" d ON l."matchDayId" = d.id WHERE l."leagueId" <> d."leagueId") AS cross_league_ledger_links,
    (SELECT count(*)::int FROM "Match" m JOIN "MatchDay" d ON m."matchDayId" = d.id WHERE d.status = 'SCORED'
      AND NOT coalesce((m."resultA" = 3 AND m."resultB" BETWEEN 0 AND 2) OR (m."resultB" = 3 AND m."resultA" BETWEEN 0 AND 2), false)) AS invalid_scored_results,
    (SELECT count(*)::int FROM "Bet" WHERE NOT (("predictedA" = 3 AND "predictedB" BETWEEN 0 AND 2) OR ("predictedB" = 3 AND "predictedA" BETWEEN 0 AND 2))) AS invalid_predictions,
    (SELECT count(*)::int FROM "Bet" b JOIN "Match" m ON b."matchId" = m.id JOIN "MatchDay" d ON m."matchDayId" = d.id
      JOIN "LeagueMember" lm ON lm."userId" = b."userId" AND lm."leagueId" = d."leagueId"
      WHERE lm."teamName" = m."teamA" OR lm."teamName" = m."teamB") AS own_team_predictions,
    (SELECT count(*)::int FROM "MatchDay" WHERE status = 'SCORED' AND "coinDrawSeed" IS NULL) AS scored_days_without_seed,
    (SELECT count(*)::int FROM "MatchDay" WHERE status = 'SCORED') AS scored_days,
    (SELECT count(*)::int FROM "League" WHERE "inviteCode" !~ '^VOLLEY-[0-9A-F]{32}$') AS weak_invites,
    (SELECT count(*)::int FROM "SecurityRateLimit") AS rate_limit_rows,
    (SELECT count(*)::int FROM "SecurityRateLimit" WHERE "expiresAt" < now()) AS expired_rate_limit_rows,
    (SELECT count(*)::int FROM "Bet" b JOIN "Match" m ON b."matchId" = m.id JOIN "MatchDay" d ON m."matchDayId" = d.id
      WHERE d.status = 'SCORED' AND b."pointsEarned" IS DISTINCT FROM
      CASE WHEN b."predictedA" = m."resultA" AND b."predictedB" = m."resultB" THEN 3
      WHEN (b."predictedA" > b."predictedB") = (m."resultA" > m."resultB") THEN 1 ELSE 0 END) AS mismatched_points,
    (SELECT count(*)::int FROM (SELECT "userId", "matchDayId" FROM "Ledger" WHERE amount < 0 AND "matchDayId" IS NOT NULL
      GROUP BY "userId", "matchDayId" HAVING count(*) > 1) q) AS duplicated_entry_fees,
    (SELECT count(*)::int FROM (SELECT "leagueId", number FROM "MatchDay" GROUP BY "leagueId", number HAVING count(*) > 1) q) AS duplicate_day_numbers,
    (SELECT count(*)::int FROM (SELECT "matchDayId" FROM "Ledger" WHERE "matchDayId" IS NOT NULL GROUP BY "matchDayId"
      HAVING abs(sum(amount)) > 0.000001 AND "matchDayId" IN (SELECT id FROM "MatchDay" WHERE status = 'SCORED')) q) AS scored_days_unbalanced`;
  const publicFunctions = await db.$queryRaw`SELECT p.proname, p.prosecdef AS security_definer,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f' ORDER BY p.proname`;
  const publicViews = await db.$queryRaw`SELECT c.relname,
    has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select,
    has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_can_select
    FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm') ORDER BY c.relname`;
  const result = { capturedAt: new Date().toISOString(), readOnly: true,
    roles: roles.map(r => ({ role: ['anon', 'authenticated'].includes(r.rolname) ? r.rolname : 'application', bypassRls: r.rolbypassrls, superuser: r.rolsuper })),
    tableSecurity, grants, constraints, indexes, tls, publicFunctions, publicViews, checks: checks[0] };
  fs.writeFileSync(path.join(__dirname, 'database-2026-11-16.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ tablesChecked: tableSecurity.length, allRls: tableSecurity.every(t => t.rls), clientGrants: grants.map(g => ({ role: g.role, accessibleTables: g.tables.filter(t => t.any_table_privilege).length })), tls, checks: checks[0] }, null, 2));
}
main().catch(e => { console.error(JSON.stringify({ error: e.code || e.name })); process.exitCode = 1; }).finally(() => db.$disconnect());
