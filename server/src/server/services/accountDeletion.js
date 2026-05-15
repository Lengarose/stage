const { withTransaction } = require('../db/database');

/**
 * Clears every column that stores users.id (uuid) before deleting the user row.
 * Does NOT delete players/clubs — call deleteUserAccount(..., 'hard') for that.
 *
 * Tables mirrored from server/schema.sql (FK + loose references).
 */
async function clearAuxiliaryUserReferences(exec, userId) {
  const stmts = [
    ['DELETE FROM player_contracts WHERE user_id = ?', [userId]],
    ['UPDATE player_identity_claims SET user_id = NULL WHERE user_id = ?', [userId]],
    ['UPDATE recruitment_posts SET author_user_id = NULL WHERE author_user_id = ?', [userId]],
    ['UPDATE recruitment_interests SET sender_user_id = NULL WHERE sender_user_id = ?', [userId]],
    ['UPDATE recruitment_interests SET recipient_user_id = NULL WHERE recipient_user_id = ?', [userId]],
    ['UPDATE club_applicants SET user_id = NULL WHERE user_id = ?', [userId]],
    ['UPDATE club_staff_roles SET user_id = NULL WHERE user_id = ?', [userId]],
    ['UPDATE club_staff_roles SET assigned_by_user_id = NULL WHERE assigned_by_user_id = ?', [userId]],
    ['UPDATE club_fixture_availability SET user_id = NULL WHERE user_id = ?', [userId]],
    ['UPDATE club_fixture_lineups SET created_by_user_id = NULL WHERE created_by_user_id = ?', [userId]],
    ['UPDATE club_operation_audit_logs SET actor_user_id = NULL WHERE actor_user_id = ?', [userId]],
    ['UPDATE admin_audit_log SET admin_user_id = NULL WHERE admin_user_id = ?', [userId]],
    ['UPDATE fixture_admin_actions SET performed_by = NULL WHERE performed_by = ?', [userId]],
  ];
  for (const [sql, params] of stmts) {
    await exec(sql, params);
  }
}

async function revokeSessions(exec, email) {
  if (email) await exec('DELETE FROM auth_tokens WHERE email = ?', [email]);
}

async function unlinkUsersOwnPointers(exec, userId) {
  await exec('UPDATE users SET player_id = NULL, owner_id = NULL WHERE id = ?', [userId]);
  await exec('UPDATE players SET user_id = NULL WHERE user_id = ?', [userId]);
  await exec('UPDATE clubs SET user_id = NULL WHERE user_id = ?', [userId]);
}

/**
 * @param {string} userId
 * @param {'soft'|'hard'} mode
 *   soft — remove login row only; player/club rows stay (user_id nulled by FK + unlink).
 *   hard — delete clubs linked via clubs.user_id and all players linked via players.user_id (Settings danger zone).
 * @param {{ alsoDeletePlayerId?: string }} [extra] — ensure this player row is removed (e.g. legacy link via users.player_id only).
 */
async function deleteUserAccount(userId, mode = 'soft', extra = {}) {
  const alsoDeletePlayerId = extra.alsoDeletePlayerId || null;
  return withTransaction(async (exec) => {
    const rows = await exec('SELECT id, email FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length) throw new Error('User not found');

    const email = rows[0].email;

    await clearAuxiliaryUserReferences(exec, userId);

    if (mode === 'hard') {
      const ownedClubs = await exec('SELECT id FROM clubs WHERE user_id = ?', [userId]);
      for (const row of ownedClubs) {
        await exec('UPDATE players SET club_id = NULL WHERE club_id = ?', [row.id]);
        await exec('DELETE FROM clubs WHERE id = ?', [row.id]);
      }
      await exec('DELETE FROM players WHERE user_id = ?', [userId]);
      if (alsoDeletePlayerId) {
        await exec('DELETE FROM players WHERE id = ?', [alsoDeletePlayerId]);
      }
    }

    await revokeSessions(exec, email);
    await unlinkUsersOwnPointers(exec, userId);
    await exec('DELETE FROM users WHERE id = ?', [userId]);
  });
}

module.exports = {
  clearAuxiliaryUserReferences,
  deleteUserAccount,
};
