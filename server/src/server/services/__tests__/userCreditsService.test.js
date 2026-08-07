const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Lightweight in-memory stub of the DB layer used by userCreditsService.
const users = new Map();

require.cache[require.resolve('../../db/database')] = {
  id: require.resolve('../../db/database'),
  filename: require.resolve('../../db/database'),
  loaded: true,
  exports: {
    EXECUTESQL: async (sql, params = []) => {
      if (/SELECT credits FROM users/.test(sql)) {
        const row = users.get(params[0]);
        return row ? [{ credits: row.credits }] : [];
      }
      if (/UPDATE users SET credits = COALESCE\(credits, 0\) \+ \?/.test(sql)) {
        const [amount, id] = params;
        const row = users.get(id) || { credits: 0 };
        row.credits = Number(row.credits || 0) + Number(amount);
        users.set(id, row);
        return { affectedRows: 1 };
      }
      if (/UPDATE users SET credits = \?, credits_refreshed_at/.test(sql)) {
        const [credits, id] = params;
        users.set(id, { credits: Number(credits) });
        return { affectedRows: 1 };
      }
      if (/UPDATE users SET credits = \?, updated_date/.test(sql)) {
        const [credits, id] = params;
        users.set(id, { credits: Number(credits) });
        return { affectedRows: 1 };
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  },
};

// Fresh require after stubbing DB.
delete require.cache[require.resolve('../userCreditsService')];
const {
  getUserCredits,
  addUserCredits,
  refreshUserCreditsTo,
  spendUserCredits,
} = require('../userCreditsService');

test('user credits are a shared pot with refresh-not-stack policy', async () => {
  users.clear();
  users.set('u1', { credits: 40 });

  assert.equal(await getUserCredits('u1'), 40);

  const added = await addUserCredits('u1', 10);
  assert.equal(added.credits_after, 50);

  const refreshed = await refreshUserCreditsTo('u1', 150);
  assert.equal(refreshed.credits_after, 150);
  assert.equal(refreshed.credits_added, 100);

  // Second refresh does not stack above 150 when already at allowance.
  const again = await refreshUserCreditsTo('u1', 150);
  assert.equal(again.credits_after, 150);
  assert.equal(again.credits_added, 0);

  const spent = await spendUserCredits('u1', 50);
  assert.equal(spent.credits_after, 100);

  await assert.rejects(() => spendUserCredits('u1', 200), /Insufficient credits/);
});

test('service module path resolves', () => {
  assert.ok(path.basename(require.resolve('../userCreditsService')).includes('userCreditsService'));
});
