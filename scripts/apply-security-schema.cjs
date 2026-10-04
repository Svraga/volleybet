// Explicit additive upgrade, not the historical SQLite migrations.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL database required');
  const statements = fs.readFileSync(path.join(__dirname, '../prisma/security-upgrade.sql'), 'utf8')
    .replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
  // This file is one DO statement; do not split its PL/pgSQL body on semicolons.
  const accessSql = fs.readFileSync(path.join(__dirname, '../prisma/security-supabase.sql'), 'utf8');
  await prisma.$transaction(async tx => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement); // fixed repo SQL, no user input
    await tx.$executeRawUnsafe(accessSql);
  });
  let rotated = 0;
  // Repeat runs preserve already secure codes.
  const leagues = await prisma.league.findMany({ select: { id: true, inviteCode: true } });
  for (const league of leagues) {
    if (/^VOLLEY-[0-9A-F]{32}$/.test(league.inviteCode)) continue;
    const result = await prisma.league.updateMany({
      where: { id: league.id, inviteCode: league.inviteCode },
      data: { inviteCode: 'VOLLEY-' + randomBytes(16).toString('hex').toUpperCase() }
    });
    rotated += result.count;
  }
  console.log('Additive security upgrade applied. Legacy invitations rotated:', rotated);
}
main().catch(() => { console.error('Security schema upgrade failed. Check database access and PostgreSQL configuration.'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
