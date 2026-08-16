const { pool } = require('../db/database');
const { markContractInboxStatus } = require('./contractRulesService');

const LIVE_CONTRACT_STATUSES = ['active', 'pending', 'pending_window', 'negotiating'];
const ACTIONABLE_OFFER_STATUSES = ['pending', 'pending_window', 'negotiating'];

function httpError(message, status = 400, code = null) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

function toRows(result) {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
}

function sameId(left, right) {
  return String(left || '') === String(right || '');
}

function sameEmail(left, right) {
  const a = String(left || '').trim().toLowerCase();
  const b = String(right || '').trim().toLowerCase();
  return Boolean(a && b && a === b);
}

async function withConnectionTransaction(dbPool, callback) {
  const conn = await dbPool.promise().getConnection();
  try {
    await conn.beginTransaction();
    const query = async (sql, params = []) => {
      const result = await conn.query(sql, params);
      return toRows(result);
    };
    const output = await callback(query);
    await conn.commit();
    return output;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function isClubPresident({ club, user, player }) {
  if (!club) return false;
  if (user?.id && (sameId(club.president_user_id, user.id) || sameId(club.user_id, user.id))) return true;
  if (player?.id && sameId(club.president_player_id, player.id)) return true;
  if (user?.email && sameEmail(club.owner_email, user.email)) return true;
  return false;
}

async function leaveClubLifecycle(input, options = {}) {
  const dbPool = options.pool || pool;
  const user = input?.user || {};
  const clubId = input?.clubId || input?.club_id || null;
  if (!user.id) throw httpError('Authentication required', 401, 'auth_required');
  if (!clubId) throw httpError('club_id is required', 400, 'club_required');

  return withConnectionTransaction(dbPool, async (query) => {
    const clubs = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE', [clubId]);
    const club = clubs[0];
    if (!club) throw httpError('Club not found', 404, 'club_not_found');

    const requestedPlayerId = input?.playerId || input?.player_id || null;
    const players = requestedPlayerId
      ? await query('SELECT * FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [requestedPlayerId])
      : await query(
        `SELECT * FROM players
          WHERE user_id = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?))
          ORDER BY user_id = ? DESC, updated_date DESC
          LIMIT 1 FOR UPDATE`,
        [user.id, user.email || '', user.id]
      );
    const player = players[0];
    if (!player) throw httpError('Player not found', 404, 'player_not_found');
    const sameUser = player.user_id && sameId(player.user_id, user.id);
    const sameMail = player.email && user.email && sameEmail(player.email, user.email);
    if (!sameUser && !sameMail) {
      throw httpError('Player must belong to the authenticated user', 403, 'player_forbidden');
    }

    const liveContracts = await query(
      `SELECT *, user_id AS target_player_id
         FROM player_contracts
        WHERE team_id = ?
          AND user_id = ?
          AND status IN (${LIVE_CONTRACT_STATUSES.map(() => '?').join(',')})
        FOR UPDATE`,
      [clubId, player.id, ...LIVE_CONTRACT_STATUSES]
    );
    const memberships = await query(
      `SELECT id
         FROM club_memberships
        WHERE player_id = ?
          AND club_id = ?
          AND status = 'active'
        LIMIT 1`,
      [player.id, clubId]
    ).catch(() => []);
    const detachedPresidency = isClubPresident({ club, user, player });
    const signedToThisClub = sameId(player.club_id, clubId);
    if (!signedToThisClub && !liveContracts.length && !memberships.length && !detachedPresidency) {
      throw httpError('You are not a member of this club', 400, 'not_a_member');
    }

    // A live loan is an agreement between two clubs. Walking out of the parent
    // club would leave the loan pointing at a club that no longer holds the
    // player, so the loan has to end first (recall, mutual end, or expiry).
    const { hasLiveLoan } = require('./playerLoanService');
    if (await hasLiveLoan(player.id, { query })) {
      throw httpError(
        'You have a live loan and cannot leave this club until it ends',
        409,
        'live_loan',
      );
    }

    const activeIds = liveContracts.filter((row) => row.status === 'active').map((row) => row.id);
    const offerIds = liveContracts
      .filter((row) => ACTIONABLE_OFFER_STATUSES.includes(row.status))
      .map((row) => row.id);

    if (activeIds.length) {
      await query(
        `UPDATE player_contracts
            SET status = 'terminated',
                end_date = COALESCE(end_date, CURDATE()),
                updated_date = NOW()
          WHERE id IN (${activeIds.map(() => '?').join(',')})`,
        activeIds
      );
    }
    if (offerIds.length) {
      await query(
        `UPDATE player_contracts
            SET status = 'cancelled',
                updated_date = NOW()
          WHERE id IN (${offerIds.map(() => '?').join(',')})`,
        offerIds
      );
      await markContractInboxStatus({ contractIds: offerIds, status: 'cancelled', query });
    }

    await query(
      `UPDATE club_memberships
          SET status = 'inactive',
              updated_date = NOW()
        WHERE player_id = ?
          AND club_id = ?
          AND status = 'active'`,
      [player.id, clubId]
    );
    await query(
      'DELETE FROM club_staff_roles WHERE club_id = ? AND (player_id = ? OR user_id = ?)',
      [clubId, player.id, user.id]
    ).catch(() => []);

    if (signedToThisClub) {
      await query(
        `UPDATE players
            SET club_id = NULL,
                role = 'member',
                club_roles = JSON_ARRAY('member'),
                status = 'free_agent',
                updated_date = NOW()
          WHERE id = ?`,
        [player.id]
      );
    }

    if (detachedPresidency) {
      await query(
        `UPDATE clubs
            SET president_player_id = CASE WHEN president_player_id = ? THEN NULL ELSE president_player_id END,
                president_user_id = CASE WHEN president_user_id = ? THEN NULL ELSE president_user_id END,
                user_id = CASE WHEN user_id = ? THEN NULL ELSE user_id END,
                owner_email = CASE WHEN LOWER(TRIM(COALESCE(owner_email, ''))) = LOWER(TRIM(?)) THEN NULL ELSE owner_email END,
                updated_date = NOW()
          WHERE id = ?`,
        [player.id, user.id, user.id, user.email || '', clubId]
      );
      await query(
        'UPDATE users SET owner_id = NULL, updated_date = NOW() WHERE id = ? AND owner_id = ?',
        [user.id, clubId]
      );
      await query(
        'DELETE FROM presidents WHERE club_id = ? AND user_id = ?',
        [clubId, user.id]
      ).catch(() => []);
    }

    const [playerRows, clubRows, contractRows] = await Promise.all([
      query('SELECT id, user_id, email, club_id, role, club_roles, status FROM players WHERE id = ? LIMIT 1', [player.id]),
      query('SELECT * FROM clubs WHERE id = ? LIMIT 1', [clubId]),
      query(
        `SELECT *, user_id AS target_player_id
           FROM player_contracts
          WHERE team_id = ?
            AND user_id = ?
          ORDER BY updated_date DESC`,
        [clubId, player.id]
      ),
    ]);

    return {
      player: playerRows[0] || {
        ...player,
        club_id: null,
        role: 'member',
        status: 'free_agent',
      },
      club: clubRows[0] || club,
      contracts: contractRows,
      terminatedContractIds: activeIds,
      cancelledContractIds: offerIds,
      detachedPresidency,
    };
  });
}

module.exports = {
  leaveClubLifecycle,
};
