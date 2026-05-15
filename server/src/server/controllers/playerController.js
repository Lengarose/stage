const express = require('express');
const router  = express.Router();
const Player  = require('../models/playerModel');
const { EXECUTESQL } = require('../db/database');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

let secondaryPositionColumnReady = null;

function normalizePlayerPayload(body = {}) {
  const payload = { ...body };
  if ('secondary_position' in payload) {
    payload.secondary_position =
      payload.secondary_position && payload.secondary_position !== 'none'
        ? payload.secondary_position
        : null;
    if (payload.secondary_position && payload.secondary_position === payload.position) {
      payload.secondary_position = null;
    }
  }
  return payload;
}

async function ensureSecondaryPositionColumn() {
  if (!secondaryPositionColumnReady) {
    secondaryPositionColumnReady = (async () => {
      const rows = await EXECUTESQL(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
        ['players', 'secondary_position']
      );
      if (!rows.length) {
        await EXECUTESQL('ALTER TABLE players ADD COLUMN secondary_position VARCHAR(50) NULL');
      }
    })().catch((err) => {
      secondaryPositionColumnReady = null;
      throw err;
    });
  }
  return secondaryPositionColumnReady;
}

// GET /
router.get('/', async (req, res) => {
  try {
    await ensureSecondaryPositionColumn();
    const { email, user_id, club_id, gamertag, page } = req.query;
    const player = new Player();
    let result;
    if (email) result = await player.selectByEmail(email);
    else if (user_id) result = await player.selectByUserId(user_id);
    else if (club_id) result = await player.selectByClub(club_id);
    else if (gamertag) {
      result = await EXECUTESQL(
        'SELECT * FROM players WHERE LOWER(gamertag) = LOWER(?) LIMIT 50',
        [String(gamertag)]
      );
    } else {
      result = await player.selectAll(Number(page) || 1);
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
    await ensureSecondaryPositionColumn();
    const player = new Player();
    const result = await player.selectOne(req.params.id);
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
    await ensureSecondaryPositionColumn();
    const body = normalizePlayerPayload(req.body);
    const { gamertag } = body || {};
    if (gamertag) {
      const existingByGamertag = await EXECUTESQL(
        'SELECT id FROM players WHERE LOWER(gamertag) = LOWER(?) LIMIT 1',
        [gamertag]
      );
      if (existingByGamertag.length) {
        return res.status(409).json({ error: 'A player with this gamertag already exists' });
      }
    }

    const player = new Player(body);
    await player.create();
    const created = await player.selectOne(player.id);
    const record  = created[0];
    if (record?.user_id) {
      await EXECUTESQL(
        'UPDATE users SET player_id = ?, role_id = 1, updated_date = NOW() WHERE id = ?',
        [record.id, record.user_id]
      );
    }

    // ── Wallet initialization: always grant 50,000 STC on first creation ──
    const INITIAL_STC = 50_000;
    try {
      await EXECUTESQL(
        'UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ? AND stc < ?',
        [INITIAL_STC, record.id, INITIAL_STC]
      );
      const existingWelcome = await EXECUTESQL(
        "SELECT id FROM player_stc_transactions WHERE player_id = ? AND category = 'initial_grant' LIMIT 1",
        [record.id]
      );
      if (!existingWelcome.length) {
        await EXECUTESQL(
          `INSERT INTO player_stc_transactions
             (id, player_id, player_email, amount, balance_after, type, category, source, description, created_date)
           VALUES (?, ?, ?, ?, ?, 'income', 'initial_grant', 'STAGE',
                   'Welcome to STAGE — 50,000 STC starting balance', NOW())`,
          [uuidv4(), record.id, record.email || null, INITIAL_STC, INITIAL_STC]
        );
      }
      record.stc = INITIAL_STC;
    } catch (walletErr) {
      console.error('[wallet-init] failed for player', record.id, walletErr.message);
    }

    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.PLAYER), record);
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    await ensureSecondaryPositionColumn();
    const { id } = req.params;
    const body = normalizePlayerPayload(req.body);
    const existing = await new Player().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (body?.gamertag) {
      const existingByGamertag = await EXECUTESQL(
        'SELECT id FROM players WHERE LOWER(gamertag) = LOWER(?) AND id <> ? LIMIT 1',
        [body.gamertag, id]
      );
      if (existingByGamertag.length) {
        return res.status(409).json({ error: 'A player with this gamertag already exists' });
      }
    }
    const player = new Player({ ...existing[0], ...body });
    await player.update(id);
    const updated = await player.selectOne(id);
    const record  = updated[0];
    if (record?.user_id) {
      await EXECUTESQL(
        'UPDATE users SET player_id = COALESCE(player_id, ?), role_id = 1, updated_date = NOW() WHERE id = ?',
        [record.id, record.user_id]
      );
    }
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.PLAYER), record);
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Player().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Player().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.PLAYER), { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
