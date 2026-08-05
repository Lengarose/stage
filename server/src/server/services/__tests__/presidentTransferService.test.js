const assert = require('node:assert/strict');
const test = require('node:test');
const { transferPresidentToClub } = require('../presidentTransferService');

function makeStore() {
  return {
    clubs: [
      {
        id: 'club-old',
        name: 'Old FC',
        president_id: 'pres-1',
        president_user_id: 'user-1',
        owner_email: 'old@example.test',
      },
      {
        id: 'club-new',
        name: 'New FC',
        president_id: 'pres-2',
        president_user_id: 'user-2',
        owner_email: 'new@example.test',
      },
    ],
    presidents: [
      { id: 'pres-1', user_id: 'user-1', club_id: 'club-old', email: 'old@example.test', display_name: 'Ada' },
      { id: 'pres-2', user_id: 'user-2', club_id: 'club-new', email: 'new@example.test', display_name: 'Bob' },
    ],
    audits: [],
  };
}

function makeQuery(store) {
  return async function query(sql, params = []) {
    if (/SELECT \* FROM presidents WHERE id = \?/.test(sql)) {
      return store.presidents.filter((p) => p.id === params[0]);
    }
    if (/SELECT \* FROM clubs WHERE id = \?/.test(sql)) {
      return store.clubs.filter((c) => c.id === params[0]);
    }
    if (/UPDATE presidents SET club_id = \? WHERE id = \?/.test(sql)) {
      const row = store.presidents.find((p) => p.id === params[1]);
      if (row) row.club_id = params[0];
      return { affectedRows: row ? 1 : 0 };
    }
    if (/UPDATE clubs SET president_id = NULL, president_user_id = NULL WHERE id = \? AND president_id = \?/.test(sql)) {
      const club = store.clubs.find((c) => c.id === params[0] && c.president_id === params[1]);
      if (club) {
        club.president_id = null;
        club.president_user_id = null;
      }
      return { affectedRows: club ? 1 : 0 };
    }
    if (/UPDATE clubs SET president_id = \?, president_user_id = \? WHERE id = \?/.test(sql)) {
      const club = store.clubs.find((c) => c.id === params[2]);
      if (club) {
        club.president_id = params[0];
        club.president_user_id = params[1];
      }
      return { affectedRows: club ? 1 : 0 };
    }
    if (/INSERT INTO admin_audit_log/.test(sql)) {
      // VALUES (id, admin_user_id, admin_email, action, 'president', entity_id, entity_name, old, new, reason, NOW())
      store.audits.push({
        id: params[0],
        admin_user_id: params[1],
        action: params[3],
        entity_type: 'president',
        entity_id: params[4],
        old_value: params[6],
        new_value: params[7],
        reason: params[8],
      });
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL in test: ${sql}`);
  };
}

test('transferPresidentToClub moves president, clears old club, displaces target club president, audits', async () => {
  const store = makeStore();
  const result = await transferPresidentToClub({
    presidentId: 'pres-1',
    clubId: 'club-new',
    actor: { id: 'admin-1', email: 'admin@example.test' },
    reason: 'Season handover',
    query: makeQuery(store),
  });

  assert.equal(result.president.club_id, 'club-new');
  assert.equal(store.presidents.find((p) => p.id === 'pres-1').club_id, 'club-new');
  assert.equal(store.presidents.find((p) => p.id === 'pres-2').club_id, null);

  const oldClub = store.clubs.find((c) => c.id === 'club-old');
  const newClub = store.clubs.find((c) => c.id === 'club-new');
  assert.equal(oldClub.president_id, null);
  assert.equal(oldClub.president_user_id, null);
  assert.equal(newClub.president_id, 'pres-1');
  assert.equal(newClub.president_user_id, 'user-1');

  assert.equal(result.displacedPresident?.id, 'pres-2');
  assert.equal(store.audits.length, 1);
  assert.equal(store.audits[0].action, 'president_transfer');
  assert.equal(store.audits[0].entity_id, 'pres-1');
  assert.match(store.audits[0].reason, /Season handover/);
});

test('transferPresidentToClub with null clubId detaches president and clears club links', async () => {
  const store = makeStore();
  const result = await transferPresidentToClub({
    presidentId: 'pres-1',
    clubId: null,
    actor: { id: 'admin-1', email: 'admin@example.test' },
    reason: 'Left club',
    query: makeQuery(store),
  });

  assert.equal(result.president.club_id, null);
  const oldClub = store.clubs.find((c) => c.id === 'club-old');
  assert.equal(oldClub.president_id, null);
  assert.equal(oldClub.president_user_id, null);
  assert.equal(store.audits[0].action, 'president_detach');
});

test('transferPresidentToClub rejects missing president', async () => {
  const store = makeStore();
  await assert.rejects(
    () => transferPresidentToClub({
      presidentId: 'missing',
      clubId: 'club-new',
      actor: { id: 'admin-1' },
      query: makeQuery(store),
    }),
    /not found/i
  );
});
