const express = require('express');
const router = express.Router();
const ClubFixtureAvailability = require('../models/clubFixtureAvailabilityModel');
const {
  getUser,
  getClubAccess,
  getPlayerForUser,
  isAdmin,
  requireClubPermission,
  writeClubAudit,
} = require('../services/clubOperationsService');

const STATUSES = new Set(['available', 'unavailable', 'maybe', 'no_response']);

function handleError(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

async function loadAvailability(id) {
  const rows = await new ClubFixtureAvailability().selectOne(id);
  return rows[0] || null;
}

async function canManageOrOwn(user, clubId, playerId) {
  if (isAdmin(user)) return true;
  const access = await getClubAccess(user, clubId);
  if (access.permissions.includes('manage_lineup')) return true;
  const mine = await getPlayerForUser(user, clubId);
  return mine?.id === playerId;
}

router.get('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const filters = { ...req.query };
    if (filters.club_id) {
      const access = await getClubAccess(user, filters.club_id);
      if (!isAdmin(user) && !access.permissions.includes('manage_lineup')) {
        const mine = await getPlayerForUser(user, filters.club_id);
        filters.player_id = mine?.id || '__none__';
      }
    } else if (!isAdmin(user)) {
      const mine = await getPlayerForUser(user);
      filters.player_id = mine?.id || '__none__';
    }
    res.json(await new ClubFixtureAvailability().selectAll(filters));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const row = await loadAvailability(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!await canManageOrOwn(user, row.club_id, row.player_id)) return res.status(403).json({ error: 'Forbidden' });
    res.json(row);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const mine = await getPlayerForUser(user, req.body?.club_id);
    const playerId = req.body?.player_id || mine?.id;
    if (!await canManageOrOwn(user, req.body?.club_id, playerId)) return res.status(403).json({ error: 'Forbidden' });
    if (!STATUSES.has(req.body?.status || 'no_response')) return res.status(400).json({ error: 'Invalid status' });
    const model = new ClubFixtureAvailability({ ...req.body, player_id: playerId, user_id: req.body?.user_id || user.id });
    await model.create();
    const created = await loadAvailability(model.id);
    res.status(201).json(created);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const existing = await loadAvailability(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!await canManageOrOwn(user, existing.club_id, existing.player_id)) return res.status(403).json({ error: 'Forbidden' });
    const body = { ...existing, ...req.body };
    if (!STATUSES.has(body.status)) return res.status(400).json({ error: 'Invalid status' });
    await new ClubFixtureAvailability(body).update(existing.id);
    res.json(await loadAvailability(existing.id));
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await loadAvailability(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await requireClubPermission(req, existing.club_id, 'manage_lineup');
    await new ClubFixtureAvailability().delete(existing.id);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
