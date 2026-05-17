const express = require('express');
const InternationalTournamentModel = require('../models/internationalTournamentModel');
const { EXECUTESQL } = require('../db/database');
const {
  canVoteForCandidate,
  chooseElectionWinner,
  normalizeCountryCode,
  validateSquadSelection,
} = require('../services/nationalTeamRules');

const router = express.Router();
const model = new InternationalTournamentModel();

async function getCurrentUser(req) {
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id]);
  return rows[0] || null;
}

function isAdmin(user) {
  return Number(user?.role_id) === 0 || Number(user?.role_id) === 2;
}

async function requireAdmin(req, res) {
  const user = await getCurrentUser(req);
  if (!isAdmin(user)) {
    res.status(403).json({ error: 'Admin access required', code: 'admin_required' });
    return null;
  }
  return user;
}

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message, code: err.code || err.reason || 'error' });
}

function parseDate(value) {
  if (!value) return null;
  const normalized = value instanceof Date ? value : String(value).replace(' ', 'T');
  const date = normalized instanceof Date ? normalized : new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPastDate(value, now = new Date()) {
  const date = parseDate(value);
  return Boolean(date && date <= now);
}

function parseEligibleCountries(raw) {
  if (!raw) return [];
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      value = [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((country) => {
      const countryCode = typeof country === 'string' ? country : country?.country_code;
      return {
        country_code: normalizeCountryCode(countryCode),
        country_name: typeof country === 'string'
          ? country
          : country?.country_name || country?.country || country?.country_code,
      };
    })
    .filter((country) => country.country_code);
}

function normalizeCountryList(countries = []) {
  return countries
    .map((country) => ({
      country_code: normalizeCountryCode(typeof country === 'string' ? country : country.country_code),
      country_name: typeof country === 'string'
        ? country
        : country.country_name || country.country || country.country_code,
    }))
    .filter((country) => country.country_code);
}

router.get('/', async (req, res) => {
  try {
    const rows = await model.listTournaments(req.query.limit || 100);
    res.json(rows);
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (!req.body?.name) return res.status(400).json({ error: 'name is required', code: 'missing_name' });
    if (!req.body?.tournament_type) return res.status(400).json({ error: 'tournament_type is required', code: 'missing_tournament_type' });
    const rows = await model.createTournament(req.body, admin, {
      admin,
      action: 'create_international_tournament',
      entityType: 'international_tournament',
    });
    res.status(201).json(rows[0]);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id/elections', async (req, res) => {
  try {
    const elections = await model.listElections(req.params.id);
    res.json(elections);
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/open-voting', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const tournament = (await model.getTournament(req.params.id))[0];
    if (!tournament) return res.status(404).json({ error: 'Tournament not found', code: 'not_found' });
    const explicitCountries = parseEligibleCountries(tournament.eligible_countries);
    const requestedCountries = explicitCountries.length
      ? normalizeCountryList(explicitCountries)
      : normalizeCountryList(await model.listCountriesFromPlayers(tournament.max_squad_size || 26));
    if (!requestedCountries.length) {
      return res.status(400).json({ error: 'No eligible countries found', code: 'no_eligible_countries' });
    }
    const elections = await model.openVoting(tournament, requestedCountries, {
      admin,
      action: 'open_international_voting',
      entityType: 'international_tournament',
      entityId: tournament.id,
      newValue: { countries: requestedCountries.map((e) => e.country_code) },
    });
    res.json({ tournament_id: tournament.id, elections });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/elections/:electionId/vote', async (req, res) => {
  try {
    const election = (await model.getElection(req.params.electionId))[0];
    if (!election) return res.status(404).json({ error: 'Election not found', code: 'not_found' });
    const voter = (await model.getPlayerForUser(req.user))[0];
    const candidate = (await model.getPlayer(req.body?.candidate_player_id))[0];
    const validation = canVoteForCandidate({ voter, candidate, election });
    if (!validation.ok) return res.status(400).json({ error: validation.reason, code: validation.reason });
    const existing = await model.findVote(election.id, voter.id);
    if (existing.length) return res.status(409).json({ error: 'duplicate_vote', code: 'duplicate_vote' });
    const vote = (await model.createVote({ election, voter, candidate }))[0];
    res.status(201).json(vote);
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/close-voting', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const tournament = (await model.getTournament(req.params.id))[0];
    if (!tournament) return res.status(404).json({ error: 'Tournament not found', code: 'not_found' });
    const elections = await model.listElections(req.params.id);
    const winnerByElectionId = new Map();
    for (const election of elections) {
      const totals = await model.voteTotals(election.id);
      winnerByElectionId.set(election.id, chooseElectionWinner(totals));
    }
    await model.closeElections(req.params.id, elections, winnerByElectionId, {
      admin,
      action: 'close_international_voting',
      entityType: 'international_tournament',
      entityId: req.params.id,
      newValue: [...winnerByElectionId.entries()].map(([electionId, winner]) => ({ electionId, winner })),
    });
    const updated = await model.listElections(req.params.id);
    res.json(updated);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id/eligible-players', async (req, res) => {
  try {
    const countryCode = normalizeCountryCode(req.query.country_code);
    if (!countryCode) return res.status(400).json({ error: 'country_code is required', code: 'missing_country_code' });
    const rows = await model.listEligiblePlayers(req.params.id, countryCode);
    res.json(rows);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id/squads/:countryCode', async (req, res) => {
  try {
    const squad = (await model.getSquad(req.params.id, req.params.countryCode))[0] || null;
    const players = squad ? await model.listSquadPlayers(squad.id) : [];
    res.json({ squad, players });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/squads', async (req, res) => {
  try {
    const tournament = (await model.getTournament(req.params.id))[0];
    if (!tournament) return res.status(404).json({ error: 'Tournament not found', code: 'not_found' });
    if (isPastDate(tournament.squad_locks_at) || isPastDate(tournament.starts_at)) {
      return res.status(409).json({ error: 'squad_locked_by_date', code: 'squad_locked_by_date' });
    }

    const countryCode = normalizeCountryCode(req.body?.country_code);
    const playerIds = req.body?.player_ids || [];
    const selection = validateSquadSelection({ playerIds, maxSquadSize: tournament.max_squad_size || 26 });
    if (!selection.ok) return res.status(400).json({ error: selection.reason, code: selection.reason });

    const submitter = (await model.getPlayerForUser(req.user))[0];
    const rep = (await model.getRepresentative(req.params.id, countryCode, submitter?.id))[0];
    if (!rep) return res.status(403).json({ error: 'representative_required', code: 'representative_required' });

    const eligiblePlayers = await model.listEligiblePlayers(req.params.id, countryCode);
    const byId = new Map(eligiblePlayers.map((player) => [player.id, player]));
    const selectedPlayers = selection.playerIds.map((id) => byId.get(id));
    if (selectedPlayers.some((player) => !player)) {
      return res.status(400).json({ error: 'player_not_eligible', code: 'player_not_eligible' });
    }

    const squad = (await model.saveSquad({
      tournamentId: req.params.id,
      countryCode,
      representativeId: rep.id,
      submitterPlayerId: submitter.id,
      players: selectedPlayers,
    }))[0];
    const players = await model.listSquadPlayers(squad.id);
    res.status(201).json({ squad, players });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/squads/:squadId/lock', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const squadRows = await EXECUTESQL(
      'SELECT * FROM national_team_squads WHERE id = ? AND tournament_id = ? LIMIT 1',
      [req.params.squadId, req.params.id]
    );
    if (!squadRows.length) return res.status(404).json({ error: 'Squad not found', code: 'not_found' });
    await model.lockSquad(req.params.squadId, {
      admin,
      action: 'lock_national_squad',
      entityType: 'national_team_squad',
      entityId: req.params.squadId,
      newValue: { tournament_id: req.params.id, status: 'locked' },
    });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
