'use strict';
const crypto = require('crypto');
const { isConfirmedResult } = require('./tournamentStatistics');
const parse = (v, fallback = []) => { try { return typeof v === 'string' ? JSON.parse(v) : v || fallback; } catch { return fallback; } };
const thirds = new Set(['third_place', 'third-place', 'bronze']);
const twoLegTypes = new Set(['ucl_playoff', 'ucl_r16', 'ucl_qf', 'ucl_sf', 'round_of_16', 'quarter_final', 'semi_final']);
const id = (m, side, player) => m[`${side}_${player ? 'player' : 'club'}_id`];
function team(m, side, player) { return id(m, side, player) ? { id: id(m, side, player), name: m[`${side}_${player ? 'player' : 'club'}_name`], email: m[`${side}_player_email`], owner_email: m[`${side}_owner_email`] } : null; }
function eligibleThird(t) { return ['knockout', 'group_stage'].includes(t.type) && t.knockout_enabled !== false && Number(t.knockout_enabled ?? 1) !== 0; }
function hasActivity(m) {
  return Boolean(m.scheduled_date || m.confirmed_date || m.home_proposed_date || m.away_proposed_date || m.home_submission || m.away_submission || m.home_dispute_submission || m.away_dispute_submission || m.proof_url || m.video_url || m.stream_url || m.home_stream_url || m.away_stream_url || m.forfeit_claimed_by || Number(m.proposal_count) > 0 || Number(m.result_home_submitted) === 1 || Number(m.result_away_submitted) === 1 || Number(m.stats_processed) === 1 || Number(m.report_finalized) === 1 || Number(m.has_dependent_activity) === 1 || Number(m.wager_stc) > 0 || ['completed', 'forfeit', 'in_progress', 'awaiting_confirmation', 'disputed'].includes(m.status));
}
function resolvedTie(rows, t, requiredLegs = 1) {
  const player = t.participant_type === 'player';
  const sorted = [...rows].sort((a, b) => Number(a.round) - Number(b.round));
  if (rows.length === 1 && rows[0].status === 'bye') return { winner: team(rows[0], 'home', player), loser: null };
  if (sorted.length < requiredLegs || sorted.some(m => !isConfirmedResult(m))) return null;
  const first = sorted[0];
  const a = team(first, 'home', player), b = team(first, 'away', player);
  if (!a || !b) return null;
  let ah = 0, bh = 0;
  for (const m of sorted.slice(0, requiredLegs)) {
    if (m.home_score == null || m.away_score == null) return null;
    const sameHome = String(id(m, 'home', player)) === String(a.id);
    ah += Number(sameHome ? m.home_score : m.away_score);
    bh += Number(sameHome ? m.away_score : m.home_score);
  }
  let winnerId = ah > bh ? a.id : bh > ah ? b.id : null;
  const last = sorted[sorted.length - 1];
  if (!winnerId && sorted.length > requiredLegs) winnerId = last[player ? 'winner_player_id' : 'winner_club_id'];
  if (!winnerId && Number(last.decided_on_penalties) === 1 && ['home', 'away'].includes(last.penalty_winner_side)) winnerId = id(last, last.penalty_winner_side, player);
  if (!winnerId && requiredLegs === 1) winnerId = first[player ? 'winner_player_id' : 'winner_club_id'];
  if (![String(a.id), String(b.id)].includes(String(winnerId))) return null;
  return String(winnerId) === String(a.id) ? { winner: a, loser: b } : { winner: b, loser: a };
}
function standings(rows, player) {
  const map = new Map();
  for (const m of rows) for (const side of ['home', 'away']) {
    const p = team(m, side, player); if (!p) continue;
    if (!map.has(String(p.id))) map.set(String(p.id), { ...p, points: 0, gf: 0, ga: 0 });
    const row = map.get(String(p.id)); const own = Number(m[`${side}_score`]), opp = Number(m[`${side === 'home' ? 'away' : 'home'}_score`]);
    row.gf += own; row.ga += opp; row.points += own > opp ? 3 : own === opp ? 1 : 0;
  }
  return [...map.values()].sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || String(a.id).localeCompare(String(b.id)));
}
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
const knockoutType = n => n === 1 ? 'final' : n === 2 ? 'semi_final' : n === 4 ? 'quarter_final' : n === 8 ? 'round_of_16' : 'knockout';
function planTournamentProgression(t, matches, shuffle = shuffled) {
  const player = t.participant_type === 'player';
  const plan = { fixtures: [], remove: [], conflicts: [], completed: false };
  if (!['in_progress', 'completed'].includes(t.status)) return plan;
  const badThird = !eligibleThird(t) ? matches.filter(m => thirds.has(m.type)) : [];
  for (const row of badThird) {
    if (hasActivity(row)) plan.conflicts.push(`Third-Place Playoff ${row.id} has activity and requires admin resolution.`);
    else plan.remove.push(row.id);
  }
  if (plan.conflicts.length) return plan;
  const rows = matches.filter(m => !plan.remove.includes(m.id));
  const historicalFinal = rows.find(m => m.type === 'final' && isConfirmedResult(m));
  const third = rows.find(m => thirds.has(m.type));
  const semifinalStage = rows.some(m => m.type === 'semi_final') || rows.filter(m => m.type === 'knockout' && historicalFinal && Number(m.round) === Number(historicalFinal.round) - 1 && id(m, 'home', player) && id(m, 'away', player)).length === 2;
  if (eligibleThird(t) && historicalFinal && semifinalStage && (!third || !resolvedTie([third], t))) {
    plan.conflicts.push('The Final already has a confirmed result while its Third-Place Playoff is unresolved. Admin review is required; historical results were preserved.');
    return plan;
  }
  if (t.status === 'completed') return plan;
  if (['knockout', 'double_elimination'].includes(t.type) && rows.length && !rows.some(m => Number(m.round) > 1)) {
    const registered = parse(t[player ? 'registered_players' : 'registered_clubs']);
    const represented = new Set(rows.flatMap(m => [id(m, 'home', player), id(m, 'away', player)]).filter(Boolean).map(String));
    const missing = registered.filter(p => !represented.has(String(p)));
    // The opening draw historically omitted an unpaired registered participant.
    if (missing.length === 1 && registered.length % 2 === 1) {
      plan.fixtures.push({ home: { id: missing[0] }, away: null, round: 1, type: 'knockout', group_number: rows.length, progression_key: `opening-bye:${missing[0]}`, qualification_sources: [], allow_penalties: 0, bye: true });
      return plan;
    }
  }
  const add = (home, away, round, type, slot, sources = [], legs = 1) => {
    if (!home && !away) return;
    for (let leg = 1; leg <= legs; leg++) {
      const h = leg === 2 ? away : home, a = leg === 2 ? home : away;
      plan.fixtures.push({ home: h, away: a, round: round + leg - 1, type, group_number: slot, progression_key: `${type}:${round}:${slot}:${leg}`, qualification_sources: sources, allow_penalties: legs === 1 ? 1 : 0 });
    }
  };
  const complete = list => list.length > 0 && list.every(isConfirmedResult);
  const addDeciders = (ties, type) => {
    for (let i = 0; i < ties.length; i++) {
      const tie = ties[i];
      if (tie.length === 2 && complete(tie) && !resolvedTie(tie, t, 2)) add(team(tie[0], 'home', player), team(tie[0], 'away', player), Math.max(...tie.map(m => Number(m.round))) + 1, type, tie[0].group_number ?? i, tie.map(m => m.id));
    }
  };
  const phase = type => rows.filter(m => m.type === type);
  if (t.type === 'league') {
    const league = phase('league');
    if (complete(league)) { plan.completed = true; plan.winner = standings(league, player)[0]; }
    return plan;
  }
  if (t.type === 'group_stage' && !rows.some(m => !['group', 'group_stage'].includes(m.type))) {
    const groups = rows.filter(m => ['group', 'group_stage'].includes(m.type));
    if (!complete(groups)) return plan;
    const tables = Array.from({ length: Number(t.num_groups || 2) }, (_, g) => standings(groups.filter(m => Number(m.group_number ?? m.group ?? 0) === g), player));
    const pairs = [];
    if (tables.length === 1 && tables[0].length >= 2) pairs.push([tables[0][0], tables[0][1]]);
    for (let g = 0; g < tables.length; g += 2) {
      if (tables[g]?.[0] && tables[g + 1]?.[1]) pairs.push([tables[g][0], tables[g + 1][1]]);
      if (tables[g + 1]?.[0] && tables[g]?.[1]) pairs.push([tables[g + 1][0], tables[g][1]]);
    }
    if (Number(t.knockout_enabled ?? 1) === 0) return plan;
    const round = Math.max(...groups.map(m => Number(m.round))) + 1;
    pairs.forEach(([a, b], slot) => add(a, b, round, knockoutType(pairs.length), slot, groups.map(m => m.id), pairs.length === 1 ? 1 : Number(t.knockout_legs || 2)));
    return plan;
  }
  if (t.type === 'swiss_ucl') {
    const league = phase('ucl_league');
    if (!complete(league) || new Set(league.map(m => Number(m.round))).size < Number(t.league_phase_rounds || 8)) return plan;
    const table = standings(league, player);
    if (!phase('ucl_playoff').length) {
      if (table.length < 24) return plan;
      for (let i = 0; i < 8; i++) add(table[23 - i], table[8 + i], 9, 'ucl_playoff', i, league.map(m => m.id), 2);
      return plan;
    }
    for (const [from, to, round] of [['ucl_playoff', 'ucl_r16', 11], ['ucl_r16', 'ucl_qf', 13], ['ucl_qf', 'ucl_sf', 15], ['ucl_sf', 'final', 17]]) {
      if (phase(to).length && !player) continue;
      const prior = phase(from);
      const ties = [...new Set(prior.map(m => m.group_number ?? m.group ?? [m.home_club_id || m.home_player_id, m.away_club_id || m.away_player_id].sort().join(':')))].map(key => prior.filter(m => (m.group_number ?? m.group ?? [m.home_club_id || m.home_player_id, m.away_club_id || m.away_player_id].sort().join(':')) === key));
      const results = ties.map(tie => resolvedTie(tie, t, 2));
      const requiredTies = from === 'ucl_qf' ? 4 : from === 'ucl_sf' ? 2 : 8;
      if (ties.length !== requiredTies) return plan;
      if (results.some(r => !r)) {
        addDeciders(ties, from);
        if (plan.fixtures.length || !player || !results.some(Boolean)) return plan;
      }
      const before = plan.fixtures.length;
      const addUcl = (a, b, slot, sources, legs) => {
        const existing = phase(to).filter(m => Number(m.group_number) === slot);
        if (existing.length === legs && existing.every((m, i) => String(id(m, 'home', player) || '') === String((i === 1 ? b : a)?.id || '') && String(id(m, 'away', player) || '') === String((i === 1 ? a : b)?.id || ''))) return;
        add(a, b, round, to, slot, sources, legs);
      };
      if (from === 'ucl_playoff') {
        if (results.length !== 8) return plan;
        results.forEach((r, i) => { if (r) addUcl(r.winner, table[7 - i], i, ties[i].map(m => m.id), 2); });
      } else {
        const winners = player ? results.map(r => r?.winner || null) : shuffle(results.map(r => r.winner));
        for (let i = 0; i < winners.length; i += 2) addUcl(winners[i], winners[i + 1], i / 2, player ? [...ties[i], ...ties[i + 1]].map(m => m.id) : prior.map(m => m.id), to === 'final' ? 1 : 2);
      }
      if (plan.fixtures.length > before) return plan;
    }
    const finalResult = resolvedTie(phase('final'), t);
    if (finalResult) { plan.completed = true; plan.winner = finalResult.winner; }
    return plan;
  }
  const knockoutRows = rows.filter(m => !['group', 'group_stage', 'league', 'ucl_league'].includes(m.type) && !thirds.has(m.type));
  const phases = new Map();
  for (const m of knockoutRows.sort((a, b) => Number(a.round) - Number(b.round) || String(a.id).localeCompare(String(b.id)))) {
    const key = twoLegTypes.has(m.type) || m.type === 'final' ? m.type : `round:${m.round}`;
    if (!phases.has(key)) phases.set(key, []); phases.get(key).push(m);
  }
  for (const stage of phases.values()) {
    const type = stage[0].type;
    const rounds = new Set(stage.map(m => Number(m.round)));
    const legs = twoLegTypes.has(type) ? Math.max(rounds.size > 1 ? 2 : 1, Number(t.knockout_legs || (t.type === 'group_stage' || t.type === 'swiss_ucl' ? 2 : 1))) : 1;
    const ties = new Map();
    for (const m of stage) {
      const key = legs > 1 ? (m.group_number ?? m.group ?? [id(m, 'home', player), id(m, 'away', player)].sort().join(':')) : m.id;
      if (!ties.has(key)) ties.set(key, []); ties.get(key).push(m);
    }
    const tieRows = [...ties.values()].sort((a, b) => Number(a[0].group_number ?? 0) - Number(b[0].group_number ?? 0) || String(a[0].id).localeCompare(String(b[0].id)));
    const results = tieRows.map(tie => resolvedTie(tie, t, legs));
    if (legs === 2 && results.some(r => !r)) { addDeciders(tieRows, type); if (plan.fixtures.length) return plan; }
    if (type === 'final') {
      const third = rows.filter(m => thirds.has(m.type));
      if (results[0] && (!third.length || (complete(third) && resolvedTie(third, t)))) { plan.completed = true; plan.winner = results[0].winner; }
      continue;
    }
    const nextRound = Math.max(...stage.map(m => Number(m.round))) + 1;
    const existingNext = knockoutRows.filter(m => Number(m.round) >= nextRound && !stage.includes(m));
    if (tieRows.length === 2 && results.every(r => r?.loser) && eligibleThird(t) && existingNext.some(m => m.type === 'final') && !rows.some(m => thirds.has(m.type))) {
      add(results[0].loser, results[1].loser, Number(existingNext.find(m => m.type === 'final').round), 'third_place', 0, stage.map(m => m.id));
      if (plan.fixtures.length) return plan;
    }
    if (existingNext.length && !player) {
      if (results.some(r => !r)) {
        const premature = rows.filter(m => Number(m.round) >= nextRound && !stage.includes(m));
        if (premature.some(hasActivity)) plan.conflicts.push('A downstream round has activity before the previous round is confirmed. Admin review is required.');
        else plan.remove.push(...premature.map(m => m.id));
        return plan;
      }
      continue;
    }
    if (!player && results.some(r => !r)) {
      for (let i = 0; i < tieRows.length; i++) if (!results[i] && tieRows[i].length === legs && complete(tieRows[i]) && legs === 2) {
        add(team(tieRows[i][0], 'home', player), team(tieRows[i][0], 'away', player), nextRound, type, tieRows[i][0].group_number ?? i, tieRows[i].map(m => m.id), 1);
      }
      return plan;
    }
    if (!results.some(Boolean)) continue;
    if (tieRows.length === 1) {
      const entrants = parse(t[player ? 'registered_players' : 'registered_clubs']).length || Number(t.max_teams || 0);
      if (results[0] && entrants === 2) { plan.completed = true; plan.winner = results[0].winner; }
      continue;
    }
    const isSemi = tieRows.length === 2;
    const nextType = isSemi ? 'final' : (twoLegTypes.has(type) ? knockoutType(Math.ceil(tieRows.length / 2)) : 'knockout');
    const qualified = player ? results : shuffle(results);
    for (let i = 0; i < qualified.length; i += 2) {
      const existing = existingNext.find(m => Number(m.group_number || 0) === i / 2 && m.type === nextType);
      if (existing && !existing.progression_key) continue;
      const a = qualified[i]?.winner || null, b = qualified[i + 1]?.winner || null;
      if (existing && String(id(existing, 'home', player) || '') === String(a?.id || '') && String(id(existing, 'away', player) || '') === String(b?.id || '')) continue;
      const sources = player ? [...(tieRows[i] || []), ...(tieRows[i + 1] || [])].map(m => m.id) : stage.map(m => m.id);
      add(a, b, nextRound, nextType, i / 2, sources, nextType === 'final' || (a && !b && i + 1 >= qualified.length) ? 1 : legs);
      if (a && !b && i + 1 >= qualified.length) {
        const bye = plan.fixtures.at(-1);
        if (bye) bye.bye = true;
      }
    }
    if (isSemi && results.every(r => r?.loser) && eligibleThird(t) && !rows.some(m => thirds.has(m.type))) add(results[0].loser, results[1].loser, nextRound, 'third_place', 0, stage.map(m => m.id));
    if (plan.fixtures.length) return plan;
  }
  return plan;
}
module.exports = { planTournamentProgression, resolvedTie, eligibleThird, hasActivity, standings, parse };
