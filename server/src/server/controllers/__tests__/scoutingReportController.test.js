const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadScoutingRouterWithMocks(executesql) {
  const controllerPath = path.resolve(__dirname, '../scoutingReportController.js');
  const modelPath = path.resolve(__dirname, '../../models/scoutingReportModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  // The audit service closes over EXECUTESQL at require time, so it has to be
  // reloaded alongside the db mock — otherwise every test after the first writes
  // its audit rows into the *first* test's mock.
  const auditServicePath = path.resolve(__dirname, '../../services/clubOperationsService.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[dbPath];
  delete require.cache[auditServicePath];

  class ScoutingReportMock {
    constructor(body = {}) {
      this.body = body;
      this.id = body.id || 'report-1';
    }

    create() {
      return executesql('TEST_CREATE_SCOUTING_REPORT', [this.id, this.body]);
    }

    selectOne(id) {
      return executesql('TEST_SELECT_SCOUTING_REPORT', [id]);
    }

    selectByClub(clubId, query) {
      return executesql('TEST_SELECT_SCOUTING_REPORTS_BY_CLUB', [clubId, query]);
    }

    update(id) {
      return executesql('TEST_UPDATE_SCOUTING_REPORT', [id, this.body]);
    }

    // Mirrors the real model: link cleaning lives in one place, and the
    // controller validates through it.
    static cleanVideoLinks(value) {
      const links = Array.isArray(value) ? value : (value ? [value] : []);
      return links.map((link) => String(link || '').trim()).filter(Boolean);
    }
  }

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: ScoutingReportMock,
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
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

/** Matches the user lookup every controller in this repo does first. */
function isUserLookup(sql) {
  return /SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql);
}

/** Matches the "which club is this user a playing member of" lookup. */
function isMemberClubLookup(sql) {
  return /FROM players/.test(sql) && /club_id/.test(sql);
}

test('a club member can file a scouting report, and the club is taken from their membership not the request body', async () => {
  let createdBody = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'scout-user', email: 'scout@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'scout-player', club_id: 'club-1' }];
    if (/FROM players WHERE id = \?/.test(sql)) return [{ id: 'target-player', club_id: 'club-9' }];
    if (/FROM player_showcase_videos/.test(sql)) return [{ n: 1 }];
    if (sql === 'TEST_CREATE_SCOUTING_REPORT') { createdBody = params[1]; return { affectedRows: 1 }; }
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') return [{ id: params[0], ...createdBody }];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    {
      // A hostile client claims a club it does not belong to — it must be ignored.
      body: {
        club_id: 'club-666',
        target_player_id: 'target-player',
      },
      user: { id: 'scout-user' },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(createdBody.club_id, 'club-1', 'club must come from the scout membership, never the request body');
  assert.equal(createdBody.scouted_by_player_id, 'scout-player');
  assert.equal(createdBody.scouted_by_user_id, 'scout-user');
});

test('a player with no club cannot file a scouting report', async () => {
  const executesql = async (sql) => {
    if (isUserLookup(sql)) return [{ id: 'free-agent-user', email: 'free@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [];
    if (sql === 'TEST_CREATE_SCOUTING_REPORT') throw new Error('must not create a report for a clubless player');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    {
      body: { target_player_id: 'target-player' },
      user: { id: 'free-agent-user' },
    },
    response
  );

  assert.equal(response.statusCode, 403);
});

test('a player with no showcase video cannot be scouted, and the refusal says why', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'scout-user', email: 'scout@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'scout-player', club_id: 'club-1' }];
    if (/FROM players WHERE id = \?/.test(sql)) return [{ id: 'target-player', club_id: null }];
    // The target has published nothing, so the club would have nothing to judge.
    if (/FROM player_showcase_videos/.test(sql)) return [{ n: 0 }];
    if (sql === 'TEST_CREATE_SCOUTING_REPORT') throw new Error('must not scout a player with an empty showcase');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    { body: { target_player_id: 'target-player' }, user: { id: 'scout-user' } },
    response
  );

  assert.equal(response.statusCode, 409);
  assert.match(String(response.body.error), /video/i, 'the message must explain the showcase is empty');
});

test('a scouting report no longer carries video links — it points at the player showcase', async () => {
  let created = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'scout-user', email: 'scout@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'scout-player', club_id: 'club-1' }];
    if (/FROM players WHERE id = \?/.test(sql)) return [{ id: 'target-player', club_id: null }];
    if (/FROM player_showcase_videos/.test(sql)) return [{ n: 2 }];
    if (sql === 'TEST_CREATE_SCOUTING_REPORT') { created = params[1]; return { affectedRows: 1 }; }
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') return [{ id: params[0], ...created }];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    {
      // Even if a client sends links, they must not become part of the report:
      // footage belongs to the player, not to whoever filed the report.
      body: { target_player_id: 'target-player', video_links: ['https://scout-supplied.example/clip'], notes: 'Great movement' },
      user: { id: 'scout-user' },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(created.notes, 'Great movement');
  assert.deepEqual(created.video_links ?? [], [], 'the scout cannot attach footage to the report');
});

test('a scouting report needs a target player', async () => {
  const executesql = async (sql) => {
    if (isUserLookup(sql)) return [{ id: 'scout-user', email: 'scout@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'scout-player', club_id: 'club-1' }];
    if (/FROM players WHERE id = \?/.test(sql)) return [{ id: 'target-player', club_id: null }];
    if (sql === 'TEST_CREATE_SCOUTING_REPORT') throw new Error('must not create an incomplete report');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);

  const noTarget = makeResponse();
  await routeHandler(router, 'post', '/')(
    { body: {}, user: { id: 'scout-user' } },
    noTarget
  );
  assert.equal(noTarget.statusCode, 400);
});

test('a player already under contract at another club can still be scouted', async () => {
  let createdBody = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'scout-user', email: 'scout@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'scout-player', club_id: 'club-1' }];
    // Target is a signed player at a rival club — scouting must not care.
    if (/FROM players WHERE id = \?/.test(sql)) return [{ id: 'rival-player', club_id: 'club-2' }];
    if (/FROM player_showcase_videos/.test(sql)) return [{ n: 1 }];
    if (sql === 'TEST_CREATE_SCOUTING_REPORT') { createdBody = params[1]; return { affectedRows: 1 }; }
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') return [{ id: params[0], ...createdBody }];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    {
      body: { target_player_id: 'rival-player' },
      user: { id: 'scout-user' },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(createdBody.target_player_id, 'rival-player');
});

test('listing returns only the reports of the club the caller belongs to', async () => {
  let askedClubId = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'scout-user', email: 'scout@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'scout-player', club_id: 'club-1' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORTS_BY_CLUB') {
      askedClubId = params[0];
      return [{ id: 'report-1', club_id: 'club-1', target_player_id: 'target-player', video_links: '["https://x"]' }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  // Caller asks for a club that is not theirs — they must get their own club's reports, not that one's.
  await routeHandler(router, 'get', '/')(
    { query: { club_id: 'club-2' }, user: { id: 'scout-user' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(askedClubId, 'club-1', 'listing must be scoped to the caller own club');
});

test('a player with no club gets no scouting reports', async () => {
  const executesql = async (sql) => {
    if (isUserLookup(sql)) return [{ id: 'free-agent-user', email: 'free@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [];
    if (sql === 'TEST_SELECT_SCOUTING_REPORTS_BY_CLUB') throw new Error('must not query reports for a clubless player');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'get', '/')({ query: {}, user: { id: 'free-agent-user' } }, response);

  assert.equal(response.statusCode, 403);
});

/** Matches the "is this user the president of that club" lookup. */
function isPresidentLookup(sql) {
  return /FROM clubs WHERE id = \?/.test(sql) && /president_user_id/.test(sql);
}

test('the president can open a vote on a report', async () => {
  let statusWrite = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'prez-user', email: 'prez@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'prez-player', club_id: 'club-1' }];
    if (isPresidentLookup(sql)) return [{ id: 'club-1' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{ id: params[0], club_id: 'club-1', status: statusWrite?.[0] || 'open', video_links: ['https://x'] }];
    }
    if (/UPDATE scouting_reports SET status/.test(sql)) { statusWrite = params; return { affectedRows: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/open-vote')(
    { params: { id: 'report-1' }, body: {}, user: { id: 'prez-user' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(statusWrite[0], 'voting');
  // The write re-checks the state it was allowed to leave, so two clicks race safely.
  assert.equal(statusWrite[2], 'open');
});

test('an ordinary member cannot open a vote', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'member-user', email: 'member@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'member-player', club_id: 'club-1' }];
    if (isPresidentLookup(sql)) return []; // not the president
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{ id: params[0], club_id: 'club-1', status: 'open', video_links: ['https://x'] }];
    }
    if (/UPDATE scouting_reports SET status/.test(sql)) throw new Error('a member must not change the vote state');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/open-vote')(
    { params: { id: 'report-1' }, body: {}, user: { id: 'member-user' } },
    response
  );

  assert.equal(response.statusCode, 403);
});

test('a member cannot end a running vote by patching the status field', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'member-user', email: 'member@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'member-player', club_id: 'club-1' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{ id: params[0], club_id: 'club-1', status: 'voting', video_links: ['https://x'] }];
    }
    if (sql === 'TEST_UPDATE_SCOUTING_REPORT') throw new Error('a running vote must not be closed by a PATCH');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    { params: { id: 'report-1' }, body: { status: 'archived' }, user: { id: 'member-user' } },
    response
  );

  // A PATCH cannot move the report's state at all — the state machine belongs to
  // the dedicated endpoints, each with its own permission rule.
  assert.equal(response.statusCode, 400);
});

test('a vote that lands just after the president closed the vote is rejected', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'member-user', email: 'member@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'member-player', club_id: 'club-1' }];
    // The read still says the vote is open...
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{ id: params[0], club_id: 'club-1', status: 'voting', votes: {}, video_links: ['https://x'] }];
    }
    // ...but by write time the president has closed it, so the guarded UPDATE
    // matches no row.
    if (/JSON_SET/.test(sql)) {
      assert.match(sql, /status = 'voting'/, 'the vote write must re-check the state');
      return { affectedRows: 0 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/vote')(
    { params: { id: 'report-1' }, body: { vote: 'for' }, user: { id: 'member-user' } },
    response
  );

  assert.equal(response.statusCode, 409);
});

test('a club member can cast a vote while the vote is open', async () => {
  let voteWrite = null;
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'member-user', email: 'member@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'member-player', club_id: 'club-1' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{ id: params[0], club_id: 'club-1', status: 'voting', votes: {}, video_links: ['https://x'] }];
    }
    if (/JSON_SET/.test(sql)) { voteWrite = { sql, params }; return { affectedRows: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/vote')(
    { params: { id: 'report-1' }, body: { vote: 'for' }, user: { id: 'member-user' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.ok(voteWrite, 'the vote must be written');
  // Keyed by the voter's player id, so a second vote overwrites the first rather
  // than adding one — and JSON_SET keeps concurrent voters from clobbering.
  assert.match(voteWrite.sql, /JSON_SET/);
  assert.equal(voteWrite.params[0], '$."member-player"');
  assert.equal(voteWrite.params[1], 'for');
});

test('a vote value outside for/against is refused', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'member-user', email: 'member@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'member-player', club_id: 'club-1' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{ id: params[0], club_id: 'club-1', status: 'voting', votes: {}, video_links: ['https://x'] }];
    }
    if (/JSON_SET/.test(sql)) throw new Error('must not write a bogus vote');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/vote')(
    { params: { id: 'report-1' }, body: { vote: 'maybe' }, user: { id: 'member-user' } },
    response
  );

  assert.equal(response.statusCode, 400);
});

test('a member of another club cannot vote', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'outsider-user', email: 'outsider@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'outsider-player', club_id: 'club-2' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{ id: params[0], club_id: 'club-1', status: 'voting', votes: {}, video_links: ['https://x'] }];
    }
    if (/JSON_SET/.test(sql)) throw new Error('an outsider must not vote');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/vote')(
    { params: { id: 'report-1' }, body: { vote: 'for' }, user: { id: 'outsider-user' } },
    response
  );

  assert.equal(response.statusCode, 403);
});

test('voting on a report whose vote is not open is refused', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'member-user', email: 'member@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'member-player', club_id: 'club-1' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{ id: params[0], club_id: 'club-1', status: 'open', votes: {}, video_links: ['https://x'] }];
    }
    if (/JSON_SET/.test(sql)) throw new Error('must not vote before the vote is opened');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/vote')(
    { params: { id: 'report-1' }, body: { vote: 'for' }, user: { id: 'member-user' } },
    response
  );

  assert.equal(response.statusCode, 409);
});

/**
 * Builds the SQL mock for the president decision tests: a president of club-1
 * looking at report-1, which targets `targetPlayerId`.
 */
function decisionMock({ contractRow, onWrite, isPresident = true, targetPlayerId = 'target-player' }) {
  return async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'prez-user', email: 'prez@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'prez-player', club_id: 'club-1' }];
    if (isPresidentLookup(sql)) return isPresident ? [{ id: 'club-1' }] : [];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{
        id: params[0], club_id: 'club-1', status: 'open',
        target_player_id: targetPlayerId, video_links: ['https://x'],
      }];
    }
    if (/FROM player_contracts/.test(sql)) return contractRow ? [contractRow] : [];
    if (/UPDATE scouting_reports/.test(sql)) { onWrite?.({ sql, params }); return { affectedRows: 1 }; }
    if (/INSERT INTO club_operation_audit_logs/.test(sql)) { onWrite?.({ sql, params, audit: true }); return { affectedRows: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
}

test('the president marks a report as offered, and the decision is audited', async () => {
  const writes = [];
  const router = loadScoutingRouterWithMocks(decisionMock({
    contractRow: { id: 'contract-1', team_id: 'club-1', user_id: 'target-player' },
    onWrite: (w) => writes.push(w),
  }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/mark-offered')(
    { params: { id: 'report-1' }, body: { contract_id: 'contract-1' }, user: { id: 'prez-user' } },
    response
  );

  assert.equal(response.statusCode, 200);
  const statusWrite = writes.find((w) => /UPDATE scouting_reports/.test(w.sql));
  assert.ok(statusWrite, 'the report must be updated');
  assert.equal(statusWrite.params[0], 'offered');
  assert.equal(statusWrite.params[1], 'contract-1');
  assert.ok(writes.some((w) => w.audit), 'the decision must be written to the club audit log');
});

test('a contract belonging to another club cannot be pinned to a report', async () => {
  const router = loadScoutingRouterWithMocks(decisionMock({
    // Right player, but the contract was raised by a different club.
    contractRow: { id: 'contract-1', team_id: 'club-999', user_id: 'target-player' },
    onWrite: () => { throw new Error('must not accept another club contract'); },
  }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/mark-offered')(
    { params: { id: 'report-1' }, body: { contract_id: 'contract-1' }, user: { id: 'prez-user' } },
    response
  );

  assert.equal(response.statusCode, 400);
});

test('a contract for a different player cannot be pinned to a report', async () => {
  const router = loadScoutingRouterWithMocks(decisionMock({
    // Right club, but this contract is for somebody else entirely.
    contractRow: { id: 'contract-1', team_id: 'club-1', user_id: 'someone-else' },
    onWrite: () => { throw new Error('must not accept a contract for another player'); },
  }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/mark-offered')(
    { params: { id: 'report-1' }, body: { contract_id: 'contract-1' }, user: { id: 'prez-user' } },
    response
  );

  assert.equal(response.statusCode, 400);
});

test('a non-president member cannot mark a report as offered', async () => {
  const router = loadScoutingRouterWithMocks(decisionMock({
    contractRow: { id: 'contract-1', team_id: 'club-1', user_id: 'target-player' },
    isPresident: false,
    onWrite: () => { throw new Error('a member must not record a decision'); },
  }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/mark-offered')(
    { params: { id: 'report-1' }, body: { contract_id: 'contract-1' }, user: { id: 'prez-user' } },
    response
  );

  assert.equal(response.statusCode, 403);
});

test('the president can archive a report without offering anything', async () => {
  const writes = [];
  const router = loadScoutingRouterWithMocks(decisionMock({ onWrite: (w) => writes.push(w) }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/archive')(
    { params: { id: 'report-1' }, body: {}, user: { id: 'prez-user' } },
    response
  );

  assert.equal(response.statusCode, 200);
  const statusWrite = writes.find((w) => /UPDATE scouting_reports/.test(w.sql));
  assert.equal(statusWrite.params[0], 'archived');
  assert.ok(writes.some((w) => w.audit), 'archiving is a decision and must be audited');
});

test('a non-president member cannot archive a report', async () => {
  const router = loadScoutingRouterWithMocks(decisionMock({
    isPresident: false,
    onWrite: () => { throw new Error('a member must not archive a report') },
  }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/archive')(
    { params: { id: 'report-1' }, body: {}, user: { id: 'prez-user' } },
    response
  );

  assert.equal(response.statusCode, 403);
});

test('an already-decided report cannot be decided again', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'prez-user', email: 'prez@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'prez-player', club_id: 'club-1' }];
    if (isPresidentLookup(sql)) return [{ id: 'club-1' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      // The offer already went out; shelving it now would leave the report saying
      // "archived" while a live contract is still pinned to it.
      return [{ id: params[0], club_id: 'club-1', status: 'offered', target_player_id: 'target-player', video_links: ['https://x'] }];
    }
    if (/UPDATE scouting_reports/.test(sql)) throw new Error('a decided report must not be rewritten');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/archive')(
    { params: { id: 'report-1' }, body: {}, user: { id: 'prez-user' } },
    response
  );

  assert.equal(response.statusCode, 409);
});

test('the president can decide while a vote is still running — the vote never blocks them', async () => {
  const writes = [];
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'prez-user', email: 'prez@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'prez-player', club_id: 'club-1' }];
    if (isPresidentLookup(sql)) return [{ id: 'club-1' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{
        id: params[0], club_id: 'club-1', status: 'voting',
        target_player_id: 'target-player',
        // Squad is voting against — this must not stop the president.
        votes: { p1: 'against', p2: 'against' },
        video_links: ['https://x'],
      }];
    }
    if (/FROM player_contracts/.test(sql)) return [{ id: 'contract-1', team_id: 'club-1', user_id: 'target-player' }];
    if (/UPDATE scouting_reports/.test(sql)) { writes.push(params); return { affectedRows: 1 }; }
    if (/INSERT INTO club_operation_audit_logs/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/mark-offered')(
    { params: { id: 'report-1' }, body: { contract_id: 'contract-1' }, user: { id: 'prez-user' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(writes[0][0], 'offered');
});

test('status is not settable through a plain edit — it belongs to the decision endpoints', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'member-user', email: 'member@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'member-player', club_id: 'club-1' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') {
      return [{ id: params[0], club_id: 'club-1', status: 'open', video_links: ['https://x'] }];
    }
    if (sql === 'TEST_UPDATE_SCOUTING_REPORT') throw new Error('a PATCH must not move the report state');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    { params: { id: 'report-1' }, body: { status: 'offered' }, user: { id: 'member-user' } },
    response
  );

  assert.equal(response.statusCode, 400);
});

test('a member of another club cannot read a single report', async () => {
  const executesql = async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'outsider-user', email: 'outsider@example.test', role_id: 2 }];
    if (isMemberClubLookup(sql)) return [{ id: 'outsider-player', club_id: 'club-2' }];
    if (sql === 'TEST_SELECT_SCOUTING_REPORT') return [{ id: params[0], club_id: 'club-1' }];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadScoutingRouterWithMocks(executesql);
  const response = makeResponse();

  await routeHandler(router, 'get', '/:id')(
    { params: { id: 'report-1' }, query: {}, user: { id: 'outsider-user' } },
    response
  );

  assert.equal(response.statusCode, 403);
});
