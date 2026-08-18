const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadNotifications(sendMailSafe) {
  const servicePath = path.resolve(__dirname, '../notifications.js');
  const mailerPath = path.resolve(__dirname, '../mailer.js');
  const preferencePath = path.resolve(__dirname, '../notificationPreferenceService.js');

  delete require.cache[servicePath];
  delete require.cache[mailerPath];
  delete require.cache[preferencePath];

  require.cache[mailerPath] = {
    id: mailerPath,
    filename: mailerPath,
    loaded: true,
    exports: {
      isConfigured: () => true,
      sendMailSafe,
    },
  };
  require.cache[preferencePath] = {
    id: preferencePath,
    filename: preferencePath,
    loaded: true,
    exports: {
      isEmailCategoryEnabled: async () => true,
    },
  };

  return require(servicePath);
}

test('notifySignup always queues a welcome email', () => {
  const sent = [];
  const { notifySignup } = loadNotifications((payload) => sent.push(payload));

  notifySignup({ to: 'new@example.test', name: 'Alex' });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'new@example.test');
  assert.match(sent[0].subject, /Welcome to STAGE League/);
  assert.match(sent[0].html, /Alex/);
});

test('sendEventEmail uses the in-app title, body, and link', () => {
  const sent = [];
  const { sendEventEmail } = loadNotifications((payload) => sent.push(payload));

  sendEventEmail({
    to: 'player@example.test',
    title: 'New contract offer',
    body: 'Longue Vie FC sent you an offer.',
    url: '/inbox?id=1',
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'player@example.test');
  assert.match(sent[0].subject, /New contract offer/);
  assert.match(sent[0].html, /Longue Vie FC sent you an offer/);
  assert.match(sent[0].html, /\/inbox\?id=1/);
});
