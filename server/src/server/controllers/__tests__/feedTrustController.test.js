const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadPostRouterWithDbMock(executesql) {
  const controllerPath = path.resolve(__dirname, '../postController.js');
  const modelPath = path.resolve(__dirname, '../../models/postModel.js');
  const notificationModelPath = path.resolve(__dirname, '../../models/notificationModel.js');
  const playerModelPath = path.resolve(__dirname, '../../models/playerModel.js');
  const servicePath = path.resolve(__dirname, '../../services/feedTrustService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[notificationModelPath];
  delete require.cache[playerModelPath];
  delete require.cache[servicePath];
  delete require.cache[socketPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: {
      broadcastPost() {},
      broadcastPostDeleted() {},
    },
  };

  return require(controllerPath);
}

function loadCommentRouterWithDbMock(executesql) {
  const controllerPath = path.resolve(__dirname, '../commentController.js');
  const modelPath = path.resolve(__dirname, '../../models/commentModel.js');
  const postModelPath = path.resolve(__dirname, '../../models/postModel.js');
  const notificationModelPath = path.resolve(__dirname, '../../models/notificationModel.js');
  const playerModelPath = path.resolve(__dirname, '../../models/playerModel.js');
  const servicePath = path.resolve(__dirname, '../../services/feedTrustService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[postModelPath];
  delete require.cache[notificationModelPath];
  delete require.cache[playerModelPath];
  delete require.cache[servicePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(controllerPath);
}

function routeHandler(router, pathPattern, method = null) {
  const layer = router.stack.find((entry) =>
    entry.route?.path === pathPattern
    && (!method || entry.route.methods?.[method])
  );
  return layer?.route.stack[0].handle;
}

function makeJsonResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
}

function makePost(overrides = {}) {
  return {
    id: 'post-1',
    author_email: 'owner@example.test',
    author_name: 'Owner',
    author_avatar: null,
    content: 'Matchday',
    media_url: '/uploads/post.jpg',
    media_cover_url: null,
    media_type: 'image',
    media_position: null,
    media_zoom: null,
    media_aspect: null,
    club_id: null,
    club_name: null,
    tournament_id: null,
    likes: '[]',
    likes_count: 0,
    comments_count: 0,
    tags: null,
    ...overrides,
  };
}

test('POST /:id/like-toggle likes once and unlikes on second toggle', async () => {
  let post = makePost();
  const updates = [];
  const notifications = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [post];
    if (/SELECT \* FROM players WHERE user_id = \?/.test(sql)) {
      return [{ id: 'player-actor', email: 'actor@example.test', gamertag: 'Actor', avatar_url: '/avatar.png' }];
    }
    if (/UPDATE posts SET/.test(sql)) {
      updates.push(params);
      post = { ...post, likes: params[10], likes_count: params[11] };
      return { affectedRows: 1 };
    }
    if (/INSERT INTO notifications/.test(sql)) {
      notifications.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadPostRouterWithDbMock(executesql);
  const handle = routeHandler(router, '/:id/like-toggle', 'post');
  assert.ok(handle, 'like-toggle route should exist');

  const first = makeJsonResponse();
  await handle({ params: { id: 'post-1' }, body: {}, user: { id: 'actor-user', email: 'actor@example.test' } }, first);

  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.body.post.likes, ['actor@example.test']);
  assert.equal(first.body.post.likes_count, 1);

  const second = makeJsonResponse();
  await handle({ params: { id: 'post-1' }, body: {}, user: { id: 'actor-user', email: 'actor@example.test' } }, second);

  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.body.post.likes, []);
  assert.equal(second.body.post.likes_count, 0);
  assert.equal(updates.length, 2);
  assert.equal(notifications.length, 1);
});

test('POST /:id/like-toggle skips like notification for post owner', async () => {
  let post = makePost({ author_email: 'owner@example.test' });
  const notifications = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [post];
    if (/SELECT \* FROM players WHERE user_id = \?/.test(sql)) {
      return [{ id: 'owner-player', email: 'owner@example.test', gamertag: 'Owner', avatar_url: null }];
    }
    if (/UPDATE posts SET/.test(sql)) {
      post = { ...post, likes: params[10], likes_count: params[11] };
      return { affectedRows: 1 };
    }
    if (/INSERT INTO notifications/.test(sql)) {
      notifications.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadPostRouterWithDbMock(executesql);
  const handle = routeHandler(router, '/:id/like-toggle', 'post');
  const response = makeJsonResponse();

  await handle({ params: { id: 'post-1' }, body: {}, user: { id: 'owner-user', email: 'owner@example.test' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(notifications.length, 0);
});

test('POST /comments creates comment, increments post count, and notifies non-owner', async () => {
  let post = makePost({ comments_count: 2 });
  const notifications = [];
  const inserts = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [post];
    if (/SELECT \* FROM players WHERE user_id = \?/.test(sql)) {
      return [{ id: 'player-actor', email: 'actor@example.test', gamertag: 'Actor', avatar_url: '/avatar.png' }];
    }
    if (/INSERT INTO comments/.test(sql)) {
      inserts.push(params);
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM comments WHERE id = \?/.test(sql)) {
      return [{
        id: params[0],
        post_id: 'post-1',
        author_email: 'actor@example.test',
        author_name: 'Actor',
        author_avatar: '/avatar.png',
        content: 'Great result',
      }];
    }
    if (/UPDATE posts SET/.test(sql)) {
      post = { ...post, comments_count: params[12] };
      return { affectedRows: 1 };
    }
    if (/INSERT INTO notifications/.test(sql)) {
      notifications.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadCommentRouterWithDbMock(executesql);
  const handle = routeHandler(router, '/', 'post');
  const response = makeJsonResponse();

  await handle(
    {
      body: {
        post_id: 'post-1',
        author_email: 'spoof@example.test',
        author_name: 'Spoof',
        content: 'Great result',
      },
      user: { id: 'actor-user', email: 'actor@example.test' },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(inserts[0][2], 'actor@example.test');
  assert.equal(inserts[0][3], 'Actor');
  assert.equal(response.body.post.comments_count, 3);
  assert.equal(notifications.length, 1);
});

test('POST /comments skips comment notification for post owner', async () => {
  let post = makePost({ author_email: 'owner@example.test', comments_count: 0 });
  const notifications = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [post];
    if (/SELECT \* FROM players WHERE user_id = \?/.test(sql)) {
      return [{ id: 'owner-player', email: 'owner@example.test', gamertag: 'Owner', avatar_url: null }];
    }
    if (/INSERT INTO comments/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM comments WHERE id = \?/.test(sql)) {
      return [{ id: params[0], post_id: 'post-1', author_email: 'owner@example.test', content: 'My update' }];
    }
    if (/UPDATE posts SET/.test(sql)) {
      post = { ...post, comments_count: params[12] };
      return { affectedRows: 1 };
    }
    if (/INSERT INTO notifications/.test(sql)) {
      notifications.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadCommentRouterWithDbMock(executesql);
  const handle = routeHandler(router, '/', 'post');
  const response = makeJsonResponse();

  await handle(
    { body: { post_id: 'post-1', content: 'My update' }, user: { id: 'owner-user', email: 'owner@example.test' } },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(notifications.length, 0);
});

test('POST /posts rejects new video feed posts', async () => {
  const router = loadPostRouterWithDbMock(async () => {
    throw new Error('No SQL should run for rejected video posts');
  });
  const handle = routeHandler(router, '/', 'post');
  const response = makeJsonResponse();

  await handle(
    { body: { content: 'clip', media_type: 'video', media_url: '/uploads/clip.mp4' }, user: { id: 'user-1', email: 'user@example.test' } },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'Video uploads are not supported yet. Please upload an image.');
});

test('POST /posts preserves image framing metadata', async () => {
  const inserts = [];
  let createdPost = null;
  const router = loadPostRouterWithDbMock(async (sql, params = []) => {
    if (/INSERT INTO posts/.test(sql)) {
      inserts.push(params);
      createdPost = makePost({
        id: params[0],
        media_position: params[15],
        media_zoom: params[16],
        media_aspect: params[17],
      });
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [createdPost];
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const handle = routeHandler(router, '/', 'post');
  const response = makeJsonResponse();

  await handle(
    {
      body: {
        author_email: 'owner@example.test',
        author_name: 'Owner',
        content: 'Framed moment',
        media_url: '/uploads/post.jpg',
        media_type: 'image',
        media_position: '42% 58%',
        media_zoom: 137,
        media_aspect: 'square',
      },
      user: { id: 'owner-user', email: 'owner@example.test' },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(inserts[0][15], '42% 58%');
  assert.equal(inserts[0][16], 137);
  assert.equal(inserts[0][17], 'square');
  assert.equal(response.body.media_position, '42% 58%');
  assert.equal(response.body.media_zoom, 137);
  assert.equal(response.body.media_aspect, 'square');
});

test('PATCH /posts/:id rejects changing feed post media to video', async () => {
  const router = loadPostRouterWithDbMock(async (sql) => {
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [makePost()];
    throw new Error('No write SQL should run for rejected video updates');
  });
  const handle = routeHandler(router, '/:id', 'patch');
  const response = makeJsonResponse();

  await handle(
    { params: { id: 'post-1' }, body: { media_type: 'video', media_url: '/uploads/clip.mp4' }, user: { id: 'user-1', email: 'user@example.test' } },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'Video uploads are not supported yet. Please upload an image.');
});

test('PATCH /posts/:id rejects server-owned likes and comment counts', async () => {
  const existingPost = makePost({
    likes: '["owner@example.test"]',
    likes_count: 1,
    comments_count: 4,
  });
  const router = loadPostRouterWithDbMock(async (sql, params = []) => {
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [existingPost];
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const handle = routeHandler(router, '/:id', 'patch');
  const response = makeJsonResponse();

  await handle(
    {
      params: { id: 'post-1' },
      body: {
        content: 'Updated caption',
        likes: ['attacker@example.test'],
        likes_count: 99,
        comments_count: 99,
      },
      user: { id: 'user-1', email: 'user@example.test' },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /dedicated social actions/i);
});

test('PATCH /posts/:id updates image framing metadata without changing server-owned counts', async () => {
  const existingPost = makePost({
    likes: '["owner@example.test"]',
    likes_count: 1,
    comments_count: 4,
    media_position: '50% 50%',
    media_zoom: 100,
    media_aspect: 'square',
  });
  const updates = [];
  const router = loadPostRouterWithDbMock(async (sql, params = []) => {
    if (/SELECT \* FROM posts WHERE id = \?/.test(sql)) return [existingPost];
    if (/UPDATE posts SET/.test(sql)) {
      updates.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const handle = routeHandler(router, '/:id', 'patch');
  const response = makeJsonResponse();

  await handle(
    {
      params: { id: 'post-1' },
      body: {
        media_position: '30% 70%',
        media_zoom: 180,
        media_aspect: 'square',
      },
      user: { id: 'user-1', email: 'user@example.test' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(updates[0][11], 1);
  assert.equal(updates[0][12], 4);
  assert.equal(updates[0][14], '30% 70%');
  assert.equal(updates[0][15], 180);
  assert.equal(updates[0][16], 'square');
});
