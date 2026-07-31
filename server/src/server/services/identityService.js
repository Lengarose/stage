const { EXECUTESQL } = require('../db/database');

function sameId(left, right) {
  return String(left || '') === String(right || '');
}

function sameEmail(left, right) {
  const a = String(left || '').trim().toLowerCase();
  const b = String(right || '').trim().toLowerCase();
  return Boolean(a && b && a === b);
}

function parseJson(value, fallback = []) {
  if (value == null || value === '') return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

async function safeQuery(sql, params = []) {
  return EXECUTESQL(sql, params).catch(() => []);
}

async function resolveUserIdentity(userId) {
  if (!userId) throw new Error('not authenticated');

  const users = await EXECUTESQL(
    'SELECT id, email, player_id, owner_id, role_id, role FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!users.length) throw new Error('User not found');
  const user = users[0];

  const playerByUserLink = user.player_id
    ? await safeQuery('SELECT * FROM players WHERE id = ? LIMIT 1', [user.player_id])
    : [];
  const playerByReverseLink = !playerByUserLink.length
    ? await safeQuery(
      `SELECT * FROM players
       WHERE user_id = ?
          OR LOWER(TRIM(email)) = LOWER(TRIM(?))
       ORDER BY user_id = ? DESC, updated_date DESC
       LIMIT 1`,
      [user.id, user.email || '', user.id]
    )
    : [];
  const player = playerByUserLink[0] || playerByReverseLink[0] || null;

  const membershipRows = player
    ? await safeQuery(
      `SELECT *
       FROM club_memberships
       WHERE player_id = ? AND status = 'active'
       ORDER BY updated_date DESC, created_date DESC
       LIMIT 1`,
      [player.id]
    )
    : [];
  const membership = membershipRows[0] || null;

  const memberClubId = membership?.club_id || player?.club_id || null;
  const memberClubRows = memberClubId
    ? await safeQuery('SELECT * FROM clubs WHERE id = ? LIMIT 1', [memberClubId])
    : [];
  const memberClub = memberClubRows[0] || null;

  const legacyMemberClubRows = !memberClub && player?.club_id
    ? await safeQuery('SELECT * FROM clubs WHERE id = ? LIMIT 1', [player.club_id])
    : [];
  const legacyMemberClub = legacyMemberClubRows[0] || null;

  // `users.owner_id` is legacy naming: it stores the owned club id.
  const ownerClubByUserField = user.owner_id
    ? await safeQuery('SELECT * FROM clubs WHERE id = ? LIMIT 1', [user.owner_id])
    : [];
  const ownerClubByClubUser = !ownerClubByUserField.length
    ? await safeQuery('SELECT * FROM clubs WHERE user_id = ? LIMIT 1', [user.id])
    : [];
  const ownerClubByEmail = !ownerClubByUserField.length && !ownerClubByClubUser.length && user.email
    ? await safeQuery('SELECT * FROM clubs WHERE LOWER(TRIM(owner_email)) = LOWER(TRIM(?)) LIMIT 1', [user.email])
    : [];
  const ownedClub = ownerClubByUserField[0] || ownerClubByClubUser[0] || ownerClubByEmail[0] || null;
  const ownedClubId = ownedClub?.id || user.owner_id || null;
  user.owned_club_id = ownedClubId;

  const club = memberClub || legacyMemberClub || ownedClub || null;
  const staffRoles = club
    ? await safeQuery(
      `SELECT * FROM club_staff_roles
       WHERE club_id = ? AND (user_id = ? OR player_id = ?)
       ORDER BY created_date DESC`,
      [club.id, user.id, player?.id || '']
    )
    : [];

  const roles = [];
  if (ownedClub && (sameId(ownedClub.user_id, user.id) || sameEmail(ownedClub.owner_email, user.email) || sameId(ownedClubId, ownedClub.id))) {
    roles.push('owner');
  }
  parseJson(player?.club_roles, []).forEach((role) => roles.push(role));
  if (player?.role && player.role !== 'member') roles.push(player.role);
  if (membership?.primary_role && membership.primary_role !== 'member') roles.push(membership.primary_role);
  staffRoles.forEach((row) => roles.push(row.role));

  return {
    user,
    player,
    membership,
    memberClub,
    ownedClub,
    club,
    staffRoles,
    roles: unique(roles),
  };
}

async function resolvePlayerForUserId(userId) {
  const identity = await resolveUserIdentity(userId);
  return identity.player;
}

async function resolveClubForUserId(userId) {
  const identity = await resolveUserIdentity(userId);
  return identity.ownedClub;
}

module.exports = {
  resolveUserIdentity,
  resolvePlayerForUserId,
  resolveClubForUserId,
  parseJson,
};
