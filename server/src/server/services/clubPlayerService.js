const { EXECUTESQL } = require('../db/database');

const DEFAULT_ORDER = 'FIELD(p.position, "ST","LW","RW","CAM","CM","CDM","CB","LB","RB","GK"), p.gamertag';

async function listActiveClubPlayers(clubId, { limit = 300, columns = 'p.*' } = {}) {
  if (!clubId) return [];
  const cappedLimit = Math.min(Number(limit) || 300, 500);
  return EXECUTESQL(
    `SELECT DISTINCT ${columns}
       FROM players p
       LEFT JOIN club_memberships cm
         ON cm.player_id = p.id
        AND cm.status = 'active'
      WHERE cm.club_id = ?
         OR p.club_id = ?
      ORDER BY ${DEFAULT_ORDER}
      LIMIT ?`,
    [clubId, clubId, cappedLimit]
  ).catch(async () => (
    EXECUTESQL(
      `SELECT ${columns}
         FROM players p
        WHERE p.club_id = ?
        ORDER BY ${DEFAULT_ORDER}
        LIMIT ?`,
      [clubId, cappedLimit]
    ).catch(() => [])
  ));
}

async function listActiveClubPlayerEmails(clubIds) {
  const ids = [...new Set((Array.isArray(clubIds) ? clubIds : [clubIds]).map(String).filter(Boolean))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = await EXECUTESQL(
    `SELECT DISTINCT p.email
       FROM players p
       LEFT JOIN club_memberships cm
         ON cm.player_id = p.id
        AND cm.status = 'active'
      WHERE (cm.club_id IN (${placeholders}) OR p.club_id IN (${placeholders}))
        AND p.email IS NOT NULL
        AND p.email <> ''`,
    [...ids, ...ids]
  ).catch(async () => (
    EXECUTESQL(
      `SELECT DISTINCT email
         FROM players
        WHERE club_id IN (${placeholders})
          AND email IS NOT NULL
          AND email <> ''`,
      ids
    ).catch(() => [])
  ));
  return rows.map((row) => row.email).filter(Boolean);
}

module.exports = {
  listActiveClubPlayers,
  listActiveClubPlayerEmails,
};
