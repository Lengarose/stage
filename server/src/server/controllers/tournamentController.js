const express    = require('express');
const router     = express.Router();
const Tournament = require('../models/tournamentModel');
const { EXECUTESQL } = require('../db/database');
const { broadcastTournament, broadcastTournamentDeleted } = require('../utils/socketBroadcast');
const { TOURNAMENT_CREDIT_COST, normalizeTournamentEconomics } = require('../utils/tournamentRules');

function hasStagePlus(subscription) {
  return ['stage_plus', 'plus', 'pro', 'elite'].includes(String(subscription || '').toLowerCase());
}

function isCommunityTournament(tournament) {
  return Boolean(tournament?.creator_gamertag) || Boolean(tournament?.creator_id);
}

function completedTournamentDeleteWaitMs(tournament) {
  if (String(tournament?.status || '').toLowerCase() !== 'completed') return 0;
  if (!isCommunityTournament(tournament)) return 0;
  const completedAt = new Date(tournament.end_date || tournament.updated_date || tournament.created_date).getTime();
  if (!Number.isFinite(completedAt)) return 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, completedAt + 7 * 24 * 60 * 60 * 1000 - Date.now());
}

function placeholders(items) {
  return items.map(() => '?').join(',');
}

async function deleteTournamentRecords(id) {
  const matches = await EXECUTESQL('SELECT id FROM matches WHERE tournament_id = ?', [id]);
  const matchIds = matches.map(row => row.id).filter(Boolean);
  if (matchIds.length) {
    const inMatches = placeholders(matchIds);
    await EXECUTESQL(`DELETE FROM match_player_stats WHERE match_id IN (${inMatches})`, matchIds).catch(() => {});
    await EXECUTESQL('DELETE FROM match_player_stats WHERE tournament_id = ?', [id]).catch(() => {});
    await EXECUTESQL(`DELETE FROM dressing_rooms WHERE match_id IN (${inMatches})`, matchIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM predictions WHERE live_match_id IN (SELECT id FROM live_matches WHERE match_id IN (${inMatches}))`, matchIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM live_matches WHERE match_id IN (${inMatches})`, matchIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM matches WHERE id IN (${inMatches})`, matchIds);
  }
  await EXECUTESQL(
    `DELETE FROM league_entities
      WHERE entity_type = 'tournament_entrance_link'
        AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.tournament_id')) = ?`,
    [id],
  ).catch(() => {});
  await EXECUTESQL('DELETE FROM tournaments WHERE id = ?', [id]);
  return { matches: matchIds.length };
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
    const userId = req.user?.id;
    const users = userId
      ? await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [userId])
      : [];
    const user = users[0] || null;
    const isAdmin = [0, 2].includes(Number(user?.role_id));
    let creatorPlayerId = null;

    if (!isAdmin) {
      const playerRows = await EXECUTESQL(
        'SELECT id, subscription, credits FROM players WHERE user_id = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?)) ORDER BY user_id = ? DESC, updated_date DESC LIMIT 1',
        [userId, user?.email || '', userId]
      );
      const player = playerRows[0] || null;
      creatorPlayerId = player?.id || null;
      if (!hasStagePlus(player?.subscription)) {
        return res.status(403).json({ error: 'STAGE Plus is required to create tournaments.' });
      }
      if (Number(player?.credits || 0) < TOURNAMENT_CREDIT_COST) {
        return res.status(402).json({ error: `Creating a tournament costs ${TOURNAMENT_CREDIT_COST} credits.` });
      }
    }

    const body = normalizeTournamentEconomics(req.body);
    const tournament = new Tournament(body);
    await tournament.create();
    if (!isAdmin && creatorPlayerId) {
      await EXECUTESQL(
        'UPDATE players SET credits = credits - ? WHERE id = ?',
        [TOURNAMENT_CREDIT_COST, creatorPlayerId]
      );
    }
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
    const shouldNormalize = ['type', 'max_teams', 'entry_fee_stc'].some(key => req.body[key] !== undefined);
    const merged = { ...existing[0], ...req.body };
    const tournament = new Tournament(shouldNormalize ? normalizeTournamentEconomics(merged) : merged);
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
    const users = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id]);
    const admin = users[0] || null;
    if (![0, 2].includes(Number(admin?.role_id))) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const existing = await new Tournament().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const tournament = existing[0];
    const waitMs = completedTournamentDeleteWaitMs(tournament);
    if (waitMs > 0) {
      const days = Math.ceil(waitMs / (24 * 60 * 60 * 1000));
      return res.status(409).json({
        error: `Community tournaments can only be deleted 7 days after completion. Try again in ${days} day${days === 1 ? '' : 's'}.`,
        code: 'TOURNAMENT_DELETE_LOCKED',
      });
    }
    const status = String(tournament.status || '').toLowerCase();
    if (!['completed', 'cancelled', 'registration'].includes(status)) {
      return res.status(409).json({
        error: 'Only completed, cancelled, or not-started tournaments can be deleted.',
        code: 'TOURNAMENT_DELETE_STATUS_BLOCKED',
      });
    }
    const deleted = await deleteTournamentRecords(id);
    await EXECUTESQL(
      `INSERT INTO admin_audit_log
         (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
       VALUES (UUID(), ?, ?, 'tournament_deleted_crud', 'tournament', ?, ?, ?, ?, 'Deleted through tournament CRUD route', NOW())`,
      [
        admin.id,
        admin.email,
        id,
        tournament.name,
        JSON.stringify(tournament),
        JSON.stringify({ deleted: true, deleted_matches: deleted.matches }),
      ],
    ).catch(() => {});
    broadcastTournamentDeleted(id);
    res.json({ success: true, deleted: true, deleted_matches: deleted.matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
