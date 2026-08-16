const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadFunctionsRouterWithDbMock(executesql, { stripePost } = {}) {
  const controllerPath = path.resolve(__dirname, '../functionsController.js');
  const legacyFunctionsPath = path.resolve(__dirname, '../../functions/legacyFunctions.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const axiosPath = require.resolve('axios');
  const identityServicePath = path.resolve(__dirname, '../../services/identityService.js');
  const clubOperationsServicePath = path.resolve(__dirname, '../../services/clubOperationsService.js');
  const clubContactServicePath = path.resolve(__dirname, '../../services/clubContactService.js');
  const messageDeliveryServicePath = path.resolve(__dirname, '../../services/messageDeliveryService.js');
  const contractRulesServicePath = path.resolve(__dirname, '../../services/contractRulesService.js');
  const transferWindowServicePath = path.resolve(__dirname, '../../services/transferWindowService.js');
  const clubFinanceServicePath = path.resolve(__dirname, '../../services/clubFinanceService.js');
  const clubMembershipServicePath = path.resolve(__dirname, '../../services/clubMembershipService.js');
  const presidentResolutionServicePath = path.resolve(__dirname, '../../services/presidentResolutionService.js');
  const scoreProofServicePath = path.resolve(__dirname, '../../services/scoreProofService.js');
  const servicePath = path.resolve(__dirname, '../../services/competitionEngineService.js');
  const matchModelPath = path.resolve(__dirname, '../../models/matchModel.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  for (const cached of [
    controllerPath, legacyFunctionsPath, identityServicePath, clubOperationsServicePath,
    clubContactServicePath, messageDeliveryServicePath, contractRulesServicePath,
    transferWindowServicePath, clubFinanceServicePath, clubMembershipServicePath,
    presidentResolutionServicePath, scoreProofServicePath, servicePath, matchModelPath, socketPath,
  ]) {
    delete require.cache[cached];
  }

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  require.cache[axiosPath] = {
    id: axiosPath,
    filename: axiosPath,
    loaded: true,
    exports: {
      default: {
        post: stripePost || (async () => ({ data: {} })),
        get: async () => ({ data: {} }),
      },
    },
  };
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      notifyIfPhaseReady: async () => ({ notified: false }),
      syncMatchResultToSource: async () => ({ synced: false }),
      advanceAfterFinalResult: async () => ({ triggered: false }),
    },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: {
      broadcastMatch() {},
      broadcastMatchById() {},
      broadcastNotification() {},
      broadcastInbox() {},
      broadcastMatchPlayerStat() {},
      broadcastTransferWindow() {},
    },
  };

  return require(controllerPath);
}

function postFunctionHandler(router) {
  const layer = router.stack.find((entry) => entry.route?.path === '/:name');
  return layer.route.stack[0].handle;
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

function playerRow(overrides = {}) {
  return {
    id: 'player-1',
    user_id: 'user-1',
    email: 'plus@example.test',
    subscription: 'stage_plus',
    subscription_expires_at: '2026-09-13T12:00:00.000Z',
    subscription_cancel_at_period_end: 0,
    stripe_subscription_id: 'sub_123',
    stripe_customer_id: 'cus_123',
    ...overrides,
  };
}

function mockIdentitySql(player) {
  return async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'user-1', email: player.email, player_id: player.id, owner_id: null, role_id: 1, role: 'user' }];
    }
    if (/FROM players WHERE id = \?/.test(sql)) return [player];
    if (/UPDATE players/.test(sql) && /subscription_cancel_at_period_end = 1/.test(sql)) {
      player.subscription_cancel_at_period_end = 1;
      if (params[0]) player.subscription_expires_at = params[0];
      return { affectedRows: 1 };
    }
    return [];
  };
}

test('cancelStagePlus tells Stripe to stop renewals and keeps Plus until period end', async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_cancel';
  const player = playerRow();
  const stripeCalls = [];
  const stripePost = async (url, body) => {
    stripeCalls.push({ url, body: String(body) });
    return { data: { id: 'sub_123', cancel_at_period_end: true, current_period_end: 1789296000, status: 'active' } };
  };

  try {
    const router = loadFunctionsRouterWithDbMock(mockIdentitySql(player), { stripePost });
    const handle = postFunctionHandler(router);
    const response = makeJsonResponse();
    await handle({ params: { name: 'cancelStagePlus' }, body: {}, user: { id: 'user-1' } }, response);

    assert.equal(response.statusCode, 200, response.body?.error);
    assert.equal(response.body.data.success, true);
    assert.equal(response.body.data.cancel_at_period_end, true);
    assert.equal(response.body.data.stripe_stopped, true);
    assert.equal(player.subscription, 'stage_plus');
    assert.equal(player.subscription_cancel_at_period_end, 1);
    assert.equal(stripeCalls.length, 1);
    assert.match(stripeCalls[0].url, /\/v1\/subscriptions\/sub_123$/);
    assert.match(stripeCalls[0].body, /cancel_at_period_end=true/);
  } finally {
    process.env.STRIPE_SECRET_KEY = previousKey;
  }
});

test('cancelStagePlus works for admin-granted Plus with no Stripe subscription', async () => {
  const player = playerRow({ stripe_subscription_id: null, stripe_customer_id: null });
  const stripeCalls = [];
  const router = loadFunctionsRouterWithDbMock(mockIdentitySql(player), {
    stripePost: async (...args) => {
      stripeCalls.push(args);
      return { data: {} };
    },
  });
  const handle = postFunctionHandler(router);
  const response = makeJsonResponse();
  await handle({ params: { name: 'cancelStagePlus' }, body: {}, user: { id: 'user-1' } }, response);

  assert.equal(response.statusCode, 200, response.body?.error);
  assert.equal(response.body.data.success, true);
  assert.equal(response.body.data.stripe_stopped, false);
  assert.equal(player.subscription_cancel_at_period_end, 1);
  assert.equal(stripeCalls.length, 0);
});
