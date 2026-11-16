// Benign requests against a loopback-only production server. No user session.
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const port = await new Promise(resolve => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    windowsHide: true, stdio: 'ignore', env: { ...process.env, NEXTAUTH_URL: base },
  });
  const results = [];
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { await fetch(base + '/privacy', { signal: AbortSignal.timeout(1000) }); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    assert.ok(ready, 'Production server did not start');
    for (const route of ['/profile', '/league/test/stats', '/league/test/predictions', '/league/test/admin', '/league/test/audit', '/league/test/notifications', '/league/test/matchday/test', '/league/create', '/league/join', '/welcome']) {
      const response = await fetch(base + route, { redirect: 'manual', headers: { authorization: 'Bearer %' }, signal: AbortSignal.timeout(5000) });
      const body = route === '/welcome' && response.status === 200 ? await response.text() : '';
      const streamRedirect = !!body && /NEXT_REDIRECT|http-equiv="refresh"/.test(body) && !body.includes('Nickname Visualizzato');
      results.push({ route, status: response.status, anonymousAccessDenied: [302, 307].includes(response.status) || streamRedirect, streamRedirect, malformedBearerHandled: response.status < 500 });
      assert.ok([302, 307].includes(response.status) || streamRedirect, `Anonymous protected route did not redirect: ${route} (${response.status})`);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
    const session = await fetch(base + '/api/auth/session', { signal: AbortSignal.timeout(5000) });
    assert.equal(session.status, 200); assert.deepEqual(await session.json(), {});
    results.push({ route: '/api/auth/session', status: 200, anonymousSession: true });
    const svg = await fetch(base + '/_next/image?url=%2Ffile.svg&w=64&q=75', { signal: AbortSignal.timeout(10000) });
    assert.equal(svg.status, 400);
    results.push({ route: '/_next/image (local SVG)', status: svg.status, defaultSvgOptimizationRejected: true });
    const privacy = await fetch(base + '/privacy');
    results.push({ route: '/privacy', status: privacy.status,
      headers: { xFrameOptions: privacy.headers.get('x-frame-options'), xContentTypeOptions: privacy.headers.get('x-content-type-options'),
        referrerPolicy: privacy.headers.get('referrer-policy'), contentSecurityPolicy: privacy.headers.get('content-security-policy'),
        permissionsPolicy: privacy.headers.get('permissions-policy'), strictTransportSecurity: privacy.headers.get('strict-transport-security') } });
    fs.writeFileSync(path.join(__dirname, 'http-2026-11-16.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
  } finally { fs.writeFileSync(path.join(__dirname, 'http-2026-11-16.json'), JSON.stringify(results, null, 2) + '\n'); child.kill(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
