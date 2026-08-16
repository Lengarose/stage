const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPhaseBoard,
  clubStoryKind,
  currentPhaseStamp,
  isLeagueCompetition,
  isPublishedToday,
  newsSectionForTournament,
  participatingCountries,
  phaseLabel,
  playerStoryKind,
  storyBeat,
  tournamentFieldCard,
  tournamentKickoffCopy,
} = require('../newsFeedService');

test('knockout cups land in Tournaments, leagues in Competitions', () => {
  assert.equal(newsSectionForTournament({ type: 'knockout' }), 'tournament');
  assert.equal(newsSectionForTournament({ type: 'swiss_ucl' }), 'tournament');
  assert.equal(isLeagueCompetition({ type: 'league_36_8md' }), true);
  assert.equal(newsSectionForTournament({ type: 'league_36_8md' }), 'competitions');
  assert.equal(phaseLabel('quarter_final'), 'the quarter-finals');
  assert.equal(phaseLabel('final'), 'the final');
});

test('club desk kinds stay off mercato: stadium, shirts, tickets, issued contracts', () => {
  assert.equal(clubStoryKind({ type: 'stadium', title: 'Hooded upgraded to Arena II' }), 'stadium');
  assert.equal(clubStoryKind({ type: 'shirts', title: 'Hooded sold 12,000 shirts' }), 'shirts');
  assert.equal(clubStoryKind({ type: 'tickets', title: 'Hooded sold 8,400 tickets' }), 'tickets');
  assert.equal(clubStoryKind({ type: 'contracts', title: 'Hooded offered a contract to Neo' }), 'contract');
  assert.equal(clubStoryKind({ type: 'trophy', title: 'Hooded lifted the STAGE Cup trophy' }), 'trophy');
  assert.equal(storyBeat({ type: 'stadium', tags: '["club_news"]' }), 'club_news');
  assert.equal(storyBeat({ type: 'tickets', category: 'tickets' }), 'club_news');
});

test('player desk kinds are lifestyle, ranking, signed and MOTM', () => {
  assert.equal(playerStoryKind({ type: 'lifestyle', title: 'Neo bought a penthouse' }), 'lifestyle');
  assert.equal(playerStoryKind({ type: 'ranking', title: 'Neo leads the STAGE ranking' }), 'ranking');
  assert.equal(playerStoryKind({ type: 'motm', title: 'Neo named man of the match' }), 'motm');
  assert.equal(playerStoryKind({ type: 'contracts', title: 'Neo joined Hooded F.C.' }), 'signed');
  assert.equal(storyBeat({ type: 'motm', category: 'motm' }), 'player_news');
  assert.equal(storyBeat({ type: 'contract', category: 'contracts', title: 'Neo joined Hooded F.C.' }), 'player_news');
});

test('daily news is the same-day mix, not leftover commentary', () => {
  assert.equal(isPublishedToday('2026-08-15T09:00:00.000Z', new Date('2026-08-15T23:00:00.000Z')), true);
  assert.equal(isPublishedToday('2026-08-14T23:00:00.000Z', new Date('2026-08-15T01:00:00.000Z')), false);
});

test('tournament kickoff copy names countries and the cup', () => {
  const body = tournamentKickoffCopy(
    { name: 'STAGE Cup', participant_type: 'club' },
    {
      entries: 16,
      countries: [{ code: 'BE' }, { code: 'FR' }, { code: 'NL' }],
      trophyName: 'The Harbor Cup',
    },
  );
  assert.match(body, /16 participating clubs/);
  assert.match(body, /3 countries/);
  assert.match(body, /BE, FR, NL/);
  assert.match(body, /Harbor Cup/);
});

test('phase board lists who advanced and the champion stamp', () => {
  const phases = buildPhaseBoard([
    { id: '1', type: 'knockout_qf', home_club_name: 'A', away_club_name: 'B', winner_club_name: 'A', home_score: 2, away_score: 1, status: 'completed' },
    { id: '2', type: 'knockout_qf', home_club_name: 'C', away_club_name: 'D', winner_club_name: 'C', home_score: 1, away_score: 0, status: 'completed' },
    { id: '3', type: 'knockout_sf', home_club_name: 'A', away_club_name: 'C', winner_club_name: 'A', status: 'completed' },
  ]);
  assert.equal(phases[0].stamp, 'QF');
  assert.deepEqual(phases[0].advancers, ['A', 'C']);
  assert.equal(phases[1].stamp, 'SF');
  const field = tournamentFieldCard(
    { id: 't1', name: 'STAGE Cup', status: 'completed', winner_club_name: 'A', registered_clubs: '["c1","c2"]' },
    {
      countries: participatingCountries([{ country_code: 'BE' }, { country_code: 'BE' }, { country_code: 'FR' }]),
      matches: [{ id: '3', type: 'final', winner_club_name: 'A', home_club_name: 'A', away_club_name: 'C' }],
      trophyName: 'Harbor Cup',
    },
  );
  assert.equal(field.stamp, 'CHAMPION');
  assert.equal(field.country_count, 2);
  assert.equal(field.trophy_name, 'Harbor Cup');
  assert.equal(currentPhaseStamp({ status: 'in_progress' }, [{ type: 'knockout_r16' }]), 'knockout_r16');
});
