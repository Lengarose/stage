'use strict';
const { withTransaction } = require('../db/database');
const { v4: uuid } = require('uuid');
const { unpack } = require('../models/competitionScopeModel');
const types = { competition: 'competition_fixture', regional_league: 'regional_league_fixture' };
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };

// A decision and its original evidence commit together. Progression remains the
// central engine's idempotent follow-up; this service never awards player stats.
async function declare({ fixture_id, fixture_type, forfeiting_club_id, evidence_url, admin_note }, actor) {
  const entityType = types[fixture_type];
  if (!entityType) fail('Unknown fixture type.', 400);
  if (!String(evidence_url || '').trim() || !String(admin_note || '').trim()) fail('Provide the reviewed evidence link and the reason for this decision.', 422);
  if (!/^(\/uploads\/|https?:\/\/)/i.test(evidence_url)) fail('Provide an uploaded evidence link or an HTTP(S) evidence URL.', 422);
  return withTransaction(async q => {
    const [raw] = await q('SELECT * FROM league_entities WHERE id=? AND entity_type=? FOR UPDATE', [fixture_id, entityType]);
    if (!raw) fail('Fixture not found.', 404);
    const fixture = unpack(raw);
    if (![fixture.home_club_id, fixture.away_club_id].filter(Boolean).includes(forfeiting_club_id)) fail('The forfeiting club must participate in this fixture.', 422);
    if (!fixture.home_club_id || !fixture.away_club_id || fixture.home_club_id === fixture.away_club_id) fail('Fixture participants require review.');
    const homeForfeit = fixture.home_club_id === forfeiting_club_id;
    const winner = homeForfeit ? 'away' : 'home';
    const [mapped] = await q('SELECT * FROM competition_fixtures WHERE legacy_fixture_id=? FOR UPDATE', [fixture_id]);
    const matches = await q('SELECT * FROM matches WHERE id=? OR source_fixture_id=? OR id=? FOR UPDATE', [fixture.match_id || '', fixture_id, mapped?.match_id || '']);
    if (matches.length > 1) fail('Multiple canonical matches require Admin review.');
    const canonical = matches[0];
    if (fixture.status === 'forfeit' && fixture.forfeit_decision?.forfeiting_club_id === forfeiting_club_id) return { fixture, match: canonical, already_applied: true };
    if (['played','completed','forfeit','cancelled','archived','reset','voided'].includes(fixture.status) || Number(fixture.stats_processed) || canonical && (['completed','forfeit','cancelled'].includes(canonical.status) || Number(canonical.stats_processed) || Number(canonical.report_finalized))) fail('This fixture already has a final result. Use the result correction review.');
    if (mapped) await require('./regionalCycleService').assertWritableFixture(mapped, q);
    await require('./leagueLifecycleService').assertEditionWritable(q, fixture_type === 'regional_league' ? 'regional_league' : 'competition_season', fixture.league_id || fixture.season_id);
    const decision = { forfeiting_club_id, evidence_url, reason: admin_note, admin_user_id: actor.userId, decided_at: new Date().toISOString() };
    const result = { home_score: homeForfeit ? 0 : 3, away_score: homeForfeit ? 3 : 0, status: 'forfeit', result_state: 'CONFIRMED', administrative_result: 1, decided_on_penalties: 0, penalty_winner_side: null, winner_club_id: fixture[`${winner}_club_id`], winner_club_name: fixture[`${winner}_club_name`] || null };
    const next = { ...fixture, ...result, scheduling_status: 'confirmed', forfeit_decision: decision };
    await q('UPDATE league_entities SET data_json=?,status=?,scheduling_status=?,updated_date=NOW() WHERE id=? AND entity_type=?', [JSON.stringify(next), next.status, next.scheduling_status, fixture_id, entityType]);
    if (canonical) await q("UPDATE matches SET home_score=?,away_score=?,status='forfeit',result_state='CONFIRMED',administrative_result=1,decided_on_penalties=0,penalty_winner_side=NULL,winner_club_id=?,winner_club_name=?,updated_date=NOW() WHERE id=?", [result.home_score,result.away_score,result.winner_club_id,result.winner_club_name,canonical.id]);
    const audit = { id: uuid(), fixture_id, fixture_type, action_type: 'declare_forfeit', performed_by: actor.userId, payload: { before: fixture, canonical_before: canonical || null, after: next }, admin_note };
    await q('INSERT INTO fixture_admin_actions (id,fixture_id,fixture_type,action_type,performed_by,performed_by_name,home_club_id,away_club_id,payload,admin_note) VALUES (?,?,?,?,?,?,?,?,?,?)', [audit.id,fixture_id,fixture_type,audit.action_type,actor.userId,actor.fullName,fixture.home_club_id,fixture.away_club_id,JSON.stringify(audit.payload),admin_note]);
    return { fixture: next, match: canonical ? { ...canonical, ...result } : { ...result, id: fixture_id, source_fixture_type: fixture_type, source_fixture_id: fixture_id }, audit };
  });
}
module.exports = { declare };
