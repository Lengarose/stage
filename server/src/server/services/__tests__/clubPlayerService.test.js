const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadServiceWithDbMock(executesql) {
  const servicePath = path.resolve(__dirname, '../clubPlayerService.js');
  const loanServicePath = path.resolve(__dirname, '../playerLoanService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[servicePath];
  delete require.cache[loanServicePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(servicePath);
}

test('listActiveClubPlayers reads active memberships as well as legacy player club_id', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/LEFT JOIN club_memberships/.test(sql)) {
      return [
        { id: 'membership-player', club_id: null },
        { id: 'legacy-player', club_id: 'club-1' },
      ];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const { listActiveClubPlayers } = loadServiceWithDbMock(executesql);

  const players = await listActiveClubPlayers('club-1', { limit: 11 });

  assert.deepEqual(players.map((player) => player.id), ['membership-player', 'legacy-player']);
  assert.match(calls[0].sql, /cm\.club_id = \?/);
  assert.match(calls[0].sql, /OR p\.club_id = \?/);
  assert.deepEqual(calls[0].params, ['club-1', 'club-1', 11]);
});

test('listActiveClubPlayers annotates loanees from the player-loan module', async () => {
  const executesql = async (sql) => {
    if (/LEFT JOIN club_memberships/.test(sql)) return [{ id: 'owner-player', club_id: 'club-1' }];
    if (/FROM player_loans/.test(sql)) {
      return [{
        player_id: 'loanee-1',
        parent_club_id: 'club-a',
        loan_club_id: 'club-1',
        status: 'ACTIVE',
        end_date: '2027-06-30',
        weekly_salary_stc: 10000,
      }];
    }
    if (/FROM players WHERE id IN/.test(sql)) return [{ id: 'loanee-1', gamertag: 'Loanee' }];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const { listActiveClubPlayers } = loadServiceWithDbMock(executesql);

  const players = await listActiveClubPlayers('club-1');
  const loanee = players.find((player) => player.id === 'loanee-1');
  assert.equal(loanee.loan_badge, 'LOAN');
  assert.equal(loanee.selectable, true);
});

test('listActiveClubPlayerEmails returns distinct user, player, and president emails', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/FROM players p/.test(sql)) {
      assert.match(sql, /COALESCE\(NULLIF\(TRIM\(p\.email\), ''\), NULLIF\(TRIM\(u\.email\), ''\)\) AS email/);
      assert.match(sql, /LEFT JOIN users u/);
      assert.match(sql, /cm\.club_id IN/);
      assert.deepEqual(params, ['club-1', 'club-2', 'club-1', 'club-2']);
      return [
        { email: 'one@example.test' },
        { email: 'linked-user@example.test' },
        { email: 'ONE@example.test' },
      ];
    }
    if (/FROM clubs c/.test(sql)) {
      assert.deepEqual(params, ['club-1', 'club-2']);
      return [{ email: 'president@example.test' }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const { listActiveClubPlayerEmails } = loadServiceWithDbMock(executesql);

  const emails = await listActiveClubPlayerEmails(['club-1', 'club-2']);

  assert.equal(calls.length, 2);
  assert.deepEqual(emails, ['one@example.test', 'linked-user@example.test', 'president@example.test']);
});
