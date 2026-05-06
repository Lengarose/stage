const express        = require('express');
const router         = express.Router();
const StcTransaction = require('../models/stcTransactionModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { club_id, type, page } = req.query;
    const tx = new StcTransaction();
    let result;
    if (club_id && type) result = await tx.selectByClubAndType(club_id, type);
    else if (club_id)    result = await tx.selectByClub(club_id);
    else if (type)       result = await tx.selectByType(type);
    else result = await tx.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const tx     = new StcTransaction();
    const result = await tx.selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const tx = new StcTransaction(req.body);
    await tx.create();
    const created = await tx.selectOne(tx.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new StcTransaction().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const tx = new StcTransaction({ ...existing[0], ...req.body });
    await tx.update(id);
    const updated = await tx.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new StcTransaction().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new StcTransaction().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
