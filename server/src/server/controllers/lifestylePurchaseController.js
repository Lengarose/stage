const express           = require('express');
const router            = express.Router();
const LifestylePurchase = require('../models/lifestylePurchaseModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { player_id, item_type, page } = req.query;
    const lp = new LifestylePurchase();
    let result;
    if (player_id && item_type) result = await lp.selectByPlayerAndType(player_id, item_type);
    else if (player_id)         result = await lp.selectByPlayer(player_id);
    else if (item_type)         result = await lp.selectByItemType(item_type);
    else result = await lp.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const lp     = new LifestylePurchase();
    const result = await lp.selectOne(req.params.id);
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
    const lp = new LifestylePurchase(req.body);
    await lp.create();
    const created = await lp.selectOne(lp.id);
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
    const existing = await new LifestylePurchase().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const lp = new LifestylePurchase({ ...existing[0], ...req.body });
    await lp.update(id);
    const updated = await lp.selectOne(id);
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
    const existing = await new LifestylePurchase().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new LifestylePurchase().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
