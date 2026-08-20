const { EXECUTESQL } = require('../db/database');
const { getSquadLoanView } = require('./playerLoanService');

const DEFAULT_ORDER = 'FIELD(p.position, "ST","LW","RW","CAM","CM","CDM","CB","LB","RB","GK"), p.gamertag';

async function annotateClubPlayers(clubId, players) {
  const view = await getSquadLoanView(clubId).catch(() => ({ incoming_player_ids: [], annotations: {} }));
  const byId = new Map((players || []).map((player) => [player.id, { ...player, ...(view.annotations[player.id] || { selectable: true }) }]));
  const missingIds = (view.incoming_player_ids || []).filter((id) => !byId.has(id));
  if (missingIds.length) {
    const placeholders = missingIds.map(() => '?').join(',');
    const extras = await EXECUTESQL(`SELECT * FROM players WHERE id IN (${placeholders})`, missingIds).catch(() => []);
    for (const player of extras) {
      byId.set(player.id, { ...player, ...(view.annotations[player.id] || {}) });
    }
  }
  return [...byId.values()];
}

async function listActiveClubPlayers(clubId, { limit = 300, columns = 'p.*' } = {}) {
  if (!clubId) return [];
  const cappedLimit = Math.min(Number(limit) || 300, 500);
  const rows = await EXECUTESQL(
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
  return annotateClubPlayers(clubId, rows);
}

async function listActiveClubPlayerEmails(clubIds) {
  const ids = [...new Set((Array.isArray(clubIds) ? clubIds : [clubIds]).map(String).filter(Boolean))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const playerRows = await EXECUTESQL(
    `SELECT DISTINCT COALESCE(NULLIF(TRIM(p.email), ''), NULLIF(TRIM(u.email), '')) AS email
       FROM players p
       LEFT JOIN club_memberships cm
         ON cm.player_id = p.id
        AND cm.status = 'active'
       LEFT JOIN users u
         ON u.id = p.user_id
         OR u.player_id = p.id
         OR LOWER(TRIM(u.email)) = LOWER(TRIM(p.email))
      WHERE (cm.club_id IN (${placeholders}) OR p.club_id IN (${placeholders}))
        AND COALESCE(NULLIF(TRIM(p.email), ''), NULLIF(TRIM(u.email), '')) IS NOT NULL`,
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
  const clubRows = await EXECUTESQL(
    `SELECT DISTINCT COALESCE(
              NULLIF(TRIM(president_user.email), ''),
              NULLIF(TRIM(owner_user.email), ''),
              NULLIF(TRIM(owner_player.email), ''),
              NULLIF(TRIM(c.owner_email), '')
            ) AS email
       FROM clubs c
       LEFT JOIN users president_user ON president_user.id = c.president_user_id
       LEFT JOIN users owner_user ON owner_user.id = c.user_id
       LEFT JOIN players owner_player
         ON owner_player.user_id = c.president_user_id
         OR LOWER(TRIM(owner_player.email)) = LOWER(TRIM(c.owner_email))
      WHERE c.id IN (${placeholders})`,
    ids
  ).catch(() => []);
  return [...new Set([...playerRows, ...clubRows]
    .map((row) => String(row.email || '').trim().toLowerCase())
    .filter((email) => email && email.includes('@') && !email.endsWith('@stage.invalid')))];
}

module.exports = {
  listActiveClubPlayers,
  listActiveClubPlayerEmails,
};
