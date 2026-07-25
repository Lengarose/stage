const express = require('express');
const router = express.Router();
const FutMatchModel = require('../models/futMatchModel');
const { EXECUTESQL } = require('../db/database');

async function playerForUser(userId) {
  if (!userId) return null;
  const rows = await EXECUTESQL('SELECT id, email FROM players WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

async function isAdmin(userId) {
  const rows = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [userId]).catch(() => []);
  return rows[0]?.role_id === 2;
}

function normalizeResult(result) {
  const r = String(result || '').toLowerCase();
  if (['win', 'w'].includes(r)) return 'win';
  if (['draw', 'd'].includes(r)) return 'draw';
  if (['loss', 'l', 'lose'].includes(r)) return 'loss';
  return null;
}

router.get('/', async (req, res) => {
  try {
    const { id, player_id, player_email, limit, offset } = req.query;
    const model = new FutMatchModel();
    let result;
    if (id) result = await model.selectOne(String(id));
    else if (player_id) result = await model.selectByPlayer(String(player_id), Number(limit) || 50);
    else if (player_email) {
      result = await EXECUTESQL(
        'SELECT * FROM player_fut_matches WHERE player_email = ? ORDER BY played_at DESC LIMIT ?',
        [String(player_email), Number(limit) || 50]
      );
    } else {
      result = await model.selectAll(Number(limit) || 50, Number(offset) || 0);
    }
    res.json(Array.isArray(result) ? result : (result?.length ? result : []));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await new FutMatchModel().selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const owner = await playerForUser(req.user?.id);
    if (!owner) return res.status(403).json({ error: 'Player profile required' });

    const normalizedResult = normalizeResult(req.body?.result);
    if (!normalizedResult) return res.status(400).json({ error: 'result must be win, draw, or loss' });
    if (!req.body?.played_at) return res.status(400).json({ error: 'played_at is required' });

    const row = new FutMatchModel({
      ...req.body,
      player_id: owner.id,
      player_email: owner.email,
      result: normalizedResult,
    });
    await row.create();
    const created = await row.selectOne(row.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new FutMatchModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });

    const admin = await isAdmin(req.user?.id);
    const owner = await playerForUser(req.user?.id);
    if (!admin && existing[0].player_id !== owner?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const body = { ...req.body };
    if (body.result != null) {
      const normalizedResult = normalizeResult(body.result);
      if (!normalizedResult) return res.status(400).json({ error: 'Invalid result' });
      body.result = normalizedResult;
    }

    const row = new FutMatchModel({ ...existing[0], ...body, player_id: existing[0].player_id });
    await row.update(id);
    const updated = await row.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new FutMatchModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });

    const admin = await isAdmin(req.user?.id);
    const owner = await playerForUser(req.user?.id);
    if (!admin && existing[0].player_id !== owner?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await new FutMatchModel().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
