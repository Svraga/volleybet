// Reports only booleans/settings, never credentials or connection hostnames.
const fs = require('node:fs');
const path = require('node:path');
const result = [];
for (const file of ['.env.local', '.env']) {
  const parsed = require('dotenv').parse(fs.readFileSync(file));
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    const url = new URL(parsed[key]);
    result.push({ file, key, viaPooler: /pooler\./.test(url.hostname), sslmode: url.searchParams.get('sslmode'), sslaccept: url.searchParams.get('sslaccept') });
  }
}
fs.writeFileSync(path.join(__dirname, 'tls-config-2026-11-16.json'), JSON.stringify(result, null, 2) + '\n');
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const { PrismaClient } = require('@prisma/client');
(async () => {
  const probes = [];
  for (const sslaccept of ['accept_invalid_certs', 'strict']) {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('sslmode', 'require'); url.searchParams.set('sslaccept', sslaccept);
    const db = new PrismaClient({ log: [], datasources: { db: { url: url.toString() } } });
    try { await db.$queryRaw`SELECT 1`; probes.push({ sslmode: 'require', sslaccept, connected: true }); }
    catch (e) { probes.push({ sslmode: 'require', sslaccept, connected: false, error: e.code || e.name,
      reason: /self.signed/i.test(e.message) ? 'SELF_SIGNED_CERTIFICATE_CHAIN' : /certificate/i.test(e.message) ? 'CERTIFICATE_ERROR' : /TLS|SSL/.test(e.message) ? 'TLS_ERROR' : /reach database/.test(e.message) ? 'DATABASE_UNREACHABLE' : 'UNCLASSIFIED' }); }
    finally { await db.$disconnect(); }
  }
  const report = { localConfiguration: result, probes };
  fs.writeFileSync(path.join(__dirname, 'tls-config-2026-11-16.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e.name); process.exitCode = 1; });
