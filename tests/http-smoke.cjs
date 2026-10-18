// Local production server checks. No authenticated requests or database mutations.
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const port = await new Promise(resolve => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { windowsHide: true, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const results = [];
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { await fetch(base + '/privacy', { signal: AbortSignal.timeout(1000) }); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    assert.equal(ready, true, 'local server failed to start');
    for (const route of ['/profile', '/league/test/stats', '/league/test/predictions', '/league/test/admin', '/league/test/matchday/test']) {
      const response = await fetch(base + route, { redirect: 'manual', headers: { authorization: 'Bearer %' }, signal: AbortSignal.timeout(5000) });
      assert.ok([302, 307].includes(response.status), 'protected route must redirect without a valid session');
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      results.push({ route, status: response.status, malformedBearerHandled: true });
    }
    const session = await fetch(base + '/api/auth/session', { headers: { authorization: 'Bearer %' }, signal: AbortSignal.timeout(5000) });
    assert.equal(session.status, 200); assert.deepEqual(await session.json(), {});
    results.push({ route: '/api/auth/session', status: 200, anonymousSession: true });
    fs.writeFileSync(path.join(__dirname, '../audit/http-smoke-results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log('HTTP smoke: 6 checks passed; no database access or writes.');
  } finally { child.kill(); }
}
main().catch(() => { console.error('HTTP smoke failed.'); process.exitCode = 1; });
