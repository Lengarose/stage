#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

const inventoryFile = new URL('../docs/API_REFERENCE.md', import.meta.url);
const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export function readInventory(markdown) {
  const entries = new Map();
  for (const match of markdown.matchAll(/^\| (GET|POST|PUT|PATCH|DELETE) \| \[([^\]]+)\]\((https?:\/\/[^)]+)\) \|/gm)) {
    const [, method, path, target] = match;
    const service = new URL(target).hostname === 'stageleagues.com' ? 'app' : 'socket';
    entries.set(`${service} ${method} ${path}`, { service, method, path });
  }
  if (!entries.size) throw new Error('No routes found in docs/API_REFERENCE.md');
  return [...entries.values()];
}

function origin(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Base URLs must be HTTP(S) origins, e.g. http://localhost:8080');
  }
  return url.origin;
}

function isFlowOrAction(route) {
  return route.path.startsWith('/auth/') || route.path.startsWith('/store/') ||
    (/^\/api\/(stage|mobile)\/auth\//.test(route.path) && !/\/(me|timezone)$/.test(route.path)) ||
    route.path.endsWith('/invite-link');
}

function requestFailure(error) {
  const causes = [error, error?.cause, ...(error?.cause?.errors || [])];
  const codes = new Set(causes.map(item => item?.code));
  if (error?.name === 'AbortError' || codes.has('ETIMEDOUT') || codes.has('UND_ERR_CONNECT_TIMEOUT')) return 'Request timed out; check the server and network';
  if (codes.has('ECONNREFUSED')) return 'ECONNREFUSED: No server is listening at the configured address; start the backend or correct --base';
  if (codes.has('ENOTFOUND') || codes.has('EAI_AGAIN')) return 'DNS lookup failed; check the hostname and network';
  if (codes.has('EPERM') || codes.has('EACCES')) return 'Network or file access denied by the environment';
  if (codes.has('ENOENT')) return 'Fixture file not found; check the form file path';
  if (codes.has('ECONNRESET') || codes.has('UND_ERR_SOCKET')) return 'Server closed the connection; check server logs';
  if (['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID'].some(code => codes.has(code))) return 'TLS certificate validation failed; check the server certificate';
  return 'Request failed; check server availability, TLS configuration and fixture files';
}

async function promptCredentials(email) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Sign-in requires a terminal, or set API_TEST_EMAIL and API_TEST_PASSWORD. OAuth accounts can use API_TEST_TOKEN from an existing session.');
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, done) { if (!hidden) process.stdout.write(chunk, encoding); done(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const controller = new AbortController();
  rl.on('SIGINT', () => controller.abort());
  try {
    const identifier = email || await rl.question('Email, gamertag or club name: ', { signal: controller.signal });
    process.stdout.write('Password (hidden): ');
    hidden = true;
    const password = await rl.question('', { signal: controller.signal });
    return { email: identifier, password };
  } finally {
    rl.close();
    process.stdout.write('\n');
  }
}

export async function signIn(options, fetcher = fetch, credentialReader = promptCredentials) {
  const credentials = options.email && options.password
    ? { email: options.email, password: options.password }
    : await credentialReader(options.email);
  if (!credentials.email?.trim() || !credentials.password) throw new Error('Sign-in requires an account identifier and password');
  let response;
  try {
    response = await fetcher(new URL('/api/stage/auth/login', origin(options.base)), {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(options.timeout),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: credentials.email.trim(), password: credentials.password }),
    });
  } catch (error) { throw new Error(`Sign-in failed: ${requestFailure(error)}`); }
  if (![200, 201].includes(response.status)) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`Sign-in failed (${response.status}); check your credentials. OAuth-only accounts need API_TEST_TOKEN from an existing session.`);
  }
  let payload;
  try { payload = await response.json(); } catch { throw new Error('Sign-in returned invalid JSON'); }
  if (typeof payload.accessToken !== 'string' || !payload.accessToken.trim()) throw new Error('Sign-in response did not include an access token');
  return payload.accessToken;
}

export function configureContext(plan, options, identity = {}) {
  const playerId = options.playerId || identity.player_id;
  const clubId = options.clubId || identity.owned_club_id || identity.president_club_id || identity.club_id;
  const profileFilters = ['id', 'player_id', 'club_id', 'home_player_id', 'away_player_id', 'home_club_id', 'away_club_id', 'status', 'mode', 'type', 'tournament_id'];
  for (const request of plan) {
    if (request.service !== 'app' || request.outcome === 'SKIP') continue;
    const { path, url } = request;
    if (options.adminToken && /^\/api\/stage\/(admin-analytics|admin-mail|match-archive)(\/|$)/.test(path)) request.headers.Authorization = `Bearer ${options.adminToken}`;
    if (options.scoutToken && /^\/api\/stage\/scouting-reports(\/|$)/.test(path)) request.headers.Authorization = `Bearer ${options.scoutToken}`;
    if (request.method !== 'GET') continue;
    if (path === '/api/stage/matches/profile' && !profileFilters.some(key => url.searchParams.get(key))) {
      url.searchParams.set(playerId ? 'player_id' : 'status', playerId || 'completed');
    }
    if (path === '/api/stage/player-showcase-videos' && !url.searchParams.get('player_id') && !url.searchParams.get('player_ids')) {
      if (playerId) url.searchParams.set('player_id', playerId);
      else { request.outcome = 'SKIP'; request.reason = 'Showcase check needs --player-id or query.player_id in its fixture; no player profile was resolved'; }
    }
    if (path === '/api/stage/club-operation-audit-logs' && !url.searchParams.get('club_id') && Number(identity.role_id ?? -1) !== 0) {
      if (clubId) url.searchParams.set('club_id', clubId);
      else { request.outcome = 'SKIP'; request.reason = 'Club audit check needs --club-id or query.club_id for a club this account can access'; }
    }
  }
}

async function readIdentity(options, fetcher) {
  try {
    const response = await fetcher(new URL('/api/stage/auth/me', origin(options.base)), {
      headers: { Accept: 'application/json', Authorization: `Bearer ${options.token}` },
      redirect: 'manual', signal: AbortSignal.timeout(options.timeout),
    });
    if (response.status !== 200) { await response.body?.cancel().catch(() => {}); return {}; }
    const identity = await response.json();
    return identity && typeof identity === 'object' && !Array.isArray(identity) ? identity : {};
  } catch { return {}; }
}

export function prepare(route, fixture, options) {
  const test = fixture || {};
  const skip = (reason) => ({ ...route, outcome: 'SKIP', reason });
  if (test.enabled === false) return skip('Disabled in cases file');
  if (options.only && !`${route.service} ${route.method} ${route.path}`.includes(options.only)) return skip('Outside --only filter');
  if (route.method !== 'GET' || isFlowOrAction(route)) {
    if (!options.allowWrites || test.enabled !== true) return skip('Requires --allow-writes and enabled:true for this route');
  }
  let missing = false;
  const path = route.path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_, name) => {
    const value = test.params?.[name];
    if (value === undefined || value === null || value === '') { missing = true; return ':' + name; }
    return encodeURIComponent(String(value));
  });
  if (missing) return skip('Missing route parameters in cases file');
  const targetOrigin = route.service === 'socket' ? options.socketBase : options.base;
  if (!targetOrigin) return skip('No --socket-base configured');
  const url = new URL(path, origin(targetOrigin));
  if (url.origin !== origin(targetOrigin)) throw new Error('Route must stay on its configured origin');
  for (const [key, value] of Object.entries(test.query || {})) url.searchParams.set(key, String(value));
  if (route.method === 'GET' && /\/api\//.test(path) && !url.searchParams.has('limit')) url.searchParams.set('limit', '1');
  const headers = { Accept: 'application/json' };
  if (route.service === 'app' && /^\/api\/(stage|mobile)\//.test(path) && options.token) headers.Authorization = `Bearer ${options.token}`;
  if (route.service === 'socket' && path === '/emit' && options.emitSecret) headers['x-emit-secret'] = options.emitSecret;
  if (test.body !== undefined && test.form !== undefined) throw new Error('Use body or form, not both');
  if (route.method === 'GET' && (test.body !== undefined || test.form !== undefined)) throw new Error('GET cases cannot have a request body');
  return { ...route, url, headers, test };
}

export async function execute(prepared, options, fetcher = fetch) {
  if (prepared.outcome === 'SKIP') return prepared;
  const { service, method, path, url, headers, test } = prepared;
  const started = Date.now();
  let timer;
  // Reports deliberately exclude tokens, query values, request/response bodies and resolved IDs.
  const result = { service, method, path };
  try {
    let body;
    if (test.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(test.body);
    }
    if (test.form !== undefined) {
      body = new FormData();
      for (const [key, value] of Object.entries(test.form)) {
        if (value && typeof value === 'object' && value.file) {
          body.append(key, new Blob([await readFile(value.file)], { type: value.type || 'application/octet-stream' }), value.filename || 'fixture');
        } else body.append(key, String(value));
      }
    }
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), options.timeout);
    const response = await fetcher(url, { method, headers, body, redirect: 'manual', signal: controller.signal });
    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    const expectsJson = test.expectJson ?? /^\/api\/(stage|mobile)\//.test(path);
    let reason;
    if (![200, 201].includes(status)) {
      reason = `Expected 200 or 201; received ${status}`;
      if (status === 401) reason += '; set API_TEST_TOKEN to a valid access token for this server';
      if (status === 403) {
        if (path.startsWith('/api/stage/scouting-reports')) reason += '; scouting requires a playing member of a club; use --scout-login or API_TEST_SCOUT_TOKEN';
        else if (/^\/api\/stage\/(admin-analytics|admin-mail|match-archive)(\/|$)/.test(path)) reason += '; requires admin role_id 0 or 2; use --admin-login or API_TEST_ADMIN_TOKEN';
        else reason += '; this account may not have the required permissions';
      }
    }
    else if (expectsJson && !contentType.toLowerCase().includes('application/json')) reason = 'Expected JSON; received another content type (possibly an HTML fallback)';
    else if (expectsJson) {
      try { await response.json(); } catch { reason = 'Response is not valid JSON'; }
    }
    await response.body?.cancel().catch(() => {});
    return { ...result, status, outcome: reason ? 'FAIL' : 'PASS', ...(reason ? { reason } : {}), durationMs: Date.now() - started };
  } catch (error) {
    return { ...result, status: null, outcome: 'FAIL', reason: requestFailure(error), durationMs: Date.now() - started };
  } finally { clearTimeout(timer); }
}

function argumentsFor(args) {
  const options = { base: process.env.API_BASE_URL || 'http://localhost:8080', socketBase: process.env.SOCKET_BASE_URL, token: process.env.API_TEST_TOKEN, email: process.env.API_TEST_EMAIL, password: process.env.API_TEST_PASSWORD, emitSecret: process.env.API_TEST_EMIT_SECRET, timeout: 10000, delay: 500, report: 'api-test-report.local.json' };
  options.adminToken = process.env.API_TEST_ADMIN_TOKEN;
  options.scoutToken = process.env.API_TEST_SCOUT_TOKEN;
  const values = { '--base': 'base', '--socket-base': 'socketBase', '--cases': 'cases', '--report': 'report', '--only': 'only', '--timeout': 'timeout', '--delay': 'delay', '--init-cases': 'initCases', '--player-id': 'playerId', '--club-id': 'clubId' };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (['--allow-writes', '--dry-run', '--require-all', '--help', '--login', '--admin-login', '--scout-login'].includes(flag)) {
      options[{ '--allow-writes': 'allowWrites', '--dry-run': 'dryRun', '--require-all': 'requireAll', '--help': 'help', '--login': 'login', '--admin-login': 'adminLogin', '--scout-login': 'scoutLogin' }[flag]] = true;
    } else if (values[flag] && args[i + 1] && !args[i + 1].startsWith('--')) options[values[flag]] = args[++i];
    else throw new Error(`Unknown option or missing value: ${flag}`);
  }
  for (const key of ['timeout', 'delay']) {
    options[key] = Number(options[key]);
    if (!Number.isFinite(options[key]) || options[key] < (key === 'timeout' ? 1 : 0)) throw new Error(`Invalid ${key}`);
  }
  origin(options.base);
  if (options.socketBase) origin(options.socketBase);
  return options;
}

export async function main(args = process.argv.slice(2), fetcher = fetch, credentialReader = promptCredentials) {
  const options = argumentsFor(args);
  if (options.help) {
    console.log(`Usage: node scripts/test-all-apis.mjs [options]
  --base ORIGIN          App server (default http://localhost:8080)
  --socket-base ORIGIN   Optional realtime server
  --init-cases FILE      Generate disabled fixtures for every route; no requests
  --cases FILE           JSON fixtures with params, query, body or multipart form
  --login                Sign in with an existing account; password is hidden
  --admin-login          Sign in a second account for admin-only routes
  --scout-login          Sign in a club-member account for scouting routes
  --player-id ID         Default showcase/profile player (overrides own profile)
  --club-id ID           Default club audit scope (must be accessible)
  --allow-writes         Run explicitly enabled mutation/auth-flow cases
  --dry-run             Show planned requests without making them
  --only TEXT           Filter method/path/service by substring
  --report FILE         JSON output (default api-test-report.local.json)
  --timeout MS          Per-request timeout (default 10000)
  --delay MS            Delay between requests (default 500)
  --require-all         Exit 2 when any route is skipped
Environment: API_TEST_TOKEN, API_TEST_EMAIL, API_TEST_PASSWORD, API_TEST_EMIT_SECRET,
             API_TEST_ADMIN_TOKEN, API_TEST_SCOUT_TOKEN, API_BASE_URL, SOCKET_BASE_URL
Exit: 0 = executed checks passed; 1 = failure; 2 = incomplete with --require-all.
PASS means status 200/201 and valid JSON where expected, not business correctness.`);
    return 0;
  }
  const routes = readInventory(await readFile(inventoryFile, 'utf8'));
  if (options.initCases) {
    const cases = routes.map(route => ({ ...route, enabled: false, params: Object.fromEntries([...route.path.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)].map(m => [m[1], ''])) }));
    await writeFile(options.initCases, JSON.stringify({ cases }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(`Created ${options.initCases} with ${cases.length} disabled cases. Fill fixtures and enable cases to run them.`);
    return 0;
  }
  const config = options.cases ? JSON.parse(await readFile(options.cases, 'utf8')) : { cases: [] };
  if (!Array.isArray(config.cases)) throw new Error('Cases file must contain a cases array');
  const fixtures = new Map();
  const keys = new Set(routes.map(r => `${r.service} ${r.method} ${r.path}`));
  for (const test of config.cases) {
    const key = `${test.service || 'app'} ${test.method} ${test.path}`;
    if (!methods.has(test.method) || !keys.has(key) || fixtures.has(key)) throw new Error(`Unknown or duplicate case: ${key}`);
    fixtures.set(key, test);
  }
  // Validate every case before sending any requests.
  const plan = routes.map(route => prepare(route, fixtures.get(`${route.service} ${route.method} ${route.path}`), options));
  const preflight = [];
  const blockedServices = new Set();
  if (!options.dryRun) {
    for (const service of ['app', 'socket']) {
      if (!plan.some(request => request.service === service && request.outcome !== 'SKIP')) continue;
      const path = service === 'app' ? '/api/stage/health' : '/health';
      const check = prepare({ service, method: 'GET', path }, { expectJson: true }, { ...options, only: undefined });
      const result = await execute(check, options, fetcher);
      preflight.push(result);
      console.log(`PREFLIGHT ${result.outcome} ${service} ${service === 'app' ? options.base : options.socketBase}${path}${result.reason ? ' — ' + result.reason : ''}`);
      if (result.outcome !== 'PASS') {
        blockedServices.add(service);
        if (service === 'app') {
          console.log('Local backend: configure server/src/constants/env.local.js (JWT secrets and MySQL), then run npm --prefix server start in another terminal.');
          console.log('For the deployed app, explicitly use --base https://stageleagues.com. Protected routes also need API_TEST_TOKEN.');
        }
      }
    }
  }
  if (!options.dryRun && !blockedServices.has('app') && plan.some(request => request.service === 'app' && request.outcome !== 'SKIP')) {
    const protectedRequests = plan.some(request => request.service === 'app' && request.outcome !== 'SKIP' && /^\/api\/(stage|mobile)\//.test(request.path) && !request.path.startsWith('/api/stage/public/') && !request.path.endsWith('/health'));
    const automaticLogin = protectedRequests && !options.token && process.stdin.isTTY && process.stdout.isTTY;
    if (options.login || automaticLogin) {
      console.log(`Sign in to ${origin(options.base)}. Use an admin account to check admin-only endpoints.`);
      options.token = await signIn(options, fetcher, credentialReader);
      // The plan was validated before login; attach the new token only to app API calls.
      for (const request of plan) {
        if (request.service === 'app' && request.outcome !== 'SKIP' && /^\/api\/(stage|mobile)\//.test(request.path)) request.headers.Authorization = `Bearer ${options.token}`;
      }
      console.log('Sign-in successful. The access token stays in memory and is excluded from the report.');
    } else if (protectedRequests && !options.token) console.log('No API_TEST_TOKEN supplied. Use --login or set API_TEST_TOKEN; protected endpoints will return 401.');
    for (const [flag, key, label] of [['adminLogin', 'adminToken', 'an administrator (role_id 0 or 2)'], ['scoutLogin', 'scoutToken', 'a playing member of a club']]) {
      if (!options[flag]) continue;
      console.log(`Sign in to ${origin(options.base)} as ${label}.`);
      options[key] = await signIn({ ...options, email: undefined, password: undefined }, fetcher, credentialReader);
    }
    const needsContext = plan.some(request => request.outcome !== 'SKIP' && ['/api/stage/matches/profile', '/api/stage/player-showcase-videos', '/api/stage/club-operation-audit-logs'].includes(request.path));
    const identity = options.token && needsContext ? await readIdentity(options, fetcher) : {};
    configureContext(plan, options, identity);
    if (needsContext && options.token && ![0, 2].includes(Number(identity.role_id ?? -1))) console.log('Admin endpoints require an admin account; use --admin-login if the primary account is not an admin. A 403 remains FAIL.');
  }
  const results = [];
  for (const request of plan) {
    const blocked = blockedServices.has(request.service);
    const result = request.outcome === 'SKIP' ? request
      : blocked ? { service: request.service, method: request.method, path: request.path, outcome: 'SKIP', reason: 'Service health preflight failed; endpoint was not tested' }
      : options.dryRun ? { service: request.service, method: request.method, path: request.path, outcome: 'PLANNED' }
      : await execute(request, options, fetcher);
    results.push(result);
    if (result.reason !== 'Outside --only filter' && !blocked) console.log(`${result.outcome.padEnd(7)} ${String(result.status ?? '-').padEnd(3)} ${result.service} ${result.method} ${result.path}${result.reason ? ' — ' + result.reason : ''}`);
    if (!options.dryRun && !blocked && request.outcome !== 'SKIP' && options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
  }
  const totals = Object.fromEntries(['PASS', 'FAIL', 'SKIP', 'PLANNED'].map(outcome => [outcome, results.filter(r => r.outcome === outcome).length]));
  totals.FAIL += preflight.filter(result => result.outcome !== 'PASS').length;
  await writeFile(options.report, JSON.stringify({ generatedAt: new Date().toISOString(), dryRun: !!options.dryRun, totals, preflight, results }, null, 2) + '\n', { mode: 0o600 });
  console.log(`\n${JSON.stringify(totals)}\nReport: ${options.report}`);
  return totals.FAIL ? 1 : options.requireAll && (totals.SKIP || totals.PLANNED) ? 2 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
