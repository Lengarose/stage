'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const transfers = require('../officialPlayerTransferService');
const conflicts = require('../officialPlayerConflictService');
const window = { id: 'window', player_transfer_policy_version: transfers.VERSION,
  confirmation_closes_at: '2027-03-07T23:00:00Z', league_start_monday: '2027-03-22' };
const row = data => ({ id: data.id, data_json: JSON.stringify(data) });
test('placement closes ordinary moves; week six and transition use Brussels dates across DST', () => {
  for (const value of ['2027-03-07T22:59:59Z', '2027-04-25T22:00:00Z', '2027-05-02T21:59:59Z', '2027-06-13T22:00:00Z']) assert.equal(transfers.ordinaryOpen(window, new Date(value)), true, value);
  for (const value of ['2027-03-07T23:00:00Z', '2027-03-10T12:00:00Z', '2027-04-25T21:59:59Z', '2027-05-02T22:00:00Z', '2027-06-13T21:59:59Z']) assert.equal(transfers.ordinaryOpen(window, new Date(value)), false, value);
  assert.equal(transfers.ordinaryOpen({ ...window, league_start_monday: null }, new Date('2027-03-10')), false);
});
function fixture(history = []) {
  const receipts = [];
  const query = async (sql, values) => {
    if (sql.includes('SELECT DISTINCT w.*')) return [row(window)];
    if (sql.startsWith('SELECT DISTINCT e.data_json')) return [];
    if (sql.includes('JOIN league_entities s')) return history;
    if (sql.startsWith('INSERT INTO league_entities')) { receipts.push(JSON.parse(values[1])); return {}; }
    throw Error(`Unexpected SQL: ${sql}`);
  };
  return { query, receipts };
}
test('recurring confirmation does not close the approved between-season transition week', () => {
 const next={...window,season_number:2,confirmation_closes_at:'2027-06-27T22:00:00Z',league_start_monday:'2027-07-19'};
 assert.equal(transfers.ordinaryOpen(next,new Date('2027-07-11T21:59:59Z')),false);
 assert.equal(transfers.ordinaryOpen(next,new Date('2027-07-11T22:00:00Z')),true);
 assert.equal(transfers.ordinaryOpen(next,new Date('2027-07-18T21:59:59Z')),true);
 assert.equal(transfers.ordinaryOpen(next,new Date('2027-07-18T22:00:00Z')),false);
});
test('a prohibited permanent transfer writes no receipt; allowed week-six move is bound to its contract and actor', async () => {
  const f = fixture(), input = { player: { id: 'player', club_id: 'old' }, targetClubId: 'new', referenceId: 'contract', actorId: 'owner' };
  await assert.rejects(transfers.assertMove(input, f.query, new Date('2027-03-10')), /transfers are closed/);
  assert.equal(f.receipts.length, 0);
  await transfers.assertMove(input, f.query, new Date('2027-04-26'));
  assert.equal(f.receipts[0].from_club_id, 'old');
  assert.equal(f.receipts[0].club_id, 'new');
  assert.equal(f.receipts[0].actor_user_id, 'owner');
  await transfers.assertMove(input, f.query, new Date('2027-04-26'));
  assert.equal(f.receipts[0].id, f.receipts[1].id);
});
test('free-player exception uses actual declarations, not bench nomination or global stat counters', async () => {
  const input = { player: { id: 'player', club_id: null }, targetClubId: 'new', referenceId: 'contract' };
  const prior = { home_club_id: 'old', home_submission: JSON.stringify({ participating_player_ids: ['player'] }) };
  await assert.rejects(transfers.assertMove(input, fixture([prior]).query, new Date('2027-03-10')), /already played/);
  const bench = fixture([{ ...prior, home_submission: JSON.stringify({ participating_player_ids: ['other'], bench_players: ['player'] }) }]);
  await transfers.assertMove(input, bench.query, new Date('2027-03-10'));
  assert.equal(bench.receipts.length, 1);
  const crossing=async(sql,values)=>sql.startsWith('SELECT DISTINCT e.data_json')?[row({status:'in_progress',participation_window_snapshot:{id:'foreign',region_slug:'france',confirmation_closes_at:window.confirmation_closes_at,league_start_monday:window.league_start_monday}})]:bench.query(sql,values);
  await assert.rejects(transfers.assertMove(input,crossing,new Date('2027-03-10')),/another active regional cycle requires Admin review/);

});
test('captured roster and permanent transfer receipts authorize selection; historical terms stay unchanged', async () => {
  const ctx = { root: { participation_window_snapshot: window } };
  const query = async sql => sql.includes("entity_type='season_registration'")
    ? [row({ club_roster_player_ids: ['original'] })]
    : [row({ policy_version: transfers.VERSION, player_id: 'new' })];
  await transfers.assertSelection(ctx, { club_id: 'club', ids: ['original', 'new'] }, query);
  await assert.rejects(transfers.assertSelection(ctx, { club_id: 'club', ids: ['unapproved'] }, query), /no captured roster/);
  await transfers.assertSelection({ root: {} }, { ids: ['legacy'] }, () => { throw Error('Legacy terms changed'); });
  await assert.rejects(transfers.assertProfileChange({ club_id: 'old' }, { club_id: 'new' }, fixture().query), /permanent contract/);
});
test('individual published selection conflicts reject overlap but allow adjacent approved blocks', async () => {
  const ctx = { root: { participation_window_snapshot: window }, engine: { phase: 'league' }, match: { id: 'current', scheduled_date: '2027-04-26T18:00:00Z', timezone: 'Europe/Brussels' } };
  const selection = { ids: ['player'] };
  let other = { id: 'other', type: 'league', scheduled_date: '2027-04-26T18:30:00Z', timezone: 'Europe/Brussels' };
  const query = async sql => sql.startsWith('SELECT id FROM players') ? [{ id: 'player' }] : [other];
  await assert.rejects(conflicts.assertSelection(ctx, selection, query), /overlapping/);
  other = { ...other, scheduled_date: '2027-04-26T18:40:00Z' };
  await conflicts.assertSelection(ctx, selection, query);
  other = { ...other, type: 'knockout', scheduled_date: '2027-04-26T17:20:00Z' };
  await assert.rejects(conflicts.assertSelection(ctx, selection, query), /overlapping/);
});
