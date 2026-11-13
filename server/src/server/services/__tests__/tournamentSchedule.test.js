'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const schedules=require('../tournamentScheduleService');
const entry={phase:'league',round:1,starts_at:'2027-03-28T18:00:00+02:00',ends_at:'2027-03-28T18:40:00+02:00'};
test('schedule times retain an unambiguous instant across DST and require a complete match block',()=>{const s=schedules.validate({mode:'fixed',timezone:'Europe/Brussels',entries:[entry]});assert.equal(s.entries[0].starts_at,'2027-03-28T16:00:00.000Z');assert.throws(()=>schedules.validate({mode:'fixed',timezone:'Europe/Brussels',entries:[{...entry,ends_at:'2027-03-28T18:39:00+02:00'}]}),/room/);assert.throws(()=>schedules.validate({mode:'fixed',timezone:'Europe/Brussels',entries:[entry,entry]}),/unique/);});
test('a full draw rejects overlapping fixtures of a participant before any write; adjacent fixtures are allowed',()=>{const first={id:'one',type:'league',home_player_id:'p',away_player_id:'q',scheduled_date:'2027-03-28 16:00:00',timezone:'UTC'},second={...first,id:'two',away_player_id:'r',scheduled_date:'2027-03-28 16:30:00'};assert.throws(()=>schedules.assertDraw([first,second]),/overlapping/);schedules.assertDraw([first,{...second,scheduled_date:'2027-03-28 16:40:00'}]);});
test('accepted conditions and protected participation fields cannot be rewritten through benign tournament editing',()=>{const t={schedule_policy_version:schedules.VERSION,registered_players:'["p"]',prize_pool_stc:100};assert.throws(()=>schedules.assertTermsEditable(t,{prize_pool_stc:200}),/accepted/);assert.throws(()=>schedules.assertTermsEditable(t,{registered_players:[]}),/protected/);schedules.assertTermsEditable(t,{prize_pool_stc:100});schedules.assertTermsEditable(t,{description:'Updated description'});});

test('legacy group_stage schedule keys match actual group fixtures and aliases cannot duplicate a round', () => {
  const e = { ...entry, phase: 'group_stage' };
  assert.equal(schedules.validate({ mode: 'fixed', timezone: 'Europe/Brussels', entries: [e] }).entries[0].phase, 'group');
  assert.throws(() => schedules.validate({ mode: 'fixed', timezone: 'Europe/Brussels', entries: [e, { ...e, phase: 'group' }] }), /unique/);
});

const { roundPlan, assertRoundPlan } = require('../../lib/tournamentSchedulePlan');
test('16-club group schedule has all three matchdays, both knockout legs, final and third place', () => {
  const t = { type: 'group_stage', max_teams: 16 };
  const rows = roundPlan(t);
  assert.deepEqual(rows.map(e => `${e.phase}:${e.round}`), ['group:1', 'group:2', 'group:3', 'quarter_final:4', 'quarter_final:5', 'semi_final:6', 'semi_final:7', 'final:8', 'third_place:8']);
  const filled = rows.map(e => ({ ...e, starts_at: new Date(Date.UTC(2027, 0, e.round, 19)).toISOString(), ends_at: new Date(Date.UTC(2027, 0, e.round, 19, e.minutes)).toISOString() }));
  assertRoundPlan(t, filled);
  assert.throws(() => assertRoundPlan(t, filled.slice(1)), /missing/);
  assert.throws(() => assertRoundPlan(t, filled.map(e => ({ ...e, starts_at: filled[0].starts_at, ends_at: filled[0].ends_at }))), /overlapping/);
});
test('league, knockout and Swiss schedules match their formats', () => {
  assert.equal(roundPlan({ type: 'league', max_teams: 20 }).length, 38);
  assert.deepEqual(roundPlan({ type: 'knockout', max_teams: 16 }).map(e => e.phase), ['round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place']);
  const swiss = roundPlan({ type: 'swiss_ucl', max_teams: 36 });
  assert.equal(swiss.length, 17); assert.equal(swiss.at(-1).phase, 'final'); assert(!swiss.some(e => e.phase === 'third_place'));
});
test('every qualified fixture in an entire group tournament has a published round slot', () => {
  const { roundRobin } = require('../../lib/regionalStructure');
  const { planTournamentProgression } = require('../../lib/tournamentProgression');
  for (const count of [8, 16, 24, 32]) {
    const t = { type: 'group_stage', max_teams: count, num_groups: count / 4, status: 'in_progress', participant_type: 'club' };
    const slots = roundPlan(t); let rows = [], serial = 0;
    for (let g = 0; g < t.num_groups; g++) {
      const ids = Array.from({ length: 4 }, (_, i) => `g${g}p${i}`);
      for (const f of roundRobin(ids, 'test')) rows.push({ id: `m${serial++}`, type: 'group', round: f.round, group_number: g, home_club_id: f.home, away_club_id: f.away, home_club_name: f.home, away_club_name: f.away, home_score: ids.indexOf(f.home) < ids.indexOf(f.away) ? 5 : 0, away_score: ids.indexOf(f.home) < ids.indexOf(f.away) ? 0 : 1, status: 'completed', result_state: 'CONFIRMED' });
    }
    let done = false;
    for (let step = 0; step < 12; step++) {
      const p = planTournamentProgression(t, rows, a => a);
      assert.deepEqual(p.conflicts, [], `${count} clubs: no unexpected progression conflicts`);
      if (p.completed) { done = true; break; }
      assert(p.fixtures.length, `${count} clubs: progression must advance`);
      for (const f of p.fixtures) {
        assert(slots.some(s => s.phase === f.type && s.round === f.round), `${count} clubs: missing ${f.type}:${f.round}`);
        rows.push({ id: `m${serial++}`, ...f, home_club_id: f.home?.id, away_club_id: f.away?.id, home_club_name: f.home?.name, away_club_name: f.away?.name, home_score: f.round % 2 ? 0 : 3, away_score: f.round % 2 ? 1 : 0, status: f.bye ? 'bye' : 'completed', result_state: 'CONFIRMED' });
      }
    }
    assert(done, `${count} clubs: reaches final completion`);
  }
});
