const { EXECUTESQL } = require('../db/database');

function parsePlayerIds(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function firstStreamUrlForPlayerIds(playerIds) {
  const ids = [...new Set(parsePlayerIds(playerIds))];
  if (!ids.length) return null;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await EXECUTESQL(
    `SELECT stream_url FROM players
     WHERE id IN (${placeholders})
       AND stream_url IS NOT NULL
       AND TRIM(stream_url) != ''
     LIMIT 1`,
    ids
  ).catch(() => []);
  return rows[0]?.stream_url || null;
}

/**
 * Fallback stream source for club matches. The dressing room no longer gates
 * Game Day, so the seated list may legitimately be empty; fall back to any
 * player of the club who has linked a Twitch/Kick channel.
 */
async function firstStreamUrlForClub(clubId) {
  if (!clubId) return null;
  const rows = await EXECUTESQL(
    `SELECT stream_url FROM players
     WHERE club_id = ?
       AND stream_url IS NOT NULL
       AND TRIM(stream_url) != ''
     LIMIT 1`,
    [clubId]
  ).catch(() => []);
  return rows[0]?.stream_url || null;
}

/**
 * Fill empty home/away stream URLs on a match from Twitch/Kick-linked players.
 * Never overwrites a URL that was already set manually.
 */
async function ensureMatchStreamsFromPlayers(match) {
  if (!match?.id) return match;

  const updates = {};

  if (!match.home_stream_url) {
    let url = null;
    if (match.home_player_id) {
      url = await firstStreamUrlForPlayerIds([match.home_player_id]);
    }
    if (!url && match.home_club_id) {
      const rooms = await EXECUTESQL(
        'SELECT seated_players FROM dressing_rooms WHERE match_id = ? AND club_id = ? LIMIT 1',
        [match.id, match.home_club_id]
      ).catch(() => []);
      url = await firstStreamUrlForPlayerIds(rooms[0]?.seated_players);
      if (!url) url = await firstStreamUrlForClub(match.home_club_id);
    }
    if (url) updates.home_stream_url = url;
  }

  if (!match.away_stream_url) {
    let url = null;
    if (match.away_player_id) {
      url = await firstStreamUrlForPlayerIds([match.away_player_id]);
    }
    if (!url && match.away_club_id) {
      const rooms = await EXECUTESQL(
        'SELECT seated_players FROM dressing_rooms WHERE match_id = ? AND club_id = ? LIMIT 1',
        [match.id, match.away_club_id]
      ).catch(() => []);
      url = await firstStreamUrlForPlayerIds(rooms[0]?.seated_players);
      if (!url) url = await firstStreamUrlForClub(match.away_club_id);
    }
    if (url) updates.away_stream_url = url;
  }

  if (!Object.keys(updates).length) return match;

  const sets = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
  await EXECUTESQL(
    `UPDATE matches SET ${sets}, updated_date = NOW() WHERE id = ?`,
    [...Object.values(updates), match.id]
  );
  return { ...match, ...updates };
}

/**
 * After a club seats players, copy the first seated player's stream_url onto
 * that club's side of the match if the slot is still empty.
 */
async function applySeatedPlayerStreamToMatch({ matchId, clubId, seatedPlayers }) {
  if (!matchId || !clubId) return null;
  const matches = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [matchId]).catch(() => []);
  const match = matches[0];
  if (!match) return null;

  const isHome = String(match.home_club_id || '') === String(clubId);
  const isAway = String(match.away_club_id || '') === String(clubId);
  if (!isHome && !isAway) return null;

  const field = isHome ? 'home_stream_url' : 'away_stream_url';
  if (match[field]) return null;

  const url = await firstStreamUrlForPlayerIds(seatedPlayers);
  if (!url) return null;

  await EXECUTESQL(
    `UPDATE matches SET ${field} = ?, updated_date = NOW() WHERE id = ? AND (${field} IS NULL OR TRIM(${field}) = '')`,
    [url, matchId]
  );
  return { [field]: url };
}

module.exports = {
  ensureMatchStreamsFromPlayers,
  applySeatedPlayerStreamToMatch,
  firstStreamUrlForPlayerIds,
};
