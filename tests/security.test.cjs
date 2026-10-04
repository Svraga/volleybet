/* Production functions with an isolated Prisma substitute. Never reads env files or connects to a DB.
 * The queued transactions model the league lock schedule; PostgreSQL locking still requires integration verification.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const clone = value => structuredClone(value);
const test = require('node:test');
const redirectError = Object.assign(new Error('mock redirect'), { redirect: true });

function load(file, world) {
  const module = { exports: {} };
  const mocks = {
    '@/lib/prisma': { prisma: world.db },
    '@/lib/auth': { authOptions: {} },
    'next-auth': { getServerSession: async () => {
      world.sessionCalls++;
      return world.actor ? { user: { id: world.actor } } : null;
    } },
    '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable', ReadCommitted: 'ReadCommitted' } } },
    'next/navigation': { redirect: () => { throw redirectError; } },
    'next/cache': { revalidatePath: () => {} },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
  };
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const compiled = ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  } }).outputText;
  const context = {
    module, exports: module.exports, console, Date: world.Clock || Date, FormData,
    // Skip only the anti-bruteforce delay; production uses a real 2-second timer.
    setTimeout: fn => { fn(); return 0; },
    require: name => {
      if (mocks[name]) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/lib/')) return load('src/lib/' + name.split('/').at(-1) + '.ts', world);
      if (name.startsWith('@/actions/')) return load(`src/actions/${name.split('/').at(-1)}.ts`, world);
      if (name.startsWith('@/components/')) {
        const label = name.split('/').at(-1);
        return new Proxy({ __esModule: true, default: label }, { get: (target, key) => target[key] ?? String(key) });
      }
      if (name === 'next/link') return { __esModule: true, default: 'Link' };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
      if (name === 'crypto' || name === 'node:crypto') return require('node:crypto');
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(compiled, context, { filename: file });
  return module.exports;
}

function world() {
  const w = {
    actor: 'player', sessionCalls: 0, bets: [], ledgers: [], logs: [], notifications: [],
    team: 'A', nextId: 0, beforeTransaction: null, beforeMatchdayRead: null,
    league: { id: 'league', adminId: 'admin', name: 'Test', homeTeam: 'A', coinName: 'Coin',
      inviteCode: 'VOLLEY-' + '1'.repeat(32), teams: ['A', 'B', 'C', 'D'].map(name => ({ name })) },
    md: { id: 'day', leagueId: 'league', number: 1, status: 'OPEN',
      deadline: new Date(Date.now() + 3600000), restingTeam: null },
    matches: [{ id: 'm1', matchDayId: 'day', teamA: 'A', teamB: 'B' },
      { id: 'm2', matchDayId: 'day', teamA: 'C', teamB: 'D' }],
  };
  const matchSnapshot = () => clone({ ...w.md, matches: w.matches.map(m => ({ ...m,
    bets: w.bets.filter(b => b.matchId === m.id).map(b => ({ ...b, user: { id: b.userId, name: b.userId } })),
  })) });
  const add = (list, data) => {
    const row = { id: `record-${++w.nextId}`, ...clone(data) };
    list.push(row); return clone(row);
  };
  const matchWhere = (row, where) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object') {
      if ('lt' in value) return row[key] < value.lt;
      if ('gt' in value) return row[key] > value.gt;
      if ('contains' in value) return String(row[key]).includes(value.contains);
      if ('in' in value) return value.in.includes(row[key]);
    }
    return row[key] === value;
  });
  w.db = {
    league: {
      findUnique: async ({ where }) => {
        if (where.id && where.id !== w.league.id) return null;
        if (where.inviteCode && where.inviteCode !== w.league.inviteCode) return null;
        return clone(w.league);
      }, update: async () => clone(w.league),
    },
    user: {
      findUnique: async ({ where }) => ({ id: where.id, name: where.id,
        leagues: [clone(w.league)] }),
      findMany: async () => ['admin', 'player'].map(id => ({ id, name: id,
        email: `${id}@example.invalid`, emailVerified: new Date(), image: null,
        memberships: [{ teamName: w.team }], ledgers: clone(w.ledgers.filter(l => l.userId === id)),
        bets: clone(w.bets.filter(b => b.userId === id)) })),
    },
    leagueMember: {
      findUnique: async () => ({ teamName: w.team }),
      upsert: async ({ update }) => { w.team = update.teamName; return { teamName: w.team }; },
    },
    matchDay: {
      findUnique: async () => {
        const snapshot = matchSnapshot();
        if (w.beforeMatchdayRead) await w.beforeMatchdayRead();
        return snapshot;
      },
      findMany: async () => [matchSnapshot()],
      update: async ({ data }) => { Object.assign(w.md, clone(data)); return clone(w.md); },
    },
    match: {
      findMany: async () => clone(w.matches),
      update: async ({ where, data }) => Object.assign(w.matches.find(m => m.id === where.id), clone(data)),
      deleteMany: async () => { w.matches = []; },
      createMany: async ({ data }) => { w.matches.push(...data.map(d => ({ id: `m-${++w.nextId}`, ...d }))); },
    },
    bet: {
      upsert: async ({ where, update, create }) => {
        const existing = w.bets.find(b => b.userId === where.userId_matchId.userId && b.matchId === where.userId_matchId.matchId);
        if (existing) return Object.assign(existing, clone(update));
        return add(w.bets, create);
      },
      update: async ({ where, data }) => Object.assign(w.bets.find(b => b.id === where.id), clone(data)),
      deleteMany: async ({ where }) => { w.bets = w.bets.filter(b => !matchWhere(b, where)); },
    },
    ledger: {
      findFirst: async ({ where }) => clone(w.ledgers.find(l => matchWhere(l, where)) ?? null),
      findMany: async ({ where }) => clone(w.ledgers.filter(l => matchWhere(l, where))),
      create: async ({ data }) => add(w.ledgers, data),
      deleteMany: async ({ where }) => { w.ledgers = w.ledgers.filter(l => !matchWhere(l, where)); },
    },
    auditLog: { create: async ({ data }) => add(w.logs, data) },
    notification: {
      create: async ({ data }) => add(w.notifications, data),
      createMany: async ({ data }) => data.forEach(d => add(w.notifications, d)),
    },
    team: { findMany: async () => clone(w.league.teams) },
    $transaction: async fn => {
      if (w.beforeTransaction) await w.beforeTransaction();
      return fn(w.db);
    },
  };
  hardenWorld(w, clone, matchSnapshot, add, matchWhere);
  return w;
}

const form = entries => {
  const f = new FormData();
  for (const [key, value] of Object.entries(entries)) f.set(key, value);
  return f;
};
async function call(fn, ...args) {
  try { return await fn(...args); } catch (e) { if (!e.redirect) throw e; }
}

function hardenWorld(w, clone, snapshot, add, matchWhere) {
  w.active = new Set(['admin', 'player']);
  w.memberships = new Map([['player', 'A'], ['admin', 'A']]);
  w.events = [];
  w.rate = new Map();
  w.db.league.updateMany = async ({ where }) => {
    w.events.push('lock');
    if (w.beforeLock) { const hook = w.beforeLock; w.beforeLock = null; await hook(); }
    return { count: where.id === w.league.id ? 1 : 0 };
  };
  w.db.league.findFirst = async ({ where }) => where.id === w.league.id && w.active.has(where.users.some.id) ? clone(w.league) : null;
  w.db.league.update = async ({ data }) => {
    if (data.users?.connect) w.active.add(data.users.connect.id);
    else Object.assign(w.league, clone(data));
    return clone(w.league);
  };
  w.db.user.findFirst = async ({ where }) => w.active.has(where.id) ? { id: where.id, name: where.id } : null;
  w.db.user.update = async ({ where, data }) => { if (data.leagues?.disconnect) w.active.delete(where.id); return { id: where.id }; };
  w.db.leagueMember.findUnique = async ({ where }) => w.memberships.has(where.userId_leagueId.userId) ? { teamName: w.memberships.get(where.userId_leagueId.userId) } : null;
  w.db.leagueMember.create = async ({ data }) => { w.memberships.set(data.userId, data.teamName); return data; };
  w.db.team.findFirst = async ({ where }) => w.league.teams.find(t => t.name === where.name) ?? null;
  const readDay = async ({ where }) => {
    w.events.push('day-read');
    if (where.id && where.id !== w.md.id || where.leagueId && where.leagueId !== w.md.leagueId || where.number && where.number !== w.md.number) return null;
    return snapshot();
  };
  w.db.matchDay.findFirst = readDay;
  w.db.matchDay.findUnique = readDay;
  w.db.matchDay.count = async () => 1;
  w.db.matchDay.create = async ({ data }) => { w.createdDay = data; return data; };
  w.db.matchDay.delete = async () => { w.deletedDay = true; };
  w.db.match.count = async ({ where }) => w.matches.filter(m => (!where.matchDayId || m.matchDayId === where.matchDayId) && (!where.OR || where.OR.some(cond => matchWhere(m, cond)))).length;
  w.db.match.create = async ({ data }) => add(w.matches, data);
  w.db.bet.create = async ({ data }) => add(w.bets, data);
  w.db.bet.count = async ({ where }) => w.bets.filter(b => {
    if (where.userId && b.userId !== where.userId) return false;
    const match = w.matches.find(m => m.id === b.matchId);
    return !where.match || match && (!where.match.matchDayId || match.matchDayId === where.match.matchDayId) && (!where.match.matchDay?.leagueId || where.match.matchDay.leagueId === w.md.leagueId);
  }).length;
  w.db.ledger.count = async ({ where }) => w.ledgers.filter(l => matchWhere(l, where)).length;
  w.db.$queryRaw = async (_, key, expiresAt, now, limit) => {
    const old = w.rate.get(key);
    const record = old && old.expiresAt > now ? { attempts: Math.min(old.attempts + 1, limit), expiresAt: old.expiresAt } : { attempts: 1, expiresAt };
    w.rate.set(key, record); return [{ attempts: record.attempts }];
  };
  let queue = Promise.resolve();
  w.db.$transaction = (fn, options) => {
    const run = queue.then(async () => {
      const backup = clone({ bets: w.bets, ledgers: w.ledgers, md: w.md, matches: w.matches, league: w.league, logs: w.logs, notifications: w.notifications, active: w.active, memberships: w.memberships });
      try {
        if (w.beforeTransaction) { const hook = w.beforeTransaction; w.beforeTransaction = null; await hook(); }
        assert.equal(options?.isolationLevel, 'ReadCommitted');
        return await fn(w.db);
      } catch (e) { Object.assign(w, backup); throw e; }
    });
    queue = run.catch(() => {});
    return run;
  };
}

const matchesForm = () => form({ numRows: '2', teamA_0: 'A', teamB_0: 'B', teamA_1: 'C', teamB_1: 'D' });
const resultsForm = () => form({ result_m1: '3-0', result_m2: '3-0' });
const positiveTotal = w => w.ledgers.filter(l => l.amount > 0).reduce((sum, l) => sum + l.amount, 0);
function seedScoring(w) {
  w.actor = 'admin'; w.md.deadline = new Date(Date.now() - 1000);
  w.bets.push({ id: 'b1', userId: 'player', matchId: 'm2', predictedA: 3, predictedB: 0 });
  w.ledgers.push({ userId: 'player', leagueId: 'league', matchDayId: 'day', amount: -1, reason: 'Entry Fee' });
}

test('S04: rejects huge, nonfinite and malformed match counts before entering a transaction', async () => {
  for (const input of ['9'.repeat(400), 'Infinity', '2x', '-1', '0', '33']) {
    const w = world(); w.actor = 'admin';
    await assert.rejects(() => load('src/actions/matchday.ts', w).setMatches('league', 'day', form({ numRows: input })));
    assert.equal(w.events.length, 0);
  }
});
test('match configuration accepts bounded valid input and rejects unknown or duplicate teams', async () => {
  const w = world(); w.actor = 'admin';
  await call(load('src/actions/matchday.ts', w).setMatches, 'league', 'day', matchesForm());
  assert.equal(w.matches.length, 2);
  for (const team of ['C', 'Unknown']) {
    const f = matchesForm(); f.set('teamB_0', team);
    await assert.rejects(() => load('src/actions/matchday.ts', w).setMatches('league', 'day', f));
    assert.equal(w.matches.length, 2);
  }
});
test('S05: existing membership cannot change team, including after leave and rejoin', async () => {
  const w = world(), actions = load('src/actions/league.ts', w);
  const joining = teamName => form({ inviteCode: w.league.inviteCode, teamName });
  await assert.rejects(() => actions.joinLeague(null, joining('C')), /squadra/);
  await call(actions.leaveLeague, 'league');
  assert.equal(w.active.has('player'), false);
  assert.equal(w.memberships.get('player'), 'A');
  await assert.rejects(() => actions.joinLeague(null, joining('C')), /squadra/);
  await call(actions.joinLeague, null, joining('A'));
  assert.equal(w.active.has('player'), true);
});
test('S05: own-team bets and rejoining without a recoverable historical team are rejected', async () => {
  const w = world();
  await assert.rejects(() => load('src/lib/betting.ts', w).saveBets('player', 'league', 'day', form({ bet_m1: '3-0' })), /squadra/);
  w.memberships.delete('player'); w.active.delete('player');
  w.ledgers.push({ userId: 'player', leagueId: 'league', amount: -1 });
  await assert.rejects(() => load('src/actions/league.ts', w).joinLeague(null, form({ inviteCode: w.league.inviteCode, teamName: 'C' })), /storica/);
});
test('S06: concurrent scoring and rescore replace payouts without duplicating money', async () => {
  const w = world(); seedScoring(w);
  const score = load('src/actions/score.ts', w).scoreMatchDay;
  await Promise.all([call(score, 'league', 'day', resultsForm()), call(score, 'league', 'day', resultsForm())]);
  assert.equal(positiveTotal(w), 1); assert.equal(w.bets[0].pointsEarned, 3);
  assert.deepEqual(w.events, ['lock', 'day-read', 'lock', 'day-read']);
  const f = resultsForm(); f.set('result_m2', '0-3');
  await call(score, 'league', 'day', f);
  assert.equal(positiveTotal(w), 1); assert.equal(w.bets[0].pointsEarned, 0);
});
test('S07: betting observes scoring, membership and deadline changes after acquiring the lock', async () => {
  for (const mutate of [w => { w.md.status = 'SCORED'; }, w => { w.md.deadline = new Date(0); }, w => { w.active.delete('player'); }]) {
    const w = world(); w.beforeLock = () => mutate(w);
    await assert.rejects(() => load('src/lib/betting.ts', w).saveBets('player', 'league', 'day', form({ bet_m2: '3-0' })));
    assert.equal(w.bets.length, 0); assert.equal(w.ledgers.length, 0);
  }
});
test('S07: a deadline crossed during save rolls back both bet and fee', async () => {
  const w = world(); w.now = Date.now(); w.md.deadline = new Date(w.now + 1000);
  w.Clock = class extends Date { static now() { return w.now; } };
  const create = w.db.ledger.create;
  w.db.ledger.create = async args => { w.now += 2000; return create(args); };
  await assert.rejects(() => load('src/lib/betting.ts', w).saveBets('player', 'league', 'day', form({ bet_m2: '3-0' })));
  assert.equal(w.bets.length, 0); assert.equal(w.ledgers.length, 0);
});
test('S08: an expired, closed or scored day cannot be reopened or deleted', async () => {
  for (const status of ['OPEN', 'CLOSED', 'SCORED']) {
    const w = world(); w.actor = 'admin'; w.md.status = status; w.md.deadline = new Date(0);
    const actions = load('src/actions/matchday.ts', w);
    await assert.rejects(() => actions.updateDeadline('league', 'day', form({ deadline: new Date(Date.now() + 3600000).toISOString() })));
    await assert.rejects(() => actions.deleteMatchDay('league', 'day'));
    assert.equal(w.md.deadline.getTime(), 0); assert.equal(w.deletedDay, undefined);
  }
});
test('scoring before the deadline and scoring by a nonadmin fail without modifying ledgers', async () => {
  const w = world(); w.actor = 'admin';
  await assert.rejects(() => load('src/actions/score.ts', w).scoreMatchDay('league', 'day', resultsForm()), /scadenza/);
  w.actor = 'player'; w.md.deadline = new Date(0);
  await assert.rejects(() => load('src/actions/score.ts', w).scoreMatchDay('league', 'day', resultsForm()), /Unauthorized/);
  assert.equal(w.ledgers.length, 0);
});
test('S10: admin proxy cannot overwrite an existing personal prediction', async () => {
  const w = world(); w.actor = 'admin'; w.bets.push({ userId: 'player', matchId: 'm2', predictedA: 0, predictedB: 3 });
  await assert.rejects(() => load('src/lib/betting.ts', w).saveBets('admin', 'league', 'day', form({ userId: 'player', bet_m2: '3-0' }), true));
  assert.equal(w.bets[0].predictedA, 0); assert.equal(w.ledgers.length, 0);
});
test('S11: concurrent proxy and personal bets charge a single entry fee', async () => {
  const w = world(), save = load('src/lib/betting.ts', w).saveBets;
  await Promise.all([save('admin', 'league', 'day', form({ userId: 'player', bet_m2: '3-0' }), true), save('player', 'league', 'day', form({ bet_m2: '3-1' }))]);
  assert.equal(w.bets.length, 1); assert.equal(w.bets[0].predictedB, 1);
  assert.equal(w.ledgers.length, 1); assert.equal(w.ledgers[0].amount, -1);
});
test('S11: historical proxy fees are recognized regardless of reason text', async () => {
  const w = world(); w.ledgers.push({ userId: 'player', leagueId: 'league', matchDayId: 'day', amount: -1, reason: 'MatchDay 1 Entry Fee (Proxy)' });
  await load('src/lib/betting.ts', w).saveBets('player', 'league', 'day', form({ bet_m2: '3-0' }));
  assert.equal(w.ledgers.length, 1);
});
test('S12: match replacement is rejected after a prediction or historical fee', async () => {
  for (const seed of [w => w.bets.push({ userId: 'player', matchId: 'm2' }), w => w.ledgers.push({ leagueId: 'league', matchDayId: 'day', amount: -1 })]) {
    const w = world(); w.actor = 'admin'; seed(w);
    await assert.rejects(() => load('src/actions/matchday.ts', w).setMatches('league', 'day', matchesForm()));
    assert.equal(w.matches[0].id, 'm1');
  }
});
test('legacy fees without predictions and zero-score duplicated fees are refunded exactly once', async () => {
  const w = world(); seedScoring(w); w.bets[0].predictedA = 0; w.bets[0].predictedB = 3;
  w.ledgers.push({ userId: 'player', leagueId: 'league', matchDayId: 'day', amount: -1 });
  w.ledgers.push({ userId: 'admin', leagueId: 'league', matchDayId: 'day', amount: -1 });
  const score = load('src/actions/score.ts', w).scoreMatchDay;
  await call(score, 'league', 'day', resultsForm()); await call(score, 'league', 'day', resultsForm());
  assert.equal(positiveTotal(w), 3);
  assert.equal(w.ledgers.filter(l => l.userId === 'player' && l.amount > 0)[0].amount, 2);
});
test('S13: invitation preview requires authentication and enforces a durable per-user limit', async () => {
  const w = world(), actions = load('src/actions/league.ts', w);
  w.actor = null; await assert.rejects(() => actions.getLeaguePreview(w.league.inviteCode), /authenticated/);
  w.actor = 'player';
  for (let i = 0; i < 10; i++) assert.equal((await actions.getLeaguePreview(w.league.inviteCode)).id, 'league');
  await assert.rejects(() => actions.getLeaguePreview(w.league.inviteCode), /Troppi/);
});
test('S13: invite rotation is admin-only and invalidates the previous capability', async () => {
  const w = world(), actions = load('src/actions/league.ts', w), oldCode = w.league.inviteCode;
  await assert.rejects(() => actions.rotateInviteCode('league'), /Unauthorized/);
  w.actor = 'admin'; await actions.rotateInviteCode('league');
  assert.match(w.league.inviteCode, /^VOLLEY-[0-9A-F]{32}$/); assert.notEqual(w.league.inviteCode, oldCode);
  assert.ok((await actions.getLeaguePreview(oldCode)).error);
});
test('R01: direct stats and betting page calls reject an outsider before reading league data', async () => {
  for (const file of ['src/app/league/[id]/stats/page.tsx', 'src/app/league/[id]/matchday/[matchdayId]/page.tsx']) {
    const w = world(); w.actor = 'outsider'; let leaked = false;
    w.db.user.findMany = async () => { leaked = true; return []; };
    w.db.matchDay.findUnique = async () => { leaked = true; return null; };
    await assert.rejects(() => load(file, w).default({ params: Promise.resolve({ id: 'league', matchdayId: 'day' }), searchParams: Promise.resolve({}) }), /403/);
    assert.equal(leaked, false);
  }
});
test('S09/S14: admin client props contain neither prediction values nor private user fields', async () => {
  const w = world(); w.actor = 'admin'; w.bets.push({ userId: 'player', matchId: 'm2', predictedA: 3, predictedB: 1 });
  const tree = await load('src/app/league/[id]/admin/page.tsx', w).default({ params: Promise.resolve({ id: 'league' }) });
  const panels = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'AdminMatchdayPanel') panels.push(node);
    for (const val of Object.values(node)) if (Array.isArray(val)) val.forEach(walk); else if (val && typeof val === 'object') walk(val);
  }
  walk(tree); assert.equal(panels.length, 1);
  for (const user of panels[0].props.users) assert.deepEqual(Object.keys(user).sort(), ['hasBets', 'id', 'name', 'teamName']);
  assert.equal(panels[0].props.users.find(u => u.id === 'player').hasBets, true);
});
test('S16: payout test entrypoint contains no database connection or destructive operations', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/test-payouts.ts'), 'utf8');
  assert.equal(source.includes('PrismaClient'), false); assert.equal(source.includes('deleteMany'), false);
  assert.ok(source.includes('tests/security.test.cjs'));
});
test('S17: development MCP is explicitly disabled and action bodies are bounded', () => {
  const config = load('next.config.ts', world()).default;
  assert.equal(config.experimental.mcpServer, false);
  assert.equal(config.experimental.serverActions.bodySizeLimit, '64kb');
});
test('braces mitigation preserves normal globs and rejects nested strings and supplied ASTs', () => {
  for (const name of ['braces', '../vendor/braces']) {
    const braces = require(name);
    assert.deepEqual(braces.expand('src/{app,lib}/*.ts'), ['src/app/*.ts', 'src/lib/*.ts']);
    assert.equal(braces.compile('a/{b,c}'), 'a/(b|c)');
    for (const pattern of ['{'.repeat(4000) + 'a,b' + '}'.repeat(4000), '('.repeat(4000) + 'a' + ')'.repeat(4000)]) {
      assert.throws(() => braces.compile(pattern), /nesting limit/);
      assert.throws(() => braces.expand(pattern), /nesting limit/);
      assert.throws(() => braces.parse(pattern), /nesting limit/);
    }
    let ast = { type: 'text', value: 'a' };
    for (let i = 0; i < 100; i++) ast = { type: 'brace', nodes: [ast] };
    for (const method of ['compile', 'expand', 'stringify']) assert.throws(() => braces[method](ast), /complexity limit/);
    const cyclic = { nodes: [] }; cyclic.nodes.push(cyclic);
    assert.throws(() => braces.compile(cyclic), /complexity limit/);
    const wide = { nodes: Array.from({ length: 300 }, () => ({ nodes: Array(300).fill(null) })) };
    assert.throws(() => braces.compile(wide), /complexity limit/);
  }
});

test('S15: malformed percent-encoded Bearer tokens fail closed without an uncaught URIError', async () => {
  const { getToken } = require('next-auth/jwt');
  const result = await getToken({ req: { headers: { authorization: 'Bearer %' }, cookies: {} }, secret: 'isolated-security-test-secret' });
  assert.equal(result, null);
});
