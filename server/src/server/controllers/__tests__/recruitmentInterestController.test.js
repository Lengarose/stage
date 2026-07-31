const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadRecruitmentInterestRouterWithMocks(executesql, deliveryMock) {
  const controllerPath = path.resolve(__dirname, '../recruitmentInterestController.js');
  const modelPath = path.resolve(__dirname, '../../models/recruitmentInterestModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const deliveryPath = path.resolve(__dirname, '../../services/messageDeliveryService.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[dbPath];
  delete require.cache[deliveryPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };
  require.cache[deliveryPath] = {
    id: deliveryPath,
    filename: deliveryPath,
    loaded: true,
    exports: {
      sendActionMessage: deliveryMock,
    },
  };

  return require(controllerPath);
}

function routeHandler(router, method, pathName) {
  const layer = router.stack.find((entry) => entry.route?.path === pathName && entry.route.methods[method]);
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

test('creating a recruitment interest delivers the actionable inbox through the central message service', async () => {
  const queries = [];
  const deliveries = [];
  let createdInterestId = null;
  const executesql = async (sql, params = []) => {
    queries.push({ sql, params });
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'sender-user', email: 'sender@example.test', role_id: 1 }];
    }
    if (/SELECT \* FROM recruitment_posts WHERE id = \? LIMIT 1/.test(sql)) {
      return [{
        id: 'post-1',
        title: 'Looking for striker',
        author_user_id: 'owner-user',
        author_player_id: null,
        author_club_id: 'club-1',
      }];
    }
    if (/SELECT id, gamertag FROM players WHERE user_id = \?/.test(sql)) {
      return [{ id: 'sender-player', gamertag: 'SenderNine' }];
    }
    if (/INSERT INTO recruitment_interests/.test(sql)) {
      createdInterestId = params[0];
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM recruitment_interests WHERE id = \?/.test(sql)) {
      return [{
        id: createdInterestId,
        recruitment_post_id: 'post-1',
        sender_user_id: 'sender-user',
        sender_player_id: 'sender-player',
        sender_club_id: null,
        recipient_user_id: 'owner-user',
        recipient_player_id: null,
        recipient_club_id: 'club-1',
        message: 'I am interested.',
        status: 'pending',
      }];
    }
    if (/SELECT email FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ email: 'owner@example.test' }];
    }
    if (/SELECT gamertag AS name FROM players WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ name: 'SenderNine' }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadRecruitmentInterestRouterWithMocks(executesql, async (payload) => {
    deliveries.push(payload);
    return { success: true, message: { id: 'inbox-1' } };
  });
  const handle = routeHandler(router, 'post', '/');
  const response = makeResponse();

  await handle(
    {
      body: {
        recruitment_post_id: 'post-1',
        message: 'I am interested.',
      },
      user: { id: 'sender-user' },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.id, createdInterestId);
  assert.equal(queries.some(({ sql }) => /INSERT INTO inbox_messages/.test(sql)), false);
  assert.equal(queries.some(({ sql }) => /INSERT INTO notifications/.test(sql)), false);
  assert.equal(deliveries.length, 1);
  assert.deepEqual(deliveries[0], {
    recipientEmail: 'owner@example.test',
    senderEmail: 'sender@example.test',
    senderGamertag: 'SenderNine',
    subject: 'Recruitment interest: Looking for striker',
    body: 'I am interested.',
    messageType: 'recruitment_interest',
    actionType: 'recruitment_interest_response',
    relatedEntityId: createdInterestId,
    relatedEntityType: 'recruitment_interest',
    idempotencyKey: `recruitment_interest:recruitment_interest:${createdInterestId}:owner@example.test`,
    notification: {
      type: 'club_update',
      title: 'Recruitment interest: Looking for striker',
      body: 'I am interested.',
    },
  });
});

test('creating a recruitment interest fails when the actionable inbox cannot be delivered', async () => {
  const originalConsoleError = console.error;
  const notificationInserts = [];
  let createdInterestId = null;
  const executesql = async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'sender-user', email: 'sender@example.test', role_id: 1 }];
    }
    if (/SELECT \* FROM recruitment_posts WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'post-1', title: 'Looking for striker', author_user_id: 'owner-user' }];
    }
    if (/SELECT id, gamertag FROM players WHERE user_id = \?/.test(sql)) {
      return [{ id: 'sender-player', gamertag: 'SenderNine' }];
    }
    if (/INSERT INTO recruitment_interests/.test(sql)) {
      createdInterestId = params[0];
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM recruitment_interests WHERE id = \?/.test(sql)) {
      return [{
        id: createdInterestId,
        recruitment_post_id: 'post-1',
        sender_user_id: 'sender-user',
        sender_player_id: 'sender-player',
        recipient_user_id: 'owner-user',
        message: 'I am interested.',
        status: 'pending',
      }];
    }
    if (/SELECT email FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ email: 'owner@example.test' }];
    }
    if (/SELECT gamertag AS name FROM players WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ name: 'SenderNine' }];
    }
    if (/INSERT INTO notifications/.test(sql)) {
      notificationInserts.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadRecruitmentInterestRouterWithMocks(executesql, async () => {
    throw new Error('delivery failed');
  });
  const handle = routeHandler(router, 'post', '/');
  const response = makeResponse();

  console.error = () => {};
  try {
    await handle(
      {
        body: {
          recruitment_post_id: 'post-1',
          message: 'I am interested.',
        },
        user: { id: 'sender-user' },
      },
      response
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.equal(notificationInserts.length, 0);
});
