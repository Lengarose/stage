const express = require('express');
const router  = express.Router();
const PlayerStcTransaction = require('../models/playerStcTransactionModel');

// GET / — supports ?player_id=, ?player_email=, ?category=, ?type=, ?limit=, ?offset=
router.get('/', async (req, res) => {
  try {
    const { player_id, player_email, limit = 50, offset = 0, orderBy } = req.query;
    const model = new PlayerStcTransaction();
    let result;
    if (player_id)    result = await model.selectByPlayer(player_id, Number(limit), Number(offset));
    else if (player_email) result = await model.selectByPlayerEmail(player_email, Number(limit));
    else result = await model.selectAll(1);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await new PlayerStcTransaction().selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const tx = new PlayerStcTransaction(req.body);
    await tx.create();
    const created = await tx.selectOne(tx.id);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new PlayerStcTransaction().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const tx = new PlayerStcTransaction({ ...existing[0], ...req.body });
    await tx.update(id);
    const updated = await tx.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await new PlayerStcTransaction().selectOne(req.params.id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new PlayerStcTransaction().delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
