const express = require('express');
const { EXECUTESQL } = require('../db/database');
const CompetitionEngineModel = require('../models/competitionEngineModel');
const service = require('../services/competitionEngineService');

const router = express.Router();
const model = new CompetitionEngineModel();

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Competition engine error' });
}

async function requireBackfillAdmin(req, res) {
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id]);
  const user = rows[0];
  if (!user || ![0, 2].includes(Number(user.role_id))) {
    res.status(403).json({ error: 'Admin access required', code: 'admin_required' });
    return null;
  }
  return user;
}

router.get('/instances', async (req, res) => {
  try {
    const rows = await model.listInstances({
      product_type: req.query.product_type,
      status: req.query.status,
      region: req.query.region,
      platform: req.query.platform,
    });
    res.json(rows);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/instances/:id', async (req, res) => {
  try {
    const rows = await model.selectInstance(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Instance not found' });
    res.json(rows[0]);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/instances/:id/participants', async (req, res) => {
  try {
    res.json(await model.listParticipants(req.params.id));
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/instances/:id/fixtures', async (req, res) => {
  try {
    res.json(await model.listFixtures(req.params.id, req.query));
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/instances/backfill', async (req, res) => {
  try {
    const admin = await requireBackfillAdmin(req, res);
    if (!admin) return;
    const productType = req.body?.product_type || 'community_tournament';
    if (productType === 'community_tournament') {
      const result = await service.backfillCommunityTournaments({ status: req.body?.status || null });
      return res.json(result);
    }
    if (productType === 'official_competition' || productType === 'regional_league') {
      const result = await service.backfillLeagueEntities({ productType, status: req.body?.status || null });
      return res.json(result);
    }
    return res.status(400).json({ error: 'product_type must be community_tournament, official_competition, or regional_league' });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/fixtures/:id/match/create', async (req, res) => {
  try {
    const match = await service.createMatchFromFixture(req.params.id);
    res.status(201).json(match);
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/matches/:id/results/submit', async (req, res) => {
  try {
    if (!['home', 'away'].includes(req.body?.side)) {
      return res.status(400).json({ error: 'side must be home or away' });
    }
    const result = await service.submitResult({
      matchId: req.params.id,
      side: req.body.side,
      submittedByUserId: req.user?.id,
      scoreHome: req.body.score_home,
      scoreAway: req.body.score_away,
      payloadJson: req.body.payload_json || null,
      proofUrl: req.body.proof_url || null,
    });
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
