const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadShowcaseRouterWithMocks(executesql, options = {}) {
  const controllerPath = path.resolve(__dirname, '../playerShowcaseVideoController.js');
  const modelPath = path.resolve(__dirname, '../../models/playerShowcaseVideoModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const deliveryPath = path.resolve(__dirname, '../../services/messageDeliveryService.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[dbPath];
  delete require.cache[deliveryPath];

  class ShowcaseVideoMock {
    constructor(body = {}) {
      this.body = body;
      this.id = body.id || 'video-1';
    }
    create() { return executesql('TEST_CREATE_VIDEO', [this.id, this.body]); }
    update(id) { return executesql('TEST_UPDATE_VIDEO', [id, this.body]); }
    delete(id) { return executesql('TEST_DELETE_VIDEO', [id]); }
    selectOne(id) { return executesql('TEST_SELECT_VIDEO', [id]); }
    selectByPlayer(playerId) { return executesql('TEST_SELECT_VIDEOS_BY_PLAYER', [playerId]); }
    static selectScoutingVideos(filters) { return executesql('TEST_SELECT_SCOUTING_VIDEOS', [filters]); }
    static toggleScoutingLike(videoId, userEmail) { return executesql('TEST_TOGGLE_SCOUTING_LIKE', [videoId, userEmail]); }
    static selectScoutingComments(videoId) { return executesql('TEST_SELECT_SCOUTING_COMMENTS', [videoId]); }
    static createScoutingComment(body) { return executesql('TEST_CREATE_SCOUTING_COMMENT', [body]); }
  }

  require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: ShowcaseVideoMock };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { EXECUTESQL: executesql } };
  require.cache[deliveryPath] = {
    id: deliveryPath,
    filename: deliveryPath,
    loaded: true,
    exports: {
      createNotificationIfEnabled: options.createNotificationIfEnabled || (async () => ({ success: true })),
    },
  };

  return require(controllerPath);
}

function routeHandler(router, method, pathName) {
  const layer = router.stack.find((e) => e.route?.path === pathName && e.route.methods[method]);
  return layer.route.stack[0].handle;
}

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
}

function isUserLookup(sql) {
  return /SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)
    && !/full_name/.test(sql);
}
/** "which player rows belong to this account" */
function isOwnPlayersLookup(sql) {
  return /FROM players/.test(sql) && /user_id = \?/.test(sql);
}

test('a player can publish a video on their own showcase', async () => {
  let created = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (sql === 'TEST_CREATE_VIDEO') { created = params[1]; return { affectedRows: 1 }; }
    if (sql === 'TEST_SELECT_VIDEO') return [{ id: params[0], ...created }];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    {
      body: {
        player_id: 'player-1',
        url: 'https://stageleagues.com/uploads/hat-trick.mp4',
        title: 'Hat-trick vs rivals',
        duration_seconds: 9.8,
      },
      user: { id: 'user-1' },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(created.player_id, 'player-1');
  assert.equal(created.url, 'https://stageleagues.com/uploads/hat-trick.mp4');
  assert.equal(created.title, 'Hat-trick vs rivals');
  assert.equal(created.duration_seconds, 9.8);
});

test('a player cannot publish a video onto somebody else profile', async () => {
  const executesql = async (sql) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    // This account owns player-1 only.
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (sql === 'TEST_CREATE_VIDEO') throw new Error('must not write to another player showcase');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    { body: { player_id: 'someone-else', url: '/uploads/clip.mp4', title: 'Clip' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 403);
});

test('a video needs a usable url', async () => {
  const executesql = async (sql) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (sql === 'TEST_CREATE_VIDEO') throw new Error('must not store a blank url');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);

  for (const url of ['', '   ', undefined]) {
    const response = makeResponse();
    await routeHandler(router, 'post', '/')(
      { body: { player_id: 'player-1', url }, user: { id: 'user-1' } },
      response
    );
    assert.equal(response.statusCode, 400, `url ${JSON.stringify(url)} must be refused`);
  }
});

test('a new showcase video needs a title', async () => {
  const executesql = async (sql) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (sql === 'TEST_CREATE_VIDEO') throw new Error('must not store an untitled showcase upload');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    { body: { player_id: 'player-1', url: '/uploads/clip.mp4', title: '   ' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 400);
});

test('new showcase videos must come from uploaded assets, not pasted external links', async () => {
  const executesql = async (sql) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (sql === 'TEST_CREATE_VIDEO') throw new Error('must not store an external showcase link');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    { body: { player_id: 'player-1', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'External link' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 400);
});

test('new showcase videos reject external hosts even when the path looks uploaded', async () => {
  const executesql = async (sql) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (sql === 'TEST_CREATE_VIDEO') throw new Error('must not trust another host uploads path');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    { body: { player_id: 'player-1', url: 'https://example.com/uploads/fake.mp4', title: 'Fake upload' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 400);
});

test('showcase videos must be 60 seconds or shorter when duration is provided', async () => {
  let created = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (sql === 'TEST_CREATE_VIDEO') { created = params[1]; return { affectedRows: 1 }; }
    if (sql === 'TEST_SELECT_VIDEO') return [{ id: 'video-1', ...created }];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const accepted = makeResponse();

  await routeHandler(router, 'post', '/')(
    { body: { player_id: 'player-1', url: '/uploads/clip.mp4', title: 'Limit clip', duration_seconds: 60 }, user: { id: 'user-1' } },
    accepted
  );

  assert.equal(accepted.statusCode, 201);
  assert.equal(created.duration_seconds, 60);
});

test('showcase videos reject anything longer than 60 seconds', async () => {
  const executesql = async (sql) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (sql === 'TEST_CREATE_VIDEO') throw new Error('must not store an overlong showcase video');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    { body: { player_id: 'player-1', url: '/uploads/clip.mp4', title: 'Long clip', duration_seconds: 60.01 }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /60 seconds/);
});

test('anyone signed in can read a player showcase — it is a shop window', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'stranger', email: 'other@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-99' }];
    if (sql === 'TEST_SELECT_VIDEOS_BY_PLAYER') {
      assert.equal(params[0], 'player-1');
      return [{ id: 'video-1', player_id: 'player-1', url: '/uploads/clip.mp4', title: 'Clip' }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'get', '/')(
    { query: { player_id: 'player-1' }, user: { id: 'stranger' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.length, 1);
});

test('only the owner can edit or remove a video', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'stranger', email: 'other@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-99' }];
    if (sql === 'TEST_SELECT_VIDEO') return [{ id: params[0], player_id: 'player-1', url: '/uploads/clip.mp4', title: 'Clip' }];
    if (sql === 'TEST_UPDATE_VIDEO' || sql === 'TEST_DELETE_VIDEO') {
      throw new Error('a stranger must not touch another player showcase');
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);

  const patched = makeResponse();
  await routeHandler(router, 'patch', '/:id')(
    { params: { id: 'video-1' }, body: { description: 'mine now' }, user: { id: 'stranger' } },
    patched
  );
  assert.equal(patched.statusCode, 403);

  const deleted = makeResponse();
  await routeHandler(router, 'delete', '/:id')(
    { params: { id: 'video-1' }, body: {}, user: { id: 'stranger' } },
    deleted
  );
  assert.equal(deleted.statusCode, 403);
});

test('the owner can edit their own video', async () => {
  let updated = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (sql === 'TEST_SELECT_VIDEO') return [{ id: params[0], player_id: 'player-1', url: '/uploads/clip.mp4', title: 'Old title', description: 'old' }];
    if (sql === 'TEST_UPDATE_VIDEO') { updated = params[1]; return { affectedRows: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    { params: { id: 'video-1' }, body: { description: 'Cup final assist' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(updated.description, 'Cup final assist');
  assert.equal(updated.title, 'Old title');
  assert.equal(updated.player_id, 'player-1', 'a patch cannot move a video to another player');
});

test('a patch cannot reassign a video to a different player', async () => {
  let updated = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (sql === 'TEST_SELECT_VIDEO') return [{ id: params[0], player_id: 'player-1', url: '/uploads/clip.mp4', title: 'Clip' }];
    if (sql === 'TEST_UPDATE_VIDEO') { updated = params[1]; return { affectedRows: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    { params: { id: 'video-1' }, body: { player_id: 'victim-player' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(updated.player_id, 'player-1');
});

test('scouting list returns showcase videos joined with player metadata and liked_by_me', async () => {
  let filters = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'scout@example.test', role_id: 2 }];
    if (sql === 'TEST_SELECT_SCOUTING_VIDEOS') {
      filters = params[0];
      return [{
        id: 'video-1',
        title: 'One touch finish',
        url: '/uploads/finish.mp4',
        media_url: '/uploads/finish.mp4',
        duration_seconds: 8.4,
        likes_count: 4,
        comments_count: 2,
        liked_by_me: 1,
        player_id: 'player-1',
        gamertag: 'Finisher',
        avatar_url: '/uploads/avatar.png',
        position: 'ST',
        showcase_position: 'ST',
        country: 'Belgium',
        country_code: 'BE',
      }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'get', '/scouting')(
    { query: { filter: 'trending', position: 'ST', country: 'BE' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(filters, {
    filter: 'trending',
    position: 'ST',
    country: 'BE',
    currentUserEmail: 'scout@example.test',
  });
  assert.equal(response.body[0].gamertag, 'Finisher');
  assert.equal(response.body[0].liked_by_me, true);
});

test('direct showcase video lookup returns current viewer like state', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'scout@example.test', role_id: 2 }];
    if (sql === 'TEST_SELECT_VIDEO') {
      assert.deepEqual(params, ['video-1']);
      return [{
        id: 'video-1',
        player_id: 'player-1',
        title: 'Near post finish',
        url: '/uploads/finish.mp4',
        likes_count: '3',
        comments_count: '2',
      }];
    }
    if (/FROM player_showcase_video_likes/.test(sql)) {
      assert.deepEqual(params, ['video-1', 'scout@example.test']);
      return [{ 1: 1 }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'get', '/:id')(
    { params: { id: 'video-1' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.media_url, '/uploads/finish.mp4');
  assert.equal(response.body.likes_count, 3);
  assert.equal(response.body.comments_count, 2);
  assert.equal(response.body.liked_by_me, true);
});

test('scouting like toggles safely and notifies the video owner on a new like', async () => {
  const notifications = [];
  const ownerVideo = {
    id: 'video-1',
    player_id: 'owner-player',
    title: 'Through ball',
    url: '/uploads/assist.mp4',
    owner_email: 'owner@example.test',
    gamertag: 'Creator',
    likes_count: 1,
    comments_count: 0,
    liked_by_me: false,
  };
  const updatedVideo = { ...ownerVideo, likes_count: 2, liked_by_me: true };
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'scout@example.test', full_name: 'Scout User', role_id: 2 }];
    if (sql === 'TEST_SELECT_VIDEO') return [ownerVideo];
    if (sql === 'TEST_TOGGLE_SCOUTING_LIKE') {
      assert.deepEqual(params, ['video-1', 'scout@example.test']);
      return { liked: true, video: updatedVideo };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql, {
    createNotificationIfEnabled: async (payload) => { notifications.push(payload); return { success: true }; },
  });
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/like')(
    { params: { id: 'video-1' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.likes_count, 2);
  assert.equal(response.body.liked_by_me, true);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].recipientEmail, 'owner@example.test');
  assert.equal(notifications[0].type, 'showcase_like');
  assert.equal(notifications[0].link, '/scouting?video=video-1');
});

test('scouting like does not notify the owner when they like their own video', async () => {
  const notifications = [];
  const ownerVideo = {
    id: 'video-1',
    player_id: 'owner-player',
    title: 'Solo run',
    url: '/uploads/solo.mp4',
    owner_email: 'owner@example.test',
    gamertag: 'Creator',
    likes_count: 0,
    comments_count: 0,
    liked_by_me: false,
  };
  const executesql = async (sql) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'owner@example.test', full_name: 'Owner', role_id: 2 }];
    if (sql === 'TEST_SELECT_VIDEO') return [ownerVideo];
    if (sql === 'TEST_TOGGLE_SCOUTING_LIKE') return { liked: true, video: { ...ownerVideo, likes_count: 1, liked_by_me: true } };
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql, {
    createNotificationIfEnabled: async (payload) => { notifications.push(payload); return { success: true }; },
  });
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/like')(
    { params: { id: 'video-1' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(notifications.length, 0);
});

test('scouting comments use server-resolved Gamertag author and notify the video owner', async () => {
  const notifications = [];
  let createdBody = null;
  const ownerVideo = {
    id: 'video-1',
    player_id: 'owner-player',
    title: 'Press resistant',
    url: '/uploads/press.mp4',
    owner_email: 'owner@example.test',
    gamertag: 'Creator',
    comments_count: 0,
  };
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'scout@example.test', full_name: 'Scout User', role_id: 2 }];
    if (sql === 'TEST_SELECT_VIDEO') return [ownerVideo];
    if (/SELECT id, gamertag, avatar_url FROM players WHERE LOWER\(email\)=LOWER\(\?\) LIMIT 1/.test(sql)) {
      assert.equal(params[0], 'scout@example.test');
      return [{ id: 'scout-player', gamertag: 'SharpScout', avatar_url: '/uploads/scout.png' }];
    }
    if (sql === 'TEST_CREATE_SCOUTING_COMMENT') {
      createdBody = params[0];
      return {
        id: 'comment-1',
        video_id: createdBody.video_id,
        content: createdBody.content,
        author_email: createdBody.author_email,
        author_player_id: createdBody.author_player_id,
        author_name: createdBody.author_name,
        author_avatar_url: createdBody.author_avatar_url,
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql, {
    createNotificationIfEnabled: async (payload) => { notifications.push(payload); return { success: true }; },
  });
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/comments')(
    {
      params: { id: 'video-1' },
      body: { content: 'Clean first touch', author_name: 'Fake Client Name' },
      user: { id: 'user-1' },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(createdBody.author_name, 'SharpScout');
  assert.equal(createdBody.author_email, 'scout@example.test');
  assert.equal(response.body.author_name, 'SharpScout');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].recipientEmail, 'owner@example.test');
  assert.equal(notifications[0].type, 'showcase_comment');
  assert.equal(notifications[0].link, '/scouting?video=video-1&comment=comment-1');
});

test('preferred position lookup uses real users columns, not full_name', async () => {
  let updated = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'user-1', email: 'me@example.test', role_id: 2 }];
    if (isOwnPlayersLookup(sql)) return [{ id: 'player-1' }];
    if (/UPDATE players SET showcase_position/.test(sql)) {
      updated = params;
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadShowcaseRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/position')(
    { body: { player_id: 'player-1', showcase_position: 'CB' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(updated, ['CB', 'player-1']);
  assert.equal(response.body.showcase_position, 'CB');
});
