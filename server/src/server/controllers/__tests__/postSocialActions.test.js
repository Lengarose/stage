const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadSocialRoutersWithMocks(executesql, notifications, broadcasts) {
  const postControllerPath = path.resolve(__dirname, '../postController.js');
  const commentControllerPath = path.resolve(__dirname, '../commentController.js');
  const postModelPath = path.resolve(__dirname, '../../models/postModel.js');
  const commentModelPath = path.resolve(__dirname, '../../models/commentModel.js');
  const notificationModelPath = path.resolve(__dirname, '../../models/notificationModel.js');
  const playerModelPath = path.resolve(__dirname, '../../models/playerModel.js');
  const feedTrustServicePath = path.resolve(__dirname, '../../services/feedTrustService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const deliveryPath = path.resolve(__dirname, '../../services/messageDeliveryService.js');
  const mentionPath = path.resolve(__dirname, '../../services/socialMentionService.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  for (const modulePath of [
    postControllerPath,
    commentControllerPath,
    postModelPath,
    commentModelPath,
    notificationModelPath,
    playerModelPath,
    feedTrustServicePath,
    dbPath,
    deliveryPath,
    mentionPath,
    socketPath,
  ]) {
    delete require.cache[modulePath];
  }
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { EXECUTESQL: executesql } };
  require.cache[deliveryPath] = {
    id: deliveryPath,
    filename: deliveryPath,
    loaded: true,
    exports: { createNotificationIfEnabled: async (payload) => { notifications.push(payload); return { success: true }; } },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: { broadcastPost: (record) => broadcasts.push(record), broadcastPostDeleted() {} },
  };

  return { postRouter: require(postControllerPath), commentRouter: require(commentControllerPath) };
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

test('POST /posts/:id/like toggles through post_likes and notifies the post owner', async () => {
  const notifications = [];
  const broadcasts = [];
  const post = { id: 'post-1', author_email: 'owner@example.test', likes: JSON.stringify(['other@example.test']), likes_count: 1 };
  const { postRouter } = loadSocialRoutersWithMocks(async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) return [{ id: params[0], email: 'liker@example.test' }];
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [post];
    if (/INSERT IGNORE INTO post_likes/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE posts SET\s+likes = COALESCE/.test(sql)) {
      post.likes = JSON.stringify(['other@example.test', 'liker@example.test']);
      post.likes_count = 2;
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }, notifications, broadcasts);

  const handler = routeHandler(postRouter, 'post', '/:id/like');
  const response = makeResponse();
  assert.ok(handler, 'like action route should exist');
  await handler({ params: { id: 'post-1' }, user: { id: 'liker-user' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.likes, ['other@example.test', 'liker@example.test']);
  assert.equal(response.body.likes_count, 2);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].recipientEmail, 'owner@example.test');
  assert.equal(broadcasts.length, 1);
});

test('POST /posts creates mention tags and notifies mentioned non-actors', async () => {
  const notifications = [];
  const broadcasts = [];
  const created = {
    id: 'post-1',
    author_email: 'actor@example.test',
    content: 'Welcome @Mentioned',
    tags: JSON.stringify([{ gamertag: 'Mentioned', player_id: 'mentioned-player' }]),
  };
  const { postRouter } = loadSocialRoutersWithMocks(async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) return [{ id: params[0], email: 'actor@example.test' }];
    if (/SELECT id, gamertag, email, avatar_url FROM players WHERE gamertag IN/.test(sql)) {
      return [{ id: 'mentioned-player', gamertag: 'Mentioned', email: 'mentioned@example.test' }];
    }
    if (/INSERT INTO posts/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [created];
    throw new Error(`Unexpected SQL: ${sql}`);
  }, notifications, broadcasts);

  const response = makeResponse();
  await routeHandler(postRouter, 'post', '/')(
    { body: { author_email: 'actor@example.test', content: 'Welcome @Mentioned' }, user: { id: 'actor-user' } },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body.tags, [{ gamertag: 'Mentioned', player_id: 'mentioned-player' }]);
  assert.deepEqual(notifications.map((item) => item.recipientEmail), ['mentioned@example.test']);
  assert.equal(notifications[0].link, '/social?post=post-1');
});

test('PATCH /posts/:id rejects like and comment counter changes outside social actions', async () => {
  const { postRouter } = loadSocialRoutersWithMocks(async () => {
    throw new Error('generic social field edits must not query the database');
  }, [], []);
  const handler = routeHandler(postRouter, 'patch', '/:id');
  const response = makeResponse();

  await handler({ params: { id: 'post-1' }, body: { likes_count: 99 } }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /dedicated social actions/i);
});

test('POST /comments resolves gamertag server-side and notifies owner and mentioned player', async () => {
  const notifications = [];
  const broadcasts = [];
  const created = { id: 'comment-1', post_id: 'post-1', author_email: 'actor@example.test', author_name: 'ActorTag', author_avatar: '/actor.png', content: 'gg @Mentioned' };
  const { commentRouter } = loadSocialRoutersWithMocks(async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) return [{ id: params[0], email: 'actor@example.test', full_name: 'Actor Name' }];
    if (/SELECT \* FROM players WHERE user_id = \?/.test(sql)) return [{ gamertag: 'ActorTag', email: 'actor@example.test', avatar_url: '/actor.png' }];
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [{ id: 'post-1', author_email: 'owner@example.test', comments_count: 0 }];
    if (/INSERT INTO comments/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM comments WHERE id = \?/.test(sql)) return [created];
    if (/UPDATE posts SET/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/.test(sql)) {
      notifications.push({
        recipientEmail: params[1],
        type: params[2],
        title: params[3],
        body: params[4],
        link: params[6],
        relatedId: params[7],
      });
      return { affectedRows: 1 };
    }
    if (/SELECT id, gamertag, email, avatar_url FROM players WHERE gamertag IN/.test(sql)) return [{ id: 'mentioned-player', gamertag: 'Mentioned', email: 'mentioned@example.test' }];
    throw new Error(`Unexpected SQL: ${sql}`);
  }, notifications, broadcasts);

  const handler = routeHandler(commentRouter, 'post', '/');
  const response = makeResponse();
  await handler({ body: { post_id: 'post-1', content: 'gg @Mentioned', author_name: 'Forged' }, user: { id: 'actor-user' } }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.author_name, 'ActorTag');
  assert.deepEqual(notifications.map((item) => item.recipientEmail), ['owner@example.test', 'mentioned@example.test']);
});
