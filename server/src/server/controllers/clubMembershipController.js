const express = require('express');
const router = express.Router();
const ClubMembership = require('../models/clubMembershipModel');
const {
  getUser,
  isAdmin,
  getClubAccess,
  requireClubPermission,
  writeClubAudit,
} = require('../services/clubOperationsService');

const STATUSES = new Set(['active', 'inactive', 'left', 'removed']);
const ROLES = new Set(['owner', 'president', 'captain', 'vice_captain', 'recruiter', 'finance_manager', 'match_coordinator', 'member']);

function handleError(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

async function loadMembership(id) {
  const rows = await new ClubMembership().selectOne(id);
  return rows[0] || null;
}

function normalizeBody(body = {}) {
  return {
    ...body,
    status: STATUSES.has(body.status) ? body.status : 'active',
    primary_role: ROLES.has(body.primary_role) ? body.primary_role : 'member',
  };
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
    const rows = await new ClubMembership().selectAll(filters);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const row = await loadMembership(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const access = await getClubAccess(user, row.club_id);
    if (!isAdmin(user) && !access.allowed && row.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(row);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const body = normalizeBody(req.body);
    const { user } = await requireClubPermission(req, body.club_id, 'manage_staff');
    const existing = await new ClubMembership().selectAll({
      club_id: body.club_id,
      player_id: body.player_id,
      status: 'active',
      limit: 1,
    });
    if (existing.length && body.status === 'active') return res.status(409).json({ error: 'Active membership already exists' });
    const model = new ClubMembership({ ...body, source: body.source || 'manual' });
    await model.create();
    const created = await loadMembership(model.id);
    await writeClubAudit({ clubId: created.club_id, user, action: 'club_membership_created', entityType: 'club_membership', entityId: created.id, newValue: created });
    res.status(201).json(created);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await loadMembership(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { user } = await requireClubPermission(req, existing.club_id, 'manage_staff');
    const body = normalizeBody({ ...existing, ...req.body });
    await new ClubMembership(body).update(existing.id);
    const updated = await loadMembership(existing.id);
    await writeClubAudit({ clubId: existing.club_id, user, action: 'club_membership_updated', entityType: 'club_membership', entityId: existing.id, oldValue: existing, newValue: updated });
    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await loadMembership(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { user } = await requireClubPermission(req, existing.club_id, 'manage_staff');
    await new ClubMembership().delete(existing.id);
    await writeClubAudit({ clubId: existing.club_id, user, action: 'club_membership_deleted', entityType: 'club_membership', entityId: existing.id, oldValue: existing });
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
