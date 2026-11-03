const express = require('express');
const router = express.Router();
const ClubFixtureLineup = require('../models/clubFixtureLineupModel');
const { requireClubPermission, parseJson } = require('../services/clubOperationsService');
const eligibility = require('../services/officialMatchEligibilityService');

const STATUSES = new Set(['draft', 'published']);

function handleError(res, err) {
  res.status(err.status || 500).json({ error: err.message, code: err.code || null });
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

router.get('/preparation/:clubId/:fixtureId', async (req,res)=>{
  try {
    await requireClubPermission(req,req.params.clubId,'manage_lineup');
    res.json(await eligibility.preparationStatus(req.params.clubId,req.params.fixtureId));
  } catch(err) {handleError(res,err);}
});
router.post('/preparation/:clubId/:fixtureId', async (req,res)=>{
  try {
    const {user}=await requireClubPermission(req,req.params.clubId,'manage_lineup');
    res.json(await eligibility.preparationAction(req.params.clubId,req.params.fixtureId,req.body,user));
  } catch(err) {handleError(res,err);}
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
    const created = normalize(await eligibility.mutate({ body: { ...req.body, status: req.body?.status || 'draft' }, user }));
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
    const updated = normalize(await eligibility.mutate({ existingId: existing.id, body: req.body, user }));
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
    await eligibility.mutate({ existingId: existing.id, body: {}, user, remove: true });
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
    const updated = normalize(await eligibility.mutate({ existingId: existing.id, body: { status: 'published' }, user }));
    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
