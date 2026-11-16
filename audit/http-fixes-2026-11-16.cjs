// Read-only authenticated smoke with an in-memory legacy-format JWT.
// No token, user ID, email or rendered page content is logged or written.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { encode } = require('next-auth/jwt');
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const { PrismaClient } = require('@prisma/client');
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('sslcert', path.resolve('prisma/certs/database-ca.pem'));
url.searchParams.set('sslmode', 'require'); url.searchParams.set('sslaccept', 'strict');
const db = new PrismaClient({ log: [], datasources: { db: { url: url.toString() } } });
(async () => {
  const league = await db.league.findFirst({ select: { id: true, adminId: true } });
  const user = await db.user.findUnique({ where: { id: league.adminId }, select: { id: true, sessionVersion: true } });
  assert.equal(user.sessionVersion, 0, 'Use an account with no explicit revocations for the legacy-token test');
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { id: user.id }, maxAge: 300 });
  const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); }); });
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { windowsHide: true, stdio: 'ignore', env: { ...process.env, NEXTAUTH_URL: base } });
  const results = [];
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) { try { await fetch(base + '/privacy', { signal: AbortSignal.timeout(1000) }); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); } }
    assert.ok(ready);
    const headers = { cookie: `next-auth.session-token=${token}` };
    const session = await fetch(base + '/api/auth/session', { headers });
    assert.equal((await session.json()).user.id, user.id);
    results.push({ check: 'legacy-format JWT accepted after schema upgrade', passed: true });
    for (const [route, marker] of [
      ['/profile', 'Le tue Statistiche Globali'], [`/league/${league.id}`, 'Scommesse Aperte'],
      [`/league/${league.id}/stats`, 'Classifica Punti Pronostici'], [`/league/${league.id}/admin`, 'Nuova Giornata'],
      [`/league/${league.id}/audit`, 'Registro Trasparenza'], [`/league/${league.id}/predictions`, 'Pronostici della lega'],
    ]) {
      const response = await fetch(base + route, { headers, redirect: 'manual' });
      assert.equal(response.status, 200);
      const html = await response.text(); assert.ok(html.includes(marker), 'Authenticated page did not render its content');
      const csp = response.headers.get('content-security-policy') || '';
      const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]; assert.ok(nonce);
      const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
      assert.ok(scripts.length > 0); assert.ok(scripts.every(tag => tag.includes(`nonce="${nonce}"`)), 'Script nonce differs from CSP');
      results.push({ check: marker, passed: true, cspNonceMatchesAllScripts: true });
    }
    const denied = await fetch(base + '/api/maintenance/rate-limits');
    assert.equal(denied.status, 401);
    results.push({ check: 'maintenance rejects anonymous requests', passed: true });
    fs.writeFileSync('audit/http-fixes-2026-11-16.json', JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
  } finally { child.kill(); }
})().catch(e => { console.error(e instanceof assert.AssertionError ? e.message : e.code || e.name); process.exitCode = 1; }).finally(() => db.$disconnect());
