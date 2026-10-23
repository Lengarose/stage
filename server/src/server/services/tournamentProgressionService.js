'use strict';
const crypto = require('crypto');
const { EXECUTESQL, withTransaction } = require('../db/database');
const { planTournamentProgression, eligibleThird, hasActivity, resolvedTie, parse } = require('../lib/tournamentProgression');
const { isConfirmedResult } = require('../lib/tournamentStatistics');
const { broadcastMatch, broadcastTournament } = require('../utils/socketBroadcast');

function conflict(message) { const err = new Error(message); err.status = 409; err.code = 'TOURNAMENT_PROGRESSION_CONFLICT'; return err; }
function downstreamMatches(rows, source) {
  const selected = new Set(rows.filter(m => Number(m.round) > Number(source.round) || (['third_place', 'third-place', 'bronze'].includes(source.type) && m.type === 'final')).map(m => m.id));
  const sources = new Set([source.id, ...selected]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) if (row.id !== source.id && !selected.has(row.id) && parse(row.qualification_sources).some(key => sources.has(key))) {
      selected.add(row.id); sources.add(row.id); changed = true;
    }
  }
  return rows.filter(row => selected.has(row.id));
}
function fixturePayload(t, spec) {
  const player = t.participant_type === 'player';
  const row = { tournament_id: t.id, progression_key: spec.progression_key, qualification_sources: JSON.stringify(spec.qualification_sources), round: spec.round, type: spec.type, group_number: spec.group_number, mode: player ? 'player' : 'club', status: spec.home && spec.away ? 'unscheduled' : 'awaiting_qualification', scheduling_status: 'open', allow_penalties: spec.allow_penalties, home_score: 0, away_score: 0, stats_processed: 0 };
  for (const side of ['home', 'away']) {
    const participant = spec[side];
    row[`${side}_${player ? 'player' : 'club'}_id`] = participant?.id || null;
    row[`${side}_${player ? 'player' : 'club'}_name`] = participant?.name || null;
    row[`${side}_${player ? 'player_email' : 'owner_email'}`] = participant?.email || participant?.owner_email || null;
  }
  const hex = crypto.createHash('sha256').update(`${t.id}:${spec.progression_key}`).digest('hex').slice(0, 32);
  row.id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if (spec.bye) { row.status = 'bye'; row[`winner_${player ? 'player' : 'club'}_id`] = spec.home.id; }
  return row;
}
async function lockedMatches(query, tournamentId) {
  return query(`SELECT m.*, (EXISTS(SELECT 1 FROM match_player_stats s WHERE s.match_id=m.id)
    OR EXISTS(SELECT 1 FROM live_matches l WHERE l.match_id=m.id)
    OR EXISTS(SELECT 1 FROM dressing_rooms d WHERE d.match_id=m.id)
    OR EXISTS(SELECT 1 FROM competition_fixtures f WHERE f.match_id=m.id AND
      (f.scheduled_at IS NOT NULL OR f.confirmed_at IS NOT NULL OR f.stats_processed=1
       OR f.status IN ('completed','forfeit','in_progress','disputed')
       OR EXISTS(SELECT 1 FROM competition_schedule_proposals p WHERE p.fixture_id=f.id)
       OR EXISTS(SELECT 1 FROM competition_result_submissions r WHERE r.fixture_id=f.id)))) AS has_dependent_activity
    FROM matches m WHERE m.tournament_id=? ORDER BY m.round, m.group_number, m.created_date, m.id FOR UPDATE`, [tournamentId]);
}
async function reconcileTournament(tournamentId, { dryRun = false } = {}) {
  const changed = [];
  const result = await withTransaction(async query => {
    const [t] = await query('SELECT * FROM tournaments WHERE id = ? LIMIT 1 FOR UPDATE', [tournamentId]);
    if (!t) throw new Error('Tournament not found');
    let rows = await lockedMatches(query, tournamentId);
    const report = { advanced: false, matches_created: 0, matches_updated: 0, removed: [], conflicts: [], completed: false, tournament: t };
    for (let step = 0; step < 32; step++) {
      const plan = planTournamentProgression(t, rows);
      report.conflicts.push(...plan.conflicts);
      if (plan.conflicts.length || dryRun) { report.plan = plan; return report; }
      for (const matchId of plan.remove) {
        await query("DELETE FROM competition_fixtures WHERE match_id=? AND legacy_fixture_type='tournament_match'", [matchId]);
        await query('DELETE FROM matches WHERE id = ? AND tournament_id = ?', [matchId, tournamentId]);
        report.removed.push(matchId);
        report.advanced = true;
        rows = rows.filter(m => m.id !== matchId);
      }
      let progress = plan.remove.length > 0;
      for (const spec of plan.fixtures) {
        for (const side of ['home', 'away']) if (spec[side]?.id && !spec[side].name) {
          const player = t.participant_type === 'player';
          const [profile] = await query(`SELECT * FROM ${player ? 'players' : 'clubs'} WHERE id=? LIMIT 1`, [spec[side].id]);
          if (profile) spec[side] = { ...spec[side], name: profile.gamertag || profile.name, email: profile.email, owner_email: profile.owner_email };
        }
        const payload = fixturePayload(t, spec);
        const existing = rows.find(m => m.progression_key === spec.progression_key);
        if (existing) {
          const keys = t.participant_type === 'player' ? ['home_player_id', 'away_player_id'] : ['home_club_id', 'away_club_id'];
          if (keys.every(k => String(existing[k] || '') === String(payload[k] || ''))) continue;
          if (hasActivity(existing)) throw conflict(`Fixture ${existing.id} already has downstream activity. Resolve it in admin before changing qualification.`);
          await query("DELETE FROM competition_fixtures WHERE match_id=? AND legacy_fixture_type='tournament_match'", [existing.id]);
          const fields = Object.keys(payload).filter(k => !['id', 'tournament_id', 'home_score', 'away_score', 'stats_processed'].includes(k));
          await query(`UPDATE matches SET ${fields.map(k => `\`${k}\`=?`).join(', ')}, updated_date=NOW() WHERE id=?`, [...fields.map(k => payload[k]), existing.id]);
          Object.assign(existing, payload, { id: existing.id });
          report.matches_updated++; changed.push(existing); progress = true;
        } else {
          const fields = Object.keys(payload);
          await query(`INSERT INTO matches (${fields.map(k => `\`${k}\``).join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, fields.map(k => payload[k]));
          rows.push(payload); changed.push(payload); report.matches_created++; progress = true;
        }
      }
      if (plan.completed && plan.winner) {
        const player = t.participant_type === 'player';
        await query(`UPDATE tournaments SET status='completed', winner_${player ? 'player' : 'club'}_id=?, winner_${player ? 'player' : 'club'}_name=?, end_date=COALESCE(end_date,NOW()), updated_date=NOW() WHERE id=?`, [plan.winner.id, plan.winner.name, t.id]);
        report.completed = true; report.winner = plan.winner; report.final_round = Math.max(1, ...rows.map(m => Number(m.round || 1)));
        t.status = 'completed'; t[player ? 'winner_player_id' : 'winner_club_id'] = plan.winner.id; t[player ? 'winner_player_name' : 'winner_club_name'] = plan.winner.name; progress = true;
      }
      report.advanced = report.advanced || progress;
      if (!progress || report.completed) break;
    }
    if (report.advanced && !report.completed) {
      const pending = rows.filter(m => m.status !== 'bye' && !isConfirmedResult(m)).sort((a, b) => Number(a.round) - Number(b.round));
      if (pending.length) {
        report.next_round = Number(pending[0].round);
        report.phase = pending[0].type;
        const uclPhase = { ucl_league: 'league', ucl_playoff: 'playoff', ucl_r16: 'r16', ucl_qf: 'qf', ucl_sf: 'sf', final: 'final' }[report.phase];
        await query(`UPDATE tournaments SET current_round=?, updated_date=NOW()${t.type === 'swiss_ucl' ? ', ucl_phase=?' : ''} WHERE id=?`, [report.next_round, ...(t.type === 'swiss_ucl' ? [uclPhase] : []), t.id]);
        t.current_round = report.next_round;
        if (t.type === 'swiss_ucl') t.ucl_phase = uclPhase;
      }
    }
    return report;
  });
  for (const row of changed) broadcastMatch(row);
  if (result.advanced) broadcastTournament(result.tournament);
  return result;
}

async function assertTournamentMatchAction(match, { schedule, result = false, correction = false } = {}, query = EXECUTESQL) {
  if (!match?.tournament_id || match.tournament_id === 'ranked') return;
  const [t] = await query('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [match.tournament_id]);
  if (!t) return;
  const rows = await query('SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, created_date', [t.id]);
  const player = t.participant_type === 'player';
  const participants = [match[`home_${player ? 'player' : 'club'}_id`], match[`away_${player ? 'player' : 'club'}_id`]];
  if ((schedule || result) && participants.some(p => !p)) throw conflict('Both qualifiers must be known before scheduling or reporting this fixture.');
  if (match.type === 'final' && eligibleThird(t)) {
    const third = rows.find(m => ['third_place', 'third-place', 'bronze'].includes(m.type));
    const hasSemis = rows.some(m => m.type === 'semi_final') || rows.filter(m => Number(m.round) === Number(match.round) - 1 && m.type === 'knockout' && m.home_club_id && m.away_club_id).length === 2 || (player && rows.filter(m => Number(m.round) === Number(match.round) - 1 && m.type === 'knockout' && m.home_player_id && m.away_player_id).length === 2);
    if (result && hasSemis && (!third || !resolvedTie([third], t))) throw conflict('Complete the Third-Place Playoff before submitting or completing the Final.');
    if (schedule && hasSemis && (!third?.scheduled_date || new Date(schedule).getTime() <= new Date(third.scheduled_date).getTime())) throw conflict('Schedule the Final after the Third-Place Playoff.');
  }
  if (schedule && ['third_place', 'third-place', 'bronze'].includes(match.type)) {
    const final = rows.find(m => m.type === 'final');
    if (final?.scheduled_date && new Date(schedule).getTime() >= new Date(final.scheduled_date).getTime()) throw conflict('The Third-Place Playoff must be scheduled before the Final.');
  }
  if (correction) {
    const descendants = downstreamMatches(rows, match);
    if (descendants.some(hasActivity)) throw conflict('Downstream fixtures have activity. Resolve downstream scheduling/reports in admin before correcting this result.');
  }
}

async function correctTournamentResult(match, patch, admin) {
  return withTransaction(async query => {
    const [t] = await query('SELECT * FROM tournaments WHERE id=? LIMIT 1 FOR UPDATE', [match.tournament_id]);
    const rows = await lockedMatches(query, t.id);
    const source = rows.find(m => m.id === match.id);
    if (!source) throw conflict('Match no longer exists.');
    const affected = downstreamMatches(rows, source);
    if (affected.some(hasActivity)) throw conflict('Downstream matches have scheduling, reports or results. Resolve those dependencies through admin before correcting this result.');
    if (t.status === 'completed') throw conflict('This tournament has awarded its final placement. An admin must resolve the awarded tournament before changing its result.');
    const status = patch.status || source.status;
    if (!['completed', 'forfeit', 'scheduled', 'unscheduled', 'in_progress', 'disputed', 'cancelled', 'voided'].includes(status)) throw conflict('Unsupported result correction status.');
    if (['completed', 'forfeit'].includes(status)) await assertTournamentMatchAction(source, { result: true }, query);
    const hs = Number(patch.home_score ?? source.home_score), as = Number(patch.away_score ?? source.away_score);
    if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) throw new Error('Scores must be nonnegative whole numbers.');
    const player = t.participant_type === 'player';
    const penaltySide = patch.penalty_winner_side || null;
    const penalties = hs === as && Number(patch.decided_on_penalties) === 1;
    if (penalties && !['home', 'away'].includes(penaltySide)) throw conflict('Choose the winning side for a penalty decision.');
    let winnerSide = hs > as ? 'home' : as > hs ? 'away' : penalties ? penaltySide : null;
    if (!winnerSide && status === 'forfeit') {
      const awarded = patch[`winner_${player ? 'player' : 'club'}_id`] || source.forfeit_claimed_by;
      winnerSide = ['home', 'away'].find(side => awarded && String(source[`${side}_${player ? 'player' : 'club'}_id`]) === String(awarded));
      if (!winnerSide) throw conflict('Select a participating winner for this administrative forfeit.');
    }
    const winner = winnerSide ? source[`${winnerSide}_${player ? 'player' : 'club'}_id`] : null;
    for (const row of affected) {
      await query("DELETE FROM competition_fixtures WHERE match_id=? AND legacy_fixture_type='tournament_match'", [row.id]);
      await query('DELETE FROM matches WHERE id=? AND tournament_id=?', [row.id, t.id]);
    }
    await query('UPDATE match_player_stats SET is_superseded=1, appearance_key=NULL WHERE match_id=?', [source.id]);
    await query(`UPDATE matches SET home_score=?, away_score=?, status=?, result_state=?, winner_${player ? 'player' : 'club'}_id=?, winner_${player ? 'player' : 'club'}_name=?, decided_on_penalties=?, penalty_winner_side=?, administrative_result=1, report_finalized=?, stats_processed=?, home_submission=NULL, away_submission=NULL, home_goal_events=NULL, away_goal_events=NULL, result_home_submitted=0, result_away_submitted=0, updated_date=NOW() WHERE id=?`, [hs, as, status, ['completed', 'forfeit'].includes(status) ? 'CONFIRMED' : null, winner, winnerSide ? source[`${winnerSide}_${player ? 'player' : 'club'}_name`] : null, penalties ? 1 : 0, penalties ? penaltySide : null, ['completed', 'forfeit'].includes(status) ? 1 : 0, ['completed', 'forfeit'].includes(status) ? 1 : 0, source.id]);
    await query(`INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)`, [crypto.randomUUID(), admin.id, admin.email, 'correct_tournament_result', 'match', source.id, JSON.stringify(source), JSON.stringify({ status, home_score: hs, away_score: as, removed_idle_descendants: affected.map(m => m.id) }), patch.reason || 'Admin corrected tournament result; previous player statistics retained as superseded.']);
    const [updated] = await query('SELECT * FROM matches WHERE id=? LIMIT 1', [source.id]);
    await query("UPDATE competition_fixtures SET status=?, home_score=?, away_score=?, winner_participant_id=CASE ? WHEN 'home' THEN home_participant_id WHEN 'away' THEN away_participant_id ELSE NULL END, stats_processed=?, updated_date=NOW() WHERE match_id=? AND legacy_fixture_type='tournament_match'", [status, hs, as, winnerSide, ['completed', 'forfeit'].includes(status) ? 1 : 0, source.id]);
    return updated;
  });
}
async function updateTournamentSchedule(match, patch, admin = null) {
  return withTransaction(async query => {
    await query('SELECT id FROM tournaments WHERE id=? FOR UPDATE', [match.tournament_id]);
    const [fresh] = await query('SELECT * FROM matches WHERE id=? LIMIT 1 FOR UPDATE', [match.id]);
    if (['completed', 'forfeit', 'cancelled', 'canceled'].includes(fresh.status)) throw conflict('This fixture is closed.');
    const date = patch.home_proposed_date || patch.away_proposed_date || patch.scheduled_date || patch.confirmed_date;
    if (patch.confirmed_date && patch.scheduled_date) {
      const current = fresh.scheduling_status === 'away_proposed' ? fresh.away_proposed_date : fresh.home_proposed_date;
      if (patch.scheduling_status === 'confirmed' && (!['home_proposed', 'away_proposed'].includes(fresh.scheduling_status) || new Date(current).getTime() !== new Date(patch.confirmed_date).getTime())) throw conflict('This schedule proposal is no longer current. Refresh the inbox before accepting.');
      patch = { ...patch, status: 'scheduled' };
    }
    await assertTournamentMatchAction(fresh, { schedule: date }, query);
    if (patch.scheduled_date) patch = { ...patch, status: 'scheduled' };
    const fields = ['scheduled_date', 'confirmed_date', 'home_proposed_date', 'away_proposed_date', 'scheduling_status', 'last_proposed_by', 'proposal_count', 'timezone', ...(patch.scheduled_date ? ['status'] : [])].filter(k => patch[k] !== undefined);
    if (fields.length) await query(`UPDATE matches SET ${fields.map(k => `\`${k}\`=?`).join(',')}, updated_date=NOW() WHERE id=?`, [...fields.map(k => patch[k]), fresh.id]);
    const [updated] = await query('SELECT * FROM matches WHERE id=? LIMIT 1', [fresh.id]);
    if (patch.scheduled_date) await query("UPDATE competition_fixtures SET scheduled_at=?, confirmed_at=?, status='scheduled', updated_date=NOW() WHERE match_id=? AND legacy_fixture_type='tournament_match'", [patch.scheduled_date, patch.confirmed_date || null, fresh.id]);
    if (admin) await query(`INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)`, [crypto.randomUUID(), admin.id, admin.email, 'schedule_tournament_fixture', 'match', fresh.id, JSON.stringify(fresh), JSON.stringify(updated), 'Admin scheduled tournament fixture']);
    return updated;
  });
}
module.exports = { reconcileTournament, assertTournamentMatchAction, fixturePayload, lockedMatches, conflict, correctTournamentResult, updateTournamentSchedule, downstreamMatches };
