const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function parseMaybeJson(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeWonIds(value) {
  const parsed = parseMaybeJson(value, []);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

async function loadTrophyContext({ query, trophyItemId, tournament = {} }) {
  if (!trophyItemId) return null;
  const rows = await query('SELECT * FROM trophy_items WHERE id = ? LIMIT 1', [trophyItemId]).catch(() => []);
  const item = rows[0];
  if (!item) return null;
  return {
    trophyItemId,
    trophyImageUrl: item.image_url || tournament.trophy_url || null,
    trophyName: item.name || tournament.name || null,
  };
}

async function awardPlacement({ query, ownerId, ownerType, context, tournamentId }) {
  if (!ownerId || !ownerType || !context?.trophyItemId) {
    return { awarded: false, reason: 'missing_owner_or_trophy' };
  }

  const existingRows = await query(
    `SELECT * FROM trophy_placements
      WHERE owner_id = ? AND owner_type = ? AND trophy_item_id = ?
      LIMIT 1 FOR UPDATE`,
    [ownerId, ownerType, context.trophyItemId]
  ).catch(() => []);
  const existing = existingRows[0];
  const wonIds = normalizeWonIds(existing?.won_tournament_ids);
  const tournamentKey = tournamentId ? String(tournamentId) : null;
  if (tournamentKey && wonIds.includes(tournamentKey)) {
    return { awarded: false, skipped: true, reason: 'already_awarded', placement_id: existing?.id || null };
  }

  const nextWonIds = tournamentKey ? JSON.stringify([...wonIds, tournamentKey]) : (existing?.won_tournament_ids || null);

  if (existing) {
    await query(
      `UPDATE trophy_placements
          SET win_count = IFNULL(win_count, 0) + 1,
              won_tournament_ids = ?,
              trophy_image_url = COALESCE(trophy_image_url, ?),
              trophy_name = COALESCE(trophy_name, ?),
              updated_date = NOW()
        WHERE id = ?`,
      [nextWonIds, context.trophyImageUrl, context.trophyName, existing.id]
    );
    return { awarded: true, placement_id: existing.id, updated: true };
  }

  const placementId = uuidv4();
  await query(
    `INSERT INTO trophy_placements
      (id, owner_id, owner_type, trophy_item_id, trophy_image_url, trophy_name,
       x_percent, y_percent, scale, win_count, won_tournament_ids, position, created_date, updated_date)
     VALUES (?, ?, ?, ?, ?, ?, 50, 50, 1, 1, ?, 0, NOW(), NOW())`,
    [
      placementId,
      ownerId,
      ownerType,
      context.trophyItemId,
      context.trophyImageUrl,
      context.trophyName,
      nextWonIds,
    ]
  );
  return { awarded: true, placement_id: placementId, created: true };
}

async function selectActiveClubPlayerIds({ query, clubId }) {
  if (!clubId) return [];
  const rows = await query(
    `SELECT DISTINCT p.id
       FROM players p
       LEFT JOIN club_memberships cm
         ON cm.player_id = p.id
        AND cm.club_id = ?
        AND cm.status = 'active'
       LEFT JOIN player_contracts pc
         ON pc.user_id = p.id
        AND pc.team_id = ?
        AND pc.status = 'active'
        AND COALESCE(pc.contract_type, '') <> 'ownership'
      WHERE p.club_id = ?
         OR cm.id IS NOT NULL
         OR pc.id IS NOT NULL`,
    [clubId, clubId, clubId]
  ).catch(() => []);
  return [...new Set(rows.map(row => row.id).filter(Boolean).map(String))];
}

async function awardClubTrophyToClubAndPlayers({
  clubId,
  trophyItemId,
  tournamentId,
  tournament = {},
  query = EXECUTESQL,
}) {
  const resolvedTrophyItemId = trophyItemId || tournament.trophy_item_id;
  const context = await loadTrophyContext({ query, trophyItemId: resolvedTrophyItemId, tournament });
  if (!context || !clubId) return { awarded: false, reason: 'missing_trophy_or_winner' };

  const club = await awardPlacement({
    query,
    ownerId: clubId,
    ownerType: 'club',
    context,
    tournamentId: tournamentId || tournament.id,
  });
  const playerIds = await selectActiveClubPlayerIds({ query, clubId });
  const players = [];
  for (const playerId of playerIds) {
    players.push(await awardPlacement({
      query,
      ownerId: playerId,
      ownerType: 'player',
      context,
      tournamentId: tournamentId || tournament.id,
    }));
  }

  return {
    awarded: Boolean(club.awarded || players.some(result => result.awarded)),
    club,
    players,
    player_count: playerIds.length,
  };
}

async function awardPlayerOnlyTrophy({
  playerId,
  trophyItemId,
  tournamentId,
  tournament = {},
  query = EXECUTESQL,
}) {
  const resolvedTrophyItemId = trophyItemId || tournament.trophy_item_id;
  const context = await loadTrophyContext({ query, trophyItemId: resolvedTrophyItemId, tournament });
  if (!context || !playerId) return { awarded: false, reason: 'missing_trophy_or_winner' };
  return awardPlacement({
    query,
    ownerId: playerId,
    ownerType: 'player',
    context,
    tournamentId: tournamentId || tournament.id,
  });
}

module.exports = {
  awardClubTrophyToClubAndPlayers,
  awardPlayerOnlyTrophy,
  selectActiveClubPlayerIds,
};
