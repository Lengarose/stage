const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const ALL_PERMISSIONS = [
  'edit_club_profile',
  'manage_recruitment',
  'review_applicants',
  'offer_contracts',
  'manage_formation',
  'manage_lineup',
  'view_finances',
  'manage_finances',
  'manage_staff',
];

const ROLE_PERMISSIONS = {
  owner: ALL_PERMISSIONS,
  president: ALL_PERMISSIONS,
  captain: ['manage_recruitment', 'review_applicants', 'offer_contracts', 'manage_formation', 'manage_lineup'],
  vice_captain: ['review_applicants', 'manage_formation', 'manage_lineup'],
  'vice-captain': ['review_applicants', 'manage_formation', 'manage_lineup'],
  recruiter: ['manage_recruitment', 'review_applicants', 'offer_contracts'],
  finance_manager: ['view_finances', 'manage_finances'],
  match_coordinator: ['manage_formation', 'manage_lineup'],
};

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function getUser(req) {
  const rows = await EXECUTESQL('SELECT id, email, role_id, role FROM users WHERE id = ? LIMIT 1', [req.user?.id]);
  return rows[0] || null;
}

function isAdmin(user) {
  return Number(user?.role_id) === 0 || user?.role === 'admin';
}

async function getClub(clubId) {
  const rows = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [clubId]);
  return rows[0] || null;
}

async function getPlayerForUser(user, clubId = null) {
  if (!user) return null;
  const params = [user.id, user.email];
  const clubClause = clubId ? ' AND club_id = ?' : '';
  if (clubId) params.push(clubId);
  const rows = await EXECUTESQL(
    `SELECT * FROM players WHERE (user_id = ? OR LOWER(email)=LOWER(?))${clubClause} LIMIT 1`,
    params
  );
  return rows[0] || null;
}

async function getClubAccess(user, clubId) {
  if (!user || !clubId) return { allowed: false, permissions: [], roles: [] };
  if (isAdmin(user)) return { allowed: true, admin: true, permissions: ALL_PERMISSIONS, roles: ['admin'] };

  const club = await getClub(clubId);
  if (!club) return { allowed: false, permissions: [], roles: [] };

  const roles = [];
  const permissions = new Set();
  if (club.user_id === user.id || String(club.owner_email || '').toLowerCase() === String(user.email || '').toLowerCase()) {
    roles.push('owner');
    ROLE_PERMISSIONS.owner.forEach((p) => permissions.add(p));
  }

  const player = await getPlayerForUser(user, clubId);
  const playerRoles = parseJson(player?.club_roles, []);
  for (const role of playerRoles) {
    roles.push(role);
    (ROLE_PERMISSIONS[role] || []).forEach((p) => permissions.add(p));
  }
  if (player?.role && player.role !== 'member') {
    roles.push(player.role);
    (ROLE_PERMISSIONS[player.role] || []).forEach((p) => permissions.add(p));
  }

  const staffRows = await EXECUTESQL(
    `SELECT * FROM club_staff_roles
     WHERE club_id = ? AND (user_id = ? OR player_id = ?)
     ORDER BY created_date DESC`,
    [clubId, user.id, player?.id || '']
  ).catch(() => []);
  for (const row of staffRows) {
    roles.push(row.role);
    (ROLE_PERMISSIONS[row.role] || []).forEach((p) => permissions.add(p));
    parseJson(row.permissions, []).forEach((p) => permissions.add(p));
  }

  return { allowed: permissions.size > 0, club, player, roles: [...new Set(roles)], permissions: [...permissions] };
}

async function requireClubPermission(req, clubId, permission) {
  const user = await getUser(req);
  if (!user) {
    const err = new Error('User not found');
    err.status = 401;
    throw err;
  }
  const access = await getClubAccess(user, clubId);
  if (!access.admin && permission && !access.permissions.includes(permission)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  if (!access.allowed && !access.admin) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return { user, access };
}

async function writeClubAudit({ clubId, user, action, entityType, entityId, oldValue, newValue, reason }) {
  await EXECUTESQL(
    `INSERT INTO club_operation_audit_logs
       (id, club_id, actor_user_id, actor_email, action, entity_type, entity_id,
        old_value, new_value, reason, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      clubId,
      user?.id || null,
      user?.email || null,
      action,
      entityType || null,
      entityId || null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      reason || null,
    ]
  ).catch(() => {});
}

async function notifyEmail(email, title, body, link = '/notifications') {
  if (!email) return;
  await EXECUTESQL(
    `INSERT INTO notifications (id, recipient_email, type, title, body, link, created_date)
     VALUES (?, ?, 'club_operations', ?, ?, ?, NOW())`,
    [uuidv4(), email, title, body, link]
  ).catch(() => {});
}

async function getCurrentTransferWindow() {
  const rows = await EXECUTESQL(
    "SELECT * FROM transfer_windows WHERE status = 'open' ORDER BY created_date DESC LIMIT 1",
    []
  ).catch(() => []);
  return rows[0] || null;
}

module.exports = {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  parseJson,
  getUser,
  isAdmin,
  getClub,
  getPlayerForUser,
  getClubAccess,
  requireClubPermission,
  writeClubAudit,
  notifyEmail,
  getCurrentTransferWindow,
};
