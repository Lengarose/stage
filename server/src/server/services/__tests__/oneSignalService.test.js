const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadService(executesql = async () => []) {
  const servicePath = path.resolve(__dirname, '../oneSignalService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  delete require.cache[servicePath];
  delete require.cache[dbPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };
  return require(servicePath);
}

test('skips push when OneSignal env is missing', async () => {
  const service = loadService();
  const result = await service.sendOneSignalPush({
    recipientEmail: 'player@example.test',
    title: 'Offer',
  }, {});
  assert.deepEqual(result, { skipped: true, reason: 'onesignal not configured' });
});

test('builds alias payload for the Stage user id', () => {
  const service = loadService();
  assert.deepEqual(service.buildOneSignalPayload({
    appId: 'app-1',
    externalId: 'user-9',
    title: 'Contract offer',
    body: 'Ajax sent a deal',
    link: '/inbox?id=m1',
    type: 'contract_offer',
    notificationId: 'n1',
    frontendUrl: 'https://stageleagues.com',
  }), {
    app_id: 'app-1',
    include_aliases: { external_id: ['user-9'] },
    target_channel: 'push',
    headings: { en: 'Contract offer' },
    contents: { en: 'Ajax sent a deal' },
    data: { link: '/inbox?id=m1', type: 'contract_offer', notification_id: 'n1' },
    url: 'https://stageleagues.com/inbox?id=m1',
    ios_sound: 'default',
  });
});

test('sends REST create-notification after resolving player.user_id', async () => {
  const calls = [];
  const service = loadService(async () => [{ external_id: 'user-9' }]);
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => ({ id: 'os-1' }) };
  };
  const result = await service.sendOneSignalPush({
    recipientEmail: 'player@example.test',
    title: 'Offer',
    body: 'Open inbox',
    link: '/inbox?id=m1',
    type: 'contract_offer',
    notificationId: 'n1',
  }, {
    ONESIGNAL_APP_ID: 'app-1',
    ONESIGNAL_REST_API_KEY: 'rest-1',
    FRONTEND_URL: 'https://stageleagues.com',
  }, fetchImpl);

  assert.equal(result.success, true);
  assert.equal(calls[0].url, 'https://api.onesignal.com/notifications');
  assert.equal(calls[0].opts.headers.Authorization, 'Key rest-1');
  const body = JSON.parse(calls[0].opts.body);
  assert.deepEqual(body.include_aliases.external_id, ['user-9']);
  assert.equal(body.target_channel, 'push');
});
