const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadClubApplicantRouterWithMocks(executesql, deliveryMock) {
  const controllerPath = path.resolve(__dirname, '../clubApplicantController.js');
  const modelPath = path.resolve(__dirname, '../../models/clubApplicantModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const operationsPath = path.resolve(__dirname, '../../services/clubOperationsService.js');
  const deliveryPath = path.resolve(__dirname, '../../services/messageDeliveryService.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[dbPath];
  delete require.cache[operationsPath];
  delete require.cache[deliveryPath];

  class ClubApplicantMock {
    constructor(body = {}) {
      this.body = body;
    }

    selectOne(id) {
      return executesql('TEST_SELECT_CLUB_APPLICANT', [id]);
    }

    update(id) {
      return executesql('TEST_UPDATE_CLUB_APPLICANT', [id, this.body]);
    }
  }

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: ClubApplicantMock,
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
      getUser: async () => ({ id: 'owner-user', email: 'owner@example.test', role_id: 1 }),
      isAdmin: () => false,
      getClubAccess: async () => ({ permissions: ['review_applicants', 'offer_contracts'] }),
      requireClubPermission: async () => ({ user: { id: 'owner-user', email: 'owner@example.test', role_id: 1 } }),
      writeClubAudit: async () => {},
      notifyEmail: async () => {},
      getCurrentTransferWindow: async () => ({ id: 'window-open' }),
    },
  };
  require.cache[deliveryPath] = {
    id: deliveryPath,
    filename: deliveryPath,
    loaded: true,
    exports: { deliverContractOfferMessage: deliveryMock },
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

test('offering an applicant contract delegates delivery to the central contract message service', async () => {
  const deliveredContractIds = [];
  const contractInserts = [];
  const applicant = {
    id: 'applicant-1',
    club_id: 'club-1',
    player_id: 'player-1',
    player_email: 'player@example.test',
    club_name: 'Club One',
    status: 'new',
    source_type: 'manual',
    source_id: null,
  };
  const executesql = async (sql, params = []) => {
    if (sql === 'TEST_SELECT_CLUB_APPLICANT') {
      return [{ ...applicant, status: contractInserts.length ? 'contract_offered' : 'new' }];
    }
    if (sql === 'TEST_UPDATE_CLUB_APPLICANT') return { affectedRows: 1 };
    if (/INSERT INTO player_contracts/.test(sql)) {
      contractInserts.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadClubApplicantRouterWithMocks(executesql, async (contractId) => {
    deliveredContractIds.push(contractId);
  });
  const handle = routeHandler(router, 'post', '/:id/offer-contract');
  const response = makeResponse();

  await handle(
    {
      params: { id: 'applicant-1' },
      body: { contract_type: 'squad', weekly_salary_stc: 5000 },
      user: { id: 'owner-user' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(contractInserts.length, 1);
  assert.deepEqual(deliveredContractIds, [contractInserts[0][0]]);
});
