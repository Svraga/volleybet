// Historical harness: needs the pre-fix source and dependency versions.
if (require.main === module) throw new Error('Historical harness: use npm run test:security for the current code.');
/* Isolated security reproductions. No database, .env files, HTTP traffic or app edits.
 * Runs the actual TypeScript functions with an in-memory Prisma substitute.
 * Transaction tests model an explicitly serial schedule, not PostgreSQL internals.
 * Execute from the repository root: node audit/reproduce.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const clone = value => structuredClone(value);
const results = [];
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
    '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } } },
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
    module, exports: module.exports, console, Date, FormData,
    // Skip only the anti-bruteforce delay; production uses a real 2-second timer.
    setTimeout: fn => { fn(); return 0; },
    require: name => {
      if (mocks[name]) return mocks[name];
      if (name === '@/lib/volleyball') return load('src/lib/volleyball.ts', world);
      if (name.startsWith('@/actions/')) return load(`src/actions/${name.split('/').at(-1)}.ts`, world);
      if (name.startsWith('@/components/')) {
        const label = name.split('/').at(-1);
        return new Proxy({ __esModule: true, default: label }, { get: (target, key) => target[key] ?? String(key) });
      }
      if (name === 'next/link') return { __esModule: true, default: 'Link' };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
      if (name === 'crypto') return require('node:crypto');
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
      inviteCode: 'VOLLEY-12345678', teams: ['A', 'B', 'C', 'D'].map(name => ({ name })) },
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
async function check(name, fn) {
  await fn(); results.push({ name, reproduced: true }); console.log(`REPRODUCED: ${name}`);
}
function collect(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (Array.isArray(node)) { for (const child of node) collect(child, predicate, found); return found; }
  if (predicate(node)) found.push(node);
  if (node.props) collect(node.props.children, predicate, found);
  return found;
}

async function main() {
  await check('Team switching retains bets and bypasses own-team restriction', async () => {
    const w = world();
    const { placeBets } = load('src/actions/bet.ts', w);
    const { joinLeague } = load('src/actions/league.ts', w);
    await call(placeBets, 'league', 'day', form({ bet_m2: '3-0' }));
    await call(joinLeague, null, form({ inviteCode: w.league.inviteCode, teamName: 'C' }));
    await call(placeBets, 'league', 'day', form({ bet_m1: '3-0' }));
    assert.equal(w.bets.length, 2);
    assert.equal(w.ledgers.length, 1);
  });
  await check('Proxy bet followed by personal submission charges two entry fees', async () => {
    const w = world(); w.actor = 'admin';
    await call(load('src/actions/proxyBet.ts', w).proxyPlaceBets, 'league', 'day', form({ userId: 'player', bet_m2: '3-0' }));
    w.actor = 'player';
    await call(load('src/actions/bet.ts', w).placeBets, 'league', 'day', form({ bet_m2: '3-1' }));
    assert.equal(w.ledgers.reduce((sum, row) => sum + row.amount, 0), -2);
  });
  await check('Two stale OPEN reads followed by serial scoring transactions duplicate payouts', async () => {
    const w = world(); w.actor = 'admin'; w.matches = [w.matches[1]];
    w.bets = [{ id: 'b1', userId: 'player', matchId: 'm2', predictedA: 3, predictedB: 0 }];
    w.ledgers = [{ id: 'fee', userId: 'player', leagueId: 'league', matchDayId: 'day', amount: -1, reason: 'Entry Fee' }];
    let reads = 0, release;
    const bothRead = new Promise(resolve => { release = resolve; });
    w.beforeMatchdayRead = async () => { if (++reads === 2) release(); await bothRead; };
    let queue = Promise.resolve();
    w.db.$transaction = fn => {
      const next = queue.then(() => fn(w.db)); queue = next.catch(() => {}); return next;
    };
    const score = load('src/actions/score.ts', w).scoreMatchDay;
    await Promise.all([call(score, 'league', 'day', form({ result_m2: '3-0' })),
      call(score, 'league', 'day', form({ result_m2: '3-0' }))]);
    assert.equal(w.ledgers.filter(l => l.amount > 0).length, 2);
    assert.equal(w.ledgers.reduce((sum, row) => sum + row.amount, 0), 1);
  });
  await check('Bet update commits after scoring using state read outside transaction', async () => {
    const w = world();
    w.bets = [{ id: 'b1', userId: 'player', matchId: 'm2', predictedA: 3, predictedB: 0, pointsEarned: null }];
    w.beforeTransaction = async () => {
      w.md.status = 'SCORED'; w.md.deadline = new Date(0); w.bets[0].pointsEarned = 3;
    };
    await call(load('src/actions/bet.ts', w).placeBets, 'league', 'day', form({ bet_m2: '0-3' }));
    assert.equal(w.md.status, 'SCORED');
    assert.equal(w.bets[0].predictedB, 3);
    assert.equal(w.bets[0].pointsEarned, 3);
  });
  await check('Expired deadline can be moved forward and predictions modified again', async () => {
    const w = world(); w.md.deadline = new Date(0); w.actor = 'admin';
    await call(load('src/actions/matchday.ts', w).updateDeadline, 'league', 'day',
      form({ deadline: new Date(Date.now() + 3600000).toISOString() }));
    w.actor = 'player';
    await call(load('src/actions/bet.ts', w).placeBets, 'league', 'day', form({ bet_m2: '3-0' }));
    assert.equal(w.bets.length, 1);
    assert.equal(w.logs.length, 1); // only deadline change, no record of prediction change
  });
  await check('Replacing matches deletes predictions while retaining their entry fees', async () => {
    const w = world(); w.actor = 'admin';
    w.bets = [{ id: 'b1', userId: 'player', matchId: 'm2', predictedA: 3, predictedB: 0 }];
    w.ledgers = [{ id: 'fee', userId: 'player', leagueId: 'league', matchDayId: 'day', amount: -1, reason: 'Entry Fee' }];
    await call(load('src/actions/matchday.ts', w).setMatches, 'league', 'day', form({ numRows: '1', teamA_0: 'C', teamB_0: 'D' }));
    assert.equal(w.bets.length, 0);
    assert.equal(w.ledgers[0].amount, -1);
  });
  await check('Proxy action overwrites an existing personal prediction', async () => {
    const w = world();
    await call(load('src/actions/bet.ts', w).placeBets, 'league', 'day', form({ bet_m2: '3-0' }));
    w.actor = 'admin';
    await call(load('src/actions/proxyBet.ts', w).proxyPlaceBets, 'league', 'day', form({ userId: 'player', bet_m2: '0-3' }));
    assert.equal(w.bets[0].predictedB, 3);
    assert.ok(!w.logs[0].details.includes('3-0'));
  });
  await check('League preview queries and returns private league metadata without session', async () => {
    const w = world(); w.actor = null;
    const result = await load('src/actions/league.ts', w).getLeaguePreview(w.league.inviteCode);
    assert.equal(result.id, 'league'); assert.equal(w.sessionCalls, 0);
  });
  await check('Unbounded numRows accepts Infinity (instrumented loop, safely interrupted)', async () => {
    const w = world(); w.actor = 'admin';
    const huge = '9'.repeat(400); assert.equal(parseInt(huge), Infinity);
    let rowReads = 0;
    const sentinel = new Error('safety stop');
    const malicious = { get(key) {
      if (key === 'numRows') return huge;
      if (key === 'restingTeam') return '';
      if (++rowReads > 200) throw sentinel;
      return null;
    } };
    await assert.rejects(load('src/actions/matchday.ts', w).setMatches('league', 'day', malicious), e => e === sentinel);
    assert.equal(rowReads, 201);
  });
  await check('Admin client props contain exact predictions before deadline and unnecessary emails', async () => {
    const w = world(); w.actor = 'admin';
    w.bets = [{ id: 'b1', userId: 'player', matchId: 'm2', predictedA: 3, predictedB: 0 }];
    const tree = await load('src/app/league/[id]/admin/page.tsx', w).default({ params: Promise.resolve({ id: 'league' }) });
    const panels = collect(tree, node => node.type === 'AdminMatchdayPanel');
    assert.equal(panels.length, 1);
    const user = panels[0].props.users.find(u => u.id === 'player');
    assert.equal(user.email, 'player@example.invalid'); assert.equal(user.bets[0].predictedA, 3);
    assert.ok(w.md.deadline > new Date());
  });
  await check('Stats and betting page functions do not independently enforce membership', async () => {
    const w = world(); w.actor = 'outsider';
    w.db.user.findUnique = async () => ({ id: 'outsider', leagues: [] });
    w.db.leagueMember.findUnique = async () => null;
    const stats = await load('src/app/league/[id]/stats/page.tsx', w).default({ params: Promise.resolve({ id: 'league' }), searchParams: Promise.resolve({}) });
    const bets = await load('src/app/league/[id]/matchday/[matchdayId]/page.tsx', w).default({ params: Promise.resolve({ id: 'league', matchdayId: 'day' }) });
    assert.ok(stats && bets); // Function-level evidence only; not an HTTP bypass test.
  });
  await check('Installed NextAuth middleware throws for malformed anonymous Bearer header', async () => {
    const { withAuth } = require('next-auth/middleware');
    const { NextRequest } = require('next/server');
    const handler = withAuth({ secret: 'isolated-audit-secret', pages: { signIn: '/' } });
    const request = new NextRequest('http://localhost:3000/profile', { headers: { authorization: 'Bearer %' } });
    await assert.rejects(handler(request), e => e.name === 'URIError');
  });
  fs.writeFileSync(path.join(__dirname, 'reproduction-results.json'), JSON.stringify({
    method: 'Actual TypeScript functions; in-memory mocks; no live database or HTTP exploitation',
    results,
  }, null, 2) + '\n');
  console.log(`${results.length} isolated reproductions completed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
