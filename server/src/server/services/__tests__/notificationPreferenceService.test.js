const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadService(executesql) {
  const servicePath = path.resolve(__dirname, '../notificationPreferenceService.js');
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

test('legacy flat keys apply to every channel until nested values exist', () => {
  const { isChannelEnabled, resolveDelivery } = loadService(async () => []);
  const settings = { messages: false };

  assert.equal(isChannelEnabled(settings, 'web', 'messages'), false);
  assert.equal(isChannelEnabled(settings, 'email', 'messages'), false);
  assert.equal(isChannelEnabled(settings, 'mobile', 'messages'), false);
  assert.equal(isChannelEnabled(settings, 'push', 'messages'), false);
  assert.deepEqual(resolveDelivery(settings, 'messages'), { inApp: false, push: false, email: false });
});

test('nested channel keys override the legacy flat fallback', () => {
  const { isChannelEnabled, resolveDelivery } = loadService(async () => []);
  const settings = {
    messages: false,
    web: { messages: true },
    email: { messages: false },
    mobile: { messages: true },
    push: { messages: false },
  };

  assert.equal(isChannelEnabled(settings, 'web', 'messages'), true);
  assert.equal(isChannelEnabled(settings, 'email', 'messages'), false);
  assert.equal(isChannelEnabled(settings, 'mobile', 'messages'), true);
  assert.equal(isChannelEnabled(settings, 'push', 'messages'), false);
  assert.deepEqual(resolveDelivery(settings, 'messages'), { inApp: true, push: false, email: false });
});

test('isEmailCategoryEnabled reads the email channel from the player record', async () => {
  const { isEmailCategoryEnabled } = loadService(async () => [{
    notification_settings: JSON.stringify({ email: { match_reminders: false } }),
  }]);

  assert.equal(await isEmailCategoryEnabled('player@example.test', 'match_reminders'), false);
});
