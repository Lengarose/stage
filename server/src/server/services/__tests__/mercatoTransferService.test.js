const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ACTION_STATUS,
  clubBalance,
  deadlineDayState,
  headlineForTransfer,
  inferDealType,
  inferWindowKind,
  matchesMercatoFilter,
  newsTagsForAction,
  rankingTables,
  statusLabel,
} = require('../mercatoTransferService');

test('contract actions map onto mercato statuses without inventing official rumours', () => {
  assert.equal(ACTION_STATUS.offer, 'negotiation');
  assert.equal(ACTION_STATUS.accept, 'official');
  assert.equal(ACTION_STATUS.reject, 'failed');
  assert.equal(ACTION_STATUS.renewal_offer, 'negotiation');
  assert.equal(statusLabel('rumour'), 'RUMOUR');
  assert.equal(statusLabel('agreement'), 'AGREEMENT REACHED');
  assert.equal(statusLabel('failed'), 'DEAL OFF');
});

test('deal type follows fee, origin club and contract action', () => {
  assert.equal(inferDealType({ transfer_fee_stc: 0 }, { fromClubId: null }), 'free');
  assert.equal(inferDealType({ transfer_fee_stc: 45000000 }, { fromClubId: 'c1' }), 'permanent');
  assert.equal(inferDealType({ contract_type: 'trial' }, {}), 'loan');
  assert.equal(inferDealType({}, { action: 'renewal_offer' }), 'extension');
  assert.equal(inferDealType({}, { action: 'terminate' }), 'termination');
});

test('window kind and deadline day come from the open window', () => {
  assert.equal(inferWindowKind({ label: 'Summer 2026' }), 'summer');
  assert.equal(inferWindowKind({ label: 'Winter window' }), 'winter');
  const soon = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  const late = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(deadlineDayState({ end_date: soon }).active, true);
  assert.equal(deadlineDayState({ end_date: late }).active, false);
});

test('mercato filters keep rumours, loans and completed deals apart', () => {
  const rumour = { status: 'rumour', deal_type: 'permanent', from_club_id: 'a' };
  const official = { status: 'official', deal_type: 'permanent', transfer_fee: 10 };
  const loan = { status: 'official', deal_type: 'loan' };
  assert.equal(matchesMercatoFilter(rumour, 'rumours'), true);
  assert.equal(matchesMercatoFilter(rumour, 'official'), false);
  assert.equal(matchesMercatoFilter(official, 'completed'), true);
  assert.equal(matchesMercatoFilter(loan, 'loans'), true);
  assert.equal(matchesMercatoFilter({ deal_type: 'free', status: 'official' }, 'free_agents'), true);
});

test('club spend/received and expensive ranking use one transfer object', () => {
  const rows = [
    { status: 'official', to_club_id: 'buy', to_club_name: 'Buy FC', from_club_id: 'sell', from_club_name: 'Sell FC', transfer_fee: 60, player_name: 'A' },
    { status: 'official', to_club_id: 'buy', to_club_name: 'Buy FC', from_club_id: 'other', from_club_name: 'Other', transfer_fee: 20, player_name: 'B' },
    { status: 'rumour', to_club_id: 'buy', transfer_fee: 999, player_name: 'Ghost' },
  ];
  const summary = clubBalance(rows, 'buy');
  assert.equal(summary.spent, 80);
  assert.equal(summary.received, 0);
  assert.equal(summary.players_in, 2);
  assert.equal(summary.balance, -80);
  const sold = clubBalance(rows, 'sell');
  assert.equal(sold.received, 60);
  const ranks = rankingTables(rows);
  assert.equal(ranks.most_expensive[0].player_name, 'A');
  assert.equal(ranks.clubs_spending[0].club_id, 'buy');
  assert.equal(ranks.clubs_sales[0].club_id, 'sell');
});

test('club news and player news tags stay off the mercato object', () => {
  assert.deepEqual(newsTagsForAction('offer'), ['club_news']);
  assert.deepEqual(newsTagsForAction('accept'), ['player_news']);
  assert.match(headlineForTransfer({ player_name: 'Neo', to_club_name: 'Hooded F.C.' }, 'official'), /Neo/);
});
