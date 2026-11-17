// Native HTTP form submission using an isolated PostgreSQL schema and fictitious
// users. Never posts predictions to an existing championship.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { encode } = require('next-auth/jwt');
const splitSql = require('./sql-statements.cjs');
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const { PrismaClient } = require('@prisma/client');
const schema = 'volleybet_form_test_' + randomBytes(8).toString('hex');
assert.match(schema, /^volleybet_form_test_[a-f0-9]{16}$/);
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('sslmode', 'require');
url.searchParams.set('sslaccept', 'strict');
url.searchParams.set('sslcert', path.resolve('prisma/certs/database-ca.pem'));
const db = new PrismaClient({ log: [], datasources: { db: { url: url.toString() } } });
url.searchParams.set('schema', schema);
const isolated = new PrismaClient({ log: [], datasources: { db: { url: url.toString() } } });
let child;
const decode = value => value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
(async () => {
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    for (const name of fs.readdirSync('prisma/migrations').sort()) {
      const file = path.join('prisma/migrations', name, 'migration.sql');
      if (fs.existsSync(file)) for (const sql of splitSql(fs.readFileSync(file, 'utf8'))) await tx.$executeRawUnsafe(sql);
    }
  }, { timeout: 120000 });
  assert.equal((await isolated.$queryRaw`SELECT current_schema() AS schema`)[0].schema, schema);
  await isolated.user.create({ data: { id: 'form-test-user', name: 'Test' } });
  await isolated.league.create({ data: { id: 'form-test-league', name: 'Test', inviteCode: 'form-test-invite', adminId: 'form-test-user', homeTeam: 'A', users: { connect: { id: 'form-test-user' } } } });
  await isolated.leagueMember.create({ data: { userId: 'form-test-user', leagueId: 'form-test-league', teamName: 'A' } });
  await isolated.matchDay.create({ data: { id: 'form-test-day', leagueId: 'form-test-league', number: 1, deadline: new Date(Date.now() + 3600000), matches: { create: [{ id: 'form-test-match', teamA: 'C', teamB: 'D' }, { id: 'form-test-match-2', teamA: 'E', teamB: 'F' }] } } });
  const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
  const base = `http://127.0.0.1:${port}`;
  let serverErrors = '';
  child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), NEXTAUTH_URL: base },
  });
  child.stderr.on('data', chunk => { serverErrors += chunk.toString(); });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { await fetch(base + '/privacy', { signal: AbortSignal.timeout(1000) }); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(ready, 'Production server did not start');
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { id: 'form-test-user', sessionVersion: 0 }, maxAge: 300 });
  const headers = { cookie: `next-auth.session-token=${token}` };
  const route = '/league/form-test-league/matchday/form-test-day';
  const response = await fetch(base + route, { headers });
  const html = await response.text();
  assert.equal(response.status, 200);
  const formHtml = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m => m[1]).find(value => value.includes('bet_form-test-match'));
  assert.ok(formHtml, 'Bet form did not render');
  const form = new FormData();
  for (const [tag] of formHtml.matchAll(/<input\b[^>]*>/g)) {
    const name = /\bname="([^"]*)"/.exec(tag)?.[1];
    const value = /\bvalue="([^"]*)"/.exec(tag)?.[1] || '';
    if (name?.startsWith('$ACTION')) form.append(decode(name), decode(value));
  }
  assert.ok([...form.keys()].some(key => key.startsWith('$ACTION')), 'No server action reference');
  form.set('bet_form-test-match', '3-0');
  form.set('bet_form-test-match-2', '');
  const posted = await fetch(base + route, { method: 'POST', headers: { ...headers, origin: base }, body: form, redirect: 'manual' });
  const body = await posted.text();
  if (posted.status !== 303) {
    // Errors are from fictitious accounts only. Never output environment values.
    console.error(serverErrors.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[database URL redacted]'));
    console.log(JSON.stringify({ status: posted.status, serverErrorPage: body.includes('server error occurred'), actionError: body.includes('digest') }));
  }
  assert.equal(posted.status, 303, 'Submitting a partial bet form failed');
  assert.equal(await isolated.bet.count(), 1);
  assert.equal(await isolated.ledger.count({ where: { kind: 'ENTRY_FEE', amount: -1 } }), 1);
  form.set('bet_form-test-match', '2-3');
  form.set('bet_form-test-match-2', '3-2');
  const updated = await fetch(base + route, { method: 'POST', headers: { ...headers, origin: base }, body: form, redirect: 'manual' });
  await updated.text();
  assert.equal(updated.status, 303, 'Updating existing bets failed');
  assert.equal(await isolated.bet.count(), 2);
  assert.equal((await isolated.bet.findUnique({ where: { userId_matchId: { userId: 'form-test-user', matchId: 'form-test-match' } } })).predictedA, 2);
  assert.equal(await isolated.ledger.count(), 1, 'Updating bets charged another entry fee');
  console.log('Production HTTP bet form: partial submission, update and completion saved; one entry fee; both redirects succeeded. Isolated fixtures only.');
})().catch(error => {
  console.error(JSON.stringify({ error: error.code || error.name, message: error instanceof assert.AssertionError ? error.message : undefined, databaseCode: error.meta?.code }));
  process.exitCode = 1;
}).finally(async () => {
  if (child && child.exitCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await stopped; }
  await isolated.$disconnect();
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
});
