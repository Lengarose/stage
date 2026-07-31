const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

async function queryWith(client, sql, params = []) {
  return client ? client(sql, params) : EXECUTESQL(sql, params);
}

async function endActiveMemberships({ playerId, exceptClubId = null, reason = 'replaced', query = null }) {
  if (!playerId) return { affectedRows: 0 };
  const params = [reason, playerId];
  const deleteParams = [playerId];
  let clubClause = '';
  if (exceptClubId) {
    clubClause = ' AND club_id <> ?';
    params.push(exceptClubId);
    deleteParams.push(exceptClubId);
  }
  await queryWith(
    query,
    `DELETE FROM club_memberships
      WHERE player_id = ?
        AND status <> 'active'${clubClause}`,
    deleteParams
  );
  return queryWith(
    query,
    `UPDATE club_memberships
        SET status = ?,
            updated_date = NOW()
      WHERE player_id = ?
        AND status = 'active'${clubClause}`,
    params
  );
}

async function upsertActiveMembership({
  clubId,
  playerId,
  userId = null,
  primaryRole = 'member',
  source = 'manual',
  query = null,
}) {
  if (!clubId || !playerId) return null;

  await endActiveMemberships({ playerId, exceptClubId: clubId, reason: 'inactive', query });
  const existingRows = await queryWith(
    query,
    `SELECT * FROM club_memberships
      WHERE club_id = ? AND player_id = ? AND status = 'active'
      LIMIT 1`,
    [clubId, playerId]
  );
  const existing = existingRows[0] || null;

  if (existing) {
    await queryWith(
      query,
      `UPDATE club_memberships
          SET user_id = COALESCE(?, user_id),
              primary_role = ?,
              source = ?,
              updated_date = NOW()
        WHERE id = ?`,
      [userId || null, primaryRole || 'member', source || existing.source || 'manual', existing.id]
    );
    return existing.id;
  }

  const id = uuidv4();
  await queryWith(
    query,
    `INSERT INTO club_memberships
      (id, club_id, player_id, user_id, status, primary_role, source, created_date, updated_date)
     VALUES (?, ?, ?, ?, 'active', ?, ?, NOW(), NOW())`,
    [id, clubId, playerId, userId || null, primaryRole || 'member', source || 'manual']
  );
  return id;
}

module.exports = {
  upsertActiveMembership,
  endActiveMemberships,
};
