import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const dependencies = {
  '@/lib/SocketContext': {},
  '@/lib/momentDate': { toMysqlDateTime: v => v, asWallClockDateTimeString: v => v },
  '@/lib/userIdentityFields': { getOwnedClubId: () => null, getPresidentClubId: () => null, getPresidentId: () => null },
  '@/lib/accountIntent': { clearAccountIntent() {} },
};

function loadClient(fetch, storage = new Map(), file = '../stageClient.js', imports = dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8').replaceAll('import.meta', '({ env: {} })');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, require(name) { if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`); return imports[name]; },
    fetch, localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    FormData, URLSearchParams, Event, setTimeout, clearTimeout,
  });
  return exports;
}

test('two access-token renewals persist the rotated refresh tokens', async () => {
  const storage = new Map([['stage_access_token', 'expired'], ['stage_refresh_token', 'refresh-0']]);
  let rotation = 0;
  const client = loadClient(async (url, request) => {
    if (url.endsWith('/auth/refresh')) {
      assert.equal(JSON.parse(request.body).refreshToken, `refresh-${rotation}`);
      rotation++;
      return json({ accessToken: `access-${rotation}`, refreshToken: `refresh-${rotation}` });
    }
    return request.headers.Authorization === `Bearer access-${rotation}` ? json([]) : json({}, 401);
  }, storage).stageClient;
  await client.entities.Player.list();
  storage.set('stage_access_token', 'expired-again');
  await client.entities.Player.list();
  assert.equal(rotation, 2);
  assert.equal(storage.get('stage_refresh_token'), 'refresh-2');
});

test('EA club search consumes the single backend data envelope', async () => {
  const clubs = [{ clubId: 'ea-1', name: 'EA fixture' }];
  const ea = loadClient(null, new Map(), '../../lib/eafcClient.js', {
    '@/api/stageClient': { stageClient: { functions: { invoke: async () => ({ data: clubs }) } } },
  });
  assert.deepEqual(await ea.searchClub('EA', 'PC'), clubs);
});

test('identity claims fall back only when the REST route is missing', async () => {
  for (const status of [404, 200, 403]) {
    let calls = 0;
    const client = loadClient(async url => {
      if (url.includes('/functions/')) { calls++; return json({ data: [{ id: 'claim-1' }] }); }
      return json(status === 200 ? [] : { error: 'Unavailable' }, status);
    }).stageClient;
    if (status === 403) await assert.rejects(client.identityClaims.list(), error => error.status === 403);
    else assert.equal((await client.identityClaims.list()).length, status === 404 ? 1 : 0);
    assert.equal(calls, status === 404 ? 1 : 0);
  }
});

test('directory ordering is sent to the backend before a limited page is selected', async () => {
  let requested;
  const client = loadClient(async url => { requested = new URL(url, 'http://localhost'); return json([]); }).stageClient;
  await client.entities.Player.filter({ offset: 200 }, '-overall_rating', 50);
  assert.equal(requested.searchParams.get('order_by'), '-overall_rating');
  assert.equal(requested.searchParams.get('offset'), '200');
  assert.equal(requested.searchParams.get('limit'), '50');
});
