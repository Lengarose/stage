'use strict';

const crypto = require('crypto');
const {
  rules,
  validateSelection
} = require('../lib/clubTournamentParticipation');
const {
  fail
} = require('../lib/clubBoardPolicy');
const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
function publishedRules(tournament) {
  return tournament.club_rules ? parse(tournament.club_rules) : rules();
}
function revision(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function registrationRevision(t) {
  return revision({
    club_rules: publishedRules(t),
    written_rules: t.custom_rules || null,
    rulebook_url: t.rules_file_url || null,
    rules_template_id: t.rules_template_id || null
  });
}
function normalize(body, existing = null) {
  if ((body.participant_type || existing?.participant_type) === 'player') {
    if (body.club_rules != null) fail('Club lineup rules do not apply to individual tournaments');
    return null;
  }
  const value = rules(body.club_rules ? parse(body.club_rules) : existing?.club_rules ? parse(existing.club_rules) : {});
  if (existing && (revision(value) !== revision(publishedRules(existing)) || ['custom_rules', 'rules_file_url', 'rules_template_id'].some(k => Object.hasOwn(body, k) && body[k] !== existing[k]))) {
    const ids = parse(existing.registered_clubs || '[]'),
      proofs = parse(existing.registration_proofs || '{}');
    if (existing.status !== 'registration' || ids.length || Object.values(proofs.club || {}).some(p => ['pending', 'approved'].includes(p.status))) fail('Published club rules cannot change after applications or play begin', 409);
  }
  return JSON.stringify(value);
}
async function roster(clubId, q) {
  const players = await q("SELECT p.* FROM players p WHERE p.club_id=? AND p.user_id IS NOT NULL AND (p.status IS NULL OR p.status NOT IN ('deleted','banned','suspended')) ORDER BY p.id FOR UPDATE", [clubId]);
  return [...new Map(players.map(p => [p.id, {
    ...p,
    eligible: true
  }])).values()];
}
async function registration(tournament, clubId, input, q) {
  const settings = publishedRules(tournament),
    players = await roster(clubId, q);
  if (tournament.club_rules && input.club_rules_revision !== registrationRevision(tournament)) fail('Review and accept the latest published club lineup rules', 409);
  if (players.length < settings.minimum_human_players) fail(`This tournament requires ${settings.minimum_human_players} eligible human players; your squad has ${players.length}`, 422);
  return {
    rules: settings,
    rules_revision: registrationRevision(tournament),
    eligible_count: players.length
  };
}
async function validateMatch(body, match, q, {
  publish = false
} = {}) {
  if (!match?.home_club_id || ![match.home_club_id, match.away_club_id].includes(body.club_id)) fail('Choose a match belonging to this club', 403);
  const [t] = match.tournament_id ? await q('SELECT * FROM tournaments WHERE id=? FOR UPDATE', [match.tournament_id]) : [];
  const settings = t ? publishedRules(t) : {
    ...rules(),
    minimum_human_players: 2
  };
  const players = await roster(body.club_id, q);
  return validateSelection(body, players, settings, {
    publish
  });
}
module.exports = {
  publishedRules,
  revision,
  registrationRevision,
  normalize,
  roster,
  registration,
  validateMatch
};
async function kickoff(match, write, q) {
  if (!match?.tournament_id || !match.home_club_id) return false;
  const [t] = await q('SELECT * FROM tournaments WHERE id=? FOR UPDATE', [match.tournament_id]);
  if (!t?.club_rules) return false; // Historical tournaments retain captured terms.
  const {
      stableId
    } = require('../models/clubBoardModel'),
    id = stableId(['club_match_selection', match.id]);
  const [old] = await q("SELECT * FROM league_entities WHERE entity_type='club_match_selection' AND id=? FOR UPDATE", [id]);
  if (old) return true;
  if (!['scheduled', 'confirmed'].includes(match.status)) fail('Confirm the match schedule before kickoff');
  if (match.scheduled_date && Date.parse(match.scheduled_date) > Date.now()) fail('The scheduled kickoff has not been reached');
  const selections = {};
  for (const side of ['home', 'away']) {
    const clubId = match[`${side}_club_id`],
      aliases = [match.id, match.source_fixture_id].filter(Boolean);
    const rows = await q(`SELECT * FROM club_fixture_lineups WHERE club_id=? AND fixture_id IN (${aliases.map(() => '?').join(',')}) FOR UPDATE`, [clubId, ...aliases]);
    if (rows.length !== 1 || rows[0].status !== 'published') fail('Both clubs must confirm a Match Squad before kickoff');
    selections[side] = {
      club_id: clubId,
      ...(await validateMatch(rows[0], match, q, {
        publish: true
      })),
      goalkeeper_player_id: rows[0].goalkeeper_player_id,
      uses_any: Number(rows[0].uses_any)
    };
  }
  const record = {
    id,
    match_id: match.id,
    tournament_id: t.id,
    rules: publishedRules(t),
    rules_revision: revision(publishedRules(t)),
    selections,
    started_at: new Date().toISOString()
  };
  await q("INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,'club_match_selection',?)", [id, JSON.stringify(record)]);
  await write(q, match);
  return true;
}
async function assertParticipants(match, side, args, q) {
  if (!match.tournament_id || !match.home_club_id) return;
  const [t] = await q('SELECT * FROM tournaments WHERE id=?', [match.tournament_id]);
  if (!t?.club_rules) return;
  const {
    stableId
  } = require('../models/clubBoardModel');
  const [row] = await q("SELECT * FROM league_entities WHERE entity_type='club_match_selection' AND id=?", [stableId(['club_match_selection', match.id])]);
  if (!row) fail('The frozen Match Squad is missing', 409);
  const snap = parse(row.data_json),
    selection = snap.selections?.[side],
    ids = args.participating_player_ids;
  if (!selection || selection.club_id !== match[`${side}_club_id`] || !Array.isArray(ids) || new Set(ids).size !== ids.length || ids.length < snap.rules.minimum_human_players || ids.some(id => !selection.ids.includes(id))) fail('Declare actual participants from the frozen Match Squad', 422);
  if ((args.player_stats || []).some(s => !ids.includes(s.player_id))) fail('Player statistics must belong to actual participants', 422);
  if (snap.rules.goalkeeper_required && !ids.includes(selection.goalkeeper_player_id)) fail('The actual participants must include the required human goalkeeper', 422);
  require('../lib/clubTournamentParticipation').validateContributions(args, ids, Number(args[`${side}_score`]));
}
module.exports.kickoff = kickoff;
module.exports.assertParticipants = assertParticipants;
