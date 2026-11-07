'use strict';
// The product now supports permanent transfers only. These assertions replace
// the removed loan creation/recall/purchase workflow's former acceptance tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../playerLoanService');
const { retirePlayerLoans } = require('../../migrations/retirePlayerLoans');

test('every obsolete loan mutation rejects before querying or charging', async () => {
  const actions = ['proposeLoan', 'rejectLoanByParent', 'acceptLoanByParent', 'rejectLoanByPlayer', 'acceptLoanByPlayer',
    'activateLoan', 'cancelLoan', 'recallLoan', 'proposeEarlyEnd', 'acceptEarlyEnd', 'rejectEarlyEnd',
    'exercisePurchaseOption', 'acceptPurchaseByPlayer', 'rejectPurchaseByPlayer', 'convertLoanToPurchase'];
  for (const action of actions) assert.throws(() => service[action]({}, { query: () => { throw Error('Unexpected write'); } }), error => error.code === 'LOANS_REMOVED' && error.status === 410, action);
  assert.deepEqual(await service.activatePendingWindowLoans(), { activated: 0, purchased: 0, errors: [] });
  assert.deepEqual(await service.completeDueLoans(), { completed: 0, errors: [] });
});
test('retirement snapshots originals, preserves source rows and paid ledgers, and is idempotent', async () => {
  const loans = [{ id: 'loan', status: 'ACTIVE', loan_fee_stc: 25000, player_id: 'player', parent_club_id: 'parent', loan_club_id: 'borrower' }];
  const snapshots = [], writes = [];
  const transaction = async fn => fn(async (sql, values) => {
    if (sql.startsWith('SELECT * FROM player_loans')) return loans.filter(loan => loan.status === 'ACTIVE').map(loan => structuredClone(loan));
    writes.push(sql);
    if (sql.startsWith('INSERT INTO league_entities')) snapshots.push(JSON.parse(values[1]));
    else if (sql.startsWith('UPDATE player_loans')) loans.find(loan => loan.id === values[0]).status = 'RETIRED';
    else throw Error(`Unexpected SQL: ${sql}`);
    return {};
  });
  assert.deepEqual(await retirePlayerLoans(transaction), { retired: 1 });
  assert.equal(snapshots[0].original.status, 'ACTIVE');
  assert.equal(snapshots[0].original.loan_fee_stc, 25000);
  assert.equal(loans[0].status, 'RETIRED');
  assert.deepEqual(await retirePlayerLoans(transaction), { retired: 0 });
  assert.equal(snapshots.length, 1);
  assert.ok(writes.every(sql => !/DELETE|transactions|UPDATE players|UPDATE clubs/i.test(sql)));
});
test('a retirement failure propagates to the transaction instead of enabling partial startup', async () => {
  await assert.rejects(retirePlayerLoans(async fn => fn(async sql => {
    if (sql.startsWith('SELECT')) return [{ id: 'loan', status: 'ACTIVE' }];
    throw Error('archive unavailable');
  })), /archive unavailable/);
});
