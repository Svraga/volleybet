const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const audit = readJson(path.join(__dirname, 'npm-audit.json'));
const lock = readJson(path.join(root, 'package-lock.json'));
if (!audit.vulnerabilities) throw new Error('npm audit did not return a vulnerability report');
const lines = ['# Inventario dipendenze segnalate da npm audit', '',
  'Data di riferimento: 4 ottobre 2026. Le gravità sono quelle del registro npm, non una valutazione della sfruttabilità di VolleyBet.', '',
  'I pacchetti dipendenti da un pacchetto vulnerabile sono conteggiati da npm separatamente. Il totale non equivale al numero di bug remoti confermati.', '',
  '| Pacchetto | Versioni installate | Gravità npm | Percorso nel lockfile |',
  '| --- | --- | --- | --- |'];
for (const v of Object.values(audit.vulnerabilities)) {
  const versions = [...new Set(v.nodes.map(n => readJson(path.join(root, n, 'package.json')).version))].join(', ');
  const classification = [...new Set(v.nodes.map(n => lock.packages[n]?.dev ? 'dev' : 'prod/optional'))].join(', ');
  lines.push(`| ${v.name} | ${versions} | ${v.severity} | ${classification} |`);
}
lines.push('', '## Avvisi distinti', '');
const seen = new Set();
for (const v of Object.values(audit.vulnerabilities)) {
  for (const advisory of v.via) {
    if (typeof advisory === 'string' || seen.has(advisory.url)) continue;
    seen.add(advisory.url);
    lines.push(`- **${advisory.name} (${advisory.severity})**: [${advisory.title}](${advisory.url}). Intervallo: \`${advisory.range}\`.`);
  }
}
lines.push('', `Totale: ${audit.metadata.vulnerabilities.total} pacchetti segnalati, ${seen.size} avvisi distinti.`, '',
  'La classificazione dev/prod deriva dal lockfile locale. Alcuni strumenti di build sono distribuiti con next e risultano prod pur non essendo chiamabili da una richiesta applicativa. Consultare SECURITY-AUDIT.md per l’applicabilità.', '');
fs.writeFileSync(path.join(__dirname, 'dependency-findings.md'), lines.join('\n'));

const dotenv = require('dotenv');
const environment = [];
for (const name of ['.env', '.env.local', '.env.example']) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  const values = dotenv.parse(fs.readFileSync(file));
  const checks = { file: name, keys: Object.keys(values).sort() };
  if ('NEXTAUTH_SECRET' in values) {
    checks.authSecretPresent = Boolean(values.NEXTAUTH_SECRET);
    checks.authSecretAtLeast32Characters = values.NEXTAUTH_SECRET.length >= 32;
    checks.authSecretLooksLikePlaceholder = /changeme|your.?secret|replace.?me|example|^test$|^secret$/i.test(values.NEXTAUTH_SECRET);
  }
  if ('NEXTAUTH_URL' in values) {
    try { const u = new URL(values.NEXTAUTH_URL); checks.authUrlUsesHttps = u.protocol === 'https:';
      checks.authUrlIsLocalhost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname); }
    catch { checks.authUrlValid = false; }
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    if (!(key in values)) continue;
    try { const u = new URL(values[key]); checks[`${key}_usesPostgres`] = ['postgres:', 'postgresql:'].includes(u.protocol);
      checks[`${key}_explicitTlsSetting`] = u.searchParams.get('sslmode') || '(unset)'; }
    catch { checks[`${key}_parseable`] = false; }
  }
  environment.push(checks);
}
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const secretPattern = /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|GOCSPX-[A-Za-z0-9_-]+|postgres(?:ql)?:\/\/[^\s"']+/;
const secretFileHits = trackedFiles.filter(file => {
  const absolute = path.join(root, file);
  return fs.existsSync(absolute) && secretPattern.test(fs.readFileSync(absolute, 'utf8'));
});
const commitsWithEnvFiles = execFileSync('git', ['log', '--all', '--format=%h', '--', '.env', '.env.local', 'dev.db'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const output = { environment, trackedSensitiveFiles: trackedFiles.filter(f => /^\.env(?:\.|$)|\.db$/.test(f)),
  trackedFilesMatchingCommonSecretPatterns: secretFileHits, commitsWithEnvOrDatabaseFiles: commitsWithEnvFiles,
  caveat: 'Heuristic worktree scan and selected file history; not a full secret scan of every historical blob. No secret values recorded.' };
fs.writeFileSync(path.join(__dirname, 'environment-checks.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ packagesFlagged: audit.metadata.vulnerabilities, distinctAdvisories: seen.size, environmentChecks: output }, null, 2));
