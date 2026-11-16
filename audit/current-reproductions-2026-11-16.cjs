// Reuse only the isolated loader/fixtures from the existing tests. No live DB.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const file = path.resolve(__dirname, '../tests/security.test.cjs');
const helper = new Module(file, module);
helper.filename = file;
helper.paths = Module._nodeModulePaths(path.dirname(file));
const source = fs.readFileSync(file, 'utf8');
helper._compile(source.slice(0, source.indexOf('\ntest(')) + '\nmodule.exports = { load, world, form, call };', file);
const { load, world, form } = helper.exports;
const results = [];
async function main() {
  {
    const w = world(); w.actor = 'admin'; w.md.deadline = new Date(0);
    w.matches.push({ id: 'm3', matchDayId: 'day', teamA: 'E', teamB: 'F' });
    const save = load('src/lib/betting.ts', w).saveBets;
    await save('admin', 'league', 'day', form({ userId: 'player', bet_m2: '3-0' }), true);
    assert.equal(w.bets.length, 1);
    await assert.rejects(() => save('admin', 'league', 'day', form({ userId: 'player', bet_m3: '3-0' }), true), /già inserito/);
    await assert.rejects(() => save('player', 'league', 'day', form({ bet_m3: '3-0' })), /chiuse/);
    results.push({ id: 'A01', reproduced: true, partialProxySaved: true, missingEligibleMatches: 1, cannotCompleteAfterDeadline: true });
  }
  {
    const w = world(); let writes = 0;
    w.db.user.update = async ({ data }) => { writes++; return data; };
    const update = load('src/actions/user.ts', w).updateNickname;
    for (let i = 0; i < 100; i++) await update(form({ nickname: 'Nickname' }));
    assert.equal(writes, 100); assert.equal(w.rate.size, 0);
    const f = new FormData(); f.set('nickname', new Blob(['name']), 'nickname.txt');
    await assert.rejects(() => update(f), /trim is not a function/);
    results.push({ id: 'A02', reproduced: true, unrestrictedWrites: writes, durableRateLimitsUsed: w.rate.size, fileInputThrowsTypeError: true });
  }
  {
    const w = world(); const f = form({ inviteCode: 'VOLLEY-' + '1'.repeat(32), teamName: 'NOT_A_TEAM' });
    await assert.rejects(() => load('src/actions/league.ts', w).joinLeague(null, f), /squadra non appartiene/);
    results.push({ id: 'B01', reproduced: true, expectedFormErrorThrowsInsteadOfReturningState: true });
  }
  {
    const w = world(); w.matches = [w.matches[0]];
    await assert.rejects(() => load('src/lib/betting.ts', w).saveBets('player', 'league', 'day', form({})), /Nessun pronostico/);
    results.push({ id: 'B02', reproduced: true, twoTeamLeagueHasNoEligiblePredictionsForMembers: true });
  }
  {
    const w = world(); w.actor = 'outsider'; let locks = 0;
    w.db.league.updateMany = async () => { locks++; return { count: 1 }; };
    await assert.rejects(() => load('src/lib/security.ts', w).withLeagueTransaction('league', 'outsider', 'admin', async () => {}), /Unauthorized/);
    assert.equal(locks, 1);
    results.push({ id: 'A03', reproduced: true, leagueWriteLockAcquiredBeforeAuthorization: true, denialOfServiceLoadNotAttempted: true });
  }
  {
    const input = new Date('2026-11-16T20:00:00Z');
    const utc = input.toLocaleString('it-IT', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' });
    const rome = input.toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });
    assert.notEqual(utc, rome);
    results.push({ id: 'B03', reproduced: true, serverUtc: utc, intendedRome: rome });
  }
  {
    const w = world();
    w.modules = { 'react-dom': { useFormStatus: () => ({ pending: true }) } };
    const button = load('src/components/SubmitButton.tsx', w).default({ defaultText: 'Save', disabled: false });
    assert.equal(button.props.disabled, false);
    results.push({ id: 'B04', reproduced: true, explicitDisabledFalseOverridesPendingState: true });
  }
  {
    const w = world();
    w.modules = { 'next/headers': { cookies: async () => ({ get: () => undefined }) } };
    w.db.user.findUnique = async () => ({ id: 'player', name: 'Player', leagues: [], memberships: [], ledgers: [], bets: [{ pointsEarned: 3 }, { pointsEarned: null }] });
    const tree = await load('src/app/profile/page.tsx', w).default();
    function text(node) {
      if (node == null || typeof node === 'boolean') return '';
      if (typeof node !== 'object') return String(node);
      if (Array.isArray(node)) return node.map(text).join('');
      return text(node.props?.children);
    }
    assert.ok(text(tree).includes('1/2 (50%)'));
    results.push({ id: 'B05', reproduced: true, oneCorrectAndOnePendingDisplayedAccuracy: '50%', accuracyAmongSettledBets: '100%' });
  }
  fs.writeFileSync(path.join(__dirname, 'reproductions-2026-11-16.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
