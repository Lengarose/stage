const express        = require('express');
const router         = express.Router();
const PlayerContract = require('../models/playerContractModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { team_id, user_id, status, page } = req.query;
    const contract = new PlayerContract();
    let result;
    if (team_id && status)   result = await contract.selectByTeamAndStatus(team_id, status);
    else if (user_id && status) result = await contract.selectByUserAndStatus(user_id, status);
    else if (team_id)        result = await contract.selectByTeam(team_id);
    else if (user_id)        result = await contract.selectByUser(user_id);
    else if (status)         result = await contract.selectByStatus(status);
    else result = await contract.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const contract = new PlayerContract();
    const result   = await contract.selectOne(req.params.id);
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
    const contract = new PlayerContract(req.body);
    await contract.create();
    const created = await contract.selectOne(contract.id);
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
    const existing = await new PlayerContract().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const contract = new PlayerContract({ ...existing[0], ...req.body });
    await contract.update(id);
    const updated = await contract.selectOne(id);
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
    const existing = await new PlayerContract().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new PlayerContract().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
