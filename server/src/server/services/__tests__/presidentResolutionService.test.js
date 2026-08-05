const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ensurePresidentForClub,
  resolveOfferedByPresidentId,
} = require('../presidentResolutionService');

test('ensurePresidentForClub creates stub and links club.president_id', async () => {
  const store = {
    clubs: [{ id: 'club-1', president_user_id: 'user-1', owner_email: 'a@example.test', president_id: null }],
    presidents: [],
  };

  async function query(sql, params = []) {
    if (/SELECT \* FROM presidents WHERE id = \?/.test(sql)) {
      return store.presidents.filter((p) => p.id === params[0]);
    }
    if (/SELECT \* FROM presidents WHERE user_id = \?/.test(sql)) {
      return store.presidents.filter((p) => p.user_id === params[0]);
    }
    if (/INSERT INTO presidents/.test(sql)) {
      store.presidents.push({
        id: params[0],
        user_id: params[1],
        club_id: params[2],
        email: params[3],
        display_name: null,
      });
      return { affectedRows: 1 };
    }
    if (/UPDATE presidents SET club_id/.test(sql)) {
      const row = store.presidents.find((p) => p.id === params[1]);
      if (row) row.club_id = params[0];
      return { affectedRows: 1 };
    }
    if (/UPDATE clubs SET president_id/.test(sql)) {
      const club = store.clubs.find((c) => c.id === params[1]);
      if (club) club.president_id = params[0];
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM clubs WHERE id = \?/.test(sql)) {
      return store.clubs.filter((c) => c.id === params[0]);
    }
    return [];
  }

  const president = await ensurePresidentForClub(store.clubs[0], { query });
  assert.ok(president?.id);
  assert.equal(president.user_id, 'user-1');
  assert.equal(president.club_id, 'club-1');
  assert.equal(store.clubs[0].president_id, president.id);
});

test('resolveOfferedByPresidentId prefers club-linked president', async () => {
  const store = {
    clubs: [{ id: 'club-1', president_user_id: 'user-1', owner_email: 'a@example.test', president_id: 'pres-1' }],
    presidents: [{ id: 'pres-1', user_id: 'user-1', club_id: 'club-1' }],
  };

  async function query(sql, params = []) {
    if (/SELECT \* FROM clubs WHERE id = \?/.test(sql)) {
      return store.clubs.filter((c) => c.id === params[0]);
    }
    if (/SELECT \* FROM presidents WHERE id = \?/.test(sql)) {
      return store.presidents.filter((p) => p.id === params[0]);
    }
    if (/SELECT \* FROM presidents WHERE user_id = \?/.test(sql)) {
      return store.presidents.filter((p) => p.user_id === params[0]);
    }
    return [];
  }

  const id = await resolveOfferedByPresidentId({ userId: 'user-1', clubId: 'club-1', query });
  assert.equal(id, 'pres-1');
});
