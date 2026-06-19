const express    = require('express');
const router     = express.Router();
const Tournament = require('../models/tournamentModel');
const { EXECUTESQL } = require('../db/database');
const { broadcastTournament, broadcastTournamentDeleted } = require('../utils/socketBroadcast');
const { DEFAULT_STORE_SETTINGS, getActiveStoreSettings } = require('../utils/storeSettings');

const TOURNAMENT_ENTRY_CREDITS = DEFAULT_STORE_SETTINGS.tournament_entry_credits;
const COMMUNITY_TOURNAMENT_LIMIT = DEFAULT_STORE_SETTINGS.community_tournament_limit;

function hasStagePlus(subscription) {
  return ['stage_plus', 'plus', 'pro', 'elite'].includes(String(subscription || '').toLowerCase());
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { page, limit, ...filters } = req.query;
    const tournament = new Tournament();
    const FILTER_KEYS = ['id', 'status', 'winner_club_id', 'winner_player_id',
                         'organizer_email', 'creator_email', 'participant_type',
                         'type', 'platform', 'region', 'country_code'];
    const hasFilter = FILTER_KEYS.some(k => filters[k] !== undefined && filters[k] !== '');
    let result;
    if (hasFilter) {
      result = await tournament.selectByFilters(filters, limit || 200);
    } else {
      result = await tournament.selectAll(Number(page) || 1);
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
    const tournament = new Tournament();
    const result     = await tournament.selectOne(req.params.id);
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
    const storeSettings = await getActiveStoreSettings();
    const userId = req.user?.id;
    const users = userId
      ? await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [userId])
      : [];
    const user = users[0] || null;
    const isAdmin = [0, 2].includes(Number(user?.role_id));

    if (!isAdmin) {
      const playerRows = await EXECUTESQL(
        'SELECT id, subscription FROM players WHERE user_id = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?)) ORDER BY user_id = ? DESC, updated_date DESC LIMIT 1',
        [userId, user?.email || '', userId]
      );
      const player = playerRows[0] || null;
      if (!hasStagePlus(player?.subscription)) {
        return res.status(403).json({ error: 'STAGE Plus is required to create tournaments.' });
      }
      const activeRows = await EXECUTESQL(
        `SELECT COUNT(*) AS count
         FROM tournaments
         WHERE organizer_email = ?
           AND status IN ('registration', 'in_progress')`,
        [user?.email || req.body.organizer_email || '']
      );
      const tournamentLimit = Number(storeSettings.community_tournament_limit || COMMUNITY_TOURNAMENT_LIMIT);
      if (Number(activeRows[0]?.count || 0) >= tournamentLimit) {
        return res.status(403).json({ error: `STAGE Plus allows ${tournamentLimit} active community tournaments.` });
      }
    }

    const body = {
      ...req.body,
      entry_credits: Number(req.body.entry_credits ?? storeSettings.tournament_entry_credits ?? TOURNAMENT_ENTRY_CREDITS) || TOURNAMENT_ENTRY_CREDITS,
    };
    const tournament = new Tournament(body);
    await tournament.create();
    const created = await tournament.selectOne(tournament.id);
    const record  = created[0];
    broadcastTournament(record);
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Tournament().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const tournament = new Tournament({ ...existing[0], ...req.body });
    await tournament.update(id);
    const updated = await tournament.selectOne(id);
    const record  = updated[0];
    broadcastTournament(record);
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
    const existing = await new Tournament().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Tournament().delete(id);
    broadcastTournamentDeleted(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
