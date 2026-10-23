'use strict';
const { EXECUTESQL } = require('../db/database');
function startTournamentReconciliationJob() {
  if (process.env.TOURNAMENT_RECONCILIATION_ENABLED !== 'true') return null;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const rows = await EXECUTESQL("SELECT id FROM tournaments WHERE status='in_progress'");
      for (const row of rows) {
        try {
          const result = await require('./competitionEngineService').advanceCommunityTournamentIfReady({ tournament_id: row.id, status: 'completed' });
          if (result.conflicts?.length) console.error('[tournament reconciliation conflict]', row.id, result.conflicts);
        } catch (err) { console.error('[tournament reconciliation]', row.id, err.message); }
      }
    } catch (err) { console.error('[tournament reconciliation]', err.message); }
    finally { running = false; }
  }, 60000);
  timer.unref();
  return timer;
}
module.exports = { startTournamentReconciliationJob };
