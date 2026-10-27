const express = require('express');
const { EXECUTESQL, withTransaction } = require('../db/database');
const service = require('../services/gostOverviewService');
function createRouter({ query = EXECUTESQL, transaction = withTransaction } = {}) {
  const router = express.Router();
  const wrap = fn => async (req, res) => { try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    await fn(req, res);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  async function admin(req) {
    const [user] = await query('SELECT id,email,role_id FROM users WHERE id=?', [req.user.id]);
    if (!user || ![0, 2].includes(Number(user.role_id))) throw Object.assign(new Error('Admin access required'), { status: 403 });
    return user;
  }
  router.get('/overview', wrap(async (req, res) => res.json(await service.overview(query))));
  router.get('/:id/trophy', wrap(async (req, res) => {
    await admin(req);
    const result = await service.assignment(req.params.id, query);
    res.json({ state: result.state, guidance: result.guidance, trophy: result.trophy, revision: result.revision, selected_id: result.settings.trophy_item_id || result.source.trophy_item_id || result.ids[0] || '', items: result.items.filter(i => !i.tournament_id && (!i.linked_source_id || i.linked_source_id === req.params.id && i.linked_source_type === 'competition')).map(service.publicTrophy) });
  }));
  router.post('/:id/trophy', wrap(async (req, res) => {
    const user = await admin(req);
    const result = await service.assign(req.params.id, req.body || {}, user, transaction);
    res.json({ trophy: result.trophy, state: result.state });
  }));
  return router;
}
module.exports = createRouter();
module.exports.createRouter = createRouter;
