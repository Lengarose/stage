const express = require('express');
const { EXECUTESQL, withTransaction } = require('../db/database');
const service = require('../services/regionalPublicService');
const art = require('../services/gostOverviewService');
function createRouter({ query = EXECUTESQL, transaction = withTransaction } = {}) {
  const router = express.Router();
  const wrap = fn => async (req, res) => { try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    await fn(req, res);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  const admin = async req => {
    const [user] = await query('SELECT id,email,role_id FROM users WHERE id=?', [req.user.id]);
    if (!user || ![0, 2].includes(Number(user.role_id))) throw Object.assign(new Error('Admin access required'), { status: 403 });
    return user;
  };
  router.get('/overview', wrap(async (req, res) => res.json(await service.overview(query))));
  router.get('/:id/clubs', wrap(async (req, res) => res.json(await service.participants(req.params.id, query))));
  router.get('/:id/trophy', wrap(async (req, res) => {
    await admin(req);
    const data = await art.assignment(req.params.id, query, false, 'regional_league');
    res.json({ state: data.state, guidance: data.guidance, revision: data.revision, selected_id: data.settings.trophy_item_id || data.source.trophy_item_id || data.ids[0] || '', items: data.items.filter(i => !i.tournament_id && (!i.linked_source_id || i.linked_source_type === 'regional_league' && i.linked_source_id === req.params.id)).map(art.publicTrophy) });
  }));
  router.post('/:id/trophy', wrap(async (req, res) => {
    const result = await art.assign(req.params.id, req.body || {}, await admin(req), transaction, 'regional_league');
    res.json({ state: result.state, trophy: result.trophy });
  }));
  return router;
}
module.exports = createRouter();
module.exports.createRouter = createRouter;
