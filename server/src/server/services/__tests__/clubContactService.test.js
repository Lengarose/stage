const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadClubContactServiceWithDbMock(executesql) {
  const servicePath = path.resolve(__dirname, '../clubContactService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[servicePath];
  delete require.cache[dbPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(servicePath);
}

test('resolveClubPresidentContact prefers president user email over legacy owner_email', async () => {
  const calls = [];
  const service = loadClubContactServiceWithDbMock(async (sql, params = []) => {
    calls.push({ sql, params });
    if (/FROM clubs c/.test(sql)) {
      return [{
        id: 'club-1',
        name: 'President FC',
        president_user_id: 'president-user',
        owner_email: 'legacy@example.test',
        president_user_email: 'President@Example.TEST',
      }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const contact = await service.resolveClubPresidentContact({ clubId: 'club-1' });

  assert.equal(contact.email, 'president@example.test');
  assert.equal(contact.club.id, 'club-1');
  assert.deepEqual(calls[0].params, ['club-1']);
});

test('resolveClubPresidentContact falls back to owner_email for legacy clubs', async () => {
  const service = loadClubContactServiceWithDbMock(async (sql) => {
    if (/FROM clubs c/.test(sql)) {
      return [{
        id: 'club-legacy',
        name: 'Legacy FC',
        president_user_id: null,
        owner_email: 'Legacy@Example.TEST',
        president_user_email: null,
      }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const contact = await service.resolveClubPresidentContact({ clubId: 'club-legacy' });

  assert.equal(contact.email, 'legacy@example.test');
});

test('resolveClubPresidentContact skips invalid and deleted fallback emails', async () => {
  const service = loadClubContactServiceWithDbMock(async (sql) => {
    if (/FROM clubs c/.test(sql)) {
      return [{
        id: 'club-deleted',
        name: 'Deleted FC',
        president_user_id: null,
        owner_email: 'deleted-owner-club-deleted@stage.invalid',
        president_user_email: null,
      }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const contact = await service.resolveClubPresidentContact({ clubId: 'club-deleted' });

  assert.equal(contact.email, null);
});
