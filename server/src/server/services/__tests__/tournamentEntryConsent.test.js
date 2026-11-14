'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const schedules = require('../tournamentScheduleService');
const notices = require('../boardTournamentNotices');

test('a published schedule requires stored consent even when the legacy policy marker is missing', async () => {
  const q = async sql => sql.includes("entity_type='tournament_schedule'")
    ? [{ data_json: JSON.stringify({ revision: 'published', rules_revision: 'old' }) }] : [];
  await assert.rejects(schedules.assertEntry({ id: 'event' }, 'club', 'club', q), /schedule|rules/i);
});

test('Board notice includes legacy club entries without club-rules revision and reaches the manager', async () => {
  const inserted = [];
  const q = async (sql, params = []) => {
    if (sql.startsWith('SELECT t.*')) return [{ id: 'event', name: 'The G.O.A.T. 2027', participant_type: 'club', registration_proofs: JSON.stringify({ club: { club: { status: 'approved', submitted_at: '2026-11-14' } } }) }];
    if (sql.includes('SELECT id FROM league_entities')) return [];
    if (sql.includes('FROM clubs')) return [{ name: 'The Hooded FC', president_user_id: 'manager' }];
    if (sql.includes('FROM users')) return [{ email: 'manager@example.test' }];
    if (sql.startsWith('INSERT INTO inbox_messages')) inserted.push(params);
    return [];
  };
  await notices.reconcile(q);
  assert.equal(inserted.length, 1, 'a legacy accepted entry must receive its Board message');
  assert.equal(inserted[0][1], 'manager@example.test');
  assert.match(inserted[0][4], /The G.O.A.T. 2027/);
});
