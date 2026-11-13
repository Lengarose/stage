'use strict';
// Schedule keys are fixture types, not tournament format names.
const canonicalPhase = phase => ['group_stage', 'group'].includes(phase) ? 'group' : phase;
const knockoutType = ties => ties >= 32 ? 'round_of_64' : ties >= 16 ? 'round_of_32' : ties > 4 ? 'round_of_16' : ties > 2 ? 'quarter_final' : ties === 2 ? 'semi_final' : 'final';
const names = { league: 'League', group: 'Group stage', round_of_64: 'Round of 64', round_of_32: 'Round of 32', round_of_16: 'Round of 16', quarter_final: 'Quarterfinal', semi_final: 'Semifinal', final: 'Final', third_place: 'Third-place playoff', ucl_league: 'League phase', ucl_playoff: 'Qualification playoff', ucl_r16: 'Round of 16', ucl_qf: 'Quarterfinal', ucl_sf: 'Semifinal' };
function roundPlan(t) {
  const count = Math.max(2, Number(t.max_teams) || 8);
  const rows = [];
  let round = 1;
  function add(phase, label, minutes = 60) { rows.push({ phase, round: round++, label, minutes }); }
  if (t.type === 'league') {
    const perLeg = count % 2 ? count : count - 1;
    for (let n = 1; n <= perLeg * 2; n++) add('league', `League matchday ${n}`, 40);
    return rows;
  }
  if (t.type === 'swiss_ucl') {
    for (let n = 1; n <= 8; n++) add('ucl_league', `League phase · Matchday ${n}`, 40);
    for (const phase of ['ucl_playoff', 'ucl_r16', 'ucl_qf', 'ucl_sf']) for (let leg = 1; leg <= 2; leg++) add(phase, `${names[phase]} · Leg ${leg}`);
    add('final', 'Final');
    return rows;
  }
  let qualifiers = count;
  if (t.type === 'group_stage') {
    const groups = Math.ceil(count / 4), size = Math.ceil(count / groups);
    const matchdays = size % 2 ? size : size - 1;
    for (let n = 1; n <= matchdays; n++) add('group', `Group stage · Matchday ${n}`, 40);
    if (Number(t.knockout_enabled ?? 1) === 0) return rows;
    qualifiers = groups * 2;
  }
  let hadSemifinal = false;
  while (qualifiers > 1) {
    const ties = Math.ceil(qualifiers / 2), phase = knockoutType(ties);
    const legs = phase === 'final' ? 1 : t.type === 'group_stage' ? Number(t.knockout_legs || 2) : 1;
    for (let leg = 1; leg <= legs; leg++) add(phase, names[phase] + (legs > 1 ? ` · Leg ${leg}` : ''));
    if (phase === 'semi_final') hadSemifinal = qualifiers === 4;
    qualifiers = ties;
  }
  if (hadSemifinal) rows.push({ phase: 'third_place', round: round - 1, label: 'Third-place playoff', minutes: 60 });
  return rows;
}
function assertRoundPlan(t, entries) {
  const expected = roundPlan(t);
  const keys = new Set(entries.map(e => `${canonicalPhase(e.phase)}:${e.round}`));
  const missing = expected.filter(e => !keys.has(`${e.phase}:${e.round}`));
  const extra = entries.filter(e => !expected.some(r => r.phase === canonicalPhase(e.phase) && r.round === e.round));
  if (missing.length || extra.length) throw Object.assign(new Error(missing.length ? `Schedule is missing: ${missing.map(e => e.label).join(', ')}.` : 'Schedule contains rounds outside this tournament format.'), { status: 422 });
  // The final and third-place playoff may run together; successive rounds may not overlap.
  for (const a of entries) for (const b of entries) if (a.round < b.round && Date.parse(a.ends_at) > Date.parse(b.starts_at)) throw Object.assign(new Error('Schedule rounds must run in order without overlapping. Leave time for results before the next round.'), { status: 422 });
  return expected;
}
module.exports = { canonicalPhase, knockoutType, roundPlan, assertRoundPlan };
