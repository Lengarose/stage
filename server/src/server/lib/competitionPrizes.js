'use strict';
const { isConfirmedResult } = require('./tournamentStatistics');
const { resolvedTie, parse } = require('./tournamentProgression');
function cents(value) {
  const text = String(value ?? '0');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('STC amounts must be nonnegative decimals with at most two decimal places');
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
function stc(value) { return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`; }
function configuredPrizes(root, rewards) {
  if (rewards?.length) return rewards.map(r => ({ position: Number(r.position), amount: stc(cents(r.stc_amount)), label: r.position_label, badge: r.badge_type }));
  const fields = ['prize_winner_stc', 'prize_runner_up_stc', root.prize_third_place_stc != null ? 'prize_third_place_stc' : 'prize_semi_final_stc'];
  if (!fields.some(k => root[k] != null)) return null;
  const rows = fields.map((k, i) => ({ position: i + 1, amount: stc(cents(root[k] ?? 0)), label: `${i + 1} place` }));
  if (cents(root.prize_participation_stc ?? 0) > 0n) {
    const entrants = parse(root.participant_type === 'player' ? root.registered_players : root.registered_clubs,[]);
    for (let position=4;position<=entrants.length;position++) rows.push({position,amount:stc(cents(root.prize_participation_stc)),badge:'participant',label:'Participant'});
  }
  if (rows.every(r => cents(r.amount) === 0n) && cents(root.prize_pool_stc ?? 0) > 0n) return null;
  return rows;
}
function placements(scope, config) {
  const { root, matches, participants } = scope;
  const player = root.participant_type === 'player';
  const results = matches.filter(isConfirmedResult);
  const map = new Map();
  const leagueOnly = scope.source_type === 'regional_league' || ['league','swiss'].includes(root.type) || root.format === 'league' || root.league_only === true;
  if (!['completed','archived'].includes(root.status)) return { map, blocked: 'Competition is not officially completed' };
  if (['regional_league','competition_season'].includes(scope.source_type)) {
    for (const phase of new Set(matches.map(m=>m.type))) {
      const readiness = require('./leagueRoundReadiness').roundReadiness(scope,phase);
      if (!readiness.ready) return {map,blocked:readiness.reason};
    }
  }
  if (matches.some(m => m.status !== 'bye' && !isConfirmedResult(m))) return { map, blocked: 'Required fixtures remain unconfirmed, missing a decision, cancelled or voided' };
  if (leagueOnly) {
    const officialLeague = ['regional_league','competition_season'].includes(scope.source_type);
    if (officialLeague && require('./standingIntegrity').reviewStandings(scope).requires_review) return { map, blocked:'Final standings integrity requires authorised historical review before settlement' };
    const registration = root[player ? 'registered_players' : 'registered_clubs'];
    const roster = registration != null ? parse(registration).map(id => participants.find(p => String(p.id) === String(id)) || {id}) : participants;
    const calculated = !officialLeague ? require('./standingsCore').calculateStandings(results, { participant_type: player ? 'player' : 'club', participants: roster, tournament_id: root.id, phase: 'league' }) : null;
    if (calculated?.issues.some(i => i.code !== 'missing_profile')) return { map, blocked: 'Standings integrity errors require authorised review' };
    if (calculated && registration != null && calculated.rows.some(row => row.P !== 2 * (roster.length - 1))) return { map, blocked: 'Required registered participant results are incomplete' };
    const table = officialLeague ? require('./competitionStandings').sortStandingRows(scope.standings) : calculated.rows;
    const tied = (a,b) => officialLeague
      ? Number(a.points) === Number(b.points) && Number(a.goal_difference) === Number(b.goal_difference) && Number(a.goals_for) === Number(b.goals_for)
      : a.rank === b.rank;
    if (table.some((row, i) => i > 0 && tied(table[i - 1], row) && config.some(c => c.position === i || c.position === i + 1))) return { map, blocked: 'Paid finishing positions remain tied under sporting criteria; authorised resolution required' };
    if (officialLeague && new Set(scope.standings.map(s=>s.club_id)).size !== participants.length) return {map,blocked:'Final standings are incomplete'};
    table.forEach((row, i) => map.set(i + 1, officialLeague ? row.club_id : row.id));
    return { map };
  }
  let final = results.filter(m => ['final', 'knockout_final', 'grand_final', 'championship'].includes(m.type));
  if (!final.length && ['knockout','double_elimination'].includes(root.type)) {
    const rounds = results.filter(m=>['knockout','double_elimination'].includes(m.type));
    const last = Math.max(...rounds.map(m=>Number(m.round)));
    final = rounds.filter(m=>Number(m.round) === last);
  }
  if (final.length !== 1) return { map, blocked: 'A unique confirmed final cannot be established' };
  const decided = resolvedTie(final, root);
  if (!decided) return { map, blocked: 'The final has no resolved winner' };
  map.set(1, decided.winner.id); map.set(2, decided.loser.id);
  const third = results.filter(m => ['third_place', 'third-place', 'bronze'].includes(m.type));
  if (third.length === 1) {
    const outcome = resolvedTie(third, root);
    if (outcome) { map.set(3, outcome.winner.id); map.set(4, outcome.loser.id); }
  }
  // Placement bands are valid only when the saved reward configuration explicitly
  // awards the same amount to all clubs in that elimination band.
  for (const [types, start, size, badge] of [[['semi_final','ucl_sf','knockout_sf'],3,2,'semi_finalist'], [['quarter_final','ucl_qf','knockout_qf'],5,4,'top_4']]) {
    const band = config.filter(r => r.position >= start && r.position < start + size);
    const games = results.filter(m => types.includes(m.type));
    const ties = new Map();
    for (const m of games) { const key = m.tie_id || (m.group_number ?? [m.home_club_id, m.away_club_id].sort().join(':')); if (!ties.has(key)) ties.set(key, []); ties.get(key).push(m); }
    const losers = [...ties.values()].map(tie => resolvedTie(tie, root, tie.length > 1 ? 2 : 1)?.loser?.id).filter(Boolean).sort();
    if (!map.has(start) && losers.length === size && band.length === size && band.every(r => r.amount === band[0].amount && r.badge === badge)) losers.forEach((id, i) => map.set(start + i, id));
  }
  const remaining = participants.map(p => p.id).filter(id => ![...map.values()].includes(id)).sort();
  const participation = config.filter(r => r.badge === 'participant' && !map.has(r.position));
  if (remaining.length === participation.length && participation.length && participation.every(r => r.amount === participation[0].amount)) participation.sort((a,b) => a.position-b.position).forEach((r,i) => map.set(r.position, remaining[i]));
  return { map };
}
function planPrizes(scope, config, payments = [], ledgers = []) {
  if(config?.model)return require('./componentPrizePlan').planComponentPrizes(scope,config,payments,ledgers);
  const blocked = [];
  if (!config) return { state: 'blocked', blocking_reasons: ['Original prize configuration is unavailable; current defaults are not historical evidence'], obligations: [] };
  const positions = new Set();
  for (const row of config) { if (!Number.isInteger(row.position) || row.position < 1 || positions.has(row.position)) blocked.push('Prize positions are invalid or duplicated'); positions.add(row.position); }
  const positive = config.filter(r => cents(r.amount) > 0n);
  if (cents(scope.root.prize_pool_stc ?? 0) > 0n && positive.reduce((sum,r)=>sum+cents(r.amount),0n) > cents(scope.root.prize_pool_stc)) blocked.push('Configured prizes exceed the funded prize pool');
  if (!positive.length) return { state: 'zero_prize', blocking_reasons: blocked, obligations: [] };
  const placed = placements(scope, config);
  if (placed.blocked) blocked.push(placed.blocked);
  const participantType = scope.root.participant_type === 'player' ? 'player' : 'club';
  const obligations = positive.map(row => {
    const recipient = placed.map.get(row.position);
    const key = `prize:${scope.source_type}:${scope.root.id}:${scope.edition_id}:${row.position}`;
    const existing = payments.find(p => p.idempotency_key === key || Number(p.position_no) === row.position);
    const proven = ledgers.filter(l => String(l[`${participantType}_id`]) === String(recipient) && (l.settlement_key === key || scope.legacy_references.includes(l.reference_id)));
    const reasons = [];
    if (!recipient) reasons.push('Paid finishing position is unresolved');
    if (existing && (String(existing[`${participantType}_id`]) !== String(recipient) || cents(existing.amount_stc) !== cents(row.amount))) reasons.push('Existing obligation differs from current result/configuration; authorised review required');
    const uncertain = ledgers.filter(l => String(l[`${participantType}_id`]) === String(recipient) && !l.settlement_key && !scope.legacy_references.includes(l.reference_id) && (!l.reference_id || scope.ambiguous_legacy_references?.includes(l.reference_id) || String(l.description || '').toLowerCase().includes(String(scope.root.name || scope.root.competition_name || '<unknown>').toLowerCase())));
    if (uncertain.length) reasons.push('Ambiguous legacy prize transactions require review');
    if (proven.some(l=>!/^\d+(\.\d{1,2})?$/.test(String(l.amount)))) reasons.push('A legacy reversal or invalid payment amount requires authorised financial review');
    const paid = proven.filter(l=>/^\d+(\.\d{1,2})?$/.test(String(l.amount))).reduce((sum,l) => sum + cents(l.amount), 0n);
    if (existing?.status === 'paid' && !proven.some(l => l.id === existing.ledger_transaction_id)) reasons.push('Paid obligation has no matching ledger proof');
    if (paid > cents(row.amount)) reasons.push('Legacy payments exceed this obligation');
    const missing = paid < cents(row.amount) ? cents(row.amount) - paid : 0n;
    const profile = scope.participants.find(p=>String(p.id) === String(recipient));
    return { position: row.position, recipient_id: recipient || null, recipient_name:profile?.name || profile?.gamertag || null, recipient_type: participantType, expected_amount: row.amount, proven_payment: stc(paid), missing_amount: stc(missing), key, blocking_reasons: reasons, ledger_ids: proven.map(l => l.id) };
  });
  const anyBlocked = blocked.length || obligations.some(o => o.blocking_reasons.length);
  const due = obligations.some(o => cents(o.missing_amount) > 0n);
  return { state: anyBlocked ? 'blocked' : !due ? 'paid' : obligations.some(o => cents(o.proven_payment) > 0n) ? 'partially_paid' : 'unpaid', blocking_reasons: blocked, obligations };
}
module.exports = { cents, stc, configuredPrizes, placements, planPrizes, parse };
