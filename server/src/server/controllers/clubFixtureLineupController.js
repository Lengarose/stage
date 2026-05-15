const express = require('express');
const router = express.Router();
const ClubFixtureLineup = require('../models/clubFixtureLineupModel');
const { requireClubPermission, writeClubAudit, parseJson } = require('../services/clubOperationsService');

const STATUSES = new Set(['draft', 'published']);

function handleError(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

function normalize(row) {
  return row ? {
    ...row,
    starting_players: parseJson(row.starting_players, []),
    bench_players: parseJson(row.bench_players, []),
  } : row;
}

async function loadLineup(id) {
  const rows = await new ClubFixtureLineup().selectOne(id);
  return normalize(rows[0] || null);
}

router.get('/', async (req, res) => {
  try {
    if (req.query?.club_id) await requireClubPermission(req, req.query.club_id, 'manage_lineup');
    const rows = await new ClubFixtureLineup().selectAll(req.query);
    res.json(rows.map(normalize));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await loadLineup(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    await requireClubPermission(req, row.club_id, 'manage_lineup');
    res.json(row);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const { user } = await requireClubPermission(req, req.body?.club_id, 'manage_lineup');
    if (!STATUSES.has(req.body?.status || 'draft')) return res.status(400).json({ error: 'Invalid status' });
    const model = new ClubFixtureLineup({ ...req.body, status: req.body?.status || 'draft', created_by_user_id: user.id });
    await model.create();
    const created = await loadLineup(model.id);
    await writeClubAudit({ clubId: created.club_id, user, action: 'lineup_saved', entityType: 'club_fixture_lineup', entityId: created.id, newValue: created });
    res.status(201).json(created);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await loadLineup(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { user } = await requireClubPermission(req, existing.club_id, 'manage_lineup');
    const body = { ...existing, ...req.body, created_by_user_id: existing.created_by_user_id || user.id };
    if (!STATUSES.has(body.status)) return res.status(400).json({ error: 'Invalid status' });
    await new ClubFixtureLineup(body).update(existing.id);
    const updated = await loadLineup(existing.id);
    await writeClubAudit({ clubId: existing.club_id, user, action: body.status === 'published' ? 'lineup_published' : 'lineup_saved', entityType: 'club_fixture_lineup', entityId: existing.id, oldValue: existing, newValue: updated });
    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await loadLineup(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { user } = await requireClubPermission(req, existing.club_id, 'manage_lineup');
    await new ClubFixtureLineup().delete(existing.id);
    await writeClubAudit({ clubId: existing.club_id, user, action: 'lineup_deleted', entityType: 'club_fixture_lineup', entityId: existing.id, oldValue: existing });
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/publish/:clubId/:fixtureId', async (req, res) => {
  try {
    const { clubId, fixtureId } = req.params;
    const { user } = await requireClubPermission(req, clubId, 'manage_lineup');
    const rows = await new ClubFixtureLineup().selectAll({ club_id: clubId, fixture_id: fixtureId, limit: 1 });
    if (!rows.length) return res.status(404).json({ error: 'Lineup not found' });
    const existing = normalize(rows[0]);
    await new ClubFixtureLineup({ ...existing, status: 'published', created_by_user_id: existing.created_by_user_id || user.id }).update(existing.id);
    const updated = await loadLineup(existing.id);
    await writeClubAudit({ clubId, user, action: 'lineup_published', entityType: 'club_fixture_lineup', entityId: existing.id, oldValue: existing, newValue: updated });
    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
