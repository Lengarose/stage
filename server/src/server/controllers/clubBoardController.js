'use strict';

const router = require('express').Router();
const service = require('../services/clubAgreementService');
const handle = fn => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (e) {
    res.status(e.status || 500).json({
      error: e.message,
      details: e.details
    });
  }
};
router.post('/clubs/:clubId/prepare', handle(req => service.prepare(req.params.clubId,req.user)));
router.get('/clubs/:clubId/contract-options',handle(req=>service.contractOptions(req.params.clubId,req.query.player_id,req.user)));
router.get('/clubs/:clubId', handle(req => service.dashboard(req.params.clubId, req.user)));
router.get('/proposals/:id', handle(req => service.proposal(req.params.id, req.user)));
router.post('/agreements/:id/terminate',handle(req=>service.terminate(req.params.id,req.user)));
router.post('/proposals', handle(req => service.offer(req.body || {}, req.user)));
router.post('/proposals/:id/respond', handle(req => service.respond(req.params.id, req.body || {}, req.user)));
module.exports = router;
