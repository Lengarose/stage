const express = require('express');
const CompetitionEngineModel = require('../models/competitionEngineModel');
const service = require('../services/competitionEngineService');

const router = express.Router();
const model = new CompetitionEngineModel();

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Competition engine error' });
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
