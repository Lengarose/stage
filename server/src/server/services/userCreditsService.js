/**
 * Platform tournament credits are owned by the USER account — one shared pot
 * for player tournaments and club tournaments (and tournament creation).
 *
 * Player/club `credits` columns remain for legacy UI mirrors but tournament
 * spend/grant should go through this service.
 */

const { EXECUTESQL } = require('../db/database');

function run(query, sql, params = []) {
  if (typeof query === 'function') return query(sql, params);
  return EXECUTESQL(sql, params);
}

async function getUserCredits(userId, query) {
  if (!userId) return 0;
  const rows = await run(query, 'SELECT credits FROM users WHERE id = ? LIMIT 1', [userId]);
  return Math.max(0, Number(rows?.[0]?.credits || 0));
}

/**
 * Additive grant (store packs, refunds, admin gifts).
 */
async function addUserCredits(userId, amount, query) {
  const credits = Number(amount || 0);
  if (!userId) throw new Error('addUserCredits: userId required');
  if (!Number.isFinite(credits) || credits <= 0) throw new Error('addUserCredits: invalid amount');

  await run(
    query,
    'UPDATE users SET credits = COALESCE(credits, 0) + ?, updated_date = NOW() WHERE id = ?',
    [credits, userId]
  );
  const after = await getUserCredits(userId, query);
  return { credits_before: after - credits, credits_after: after, credits_added: credits };
}

/**
 * STAGE Plus monthly policy: refresh balance UP TO allowance (does not stack).
 */
async function refreshUserCreditsTo(userId, allowance, query) {
  const target = Math.max(0, Number(allowance || 0));
  if (!userId) throw new Error('refreshUserCreditsTo: userId required');

  const before = await getUserCredits(userId, query);
  const after = Math.max(before, target);
  await run(
    query,
    'UPDATE users SET credits = ?, credits_refreshed_at = NOW(), updated_date = NOW() WHERE id = ?',
    [after, userId]
  );
  return {
    credits_before: before,
    credits_after: after,
    credits_added: Math.max(0, after - before),
    credit_policy: 'refresh_not_stack',
  };
}

/**
 * Spend credits from the user pot. Returns new balance or throws.
 */
async function spendUserCredits(userId, amount, query) {
  const cost = Number(amount || 0);
  if (!userId) throw new Error('spendUserCredits: userId required');
  if (!Number.isFinite(cost) || cost <= 0) {
    return { credits_spent: 0, credits_after: await getUserCredits(userId, query) };
  }

  // Lock row when inside a transaction (FOR UPDATE).
  const rows = await run(query, 'SELECT credits FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [userId])
    .catch(async () => run(query, 'SELECT credits FROM users WHERE id = ? LIMIT 1', [userId]));
  if (!rows?.length) throw new Error('User not found');
  const before = Math.max(0, Number(rows[0].credits || 0));
  if (before < cost) {
    const err = new Error(`Insufficient credits. Need ${cost}, have ${before}`);
    err.code = 'INSUFFICIENT_CREDITS';
    err.need = cost;
    err.have = before;
    throw err;
  }
  const after = before - cost;
  await run(query, 'UPDATE users SET credits = ?, updated_date = NOW() WHERE id = ?', [after, userId]);
  return { credits_spent: cost, credits_before: before, credits_after: after };
}

module.exports = {
  getUserCredits,
  addUserCredits,
  refreshUserCreditsTo,
  spendUserCredits,
};
