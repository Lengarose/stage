const { EXECUTESQL } = require('../db/database');

function ok(res, data, status = 200) {
  return res.status(status).json({ data, message: 'ok' });
}

function fail(res, status, message) {
  return res.status(status).json({ data: null, message, error: message });
}

function splitName(gamertag, email) {
  const base = String(gamertag || email?.split('@')[0] || 'Player').trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return {
    first_name: parts[0] || base,
    last_name: parts.slice(1).join(' ') || '',
  };
}

function mapPlayer(row = {}) {
  if (!row) return null;
  const names = splitName(row.gamertag, row.email);
  return {
    ...row,
    id: row.user_id || row.id,
    player_id: row.id,
    user_id: row.user_id || null,
    email: row.email || null,
    gamer_tag: row.gamertag || null,
    gamertag: row.gamertag || null,
    first_name: row.first_name || names.first_name,
    last_name: row.last_name || names.last_name,
    avatar: row.avatar_url || row.avatar || null,
    avatar_url: row.avatar_url || null,
    team_id: row.club_id || null,
    club_id: row.club_id || null,
    position: row.position || null,
    platform: row.platform || null,
    bio: row.bio || null,
  };
}

function mapUserFromMe(me = {}) {
  const names = splitName(me.gamertag, me.email);
  return {
    id: me.id,
    email: me.email,
    gamer_tag: me.gamertag || null,
    gamertag: me.gamertag || null,
    first_name: names.first_name,
    last_name: names.last_name,
    avatar: null,
    player_id: me.player_id || null,
    team_id: me.club_id || me.owned_club_id || me.president_club_id || null,
    club_id: me.club_id || null,
    owned_club_id: me.owned_club_id || me.owner_id || null,
    president_club_id: me.president_club_id || null,
    role: me.role || me.role_name || 'player',
    role_id: me.role_id,
    credits: me.credits,
    timezone: me.timezone,
    subscription: me.subscription,
    club_name: me.club_name || null,
  };
}

function mapClub(row = {}) {
  if (!row) return null;
  return {
    ...row,
    club_name: row.name,
    name: row.name,
    team_id: row.id,
    owner_id: row.user_id || row.president_user_id || null,
    logo: row.logo_url || null,
    avatar: row.logo_url || null,
  };
}

function mapMatch(row = {}) {
  if (!row) return null;
  return {
    ...row,
    tournament_name: row.competition_name || row.tournament_name || row.competition_type || null,
    home_team_name: row.home_club_name || row.home_player_name || row.home_team_name || 'Home',
    away_team_name: row.away_club_name || row.away_player_name || row.away_team_name || 'Away',
    home_score: row.home_score ?? row.score_home ?? null,
    away_score: row.away_score ?? row.score_away ?? null,
    status: row.status || 'scheduled',
  };
}

function mapPost(row = {}) {
  if (!row) return null;
  const names = splitName(row.author_name, row.author_email);
  return {
    ...row,
    gamer_tag: row.author_name || null,
    first_name: names.first_name,
    last_name: names.last_name,
    user_avatar: row.author_avatar || null,
    created_at: row.created_date || row.created_at || null,
  };
}

function mapComment(row = {}) {
  if (!row) return null;
  return {
    ...row,
    gamer_tag: row.author_name || row.gamer_tag || null,
    avatar: row.author_avatar || row.avatar || null,
    content: row.content || row.body || '',
  };
}

function mapJoinRequest(row = {}) {
  if (!row) return null;
  return {
    ...row,
    gamer_tag: row.player_gamertag || null,
    first_name: splitName(row.player_gamertag, row.player_email).first_name,
    last_name: splitName(row.player_gamertag, row.player_email).last_name,
    avatar: null,
  };
}

function mapChatMessage(row = {}) {
  if (!row) return null;
  return {
    ...row,
    user_id: row.sender_email || row.user_id || null,
    gamer_tag: row.sender_name || row.gamer_tag || null,
    created_at: row.created_date || row.created_at || null,
    message_type: row.message_type || 'text',
  };
}

async function resolveCallerContext(user) {
  if (!user?.id && !user?.email) return null;
  const users = await EXECUTESQL(
    'SELECT id, email, role_id FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
    [user.id || '', user.email || '']
  );
  if (!users.length) return null;
  const u = users[0];
  const email = String(u.email || '').trim().toLowerCase();
  const [players, clubs] = await Promise.all([
    EXECUTESQL(
      `SELECT * FROM players
       WHERE user_id = ? OR LOWER(TRIM(email)) = ?
       ORDER BY user_id = ? DESC, updated_date DESC
       LIMIT 1`,
      [u.id, email, u.id]
    ).catch(() => []),
    EXECUTESQL(
      `SELECT * FROM clubs
       WHERE president_user_id = ? OR user_id = ? OR LOWER(TRIM(owner_email)) = ?
       ORDER BY president_user_id = ? DESC, user_id = ? DESC, updated_date DESC
       LIMIT 1`,
      [u.id, u.id, email, u.id, u.id]
    ).catch(() => []),
  ]);
  return {
    user: u,
    player: players[0] || null,
    club: clubs[0] || null,
  };
}

async function buildMePayload(userId) {
  const rows = await EXECUTESQL(
    `SELECT
       u.id, u.email, u.role_id, u.credits, u.timezone,
       p.id AS player_id, p.gamertag, p.subscription, p.role AS player_role, p.club_id,
       c.id AS owned_club_id, c.name AS club_name,
       c.id AS president_club_id
     FROM users u
     LEFT JOIN players p ON p.user_id = u.id OR LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
     LEFT JOIN clubs c ON c.president_user_id = u.id OR c.user_id = u.id OR LOWER(TRIM(c.owner_email)) = LOWER(TRIM(u.email))
     WHERE u.id = ?
     ORDER BY p.user_id = u.id DESC, c.president_user_id = u.id DESC
     LIMIT 1`,
    [userId]
  );
  if (!rows.length) return null;
  const me = rows[0];
  return mapUserFromMe({
    ...me,
    role: Number(me.role_id) === 0 ? 'admin' : (me.player_role || 'player'),
    owner_id: me.owned_club_id,
  });
}

module.exports = {
  ok,
  fail,
  mapPlayer,
  mapUserFromMe,
  mapClub,
  mapMatch,
  mapPost,
  mapComment,
  mapJoinRequest,
  mapChatMessage,
  resolveCallerContext,
  buildMePayload,
  splitName,
};
