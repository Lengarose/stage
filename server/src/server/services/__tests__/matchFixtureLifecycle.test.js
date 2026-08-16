const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isPlayerManagedMatch,
  canRequestMatchCancel,
  canConfirmMatchCancel,
  resolveMatchOpponent,
  applyConfirmedCancelPatch,
} = require('../matchFixtureLifecycle');

const arrangedSolo = {
  id: 'match-1',
  status: 'scheduled',
  mode: 'solo',
  type: 'ranked',
  tournament_id: null,
  source_fixture_type: null,
  home_player_id: 'p-home',
  away_player_id: 'p-away',
  home_player_email: 'home@example.test',
  away_player_email: 'away@example.test',
  home_player_name: 'HomeTag',
  away_player_name: 'AwayTag',
};

test('arranged player matches are player-managed; league fixtures are not', () => {
  assert.equal(isPlayerManagedMatch(arrangedSolo), true);
  assert.equal(isPlayerManagedMatch({
    ...arrangedSolo,
    source_fixture_type: 'regional_league',
    tournament_id: 'league-1',
  }), false);
  assert.equal(isPlayerManagedMatch({
    ...arrangedSolo,
    source_fixture_type: 'competition_engine',
  }), false);
});

test('one player cannot cancel a scheduled arranged match without the opponent', () => {
  const home = { email: 'home@example.test', playerId: 'p-home' };
  assert.equal(canRequestMatchCancel(arrangedSolo, home), true);
  assert.equal(canConfirmMatchCancel(arrangedSolo, home), false);
  assert.deepEqual(applyConfirmedCancelPatch(arrangedSolo).status, 'cancelled');
  assert.notEqual(arrangedSolo.status, 'cancelled');
});

test('the opponent must confirm a pending cancel before the match is deleted', () => {
  const pending = {
    ...arrangedSolo,
    cancel_status: 'pending',
    cancel_requested_by: 'home@example.test',
  };
  const home = { email: 'home@example.test', playerId: 'p-home' };
  const away = { email: 'away@example.test', playerId: 'p-away' };
  assert.equal(canRequestMatchCancel(pending, home), false);
  assert.equal(canConfirmMatchCancel(pending, home), false);
  assert.equal(canConfirmMatchCancel(pending, away), true);
  assert.deepEqual(resolveMatchOpponent(pending, home), {
    email: 'away@example.test',
    name: 'AwayTag',
    playerId: 'p-away',
    clubId: null,
  });
});

test('in-progress and official fixtures cannot be player-deleted', () => {
  assert.equal(canRequestMatchCancel({ ...arrangedSolo, status: 'in_progress' }, { email: 'home@example.test', playerId: 'p-home' }), false);
  assert.equal(canRequestMatchCancel({
    ...arrangedSolo,
    source_fixture_type: 'regional_league',
  }, { email: 'home@example.test', playerId: 'p-home' }), false);
});
