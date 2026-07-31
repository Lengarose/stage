const { EXECUTESQL } = require('../db/database');

const LIVE_CONTRACT_STATUSES = ['active', 'pending', 'pending_window', 'negotiating'];
const ACTIONABLE_CONTRACT_STATUSES = ['pending', 'pending_window', 'negotiating'];

function queryWith(query, sql, params = []) {
  return query ? query(sql, params) : EXECUTESQL(sql, params);
}

function placeholders(values) {
  return values.map(() => '?').join(',');
}

function contractGroup(contractType) {
  return String(contractType || 'squad') === 'ownership' ? 'ownership' : 'player';
}

function groupSql(group) {
  return group === 'ownership'
    ? "contract_type = 'ownership'"
    : "(contract_type IS NULL OR contract_type <> 'ownership')";
}

function conflictError(conflict, group) {
  const err = new Error(`Player already has a live ${group} contract with this club (${conflict.status})`);
  err.status = 409;
  err.code = 'contract_conflict';
  err.conflict = conflict;
  return err;
}

async function assertCanCreateContractOffer({
  playerId,
  teamId,
  contractType = 'squad',
  allowedActiveContractId = null,
  query = null,
}) {
  if (!playerId || !teamId) return;
  const group = contractGroup(contractType);
  const params = [playerId, teamId, ...LIVE_CONTRACT_STATUSES];
  let allowedClause = '';
  if (allowedActiveContractId) {
    allowedClause = " AND NOT (id = ? AND status = 'active')";
    params.push(allowedActiveContractId);
  }
  const conflicts = await queryWith(
    query,
    `SELECT id, team_id, user_id, contract_type, status
       FROM player_contracts
      WHERE user_id = ?
        AND team_id = ?
        AND status IN (${placeholders(LIVE_CONTRACT_STATUSES)})
        AND ${groupSql(group)}
        ${allowedClause}
      LIMIT 1`,
    params
  );
  if (conflicts.length) throw conflictError(conflicts[0], group);
}

async function markContractInboxStatus({ contractIds, status, query = null }) {
  const ids = [...new Set((contractIds || []).filter(Boolean))];
  if (!ids.length || !status) return;
  const inSql = placeholders(ids);
  await queryWith(
    query,
    `UPDATE inbox_messages
        SET status = ?,
            is_read = 1
      WHERE message_type = 'contract_offer'
        AND related_entity_id IN (${inSql})`,
    [status, ...ids]
  );
  await queryWith(
    query,
    `UPDATE notifications
        SET \`read\` = 1
      WHERE type = 'contract_offer'
        AND related_id IN (${inSql})`,
    ids
  );
}

async function closeAcceptedContractConflicts({ acceptedContract, query = null }) {
  if (!acceptedContract?.id || !acceptedContract?.user_id) return;
  const group = contractGroup(acceptedContract.contract_type);
  const conflicts = await queryWith(
    query,
    `SELECT id, team_id, user_id, contract_type, status
       FROM player_contracts
      WHERE user_id = ?
        AND id <> ?
        AND status IN (${placeholders(LIVE_CONTRACT_STATUSES)})
        AND ${groupSql(group)}`,
    [acceptedContract.user_id, acceptedContract.id, ...LIVE_CONTRACT_STATUSES]
  );
  if (!conflicts.length) return;

  const activeIds = conflicts.filter((row) => row.status === 'active').map((row) => row.id);
  const offerIds = conflicts.filter((row) => ACTIONABLE_CONTRACT_STATUSES.includes(row.status)).map((row) => row.id);

  // Accepting one contract must close the other live documents in the same group.
  // Otherwise a player can keep accepting/sending parallel contracts forever.
  if (activeIds.length) {
    await queryWith(
      query,
      `UPDATE player_contracts
          SET status = CASE WHEN team_id = ? THEN 'completed' ELSE 'terminated' END,
              updated_date = NOW()
        WHERE id IN (${placeholders(activeIds)})`,
      [acceptedContract.team_id, ...activeIds]
    );
  }

  if (offerIds.length) {
    await queryWith(
      query,
      `UPDATE player_contracts
          SET status = 'cancelled',
              updated_date = NOW()
        WHERE id IN (${placeholders(offerIds)})`,
      offerIds
    );
    await markContractInboxStatus({ contractIds: offerIds, status: 'cancelled', query });
  }
}

module.exports = {
  LIVE_CONTRACT_STATUSES,
  ACTIONABLE_CONTRACT_STATUSES,
  assertCanCreateContractOffer,
  closeAcceptedContractConflicts,
  markContractInboxStatus,
};
