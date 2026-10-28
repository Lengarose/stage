const express = require('express');
const { EXECUTESQL, withTransaction } = require('../db/database');
const service = require('../services/tournamentPresentationService');
function createRouter({ query = EXECUTESQL, transaction = withTransaction, publicRead = false } = {}) {
  const router = express.Router();
  const wrap = fn => async (req,res) => { try { await fn(req,res); } catch(e) { res.status(e.status || 500).json({error:e.message}); } };
  if (publicRead) router.get('/tournaments/:id/presentation',wrap(async(req,res)=>res.json(await service.presentation(req.params.id,query))));
  else router.post('/:id/presentation',wrap(async(req,res)=>res.json(await service.edit(req.params.id,req.body || {},req.user,transaction))));
  return router;
}
module.exports = createRouter;
