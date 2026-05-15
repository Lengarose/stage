const express = require('express');
const router = express.Router();
const ClubStaffRole = require('../models/clubStaffRoleModel');
const { EXECUTESQL } = require('../db/database');
const {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  parseJson,
  getUser,
  isAdmin,
  getClubAccess,
  requireClubPermission,
  writeClubAudit,
} = require('../services/clubOperationsService');

const ROLES = new Set(['owner', 'president', 'captain', 'vice_captain', 'recruiter', 'finance_manager', 'match_coordinator']);

function handleError(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

function normalize(row) {
  return row ? { ...row, permissions: parseJson(row.permissions, []) } : row;
}

async function loadRole(id) {
  const rows = await new ClubStaffRole().selectOne(id);
  return normalize(rows[0] || null);
}

async function attachUserId(body) {
  if (body.user_id || !body.player_id) return body;
  const players = await EXECUTESQL('SELECT user_id, email FROM players WHERE id = ? LIMIT 1', [body.player_id]);
  return { ...body, user_id: players[0]?.user_id || null };
}

router.get('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const filters = { ...req.query };
    if (filters.club_id) {
      const access = await getClubAccess(user, filters.club_id);
      if (!isAdmin(user) && !access.allowed) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isAdmin(user)) {
      filters.user_id = user.id;
    }
    const rows = await new ClubStaffRole().selectAll(filters);
    res.json(rows.map(normalize));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const row = await loadRole(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const access = await getClubAccess(user, row.club_id);
    if (!isAdmin(user) && !access.allowed) return res.status(403).json({ error: 'Forbidden' });
    res.json(row);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const { user } = await requireClubPermission(req, req.body?.club_id, 'manage_staff');
    if (!ROLES.has(req.body?.role)) return res.status(400).json({ error: 'Invalid role' });
    const permissions = (req.body?.permissions || ROLE_PERMISSIONS[req.body.role] || []).filter((p) => ALL_PERMISSIONS.includes(p));
    const body = await attachUserId({ ...req.body, permissions, assigned_by_user_id: user.id });
    const existing = await new ClubStaffRole().selectAll({ club_id: body.club_id, player_id: body.player_id, role: body.role, limit: 1 });
    if (existing.length) return res.status(409).json({ error: 'Role already assigned' });
    const model = new ClubStaffRole(body);
    await model.create();
    const created = await loadRole(model.id);
    await writeClubAudit({ clubId: created.club_id, user, action: 'staff_role_changed', entityType: 'club_staff_role', entityId: created.id, newValue: created });
    res.status(201).json(created);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await loadRole(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { user } = await requireClubPermission(req, existing.club_id, 'manage_staff');
    const body = await attachUserId({ ...existing, ...req.body });
    if (!ROLES.has(body.role)) return res.status(400).json({ error: 'Invalid role' });
    body.permissions = (body.permissions || []).filter((p) => ALL_PERMISSIONS.includes(p));
    await new ClubStaffRole(body).update(existing.id);
    const updated = await loadRole(existing.id);
    await writeClubAudit({ clubId: existing.club_id, user, action: 'staff_permission_changed', entityType: 'club_staff_role', entityId: existing.id, oldValue: existing, newValue: updated });
    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await loadRole(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { user } = await requireClubPermission(req, existing.club_id, 'manage_staff');
    await new ClubStaffRole().delete(existing.id);
    await writeClubAudit({ clubId: existing.club_id, user, action: 'staff_role_changed', entityType: 'club_staff_role', entityId: existing.id, oldValue: existing, reason: req.body?.reason });
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
