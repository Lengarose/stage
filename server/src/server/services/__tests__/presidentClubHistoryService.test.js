const assert = require('node:assert/strict');
const test = require('node:test');
const {
  recordPresidentClubChange,
  ensureOpenTenureForClub,
  listHistoryForPresident,
} = require('../presidentClubHistoryService');

function makeStore() {
  return {
    history: [
      {
        id: 'h1',
        president_id: 'pres-1',
        club_id: 'club-a',
        club_name: 'Alpha',
        started_at: '2026-01-01 00:00:00',
        ended_at: null,
        reason: null,
        created_date: '2026-01-01 00:00:00',
      },
    ],
    clubs: [{ id: 'club-b', name: 'Beta FC', logo_url: null, tag: 'BET' }],
  };
}

function makeQuery(store) {
  return async function query(sql, params = []) {
    if (/UPDATE president_club_history[\s\S]*ended_at IS NULL/.test(sql)) {
      for (const row of store.history) {
        if (row.president_id === params[2] && row.ended_at == null) {
          row.ended_at = params[0] || new Date().toISOString();
          if (params[1]) row.reason = params[1];
        }
      }
      return { affectedRows: 1 };
    }
    if (/INSERT INTO president_club_history/.test(sql)) {
      store.history.push({
        id: params[0],
        president_id: params[1],
        club_id: params[2],
        club_name: params[3],
        started_at: params[4] || new Date().toISOString(),
        ended_at: null,
        reason: params[5],
        created_date: new Date().toISOString(),
      });
      return { affectedRows: 1 };
    }
    if (/SELECT id, club_id FROM president_club_history/.test(sql)) {
      return store.history.filter((h) => h.president_id === params[0] && h.ended_at == null).slice(0, 1);
    }
    if (/SELECT name FROM clubs WHERE id = \?/.test(sql)) {
      const club = store.clubs.find((c) => c.id === params[0]);
      return club ? [{ name: club.name }] : [];
    }
    if (/FROM president_club_history h/.test(sql)) {
      return store.history
        .filter((h) => h.president_id === params[0])
        .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
        .slice(0, params[1] || 50)
        .map((h) => {
          const club = store.clubs.find((c) => c.id === h.club_id);
          return {
            ...h,
            club_logo_url: club?.logo_url || null,
            club_tag: club?.tag || null,
          };
        });
    }
    throw new Error(`Unexpected SQL in test: ${sql}`);
  };
}

test('recordPresidentClubChange closes open tenure and opens new club', async () => {
  const store = makeStore();
  await recordPresidentClubChange({
    presidentId: 'pres-1',
    clubId: 'club-b',
    reason: 'Transfer',
    query: makeQuery(store),
  });

  assert.equal(store.history.length, 2);
  assert.ok(store.history[0].ended_at);
  assert.equal(store.history[1].club_id, 'club-b');
  assert.equal(store.history[1].club_name, 'Beta FC');
  assert.equal(store.history[1].ended_at, null);
});

test('ensureOpenTenureForClub is a no-op when already open for same club', async () => {
  const store = makeStore();
  await ensureOpenTenureForClub({
    presidentId: 'pres-1',
    clubId: 'club-a',
    query: makeQuery(store),
  });
  assert.equal(store.history.length, 1);
  assert.equal(store.history[0].ended_at, null);
});

test('listHistoryForPresident returns newest first', async () => {
  const store = makeStore();
  store.history.push({
    id: 'h0',
    president_id: 'pres-1',
    club_id: 'club-old',
    club_name: 'Old',
    started_at: '2025-01-01 00:00:00',
    ended_at: '2025-12-31 00:00:00',
    reason: null,
    created_date: '2025-01-01 00:00:00',
  });
  const rows = await listHistoryForPresident('pres-1', { query: makeQuery(store) });
  assert.equal(rows[0].id, 'h1');
  assert.equal(rows[1].id, 'h0');
});
