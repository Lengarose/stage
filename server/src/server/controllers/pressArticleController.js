const express      = require('express');
const router       = express.Router();
const PressArticle = require('../models/pressArticleModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { press_conference_id, club_name, page } = req.query;
    const pa = new PressArticle();
    let result;
    if (press_conference_id || club_name) {
      result = await pa.selectFiltered({ press_conference_id, club_name });
    } else {
      result = await pa.selectAll(Number(page) || 1);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const pa     = new PressArticle();
    const result = await pa.selectOne(req.params.id);
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
    const pa = new PressArticle(req.body);
    await pa.create();
    const created = await pa.selectOne(pa.id);
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
    const existing = await new PressArticle().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const pa = new PressArticle({ ...existing[0], ...req.body });
    await pa.update(id);
    const updated = await pa.selectOne(id);
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
    const existing = await new PressArticle().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new PressArticle().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
