const express = require('express');
const { EXECUTESQL } = require('../db/database');
const { resolveUserIdentity } = require('../services/identityService');
const { createCalendarService } = require('../services/scheduleCalendarService');

function createRouter({ query = EXECUTESQL, resolveIdentity = resolveUserIdentity } = {}) {
  const router = express.Router();
  const readCalendar = createCalendarService({ query, resolveIdentity });
  router.get('/calendar', async (req,res) => {
    if (!req.user?.id) return res.status(401).json({error:'Authentication required.'});
    try { res.json(await readCalendar(req.user.id,req.query)); }
    catch (err) { res.status(err.status || 500).json({error:err.status === 400 ? err.message : 'Unable to load scheduled games.'}); }
  });
  return router;
}
module.exports = createRouter();
module.exports.createRouter = createRouter;
