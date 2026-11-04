'use strict';

const { EXECUTESQL } = require('../db/database');

function createService({ query = EXECUTESQL, policyForMatch = match => require('./regionalResultPolicyService').policyForMatch(match), settle = (match, now) => require('./matchResultNegotiationService').settleMatchDeadlines(match, now), clock = () => new Date(), logger = console } = {}) {
  let running = false;
  let cursor = '';
  let timer;
  async function tick() {
    if (running) return { skipped: true };
    running = true;
    let reviewed = 0;
    try {
      const now = clock();
      const rows = await query(`SELECT * FROM matches WHERE id > ?
        AND source_fixture_type IN ('competition_engine','regional_league','regional_league_fixture','regional_pathway')
        AND status IN ('in_progress','awaiting_confirmation','disputed')
        AND ((result_state='AWAITING_AWAY_CONFIRMATION' AND confirmation_due_at <= ?)
          OR (result_state='AWAITING_HOME_REVIEW' AND review_due_at <= ?))
        ORDER BY id LIMIT 80`, [cursor, now.toISOString(), now.toISOString()]);
      for (const match of rows) {
        try {
          if (!(await policyForMatch(match))?.reviewOnTimeout) continue;
          const result = await settle(match, now);
          if (result?.data?.event === 'response_timeout_admin_review') reviewed += 1;
        } catch (error) {
          // Snapshot conflicts can be a simultaneous confirmation. The next scan
          // reloads persisted state; no completion or guessed winner is forced.
          if (error.code !== 'RESULT_CHANGED') logger.error('[regional result deadline] Match requires review:', match.id);
        }
      }
      cursor = rows.length === 80 ? rows.at(-1).id : '';
      return { reviewed };
    } catch (error) {
      logger.error('[regional result deadline] Scan failed; it will retry.');
      return { failed: true };
    } finally { running = false; }
  }
  function start() {
    if (!timer) { timer = setInterval(tick, 60000); timer.unref(); }
    return timer;
  }
  return { tick, start };
}

module.exports = { createService, ...createService() };
