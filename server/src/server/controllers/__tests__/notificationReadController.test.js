const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadNotificationRouterWithMocks({ currentUser, notification }) {
  const controllerPath = path.resolve(__dirname, '../notificationController.js');
  const modelPath = path.resolve(__dirname, '../../models/notificationModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');
  const broadcasts = [];
  const calls = { markRead: [] };

  for (const modulePath of [controllerPath, modelPath, dbPath, socketPath]) {
    delete require.cache[modulePath];
  }

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      EXECUTESQL: async (sql, params = []) => {
        if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
          return currentUser ? [{ ...currentUser, id: params[0] }] : [];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
  };

  class NotificationMock {
    selectOne(id) {
      if (!notification || id !== notification.id) return [];
      return [{ ...notification }];
    }
    markRead(id) {
      calls.markRead.push(id);
      if (notification && id === notification.id) notification.read = 1;
      return { affectedRows: notification && id === notification.id ? 1 : 0 };
    }
  }

  require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: NotificationMock };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: { broadcastNotification: (record) => broadcasts.push(record) },
  };

  return { router: require(controllerPath), broadcasts, calls };
}

function routeHandler(router, method, pathName) {
  const layer = router.stack.find((entry) => entry.route?.path === pathName && entry.route.methods[method]);
  return layer?.route.stack.find((entry) => entry.method === method)?.handle;
}

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
}

test('recipient can mark their notification as read', async () => {
  const notification = {
    id: 'notification-1',
    recipient_email: 'Recipient@Example.Test',
    type: 'message',
    title: 'New message',
    read: 0,
  };
  const { router, broadcasts, calls } = loadNotificationRouterWithMocks({
    currentUser: { email: 'recipient@example.test', role_id: 1 },
    notification,
  });
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/read')(
    { params: { id: 'notification-1' }, user: { id: 'recipient-user' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.read, 1);
  assert.deepEqual(calls.markRead, ['notification-1']);
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].id, 'notification-1');
  assert.equal(broadcasts[0].read, 1);
});

test('another non-admin user cannot mark a notification as read', async () => {
  const notification = {
    id: 'notification-1',
    recipient_email: 'recipient@example.test',
    type: 'message',
    title: 'New message',
    read: 0,
  };
  const { router, broadcasts, calls } = loadNotificationRouterWithMocks({
    currentUser: { email: 'intruder@example.test', role_id: 1 },
    notification,
  });
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/read')(
    { params: { id: 'notification-1' }, user: { id: 'intruder-user' } },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.deepEqual(calls.markRead, []);
  assert.equal(notification.read, 0);
  assert.equal(broadcasts.length, 0);
});

test('admin can mark another user notification as read', async () => {
  const notification = {
    id: 'notification-1',
    recipient_email: 'recipient@example.test',
    type: 'message',
    title: 'New message',
    read: 0,
  };
  const { router, broadcasts, calls } = loadNotificationRouterWithMocks({
    currentUser: { email: 'admin@example.test', role_id: 0 },
    notification,
  });
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/read')(
    { params: { id: 'notification-1' }, user: { id: 'admin-user' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.read, 1);
  assert.deepEqual(calls.markRead, ['notification-1']);
  assert.equal(broadcasts.length, 1);
});
