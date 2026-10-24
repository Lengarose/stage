'use strict';
const { isConfirmedResult } = require('./tournamentStatistics');
const { resolvedTie } = require('./tournamentProgression');
function roundReadiness(scope, phase = 'league') {
  const rows = scope.matches.filter(m => m.type === phase);
  const n = scope.participants.length;
  const regional = scope.source_type === 'regional_league';
  let expected;
  if (phase === 'league') {
    if (regional) expected = n * (n - 1);
    else {
      const days = Number(scope.root.league_matchday_total || scope.root.num_league_matchdays);
      if (!Number.isInteger(days) || days < 1 || n < 2) return { ready:false,reason:'Expected league matchdays are not configured' };
      expected = n * days / 2;
    }
  } else expected = {playoff_round:16,knockout_r16:16,knockout_qf:8,knockout_sf:4,knockout_final:1}[phase];
  const blocked = reason => ({ready:false,reason,message:'Awaiting completion of the previous round before the draw.'});
  if (!expected || rows.length !== expected || new Set(rows.map(m=>m.fixture_id || m.id)).size !== expected) return blocked('Missing or duplicate expected fixtures');
  if (rows.some(m=>!isConfirmedResult(m))) return blocked('Required results remain unconfirmed or unresolved');
  if (phase === 'league') {
    const counts = new Map(scope.participants.map(p=>[p.id,0]));
    const pairs = new Set();
    for (const m of rows) {
      if (!counts.has(m.home_club_id) || !counts.has(m.away_club_id) || m.home_club_id === m.away_club_id) return blocked('Invalid league participants');
      const pair = `${m.home_club_id}:${m.away_club_id}`;
      if (pairs.has(pair)) return blocked('Duplicate league pairing');
      pairs.add(pair);
      counts.set(m.home_club_id,counts.get(m.home_club_id)+1); counts.set(m.away_club_id,counts.get(m.away_club_id)+1);
    }
    const games = regional ? 2*(n-1) : Number(scope.root.league_matchday_total || scope.root.num_league_matchdays);
    if ([...counts.values()].some(count=>count !== games)) return blocked('Required participant fixtures are missing');
  } else {
    const ties = new Map();
    for (const m of rows) { const key = m.tie_id || (m.group_number ?? [m.home_club_id,m.away_club_id].sort().join(':')); if (!ties.has(key)) ties.set(key,[]); ties.get(key).push(m); }
    const legs = phase === 'knockout_final' ? 1 : 2;
    if ([...ties.values()].some(t=>t.length !== legs || !resolvedTie(t,{participant_type:'club'},legs))) return blocked('Required legs or aggregate decisions are missing');
  }
  return {ready:true,expected};
}
module.exports = { roundReadiness };
