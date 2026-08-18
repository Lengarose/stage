const express = require('express');
const router = express.Router();
const Follow = require('../models/followModel');
const { EXECUTESQL } = require('../db/database');

const TARGET_TYPES = new Set(['player', 'club']);

async function resolveFollower(req) {
  const userId = String(req.user?.id || '').trim();
  const email = String(req.user?.email || '').trim();
  if (!userId) return null;
  const players = await EXECUTESQL(
    `SELECT id FROM players
      WHERE user_id = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?))
      ORDER BY user_id = ? DESC
      LIMIT 1`,
    [userId, email || '', userId]
  ).catch(() => []);
  return {
    follower_id: userId,
    follower_email: email || null,
    follower_player_id: players[0]?.id || null,
  };
}

function ownsFollow(row, follower) {
  if (!row || !follower) return false;
  if (String(row.follower_id || '') === String(follower.follower_id)) return true;
  if (row.follower_email && follower.follower_email
    && String(row.follower_email).toLowerCase() === String(follower.follower_email).toLowerCase()) {
    return true;
  }
  return false;
}

router.get('/', async (req, res) => {
  try {
    const rows = await Follow.getAll(req.query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await Follow.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const follower = await resolveFollower(req);
    if (!follower) return res.status(401).json({ error: 'Unauthorized' });

    const target_id = String(req.body?.target_id || '').trim();
    const target_type = String(req.body?.target_type || '').trim().toLowerCase();
    const target_name = String(req.body?.target_name || '').trim() || null;
    if (!target_id || !TARGET_TYPES.has(target_type)) {
      return res.status(400).json({ error: 'target_id and target_type (player|club) are required' });
    }
    if (target_type === 'player' && (
      target_id === follower.follower_id || target_id === follower.follower_player_id
    )) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const existing = await Follow.findOne({
      follower_id: follower.follower_id,
      target_id,
      target_type,
    });
    if (existing) return res.status(200).json(existing);

    const row = await Follow.create({
      follower_id: follower.follower_id,
      follower_email: follower.follower_email,
      follower_player_id: follower.follower_player_id,
      target_id,
      target_type,
      target_name,
    });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const follower = await resolveFollower(req);
    if (!follower) return res.status(401).json({ error: 'Unauthorized' });
    const row = await Follow.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!ownsFollow(row, follower)) return res.status(403).json({ error: 'Forbidden' });
    await Follow.delete(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
