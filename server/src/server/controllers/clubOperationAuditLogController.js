const express = require('express');
const router = express.Router();
const ClubOperationAuditLog = require('../models/clubOperationAuditLogModel');
const { getUser, isAdmin, getClubAccess } = require('../services/clubOperationsService');

function handleError(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

router.get('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (req.query?.club_id) {
      const access = await getClubAccess(user, req.query.club_id);
      if (!isAdmin(user) && !access.allowed) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isAdmin(user)) {
      return res.status(400).json({ error: 'club_id is required' });
    }
    res.json(await new ClubOperationAuditLog().selectAll(req.query));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const rows = await new ClubOperationAuditLog().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const access = await getClubAccess(user, rows[0].club_id);
    if (!isAdmin(user) && !access.allowed) return res.status(403).json({ error: 'Forbidden' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
