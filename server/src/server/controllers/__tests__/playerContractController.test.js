const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadPlayerContractRouterWithMocks(executesql, deliveryMock) {
  const controllerPath = path.resolve(__dirname, '../playerContractController.js');
  const modelPath = path.resolve(__dirname, '../../models/playerContractModel.js');
  const inboxModelPath = path.resolve(__dirname, '../../models/inboxMessageModel.js');
  const notificationModelPath = path.resolve(__dirname, '../../models/notificationModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const operationsPath = path.resolve(__dirname, '../../services/clubOperationsService.js');
  const deliveryPath = path.resolve(__dirname, '../../services/messageDeliveryService.js');
  const contractRulesPath = path.resolve(__dirname, '../../services/contractRulesService.js');
  const transferWindowServicePath = path.resolve(__dirname, '../../services/transferWindowService.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[inboxModelPath];
  delete require.cache[notificationModelPath];
  delete require.cache[dbPath];
  delete require.cache[operationsPath];
  delete require.cache[deliveryPath];
  delete require.cache[contractRulesPath];
  delete require.cache[transferWindowServicePath];

  class PlayerContractMock {
    constructor(body = {}) {
      this.body = body;
      this.id = body.id || 'contract-1';
    }

    create() {
      return executesql('TEST_CREATE_PLAYER_CONTRACT', [this.id, this.body]);
    }

    selectOne(id) {
      return executesql('TEST_SELECT_PLAYER_CONTRACT', [id]);
    }
  }

  class UnexpectedInboxMessage {
    constructor() {
      throw new Error('playerContractController must not create inbox messages directly');
    }
  }

  class UnexpectedNotification {
    constructor() {
      throw new Error('playerContractController must not create notifications directly');
    }
  }

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: PlayerContractMock,
  };
  require.cache[inboxModelPath] = {
    id: inboxModelPath,
    filename: inboxModelPath,
    loaded: true,
    exports: UnexpectedInboxMessage,
  };
  require.cache[notificationModelPath] = {
    id: notificationModelPath,
    filename: notificationModelPath,
    loaded: true,
    exports: UnexpectedNotification,
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };
  require.cache[operationsPath] = {
    id: operationsPath,
    filename: operationsPath,
    loaded: true,
    exports: {
      requireClubPermission: async () => ({ user: { id: 'owner-user', email: 'owner@example.test' } }),
      writeClubAudit: async () => {},
    },
  };
  require.cache[deliveryPath] = {
    id: deliveryPath,
    filename: deliveryPath,
    loaded: true,
    exports: {
      deliverContractOfferMessage: deliveryMock,
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

test('creating a player contract delegates offer delivery to the central message service', async () => {
  const deliveredContractIds = [];
  const directDeliveryQueries = [];
  const executesql = async (sql, params = []) => {
    if (/CREATE TABLE IF NOT EXISTS transfer_windows/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM transfer_windows WHERE status = 'open'/.test(sql)) return [{ id: 'window-open', status: 'open' }];
    if (/FROM player_contracts/.test(sql) && /status IN/.test(sql)) return [];
    if (sql === 'TEST_CREATE_PLAYER_CONTRACT') return { affectedRows: 1 };
    if (sql === 'TEST_SELECT_PLAYER_CONTRACT') {
      return [{
        id: params[0],
        team_id: 'club-1',
        user_id: 'player-1',
        contract_type: 'squad',
        status: 'pending',
      }];
    }
    if (/FROM player_contracts pc/.test(sql) || /INSERT INTO inbox_messages/.test(sql) || /INSERT INTO notifications/.test(sql)) {
      directDeliveryQueries.push(sql);
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadPlayerContractRouterWithMocks(executesql, async (contractId) => {
    deliveredContractIds.push(contractId);
  });
  const handle = routeHandler(router, 'post', '/');
  const response = makeResponse();

  await handle(
    {
      body: {
        id: 'contract-1',
        team_id: 'club-1',
        user_id: 'player-1',
        contract_type: 'squad',
      },
      user: { id: 'owner-user' },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(deliveredContractIds, ['contract-1']);
  assert.deepEqual(directDeliveryQueries, []);
});

test('creating a player contract rejects new offers while the transfer window is closed', async () => {
  let createCalled = false;
  const executesql = async (sql) => {
    if (/CREATE TABLE IF NOT EXISTS transfer_windows/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM transfer_windows WHERE status = 'open'/.test(sql)) return [];
    if (/FROM player_contracts/.test(sql) && /status IN/.test(sql)) return [];
    if (sql === 'TEST_CREATE_PLAYER_CONTRACT') {
      createCalled = true;
      return { affectedRows: 1 };
    }
    if (sql === 'TEST_SELECT_PLAYER_CONTRACT') return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadPlayerContractRouterWithMocks(executesql, async () => {});
  const handle = routeHandler(router, 'post', '/');
  const response = makeResponse();

  await handle(
    {
      body: {
        team_id: 'club-1',
        user_id: 'player-1',
        contract_type: 'squad',
      },
      user: { id: 'owner-user' },
    },
    response
  );

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'transfer_window_closed');
  assert.equal(createCalled, false);
});

test('creating a player contract rejects duplicate live contract offers for the same club group', async () => {
  let createCalled = false;
  const executesql = async (sql, params = []) => {
    if (/CREATE TABLE IF NOT EXISTS transfer_windows/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM transfer_windows WHERE status = 'open'/.test(sql)) return [{ id: 'window-open', status: 'open' }];
    if (/FROM player_contracts/.test(sql) && /status IN/.test(sql)) {
      return [{
        id: 'active-contract',
        team_id: 'club-1',
        user_id: 'player-1',
        contract_type: 'squad',
        status: 'active',
      }];
    }
    if (sql === 'TEST_CREATE_PLAYER_CONTRACT') {
      createCalled = true;
      return { affectedRows: 1 };
    }
    if (sql === 'TEST_SELECT_PLAYER_CONTRACT') {
      return [{
        id: params[0],
        team_id: 'club-1',
        user_id: 'player-1',
        contract_type: 'squad',
        status: 'pending',
      }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadPlayerContractRouterWithMocks(executesql, async () => {});
  const handle = routeHandler(router, 'post', '/');
  const response = makeResponse();

  await handle(
    {
      body: {
        team_id: 'club-1',
        user_id: 'player-1',
        contract_type: 'star',
      },
      user: { id: 'owner-user' },
    },
    response
  );

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'contract_conflict');
  assert.equal(createCalled, false);
});
