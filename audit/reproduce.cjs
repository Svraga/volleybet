// Current security verification. Original results are preserved in reproduction-results.json.
const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, ['--test', require('node:path').join(__dirname, '../tests/security.test.cjs')], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
