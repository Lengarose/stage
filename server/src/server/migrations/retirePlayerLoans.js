'use strict';
const { withTransaction } = require('../db/database');
const { v5: uuid } = require('uuid');

// Feature removal is not a sale, refund or deletion of historical obligations.
// Preserve the exact source before disabling its temporary playing assignment.
async function retirePlayerLoans(transaction = withTransaction) {
  return transaction(async query => {
    const loans = await query("SELECT * FROM player_loans WHERE status IN ('PROPOSED','AWAITING_PLAYER','PENDING_WINDOW','ACTIVE') ORDER BY id FOR UPDATE");
    for (const loan of loans) {
      const id = uuid(`retired_player_loan:${loan.id}`, uuid.URL);
      await query("INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,'retired_player_loan',?)", [id, JSON.stringify({
        id, loan_id: loan.id, reason: 'Player loans removed by product policy', original: loan,
      })]);
      await query("UPDATE player_loans SET status='RETIRED', completed_at=COALESCE(completed_at,NOW()), updated_date=NOW() WHERE id=?", [loan.id]);
    }
    return { retired: loans.length };
  });
}
module.exports = { retirePlayerLoans };
