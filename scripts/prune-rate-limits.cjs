require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('sslmode', 'require'); url.searchParams.set('sslaccept', 'strict');
url.searchParams.set('sslcert', path.resolve('prisma/certs/database-ca.pem'));
const db = new PrismaClient({ log: [], datasources: { db: { url: url.toString() } } });
db.securityRateLimit.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 86400000) } } })
  .then(result => console.log('Expired abuse-limit counters removed:', result.count))
  .catch(e => { console.error(e.code || e.name); process.exitCode = 1; }).finally(() => db.$disconnect());
