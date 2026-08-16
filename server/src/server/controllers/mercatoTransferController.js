const express = require('express');
const router = express.Router();
const { EXECUTESQL } = require('../db/database');
const {
  clubSummary,
  getTransfer,
  listTransfers,
  mercatoDesk,
  playerHistory,
  upsertTransfer,
} = require('../services/mercatoTransferService');

function handle(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

async function requireAdmin(req, res) {
  const rows = await EXECUTESQL('SELECT id, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id]).catch(() => []);
  if (Number(rows[0]?.role_id) !== 0) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return rows[0];
}

router.get('/', async (req, res) => {
  try {
    res.json(await listTransfers(req.query));
  } catch (err) {
    handle(res, err);
  }
});

router.get('/desk', async (req, res) => {
  try {
    res.json(await mercatoDesk(req.query));
  } catch (err) {
    handle(res, err);
  }
});

router.get('/clubs/:clubId', async (req, res) => {
  try {
    res.json(await clubSummary(req.params.clubId));
  } catch (err) {
    handle(res, err);
  }
});

router.get('/players/:playerId', async (req, res) => {
  try {
    res.json(await playerHistory(req.params.playerId));
  } catch (err) {
    handle(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await getTransfer(req.params.id, { bumpViews: true });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handle(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const created = await upsertTransfer({
      ...req.body,
      status: req.body?.status || 'rumour',
      verification_status: req.body?.status === 'rumour' ? 'unconfirmed' : (req.body?.verification_status || 'unconfirmed'),
    });
    res.status(201).json(created);
  } catch (err) {
    handle(res, err);
  }
});

router.post('/:id/status', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const existing = await getTransfer(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = await upsertTransfer({
      id: req.params.id,
      ...existing,
      status: req.body?.status,
      source_name: req.body?.source_name || existing.source_name,
      journalist_name: req.body?.journalist_name || existing.journalist_name,
      reliability: req.body?.reliability || existing.reliability,
    });
    res.json(updated);
  } catch (err) {
    handle(res, err);
  }
});

module.exports = router;
