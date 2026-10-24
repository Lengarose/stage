const express = require('express');
const router = express.Router();
const { EXECUTESQL } = require('../db/database');
const { HANDLERS } = require('./functionsController');
const { resolveTournamentRules } = require('../utils/tournamentRuleTemplates');
const { loadStageCountries } = require('../utils/stageCountries');
const TournamentStatisticsModel = require('../models/tournamentStatisticsModel');

router.get('/tournaments/:id/statistics', async (req, res) => {
  try {
    const result = await new TournamentStatisticsModel().selectByTournament(req.params.id);
    if (!result) return res.status(404).json({ error: 'Tournament not found' });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function attachRenderedRules(tournament, locale) {
  if (locale !== 'fr' && locale !== 'en') return tournament;
  const resolved = resolveTournamentRules(tournament, locale, loadStageCountries());
  return { ...tournament, rules_rendered: resolved.body };
}

// Public tournament routes stay unauthenticated, but their implementation
// belongs in a controller so the app bootstrap stays focused on wiring.
router.post('/resolve-entrance-token', async (req, res) => {
  try {
    const result = await HANDLERS.resolveTournamentEntranceToken({ token: req.body?.token });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to resolve entrance token' });
  }
});

router.get('/tournaments/:id', async (req, res) => {
  try {
    const rows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const tournament = rows[0];
    const player = tournament.participant_type === 'player';
    let ids = tournament[player ? 'registered_players' : 'registered_clubs'] || [];
    if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = []; } }
    ids = [...new Set((Array.isArray(ids) ? ids : []).filter(id => id != null && String(id).trim()).map(String))];
    const profiles = ids.length ? await EXECUTESQL(`SELECT id, ${player ? 'gamertag, avatar_url' : 'name, logo_url'} FROM ${player ? 'players' : 'clubs'} WHERE id IN (${ids.map(() => '?').join(',')})`, ids) : [];
    res.json({ ...attachRenderedRules(tournament, req.query.locale), standing_participants: ids.map(id => profiles.find(p => String(p.id) === id) || { id }) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load tournament' });
  }
});

router.get('/tournaments/:id/matches', async (req, res) => {
  try {
    const rows = await EXECUTESQL(
      `SELECT *
         FROM matches
        WHERE tournament_id = ?
        ORDER BY round ASC, group_number ASC, created_date ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load tournament matches' });
  }
});

module.exports = router;
