import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readInventory, prepare, execute, main, signIn, configureContext } from './test-all-apis.mjs';

const options = { base: 'http://localhost:8080', timeout: 1000, token: 'test-token' };
const route = { service: 'app', method: 'GET', path: '/api/stage/players/:id' };

test('profile-aware checks supply required filters and route privileged tokens to their endpoints', () => {
  const paths = ['/api/stage/matches/profile', '/api/stage/player-showcase-videos', '/api/stage/club-operation-audit-logs', '/api/stage/admin-analytics', '/api/stage/admin-mail/status', '/api/stage/match-archive', '/api/stage/scouting-reports', '/api/stage/players'];
  const plan = paths.map(path => prepare({ ...route, path }, {}, options));
  configureContext(plan, { ...options, adminToken: 'admin-only-token', scoutToken: 'scout-only-token' }, { player_id: 'player-fixture', owned_club_id: 'club-fixture', role_id: 1 });
  assert.equal(plan[0].url.searchParams.get('player_id'), 'player-fixture');
  assert.equal(plan[1].url.searchParams.get('player_id'), 'player-fixture');
  assert.equal(plan[2].url.searchParams.get('club_id'), 'club-fixture');
  for (const index of [3, 4, 5]) assert.equal(plan[index].headers.Authorization, 'Bearer admin-only-token');
  assert.equal(plan[6].headers.Authorization, 'Bearer scout-only-token');
  assert.equal(plan[7].headers.Authorization, 'Bearer test-token');
});

test('context preserves explicit fixtures and does not invent player or club IDs', () => {
  const path = '/api/stage/matches/profile';
  const filtered = prepare({ ...route, path }, { query: { club_id: 'explicit-club' } }, options);
  configureContext([filtered], options, { player_id: 'other-player' });
  assert.equal(filtered.url.searchParams.get('club_id'), 'explicit-club');
  assert.equal(filtered.url.searchParams.get('player_id'), null);
  const requests = ['/api/stage/matches/profile', '/api/stage/player-showcase-videos', '/api/stage/club-operation-audit-logs'].map(path => prepare({ ...route, path }, {}, options));
  configureContext(requests, options, {});
  assert.equal(requests[0].url.searchParams.get('status'), 'completed');
  assert.equal(requests[1].outcome, 'SKIP');
  assert.equal(requests[2].outcome, 'SKIP');
});

test('inventory deduplicates identical routes while preserving service and method', () => {
  const row = '| GET | [/health](https://stageleagues.com/health) | Health |';
  assert.equal(readInventory(`${row}\n${row}`).length, 1);
  assert.throws(() => readInventory('No routes'), /No routes/);
});

test('parameterized and mutation routes are skipped until configured', () => {
  assert.equal(prepare(route, undefined, options).outcome, 'SKIP');
  const post = { ...route, method: 'POST' };
  assert.equal(prepare(post, { enabled: true, params: { id: 'x' } }, options).outcome, 'SKIP');
  assert.equal(prepare(post, { params: { id: 'x' } }, { ...options, allowWrites: true }).outcome, 'SKIP');
  assert.ok(prepare(post, { enabled: true, params: { id: 'x' }, body: {} }, { ...options, allowWrites: true }).url);
});

test('GET action and OAuth flow routes require explicit write opt-in', () => {
  for (const path of ['/api/stage/tournaments/123/invite-link', '/api/stage/auth/google', '/auth/callback']) {
    assert.equal(prepare({ ...route, path }, {}, options).outcome, 'SKIP');
  }
});

test('parameters are encoded and bearer tokens stay on app API requests', () => {
  const request = prepare(route, { params: { id: 'a/b?c' } }, options);
  assert.equal(request.url.pathname, '/api/stage/players/a%2Fb%3Fc');
  assert.equal(request.headers.Authorization, 'Bearer test-token');
  assert.equal(prepare({ ...route, path: '/health' }, {}, options).headers.Authorization, undefined);
  assert.equal(prepare({ ...route, service: 'socket', path: '/health' }, {}, options).outcome, 'SKIP');
  assert.throws(() => prepare({ ...route, path: '//another-host/health' }, {}, options), /origin/);
});

test('connection refusal reports the underlying code without leaking error details', async () => {
  const error = new TypeError('fetch failed with private token');
  error.cause = new AggregateError([Object.assign(new Error('private URL'), { code: 'ECONNREFUSED' })]);
  const result = await execute(prepare({ ...route, path: '/api/stage/health' }, {}, options), options, async () => { throw error; });
  assert.match(result.reason, /ECONNREFUSED/);
  assert.match(result.reason, /No server is listening/);
  assert.ok(!JSON.stringify(result).includes('private'));
});

test('sign-in obtains a bearer token and rejects bad credentials without exposing them', async () => {
  const loginOptions = { ...options, email: 'fixture@example.com', password: 'private-password' };
  const token = await signIn(loginOptions, async (url, request) => {
    assert.equal(url.pathname, '/api/stage/auth/login');
    assert.equal(request.redirect, 'manual');
    assert.deepEqual(JSON.parse(request.body), { identifier: loginOptions.email, password: loginOptions.password });
    return new Response(JSON.stringify({ accessToken: 'private-access-token' }), { headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(token, 'private-access-token');
  await assert.rejects(signIn(loginOptions, async () => new Response('{"error":"private-password"}', { status: 401 })), /Sign-in failed \(401\)/);
  await assert.rejects(signIn(loginOptions, async () => new Response('{}')), /access token/);
});

test('signed-in inventory checks use the token and exclude credentials from the report', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'stage-api-login-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const output = [];
  t.mock.method(console, 'log', message => output.push(message));
  let logins = 0;
  let protectedCalls = 0;
  const fetcher = async (url, request) => {
    if (url.pathname === '/api/stage/auth/login') {
      logins++;
      assert.equal(JSON.parse(request.body).password, 'private-password');
      return new Response('{"accessToken":"private-access-token","refreshToken":"private-refresh-token"}', { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname.startsWith('/api/') && !url.pathname.endsWith('/health') && !url.pathname.startsWith('/api/stage/public/')) {
      protectedCalls++;
      assert.equal(request.headers.Authorization, 'Bearer private-access-token');
    }
    if (url.pathname === '/api/stage/auth/me') return new Response('{"player_id":"private-player-id","owned_club_id":"private-club-id","role_id":0}', { headers: { 'Content-Type': 'application/json' } });
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  };
  const report = join(folder, 'report.json');
  const credentials = async () => ({ email: 'private-email@example.com', password: 'private-password' });
  assert.equal(await main(['--base', 'http://localhost:8080', '--login', '--delay', '0', '--report', report], fetcher, credentials), 0);
  assert.equal(logins, 1);
  assert.equal(protectedCalls, 108); // Includes the profile lookup used to scope required queries.
  const rawReport = await readFile(report, 'utf8');
  assert.equal(JSON.parse(rawReport).totals.PASS, 111);
  assert.equal(JSON.parse(rawReport).totals.FAIL, 0);
  for (const secret of ['private-email', 'private-password', 'private-access-token', 'private-refresh-token', 'private-player-id', 'private-club-id']) {
    assert.ok(!rawReport.includes(secret));
    assert.ok(!output.join('\n').includes(secret));
  }
});

test('the eleven reported routes succeed with valid query scopes and separate authorized accounts', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'stage-api-scopes-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  t.mock.method(console, 'log', () => {});
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetcher = async (url, request) => {
    const path = url.pathname;
    if (path === '/api/stage/auth/login') return reply({ accessToken: JSON.parse(request.body).identifier });
    if (path === '/api/stage/auth/me') return reply({ player_id: 'player-fixture', owned_club_id: 'club-fixture', role_id: 1 });
    if (path === '/api/stage/matches/profile' && !url.searchParams.get('player_id')) return reply({}, 400);
    if (path === '/api/stage/player-showcase-videos' && !url.searchParams.get('player_id')) return reply({}, 400);
    if (path === '/api/stage/club-operation-audit-logs' && !url.searchParams.get('club_id')) return reply({}, 400);
    if (/^\/api\/stage\/(admin-analytics|admin-mail|match-archive)(\/|$)/.test(path) && request.headers.Authorization !== 'Bearer admin-fixture') return reply({}, 403);
    if (path === '/api/stage/scouting-reports' && request.headers.Authorization !== 'Bearer scout-fixture') return reply({}, 403);
    return reply([]);
  };
  const report = join(folder, 'report.json');
  const args = ['--base', 'http://localhost:8080', '--login', '--delay', '0', '--report', report];
  const primary = async () => ({ email: 'primary-fixture', password: 'fixture-password' });
  assert.equal(await main(args, fetcher, primary), 1);
  assert.equal(JSON.parse(await readFile(report, 'utf8')).totals.FAIL, 8);
  const accounts = ['primary-fixture', 'admin-fixture', 'scout-fixture'];
  const credentials = async () => ({ email: accounts.shift(), password: 'fixture-password' });
  assert.equal(await main([...args, '--admin-login', '--scout-login'], fetcher, credentials), 0);
  const saved = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(saved.totals.FAIL, 0);
  assert.equal(saved.totals.PASS, 111);
});

test('unavailable backend makes one preflight request instead of failing every route', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'stage-api-preflight-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  t.mock.method(console, 'log', () => {});
  let calls = 0;
  const fetcher = async () => {
    calls++;
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
  };
  const report = join(folder, 'report.json');
  const code = await main(['--base', 'http://localhost:8080', '--only', 'app GET /api/stage/', '--delay', '0', '--report', report], fetcher);
  assert.equal(code, 1);
  assert.equal(calls, 1);
  const saved = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(saved.totals.FAIL, 1);
  assert.equal(saved.preflight[0].outcome, 'FAIL');
  assert.match(saved.preflight[0].reason, /ECONNREFUSED/);
  assert.ok(saved.results.every(result => result.outcome === 'SKIP'));
});

test('healthy preflight still reports authentication failures and dry runs send no requests', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'stage-api-auth-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  t.mock.method(console, 'log', () => {});
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url.pathname);
    return new Response('{}', { status: url.pathname.endsWith('/health') ? 200 : 401, headers: { 'Content-Type': 'application/json' } });
  };
  const report = join(folder, 'report.json');
  const args = ['--base', 'http://localhost:8080', '--only', 'app GET /api/stage/auth/me', '--delay', '0', '--report', report];
  assert.equal(await main(args, fetcher), 1);
  assert.deepEqual(calls, ['/api/stage/health', '/api/stage/auth/me']);
  const saved = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(saved.preflight[0].outcome, 'PASS');
  assert.equal(saved.totals.FAIL, 1);
  assert.match(saved.results.find(row => row.status === 401).reason, /API_TEST_TOKEN/);
  calls.length = 0;
  assert.equal(await main([...args, '--dry-run'], fetcher), 0);
  assert.equal(calls.length, 0);
});

test('HTTP integration: strict status, valid JSON, redirects, writes, timeouts and secret-free results', async (t) => {
  let redirected = false;
  const server = createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    if (path.endsWith('/slow')) return;
    if (path.endsWith('/redirect')) { res.writeHead(302, { Location: '/api/stage/destination' }); res.end(); return; }
    if (path.endsWith('/destination')) redirected = true;
    if (path.endsWith('/html')) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>fallback</html>'); return; }
    res.setHeader('Content-Type', 'application/json');
    if (path.endsWith('/invalid')) { res.end('not json'); return; }
    if (path.endsWith('/unauthorized')) res.statusCode = 401;
    if (path.endsWith('/empty')) res.statusCode = 204;
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      assert.equal(JSON.parse(body).name, 'fixture');
      res.statusCode = 201;
    }
    res.end(JSON.stringify({ ok: true, secret: 'not-in-report' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const localOptions = { ...options, base: `http://127.0.0.1:${server.address().port}`, timeout: 100 };
  for (const [name, outcome, status] of [['ok', 'PASS', 200], ['html', 'FAIL', 200], ['invalid', 'FAIL', 200], ['unauthorized', 'FAIL', 401], ['empty', 'FAIL', 204], ['redirect', 'FAIL', 302], ['slow', 'FAIL', null]]) {
    const result = await execute(prepare({ ...route, path: `/api/stage/${name}` }, {}, localOptions), localOptions);
    assert.equal(result.outcome, outcome, name);
    assert.equal(result.status, status, name);
    assert.ok(!JSON.stringify(result).includes('test-token'));
    assert.ok(!JSON.stringify(result).includes('not-in-report'));
  }
  assert.equal(redirected, false);
  const post = prepare({ ...route, method: 'POST', path: '/api/stage/create' }, { enabled: true, body: { name: 'fixture' } }, { ...localOptions, allowWrites: true });
  const created = await execute(post, localOptions);
  assert.equal(created.outcome, 'PASS');
  assert.equal(created.status, 201);
});
