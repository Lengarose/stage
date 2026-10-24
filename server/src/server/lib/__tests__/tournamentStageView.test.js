'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildStageCatalogue,
  presentStageMatches,
  pageStageMatches,
  parseStagePage,
  stageStandings,
  participantCanScheduleMatch,
  publicStage,
} = require('../tournamentStageView');

const keys = (tournament, matches) => buildStageCatalogue(tournament, matches).map((stage) => stage.key);
const confirmed = (extra) => ({ status: 'completed', result_state: 'confirmed', home_score: 1, away_score: 0, ...extra });

test('player and club knockout catalogues keep future rounds and third place', () => {
  const matches = [{ id: 'one', type: 'knockout', round: 1, status: 'scheduled', home_player_id: 'p1', away_player_id: 'p2' }];
  const player = buildStageCatalogue({ id: 'cup', type: 'knockout', participant_type: 'player', max_teams: 8, status: 'in_progress' }, matches);
  assert.deepEqual(player.map((stage) => stage.key), ['qf', 'sf', 'third', 'final']);
  assert.equal(player[0].status, 'fixtures_available');
  assert.equal(player[1].status, 'awaiting_qualification');
  assert.equal(player[1].reason.message, 'Awaiting qualification from the previous stage.');
  assert.equal(player[1].previous_stage_key, 'qf');
  assert.equal(player[1].next_stage_key, 'third');
  assert.equal(player[0].matches.length, 1);
  assert.deepEqual(keys({ type: 'knockout', participant_type: 'club', max_teams: 8 }, []), ['qf', 'sf', 'third', 'final']);
  assert.equal(buildStageCatalogue({ type: 'knockout', max_teams: 8, status: 'registration' }, []).every((stage, index) => stage.status === (index === 0 ? 'draw_not_made' : 'awaiting_qualification')), true);
  assert.equal(buildStageCatalogue({ type: 'knockout', max_teams: 8, status: 'registration' }, [])[0].reason.message, 'Draw not made yet.');
  const clubNext = buildStageCatalogue({ type: 'knockout', participant_type: 'club', max_teams: 8, status: 'in_progress' }, matches)[1];
  assert.equal(clubNext.reason.code, 'awaiting_round_completion');
  assert.equal(clubNext.reason.message, 'Awaiting completion of the previous round before the draw.');
});

test('knockout does not invent UCL stages and a final stays single-legged', () => {
  const stages = buildStageCatalogue({ type: 'knockout', max_teams: 2, status: 'registration' }, []);
  assert.deepEqual(stages.map((stage) => stage.key), ['final']);
  assert.equal(stages[0].two_legged, false);
  assert.equal(stages[0].legs, 1);
  assert.equal(stages.some((stage) => stage.key === 'playoff'), false);
});

test('two-legged stage groups both legs without creating a second final leg', () => {
  const matches = [3, 4].map((round) => ({
    id: `qf-${round}`,
    type: 'quarter_final',
    round,
    group_number: 0,
    status: round === 3 ? 'completed' : 'scheduled',
    result_state: round === 3 ? 'confirmed' : null,
    home_club_id: round === 3 ? 'a' : 'b',
    away_club_id: round === 3 ? 'b' : 'a',
    home_score: round === 3 ? 2 : null,
    away_score: round === 3 ? 1 : null,
  }));
  const stages = buildStageCatalogue({ type: 'group_stage', max_teams: 16, num_groups: 4, status: 'in_progress', knockout_enabled: 1 }, matches);
  const quarter = stages.find((stage) => stage.key === 'qf');
  assert.equal(quarter.two_legged, true);
  assert.equal(quarter.matches.length, 2);
  const rows = presentStageMatches(quarter, { id: 't', participant_type: 'club' }, new Map(), null, new Map());
  assert.deepEqual(rows.map((row) => row.leg_label), ['First leg', 'Second leg']);
  assert.equal(rows[0].home.id, 'a');
  assert.equal(rows[1].home.id, 'b');
  assert.equal(rows[0].aggregate, null);
  const final = buildStageCatalogue({ type: 'knockout', max_teams: 2 }, [{ id: 'f', type: 'final', round: 1, status: 'scheduled' }])[0];
  assert.equal(presentStageMatches(final, { participant_type: 'club' }, new Map(), null, new Map())[0].leg, null);
});

test('group, league, and UCL catalogues come from the tournament format', () => {
  assert.equal(keys({ type: 'group_stage', max_teams: 16, num_groups: 4 }, [])[0], 'group');
  assert.deepEqual(keys({ type: 'group_stage', knockout_enabled: 0, max_teams: 8 }, []), ['group']);
  assert.deepEqual(keys({ type: 'league', max_teams: 8 }, []), ['league']);
  assert.deepEqual(keys({ type: 'swiss_ucl', max_teams: 36 }, []), ['league', 'playoff', 'r16', 'qf', 'sf', 'final']);
  assert.equal(keys({ type: 'league', max_teams: 8 }, []).includes('playoff'), false);
  const preview = buildStageCatalogue({ type: 'knockout', max_teams: 4, status: 'registration' }, [
    { id: 'sf', type: 'knockout', round: 1, status: 'scheduled', home_club_id: 'a', away_club_id: 'b' },
  ]);
  assert.equal(preview[0].status, 'draw_preview');
  assert.equal(preview[0].fixture_state, 'preview');
  assert.equal(preview[0].reason.message, 'Draw preview — tournament has not started yet.');
});

test('a partly played stage separates fixtures, confirmed results, and unconfirmed scores', () => {
  const matches = [
    confirmed({ id: 'done', type: 'knockout', round: 1, home_club_id: 'a', away_club_id: 'b', home_score: 2, away_score: 0 }),
    { id: 'open', type: 'knockout', round: 1, status: 'scheduled', home_club_id: 'c', away_club_id: 'd' },
    { id: 'pending', type: 'knockout', round: 1, status: 'awaiting_confirmation', home_club_id: 'e', away_club_id: 'f', home_score: 3, away_score: 1 },
    { id: 'fight', type: 'knockout', round: 1, status: 'disputed', home_club_id: 'g', away_club_id: 'h', home_score: 1, away_score: 1 },
    { id: 'gone', type: 'knockout', round: 1, status: 'cancelled', home_club_id: 'i', away_club_id: 'j' },
  ];
  const stage = buildStageCatalogue({ type: 'knockout', max_teams: 8, status: 'in_progress' }, matches)[0];
  assert.equal(stage.status, 'in_progress');
  const rows = presentStageMatches(stage, { id: 't', participant_type: 'club' }, new Map(), null, new Map());
  assert.equal(rows.find((row) => row.id === 'done').classification, 'result');
  assert.deepEqual(rows.find((row) => row.id === 'done').score, { home: 2, away: 0 });
  assert.equal(rows.find((row) => row.id === 'pending').score, null);
  assert.equal(rows.find((row) => row.id === 'pending').classification, 'unconfirmed');
  assert.equal(pageStageMatches(rows, { classification: 'fixtures', limit: 20, offset: 0 }).total, 1);
  assert.equal(pageStageMatches(rows, { classification: 'results', limit: 20, offset: 0 }).total, 1);
  const unresolved = pageStageMatches(rows, { classification: 'unresolved', limit: 20, offset: 0 });
  assert.deepEqual(unresolved.matches.map((row) => row.id), ['fight', 'gone', 'pending']);
  const emptyResults = buildStageCatalogue({ type: 'knockout', max_teams: 8, status: 'in_progress' }, [
    { id: 'only', type: 'knockout', round: 1, status: 'scheduled' },
  ])[0];
  assert.equal(emptyResults.result_count, 0);
  assert.equal(emptyResults.status, 'fixtures_available');
  const finished = buildStageCatalogue({ type: 'knockout', max_teams: 2, status: 'in_progress' }, [
    confirmed({ id: 'final', type: 'final', round: 1 }),
  ])[0];
  assert.equal(finished.fixture_count, 0);
  assert.equal(finished.status, 'completed');
});

test('pagination is bounded and does not skip rows that share a round', () => {
  const matches = ['b', 'a', 'c'].map((id) => ({ id, type: 'knockout', round: 1, group_number: 1, status: 'scheduled' }));
  const stage = buildStageCatalogue({ type: 'knockout', max_teams: 8, status: 'in_progress' }, matches)[0];
  const rows = presentStageMatches(stage, { participant_type: 'club' }, new Map(), null, new Map());
  const first = pageStageMatches(rows, { classification: 'all', limit: 2, offset: 0 });
  const second = pageStageMatches(rows, { classification: 'all', limit: 2, offset: 2 });
  assert.deepEqual(first.matches.map((row) => row.id), ['a', 'b']);
  assert.equal(first.has_more, true);
  assert.deepEqual(second.matches.map((row) => row.id), ['c']);
  assert.equal(second.has_more, false);
  assert.equal(first.total, 3);
  assert.throws(() => parseStagePage({ limit: '0' }), /limit/);
  assert.throws(() => parseStagePage({ classification: 'bracket' }), /classification/);
});

test('unknown opponents stay placeholders and preview pairings stay distinct from active fixtures', () => {
  const stage = buildStageCatalogue({ id: 't', type: 'knockout', max_teams: 4, status: 'registration' }, [
    { id: 'preview', type: 'knockout', round: 1, status: 'scheduled', home_club_id: 'a', home_club_name: 'Alpha' },
  ])[0];
  const [row] = presentStageMatches(stage, { id: 't', participant_type: 'club' }, new Map([['a', { name: 'Alpha', badge: 'logo.png' }]]), null, new Map());
  assert.equal(row.preview, true);
  assert.equal(row.fixture_state, 'preview');
  assert.equal(row.home.badge, 'logo.png');
  assert.equal(row.away.placeholder, true);
  assert.equal(row.away.id, null);
  assert.equal(row.can_schedule, undefined);
  assert.equal(publicStage(stage).matches, undefined);
});

test('group standings reuse confirmed progression points and ignore unconfirmed scores', () => {
  const matches = [
    confirmed({ id: 'g1', type: 'group', round: 1, group_number: 0, home_club_id: 'a', away_club_id: 'b', home_club_name: 'A', away_club_name: 'B', home_score: 2, away_score: 0 }),
    { id: 'g2', type: 'group', round: 1, group_number: 0, status: 'awaiting_confirmation', home_club_id: 'a', away_club_id: 'c', home_score: 9, away_score: 0 },
  ];
  const stage = buildStageCatalogue({ type: 'group_stage', max_teams: 4, num_groups: 1, knockout_enabled: 0, status: 'in_progress' }, matches)[0];
  const table = stageStandings({ type: 'group_stage', participant_type: 'club', knockout_enabled: 0 }, stage, new Map());
  assert.equal(table.source, 'tournament_progression.standings');
  assert.equal(table.groups[0].rows.find((row) => row.id === 'a').points, 3);
  assert.equal(table.groups[0].rows.find((row) => row.id === 'c').points, 0);
  assert.equal(table.groups[0].rows.find((row) => row.id === 'a').qualification, null);
});

test('scheduling permission follows the home player or home club president/owner', () => {
  const match = { status: 'scheduled', home_player_id: 'p1', away_player_id: 'p2', home_club_id: 'c1', away_club_id: 'c2' };
  const club = { id: 'c1', president_user_id: 'boss', user_id: 'owner', owner_email: 'owner@club.test' };
  assert.equal(participantCanScheduleMatch({ match, auth: { userId: 'u', playerId: 'p1' }, homeClub: null }), true);
  assert.equal(participantCanScheduleMatch({ match, auth: { userId: 'u', playerId: 'p2' }, homeClub: null }), false);
  assert.equal(participantCanScheduleMatch({ match: { ...match, home_player_id: null }, auth: { userId: 'boss', playerId: 'member' }, homeClub: club }), true);
  assert.equal(participantCanScheduleMatch({ match: { ...match, home_player_id: null }, auth: { userId: 'owner' }, homeClub: club }), true);
  assert.equal(participantCanScheduleMatch({ match: { ...match, home_player_id: null }, auth: { userId: 'guest', email: 'owner@club.test' }, homeClub: club }), true);
  assert.equal(participantCanScheduleMatch({ match: { ...match, home_player_id: null }, auth: { userId: 'member', playerId: 'member' }, homeClub: club }), false);
  assert.equal(participantCanScheduleMatch({ match: { ...match, home_player_id: null, home_club_id: 'c2' }, auth: { userId: 'boss' }, homeClub: { id: 'c2', president_user_id: 'away-boss' } }), false);
  assert.equal(participantCanScheduleMatch({ match: { ...match, status: 'completed', result_state: 'confirmed' }, auth: { userId: 'u', playerId: 'p1' } }), false);
  assert.equal(participantCanScheduleMatch({ match: { ...match, scheduling_status: 'home_proposed' }, auth: { userId: 'u', playerId: 'p1' } }), false);
  assert.equal(participantCanScheduleMatch({ match: { ...match, away_player_id: null }, auth: { userId: 'u', playerId: 'p1' } }), false);
});
